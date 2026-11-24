import { beforeEach, describe, expect, it } from 'vitest';
import { createEngineClient } from '../../engine-api';
import { createMemoryStudyBackend, createStudyRepository } from '../storage';
import { createTrainingStore } from './trainingStore';
import {
  REVISIT_STORAGE_KEY,
  clearRevisitQueue,
  getDueRevisitItems,
  loadRevisitQueue,
  recordRevisitOutcome,
  saveRevisitQueue,
} from './revisitQueue';

describe('revisitQueue', () => {
  beforeEach(() => {
    clearRevisitQueue();
  });

  async function getSampleExercise() {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createTrainingStore({ engine, repository: repo, instantTimers: true });
    await store.openQuickDrill({ target: 'preflop_rfi', focusPosition: 'BTN' });
    const ex = store.drillExerciseSignal.value!;
    store.dispose();
    engine.dispose();
    return ex;
  }

  it('adds missed spot at box 0 due immediately and advances on aligned answers until graduation', async () => {
    const sampleExercise = await getSampleExercise();
    const t0 = 1_700_000_000_000;
    const dayMs = 24 * 60 * 60 * 1000;

    // Miss -> box 0, due immediately
    const q1 = recordRevisitOutcome([], sampleExercise, false, t0);
    expect(q1).toHaveLength(1);
    expect(q1[0]?.box).toBe(0);
    expect(q1[0]?.dueAtMs).toBe(t0);
    expect(getDueRevisitItems(q1, t0)).toHaveLength(1);

    // Aligned -> box 1 (+1d)
    const q2 = recordRevisitOutcome(q1, sampleExercise, true, t0);
    expect(q2[0]?.box).toBe(1);
    expect(q2[0]?.dueAtMs).toBe(t0 + dayMs);
    expect(getDueRevisitItems(q2, t0 + dayMs - 1)).toHaveLength(0);
    expect(getDueRevisitItems(q2, t0 + dayMs)).toHaveLength(1);

    // Aligned -> box 2 (+3d)
    const q3 = recordRevisitOutcome(q2, sampleExercise, true, t0 + dayMs);
    expect(q3[0]?.box).toBe(2);
    expect(q3[0]?.dueAtMs).toBe(t0 + dayMs + 3 * dayMs);

    // Aligned -> box 3 (+7d)
    const q4 = recordRevisitOutcome(q3, sampleExercise, true, t0 + 4 * dayMs);
    expect(q4[0]?.box).toBe(3);

    // Aligned -> graduated (removed)
    const q5 = recordRevisitOutcome(q4, sampleExercise, true, t0 + 11 * dayMs);
    expect(q5).toHaveLength(0);
  });

  it('persists and clears from localStorage', async () => {
    const sampleExercise = await getSampleExercise();
    const t0 = 1_700_000_000_000;
    const q1 = recordRevisitOutcome([], sampleExercise, false, t0);
    saveRevisitQueue(q1);
    expect(window.localStorage.getItem(REVISIT_STORAGE_KEY)).not.toBeNull();
    expect(loadRevisitQueue()).toHaveLength(1);

    clearRevisitQueue();
    expect(window.localStorage.getItem(REVISIT_STORAGE_KEY)).toBeNull();
    expect(loadRevisitQueue()).toHaveLength(0);
  });
});
