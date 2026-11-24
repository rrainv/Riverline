import type { RangeBreakdownResult } from './rangeBreakdown';

export type RangeAdvantagePosture =
  | 'range_edge'
  | 'nut_edge'
  | 'polarized_edge'
  | 'balanced';

export interface RangeAdvantageSummary {
  readonly heroNutPct: number;
  readonly villainNutPct: number;
  readonly nutDeltaPct: number;
  readonly heroStrongPct: number;
  readonly villainStrongPct: number;
  readonly strongDeltaPct: number;
  readonly equityDeltaPct: number | null;
  readonly posture: RangeAdvantagePosture;
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function sumBucketShares(
  breakdown: RangeBreakdownResult,
  ids: readonly string[],
): number {
  let sum = 0;
  for (const bucket of breakdown.buckets) {
    if (ids.includes(bucket.id)) {
      sum += bucket.sharePct;
    }
  }
  return roundTenth(sum);
}

export function computeRangeAdvantage(
  heroBreakdown: RangeBreakdownResult,
  villainBreakdown: RangeBreakdownResult,
  heroEquityPct: number | null,
  villainEquityPct: number | null,
): RangeAdvantageSummary {
  const heroNutPct = sumBucketShares(heroBreakdown, ['sets_plus', 'two_pair']);
  const villainNutPct = sumBucketShares(villainBreakdown, ['sets_plus', 'two_pair']);
  const nutDeltaPct = roundTenth(heroNutPct - villainNutPct);

  const heroStrongPct = sumBucketShares(heroBreakdown, [
    'sets_plus',
    'two_pair',
    'top_overpair',
  ]);
  const villainStrongPct = sumBucketShares(villainBreakdown, [
    'sets_plus',
    'two_pair',
    'top_overpair',
  ]);
  const strongDeltaPct = roundTenth(heroStrongPct - villainStrongPct);

  const equityDeltaPct =
    heroEquityPct !== null && villainEquityPct !== null
      ? roundTenth(heroEquityPct - villainEquityPct)
      : null;

  let posture: RangeAdvantagePosture = 'balanced';
  if (
    Math.abs(nutDeltaPct) >= 5 &&
    (equityDeltaPct === null || Math.abs(equityDeltaPct) < 5)
  ) {
    posture = 'polarized_edge';
  } else if (
    Math.abs(nutDeltaPct) >= 5 &&
    equityDeltaPct !== null &&
    Math.sign(nutDeltaPct) === Math.sign(equityDeltaPct)
  ) {
    posture = 'nut_edge';
  } else if (equityDeltaPct !== null && Math.abs(equityDeltaPct) >= 4) {
    posture = 'range_edge';
  }

  return {
    heroNutPct,
    villainNutPct,
    nutDeltaPct,
    heroStrongPct,
    villainStrongPct,
    strongDeltaPct,
    equityDeltaPct,
    posture,
  };
}
