import { describe, expect, it } from 'vitest';
import { PREFLOP_HAND_CLASSES } from '../hand-class';
import { queryMultidimensionalPreflop } from './preflop-interpolator';
import { PUSHFOLD_REFERENCE_TABLE } from './pushfold-table';

describe('Multidimensional Offline Preflop Engine', () => {
  it('normalizes all 169 hand classes across HU, 6-max, 8-max, 9-max, and 10-max', () => {
    for (const tableSize of [2, 6, 8, 9, 10]) {
      const res = queryMultidimensionalPreflop({
        tableSize,
        stackDepthBb: 100,
        spotClass: 'preflop_rfi',
        position: tableSize === 2 ? 'BTN' : 'UTG',
      });
      expect(Object.keys(res.frequencies)).toHaveLength(169);
      for (const hc of PREFLOP_HAND_CLASSES) {
        const mix = res.frequencies[hc]!;
        expect(mix.raise + mix.call + mix.fold).toBeCloseTo(1, 2);
        expect(mix.raise).toBeGreaterThanOrEqual(0);
        expect(mix.call).toBeGreaterThanOrEqual(0);
        expect(mix.fold).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('tightens UTG opening monotonically from 6-max to 9-max to 10-max and interpolates stacks', () => {
    const utg6 = queryMultidimensionalPreflop({
      tableSize: 6,
      stackDepthBb: 100,
      spotClass: 'preflop_rfi',
      position: 'UTG',
    });
    const utg9 = queryMultidimensionalPreflop({
      tableSize: 9,
      stackDepthBb: 100,
      spotClass: 'preflop_rfi',
      position: 'UTG',
    });
    const utg10 = queryMultidimensionalPreflop({
      tableSize: 10,
      stackDepthBb: 100,
      spotClass: 'preflop_rfi',
      position: 'UTG',
    });
    expect(utg10.derivation).toBe('mapped');
    expect(utg6.frequencies.KJs!.raise).toBeGreaterThanOrEqual(utg9.frequencies.KJs!.raise);
    expect(utg9.frequencies.KJs!.raise).toBeGreaterThanOrEqual(utg10.frequencies.KJs!.raise);

    const interp75 = queryMultidimensionalPreflop({
      tableSize: 6,
      stackDepthBb: 75,
      spotClass: 'preflop_rfi',
      position: 'CO',
    });
    expect(interp75.derivation).toBe('interpolated');
    expect(interp75.closeCallHandClasses.length).toBeGreaterThan(0);
  });

  it('shifts facing-open defense monotonically with open sizing (2x vs 4x) and delegates <=15bb push/fold', () => {
    const vs2x = queryMultidimensionalPreflop({
      tableSize: 6,
      stackDepthBb: 100,
      spotClass: 'preflop_facing_open',
      position: 'BTN',
      openerPosition: 'CO',
      openSizeBb: 2.0,
    });
    const vs4x = queryMultidimensionalPreflop({
      tableSize: 6,
      stackDepthBb: 100,
      spotClass: 'preflop_facing_open',
      position: 'BTN',
      openerPosition: 'CO',
      openSizeBb: 4.0,
    });
    const cont2x = Object.values(vs2x.frequencies).reduce((s, m) => s + m.raise + m.call, 0);
    const cont4x = Object.values(vs4x.frequencies).reduce((s, m) => s + m.raise + m.call, 0);
    expect(cont2x).toBeGreaterThan(cont4x);

    const push10 = queryMultidimensionalPreflop({
      tableSize: 2,
      stackDepthBb: 10,
      spotClass: 'preflop_rfi',
      position: 'BTN',
    });
    expect(push10.derivation).toBe('push_fold');
    expect(push10.frequencies.AA!.raise).toBe(1);
    expect(push10.frequencies['72o']!.fold).toBeGreaterThan(0.99);

    const bb10 = queryMultidimensionalPreflop({
      tableSize: 2,
      stackDepthBb: 10,
      spotClass: 'preflop_facing_open',
      position: 'BB',
    });
    expect(bb10.derivation).toBe('push_fold');
    expect(bb10.frequencies.AA!.call).toBe(1);
    expect(bb10.frequencies['72o']!.fold).toBe(1);
  });

  it('verifies exact 169x169 HU push/fold Nash exploitability and monotonic tightening', () => {
    expect(PUSHFOLD_REFERENCE_TABLE).toHaveLength(6);
    for (let i = 0; i < PUSHFOLD_REFERENCE_TABLE.length; i += 1) {
      const row = PUSHFOLD_REFERENCE_TABLE[i]!;
      expect(row.exploitabilityBb).toBeLessThan(0.002);
      expect(Object.keys(row.sbJamFreqByClass)).toHaveLength(169);
      expect(Object.keys(row.bbCallFreqByClass)).toHaveLength(169);
      if (i > 0) {
        const prev = PUSHFOLD_REFERENCE_TABLE[i - 1]!;
        expect(row.sbJamPct).toBeLessThanOrEqual(prev.sbJamPct);
        expect(row.bbCallPct).toBeLessThanOrEqual(prev.bbCallPct);
      }
    }
    const row10 = PUSHFOLD_REFERENCE_TABLE.find((r) => r.stackBb === 10)!;
    expect(row10.sbJamPct).toBeGreaterThanOrEqual(56);
    expect(row10.sbJamPct).toBeLessThanOrEqual(68);
    expect(row10.bbCallPct).toBeGreaterThanOrEqual(36);
    expect(row10.bbCallPct).toBeLessThanOrEqual(46);

    const row15 = PUSHFOLD_REFERENCE_TABLE.find((r) => r.stackBb === 15)!;
    expect(row15.bbCallFreqByClass['72o']).toBe(0);
  });
});
