import { assertCardArray, assertUniqueKnownCards, type CardGroup } from './cards';
import { deepFreeze } from './freeze';
import { clonePokerState } from './poker-state-rules';
import { isHiddenHoleCards } from './private-cards';
import { PHASES, type PokerState } from './schema';
import { isPlayerLive } from './selectors';
import { validatePokerState } from './validate';

export interface PrivateRevealEvent {
  readonly playerId: string;
  readonly cards: readonly string[];
}

function knownCardGroups(state: PokerState): CardGroup[] {
  return [
    { label: 'board', cards: state.board },
    { label: 'deadCards', cards: state.deadCards },
    ...state.players
      .filter((player) => Array.isArray(player.holeCards))
      .map((player) => ({
        label: `holeCards.${player.playerId}`,
        cards: player.holeCards as readonly string[],
      })),
  ];
}

/** Deterministically materialize one previously dealt hidden private hand. */
export function applyPrivateReveal(state: PokerState, revealEvent: PrivateRevealEvent): PokerState {
  validatePokerState(state);
  if (!revealEvent || typeof revealEvent !== 'object' || Array.isArray(revealEvent)) {
    throw new TypeError('revealEvent must be an object');
  }
  const eventRecord = revealEvent as unknown as Record<string, unknown>;
  if (typeof eventRecord.playerId !== 'string' || !eventRecord.playerId) {
    throw new TypeError('revealEvent.playerId is required');
  }
  const player = state.players.find((candidate) => candidate.playerId === eventRecord.playerId);
  if (!player) throw new RangeError(`Unknown playerId: ${eventRecord.playerId}`);
  if (!isHiddenHoleCards(player.holeCards)) {
    throw new RangeError('Only dealt hidden hole cards may be revealed');
  }
  const cards = assertCardArray(eventRecord.cards, 'revealEvent.cards');
  if (cards.length !== 2) throw new RangeError('A private reveal requires exactly two cards');
  assertUniqueKnownCards([...knownCardGroups(state), { label: `reveal.${player.playerId}`, cards }]);

  const nextState = clonePokerState(state);
  nextState.players.find((candidate) => candidate.playerId === player.playerId)!.holeCards = [
    ...cards,
  ];

  if (nextState.phase === PHASES.SHOWDOWN && nextState.showdown.status === 'awaiting_private_reveal') {
    const requiredRevealPlayerIds = nextState.players
      .filter((candidate) => isPlayerLive(candidate) && isHiddenHoleCards(candidate.holeCards))
      .map((candidate) => candidate.playerId);
    if (requiredRevealPlayerIds.length === 0) {
      nextState.showdown.status = 'ready';
      delete nextState.showdown.requiredRevealPlayerIds;
    } else {
      nextState.showdown.requiredRevealPlayerIds = requiredRevealPlayerIds;
    }
  }

  validatePokerState(nextState);
  return deepFreeze(nextState);
}
