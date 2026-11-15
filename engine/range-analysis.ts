import {
  assertCardArray,
  assertUniqueKnownCards,
  CARD_RANKS,
} from './cards';
import {
  evaluateFive,
  evaluateSeven,
  HAND_CATEGORIES,
  type HandCategory,
} from './evaluator';
import { cloneData, deepFreeze } from './freeze';
import { preflopHandClassForCards, PREFLOP_HAND_CLASSES } from './hand-class';
import { getHoldemComboById, HOLDEM_DECK } from './holdem-combos';
import {
  conditionHoldemRange,
  HOLDEM_RANGE_ENTRY_STATES,
  type HoldemConditionedRange,
  type HoldemRangeEntry,
  type HoldemRangeInspection,
  type HoldemWeightedRange,
  inspectHoldemWeightedRange,
  validateHoldemWeightedRange,
} from './holdem-range';
import type { PokerHandRank } from './schema';

export const RANGE_ANALYSIS_REQUEST_SCHEMA_VERSION = 'range-analysis-request/v1';
export const RANGE_ANALYSIS_FACTS_SCHEMA_VERSION = 'range-analysis-facts/v1';

const DECISION_CONTEXT_SCHEMA_VERSION = 'decision-context/v1';
const RANGE_ROLES = Object.freeze(['hero', 'opponent'] as const);
type RangeRole = (typeof RANGE_ROLES)[number];

const RANK_VALUE: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries([...CARD_RANKS].map((rank, index) => [rank, index + 2])),
);
const RANK_SYMBOL: Readonly<Record<number, string>> = Object.freeze(
  Object.fromEntries(Object.entries(RANK_VALUE).map(([rank, value]) => [value, rank])),
);
const STRAIGHT_WINDOWS: readonly (readonly number[])[] = Object.freeze([
  Object.freeze([14, 2, 3, 4, 5]),
  ...Array.from({ length: 9 }, (_, index) =>
    Object.freeze(Array.from({ length: 5 }, (__, offset) => index + 2 + offset)),
  ),
]);
const PRIMARY_CATEGORIES: readonly HandCategory[] = Object.freeze(Object.values(HAND_CATEGORIES));
const RELATIONSHIP_TAGS = Object.freeze([
  'board_pair',
  'overpair',
  'pocket_pair',
  'top_pair',
  'middle_pair',
  'lower_pair',
  'two_pair',
  'board_two_pair',
  'set',
  'trips',
  'board_trips',
  'plays_board',
] as const);
const DRAW_TAGS = Object.freeze([
  'flush_draw',
  'nut_flush_draw',
  'straight_flush_draw',
  'royal_flush_draw',
  'wheel_straight_flush_draw',
  'gutshot_straight_flush_draw',
  'open_ended_straight_flush_draw',
  'double_gutshot_straight_flush_draw',
  'open_ended_straight_draw',
  'gutshot',
  'double_gutshot',
  'overcards',
  'made_hand_and_draw',
] as const);

export interface AnalysisSourceMetadata {
  readonly kind: string;
  readonly label: string;
  readonly sourceId: string | null;
  readonly sourceSchemaVersion: string | null;
}

export interface RangeAnalysisRangeInputRecord {
  readonly key: string;
  readonly role: RangeRole;
  readonly subjectId: string;
  readonly label: string;
  readonly range: HoldemWeightedRange;
  readonly source: AnalysisSourceMetadata;
}

export interface RangeAnalysisRequest {
  readonly schemaVersion: typeof RANGE_ANALYSIS_REQUEST_SCHEMA_VERSION;
  readonly heroCards: readonly string[];
  readonly board: readonly string[];
  readonly deadCards: readonly string[];
  readonly decisionContext: Readonly<Record<string, unknown>> | null;
  readonly ranges: Readonly<Record<string, RangeAnalysisRangeInputRecord>>;
  readonly provenance: {
    readonly exactHand: AnalysisSourceMetadata;
    readonly board: AnalysisSourceMetadata;
    readonly deadCards: AnalysisSourceMetadata;
  };
}

export interface BoardStructureFacts {
  readonly available: boolean;
  readonly cardCount: number;
  readonly paired: boolean | null;
  readonly doublePaired: boolean | null;
  readonly tripled: boolean | null;
  readonly quads: boolean | null;
  readonly monotone: boolean | null;
  readonly twoTone: boolean | null;
  readonly rainbow: boolean | null;
  readonly suitTexture: 'monotone' | 'two_tone' | 'rainbow' | 'multi_suit' | null;
  readonly flushDrawPossible: boolean | null;
  readonly flushCompletionState: 'board_flush' | 'four_flush' | 'three_flush' | 'none' | null;
  readonly connectivity: 'connected' | 'coordinated' | 'disconnected' | null;
  readonly connected: boolean | null;
  readonly longestConnectedRun: number | null;
  readonly maximumRanksInStraightWindow: number | null;
  readonly straightCompletedOnBoard: boolean | null;
  readonly straightCompletionRanks: readonly number[];
  readonly broadwayCount: number | null;
  readonly highestRank: number | null;
  readonly highCardStructure: 'ace_high' | 'high' | 'low' | 'middle' | null;
}

export interface StraightFlushCompletion {
  readonly card: string;
  readonly subtype: string | null;
}

export interface DrawOutsFacts {
  readonly available: boolean;
  readonly street: 'preflop' | 'flop' | 'turn' | 'river' | null;
  readonly semantics: 'structural_direct_improvement_cards';
  readonly flush: {
    readonly available: boolean;
    readonly completionCards: readonly string[];
    readonly count: number;
  };
  readonly straight: {
    readonly available: boolean;
    readonly subtype: string | null;
    readonly completionRanks: readonly number[];
    readonly completionCards: readonly string[];
    readonly count: number;
  };
  readonly straightFlush: {
    readonly available: boolean;
    readonly subtype: string | null;
    readonly completionSubtype: string | null;
    readonly royalFlushDraw: boolean;
    readonly wheelStraightFlushDraw: boolean;
    readonly completionCards: readonly string[];
    readonly completionResults: readonly StraightFlushCompletion[];
    readonly count: number;
  };
  readonly overlaps: readonly { readonly card: string; readonly families: readonly string[] }[];
  readonly uniqueCompletionCards: readonly string[];
  readonly uniqueCompletionCardCount: number;
  readonly equityCalculated: false;
}

export interface ExactHandDrawFacts {
  readonly available: boolean;
  readonly street: 'preflop' | 'flop' | 'turn' | 'river' | null;
  readonly flushDraw: boolean;
  readonly flushDrawSuit: string | null;
  readonly nutFlushDraw: boolean;
  readonly straightFlushDraw: boolean;
  readonly royalFlushDraw: boolean;
  readonly wheelStraightFlushDraw: boolean;
  readonly straightFlushDrawSubtype: string | null;
  readonly straightFlushCompletionSubtype: string | null;
  readonly straightFlushDrawType: string | null;
  readonly straightFlushCompletions: readonly StraightFlushCompletion[];
  readonly straightFlushOutCards: readonly string[];
  readonly straightFlushOutCount: number;
  readonly flushCompletionCards: readonly string[];
  readonly straightCompletionCards: readonly string[];
  readonly overlappingCompletionCards: readonly string[];
  readonly openEndedStraightDraw: boolean;
  readonly gutshot: boolean;
  readonly doubleGutshot: boolean;
  readonly straightOutRanks: readonly number[];
  readonly straightOutRankSymbols?: readonly string[];
  readonly overcardCount: number;
  readonly overcardRanks: readonly number[];
  readonly overcardRankSymbols?: readonly string[];
  readonly madeHandAndDraw: boolean;
  readonly drawOuts: DrawOutsFacts;
  readonly tags: readonly string[];
}

export interface ExactHandFacts {
  readonly available: boolean;
  readonly street: 'preflop' | 'flop' | 'turn' | 'river' | null;
  readonly heroCards: readonly string[];
  readonly preflopHandClass: string | null;
  readonly preflopKind?: 'pair' | 'suited' | 'offsuit';
  readonly primaryCategory: HandCategory | null;
  readonly madeHandSubtype: string | null;
  readonly relationship: string | null;
  readonly canonicalRank: PokerHandRank | null;
  readonly usesHeroCards: boolean | null;
  readonly playsBoard: boolean | null;
  readonly components: readonly string[];
  readonly draws: ExactHandDrawFacts;
  readonly drawOuts: DrawOutsFacts;
}

export interface RangeCompositionMetric {
  knownComboCount: number;
  positiveWeightComboCount: number;
  knownComboMass: number;
  normalizedShare: number | null;
}

export interface SingleRangeAnalysisFacts {
  readonly schemaVersion: 'range-analysis-range-facts/v1';
  readonly key: string;
  readonly role: RangeRole;
  readonly subjectId: string;
  readonly label: string;
  readonly source: AnalysisSourceMetadata;
  readonly rangeProvenance: HoldemWeightedRange['provenance'];
  readonly sourceRangeId: string | null;
  readonly sourceRangeSchemaVersion: string;
  readonly inspection: HoldemRangeInspection;
  readonly eligibility: {
    readonly blockers: readonly string[];
    readonly eligibleComboCount: number;
    readonly knownEligibleComboCount: number;
    readonly unknownEligibleComboCount: number;
    readonly eligibleCoverageRatio: number;
    readonly knownEligibleComboMass: number;
    readonly completeAfterConditioning: boolean;
  };
  readonly normalization: {
    readonly available: boolean;
    readonly denominatorKnownComboMass: number | null;
    readonly unavailableReason: string | null;
  };
  readonly blockers: {
    readonly blockers: readonly string[];
    readonly boardAndDeadRemovedComboCount: number;
    readonly boardAndDeadRemovedKnownComboMass: number;
    readonly heroConditioningApplied: boolean;
    readonly physicalEligibleComboCountBeforeHero: number;
    readonly physicalEligibleComboCountAfterHero: number;
    readonly heroRemovedComboCount: number;
    readonly heroRemovedKnownComboCount: number;
    readonly heroRemovedKnownComboMass: number;
    readonly perHeroCard: readonly {
      readonly card: string;
      readonly directComboCount: number;
      readonly directKnownComboCount: number;
      readonly directKnownComboMass: number;
      readonly incrementalComboCount: number;
      readonly incrementalKnownComboMass: number;
    }[];
    readonly perCardDirectEffectsMayOverlap: true;
    readonly mostAffectedClasses: readonly {
      readonly handClass: string;
      readonly removedComboCount: number;
      readonly removedKnownComboCount: number;
      readonly removedKnownComboMass: number;
    }[];
  };
  readonly composition: {
    readonly preflop: {
      readonly categories: Readonly<Record<'pair' | 'suited' | 'offsuit', RangeCompositionMetric>>;
      readonly classCoverage: {
        readonly totalCanonicalClasses: number;
        readonly eligibleClasses: number;
        readonly knownClasses: number;
        readonly fullyKnownClasses: number;
        readonly positiveWeightClasses: number;
      };
    };
    readonly postflop: {
      readonly primary: Readonly<Record<string, RangeCompositionMetric>>;
      readonly relationships: Readonly<Record<string, RangeCompositionMetric>>;
      readonly draws: Readonly<Record<string, RangeCompositionMetric>>;
      readonly drawAttributesOverlap: true;
      readonly classifiedKnownCombos: number;
    } | null;
  };
}

export interface RangeAnalysisFacts {
  readonly schemaVersion: typeof RANGE_ANALYSIS_FACTS_SCHEMA_VERSION;
  readonly requestSchemaVersion: typeof RANGE_ANALYSIS_REQUEST_SCHEMA_VERSION;
  readonly exactHand: ExactHandFacts;
  readonly board: BoardStructureFacts;
  readonly blockers: {
    readonly heroCards: readonly string[];
    readonly heroCardEffects: readonly {
      readonly card: string;
      readonly rawComboCountContainingCard: number;
      readonly incrementalRawComboCountRemoved: number;
    }[];
    readonly rawCombosRemovedByHeroCards: number | null;
    readonly knownCards: readonly string[];
    readonly rawCombosRemovedByAllKnownCards: number | null;
    readonly interpretation: 'structural_only';
  };
  readonly ranges: Readonly<Record<string, SingleRangeAnalysisFacts>>;
  readonly suppliedRangeCount: number;
  readonly rangeAvailability: 'supplied' | 'unavailable';
  readonly decision: {
    readonly sourceSchemaVersion: unknown;
    readonly street: unknown;
    readonly potBb: number | null;
    readonly currentPotBb: number | null;
    readonly callAmountBb: number | null;
    readonly actorContestablePotAfterCallBb: number | null;
    readonly actorIneligiblePotAfterCallBb: number | null;
    readonly requiredRawEquity: number | null;
    readonly facingSizeBb: number | null;
    readonly heroStreetContributionBb: number | null;
    readonly stackBb: number | null;
    readonly opponentCount: number | null;
    readonly tableSize: number | null;
  } | null;
  readonly provenance: {
    readonly exactHand: AnalysisSourceMetadata;
    readonly board: AnalysisSourceMetadata;
    readonly deadCards: AnalysisSourceMetadata;
    readonly ranges: Readonly<Record<string, AnalysisSourceMetadata>>;
  };
  readonly limitations: readonly string[];
}

function plainObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function nullableFinite(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function cardRank(card: string): number {
  return RANK_VALUE[card[0]!]!;
}

function countsOf<T>(values: readonly T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function sumKnownWeight(entries: readonly HoldemRangeEntry[]): number {
  let sum = 0;
  let correction = 0;
  for (const entry of entries) {
    if (entry.state !== HOLDEM_RANGE_ENTRY_STATES.KNOWN) continue;
    const adjusted = entry.weight - correction;
    const next = sum + adjusted;
    correction = next - sum - adjusted;
    sum = next;
  }
  return sum;
}

function normalizedSource(
  source: unknown,
  fallback: Partial<AnalysisSourceMetadata>,
): AnalysisSourceMetadata {
  const candidate =
    source === null || source === undefined ? {} : plainObject(source, 'fact source');
  const kind = String(candidate.kind || fallback.kind || 'unknown');
  if (!/^[a-z][a-z0-9_.-]*$/.test(kind)) {
    throw new RangeError('fact source kind must be a lowercase extensible discriminator');
  }
  return {
    kind,
    label: String(candidate.label || fallback.label || 'Unknown source'),
    sourceId:
      candidate.sourceId === null || candidate.sourceId === undefined
        ? (fallback.sourceId ?? null)
        : String(candidate.sourceId),
    sourceSchemaVersion:
      candidate.sourceSchemaVersion === null || candidate.sourceSchemaVersion === undefined
        ? (fallback.sourceSchemaVersion ?? null)
        : String(candidate.sourceSchemaVersion),
  };
}

function defaultRangeSource(range: HoldemWeightedRange): AnalysisSourceMetadata {
  const sources = range.provenance.sources;
  if (sources.length === 1) {
    const first = sources[0]!;
    return {
      kind: first.kind,
      label: first.kind.replaceAll('_', ' '),
      sourceId: first.sourceId || first.id,
      sourceSchemaVersion: first.sourceSchemaVersion,
    };
  }
  return {
    kind: sources.length > 1 ? 'mixed' : 'unknown',
    label: sources.length > 1 ? 'Mixed supplied sources' : 'Unknown supplied source',
    sourceId: range.rangeId,
    sourceSchemaVersion: range.schemaVersion,
  };
}

function normalizedRangeInputs(
  ranges: unknown,
): Record<string, RangeAnalysisRangeInputRecord> {
  if (ranges === null || ranges === undefined) return {};
  const obj = plainObject(ranges, 'ranges');
  const normalized: Record<string, RangeAnalysisRangeInputRecord> = {};
  for (const key of Object.keys(obj).sort()) {
    if (!/^[a-z][a-z0-9_.-]*$/.test(key)) throw new RangeError(`Invalid range input key: ${key}`);
    const input = plainObject(obj[key], `ranges.${key}`);
    const range = validateHoldemWeightedRange(input.range);
    const role = (input.role || (key === 'hero' ? 'hero' : 'opponent')) as RangeRole;
    if (!RANGE_ROLES.includes(role)) throw new RangeError(`Unsupported range role: ${String(role)}`);
    normalized[key] = {
      key,
      role,
      subjectId: String(input.subjectId || key),
      label: String(input.label || (role === 'hero' ? 'Supplied Hero range' : 'Supplied opponent range')),
      range,
      source: normalizedSource(input.source, defaultRangeSource(range)),
    };
  }
  return normalized;
}

function resolvedCards(
  input: Record<string, unknown>,
  decisionContext: Record<string, unknown> | null,
  key: 'heroCards' | 'board' | 'deadCards',
): string[] {
  if (Object.hasOwn(input, key) && input[key] !== undefined) {
    return [...(input[key] as readonly string[])];
  }
  const dcVal = decisionContext?.[key];
  return Array.isArray(dcVal) ? [...(dcVal as readonly string[])] : [];
}

function sameCards(left: unknown, right: unknown): boolean {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  return left.length === right.length && left.every((card, index) => card === right[index]);
}

export function createRangeAnalysisRequest(
  rawInput: Record<string, unknown> = {},
): RangeAnalysisRequest {
  const input = plainObject(rawInput, 'RangeAnalysisRequest input');
  if (input.schemaVersion && input.schemaVersion !== RANGE_ANALYSIS_REQUEST_SCHEMA_VERSION) {
    throw new RangeError(`Unsupported RangeAnalysisRequest schema: ${String(input.schemaVersion)}`);
  }
  const decisionContext =
    input.decisionContext === undefined || input.decisionContext === null
      ? null
      : plainObject(input.decisionContext, 'decisionContext');
  if (decisionContext !== null && decisionContext.schemaVersion !== DECISION_CONTEXT_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${DECISION_CONTEXT_SCHEMA_VERSION}`);
  }

  const heroCards = resolvedCards(input, decisionContext, 'heroCards');
  const board = resolvedCards(input, decisionContext, 'board');
  const deadCards = resolvedCards(input, decisionContext, 'deadCards');
  assertCardArray(heroCards, 'heroCards');
  assertCardArray(board, 'board');
  assertCardArray(deadCards, 'deadCards');
  if (heroCards.length !== 0 && heroCards.length !== 2) {
    throw new RangeError('heroCards must contain zero or two cards');
  }
  if (board.length > 5) throw new RangeError('board cannot contain more than five cards');
  assertUniqueKnownCards([
    { label: 'heroCards', cards: heroCards },
    { label: 'board', cards: board },
    { label: 'deadCards', cards: deadCards },
  ]);

  if (decisionContext) {
    for (const key of ['heroCards', 'board', 'deadCards'] as const) {
      if (
        Object.hasOwn(input, key) &&
        input[key] !== undefined &&
        !sameCards(input[key], decisionContext[key])
      ) {
        throw new RangeError(`${key} must match the supplied DecisionContext`);
      }
    }
  }

  const defaultAuthority: Partial<AnalysisSourceMetadata> = {
    kind: 'unknown',
    label: 'Supplied analysis input',
    sourceId: null,
    sourceSchemaVersion:
      typeof decisionContext?.schemaVersion === 'string' ? decisionContext.schemaVersion : null,
  };
  const provenance = plainObject(input.provenance || {}, 'provenance');
  const request: RangeAnalysisRequest = {
    schemaVersion: RANGE_ANALYSIS_REQUEST_SCHEMA_VERSION,
    heroCards,
    board,
    deadCards,
    decisionContext: decisionContext ? cloneData(decisionContext) : null,
    ranges: normalizedRangeInputs(input.ranges),
    provenance: {
      exactHand: normalizedSource(provenance.exactHand, defaultAuthority),
      board: normalizedSource(provenance.board, defaultAuthority),
      deadCards: normalizedSource(provenance.deadCards, defaultAuthority),
    },
  };
  return deepFreeze(request);
}

function unavailableBoard(cardCount: number): BoardStructureFacts {
  return {
    available: false,
    cardCount,
    paired: null,
    doublePaired: null,
    tripled: null,
    quads: null,
    monotone: null,
    twoTone: null,
    rainbow: null,
    suitTexture: null,
    flushDrawPossible: null,
    flushCompletionState: null,
    connectivity: null,
    connected: null,
    longestConnectedRun: null,
    maximumRanksInStraightWindow: null,
    straightCompletedOnBoard: null,
    straightCompletionRanks: [],
    broadwayCount: null,
    highestRank: null,
    highCardStructure: null,
  };
}

export function deriveBoardStructureFacts(board: unknown): BoardStructureFacts {
  const cards = Array.isArray(board) ? [...(board as readonly unknown[])] : [];
  let validCards: readonly string[];
  try {
    validCards = assertCardArray(cards, 'board');
    assertUniqueKnownCards([{ label: 'board', cards: validCards }]);
  } catch {
    return deepFreeze(unavailableBoard(cards.length));
  }
  if (validCards.length < 3 || validCards.length > 5) {
    return deepFreeze(unavailableBoard(validCards.length));
  }

  const ranks = validCards.map(cardRank);
  const rankCounts = countsOf(ranks);
  const suitCounts = countsOf(validCards.map((card) => card[1]!));
  const distinctSuits = suitCounts.size;
  const maximumSuitCount = Math.max(...suitCounts.values());
  const naturalUniqueRanks = [...new Set(ranks)].sort((left, right) => left - right);
  const connectedRanks = naturalUniqueRanks.includes(14)
    ? [1, ...naturalUniqueRanks]
    : naturalUniqueRanks;
  let longestRun = 1;
  let currentRun = 1;
  for (let index = 1; index < connectedRanks.length; index += 1) {
    if (connectedRanks[index] === connectedRanks[index - 1]! + 1) currentRun += 1;
    else currentRun = 1;
    longestRun = Math.max(longestRun, currentRun);
  }
  const windowHits = STRAIGHT_WINDOWS.map((window) => ({
    window,
    hits: window.filter((rank) => naturalUniqueRanks.includes(rank)),
  }));
  const maximumRanksInStraightWindow = Math.max(...windowHits.map(({ hits }) => hits.length));
  const connectivity =
    longestRun >= 3
      ? 'connected'
      : maximumRanksInStraightWindow >= 3
        ? 'coordinated'
        : 'disconnected';
  const straightCompletionRanks = [
    ...new Set(
      windowHits
        .filter(({ hits }) => hits.length === 4)
        .flatMap(({ window }) => window.filter((rank) => !naturalUniqueRanks.includes(rank))),
    ),
  ].sort((left, right) => left - right);
  const suitTexture =
    distinctSuits === 1
      ? 'monotone'
      : distinctSuits === 2
        ? 'two_tone'
        : maximumSuitCount === 1
          ? 'rainbow'
          : 'multi_suit';
  const flushCompletionState =
    maximumSuitCount >= 5
      ? 'board_flush'
      : maximumSuitCount === 4
        ? 'four_flush'
        : maximumSuitCount === 3
          ? 'three_flush'
          : 'none';
  const highestRank = Math.max(...ranks);
  const broadwayCount = ranks.filter((rank) => rank >= 10).length;
  const highCardStructure =
    highestRank === 14
      ? 'ace_high'
      : highestRank >= 12
        ? 'high'
        : highestRank <= 9
          ? 'low'
          : 'middle';

  return deepFreeze({
    available: true,
    cardCount: validCards.length,
    paired: [...rankCounts.values()].some((count) => count >= 2),
    doublePaired: [...rankCounts.values()].filter((count) => count >= 2).length >= 2,
    tripled: [...rankCounts.values()].some((count) => count >= 3),
    quads: [...rankCounts.values()].some((count) => count >= 4),
    monotone: suitTexture === 'monotone',
    twoTone: suitTexture === 'two_tone',
    rainbow: suitTexture === 'rainbow',
    suitTexture,
    flushDrawPossible: maximumSuitCount >= 2,
    flushCompletionState,
    connectivity,
    connected: connectivity === 'connected',
    longestConnectedRun: longestRun,
    maximumRanksInStraightWindow,
    straightCompletedOnBoard: maximumRanksInStraightWindow === 5,
    straightCompletionRanks,
    broadwayCount,
    highestRank,
    highCardStructure,
  });
}

/** Evaluates a 5, 6, or 7 card hand to its canonical PokerHandRank. */
export function evaluateAvailableCards(cards: readonly string[]): PokerHandRank {
  if (cards.length === 5) return evaluateFive(cards);
  if (cards.length === 7) return evaluateSeven(cards);
  if (cards.length !== 6) {
    throw new RangeError('Exact hand evaluation requires five through seven cards');
  }
  let best: PokerHandRank | null = null;
  for (let excluded = 0; excluded < cards.length; excluded += 1) {
    const candidate = evaluateFive(cards.filter((_, index) => index !== excluded));
    if (best === null || candidate.score > best.score) best = candidate;
  }
  return best!;
}

function madeHandSubtype(canonicalRank: PokerHandRank | null): string | null {
  if (
    canonicalRank?.category !== HAND_CATEGORIES.STRAIGHT &&
    canonicalRank?.category !== HAND_CATEGORIES.STRAIGHT_FLUSH
  ) {
    return null;
  }
  const highRank = canonicalRank.tiebreakers[0] ?? null;
  if (canonicalRank.category === HAND_CATEGORIES.STRAIGHT) {
    if (highRank === 5) return 'wheel';
    if (highRank === 14) return 'broadway';
    return 'ordinary';
  }
  if (highRank === 5) return 'wheel';
  if (highRank === 14) return 'royal';
  return 'ordinary';
}

function pairRelationship(
  heroRanks: readonly number[],
  boardRanks: readonly number[],
  canonicalCategory: HandCategory,
): string | null {
  if (canonicalCategory !== HAND_CATEGORIES.ONE_PAIR) return null;
  const boardCounts = countsOf(boardRanks);
  const isPocketPair = heroRanks[0] === heroRanks[1];
  const distinctBoardRanks = [...boardCounts.keys()].sort((left, right) => right - left);
  const matched = [...new Set(heroRanks.filter((rank) => boardCounts.has(rank)))].sort(
    (left, right) => right - left,
  );
  if (isPocketPair) {
    if (heroRanks[0]! > distinctBoardRanks[0]!) return 'overpair';
    return 'pocket_pair';
  }
  if (!matched.length) return 'board_pair';
  const index = distinctBoardRanks.indexOf(matched[0]!);
  if (index === 0) return 'top_pair';
  if (index === 1) return 'middle_pair';
  return 'lower_pair';
}

function madeHandRelationship(
  heroRanks: readonly number[],
  boardRanks: readonly number[],
  canonicalRank: PokerHandRank,
  playsBoard: boolean,
): string {
  if (playsBoard && canonicalRank.category !== HAND_CATEGORIES.HIGH_CARD) return 'plays_board';
  const heroCounts = countsOf(heroRanks);
  const boardCounts = countsOf(boardRanks);
  const pairType = pairRelationship(heroRanks, boardRanks, canonicalRank.category as HandCategory);
  if (pairType) return pairType;
  if (canonicalRank.category === HAND_CATEGORIES.TWO_PAIR) {
    const boardPairCount = [...boardCounts.values()].filter((count) => count >= 2).length;
    const heroMatchesBoard = heroRanks.some((rank) => boardCounts.has(rank));
    const pocketPair = heroRanks[0] === heroRanks[1];
    return boardPairCount >= 2 && !heroMatchesBoard && !pocketPair ? 'board_two_pair' : 'two_pair';
  }
  if (canonicalRank.category === HAND_CATEGORIES.THREE_OF_A_KIND) {
    const tripRank =
      [...countsOf([...heroRanks, ...boardRanks])].find(([, count]) => count >= 3)?.[0] ?? null;
    if (tripRank !== null && heroCounts.get(tripRank) === 2 && boardCounts.get(tripRank) === 1) {
      return 'set';
    }
    if (tripRank !== null && heroCounts.get(tripRank) === 1 && (boardCounts.get(tripRank) ?? 0) >= 2) {
      return 'trips';
    }
    return 'board_trips';
  }
  return canonicalRank.category;
}

interface StraightDrawResult {
  readonly madeStraight: boolean;
  readonly openEnded: boolean;
  readonly gutshot: boolean;
  readonly doubleGutshot: boolean;
  readonly outRanks: readonly number[];
  readonly outRankSymbols: readonly string[];
  readonly endOutRanks: readonly number[];
  readonly internalOutRanks: readonly number[];
}

function straightDrawFacts(
  heroRanks: readonly number[],
  boardRanks: readonly number[],
): StraightDrawResult {
  const combined = new Set([...heroRanks, ...boardRanks]);
  const hero = new Set(heroRanks);
  const board = new Set(boardRanks);
  const madeStraight = STRAIGHT_WINDOWS.some((window) => window.every((rank) => combined.has(rank)));
  const endOutRanks = new Set<number>();
  const internalOutRanks = new Set<number>();
  if (!madeStraight) {
    for (const window of STRAIGHT_WINDOWS) {
      const hits = window.filter((rank) => combined.has(rank));
      if (hits.length !== 4) continue;
      if (!window.some((rank) => hero.has(rank) && !board.has(rank))) continue;
      const missingIndex = window.findIndex((rank) => !combined.has(rank));
      const missingRank = window[missingIndex]!;
      if (missingIndex === 0 || missingIndex === window.length - 1) endOutRanks.add(missingRank);
      else internalOutRanks.add(missingRank);
    }
  }
  const allOutRanks = [...new Set([...endOutRanks, ...internalOutRanks])].sort(
    (left, right) => left - right,
  );
  const openEnded = endOutRanks.size >= 2;
  return {
    madeStraight,
    openEnded,
    gutshot: internalOutRanks.size >= 1 || (!openEnded && allOutRanks.length === 1),
    doubleGutshot: internalOutRanks.size >= 2,
    outRanks: allOutRanks,
    outRankSymbols: allOutRanks.map((rank) => RANK_SYMBOL[rank]!),
    endOutRanks: [...endOutRanks].sort((left, right) => left - right),
    internalOutRanks: [...internalOutRanks].sort((left, right) => left - right),
  };
}

function straightDrawSubtype(straight: StraightDrawResult | null): string | null {
  if (straight?.doubleGutshot) return 'double_gutshot';
  if (straight?.openEnded) return 'open_ended';
  if (straight?.gutshot) return 'gutshot';
  return null;
}

function emptyDrawOuts(street: DrawOutsFacts['street'] = null): DrawOutsFacts {
  return {
    available: false,
    street,
    semantics: 'structural_direct_improvement_cards',
    flush: { available: false, completionCards: [], count: 0 },
    straight: {
      available: false,
      subtype: null,
      completionRanks: [],
      completionCards: [],
      count: 0,
    },
    straightFlush: {
      available: false,
      subtype: null,
      completionSubtype: null,
      royalFlushDraw: false,
      wheelStraightFlushDraw: false,
      completionCards: [],
      completionResults: [],
      count: 0,
    },
    overlaps: [],
    uniqueCompletionCards: [],
    uniqueCompletionCardCount: 0,
    equityCalculated: false,
  };
}

function buildDrawOuts(params: {
  readonly street: 'flop' | 'turn';
  readonly flushCompletionCards: readonly string[];
  readonly straight: StraightDrawResult;
  readonly straightCompletionCards: readonly string[];
  readonly straightFlushDrawSubtype: string | null;
  readonly straightFlushCompletionSubtype: string | null;
  readonly straightFlushCompletions: readonly StraightFlushCompletion[];
  readonly royalFlushDraw: boolean;
  readonly wheelStraightFlushDraw: boolean;
}): DrawOutsFacts {
  const {
    street,
    flushCompletionCards,
    straight,
    straightCompletionCards,
    straightFlushDrawSubtype,
    straightFlushCompletionSubtype,
    straightFlushCompletions,
    royalFlushDraw,
    wheelStraightFlushDraw,
  } = params;
  const families: readonly [string, readonly string[]][] = [
    ['flush', flushCompletionCards],
    ['straight', straightCompletionCards],
    ['straight_flush', straightFlushCompletions.map((completion) => completion.card)],
  ];
  const uniqueCompletionCards = HOLDEM_DECK.filter((card) =>
    families.some(([, cards]) => cards.includes(card)),
  );
  const overlaps = uniqueCompletionCards
    .map((card) => ({
      card,
      families: families.filter(([, cards]) => cards.includes(card)).map(([family]) => family),
    }))
    .filter((entry) => entry.families.length > 1);
  return {
    available: true,
    street,
    semantics: 'structural_direct_improvement_cards',
    flush: {
      available: flushCompletionCards.length > 0,
      completionCards: [...flushCompletionCards],
      count: flushCompletionCards.length,
    },
    straight: {
      available: straightCompletionCards.length > 0,
      subtype: straightDrawSubtype(straight),
      completionRanks: [...straight.outRanks],
      completionCards: [...straightCompletionCards],
      count: straightCompletionCards.length,
    },
    straightFlush: {
      available: straightFlushCompletions.length > 0,
      subtype: straightFlushDrawSubtype,
      completionSubtype: straightFlushCompletionSubtype,
      royalFlushDraw,
      wheelStraightFlushDraw,
      completionCards: straightFlushCompletions.map((completion) => completion.card),
      completionResults: straightFlushCompletions.map((completion) => ({ ...completion })),
      count: straightFlushCompletions.length,
    },
    overlaps,
    uniqueCompletionCards,
    uniqueCompletionCardCount: uniqueCompletionCards.length,
    equityCalculated: false,
  };
}

function drawFacts(
  heroCards: readonly string[],
  board: readonly string[],
  deadCards: readonly string[],
  canonicalCategory: HandCategory,
): ExactHandDrawFacts {
  if (board.length < 3 || board.length > 4) {
    const street = board.length === 5 ? 'river' : null;
    return {
      available: false,
      street,
      flushDraw: false,
      flushDrawSuit: null,
      nutFlushDraw: false,
      straightFlushDraw: false,
      royalFlushDraw: false,
      wheelStraightFlushDraw: false,
      straightFlushDrawSubtype: null,
      straightFlushCompletionSubtype: null,
      straightFlushDrawType: null,
      straightFlushCompletions: [],
      straightFlushOutCards: [],
      straightFlushOutCount: 0,
      flushCompletionCards: [],
      straightCompletionCards: [],
      overlappingCompletionCards: [],
      openEndedStraightDraw: false,
      gutshot: false,
      doubleGutshot: false,
      straightOutRanks: [],
      overcardCount: 0,
      overcardRanks: [],
      madeHandAndDraw: false,
      drawOuts: emptyDrawOuts(street),
      tags: [],
    };
  }
  const allCards = [...heroCards, ...board];
  const allSuitCounts = countsOf(allCards.map((card) => card[1]!));
  const heroSuitCounts = countsOf(heroCards.map((card) => card[1]!));
  const madeFlush =
    canonicalCategory === HAND_CATEGORIES.FLUSH ||
    canonicalCategory === HAND_CATEGORIES.STRAIGHT_FLUSH;
  let flushDrawSuit: string | null = null;
  if (!madeFlush) {
    for (const [suit, count] of allSuitCounts) {
      if (count === 4 && (heroSuitCounts.get(suit) ?? 0) > 0) {
        flushDrawSuit = suit;
        break;
      }
    }
  }
  let nutFlushDraw = false;
  if (flushDrawSuit) {
    const unavailable = new Set([...board, ...deadCards]);
    const highestAvailable = [...CARD_RANKS]
      .reverse()
      .map((rank) => `${rank}${flushDrawSuit}`)
      .find((card) => !unavailable.has(card));
    nutFlushDraw = highestAvailable !== undefined && heroCards.includes(highestAvailable);
  }
  const heroRanks = heroCards.map(cardRank);
  const boardRanks = board.map(cardRank);
  const straight = straightDrawFacts(heroRanks, boardRanks);
  const unavailableCards = new Set([...heroCards, ...board, ...deadCards]);
  const legalCompletionCards = HOLDEM_DECK.filter((card) => !unavailableCards.has(card));
  const flushCompletionCards = flushDrawSuit
    ? legalCompletionCards.filter((card) => card[1] === flushDrawSuit)
    : [];
  const straightOutRankSet = new Set(straight.outRanks);
  const straightCompletionCards = legalCompletionCards.filter((card) =>
    straightOutRankSet.has(cardRank(card)),
  );
  const straightCompletionSet = new Set(straightCompletionCards);
  const overlappingCompletionCards = flushCompletionCards.filter((card) =>
    straightCompletionSet.has(card),
  );
  const madeStraightFlush = canonicalCategory === HAND_CATEGORIES.STRAIGHT_FLUSH;
  const straightFlushCandidateCards: string[] = [];
  for (const [suit, suitCount] of allSuitCounts) {
    if (suitCount < 4 || (heroSuitCounts.get(suit) ?? 0) === 0) continue;
    const suitedRanks = new Set(
      allCards.filter((card) => card[1] === suit).map(cardRank),
    );
    for (const window of STRAIGHT_WINDOWS) {
      const missingRanks = window.filter((rank) => !suitedRanks.has(rank));
      if (missingRanks.length !== 1) continue;
      const candidate = `${RANK_SYMBOL[missingRanks[0]!]!}${suit}`;
      if (!unavailableCards.has(candidate) && !straightFlushCandidateCards.includes(candidate)) {
        straightFlushCandidateCards.push(candidate);
      }
    }
  }
  const straightFlushCompletions: StraightFlushCompletion[] = madeStraightFlush
    ? []
    : [...straightFlushCandidateCards]
        .sort((left, right) => HOLDEM_DECK.indexOf(left) - HOLDEM_DECK.indexOf(right))
        .flatMap((card) => {
          const completedRank = evaluateAvailableCards([...heroCards, ...board, card]);
          const usesHeroCard = completedRank.bestFiveCards.some((bestCard) =>
            heroCards.includes(bestCard),
          );
          if (
            completedRank.category !== HAND_CATEGORIES.STRAIGHT_FLUSH ||
            !completedRank.bestFiveCards.includes(card) ||
            !usesHeroCard
          ) {
            return [];
          }
          return [{ card, subtype: madeHandSubtype(completedRank) }];
        });

  const straightFlushOutCards = straightFlushCompletions.map((completion) => completion.card);
  const straightFlushSubtypeSet = new Set(
    straightFlushCompletions
      .map((completion) => completion.subtype)
      .filter((subtype): subtype is string => subtype !== null),
  );
  const straightFlushCompletionSubtype =
    straightFlushSubtypeSet.size === 1
      ? ([...straightFlushSubtypeSet][0] ?? null)
      : straightFlushSubtypeSet.size > 1
        ? 'mixed'
        : null;
  const straightFlushDraw = straightFlushCompletions.length > 0;
  const royalFlushDraw = straightFlushCompletions.some((completion) => completion.subtype === 'royal');
  const wheelStraightFlushDraw = straightFlushCompletions.some(
    (completion) => completion.subtype === 'wheel',
  );
  const straightFlushSuit =
    [...allSuitCounts].find(([suit, count]) => count >= 4 && (heroSuitCounts.get(suit) ?? 0) > 0)?.[0] ??
    null;
  const suitedStraight = straightFlushSuit
    ? straightDrawFacts(
        heroCards.filter((card) => card[1] === straightFlushSuit).map(cardRank),
        board.filter((card) => card[1] === straightFlushSuit).map(cardRank),
      )
    : null;
  const straightFlushDrawSubtype = straightFlushDraw ? straightDrawSubtype(suitedStraight) : null;
  const straightFlushDrawType = royalFlushDraw
    ? 'royal_flush_draw'
    : straightFlushDrawSubtype
      ? `${straightFlushDrawSubtype}_straight_flush_draw`
      : null;
  const highestBoardRank = Math.max(...boardRanks);
  const overcardRanks =
    canonicalCategory === HAND_CATEGORIES.HIGH_CARD
      ? [...new Set(heroRanks.filter((rank) => rank > highestBoardRank))].sort(
          (left, right) => right - left,
        )
      : [];
  const tags: string[] = [];
  if (flushDrawSuit) tags.push('flush_draw');
  if (nutFlushDraw) tags.push('nut_flush_draw');
  if (straightFlushDraw) tags.push('straight_flush_draw');
  if (royalFlushDraw) tags.push('royal_flush_draw');
  if (wheelStraightFlushDraw) tags.push('wheel_straight_flush_draw');
  if (straightFlushDrawType && straightFlushDrawType !== 'royal_flush_draw') {
    tags.push(straightFlushDrawType);
  }
  if (straight.openEnded) tags.push('open_ended_straight_draw');
  if (straight.gutshot) tags.push('gutshot');
  if (straight.doubleGutshot) tags.push('double_gutshot');
  if (overcardRanks.length) tags.push('overcards');
  const primaryDraw = Boolean(flushDrawSuit) || straight.openEnded || straight.gutshot;
  const madeHandAndDraw = canonicalCategory !== HAND_CATEGORIES.HIGH_CARD && primaryDraw;
  if (madeHandAndDraw) tags.push('made_hand_and_draw');
  const street: 'flop' | 'turn' = board.length === 3 ? 'flop' : 'turn';
  const drawOuts = buildDrawOuts({
    street,
    flushCompletionCards,
    straight,
    straightCompletionCards,
    straightFlushDrawSubtype,
    straightFlushCompletionSubtype,
    straightFlushCompletions,
    royalFlushDraw,
    wheelStraightFlushDraw,
  });
  return {
    available: true,
    street,
    flushDraw: Boolean(flushDrawSuit),
    flushDrawSuit,
    nutFlushDraw,
    straightFlushDraw,
    royalFlushDraw,
    wheelStraightFlushDraw,
    straightFlushDrawSubtype,
    straightFlushCompletionSubtype,
    straightFlushDrawType,
    straightFlushCompletions,
    straightFlushOutCards,
    straightFlushOutCount: straightFlushOutCards.length,
    flushCompletionCards,
    straightCompletionCards,
    overlappingCompletionCards,
    openEndedStraightDraw: straight.openEnded,
    gutshot: straight.gutshot,
    doubleGutshot: straight.doubleGutshot,
    straightOutRanks: straight.outRanks,
    straightOutRankSymbols: straight.outRankSymbols,
    overcardCount: overcardRanks.length,
    overcardRanks,
    overcardRankSymbols: overcardRanks.map((rank) => RANK_SYMBOL[rank]!),
    madeHandAndDraw,
    drawOuts,
    tags,
  };
}

function classifyExactHand(
  heroCards: readonly string[],
  board: readonly string[],
  deadCards: readonly string[],
  boardFacts: BoardStructureFacts,
): ExactHandFacts {
  if (heroCards.length !== 2) {
    const draws = drawFacts([], board, deadCards, HAND_CATEGORIES.HIGH_CARD);
    return {
      available: false,
      street: board.length === 0 ? 'preflop' : null,
      heroCards: [...heroCards],
      preflopHandClass: null,
      primaryCategory: null,
      madeHandSubtype: null,
      relationship: null,
      canonicalRank: null,
      usesHeroCards: null,
      playsBoard: null,
      components: [],
      draws,
      drawOuts: draws.drawOuts,
    };
  }
  if (board.length === 0) {
    const preflopHandClass = preflopHandClassForCards(heroCards);
    return {
      available: true,
      street: 'preflop',
      heroCards: [...heroCards],
      preflopHandClass,
      preflopKind:
        preflopHandClass.length === 2
          ? 'pair'
          : preflopHandClass.endsWith('s')
            ? 'suited'
            : 'offsuit',
      primaryCategory: null,
      madeHandSubtype: null,
      relationship: null,
      canonicalRank: null,
      usesHeroCards: true,
      playsBoard: false,
      components: heroCards[0]![0] === heroCards[1]![0] ? ['pocket_pair'] : [],
      draws: {
        available: false,
        street: 'preflop',
        flushDraw: false,
        flushDrawSuit: null,
        nutFlushDraw: false,
        straightFlushDraw: false,
        royalFlushDraw: false,
        wheelStraightFlushDraw: false,
        straightFlushDrawSubtype: null,
        straightFlushCompletionSubtype: null,
        straightFlushDrawType: null,
        straightFlushCompletions: [],
        straightFlushOutCards: [],
        straightFlushOutCount: 0,
        flushCompletionCards: [],
        straightCompletionCards: [],
        overlappingCompletionCards: [],
        openEndedStraightDraw: false,
        gutshot: false,
        doubleGutshot: false,
        straightOutRanks: [],
        overcardCount: 0,
        overcardRanks: [],
        madeHandAndDraw: false,
        drawOuts: emptyDrawOuts('preflop'),
        tags: [],
      },
      drawOuts: emptyDrawOuts('preflop'),
    };
  }
  if (!boardFacts.available) {
    const unavailableDraws: ExactHandDrawFacts = {
      available: false,
      street: null,
      flushDraw: false,
      flushDrawSuit: null,
      nutFlushDraw: false,
      straightFlushDraw: false,
      royalFlushDraw: false,
      wheelStraightFlushDraw: false,
      straightFlushDrawSubtype: null,
      straightFlushCompletionSubtype: null,
      straightFlushDrawType: null,
      straightFlushCompletions: [],
      straightFlushOutCards: [],
      straightFlushOutCount: 0,
      flushCompletionCards: [],
      straightCompletionCards: [],
      overlappingCompletionCards: [],
      openEndedStraightDraw: false,
      gutshot: false,
      doubleGutshot: false,
      straightOutRanks: [],
      overcardCount: 0,
      overcardRanks: [],
      madeHandAndDraw: false,
      drawOuts: emptyDrawOuts(null),
      tags: [],
    };
    return {
      available: false,
      street: null,
      heroCards: [...heroCards],
      preflopHandClass: preflopHandClassForCards(heroCards),
      primaryCategory: null,
      madeHandSubtype: null,
      relationship: null,
      canonicalRank: null,
      usesHeroCards: null,
      playsBoard: null,
      components: [],
      draws: unavailableDraws,
      drawOuts: emptyDrawOuts(null),
    };
  }
  const canonicalRank = evaluateAvailableCards([...heroCards, ...board]);
  const playsBoard = board.length === 5 && evaluateFive(board).score === canonicalRank.score;
  const heroRanks = heroCards.map(cardRank);
  const boardRanks = board.map(cardRank);
  const canonicalCategory = canonicalRank.category as HandCategory;
  const relationship = madeHandRelationship(heroRanks, boardRanks, canonicalRank, playsBoard);
  const components: string[] = [];
  if (heroRanks[0] === heroRanks[1]) components.push('pocket_pair');
  if (heroRanks.some((rank) => boardRanks.includes(rank))) components.push('pairs_board_rank');
  if (playsBoard) components.push('plays_board');
  if (relationship && relationship !== canonicalCategory) components.push(relationship);
  const draws = drawFacts(heroCards, board, deadCards, canonicalCategory);
  const subtype = madeHandSubtype(canonicalRank);
  return {
    available: true,
    street: board.length === 3 ? 'flop' : board.length === 4 ? 'turn' : 'river',
    heroCards: [...heroCards],
    preflopHandClass: preflopHandClassForCards(heroCards),
    primaryCategory: canonicalCategory,
    madeHandSubtype: subtype,
    relationship,
    canonicalRank: {
      schemaVersion: canonicalRank.schemaVersion,
      score: canonicalRank.score,
      category: canonicalRank.category,
      categoryRank: canonicalRank.categoryRank,
      tiebreakers: [...canonicalRank.tiebreakers],
      bestFiveCards: [...canonicalRank.bestFiveCards],
    },
    usesHeroCards: !playsBoard && canonicalRank.bestFiveCards.some((card) => heroCards.includes(card)),
    playsBoard,
    components,
    draws,
    drawOuts: draws.drawOuts,
  };
}

export function deriveExactHandFacts(input: {
  readonly heroCards?: readonly string[];
  readonly board?: readonly string[];
  readonly deadCards?: readonly string[];
} = {}): ExactHandFacts {
  const heroCards = input.heroCards ?? [];
  const board = input.board ?? [];
  const deadCards = input.deadCards ?? [];
  assertCardArray(heroCards, 'heroCards');
  assertCardArray(board, 'board');
  assertCardArray(deadCards, 'deadCards');
  assertUniqueKnownCards([
    { label: 'heroCards', cards: heroCards },
    { label: 'board', cards: board },
    { label: 'deadCards', cards: deadCards },
  ]);
  if (heroCards.length !== 0 && heroCards.length !== 2) {
    throw new RangeError('heroCards must contain zero or two cards');
  }
  const boardFacts = deriveBoardStructureFacts(board);
  return deepFreeze(classifyExactHand(heroCards, board, deadCards, boardFacts));
}

function rawComboRemovalCount(blockerCount: number): number | null {
  if (!Number.isInteger(blockerCount) || blockerCount < 0 || blockerCount > 52) return null;
  return 1326 - ((52 - blockerCount) * (51 - blockerCount)) / 2;
}

function rangeMetric(): RangeCompositionMetric {
  return { knownComboCount: 0, positiveWeightComboCount: 0, knownComboMass: 0, normalizedShare: null };
}

function addEntry(metric: RangeCompositionMetric, entry: HoldemRangeEntry): void {
  if (entry.state !== HOLDEM_RANGE_ENTRY_STATES.KNOWN) return;
  metric.knownComboCount += 1;
  metric.knownComboMass += entry.weight;
  if (entry.weight > 0) metric.positiveWeightComboCount += 1;
}

function finalizeMetric(
  metric: RangeCompositionMetric,
  denominator: number | null,
): RangeCompositionMetric {
  metric.normalizedShare = denominator === null ? null : metric.knownComboMass / denominator;
  return metric;
}

function preflopComposition(
  entries: readonly HoldemRangeEntry[],
  normalizationDenominator: number | null,
): SingleRangeAnalysisFacts['composition']['preflop'] {
  const composition = {
    pair: rangeMetric(),
    suited: rangeMetric(),
    offsuit: rangeMetric(),
  };
  const classes = new Map<string, HoldemRangeEntry[]>();
  for (const entry of entries) {
    const combo = getHoldemComboById(entry.comboId);
    const kind =
      combo.handClass.length === 2
        ? 'pair'
        : combo.handClass.endsWith('s')
          ? 'suited'
          : 'offsuit';
    addEntry(composition[kind], entry);
    let bucket = classes.get(combo.handClass);
    if (!bucket) {
      bucket = [];
      classes.set(combo.handClass, bucket);
    }
    bucket.push(entry);
  }
  Object.values(composition).forEach((metric) => finalizeMetric(metric, normalizationDenominator));
  const classCoverage = {
    totalCanonicalClasses: PREFLOP_HAND_CLASSES.length,
    eligibleClasses: classes.size,
    knownClasses: 0,
    fullyKnownClasses: 0,
    positiveWeightClasses: 0,
  };
  for (const classEntries of classes.values()) {
    const known = classEntries.filter((entry) => entry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN);
    if (known.length) classCoverage.knownClasses += 1;
    if (known.length === classEntries.length) classCoverage.fullyKnownClasses += 1;
    if (known.some((entry) => entry.weight > 0)) classCoverage.positiveWeightClasses += 1;
  }
  return { categories: composition, classCoverage };
}

function postflopComposition(
  entries: readonly HoldemRangeEntry[],
  board: readonly string[],
  unavailablePrivateCards: readonly string[],
  boardFacts: BoardStructureFacts,
  normalizationDenominator: number | null,
): NonNullable<SingleRangeAnalysisFacts['composition']['postflop']> {
  const primary = Object.fromEntries(PRIMARY_CATEGORIES.map((key) => [key, rangeMetric()])) as Record<
    string,
    RangeCompositionMetric
  >;
  const relationships = Object.fromEntries(
    RELATIONSHIP_TAGS.map((key) => [key, rangeMetric()]),
  ) as Record<string, RangeCompositionMetric>;
  const draws = Object.fromEntries(DRAW_TAGS.map((key) => [key, rangeMetric()])) as Record<
    string,
    RangeCompositionMetric
  >;
  let classifiedKnownCombos = 0;
  for (const entry of entries) {
    if (entry.state !== HOLDEM_RANGE_ENTRY_STATES.KNOWN) continue;
    const combo = getHoldemComboById(entry.comboId);
    const exact = classifyExactHand(combo.cards, board, unavailablePrivateCards, boardFacts);
    if (!exact.available || !exact.primaryCategory) continue;
    classifiedKnownCombos += 1;
    addEntry(primary[exact.primaryCategory]!, entry);
    const relationshipTag = exact.playsBoard ? 'plays_board' : exact.relationship;
    if (relationshipTag && relationships[relationshipTag]) {
      addEntry(relationships[relationshipTag]!, entry);
    }
    for (const tag of exact.draws.tags) {
      if (draws[tag]) addEntry(draws[tag]!, entry);
    }
  }
  for (const group of [primary, relationships, draws]) {
    Object.values(group).forEach((metric) => finalizeMetric(metric, normalizationDenominator));
  }
  return {
    primary,
    relationships,
    draws,
    drawAttributesOverlap: true,
    classifiedKnownCombos,
  };
}

function entriesRemovedBetween(
  before: readonly HoldemRangeEntry[],
  after: readonly HoldemRangeEntry[],
): HoldemRangeEntry[] {
  const afterIds = new Set(after.map((entry) => entry.comboId));
  return before.filter((entry) => !afterIds.has(entry.comboId));
}

function affectedClasses(entries: readonly HoldemRangeEntry[]) {
  const byClass = new Map<
    string,
    {
      handClass: string;
      removedComboCount: number;
      removedKnownComboCount: number;
      removedKnownComboMass: number;
    }
  >();
  for (const entry of entries) {
    const handClass = getHoldemComboById(entry.comboId).handClass;
    let item = byClass.get(handClass);
    if (!item) {
      item = {
        handClass,
        removedComboCount: 0,
        removedKnownComboCount: 0,
        removedKnownComboMass: 0,
      };
      byClass.set(handClass, item);
    }
    item.removedComboCount += 1;
    if (entry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN) {
      item.removedKnownComboCount += 1;
      item.removedKnownComboMass += entry.weight;
    }
  }
  return [...byClass.values()]
    .sort(
      (left, right) =>
        right.removedKnownComboMass - left.removedKnownComboMass ||
        right.removedComboCount - left.removedComboCount ||
        left.handClass.localeCompare(right.handClass),
    )
    .slice(0, 10);
}

function rangeBlockerFacts(
  range: HoldemWeightedRange,
  role: RangeRole,
  heroCards: readonly string[],
  board: readonly string[],
  deadCards: readonly string[],
): {
  readonly conditioned: HoldemConditionedRange;
  readonly facts: SingleRangeAnalysisFacts['blockers'];
} {
  const boardAndDead = [...board, ...deadCards];
  const base = conditionHoldemRange(range, boardAndDead);
  const finalBlockers = role === 'opponent' ? [...boardAndDead, ...heroCards] : boardAndDead;
  const conditioned = conditionHoldemRange(range, finalBlockers);
  const heroRemovedEntries =
    role === 'opponent'
      ? entriesRemovedBetween(base.eligibleEntries, conditioned.eligibleEntries)
      : [];
  const perHeroCard: {
    card: string;
    directComboCount: number;
    directKnownComboCount: number;
    directKnownComboMass: number;
    incrementalComboCount: number;
    incrementalKnownComboMass: number;
  }[] = [];
  if (role === 'opponent') {
    let prior = base;
    const priorCards = [...boardAndDead];
    for (const card of heroCards) {
      const directEntries = base.eligibleEntries.filter((entry) =>
        getHoldemComboById(entry.comboId).cards.includes(card),
      );
      const next = conditionHoldemRange(range, [...priorCards, card]);
      const incrementalEntries = entriesRemovedBetween(prior.eligibleEntries, next.eligibleEntries);
      perHeroCard.push({
        card,
        directComboCount: directEntries.length,
        directKnownComboCount: directEntries.filter(
          (entry) => entry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN,
        ).length,
        directKnownComboMass: sumKnownWeight(directEntries),
        incrementalComboCount: incrementalEntries.length,
        incrementalKnownComboMass: sumKnownWeight(incrementalEntries),
      });
      prior = next;
      priorCards.push(card);
    }
  }
  const boardRemovedEntries = entriesRemovedBetween(range.entries, base.eligibleEntries);
  return {
    conditioned,
    facts: {
      blockers: [...conditioned.blockers],
      boardAndDeadRemovedComboCount: boardRemovedEntries.length,
      boardAndDeadRemovedKnownComboMass: sumKnownWeight(boardRemovedEntries),
      heroConditioningApplied: role === 'opponent',
      physicalEligibleComboCountBeforeHero: base.eligibleEntries.length,
      physicalEligibleComboCountAfterHero: conditioned.eligibleEntries.length,
      heroRemovedComboCount: heroRemovedEntries.length,
      heroRemovedKnownComboCount: heroRemovedEntries.filter(
        (entry) => entry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN,
      ).length,
      heroRemovedKnownComboMass: sumKnownWeight(heroRemovedEntries),
      perHeroCard,
      perCardDirectEffectsMayOverlap: true,
      mostAffectedClasses: affectedClasses(heroRemovedEntries),
    },
  };
}

function analyzeRangeInput(
  input: RangeAnalysisRangeInputRecord,
  heroCards: readonly string[],
  board: readonly string[],
  deadCards: readonly string[],
  boardFacts: BoardStructureFacts,
): SingleRangeAnalysisFacts {
  const inspection = inspectHoldemWeightedRange(input.range);
  const blockerAnalysis = rangeBlockerFacts(input.range, input.role, heroCards, board, deadCards);
  const conditioned = blockerAnalysis.conditioned;
  const eligibleKnownMass = conditioned.facts.totalEligibleWeight;
  const normalizationAvailable = inspection.complete && eligibleKnownMass > 0;
  const normalizationDenominator = normalizationAvailable ? eligibleKnownMass : null;
  const preflop = preflopComposition(conditioned.eligibleEntries, normalizationDenominator);
  const unavailablePrivateCards =
    input.role === 'opponent' ? [...deadCards, ...heroCards] : deadCards;
  const postflop = boardFacts.available
    ? postflopComposition(
        conditioned.eligibleEntries,
        board,
        unavailablePrivateCards,
        boardFacts,
        normalizationDenominator,
      )
    : null;
  return {
    schemaVersion: 'range-analysis-range-facts/v1',
    key: input.key,
    role: input.role,
    subjectId: input.subjectId,
    label: input.label,
    source: cloneData(input.source),
    rangeProvenance: cloneData(input.range.provenance),
    sourceRangeId: input.range.rangeId,
    sourceRangeSchemaVersion: input.range.schemaVersion,
    inspection: cloneData(inspection),
    eligibility: {
      blockers: [...conditioned.blockers],
      eligibleComboCount: conditioned.facts.eligibleCombos,
      knownEligibleComboCount: conditioned.facts.knownEligibleCombos,
      unknownEligibleComboCount: conditioned.facts.unknownEligibleCombos,
      eligibleCoverageRatio: conditioned.facts.eligibleCoverageRatio,
      knownEligibleComboMass: eligibleKnownMass,
      completeAfterConditioning: conditioned.facts.completeAfterConditioning,
    },
    normalization: {
      available: normalizationAvailable,
      denominatorKnownComboMass: normalizationDenominator,
      unavailableReason: normalizationAvailable
        ? null
        : !inspection.complete
          ? 'partial_range'
          : 'zero_eligible_mass',
    },
    blockers: blockerAnalysis.facts,
    composition: { preflop, postflop },
  };
}

function decisionFacts(
  decisionContext: Readonly<Record<string, unknown>> | null,
): RangeAnalysisFacts['decision'] {
  if (!decisionContext) return null;
  return {
    sourceSchemaVersion: decisionContext.schemaVersion,
    street: decisionContext.street,
    potBb: nullableFinite(decisionContext.potBb),
    currentPotBb: nullableFinite(decisionContext.currentPotBb),
    callAmountBb: nullableFinite(decisionContext.callAmountBb),
    actorContestablePotAfterCallBb: nullableFinite(
      decisionContext.actorContestablePotAfterCallBb,
    ),
    actorIneligiblePotAfterCallBb: nullableFinite(
      decisionContext.actorIneligiblePotAfterCallBb,
    ),
    requiredRawEquity: nullableFinite(decisionContext.requiredRawEquity),
    facingSizeBb: nullableFinite(decisionContext.facingSizeBb),
    heroStreetContributionBb: nullableFinite(decisionContext.heroStreetContributionBb),
    stackBb: nullableFinite(decisionContext.stackBb),
    opponentCount: Number.isInteger(decisionContext.opponentCount)
      ? (decisionContext.opponentCount as number)
      : null,
    tableSize: Number.isInteger(decisionContext.tableSize)
      ? (decisionContext.tableSize as number)
      : null,
  };
}

export function createRangeAnalysisFacts(
  requestInput: Record<string, unknown> = {},
): RangeAnalysisFacts {
  const request = createRangeAnalysisRequest(requestInput);
  const board = deriveBoardStructureFacts(request.board);
  const exactHand = classifyExactHand(request.heroCards, request.board, request.deadCards, board);
  const rangeAnalyses: Record<string, SingleRangeAnalysisFacts> = {};
  for (const key of Object.keys(request.ranges)) {
    rangeAnalyses[key] = analyzeRangeInput(
      request.ranges[key]!,
      request.heroCards,
      request.board,
      request.deadCards,
      board,
    );
  }
  const heroCardEffects = request.heroCards.map((card, index) => ({
    card,
    rawComboCountContainingCard: 51,
    incrementalRawComboCountRemoved: 51 - index,
  }));
  const facts: RangeAnalysisFacts = {
    schemaVersion: RANGE_ANALYSIS_FACTS_SCHEMA_VERSION,
    requestSchemaVersion: request.schemaVersion,
    exactHand,
    board,
    blockers: {
      heroCards: [...request.heroCards],
      heroCardEffects,
      rawCombosRemovedByHeroCards: rawComboRemovalCount(request.heroCards.length),
      knownCards: [...request.heroCards, ...request.board, ...request.deadCards],
      rawCombosRemovedByAllKnownCards: rawComboRemovalCount(
        request.heroCards.length + request.board.length + request.deadCards.length,
      ),
      interpretation: 'structural_only',
    },
    ranges: rangeAnalyses,
    suppliedRangeCount: Object.keys(rangeAnalyses).length,
    rangeAvailability: Object.keys(rangeAnalyses).length ? 'supplied' : 'unavailable',
    decision: decisionFacts(request.decisionContext),
    provenance: {
      exactHand: cloneData(request.provenance.exactHand),
      board: cloneData(request.provenance.board),
      deadCards: cloneData(request.provenance.deadCards),
      ranges: Object.fromEntries(
        Object.entries(rangeAnalyses).map(([key, analysis]) => [key, cloneData(analysis.source)]),
      ),
    },
    limitations: [
      'structural_facts_only',
      ...(Object.keys(rangeAnalyses).length ? [] : ['no_supplied_weighted_range']),
      ...(Object.values(rangeAnalyses).some((analysis) => !analysis.inspection.complete)
        ? ['partial_range_not_normalized']
        : []),
      'no_range_advantage',
      'no_nut_advantage',
      'no_action_ev',
    ],
  };
  return deepFreeze(facts);
}
