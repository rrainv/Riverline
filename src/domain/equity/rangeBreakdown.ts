import type { HoldemWeightedRange } from '../../engine-api';

const HOLDEM_COMBO_ID_PREFIX = 'holdem-combo/v1:';

export type RangeBreakdownBucketId =
  | 'sets_plus'
  | 'two_pair'
  | 'top_overpair'
  | 'mid_weak_pair'
  | 'combo_draw'
  | 'flush_straight_draw'
  | 'gutshot_overcards'
  | 'air';

export const RANGE_BREAKDOWN_BUCKET_ORDER: readonly RangeBreakdownBucketId[] = [
  'sets_plus',
  'two_pair',
  'top_overpair',
  'mid_weak_pair',
  'combo_draw',
  'flush_straight_draw',
  'gutshot_overcards',
  'air',
];

export interface RangeBreakdownBucket {
  readonly id: RangeBreakdownBucketId;
  readonly comboCount: number;
  readonly weightedCombos: number;
  readonly sharePct: number;
  readonly comboIds: readonly string[];
}

export interface RangeBreakdownResult {
  readonly totalCombos: number;
  readonly totalWeight: number;
  readonly buckets: readonly RangeBreakdownBucket[];
}

const RANK_VAL: Readonly<Record<string, number>> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const SUIT_IDX: Readonly<Record<string, number>> = {
  s: 0,
  h: 1,
  d: 2,
  c: 3,
};

const WHEEL_MASK = (1 << 14) | (1 << 5) | (1 << 4) | (1 << 3) | (1 << 2);

const STRAIGHT_WINDOWS: readonly number[] = [
  WHEEL_MASK,
  ...Array.from({ length: 9 }, (_, i) => 0b11111 << (i + 2)),
];

function popcount(n: number): number {
  let x = n;
  let count = 0;
  while (x !== 0) {
    x &= x - 1;
    count += 1;
  }
  return count;
}

function hasFiveCardStraight(rankMask: number): boolean {
  for (const win of STRAIGHT_WINDOWS) {
    if ((rankMask & win) === win) return true;
  }
  return false;
}

function parseComboIdCards(comboId: string): readonly [string, string] | null {
  if (!comboId.startsWith(HOLDEM_COMBO_ID_PREFIX)) return null;
  const rest = comboId.slice(HOLDEM_COMBO_ID_PREFIX.length);
  const parts = rest.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

export function classifyComboAgainstBoard(
  holeCards: readonly [string, string],
  board: readonly string[],
): RangeBreakdownBucketId {
  const rankCounts = new Int8Array(15);
  const boardRankCounts = new Int8Array(15);
  const suitCounts = new Int8Array(4);
  let totalRankMask = 0;
  let boardRankMask = 0;
  let maxBoardRank = 0;

  for (const card of board) {
    const r = RANK_VAL[card[0]?.toUpperCase() ?? ''] ?? 0;
    const s = SUIT_IDX[card[1]?.toLowerCase() ?? ''] ?? -1;
    if (r < 2 || s < 0) continue;
    rankCounts[r] = (rankCounts[r] ?? 0) + 1;
    boardRankCounts[r] = (boardRankCounts[r] ?? 0) + 1;
    suitCounts[s] = (suitCounts[s] ?? 0) + 1;
    totalRankMask |= 1 << r;
    boardRankMask |= 1 << r;
    if (r > maxBoardRank) maxBoardRank = r;
  }

  const h0R = RANK_VAL[holeCards[0][0]?.toUpperCase() ?? ''] ?? 0;
  const h0S = SUIT_IDX[holeCards[0][1]?.toLowerCase() ?? ''] ?? -1;
  const h1R = RANK_VAL[holeCards[1][0]?.toUpperCase() ?? ''] ?? 0;
  const h1S = SUIT_IDX[holeCards[1][1]?.toLowerCase() ?? ''] ?? -1;

  if (h0R >= 2 && h0S >= 0) {
    rankCounts[h0R] = (rankCounts[h0R] ?? 0) + 1;
    suitCounts[h0S] = (suitCounts[h0S] ?? 0) + 1;
    totalRankMask |= 1 << h0R;
  }
  if (h1R >= 2 && h1S >= 0) {
    rankCounts[h1R] = (rankCounts[h1R] ?? 0) + 1;
    suitCounts[h1S] = (suitCounts[h1S] ?? 0) + 1;
    totalRankMask |= 1 << h1R;
  }

  // Flush or straight -> sets_plus
  for (let s = 0; s < 4; s += 1) {
    if ((suitCounts[s] ?? 0) >= 5) return 'sets_plus';
  }
  if (hasFiveCardStraight(totalRankMask)) return 'sets_plus';

  let maxMultiplicity = 0;
  let pairCount = 0;
  let singlePairRank = 0;
  for (let r = 2; r <= 14; r += 1) {
    const c = rankCounts[r] ?? 0;
    if (c > maxMultiplicity) maxMultiplicity = c;
    if (c >= 2) {
      pairCount += 1;
      singlePairRank = r;
    }
  }

  if (maxMultiplicity >= 3) {
    return 'sets_plus';
  }
  if (pairCount >= 2) {
    return 'two_pair';
  }

  if (pairCount === 1) {
    const isPureBoardPair =
      (boardRankCounts[singlePairRank] ?? 0) === 2 &&
      h0R !== singlePairRank &&
      h1R !== singlePairRank;
    if (!isPureBoardPair) {
      const isPocketOverpair = h0R === h1R && h0R > maxBoardRank;
      const isTopPair =
        singlePairRank === maxBoardRank && (h0R === singlePairRank || h1R === singlePairRank);
      return isPocketOverpair || isTopPair ? 'top_overpair' : 'mid_weak_pair';
    }
  }

  // Draws on flop or turn (board.length < 5)
  if (board.length < 5) {
    const hasFlushDraw =
      (h0S >= 0 && (suitCounts[h0S] ?? 0) === 4) ||
      (h1S >= 0 && (suitCounts[h1S] ?? 0) === 4);

    const holeMask = (h0R >= 2 ? 1 << h0R : 0) | (h1R >= 2 ? 1 << h1R : 0);
    let straightDrawWindows = 0;
    for (const win of STRAIGHT_WINDOWS) {
      if (
        popcount(totalRankMask & win) === 4 &&
        (holeMask & win) !== 0 &&
        (holeMask & ~boardRankMask & win) !== 0
      ) {
        straightDrawWindows += 1;
      }
    }
    const isOesd = straightDrawWindows >= 2;
    const isAnyStraightDraw = straightDrawWindows >= 1;

    if (hasFlushDraw && isAnyStraightDraw) return 'combo_draw';
    if (hasFlushDraw || isOesd) return 'flush_straight_draw';
    if (isAnyStraightDraw || (h0R > maxBoardRank && h1R > maxBoardRank)) {
      return 'gutshot_overcards';
    }
  }

  return 'air';
}

export function computePostflopRangeBreakdown(
  range: HoldemWeightedRange,
  board: readonly string[],
  deadCards: readonly string[] = [],
): RangeBreakdownResult | null {
  if (board.length < 3) return null;
  const dead = new Set<string>([...board, ...deadCards]);

  const bucketCombos: Record<RangeBreakdownBucketId, string[]> = {
    sets_plus: [],
    two_pair: [],
    top_overpair: [],
    mid_weak_pair: [],
    combo_draw: [],
    flush_straight_draw: [],
    gutshot_overcards: [],
    air: [],
  };
  const bucketWeights: Record<RangeBreakdownBucketId, number> = {
    sets_plus: 0,
    two_pair: 0,
    top_overpair: 0,
    mid_weak_pair: 0,
    combo_draw: 0,
    flush_straight_draw: 0,
    gutshot_overcards: 0,
    air: 0,
  };

  let totalCombos = 0;
  let totalWeight = 0;

  for (const entry of range.entries) {
    if (entry.state !== 'known' || entry.weight <= 0) continue;
    const cards = parseComboIdCards(entry.comboId);
    if (!cards) continue;
    if (dead.has(cards[0]) || dead.has(cards[1])) continue;

    const bucket = classifyComboAgainstBoard(cards, board);
    bucketCombos[bucket].push(entry.comboId);
    bucketWeights[bucket] += entry.weight;
    totalCombos += 1;
    totalWeight += entry.weight;
  }

  const buckets: RangeBreakdownBucket[] = RANGE_BREAKDOWN_BUCKET_ORDER.map((id) => {
    const comboIds = bucketCombos[id];
    const weightedCombos = Math.round(bucketWeights[id] * 10) / 10;
    const sharePct = totalWeight > 0 ? Math.round((bucketWeights[id] / totalWeight) * 1000) / 10 : 0;
    return {
      id,
      comboCount: comboIds.length,
      weightedCombos,
      sharePct,
      comboIds,
    };
  });

  return {
    totalCombos,
    totalWeight: Math.round(totalWeight * 10) / 10,
    buckets,
  };
}

export function filterWeightedRangeByBucketWeights(
  range: HoldemWeightedRange,
  breakdown: RangeBreakdownResult,
  bucketWeights: Readonly<Partial<Record<RangeBreakdownBucketId, number>>>,
): HoldemWeightedRange {
  const multiplierByComboId = new Map<string, number>();
  for (const bucket of breakdown.buckets) {
    const mult = bucketWeights[bucket.id] ?? 1;
    for (const comboId of bucket.comboIds) {
      multiplierByComboId.set(comboId, mult);
    }
  }

  return {
    ...range,
    rangeId: range.rangeId ? `${range.rangeId}#filtered` : 'filtered-range',
    entries: range.entries.map((entry) => {
      if (entry.state !== 'known' || entry.weight <= 0) return entry;
      const mult = multiplierByComboId.get(entry.comboId) ?? 0;
      const nextWeight = Math.max(0, Math.min(1, entry.weight * mult));
      if (Math.abs(nextWeight - entry.weight) < 1e-6) return entry;
      return {
        ...entry,
        weight: nextWeight,
      };
    }),
  };
}

export function filterWeightedRangeByBuckets(
  range: HoldemWeightedRange,
  breakdown: RangeBreakdownResult,
  enabledBuckets: ReadonlySet<RangeBreakdownBucketId>,
): HoldemWeightedRange {
  const weights: Partial<Record<RangeBreakdownBucketId, number>> = {};
  for (const b of RANGE_BREAKDOWN_BUCKET_ORDER) {
    weights[b] = enabledBuckets.has(b) ? 1 : 0;
  }
  return filterWeightedRangeByBucketWeights(range, breakdown, weights);
}
