import {
  buildHandCategoryRecord,
  categoryRankFromScore,
  encodeCard,
  evaluateSevenCodesUnchecked,
  type HandCategory,
} from './evaluator';
import {
  chooseCards,
  createSeededRandom,
  defaultYieldControl,
  EXACT_EQUITY_COMBINATION_LIMIT,
  validateEquityRequest,
  type AbortSignalLike,
  type EquityMethodPreference,
  type EquityResolvedMethod,
} from './equity';
import { cloneData, deepFreeze } from './freeze';
import { solveExactHeadsUpPreflop } from './preflop-exact';
import { getHoldemComboById, HOLDEM_COMBOS, HOLDEM_DECK } from './holdem-combos';
import {
  conditionHoldemRange,
  HOLDEM_RANGE_ENTRY_STATES,
  type HoldemWeightedRange,
} from './holdem-range';

export const WEIGHTED_EQUITY_REQUEST_VERSION = 'weighted-equity-request/v1';
export const WEIGHTED_EQUITY_RESULT_VERSION = 'weighted-equity-result/v1';

const SOURCE_ROLES = Object.freeze([
  'user_supplied',
  'personal_intended',
  'explicit_opponent_model',
  'reference',
] as const);

export type WeightedEquitySourceRole = (typeof SOURCE_ROLES)[number];
export type WeightedEquityPartialPolicy = 'reject' | 'known_only';

export type WeightedEquityPlayerInput =
  | { readonly id: string; readonly kind: 'exact'; readonly cards: readonly string[] }
  | { readonly id: string; readonly kind: 'uniform_unknown' }
  | {
      readonly id: string;
      readonly kind: 'range';
      readonly range: HoldemWeightedRange;
      readonly sourceRole: WeightedEquitySourceRole;
      readonly sourceId: string;
      readonly weightSemantics: 'relative_combo_likelihood';
    };

export interface WeightedEquityRequestInput {
  readonly schemaVersion: typeof WEIGHTED_EQUITY_REQUEST_VERSION;
  readonly players: readonly WeightedEquityPlayerInput[];
  readonly board?: readonly string[];
  readonly deadCards?: readonly string[];
  readonly method?: EquityMethodPreference;
  readonly samples?: number;
  readonly seed?: number;
  readonly partialPolicy?: WeightedEquityPartialPolicy;
}

export interface NormalizedWeightedEquityRequest {
  readonly schemaVersion: typeof WEIGHTED_EQUITY_REQUEST_VERSION;
  readonly players: readonly WeightedEquityPlayerInput[];
  readonly board: readonly string[];
  readonly deadCards: readonly string[];
  readonly method: EquityMethodPreference;
  readonly samples: number;
  readonly seed: number;
  readonly partialPolicy: WeightedEquityPartialPolicy;
}

export interface WeightedEquityCoverageEntry {
  readonly playerId: string;
  readonly sourceRole: string;
  readonly sourceId: string;
  readonly provenance?: HoldemWeightedRange['provenance'];
  readonly rangeId: string | null;
  readonly knownMass: number;
  readonly unknownMass: number | null;
  readonly unknownMassBounds: readonly [number, number];
  readonly blockedKnownMass: number;
  readonly blockedUnknownCombos: number;
  readonly knownCombos: number;
  readonly unknownCombos: number;
  readonly eligibleCombos: number;
  readonly comboCoverage: number;
  readonly normalizationAvailable: boolean;
  readonly conditionalNormalizationAvailable: boolean;
  readonly conditioning: string;
}

export interface WeightedEquityFailure {
  readonly schemaVersion: typeof WEIGHTED_EQUITY_RESULT_VERSION;
  readonly status: 'unavailable' | 'partial' | 'incomparable';
  readonly reason: string;
  readonly players: readonly [];
  readonly coverage: readonly WeightedEquityCoverageEntry[];
  readonly conditionalOnKnownMass: null;
  readonly method: null;
}

export interface WeightedEquityPlayerResult {
  readonly id: string;
  readonly wins: number;
  readonly ties: number;
  readonly losses: number;
  readonly totalMass: number;
  readonly equity: number;
  readonly winProbability: number;
  readonly tieProbability: number;
  readonly margin95: number;
  readonly riverCategoryShares: Readonly<Record<HandCategory, number>>;
}

export interface WeightedEquityResult {
  readonly schemaVersion: typeof WEIGHTED_EQUITY_RESULT_VERSION;
  readonly status: 'exact' | 'estimated' | 'partial';
  readonly reason: null;
  readonly method: EquityResolvedMethod;
  readonly conditionalOnKnownMass: boolean;
  readonly coverage: readonly WeightedEquityCoverageEntry[];
  readonly players: readonly WeightedEquityPlayerResult[];
  readonly trials: number;
  readonly metadata: {
    readonly seed: number;
    readonly samplesRequested: number;
    readonly attempts: number;
    readonly estimatedCombinationsUpperBound: number;
    readonly sampler: 'independent_weighted_tuple_rejection/v1';
    readonly jointCompatibilityProbability: number | null;
    readonly payoff: 'equal_showdown_pot_share_no_rake_or_side_pots';
  };
  readonly recipe: NormalizedWeightedEquityRequest;
  readonly permissions: {
    readonly strategyRecommendation: false;
    readonly normative: false;
  };
}

export type WeightedEquityOutcome = WeightedEquityResult | WeightedEquityFailure;

interface CandidateEntry {
  readonly cards: readonly string[];
  readonly cardCodes: readonly [number, number];
  readonly probability: number;
  readonly cumulative: number;
}

export interface PreparedWeightedEquity {
  readonly request: NormalizedWeightedEquityRequest;
  readonly candidates: readonly (readonly CandidateEntry[])[];
  readonly fixedSet: ReadonlySet<string>;
  readonly coverage: readonly WeightedEquityCoverageEntry[];
  readonly partial: boolean;
  readonly upper: number;
}

function fail(
  reason: string,
  status: 'unavailable' | 'partial' | 'incomparable' = 'unavailable',
  coverage: readonly WeightedEquityCoverageEntry[] = [],
): WeightedEquityFailure {
  return deepFreeze({
    schemaVersion: WEIGHTED_EQUITY_RESULT_VERSION,
    status,
    reason,
    players: [],
    coverage,
    conditionalOnKnownMass: null,
    method: null,
  });
}

function choose(n: number, k: number): number {
  let value = 1;
  for (let i = 1; i <= k; i += 1) value = (value * (n - i + 1)) / i;
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Range Core remains the representation. This wrapper declares the meaning of
 * its weights for this matchup; it neither authenticates references nor derives
 * a holding distribution from action-selection policy weights.
 */
export function prepareWeightedEquity(
  input: unknown,
): PreparedWeightedEquity | WeightedEquityFailure {
  try {
    if (!isPlainRecord(input) || input.schemaVersion !== WEIGHTED_EQUITY_REQUEST_VERSION) {
      return fail('invalid_request');
    }
    const partialPolicy = input.partialPolicy ?? 'reject';
    if (partialPolicy !== 'reject' && partialPolicy !== 'known_only') {
      return fail('invalid_partial_policy');
    }
    const rawPlayers = input.players;
    const projected = (Array.isArray(rawPlayers) ? rawPlayers : []).map((rawPlayer) => {
      if (!isPlainRecord(rawPlayer)) throw Error('invalid_player_kind');
      const kind = rawPlayer.kind;
      if (kind !== 'exact' && kind !== 'range' && kind !== 'uniform_unknown') {
        throw Error('invalid_player_kind');
      }
      if (kind === 'exact' && (!Array.isArray(rawPlayer.cards) || rawPlayer.cards.length !== 2)) {
        throw Error('invalid_exact_hand');
      }
      if (kind === 'range') {
        if (Object.hasOwn(rawPlayer, 'cards')) throw Error('ambiguous_range_input');
        if (
          rawPlayer.weightSemantics !== 'relative_combo_likelihood' ||
          typeof rawPlayer.sourceRole !== 'string' ||
          !(SOURCE_ROLES as readonly string[]).includes(rawPlayer.sourceRole) ||
          typeof rawPlayer.sourceId !== 'string' ||
          !rawPlayer.sourceId.trim()
        ) {
          throw Error('incompatible_source_semantics');
        }
      } else if (
        Object.hasOwn(rawPlayer, 'range') ||
        (kind === 'uniform_unknown' && Object.hasOwn(rawPlayer, 'cards'))
      ) {
        throw Error('ambiguous_player_input');
      }
      return {
        id: rawPlayer.id as string,
        cards: kind === 'exact' ? (rawPlayer.cards as readonly string[]) : null,
      };
    });

    const validation = validateEquityRequest({
      ...input,
      schemaVersion: 'equity-request/v1',
      players: projected,
    });
    if (!validation.ok) return fail(validation.error.code);

    const request: NormalizedWeightedEquityRequest = {
      schemaVersion: WEIGHTED_EQUITY_REQUEST_VERSION,
      players: cloneData(rawPlayers as WeightedEquityPlayerInput[]),
      board: [...validation.request.board],
      deadCards: [...validation.request.deadCards],
      method: validation.request.method,
      samples: validation.request.samples,
      seed: validation.request.seed,
      partialPolicy: partialPolicy as WeightedEquityPartialPolicy,
    };

    const fixed = [
      ...request.board,
      ...request.deadCards,
      ...projected.flatMap((player) => player.cards ?? []),
    ];
    const fixedSet = new Set(fixed);
    const coverage: WeightedEquityCoverageEntry[] = [];

    const candidates: CandidateEntry[][] = request.players.map((player) => {
      if (player.kind === 'exact') {
        const c0 = encodeCard(player.cards[0]!);
        const c1 = encodeCard(player.cards[1]!);
        return [
          {
            cards: player.cards,
            cardCodes: [c0, c1] as const,
            probability: 1,
            cumulative: 1,
          },
        ];
      }
      let entries: Array<{ cards: readonly string[]; weight: number }>;
      if (player.kind === 'uniform_unknown') {
        entries = HOLDEM_COMBOS
          .filter((combo) => !combo.cards.some((card) => fixedSet.has(card)))
          .map((combo) => ({ cards: combo.cards, weight: 1 }));
      } else {
        const removal = conditionHoldemRange(player.range, fixed);
        const f = removal.facts;
        coverage.push({
          playerId: player.id,
          sourceRole: player.sourceRole,
          sourceId: player.sourceId,
          provenance: player.range.provenance,
          rangeId: player.range.rangeId,
          knownMass: f.totalEligibleWeight,
          unknownMass: f.unknownEligibleCombos ? null : 0,
          unknownMassBounds: [0, f.unknownEligibleCombos],
          blockedKnownMass: f.blockedKnownWeight,
          blockedUnknownCombos: removal.blockedEntries.filter(
            (entry) => entry.state === HOLDEM_RANGE_ENTRY_STATES.UNKNOWN,
          ).length,
          knownCombos: f.knownEligibleCombos,
          unknownCombos: f.unknownEligibleCombos,
          eligibleCombos: f.eligibleCombos,
          comboCoverage: f.eligibleCoverageRatio,
          normalizationAvailable: f.completeAfterConditioning && f.totalEligibleWeight > 0,
          conditionalNormalizationAvailable: f.totalEligibleWeight > 0,
          conditioning: 'fixed_board_dead_and_exact_hands_before_joint_collision_conditioning',
        });
        entries = removal.eligibleEntries
          .filter((entry) => entry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN && entry.weight > 0)
          .map((entry) => ({
            cards: getHoldemComboById(entry.comboId).cards,
            weight: entry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN ? entry.weight : 0,
          }));
      }
      const mass = entries.reduce((sum, entry) => sum + entry.weight, 0);
      let cumulative = 0;
      return entries.map((entry) => {
        const probability = entry.weight / mass;
        cumulative += probability;
        return {
          cards: entry.cards,
          cardCodes: [encodeCard(entry.cards[0]!), encodeCard(entry.cards[1]!)] as const,
          probability,
          cumulative,
        };
      });
    });

    const partial = coverage.some((entry) => entry.unknownCombos > 0);
    if (partial && request.partialPolicy !== 'known_only') {
      return fail('partial_range_requires_explicit_known_only', 'partial', coverage);
    }
    if (candidates.some((entries) => entries.length === 0)) {
      return fail('no_positive_known_mass', 'unavailable', coverage);
    }
    const remaining = 52 - request.deadCards.length - request.board.length - request.players.length * 2;
    const upper = candidates.reduce(
      (total, entries) => total * entries.length,
      choose(remaining, 5 - request.board.length),
    );
    return { request: deepFreeze(request), candidates, fixedSet, coverage, partial, upper };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return fail(
      msg === 'incompatible_source_semantics' ? msg : 'invalid_request',
      msg === 'incompatible_source_semantics' ? 'incomparable' : 'unavailable',
    );
  }
}

export interface WeightedEquityEstimateSuccess {
  readonly ok: true;
  readonly combinations: number;
  readonly combinationsText: string;
  readonly exactFeasible: boolean;
  readonly exactLimit: number;
  readonly conservativeUpperBound: true;
}

export function estimateWeightedEquity(
  input: unknown,
): WeightedEquityEstimateSuccess | WeightedEquityFailure {
  const prepared = prepareWeightedEquity(input);
  if (!('request' in prepared)) return prepared;
  return {
    ok: true,
    combinations: prepared.upper,
    combinationsText: String(prepared.upper),
    exactFeasible: prepared.upper <= EXACT_EQUITY_COMBINATION_LIMIT,
    exactLimit: EXACT_EQUITY_COMBINATION_LIMIT,
    conservativeUpperBound: true,
  };
}

interface RealizationCodes {
  readonly hand0: Int32Array;
  readonly hand1: Int32Array;
  readonly boardCodes: Int32Array;
  weight: number;
}

const DECK_CODES: readonly number[] = Object.freeze(HOLDEM_DECK.map(encodeCard));

function* exact(
  p: PreparedWeightedEquity,
  index: number,
  hand0: Int32Array,
  hand1: Int32Array,
  boardCodes: Int32Array,
  usedMask: Uint8Array,
  weight: number,
  reusable: RealizationCodes,
): Generator<RealizationCodes | null> {
  if (index === p.candidates.length) {
    const deck = DECK_CODES.filter((code) => !usedMask[code]);
    const fixedLen = p.request.board.length;
    for (const cards of chooseCards(deck, 5 - fixedLen)) {
      for (let b = 0; b < cards.length; b += 1) {
        boardCodes[fixedLen + b] = cards[b]!;
      }
      reusable.weight = weight;
      yield reusable;
    }
    return;
  }
  for (const entry of p.candidates[index]!) {
    const c0 = entry.cardCodes[0];
    const c1 = entry.cardCodes[1];
    if (usedMask[c0] || usedMask[c1]) {
      yield null;
      continue;
    }
    usedMask[c0] = 1;
    usedMask[c1] = 1;
    hand0[index] = c0;
    hand1[index] = c1;
    yield* exact(p, index + 1, hand0, hand1, boardCodes, usedMask, weight * entry.probability, reusable);
    usedMask[c0] = 0;
    usedMask[c1] = 0;
  }
}

function sampleEntry(
  entries: readonly CandidateEntry[],
  random: ReturnType<typeof createSeededRandom>,
): CandidateEntry {
  const draw = random.nextFloat();
  let lo = 0;
  let hi = entries.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (draw < entries[mid]!.cumulative) hi = mid;
    else lo = mid + 1;
  }
  return entries[lo]!;
}

export interface WeightedEquityProgress {
  readonly completed: number;
  readonly total: number;
  readonly attempts: number;
  readonly conservativeUpperBound: boolean;
}

export interface CalculateWeightedEquityOptions {
  readonly signal?: AbortSignalLike | null;
  readonly onProgress?: ((progress: WeightedEquityProgress) => void) | null;
  readonly batchSize?: number;
  readonly yieldControl?: () => Promise<void>;
  readonly exactLimit?: number;
}

export async function calculateWeightedEquity(
  input: unknown,
  options: CalculateWeightedEquityOptions = {},
): Promise<WeightedEquityOutcome> {
  const {
    signal = null,
    onProgress = null,
    batchSize = 250,
    yieldControl = defaultYieldControl,
    exactLimit = EXACT_EQUITY_COMBINATION_LIMIT,
  } = options;
  const p = prepareWeightedEquity(input);
  if (!('request' in p)) return p;
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    !Number.isInteger(exactLimit) ||
    exactLimit < 1 ||
    exactLimit > EXACT_EQUITY_COMBINATION_LIMIT
  ) {
    return fail('invalid_execution_options');
  }

  const p0 = p.request.players[0];
  const p1 = p.request.players[1];
  const isExactHuPreflopFastPath =
    p.request.method !== 'monte_carlo' &&
    p.request.board.length === 0 &&
    p.request.players.length === 2 &&
    p0?.kind === 'exact' &&
    p1?.kind === 'exact' &&
    p0.cards.length === 2 &&
    p1.cards.length === 2;

  if (isExactHuPreflopFastPath && p0?.kind === 'exact' && p1?.kind === 'exact') {
    const c0: readonly [string, string] = [p0.cards[0]!, p0.cards[1]!];
    const c1: readonly [string, string] = [p1.cards[0]!, p1.cards[1]!];
    if (
      c0[0] !== c1[0] &&
      c0[0] !== c1[1] &&
      c0[1] !== c1[0] &&
      c0[1] !== c1[1]
    ) {
      const solved = solveExactHeadsUpPreflop(c0, c1, p.request.deadCards);
      onProgress?.({
        completed: solved.trials,
        total: solved.trials,
        attempts: solved.trials,
        conservativeUpperBound: false,
      });
      return deepFreeze({
        schemaVersion: WEIGHTED_EQUITY_RESULT_VERSION,
        status: p.partial ? 'partial' : 'exact',
        reason: null,
        method: 'exact',
        conditionalOnKnownMass: p.partial,
        coverage: p.coverage,
        players: p.request.players.map((player, i) => {
          const sp = solved.players[i as 0 | 1];
          return {
            id: player.id,
            wins: sp.wins,
            ties: sp.ties,
            losses: sp.losses,
            totalMass: solved.trials,
            equity: sp.equity,
            winProbability: sp.winProbability,
            tieProbability: sp.tieProbability,
            margin95: 0,
            riverCategoryShares: sp.riverCategoryShares,
          };
        }),
        trials: solved.trials,
        metadata: {
          seed: p.request.seed,
          samplesRequested: p.request.samples,
          attempts: solved.trials,
          estimatedCombinationsUpperBound: p.upper,
          sampler: 'independent_weighted_tuple_rejection/v1',
          jointCompatibilityProbability: 1,
          payoff: 'equal_showdown_pot_share_no_rake_or_side_pots',
        },
        recipe: p.request,
        permissions: { strategyRecommendation: false, normative: false },
      });
    }
  }

  const method: EquityResolvedMethod =
    p.request.method === 'auto'
      ? p.upper <= exactLimit
        ? 'exact'
        : 'monte_carlo'
      : p.request.method;
  if (method === 'exact' && p.upper > exactLimit) {
    return fail('exact_limit_exceeded', 'unavailable', p.coverage);
  }

  const nPlayers = p.request.players.length;
  const hand0 = new Int32Array(nPlayers);
  const hand1 = new Int32Array(nPlayers);
  const boardCodes = new Int32Array(5);
  for (let b = 0; b < p.request.board.length; b += 1) {
    boardCodes[b] = encodeCard(p.request.board[b]!);
  }
  const usedMask = new Uint8Array(52);
  for (const card of p.request.board) usedMask[encodeCard(card)] = 1;
  for (const card of p.request.deadCards) usedMask[encodeCard(card)] = 1;

  const limit = Math.min(2_000_000, Math.max(10_000, p.request.samples * 100));
  const shares = new Float64Array(nPlayers);
  const shareSumForVar = new Float64Array(nPlayers);
  const shareSqSumForVar = new Float64Array(nPlayers);
  const wins = new Float64Array(nPlayers);
  const ties = new Float64Array(nPlayers);
  const riverCategoryMass = Array.from({ length: nPlayers }, () => new Float64Array(9));
  const playerCategoryRanks = new Uint8Array(nPlayers);
  const winnerIndexes: number[] = [];
  let mass = 0;
  let trials = 0;
  let attempts = 0;
  const useTimeSlice = !onProgress && yieldControl === defaultYieldControl;
  let lastYieldAt = Date.now();

  const scoreRealization = (weight: number) => {
    const b0 = boardCodes[0]!;
    const b1 = boardCodes[1]!;
    const b2 = boardCodes[2]!;
    const b3 = boardCodes[3]!;
    const b4 = boardCodes[4]!;
    let bestScore = -1;
    winnerIndexes.length = 0;
    for (let i = 0; i < nPlayers; i += 1) {
      const score = evaluateSevenCodesUnchecked(
        hand0[i]!,
        hand1[i]!,
        b0,
        b1,
        b2,
        b3,
        b4,
      );
      playerCategoryRanks[i] = categoryRankFromScore(score);
      if (score > bestScore) {
        bestScore = score;
        winnerIndexes.length = 0;
        winnerIndexes.push(i);
      } else if (score === bestScore) {
        winnerIndexes.push(i);
      }
    }
    const unitShare = 1 / winnerIndexes.length;
    const weightedShare = weight * unitShare;
    mass += weight;
    trials += 1;
    for (let i = 0; i < nPlayers; i += 1) {
      riverCategoryMass[i]![playerCategoryRanks[i]!]! += weight;
    }
    for (let k = 0; k < winnerIndexes.length; k += 1) {
      const idx = winnerIndexes[k]!;
      shares[idx]! += weightedShare;
      shareSumForVar[idx]! += unitShare;
      shareSqSumForVar[idx]! += unitShare * unitShare;
      if (winnerIndexes.length === 1) wins[idx]! += weight;
      else ties[idx]! += weight;
    }
  };

  try {
    if (method === 'exact') {
      const reusable: RealizationCodes = { hand0, hand1, boardCodes, weight: 1 };
      for (const realization of exact(p, 0, hand0, hand1, boardCodes, usedMask, 1, reusable)) {
        if (signal?.aborted) return fail('aborted');
        attempts += 1;
        if (realization) {
          scoreRealization(realization.weight);
        }
        if (attempts % batchSize === 0) {
          if (useTimeSlice) {
            const now = Date.now();
            if (now - lastYieldAt >= 12) {
              await yieldControl();
              lastYieldAt = Date.now();
            }
          } else {
            onProgress?.({
              completed: trials,
              total: p.upper,
              attempts,
              conservativeUpperBound: true,
            });
            await yieldControl();
          }
        }
      }
    } else {
      const random = createSeededRandom(p.request.seed);
      const fixedLen = p.request.board.length;
      const missing = 5 - fixedLen;
      const deckBuf = new Int32Array(52);
      const tupleMask = new Uint8Array(52);
      const candidates = p.candidates;

      for (let attempt = 0; attempt < limit && trials < p.request.samples; attempt += 1) {
        if (signal?.aborted) return fail('aborted');
        attempts += 1;
        tupleMask.set(usedMask);
        let collision = false;
        for (let i = 0; i < nPlayers; i += 1) {
          const entries = candidates[i]!;
          const chosen = entries.length === 1 ? entries[0]! : sampleEntry(entries, random);
          const c0 = chosen.cardCodes[0];
          const c1 = chosen.cardCodes[1];
          if (tupleMask[c0] || tupleMask[c1]) {
            collision = true;
            break;
          }
          tupleMask[c0] = 1;
          tupleMask[c1] = 1;
          hand0[i] = c0;
          hand1[i] = c1;
        }
        if (!collision) {
          let deckLen = 0;
          for (let c = 0; c < DECK_CODES.length; c += 1) {
            const code = DECK_CODES[c]!;
            if (!tupleMask[code]) {
              deckBuf[deckLen] = code;
              deckLen += 1;
            }
          }
          for (let i = 0; i < missing; i += 1) {
            const j = i + random.nextInt(deckLen - i);
            const tmp = deckBuf[i]!;
            deckBuf[i] = deckBuf[j]!;
            deckBuf[j] = tmp;
            boardCodes[fixedLen + i] = deckBuf[i]!;
          }
          scoreRealization(1);
        }
        if (attempts % batchSize === 0) {
          if (useTimeSlice) {
            const now = Date.now();
            if (now - lastYieldAt >= 12) {
              await yieldControl();
              lastYieldAt = Date.now();
            }
          } else {
            onProgress?.({
              completed: trials,
              total: p.request.samples,
              attempts,
              conservativeUpperBound: false,
            });
            await yieldControl();
          }
        }
      }
    }
    if (signal?.aborted) return fail('aborted');
    if (method === 'monte_carlo' && trials !== p.request.samples) {
      return fail('joint_sampling_limit', 'unavailable', p.coverage);
    }
    if (!(mass > 0)) return fail('no_compatible_joint_mass', 'unavailable', p.coverage);

    const remainingDeckSize =
      52 - p.request.deadCards.length - p.request.board.length - p.request.players.length * 2;
    const totalBoardDeals = choose(remainingDeckSize, 5 - p.request.board.length);

    return deepFreeze({
      schemaVersion: WEIGHTED_EQUITY_RESULT_VERSION,
      status: p.partial ? 'partial' : method === 'exact' ? 'exact' : 'estimated',
      reason: null,
      method,
      conditionalOnKnownMass: p.partial,
      coverage: p.coverage,
      players: p.request.players.map((player, i) => {
        const equity = shares[i]! / mass;
        let margin95 = 0;
        if (method === 'monte_carlo' && trials > 1) {
          const s = shareSumForVar[i]!;
          const sSq = shareSqSumForVar[i]!;
          const sampleVariance = Math.max(0, (sSq - (s * s) / trials) / (trials - 1));
          margin95 = 1.96 * Math.sqrt(sampleVariance / trials);
        }
        return {
          id: player.id,
          wins: wins[i]!,
          ties: ties[i]!,
          losses: Math.max(0, mass - wins[i]! - ties[i]!),
          totalMass: mass,
          equity,
          winProbability: wins[i]! / mass,
          tieProbability: ties[i]! / mass,
          margin95,
          riverCategoryShares: buildHandCategoryRecord(riverCategoryMass[i]!, mass),
        };
      }),
      trials,
      metadata: {
        seed: p.request.seed,
        samplesRequested: p.request.samples,
        attempts,
        estimatedCombinationsUpperBound: p.upper,
        sampler: 'independent_weighted_tuple_rejection/v1',
        jointCompatibilityProbability: method === 'exact' ? mass / totalBoardDeals : null,
        payoff: 'equal_showdown_pot_share_no_rake_or_side_pots',
      },
      recipe: p.request,
      permissions: { strategyRecommendation: false, normative: false },
    });
  } catch {
    return fail('calculation_failed');
  }
}
