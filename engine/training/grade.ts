import { deepFreeze } from '../freeze';
import { strategyContextKey } from '../personal-strategy/context';
import { projectStrategyMatrix } from '../personal-strategy/inference';
import type { StrategyActionType, StrategyEvidenceEntry } from '../personal-strategy/types';
import type { ActionType } from '../schema';
import type {
  TrainingDrillMixSegment,
  TrainingGradeComparison,
  TrainingGradeInput,
  TrainingGradeOutput,
  TrainingLampMood,
} from './types';

const MATCHES_GAP = 0.05;
const CLOSE_GAP = 0.15;

function toStrategyAction(action: ActionType | StrategyActionType): StrategyActionType {
  if (action === 'bet') return 'raise';
  return action;
}

function sumFamilyPct(
  segments: readonly TrainingDrillMixSegment[],
  action: StrategyActionType,
): number {
  const familyAction = action === 'all_in' ? 'raise' : action;
  return segments
    .filter((s) => s.action === familyAction)
    .reduce((sum, s) => sum + s.pct, 0);
}

function computeYouPointerPct(
  segments: readonly TrainingDrillMixSegment[],
  action: ActionType | StrategyActionType,
  amountBb: number | null,
): number {
  if (segments.length === 0) return 50;

  let cursor = 0;
  const ranges = segments.map((seg) => {
    const start = cursor;
    const end = cursor + seg.pct;
    cursor = end;
    return { seg, start, end };
  });

  const mapped = toStrategyAction(action);

  if (mapped === 'fold') {
    const foldRange = ranges.find((r) => r.seg.action === 'fold');
    return foldRange ? Math.round((foldRange.start + foldRange.end) / 2) : 3;
  }

  if (mapped === 'call' || mapped === 'check') {
    const callRange = ranges.find((r) => r.seg.action === 'call');
    if (callRange) return Math.round((callRange.start + callRange.end) / 2);
    const foldRange = ranges.find((r) => r.seg.action === 'fold');
    return foldRange ? Math.min(94, Math.round(foldRange.end + 4)) : 12;
  }

  // Raise / all_in: place within raise segments ordered small -> large so bigger raises sit further right
  const raiseRanges = ranges.filter((r) => r.seg.action === 'raise');
  if (raiseRanges.length === 0) return 94;

  if (mapped === 'all_in') {
    const last = raiseRanges[raiseRanges.length - 1]!;
    return Math.min(94, Math.round(last.end - 3));
  }

  if (amountBb !== null) {
    let best = raiseRanges[0]!;
    let bestDiff = Infinity;
    for (const r of raiseRanges) {
      const segAmt = r.seg.amountBb ?? amountBb;
      const diff = Math.abs(segAmt - amountBb);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = r;
      }
    }
    // Nudge within the chosen segment if user's raise size is larger/smaller than segment anchor
    const mid = (best.start + best.end) / 2;
    const segAmt = best.seg.amountBb ?? amountBb;
    const halfSpan = Math.max(2, (best.end - best.start) * 0.35);
    const delta = amountBb > segAmt ? halfSpan * 0.5 : amountBb < segAmt ? -halfSpan * 0.5 : 0;
    return Math.max(6, Math.min(94, Math.round(mid + delta)));
  }

  const firstRaise = raiseRanges[0]!;
  return Math.round((firstRaise.start + firstRaise.end) / 2);
}

export function gradeTrainingAnswer(input: TrainingGradeInput): TrainingGradeOutput {
  const { exercise, chosenActionType } = input;
  if (!exercise || !exercise.exerciseId) {
    throw new TypeError('gradeTrainingAnswer requires a valid TrainingDrillExercise');
  }
  const chosenAmountToBb =
    input.chosenAmountToBb !== undefined && input.chosenAmountToBb !== null
      ? Number(input.chosenAmountToBb)
      : chosenActionType === 'call'
        ? exercise.toCallBb
        : null;

  const segments = exercise.baselineMix;
  const canonical = toStrategyAction(chosenActionType);

  let chosenPct: number | null = null;
  let bestActionType: StrategyActionType | null = null;
  let bestPct: number | null = null;
  let comparison: TrainingGradeComparison = 'unavailable';

  if (exercise.baselineTier === 'estimated' && segments.length > 0) {
    const actions: readonly StrategyActionType[] = ['fold', 'call', 'raise'];
    const totals = actions
      .map((a) => ({ action: a, pct: sumFamilyPct(segments, a) }))
      .filter((t) => t.pct > 0);

    const best = totals.reduce(
      (cur, item) => (!cur || item.pct > cur.pct ? item : cur),
      totals[0] ?? null,
    );
    bestActionType = best?.action ?? null;
    bestPct = best?.pct ?? null;
    chosenPct = sumFamilyPct(segments, canonical);

    if (bestPct !== null) {
      const gap = Math.max(0, (bestPct - chosenPct) / 100);
      if (gap <= MATCHES_GAP) {
        comparison = 'matches';
      } else if (chosenPct > 0 && gap <= CLOSE_GAP + Number.EPSILON) {
        comparison = 'close';
      } else {
        comparison = 'differs';
      }
    }
  }

  const evidence = input.evidence ?? [];
  const planProjection = projectStrategyMatrix(exercise.strategyContext, evidence);
  const planCell = planProjection.cells.find((c) => c.handClass === exercise.handClass);
  const userPlanAction = planCell?.dominantAction ?? null;
  const userPlanStatus = planCell?.status ?? 'unknown';
  const matchesUserPlan =
    userPlanAction === null
      ? null
      : (userPlanAction === canonical || (userPlanAction === 'all_in' && canonical === 'raise'));

  const youPointerPct = computeYouPointerPct(segments, chosenActionType, chosenAmountToBb);

  const lampMood: TrainingLampMood =
    comparison === 'matches'
      ? 'approving'
      : comparison === 'differs'
        ? 'curious'
        : 'speaking';

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const evidenceEntry: StrategyEvidenceEntry = {
    evidenceId: `drill-${exercise.exerciseId}-${occurredAt}`,
    occurredAt,
    contextKey: strategyContextKey(exercise.strategyContext),
    handClass: exercise.handClass,
    source: 'drill',
    action: canonical,
    frequencies: null,
    retracted: false,
    supersedesEvidenceId: null,
  };

  return deepFreeze({
    exerciseId: exercise.exerciseId,
    chosenActionType,
    chosenAmountToBb,
    baselineTier: exercise.baselineTier,
    comparison,
    grade: null,
    isMathMistake: false,
    chosenPct,
    bestActionType,
    bestPct,
    youPointerPct,
    mixSegments: segments,
    userPlanAction,
    userPlanStatus,
    matchesUserPlan,
    lampMood,
    evidenceEntry,
  });
}
