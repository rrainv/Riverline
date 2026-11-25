import { HOLDEM_COMBOS, HOLDEM_DECK } from '../holdem-combos';

export type RiverSamplingMode = 'exact_isomorphic' | 'stratified_fast' | 'all_rivers';

export interface WeightedRiverCard {
  readonly card: string;
  readonly weight: number;
  readonly representedCards: readonly string[];
}

export interface RiverCompressionResult {
  readonly mode: RiverSamplingMode;
  readonly rawRiverCount: number;
  readonly branches: readonly WeightedRiverCard[];
  readonly isomorphicGroupsCount: number;
}

const SUITS = ['s', 'h', 'd', 'c'] as const;
type SuitChar = (typeof SUITS)[number];

const RANK_TIER: Readonly<Record<string, 0 | 1 | 2>> = {
  A: 0,
  K: 0,
  Q: 0,
  J: 0,
  T: 0,
  '9': 1,
  '8': 1,
  '7': 1,
  '6': 1,
  '5': 2,
  '4': 2,
  '3': 2,
  '2': 2,
};

function swapCardSuit(card: string, s1: SuitChar, s2: SuitChar): string {
  const s = card[1];
  if (s === s1) return `${card[0]}${s2}`;
  if (s === s2) return `${card[0]}${s1}`;
  return card;
}

const COMBO_ID_BY_CARDS = new Map<string, string>();
for (const combo of HOLDEM_COMBOS) {
  COMBO_ID_BY_CARDS.set(`${combo.cards[0]}:${combo.cards[1]}`, combo.id);
  COMBO_ID_BY_CARDS.set(`${combo.cards[1]}:${combo.cards[0]}`, combo.id);
}

function areSuitsRangeSymmetric(
  s1: SuitChar,
  s2: SuitChar,
  oopRangeByCombo: Readonly<Record<string, number>>,
  ipRangeByCombo: Readonly<Record<string, number>>,
): boolean {
  for (const combo of HOLDEM_COMBOS) {
    const c0 = combo.cards[0];
    const c1 = combo.cards[1];
    if (c0[1] !== s1 && c0[1] !== s2 && c1[1] !== s1 && c1[1] !== s2) continue;

    const sc0 = swapCardSuit(c0, s1, s2);
    const sc1 = swapCardSuit(c1, s1, s2);
    const swappedId = COMBO_ID_BY_CARDS.get(`${sc0}:${sc1}`);
    if (!swappedId) return false;

    const oopA = oopRangeByCombo[combo.id] ?? 0;
    const oopB = oopRangeByCombo[swappedId] ?? 0;
    if (Math.abs(oopA - oopB) > 1e-9) return false;

    const ipA = ipRangeByCombo[combo.id] ?? 0;
    const ipB = ipRangeByCombo[swappedId] ?? 0;
    if (Math.abs(ipA - ipB) > 1e-9) return false;
  }
  return true;
}

/**
 * Compresses remaining river cards using exact suit isomorphism when unused suits
 * are symmetric in both board+dead cards and both players' ranges.
 */
export function compressIsomorphicRivers(
  turnBoard: readonly string[],
  deadCards: readonly string[],
  oopRangeByCombo: Readonly<Record<string, number>>,
  ipRangeByCombo: Readonly<Record<string, number>>,
): readonly WeightedRiverCard[] {
  const blocked = new Set<string>([...turnBoard, ...deadCards]);
  const usedSuits = new Set<string>();
  for (const c of blocked) {
    if (c.length >= 2) usedSuits.add(c[1]!);
  }

  // Canonical suit representative per suit
  const canonicalSuit = new Map<SuitChar, SuitChar>();
  for (const s of SUITS) canonicalSuit.set(s, s);

  const freeSuits = SUITS.filter((s) => !usedSuits.has(s));
  for (let i = 0; i < freeSuits.length; i += 1) {
    const s1 = freeSuits[i]!;
    if (canonicalSuit.get(s1) !== s1) continue;
    for (let j = i + 1; j < freeSuits.length; j += 1) {
      const s2 = freeSuits[j]!;
      if (areSuitsRangeSymmetric(s1, s2, oopRangeByCombo, ipRangeByCombo)) {
        canonicalSuit.set(s2, s1);
      }
    }
  }

  const groups = new Map<string, string[]>();
  for (const card of HOLDEM_DECK) {
    if (blocked.has(card)) continue;
    const rank = card[0]!;
    const suit = card[1]! as SuitChar;
    const canon = canonicalSuit.get(suit) ?? suit;
    const key = `${rank}${canon}`;
    let list = groups.get(key);
    if (!list) {
      list = [];
      groups.set(key, list);
    }
    list.push(card);
  }

  const out: WeightedRiverCard[] = [];
  for (const representedCards of groups.values()) {
    out.push({
      card: representedCards[0]!,
      weight: representedCards.length,
      representedCards,
    });
  }
  return out;
}

/**
 * Builds a stratified, weighted river subset from isomorphic groups so fast Turn->River
 * solves preserve board-pairing, flush-completion, and rank-tier proportions.
 */
export function buildStratifiedRiverSubset(
  isomorphicGroups: readonly WeightedRiverCard[],
  turnBoard: readonly string[],
  targetCount = 16,
): readonly WeightedRiverCard[] {
  if (isomorphicGroups.length <= targetCount) {
    return isomorphicGroups;
  }

  const boardRanks = new Set(turnBoard.map((c) => c[0]!));
  const suitCounts = new Map<string, number>();
  for (const c of turnBoard) {
    const s = c[1]!;
    suitCounts.set(s, (suitCounts.get(s) ?? 0) + 1);
  }

  const buckets = new Map<string, WeightedRiverCard[]>();
  for (const g of isomorphicGroups) {
    const rank = g.card[0]!;
    const suit = g.card[1]!;
    const pairsBoard = boardRanks.has(rank) ? 'P' : 'N';
    const completesFlush = (suitCounts.get(suit) ?? 0) >= 2 ? 'F' : 'X';
    const tier = RANK_TIER[rank] ?? 1;
    const key = `${pairsBoard}-${completesFlush}-${tier}`;
    let arr = buckets.get(key);
    if (!arr) {
      arr = [];
      buckets.set(key, arr);
    }
    arr.push(g);
  }

  const totalRawWeight = isomorphicGroups.reduce((acc, g) => acc + g.weight, 0);
  const bucketEntries = [...buckets.entries()].map(([key, items]) => ({
    key,
    items,
    bucketWeight: items.reduce((acc, g) => acc + g.weight, 0),
    pickCount: 1,
  }));

  // Ensure every non-empty bucket gets at least 1 representative, then allocate remaining slots proportionally
  let allocated = bucketEntries.length;
  if (allocated > targetCount) {
    bucketEntries.sort((a, b) => b.bucketWeight - a.bucketWeight);
    bucketEntries.length = targetCount;
    allocated = targetCount;
  }

  while (allocated < targetCount) {
    let bestIdx = -1;
    let bestDeficit = -1;
    for (let i = 0; i < bucketEntries.length; i += 1) {
      const b = bucketEntries[i]!;
      if (b.pickCount >= b.items.length) continue;
      const ideal = (b.bucketWeight / totalRawWeight) * targetCount;
      const deficit = ideal - b.pickCount;
      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    bucketEntries[bestIdx]!.pickCount += 1;
    allocated += 1;
  }

  // Re-normalize weights when a bucket was truncated (rare if targetCount < bucketEntries)
  const keptRawWeight = bucketEntries.reduce((acc, b) => acc + b.bucketWeight, 0);
  const weightScale = keptRawWeight > 0 ? totalRawWeight / keptRawWeight : 1;

  const selected: WeightedRiverCard[] = [];
  for (const b of bucketEntries) {
    const step = b.items.length / b.pickCount;
    const picked: WeightedRiverCard[] = [];
    for (let k = 0; k < b.pickCount; k += 1) {
      const idx = Math.min(b.items.length - 1, Math.floor((k + 0.5) * step));
      picked.push(b.items[idx]!);
    }
    const pickedSum = picked.reduce((acc, g) => acc + g.weight, 0);
    const targetBucketWeight = b.bucketWeight * weightScale;
    for (const p of picked) {
      const scaledWeight = pickedSum > 0 ? (p.weight / pickedSum) * targetBucketWeight : targetBucketWeight / picked.length;
      selected.push({
        card: p.card,
        weight: scaledWeight,
        representedCards: p.representedCards,
      });
    }
  }

  return selected;
}

export function selectTurnRiverBranches(
  turnBoard: readonly string[],
  deadCards: readonly string[],
  oopRangeByCombo: Readonly<Record<string, number>>,
  ipRangeByCombo: Readonly<Record<string, number>>,
  mode: RiverSamplingMode,
  fastTargetCount = 16,
): RiverCompressionResult {
  const blocked = new Set<string>([...turnBoard, ...deadCards]);
  const rawRemaining = HOLDEM_DECK.filter((c) => !blocked.has(c));

  if (mode === 'all_rivers') {
    return {
      mode,
      rawRiverCount: rawRemaining.length,
      isomorphicGroupsCount: rawRemaining.length,
      branches: rawRemaining.map((card) => ({
        card,
        weight: 1,
        representedCards: [card],
      })),
    };
  }

  const iso = compressIsomorphicRivers(turnBoard, deadCards, oopRangeByCombo, ipRangeByCombo);
  if (mode === 'exact_isomorphic') {
    return {
      mode,
      rawRiverCount: rawRemaining.length,
      isomorphicGroupsCount: iso.length,
      branches: iso,
    };
  }

  const stratified = buildStratifiedRiverSubset(iso, turnBoard, fastTargetCount);
  return {
    mode,
    rawRiverCount: rawRemaining.length,
    isomorphicGroupsCount: iso.length,
    branches: stratified,
  };
}
