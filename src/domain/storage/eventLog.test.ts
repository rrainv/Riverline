import { describe, expect, it } from 'vitest';
import {
  buildFactMatchupTitle,
  createMemoryStudyBackend,
  createStudyRepository,
  STUDY_BUNDLE_SCHEMA_VERSION,
} from './index';

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
});
