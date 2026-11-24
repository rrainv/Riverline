import { describe, expect, it } from 'vitest';
import { getSharedEngineClient } from '../../engine-api';
import { parsePlayerHandInput } from '../shorthand';
import {
  classifyComboAgainstBoard,
  computePostflopRangeBreakdown,
  filterWeightedRangeByBuckets,
} from './rangeBreakdown';

describe('rangeBreakdown', () => {
  it('classifies combos accurately across all 5 postflop buckets', () => {
    const board = ['Qh', '7c', '2h'];
    expect(classifyComboAgainstBoard(['Qc', '7d'], board)).toBe('two_pair_plus');
    expect(classifyComboAgainstBoard(['7s', '7d'], board)).toBe('two_pair_plus');
    expect(classifyComboAgainstBoard(['As', 'Ad'], board)).toBe('top_overpair');
    expect(classifyComboAgainstBoard(['Ah', 'Qd'], board)).toBe('top_overpair');
    expect(classifyComboAgainstBoard(['Jd', 'Jc'], board)).toBe('mid_weak_pair');
    expect(classifyComboAgainstBoard(['Ah', 'Kh'], board)).toBe('draw');
    expect(classifyComboAgainstBoard(['6s', '5s'], ['9h', '8d', '2c'])).toBe('draw');
    expect(classifyComboAgainstBoard(['As', '5s'], ['Kh', 'Ks', '2s'])).toBe('draw');
    expect(classifyComboAgainstBoard(['7c', '6c'], ['Kh', 'Ks', '2s'])).toBe('air');
    expect(classifyComboAgainstBoard(['Ks', 'Jd'], board)).toBe('air');
  });

  it('computes breakdown shares and filters weighted range by selected buckets', () => {
    const engine = getSharedEngineClient();
    const board = ['Qh', '7c', '2h'];
    const parsed = parsePlayerHandInput('QQ+, AKo:50, 54s', {
      deadCards: board,
      engine,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || parsed.kind !== 'range') return;

    const breakdown = computePostflopRangeBreakdown(parsed.weightedRange, board);
    expect(breakdown).not.toBeNull();
    if (!breakdown) return;

    expect(breakdown.totalCombos).toBeGreaterThan(0);
    const twoPairPlus = breakdown.buckets.find((b) => b.id === 'two_pair_plus');
    const topOverpair = breakdown.buckets.find((b) => b.id === 'top_overpair');
    expect(twoPairPlus?.comboCount).toBe(3); // QQ on Qh7c2h = 3 combos of set
    expect(topOverpair?.comboCount).toBe(12); // AA + KK = 12 combos

    const filtered = filterWeightedRangeByBuckets(
      parsed.weightedRange,
      breakdown,
      new Set(['two_pair_plus', 'top_overpair']),
    );
    const activeAfterFilter = filtered.entries.filter(
      (e) => e.state === 'known' && e.weight > 0,
    );
    expect(activeAfterFilter.length).toBe(15);
  });
});
