import { deepFreeze } from './freeze';
import {
  amountToCallMilliBb,
  currentActor,
  hasRaisingRights,
  isPlayerAllIn,
  isPlayerLive,
  maximumAmountToMilliBb,
  minimumBetToMilliBb,
  minimumRaiseToMilliBb,
} from './selectors';
import { PHASES, type LegalActionSpec, type PokerPlayerState, type PokerState } from './schema';
import { validatePokerState } from './validate';

function requireBettingState(state: PokerState): PokerPlayerState {
  validatePokerState(state);
  if (state.phase !== PHASES.BETTING) throw new RangeError('Actions require a betting phase');
  const actor = currentActor(state);
  if (!actor || !isPlayerLive(actor) || isPlayerAllIn(actor)) {
    throw new RangeError('The betting state has no actionable current actor');
  }
  return actor;
}

export function getLegalActionSpec(state: PokerState): LegalActionSpec {
  const actor = requireBettingState(state);
  const toCallMilliBb = amountToCallMilliBb(state, actor.playerId);
  const maximumTo = maximumAmountToMilliBb(state, actor.playerId);
  const commitMilliBb = Math.min(toCallMilliBb, actor.currentStackMilliBb);
  const opponentCanRespond = state.players.some(
    (player) =>
      player.playerId !== actor.playerId && isPlayerLive(player) && !isPlayerAllIn(player),
  );
  const canAggress =
    opponentCanRespond &&
    hasRaisingRights(state, actor.playerId) &&
    maximumTo > state.currentBetMilliBb;
  const maximumNonAllInTo = maximumTo - state.game.chipUnitMilliBb;
  const minBetTo = minimumBetToMilliBb(state);
  const minRaiseTo = minimumRaiseToMilliBb(state);
  const betAvailable =
    canAggress &&
    state.currentBetMilliBb === 0 &&
    minBetTo !== null &&
    maximumNonAllInTo >= minBetTo;
  const raiseAvailable =
    canAggress &&
    state.currentBetMilliBb > 0 &&
    minRaiseTo !== null &&
    maximumNonAllInTo >= minRaiseTo;

  return deepFreeze({
    playerId: actor.playerId,
    fold: { available: toCallMilliBb > 0 },
    check: { available: toCallMilliBb === 0 },
    call: {
      available: toCallMilliBb > 0,
      toCallMilliBb,
      commitMilliBb,
      allIn: toCallMilliBb > 0 && commitMilliBb === actor.currentStackMilliBb,
    },
    bet: {
      available: betAvailable,
      minToMilliBb: betAvailable ? minBetTo : null,
      maxToMilliBb: betAvailable ? maximumNonAllInTo : null,
    },
    raise: {
      available: raiseAvailable,
      minToMilliBb: raiseAvailable ? minRaiseTo : null,
      maxToMilliBb: raiseAvailable ? maximumNonAllInTo : null,
    },
    allIn: {
      available: canAggress,
      amountToMilliBb: canAggress ? maximumTo : null,
    },
  });
}
