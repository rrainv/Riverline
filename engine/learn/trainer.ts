import { potOddsFacts } from '../economics-facts';
import { deepFreeze } from '../freeze';
import { createRangeAnalysisFacts } from '../range-analysis';
import type {
  LearnOutsSpot,
  LearnPotOddsSpot,
  LearnTrainerGrade,
  LearnTrainerMode,
  LearnTrainerOption,
  LearnTrainerRound,
} from './types';

export const LEARN_POT_ODDS_SPOTS: readonly LearnPotOddsSpot[] = deepFreeze([
  { id: 'po_12_6', potBeforeBetBb: 12, betBb: 6 },
  { id: 'po_10_10', potBeforeBetBb: 10, betBb: 10 },
  { id: 'po_8_12', potBeforeBetBb: 8, betBb: 12 },
  { id: 'po_15_5', potBeforeBetBb: 15, betBb: 5 },
  { id: 'po_16_4', potBeforeBetBb: 16, betBb: 4 },
  { id: 'po_10_30', potBeforeBetBb: 10, betBb: 30 },
]);

export const LEARN_OUTS_SPOTS: readonly LearnOutsSpot[] = deepFreeze([
  {
    id: 'out_flush',
    heroCards: ['Ah', 'Kh'],
    board: ['Qh', '7c', '2h'],
    drawKind: 'flush',
  },
  {
    id: 'out_oesd',
    heroCards: ['Jc', 'Td'],
    board: ['9s', '8h', '2c'],
    drawKind: 'oesd',
  },
  {
    id: 'out_gutshot',
    heroCards: ['As', 'Jd'],
    board: ['Qc', 'Ts', '3h'],
    drawKind: 'gutshot',
  },
  {
    id: 'out_combo_oesd_flush',
    heroCards: ['Jh', 'Th'],
    board: ['9h', '8c', '2h'],
    drawKind: 'combo_oesd_flush',
  },
  {
    id: 'out_combo_gutshot_flush',
    heroCards: ['Ah', 'Jh'],
    board: ['Kh', 'Tc', '4h'],
    drawKind: 'combo_gutshot_flush',
  },
  {
    id: 'out_double_gutshot',
    heroCards: ['Td', '8s'],
    board: ['Jh', '7c', '6d'],
    drawKind: 'double_gutshot',
  },
]);

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizePotOddsOptions(
  spot: LearnPotOddsSpot,
  spotIndex: number,
): { readonly correctPercent: number; readonly options: readonly LearnTrainerOption[] } {
  const potBeforeCallBb = spot.potBeforeBetBb + spot.betBb;
  const exact = potOddsFacts(spot.betBb, potBeforeCallBb);
  const correctPercent = roundToOneDecimal(exact.requiredPercent);

  const rawDistractors = [
    potOddsFacts(spot.betBb, spot.potBeforeBetBb).requiredPercent, // Forgot own call
    (spot.betBb / spot.potBeforeBetBb) * 100, // Bet / pot before bet
    (spot.betBb / (spot.potBeforeBetBb + 3 * spot.betBb)) * 100, // Overcounted pot
  ].map(roundToOneDecimal);

  const used = new Set<number>([correctPercent]);
  const uniqueDistractors: number[] = [];
  for (let j = 0; j < rawDistractors.length; j += 1) {
    let candidate = rawDistractors[j]!;
    while (
      Array.from(used).some((v) => Math.abs(v - candidate) < 0.5) ||
      candidate <= 0 ||
      candidate >= 95
    ) {
      candidate = roundToOneDecimal(candidate + 5 + j * 2);
      if (candidate >= 95) {
        candidate = roundToOneDecimal(Math.max(4, correctPercent - (6 + j * 3)));
      }
    }
    used.add(candidate);
    uniqueDistractors.push(candidate);
  }

  const pool = [
    { value: correctPercent, isCorrect: true },
    ...uniqueDistractors.map((value) => ({ value, isCorrect: false })),
  ];
  const order = [
    (spotIndex + 1) % 4,
    (spotIndex + 3) % 4,
    (spotIndex + 2) % 4,
    spotIndex % 4,
  ];
  const options = order.map((poolIdx, optionIdx) => ({
    index: optionIdx,
    value: pool[poolIdx]!.value,
    isCorrect: pool[poolIdx]!.isCorrect,
  }));

  return { correctPercent, options };
}

function analyzeOutsSpot(spot: LearnOutsSpot) {
  const analysis = createRangeAnalysisFacts({
    board: [...spot.board],
    heroCards: [...spot.heroCards],
  });
  const drawOuts = analysis.exactHand.drawOuts;
  if (!drawOuts.available) {
    throw new Error(`Learn outs spot ${spot.id} has no available drawOuts`);
  }
  return drawOuts;
}

function normalizeOutsOptions(
  spot: LearnOutsSpot,
  spotIndex: number,
): {
  readonly drawOuts: ReturnType<typeof analyzeOutsSpot>;
  readonly options: readonly LearnTrainerOption[];
} {
  const drawOuts = analyzeOutsSpot(spot);
  const correctCount = drawOuts.uniqueCompletionCardCount;
  const naiveSum = drawOuts.flush.count + drawOuts.straight.count;

  const candidates: number[] = [];
  if (naiveSum !== correctCount && naiveSum > 0) {
    candidates.push(naiveSum);
  }
  const fallbackOffsets = [-2, 2, 4, -4, 3, -1];
  for (const offset of fallbackOffsets) {
    const val = correctCount + offset;
    if (val > 0 && val <= 20 && val !== correctCount && !candidates.includes(val)) {
      candidates.push(val);
    }
    if (candidates.length >= 3) break;
  }

  const pool = [
    { value: correctCount, isCorrect: true },
    ...candidates.slice(0, 3).map((value) => ({ value, isCorrect: false })),
  ];
  const order = [
    (spotIndex + 1) % 4,
    (spotIndex + 3) % 4,
    (spotIndex + 2) % 4,
    spotIndex % 4,
  ];
  const options = order.map((poolIdx, optionIdx) => ({
    index: optionIdx,
    value: pool[poolIdx]!.value,
    isCorrect: pool[poolIdx]!.isCorrect,
  }));

  return { drawOuts, options };
}

export function getLearnTrainerRound(
  mode: LearnTrainerMode,
  spotIndex: number,
): LearnTrainerRound {
  if (mode === 'pot_odds') {
    const totalSpots = LEARN_POT_ODDS_SPOTS.length;
    const normalizedIdx = ((spotIndex % totalSpots) + totalSpots) % totalSpots;
    const spot = LEARN_POT_ODDS_SPOTS[normalizedIdx]!;
    const { options } = normalizePotOddsOptions(spot, normalizedIdx);
    return deepFreeze({
      mode,
      spotIndex: normalizedIdx,
      totalSpots,
      spotId: spot.id,
      potBeforeBetBb: spot.potBeforeBetBb,
      betBb: spot.betBb,
      options,
    });
  }

  const totalSpots = LEARN_OUTS_SPOTS.length;
  const normalizedIdx = ((spotIndex % totalSpots) + totalSpots) % totalSpots;
  const spot = LEARN_OUTS_SPOTS[normalizedIdx]!;
  const { options } = normalizeOutsOptions(spot, normalizedIdx);
  return deepFreeze({
    mode,
    spotIndex: normalizedIdx,
    totalSpots,
    spotId: spot.id,
    heroCards: spot.heroCards,
    board: spot.board,
    drawKind: spot.drawKind,
    options,
  });
}

export function gradeLearnTrainerAnswer(
  mode: LearnTrainerMode,
  spotIndex: number,
  chosenOptionIndex: number,
): LearnTrainerGrade {
  if (mode === 'pot_odds') {
    const totalSpots = LEARN_POT_ODDS_SPOTS.length;
    const normalizedIdx = ((spotIndex % totalSpots) + totalSpots) % totalSpots;
    const spot = LEARN_POT_ODDS_SPOTS[normalizedIdx]!;
    const { correctPercent, options } = normalizePotOddsOptions(spot, normalizedIdx);
    const chosen = options[chosenOptionIndex];
    if (!chosen) {
      throw new RangeError(`Invalid option index ${chosenOptionIndex}`);
    }
    const correctOptionIndex = options.findIndex((o) => o.isCorrect);
    const potAfterBetBb = spot.potBeforeBetBb + spot.betBb;
    const potAfterCallBb = potAfterBetBb + spot.betBb;
    return deepFreeze({
      mode,
      spotId: spot.id,
      spotIndex: normalizedIdx,
      chosenOptionIndex,
      correctOptionIndex,
      correctValue: correctPercent,
      isCorrect: chosen.isCorrect,
      tier: 'exact',
      qualifier: 'price_only',
      potBeforeBetBb: spot.potBeforeBetBb,
      betBb: spot.betBb,
      potAfterBetBb,
      potAfterCallBb,
    });
  }

  const totalSpots = LEARN_OUTS_SPOTS.length;
  const normalizedIdx = ((spotIndex % totalSpots) + totalSpots) % totalSpots;
  const spot = LEARN_OUTS_SPOTS[normalizedIdx]!;
  const { drawOuts, options } = normalizeOutsOptions(spot, normalizedIdx);
  const chosen = options[chosenOptionIndex];
  if (!chosen) {
    throw new RangeError(`Invalid option index ${chosenOptionIndex}`);
  }
  const correctOptionIndex = options.findIndex((o) => o.isCorrect);
  return deepFreeze({
    mode,
    spotId: spot.id,
    spotIndex: normalizedIdx,
    chosenOptionIndex,
    correctOptionIndex,
    correctValue: drawOuts.uniqueCompletionCardCount,
    isCorrect: chosen.isCorrect,
    tier: 'exact',
    flushCount: drawOuts.flush.count,
    straightCount: drawOuts.straight.count,
    overlapCount: drawOuts.overlaps.length,
    uniqueOutsCount: drawOuts.uniqueCompletionCardCount,
    completionCards: drawOuts.uniqueCompletionCards,
  });
}
