import {
  buildHandCategoryRecord,
  categoryRankFromScore,
  encodeCard,
  scoreSevenFromBitmasks,
  type HandCategory,
} from './evaluator';

const CHOOSE_4 = [
  [1, 0, 0, 0, 0],
  [1, 1, 0, 0, 0],
  [1, 2, 1, 0, 0],
  [1, 3, 3, 1, 0],
  [1, 4, 6, 4, 1],
] as const;

export interface ExactHeadsUpPreflopPlayerStats {
  readonly wins: number;
  readonly ties: number;
  readonly losses: number;
  readonly equity: number;
  readonly winProbability: number;
  readonly tieProbability: number;
  readonly riverCategories: Readonly<Record<HandCategory, number>>;
  readonly riverCategoryShares: Readonly<Record<HandCategory, number>>;
}

export interface ExactHeadsUpPreflopResult {
  readonly trials: number;
  readonly players: readonly [ExactHeadsUpPreflopPlayerStats, ExactHeadsUpPreflopPlayerStats];
}

const PREFLOP_CACHE_LIMIT = 512;
const preflopExactCache = new Map<string, ExactHeadsUpPreflopResult>();

function addCardToBitmasks(
  code: number,
  state: { c1: number; c2: number; c3: number; c4: number },
): void {
  const bit = 1 << ((code >> 2) + 2);
  if ((state.c1 & bit) !== 0) {
    if ((state.c2 & bit) !== 0) {
      if ((state.c3 & bit) !== 0) state.c4 |= bit;
      else state.c3 |= bit;
    } else {
      state.c2 |= bit;
    }
  } else {
    state.c1 |= bit;
  }
}

function addRankToBitmasks(
  rankIdx: number,
  count: number,
  state: { c1: number; c2: number; c3: number; c4: number },
): void {
  const bit = 1 << (rankIdx + 2);
  for (let i = 0; i < count; i += 1) {
    if ((state.c1 & bit) !== 0) {
      if ((state.c2 & bit) !== 0) {
        if ((state.c3 & bit) !== 0) state.c4 |= bit;
        else state.c3 |= bit;
      } else {
        state.c2 |= bit;
      }
    } else {
      state.c1 |= bit;
    }
  }
}

function buildCacheKey(
  h0: number,
  h1: number,
  v0: number,
  v1: number,
  deadCodes: readonly number[],
): string {
  const a0 = Math.min(h0, h1);
  const a1 = Math.max(h0, h1);
  const b0 = Math.min(v0, v1);
  const b1 = Math.max(v0, v1);
  const sortedDead = [...deadCodes].sort((x, y) => x - y);
  return `${a0},${a1}|${b0},${b1}|${sortedDead.join(',')}`;
}

/**
 * Computes exact heads-up preflop equity across all C(48 - dead, 5) boards in ~3ms
 * using rank-multiset enumeration with mutually-exclusive flush-suit decomposition.
 */
export function solveExactHeadsUpPreflop(
  heroCards: readonly [string, string],
  villainCards: readonly [string, string],
  deadCards: readonly string[] = [],
): ExactHeadsUpPreflopResult {
  const h0 = encodeCard(heroCards[0]);
  const h1 = encodeCard(heroCards[1]);
  const v0 = encodeCard(villainCards[0]);
  const v1 = encodeCard(villainCards[1]);
  const deadCodes = deadCards.map(encodeCard);

  const cacheKey = buildCacheKey(h0, h1, v0, v1, deadCodes);
  const cached = preflopExactCache.get(cacheKey);
  if (cached) {
    preflopExactCache.delete(cacheKey);
    preflopExactCache.set(cacheKey, cached);
    return cached;
  }

  const used = new Uint8Array(52);
  used[h0] = 1;
  used[h1] = 1;
  used[v0] = 1;
  used[v1] = 1;
  for (const dc of deadCodes) used[dc] = 1;

  const availCount = new Int32Array(13);
  const suitAvailMask = new Int32Array(4); // bits 0..12 = rank index
  for (let r = 0; r < 13; r += 1) {
    let cnt = 0;
    for (let s = 0; s < 4; s += 1) {
      if (!used[r * 4 + s]) {
        cnt += 1;
        suitAvailMask[s]! |= 1 << r;
      }
    }
    availCount[r] = cnt;
  }

  const baseState0 = { c1: 0, c2: 0, c3: 0, c4: 0 };
  addCardToBitmasks(h0, baseState0);
  addCardToBitmasks(h1, baseState0);

  const baseState1 = { c1: 0, c2: 0, c3: 0, c4: 0 };
  addCardToBitmasks(v0, baseState1);
  addCardToBitmasks(v1, baseState1);

  const suitCount0 = new Int32Array(4);
  const suitMask0 = new Int32Array(4);
  suitCount0[h0 & 3]! += 1;
  suitMask0[h0 & 3]! |= 1 << ((h0 >> 2) + 2);
  suitCount0[h1 & 3]! += 1;
  suitMask0[h1 & 3]! |= 1 << ((h1 >> 2) + 2);

  const suitCount1 = new Int32Array(4);
  const suitMask1 = new Int32Array(4);
  suitCount1[v0 & 3]! += 1;
  suitMask1[v0 & 3]! |= 1 << ((v0 >> 2) + 2);
  suitCount1[v1 & 3]! += 1;
  suitMask1[v1 & 3]! |= 1 << ((v1 >> 2) + 2);

  let wins0 = 0;
  let wins1 = 0;
  let ties = 0;
  let trials = 0;
  const cat0 = new Float64Array(9);
  const cat1 = new Float64Array(9);

  const distRanks = new Int32Array(5);
  const distCounts = new Int32Array(5);

  // Enumerate all non-decreasing 5-card rank multisets r0 <= r1 <= r2 <= r3 <= r4
  for (let r0 = 0; r0 < 13; r0 += 1) {
    if (availCount[r0]! === 0) continue;
    for (let r1 = r0; r1 < 13; r1 += 1) {
      if (availCount[r1]! < (r1 === r0 ? 2 : 1)) continue;
      for (let r2 = r1; r2 < 13; r2 += 1) {
        const c2Needed = 1 + (r2 === r1 ? 1 : 0) + (r2 === r0 ? 1 : 0);
        if (availCount[r2]! < c2Needed) continue;
        for (let r3 = r2; r3 < 13; r3 += 1) {
          const c3Needed =
            1 + (r3 === r2 ? 1 : 0) + (r3 === r1 ? 1 : 0) + (r3 === r0 ? 1 : 0);
          if (availCount[r3]! < c3Needed) continue;
          for (let r4 = r3; r4 < 13; r4 += 1) {
            const c4Needed =
              1 +
              (r4 === r3 ? 1 : 0) +
              (r4 === r2 ? 1 : 0) +
              (r4 === r1 ? 1 : 0) +
              (r4 === r0 ? 1 : 0);
            if (availCount[r4]! < c4Needed) continue;

            // Build distinct ranks + multiplicities for this 5-card multiset
            let d = 1;
            distRanks[0] = r0;
            distCounts[0] = 1;
            const rs = [r1, r2, r3, r4];
            for (let idx = 0; idx < 4; idx += 1) {
              const rx = rs[idx]!;
              if (rx === distRanks[d - 1]) {
                distCounts[d - 1]! += 1;
              } else {
                distRanks[d] = rx;
                distCounts[d] = 1;
                d += 1;
              }
            }

            let totalWays = 1;
            for (let j = 0; j < d; j += 1) {
              totalWays *= CHOOSE_4[availCount[distRanks[j]!]!]![distCounts[j]!]!;
            }
            if (totalWays === 0) continue;

            const st0 = { ...baseState0 };
            const st1 = { ...baseState1 };
            for (let j = 0; j < d; j += 1) {
              const rx = distRanks[j]!;
              const cx = distCounts[j]!;
              addRankToBitmasks(rx, cx, st0);
              addRankToBitmasks(rx, cx, st1);
            }

            let flushAccountedWays = 0;

            if (d >= 3) {
              const subsetLimit = 1 << d;
              for (let s = 0; s < 4; s += 1) {
                const sc0 = suitCount0[s]!;
                const sc1 = suitCount1[s]!;
                // Only suits where at least one player could reach >= 5 cards
                if (sc0 + d < 5 && sc1 + d < 5) continue;
                const sMaskAvail = suitAvailMask[s]!;

                for (let sub = 7; sub < subsetLimit; sub += 1) {
                  // Popcount of sub (number of board cards in suit s)
                  let boardInSuit = 0;
                  let ways = 1;
                  let boardSuitRankBits = 0;
                  let validSub = true;

                  for (let j = 0; j < d; j += 1) {
                    const rx = distRanks[j]!;
                    const cx = distCounts[j]!;
                    const hasSuit = (sMaskAvail & (1 << rx)) !== 0;
                    if ((sub & (1 << j)) !== 0) {
                      if (!hasSuit) {
                        validSub = false;
                        break;
                      }
                      boardInSuit += 1;
                      boardSuitRankBits |= 1 << (rx + 2);
                      ways *= CHOOSE_4[availCount[rx]! - 1]![cx - 1]!;
                    } else {
                      const nonSuitAvail = availCount[rx]! - (hasSuit ? 1 : 0);
                      if (cx > nonSuitAvail) {
                        validSub = false;
                        break;
                      }
                      ways *= CHOOSE_4[nonSuitAvail]![cx]!;
                    }
                    if (ways === 0) {
                      validSub = false;
                      break;
                    }
                  }

                  if (!validSub || boardInSuit < 3) continue;
                  const f0 = sc0 + boardInSuit >= 5 ? suitMask0[s]! | boardSuitRankBits : 0;
                  const f1 = sc1 + boardInSuit >= 5 ? suitMask1[s]! | boardSuitRankBits : 0;
                  if (f0 === 0 && f1 === 0) continue;

                  flushAccountedWays += ways;
                  const score0 = scoreSevenFromBitmasks(st0.c1, st0.c2, st0.c3, st0.c4, f0);
                  const score1 = scoreSevenFromBitmasks(st1.c1, st1.c2, st1.c3, st1.c4, f1);
                  cat0[categoryRankFromScore(score0)]! += ways;
                  cat1[categoryRankFromScore(score1)]! += ways;
                  if (score0 > score1) wins0 += ways;
                  else if (score1 > score0) wins1 += ways;
                  else ties += ways;
                }
              }
            }

            const nonFlushWays = totalWays - flushAccountedWays;
            if (nonFlushWays > 0) {
              const score0 = scoreSevenFromBitmasks(st0.c1, st0.c2, st0.c3, st0.c4, 0);
              const score1 = scoreSevenFromBitmasks(st1.c1, st1.c2, st1.c3, st1.c4, 0);
              cat0[categoryRankFromScore(score0)]! += nonFlushWays;
              cat1[categoryRankFromScore(score1)]! += nonFlushWays;
              if (score0 > score1) wins0 += nonFlushWays;
              else if (score1 > score0) wins1 += nonFlushWays;
              else ties += nonFlushWays;
            }

            trials += totalWays;
          }
        }
      }
    }
  }

  const eq0 = trials > 0 ? (wins0 + ties * 0.5) / trials : 0;
  const eq1 = trials > 0 ? (wins1 + ties * 0.5) / trials : 0;

  const result: ExactHeadsUpPreflopResult = {
    trials,
    players: [
      {
        wins: wins0,
        ties,
        losses: wins1,
        equity: eq0,
        winProbability: trials > 0 ? wins0 / trials : 0,
        tieProbability: trials > 0 ? ties / trials : 0,
        riverCategories: buildHandCategoryRecord(cat0, 1),
        riverCategoryShares: buildHandCategoryRecord(cat0, trials),
      },
      {
        wins: wins1,
        ties,
        losses: wins0,
        equity: eq1,
        winProbability: trials > 0 ? wins1 / trials : 0,
        tieProbability: trials > 0 ? ties / trials : 0,
        riverCategories: buildHandCategoryRecord(cat1, 1),
        riverCategoryShares: buildHandCategoryRecord(cat1, trials),
      },
    ],
  };

  if (preflopExactCache.size >= PREFLOP_CACHE_LIMIT) {
    const oldestKey = preflopExactCache.keys().next().value;
    if (oldestKey !== undefined) preflopExactCache.delete(oldestKey);
  }
  preflopExactCache.set(cacheKey, result);
  return result;
}
