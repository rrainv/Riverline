import {
  assertCardArray,
  assertUniqueKnownCards,
  CARD_RANKS,
  CARD_SUITS,
} from './cards';
import {
  buildHandCategoryRecord,
  categoryRankFromScore,
  encodeCard,
  evaluateSevenCodesUnchecked,
  type HandCategory,
} from './evaluator';
import { deepFreeze } from './freeze';
import { solveExactHeadsUpPreflop } from './preflop-exact';

export const EQUITY_REQUEST_SCHEMA_VERSION = 'equity-request/v1';
export const EQUITY_RESULT_SCHEMA_VERSION = 'equity-result/v1';
export const EQUITY_ERROR_SCHEMA_VERSION = 'equity-error/v1';
export const EQUITY_ESTIMATE_SCHEMA_VERSION = 'equity-estimate/v1';

export const EQUITY_METHODS = Object.freeze({
  AUTO: 'auto',
  EXACT: 'exact',
  MONTE_CARLO: 'monte_carlo',
} as const);

export type EquityMethodPreference = (typeof EQUITY_METHODS)[keyof typeof EQUITY_METHODS];
export type EquityResolvedMethod = 'exact' | 'monte_carlo';

export const EQUITY_ERROR_CODES = Object.freeze({
  INVALID_REQUEST: 'invalid_request',
  DUPLICATE_CARD: 'duplicate_card',
  IMPOSSIBLE_DECK: 'impossible_deck',
  EXACT_LIMIT_EXCEEDED: 'exact_limit_exceeded',
  ABORTED: 'aborted',
  INTERNAL_ERROR: 'internal_error',
} as const);

export type EquityErrorCode = (typeof EQUITY_ERROR_CODES)[keyof typeof EQUITY_ERROR_CODES];

export const DEFAULT_EQUITY_SAMPLES = 10_000;
export const DEFAULT_EQUITY_SEED = 0x6d2b79f5;
export const MIN_EQUITY_SAMPLES = 1;
export const MAX_EQUITY_SAMPLES = 1_000_000;
export const EXACT_EQUITY_COMBINATION_LIMIT = 100_000;
export const DEFAULT_EQUITY_BATCH_SIZE = 250;

const EQUITY_SHARE_UNIT_SCALE = 2520; // LCM(1..10), exact split shares for supported tables.
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const FULL_DECK: readonly string[] = Object.freeze(
  [...CARD_RANKS].flatMap((rank) => [...CARD_SUITS].map((suit) => `${rank}${suit}`)),
);
const FULL_DECK_CODES: readonly number[] = Object.freeze(FULL_DECK.map(encodeCard));

export interface AbortSignalLike {
  readonly aborted: boolean;
}

export interface AbortControllerLike {
  readonly signal: AbortSignalLike;
  abort(): void;
}

export interface EquityPlayerInput {
  readonly id: string;
  readonly cards: readonly string[] | null;
}

export interface EquityRequestInput {
  readonly schemaVersion: typeof EQUITY_REQUEST_SCHEMA_VERSION;
  readonly players: readonly EquityPlayerInput[];
  readonly board?: readonly string[];
  readonly deadCards?: readonly string[];
  readonly method?: EquityMethodPreference;
  readonly samples?: number;
  readonly seed?: number;
}

export interface NormalizedEquityRequest {
  readonly schemaVersion: typeof EQUITY_REQUEST_SCHEMA_VERSION;
  readonly players: readonly {
    readonly id: string;
    readonly cards: readonly [string, string] | null;
  }[];
  readonly board: readonly string[];
  readonly deadCards: readonly string[];
  readonly method: EquityMethodPreference;
  readonly samples: number;
  readonly seed: number;
}

export interface EquityErrorObject {
  readonly schemaVersion: typeof EQUITY_ERROR_SCHEMA_VERSION;
  readonly code: EquityErrorCode;
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface EquityFailureResult {
  readonly ok: false;
  readonly error: EquityErrorObject;
}

export interface EquityValidationSuccess {
  readonly ok: true;
  readonly request: NormalizedEquityRequest;
}

export type EquityValidationResult = EquityValidationSuccess | EquityFailureResult;

export interface EquityEstimateSuccess {
  readonly ok: true;
  readonly schemaVersion: typeof EQUITY_ESTIMATE_SCHEMA_VERSION;
  readonly combinations: number | null;
  readonly combinationsText: string;
  readonly exceedsSafeInteger: boolean;
  readonly exactLimit: number;
  readonly exactFeasible: boolean;
}

export type EquityEstimateResult = EquityEstimateSuccess | EquityFailureResult;

export interface EquityPlayerResult {
  readonly id: string;
  readonly wins: number;
  readonly ties: number;
  readonly losses: number;
  readonly equity: number;
  readonly winProbability: number;
  readonly tieProbability: number;
  readonly margin95: number;
  readonly riverCategories: Readonly<Record<HandCategory, number>>;
  readonly riverCategoryShares: Readonly<Record<HandCategory, number>>;
}

export interface EquityResult {
  readonly schemaVersion: typeof EQUITY_RESULT_SCHEMA_VERSION;
  readonly method: EquityResolvedMethod;
  readonly exact: boolean;
  readonly players: readonly EquityPlayerResult[];
  readonly trials: number;
  readonly combinationsEvaluated: number;
  readonly metadata: {
    readonly seed: number;
    readonly samplesRequested: number | null;
    readonly samplesCompleted: number | null;
    readonly unknownPlayers: number;
    readonly unknownCards: number;
    readonly boardCardsMissing: number;
    readonly estimatedCombinations: number | null;
    readonly estimatedCombinationsText: string;
    readonly exactCombinationLimit: number;
    readonly splitPotTrials: number;
    readonly durationMs: number | null;
  };
}

export type EquityOutcome = EquityResult | EquityFailureResult;

export interface EquityProgress {
  readonly completed: number;
  readonly total: number;
  readonly fraction: number;
}

export interface CalculateEquityOptions {
  readonly signal?: AbortSignalLike | null;
  readonly onProgress?: ((progress: EquityProgress) => void) | null;
  readonly batchSize?: number;
  readonly yieldControl?: () => Promise<void>;
  readonly exactLimit?: number;
}

class EquityValidationError extends Error {
  readonly code: EquityErrorCode;
  constructor(code: EquityErrorCode, message: string) {
    super(message);
    this.name = 'EquityValidationError';
    this.code = code;
  }
}

function equityError(
  code: EquityErrorCode,
  message: string,
  details: Readonly<Record<string, unknown>> = {},
): EquityErrorObject {
  return deepFreeze({
    schemaVersion: EQUITY_ERROR_SCHEMA_VERSION,
    code,
    message,
    details: { ...details },
  });
}

function failure(
  code: EquityErrorCode,
  message: string,
  details: Readonly<Record<string, unknown>> = {},
): EquityFailureResult {
  return deepFreeze({ ok: false, error: equityError(code, message, details) });
}

export function createEquityFailure(
  code: EquityErrorCode,
  message: string,
  details: Readonly<Record<string, unknown>> = {},
): EquityFailureResult {
  if (!Object.values(EQUITY_ERROR_CODES).includes(code)) {
    throw new RangeError(`Unsupported equity error code: ${String(code)}`);
  }
  return failure(code, message, details);
}

function requirePlainObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function normalizeSeed(value: unknown): number {
  const seed = value ?? DEFAULT_EQUITY_SEED;
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('seed must be an unsigned 32-bit integer');
  }
  return seed >>> 0;
}

function normalizeSamples(value: unknown): number {
  const samples = value ?? DEFAULT_EQUITY_SAMPLES;
  if (
    typeof samples !== 'number' ||
    !Number.isInteger(samples) ||
    samples < MIN_EQUITY_SAMPLES ||
    samples > MAX_EQUITY_SAMPLES
  ) {
    throw new RangeError(
      `samples must be an integer from ${MIN_EQUITY_SAMPLES} through ${MAX_EQUITY_SAMPLES}`,
    );
  }
  return samples;
}

function normalizeRequest(input: unknown): NormalizedEquityRequest {
  const obj = requirePlainObject(input, 'EquityRequest');
  if (obj.schemaVersion !== EQUITY_REQUEST_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${EQUITY_REQUEST_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(obj.players) || obj.players.length < 2 || obj.players.length > 10) {
    throw new RangeError('players must contain 2 through 10 entries');
  }

  const ids = new Set<string>();
  const players = obj.players.map((rawPlayer, index) => {
    const player = requirePlainObject(rawPlayer, `players[${index}]`);
    if (typeof player.id !== 'string' || !player.id.trim()) {
      throw new TypeError(`players[${index}].id must be a non-empty string`);
    }
    if (ids.has(player.id)) throw new RangeError(`Duplicate player id: ${player.id}`);
    ids.add(player.id);

    if (player.cards === null) return { id: player.id, cards: null };
    const cards = assertCardArray(player.cards, `players[${index}].cards`);
    if (cards.length !== 2) {
      throw new RangeError(`players[${index}].cards must be null or contain exactly two cards`);
    }
    return { id: player.id, cards: [cards[0]!, cards[1]!] as readonly [string, string] };
  });

  const board = assertCardArray([...((obj.board as readonly unknown[] | undefined) ?? [])], 'board');
  const deadCards = assertCardArray(
    [...((obj.deadCards as readonly unknown[] | undefined) ?? [])],
    'deadCards',
  );
  if (board.length > 5) throw new RangeError('board cannot contain more than five cards');

  const method = (obj.method ?? EQUITY_METHODS.AUTO) as EquityMethodPreference;
  if (!Object.values(EQUITY_METHODS).includes(method)) {
    throw new RangeError('method must be auto, exact, or monte_carlo');
  }

  const normalized: NormalizedEquityRequest = {
    schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
    players,
    board,
    deadCards,
    method,
    samples: normalizeSamples(obj.samples),
    seed: normalizeSeed(obj.seed),
  };

  try {
    assertUniqueKnownCards([
      ...players
        .filter((player): player is { id: string; cards: readonly [string, string] } => player.cards !== null)
        .map((player) => ({ label: `players.${player.id}.cards`, cards: player.cards })),
      { label: 'board', cards: board },
      { label: 'deadCards', cards: deadCards },
    ]);
  } catch (error) {
    throw new EquityValidationError(
      EQUITY_ERROR_CODES.DUPLICATE_CARD,
      error instanceof Error ? error.message : String(error),
    );
  }

  const knownCardCount = players.reduce(
    (sum, player) => sum + (player.cards === null ? 0 : 2),
    board.length + deadCards.length,
  );
  const unknownCardCount = players.filter((player) => player.cards === null).length * 2;
  const boardCardsMissing = 5 - board.length;
  if (knownCardCount + unknownCardCount + boardCardsMissing > 52) {
    throw new EquityValidationError(
      EQUITY_ERROR_CODES.IMPOSSIBLE_DECK,
      'Known, unknown, board, and dead cards cannot fit in one deck',
    );
  }

  return deepFreeze(normalized);
}

export function validateEquityRequest(input: unknown): EquityValidationResult {
  try {
    return deepFreeze({ ok: true, request: normalizeRequest(input) });
  } catch (error) {
    if (error instanceof EquityValidationError) {
      return failure(error.code, error.message);
    }
    return failure(
      EQUITY_ERROR_CODES.INVALID_REQUEST,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function chooseBigInt(total: number, count: number): bigint {
  if (!Number.isInteger(total) || !Number.isInteger(count) || count < 0 || count > total) return 0n;
  const reducedCount = Math.min(count, total - count);
  let result = 1n;
  for (let index = 1; index <= reducedCount; index += 1) {
    result = (result * BigInt(total - reducedCount + index)) / BigInt(index);
  }
  return result;
}

function estimateNormalizedRequest(request: NormalizedEquityRequest): bigint {
  const knownCards = request.players.flatMap((player) => player.cards ?? [])
    .concat(request.board, request.deadCards);
  let availableCards = 52 - knownCards.length;
  let combinations = 1n;
  for (const player of request.players) {
    if (player.cards !== null) continue;
    combinations *= chooseBigInt(availableCards, 2);
    availableCards -= 2;
  }
  combinations *= chooseBigInt(availableCards, 5 - request.board.length);
  return combinations;
}

function estimateResult(
  combinations: bigint,
  exactLimit = EXACT_EQUITY_COMBINATION_LIMIT,
): EquityEstimateSuccess {
  return deepFreeze({
    ok: true,
    schemaVersion: EQUITY_ESTIMATE_SCHEMA_VERSION,
    combinations: combinations <= MAX_SAFE_BIGINT ? Number(combinations) : null,
    combinationsText: combinations.toString(),
    exceedsSafeInteger: combinations > MAX_SAFE_BIGINT,
    exactLimit,
    exactFeasible: combinations <= BigInt(exactLimit),
  });
}

export function estimateEquityCombinations(
  input: unknown,
  options: { readonly exactLimit?: number } = {},
): EquityEstimateResult {
  const exactLimit = options.exactLimit ?? EXACT_EQUITY_COMBINATION_LIMIT;
  if (!Number.isInteger(exactLimit) || exactLimit < 1) {
    return failure(EQUITY_ERROR_CODES.INVALID_REQUEST, 'exactLimit must be a positive integer');
  }
  const validation = validateEquityRequest(input);
  if (!validation.ok) return validation;
  return estimateResult(estimateNormalizedRequest(validation.request), exactLimit);
}

function remainingDeckCodes(request: NormalizedEquityRequest): number[] {
  const excluded = new Set<number>();
  for (const player of request.players) {
    if (player.cards) {
      excluded.add(encodeCard(player.cards[0]));
      excluded.add(encodeCard(player.cards[1]));
    }
  }
  for (const card of request.board) excluded.add(encodeCard(card));
  for (const card of request.deadCards) excluded.add(encodeCard(card));
  return FULL_DECK_CODES.filter((code) => !excluded.has(code));
}

export function* chooseCards<T>(
  cards: readonly T[],
  count: number,
  start = 0,
  chosen: T[] = [],
): Generator<T[]> {
  if (chosen.length === count) {
    yield [...chosen];
    return;
  }
  const cardsStillNeeded = count - chosen.length;
  for (let index = start; index <= cards.length - cardsStillNeeded; index += 1) {
    chosen.push(cards[index]!);
    yield* chooseCards(cards, count, index + 1, chosen);
    chosen.pop();
  }
}

export interface SeededRandom {
  nextInt(upperExclusive: number): number;
  nextFloat(): number;
}

export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };
  const nextInt = (upperExclusive: number): number => {
    const range = 0x100000000;
    const limit = Math.floor(range / upperExclusive) * upperExclusive;
    let value: number;
    do value = nextUint32(); while (value >= limit);
    return value % upperExclusive;
  };
  return Object.freeze({ nextInt, nextFloat: () => nextUint32() / 0x100000000 });
}

interface CodeAccumulator {
  readonly playerCount: number;
  readonly wins: Int32Array;
  readonly ties: Int32Array;
  readonly riverCategories: readonly Int32Array[];
  readonly equityShareUnits: Float64Array;
  readonly equityShareUnitsSq: Float64Array;
  readonly scores: Float64Array;
  readonly winnerIndexes: number[];
  trials: number;
  splitPotTrials: number;
}

function createCodeAccumulator(playerCount: number): CodeAccumulator {
  return {
    playerCount,
    wins: new Int32Array(playerCount),
    ties: new Int32Array(playerCount),
    riverCategories: Array.from({ length: playerCount }, () => new Int32Array(9)),
    equityShareUnits: new Float64Array(playerCount),
    equityShareUnitsSq: new Float64Array(playerCount),
    scores: new Float64Array(playerCount),
    winnerIndexes: [],
    trials: 0,
    splitPotTrials: 0,
  };
}

function recordEncodedHandsAndBoard(
  accumulator: CodeAccumulator,
  hand0: Int32Array,
  hand1: Int32Array,
  b0: number,
  b1: number,
  b2: number,
  b3: number,
  b4: number,
): void {
  const { playerCount, scores, winnerIndexes, riverCategories } = accumulator;
  let bestScore = -1;
  winnerIndexes.length = 0;
  for (let i = 0; i < playerCount; i += 1) {
    const score = evaluateSevenCodesUnchecked(
      hand0[i]!,
      hand1[i]!,
      b0,
      b1,
      b2,
      b3,
      b4,
    );
    scores[i] = score;
    riverCategories[i]![categoryRankFromScore(score)]! += 1;
    if (score > bestScore) {
      bestScore = score;
      winnerIndexes.length = 0;
      winnerIndexes.push(i);
    } else if (score === bestScore) {
      winnerIndexes.push(i);
    }
  }

  const winCount = winnerIndexes.length;
  if (winCount === 1) {
    accumulator.wins[winnerIndexes[0]!]! += 1;
  } else {
    accumulator.splitPotTrials += 1;
    for (let k = 0; k < winCount; k += 1) {
      accumulator.ties[winnerIndexes[k]!]! += 1;
    }
  }
  const shareUnits = EQUITY_SHARE_UNIT_SCALE / winCount;
  const shareUnitsSq = shareUnits * shareUnits;
  for (let k = 0; k < winCount; k += 1) {
    const idx = winnerIndexes[k]!;
    accumulator.equityShareUnits[idx]! += shareUnits;
    accumulator.equityShareUnitsSq[idx]! += shareUnitsSq;
  }
  accumulator.trials += 1;
}

export function equityWinnerIndexes(realization: {
  readonly hands: readonly (readonly string[])[];
  readonly board: readonly string[];
}): number[] {
  const b0 = encodeCard(realization.board[0]!);
  const b1 = encodeCard(realization.board[1]!);
  const b2 = encodeCard(realization.board[2]!);
  const b3 = encodeCard(realization.board[3]!);
  const b4 = encodeCard(realization.board[4]!);
  let bestScore = -1;
  const winners: number[] = [];
  for (let i = 0; i < realization.hands.length; i += 1) {
    const hand = realization.hands[i]!;
    const score = evaluateSevenCodesUnchecked(
      encodeCard(hand[0]!),
      encodeCard(hand[1]!),
      b0,
      b1,
      b2,
      b3,
      b4,
    );
    if (score > bestScore) {
      bestScore = score;
      winners.length = 0;
      winners.push(i);
    } else if (score === bestScore) {
      winners.push(i);
    }
  }
  return winners;
}

function buildResult(
  request: NormalizedEquityRequest,
  method: EquityResolvedMethod,
  estimate: EquityEstimateSuccess,
  accumulator: CodeAccumulator,
  exactCombinationLimit: number,
): EquityResult {
  const trials = accumulator.trials;
  const players: EquityPlayerResult[] = request.players.map((player, index) => {
    const sumU = accumulator.equityShareUnits[index]!;
    const sumSqU = accumulator.equityShareUnitsSq[index]!;
    const equity = sumU / (trials * EQUITY_SHARE_UNIT_SCALE);
    let margin95 = 0;
    if (method === EQUITY_METHODS.MONTE_CARLO && trials > 1) {
      const unitVarScale = EQUITY_SHARE_UNIT_SCALE * EQUITY_SHARE_UNIT_SCALE;
      const ss = (sumSqU - (sumU * sumU) / trials) / unitVarScale;
      const sampleVariance = Math.max(0, ss / (trials - 1));
      margin95 = 1.96 * Math.sqrt(sampleVariance / trials);
    }
    const wins = accumulator.wins[index]!;
    const ties = accumulator.ties[index]!;
    const categoryTallies = accumulator.riverCategories[index]!;
    return {
      id: player.id,
      wins,
      ties,
      losses: trials - wins - ties,
      equity,
      winProbability: wins / trials,
      tieProbability: ties / trials,
      margin95,
      riverCategories: buildHandCategoryRecord(categoryTallies, 1),
      riverCategoryShares: buildHandCategoryRecord(categoryTallies, trials),
    };
  });

  return deepFreeze({
    schemaVersion: EQUITY_RESULT_SCHEMA_VERSION,
    method,
    exact: method === EQUITY_METHODS.EXACT,
    players,
    trials,
    combinationsEvaluated: trials,
    metadata: {
      seed: request.seed,
      samplesRequested: method === EQUITY_METHODS.MONTE_CARLO ? request.samples : null,
      samplesCompleted: method === EQUITY_METHODS.MONTE_CARLO ? trials : null,
      unknownPlayers: request.players.filter((player) => player.cards === null).length,
      unknownCards: request.players.filter((player) => player.cards === null).length * 2,
      boardCardsMissing: 5 - request.board.length,
      estimatedCombinations: estimate.combinations,
      estimatedCombinationsText: estimate.combinationsText,
      exactCombinationLimit,
      splitPotTrials: accumulator.splitPotTrials,
      durationMs: null,
    },
  });
}

function canUseExactHeadsUpPreflopFastPath(request: NormalizedEquityRequest): boolean {
  return (
    request.board.length === 0 &&
    request.players.length === 2 &&
    request.players[0]!.cards !== null &&
    request.players[1]!.cards !== null
  );
}

function buildExactHeadsUpPreflopResult(
  request: NormalizedEquityRequest,
  estimate: EquityEstimateSuccess,
  exactLimit: number,
): EquityResult {
  const solved = solveExactHeadsUpPreflop(
    request.players[0]!.cards!,
    request.players[1]!.cards!,
    request.deadCards,
  );
  return deepFreeze({
    schemaVersion: EQUITY_RESULT_SCHEMA_VERSION,
    method: EQUITY_METHODS.EXACT,
    exact: true,
    players: request.players.map((player, idx) => {
      const p = solved.players[idx as 0 | 1];
      return {
        id: player.id,
        wins: p.wins,
        ties: p.ties,
        losses: p.losses,
        equity: p.equity,
        winProbability: p.winProbability,
        tieProbability: p.tieProbability,
        margin95: 0,
        riverCategories: p.riverCategories,
        riverCategoryShares: p.riverCategoryShares,
      };
    }),
    trials: solved.trials,
    combinationsEvaluated: solved.trials,
    metadata: {
      seed: request.seed,
      samplesRequested: null,
      samplesCompleted: null,
      unknownPlayers: 0,
      unknownCards: 0,
      boardCardsMissing: 5,
      estimatedCombinations: estimate.combinations,
      estimatedCombinationsText: estimate.combinationsText,
      exactCombinationLimit: exactLimit,
      splitPotTrials: solved.players[0].ties,
      durationMs: null,
    },
  });
}

function actualMethod(
  request: NormalizedEquityRequest,
  estimate: EquityEstimateSuccess,
): EquityResolvedMethod {
  const fullyKnownRiver =
    request.board.length === 5 && request.players.every((player) => player.cards !== null);
  if (fullyKnownRiver) return EQUITY_METHODS.EXACT;
  if (request.method !== EQUITY_METHODS.MONTE_CARLO && canUseExactHeadsUpPreflopFastPath(request)) {
    return EQUITY_METHODS.EXACT;
  }
  if (request.method === EQUITY_METHODS.AUTO) {
    return estimate.exactFeasible ? EQUITY_METHODS.EXACT : EQUITY_METHODS.MONTE_CARLO;
  }
  return request.method;
}

interface PreparedCalculation {
  readonly ok: true;
  readonly request: NormalizedEquityRequest;
  readonly estimate: EquityEstimateSuccess;
  readonly method: EquityResolvedMethod;
  readonly exactLimit: number;
}

function prepareCalculation(
  input: unknown,
  forcedMethod: EquityMethodPreference | null = null,
  exactLimit = EXACT_EQUITY_COMBINATION_LIMIT,
): PreparedCalculation | EquityFailureResult {
  if (!Number.isInteger(exactLimit) || exactLimit < 1) {
    return failure(EQUITY_ERROR_CODES.INVALID_REQUEST, 'exactLimit must be a positive integer');
  }
  const validation = validateEquityRequest(input);
  if (!validation.ok) return validation;
  const request =
    forcedMethod === null
      ? validation.request
      : deepFreeze({ ...validation.request, method: forcedMethod });
  const estimate = estimateResult(estimateNormalizedRequest(request), exactLimit);
  const method = actualMethod(request, estimate);
  if (
    method === EQUITY_METHODS.EXACT &&
    !estimate.exactFeasible &&
    !canUseExactHeadsUpPreflopFastPath(request)
  ) {
    return failure(
      EQUITY_ERROR_CODES.EXACT_LIMIT_EXCEEDED,
      `Exact enumeration requires ${estimate.combinationsText} realizations, above the ${exactLimit} limit`,
      {
        estimatedCombinations: estimate.combinations,
        estimatedCombinationsText: estimate.combinationsText,
        exactCombinationLimit: exactLimit,
      },
    );
  }
  return { ok: true, request, estimate, method, exactLimit };
}

function* exactCodeRealizations(
  request: NormalizedEquityRequest,
  hand0: Int32Array,
  hand1: Int32Array,
  boardCodes: Int32Array,
): Generator<void> {
  const deck = remainingDeckCodes(request);
  const n = deck.length;
  const used = new Uint8Array(n);
  const unknownIndexes: number[] = [];
  for (let i = 0; i < request.players.length; i += 1) {
    const cards = request.players[i]!.cards;
    if (cards === null) {
      unknownIndexes.push(i);
    } else {
      hand0[i] = encodeCard(cards[0]);
      hand1[i] = encodeCard(cards[1]);
    }
  }
  const fixedLen = request.board.length;
  for (let i = 0; i < fixedLen; i += 1) {
    boardCodes[i] = encodeCard(request.board[i]!);
  }
  const missingBoard = 5 - fixedLen;

  function* dealBoard(depth: number, startIdx: number): Generator<void> {
    if (depth === missingBoard) {
      yield;
      return;
    }
    const maxIdx = n - (missingBoard - depth);
    for (let idx = startIdx; idx <= maxIdx; idx += 1) {
      if (used[idx]) continue;
      used[idx] = 1;
      boardCodes[fixedLen + depth] = deck[idx]!;
      yield* dealBoard(depth + 1, idx + 1);
      used[idx] = 0;
    }
  }

  function* assignUnknown(offset: number): Generator<void> {
    if (offset === unknownIndexes.length) {
      yield* dealBoard(0, 0);
      return;
    }
    const pIdx = unknownIndexes[offset]!;
    for (let i = 0; i < n - 1; i += 1) {
      if (used[i]) continue;
      used[i] = 1;
      hand0[pIdx] = deck[i]!;
      for (let j = i + 1; j < n; j += 1) {
        if (used[j]) continue;
        used[j] = 1;
        hand1[pIdx] = deck[j]!;
        yield* assignUnknown(offset + 1);
        used[j] = 0;
      }
      used[i] = 0;
    }
  }

  yield* assignUnknown(0);
}

function* monteCarloCodeRealizations(
  request: NormalizedEquityRequest,
  hand0: Int32Array,
  hand1: Int32Array,
  boardCodes: Int32Array,
): Generator<void> {
  const baseDeck = remainingDeckCodes(request);
  const sampledDeck = new Int32Array(baseDeck);
  const deckLen = sampledDeck.length;
  const unknownIndexes: number[] = [];
  for (let i = 0; i < request.players.length; i += 1) {
    const cards = request.players[i]!.cards;
    if (cards === null) {
      unknownIndexes.push(i);
    } else {
      hand0[i] = encodeCard(cards[0]);
      hand1[i] = encodeCard(cards[1]);
    }
  }
  const fixedLen = request.board.length;
  for (let i = 0; i < fixedLen; i += 1) {
    boardCodes[i] = encodeCard(request.board[i]!);
  }
  const missingBoard = 5 - fixedLen;
  const needed = unknownIndexes.length * 2 + missingBoard;
  const random = createSeededRandom(request.seed);

  for (let trial = 0; trial < request.samples; trial += 1) {
    for (let i = 0; i < needed; i += 1) {
      const selected = i + random.nextInt(deckLen - i);
      const tmp = sampledDeck[i]!;
      sampledDeck[i] = sampledDeck[selected]!;
      sampledDeck[selected] = tmp;
    }
    let offset = 0;
    for (let u = 0; u < unknownIndexes.length; u += 1) {
      const pIdx = unknownIndexes[u]!;
      hand0[pIdx] = sampledDeck[offset]!;
      hand1[pIdx] = sampledDeck[offset + 1]!;
      offset += 2;
    }
    for (let b = 0; b < missingBoard; b += 1) {
      boardCodes[fixedLen + b] = sampledDeck[offset + b]!;
    }
    yield;
  }
}

function executeSync(prepared: PreparedCalculation): EquityResult {
  if (
    prepared.method === EQUITY_METHODS.EXACT &&
    canUseExactHeadsUpPreflopFastPath(prepared.request)
  ) {
    return buildExactHeadsUpPreflopResult(
      prepared.request,
      prepared.estimate,
      prepared.exactLimit,
    );
  }
  const nPlayers = prepared.request.players.length;
  const accumulator = createCodeAccumulator(nPlayers);
  const hand0 = new Int32Array(nPlayers);
  const hand1 = new Int32Array(nPlayers);
  const boardCodes = new Int32Array(5);
  const realizations =
    prepared.method === EQUITY_METHODS.EXACT
      ? exactCodeRealizations(prepared.request, hand0, hand1, boardCodes)
      : monteCarloCodeRealizations(prepared.request, hand0, hand1, boardCodes);

  for (const _ of realizations) {
    void _;
    recordEncodedHandsAndBoard(
      accumulator,
      hand0,
      hand1,
      boardCodes[0]!,
      boardCodes[1]!,
      boardCodes[2]!,
      boardCodes[3]!,
      boardCodes[4]!,
    );
  }
  return buildResult(
    prepared.request,
    prepared.method,
    prepared.estimate,
    accumulator,
    prepared.exactLimit,
  );
}

export function calculateEquityExact(
  input: unknown,
  options: { readonly exactLimit?: number } = {},
): EquityOutcome {
  const prepared = prepareCalculation(
    input,
    EQUITY_METHODS.EXACT,
    options.exactLimit ?? EXACT_EQUITY_COMBINATION_LIMIT,
  );
  if (!prepared.ok) return prepared;
  return executeSync(prepared);
}

export function calculateEquityMonteCarlo(input: unknown): EquityOutcome {
  const prepared = prepareCalculation(input, EQUITY_METHODS.MONTE_CARLO);
  if (!prepared.ok) return prepared;
  return executeSync(prepared);
}

function progressSnapshot(completed: number, total: number): EquityProgress {
  return deepFreeze({ completed, total, fraction: total === 0 ? 1 : completed / total });
}

function reportProgress(
  callback: ((progress: EquityProgress) => void) | null | undefined,
  completed: number,
  total: number,
): void {
  if (typeof callback === 'function') callback(progressSnapshot(completed, total));
}

interface GlobalTimerLike {
  setTimeout?: (handler: () => void, timeoutMs?: number) => unknown;
}

export function defaultYieldControl(): Promise<void> {
  const timer = (globalThis as GlobalTimerLike).setTimeout;
  if (typeof timer === 'function') {
    return new Promise<void>((resolve) => {
      timer(resolve, 0);
    });
  }
  return Promise.resolve();
}

export async function calculateEquity(
  input: unknown,
  options: CalculateEquityOptions = {},
): Promise<EquityOutcome> {
  const {
    signal = null,
    onProgress = null,
    batchSize = DEFAULT_EQUITY_BATCH_SIZE,
    yieldControl = defaultYieldControl,
    exactLimit = EXACT_EQUITY_COMBINATION_LIMIT,
  } = options;
  const prepared = prepareCalculation(input, null, exactLimit);
  if (!prepared.ok) return prepared;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    return failure(EQUITY_ERROR_CODES.INVALID_REQUEST, 'batchSize must be a positive integer');
  }

  if (
    prepared.method === EQUITY_METHODS.EXACT &&
    canUseExactHeadsUpPreflopFastPath(prepared.request)
  ) {
    const exactResult = buildExactHeadsUpPreflopResult(
      prepared.request,
      prepared.estimate,
      prepared.exactLimit,
    );
    reportProgress(onProgress, exactResult.trials, exactResult.trials);
    return exactResult;
  }

  const total =
    prepared.method === EQUITY_METHODS.EXACT
      ? prepared.estimate.combinations ?? 0
      : prepared.request.samples;
  const nPlayers = prepared.request.players.length;
  const accumulator = createCodeAccumulator(nPlayers);
  const hand0 = new Int32Array(nPlayers);
  const hand1 = new Int32Array(nPlayers);
  const boardCodes = new Int32Array(5);
  const realizations =
    prepared.method === EQUITY_METHODS.EXACT
      ? exactCodeRealizations(prepared.request, hand0, hand1, boardCodes)
      : monteCarloCodeRealizations(prepared.request, hand0, hand1, boardCodes);

  const useTimeSlice = !onProgress && yieldControl === defaultYieldControl;
  let lastYieldAt = Date.now();

  reportProgress(onProgress, 0, total);
  try {
    for (const _ of realizations) {
      void _;
      if (signal?.aborted) {
        return failure(EQUITY_ERROR_CODES.ABORTED, 'Equity calculation was cancelled', {
          completed: accumulator.trials,
          total,
          method: prepared.method,
        });
      }
      recordEncodedHandsAndBoard(
        accumulator,
        hand0,
        hand1,
        boardCodes[0]!,
        boardCodes[1]!,
        boardCodes[2]!,
        boardCodes[3]!,
        boardCodes[4]!,
      );
      if (accumulator.trials % batchSize === 0 && accumulator.trials < total) {
        if (useTimeSlice) {
          const now = Date.now();
          if (now - lastYieldAt >= 12) {
            await yieldControl();
            lastYieldAt = Date.now();
          }
        } else {
          reportProgress(onProgress, accumulator.trials, total);
          await yieldControl();
        }
      }
    }
    reportProgress(onProgress, accumulator.trials, total);
    return buildResult(
      prepared.request,
      prepared.method,
      prepared.estimate,
      accumulator,
      prepared.exactLimit,
    );
  } catch (error) {
    return failure(
      EQUITY_ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : String(error),
    );
  }
}
