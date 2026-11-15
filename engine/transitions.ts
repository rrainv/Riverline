import { validateAction } from './action';
import { deepFreeze } from './freeze';
import { clonePokerState } from './poker-state-rules';
import { getLegalActionSpec } from './legal-actions';
import {
  amountToCallMilliBb,
  isBettingRoundComplete,
  isPlayerAllIn,
  isPlayerLive,
  nextActionablePlayerId,
} from './selectors';
import {
  ACTION_TYPES,
  LEDGER_KINDS,
  LEDGER_MOVEMENTS,
  POKER_ACTION_RECORD_SCHEMA_VERSION,
  STREETS,
  type DeepMutable,
  type LedgerKind,
  type LedgerMovement,
  type LegalActionSpec,
  type MutablePokerState,
  type PokerAction,
  type PokerActionRecord,
  type PokerPlayerState,
  type PokerState,
} from './schema';
import { completeBettingRound, settleFoldTerminal } from './settlement';
import { validatePokerState } from './validate';

function mutablePlayerById(
  state: MutablePokerState,
  playerId: string,
): DeepMutable<PokerPlayerState> {
  return state.players.find((player) => player.playerId === playerId)!;
}

function appendLedger(
  state: MutablePokerState,
  playerId: string,
  kind: LedgerKind,
  movement: LedgerMovement,
  amountMilliBb: number,
): void {
  if (amountMilliBb === 0) return;
  state.ledger.push({
    sequence: state.ledger.length,
    playerId,
    street: state.street,
    kind,
    movement,
    amountMilliBb,
  });
}

function commitToPot(
  state: MutablePokerState,
  player: DeepMutable<PokerPlayerState>,
  amountMilliBb: number,
): void {
  if (amountMilliBb < 0 || amountMilliBb > player.currentStackMilliBb) {
    throw new RangeError('Action commitment exceeds the available stack');
  }
  if (amountMilliBb === 0) return;
  player.currentStackMilliBb -= amountMilliBb;
  player.streetContributionMilliBb += amountMilliBb;
  player.totalPotContributionMilliBb += amountMilliBb;
  state.potMilliBb += amountMilliBb;
  appendLedger(
    state,
    player.playerId,
    LEDGER_KINDS.ACTION,
    LEDGER_MOVEMENTS.STACK_TO_POT,
    amountMilliBb,
  );
}

function validateConcreteAction(action: PokerAction, spec: LegalActionSpec): void {
  let available: boolean;
  if (action.type === ACTION_TYPES.ALL_IN) {
    available = spec.allIn.available === true;
  } else if (action.type === ACTION_TYPES.FOLD) {
    available = spec.fold.available === true;
  } else if (action.type === ACTION_TYPES.CHECK) {
    available = spec.check.available === true;
  } else if (action.type === ACTION_TYPES.CALL) {
    available = spec.call.available === true;
  } else if (action.type === ACTION_TYPES.BET) {
    available = spec.bet.available === true;
  } else {
    available = spec.raise.available === true;
  }
  if (!available) throw new RangeError(`Illegal ${action.type} action`);
  if (action.type === ACTION_TYPES.BET || action.type === ACTION_TYPES.RAISE) {
    const option = action.type === ACTION_TYPES.BET ? spec.bet : spec.raise;
    if (
      action.amountToMilliBb === null ||
      option.minToMilliBb === null ||
      option.maxToMilliBb === null ||
      action.amountToMilliBb < option.minToMilliBb ||
      action.amountToMilliBb > option.maxToMilliBb
    ) {
      throw new RangeError(`${action.type} amount is outside legal raise-to bounds`);
    }
  }
}

export function applyAction(state: PokerState, action: PokerAction): PokerState {
  validatePokerState(state);
  const validatedAction = validateAction(action, state.game.chipUnitMilliBb);
  const spec = getLegalActionSpec(state);
  if (validatedAction.playerId !== state.actingPlayerId) {
    throw new RangeError('Action player is not the current actor');
  }
  validateConcreteAction(validatedAction, spec);

  const nextState = clonePokerState(state);
  const actor = mutablePlayerById(nextState, validatedAction.playerId);
  const currentBetBeforeMilliBb = nextState.currentBetMilliBb;
  const toCallBeforeMilliBb = amountToCallMilliBb(nextState, actor.playerId);
  let committedMilliBb = 0;
  let wasFullRaise = false;
  let reopenedBetting = false;

  if (validatedAction.type === ACTION_TYPES.FOLD) {
    actor.folded = true;
    actor.actedThisStreet = true;
  } else if (validatedAction.type === ACTION_TYPES.CHECK) {
    actor.actedThisStreet = true;
    actor.raiseReopenAtMilliBb = nextState.currentBetMilliBb + nextState.game.chipUnitMilliBb;
  } else if (validatedAction.type === ACTION_TYPES.CALL) {
    committedMilliBb = Math.min(toCallBeforeMilliBb, actor.currentStackMilliBb);
    commitToPot(nextState, actor, committedMilliBb);
    actor.actedThisStreet = true;
    actor.raiseReopenAtMilliBb =
      nextState.currentBetMilliBb + nextState.lastFullRaiseIncrementMilliBb;
  } else {
    const amountToMilliBb =
      validatedAction.type === ACTION_TYPES.ALL_IN
        ? spec.allIn.amountToMilliBb!
        : validatedAction.amountToMilliBb!;
    committedMilliBb = amountToMilliBb - actor.streetContributionMilliBb;
    commitToPot(nextState, actor, committedMilliBb);

    const raiseIncrementMilliBb = amountToMilliBb - currentBetBeforeMilliBb;
    const isPostflopCompletion =
      nextState.street !== STREETS.PREFLOP &&
      currentBetBeforeMilliBb > 0 &&
      currentBetBeforeMilliBb < nextState.game.bigBlindMilliBb &&
      amountToMilliBb >= nextState.game.bigBlindMilliBb;
    wasFullRaise =
      isPostflopCompletion ||
      (currentBetBeforeMilliBb === 0
        ? amountToMilliBb >= nextState.game.bigBlindMilliBb
        : raiseIncrementMilliBb >= nextState.lastFullRaiseIncrementMilliBb);
    if (wasFullRaise) {
      nextState.lastFullRaiseIncrementMilliBb =
        currentBetBeforeMilliBb === 0
          ? amountToMilliBb
          : Math.max(nextState.game.bigBlindMilliBb, raiseIncrementMilliBb);
    }
    nextState.currentBetMilliBb = amountToMilliBb;
    nextState.lastAggressorPlayerId = actor.playerId;
    actor.actedThisStreet = true;
    actor.raiseReopenAtMilliBb =
      nextState.currentBetMilliBb + nextState.lastFullRaiseIncrementMilliBb;
    reopenedBetting =
      wasFullRaise ||
      nextState.players.some(
        (player) =>
          player.playerId !== actor.playerId &&
          isPlayerLive(player) &&
          !isPlayerAllIn(player) &&
          player.actedThisStreet &&
          player.raiseReopenAtMilliBb !== null &&
          currentBetBeforeMilliBb < player.raiseReopenAtMilliBb &&
          nextState.currentBetMilliBb >= player.raiseReopenAtMilliBb,
      );
  }

  const record: DeepMutable<PokerActionRecord> = {
    schemaVersion: POKER_ACTION_RECORD_SCHEMA_VERSION,
    sequence: nextState.actionHistory.length,
    street: nextState.street,
    playerId: actor.playerId,
    submittedAction: { ...validatedAction },
    toCallBeforeMilliBb,
    committedMilliBb,
    streetContributionAfterMilliBb: actor.streetContributionMilliBb,
    currentBetBeforeMilliBb,
    currentBetAfterMilliBb: nextState.currentBetMilliBb,
    wasAllIn: isPlayerAllIn(actor),
    wasFullRaise,
    reopenedBetting,
  };
  nextState.actionHistory.push(record);

  const livePlayers = nextState.players.filter(isPlayerLive);
  if (livePlayers.length === 1) {
    settleFoldTerminal(nextState, livePlayers[0]!.playerId);
  } else if (isBettingRoundComplete(nextState)) {
    completeBettingRound(nextState);
  } else {
    const nextPlayerId = nextActionablePlayerId(nextState, actor.playerId);
    if (nextPlayerId === null) {
      throw new RangeError('No actionable player found before betting was complete');
    }
    nextState.actingPlayerId = nextPlayerId;
  }

  validatePokerState(nextState);
  return deepFreeze(nextState);
}
