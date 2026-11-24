import { describe, expect, it } from 'vitest';
import { getSharedEngineClient } from '../../engine-api';
import { parsePlayerHandInput } from '../shorthand';
import {
  CANONICAL_12_FLOPS,
  TEXTURE_SUBSET_PRESETS,
  computeTextureSubsetReport,
} from './textureSubset';

describe('textureSubset', () => {
  it('computes valid percentages across all 12 canonical flops', () => {
    const engine = getSharedEngineClient();
    const parsed = parsePlayerHandInput(TEXTURE_SUBSET_PRESETS.btn_open, { engine });
    expect(parsed.ok && parsed.kind === 'range').toBe(true);
    if (!parsed.ok || parsed.kind !== 'range') return;

    const rows = computeTextureSubsetReport(parsed.weightedRange);
    expect(rows).toHaveLength(CANONICAL_12_FLOPS.length);
    for (const row of rows) {
      expect(row.twoPairPlusPct).toBeGreaterThanOrEqual(row.setsPlusPct);
      expect(row.topPairPlusPct).toBeGreaterThanOrEqual(row.twoPairPlusPct);
      expect(row.continuePct).toBeGreaterThanOrEqual(0);
      expect(row.continuePct).toBeLessThanOrEqual(100);
      expect(row.airPct).toBeGreaterThanOrEqual(0);
      expect(row.airPct).toBeLessThanOrEqual(100);
    }
  });
});
