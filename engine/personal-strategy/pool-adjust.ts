import type { PreflopPoolStyle } from './preflop-pack';
import type { StrategySpotRowId } from './types';

export interface PoolStyleAdjustment {
  readonly poolStyle: PreflopPoolStyle;
  readonly baselineFreq: number;
  readonly adjustedFreq: number;
  readonly deltaFreq: number;
  readonly shiftSummaryKey: 'standard' | 'loose_calling' | 'tight_passive';
}

/**
 * Pure heuristic adjustment over baseline preflop frequencies for pool tendencies.
 * Always returns both `baselineFreq` and `adjustedFreq` so the UI never hides the baseline.
 */
export function adjustFrequencyForPoolStyle(
  baselineFreq: number,
  rowId: StrategySpotRowId,
  poolStyle: PreflopPoolStyle,
): PoolStyleAdjustment {
  const clamped = Math.max(0, Math.min(1, baselineFreq));
  if (poolStyle === 'standard' || clamped <= 0) {
    return {
      poolStyle,
      baselineFreq: clamped,
      adjustedFreq: clamped,
      deltaFreq: 0,
      shiftSummaryKey: 'standard',
    };
  }

  let shift = 0;
  if (poolStyle === 'loose_calling') {
    // Against calling stations: trim thin bluff/steal edges, keep value/high-equity hands
    shift = rowId === 'first_in' ? -0.08 : rowId === 'facing_3bet' ? -0.1 : -0.05;
  } else if (poolStyle === 'tight_passive') {
    // Against tight-passive tables: widen steal opens and light 3-bets for fold equity
    shift = rowId === 'first_in' ? 0.1 : rowId === 'facing_early_open' ? 0.04 : 0.08;
  }

  const adjusted = Math.max(0, Math.min(1, Math.round((clamped + shift) * 1000) / 1000));
  return {
    poolStyle,
    baselineFreq: clamped,
    adjustedFreq: adjusted,
    deltaFreq: Math.round((adjusted - clamped) * 1000) / 1000,
    shiftSummaryKey: poolStyle,
  };
}
