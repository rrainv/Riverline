import { encodeCard, evaluateSevenCodesUnchecked, HOLDEM_DECK } from '../../engine-api';

export interface EquityHistogramBucket {
  readonly id: 'b0' | 'b1' | 'b2' | 'b3' | 'b4';
  readonly label: string;
  readonly count: number;
  readonly sharePct: number;
}

export interface EquityRangeHistogram {
  readonly buckets: readonly EquityHistogramBucket[];
  readonly totalCombos: number;
  readonly exact: boolean;
  readonly crushingPct: number;
  readonly flippedPct: number;
  readonly behindPct: number;
}

const DECK_CODES = HOLDEM_DECK.map(encodeCard);

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

export function computeEquityHistogramVsRange(input: {
  readonly heroCards: readonly [string, string];
  readonly villainCombos: readonly (readonly [string, string])[];
  readonly board: readonly string[];
}): EquityRangeHistogram | null {
  if (input.board.length < 3 || input.board.length > 5) return null;

  const h0 = encodeCard(input.heroCards[0]);
  const h1 = encodeCard(input.heroCards[1]);
  const bCodes = input.board.map(encodeCard);

  const baseDead = new Set<number>([h0, h1, ...bCodes]);
  const liveVillain: Array<[number, number]> = [];
  for (const combo of input.villainCombos) {
    const v0 = encodeCard(combo[0]);
    const v1 = encodeCard(combo[1]);
    if (v0 === v1 || baseDead.has(v0) || baseDead.has(v1)) continue;
    liveVillain.push([v0, v1]);
  }
  if (liveVillain.length === 0) return null;

  const remDeck = DECK_CODES.filter((c) => !baseDead.has(c));
  const counts = [0, 0, 0, 0, 0];
  let exact = true;

  if (bCodes.length === 5) {
    const [b0, b1, b2, b3, b4] = bCodes as [number, number, number, number, number];
    const heroScore = evaluateSevenCodesUnchecked(h0, h1, b0, b1, b2, b3, b4);
    for (const [v0, v1] of liveVillain) {
      const vScore = evaluateSevenCodesUnchecked(v0, v1, b0, b1, b2, b3, b4);
      const eq = heroScore > vScore ? 1 : heroScore === vScore ? 0.5 : 0;
      const idx = eq >= 0.8 ? 4 : eq >= 0.6 ? 3 : eq >= 0.4 ? 2 : eq >= 0.2 ? 1 : 0;
      counts[idx]! += 1;
    }
  } else if (bCodes.length === 4) {
    const [b0, b1, b2, b3] = bCodes as [number, number, number, number];
    for (const [v0, v1] of liveVillain) {
      let eqSum = 0;
      let n = 0;
      for (const r of remDeck) {
        if (r === v0 || r === v1) continue;
        const heroScore = evaluateSevenCodesUnchecked(h0, h1, b0, b1, b2, b3, r);
        const vScore = evaluateSevenCodesUnchecked(v0, v1, b0, b1, b2, b3, r);
        eqSum += heroScore > vScore ? 1 : heroScore === vScore ? 0.5 : 0;
        n += 1;
      }
      const eq = n > 0 ? eqSum / n : 0.5;
      const idx = eq >= 0.8 ? 4 : eq >= 0.6 ? 3 : eq >= 0.4 ? 2 : eq >= 0.2 ? 1 : 0;
      counts[idx]! += 1;
    }
  } else {
    const [b0, b1, b2] = bCodes as [number, number, number];
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < remDeck.length; i += 1) {
      for (let j = i + 1; j < remDeck.length; j += 1) {
        pairs.push([remDeck[i]!, remDeck[j]!]);
      }
    }
    exact = liveVillain.length <= 25;
    const step = exact ? 1 : Math.max(1, Math.floor(pairs.length / 66));

    for (const [v0, v1] of liveVillain) {
      let eqSum = 0;
      let n = 0;
      for (let pIdx = 0; pIdx < pairs.length; pIdx += step) {
        const [tCard, rCard] = pairs[pIdx]!;
        if (tCard === v0 || tCard === v1 || rCard === v0 || rCard === v1) continue;
        const heroScore = evaluateSevenCodesUnchecked(h0, h1, b0, b1, b2, tCard, rCard);
        const vScore = evaluateSevenCodesUnchecked(v0, v1, b0, b1, b2, tCard, rCard);
        eqSum += heroScore > vScore ? 1 : heroScore === vScore ? 0.5 : 0;
        n += 1;
      }
      const eq = n > 0 ? eqSum / n : 0.5;
      const idx = eq >= 0.8 ? 4 : eq >= 0.6 ? 3 : eq >= 0.4 ? 2 : eq >= 0.2 ? 1 : 0;
      counts[idx]! += 1;
    }
  }

  const totalCombos = liveVillain.length;
  const labels = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'] as const;
  const ids = ['b0', 'b1', 'b2', 'b3', 'b4'] as const;
  const buckets: EquityHistogramBucket[] = ids.map((id, i) => ({
    id,
    label: labels[i]!,
    count: counts[i]!,
    sharePct: round1((counts[i]! / totalCombos) * 100),
  }));

  return {
    buckets,
    totalCombos,
    exact,
    crushingPct: round1(((counts[3]! + counts[4]!) / totalCombos) * 100),
    flippedPct: round1((counts[2]! / totalCombos) * 100),
    behindPct: round1(((counts[0]! + counts[1]!) / totalCombos) * 100),
  };
}
