import { applyAction } from './transitions';
import { applyChance, type ChanceEvent } from './chance';
import { assertCardArray, assertUniqueKnownCards } from './cards';
import { cloneData, dataEquals, deepFreeze } from './freeze';
import {
  initializeHand,
  initializeHandFromGameRulesSnapshot,
  initializeRecordedHand,
  type InitializeLegacyHandConfig,
  type InitializeSnapshotHandConfig,
} from './initialize-hand';
import { getLegalActionSpec } from './legal-actions';
import { isHiddenHoleCards } from './private-cards';
import { applyPrivateReveal, type PrivateRevealEvent } from './private-reveal';
import { applyRecordedSettlement } from './recorded-settlement';
import {
  CHANCE_TYPES,
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_V2_SCHEMA_VERSION,
  POKER_STATE_V3_SCHEMA_VERSION,
  type ActionType,
  type LegalActionSpec,
  type PokerAction,
  type PokerState,
  type PokerStateSchemaVersion,
  type RecordedHandSettlementEvidence,
  type Street,
} from './schema';
import { playerById } from './selectors';
import { resolveShowdown } from './showdown';
import { validatePokerState } from './validate';

export const OPPONENT_ACTOR_INFORMATION_VERSION = 'opponent-actor-information/v1' as const;

export interface OpponentVisiblePlayerInfo {
  readonly playerId: string;
  readonly seat: number;
  readonly position: string;
  readonly dealtIn: true;
  readonly folded: boolean;
  readonly startingStackMilliBb: number;
  readonly currentStackMilliBb: number;
  readonly streetContributionMilliBb: number;
  readonly totalPotContributionMilliBb: number;
}

export interface OpponentActionSummary {
  readonly street: Street;
  readonly playerId: string;
  readonly type: ActionType;
  readonly amountToMilliBb: number | null;
  readonly committedMilliBb: number;
}

export interface OpponentActorInformation {
  readonly schemaVersion: typeof OPPONENT_ACTOR_INFORMATION_VERSION;
  readonly actorSeat: number;
  readonly actingPlayerId: string;
  readonly ownCards: readonly string[] | null;
  readonly street: Street;
  readonly board: readonly string[];
  readonly buttonSeat: number;
  readonly potMilliBb: number;
  readonly currentBetMilliBb: number;
  readonly lastFullRaiseIncrementMilliBb: number;
  readonly game: {
    readonly smallBlindMilliBb: number;
    readonly bigBlindMilliBb: number;
    readonly chipUnitMilliBb: number;
  };
  readonly players: readonly OpponentVisiblePlayerInfo[];
  readonly actionHistory: readonly OpponentActionSummary[];
  readonly legalActionSpec: LegalActionSpec;
}

export interface CreateOpponentActorInformationInput {
  readonly pokerState: PokerState;
  readonly actorSeat: number;
  readonly ownCards?: readonly string[] | null;
}

/**
 * Privacy allowlist (never a redacted PokerState) ensuring a bot/opponent sees
 * only public table facts, its own private cards, and its legal actions.
 */
export function createOpponentActorInformation({
  pokerState,
  actorSeat,
  ownCards = null,
}: CreateOpponentActorInformationInput): OpponentActorInformation {
  const validState = validatePokerState(pokerState);
  const actor = playerById(validState, validState.actingPlayerId);
  if (!actor || actor.seat !== actorSeat) {
    throw new RangeError('Expected the current actor seat');
  }
  const cards = ownCards ?? (Array.isArray(actor.holeCards) ? actor.holeCards : null);
  if (cards !== null) {
    const checked = assertCardArray(cards, 'actor private cards');
    if (checked.length !== 2) throw new RangeError('Actor requires exactly two private cards');
    assertUniqueKnownCards([
      { label: 'actor', cards: checked },
      { label: 'board', cards: validState.board },
    ]);
    if (Array.isArray(actor.holeCards) && !dataEquals(checked, actor.holeCards)) {
      throw new RangeError('Actor private cards disagree with canonical known cards');
    }
  }
  const information: OpponentActorInformation = {
    schemaVersion: OPPONENT_ACTOR_INFORMATION_VERSION,
    actorSeat,
    actingPlayerId: actor.playerId,
    ownCards: cards === null ? null : [...cards],
    street: validState.street,
    board: [...validState.board],
    buttonSeat: validState.buttonSeat,
    potMilliBb: validState.potMilliBb,
    currentBetMilliBb: validState.currentBetMilliBb,
    lastFullRaiseIncrementMilliBb: validState.lastFullRaiseIncrementMilliBb,
    game: {
      smallBlindMilliBb: validState.game.smallBlindMilliBb,
      bigBlindMilliBb: validState.game.bigBlindMilliBb,
      chipUnitMilliBb: validState.game.chipUnitMilliBb,
    },
    players: validState.players.map((player) => ({
      playerId: player.playerId,
      seat: player.seat,
      position: player.position,
      dealtIn: player.dealtIn,
      folded: player.folded,
      startingStackMilliBb: player.startingStackMilliBb,
      currentStackMilliBb: player.currentStackMilliBb,
      streetContributionMilliBb: player.streetContributionMilliBb,
      totalPotContributionMilliBb: player.totalPotContributionMilliBb,
    })),
    actionHistory: validState.actionHistory.map((record) => ({
      street: record.street,
      playerId: record.playerId,
      type: record.submittedAction.type,
      amountToMilliBb: record.submittedAction.amountToMilliBb,
      committedMilliBb: record.committedMilliBb,
    })),
    legalActionSpec: getLegalActionSpec(validState),
  };
  return deepFreeze(cloneData(information));
}

export const CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSION = 'canonical-hand-replay-source/v1' as const;
export const CANONICAL_HAND_REPLAY_SOURCE_V2_SCHEMA_VERSION = 'canonical-hand-replay-source/v2' as const;
export const CANONICAL_HAND_REPLAY_SOURCE_V3_SCHEMA_VERSION = 'canonical-hand-replay-source/v3' as const;
export const CANONICAL_HAND_REPLAY_EVENT_SCHEMA_VERSION = 'canonical-hand-replay-event/v1' as const;
export const CANONICAL_HAND_REPLAY_EVENT_V2_SCHEMA_VERSION = 'canonical-hand-replay-event/v2' as const;
export const CANONICAL_HAND_REPLAY_EVENT_V3_SCHEMA_VERSION = 'canonical-hand-replay-event/v3' as const;
export const CANONICAL_HAND_REPLAY_RECONSTRUCTION_SCHEMA_VERSION =
  'canonical-hand-replay-reconstruction/v1' as const;

export const CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSIONS = Object.freeze([
  CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSION,
  CANONICAL_HAND_REPLAY_SOURCE_V2_SCHEMA_VERSION,
  CANONICAL_HAND_REPLAY_SOURCE_V3_SCHEMA_VERSION,
] as const);

export const CANONICAL_HAND_REPLAY_EVENT_SCHEMA_VERSIONS = Object.freeze([
  CANONICAL_HAND_REPLAY_EVENT_SCHEMA_VERSION,
  CANONICAL_HAND_REPLAY_EVENT_V2_SCHEMA_VERSION,
  CANONICAL_HAND_REPLAY_EVENT_V3_SCHEMA_VERSION,
] as const);

export const REPLAY_FRAME_OPERATIONS = Object.freeze({
  INITIALIZE_HAND: 'initialize_hand',
  DEAL_HOLE: 'deal_hole',
  DEAL_HOLE_OBSERVED: 'deal_hole_observed',
  REVEAL_HOLE: 'reveal_hole',
  DEAL_BOARD: 'deal_board',
  ACTION: 'action',
  SHOWDOWN: 'showdown',
  RECORDED_SETTLEMENT: 'recorded_settlement',
} as const);

export type ReplayFrameOperation =
  (typeof REPLAY_FRAME_OPERATIONS)[keyof typeof REPLAY_FRAME_OPERATIONS];
export type CanonicalHandReplaySourceVersion =
  (typeof CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSIONS)[number];
export type CanonicalHandReplayEventVersion =
  (typeof CANONICAL_HAND_REPLAY_EVENT_SCHEMA_VERSIONS)[number];

interface ReplayVersionContract {
  readonly sourceSchemaVersion: CanonicalHandReplaySourceVersion;
  readonly eventSchemaVersion: CanonicalHandReplayEventVersion;
  readonly pokerStateSchemaVersion: PokerStateSchemaVersion;
  readonly initialize: (config: unknown) => PokerState;
}

const SUPPORTED_OPERATIONS = new Set<string>(Object.values(REPLAY_FRAME_OPERATIONS));

const REPLAY_VERSION_CONTRACTS: Readonly<
  Record<CanonicalHandReplaySourceVersion, ReplayVersionContract>
> = Object.freeze({
  [CANONICAL_HAND_REPLAY_SOURCE_V3_SCHEMA_VERSION]: Object.freeze({
    sourceSchemaVersion: CANONICAL_HAND_REPLAY_SOURCE_V3_SCHEMA_VERSION,
    eventSchemaVersion: CANONICAL_HAND_REPLAY_EVENT_V3_SCHEMA_VERSION,
    pokerStateSchemaVersion: POKER_STATE_V3_SCHEMA_VERSION,
    initialize: (config: unknown) => initializeRecordedHand(config as InitializeSnapshotHandConfig),
  }),
  [CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSION]: Object.freeze({
    sourceSchemaVersion: CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSION,
    eventSchemaVersion: CANONICAL_HAND_REPLAY_EVENT_SCHEMA_VERSION,
    pokerStateSchemaVersion: POKER_STATE_SCHEMA_VERSION,
    initialize: (config: unknown) => initializeHand(config as InitializeLegacyHandConfig),
  }),
  [CANONICAL_HAND_REPLAY_SOURCE_V2_SCHEMA_VERSION]: Object.freeze({
    sourceSchemaVersion: CANONICAL_HAND_REPLAY_SOURCE_V2_SCHEMA_VERSION,
    eventSchemaVersion: CANONICAL_HAND_REPLAY_EVENT_V2_SCHEMA_VERSION,
    pokerStateSchemaVersion: POKER_STATE_V2_SCHEMA_VERSION,
    initialize: (config: unknown) =>
      initializeHandFromGameRulesSnapshot(config as InitializeSnapshotHandConfig),
  }),
});

const REPLAY_VERSION_CONTRACT_VALUES: readonly ReplayVersionContract[] = Object.freeze(
  Object.values(REPLAY_VERSION_CONTRACTS),
);

function replayContractForPokerStateVersion(
  schemaVersion: PokerStateSchemaVersion,
): ReplayVersionContract | null {
  return (
    REPLAY_VERSION_CONTRACT_VALUES.find(
      (contract) => contract.pokerStateSchemaVersion === schemaVersion,
    ) ?? null
  );
}

function replayContractForEventVersion(schemaVersion: unknown): ReplayVersionContract | null {
  return (
    REPLAY_VERSION_CONTRACT_VALUES.find(
      (contract) => contract.eventSchemaVersion === schemaVersion,
    ) ?? null
  );
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  value: unknown,
  expected: readonly string[],
  label: string,
): Record<string, unknown> {
  const obj = requireObject(value, label);
  const actual = Object.keys(obj).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new RangeError(`${label} must contain exactly ${sortedExpected.join(', ')}`);
  }
  return obj;
}

function requireSameState(actual: PokerState, expected: PokerState, label: string): void {
  if (!dataEquals(actual, expected)) {
    throw new RangeError(`${label} does not reproduce the recorded canonical PokerState`);
  }
}

function validateInitialConfigurationShape(
  configuration: unknown,
  contract: ReplayVersionContract,
): void {
  const configObj = requireExactKeys(
    configuration,
    contract.pokerStateSchemaVersion === POKER_STATE_SCHEMA_VERSION
      ? ['handId', 'game', 'buttonSeat', 'players']
      : ['handId', 'rulesSnapshot', 'buttonSeat', 'players'],
    'Replay initialization configuration',
  );
  if (contract.pokerStateSchemaVersion === POKER_STATE_SCHEMA_VERSION) {
    const game = requireExactKeys(
      configObj.game,
      ['mode', 'smallBlindMilliBb', 'bigBlindMilliBb', 'chipUnitMilliBb', 'ante'],
      'Replay initialization game',
    );
    requireExactKeys(game.ante, ['type', 'amountMilliBb'], 'Replay initialization ante');
  }
  if (!Array.isArray(configObj.players)) {
    throw new TypeError('Replay initialization players must be an array');
  }
  configObj.players.forEach((player, index) =>
    requireExactKeys(
      player,
      ['playerId', 'seat', 'startingStackMilliBb'],
      `Replay initialization player[${index}]`,
    ),
  );
}

function initialConfigurationFromState(state: PokerState): Record<string, unknown> {
  validatePokerState(state);
  const contract = replayContractForPokerStateVersion(state.schemaVersion);
  if (!contract) throw new TypeError(`Unsupported PokerState version: ${state.schemaVersion}`);
  const configuration: Record<string, unknown> =
    state.schemaVersion === POKER_STATE_SCHEMA_VERSION
      ? {
          handId: state.handId,
          game: {
            mode: (state.game as { mode: string }).mode,
            smallBlindMilliBb: state.game.smallBlindMilliBb,
            bigBlindMilliBb: state.game.bigBlindMilliBb,
            chipUnitMilliBb: state.game.chipUnitMilliBb,
            ante: cloneData(state.game.ante),
          },
          buttonSeat: state.buttonSeat,
          players: state.players.map((player) => ({
            playerId: player.playerId,
            seat: player.seat,
            startingStackMilliBb: player.startingStackMilliBb,
          })),
        }
      : {
          handId: state.handId,
          rulesSnapshot: state.rulesSnapshot,
          buttonSeat: state.buttonSeat,
          players: state.players.map((player) => ({
            playerId: player.playerId,
            seat: player.seat,
            startingStackMilliBb: player.startingStackMilliBb,
          })),
        };
  requireSameState(
    contract.initialize(configuration),
    state,
    'Replay initialization configuration',
  );
  return configuration;
}

function holeChanceEventFromStates(
  previousState: PokerState,
  state: PokerState,
  operation: ReplayFrameOperation,
): { type: typeof CHANCE_TYPES.DEAL_HOLE; cardsByPlayer: Record<string, string[]>; hiddenPlayerIds: string[] } {
  if (previousState.pendingChance?.type !== CHANCE_TYPES.DEAL_HOLE) {
    throw new RangeError('A private-deal Replay event requires pending deal_hole chance');
  }
  const cardsByPlayer: Record<string, string[]> = {};
  const hiddenPlayerIds: string[] = [];
  for (const player of state.players) {
    if (Array.isArray(player.holeCards)) cardsByPlayer[player.playerId] = [...player.holeCards];
    else if (isHiddenHoleCards(player.holeCards)) hiddenPlayerIds.push(player.playerId);
    else throw new RangeError('A private-deal Replay event must represent every dealt player');
  }
  if (operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE && hiddenPlayerIds.length !== 0) {
    throw new RangeError('deal_hole Replay events cannot contain observer-hidden private cards');
  }
  if (operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED && hiddenPlayerIds.length === 0) {
    throw new RangeError('deal_hole_observed Replay events require at least one hidden private hand');
  }
  return {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer,
    hiddenPlayerIds,
  };
}

function boardChanceEventFromStates(previousState: PokerState, state: PokerState) {
  const type = previousState.pendingChance?.type;
  if (
    type !== CHANCE_TYPES.DEAL_FLOP &&
    type !== CHANCE_TYPES.DEAL_TURN &&
    type !== CHANCE_TYPES.DEAL_RIVER
  ) {
    throw new RangeError('A board-deal Replay event requires a pending board chance event');
  }
  return {
    type,
    cards: state.board.slice(previousState.board.length),
  };
}

function actionFromStates(previousState: PokerState, state: PokerState): PokerAction {
  if (state.actionHistory.length !== previousState.actionHistory.length + 1) {
    throw new RangeError('A Replay action event must append exactly one canonical action record');
  }
  return cloneData(state.actionHistory.at(-1)!.submittedAction);
}

function revealEventFromStates(previousState: PokerState, state: PokerState): PrivateRevealEvent {
  const revealed = previousState.players.filter((previousPlayer) => {
    const nextPlayer = state.players.find((player) => player.playerId === previousPlayer.playerId);
    return isHiddenHoleCards(previousPlayer.holeCards) && Array.isArray(nextPlayer?.holeCards);
  });
  if (revealed.length !== 1) {
    throw new RangeError('A Replay private-reveal event must reveal exactly one hidden private hand');
  }
  const playerId = revealed[0]!.playerId;
  return {
    playerId,
    cards: [...(state.players.find((player) => player.playerId === playerId)!.holeCards as readonly string[])],
  };
}

export interface CanonicalHandReplayEvent {
  readonly schemaVersion: CanonicalHandReplayEventVersion;
  readonly sequence: number;
  readonly operation: ReplayFrameOperation;
  readonly payload: unknown;
}

export interface CanonicalHandReplaySource {
  readonly schemaVersion: CanonicalHandReplaySourceVersion;
  readonly heroPlayerId: string;
  readonly events: readonly CanonicalHandReplayEvent[];
}

export interface CanonicalHandReplayFrame {
  readonly sequence: number;
  readonly operation: ReplayFrameOperation;
  readonly heroPlayerId: string;
  readonly state: PokerState;
}

export interface CanonicalHandReplayReconstruction {
  readonly schemaVersion: typeof CANONICAL_HAND_REPLAY_RECONSTRUCTION_SCHEMA_VERSION;
  readonly heroPlayerId: string;
  readonly frames: readonly CanonicalHandReplayFrame[];
  readonly finalState: PokerState;
}

function validateEventEnvelope(
  rawEvent: unknown,
  expectedSequence: number,
  expectedSchemaVersion: CanonicalHandReplayEventVersion,
): CanonicalHandReplayEvent {
  const event = requireExactKeys(
    rawEvent,
    ['schemaVersion', 'sequence', 'operation', 'payload'],
    `CanonicalHandReplayEvent[${expectedSequence}]`,
  );
  if (
    !CANONICAL_HAND_REPLAY_EVENT_SCHEMA_VERSIONS.includes(
      event.schemaVersion as CanonicalHandReplayEventVersion,
    )
  ) {
    throw new TypeError(`Unsupported CanonicalHandReplayEvent version: ${String(event.schemaVersion)}`);
  }
  if (event.schemaVersion !== expectedSchemaVersion) {
    throw new TypeError(`Expected ${expectedSchemaVersion}`);
  }
  if (event.sequence !== expectedSequence) {
    throw new RangeError('Canonical Hand Replay event sequence must be contiguous');
  }
  if (typeof event.operation !== 'string' || !SUPPORTED_OPERATIONS.has(event.operation)) {
    throw new RangeError(`Unsupported canonical Replay operation: ${String(event.operation)}`);
  }
  return event as unknown as CanonicalHandReplayEvent;
}

function createEvent(
  sequence: number,
  operation: ReplayFrameOperation,
  payload: unknown,
  eventSchemaVersion: CanonicalHandReplayEventVersion,
): CanonicalHandReplayEvent {
  const event = {
    schemaVersion: eventSchemaVersion,
    sequence,
    operation,
    payload,
  };
  validateEventEnvelope(event, sequence, eventSchemaVersion);
  return event;
}

function applyReplayEvent(
  previousState: PokerState | null,
  event: CanonicalHandReplayEvent,
  contract: ReplayVersionContract,
): PokerState {
  if (event.operation === REPLAY_FRAME_OPERATIONS.RECORDED_SETTLEMENT) {
    if (contract.pokerStateSchemaVersion !== POKER_STATE_V3_SCHEMA_VERSION) {
      throw new RangeError('Recorded settlement requires Replay v3');
    }
    if (previousState === null || previousState.recordedSettlement !== null) {
      throw new RangeError(
        'Recorded settlement must occur exactly once after canonical progression',
      );
    }
    const payload = requireExactKeys(event.payload, ['evidence'], 'Replay recorded settlement');
    return applyRecordedSettlement(
      previousState,
      payload.evidence as RecordedHandSettlementEvidence,
    );
  }
  if (event.operation === REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND) {
    if (previousState !== null || event.sequence !== 0) {
      throw new RangeError('Canonical Hand Replay must initialize exactly once at sequence 0');
    }
    const payload = requireExactKeys(
      event.payload,
      ['configuration'],
      'Replay initialize payload',
    );
    validateInitialConfigurationShape(payload.configuration, contract);
    return contract.initialize(payload.configuration);
  }
  if (previousState === null) {
    throw new RangeError('Canonical Hand Replay must begin with initialization');
  }
  if (
    event.operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE ||
    event.operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED
  ) {
    const payload = requireExactKeys(
      event.payload,
      ['chanceEvent'],
      'Replay private-deal payload',
    );
    const chanceEvent = requireExactKeys(
      payload.chanceEvent,
      ['type', 'cardsByPlayer', 'hiddenPlayerIds'],
      'Replay private-deal chanceEvent',
    );
    const hiddenPlayerIds = chanceEvent.hiddenPlayerIds;
    if (
      event.operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE &&
      (!Array.isArray(hiddenPlayerIds) || hiddenPlayerIds.length !== 0)
    ) {
      throw new RangeError('deal_hole Replay events cannot contain hidden private hands');
    }
    if (
      event.operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED &&
      (!Array.isArray(hiddenPlayerIds) || hiddenPlayerIds.length === 0)
    ) {
      throw new RangeError('deal_hole_observed Replay events require hidden private hands');
    }
    return applyChance(previousState, chanceEvent as unknown as ChanceEvent);
  }
  if (event.operation === REPLAY_FRAME_OPERATIONS.DEAL_BOARD) {
    const payload = requireExactKeys(event.payload, ['chanceEvent'], 'Replay board-deal payload');
    const chanceEvent = requireExactKeys(
      payload.chanceEvent,
      ['type', 'cards'],
      'Replay board-deal chanceEvent',
    );
    if (chanceEvent.type === CHANCE_TYPES.DEAL_HOLE) {
      throw new RangeError('A board-deal Replay event cannot deal private cards');
    }
    return applyChance(previousState, chanceEvent as unknown as ChanceEvent);
  }
  if (event.operation === REPLAY_FRAME_OPERATIONS.ACTION) {
    const payload = requireExactKeys(event.payload, ['action'], 'Replay action payload');
    return applyAction(previousState, payload.action as PokerAction);
  }
  if (event.operation === REPLAY_FRAME_OPERATIONS.REVEAL_HOLE) {
    const payload = requireExactKeys(
      event.payload,
      ['revealEvent'],
      'Replay private-reveal payload',
    );
    const revealEvent = requireExactKeys(
      payload.revealEvent,
      ['playerId', 'cards'],
      'Replay private-reveal event',
    );
    return applyPrivateReveal(previousState, revealEvent as unknown as PrivateRevealEvent);
  }
  if (event.operation === REPLAY_FRAME_OPERATIONS.SHOWDOWN) {
    if (event.payload !== null) throw new RangeError('Replay showdown payload must be null');
    return resolveShowdown(previousState);
  }
  throw new RangeError(`Unsupported canonical Replay operation: ${String(event.operation)}`);
}

function reconstruct(rawSource: unknown): CanonicalHandReplayReconstruction {
  const source = requireExactKeys(
    rawSource,
    ['schemaVersion', 'heroPlayerId', 'events'],
    'CanonicalHandReplaySource',
  );
  const contract =
    REPLAY_VERSION_CONTRACTS[source.schemaVersion as CanonicalHandReplaySourceVersion];
  if (!contract) {
    throw new TypeError(
      `Unsupported CanonicalHandReplaySource version: ${String(source.schemaVersion)}`,
    );
  }
  if (typeof source.heroPlayerId !== 'string' || !source.heroPlayerId.trim()) {
    throw new TypeError('CanonicalHandReplaySource.heroPlayerId is required');
  }
  const heroPlayerId = source.heroPlayerId;
  if (!Array.isArray(source.events) || source.events.length === 0) {
    throw new RangeError('CanonicalHandReplaySource.events must begin with initialization');
  }

  let state: PokerState | null = null;
  const frames: CanonicalHandReplayFrame[] = source.events.map((rawEvent, sequence) => {
    const event = validateEventEnvelope(rawEvent, sequence, contract.eventSchemaVersion);
    state = applyReplayEvent(state, event, contract);
    validatePokerState(state);
    if (state.schemaVersion !== contract.pokerStateSchemaVersion) {
      throw new RangeError('Canonical Hand Replay state version does not match its source version');
    }
    if (!state.players.some((player) => player.playerId === heroPlayerId)) {
      throw new RangeError('Canonical Hand Replay Hero must remain seated in every state');
    }
    return {
      sequence,
      operation: event.operation,
      heroPlayerId,
      state,
    };
  });

  return {
    schemaVersion: CANONICAL_HAND_REPLAY_RECONSTRUCTION_SCHEMA_VERSION,
    heroPlayerId,
    frames,
    finalState: state!,
  };
}

/** Derive one canonical Replay transition event from adjacent truthful PokerStates. */
export function deriveCanonicalHandReplayEvent({
  sequence,
  operation,
  previousState = null,
  state,
}: {
  readonly sequence: number;
  readonly operation: ReplayFrameOperation;
  readonly previousState?: PokerState | null;
  readonly state: PokerState;
}): CanonicalHandReplayEvent {
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new RangeError('Canonical Hand Replay sequence must be a nonnegative integer');
  }
  const validState = validatePokerState(state);
  const validPrev = previousState === null ? null : validatePokerState(previousState);

  let payload: unknown;
  const contract = replayContractForPokerStateVersion(validState.schemaVersion);
  if (!contract) throw new TypeError(`Unsupported PokerState version: ${validState.schemaVersion}`);
  if (operation === REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND) {
    if (validPrev !== null || sequence !== 0) {
      throw new RangeError('Replay initialization must be the first event');
    }
    payload = { configuration: initialConfigurationFromState(validState) };
  } else if (
    operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE ||
    operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED
  ) {
    if (validPrev === null) {
      throw new RangeError('A private-deal Replay event requires a previous PokerState');
    }
    payload = { chanceEvent: holeChanceEventFromStates(validPrev, validState, operation) };
  } else if (operation === REPLAY_FRAME_OPERATIONS.DEAL_BOARD) {
    if (validPrev === null) {
      throw new RangeError('A board-deal Replay event requires a previous PokerState');
    }
    payload = { chanceEvent: boardChanceEventFromStates(validPrev, validState) };
  } else if (operation === REPLAY_FRAME_OPERATIONS.ACTION) {
    if (validPrev === null) {
      throw new RangeError('A Replay action event requires a previous PokerState');
    }
    payload = { action: actionFromStates(validPrev, validState) };
  } else if (operation === REPLAY_FRAME_OPERATIONS.REVEAL_HOLE) {
    if (validPrev === null) {
      throw new RangeError('A Replay private-reveal event requires a previous PokerState');
    }
    payload = { revealEvent: revealEventFromStates(validPrev, validState) };
  } else if (operation === REPLAY_FRAME_OPERATIONS.SHOWDOWN) {
    payload = null;
  } else if (operation === REPLAY_FRAME_OPERATIONS.RECORDED_SETTLEMENT) {
    const settled = validState.recordedSettlement;
    if (!settled) {
      throw new RangeError('Replay recorded settlement requires state.recordedSettlement');
    }
    payload = {
      evidence: {
        schemaVersion: settled.schemaVersion,
        grossPotMilliBb: settled.grossPotMilliBb,
        rakeMilliBb: settled.rakeMilliBb,
        payoutsMilliBbByPlayer: settled.payoutsMilliBbByPlayer,
      },
    };
  } else {
    throw new RangeError(`Unsupported canonical Replay operation: ${String(operation)}`);
  }

  if (validPrev !== null && validPrev.schemaVersion !== contract.pokerStateSchemaVersion) {
    throw new RangeError('Canonical Hand Replay cannot mix PokerState versions');
  }
  const event = createEvent(sequence, operation, payload, contract.eventSchemaVersion);
  requireSameState(
    applyReplayEvent(validPrev, event, contract),
    validState,
    `Canonical Hand Replay event ${sequence}`,
  );
  return deepFreeze(event);
}

export function createCanonicalHandReplaySource({
  schemaVersion = null,
  heroPlayerId,
  events,
}: {
  readonly schemaVersion?: CanonicalHandReplaySourceVersion | null;
  readonly heroPlayerId: string;
  readonly events: readonly CanonicalHandReplayEvent[];
}): CanonicalHandReplaySource {
  const inferredContract = replayContractForEventVersion(events?.[0]?.schemaVersion);
  const contract =
    schemaVersion === null ? inferredContract : REPLAY_VERSION_CONTRACTS[schemaVersion];
  if (!contract) {
    throw new TypeError(
      `Unsupported Canonical Hand Replay version: ${String(schemaVersion ?? events?.[0]?.schemaVersion)}`,
    );
  }
  if (inferredContract !== contract) {
    throw new RangeError('Canonical Hand Replay source and event versions must agree');
  }
  const source: CanonicalHandReplaySource = cloneData({
    schemaVersion: contract.sourceSchemaVersion,
    heroPlayerId,
    events,
  });
  reconstruct(source);
  return deepFreeze(source);
}

export function validateCanonicalHandReplaySource(source: unknown): CanonicalHandReplaySource {
  reconstruct(source);
  return source as CanonicalHandReplaySource;
}

export function reconstructCanonicalHandReplaySource(
  source: unknown,
): CanonicalHandReplayReconstruction {
  return deepFreeze(reconstruct(source));
}

export function canonicalPokerStatesEqual(left: unknown, right: unknown): boolean {
  return dataEquals(left, right);
}

export const TRAINING_MEMORY_PRESENTATION_GATE_SCHEMA_VERSION =
  'training-memory-presentation-gate/v1' as const;

export interface TrainingMemoryPresentationGate {
  readonly schemaVersion: typeof TRAINING_MEMORY_PRESENTATION_GATE_SCHEMA_VERSION;
  readonly feedbackEmbargoed: boolean;
  readonly revealAnswerAndReference: boolean;
  readonly revealReviewReasons: boolean;
  readonly revealSessionVerdict: boolean;
}

/** Embargoes solution/review feedback while a live Full Hand training session is active. */
export function createTrainingMemoryPresentationGate(
  session: { readonly mode?: string; readonly status?: string } | null | undefined,
  { fullHandReviewUnlocked = false }: { readonly fullHandReviewUnlocked?: boolean } = {},
): TrainingMemoryPresentationGate {
  const feedbackEmbargoed =
    session?.mode === 'full_hand' &&
    session?.status === 'active' &&
    fullHandReviewUnlocked !== true;
  return Object.freeze({
    schemaVersion: TRAINING_MEMORY_PRESENTATION_GATE_SCHEMA_VERSION,
    feedbackEmbargoed,
    revealAnswerAndReference: !feedbackEmbargoed,
    revealReviewReasons: !feedbackEmbargoed,
    revealSessionVerdict: !feedbackEmbargoed,
  });
}
