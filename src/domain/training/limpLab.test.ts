import { describe, expect, it } from 'vitest';
import { LIMP_LAB_SPOTS, recommendedIsoSizeBb } from './limpLab';

describe('limpLab', () => {
  it('computes 3bb + 1bb/limper (+1bb OOP) iso sizing and has 12 valid spots', () => {
    expect(recommendedIsoSizeBb(1, true)).toBe(4);
    expect(recommendedIsoSizeBb(1, false)).toBe(5);
    expect(recommendedIsoSizeBb(2, true)).toBe(5);
    expect(recommendedIsoSizeBb(3, false)).toBe(7);

    expect(LIMP_LAB_SPOTS).toHaveLength(12);
    for (const spot of LIMP_LAB_SPOTS) {
      expect(spot.heroCards[0]).not.toBe(spot.heroCards[1]);
      if (spot.recommendedAction === 'iso_raise') {
        expect(spot.recommendedSizeBb).toBeGreaterThanOrEqual(4);
      } else {
        expect(spot.recommendedSizeBb).toBeNull();
      }
    }
  });
});
