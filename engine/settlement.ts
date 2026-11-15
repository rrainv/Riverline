import {
  CHANCE_TYPES,
  LEDGER_KINDS,
  LEDGER_MOVEMENTS,
  PHASES,
  STREETS,
  type LedgerKind,
  type MutablePokerState,
} from './schema';
import { isPlayerLive } from './selectors';
import { deriveUnmatchedContribution } from './pot-layers';
import { markShowdownReady, requestBoardChance } from './street-transitions';

export interface PotCreditMetadata {
  readonly settlementReason?: 'showdown';
  readonly potLayerIndex?: number;
}

function appendLedger(
  state: MutablePokerState,
  playerId: string,
  kind: LedgerKind,
  amountMilliBb: number,
  metadata: PotCreditMetadata = {},
): void {
  if (amountMilliBb === 0) return;
  state.ledger.push({
    sequence: state.ledger.length,
    playerId,
    street: state.street,
    kind,
    movement: LEDGER_MOVEMENTS.POT_TO_STACK,
    amountMilliBb,
    ...metadata,
  });
}

export function creditPotToPlayer(
  state: MutablePokerState,
  playerId: string,
  amountMilliBb: number,
  kind: LedgerKind,
  metadata: PotCreditMetadata = {},
): void {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  if (!player) throw new RangeError(`Unknown playerId: ${playerId}`);
  if (amountMilliBb === 0) return;
  if (amountMilliBb > state.potMilliBb) throw new RangeError('Pot credit exceeds the pot');
  state.potMilliBb -= amountMilliBb;
  player.currentStackMilliBb += amountMilliBb;
  appendLedger(state, player.playerId, kind, amountMilliBb, metadata);
}

export function refundUncalledExcess(
  state: MutablePokerState,
  recipientPlayerId: string | null = null,
): { readonly playerId: string; readonly amountMilliBb: number } | null {
  const unmatched = deriveUnmatchedContribution(state, recipientPlayerId);
  const recipient = state.players.find((player) => player.playerId === unmatched?.playerId);
  if (!recipient || (recipientPlayerId === null && !isPlayerLive(recipient))) return null;
  const amountMilliBb = unmatched === null ? 0 : unmatched.amountMilliBb;
  creditPotToPlayer(state, recipient.playerId, amountMilliBb, LEDGER_KINDS.UNCALLED_REFUND);
  return amountMilliBb === 0 ? null : { playerId: recipient.playerId, amountMilliBb };
}

export function completeBettingRound(state: MutablePokerState): void {
  refundUncalledExcess(state);
  if (state.street === STREETS.PREFLOP) {
    requestBoardChance(state, CHANCE_TYPES.DEAL_FLOP);
  } else if (state.street === STREETS.FLOP) {
    requestBoardChance(state, CHANCE_TYPES.DEAL_TURN);
  } else if (state.street === STREETS.TURN) {
    requestBoardChance(state, CHANCE_TYPES.DEAL_RIVER);
  } else if (state.street === STREETS.RIVER) {
    markShowdownReady(state);
  } else {
    throw new RangeError(`Cannot complete unsupported betting street: ${String(state.street)}`);
  }
}

export function completePreflop(state: MutablePokerState): void {
  if (state.street !== STREETS.PREFLOP) {
    throw new RangeError('completePreflop requires the preflop street');
  }
  completeBettingRound(state);
}

export function settleFoldTerminal(state: MutablePokerState, winnerPlayerId: string): void {
  const winner = state.players.find((player) => player.playerId === winnerPlayerId);
  if (!winner || !isPlayerLive(winner)) {
    throw new RangeError('Fold settlement requires one live winner');
  }
  const refund = refundUncalledExcess(state, winnerPlayerId);
  const payoutMilliBb = state.potMilliBb;
  creditPotToPlayer(state, winner.playerId, payoutMilliBb, LEDGER_KINDS.POT_AWARD);

  state.phase = PHASES.TERMINAL;
  state.actingPlayerId = null;
  state.pendingChance = null;
  state.terminal = {
    isTerminal: true,
    reason: 'fold',
    winnerPlayerIds: [winner.playerId],
    payoutsMilliBbByPlayer: payoutMilliBb === 0 ? {} : { [winner.playerId]: payoutMilliBb },
    refundsMilliBbByPlayer: refund === null ? {} : { [winner.playerId]: refund.amountMilliBb },
  };
}
