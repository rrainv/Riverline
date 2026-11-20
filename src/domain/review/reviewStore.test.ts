import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEngineClient } from '../../engine-api';
import { createHandRecorderStore } from '../hand';
import { createMemoryStudyBackend, createStudyRepository } from '../storage';
import { createReviewStore } from './reviewStore';

describe('reviewStore', () => {
  const disposers: Array<() => void> = [];

  afterEach(() => {
    while (disposers.length > 0) {
      disposers.pop()?.();
    }
  });

  it('enforces replay privacy fences with no backward card leakage on earlier frames', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createReviewStore({ engine, repository: repo, autoLoadSaved: false });
    disposers.push(() => store.dispose(), () => engine.dispose());

    const snap = store.replaySnapshotSignal.value;
    expect(snap.decisions.length).toBe(3);

    // Early frame (preflop after hole deal): BB QsQc must stay hidden
    store.jumpToFrame(1);
    const earlyState = store.currentPokerStateSignal.value;
    const bbEarly = earlyState.players.find((p) => p.playerId === 'seat-2');
    expect(Array.isArray(bbEarly?.holeCards)).toBe(false);
    expect(bbEarly?.holeCards).toMatchObject({ status: 'hidden', cardCount: 2 });

    // Flop all-in decision frame: villain cards must STILL stay hidden
    const dec3 = snap.decisions[2]!;
    store.jumpToFrame(dec3.actionFrameIndex);
    const flopState = store.currentPokerStateSignal.value;
    const bbFlop = flopState.players.find((p) => p.playerId === 'seat-2');
    expect(Array.isArray(bbFlop?.holeCards)).toBe(false);
    expect(bbFlop?.holeCards).toMatchObject({ status: 'hidden', cardCount: 2 });

    // Final showdown frame: BB QsQc are revealed
    store.jumpToFrame(snap.frames.length - 1);
    const finalState = store.currentPokerStateSignal.value;
    const bbFinal = finalState.players.find((p) => p.playerId === 'seat-2');
    expect(bbFinal?.holeCards).toEqual(['Qs', 'Qc']);
  });

  it('computes exact Section 8 callVsFoldEvBb (-38.8) and handEvBb (-48.8) alongside luck (-51.2) and actual (-100)', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createReviewStore({ engine, repository: repo, autoLoadSaved: false });
    disposers.push(() => store.dispose(), () => engine.dispose());

    await vi.waitFor(() => {
      expect(store.decisionEvaluationSignal.value.isLoading).toBe(false);
      expect(store.decisionsVsLuckSignal.value.isLoading).toBe(false);
    });

    const evalDec = store.decisionEvaluationSignal.value;
    expect(evalDec.tier).toBe('exact');
    expect(evalDec.requiredEquityPct).toBe(45);
    expect(evalDec.heroEquityPct).toBe(25.6);
    expect(evalDec.isMathMistake).toBe(true);

    const luck = store.decisionsVsLuckSignal.value;
    expect(luck.tier).toBe('exact');
    expect(luck.isAvailable).toBe(true);
    expect(luck.showdownHeroEquityPct).toBe(25.6);
    expect(luck.decisiveCallNeededPct).toBe(45);
    expect(luck.callVsFoldEvBb).toBe(-38.8);
    expect(luck.handEvBb).toBe(-48.8);
    expect(luck.runoutLuckBb).toBe(-51.2);
    expect(luck.actualNetBb).toBe(-100);
  });

  it('switches Decision panel to Estimated counterfactual range while keeping Decisions vs luck on Exact', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createReviewStore({ engine, repository: repo, autoLoadSaved: false });
    disposers.push(() => store.dispose(), () => engine.dispose());

    await vi.waitFor(() => {
      expect(store.decisionsVsLuckSignal.value.isLoading).toBe(false);
    });

    store.setCounterfactualRange('loose');
    await vi.waitFor(
      () => {
        expect(store.decisionEvaluationSignal.value.mode).toBe('loose');
        expect(store.decisionEvaluationSignal.value.isLoading).toBe(false);
        expect(store.decisionEvaluationSignal.value.heroEquityPct).not.toBeNull();
      },
      { timeout: 5000 },
    );

    const evalLoose = store.decisionEvaluationSignal.value;
    expect(evalLoose.tier).toBe('estimated');
    expect(evalLoose.detailKey).toBe('opponent_assumption');
    expect(evalLoose.isMathMistake).toBe(false);
    expect(evalLoose.villainRangeSpec?.rangeMatrix.length).toBe(13);
    expect(evalLoose.villainRangeSpec?.removedCombos).toBeGreaterThan(0);

    // Decisions vs luck remains locked to Exact showdown truth
    expect(store.decisionsVsLuckSignal.value.tier).toBe('exact');
    expect(store.decisionsVsLuckSignal.value.callVsFoldEvBb).toBe(-38.8);
    expect(store.decisionsVsLuckSignal.value.handEvBb).toBe(-48.8);
  });

  it('opens hands saved from /hand, handles incomplete spots honestly, and persists annotations/tags/archive/restore', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const recorder = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });
    const review = createReviewStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      includeStarterSamples: false,
    });
    disposers.push(() => recorder.dispose(), () => review.dispose(), () => engine.dispose());

    // Record a mid-hand spot in /hand and save
    expect(recorder.confirmTicketAction()).toBe(true); // Hero raises 2.5 bb
    const savedSpot = await recorder.saveCurrentHand();
    expect(savedSpot.payload.savedKind).toBe('mid_hand_spot');

    await review.refreshSavedLibrary();
    expect(review.savedLibraryItemsSignal.value).toHaveLength(1);

    review.openSavedHand(savedSpot);
    await vi.waitFor(() => {
      expect(review.decisionsVsLuckSignal.value.isLoading).toBe(false);
      expect(review.decisionEvaluationSignal.value.isLoading).toBe(false);
    });

    // Incomplete spot: luck unavailable, counterfactual range defaults to 'standard'
    expect(review.decisionsVsLuckSignal.value.tier).toBe('unavailable');
    expect(review.decisionsVsLuckSignal.value.unavailableReason).toBe('spot_incomplete');
    expect(review.decisionEvaluationSignal.value.mode).toBe('standard');
    expect(review.decisionEvaluationSignal.value.tier).toBe('estimated');
    expect(review.decisionEvaluationSignal.value.rangeSampled).toBe(true);

    // Annotate thinking + tag in review and verify persistence in repository
    await review.toggleThinkingReason('stealing');
    await review.setThinkingCustomText('Attacking tight blinds');
    await review.toggleActiveHandTag('review_later');

    expect(review.activeHeroNoteSignal.value?.reasonChip).toBe('stealing');
    expect(review.activeHeroNoteSignal.value?.customText).toBe('Attacking tight blinds');

    await review.archiveSavedItem(savedSpot.objectId);
    expect(review.filteredSavedItemsSignal.value).toHaveLength(0);

    review.setSavedFilter('archived');
    expect(review.filteredSavedItemsSignal.value).toHaveLength(1);

    await review.restoreSavedItem(savedSpot.objectId);
    review.setSavedFilter('spots');
    expect(review.filteredSavedItemsSignal.value).toHaveLength(1);
    expect(review.filteredSavedItemsSignal.value[0]?.record.tags).toEqual(['review_later']);
  });

  it('badges preflop sampled known-card decisions and preflop all-in luck as Estimated and never raises a math mistake', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createReviewStore({ engine, repository: repo, autoLoadSaved: false });
    disposers.push(() => store.dispose(), () => engine.dispose());

    await vi.waitFor(() => {
      expect(store.decisionEvaluationSignal.value.isLoading).toBe(false);
    });

    // Decision 1 in Friday hand is Hero BTN calling BB 3-bet preflop (empty board -> C(48,5) > 100k -> sampled 10,000)
    store.selectDecision(1);
    await vi.waitFor(
      () => {
        expect(store.decisionEvaluationSignal.value.decisionIndex).toBe(1);
        expect(store.decisionEvaluationSignal.value.isLoading).toBe(false);
        expect(store.decisionEvaluationSignal.value.heroEquityPct).not.toBeNull();
      },
      { timeout: 5000 },
    );

    const preflopDec = store.decisionEvaluationSignal.value;
    expect(preflopDec.tier).toBe('estimated');
    expect(preflopDec.detailKey).toBe('showdown_sampled');
    expect(preflopDec.isMathMistake).toBe(false);
    expect(preflopDec.trials).toBe(10_000);

    // Build a preflop all-in showdown hand (empty board at all-in action -> luck equity is sampled)
    const rulesRes = engine.sync.createGameRulesSnapshot({
      source: { kind: 'direct' },
      setup: { seatedPlayers: 2 },
      definition: {
        schemaVersion: 'game-rules-definition/v2',
        variant: 'no_limit_texas_holdem',
        format: 'cash',
        tableSize: { minimumSeated: 2, maximumSeated: 10 },
        blinds: { smallBlindMilliBb: 500, bigBlindMilliBb: 1000, chipUnitMilliBb: 100 },
        ante: { type: 'none', amountMilliBb: 0 },
        straddle: { type: 'none' },
        collectionPolicy: { type: 'none' },
        recordedSettlementPolicy: { type: 'source_recorded_rake', rakeModel: 'unknown' },
      },
    });
    if (!rulesRes.ok) throw new Error(rulesRes.error.message);

    const initRes = engine.sync.initializeRecordedHand({
      handId: 'preflop-allin-sampled-luck',
      rulesSnapshot: rulesRes.data,
      buttonSeat: 0,
      players: [
        { playerId: 'hero', seat: 0, startingStackMilliBb: 100_000 },
        { playerId: 'seat-2', seat: 1, startingStackMilliBb: 100_000 },
      ],
    });
    if (!initRes.ok) throw new Error(initRes.error.message);

    const dealRes = engine.sync.applyChance(initRes.data, {
      type: 'deal_hole',
      cardsByPlayer: { hero: ['7s', '2c'] },
      hiddenPlayerIds: ['seat-2'],
    });
    if (!dealRes.ok) throw new Error(dealRes.error.message);

    const r1 = engine.sync.applyAction(dealRes.data, {
      schemaVersion: 'poker-action/v1',
      playerId: 'hero',
      type: 'raise',
      amountToMilliBb: 3000,
    });
    if (!r1.ok) throw new Error(r1.error.message);
    const r2 = engine.sync.applyAction(r1.data, {
      schemaVersion: 'poker-action/v1',
      playerId: 'seat-2',
      type: 'all_in',
      amountToMilliBb: null,
    });
    if (!r2.ok) throw new Error(r2.error.message);
    const r3 = engine.sync.applyAction(r2.data, {
      schemaVersion: 'poker-action/v1',
      playerId: 'hero',
      type: 'call',
      amountToMilliBb: null,
    });
    if (!r3.ok) throw new Error(r3.error.message);

    const flop = engine.sync.applyChance(r3.data, { type: 'deal_flop', cards: ['Ah', 'Kd', 'Qc'] });
    if (!flop.ok) throw new Error(flop.error.message);
    const turn = engine.sync.applyChance(flop.data, { type: 'deal_turn', cards: ['Jh'] });
    if (!turn.ok) throw new Error(turn.error.message);
    const river = engine.sync.applyChance(turn.data, { type: 'deal_river', cards: ['Ts'] });
    if (!river.ok) throw new Error(river.error.message);
    const reveal = engine.sync.applyPrivateReveal(river.data, { playerId: 'seat-2', cards: ['As', 'Ac'] });
    if (!reveal.ok) throw new Error(reveal.error.message);
    const showdown = engine.sync.resolveShowdown(reveal.data);
    if (!showdown.ok) throw new Error(showdown.error.message);

    const savedPreflopAllIn = await repo.saveHand({
      handId: 'preflop-allin-sampled-luck',
      tablePreset: 'six_max_100bb',
      unitLabel: 'bb',
      seatCount: 2,
      startingStackBb: 100,
      heroPlayerId: 'hero',
      heroSeat: 0,
      heroPositionLabel: 'BTN',
      heroCards: ['7s', '2c'],
      pokerState: showdown.data,
      recordedActions: [
        { seq: 1, street: 'preflop', playerId: 'hero', seatIndex: 0, positionLabel: 'BTN', isHero: true, type: 'raise', amountMilliBb: 3000 },
        { seq: 2, street: 'preflop', playerId: 'seat-2', seatIndex: 1, positionLabel: 'BB', isHero: false, type: 'all_in' },
        { seq: 3, street: 'preflop', playerId: 'hero', seatIndex: 0, positionLabel: 'BTN', isHero: true, type: 'call' },
      ],
      heroNotes: [],
      shorthandLine: 'r3 ai c',
      savedKind: 'completed_hand',
    });

    store.openSavedHand(savedPreflopAllIn);
    await vi.waitFor(
      () => {
        expect(store.decisionEvaluationSignal.value.isLoading).toBe(false);
        expect(store.decisionsVsLuckSignal.value.isLoading).toBe(false);
        expect(store.decisionsVsLuckSignal.value.isAvailable).toBe(true);
      },
      { timeout: 5000 },
    );

    // Even when 7s2c calls preflop all-in against AsAc (~12% vs ~49% needed), sampled equity must not raise a math mistake.
    expect(store.decisionEvaluationSignal.value.tier).toBe('estimated');
    expect(store.decisionEvaluationSignal.value.detailKey).toBe('showdown_sampled');
    expect(store.decisionEvaluationSignal.value.isMathMistake).toBe(false);
    expect(store.decisionEvaluationSignal.value.trials).toBe(10_000);

    expect(store.decisionsVsLuckSignal.value.tier).toBe('estimated');
    expect(store.decisionsVsLuckSignal.value.isAvailable).toBe(true);
    expect(store.decisionsVsLuckSignal.value.trials).toBe(10_000);
  });

  it('sets rangeSampled=false on river counterfactual range evaluation via method auto', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createReviewStore({ engine, repository: repo, autoLoadSaved: false });
    disposers.push(() => store.dispose(), () => engine.dispose());

    const unwrapOk = <T,>(res: { ok: true; data: T } | { ok: false; error: { message: string } }): T => {
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    };

    const rules = unwrapOk(
      engine.sync.createGameRulesSnapshot({
        source: { kind: 'direct' },
        setup: { seatedPlayers: 2 },
        definition: {
          schemaVersion: 'game-rules-definition/v2',
          variant: 'no_limit_texas_holdem',
          format: 'cash',
          tableSize: { minimumSeated: 2, maximumSeated: 10 },
          blinds: { smallBlindMilliBb: 500, bigBlindMilliBb: 1000, chipUnitMilliBb: 100 },
          ante: { type: 'none', amountMilliBb: 0 },
          straddle: { type: 'none' },
          collectionPolicy: { type: 'none' },
          recordedSettlementPolicy: { type: 'source_recorded_rake', rakeModel: 'unknown' },
        },
      }),
    );

    let st = unwrapOk(
      engine.sync.initializeRecordedHand({
        handId: 'river-range-exact-check',
        rulesSnapshot: rules,
        buttonSeat: 0,
        players: [
          { playerId: 'hero', seat: 0, startingStackMilliBb: 100_000 },
          { playerId: 'seat-2', seat: 1, startingStackMilliBb: 100_000 },
        ],
      }),
    );
    st = unwrapOk(
      engine.sync.applyChance(st, {
        type: 'deal_hole',
        cardsByPlayer: { hero: ['As', 'Ks'] },
        hiddenPlayerIds: ['seat-2'],
      }),
    );
    const act = (playerId: string, type: 'call' | 'check' | 'bet', amountToMilliBb: number | null = null) => {
      st = unwrapOk(
        engine.sync.applyAction(st, {
          schemaVersion: 'poker-action/v1',
          playerId,
          type,
          amountToMilliBb,
        }),
      );
    };
    act('hero', 'call');
    act('seat-2', 'check');
    st = unwrapOk(engine.sync.applyChance(st, { type: 'deal_flop', cards: ['Ah', '7d', '2c'] }));
    act('seat-2', 'check');
    act('hero', 'check');
    st = unwrapOk(engine.sync.applyChance(st, { type: 'deal_turn', cards: ['8s'] }));
    act('seat-2', 'check');
    act('hero', 'check');
    st = unwrapOk(engine.sync.applyChance(st, { type: 'deal_river', cards: ['Td'] }));
    act('seat-2', 'bet', 3000);
    act('hero', 'call');

    const riverSpot = await repo.saveHand({
      handId: 'river-range-exact-check',
      tablePreset: 'six_max_100bb',
      unitLabel: 'bb',
      seatCount: 2,
      startingStackBb: 100,
      heroPlayerId: 'hero',
      heroSeat: 0,
      heroPositionLabel: 'BTN',
      heroCards: ['As', 'Ks'],
      pokerState: st,
      recordedActions: [
        { seq: 1, street: 'preflop', playerId: 'hero', seatIndex: 0, positionLabel: 'BTN', isHero: true, type: 'call' },
        { seq: 2, street: 'preflop', playerId: 'seat-2', seatIndex: 1, positionLabel: 'BB', isHero: false, type: 'check' },
        { seq: 3, street: 'flop', playerId: 'seat-2', seatIndex: 1, positionLabel: 'BB', isHero: false, type: 'check' },
        { seq: 4, street: 'flop', playerId: 'hero', seatIndex: 0, positionLabel: 'BTN', isHero: true, type: 'check' },
        { seq: 5, street: 'turn', playerId: 'seat-2', seatIndex: 1, positionLabel: 'BB', isHero: false, type: 'check' },
        { seq: 6, street: 'turn', playerId: 'hero', seatIndex: 0, positionLabel: 'BTN', isHero: true, type: 'check' },
        { seq: 7, street: 'river', playerId: 'seat-2', seatIndex: 1, positionLabel: 'BB', isHero: false, type: 'bet', amountMilliBb: 3000 },
        { seq: 8, street: 'river', playerId: 'hero', seatIndex: 0, positionLabel: 'BTN', isHero: true, type: 'call' },
      ],
      heroNotes: [],
      shorthandLine: 'c x x x x x x b3 c',
      savedKind: 'mid_hand_spot',
    });

    store.openSavedHand(riverSpot);
    await vi.waitFor(
      () => {
        expect(store.decisionEvaluationSignal.value.isLoading).toBe(false);
        expect(store.decisionEvaluationSignal.value.heroEquityPct).not.toBeNull();
      },
      { timeout: 5000 },
    );

    expect(store.decisionEvaluationSignal.value.tier).toBe('estimated');
    expect(store.decisionEvaluationSignal.value.rangeSampled).toBe(false);
  });

  it('persists hand summary note (handNote) and matches it in filteredSavedItemsSignal search', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const recorder = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });
    const review = createReviewStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      includeStarterSamples: false,
    });
    disposers.push(() => recorder.dispose(), () => review.dispose(), () => engine.dispose());

    expect(recorder.confirmTicketAction()).toBe(true);
    const savedSpot = await recorder.saveCurrentHand();
    await review.refreshSavedLibrary();
    review.openSavedHand(savedSpot);

    await review.setHandSummaryNote('Opened loose BTN vs tight blinds; note keyword flamingo.');
    expect(review.activeRecordSignal.value.payload.handNote).toBe(
      'Opened loose BTN vs tight blinds; note keyword flamingo.',
    );

    const listed = await repo.listSavedHands({ includeArchived: true });
    expect(listed[0]?.payload.handNote).toBe(
      'Opened loose BTN vs tight blinds; note keyword flamingo.',
    );

    review.setSavedSearch('flamingo');
    expect(review.filteredSavedItemsSignal.value).toHaveLength(1);
    expect(review.filteredSavedItemsSignal.value[0]?.record.objectId).toBe(savedSpot.objectId);

    review.setSavedSearch('nonexistent-token');
    expect(review.filteredSavedItemsSignal.value).toHaveLength(0);

    // Also works cleanly on starter sample hands in memory
    const starterStore = createReviewStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
    });
    disposers.push(() => starterStore.dispose());
    await starterStore.setHandSummaryNote('Starter takeaway orchid');
    expect(starterStore.activeRecordSignal.value.payload.handNote).toBe('Starter takeaway orchid');
    starterStore.setSavedSearch('orchid');
    expect(starterStore.filteredSavedItemsSignal.value).toHaveLength(1);
    expect(starterStore.filteredSavedItemsSignal.value[0]?.record.objectId).toBe(
      'starter-friday-section8',
    );
  });
});
