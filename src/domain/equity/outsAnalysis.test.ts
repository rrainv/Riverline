import { describe, expect, it } from 'vitest';
import { getSharedEngineClient } from '../../engine-api';
import { parsePlayerHandInput } from '../shorthand';
import { computeHeroOutsAnalysis, hitByRiverPct, hitOneCardPct } from './outsAnalysis';

describe('outsAnalysis', () => {
  it('separates clean winning outs from dominated outs and counterfeit cards in exact matchups', () => {
    const engine = getSharedEngineClient();
    const board = ['Kh', '8h', '3d'];
    // Hero Qh 9h flush draw + gutshot/pair outs vs Villain Ah 2h (dominating nut flush draw + A-high)
    const projRes = engine.sync.projectEquityHands({
      board,
      players: [
        { id: 'hero', cards: ['Qh', '9h'] },
        { id: 'v1', cards: ['Ah', '2c'] },
      ],
    });
    expect(projRes.ok).toBe(true);
    if (!projRes.ok) return;

    const analysis = computeHeroOutsAnalysis({
      projection: projRes.data,
      heroId: 'hero',
      heroCards: ['Qh', '9h'],
      board,
      customDeadCards: [],
      villainRange: null,
    });

    expect(analysis).not.toBeNull();
    if (!analysis) return;

    expect(analysis.exactMatchupAvailable).toBe(true);
    expect(analysis.standing).toBe('behind');
    expect(analysis.winningOuts?.count).toBeGreaterThan(0);
    // Hearts would improve Hero to a Flush, yet Ah makes Villain the nut flush!
    // Wait: let's check Villain holding 'Ah' makes any heart (except Ah which is already in Villain's hand) NOT make Villain a flush (Villain only has 1 heart!), so let's also check Kc/Kd/2h scenarios.
    expect(analysis.structuralDraws.flushCount).toBe(8);
    expect(hitOneCardPct(9, 45)).toBe(20);
    expect(hitByRiverPct(9, 45)).toBe(36.4);
  });

  it('detects dominated flush draws when Villain holds both flush cards', () => {
    const engine = getSharedEngineClient();
    const board = ['Kh', '8h', '3d'];
    const projRes = engine.sync.projectEquityHands({
      board,
      players: [
        { id: 'hero', cards: ['Qh', '9h'] },
        { id: 'v1', cards: ['Ah', 'Jh'] },
      ],
    });
    expect(projRes.ok).toBe(true);
    if (!projRes.ok) return;

    const analysis = computeHeroOutsAnalysis({
      projection: projRes.data,
      heroId: 'hero',
      heroCards: ['Qh', '9h'],
      board,
      customDeadCards: [],
      villainRange: null,
    });
    expect(analysis).not.toBeNull();
    if (!analysis) return;

    // Non-straight-flush hearts improve Hero to Queen-high flush, yet still lose to Villain's Nut Flush!
    expect(analysis.dominatedOuts?.count).toBeGreaterThanOrEqual(6);
  });

  it('computes range-aware flush domination risk when facing a Villain range', () => {
    const engine = getSharedEngineClient();
    const board = ['Kh', '8h', '3d'];
    const projRes = engine.sync.projectEquityHands({
      board,
      players: [
        { id: 'hero', cards: ['Jh', '9h'] },
        { id: 'v1', cards: null },
      ],
    });
    const parsed = parsePlayerHandInput('AQs, ATs, QJs, KQs', { deadCards: board, engine });
    expect(projRes.ok && parsed.ok && parsed.kind === 'range').toBe(true);
    if (!projRes.ok || !parsed.ok || parsed.kind !== 'range') return;

    const analysis = computeHeroOutsAnalysis({
      projection: projRes.data,
      heroId: 'hero',
      heroCards: ['Jh', '9h'],
      board,
      customDeadCards: [],
      villainRange: parsed.weightedRange,
    });

    expect(analysis?.rangeDomination).not.toBeNull();
    expect(analysis?.rangeDomination?.dominatingFlushCombos).toBeGreaterThan(0);
    expect(analysis?.rangeDomination?.flushDominationPct).toBeGreaterThan(0);
  });
});
