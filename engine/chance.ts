import { assertCardArray, assertUniqueKnownCards, type CardGroup } from './cards';
import { deepFreeze } from './freeze';
import { HOLDEM_DECK } from './holdem-combos';
import { clonePokerState } from './poker-state-rules';
import { createHiddenHoleCards } from './private-cards';
import { firstPreflopActorId } from './selectors';
import { CHANCE_TYPES, PHASES, type ChanceType, type MutablePokerState, type PokerState } from './schema';
import { completePreflop } from './settlement';
import {
  boardChanceTransition,
  initializeStreetAfterBoardDeal,
  type BoardChanceTransition,
} from './street-transitions';
import { validateInitializedPokerState, validatePokerState } from './validate';

export interface DealHoleChanceEvent {
  readonly type: typeof CHANCE_TYPES.DEAL_HOLE;
  readonly cardsByPlayer: Readonly<Record<string, readonly string[]>>;
  readonly hiddenPlayerIds?: readonly string[];
}

export interface DealBoardChanceEvent {
  readonly type:
    | typeof CHANCE_TYPES.DEAL_FLOP
    | typeof CHANCE_TYPES.DEAL_TURN
    | typeof CHANCE_TYPES.DEAL_RIVER;
  readonly cards: readonly string[];
}

export type ChanceEvent = DealHoleChanceEvent | DealBoardChanceEvent;

function requirePendingChance(state: PokerState, chanceEvent: unknown): Record<string, unknown> {
  if (!chanceEvent || typeof chanceEvent !== 'object' || Array.isArray(chanceEvent)) {
    throw new TypeError('chanceEvent must be an object');
  }
  if (state.phase !== PHASES.CHANCE || state.pendingChance === null) {
    throw new RangeError('No chance event is pending');
  }
  const eventRecord = chanceEvent as Record<string, unknown>;
  if (eventRecord.type !== state.pendingChance.type) {
    throw new RangeError(`Expected pending chance event ${state.pendingChance.type}`);
  }
  return eventRecord;
}

export function getAvailableChanceCards(
  state: PokerState,
  pendingCards: readonly string[] = [],
): readonly string[] {
  validatePokerState(state);
  if (state.phase !== PHASES.CHANCE || state.pendingChance === null) {
    throw new RangeError('Available chance cards require a pending chance event');
  }

  const pending = assertCardArray(pendingCards, 'pendingCards');
  if (pending.length > state.pendingChance.cardCount) {
    throw new RangeError('Pending chance cards exceed the pending chance card count');
  }
  const consumed = assertUniqueKnownCards([
    { label: 'board', cards: state.board },
    { label: 'deadCards', cards: state.deadCards },
    ...state.players
      .filter((player) => Array.isArray(player.holeCards))
      .map((player) => ({
        label: `holeCards.${player.playerId}`,
        cards: player.holeCards as readonly string[],
      })),
    { label: 'pendingCards', cards: pending },
  ]);

  return deepFreeze(HOLDEM_DECK.filter((card) => !consumed.has(card)));
}

function applyHoleDeal(
  state: PokerState,
  chanceEvent: Record<string, unknown>,
): MutablePokerState {
  validateInitializedPokerState(state);
  if (
    !chanceEvent.cardsByPlayer ||
    typeof chanceEvent.cardsByPlayer !== 'object' ||
    Array.isArray(chanceEvent.cardsByPlayer)
  ) {
    throw new TypeError('deal_hole requires cardsByPlayer');
  }

  const cardsByPlayer = chanceEvent.cardsByPlayer as Record<string, unknown>;
  const dealtPlayers = state.players.filter((player) => player.dealtIn);
  const expectedIds = new Set(dealtPlayers.map((player) => player.playerId));
  const suppliedIds = Object.keys(cardsByPlayer);
  const hiddenPlayerIds = chanceEvent.hiddenPlayerIds ?? [];
  if (
    !Array.isArray(hiddenPlayerIds) ||
    hiddenPlayerIds.some((playerId) => typeof playerId !== 'string')
  ) {
    throw new TypeError('hiddenPlayerIds must be an array of player IDs');
  }
  const typedHiddenIds = hiddenPlayerIds as readonly string[];
  if (new Set(typedHiddenIds).size !== typedHiddenIds.length) {
    throw new RangeError('hiddenPlayerIds cannot contain duplicates');
  }
  if (
    suppliedIds.some((playerId) => !expectedIds.has(playerId)) ||
    typedHiddenIds.some((playerId) => !expectedIds.has(playerId))
  ) {
    throw new RangeError('Hole-card deal refers to an unknown or non-dealt player');
  }
  if (suppliedIds.some((playerId) => typedHiddenIds.includes(playerId))) {
    throw new RangeError('A player cannot have both known and hidden hole cards');
  }
  const representedIds = new Set([...suppliedIds, ...typedHiddenIds]);
  if (
    representedIds.size !== expectedIds.size ||
    [...expectedIds].some((playerId) => !representedIds.has(playerId))
  ) {
    throw new RangeError(
      'deal_hole must represent every dealt-in player as known or hidden for heads-up or multiway play',
    );
  }

  const cardGroups: CardGroup[] = [
    { label: 'board', cards: state.board },
    { label: 'deadCards', cards: state.deadCards },
  ];
  for (const player of dealtPlayers.filter((candidate) => suppliedIds.includes(candidate.playerId))) {
    const cards = assertCardArray(
      cardsByPlayer[player.playerId],
      `cardsByPlayer.${player.playerId}`,
    );
    if (cards.length !== 2) throw new RangeError('Each dealt-in player must receive exactly two cards');
    cardGroups.push({ label: `holeCards.${player.playerId}`, cards });
  }
  assertUniqueKnownCards(cardGroups);

  const nextState = clonePokerState(state);
  for (const player of nextState.players) {
    if (Object.hasOwn(cardsByPlayer, player.playerId)) {
      player.holeCards = [...(cardsByPlayer[player.playerId] as readonly string[])];
    } else {
      player.holeCards = { ...createHiddenHoleCards() };
    }
  }
  nextState.phase = PHASES.BETTING;
  nextState.actingPlayerId = firstPreflopActorId(nextState);
  nextState.pendingChance = null;
  if (nextState.actingPlayerId === null) completePreflop(nextState);
  return nextState;
}

function applyBoardDeal(
  state: PokerState,
  chanceEvent: Record<string, unknown>,
  transition: BoardChanceTransition | null,
): MutablePokerState {
  if (!Object.hasOwn(chanceEvent, 'cards')) {
    throw new TypeError(`${String(chanceEvent.type)} requires cards`);
  }
  const cards = assertCardArray(chanceEvent.cards, 'chanceEvent.cards');
  if (!transition || cards.length !== transition.cardCount) {
    throw new RangeError(
      `${String(chanceEvent.type)} requires exactly ${transition?.cardCount ?? 0} card(s)`,
    );
  }
  const cardGroups: CardGroup[] = [
    { label: 'board', cards: state.board },
    { label: 'deadCards', cards: state.deadCards },
    // Hidden hands consume two cards without observable identity; only known cards check collisions.
    ...state.players
      .filter((player) => Array.isArray(player.holeCards))
      .map((player) => ({
        label: `holeCards.${player.playerId}`,
        cards: player.holeCards as readonly string[],
      })),
    { label: String(chanceEvent.type), cards },
  ];
  assertUniqueKnownCards(cardGroups);

  const nextState = clonePokerState(state);
  initializeStreetAfterBoardDeal(nextState, transition, cards);
  return nextState;
}

export function applyChance(state: PokerState, chanceEvent: ChanceEvent): PokerState {
  validatePokerState(state);
  const eventRecord = requirePendingChance(state, chanceEvent);

  const nextState =
    eventRecord.type === CHANCE_TYPES.DEAL_HOLE
      ? applyHoleDeal(state, eventRecord)
      : applyBoardDeal(state, eventRecord, boardChanceTransition(eventRecord.type as ChanceType));

  validatePokerState(nextState);
  return deepFreeze(nextState);
}
