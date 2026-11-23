import { describe, expect, it } from 'vitest';
import { computeEquityHistogramVsRange } from './rangeHistogram';

describe('computeEquityHistogramVsRange', () => {
  it('computes exact river and turn equity distribution buckets vs villain combos', () => {
    const riverHist = computeEquityHistogramVsRange({
      heroCards: ['Ah', 'Kh'],
      villainCombos: [
        ['Qh', '2h'], // flush (hero has nut flush -> wins 100%)
        ['As', 'Qd'], // one pair (loses 0% to hero flush)
        ['7s', '7d'], // set (loses 0% to hero flush)
      ],
      board: ['Jh', '7c', '2c', '9h', '4h'],
    });
    expect(riverHist).not.toBeNull();
    expect(riverHist!.exact).toBe(true);
    expect(riverHist!.totalCombos).toBe(3);
    expect(riverHist!.crushingPct).toBe(100);
    expect(riverHist!.buckets[4]!.count).toBe(3);

    const turnHist = computeEquityHistogramVsRange({
      heroCards: ['As', 'Ad'],
      villainCombos: [
        ['Ks', 'Kd'],
        ['Qs', 'Qd'],
      ],
      board: ['7c', '4h', '2s', '9d'],
    });
    expect(turnHist).not.toBeNull();
    expect(turnHist!.exact).toBe(true);
    expect(turnHist!.totalCombos).toBe(2);
    expect(turnHist!.buckets[4]!.count).toBe(2);
  });

  it('filters out combos blocked by hero cards or board and returns null on preflop', () => {
    expect(
      computeEquityHistogramVsRange({
        heroCards: ['As', 'Ad'],
        villainCombos: [['Ks', 'Kd']],
        board: [],
      }),
    ).toBeNull();

    const blockedOnly = computeEquityHistogramVsRange({
      heroCards: ['As', 'Ad'],
      villainCombos: [['As', 'Ks']],
      board: ['Qh', '7c', '2h'],
    });
    expect(blockedOnly).toBeNull();
  });
});
