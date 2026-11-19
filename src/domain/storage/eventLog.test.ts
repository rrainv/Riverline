import { describe, expect, it } from 'vitest';
import {
  buildFactMatchupTitle,
  createCachingStudyBackend,
  createMemoryStudyBackend,
  createStudyRepository,
  STUDY_BUNDLE_SCHEMA_VERSION,
  type StudyStorageBackend,
} from './index';
import { HOME_GAME_CURRENCY_PRESETS } from '../../engine-api';

describe('src/domain/storage append-only event log, export & schemaVersion 1 import', () => {
  it('saves, lists, archives without mutating history, and exports/imports cleanly', async () => {
    const backend = createMemoryStudyBackend();
    const repo = createStudyRepository(backend);

    const saved = await repo.saveMatchup({
      board: ['Qh', '7c', '2h'],
      players: [
        { id: 'hero', label: 'Hero', isHero: true, rawInput: 'AhKh', inputKind: 'exact' },
        { id: 'v1', label: 'Villain 1', isHero: false, rawInput: 'QsQc', inputKind: 'exact' },
      ],
      street: 'flop',
    });

    expect(saved.factTitle).toBe('AhKh vs QsQc · Qh 7c 2h');
    expect(buildFactMatchupTitle(saved.payload.players, ['Qh', '7c', '2h'], 'Js')).toBe(
      'AhKh vs QsQc · Qh 7c 2h Js',
    );

    const listed = await repo.listSavedMatchups();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.objectId).toBe(saved.objectId);

    const bundle = await repo.exportBundle();
    expect(bundle.schemaVersion).toBe(STUDY_BUNDLE_SCHEMA_VERSION);
    expect(bundle.events).toHaveLength(1);

    await repo.archiveSavedMatchup(saved.objectId);
    expect(await repo.listSavedMatchups()).toHaveLength(0);
    // Append-only guarantee: original event remains in the log alongside the archive event
    expect(await backend.readAllEvents()).toHaveLength(2);

    // Restoring exported JSON into a fresh store restores the saved matchup
    const freshRepo = createStudyRepository(createMemoryStudyBackend());
    const imported = await freshRepo.importBundle(JSON.stringify(bundle), { applyAppearance: false });
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error('expected import ok');
    expect(imported.importedCount).toBe(1);
    expect(imported.savedMatchups).toHaveLength(1);
    expect(imported.savedMatchups[0]?.factTitle).toBe('AhKh vs QsQc · Qh 7c 2h');

    // Re-importing the exact same bundle deduplicates by event id
    const reimported = await freshRepo.importBundle(bundle, { applyAppearance: false });
    expect(reimported.ok).toBe(true);
    if (reimported.ok) {
      expect(reimported.importedCount).toBe(0);
      expect(reimported.skippedDuplicates).toBe(1);
    }
  });

  it('rejects unsupported schemaVersion, malformed JSON, and invalid event payloads cleanly', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());

    const badJson = await repo.importBundle('{not-json', { applyAppearance: false });
    expect(badJson).toMatchObject({ ok: false, errorCode: 'invalid_json' });

    const futureSchema = await repo.importBundle(
      { schemaVersion: 99, exportedAt: new Date().toISOString(), events: [] },
      { applyAppearance: false },
    );
    expect(futureSchema).toEqual({
      ok: false,
      errorCode: 'unsupported_schema_version',
      detail: '99',
    });

    const badEvent = await repo.importBundle(
      {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        events: [{ id: 'x', seq: 1, ts: '2026-01-01T00:00:00Z', domain: 'savedObjects', type: 'saved_matchup.created', objectId: 'm1', payload: { schemaVersion: 1, board: ['INVALID'], players: [] } }],
      },
      { applyAppearance: false },
    );
    expect(badEvent).toMatchObject({ ok: false, errorCode: 'invalid_event', detail: 'events[0]' });
  });

  it('archives, restores, and annotates saved hands without mutating history', async () => {
    const backend = createMemoryStudyBackend();
    const repo = createStudyRepository(backend);

    const saved = await repo.saveHand({
      handId: 'hand-test-1',
      tablePreset: 'six_max_100bb',
      unitLabel: 'bb',
      seatCount: 6,
      startingStackBb: 100,
      heroPlayerId: 'hero',
      heroSeat: 0,
      heroPositionLabel: 'BTN',
      heroCards: ['Ah', 'Kh'],
      pokerState: {
        schemaVersion: 'poker-state/v3',
        handId: 'hand-test-1',
        rulesSnapshot: {
          schemaVersion: 'game-rules-snapshot/v1',
          preset: 'home_6max_100bb',
          smallBlindMilliBb: 500,
          bigBlindMilliBb: 1000,
          chipUnitMilliBb: 100,
          ante: { type: 'none', amountMilliBb: 0 },
          rake: { type: 'none' },
          seatCount: 6,
          buttonSeat: 0,
        },
        buttonSeat: 0,
        phase: 'terminal',
        street: 'river',
        board: ['Qh', '7c', '2h', '4c', '9s'],
        potMilliBb: 200_000,
        currentBetMilliBb: 0,
        lastFullRaiseIncrementMilliBb: 1000,
        actingPlayerId: null,
        players: [],
        pots: [],
        actionHistory: [],
        terminal: { isTerminal: true, reason: 'showdown', winners: [], payoutsMilliBbByPlayer: {} },
        recordedSettlement: null,
      } as never,
      recordedActions: [
        { seq: 1, street: 'preflop', playerId: 'hero', seatIndex: 0, positionLabel: 'BTN', isHero: true, type: 'raise', amountMilliBb: 3000 },
      ],
      heroNotes: [],
      shorthandLine: 'r3',
      savedKind: 'completed_hand',
    });

    const annotated = await repo.annotateSavedHand(saved.objectId, {
      tags: ['review_later', 'unsure'],
      heroNotes: [{ actionSeq: 1, street: 'preflop', reasonChip: 'value', customText: 'Good top-of-range open' }],
    });
    expect(annotated?.tags).toEqual(['review_later', 'unsure']);
    expect(annotated?.payload.heroNotes).toHaveLength(1);

    await repo.archiveSavedHand(saved.objectId);
    expect(await repo.listSavedHands()).toHaveLength(0);
    const withArchived = await repo.listSavedHands({ includeArchived: true });
    expect(withArchived).toHaveLength(1);
    expect(withArchived[0]?.archived).toBe(true);

    await repo.restoreSavedHand(saved.objectId);
    const activeAgain = await repo.listSavedHands();
    expect(activeAgain).toHaveLength(1);
    expect(activeAgain[0]?.archived).toBe(false);
    expect(activeAgain[0]?.tags).toEqual(['review_later', 'unsure']);

    const bundle = await repo.exportBundle();
    const freshRepo = createStudyRepository(createMemoryStudyBackend());
    const imported = await freshRepo.importBundle(JSON.stringify(bundle), { applyAppearance: false });
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error('expected import ok');
    expect(imported.savedHands).toHaveLength(1);
    expect(imported.savedHands[0]?.tags).toEqual(['review_later', 'unsure']);
    expect(imported.savedHands[0]?.payload.heroNotes[0]?.customText).toBe('Good top-of-range open');
  });

  it('persists training_session.recorded events and 2-seat duel hands across bundle export/import', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    await repo.recordTrainingSession({
      sessionId: 'ts-1',
      mode: 'heads_up_duel',
      completedAt: '2026-11-16T01:00:00.000Z',
      spotsCount: 10,
      planAlignedCount: 0,
      baselineAlignedCount: 0,
      netBb: 8.5,
      handsPlayed: 10,
      focusLabel: 'vs Astra',
    });

    const sessions = await repo.listTrainingSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.netBb).toBe(8.5);

    const bundle = await repo.exportBundle();
    const freshRepo = createStudyRepository(createMemoryStudyBackend());
    const imported = await freshRepo.importBundle(bundle, { applyAppearance: false });
    expect(imported.ok).toBe(true);
    expect(await freshRepo.listTrainingSessions()).toHaveLength(1);
  });

  it('persists night_session.*, night_ledger.appended, and night_hand.linked events across export/import', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const created = await repo.createNightSession({
      sessionId: 'night-test-1',
      title: 'Friday chips',
      currency: HOME_GAME_CURRENCY_PRESETS.chips,
      participants: [
        { playerId: 'p1', displayName: 'Eli', seatNumber: 1, status: 'active' },
        { playerId: 'p2', displayName: 'Dan', seatNumber: 2, status: 'active' },
      ],
    });
    const tx1 = await repo.appendNightTransaction({
      sessionId: created.session.sessionId,
      playerId: 'p1',
      type: 'buy_in',
      amountMinor: 200,
    });
    await repo.appendNightTransaction({
      sessionId: created.session.sessionId,
      playerId: 'p1',
      type: 'correction',
      amountMinor: 200,
      correctionOfTransactionId: tx1.transactionId,
    });
    await repo.updateNightSession(created.session.sessionId, {
      participants: [
        { playerId: 'p1', displayName: 'Eli', seatNumber: 1, status: 'cashed_out' },
        { playerId: 'p2', displayName: 'Dan', seatNumber: 2, status: 'cashed_out' },
      ],
    });
    await repo.settleNightSession(created.session.sessionId);
    await repo.linkHandToNight({
      nightSessionId: created.session.sessionId,
      handObjectId: 'hand-abc',
      shorthandSummary: 'f f r12 f c f / Qh 7c 2h',
    });

    const listed = await repo.listNightSessions();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.session.status).toBe('completed');
    expect(listed[0]?.transactions).toHaveLength(2);
    expect(listed[0]?.linkedHands).toHaveLength(1);

    const bundle = await repo.exportBundle();
    const freshRepo = createStudyRepository(createMemoryStudyBackend());
    const imported = await freshRepo.importBundle(JSON.stringify(bundle), {
      applyAppearance: false,
    });
    expect(imported.ok).toBe(true);
    const rehydrated = await freshRepo.listNightSessions();
    expect(rehydrated).toHaveLength(1);
    expect(rehydrated[0]?.session.title).toBe('Friday chips');
    expect(rehydrated[0]?.transactions).toHaveLength(2);
    expect(rehydrated[0]?.linkedHands[0]?.handObjectId).toBe('hand-abc');
  });

  it('coalesces concurrent backend reads, updates cache on writes, and reloads on invalidation', async () => {
    const inner = createMemoryStudyBackend();
    let innerReadCount = 0;
    const spyInner: StudyStorageBackend = {
      async readAllEvents() {
        innerReadCount += 1;
        return inner.readAllEvents();
      },
      appendEvent: (event) => inner.appendEvent(event),
      putManyEvents: (events) => inner.putManyEvents(events),
    };
    const cached = createCachingStudyBackend(spyInner);
    const repo = createStudyRepository(cached);

    // 5 concurrent reads trigger only 1 inner backend read
    await Promise.all([
      cached.readAllEvents(),
      cached.readAllEvents(),
      cached.readAllEvents(),
      cached.readAllEvents(),
      cached.readAllEvents(),
    ]);
    expect(innerReadCount).toBe(1);

    // Writes update the warm cache without re-reading inner storage
    await repo.saveMatchup({
      board: ['Qh', '7c', '2h'],
      players: [
        { id: 'hero', label: 'Hero', isHero: true, rawInput: 'AhKh', inputKind: 'exact' },
        { id: 'v1', label: 'Villain 1', isHero: false, rawInput: 'QsQc', inputKind: 'exact' },
      ],
      street: 'flop',
    });
    expect(innerReadCount).toBe(1);

    const listed = await repo.listSavedMatchups();
    expect(listed).toHaveLength(1);
    expect(innerReadCount).toBe(1);

    // Batch write keeps cache warm as well
    await cached.putManyEvents([
      {
        id: 'evt-extra-1',
        seq: 2,
        ts: '2026-11-19T00:00:00.000Z',
        domain: 'savedObjects',
        type: 'learn_concept.updated',
        objectId: 'learn-concept-pot_odds',
        payload: { conceptId: 'pot_odds', understood: true, updatedAt: '2026-11-19T00:00:00.000Z' },
      },
    ]);
    const progress = await repo.getLearnProgress();
    expect(progress.understoodById.pot_odds).toBe(true);
    expect(innerReadCount).toBe(1);

    // Explicit invalidation forces the next read to reload from inner storage
    cached.invalidateCache();
    const reloaded = await cached.readAllEvents();
    expect(reloaded).toHaveLength(2);
    expect(innerReadCount).toBe(2);
  });
});
