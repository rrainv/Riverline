import { describe, expect, it } from 'vitest';
import { createEngineClient } from '../../engine-api';
import { createMemoryStudyBackend, createStudyRepository } from '../storage';
import { buildMainCacheKey, canonicalizePreflopExactHoldings } from './equityStore';
import { createEquityStore } from './index';

describe('src/domain/equity store & cancellation', () => {
  it('computes default flop matchup, steps turn -> river -> Escape back, and preserves row order', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createEquityStore({ engine, repository: repo, autoCompute: false });

    await store.recompute();
    expect(store.playersSignal.value.map((p) => p.label)).toEqual(['Hero', 'Villain 1']);
    expect(store.densitySignal.value).toBe('roomy');
    const flopSnap = store.equitySnapshotSignal.value;
    expect(flopSnap.status).toBe('ready');
    expect(flopSnap.method).toBe('exact');
    expect(flopSnap.trials).toBe(990);
    expect(flopSnap.players['hero']?.equityPct).toBeCloseTo(25.5556, 3);

    // Select Js on turn -> turn equity + delta vs flop + river runouts grid with Js struck
    store.selectRunoutCard('Js');
    await store.recompute();
    expect(store.streetSignal.value).toBe('turn');
    expect(store.turnCardSignal.value).toBe('Js');
    const turnSnap = store.equitySnapshotSignal.value;
    expect(turnSnap.trials).toBe(44);
    expect(turnSnap.players['hero']?.equityPct).toBeCloseTo(22.727, 2);
    expect(turnSnap.players['hero']?.deltaPct).toBeCloseTo(22.727 - 25.556, 1);

    // Select a river card -> river street; Escape steps River -> Turn -> Flop
    store.selectRunoutCard('Th');
    await store.recompute();
    expect(store.streetSignal.value).toBe('river');
    expect(store.effectiveBoardSignal.value).toHaveLength(5);

    expect(store.stepBackWithEscape()).toBe(true);
    expect(store.streetSignal.value).toBe('turn');
    expect(store.stepBackWithEscape()).toBe(true);
    expect(store.streetSignal.value).toBe('flop');
    expect(store.stepBackWithEscape()).toBe(false);

    store.dispose();
  });

  it('switches density cleanly, skips runouts when collapsed, and saves/reloads matchups', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createEquityStore({ engine, repository: repo, autoCompute: false });

    // Adding a 3rd player moves density to 'dense' and never reorders existing rows
    expect(store.addPlayer('Th9h')).toBe(true);
    expect(store.densitySignal.value).toBe('dense');
    expect(store.playersSignal.value.map((p) => p.rawInput)).toEqual(['AhKh', 'QsQc', 'Th9h']);

    // Duplicate card conflict is rejected cleanly
    expect(store.addPlayer('QhKd')).toBe(false);
    expect(store.submitAttemptedErrorSignal.value).toBe('card_in_play');

    // Collapsed runout panel triggers zero runout exploration
    store.setRunoutsExpanded(false);
    await store.recompute();
    expect(store.runoutSnapshotSignal.value.status).toBe('idle');
    expect(store.runoutSnapshotSignal.value.result).toBeNull();

    // Expand again -> computes runouts
    store.setRunoutsExpanded(true);
    await store.recompute();
    expect(store.runoutSnapshotSignal.value.status).toBe('ready');

    // Add 3 more players -> compact density + auto-collapses river dist until asked
    store.addPlayer('7d7s');
    store.addPlayer('AcQd');
    store.addPlayer('any');
    expect(store.densitySignal.value).toBe('compact');
    expect(store.riverDistExpandedSignal.value).toBe(false);
    store.setRiverDistExpanded(true);
    expect(store.riverDistExpandedSignal.value).toBe(true);

    // Save matchup & reload cleanly
    const saved = await store.saveCurrentMatchup();
    expect(saved).not.toBeNull();
    store.applyPreset('flop');
    expect(store.playersSignal.value).toHaveLength(2);
    store.loadSavedMatchup(saved!);
    expect(store.playersSignal.value).toHaveLength(6);

    store.dispose();
  });

  it('canonicalizes preflop exact holdings across all 24 suit permutations without swapping players', () => {
    const k1 = canonicalizePreflopExactHoldings([
      ['Ah', 'Kh'],
      ['Qs', 'Qc'],
    ]);
    const k2 = canonicalizePreflopExactHoldings([
      ['As', 'Ks'],
      ['Qh', 'Qd'],
    ]);
    const k3 = canonicalizePreflopExactHoldings([
      ['Ad', 'Kd'],
      ['Qc', 'Qh'],
    ]);
    expect(k1).toBe(k2);
    expect(k2).toBe(k3);

    // Offsuit vs suited or shared suit with pair is not suit-isomorphic
    const offsuit = canonicalizePreflopExactHoldings([
      ['Ah', 'Ks'],
      ['Qh', 'Qd'],
    ]);
    expect(offsuit).not.toBe(k1);

    const sharedSuit = canonicalizePreflopExactHoldings([
      ['Ah', 'Kh'],
      ['Qh', 'Qc'],
    ]);
    expect(sharedSuit).not.toBe(k1);

    // Keeping player indices fixed ensures swapped seats do not collide
    const swappedSeats = canonicalizePreflopExactHoldings([
      ['Qs', 'Qc'],
      ['Ah', 'Kh'],
    ]);
    expect(swappedSeats).not.toBe(k1);

    // buildMainCacheKey uses canonical preflop key for board.length === 0 exact matchups
    const reqA = buildMainCacheKey({
      schemaVersion: 'equity-request/v1',
      board: [],
      deadCards: [],
      method: 'auto',
      samples: 15_000,
      players: [
        { id: 'hero', cards: ['Ah', 'Kh'] },
        { id: 'villain-1', cards: ['Qs', 'Qc'] },
      ],
    });
    const reqB = buildMainCacheKey({
      schemaVersion: 'equity-request/v1',
      board: [],
      deadCards: [],
      method: 'auto',
      samples: 15_000,
      players: [
        { id: 'hero', cards: ['Ad', 'Kd'] },
        { id: 'villain-2', cards: ['Qc', 'Qh'] },
      ],
    });
    expect(reqA).toBe(reqB);
  });
});
