import { deepFreeze } from '../freeze';
import {
  createStrategyContext,
  playersBehindForPosition,
  positionsForTableSize,
  strategyContextKey,
} from './context';
import {
  deriveFamilyCutoffFromProjection,
  familyKnownCombosFromProjection,
  familyRaiseCombosFromProjection,
  getStrategyFamily,
  STRATEGY_FAMILIES,
} from './families';
import { projectStrategyMatrix } from './inference';
import type {
  StrategyBaselineComparison,
  StrategyContext,
  StrategyEvidenceEntry,
  StrategyFamilyId,
  StrategyLeakMapCell,
  StrategyLeakMapColumnFooter,
  StrategyLeakMapProjection,
  StrategyMatrixProjection,
  StrategyStackDepthBb,
  StrategyTableSize,
} from './types';

/**
 * Sample Estimated 6-max 100 bb RFI cutoffs (inclusive index into STRATEGY_FAMILIES).
 * Strictly labelled `Estimated` in UI; 30-60 bb and response spots return `Unavailable`
 * until solver-backed verified references are added (docs/DECISIONS.md §G).
 */
const ESTIMATED_100BB_6MAX_RFI_CUTOFFS: Readonly<
  Record<string, Readonly<Record<StrategyFamilyId, number>>>
> = Object.freeze({
  UTG: Object.freeze({
    pairs: 7, // down to 77
    suited_aces: 3, // down to ATs (+ wheel aces in some models, kept simple for strip)
    suited_kings: 2, // down to KTs
    suited_queens_jacks: 1, // down to QTs
    suited_connectors: 0, // T9s
    suited_one_gappers: -1,
    offsuit_aces: 1, // AQo+
    offsuit_broadways: 0, // KQo
  }),
  HJ: Object.freeze({
    pairs: 8, // down to 66
    suited_aces: 7, // down to A6s
    suited_kings: 3, // down to K9s
    suited_queens_jacks: 2, // down to Q9s
    suited_connectors: 2, // down to 87s
    suited_one_gappers: 0, // T8s
    offsuit_aces: 2, // AJo+
    offsuit_broadways: 1, // KJo+
  }),
  CO: Object.freeze({
    pairs: 10, // down to 44
    suited_aces: 11, // all suited aces
    suited_kings: 5, // down to K7s
    suited_queens_jacks: 4, // down to Q7s
    suited_connectors: 4, // down to 65s
    suited_one_gappers: 2, // down to 86s
    offsuit_aces: 3, // ATo+
    offsuit_broadways: 3, // QJo+
  }),
  BTN: Object.freeze({
    pairs: 12, // all pairs 22+
    suited_aces: 11, // all suited aces
    suited_kings: 10, // all suited kings
    suited_queens_jacks: 9, // down to Q3s
    suited_connectors: 5, // all suited connectors 54s+
    suited_one_gappers: 4, // down to 64s
    offsuit_aces: 8, // down to A5o
    offsuit_broadways: 5, // all offsuit broadways JTo+
  }),
  SB: Object.freeze({
    pairs: 12, // all pairs 22+
    suited_aces: 11, // all suited aces
    suited_kings: 8, // down to K5s
    suited_queens_jacks: 6, // down to Q6s
    suited_connectors: 4, // down to 65s
    suited_one_gappers: 3, // down to 75s
    offsuit_aces: 6, // down to A7o
    offsuit_broadways: 4, // down to QTo
  }),
});

export function getEstimatedBaselineCutoff(
  context: StrategyContext,
  familyId: StrategyFamilyId,
): number | null {
  if (
    context.tableSize !== 6 ||
    context.stackDepthBb !== 100 ||
    context.decisionFamily !== 'preflop_rfi'
  ) {
    return null;
  }
  const byPos = ESTIMATED_100BB_6MAX_RFI_CUTOFFS[context.position];
  if (!byPos) return null;
  return byPos[familyId] ?? null;
}

export function compareStrategyWithBaseline(
  projection: StrategyMatrixProjection,
  familyId: StrategyFamilyId,
): StrategyBaselineComparison {
  const { context, contextKey } = projection;
  const family = getStrategyFamily(familyId);
  const userCutoffIndex = deriveFamilyCutoffFromProjection(projection, familyId);
  const baselineCutoffIndex = getEstimatedBaselineCutoff(context, familyId);
  const playersBehind = playersBehindForPosition(context.tableSize, context.position);

  const userCutoffHand =
    userCutoffIndex >= 0 ? family.hands[userCutoffIndex]?.handClass ?? null : null;

  if (baselineCutoffIndex === null) {
    return deepFreeze({
      tier: 'unavailable',
      available: false,
      contextKey,
      familyId,
      position: context.position,
      playersBehind,
      userCutoffIndex,
      baselineCutoffIndex: null,
      userCutoffHand,
      baselineCutoffHand: null,
      deltaHands: null,
      deltaCombos: null,
    });
  }

  const baselineCutoffHand =
    baselineCutoffIndex >= 0 ? family.hands[baselineCutoffIndex]?.handClass ?? null : null;
  const deltaHands = userCutoffIndex - baselineCutoffIndex;

  let userCombos = 0;
  for (let i = 0; i <= userCutoffIndex; i += 1) {
    userCombos += family.hands[i]?.combos ?? 0;
  }
  let baseCombos = 0;
  for (let i = 0; i <= baselineCutoffIndex; i += 1) {
    baseCombos += family.hands[i]?.combos ?? 0;
  }

  return deepFreeze({
    tier: 'estimated',
    available: true,
    contextKey,
    familyId,
    position: context.position,
    playersBehind,
    userCutoffIndex,
    baselineCutoffIndex,
    userCutoffHand,
    baselineCutoffHand,
    deltaHands,
    deltaCombos: userCombos - baseCombos,
  });
}

export function projectStrategyLeakMap(
  tableSize: StrategyTableSize,
  stackDepthBb: StrategyStackDepthBb,
  evidence: readonly StrategyEvidenceEntry[],
): StrategyLeakMapProjection {
  const positions = positionsForTableSize(tableSize).filter((p) => p !== 'BB');
  const projectionsByPos = new Map<string, StrategyMatrixProjection>();
  for (const pos of positions) {
    const ctx = createStrategyContext({
      tableSize,
      stackDepthBb,
      decisionFamily: 'preflop_rfi',
      position: pos,
    });
    projectionsByPos.set(pos, projectStrategyMatrix(ctx, evidence));
  }

  const anyAvailable = tableSize === 6 && stackDepthBb === 100;

  const rows = STRATEGY_FAMILIES.map((family) => ({
    familyId: family.id,
    cells: positions.map((pos): StrategyLeakMapCell => {
      const proj = projectionsByPos.get(pos)!;
      const behind = playersBehindForPosition(tableSize, pos);
      const userCombos = familyRaiseCombosFromProjection(proj, family.id);
      const knownCombos = familyKnownCombosFromProjection(proj, family.id);
      const baseCut = getEstimatedBaselineCutoff(proj.context, family.id);
      if (baseCut === null) {
        return {
          familyId: family.id,
          position: pos,
          playersBehind: behind,
          contextKey: proj.contextKey,
          userCombos,
          baselineCombos: null,
          deltaPoints: null,
          available: false,
        };
      }
      if (knownCombos === 0) {
        return {
          familyId: family.id,
          position: pos,
          playersBehind: behind,
          contextKey: proj.contextKey,
          userCombos,
          baselineCombos: null,
          deltaPoints: null,
          available: true,
        };
      }
      let baselineCombos = 0;
      for (let i = 0; i <= baseCut; i += 1) {
        baselineCombos += family.hands[i]?.combos ?? 0;
      }
      const userPct = (userCombos / family.totalCombos) * 100;
      const basePct = (baselineCombos / family.totalCombos) * 100;
      return {
        familyId: family.id,
        position: pos,
        playersBehind: behind,
        contextKey: proj.contextKey,
        userCombos,
        baselineCombos,
        deltaPoints: Math.round(userPct - basePct),
        available: true,
      };
    }),
  }));

  const columnFooters: StrategyLeakMapColumnFooter[] = positions.map((pos) => {
    const proj = projectionsByPos.get(pos)!;
    const behind = playersBehindForPosition(tableSize, pos);
    const contextKey = strategyContextKey(proj.context);
    const sampleHands = evidence.filter((e) => e.contextKey === contextKey && !e.retracted).length;

    let baselineOpenPct: number | null = null;
    if (anyAvailable) {
      let baseTotal = 0;
      for (const fam of STRATEGY_FAMILIES) {
        const cut = getEstimatedBaselineCutoff(proj.context, fam.id);
        if (cut !== null) {
          for (let i = 0; i <= cut; i += 1) {
            baseTotal += fam.hands[i]?.combos ?? 0;
          }
        }
      }
      baselineOpenPct = Number(((baseTotal / 1326) * 100).toFixed(1));
    }

    return {
      position: pos,
      playersBehind: behind,
      userOpenPct: proj.openPct,
      baselineOpenPct,
      openCombos: proj.openCombos,
      sampleHands,
    };
  });

  return deepFreeze({
    tableSize,
    stackDepthBb,
    tier: anyAvailable ? 'estimated' : 'unavailable',
    positions,
    rows,
    columnFooters,
  });
}
