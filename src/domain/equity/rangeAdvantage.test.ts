import { describe, expect, it } from 'vitest';
import { getSharedEngineClient } from '../../engine-api';
import { parsePlayerHandInput } from '../shorthand';
import { computePostflopRangeBreakdown } from './rangeBreakdown';
import { computeRangeAdvantage } from './rangeAdvantage';

describe('rangeAdvantage', () => {
  it('computes nut/strong share deltas and classifies polarized_edge, nut_edge, range_edge, and balanced postures', () => {
    const engine = getSharedEngineClient();
    const board = ['Ah', 'Kd', '7c'];

    const tightParsed = parsePlayerHandInput('AA, KK, AKs', { deadCards: board, engine });
    const wideParsed = parsePlayerHandInput('TT-22, KQs-KTs, QJs-98s', {
      deadCards: board,
      engine,
    });
    expect(tightParsed.ok && tightParsed.kind === 'range').toBe(true);
    expect(wideParsed.ok && wideParsed.kind === 'range').toBe(true);
    if (!tightParsed.ok || tightParsed.kind !== 'range') return;
    if (!wideParsed.ok || wideParsed.kind !== 'range') return;

    const heroBd = computePostflopRangeBreakdown(tightParsed.weightedRange, board)!;
    const villainBd = computePostflopRangeBreakdown(wideParsed.weightedRange, board)!;

    const nutEdge = computeRangeAdvantage(heroBd, villainBd, 68, 32);
    expect(nutEdge.heroNutPct).toBe(100);
    expect(nutEdge.villainNutPct).toBeLessThan(20);
    expect(nutEdge.nutDeltaPct).toBeGreaterThan(80);
    expect(nutEdge.posture).toBe('nut_edge');

    const polarized = computeRangeAdvantage(heroBd, villainBd, 51, 49);
    expect(polarized.posture).toBe('polarized_edge');

    const rangeEdge = computeRangeAdvantage(heroBd, heroBd, 56, 44);
    expect(rangeEdge.nutDeltaPct).toBe(0);
    expect(rangeEdge.equityDeltaPct).toBe(12);
    expect(rangeEdge.posture).toBe('range_edge');

    const balanced = computeRangeAdvantage(heroBd, heroBd, 50.5, 49.5);
    expect(balanced.posture).toBe('balanced');
  });
});
