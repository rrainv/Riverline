import { describe, expect, it } from 'vitest';
import { calculateEquity, calculateEquityExact } from '../equity';
import { solveExactHeadsUpPreflop } from '../preflop-exact';

describe('solveExactHeadsUpPreflop', () => {
  it('computes exact C(48, 5) = 1,712,304 preflop equity for AA vs KK and AK vs QQ', () => {
    const aaKk = solveExactHeadsUpPreflop(['As', 'Ah'], ['Ks', 'Kh']);
    expect(aaKk.trials).toBe(1_712_304);
    expect(aaKk.players[0].wins + aaKk.players[0].ties + aaKk.players[0].losses).toBe(1_712_304);
    expect(aaKk.players[0].equity + aaKk.players[1].equity).toBeCloseTo(1, 12);
    // Canonical AA vs KK suit topologies:
    // - 2 shared suits (AsAh vs KsKh): ~82.64%
    // - 1 shared suit (AsAh vs KsKd): ~81.95%
    // - 0 shared suits (AsAh vs KcKd): ~81.26%
    expect(aaKk.players[0].equity).toBeCloseTo(0.8264, 3);
    const oneShared = solveExactHeadsUpPreflop(['As', 'Ah'], ['Ks', 'Kd']);
    const zeroShared = solveExactHeadsUpPreflop(['As', 'Ah'], ['Kc', 'Kd']);
    expect(oneShared.players[0].equity).toBeCloseTo(0.8195, 3);
    expect(zeroShared.players[0].equity).toBeCloseTo(0.8126, 3);

    const catSum0 = Object.values(aaKk.players[0].riverCategories).reduce((a, b) => a + b, 0);
    const catSum1 = Object.values(aaKk.players[1].riverCategories).reduce((a, b) => a + b, 0);
    expect(catSum0).toBe(1_712_304);
    expect(catSum1).toBe(1_712_304);
  });

  it('distinguishes suited-overlap matchups (AsKs vs QsJs vs QhJh) and dead cards', () => {
    const sameSuit = solveExactHeadsUpPreflop(['As', 'Ks'], ['Qs', 'Js']);
    const diffSuit = solveExactHeadsUpPreflop(['As', 'Ks'], ['Qh', 'Jh']);
    expect(sameSuit.trials).toBe(1_712_304);
    expect(diffSuit.trials).toBe(1_712_304);
    // Same-suit blocks villain's flush outs -> higher hero equity
    expect(sameSuit.players[0].equity).toBeGreaterThan(diffSuit.players[0].equity);

    // Identical ranks with disjoint suits must split exactly 50% / 50%
    const mirror = solveExactHeadsUpPreflop(['Ah', 'Kh'], ['Ad', 'Kd']);
    expect(mirror.players[0].wins).toBe(mirror.players[1].wins);
    expect(mirror.players[0].equity).toBe(0.5);

    // Dead cards reduce total board combinations to C(46, 5) = 1,370,754
    const withDead = solveExactHeadsUpPreflop(['As', 'Ah'], ['Ks', 'Kh'], ['2c', '7d']);
    expect(withDead.trials).toBe(1_370_754);
  });

  it('wires into calculateEquity (auto) and calculateEquityExact as exact', async () => {
    const syncExact = calculateEquityExact({
      schemaVersion: 'equity-request/v1',
      players: [
        { id: 'hero', cards: ['As', 'Ah'] },
        { id: 'villain', cards: ['Ks', 'Kh'] },
      ],
      board: [],
    });
    expect('trials' in syncExact).toBe(true);
    if ('trials' in syncExact) {
      expect(syncExact.exact).toBe(true);
      expect(syncExact.method).toBe('exact');
      expect(syncExact.trials).toBe(1_712_304);
    }

    const asyncAuto = await calculateEquity({
      schemaVersion: 'equity-request/v1',
      players: [
        { id: 'hero', cards: ['As', 'Ah'] },
        { id: 'villain', cards: ['Ks', 'Kh'] },
      ],
      board: [],
    });
    expect('trials' in asyncAuto).toBe(true);
    if ('trials' in asyncAuto) {
      expect(asyncAuto.exact).toBe(true);
      expect(asyncAuto.method).toBe('exact');
      expect(asyncAuto.trials).toBe(1_712_304);
    }
  });
});
