import { describe, expect, it } from 'vitest';
import { createEngineClient } from '../../engine-api';
import { createMemoryStudyBackend, createStudyRepository } from '../storage';
import { createStrategyStore } from './strategyStore';

describe('StrategyStore', () => {
  it('persists family cutoff edits and clear-as-unknown to riverline-study-v1', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createStrategyStore({
      engine: createEngineClient({ mode: 'inline' }),
      repository: repo,
    });

    await store.hydrate();
    expect(store.matrixProjectionSignal.value.knownCombos).toBe(0);

    await store.setFamilyCutoff(2); // KQs, KJs, KTs -> raise; K9s..K2s -> fold
    expect(store.matrixProjectionSignal.value.openCombos).toBe(12);
    expect(store.baselineComparisonSignal.value.tier).toBe('estimated');
    expect(store.baselineComparisonSignal.value.deltaHands).toBe(0);

    // Reload into a fresh store from the same repository
    const store2 = createStrategyStore({
      engine: createEngineClient({ mode: 'inline' }),
      repository: repo,
    });
    await store2.hydrate();
    expect(store2.matrixProjectionSignal.value.openCombos).toBe(12);

    // Clearing returns hands to unknown (never fold)
    await store2.clearSelectedFamily();
    expect(store2.matrixProjectionSignal.value.knownCombos).toBe(0);
    expect(store2.matrixProjectionSignal.value.openCombos).toBe(0);
  });

  it('isolates 30-60 bb 8-max home game plans from 100 bb 6-max plans', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createStrategyStore({
      engine: createEngineClient({ mode: 'inline' }),
      repository: repo,
    });

    store.setTableSize(8);
    store.setStackDepthBb(50);
    store.selectSpot('facing_early_open', 'CO');
    store.setPaintAction('call');
    await store.paintMatrixCell('AQs');

    expect(store.matrixProjectionSignal.value.knownCombos).toBe(4);
    expect(store.baselineComparisonSignal.value.tier).toBe('unavailable');

    store.setTableSize(6);
    store.setStackDepthBb(100);
    expect(store.matrixProjectionSignal.value.knownCombos).toBe(0);
  });
});
