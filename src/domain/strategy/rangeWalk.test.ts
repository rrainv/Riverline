import { describe, expect, it } from 'vitest';
import { createEngineClient } from '../../engine-api';
import {
  analyzeRangeWalkStreet,
  classifyComboOnBoard,
  compareRangeWalkClash,
  RANGE_WALK_BUCKETS,
} from './rangeWalk';

describe('rangeWalk', () => {
  it('classifies made hands, one pair, flush/straight draws, and air accurately', () => {
    expect(classifyComboOnBoard(['Qs', 'Qd'], ['Qh', '7c', '2h'])).toBe('strong');
    expect(classifyComboOnBoard(['As', 'Qc'], ['Qh', '7c', '2h'])).toBe('one_pair');
    expect(classifyComboOnBoard(['Ah', 'Kh'], ['Qh', '7c', '2h'])).toBe('draw');
    expect(classifyComboOnBoard(['Jc', 'Td'], ['Qh', '7c', '2h'])).toBe('air');
    // On river (5 board cards), missed draws become air
    expect(classifyComboOnBoard(['Ah', 'Kh'], ['Qh', '7c', '2h', '9s', 'Kd'])).toBe('one_pair');
    expect(classifyComboOnBoard(['Ah', '5h'], ['Qh', '7c', '2h', '9s', 'Kd'])).toBe('air');
  });

  it('tracks card removal, bucket counts, and retention % across streets', () => {
    const engine = createEngineClient({ mode: 'inline' });
    const allKept = new Set(RANGE_WALK_BUCKETS);

    const pre = analyzeRangeWalkStreet({
      rangeText: 'top 15%',
      board: [],
      keptBuckets: allKept,
      engine,
    });
    expect(pre.valid).toBe(true);
    expect(pre.isPreflop).toBe(true);
    expect(pre.blockedCombos).toBe(0);
    expect(pre.liveCombos).toBe(pre.totalBeforeRemoval);

    const flop = analyzeRangeWalkStreet({
      rangeText: 'top 15%',
      board: ['Qh', '7c', '2h'],
      keptBuckets: new Set(['strong', 'one_pair', 'draw']),
      engine,
    });
    expect(flop.valid).toBe(true);
    expect(flop.isPreflop).toBe(false);
    expect(flop.blockedCombos).toBeGreaterThan(0);
    expect(
      flop.bucketCounts.strong +
        flop.bucketCounts.one_pair +
        flop.bucketCounts.draw +
        flop.bucketCounts.air,
    ).toBe(flop.liveCombos);
    expect(flop.keptCombos).toBe(
      flop.bucketCounts.strong + flop.bucketCounts.one_pair + flop.bucketCounts.draw,
    );
    expect(flop.cellsByClass['AQs']?.combos.length).toBeGreaterThan(0);

    const villainFlop = analyzeRangeWalkStreet({
      rangeText: 'top 38%',
      board: ['Qh', '7c', '2h'],
      keptBuckets: allKept,
      engine,
    });
    const clash = compareRangeWalkClash(flop, villainFlop);
    expect(clash.heroMadePct).toBeGreaterThan(clash.villainMadePct);
  });
});
