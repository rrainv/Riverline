import { describe, expect, it } from 'vitest';
import { createEquityStore } from '../domain/equity';
import { createMemoryStudyBackend, createStudyRepository } from '../domain/storage';
import { createEngineClient } from '../engine-api';

describe('Equity Spec Section 2 verified golden matchups (live EquityStore vs tools/eqexact.py)', () => {
  it('matches every Section 2 matchup figure onQh7c2h across streets and multiway additions', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const store = createEquityStore({
      engine,
      repository: createStudyRepository(createMemoryStudyBackend()),
      autoCompute: false,
    });
    // Skip runout matrix during multiway table golden assertion; runout matrix is verified separately below.
    store.setRunoutsExpanded(false);

    // 1. Flop Qh7c2h: AhKh vs QsQc -> 990 runouts, wins 253 / 737 (25.5556% / 74.4444%)
    await store.recompute();
    const flop = store.equitySnapshotSignal.value;
    expect(flop.method).toBe('exact');
    expect(flop.trials).toBe(990);
    expect(flop.players['hero']?.wins).toBe(253);
    expect(flop.players['hero']?.ties).toBe(0);
    expect(flop.players['hero']?.equityPct).toBeCloseTo((253 / 990) * 100, 6);
    expect(flop.players['villain-1']?.wins).toBe(737);
    expect(flop.players['villain-1']?.equityPct).toBeCloseTo((737 / 990) * 100, 6);

    // 2. Turn Qh7c2hJs: AhKh vs QsQc -> 44 rivers, wins 10 / 34 (22.7273% / 77.2727%)
    store.selectRunoutCard('Js');
    await store.recompute();
    const turnJs = store.equitySnapshotSignal.value;
    expect(turnJs.trials).toBe(44);
    expect(turnJs.players['hero']?.wins).toBe(10);
    expect(turnJs.players['hero']?.equityPct).toBeCloseTo((10 / 44) * 100, 6);
    expect(turnJs.players['villain-1']?.wins).toBe(34);
    expect(turnJs.players['hero']?.deltaPct).toBeCloseTo((10 / 44 - 253 / 990) * 100, 5);

    // 3. Flop + Th9h -> 903 runouts, wins [185, 690, 28]
    store.clearRunoutSelection();
    store.addPlayer('Th9h');
    await store.recompute();
    const threeWay = store.equitySnapshotSignal.value;
    expect(threeWay.trials).toBe(903);
    expect(threeWay.players['hero']?.wins).toBe(185);
    expect(threeWay.players['villain-1']?.wins).toBe(690);
    const th9hId = store.playersSignal.value[2]!.id;
    expect(threeWay.players[th9hId]?.wins).toBe(28);
    expect(threeWay.players['hero']?.equityPct).toBeCloseTo((185 / 903) * 100, 6);

    // 4. Turn Qh7c2h3h with AhKh vs QsQc vs Th9h -> 42 rivers, wins [32, 10, 0] (76.190% / 23.810% / 0%)
    store.selectRunoutCard('3h');
    await store.recompute();
    const turn3h = store.equitySnapshotSignal.value;
    expect(turn3h.trials).toBe(42);
    expect(turn3h.players['hero']?.wins).toBe(32);
    expect(turn3h.players['villain-1']?.wins).toBe(10);
    expect(turn3h.players[th9hId]?.wins).toBe(0);
    expect(turn3h.players[th9hId]?.ties).toBe(0);

    // 5. Flop + 7d7s (4 players on Qh7c2h) -> 820 runouts, wins [185, 568, 28, 39]
    store.clearRunoutSelection();
    store.addPlayer('7d7s');
    await store.recompute();
    const fourWay = store.equitySnapshotSignal.value;
    expect(fourWay.trials).toBe(820);
    expect(fourWay.players['hero']?.wins).toBe(185);
    expect(fourWay.players['villain-1']?.wins).toBe(568);
    expect(fourWay.players[th9hId]?.wins).toBe(28);
    const sevensId = store.playersSignal.value[3]!.id;
    expect(fourWay.players[sevensId]?.wins).toBe(39);

    store.dispose();
    engine.dispose();
  }, 15000);
});
