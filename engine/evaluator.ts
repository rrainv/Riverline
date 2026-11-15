import { assertCardArray, assertUniqueKnownCards, CARD_RANKS, CARD_SUITS } from './cards';
import { deepFreeze } from './freeze';
import { POKER_HAND_RANK_SCHEMA_VERSION, type PokerHandRank } from './schema';

export const HAND_CATEGORIES = Object.freeze({
  HIGH_CARD: 'high_card',
  ONE_PAIR: 'one_pair',
  TWO_PAIR: 'two_pair',
  THREE_OF_A_KIND: 'three_of_a_kind',
  STRAIGHT: 'straight',
  FLUSH: 'flush',
  FULL_HOUSE: 'full_house',
  FOUR_OF_A_KIND: 'four_of_a_kind',
  STRAIGHT_FLUSH: 'straight_flush',
} as const);

export type HandCategory = (typeof HAND_CATEGORIES)[keyof typeof HAND_CATEGORIES];

export const CATEGORY_BY_RANK: readonly HandCategory[] = Object.freeze([
  HAND_CATEGORIES.HIGH_CARD,
  HAND_CATEGORIES.ONE_PAIR,
  HAND_CATEGORIES.TWO_PAIR,
  HAND_CATEGORIES.THREE_OF_A_KIND,
  HAND_CATEGORIES.STRAIGHT,
  HAND_CATEGORIES.FLUSH,
  HAND_CATEGORIES.FULL_HOUSE,
  HAND_CATEGORIES.FOUR_OF_A_KIND,
  HAND_CATEGORIES.STRAIGHT_FLUSH,
]);

/** Extracts category rank (0..8) from an unchecked 7-card score. */
export function categoryRankFromScore(score: number): number {
  const rank = Math.floor(score / 1e10);
  return rank < 0 ? 0 : rank > 8 ? 8 : rank;
}

/** Converts indexed category tallies (0..8) into a keyed HandCategory record, optionally normalized. */
export function buildHandCategoryRecord(
  tallies: ArrayLike<number>,
  divisor = 1,
): Record<HandCategory, number> {
  const safeDiv = divisor > 0 ? divisor : 1;
  const out = {} as Record<HandCategory, number>;
  for (let i = 0; i < CATEGORY_BY_RANK.length; i += 1) {
    out[CATEGORY_BY_RANK[i]!] = (tallies[i] ?? 0) / safeDiv;
  }
  return out;
}

const RANK_VALUE: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries([...CARD_RANKS].map((rank, index) => [rank, index + 2])),
);

const CARD_CODE_BY_STRING = new Map<string, number>();
for (let rankIndex = 0; rankIndex < CARD_RANKS.length; rankIndex += 1) {
  for (let suitIndex = 0; suitIndex < CARD_SUITS.length; suitIndex += 1) {
    CARD_CODE_BY_STRING.set(`${CARD_RANKS[rankIndex]}${CARD_SUITS[suitIndex]}`, rankIndex * 4 + suitIndex);
  }
}

const SCORE_WEIGHTS: readonly number[] = Object.freeze([50_625, 3375, 225, 15, 1]);

// Precomputed 15-bit rank-mask lookup tables (bits 2..14 correspond to ranks 2..14).
const MASK_LIMIT = 1 << 15;
const STRAIGHT_HIGH_TABLE = new Int8Array(MASK_LIMIT);
const TOP5_SCORE_TABLE = new Int32Array(MASK_LIMIT);
const WHEEL_MASK = (1 << 14) | (1 << 5) | (1 << 4) | (1 << 3) | (1 << 2);

for (let mask = 0; mask < MASK_LIMIT; mask += 1) {
  let straight = 0;
  for (let high = 14; high >= 6; high -= 1) {
    const windowMask = 0b11111 << (high - 4);
    if ((mask & windowMask) === windowMask) {
      straight = high;
      break;
    }
  }
  if (straight === 0 && (mask & WHEEL_MASK) === WHEEL_MASK) {
    straight = 5;
  }
  STRAIGHT_HIGH_TABLE[mask] = straight;

  let picked = 0;
  let score = 0;
  for (let rank = 14; rank >= 2 && picked < 5; rank -= 1) {
    if ((mask & (1 << rank)) !== 0) {
      score += rank * SCORE_WEIGHTS[picked]!;
      picked += 1;
    }
  }
  if (picked === 5) TOP5_SCORE_TABLE[mask] = score;
}

function packScore(categoryRank: number, tiebreakers: readonly number[]): number {
  return (
    categoryRank * 1e10 +
    tiebreakers.reduce((sum, rank, index) => sum + rank * (SCORE_WEIGHTS[index] ?? 0), 0)
  );
}

function straightHigh(ranks: readonly number[]): number | null {
  const unique = [...new Set(ranks)].sort((left, right) => right - left);
  if (unique.length !== 5) return null;
  const u0 = unique[0]!;
  const u1 = unique[1]!;
  const u2 = unique[2]!;
  const u3 = unique[3]!;
  const u4 = unique[4]!;
  if (u0 === 14 && u1 === 5 && u2 === 4 && u3 === 3 && u4 === 2) return 5;
  return u0 - u4 === 4 ? u0 : null;
}

function structuralRank(
  categoryRank: number,
  tiebreakers: readonly number[],
  bestFiveCards: readonly string[],
): PokerHandRank {
  return deepFreeze({
    schemaVersion: POKER_HAND_RANK_SCHEMA_VERSION,
    score: packScore(categoryRank, tiebreakers),
    category: CATEGORY_BY_RANK[categoryRank]!,
    categoryRank,
    tiebreakers: [...tiebreakers],
    bestFiveCards: [...bestFiveCards],
  });
}

function evaluateFiveUnchecked(cards: readonly string[]): PokerHandRank {
  const ranks = cards
    .map((card) => RANK_VALUE[card[0]!]!)
    .sort((left, right) => right - left);
  const firstSuit = cards[0]![1]!;
  const flush = cards.every((card) => card[1] === firstSuit);
  const highStraight = straightHigh(ranks);
  if (flush && highStraight !== null) return structuralRank(8, [highStraight], cards);

  const counts = new Map<number, number>();
  for (const rank of ranks) {
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  const groups = [...counts.entries()].sort(
    (left, right) => right[1] - left[1] || right[0] - left[0],
  );
  const four = groups.find(([, count]) => count === 4);
  if (four) {
    const kicker = groups.find(([, count]) => count === 1)![0];
    return structuralRank(7, [four[0], kicker], cards);
  }

  const three = groups.find(([, count]) => count === 3);
  const pairs = groups
    .filter(([, count]) => count === 2)
    .map(([rank]) => rank)
    .sort((left, right) => right - left);
  if (three && pairs.length > 0) return structuralRank(6, [three[0], pairs[0]!], cards);
  if (flush) return structuralRank(5, ranks, cards);
  if (highStraight !== null) return structuralRank(4, [highStraight], cards);
  if (three) {
    const kickers = groups
      .filter(([, count]) => count === 1)
      .map(([rank]) => rank)
      .sort((left, right) => right - left);
    return structuralRank(3, [three[0], ...kickers], cards);
  }
  if (pairs.length >= 2) {
    const kicker = groups.find(([, count]) => count === 1)![0];
    return structuralRank(2, [pairs[0]!, pairs[1]!, kicker], cards);
  }
  if (pairs.length === 1) {
    const kickers = groups
      .filter(([, count]) => count === 1)
      .map(([rank]) => rank)
      .sort((left, right) => right - left);
    return structuralRank(1, [pairs[0]!, ...kickers], cards);
  }
  return structuralRank(0, ranks, cards);
}

function validateCards(cards: unknown, expectedCount: number, label: string): readonly string[] {
  const checked = assertCardArray(cards, label);
  if (checked.length !== expectedCount) {
    throw new RangeError(`${label} requires exactly ${expectedCount} cards`);
  }
  assertUniqueKnownCards([{ label, cards: checked }]);
  return checked;
}

/** Evaluates a canonical 5-card Texas Hold'em hand. */
export function evaluateFive(cards: readonly string[]): PokerHandRank {
  const checked = validateCards(cards, 5, 'evaluateFive.cards');
  return evaluateFiveUnchecked(checked);
}

/** Evaluates the best 5-card hand out of 7 cards (Exhaustive 21 combinations). */
export function evaluateSeven(cards: readonly string[]): PokerHandRank {
  const checked = validateCards(cards, 7, 'evaluateSeven.cards');
  let best: PokerHandRank | null = null;
  for (let firstExcluded = 0; firstExcluded < 6; firstExcluded += 1) {
    for (let secondExcluded = firstExcluded + 1; secondExcluded < 7; secondExcluded += 1) {
      const five = checked.filter(
        (_, index) => index !== firstExcluded && index !== secondExcluded,
      );
      const candidate = evaluateFiveUnchecked(five);
      if (best === null || candidate.score > best.score) best = candidate;
    }
  }
  return best!;
}

/** Encodes a canonical card string (e.g. 'As') to a compact integer 0..51. */
export function encodeCard(card: string): number {
  const code = CARD_CODE_BY_STRING.get(card);
  if (code === undefined) {
    throw new RangeError(`Invalid canonical card: ${String(card)}`);
  }
  return code;
}

const SCRATCH_SEVEN_CODES = new Int32Array(7);

/**
 * Evaluates 7 distinct encoded card integers (0..51) with zero heap allocations.
 * Produces the exact same numeric score as `evaluateSeven(cards).score`.
 */
export function evaluateSevenCodesUnchecked(
  card0: number,
  card1: number,
  card2: number,
  card3: number,
  card4: number,
  card5: number,
  card6: number,
): number {
  let c1 = 0;
  let c2 = 0;
  let c3 = 0;
  let c4 = 0;
  let m0 = 0;
  let m1 = 0;
  let m2 = 0;
  let m3 = 0;
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;

  SCRATCH_SEVEN_CODES[0] = card0;
  SCRATCH_SEVEN_CODES[1] = card1;
  SCRATCH_SEVEN_CODES[2] = card2;
  SCRATCH_SEVEN_CODES[3] = card3;
  SCRATCH_SEVEN_CODES[4] = card4;
  SCRATCH_SEVEN_CODES[5] = card5;
  SCRATCH_SEVEN_CODES[6] = card6;
  for (let i = 0; i < 7; i += 1) {
    const code = SCRATCH_SEVEN_CODES[i]!;
    const bit = 1 << ((code >> 2) + 2);
    if ((c1 & bit) !== 0) {
      if ((c2 & bit) !== 0) {
        if ((c3 & bit) !== 0) c4 |= bit;
        else c3 |= bit;
      } else {
        c2 |= bit;
      }
    } else {
      c1 |= bit;
    }
    const suit = code & 3;
    if (suit === 0) { s0 += 1; m0 |= bit; }
    else if (suit === 1) { s1 += 1; m1 |= bit; }
    else if (suit === 2) { s2 += 1; m2 |= bit; }
    else { s3 += 1; m3 |= bit; }
  }

  const flushMask = s0 >= 5 ? m0 : s1 >= 5 ? m1 : s2 >= 5 ? m2 : s3 >= 5 ? m3 : 0;
  if (flushMask !== 0) {
    const sfHigh = STRAIGHT_HIGH_TABLE[flushMask]!;
    if (sfHigh > 0) return 8e10 + sfHigh * 50_625;
  }

  if (c4 !== 0) {
    const quadRank = 31 - Math.clz32(c4);
    const kicker = 31 - Math.clz32(c1 & ~c4);
    return 7e10 + quadRank * 50_625 + kicker * 3375;
  }

  if (c3 !== 0) {
    const tripsRank = 31 - Math.clz32(c3);
    const remPairMask = c2 & ~(1 << tripsRank);
    if (remPairMask !== 0) {
      const pairRank = 31 - Math.clz32(remPairMask);
      return 6e10 + tripsRank * 50_625 + pairRank * 3375;
    }
  }

  if (flushMask !== 0) {
    return 5e10 + TOP5_SCORE_TABLE[flushMask]!;
  }

  const straightHighRank = STRAIGHT_HIGH_TABLE[c1]!;
  if (straightHighRank > 0) {
    return 4e10 + straightHighRank * 50_625;
  }

  if (c3 !== 0) {
    const tripsRank = 31 - Math.clz32(c3);
    const kickersMask = c1 & ~c3;
    const k0 = 31 - Math.clz32(kickersMask);
    const k1 = 31 - Math.clz32(kickersMask & ~(1 << k0));
    return 3e10 + tripsRank * 50_625 + k0 * 3375 + k1 * 225;
  }

  if (c2 !== 0) {
    const p0 = 31 - Math.clz32(c2);
    const remPairs = c2 & ~(1 << p0);
    if (remPairs !== 0) {
      const p1 = 31 - Math.clz32(remPairs);
      const kicker = 31 - Math.clz32(c1 & ~(1 << p0) & ~(1 << p1));
      return 2e10 + p0 * 50_625 + p1 * 3375 + kicker * 225;
    }
    const singles = c1 & ~c2;
    const k0 = 31 - Math.clz32(singles);
    const rem1 = singles & ~(1 << k0);
    const k1 = 31 - Math.clz32(rem1);
    const k2 = 31 - Math.clz32(rem1 & ~(1 << k1));
    return 1e10 + p0 * 50_625 + k0 * 3375 + k1 * 225 + k2 * 15;
  }

  return TOP5_SCORE_TABLE[c1]!;
}

/** Validates 7 distinct cards and returns the fast numeric score matching `evaluateSeven(cards).score`. */
export function evaluateSevenScore(cards: readonly string[]): number {
  const checked = validateCards(cards, 7, 'evaluateSevenScore.cards');
  return evaluateSevenCodesUnchecked(
    encodeCard(checked[0]!),
    encodeCard(checked[1]!),
    encodeCard(checked[2]!),
    encodeCard(checked[3]!),
    encodeCard(checked[4]!),
    encodeCard(checked[5]!),
    encodeCard(checked[6]!),
  );
}

/** Compares two canonical PokerHandRank values (-1, 0, or 1). */
export function compareHandRanks(left: PokerHandRank, right: PokerHandRank): number {
  if (
    !left ||
    left.schemaVersion !== POKER_HAND_RANK_SCHEMA_VERSION ||
    !right ||
    right.schemaVersion !== POKER_HAND_RANK_SCHEMA_VERSION
  ) {
    throw new TypeError(`compareHandRanks requires two ${POKER_HAND_RANK_SCHEMA_VERSION} values`);
  }
  return Math.sign(left.score - right.score);
}
