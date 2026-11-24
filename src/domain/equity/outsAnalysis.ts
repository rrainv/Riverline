import {
  HOLDEM_DECK,
  type EquityHandAnalysisProjection,
  type HandCategory,
  type HoldemWeightedRange,
} from '../../engine-api';
import { classifyComboAgainstBoard } from './rangeBreakdown';

const RANK_ORDER = '23456789TJQKA';

function rankVal(rankChar: string): number {
  return RANK_ORDER.indexOf(rankChar.toUpperCase()) + 2;
}

function roundTenth(v: number): number {
  return Math.round(v * 10) / 10;
}

export function hitOneCardPct(outs: number, unseenCount: number): number {
  if (outs <= 0 || unseenCount <= 0) return 0;
  return roundTenth((Math.min(outs, unseenCount) / unseenCount) * 100);
}

export function hitByRiverPct(outs: number, unseenCount: number): number {
  if (outs <= 0 || unseenCount <= 1) return hitOneCardPct(outs, unseenCount);
  const clamped = Math.min(outs, unseenCount);
  const missBoth =
    ((unseenCount - clamped) / unseenCount) *
    ((unseenCount - 1 - clamped) / (unseenCount - 1));
  return roundTenth((1 - missBoth) * 100);
}

export interface OutcomeGroupBadge {
  readonly category: string;
  readonly count: number;
  readonly cards: readonly string[];
}

export interface NextCardOutcomeBucket {
  readonly count: number;
  readonly turnPct: number;
  readonly byRiverPct: number | null;
  readonly cards: readonly string[];
  readonly groups: readonly OutcomeGroupBadge[];
}

export interface RangeDominationSummary {
  readonly flushDominationPct: number | null;
  readonly dominatingFlushCombos: number;
  readonly heroFlushSuit: string | null;
  readonly villainAheadSetsTwoPairPct: number;
  readonly boardPairThreatCount: number;
  readonly flushCompleteThreatCount: number;
}

export interface HeroOutsAnalysis {
  readonly street: 'flop' | 'turn';
  readonly unseenCount: number;
  readonly heroCategory: HandCategory | null;
  readonly bestFiveCards: readonly string[];
  readonly standing: 'leading' | 'tied' | 'behind' | null;
  readonly exactMatchupAvailable: boolean;
  readonly winningOuts: NextCardOutcomeBucket | null;
  readonly tieOuts: NextCardOutcomeBucket | null;
  readonly dominatedOuts: NextCardOutcomeBucket | null;
  readonly counterfeitOuts: NextCardOutcomeBucket | null;
  readonly villainCatchUpOuts: NextCardOutcomeBucket | null;
  readonly structuralDraws: {
    readonly flushCount: number;
    readonly flushCards: readonly string[];
    readonly nutFlushDraw: boolean;
    readonly straightCount: number;
    readonly straightSubtype: string | null;
    readonly straightCards: readonly string[];
    readonly overcardCount: number;
    readonly overcardRankSymbols: readonly string[];
    readonly overlapCount: number;
    readonly uniqueCount: number;
    readonly uniqueCards: readonly string[];
    readonly uniqueTurnPct: number;
    readonly uniqueByRiverPct: number | null;
  };
  readonly rangeDomination: RangeDominationSummary | null;
}

function emptyBucket(): NextCardOutcomeBucket {
  return { count: 0, turnPct: 0, byRiverPct: null, cards: [], groups: [] };
}

function parseComboCards(comboId: string): readonly [string, string] | null {
  const parts = comboId.split(':');
  if (parts.length !== 3) return null;
  return [parts[1]!, parts[2]!];
}

export function computeHeroOutsAnalysis(params: {
  readonly projection: EquityHandAnalysisProjection | null;
  readonly heroId: string;
  readonly heroCards: readonly [string, string] | null;
  readonly board: readonly string[];
  readonly customDeadCards: readonly string[];
  readonly villainRange: HoldemWeightedRange | null;
}): HeroOutsAnalysis | null {
  const { projection, heroId, heroCards, board, customDeadCards, villainRange } = params;
  if (!projection || !heroCards || (board.length !== 3 && board.length !== 4)) {
    return null;
  }

  const street: 'flop' | 'turn' = board.length === 3 ? 'flop' : 'turn';
  const projHero = projection.players.find((p) => p.id === heroId);
  if (!projHero?.facts) return null;

  const exactFacts = projHero.facts.exactHand;
  const draws = exactFacts.draws;
  const drawOuts = exactFacts.drawOuts;

  const knownCards = new Set<string>([
    ...board,
    ...customDeadCards,
    ...projection.players.flatMap((p) => p.cards ?? []),
  ]);
  const unseenDeck = HOLDEM_DECK.filter((c) => !knownCards.has(c));
  const unseenCount = projection.exactOutcomes.available
    ? (projection.exactOutcomes.legalNextCardCount ?? unseenDeck.length)
    : unseenDeck.length;

  const exactAvailable = projection.exactOutcomes.available;
  const outcomeHero = exactAvailable
    ? projection.exactOutcomes.players.find((p) => p.id === heroId)
    : undefined;

  const toBucket = (
    fam:
      | {
          readonly count: number;
          readonly cards: readonly string[];
          readonly groups: readonly {
            readonly resultCategory: string;
            readonly count: number;
            readonly cards: readonly string[];
          }[];
        }
      | undefined,
  ): NextCardOutcomeBucket => {
    if (!fam) return emptyBucket();
    return {
      count: fam.count,
      turnPct: hitOneCardPct(fam.count, unseenCount),
      byRiverPct: street === 'flop' ? hitByRiverPct(fam.count, unseenCount) : null,
      cards: fam.cards,
      groups: fam.groups.map((g) => ({
        category: g.resultCategory,
        count: g.count,
        cards: g.cards,
      })),
    };
  };

  let villainCatchUpOuts: NextCardOutcomeBucket | null = null;
  if (outcomeHero && outcomeHero.currentStanding === 'leading') {
    const catchUpTransitions = outcomeHero.nextCardTransitions.filter(
      (t) => t.standingBefore === 'leading' && t.standingAfter !== 'leading',
    );
    const byCat = new Map<string, string[]>();
    for (const tr of catchUpTransitions) {
      const list = byCat.get(tr.resultCategory) ?? [];
      list.push(tr.card);
      byCat.set(tr.resultCategory, list);
    }
    villainCatchUpOuts = {
      count: catchUpTransitions.length,
      turnPct: hitOneCardPct(catchUpTransitions.length, unseenCount),
      byRiverPct:
        street === 'flop' ? hitByRiverPct(catchUpTransitions.length, unseenCount) : null,
      cards: catchUpTransitions.map((t) => t.card),
      groups: [...byCat.entries()].map(([category, cards]) => ({
        category,
        count: cards.length,
        cards,
      })),
    };
  }

  // Unique clean structural outs (flush + straight deduplicated by card)
  const uniqueCards = drawOuts.uniqueCompletionCards;
  const uniqueCount = drawOuts.uniqueCompletionCardCount;

  // Range-aware domination and board counterfeit threat
  let rangeDomination: RangeDominationSummary | null = null;
  if (villainRange) {
    const suitCounts: Record<string, number> = {};
    for (const c of board) {
      suitCounts[c[1]!] = (suitCounts[c[1]!] ?? 0) + 1;
    }
    const maxBoardSuit = Object.entries(suitCounts).sort((a, b) => b[1] - a[1])[0];
    const heroSuitForDraw = draws.flushDrawSuit;
    const heroMaxInDrawSuit = heroSuitForDraw
      ? Math.max(
          0,
          ...heroCards
            .filter((c) => c[1] === heroSuitForDraw)
            .map((c) => rankVal(c[0]!)),
        )
      : 0;

    let totalWeight = 0;
    let dominatingFlushWeight = 0;
    let dominatingFlushCombos = 0;
    let setsTwoPairWeight = 0;

    const deadAll = new Set<string>([...board, ...heroCards, ...customDeadCards]);
    for (const entry of villainRange.entries) {
      if (entry.state !== 'known' || entry.weight <= 0) continue;
      const cards = parseComboCards(entry.comboId);
      if (!cards) continue;
      if (deadAll.has(cards[0]) || deadAll.has(cards[1])) continue;
      totalWeight += entry.weight;

      const bucket = classifyComboAgainstBoard(cards, board);
      if (bucket === 'sets_plus' || bucket === 'two_pair') {
        setsTwoPairWeight += entry.weight;
      }

      if (heroSuitForDraw && heroMaxInDrawSuit > 0) {
        const s0 = cards[0][1] === heroSuitForDraw;
        const s1 = cards[1][1] === heroSuitForDraw;
        const villainSuitCount = (s0 ? 1 : 0) + (s1 ? 1 : 0);
        const boardSuitCount = suitCounts[heroSuitForDraw] ?? 0;
        if (villainSuitCount + boardSuitCount >= 4 && villainSuitCount >= 1) {
          const villainMax = Math.max(
            s0 ? rankVal(cards[0][0]!) : 0,
            s1 ? rankVal(cards[1][0]!) : 0,
          );
          if (villainMax > heroMaxInDrawSuit) {
            dominatingFlushWeight += entry.weight;
            dominatingFlushCombos += 1;
          }
        }
      }
    }

    const boardRanks = new Set(board.map((c) => c[0]!));
    const boardPairThreatCount = unseenDeck.filter((c) => boardRanks.has(c[0]!)).length;
    const flushCompleteThreatCount =
      maxBoardSuit && maxBoardSuit[1] >= 2
        ? unseenDeck.filter((c) => c[1] === maxBoardSuit[0]).length
        : 0;

    rangeDomination = {
      flushDominationPct:
        heroSuitForDraw && totalWeight > 0
          ? roundTenth((dominatingFlushWeight / totalWeight) * 100)
          : null,
      dominatingFlushCombos,
      heroFlushSuit: heroSuitForDraw,
      villainAheadSetsTwoPairPct:
        totalWeight > 0 ? roundTenth((setsTwoPairWeight / totalWeight) * 100) : 0,
      boardPairThreatCount,
      flushCompleteThreatCount,
    };
  }

  return {
    street,
    unseenCount,
    heroCategory: exactFacts.primaryCategory,
    bestFiveCards: projHero.bestFivePresentationCards,
    standing: outcomeHero?.currentStanding ?? null,
    exactMatchupAvailable: exactAvailable && Boolean(outcomeHero),
    winningOuts: outcomeHero ? toBucket(outcomeHero.winningOuts) : null,
    tieOuts: outcomeHero ? toBucket(outcomeHero.tieOuts) : null,
    dominatedOuts: outcomeHero ? toBucket(outcomeHero.structuralImprovementsStillBehind) : null,
    counterfeitOuts: outcomeHero ? toBucket(outcomeHero.structuralImprovementsLosingLead) : null,
    villainCatchUpOuts,
    structuralDraws: {
      flushCount: drawOuts.flush.count,
      flushCards: drawOuts.flush.completionCards,
      nutFlushDraw: draws.nutFlushDraw,
      straightCount: drawOuts.straight.count,
      straightSubtype: drawOuts.straight.subtype,
      straightCards: drawOuts.straight.completionCards,
      overcardCount: draws.overcardCount,
      overcardRankSymbols: draws.overcardRankSymbols ?? [],
      overlapCount: drawOuts.overlaps.length,
      uniqueCount,
      uniqueCards,
      uniqueTurnPct: hitOneCardPct(uniqueCount, unseenCount),
      uniqueByRiverPct: street === 'flop' ? hitByRiverPct(uniqueCount, unseenCount) : null,
    },
    rangeDomination,
  };
}
