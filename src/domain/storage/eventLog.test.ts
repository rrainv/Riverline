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
});
