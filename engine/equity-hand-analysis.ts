import { assertCardArray, assertUniqueKnownCards, CARD_RANKS } from './cards';
import { compareHandRanks, HAND_CATEGORIES } from './evaluator';
import { deepFreeze } from './freeze';
import { HOLDEM_DECK } from './holdem-combos';
import {
  createRangeAnalysisFacts,
  createRangeAnalysisRequest,
  evaluateAvailableCards,
  type RangeAnalysisFacts,
  type RangeAnalysisRequest,
} from './range-analysis';
import type { PokerHandRank } from './schema';

export { evaluateAvailableCards } from './range-analysis';

export const EQUITY_HAND_ANALYSIS_SCHEMA_VERSION = 'equity-hand-analysis/v1';
export const EXACT_ENTERED_HAND_OUTCOMES_SCHEMA_VERSION = 'exact-entered-hand-outcomes/v1';

const RANK_VALUE: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries([...CARD_RANKS].map((rank, index) => [rank, index + 2])),
);

function cardsForRank(cards: readonly string[], rank: number): string[] {
  return cards.filter((card) => RANK_VALUE[card[0]!] === rank);
}

export function orderBestFiveForPresentation(
  canonicalRank: PokerHandRank | null | undefined,
): string[] {
  if (!canonicalRank) return [];
  const cards = canonicalRank.bestFiveCards;
  const tiebreakers = canonicalRank.tiebreakers;
  if (!Array.isArray(cards) || cards.length !== 5 || !Array.isArray(tiebreakers)) return [];

  const ranks = ((): number[] => {
    switch (canonicalRank.category) {
      case HAND_CATEGORIES.FOUR_OF_A_KIND:
        return [
          tiebreakers[0]!,
          tiebreakers[0]!,
          tiebreakers[0]!,
          tiebreakers[0]!,
          tiebreakers[1]!,
        ];
      case HAND_CATEGORIES.FULL_HOUSE:
        return [
          tiebreakers[0]!,
          tiebreakers[0]!,
          tiebreakers[0]!,
          tiebreakers[1]!,
          tiebreakers[1]!,
        ];
      case HAND_CATEGORIES.THREE_OF_A_KIND:
        return [tiebreakers[0]!, tiebreakers[0]!, tiebreakers[0]!, ...tiebreakers.slice(1)];
      case HAND_CATEGORIES.TWO_PAIR:
        return [
          tiebreakers[0]!,
          tiebreakers[0]!,
          tiebreakers[1]!,
          tiebreakers[1]!,
          tiebreakers[2]!,
        ];
      case HAND_CATEGORIES.ONE_PAIR:
        return [tiebreakers[0]!, tiebreakers[0]!, ...tiebreakers.slice(1)];
      case HAND_CATEGORIES.STRAIGHT:
      case HAND_CATEGORIES.STRAIGHT_FLUSH: {
        const high = tiebreakers[0]!;
        return high === 5 ? [5, 4, 3, 2, 14] : [high, high - 1, high - 2, high - 3, high - 4];
      }
      case HAND_CATEGORIES.FLUSH:
      case HAND_CATEGORIES.HIGH_CARD:
        return [...tiebreakers];
      default:
        return [];
    }
  })();

  const remaining = [...cards];
  const ordered: string[] = [];
  for (const rank of ranks) {
    const match = cardsForRank(remaining, rank)[0];
    if (!match) return [...cards];
    ordered.push(match);
    remaining.splice(remaining.indexOf(match), 1);
  }
  return ordered.length === 5 && remaining.length === 0 ? ordered : [...cards];
}

interface NormalizedEnteredPlayer {
  readonly id: string;
  readonly cards: readonly string[] | null;
}

function normalizedPlayers(players: unknown): NormalizedEnteredPlayer[] {
  if (!Array.isArray(players) || players.length < 2 || players.length > 10) {
    throw new RangeError('Exact entered-hand analysis requires 2 through 10 players');
  }
  const ids = new Set<string>();
  return players.map((rawPlayer, index) => {
    const player = rawPlayer as { readonly id?: unknown; readonly cards?: unknown } | null;
    const id = String(player?.id || '').trim();
    if (!id || ids.has(id)) {
      throw new TypeError('Each exact entered-hand player requires a unique id');
    }
    ids.add(id);
    if (player?.cards === null) return { id, cards: null };
    const cards = assertCardArray(player?.cards, `players[${index}].cards`);
    if (cards.length !== 2) {
      throw new RangeError(`players[${index}].cards requires exactly two cards or null`);
    }
    return { id, cards: [...cards] };
  });
}

export type EnteredOutcomeStanding = 'leading' | 'tied' | 'behind';
export type NextCardClassification =
  | 'winning_out'
  | 'tie_out'
  | 'structural_improvement_still_behind'
  | 'structural_improvement_loses_lead'
  | 'non_catch_up';

export interface NextCardTransitionEntry {
  readonly card: string;
  readonly classification: NextCardClassification;
  readonly handClassImproved: boolean;
  readonly standingBefore: EnteredOutcomeStanding;
  readonly standingAfter: EnteredOutcomeStanding;
  readonly resultCategory: string;
  readonly resultTiebreakers: readonly number[];
}

export interface OutcomeFamily {
  readonly count: number;
  readonly cards: readonly string[];
  readonly groups: readonly {
    readonly resultCategory: string;
    readonly count: number;
    readonly cards: readonly string[];
  }[];
}

export interface ExactEnteredHandOutcomesResult {
  readonly schemaVersion: typeof EXACT_ENTERED_HAND_OUTCOMES_SCHEMA_VERSION;
  readonly available: boolean;
  readonly reason: string | null;
  readonly comparisonUniverse: 'all_entered_exact_hands';
  readonly boardCardCount: number;
  readonly street?: 'flop' | 'turn' | 'river';
  readonly nextCardAvailable?: boolean;
  readonly nextCardMeaning?: string;
  readonly legalNextCardCount?: number;
  readonly players: readonly {
    readonly id: string;
    readonly currentStanding: EnteredOutcomeStanding;
    readonly currentCategory: string;
    readonly winningOuts: OutcomeFamily;
    readonly tieOuts: OutcomeFamily;
    readonly structuralImprovementsStillBehind: OutcomeFamily;
    readonly structuralImprovementsLosingLead: OutcomeFamily;
    readonly nextCardTransitions: readonly NextCardTransitionEntry[];
    readonly nonCatchUpCards: OutcomeFamily;
  }[];
}

function groupedOutcomes(
  entries: readonly NextCardTransitionEntry[],
): OutcomeFamily['groups'] {
  const groups = new Map<string, string[]>();
  for (const entry of entries) {
    const key = entry.resultCategory;
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = [];
      groups.set(key, bucket);
    }
    bucket.push(entry.card);
  }
  return [...groups].map(([resultCategory, cards]) => ({
    resultCategory,
    count: cards.length,
    cards,
  }));
}

function outcomeFamily(entries: readonly NextCardTransitionEntry[]): OutcomeFamily {
  return {
    count: entries.length,
    cards: entries.map((entry) => entry.card),
    groups: groupedOutcomes(entries),
  };
}

function currentStandingFor(
  ranks: readonly PokerHandRank[],
  playerIndex: number,
): EnteredOutcomeStanding {
  const comparisons = ranks
    .map((rank, opponentIndex) =>
      opponentIndex === playerIndex ? null : compareHandRanks(ranks[playerIndex]!, rank),
    )
    .filter((comparison): comparison is number => comparison !== null);
  if (comparisons.every((comparison) => comparison > 0)) return 'leading';
  if (
    comparisons.every((comparison) => comparison >= 0) &&
    comparisons.some((comparison) => comparison === 0)
  ) {
    return 'tied';
  }
  return 'behind';
}

export function createExactEnteredHandOutcomeFacts(input: {
  readonly players?: readonly { readonly id: string; readonly cards: readonly string[] | null }[];
  readonly board?: readonly string[];
  readonly deadCards?: readonly string[];
} = {}): ExactEnteredHandOutcomesResult {
  const players = normalizedPlayers(input.players);
  const board = assertCardArray([...(input.board ?? [])], 'board');
  const deadCards = assertCardArray([...(input.deadCards ?? [])], 'deadCards');
  if (board.length > 5) throw new RangeError('board supports at most five cards');
  assertUniqueKnownCards([
    ...players
      .filter((player): player is { id: string; cards: readonly string[] } => player.cards !== null)
      .map((player) => ({ label: `player ${player.id}`, cards: player.cards })),
    { label: 'board', cards: board },
    { label: 'deadCards', cards: deadCards },
  ]);

  if (players.some((player) => player.cards === null)) {
    return deepFreeze({
      schemaVersion: EXACT_ENTERED_HAND_OUTCOMES_SCHEMA_VERSION,
      available: false,
      reason: 'unknown_opponent',
      comparisonUniverse: 'all_entered_exact_hands',
      boardCardCount: board.length,
      players: [],
    });
  }
  if (board.length < 3) {
    return deepFreeze({
      schemaVersion: EXACT_ENTERED_HAND_OUTCOMES_SCHEMA_VERSION,
      available: false,
      reason: 'insufficient_board',
      comparisonUniverse: 'all_entered_exact_hands',
      boardCardCount: board.length,
      players: [],
    });
  }

  const currentRanks = players.map((player) =>
    evaluateAvailableCards([...player.cards!, ...board]),
  );
  const currentStandings = currentRanks.map((_, playerIndex) =>
    currentStandingFor(currentRanks, playerIndex),
  );
  const nextCardAvailable = board.length === 3 || board.length === 4;
  const known = new Set([
    ...players.flatMap((player) => player.cards ?? []),
    ...board,
    ...deadCards,
  ]);
  const legalNextCards = nextCardAvailable
    ? HOLDEM_DECK.filter((card) => !known.has(card))
    : [];
  const entriesByPlayer: NextCardTransitionEntry[][] = players.map(() => []);

  for (const card of legalNextCards) {
    const nextRanks = players.map((player) =>
      evaluateAvailableCards([...player.cards!, ...board, card]),
    );
    players.forEach((_, playerIndex) => {
      const myNext = nextRanks[playerIndex]!;
      const myCurrent = currentRanks[playerIndex]!;
      const comparisons = nextRanks
        .map((rank, opponentIndex) =>
          opponentIndex === playerIndex ? null : compareHandRanks(myNext, rank),
        )
        .filter((comparison): comparison is number => comparison !== null);
      const strictlyAhead = comparisons.every((comparison) => comparison > 0);
      const tiedForBest =
        comparisons.every((comparison) => comparison >= 0) &&
        comparisons.some((comparison) => comparison === 0);
      const canonicalImprovement = myNext.categoryRank > myCurrent.categoryRank;
      const classification: NextCardClassification =
        strictlyAhead && currentStandings[playerIndex] !== 'leading'
          ? 'winning_out'
          : tiedForBest
            ? 'tie_out'
            : canonicalImprovement && comparisons.some((comparison) => comparison < 0)
              ? currentStandings[playerIndex] === 'behind'
                ? 'structural_improvement_still_behind'
                : 'structural_improvement_loses_lead'
              : 'non_catch_up';
      entriesByPlayer[playerIndex]!.push({
        card,
        classification,
        handClassImproved: canonicalImprovement,
        standingBefore: currentStandings[playerIndex]!,
        standingAfter: strictlyAhead ? 'leading' : tiedForBest ? 'tied' : 'behind',
        resultCategory: myNext.category,
        resultTiebreakers: [...myNext.tiebreakers],
      });
    });
  }

  return deepFreeze({
    schemaVersion: EXACT_ENTERED_HAND_OUTCOMES_SCHEMA_VERSION,
    available: true,
    reason: null,
    comparisonUniverse: 'all_entered_exact_hands',
    boardCardCount: board.length,
    street: board.length === 3 ? 'flop' : board.length === 4 ? 'turn' : 'river',
    nextCardAvailable,
    nextCardMeaning:
      board.length === 3
        ? 'ahead_after_next_card_not_guaranteed_final_pot'
        : board.length === 4
          ? 'final_one_card_runout'
          : 'no_cards_to_come',
    legalNextCardCount: legalNextCards.length,
    players: players.map((player, playerIndex) => {
      const entries = entriesByPlayer[playerIndex]!;
      return {
        id: player.id,
        currentStanding: currentStandings[playerIndex]!,
        currentCategory: currentRanks[playerIndex]!.category,
        winningOuts: outcomeFamily(entries.filter((entry) => entry.classification === 'winning_out')),
        tieOuts: outcomeFamily(entries.filter((entry) => entry.classification === 'tie_out')),
        structuralImprovementsStillBehind: outcomeFamily(
          entries.filter((entry) => entry.classification === 'structural_improvement_still_behind'),
        ),
        structuralImprovementsLosingLead: outcomeFamily(
          entries.filter((entry) => entry.classification === 'structural_improvement_loses_lead'),
        ),
        nextCardTransitions: entries,
        nonCatchUpCards: outcomeFamily(
          entries.filter((entry) => entry.classification === 'non_catch_up'),
        ),
      };
    }),
  });
}

function analysisSource() {
  return {
    kind: 'scenario',
    label: 'Equity calculated input',
    sourceId: 'equity-workspace',
    sourceSchemaVersion: 'equity-request/v1',
  };
}

function rangeFactsFor(
  heroCards: readonly string[],
  board: readonly string[],
  unavailableCards: readonly string[],
  createRequest: (input: Record<string, unknown>) => RangeAnalysisRequest,
  createFacts: (requestInput: Record<string, unknown>) => RangeAnalysisFacts,
): RangeAnalysisFacts {
  const source = analysisSource();
  return createFacts(
    createRequest({
      heroCards,
      board,
      deadCards: unavailableCards,
      ranges: {},
      provenance: { exactHand: source, board: source, deadCards: source },
    }) as unknown as Record<string, unknown>,
  );
}

export interface EquityHandAnalysisProjection {
  readonly schemaVersion: typeof EQUITY_HAND_ANALYSIS_SCHEMA_VERSION;
  readonly board: readonly string[];
  readonly deadCards: readonly string[];
  readonly globalFacts: RangeAnalysisFacts;
  readonly players: readonly {
    readonly id: string;
    readonly cards: readonly string[] | null;
    readonly facts: RangeAnalysisFacts | null;
    readonly bestFivePresentationCards: readonly string[];
  }[];
  readonly exactOutcomes: ExactEnteredHandOutcomesResult;
}

export function createEquityHandAnalysisProjection(
  input: {
    readonly players?: readonly { readonly id: string; readonly cards: readonly string[] | null }[];
    readonly board?: readonly string[];
    readonly deadCards?: readonly string[];
  } = {},
  dependencies: {
    readonly createRangeAnalysisRequest?: (input: Record<string, unknown>) => RangeAnalysisRequest;
    readonly createRangeAnalysisFacts?: (input: Record<string, unknown>) => RangeAnalysisFacts;
  } = {},
): EquityHandAnalysisProjection {
  const createRequest = dependencies.createRangeAnalysisRequest ?? createRangeAnalysisRequest;
  const createFacts = dependencies.createRangeAnalysisFacts ?? createRangeAnalysisFacts;
  const players = normalizedPlayers(input.players);
  const board = [...(input.board ?? [])];
  const deadCards = [...(input.deadCards ?? [])];
  const knownHoleCards = players.flatMap((player) => player.cards ?? []);
  const globalFacts = rangeFactsFor(
    [],
    board,
    [...deadCards, ...knownHoleCards],
    createRequest,
    createFacts,
  );
  const playerFacts = players.map((player) => {
    const unavailableCards = [
      ...deadCards,
      ...players
        .filter((candidate) => candidate.id !== player.id)
        .flatMap((candidate) => candidate.cards ?? []),
    ];
    const facts = player.cards
      ? rangeFactsFor(player.cards, board, unavailableCards, createRequest, createFacts)
      : null;
    return {
      id: player.id,
      cards: player.cards ? [...player.cards] : null,
      facts,
      bestFivePresentationCards: orderBestFiveForPresentation(facts?.exactHand.canonicalRank),
    };
  });
  return deepFreeze({
    schemaVersion: EQUITY_HAND_ANALYSIS_SCHEMA_VERSION,
    board,
    deadCards,
    globalFacts,
    players: playerFacts,
    exactOutcomes: createExactEnteredHandOutcomeFacts({ players, board, deadCards }),
  });
}
