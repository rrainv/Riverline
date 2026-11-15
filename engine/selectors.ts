import {
  LEDGER_MOVEMENTS,
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_SCHEMA_VERSIONS,
  POKER_STATE_V2_SCHEMA_VERSION,
  POKER_STATE_V3_SCHEMA_VERSION,
  type PokerPlayerState,
  type PokerState,
} from './schema';
import { deriveSeatAssignments, playersClockwiseAfterSeat } from './positions';

function requirePokerState(state: PokerState): PokerState {
  if (!state || !POKER_STATE_SCHEMA_VERSIONS.includes(state.schemaVersion)) {
    throw new TypeError(
      `Expected ${POKER_STATE_SCHEMA_VERSION} or ${POKER_STATE_V2_SCHEMA_VERSION}`,
    );
  }
  return state;
}

export function playerById(
  state: PokerState,
  playerId: string | null | undefined,
): PokerPlayerState | null {
  requirePokerState(state);
  if (playerId === null || playerId === undefined) return null;
  return state.players.find((player) => player.playerId === playerId) ?? null;
}

export interface BlindAssignments {
  readonly buttonPlayerId: string;
  readonly smallBlindPlayerId: string;
  readonly bigBlindPlayerId: string;
}

export function blindAssignments(state: PokerState): BlindAssignments {
  requirePokerState(state);
  const assignments = deriveSeatAssignments(state.players, state.buttonSeat);
  return Object.freeze({
    buttonPlayerId: assignments.find((entry) => entry.isButton)!.playerId,
    smallBlindPlayerId: assignments.find((entry) => entry.isSmallBlind)!.playerId,
    bigBlindPlayerId: assignments.find((entry) => entry.isBigBlind)!.playerId,
  });
}

export function isPlayerLive(player: Pick<PokerPlayerState, 'dealtIn' | 'folded'> | null | undefined): boolean {
  return Boolean(player && player.dealtIn && !player.folded);
}

export function isPlayerAllIn(
  player: Pick<PokerPlayerState, 'dealtIn' | 'folded' | 'currentStackMilliBb'> | null | undefined,
): boolean {
  return isPlayerLive(player) && player!.currentStackMilliBb === 0;
}

export function totalHandContributionMilliBb(
  player: Pick<PokerPlayerState, 'totalPotContributionMilliBb' | 'totalDeductionMilliBb'>,
): number {
  if (!player) throw new TypeError('player is required');
  return player.totalPotContributionMilliBb + player.totalDeductionMilliBb;
}

export function firstPreflopActorId(state: PokerState): string | null {
  requirePokerState(state);
  const { bigBlindPlayerId } = blindAssignments(state);
  const bigBlind = playerById(state, bigBlindPlayerId);
  if (!bigBlind) return null;
  const order = playersClockwiseAfterSeat(state.players, bigBlind.seat);
  const actor = order.find((player) => isPlayerLive(player) && player.currentStackMilliBb > 0);
  return actor ? actor.playerId : null;
}

export function firstPostflopActorId(state: PokerState): string | null {
  requirePokerState(state);
  const order = playersClockwiseAfterSeat(state.players, state.buttonSeat);
  const actor = order.find((player) => isPlayerLive(player) && !isPlayerAllIn(player));
  return actor ? actor.playerId : null;
}

export function currentActor(state: PokerState): PokerPlayerState | null {
  requirePokerState(state);
  return state.actingPlayerId === null ? null : playerById(state, state.actingPlayerId);
}

export function isHandResumable(state: PokerState | null | undefined): boolean {
  if (state === null || state === undefined) return false;
  requirePokerState(state);
  return state.terminal?.isTerminal === false;
}

export function amountToCallMilliBb(
  state: PokerState,
  playerId: string | null = state.actingPlayerId,
): number {
  requirePokerState(state);
  const player = playerById(state, playerId);
  if (!player) throw new RangeError(`Unknown playerId: ${String(playerId)}`);
  return Math.max(0, state.currentBetMilliBb - player.streetContributionMilliBb);
}

export function maximumAmountToMilliBb(
  state: PokerState,
  playerId: string | null = state.actingPlayerId,
): number {
  requirePokerState(state);
  const player = playerById(state, playerId);
  if (!player) throw new RangeError(`Unknown playerId: ${String(playerId)}`);
  return player.streetContributionMilliBb + player.currentStackMilliBb;
}

export function minimumBetToMilliBb(state: PokerState): number | null {
  requirePokerState(state);
  return state.currentBetMilliBb === 0 ? state.game.bigBlindMilliBb : null;
}

export function minimumRaiseToMilliBb(state: PokerState): number | null {
  requirePokerState(state);
  if (state.currentBetMilliBb === 0) return null;
  if (state.currentBetMilliBb < state.game.bigBlindMilliBb) return state.game.bigBlindMilliBb;
  return state.currentBetMilliBb + state.lastFullRaiseIncrementMilliBb;
}

export function hasRaisingRights(
  state: PokerState,
  playerId: string | null = state.actingPlayerId,
): boolean {
  requirePokerState(state);
  const player = playerById(state, playerId);
  if (!player) throw new RangeError(`Unknown playerId: ${String(playerId)}`);
  if (!isPlayerLive(player) || isPlayerAllIn(player)) return false;
  if (maximumAmountToMilliBb(state, playerId) <= state.currentBetMilliBb) return false;
  if (!player.actedThisStreet || player.raiseReopenAtMilliBb === null) return true;
  return state.currentBetMilliBb >= player.raiseReopenAtMilliBb;
}

export function playerNeedsAction(state: PokerState, playerId: string): boolean {
  requirePokerState(state);
  const player = playerById(state, playerId);
  if (!player) throw new RangeError(`Unknown playerId: ${playerId}`);
  return (
    isPlayerLive(player) &&
    !isPlayerAllIn(player) &&
    (!player.actedThisStreet || player.streetContributionMilliBb < state.currentBetMilliBb)
  );
}

export function nextActionablePlayerId(state: PokerState, afterPlayerId: string): string | null {
  requirePokerState(state);
  const player = playerById(state, afterPlayerId);
  if (!player) throw new RangeError(`Unknown playerId: ${afterPlayerId}`);
  const next = playersClockwiseAfterSeat(state.players, player.seat).find((candidate) =>
    playerNeedsAction(state, candidate.playerId),
  );
  return next ? next.playerId : null;
}

export function isBettingRoundComplete(state: PokerState): boolean {
  requirePokerState(state);
  const livePlayers = state.players.filter(isPlayerLive);
  return (
    livePlayers.length >= 2 &&
    livePlayers.every(
      (player) =>
        isPlayerAllIn(player) ||
        (player.actedThisStreet && player.streetContributionMilliBb === state.currentBetMilliBb),
    )
  );
}

export interface LedgerTotals {
  readonly potMilliBb: number;
  readonly deductionMilliBb: number;
  readonly recordedRakeMilliBb?: number;
}

export function ledgerTotals(state: PokerState): LedgerTotals {
  requirePokerState(state);
  let potMilliBb = 0;
  let deductionMilliBb = 0;
  let recordedRakeMilliBb = 0;
  for (const entry of state.ledger) {
    if (entry.movement === LEDGER_MOVEMENTS.STACK_TO_POT) potMilliBb += entry.amountMilliBb;
    if (
      entry.movement === LEDGER_MOVEMENTS.POT_TO_STACK ||
      entry.movement === LEDGER_MOVEMENTS.POT_TO_RECORDED_RAKE
    ) {
      potMilliBb -= entry.amountMilliBb;
    }
    if (entry.movement === LEDGER_MOVEMENTS.STACK_TO_DEDUCTION) {
      deductionMilliBb += entry.amountMilliBb;
    }
    if (entry.movement === LEDGER_MOVEMENTS.POT_TO_RECORDED_RAKE) {
      recordedRakeMilliBb += entry.amountMilliBb;
    }
  }
  return Object.freeze({
    potMilliBb,
    deductionMilliBb,
    ...(state.schemaVersion === POKER_STATE_V3_SCHEMA_VERSION ? { recordedRakeMilliBb } : {}),
  });
}

export function deductionTotalsByPlayer(state: PokerState): Readonly<Record<string, number>> {
  requirePokerState(state);
  const totals: Record<string, number> = Object.fromEntries(
    state.players.map((player) => [player.playerId, 0]),
  );
  for (const entry of state.ledger) {
    if (entry.movement === LEDGER_MOVEMENTS.STACK_TO_DEDUCTION && entry.playerId !== null) {
      totals[entry.playerId] = (totals[entry.playerId] ?? 0) + entry.amountMilliBb;
    }
  }
  return Object.freeze(totals);
}

export interface StackTotals {
  readonly startingMilliBb: number;
  readonly remainingMilliBb: number;
}

export function stackTotals(state: PokerState): StackTotals {
  requirePokerState(state);
  return Object.freeze({
    startingMilliBb: state.players.reduce((sum, player) => sum + player.startingStackMilliBb, 0),
    remainingMilliBb: state.players.reduce((sum, player) => sum + player.currentStackMilliBb, 0),
  });
}

export function isChipConserved(state: PokerState): boolean {
  const stacks = stackTotals(state);
  return (
    stacks.startingMilliBb ===
    stacks.remainingMilliBb +
      state.potMilliBb +
      state.deductionTotalMilliBb +
      (state.recordedSettlement?.rakeMilliBb ?? 0)
  );
}

export {
  deriveActionSizeFacts,
  deriveActorPotBeforeActionBb,
  actorPotBeforeActionBb,
  deriveStackToPotRatio,
  stackToPotRatio,
  deriveMinimumDefenseFrequency,
  minimumDefenseFrequency,
  deriveMinimumDefenseFrequencyPercent,
  minimumDefenseFrequencyPercent,
} from './actor-call-economics';
