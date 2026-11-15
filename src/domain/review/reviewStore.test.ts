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
});
