import { assertCardArray } from './cards';
import { cloneData, deepFreeze } from './freeze';
import { clonePokerState } from './poker-state-rules';
import { compareHandRanks, evaluateSeven } from './evaluator';
import { derivePotAccounting } from './pot-layers';
import { playersClockwiseAfterSeat } from './positions';
import {
  LEDGER_KINDS,
  PHASES,
  POKER_SHOWDOWN_LAYER_RESULT_SCHEMA_VERSION,
  type MutablePokerState,
  type PokerHandRank,
  type PokerPlayerState,
  type PokerShowdownLayerResult,
  type PokerState,
} from './schema';
import { isPlayerLive } from './selectors';
import { creditPotToPlayer, refundUncalledExcess } from './settlement';
import { validatePokerState } from './validate';

function findPlayerById(
  state: MutablePokerState | PokerState,
  playerId: string,
): PokerPlayerState | null {
  return state.players.find((player) => player.playerId === playerId) ?? null;
}

function clockwiseWinnerOrder(
  state: MutablePokerState | PokerState,
  winnerPlayerIds: readonly string[],
): string[] {
  const winners = new Set(winnerPlayerIds);
  const button = state.players.find((player) => player.seat === state.buttonSeat);
  const clockwise = playersClockwiseAfterSeat(state.players, state.buttonSeat);
  const ordered = button ? clockwise.concat(button) : [...clockwise];
  return ordered.filter((player) => winners.has(player.playerId)).map((player) => player.playerId);
}

export interface SplitLayerResult {
  readonly orderedWinners: readonly string[];
  readonly payoutsMilliBbByPlayer: Record<string, number>;
}

export function splitLayerAmount(
  state: PokerState | MutablePokerState,
  amountMilliBb: number,
  winnerPlayerIds: readonly string[],
): SplitLayerResult {
  if (winnerPlayerIds.length === 0) throw new RangeError('A pot layer requires at least one winner');
  const chipUnit = state.game.chipUnitMilliBb;
  if (amountMilliBb % chipUnit !== 0) {
    throw new RangeError('Pot layer amount must align to the canonical chip unit');
  }
  const orderedWinners = clockwiseWinnerOrder(state, winnerPlayerIds);
  const totalUnits = amountMilliBb / chipUnit;
  const baseUnits = Math.floor(totalUnits / orderedWinners.length);
  const oddUnits = totalUnits % orderedWinners.length;
  const payoutsMilliBbByPlayer: Record<string, number> = {};
  orderedWinners.forEach((playerId, index) => {
    payoutsMilliBbByPlayer[playerId] = (baseUnits + (index < oddUnits ? 1 : 0)) * chipUnit;
  });
  return { orderedWinners, payoutsMilliBbByPlayer };
}

export function resolveShowdown(state: PokerState): PokerState {
  validatePokerState(state);
  if (state.phase !== PHASES.SHOWDOWN || state.showdown.status !== 'ready') {
    throw new RangeError('resolveShowdown requires a showdown-ready PokerState');
  }
  assertCardArray(state.board, 'state.board');
  if (state.board.length !== 5) throw new RangeError('Showdown requires a complete five-card board');

  const nextState = clonePokerState(state);
  const preSettlementPotMilliBb = nextState.potMilliBb;
  let accounting = derivePotAccounting(nextState);
  let refund: { readonly playerId: string; readonly amountMilliBb: number } | null = null;
  if (accounting.unmatchedContribution !== null) {
    const unmatched = accounting.unmatchedContribution;
    refund = refundUncalledExcess(nextState, unmatched.playerId);
    if (!refund || refund.amountMilliBb !== unmatched.amountMilliBb) {
      throw new RangeError('Outstanding unmatched contribution could not be refunded exactly');
    }
    accounting = derivePotAccounting(nextState);
  }
  if (accounting.unmatchedContribution !== null) {
    throw new RangeError('Showdown cannot award an unmatched contribution');
  }

  const evaluatedPlayerIds = new Set(
    accounting.potLayers.flatMap((layer) => layer.eligiblePlayerIds),
  );
  const handRanksByPlayer: Record<string, PokerHandRank> = {};
  for (const playerId of evaluatedPlayerIds) {
    const player = findPlayerById(nextState, playerId);
    if (!player || !isPlayerLive(player)) {
      throw new RangeError(`Showdown layer contains an ineligible player: ${playerId}`);
    }
    if (!Array.isArray(player.holeCards) || player.holeCards.length !== 2) {
      throw new RangeError(`Live showdown player ${playerId} requires two known hole cards`);
    }
    handRanksByPlayer[playerId] = evaluateSeven([...player.holeCards, ...nextState.board]);
  }

  const aggregatePayouts = new Map<string, number>();
  const layerResults: PokerShowdownLayerResult[] = accounting.potLayers.map(
    (layer, layerIndex) => {
      if (layer.eligiblePlayerIds.length === 0) {
        throw new RangeError(`Pot layer ${layerIndex} has no eligible showdown player`);
      }
      let bestRank: PokerHandRank | null = null;
      let tiedWinnerIds: string[] = [];
      for (const playerId of layer.eligiblePlayerIds) {
        const rank = handRanksByPlayer[playerId]!;
        if (bestRank === null || compareHandRanks(rank, bestRank) > 0) {
          bestRank = rank;
          tiedWinnerIds = [playerId];
        } else if (compareHandRanks(rank, bestRank) === 0) {
          tiedWinnerIds.push(playerId);
        }
      }

      const split = splitLayerAmount(nextState, layer.amountMilliBb, tiedWinnerIds);
      for (const playerId of split.orderedWinners) {
        const amountMilliBb = split.payoutsMilliBbByPlayer[playerId]!;
        creditPotToPlayer(nextState, playerId, amountMilliBb, LEDGER_KINDS.POT_AWARD, {
          settlementReason: 'showdown',
          potLayerIndex: layerIndex,
        });
        aggregatePayouts.set(playerId, (aggregatePayouts.get(playerId) ?? 0) + amountMilliBb);
      }

      return {
        schemaVersion: POKER_SHOWDOWN_LAYER_RESULT_SCHEMA_VERSION,
        layerIndex,
        amountMilliBb: layer.amountMilliBb,
        contributionFloorMilliBb: layer.contributionFloorMilliBb,
        contributionCeilingMilliBb: layer.contributionCeilingMilliBb,
        eligiblePlayerIds: [...layer.eligiblePlayerIds],
        winnerPlayerIds: [...split.orderedWinners],
        payoutsMilliBbByPlayer: { ...split.payoutsMilliBbByPlayer },
      };
    },
  );

  const payoutsMilliBbByPlayer = Object.fromEntries(aggregatePayouts);
  const payoutTotal = Object.values(payoutsMilliBbByPlayer).reduce(
    (sum, amount) => sum + amount,
    0,
  );
  const refundTotal = refund === null ? 0 : refund.amountMilliBb;
  if (payoutTotal + refundTotal !== preSettlementPotMilliBb || nextState.potMilliBb !== 0) {
    throw new RangeError('Showdown awards and refunds must consume the exact unsettled pot');
  }

  nextState.phase = PHASES.TERMINAL;
  nextState.actingPlayerId = null;
  nextState.pendingChance = null;
  nextState.terminal = {
    isTerminal: true,
    reason: 'showdown',
    winnerPlayerIds: clockwiseWinnerOrder(nextState, [...aggregatePayouts.keys()]),
    payoutsMilliBbByPlayer,
    refundsMilliBbByPlayer: refund === null ? {} : { [refund.playerId]: refund.amountMilliBb },
  };
  nextState.showdown = {
    ...nextState.showdown,
    status: 'settled',
    handRanksByPlayer: cloneData(
      handRanksByPlayer,
    ) as unknown as MutablePokerState['showdown']['handRanksByPlayer'],
    layerResults: layerResults.map((layer) => ({
      ...layer,
      eligiblePlayerIds: [...layer.eligiblePlayerIds],
      winnerPlayerIds: [...layer.winnerPlayerIds],
      payoutsMilliBbByPlayer: { ...layer.payoutsMilliBbByPlayer },
    })),
  };

  validatePokerState(nextState);
  return deepFreeze(nextState);
}
