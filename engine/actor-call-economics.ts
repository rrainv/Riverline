import { deepFreeze } from './freeze';
import { getLegalActionSpec } from './legal-actions';
import { derivePotLayers, deriveUnmatchedContribution } from './pot-layers';
import {
  POKER_ACTOR_CALL_ECONOMICS_SCHEMA_VERSION,
  type ActionSizeFacts,
  type ActorCallEconomics,
  type PokerState,
} from './schema';
import { isPlayerLive } from './selectors';

export interface EconomicsContext {
  readonly actorContestablePotAfterCallBb?: number | null;
  readonly callAmountBb?: number | null;
  readonly actorContestablePotAfterCallMilliBb?: number | null;
  readonly callCommitmentMilliBb?: number | null;
  readonly opponentCount?: number | null;
  readonly effectiveStackBb?: number | null;
}

/**
 * Projects the final pot layers for the current live actor after the canonical,
 * stack-capped legal call. Layer construction remains owned by pot-layers; this
 * selector does not mutate PokerState or expose an arbitrary commitment API.
 */
export function deriveActorCallEconomics(
  state: PokerState,
  actorPlayerId: string,
): ActorCallEconomics {
  const actor = state?.players?.find((player) => player.playerId === actorPlayerId);
  if (!actor) throw new RangeError(`Unknown playerId: ${actorPlayerId}`);
  if (!isPlayerLive(actor)) {
    throw new RangeError('Actor call economics requires a live player');
  }
  if (state.actingPlayerId !== actorPlayerId) {
    throw new RangeError('Actor call economics requires the current acting player');
  }
  const legalActions = getLegalActionSpec(state);
  if (legalActions.playerId !== actorPlayerId) {
    throw new RangeError('Legal call authority did not resolve the requested actor');
  }
  const callCommitmentMilliBb = legalActions.call.commitMilliBb;
  const projectedState: PokerState = {
    ...state,
    potMilliBb: state.potMilliBb + callCommitmentMilliBb,
    players: state.players.map((player) =>
      player.playerId === actorPlayerId
        ? {
            ...player,
            totalPotContributionMilliBb:
              player.totalPotContributionMilliBb + callCommitmentMilliBb,
          }
        : player,
    ),
  };
  const projectedLayers = derivePotLayers(projectedState);
  const actorContestablePotAfterCallMilliBb = projectedLayers
    .filter((layer) => layer.eligiblePlayerIds.includes(actorPlayerId))
    .reduce((sum, layer) => sum + layer.amountMilliBb, 0);
  const potAfterCallMilliBb = projectedState.potMilliBb;
  const actorIneligiblePotAfterCallMilliBb =
    potAfterCallMilliBb - actorContestablePotAfterCallMilliBb;
  if (actorIneligiblePotAfterCallMilliBb < 0) {
    throw new RangeError('Actor-contestable pot cannot exceed the projected total pot');
  }

  const ownRefund = (projected: PokerState): number => {
    const unmatched = deriveUnmatchedContribution(projected, actorPlayerId);
    return unmatched?.amountMilliBb ?? 0;
  };
  const incrementalRiskMilliBb =
    callCommitmentMilliBb - (ownRefund(projectedState) - ownRefund(state));
  return deepFreeze({
    schemaVersion: POKER_ACTOR_CALL_ECONOMICS_SCHEMA_VERSION,
    actorPlayerId,
    callCommitmentMilliBb,
    potAfterCallMilliBb,
    actorContestablePotAfterCallMilliBb,
    actorIneligiblePotAfterCallMilliBb,
    requiredRawEquity:
      callCommitmentMilliBb > 0
        ? incrementalRiskMilliBb / actorContestablePotAfterCallMilliBb
        : null,
  });
}

/**
 * Facts about one concrete bet/raise size for the acting player.
 * - potShare: increment over current wager as a share of actor-contestable pot after calling
 * - sprAfterCalled: heads-up only; effective stack left behind divided by pot if called
 */
export function deriveActionSizeFacts(
  state: PokerState,
  actorPlayerId: string,
  amountToMilliBb: number,
): ActionSizeFacts {
  if (!Number.isSafeInteger(amountToMilliBb) || amountToMilliBb < 0) {
    throw new RangeError('amountToMilliBb must be a nonnegative safe integer');
  }
  const economics = deriveActorCallEconomics(state, actorPlayerId);
  const actor = state.players.find((player) => player.playerId === actorPlayerId)!;
  const increment = amountToMilliBb - state.currentBetMilliBb;
  const basis = economics.actorContestablePotAfterCallMilliBb;
  const potShare = basis > 0 && increment >= 0 ? increment / basis : null;

  const opponents = state.players.filter(
    (player) => player.playerId !== actorPlayerId && isPlayerLive(player),
  );
  let sprAfterCalled: number | null = null;
  if (opponents.length === 1) {
    const opponent = opponents[0]!;
    const actorAdds = Math.min(
      Math.max(0, amountToMilliBb - actor.streetContributionMilliBb),
      actor.currentStackMilliBb,
    );
    const opponentAdds = Math.min(
      Math.max(0, amountToMilliBb - opponent.streetContributionMilliBb),
      opponent.currentStackMilliBb,
    );
    const potIfCalled = state.potMilliBb + actorAdds + opponentAdds;
    const effectiveBehind = Math.min(
      actor.currentStackMilliBb - actorAdds,
      opponent.currentStackMilliBb - opponentAdds,
    );
    sprAfterCalled = potIfCalled > 0 ? effectiveBehind / potIfCalled : null;
  }
  return deepFreeze({
    actorPlayerId,
    amountToMilliBb,
    potShare,
    sprAfterCalled,
  });
}

function finiteNonNegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Canonical actor-contestable pot before the current decision action, in big blinds.
 */
export function deriveActorPotBeforeActionBb(context: EconomicsContext | null | undefined): number | null {
  if (!context || typeof context !== 'object') return null;
  const afterCallBb = finiteNonNegativeNumber(context.actorContestablePotAfterCallBb);
  const callAmountBb = finiteNonNegativeNumber(context.callAmountBb);
  if (afterCallBb !== null && callAmountBb !== null) {
    return afterCallBb >= callAmountBb ? afterCallBb - callAmountBb : null;
  }
  const afterCallMilliBb = finiteNonNegativeNumber(context.actorContestablePotAfterCallMilliBb);
  const callMilliBb = finiteNonNegativeNumber(context.callCommitmentMilliBb);
  if (afterCallMilliBb !== null && callMilliBb !== null) {
    return afterCallMilliBb >= callMilliBb ? (afterCallMilliBb - callMilliBb) / 1000 : null;
  }
  return null;
}

/**
 * Canonical heads-up Stack-to-Pot Ratio (SPR) before the current action.
 */
export function deriveStackToPotRatio(context: EconomicsContext | null | undefined): number | null {
  if (!context || typeof context !== 'object') return null;
  if (context.opponentCount !== 1) return null;
  const effectiveStackBb = finiteNonNegativeNumber(context.effectiveStackBb);
  const potBeforeActionBb = deriveActorPotBeforeActionBb(context);
  if (effectiveStackBb === null || potBeforeActionBb === null || potBeforeActionBb <= 0) {
    return null;
  }
  return effectiveStackBb / potBeforeActionBb;
}

/**
 * Canonical heads-up Minimum Defense Frequency (MDF) as a probability in [0, 1].
 */
export function deriveMinimumDefenseFrequency(
  context: EconomicsContext | null | undefined,
): number | null {
  if (!context || typeof context !== 'object') return null;
  if (context.opponentCount !== 1) return null;
  const directCallBb = finiteNonNegativeNumber(context.callAmountBb);
  const callMilliBb = finiteNonNegativeNumber(context.callCommitmentMilliBb);
  const callAmountBb =
    directCallBb ?? (callMilliBb !== null ? callMilliBb / 1000 : null);
  const directAfterBb = finiteNonNegativeNumber(context.actorContestablePotAfterCallBb);
  const afterMilliBb = finiteNonNegativeNumber(context.actorContestablePotAfterCallMilliBb);
  const afterCallBb =
    directAfterBb ?? (afterMilliBb !== null ? afterMilliBb / 1000 : null);
  if (callAmountBb === null || callAmountBb <= 0) return null;
  if (afterCallBb === null || afterCallBb <= 0 || afterCallBb < callAmountBb) return null;
  const potBeforeActionBb = deriveActorPotBeforeActionBb(context);
  if (potBeforeActionBb === null) return null;
  return potBeforeActionBb / afterCallBb;
}

/**
 * Canonical heads-up Minimum Defense Frequency (MDF) as a percentage in [0, 100].
 */
export function deriveMinimumDefenseFrequencyPercent(
  context: EconomicsContext | null | undefined,
): number | null {
  const mdf = deriveMinimumDefenseFrequency(context);
  return mdf === null ? null : mdf * 100;
}

export {
  deriveActorPotBeforeActionBb as actorPotBeforeActionBb,
  deriveStackToPotRatio as stackToPotRatio,
  deriveMinimumDefenseFrequency as minimumDefenseFrequency,
  deriveMinimumDefenseFrequencyPercent as minimumDefenseFrequencyPercent,
};
