import { assertCardArray, assertUniqueKnownCards, type CardGroup } from './cards';
import { assertMilliBb, assertMilliBbAlignment, assertPositiveMilliBb } from './amounts';
import { validateRecordedSettlementState } from './recorded-settlement';
import { validateAction } from './action';
import {
  GAME_RULES_COLLECTION_TYPES,
  GAME_RULES_SNAPSHOT_V2_SCHEMA_VERSION,
  type GameRulesSnapshot,
} from './game-rules';
import { derivePotLayers } from './pot-layers';
import { normalizePokerStateRulesSnapshot } from './poker-state-rules';
import { areHoleCardsDealt, isHiddenHoleCards, validateHiddenHoleCards } from './private-cards';
import {
  deriveSeatAssignments,
  playersClockwiseAfterSeat,
  POSITIONS_BY_TABLE_SIZE,
} from './positions';
import {
  isBettingRoundComplete,
  isPlayerAllIn,
  isPlayerLive,
  playerNeedsAction,
} from './selectors';
import {
  ANTE_TYPES,
  CHANCE_TYPES,
  CLUBGG_FORCED_CONTRIBUTION_MILLI_BB,
  GAME_MODES,
  LEDGER_KINDS,
  LEDGER_MOVEMENTS,
  PHASES,
  POKER_ACTION_RECORD_SCHEMA_VERSION,
  POKER_HAND_RANK_SCHEMA_VERSION,
  POKER_SHOWDOWN_LAYER_RESULT_SCHEMA_VERSION,
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_V2_SCHEMA_VERSION,
  POKER_STATE_V3_SCHEMA_VERSION,
  POKER_VARIANT,
  STREETS,
  type ChanceType,
  type PokerHandRank,
  type PokerState,
  type Street,
} from './schema';

const values = <T extends object>(object: T): Array<T[keyof T]> =>
  Object.values(object) as Array<T[keyof T]>;

const BOARD_LENGTH_BY_STREET: Readonly<Record<Street, number>> = Object.freeze({
  [STREETS.PREFLOP]: 0,
  [STREETS.FLOP]: 3,
  [STREETS.TURN]: 4,
  [STREETS.RIVER]: 5,
});

const CHANCE_CARD_COUNT: Readonly<Partial<Record<ChanceType, number>>> = Object.freeze({
  [CHANCE_TYPES.DEAL_FLOP]: 3,
  [CHANCE_TYPES.DEAL_TURN]: 1,
  [CHANCE_TYPES.DEAL_RIVER]: 1,
});

const POKER_STATE_V2_GAME_KEYS = Object.freeze([
  'variant',
  'format',
  'tableSize',
  'smallBlindMilliBb',
  'bigBlindMilliBb',
  'chipUnitMilliBb',
  'ante',
]);
const POKER_STATE_V2_ANTE_KEYS = Object.freeze(['type', 'amountMilliBb']);

const COMMON_LEDGER_KINDS = [
  LEDGER_KINDS.ANTE,
  LEDGER_KINDS.SMALL_BLIND,
  LEDGER_KINDS.BIG_BLIND,
  LEDGER_KINDS.ACTION,
  LEDGER_KINDS.UNCALLED_REFUND,
  LEDGER_KINDS.POT_AWARD,
] as const;

const POKER_STATE_V1_LEDGER_KINDS = new Set<string>([
  LEDGER_KINDS.CLUBGG_FORCED_CONTRIBUTION,
  ...COMMON_LEDGER_KINDS,
]);
const POKER_STATE_V2_LEDGER_KINDS = new Set<string>([
  LEDGER_KINDS.FIXED_PLAYER_COLLECTION,
  ...COMMON_LEDGER_KINDS,
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sameNumericRecord(left: unknown, right: unknown): boolean {
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => Object.hasOwn(right, key) && left[key] === right[key])
  );
}

function requireExactKeys(value: unknown, expected: readonly string[], label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new RangeError(`${label} must contain exactly: ${wanted.join(', ')}`);
  }
  return value;
}

function validatePokerStateV2Rules(state: Record<string, unknown>): GameRulesSnapshot {
  const rulesSnapshot = normalizePokerStateRulesSnapshot(state.rulesSnapshot);
  const game = requireExactKeys(state.game, POKER_STATE_V2_GAME_KEYS, 'PokerState v2 game');
  const ante = requireExactKeys(game.ante, POKER_STATE_V2_ANTE_KEYS, 'PokerState v2 game.ante');
  const players = state.players as readonly unknown[];
  const { definition } = rulesSnapshot;
  if (rulesSnapshot.setup.seatedPlayers !== players.length) {
    throw new RangeError('GameRulesSnapshot.setup.seatedPlayers must match players');
  }
  if (
    players.length < definition.tableSize.minimumSeated ||
    players.length > definition.tableSize.maximumSeated
  ) {
    throw new RangeError('PokerState v2 players must fit the rules table-size policy');
  }
  if (
    game.variant !== definition.variant ||
    game.format !== definition.format ||
    game.tableSize !== players.length ||
    game.smallBlindMilliBb !== definition.blinds.smallBlindMilliBb ||
    game.bigBlindMilliBb !== definition.blinds.bigBlindMilliBb ||
    game.chipUnitMilliBb !== definition.blinds.chipUnitMilliBb ||
    ante.type !== definition.ante.type ||
    ante.amountMilliBb !== definition.ante.amountMilliBb
  ) {
    throw new RangeError('PokerState v2 game must exactly project its GameRulesSnapshot');
  }
  return rulesSnapshot;
}

function validatePokerStateV2Collection(state: PokerState, rulesSnapshot: GameRulesSnapshot): void {
  const collectionEntries = state.ledger.filter(
    (entry) => entry.kind === LEDGER_KINDS.FIXED_PLAYER_COLLECTION,
  );
  const { collectionPolicy } = rulesSnapshot.definition;
  const policyType: string = collectionPolicy.type;
  if (collectionPolicy.type === GAME_RULES_COLLECTION_TYPES.NONE) {
    if (collectionEntries.length !== 0 || state.deductionTotalMilliBb !== 0) {
      throw new RangeError('No-collection PokerState v2 cannot contain non-pot deductions');
    }
    return;
  }
  if (collectionPolicy.type !== GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER) {
    throw new RangeError(`Unsupported PokerState v2 collection policy: ${policyType}`);
  }

  const policyAmount = collectionPolicy.amountMilliBb;
  if (collectionEntries.length !== state.players.length) {
    throw new RangeError('Fixed collection must occur exactly once per seated player');
  }

  const collectedPlayerIds = new Set<string>();
  for (let index = 0; index < collectionEntries.length; index += 1) {
    const entry = collectionEntries[index]!;
    if (
      entry.sequence !== index ||
      state.ledger[index] !== entry ||
      entry.street !== 'hand' ||
      entry.movement !== LEDGER_MOVEMENTS.STACK_TO_DEDUCTION ||
      entry.amountMilliBb !== policyAmount
    ) {
      throw new RangeError('Fixed collection must be exact and precede antes and blinds');
    }
    if (entry.playerId === null || collectedPlayerIds.has(entry.playerId)) {
      throw new RangeError('Fixed collection cannot be applied more than once to a player');
    }
    collectedPlayerIds.add(entry.playerId);
  }
  if (
    state.players.some(
      (player) =>
        !collectedPlayerIds.has(player.playerId) ||
        player.totalDeductionMilliBb !== policyAmount,
    )
  ) {
    throw new RangeError('Fixed collection ledger must agree with every player deduction');
  }
  const expectedTotal = policyAmount * state.players.length;
  if (!Number.isSafeInteger(expectedTotal) || state.deductionTotalMilliBb !== expectedTotal) {
    throw new RangeError('Fixed collection total must equal amount times seated players');
  }
}

export function validateGameConfiguration(game: unknown, tableSize: unknown): number {
  if (!isRecord(game)) throw new TypeError('game configuration is required');
  if (!values(GAME_MODES).includes(game.mode as (typeof GAME_MODES)[keyof typeof GAME_MODES])) {
    throw new RangeError('Unsupported game mode');
  }
  if (!Number.isInteger(tableSize) || (tableSize as number) < 2 || (tableSize as number) > 10) {
    throw new RangeError('tableSize must be between 2 and 10');
  }
  if (game.mode === GAME_MODES.CLUBGG && (tableSize as number) < 7) {
    throw new RangeError('ClubGG mode requires 7 through 10 seated players');
  }

  const chipUnitMilliBb = assertPositiveMilliBb(game.chipUnitMilliBb, 'game.chipUnitMilliBb');
  const smallBlindMilliBb = assertPositiveMilliBb(game.smallBlindMilliBb, 'game.smallBlindMilliBb');
  const bigBlindMilliBb = assertPositiveMilliBb(game.bigBlindMilliBb, 'game.bigBlindMilliBb');
  if (bigBlindMilliBb !== 1000) {
    throw new RangeError('game.bigBlindMilliBb must equal 1000 because amounts are denominated in milliBb');
  }
  if (smallBlindMilliBb > bigBlindMilliBb) {
    throw new RangeError('game.smallBlindMilliBb cannot exceed game.bigBlindMilliBb');
  }
  assertMilliBbAlignment(smallBlindMilliBb, chipUnitMilliBb, 'game.smallBlindMilliBb');
  assertMilliBbAlignment(bigBlindMilliBb, chipUnitMilliBb, 'game.bigBlindMilliBb');

  if (
    !isRecord(game.ante) ||
    !values(ANTE_TYPES).includes(game.ante.type as (typeof ANTE_TYPES)[keyof typeof ANTE_TYPES])
  ) {
    throw new RangeError('Unsupported ante type');
  }
  const anteAmount = assertMilliBbAlignment(
    game.ante.amountMilliBb,
    chipUnitMilliBb,
    'game.ante.amountMilliBb',
  );
  if (game.ante.type === ANTE_TYPES.NONE && anteAmount !== 0) {
    throw new RangeError('A none ante must have amountMilliBb 0');
  }
  if (game.ante.type !== ANTE_TYPES.NONE && anteAmount === 0) {
    throw new RangeError('An enabled ante must have a positive amountMilliBb');
  }

  const forced = game.mode === GAME_MODES.CLUBGG ? CLUBGG_FORCED_CONTRIBUTION_MILLI_BB : 0;
  assertMilliBbAlignment(forced, chipUnitMilliBb, 'forcedContributionPerPlayerMilliBb');
  return forced;
}

export function validatePokerState(rawState: unknown): PokerState {
  if (
    !isRecord(rawState) ||
    ![
      POKER_STATE_SCHEMA_VERSION,
      POKER_STATE_V2_SCHEMA_VERSION,
      POKER_STATE_V3_SCHEMA_VERSION,
    ].includes(rawState.schemaVersion as typeof POKER_STATE_SCHEMA_VERSION)
  ) {
    throw new TypeError(
      `Expected ${POKER_STATE_SCHEMA_VERSION} or ${POKER_STATE_V2_SCHEMA_VERSION}`,
    );
  }
  const isV3 = rawState.schemaVersion === POKER_STATE_V3_SCHEMA_VERSION;
  const isV2 = isV3 || rawState.schemaVersion === POKER_STATE_V2_SCHEMA_VERSION;
  if (!isV3 && Object.hasOwn(rawState, 'recordedSettlement')) {
    throw new RangeError('Recorded settlement requires PokerState v3');
  }
  if (!isRecord(rawState.game) || rawState.game.variant !== POKER_VARIANT) {
    throw new RangeError('Unsupported poker variant');
  }
  if (!values(PHASES).includes(rawState.phase as (typeof PHASES)[keyof typeof PHASES])) {
    throw new RangeError('Invalid phase');
  }
  if (!values(STREETS).includes(rawState.street as Street)) {
    throw new RangeError('Invalid street');
  }
  if (!Array.isArray(rawState.players)) throw new TypeError('state.players must be an array');

  let rulesSnapshot: GameRulesSnapshot | null = null;
  if (isV2) {
    rulesSnapshot = validatePokerStateV2Rules(rawState);
    if ((rulesSnapshot.schemaVersion === GAME_RULES_SNAPSHOT_V2_SCHEMA_VERSION) !== isV3) {
      throw new RangeError('PokerState and rules snapshot versions must match');
    }
    if (isV3 && !Object.hasOwn(rawState, 'recordedSettlement')) {
      throw new RangeError('PokerState v3 requires recordedSettlement');
    }
  } else {
    const expectedForcedContribution = validateGameConfiguration(
      rawState.game,
      rawState.players.length,
    );
    if (rawState.game.tableSize !== rawState.players.length) {
      throw new RangeError('game.tableSize must match players');
    }
    if (rawState.game.forcedContributionPerPlayerMilliBb !== expectedForcedContribution) {
      throw new RangeError('forcedContributionPerPlayerMilliBb does not match the game mode');
    }
  }
  if (!POSITIONS_BY_TABLE_SIZE[rawState.players.length]) {
    throw new RangeError('Unsupported table size');
  }

  const state = rawState as unknown as PokerState;
  const chipUnitMilliBb = state.game.chipUnitMilliBb;
  const ids = new Set<string>();
  const seats = new Set<number>();
  const cardGroups: CardGroup[] = [
    { label: 'board', cards: assertCardArray(state.board, 'board') },
    { label: 'deadCards', cards: assertCardArray(state.deadCards, 'deadCards') },
  ];

  for (const player of rawState.players as unknown[]) {
    if (!isRecord(player)) throw new TypeError('Each player must be an object');
    if (typeof player.playerId !== 'string' || !player.playerId.trim()) {
      throw new TypeError('playerId is required');
    }
    if (ids.has(player.playerId)) throw new RangeError(`Duplicate playerId: ${player.playerId}`);
    ids.add(player.playerId);
    if (
      !Number.isInteger(player.seat) ||
      (player.seat as number) < 0 ||
      (player.seat as number) > 9
    ) {
      throw new RangeError('seat must be an integer from 0 through 9');
    }
    const seat = player.seat as number;
    if (seats.has(seat)) throw new RangeError(`Duplicate seat: ${seat}`);
    seats.add(seat);
    if (player.seated !== true || player.dealtIn !== true) {
      throw new RangeError(
        `Sitting-out players are deferred in ${state.schemaVersion} initialization`,
      );
    }
    if (typeof player.folded !== 'boolean') throw new TypeError('player.folded must be boolean');
    if (typeof player.actedThisStreet !== 'boolean') {
      throw new TypeError('player.actedThisStreet must be boolean');
    }
    if (Object.hasOwn(player, 'allIn')) throw new RangeError('allIn must be derived, not stored');
    if (Object.hasOwn(player, 'totalHandContributionMilliBb')) {
      throw new RangeError('totalHandContributionMilliBb must be derived, not stored');
    }
    for (const field of [
      'startingStackMilliBb',
      'currentStackMilliBb',
      'streetContributionMilliBb',
      'totalPotContributionMilliBb',
      'totalDeductionMilliBb',
    ] as const) {
      assertMilliBbAlignment(player[field], chipUnitMilliBb, `player.${field}`);
    }
    if (
      (player.streetContributionMilliBb as number) >
      (player.totalPotContributionMilliBb as number)
    ) {
      throw new RangeError('street contribution cannot exceed total pot contribution');
    }
    if (player.raiseReopenAtMilliBb !== null) {
      assertMilliBbAlignment(
        player.raiseReopenAtMilliBb,
        chipUnitMilliBb,
        'player.raiseReopenAtMilliBb',
      );
    }
    if (Array.isArray(player.holeCards)) {
      const hole = assertCardArray(player.holeCards, `holeCards.${player.playerId}`);
      if (hole.length !== 2) throw new RangeError('Known holeCards must contain exactly two cards');
      cardGroups.push({ label: `holeCards.${player.playerId}`, cards: hole });
    } else if (player.holeCards !== null) {
      validateHiddenHoleCards(player.holeCards, `holeCards.${player.playerId}`);
    }
  }

  const uniqueKnownCards = assertUniqueKnownCards(cardGroups);
  if (state.board.length !== BOARD_LENGTH_BY_STREET[state.street]) {
    throw new RangeError(
      `Street ${state.street} requires exactly ${BOARD_LENGTH_BY_STREET[state.street]} board cards`,
    );
  }
  const hiddenHoleCardPlayers = state.players.filter((player) => isHiddenHoleCards(player.holeCards));
  const dealtHoleCardPlayers = state.players.filter((player) => areHoleCardsDealt(player.holeCards));
  if (dealtHoleCardPlayers.length !== 0 && dealtHoleCardPlayers.length !== state.players.length) {
    throw new RangeError(
      'Hole cards must be either entirely pending or dealt for every dealt-in player',
    );
  }
  if (uniqueKnownCards.size + hiddenHoleCardPlayers.length * 2 > 52) {
    throw new RangeError('Known and hidden physical card counts cannot exceed the deck');
  }
  if (!seats.has(state.buttonSeat)) throw new RangeError('buttonSeat must be occupied');
  const expectedAssignments = deriveSeatAssignments(state.players, state.buttonSeat);
  for (const assignment of expectedAssignments) {
    const player = state.players.find((candidate) => candidate.playerId === assignment.playerId)!;
    if (player.position !== assignment.position) {
      throw new RangeError(`Invalid position for ${player.playerId}`);
    }
  }

  for (const field of [
    'potMilliBb',
    'deductionTotalMilliBb',
    'currentBetMilliBb',
    'lastFullRaiseIncrementMilliBb',
  ] as const) {
    assertMilliBbAlignment(state[field], chipUnitMilliBb, field);
  }
  if (
    Object.hasOwn(rawState, 'minimumBetToMilliBb') ||
    Object.hasOwn(rawState, 'minimumRaiseToMilliBb')
  ) {
    throw new RangeError('Minimum bet and raise values must be derived, not stored');
  }
  if (
    state.potMilliBb >
    state.players.reduce((sum, player) => sum + player.totalPotContributionMilliBb, 0)
  ) {
    throw new RangeError('potMilliBb cannot exceed gross player pot contributions');
  }
  if (
    state.deductionTotalMilliBb !==
    state.players.reduce((sum, player) => sum + player.totalDeductionMilliBb, 0)
  ) {
    throw new RangeError('deductionTotalMilliBb must equal player deductions');
  }

  if (!Array.isArray(state.ledger)) throw new TypeError('ledger must be an array');
  let ledgerPot = 0;
  let ledgerDeduction = 0;
  let ledgerRecordedRake = 0;
  const ledgerPotByPlayer = new Map<string, number>(
    state.players.map((player) => [player.playerId, 0]),
  );
  const ledgerDeductionByPlayer = new Map<string, number>(
    state.players.map((player) => [player.playerId, 0]),
  );
  const streetPotByPlayer = new Map<string, number>(
    state.players.map((player) => [player.playerId, 0]),
  );
  state.ledger.forEach((entry, index) => {
    if (entry.sequence !== index) throw new RangeError('Ledger sequence must be contiguous');
    const rakeEntry = isV3 && entry.kind === LEDGER_KINDS.RECORDED_RAKE;
    if (rakeEntry ? entry.playerId !== null : entry.playerId === null || !ids.has(entry.playerId)) {
      throw new RangeError('Ledger entry refers to an unknown player');
    }
    const allowedLedgerKinds = isV2 ? POKER_STATE_V2_LEDGER_KINDS : POKER_STATE_V1_LEDGER_KINDS;
    if (!rakeEntry && !allowedLedgerKinds.has(entry.kind)) {
      throw new RangeError('Invalid ledger kind');
    }
    if (rakeEntry !== (entry.movement === LEDGER_MOVEMENTS.POT_TO_RECORDED_RAKE)) {
      throw new RangeError('Recorded rake must move from pot to recorded rake');
    }
    if (!values(LEDGER_MOVEMENTS).includes(entry.movement)) {
      throw new RangeError('Invalid ledger movement');
    }
    assertPositiveMilliBb(entry.amountMilliBb, 'ledger.amountMilliBb');
    assertMilliBbAlignment(entry.amountMilliBb, chipUnitMilliBb, 'ledger.amountMilliBb');
    if (
      entry.kind === LEDGER_KINDS.CLUBGG_FORCED_CONTRIBUTION &&
      entry.movement !== LEDGER_MOVEMENTS.STACK_TO_DEDUCTION
    ) {
      throw new RangeError('ClubGG contributions must be non-pot deductions');
    }
    if (
      entry.kind === LEDGER_KINDS.FIXED_PLAYER_COLLECTION &&
      entry.movement !== LEDGER_MOVEMENTS.STACK_TO_DEDUCTION
    ) {
      throw new RangeError('Fixed player collections must be non-pot deductions');
    }
    if (entry.kind === LEDGER_KINDS.FIXED_PLAYER_COLLECTION && entry.street !== 'hand') {
      throw new RangeError('Fixed player collections must occur at hand start');
    }
    if (
      (entry.kind === LEDGER_KINDS.ANTE ||
        entry.kind === LEDGER_KINDS.SMALL_BLIND ||
        entry.kind === LEDGER_KINDS.BIG_BLIND ||
        entry.kind === LEDGER_KINDS.ACTION) &&
      entry.movement !== LEDGER_MOVEMENTS.STACK_TO_POT
    ) {
      throw new RangeError('Antes, blinds, and actions must enter the pot');
    }
    if (
      (entry.kind === LEDGER_KINDS.UNCALLED_REFUND ||
        entry.kind === LEDGER_KINDS.POT_AWARD) &&
      entry.movement !== LEDGER_MOVEMENTS.POT_TO_STACK
    ) {
      throw new RangeError('Refunds and awards must move from pot to stack');
    }
    if (Object.hasOwn(entry, 'settlementReason')) {
      if (
        entry.kind !== LEDGER_KINDS.POT_AWARD ||
        entry.settlementReason !== 'showdown' ||
        !Number.isInteger(entry.potLayerIndex) ||
        (entry.potLayerIndex ?? -1) < 0
      ) {
        throw new RangeError('Showdown award metadata requires a nonnegative potLayerIndex');
      }
    }
    if (entry.movement === LEDGER_MOVEMENTS.STACK_TO_POT && entry.playerId !== null) {
      ledgerPot += entry.amountMilliBb;
      ledgerPotByPlayer.set(
        entry.playerId,
        (ledgerPotByPlayer.get(entry.playerId) ?? 0) + entry.amountMilliBb,
      );
    }
    if (entry.movement === LEDGER_MOVEMENTS.STACK_TO_DEDUCTION && entry.playerId !== null) {
      ledgerDeduction += entry.amountMilliBb;
      ledgerDeductionByPlayer.set(
        entry.playerId,
        (ledgerDeductionByPlayer.get(entry.playerId) ?? 0) + entry.amountMilliBb,
      );
    }
    if (rakeEntry) ledgerRecordedRake += entry.amountMilliBb;
    if (entry.movement === LEDGER_MOVEMENTS.POT_TO_STACK || rakeEntry) {
      ledgerPot -= entry.amountMilliBb;
      if (ledgerPot < 0) throw new RangeError('Ledger cannot credit more than the available pot');
    }
    if (
      entry.street === state.street &&
      entry.playerId !== null &&
      (entry.kind === LEDGER_KINDS.SMALL_BLIND ||
        entry.kind === LEDGER_KINDS.BIG_BLIND ||
        entry.kind === LEDGER_KINDS.ACTION)
    ) {
      streetPotByPlayer.set(
        entry.playerId,
        (streetPotByPlayer.get(entry.playerId) ?? 0) + entry.amountMilliBb,
      );
    }
  });
  if (ledgerPot !== state.potMilliBb || ledgerDeduction !== state.deductionTotalMilliBb) {
    throw new RangeError('Ledger totals must agree with state totals');
  }
  for (const player of state.players) {
    if (
      ledgerPotByPlayer.get(player.playerId) !== player.totalPotContributionMilliBb ||
      ledgerDeductionByPlayer.get(player.playerId) !== player.totalDeductionMilliBb ||
      streetPotByPlayer.get(player.playerId) !== player.streetContributionMilliBb
    ) {
      throw new RangeError(`Ledger does not agree with player totals for ${player.playerId}`);
    }
  }
  if (isV2 && rulesSnapshot) validatePokerStateV2Collection(state, rulesSnapshot);

  const startingStacks = state.players.reduce((sum, player) => sum + player.startingStackMilliBb, 0);
  const currentStacks = state.players.reduce((sum, player) => sum + player.currentStackMilliBb, 0);
  if (
    startingStacks !==
    currentStacks + state.potMilliBb + state.deductionTotalMilliBb + ledgerRecordedRake
  ) {
    throw new RangeError('Aggregate chips are not conserved');
  }

  if (!Array.isArray(state.actionHistory)) throw new TypeError('actionHistory must be an array');
  state.actionHistory.forEach((record, index) => {
    if (!record || record.schemaVersion !== POKER_ACTION_RECORD_SCHEMA_VERSION) {
      throw new TypeError(`Expected ${POKER_ACTION_RECORD_SCHEMA_VERSION}`);
    }
    if (record.sequence !== index) throw new RangeError('ActionRecord sequence must be contiguous');
    if (!ids.has(record.playerId)) throw new RangeError('ActionRecord refers to an unknown player');
    if (!values(STREETS).includes(record.street)) {
      throw new RangeError('ActionRecord has an invalid street');
    }
    validateAction(record.submittedAction, chipUnitMilliBb);
    if (record.submittedAction.playerId !== record.playerId) {
      throw new RangeError('ActionRecord player must match its submitted action');
    }
    for (const field of [
      'toCallBeforeMilliBb',
      'committedMilliBb',
      'streetContributionAfterMilliBb',
      'currentBetBeforeMilliBb',
      'currentBetAfterMilliBb',
    ] as const) {
      assertMilliBbAlignment(record[field], chipUnitMilliBb, `actionHistory.${field}`);
    }
    if (
      typeof record.wasAllIn !== 'boolean' ||
      typeof record.wasFullRaise !== 'boolean' ||
      typeof record.reopenedBetting !== 'boolean'
    ) {
      throw new TypeError('ActionRecord flags must be boolean');
    }
  });

  if (state.actingPlayerId !== null && !ids.has(state.actingPlayerId)) {
    throw new RangeError('actingPlayerId must identify a player or be null');
  }

  if (state.phase === PHASES.CHANCE) {
    if (!state.pendingChance || typeof state.pendingChance !== 'object') {
      throw new RangeError('A chance phase requires pendingChance');
    }
    let expectedChanceType: ChanceType;
    if (state.street === STREETS.PREFLOP) {
      expectedChanceType =
        dealtHoleCardPlayers.length === 0 ? CHANCE_TYPES.DEAL_HOLE : CHANCE_TYPES.DEAL_FLOP;
    } else if (state.street === STREETS.FLOP) {
      expectedChanceType = CHANCE_TYPES.DEAL_TURN;
    } else if (state.street === STREETS.TURN) {
      expectedChanceType = CHANCE_TYPES.DEAL_RIVER;
    } else {
      throw new RangeError('River cannot have a pending board chance event');
    }
    if (state.pendingChance.type !== expectedChanceType) {
      throw new RangeError(`Street ${state.street} requires pending chance ${expectedChanceType}`);
    }
    const expectedCardCount =
      expectedChanceType === CHANCE_TYPES.DEAL_HOLE
        ? state.players.length * 2
        : CHANCE_CARD_COUNT[expectedChanceType];
    if (state.pendingChance.cardCount !== expectedCardCount) {
      throw new RangeError(`Pending ${expectedChanceType} has an invalid card count`);
    }
  } else if (state.pendingChance !== null) {
    throw new RangeError('pendingChance is only valid during a chance phase');
  }

  if (state.phase !== PHASES.CHANCE && dealtHoleCardPlayers.length !== state.players.length) {
    throw new RangeError(
      'All dealt-in players require dealt hole cards outside the initial chance state',
    );
  }

  const currentStreetActions = state.actionHistory.filter(
    (record) => record.street === state.street,
  );
  if (state.street !== STREETS.PREFLOP && currentStreetActions.length === 0) {
    if (
      state.currentBetMilliBb !== 0 ||
      state.lastFullRaiseIncrementMilliBb !== state.game.bigBlindMilliBb ||
      state.lastAggressorPlayerId !== null ||
      state.players.some(
        (player) =>
          player.streetContributionMilliBb !== 0 ||
          player.actedThisStreet ||
          player.raiseReopenAtMilliBb !== null,
      )
    ) {
      throw new RangeError('A newly initialized postflop street must have reset betting state');
    }
  }

  if (state.street !== STREETS.PREFLOP && currentStreetActions.length > 0) {
    const maximumStreetContribution = state.players.reduce(
      (maximum, player) => Math.max(maximum, player.streetContributionMilliBb),
      0,
    );
    if (state.currentBetMilliBb !== maximumStreetContribution) {
      throw new RangeError('Postflop current bet must equal the greatest street contribution');
    }
  }

  const playersAbleToBet = state.players.filter(
    (player) => isPlayerLive(player) && !isPlayerAllIn(player),
  );
  const hasOutstandingCall = playersAbleToBet.some(
    (player) => player.streetContributionMilliBb < state.currentBetMilliBb,
  );
  const bettingIsResolved =
    isBettingRoundComplete(state) || (playersAbleToBet.length < 2 && !hasOutstandingCall);
  if (state.phase === PHASES.BETTING && state.actingPlayerId === null) {
    throw new RangeError('A betting state requires an acting player');
  }
  if (state.phase === PHASES.BETTING) {
    const actor = state.players.find((player) => player.playerId === state.actingPlayerId)!;
    if (!actor.dealtIn || actor.folded || actor.currentStackMilliBb === 0) {
      throw new RangeError('A betting actor must be live and have chips');
    }
    if (!playerNeedsAction(state, actor.playerId)) {
      throw new RangeError('The betting actor must still need action');
    }
    if (isBettingRoundComplete(state)) {
      throw new RangeError('A complete betting round cannot retain an actor');
    }
    if (
      state.street !== STREETS.PREFLOP &&
      playersAbleToBet.length < 2 &&
      !hasOutstandingCall
    ) {
      throw new RangeError(
        'Postflop betting cannot require a fake check from the only player with chips',
      );
    }
    if (state.street !== STREETS.PREFLOP && currentStreetActions.length === 0) {
      const expectedActor = playersClockwiseAfterSeat(state.players, state.buttonSeat).find(
        (player) => player.dealtIn && !player.folded && player.currentStackMilliBb > 0,
      );
      if (!expectedActor || state.actingPlayerId !== expectedActor.playerId) {
        throw new RangeError('A new postflop street must begin left of the button');
      }
    }
  }
  if (state.phase === PHASES.CHANCE && state.street !== STREETS.PREFLOP && !bettingIsResolved) {
    throw new RangeError('Postflop chance requires completed betting or no meaningful action');
  }
  const expectedShowdownEligiblePlayerIds = state.players
    .filter((player) => player.dealtIn && !player.folded)
    .map((player) => player.playerId);
  const settledShowdown =
    state.phase === PHASES.TERMINAL && state.terminal && state.terminal.reason === 'showdown';
  if (state.phase === PHASES.SHOWDOWN) {
    if (
      state.street !== STREETS.RIVER ||
      state.actingPlayerId !== null ||
      state.pendingChance !== null
    ) {
      throw new RangeError(
        'Showdown-ready state requires a complete river and no actor or chance',
      );
    }
    if (
      !state.showdown ||
      !['ready', 'awaiting_private_reveal'].includes(state.showdown.status) ||
      !bettingIsResolved
    ) {
      throw new RangeError('Showdown requires completed river betting or no meaningful action');
    }
    if (
      !Array.isArray(state.showdown.eligiblePlayerIds) ||
      state.showdown.eligiblePlayerIds.length !== expectedShowdownEligiblePlayerIds.length ||
      state.showdown.eligiblePlayerIds.some(
        (playerId, index) => playerId !== expectedShowdownEligiblePlayerIds[index],
      )
    ) {
      throw new RangeError('Showdown eligible players must match live players');
    }
    if (
      state.showdown.handRanksByPlayer !== null ||
      !Array.isArray(state.showdown.layerResults) ||
      state.showdown.layerResults.length !== 0
    ) {
      throw new RangeError('Showdown-ready state cannot contain settlement results');
    }
    const expectedRevealPlayerIds = state.players
      .filter((player) => isPlayerLive(player) && isHiddenHoleCards(player.holeCards))
      .map((player) => player.playerId);
    if (state.showdown.status === 'awaiting_private_reveal') {
      if (
        expectedRevealPlayerIds.length === 0 ||
        !Array.isArray(state.showdown.requiredRevealPlayerIds) ||
        state.showdown.requiredRevealPlayerIds.length !== expectedRevealPlayerIds.length ||
        state.showdown.requiredRevealPlayerIds.some(
          (playerId, index) => playerId !== expectedRevealPlayerIds[index],
        )
      ) {
        throw new RangeError('Awaiting showdown reveal IDs must match live hidden players');
      }
    } else if (
      expectedRevealPlayerIds.length !== 0 ||
      Object.hasOwn(state.showdown, 'requiredRevealPlayerIds')
    ) {
      throw new RangeError('Showdown cannot be ready while a live private hand is hidden');
    }
  } else if (settledShowdown) {
    if (
      !state.showdown ||
      state.showdown.status !== 'settled' ||
      state.street !== STREETS.RIVER ||
      state.actingPlayerId !== null ||
      state.pendingChance !== null
    ) {
      throw new RangeError('Settled showdown requires a complete river and no actor or chance');
    }
    if (
      !Array.isArray(state.showdown.eligiblePlayerIds) ||
      state.showdown.eligiblePlayerIds.length !== expectedShowdownEligiblePlayerIds.length ||
      state.showdown.eligiblePlayerIds.some(
        (playerId, index) => playerId !== expectedShowdownEligiblePlayerIds[index],
      )
    ) {
      throw new RangeError('Settled showdown eligible players must match live players');
    }
    if (
      !state.showdown.handRanksByPlayer ||
      typeof state.showdown.handRanksByPlayer !== 'object' ||
      Array.isArray(state.showdown.handRanksByPlayer) ||
      !Array.isArray(state.showdown.layerResults)
    ) {
      throw new RangeError('Settled showdown requires structural ranks and layer results');
    }
    const derivedLayers = derivePotLayers(state);
    if (state.showdown.layerResults.length !== derivedLayers.length) {
      throw new RangeError('Settled showdown results must match every derived pot layer');
    }
    const evaluatedPlayerIds = new Set(
      derivedLayers.flatMap((layer) => layer.eligiblePlayerIds),
    );
    const ranksRecord = state.showdown.handRanksByPlayer as Record<string, PokerHandRank>;
    const rankedPlayerIds = Object.keys(ranksRecord);
    if (
      rankedPlayerIds.length !== evaluatedPlayerIds.size ||
      rankedPlayerIds.some((playerId) => !evaluatedPlayerIds.has(playerId)) ||
      rankedPlayerIds.some(
        (playerId) => ranksRecord[playerId]?.schemaVersion !== POKER_HAND_RANK_SCHEMA_VERSION,
      )
    ) {
      throw new RangeError('Settled showdown ranks must match every evaluated player');
    }
    const aggregatePayouts: Record<string, number> = {};
    state.showdown.layerResults.forEach((result, index) => {
      const layer = derivedLayers[index]!;
      if (
        !result ||
        result.schemaVersion !== POKER_SHOWDOWN_LAYER_RESULT_SCHEMA_VERSION ||
        result.layerIndex !== index ||
        result.amountMilliBb !== layer.amountMilliBb ||
        result.contributionFloorMilliBb !== layer.contributionFloorMilliBb ||
        result.contributionCeilingMilliBb !== layer.contributionCeilingMilliBb ||
        !Array.isArray(result.eligiblePlayerIds) ||
        result.eligiblePlayerIds.length !== layer.eligiblePlayerIds.length ||
        result.eligiblePlayerIds.some(
          (playerId: string, playerIndex: number) => playerId !== layer.eligiblePlayerIds[playerIndex],
        ) ||
        !Array.isArray(result.winnerPlayerIds) ||
        result.winnerPlayerIds.length === 0 ||
        new Set(result.winnerPlayerIds).size !== result.winnerPlayerIds.length ||
        result.winnerPlayerIds.some(
          (playerId: string) => !layer.eligiblePlayerIds.includes(playerId),
        ) ||
        !result.payoutsMilliBbByPlayer ||
        typeof result.payoutsMilliBbByPlayer !== 'object'
      ) {
        throw new RangeError('Invalid settled showdown layer result');
      }
      const payoutMap = result.payoutsMilliBbByPlayer as Readonly<Record<string, number>>;
      const payoutIds = Object.keys(payoutMap);
      if (
        payoutIds.length !== result.winnerPlayerIds.length ||
        payoutIds.some((playerId) => !result.winnerPlayerIds.includes(playerId))
      ) {
        throw new RangeError('Layer payout recipients must match layer winners');
      }
      let layerPayout = 0;
      for (const [playerId, rawAmount] of Object.entries(payoutMap)) {
        const amountMilliBb = assertMilliBb(rawAmount, 'showdown.layer payout');
        assertMilliBbAlignment(amountMilliBb, chipUnitMilliBb, 'showdown.layer payout');
        layerPayout += amountMilliBb;
        aggregatePayouts[playerId] = (aggregatePayouts[playerId] ?? 0) + amountMilliBb;
        const rank = ranksRecord[playerId];
        if (!rank || rank.schemaVersion !== POKER_HAND_RANK_SCHEMA_VERSION) {
          throw new RangeError('Every showdown winner requires a canonical hand rank');
        }
      }
      if (layerPayout !== layer.amountMilliBb) {
        throw new RangeError('Layer payouts must equal the exact pot-layer amount');
      }
    });
    const expectedAggregate =
      isV3 && state.recordedSettlement
        ? state.recordedSettlement.grossPayoutsMilliBbByPlayer
        : state.terminal.payoutsMilliBbByPlayer;
    if (!sameNumericRecord(aggregatePayouts, expectedAggregate)) {
      throw new RangeError('Terminal showdown payouts must equal aggregate layer payouts');
    }
  } else if (!state.showdown || state.showdown.status !== 'not_reached') {
    throw new RangeError('Showdown status must remain not_reached before showdown');
  } else if (
    state.showdown.handRanksByPlayer !== null ||
    !Array.isArray(state.showdown.layerResults) ||
    state.showdown.layerResults.length !== 0
  ) {
    throw new RangeError('Unreached showdown cannot contain settlement results');
  }
  if (!state.showdown || !Array.isArray(state.showdown.pots) || state.showdown.pots.length !== 0) {
    throw new RangeError('showdown.pots is reserved; canonical pot layers are derived');
  }
  if (
    state.phase === PHASES.TERMINAL &&
    (state.actingPlayerId !== null ||
      state.potMilliBb !== 0 ||
      !state.terminal ||
      state.terminal.isTerminal !== true)
  ) {
    throw new RangeError(
      'A terminal state must have no actor, no unsettled pot, and terminal status',
    );
  }

  if (isV3) validateRecordedSettlementState(state, ledgerRecordedRake);
  return state;
}

export function validateInitializedPokerState(rawState: unknown): PokerState {
  const state = validatePokerState(rawState);
  const playerIds = new Set(state.players.map((player) => player.playerId));
  if (state.actionHistory.length !== 0) {
    throw new RangeError('ENGINE-002 initialized actionHistory must be empty');
  }
  if (
    state.phase !== PHASES.CHANCE ||
    state.street !== STREETS.PREFLOP ||
    state.actingPlayerId !== null
  ) {
    throw new RangeError('ENGINE-002 initialization must await preflop hole-card chance');
  }
  if (!state.pendingChance || state.pendingChance.type !== CHANCE_TYPES.DEAL_HOLE) {
    throw new RangeError('Initialization must request hole cards explicitly');
  }
  if (state.pendingChance.cardCount !== state.players.length * 2) {
    throw new RangeError('Hole-card chance count must be two per player');
  }
  if (
    !Array.isArray(state.pendingChance.playerOrder) ||
    state.pendingChance.playerOrder.length !== state.players.length ||
    new Set(state.pendingChance.playerOrder).size !== state.players.length ||
    state.pendingChance.playerOrder.some((playerId) => !playerIds.has(playerId))
  ) {
    throw new RangeError('Hole-card chance order must contain every player exactly once');
  }
  if (state.board.length !== 0 || state.players.some((player) => player.holeCards !== null)) {
    throw new RangeError('Hole cards and board must be undealt while deal_hole is pending');
  }
  if (state.currentBetMilliBb !== state.game.bigBlindMilliBb) {
    throw new RangeError('Initial current bet must be the nominal big blind');
  }
  if (state.lastFullRaiseIncrementMilliBb !== state.game.bigBlindMilliBb) {
    throw new RangeError('Initial full-raise increment must be the nominal big blind');
  }
  if (!state.terminal || state.terminal.isTerminal !== false || state.terminal.reason !== null) {
    throw new RangeError('An initialized hand cannot be terminal');
  }
  if (!state.showdown || state.showdown.status !== 'not_reached') {
    throw new RangeError('Showdown cannot be reached during initialization');
  }

  return state;
}
