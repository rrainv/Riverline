export interface BetSizingEvRow {
  readonly id: string;
  readonly label: string;
  readonly betBb: number;
  readonly bluffBreakevenFePct: number;
  readonly requiredFeWithEquityPct: number;
  readonly netEvBb: number;
}

export interface RunoutGroupShift {
  readonly key: string;
  readonly avgDeltaPct: number;
  readonly count: number;
}

export interface RunoutSuitAndRankShifts {
  readonly suits: readonly RunoutGroupShift[];
  readonly rankTiers: readonly RunoutGroupShift[];
}

function roundTenth(v: number): number {
  return Math.round(v * 10) / 10;
}

export function computeBetSizingEvRows(input: {
  readonly potBb: number;
  readonly remainingStackBb: number;
  readonly foldEquityPct: number;
  readonly heroEquityPct: number;
}): readonly BetSizingEvRow[] {
  const potBb = Math.max(0.5, input.potBb);
  const stackBb = Math.max(0.5, input.remainingStackBb);
  const fe = Math.max(0, Math.min(1, input.foldEquityPct / 100));
  const eq = Math.max(0, Math.min(1, input.heroEquityPct / 100));

  const candidates: readonly { id: string; label: string; mult: number | null }[] = [
    { id: '33', label: '33%', mult: 0.33 },
    { id: '50', label: '50%', mult: 0.5 },
    { id: '75', label: '75%', mult: 0.75 },
    { id: '100', label: '100%', mult: 1.0 },
    { id: '150', label: '150%', mult: 1.5 },
    { id: 'allin', label: 'All-in', mult: null },
  ];

  const rows: BetSizingEvRow[] = [];
  const seenAmounts = new Set<number>();

  for (const cand of candidates) {
    const rawBet = cand.mult === null ? stackBb : Math.round(potBb * cand.mult * 2) / 2;
    const betBb = Math.min(stackBb, Math.max(0.5, rawBet));
    if (seenAmounts.has(betBb) && cand.id !== 'allin') continue;
    if (cand.id === 'allin' && seenAmounts.has(betBb)) continue;
    seenAmounts.add(betBb);

    const bluffBreakevenFePct = roundTenth((betBb / (potBb + betBb)) * 100);
    const callEv = eq * (potBb + 2 * betBb) - betBb;
    const checkBaselineEv = eq * potBb;
    const requiredFeWithEquityPct =
      callEv >= 0
        ? 0
        : roundTenth(Math.min(100, Math.max(0, (-callEv / (potBb - callEv)) * 100)));
    // Net EV vs checking cleanly measures whether betting outperforms realizing equity passively.
    const netEvBb = roundTenth(fe * potBb + (1 - fe) * callEv - checkBaselineEv);

    rows.push({
      id: cand.id,
      label: cand.label,
      betBb,
      bluffBreakevenFePct,
      requiredFeWithEquityPct,
      netEvBb,
    });
  }

  return rows;
}

const SUIT_ORDER = ['s', 'h', 'd', 'c'] as const;

function rankTierForCard(card: string): 'A-K' | 'Q-T' | '9-6' | '5-2' {
  const rank = card[0] ?? '';
  if (rank === 'A' || rank === 'K') return 'A-K';
  if (rank === 'Q' || rank === 'J' || rank === 'T') return 'Q-T';
  if (rank === '9' || rank === '8' || rank === '7' || rank === '6') return '9-6';
  return '5-2';
}

export function computeRunoutSuitAndRankShifts(
  rows: readonly {
    readonly cards: readonly string[];
    readonly equityDelta: number | null;
    readonly deltaPct?: number;
  }[],
  invertDelta = false,
): RunoutSuitAndRankShifts {
  const suitAgg = new Map<string, { sum: number; count: number }>();
  const tierAgg = new Map<string, { sum: number; count: number }>();

  for (const row of rows) {
    const card = row.cards[0];
    if (!card || card.length < 2) continue;
    const rawDelta = typeof row.deltaPct === 'number' ? row.deltaPct : (row.equityDelta ?? 0) * 100;
    const delta = invertDelta ? -rawDelta : rawDelta;
    const suit = card[1]!;
    const tier = rankTierForCard(card);

    const sPrev = suitAgg.get(suit) ?? { sum: 0, count: 0 };
    suitAgg.set(suit, { sum: sPrev.sum + delta, count: sPrev.count + 1 });

    const tPrev = tierAgg.get(tier) ?? { sum: 0, count: 0 };
    tierAgg.set(tier, { sum: tPrev.sum + delta, count: tPrev.count + 1 });
  }

  const suits: RunoutGroupShift[] = [];
  for (const s of SUIT_ORDER) {
    const agg = suitAgg.get(s);
    if (agg && agg.count > 0) {
      suits.push({ key: s, avgDeltaPct: roundTenth(agg.sum / agg.count), count: agg.count });
    }
  }

  const rankTiers: RunoutGroupShift[] = [];
  for (const t of ['A-K', 'Q-T', '9-6', '5-2'] as const) {
    const agg = tierAgg.get(t);
    if (agg && agg.count > 0) {
      rankTiers.push({ key: t, avgDeltaPct: roundTenth(agg.sum / agg.count), count: agg.count });
    }
  }

  return { suits, rankTiers };
}
