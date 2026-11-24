import { deepFreeze } from '../freeze';
import { createStrategyContext, strategyContextKey } from './context';
import { getStrategyFamily, STRATEGY_FAMILIES } from './families';
import { queryMultidimensionalPreflop } from './preflop-interpolator';
import type { StrategyContext, StrategyFamilyId } from './types';

export interface SpotFrequencyMix {
  readonly raise: number;
  readonly call: number;
  readonly fold: number;
}

export interface SpotProvenanceRow {
  readonly provenanceId: string;
  readonly label: string;
  readonly derivation: 'authored' | 'interpolated' | 'mapped' | 'solved_pilot';
  readonly licenceNote: string;
}

export interface SpotBaselineRow {
  readonly contextKey: string;
  readonly stackDepthBb: number;
  readonly provenanceId: string;
  readonly frequencies: Readonly<Record<string, SpotFrequencyMix>>;
}

export interface SpotBaselineQueryResult {
  readonly available: boolean;
  readonly tier: 'estimated' | 'unavailable';
  readonly qualifier: string;
  readonly derivation: 'authored' | 'interpolated' | 'unavailable';
  readonly row: SpotBaselineRow | null;
}

export const SPOT_PROVENANCE_LEDGER: Readonly<Record<string, SpotProvenanceRow>> = Object.freeze({
  'model-estimated-homegame-v1': deepFreeze<SpotProvenanceRow>({
    provenanceId: 'model-estimated-homegame-v1',
    label: 'Estimated · Riverline 6-max reference',
    derivation: 'authored',
    licenceNote: 'Clean-room author-tuned reference cutoffs; Estimated only, never optimal.',
  }),
  'model-interpolated-stack-v1': deepFreeze<SpotProvenanceRow>({
    provenanceId: 'model-interpolated-stack-v1',
    label: 'Estimated · interpolated stack depth',
    derivation: 'interpolated',
    licenceNote: 'Linear strength-space interpolation between authored stack anchors.',
  }),
});

export function buildSpotRowFromFamilyCutoffs(
  contextKey: string,
  stackDepthBb: number,
  provenanceId: string,
  cutoffsByFamily: Readonly<Partial<Record<StrategyFamilyId, number>>>,
): SpotBaselineRow {
  const frequencies: Record<string, SpotFrequencyMix> = {};
  for (const spec of STRATEGY_FAMILIES) {
    const cutoff = cutoffsByFamily[spec.id];
    if (cutoff === undefined) continue;
    const family = getStrategyFamily(spec.id);
    for (let idx = 0; idx < family.hands.length; idx += 1) {
      const hand = family.hands[idx]!;
      const isRaise = idx <= cutoff;
      frequencies[hand.handClass] = Object.freeze({
        raise: isRaise ? 1 : 0,
        call: 0,
        fold: isRaise ? 0 : 1,
      });
    }
  }
  return deepFreeze({
    contextKey,
    stackDepthBb,
    provenanceId,
    frequencies,
  });
}

/**
 * Interpolates a monotone family cutoff index between two authored stack anchors.
 * Enforces bracket-only bounds [30, 100], max span 40 bb, and monotonicity.
 */
export function interpolateFamilyCutoff(
  lowerDepthBb: number,
  lowerCutoff: number,
  upperDepthBb: number,
  upperCutoff: number,
  targetDepthBb: number,
): number | null {
  if (lowerDepthBb < 30 || upperDepthBb > 100 || upperDepthBb <= lowerDepthBb) return null;
  if (upperDepthBb - lowerDepthBb > 40) return null;
  if (targetDepthBb < lowerDepthBb || targetDepthBb > upperDepthBb) return null;
  const t = (targetDepthBb - lowerDepthBb) / (upperDepthBb - lowerDepthBb);
  return Math.round(lowerCutoff + t * (upperCutoff - lowerCutoff));
}

const ANCHOR_CUTOFFS_40BB: Readonly<Record<string, Readonly<Record<StrategyFamilyId, number>>>> = {
  UTG: { pairs: 6, suited_aces: 3, suited_kings: 1, suited_queens_jacks: 1, suited_connectors: -1, suited_one_gappers: -1, offsuit_aces: 1, offsuit_broadways: 0 },
  HJ: { pairs: 7, suited_aces: 6, suited_kings: 2, suited_queens_jacks: 2, suited_connectors: 1, suited_one_gappers: -1, offsuit_aces: 2, offsuit_broadways: 1 },
  CO: { pairs: 9, suited_aces: 10, suited_kings: 4, suited_queens_jacks: 3, suited_connectors: 3, suited_one_gappers: 1, offsuit_aces: 3, offsuit_broadways: 2 },
  BTN: { pairs: 11, suited_aces: 11, suited_kings: 8, suited_queens_jacks: 7, suited_connectors: 4, suited_one_gappers: 3, offsuit_aces: 7, offsuit_broadways: 4 },
  SB: { pairs: 11, suited_aces: 10, suited_kings: 6, suited_queens_jacks: 4, suited_connectors: 3, suited_one_gappers: 2, offsuit_aces: 5, offsuit_broadways: 3 },
};

const ANCHOR_CUTOFFS_60BB: Readonly<Record<string, Readonly<Record<StrategyFamilyId, number>>>> = {
  UTG: { pairs: 7, suited_aces: 3, suited_kings: 2, suited_queens_jacks: 1, suited_connectors: 0, suited_one_gappers: -1, offsuit_aces: 1, offsuit_broadways: 0 },
  HJ: { pairs: 8, suited_aces: 7, suited_kings: 3, suited_queens_jacks: 2, suited_connectors: 2, suited_one_gappers: 0, offsuit_aces: 2, offsuit_broadways: 1 },
  CO: { pairs: 10, suited_aces: 11, suited_kings: 5, suited_queens_jacks: 4, suited_connectors: 4, suited_one_gappers: 2, offsuit_aces: 3, offsuit_broadways: 3 },
  BTN: { pairs: 12, suited_aces: 11, suited_kings: 9, suited_queens_jacks: 8, suited_connectors: 5, suited_one_gappers: 4, offsuit_aces: 8, offsuit_broadways: 5 },
  SB: { pairs: 12, suited_aces: 11, suited_kings: 7, suited_queens_jacks: 5, suited_connectors: 4, suited_one_gappers: 3, offsuit_aces: 6, offsuit_broadways: 4 },
};

const ANCHOR_CUTOFFS_100BB: Readonly<Record<string, Readonly<Record<StrategyFamilyId, number>>>> = {
  UTG: { pairs: 7, suited_aces: 3, suited_kings: 2, suited_queens_jacks: 1, suited_connectors: 0, suited_one_gappers: -1, offsuit_aces: 1, offsuit_broadways: 0 },
  HJ: { pairs: 8, suited_aces: 7, suited_kings: 3, suited_queens_jacks: 2, suited_connectors: 2, suited_one_gappers: 0, offsuit_aces: 2, offsuit_broadways: 1 },
  CO: { pairs: 10, suited_aces: 11, suited_kings: 5, suited_queens_jacks: 4, suited_connectors: 4, suited_one_gappers: 2, offsuit_aces: 3, offsuit_broadways: 3 },
  BTN: { pairs: 12, suited_aces: 11, suited_kings: 10, suited_queens_jacks: 8, suited_connectors: 5, suited_one_gappers: 4, offsuit_aces: 8, offsuit_broadways: 5 },
  SB: { pairs: 12, suited_aces: 11, suited_kings: 7, suited_queens_jacks: 5, suited_connectors: 4, suited_one_gappers: 3, offsuit_aces: 6, offsuit_broadways: 4 },
};

const REGISTRY_ROWS = new Map<string, SpotBaselineRow>();

function registerRfiAnchors(
  depthBb: 40 | 60 | 100,
  cutoffsByPos: Readonly<Record<string, Readonly<Record<StrategyFamilyId, number>>>>,
): void {
  for (const [position, cutoffs] of Object.entries(cutoffsByPos)) {
    const key = strategyContextKey(
      createStrategyContext({
        tableSize: 6,
        stackDepthBb: depthBb,
        decisionFamily: 'preflop_rfi',
        position,
      }),
    );
    REGISTRY_ROWS.set(
      key,
      buildSpotRowFromFamilyCutoffs(key, depthBb, 'model-estimated-homegame-v1', cutoffs),
    );
  }
}

registerRfiAnchors(40, ANCHOR_CUTOFFS_40BB);
registerRfiAnchors(60, ANCHOR_CUTOFFS_60BB);
registerRfiAnchors(100, ANCHOR_CUTOFFS_100BB);

// Facing-open and limp-iso 100 bb reference rows
const FACING_BTN_CO_KEY = strategyContextKey(
  createStrategyContext({
    tableSize: 6,
    stackDepthBb: 100,
    decisionFamily: 'preflop_facing_open',
    position: 'BTN',
    openerPosition: 'CO',
  }),
);
REGISTRY_ROWS.set(
  FACING_BTN_CO_KEY,
  buildSpotRowFromFamilyCutoffs(FACING_BTN_CO_KEY, 100, 'model-estimated-homegame-v1', {
    pairs: 3,
    suited_aces: 3,
    suited_kings: 1,
    suited_queens_jacks: 1,
    offsuit_aces: 1,
  }),
);

const LIMP_ISO_CO_KEY = strategyContextKey(
  createStrategyContext({
    tableSize: 6,
    stackDepthBb: 100,
    decisionFamily: 'preflop_facing_limp',
    position: 'CO',
  }),
);
REGISTRY_ROWS.set(
  LIMP_ISO_CO_KEY,
  buildSpotRowFromFamilyCutoffs(LIMP_ISO_CO_KEY, 100, 'model-estimated-homegame-v1', {
    pairs: 7,
    suited_aces: 5,
    suited_kings: 3,
    suited_queens_jacks: 2,
    offsuit_aces: 2,
    offsuit_broadways: 1,
  }),
);

export function querySpotBaselineRegistry(context: StrategyContext): SpotBaselineQueryResult {
  const key = strategyContextKey(context);
  const direct = REGISTRY_ROWS.get(key);
  if (direct) {
    return {
      available: true,
      tier: 'estimated',
      qualifier: SPOT_PROVENANCE_LEDGER[direct.provenanceId]!.label,
      derivation: 'authored',
      row: direct,
    };
  }

  if (
    context.tableSize === 6 &&
    context.decisionFamily === 'preflop_rfi' &&
    context.stackDepthBb === 50 &&
    ANCHOR_CUTOFFS_40BB[context.position] &&
    ANCHOR_CUTOFFS_60BB[context.position]
  ) {
    const low = ANCHOR_CUTOFFS_40BB[context.position]!;
    const high = ANCHOR_CUTOFFS_60BB[context.position]!;
    const interpCutoffs: Partial<Record<StrategyFamilyId, number>> = {};
    for (const spec of STRATEGY_FAMILIES) {
      const val = interpolateFamilyCutoff(40, low[spec.id], 60, high[spec.id], 50);
      if (val !== null) interpCutoffs[spec.id] = val;
    }
    return {
      available: true,
      tier: 'estimated',
      qualifier: 'Estimated · interpolated 40-60 bb',
      derivation: 'interpolated',
      row: buildSpotRowFromFamilyCutoffs(key, 50, 'model-interpolated-stack-v1', interpCutoffs),
    };
  }

  const md = queryMultidimensionalPreflop({
    tableSize: context.tableSize,
    stackDepthBb: context.stackDepthBb,
    spotClass: context.decisionFamily,
    position: context.position,
    openerPosition: context.openerPosition,
  });
  return {
    available: md.available,
    tier: md.tier,
    qualifier: md.qualifier,
    derivation: md.derivation === 'interpolated' ? 'interpolated' : 'authored',
    row: deepFreeze({
      contextKey: key,
      stackDepthBb: context.stackDepthBb,
      provenanceId: 'model-estimated-homegame-v1',
      frequencies: md.frequencies,
    }),
  };
}
