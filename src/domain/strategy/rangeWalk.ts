import {
  CARD_RANKS,
  CARD_SUITS,
  getHoldemCombosForHandClass,
  PREFLOP_MATRIX_RANKS,
  type EngineClient,
} from '../../engine-api';
import { parsePlayerHandInput } from '../shorthand';

export type RangeWalkBucketId = 'strong' | 'one_pair' | 'draw' | 'air';
export type RangeWalkStreet = 'preflop' | 'flop' | 'turn' | 'river';

export const RANGE_WALK_BUCKETS: readonly RangeWalkBucketId[] = [
  'strong',
  'one_pair',
  'draw',
  'air',
];

export const RANGE_WALK_PRESETS: readonly {
  readonly id: string;
  readonly label: string;
  readonly range: string;
}[] = [
  { id: 'utg_15', label: 'UTG 15%', range: 'top 15%' },
  { id: 'co_27', label: 'CO 27%', range: 'top 27%' },
  { id: 'btn_45', label: 'BTN 45%', range: 'top 45%' },
  { id: 'bb_38', label: 'BB 38%', range: 'top 38%' },
];

export const RANGE_WALK_BOARD_PRESETS: readonly {
  readonly id: string;
  readonly label: string;
  readonly cards: readonly [string, string, string, string, string];
}[] = [
  { id: 'dry_flush', label: 'Qh 7c 2h', cards: ['Qh', '7c', '2h', '9s', 'Kd'] },
  { id: 'wet_conn', label: 'Js Ts 8c', cards: ['Js', 'Ts', '8c', 'Qd', '4s'] },
  { id: 'high_dry', label: 'Kc 7d 2s', cards: ['Kc', '7d', '2s', '5h', 'Jc'] },
];

const RANK_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  [...CARD_RANKS].map((r, i) => [r, i]),
);
const SUIT_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  [...CARD_SUITS].map((s, i) => [s, i]),
);

const STRAIGHT_WINDOWS: readonly number[] = [
  // Wheel A-2-3-4-5 (bits 12,0,1,2,3)
  (1 << 12) | 0b1111,
  ...Array.from({ length: 9 }, (_, i) => 0b11111 << i),
];

function popcount(mask: number): number {
  let x = mask;
  let c = 0;
  while (x) {
    x &= x - 1;
    c += 1;
  }
  return c;
}

export function classifyComboOnBoard(
  hole: readonly [string, string],
  board: readonly string[],
): RangeWalkBucketId {
  const rankCounts = new Int32Array(13);
  const suitCounts = new Int32Array(4);
  let rankMask = 0;

  const h0r = RANK_INDEX[hole[0][0]!]!;
  const h0s = SUIT_INDEX[hole[0][1]!]!;
  const h1r = RANK_INDEX[hole[1][0]!]!;
  const h1s = SUIT_INDEX[hole[1][1]!]!;

  rankCounts[h0r]! += 1;
  suitCounts[h0s]! += 1;
  rankMask |= 1 << h0r;

  rankCounts[h1r]! += 1;
  suitCounts[h1s]! += 1;
  rankMask |= 1 << h1r;

  for (let i = 0; i < board.length; i += 1) {
    const card = board[i]!;
    const r = RANK_INDEX[card[0]!]!;
    const s = SUIT_INDEX[card[1]!]!;
    rankCounts[r]! += 1;
    suitCounts[s]! += 1;
    rankMask |= 1 << r;
  }

  let hasFlush = false;
  for (let s = 0; s < 4; s += 1) {
    if (suitCounts[s]! >= 5) {
      hasFlush = true;
      break;
    }
  }
  if (hasFlush) return 'strong';

  for (let w = 0; w < STRAIGHT_WINDOWS.length; w += 1) {
    const win = STRAIGHT_WINDOWS[w]!;
    if ((rankMask & win) === win) return 'strong';
  }

  let pairs = 0;
  let trips = 0;
  for (let r = 0; r < 13; r += 1) {
    const c = rankCounts[r]!;
    if (c >= 4) return 'strong';
    if (c === 3) trips += 1;
    else if (c === 2) pairs += 1;
  }
  if (trips >= 1 || pairs >= 2) return 'strong';
  if (pairs === 1) return 'one_pair';

  if (board.length < 5) {
    if (suitCounts[h0s]! === 4 || suitCounts[h1s]! === 4) {
      return 'draw';
    }
    for (let w = 0; w < STRAIGHT_WINDOWS.length; w += 1) {
      const win = STRAIGHT_WINDOWS[w]!;
      if (popcount(rankMask & win) === 4) {
        return 'draw';
      }
    }
  }

  return 'air';
}

export interface RangeWalkCellCombo {
  readonly cards: readonly [string, string];
  readonly bucket: RangeWalkBucketId | null;
}

export interface RangeWalkCellSummary {
  readonly handClass: string;
  readonly totalLive: number;
  readonly keptLive: number;
  readonly dominantBucket: RangeWalkBucketId | null;
  readonly combos: readonly RangeWalkCellCombo[];
}

export interface RangeWalkClashSummary {
  readonly heroNutPct: number;
  readonly villainNutPct: number;
  readonly nutDeltaPct: number;
  readonly heroMadePct: number;
  readonly villainMadePct: number;
  readonly madeDeltaPct: number;
}

export function compareRangeWalkClash(
  hero: RangeWalkAnalysis,
  villain: RangeWalkAnalysis,
): RangeWalkClashSummary {
  const pct = (part: number, total: number) =>
    total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
  const heroNutPct = pct(hero.bucketCounts.strong, hero.liveCombos);
  const villainNutPct = pct(villain.bucketCounts.strong, villain.liveCombos);
  const heroMadePct = pct(
    hero.bucketCounts.strong + hero.bucketCounts.one_pair,
    hero.liveCombos,
  );
  const villainMadePct = pct(
    villain.bucketCounts.strong + villain.bucketCounts.one_pair,
    villain.liveCombos,
  );
  return {
    heroNutPct,
    villainNutPct,
    nutDeltaPct: Math.round((heroNutPct - villainNutPct) * 10) / 10,
    heroMadePct,
    villainMadePct,
    madeDeltaPct: Math.round((heroMadePct - villainMadePct) * 10) / 10,
  };
}

export interface RangeWalkAnalysis {
  readonly valid: boolean;
  readonly isPreflop: boolean;
  readonly totalBeforeRemoval: number;
  readonly liveCombos: number;
  readonly blockedCombos: number;
  readonly keptCombos: number;
  readonly keptPct: number;
  readonly bucketCounts: Readonly<Record<RangeWalkBucketId, number>>;
  readonly cellsByClass: Readonly<Record<string, RangeWalkCellSummary>>;
}

export function handClassAtMatrixCell(rowIdx: number, colIdx: number): string {
  const rRow = PREFLOP_MATRIX_RANKS[rowIdx]!;
  const rCol = PREFLOP_MATRIX_RANKS[colIdx]!;
  if (rowIdx === colIdx) return `${rRow}${rCol}`;
  if (rowIdx < colIdx) return `${rRow}${rCol}s`;
  return `${rCol}${rRow}o`;
}

export function analyzeRangeWalkStreet(input: {
  readonly rangeText: string;
  readonly board: readonly string[];
  readonly keptBuckets: ReadonlySet<RangeWalkBucketId>;
  readonly engine: EngineClient;
}): RangeWalkAnalysis {
  const emptyBuckets: Record<RangeWalkBucketId, number> = {
    strong: 0,
    one_pair: 0,
    draw: 0,
    air: 0,
  };

  const parsed = parsePlayerHandInput(input.rangeText.trim() || 'top 20%', {
    deadCards: input.board,
    engine: input.engine,
  });

  if (!parsed.ok || parsed.kind === 'any') {
    return {
      valid: false,
      isPreflop: input.board.length === 0,
      totalBeforeRemoval: 0,
      liveCombos: 0,
      blockedCombos: 0,
      keptCombos: 0,
      keptPct: 0,
      bucketCounts: emptyBuckets,
      cellsByClass: {},
    };
  }

  const classSet: ReadonlySet<string> =
    parsed.kind === 'range'
      ? parsed.handClasses
      : new Set([
          // Exact single holding
          (() => {
            const [c0, c1] = parsed.cards;
            const i0 = RANK_INDEX[c0[0]!]!;
            const i1 = RANK_INDEX[c1[0]!]!;
            if (i0 === i1) return `${c0[0]}${c1[0]}`;
            const hi = i0 > i1 ? c0[0] : c1[0];
            const lo = i0 > i1 ? c1[0] : c0[0];
            return `${hi}${lo}${c0[1] === c1[1] ? 's' : 'o'}`;
          })(),
        ]);

  const boardSet = new Set(input.board);
  const isPreflop = input.board.length < 3;
  const bucketCounts: Record<RangeWalkBucketId, number> = {
    strong: 0,
    one_pair: 0,
    draw: 0,
    air: 0,
  };
  const cellsByClass: Record<string, RangeWalkCellSummary> = {};
  let totalBeforeRemoval = 0;
  let liveCombos = 0;
  let keptCombos = 0;

  for (const handClass of classSet) {
    const combos = getHoldemCombosForHandClass(handClass);
    totalBeforeRemoval += combos.length;

    const classBucketCounts: Record<RangeWalkBucketId, number> = {
      strong: 0,
      one_pair: 0,
      draw: 0,
      air: 0,
    };
    let classLive = 0;
    let classKept = 0;
    const cellCombos: RangeWalkCellCombo[] = [];

    for (const combo of combos) {
      if (boardSet.has(combo.cards[0]) || boardSet.has(combo.cards[1])) {
        continue;
      }
      classLive += 1;
      liveCombos += 1;

      if (isPreflop) {
        classKept += 1;
        keptCombos += 1;
        cellCombos.push({ cards: combo.cards, bucket: null });
      } else {
        const bucket = classifyComboOnBoard(combo.cards, input.board);
        bucketCounts[bucket] += 1;
        classBucketCounts[bucket] += 1;
        cellCombos.push({ cards: combo.cards, bucket });
        if (input.keptBuckets.has(bucket)) {
          classKept += 1;
          keptCombos += 1;
        }
      }
    }

    let dominantBucket: RangeWalkBucketId | null = null;
    if (!isPreflop && classLive > 0) {
      let best = -1;
      for (const b of RANGE_WALK_BUCKETS) {
        if (classBucketCounts[b] > best) {
          best = classBucketCounts[b];
          dominantBucket = b;
        }
      }
    }

    cellsByClass[handClass] = {
      handClass,
      totalLive: classLive,
      keptLive: classKept,
      dominantBucket,
      combos: cellCombos,
    };
  }

  return {
    valid: true,
    isPreflop,
    totalBeforeRemoval,
    liveCombos,
    blockedCombos: Math.max(0, totalBeforeRemoval - liveCombos),
    keptCombos,
    keptPct: liveCombos > 0 ? Math.round((keptCombos / liveCombos) * 1000) / 10 : 0,
    bucketCounts,
    cellsByClass,
  };
}
