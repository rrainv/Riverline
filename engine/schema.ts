import type { GameRulesSnapshot } from './game-rules';

export const POKER_STATE_SCHEMA_VERSION = 'poker-state/v1' as const;
export const POKER_STATE_V2_SCHEMA_VERSION = 'poker-state/v2' as const;
export const POKER_STATE_V3_SCHEMA_VERSION = 'poker-state/v3' as const;
export const POKER_STATE_SCHEMA_VERSIONS = Object.freeze([
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_V2_SCHEMA_VERSION,
  POKER_STATE_V3_SCHEMA_VERSION,
] as const);

export type PokerStateSchemaVersion =
  | typeof POKER_STATE_SCHEMA_VERSION
  | typeof POKER_STATE_V2_SCHEMA_VERSION
  | typeof POKER_STATE_V3_SCHEMA_VERSION;

export const POKER_ACTION_SCHEMA_VERSION = 'poker-action/v1' as const;
export const POKER_ACTION_RECORD_SCHEMA_VERSION = 'poker-action-record/v1' as const;
export const POKER_POT_LAYER_SCHEMA_VERSION = 'poker-pot-layer/v1' as const;
export const POKER_POT_LAYER_V2_SCHEMA_VERSION = 'poker-pot-layer/v2' as const;
export const POKER_UNMATCHED_CONTRIBUTION_SCHEMA_VERSION = 'poker-unmatched-contribution/v1' as const;
export const POKER_ACTOR_CALL_ECONOMICS_SCHEMA_VERSION = 'poker-actor-call-economics/v1' as const;
export const POKER_HAND_RANK_SCHEMA_VERSION = 'poker-hand-rank/v1' as const;
export const POKER_SHOWDOWN_LAYER_RESULT_SCHEMA_VERSION = 'poker-showdown-layer-result/v1' as const;
export const POKER_HIDDEN_HOLE_CARDS_SCHEMA_VERSION = 'poker-hidden-hole-cards/v1' as const;
export const POKER_VARIANT = 'no_limit_texas_holdem' as const;

export const ACTION_TYPES = Object.freeze({
  FOLD: 'fold',
  CHECK: 'check',
  CALL: 'call',
  BET: 'bet',
  RAISE: 'raise',
  ALL_IN: 'all_in',
} as const);

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

export const GAME_MODES = Object.freeze({
  HOME: 'home',
  CLUBGG: 'clubgg',
} as const);

export type GameMode = (typeof GAME_MODES)[keyof typeof GAME_MODES];

export const ANTE_TYPES = Object.freeze({
  NONE: 'none',
  PER_PLAYER: 'per_player',
  BIG_BLIND: 'big_blind',
} as const);

export type AnteType = (typeof ANTE_TYPES)[keyof typeof ANTE_TYPES];

export const PHASES = Object.freeze({
  CHANCE: 'chance',
  BETTING: 'betting',
  SHOWDOWN: 'showdown',
  TERMINAL: 'terminal',
} as const);

export type Phase = (typeof PHASES)[keyof typeof PHASES];

export const STREETS = Object.freeze({
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
} as const);

export type Street = (typeof STREETS)[keyof typeof STREETS];

export const CHANCE_TYPES = Object.freeze({
  DEAL_HOLE: 'deal_hole',
  DEAL_FLOP: 'deal_flop',
  DEAL_TURN: 'deal_turn',
  DEAL_RIVER: 'deal_river',
} as const);

export type ChanceType = (typeof CHANCE_TYPES)[keyof typeof CHANCE_TYPES];

export const HOLE_CARD_STATES = Object.freeze({
  HIDDEN: 'hidden',
} as const);

export const LEDGER_KINDS = Object.freeze({
  CLUBGG_FORCED_CONTRIBUTION: 'clubgg_forced_contribution',
  FIXED_PLAYER_COLLECTION: 'fixed_player_collection',
  ANTE: 'ante',
  SMALL_BLIND: 'small_blind',
  BIG_BLIND: 'big_blind',
  ACTION: 'action',
  UNCALLED_REFUND: 'uncalled_refund',
  POT_AWARD: 'pot_award',
  RECORDED_RAKE: 'recorded_rake',
} as const);

export type LedgerKind = (typeof LEDGER_KINDS)[keyof typeof LEDGER_KINDS];

export const LEDGER_MOVEMENTS = Object.freeze({
  STACK_TO_POT: 'stack_to_pot',
  STACK_TO_DEDUCTION: 'stack_to_deduction',
  POT_TO_STACK: 'pot_to_stack',
  POT_TO_RECORDED_RAKE: 'pot_to_recorded_rake',
} as const);

export type LedgerMovement = (typeof LEDGER_MOVEMENTS)[keyof typeof LEDGER_MOVEMENTS];

export const CLUBGG_FORCED_CONTRIBUTION_MILLI_BB = 100 as const;

export interface HiddenHoleCards {
  readonly schemaVersion: typeof POKER_HIDDEN_HOLE_CARDS_SCHEMA_VERSION;
  readonly status: typeof HOLE_CARD_STATES.HIDDEN;
  readonly cardCount: 2;
}

export type PlayerHoleCards = readonly string[] | HiddenHoleCards | null;

export interface PokerAnteSpec {
  readonly type: AnteType;
  readonly amountMilliBb: number;
}

export interface PokerAction {
  readonly schemaVersion: typeof POKER_ACTION_SCHEMA_VERSION;
  readonly playerId: string;
  readonly type: ActionType;
  readonly amountToMilliBb: number | null;
}

export interface PokerActionRecord {
  readonly schemaVersion: typeof POKER_ACTION_RECORD_SCHEMA_VERSION;
  readonly sequence: number;
  readonly street: Street;
  readonly playerId: string;
  readonly submittedAction: PokerAction;
  readonly toCallBeforeMilliBb: number;
  readonly committedMilliBb: number;
  readonly streetContributionAfterMilliBb: number;
  readonly currentBetBeforeMilliBb: number;
  readonly currentBetAfterMilliBb: number;
  readonly wasAllIn: boolean;
  readonly wasFullRaise: boolean;
  readonly reopenedBetting: boolean;
}

export interface PokerLedgerEntry {
  readonly sequence: number;
  readonly playerId: string | null;
  readonly street: Street | 'hand';
  readonly kind: LedgerKind;
  readonly movement: LedgerMovement;
  readonly amountMilliBb: number;
  readonly settlementReason?: 'showdown';
  readonly potLayerIndex?: number;
}

export interface PokerPlayerState {
  readonly playerId: string;
  readonly seat: number;
  readonly position: string;
  readonly seated: true;
  readonly dealtIn: true;
  readonly holeCards: PlayerHoleCards;
  readonly startingStackMilliBb: number;
  readonly currentStackMilliBb: number;
  readonly streetContributionMilliBb: number;
  readonly totalPotContributionMilliBb: number;
  readonly totalDeductionMilliBb: number;
  readonly folded: boolean;
  readonly actedThisStreet: boolean;
  readonly raiseReopenAtMilliBb: number | null;
}

export interface PokerHandRank {
  readonly schemaVersion: typeof POKER_HAND_RANK_SCHEMA_VERSION;
  readonly score: number;
  readonly category: string;
  readonly categoryRank: number;
  readonly tiebreakers: readonly number[];
  readonly bestFiveCards: readonly string[];
}

export interface PokerShowdownLayerResult {
  readonly schemaVersion: typeof POKER_SHOWDOWN_LAYER_RESULT_SCHEMA_VERSION;
  readonly layerIndex: number;
  readonly amountMilliBb: number;
  readonly contributionFloorMilliBb: number;
  readonly contributionCeilingMilliBb: number;
  readonly eligiblePlayerIds: readonly string[];
  readonly winnerPlayerIds: readonly string[];
  readonly payoutsMilliBbByPlayer: Readonly<Record<string, number>>;
}

export interface PokerPendingChance {
  readonly type: ChanceType;
  readonly cardCount: number;
  readonly playerOrder?: readonly string[];
}

export interface PokerTerminalState {
  readonly isTerminal: boolean;
  readonly reason: 'fold' | 'showdown' | null;
  readonly winnerPlayerIds: readonly string[];
  readonly payoutsMilliBbByPlayer: Readonly<Record<string, number>>;
  readonly refundsMilliBbByPlayer: Readonly<Record<string, number>>;
}

export interface PokerShowdownState {
  readonly status: 'not_reached' | 'awaiting_private_reveal' | 'ready' | 'settled';
  readonly eligiblePlayerIds: readonly string[];
  readonly pots: readonly never[];
  readonly handRanksByPlayer: Readonly<Record<string, PokerHandRank>> | null;
  readonly layerResults: readonly PokerShowdownLayerResult[];
  readonly requiredRevealPlayerIds?: readonly string[];
}

export interface PokerLegacyGameSpec {
  readonly variant: typeof POKER_VARIANT;
  readonly mode: GameMode;
  readonly tableSize: number;
  readonly smallBlindMilliBb: number;
  readonly bigBlindMilliBb: number;
  readonly chipUnitMilliBb: number;
  readonly ante: PokerAnteSpec;
  readonly forcedContributionPerPlayerMilliBb: number;
}

export interface PokerV2GameSpec {
  readonly variant: typeof POKER_VARIANT;
  readonly format: string;
  readonly tableSize: number;
  readonly smallBlindMilliBb: number;
  readonly bigBlindMilliBb: number;
  readonly chipUnitMilliBb: number;
  readonly ante: PokerAnteSpec;
}

export interface RecordedHandSettlementEvidence {
  readonly schemaVersion: 'recorded-hand-settlement/v1';
  readonly grossPotMilliBb: number;
  readonly rakeMilliBb: number;
  readonly payoutsMilliBbByPlayer: Readonly<Record<string, number>>;
}

export interface RecordedHandSettlementRecord extends RecordedHandSettlementEvidence {
  readonly netAwardedMilliBb: number;
  readonly grossPayoutsMilliBbByPlayer: Readonly<Record<string, number>>;
}

export interface PotLayer {
  readonly schemaVersion: typeof POKER_POT_LAYER_SCHEMA_VERSION | typeof POKER_POT_LAYER_V2_SCHEMA_VERSION;
  readonly amountMilliBb: number;
  readonly anteMilliBb?: number;
  readonly contributionFloorMilliBb: number;
  readonly contributionCeilingMilliBb: number;
  readonly contributorPlayerIds: readonly string[];
  readonly eligiblePlayerIds: readonly string[];
}

export interface UnmatchedContribution {
  readonly schemaVersion: typeof POKER_UNMATCHED_CONTRIBUTION_SCHEMA_VERSION;
  readonly playerId: string;
  readonly amountMilliBb: number;
  readonly contributionFloorMilliBb: number;
  readonly contributionCeilingMilliBb: number;
}

export interface PotAccounting {
  readonly potLayers: readonly PotLayer[];
  readonly unmatchedContribution: UnmatchedContribution | null;
  readonly contestablePotMilliBb: number;
  readonly unmatchedMilliBb: number;
}

export interface LegalActionSpec {
  readonly playerId: string;
  readonly fold: { readonly available: boolean };
  readonly check: { readonly available: boolean };
  readonly call: {
    readonly available: boolean;
    readonly toCallMilliBb: number;
    readonly commitMilliBb: number;
    readonly allIn: boolean;
  };
  readonly bet: {
    readonly available: boolean;
    readonly minToMilliBb: number | null;
    readonly maxToMilliBb: number | null;
  };
  readonly raise: {
    readonly available: boolean;
    readonly minToMilliBb: number | null;
    readonly maxToMilliBb: number | null;
  };
  readonly allIn: {
    readonly available: boolean;
    readonly amountToMilliBb: number | null;
  };
}

export interface ActorCallEconomics {
  readonly schemaVersion: typeof POKER_ACTOR_CALL_ECONOMICS_SCHEMA_VERSION;
  readonly actorPlayerId: string;
  readonly callCommitmentMilliBb: number;
  readonly potAfterCallMilliBb: number;
  readonly actorContestablePotAfterCallMilliBb: number;
  readonly actorIneligiblePotAfterCallMilliBb: number;
  readonly requiredRawEquity: number | null;
}

export interface ActionSizeFacts {
  readonly actorPlayerId: string;
  readonly amountToMilliBb: number;
  readonly potShare: number | null;
  readonly sprAfterCalled: number | null;
}

export interface PokerState {
  readonly schemaVersion: PokerStateSchemaVersion;
  readonly handId: string | null;
  readonly recordedSettlement?: RecordedHandSettlementRecord | null;
  readonly rulesSnapshot?: GameRulesSnapshot;
  readonly game: PokerLegacyGameSpec | PokerV2GameSpec;
  readonly phase: Phase;
  readonly street: Street;
  readonly buttonSeat: number;
  readonly actingPlayerId: string | null;
  readonly board: readonly string[];
  readonly deadCards: readonly string[];
  readonly players: readonly PokerPlayerState[];
  readonly potMilliBb: number;
  readonly deductionTotalMilliBb: number;
  readonly currentBetMilliBb: number;
  readonly lastFullRaiseIncrementMilliBb: number;
  readonly lastAggressorPlayerId: string | null;
  readonly actionHistory: readonly PokerActionRecord[];
  readonly ledger: readonly PokerLedgerEntry[];
  readonly pendingChance: PokerPendingChance | null;
  readonly terminal: PokerTerminalState;
  readonly showdown: PokerShowdownState;
}

export type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;

export type MutablePokerState = DeepMutable<PokerState>;
