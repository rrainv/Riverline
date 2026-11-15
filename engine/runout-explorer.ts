import { CARD_RANKS } from './cards';
import type { AbortSignalLike, EquityRequestInput } from './equity';
import {
  createExactEnteredHandOutcomeFacts,
  type EnteredOutcomeStanding,
  evaluateAvailableCards,
} from './equity-hand-analysis';
import { HAND_CATEGORIES } from './evaluator';
import { cloneData, deepFreeze } from './freeze';
import { getHoldemComboById, HOLDEM_DECK } from './holdem-combos';
import { conditionHoldemRange, HOLDEM_RANGE_ENTRY_STATES } from './holdem-range';
import { deriveBoardStructureFacts, deriveExactHandFacts } from './range-analysis';
import type { PokerHandRank } from './schema';
import {
  calculateWeightedEquity,
  type CalculateWeightedEquityOptions,
  type NormalizedWeightedEquityRequest,
  prepareWeightedEquity,
  WEIGHTED_EQUITY_REQUEST_VERSION,
  type WeightedEquityCoverageEntry,
  type WeightedEquityFailure,
  type WeightedEquityOutcome,
  type WeightedEquityPlayerInput,
  type WeightedEquityRequestInput,
  type WeightedEquityResult,
} from './weighted-equity';

export const RUNOUT_EXPLORER_VERSION = 'runout-explorer/v1';

export function asWeightedEquityRequest(
  input: WeightedEquityRequestInput | EquityRequestInput,
): WeightedEquityRequestInput {
  if (!input || typeof input !== 'object') {
    throw new TypeError('Canonical Equity request required');
  }
  if (input.schemaVersion === WEIGHTED_EQUITY_REQUEST_VERSION) {
    return cloneData(input);
  }
  if (input.schemaVersion !== 'equity-request/v1') {
    throw new TypeError('Canonical Equity request required');
  }
  const cloned = cloneData(input);
  return {
    schemaVersion: WEIGHTED_EQUITY_REQUEST_VERSION,
    board: cloned.board,
    deadCards: cloned.deadCards,
    method: cloned.method,
    samples: cloned.samples,
    seed: cloned.seed,
    players: cloned.players.map((player): WeightedEquityPlayerInput =>
      player.cards === null
        ? { id: player.id, kind: 'uniform_unknown' }
        : { id: player.id, kind: 'exact', cards: player.cards },
    ),
  };
}

export interface RangeStandingFacts {
  readonly definition: 'current_made_hand_vs_known_eligible_opponent_mass';
  readonly ahead: number;
  readonly tied: number;
  readonly behind: number;
  readonly conditionalOnKnownMass: boolean;
  readonly categories: Readonly<Record<string, number>>;
  readonly knownMass: number;
  readonly futureLock: null;
  readonly percentile: null;
}

export function rangeStandingFacts(
  request: Pick<NormalizedWeightedEquityRequest, 'players' | 'board' | 'deadCards'>,
  heroId = request.players[0]?.id,
): RangeStandingFacts | null {
  const hero = request.players.find((player) => player.id === heroId);
  const opponent = request.players.find((player) => player.id !== heroId);
  if (
    request.players.length !== 2 ||
    hero?.kind !== 'exact' ||
    opponent?.kind !== 'range' ||
    request.board.length < 3
  ) {
    return null;
  }
  const removal = conditionHoldemRange(opponent.range, [
    ...request.board,
    ...request.deadCards,
    ...hero.cards,
  ]);
  const heroRank = evaluateAvailableCards([...hero.cards, ...request.board]);
  let ahead = 0;
  let tied = 0;
  let behind = 0;
  const categories: Record<string, number> = {};
  for (const entry of removal.eligibleEntries) {
    if (entry.state !== HOLDEM_RANGE_ENTRY_STATES.KNOWN || entry.weight <= 0) continue;
    const other = evaluateAvailableCards([...getHoldemComboById(entry.comboId).cards, ...request.board]);
    if (heroRank.score > other.score) ahead += entry.weight;
    else if (heroRank.score === other.score) tied += entry.weight;
    else behind += entry.weight;
    categories[other.category] = (categories[other.category] ?? 0) + entry.weight;
  }
  const mass = ahead + tied + behind;
  return mass > 0
    ? {
        definition: 'current_made_hand_vs_known_eligible_opponent_mass',
        ahead: ahead / mass,
        tied: tied / mass,
        behind: behind / mass,
        conditionalOnKnownMass: removal.facts.unknownEligibleCombos > 0,
        categories,
        knownMass: mass,
        futureLock: null,
        percentile: null,
      }
    : null;
}

export type RunoutEffectGroup =
  | 'pairs_board'
  | 'completes_flush'
  | 'completes_straight'
  | 'pairs_hero'
  | 'adds_draw'
  | 'overcard'
  | 'blank';

export interface RunoutRemovalFacts {
  readonly playerId: string;
  readonly before: ReturnType<typeof conditionHoldemRange>['facts'];
  readonly after: ReturnType<typeof conditionHoldemRange>['facts'];
  readonly derivation: 'public_card_removal_only_no_action_conditioning';
}

export interface RunoutCardFacts {
  readonly cards: readonly string[];
  readonly resultingHand: PokerHandRank | null;
  readonly categoryImproved: boolean | null;
  readonly completion: {
    readonly category: string;
    readonly fromCategory: string;
    readonly redraw: null;
  } | null;
  readonly effectGroup: RunoutEffectGroup;
  readonly pairsBoard: boolean;
  readonly bringsFlushCard: boolean;
  readonly enteredStanding: EnteredOutcomeStanding | null;
  readonly standing: RangeStandingFacts | null;
  readonly removal: readonly RunoutRemovalFacts[];
}

function classifyHeroRunoutEffect(
  beforeBoard: readonly string[],
  addedCards: readonly string[],
  hero: WeightedEquityPlayerInput | undefined,
  deadCards: readonly string[],
  current: PokerHandRank | null,
  resulting: PokerHandRank | null,
): {
  readonly effectGroup: RunoutEffectGroup;
  readonly pairsBoard: boolean;
  readonly bringsFlushCard: boolean;
} {
  const afterBoard = [...beforeBoard, ...addedCards];
  const lastCard = addedCards[addedCards.length - 1]!;
  const beforeBoardRanks = new Set(beforeBoard.map((c) => c[0]!));
  const pairsBoard = addedCards.some((c) => beforeBoardRanks.has(c[0]!));

  const lastSuitCountAfter = afterBoard.filter((c) => c[1] === lastCard[1]).length;
  const heroMadeFlush =
    resulting !== null &&
    (resulting.category === HAND_CATEGORIES.FLUSH ||
      resulting.category === HAND_CATEGORIES.STRAIGHT_FLUSH) &&
    (current === null || resulting.categoryRank > current.categoryRank);
  const bringsFlushCard = lastSuitCountAfter >= 3 || heroMadeFlush;

  const beforeBoardFacts = deriveBoardStructureFacts(beforeBoard);
  const afterBoardFacts = deriveBoardStructureFacts(afterBoard);
  const heroMadeStraight =
    resulting !== null &&
    resulting.category === HAND_CATEGORIES.STRAIGHT &&
    (current === null || resulting.categoryRank > current.categoryRank);
  const completesStraight =
    heroMadeStraight ||
    (afterBoardFacts.straightCompletedOnBoard === true &&
      beforeBoardFacts.straightCompletedOnBoard !== true);

  const pairsHero =
    hero?.kind === 'exact' &&
    addedCards.some((c) => hero.cards.some((hc) => hc[0] === c[0]));

  let addsDraw = false;
  if (hero?.kind === 'exact' && beforeBoard.length >= 3) {
    const beforeHeroFacts = deriveExactHandFacts({
      heroCards: hero.cards,
      board: beforeBoard,
      deadCards,
    });
    const afterHeroFacts = deriveExactHandFacts({
      heroCards: hero.cards,
      board: afterBoard,
      deadCards,
    });
    const gainedFlushDraw = !beforeHeroFacts.draws.flushDraw && afterHeroFacts.draws.flushDraw;
    const gainedStraightDraw =
      (!beforeHeroFacts.draws.openEndedStraightDraw &&
        afterHeroFacts.draws.openEndedStraightDraw) ||
      (!beforeHeroFacts.draws.gutshot && afterHeroFacts.draws.gutshot) ||
      (!beforeHeroFacts.draws.doubleGutshot && afterHeroFacts.draws.doubleGutshot);
    addsDraw = gainedFlushDraw || gainedStraightDraw;
  }

  const maxBeforeRank = beforeBoard.reduce(
    (max, card) => Math.max(max, CARD_RANKS.indexOf(card[0] as (typeof CARD_RANKS)[number])),
    -1,
  );
  const lastRank = CARD_RANKS.indexOf(lastCard[0] as (typeof CARD_RANKS)[number]);
  const isOvercard = !pairsBoard && lastRank > maxBeforeRank;

  const effectGroup: RunoutEffectGroup = pairsBoard
    ? 'pairs_board'
    : bringsFlushCard
      ? 'completes_flush'
      : completesStraight
        ? 'completes_straight'
        : pairsHero
          ? 'pairs_hero'
          : addsDraw
            ? 'adds_draw'
            : isOvercard
              ? 'overcard'
              : 'blank';

  return { effectGroup, pairsBoard, bringsFlushCard };
}

export function runoutCardFacts(
  request: NormalizedWeightedEquityRequest,
  cards: readonly string[],
  heroId = request.players[0]?.id,
): RunoutCardFacts {
  const hero = request.players.find((player) => player.id === heroId);
  const board = [...request.board, ...cards];
  const current = hero?.kind === 'exact' ? evaluateAvailableCards([...hero.cards, ...request.board]) : null;
  const resulting = hero?.kind === 'exact' ? evaluateAvailableCards([...hero.cards, ...board]) : null;
  const exactPlayers = request.players.every((player) => player.kind === 'exact');
  const outcomes = exactPlayers
    ? createExactEnteredHandOutcomeFacts({
        players: request.players.map((player) => ({
          id: player.id,
          cards: player.kind === 'exact' ? player.cards : null,
        })),
        board,
        deadCards: request.deadCards,
      }).players
    : [];

  const exactHoleCards = request.players
    .filter((p): p is Extract<WeightedEquityPlayerInput, { kind: 'exact' }> => p.kind === 'exact')
    .flatMap((p) => p.cards);

  const effect = classifyHeroRunoutEffect(
    request.board,
    cards,
    hero,
    request.deadCards,
    current,
    resulting,
  );

  return {
    cards,
    resultingHand: resulting,
    categoryImproved: current && resulting ? resulting.categoryRank > current.categoryRank : null,
    completion:
      current && resulting && resulting.categoryRank > current.categoryRank
        ? { category: resulting.category, fromCategory: current.category, redraw: null }
        : null,
    effectGroup: effect.effectGroup,
    pairsBoard: effect.pairsBoard,
    bringsFlushCard: effect.bringsFlushCard,
    enteredStanding: outcomes.find((player) => player.id === heroId)?.currentStanding ?? null,
    standing: rangeStandingFacts({ ...request, board }, heroId),
    removal: request.players
      .filter((p): p is Extract<WeightedEquityPlayerInput, { kind: 'range' }> => p.kind === 'range')
      .map((player) => ({
        playerId: player.id,
        before: conditionHoldemRange(player.range, [
          ...request.board,
          ...request.deadCards,
          ...exactHoleCards,
        ]).facts,
        after: conditionHoldemRange(player.range, [
          ...board,
          ...request.deadCards,
          ...exactHoleCards,
        ]).facts,
        derivation: 'public_card_removal_only_no_action_conditioning',
      })),
  };
}

export interface CompactRunoutCoverageEntry extends Omit<WeightedEquityCoverageEntry, 'provenance'> {}

export interface CompactRunoutRowResult
  extends Omit<WeightedEquityResult, 'recipe' | 'coverage'> {
  readonly coverage: readonly CompactRunoutCoverageEntry[];
}

export interface RunoutRow extends RunoutCardFacts {
  readonly result: CompactRunoutRowResult | WeightedEquityFailure;
  readonly equity: number | null;
  readonly equityDelta: number | null;
  readonly deltaEstimated: boolean;
}

export interface RunoutExplorerResult {
  readonly schemaVersion: typeof RUNOUT_EXPLORER_VERSION;
  readonly status: 'exact' | 'estimated' | 'partial';
  readonly baseline: WeightedEquityResult;
  readonly heroId: string;
  readonly rows: readonly RunoutRow[];
  readonly recipe: {
    readonly request: NormalizedWeightedEquityRequest;
    readonly sequences: readonly (readonly string[])[];
    readonly heroId: string;
  };
  readonly cardProbabilities: null;
  readonly scope: 'conditional_hypothetical_runouts_not_equally_likely_cards';
  readonly actionConditioning: 'unchanged';
  readonly strategyRecommendation: false;
}

export type RunoutExplorerOutcome =
  | RunoutExplorerResult
  | WeightedEquityFailure
  | { readonly status: 'unavailable'; readonly reason: string };

export interface ExploreRunoutsOptions {
  readonly sequences?: readonly (readonly string[])[] | null;
  readonly heroId?: string;
  readonly signal?: AbortSignalLike | null;
  readonly onProgress?: ((progress: { readonly completed: number; readonly total: number }) => void) | null;
  readonly samples?: number;
  readonly calculate?: (
    input: unknown,
    options?: CalculateWeightedEquityOptions,
  ) => Promise<WeightedEquityOutcome>;
}

export async function exploreRunouts(
  input: WeightedEquityRequestInput | EquityRequestInput,
  options: ExploreRunoutsOptions = {},
): Promise<RunoutExplorerOutcome> {
  const {
    sequences = null,
    heroId = input.players[0]?.id,
    signal = null,
    onProgress = null,
    samples = 500,
    calculate = calculateWeightedEquity,
  } = options;

  const prepared = prepareWeightedEquity(asWeightedEquityRequest(input));
  if (!('request' in prepared)) return prepared;
  const request = prepared.request;
  if (request.board.length !== 3 && request.board.length !== 4) {
    return { status: 'unavailable', reason: 'flop_or_turn_required' };
  }
  if (!Number.isInteger(samples) || samples < 1 || samples > 2000) {
    return { status: 'unavailable', reason: 'preview_sample_limit' };
  }
  if (!heroId || !request.players.some((player) => player.id === heroId)) {
    return { status: 'unavailable', reason: 'invalid_hero' };
  }
  const legal = HOLDEM_DECK.filter((card) => !prepared.fixedSet.has(card));
  const paths = sequences ?? legal.map((card) => [card]);
  if (
    !Array.isArray(paths) ||
    !paths.length ||
    paths.length > 52 ||
    paths.some(
      (path) =>
        !Array.isArray(path) ||
        !path.length ||
        path.length > 5 - request.board.length ||
        new Set(path).size !== path.length ||
        path.some((card) => !legal.includes(card)),
    )
  ) {
    return { status: 'unavailable', reason: 'illegal_runout' };
  }

  // 53 calculations at most, each capped at 2,000 exact realizations or samples.
  const bounded: NormalizedWeightedEquityRequest = { ...request, method: 'auto', samples };
  const baseline = await calculate(bounded, { signal, exactLimit: 2000 });
  if (baseline.reason !== null) return baseline;
  if (!baseline.players.length) return { status: 'unavailable', reason: 'no_players' };

  const base = baseline.players.find((player) => player.id === heroId)!.equity;
  const rows: RunoutRow[] = [];
  for (const cards of paths) {
    if (signal?.aborted) return { status: 'unavailable', reason: 'aborted' };
    const result = await calculate(
      { ...bounded, board: [...request.board, ...cards] },
      { signal, exactLimit: 2000 },
    );
    if (signal?.aborted) return { status: 'unavailable', reason: 'aborted' };

    const equity = result.players.find((player) => player.id === heroId)?.equity ?? null;
    // One top-level replay request owns large range/provenance values. Do not
    // copy 1,326-entry ranges into every card row sent across the worker boundary.
    const compactCoverage: readonly CompactRunoutCoverageEntry[] = result.coverage.map(
      ({ provenance: _provenance, ...coverage }) => coverage,
    );
    let compactResult: CompactRunoutRowResult | WeightedEquityFailure;
    if (result.reason === null) {
      const { recipe: _recipe, coverage: _cov, ...rest } = result;
      compactResult = { ...rest, coverage: compactCoverage };
    } else {
      compactResult = { ...result, coverage: compactCoverage };
    }

    rows.push({
      ...runoutCardFacts(request, cards, heroId),
      result: compactResult,
      equity,
      equityDelta: equity === null ? null : equity - base,
      deltaEstimated: baseline.method !== 'exact' || result.method !== 'exact',
    });
    onProgress?.({ completed: rows.length, total: paths.length });
  }

  return deepFreeze({
    schemaVersion: RUNOUT_EXPLORER_VERSION,
    status: baseline.status,
    baseline,
    heroId,
    rows,
    recipe: { request: bounded, sequences: paths, heroId },
    cardProbabilities: null,
    scope: 'conditional_hypothetical_runouts_not_equally_likely_cards',
    actionConditioning: 'unchanged',
    strategyRecommendation: false,
  });
}

export function groupRunouts(
  rows: readonly RunoutRow[],
  by: 'rank' | 'suit' | 'category' | 'effect' = 'rank',
): { readonly key: string; readonly rows: RunoutRow[] }[] {
  if (by !== 'rank' && by !== 'suit' && by !== 'category' && by !== 'effect') {
    throw new RangeError('Unsupported grouping');
  }
  const groups = new Map<string, RunoutRow[]>();
  for (const row of rows) {
    const key =
      by === 'effect'
        ? row.effectGroup
        : by === 'category'
          ? (row.resultingHand?.category ?? 'range')
          : row.cards.map((card) => card[by === 'rank' ? 0 : 1]!).join(' -> ');
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = [];
      groups.set(key, bucket);
    }
    bucket.push(row);
  }
  return [...groups].map(([key, entries]) => ({ key, rows: entries }));
}
