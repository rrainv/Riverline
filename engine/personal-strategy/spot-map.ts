import { deepFreeze } from '../freeze';
import {
  createStrategyContext,
  decisionFamilyForSpotRow,
  defaultOpenerForSpotRow,
  isSpotMapCellPossible,
  positionsForTableSize,
  strategyContextKey,
} from './context';
import { countSetFamiliesInProjection, STRATEGY_FAMILIES } from './families';
import { projectStrategyMatrix } from './inference';
import type {
  StrategyEvidenceEntry,
  StrategySpotMapProjection,
  StrategySpotRowId,
  StrategySpotState,
  StrategySpotSummary,
  StrategyStackDepthBb,
  StrategyTableSize,
} from './types';

const SPOT_ROWS: readonly StrategySpotRowId[] = Object.freeze([
  'first_in',
  'facing_early_open',
  'facing_late_open',
  'facing_3bet',
]);

export function projectStrategySpotMap(
  tableSize: StrategyTableSize,
  stackDepthBb: StrategyStackDepthBb,
  evidence: readonly StrategyEvidenceEntry[],
): StrategySpotMapProjection {
  const positions = positionsForTableSize(tableSize);
  const totalFamilyCount = STRATEGY_FAMILIES.length;

  let setSpotsCount = 0;
  let totalValidSpotsCount = 0;
  let firstConflict: StrategySpotSummary | null = null;
  let firstInProgress: StrategySpotSummary | null = null;
  let firstNotAsked: StrategySpotSummary | null = null;

  const rows = SPOT_ROWS.map((rowId) => {
    const decisionFamily = decisionFamilyForSpotRow(rowId);
    const openerPosition = defaultOpenerForSpotRow(rowId);

    const cells: StrategySpotSummary[] = positions.map((position) => {
      const ctx = createStrategyContext({
        tableSize,
        stackDepthBb,
        decisionFamily,
        position,
        openerPosition,
      });
      const contextKey = strategyContextKey(ctx);

      if (!isSpotMapCellPossible(tableSize, rowId, position)) {
        return {
          rowId,
          decisionFamily,
          position,
          openerPosition,
          contextKey,
          state: 'cannot_happen' as StrategySpotState,
          setFamilyCount: 0,
          totalFamilyCount,
          openPct: null,
          raisePct: null,
          callPct: null,
          conflictHands: [],
        };
      }

      totalValidSpotsCount += 1;
      const projection = projectStrategyMatrix(ctx, evidence);
      const setFamilyCount = countSetFamiliesInProjection(projection);

      let raiseCombos = 0;
      let callCombos = 0;
      for (const cell of projection.cells) {
        if (cell.dominantAction === 'raise' || cell.dominantAction === 'all_in') {
          raiseCombos += cell.combos;
        } else if (cell.dominantAction === 'call') {
          callCombos += cell.combos;
        }
      }

      let state: StrategySpotState = 'not_asked';
      if (projection.conflictHands.length > 0) {
        state = 'conflict';
      } else if (setFamilyCount >= totalFamilyCount) {
        state = 'set';
      } else if (setFamilyCount > 0 || projection.setHandCount > 0) {
        state = 'in_progress';
      }

      if (state === 'set' || state === 'conflict') {
        setSpotsCount += 1;
      }

      const summary: StrategySpotSummary = {
        rowId,
        decisionFamily,
        position,
        openerPosition,
        contextKey,
        state,
        setFamilyCount,
        totalFamilyCount,
        openPct: projection.setHandCount > 0 ? projection.openPct : null,
        raisePct:
          projection.setHandCount > 0
            ? Number(((raiseCombos / 1326) * 100).toFixed(1))
            : null,
        callPct:
          projection.setHandCount > 0
            ? Number(((callCombos / 1326) * 100).toFixed(1))
            : null,
        conflictHands: projection.conflictHands,
      };

      if (state === 'conflict' && !firstConflict) firstConflict = summary;
      if (state === 'in_progress' && !firstInProgress) firstInProgress = summary;
      if (state === 'not_asked' && !firstNotAsked) firstNotAsked = summary;

      return summary;
    });

    return { rowId, decisionFamily, cells };
  });

  const recommendedSpot = firstConflict ?? firstInProgress ?? firstNotAsked ?? null;

  return deepFreeze({
    tableSize,
    stackDepthBb,
    positions,
    rows,
    setSpotsCount,
    totalValidSpotsCount,
    recommendedSpot,
  });
}
