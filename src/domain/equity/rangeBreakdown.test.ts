import { describe, expect, it } from 'vitest';
import { getSharedEngineClient } from '../../engine-api';
import { parsePlayerHandInput } from '../shorthand';
import {
  classifyComboAgainstBoard,
  computePostflopRangeBreakdown,
  filterWeightedRangeByBucketWeights,
  filterWeightedRangeByBuckets,
} from './rangeBreakdown';

describe('rangeBreakdown', () => {
  it('classifies combos accurately across all 8 postflop buckets', () => {
    const board = ['Qh', '7c', '2h'];
    expect(classifyComboAgainstBoard(['7s', '7d'], board)).toBe('sets_plus');
    expect(classifyComboAgainstBoard(['Qc', '7d'], board)).toBe('two_pair');
    expect(classifyComboAgainstBoard(['As', 'Ad'], board)).toBe('top_overpair');
    expect(classifyComboAgainstBoard(['Ah', 'Qd'], board)).toBe('top_overpair');
    expect(classifyComboAgainstBoard(['Jd', 'Jc'], board)).toBe('mid_weak_pair');
    // Combo draw: flush draw + OESD (KhJh on Qh9h2c or Th9h on Qh8h7c)
    expect(classifyComboAgainstBoard(['Th', '9h'], ['Qh', '8h', '7c'])).toBe('combo_draw');
    expect(classifyComboAgainstBoard(['Ah', 'Kh'], board)).toBe('flush_straight_draw');
    expect(classifyComboAgainstBoard(['7s', '6s'], ['9h', '8d', '2c'])).toBe('flush_straight_draw');
    expect(classifyComboAgainstBoard(['6s', '5s'], ['9h', '8d', '2c'])).toBe('gutshot_overcards');
    expect(classifyComboAgainstBoard(['As', '5s'], ['Kh', 'Ks', '2s'])).toBe('flush_straight_draw');
    // Gutshot / two overcards
    expect(classifyComboAgainstBoard(['As', 'Kd'], board)).toBe('gutshot_overcards');
    expect(classifyComboAgainstBoard(['Jc', '9d'], ['Qh', '8c', '2s'])).toBe('gutshot_overcards');
    // Air
    expect(classifyComboAgainstBoard(['7c', '6c'], ['Kh', 'Ks', '2s'])).toBe('air');
    expect(classifyComboAgainstBoard(['5s', '4d'], board)).toBe('air');
  });

  it('computes breakdown shares and filters weighted range by fractional bucket weights', () => {
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
    const setsPlus = breakdown.buckets.find((b) => b.id === 'sets_plus');
    const topOverpair = breakdown.buckets.find((b) => b.id === 'top_overpair');
    expect(setsPlus?.comboCount).toBe(3); // QQ on Qh7c2h = 3 combos of set
    expect(topOverpair?.comboCount).toBe(12); // AA + KK = 12 combos

    const filtered = filterWeightedRangeByBuckets(
      parsed.weightedRange,
      breakdown,
      new Set(['sets_plus', 'top_overpair']),
    );
    const activeAfterFilter = filtered.entries.filter(
      (e) => e.state === 'known' && e.weight > 0,
    );
    expect(activeAfterFilter.length).toBe(15);

    const fractionalFiltered = filterWeightedRangeByBucketWeights(
      parsed.weightedRange,
      breakdown,
      {
        sets_plus: 1,
        top_overpair: 0.5,
        air: 0,
      },
    );
    const knownEntries = fractionalFiltered.entries.filter(
      (e): e is Extract<typeof e, { state: 'known' }> => e.state === 'known',
    );
    const setEntry = knownEntries.find((e) => e.weight > 0 && e.comboId.startsWith('holdem-combo/v1:Q'));
    const aaEntry = knownEntries.find((e) => e.weight > 0 && e.comboId.startsWith('holdem-combo/v1:A') && e.comboId.includes(':A'));
    const airEntry = knownEntries.find((e) => e.comboId === 'holdem-combo/v1:5s:4s');
    expect(setEntry?.weight).toBeCloseTo(1, 3);
    expect(aaEntry?.weight).toBeCloseTo(0.5, 3);
    expect(airEntry?.weight ?? 0).toBe(0);
  });
});
