import { deepFreeze } from '../freeze';
import { isPreflopHandClass, PREFLOP_HAND_CLASSES, PREFLOP_MATRIX_RANKS } from '../hand-class';
import { getHoldemCombosForHandClass } from '../holdem-combos';
import { createStrategyContext, strategyContextKey } from './context';
import type {
  StrategyActionFrequencies,
  StrategyActionType,
  StrategyCellPrecision,
  StrategyCellStatus,
  StrategyContext,
  StrategyEvidenceEntry,
  StrategyMatrixCell,
  StrategyMatrixProjection,
} from './types';

function sortChronological(
  left: StrategyEvidenceEntry,
  right: StrategyEvidenceEntry,
): number {
  return (
    left.occurredAt.localeCompare(right.occurredAt) ||
    left.evidenceId.localeCompare(right.evidenceId, 'en')
  );
}

function resolveCellPrecision(
  dominantAction: StrategyActionType | null,
  frequencies: StrategyActionFrequencies | null,
): StrategyCellPrecision {
  if (!frequencies) {
    return dominantAction ? 'dominant_only' : 'unknown';
  }
  const entries = Object.entries(frequencies).filter(
    ([, prob]) => typeof prob === 'number' && prob > 0,
  );
  if (entries.length === 0) {
    return dominantAction ? 'dominant_only' : 'unknown';
  }
  const maxProb = Math.max(...entries.map(([, prob]) => prob ?? 0));
  const tiedTop = entries.filter(([, prob]) => Math.abs((prob ?? 0) - maxProb) <= 1e-9);
  if (tiedTop.length > 1) {
    return 'tied_exact_mix';
  }
  if (entries.length === 1 && Math.abs(maxProb - 1) <= 1e-9) {
    return 'pure_explicit';
  }
  return 'exact_mix';
}

function foldHandEvidence(
  entries: readonly StrategyEvidenceEntry[],
): {
  status: StrategyCellStatus;
  precision: StrategyCellPrecision;
  dominantAction: StrategyActionType | null;
  frequencies: StrategyActionFrequencies | null;
  hasConflict: boolean;
  directCount: number;
  drillEvidenceCount: number;
  drillFoldCount: number;
} {
  if (entries.length === 0) {
    return {
      status: 'unknown',
      precision: 'unknown',
      dominantAction: null,
      frequencies: null,
      hasConflict: false,
      directCount: 0,
      drillEvidenceCount: 0,
      drillFoldCount: 0,
    };
  }

  const supersededIds = new Set<string>();
  for (const entry of entries) {
    if (entry.supersedesEvidenceId) {
      supersededIds.add(entry.supersedesEvidenceId);
    }
  }

  const active = entries
    .filter((entry) => !entry.retracted && !supersededIds.has(entry.evidenceId))
    .sort(sortChronological);

  if (active.length === 0) {
    return {
      status: 'unknown',
      precision: 'unknown',
      dominantAction: null,
      frequencies: null,
      hasConflict: false,
      directCount: 0,
      drillEvidenceCount: 0,
      drillFoldCount: 0,
    };
  }

  const directEntries = active.filter(
    (e) =>
      e.source === 'calibration' ||
      e.source === 'matrix' ||
      e.source === 'conflict_resolution',
  );
  const drillEntries = active.filter((e) => e.source === 'drill');
  const drillFoldCount = drillEntries.filter((e) => e.action === 'fold').length;

  const latestDirect = directEntries.at(-1) ?? null;
  const latestResolution =
    directEntries.filter((e) => e.source === 'conflict_resolution').at(-1) ?? null;

  if (!latestDirect) {
    // Only drill evidence exists, no direct plan answer yet -> uncertain (never treat as final plan)
    const latestDrill = drillEntries.at(-1)!;
    return {
      status: 'uncertain',
      precision: 'dominant_only',
      dominantAction: latestDrill.action,
      frequencies: latestDrill.frequencies ?? null,
      hasConflict: false,
      directCount: 0,
      drillEvidenceCount: drillEntries.length,
      drillFoldCount,
    };
  }

  // Check if drill evidence after the last conflict resolution disagrees with the direct plan
  const relevantDrills = latestResolution
    ? drillEntries.filter((d) => sortChronological(d, latestResolution) > 0)
    : drillEntries;

  const disagreeingDrills = relevantDrills.filter(
    (d) => d.action !== latestDirect.action,
  );
  const hasConflict =
    relevantDrills.length >= 3 &&
    disagreeingDrills.length > relevantDrills.length / 2;

  const frequencies = latestDirect.frequencies ?? null;
  const precision = resolveCellPrecision(latestDirect.action, frequencies);

  return {
    status: hasConflict ? 'conflicting' : 'direct',
    precision,
    dominantAction: latestDirect.action,
    frequencies,
    hasConflict,
    directCount: directEntries.length,
    drillEvidenceCount: drillEntries.length,
    drillFoldCount,
  };
}

export function projectStrategyMatrix(
  rawContext: StrategyContext,
  evidence: readonly StrategyEvidenceEntry[],
): StrategyMatrixProjection {
  const context = createStrategyContext(rawContext);
  const contextKey = strategyContextKey(context);

  const byHand = new Map<string, StrategyEvidenceEntry[]>();
  for (const entry of evidence) {
    if (entry.contextKey !== contextKey) continue;
    if (!isPreflopHandClass(entry.handClass)) continue;
    const list = byHand.get(entry.handClass);
    if (list) {
      list.push(entry);
    } else {
      byHand.set(entry.handClass, [entry]);
    }
  }

  let knownCombos = 0;
  let openCombos = 0;
  let setHandCount = 0;
  const conflictHands: string[] = [];
  const cells: StrategyMatrixCell[] = [];

  for (let row = 0; row < PREFLOP_MATRIX_RANKS.length; row += 1) {
    for (let col = 0; col < PREFLOP_MATRIX_RANKS.length; col += 1) {
      const idx = row * PREFLOP_MATRIX_RANKS.length + col;
      const handClass = PREFLOP_HAND_CLASSES[idx]!;
      const combos = getHoldemCombosForHandClass(handClass).length;
      const handEntries = byHand.get(handClass) ?? [];
      const folded = foldHandEvidence(handEntries);

      if (folded.status !== 'unknown') {
        knownCombos += combos;
        setHandCount += 1;
      }
      if (folded.dominantAction === 'raise' || folded.dominantAction === 'all_in') {
        openCombos += combos;
      }
      if (folded.hasConflict) {
        conflictHands.push(handClass);
      }

      cells.push({
        handClass,
        row,
        col,
        combos,
        status: folded.status,
        precision: folded.precision,
        dominantAction: folded.dominantAction,
        frequencies: folded.frequencies,
        hasConflict: folded.hasConflict,
        directCount: folded.directCount,
        drillEvidenceCount: folded.drillEvidenceCount,
        drillFoldCount: folded.drillFoldCount,
      });
    }
  }

  const totalCombos = 1326 as const;
  const unknownCombos = totalCombos - knownCombos;
  const openPct = Number(((openCombos / totalCombos) * 100).toFixed(1));

  return deepFreeze({
    contextKey,
    context,
    cells,
    totalCombos,
    knownCombos,
    unknownCombos,
    openCombos,
    openPct,
    setHandCount,
    conflictHands,
  });
}
