import { describe, expect, it } from 'vitest';
import { createEngineClient } from '../../engine-api';
import { createMemoryStudyBackend, createStudyRepository } from '../storage';
import { createNightsStore } from './nightsStore';
import { buildNightPackJson, NIGHT_PACK_SCHEMA_VERSION, parseNightPackJson } from './nightPack';

describe('nightPack export and import', () => {
  it('exports a settled night with linked hands and imports it into another repository without clobbering', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repoA = createStudyRepository(createMemoryStudyBackend());
    const storeA = createNightsStore({ engine, repository: repoA });
    await storeA.hydrate();

    const night = await storeA.createNight({
      title: 'Friday Crew',
      unitPreset: 'chips',
      players: [
        { displayName: 'Avi', initialBuyInInput: '100' },
        { displayName: 'Ben', initialBuyInInput: '100' },
      ],
    });
    expect(night).not.toBeNull();
    storeA.setHandShorthandInput('co r12 btn f sb f bb c / 9h 4c 2d');
    const saved = await storeA.saveQuickShorthandHand();
    expect(saved).not.toBeNull();

    const exported = storeA.exportActiveNightPack();
    expect(exported).not.toBeNull();
    expect(exported!.filename).toContain('friday-crew');

    const parsed = parseNightPackJson(exported!.json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.pack.schemaVersion).toBe(NIGHT_PACK_SCHEMA_VERSION);
      expect(parsed.pack.hands).toHaveLength(1);
    }

    // Import into a second fresh repository
    const repoB = createStudyRepository(createMemoryStudyBackend());
    const storeB = createNightsStore({ engine, repository: repoB });
    await storeB.hydrate();
    const ok = await storeB.importNightPackJson(exported!.json);
    expect(ok).toBe(true);
    expect(storeB.sessionsSignal.value).toHaveLength(1);
    expect(storeB.sessionsSignal.value[0]?.session.title).toBe('Friday Crew');
    expect(storeB.sessionsSignal.value[0]?.linkedHands).toHaveLength(1);

    // Importing again into the same store creates a distinct session without overwriting
    const ok2 = await storeB.importNightPackJson(exported!.json);
    expect(ok2).toBe(true);
    expect(storeB.sessionsSignal.value).toHaveLength(2);

    // Rejects malformed JSON cleanly
    const bad = await storeB.importNightPackJson('{not valid json');
    expect(bad).toBe(false);
    expect(buildNightPackJson(storeB.sessionsSignal.value[0]!, storeB.savedHandsByIdSignal.value).json).toContain(
      NIGHT_PACK_SCHEMA_VERSION,
    );
  });
});
