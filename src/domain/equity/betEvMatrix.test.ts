import { describe, expect, it } from 'vitest';
import { computeBetSizingEvRows, computeRunoutSuitAndRankShifts } from './betEvMatrix';

describe('Equity Bet EV Matrix & Runout Suit/Rank Shifts (#5)', () => {
  it('computes breakeven fold equity, equity-adjusted required FE, and net EV across sizings', () => {
    const rows = computeBetSizingEvRows({
      potBb: 20,
      remainingStackBb: 40,
      foldEquityPct: 40,
      heroEquityPct: 25,
    });
    expect(rows.length).toBeGreaterThanOrEqual(4);
    const potRow = rows.find((r) => r.id === '100')!;
    expect(potRow.betBb).toBe(20);
    expect(potRow.bluffBreakevenFePct).toBe(50);
    // callEv = 0.25 * 60 - 20 = -5; reqFE = 5 / (20 - (-5)) = 20%
    expect(potRow.requiredFeWithEquityPct).toBe(20);
    // netEv = 0.4 * 20 + 0.6 * (-5) = 8 - 3 = +5.0 bb
    expect(potRow.netEvBb).toBe(5);
  });

  it('aggregates suit and rank-tier equity shifts cleanly', () => {
    const shifts = computeRunoutSuitAndRankShifts([
      { cards: ['As'], equityDelta: 0.1 },
      { cards: ['Ks'], equityDelta: 0.06 },
      { cards: ['2c'], equityDelta: -0.04 },
    ]);
    expect(shifts.suits.find((s) => s.key === 's')?.avgDeltaPct).toBe(8);
    expect(shifts.suits.find((s) => s.key === 'c')?.avgDeltaPct).toBe(-4);
    expect(shifts.rankTiers.find((t) => t.key === 'A-K')?.avgDeltaPct).toBe(8);
    expect(shifts.rankTiers.find((t) => t.key === '5-2')?.avgDeltaPct).toBe(-4);
  });
});
