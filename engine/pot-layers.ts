import { deepFreeze } from './freeze';
import { playersBySeat } from './positions';
import {
  ANTE_TYPES,
  LEDGER_KINDS,
  POKER_POT_LAYER_SCHEMA_VERSION,
  POKER_POT_LAYER_V2_SCHEMA_VERSION,
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_SCHEMA_VERSIONS,
  POKER_STATE_V2_SCHEMA_VERSION,
  POKER_UNMATCHED_CONTRIBUTION_SCHEMA_VERSION,
  type PokerPlayerState,
  type PokerState,
  type PotAccounting,
  type PotLayer,
  type UnmatchedContribution,
} from './schema';
import { isPlayerLive } from './selectors';

interface SeatContribution {
  readonly player: PokerPlayerState;
  readonly amountMilliBb: number;
  readonly anteMilliBb: number;
}

function requireContributionState(state: PokerState): PokerState {
  if (!state || !POKER_STATE_SCHEMA_VERSIONS.includes(state.schemaVersion)) {
    throw new TypeError(
      `Expected ${POKER_STATE_SCHEMA_VERSION} or ${POKER_STATE_V2_SCHEMA_VERSION}`,
    );
  }
  if (!Array.isArray(state.players) || !Array.isArray(state.ledger)) {
    throw new TypeError('Pot derivation requires canonical players and ledger arrays');
  }
  return state;
}

function effectiveContributionsBySeat(state: PokerState): SeatContribution[] {
  requireContributionState(state);
  const refundedByPlayerId = new Map<string, number>(
    state.players.map((player) => [player.playerId, 0]),
  );
  for (const entry of state.ledger) {
    if (entry.kind === LEDGER_KINDS.UNCALLED_REFUND && entry.playerId !== null) {
      refundedByPlayerId.set(
        entry.playerId,
        (refundedByPlayerId.get(entry.playerId) ?? 0) + entry.amountMilliBb,
      );
    }
  }
  const anteByPlayerId = new Map<string, number>();
  for (const entry of state.ledger) {
    if (entry.kind === LEDGER_KINDS.ANTE && entry.playerId !== null) {
      anteByPlayerId.set(
        entry.playerId,
        (anteByPlayerId.get(entry.playerId) ?? 0) + entry.amountMilliBb,
      );
    }
  }
  return playersBySeat(state.players).map((player) => {
    const anteMilliBb = anteByPlayerId.get(player.playerId) ?? 0;
    const amountMilliBb =
      player.totalPotContributionMilliBb -
      (refundedByPlayerId.get(player.playerId) ?? 0) -
      anteMilliBb;
    if (!Number.isSafeInteger(amountMilliBb) || amountMilliBb < 0) {
      throw new RangeError(`Refunds exceed gross pot contribution for ${player.playerId}`);
    }
    return { player, amountMilliBb, anteMilliBb };
  });
}

function potLayersFromContributions(contributions: readonly SeatContribution[]): PotLayer[] {
  const thresholds = [
    ...new Set(contributions.map((entry) => entry.amountMilliBb).filter((amount) => amount > 0)),
  ].sort((left, right) => left - right);
  const layers: PotLayer[] = [];
  let contributionFloorMilliBb = 0;

  for (const contributionCeilingMilliBb of thresholds) {
    const contributors = contributions.filter(
      (entry) => entry.amountMilliBb >= contributionCeilingMilliBb,
    );
    if (contributors.length >= 2) {
      const amountMilliBb =
        (contributionCeilingMilliBb - contributionFloorMilliBb) * contributors.length;
      if (!Number.isSafeInteger(amountMilliBb)) {
        throw new RangeError('Pot layer amount exceeds safe integer precision');
      }
      layers.push({
        schemaVersion: POKER_POT_LAYER_SCHEMA_VERSION,
        amountMilliBb,
        contributionFloorMilliBb,
        contributionCeilingMilliBb,
        contributorPlayerIds: contributors.map((entry) => entry.player.playerId),
        eligiblePlayerIds: contributors
          .filter((entry) => isPlayerLive(entry.player))
          .map((entry) => entry.player.playerId),
      });
    }
    contributionFloorMilliBb = contributionCeilingMilliBb;
  }
  return layers;
}

export function deriveUnmatchedContribution(
  state: PokerState,
  recipientPlayerId: string | null = null,
): UnmatchedContribution | null {
  const contributions = effectiveContributionsBySeat(state);
  let candidate: SeatContribution | null;
  if (recipientPlayerId === null) {
    candidate = contributions.reduce<SeatContribution | null>(
      (highest, entry) =>
        highest === null || entry.amountMilliBb > highest.amountMilliBb ? entry : highest,
      null,
    );
  } else {
    candidate =
      contributions.find((entry) => entry.player.playerId === recipientPlayerId) ?? null;
    if (candidate === null) throw new RangeError(`Unknown playerId: ${recipientPlayerId}`);
  }
  if (candidate === null || candidate.amountMilliBb === 0) return null;

  const candidateId = candidate.player.playerId;
  const contributionFloorMilliBb = contributions
    .filter((entry) => entry.player.playerId !== candidateId)
    .reduce((maximum, entry) => Math.max(maximum, entry.amountMilliBb), 0);
  const amountMilliBb = candidate.amountMilliBb - contributionFloorMilliBb;
  if (amountMilliBb <= 0) return null;

  return deepFreeze({
    schemaVersion: POKER_UNMATCHED_CONTRIBUTION_SCHEMA_VERSION,
    playerId: candidateId,
    amountMilliBb,
    contributionFloorMilliBb,
    contributionCeilingMilliBb: candidate.amountMilliBb,
  });
}

export function derivePotLayers(state: PokerState): readonly PotLayer[] {
  const contributions = effectiveContributionsBySeat(state);
  const layers = potLayersFromContributions(contributions);
  const anteMilliBb = contributions.reduce((sum, entry) => sum + entry.anteMilliBb, 0);
  const antePools: Array<{ amount: number; funders: readonly SeatContribution[] }> = [];
  if (anteMilliBb > 0 && state.game.ante.type === ANTE_TYPES.PER_PLAYER) {
    let floor = 0;
    const thresholds = [
      ...new Set(contributions.map((entry) => entry.anteMilliBb).filter(Boolean)),
    ].sort((a, b) => a - b);
    for (const ceiling of thresholds) {
      const funders = contributions.filter((entry) => entry.anteMilliBb >= ceiling);
      antePools.push({ amount: (ceiling - floor) * funders.length, funders });
      floor = ceiling;
    }
  } else if (anteMilliBb > 0) {
    // A BBA funds the shared ante for the table, including ante-only all-ins.
    antePools.push({ amount: anteMilliBb, funders: contributions });
  }
  const deadLayers: PotLayer[] = [];
  for (const pool of antePools) {
    const eligiblePlayerIds = pool.funders
      .filter((entry) => isPlayerLive(entry.player))
      .map((entry) => entry.player.playerId);
    // Combine identical eligibility before splitting odd chips.
    const index = layers.findIndex((layer) => sameIds(layer.eligiblePlayerIds, eligiblePlayerIds));
    if (index >= 0) {
      const existing = layers[index]!;
      layers[index] = {
        ...existing,
        schemaVersion: POKER_POT_LAYER_V2_SCHEMA_VERSION,
        amountMilliBb: existing.amountMilliBb + pool.amount,
        anteMilliBb: (existing.anteMilliBb ?? 0) + pool.amount,
      };
    } else {
      deadLayers.push({
        schemaVersion: POKER_POT_LAYER_V2_SCHEMA_VERSION,
        amountMilliBb: pool.amount,
        anteMilliBb: pool.amount,
        contributionFloorMilliBb: 0,
        contributionCeilingMilliBb: 0,
        contributorPlayerIds: pool.funders
          .filter((entry) => entry.anteMilliBb > 0)
          .map((entry) => entry.player.playerId),
        eligiblePlayerIds,
      });
    }
  }
  layers.unshift(...deadLayers);
  return deepFreeze(layers);
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function samePotLayer(left: PotLayer, right: PotLayer): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.anteMilliBb === right.anteMilliBb &&
    left.amountMilliBb === right.amountMilliBb &&
    left.contributionFloorMilliBb === right.contributionFloorMilliBb &&
    left.contributionCeilingMilliBb === right.contributionCeilingMilliBb &&
    sameIds(left.contributorPlayerIds, right.contributorPlayerIds) &&
    sameIds(left.eligiblePlayerIds, right.eligiblePlayerIds)
  );
}

function sameUnmatchedContribution(
  left: UnmatchedContribution | null,
  right: UnmatchedContribution | null,
): boolean {
  if (left === null || right === null) return left === right;
  return (
    left.schemaVersion === right.schemaVersion &&
    left.playerId === right.playerId &&
    left.amountMilliBb === right.amountMilliBb &&
    left.contributionFloorMilliBb === right.contributionFloorMilliBb &&
    left.contributionCeilingMilliBb === right.contributionCeilingMilliBb
  );
}

export function validatePotAccounting(state: PokerState, accounting: PotAccounting): PotAccounting {
  requireContributionState(state);
  if (!accounting || typeof accounting !== 'object' || !Array.isArray(accounting.potLayers)) {
    throw new TypeError('Pot accounting requires a potLayers array');
  }
  const playerByIdMap = new Map(state.players.map((player) => [player.playerId, player]));
  let previousCeilingMilliBb = 0;
  let contestablePotMilliBb = 0;

  for (const layer of accounting.potLayers) {
    if (layer?.schemaVersion === POKER_POT_LAYER_V2_SCHEMA_VERSION) {
      // v2 dead-money funding/eligibility is checked against canonical ledger
      // derivation below; it is deliberately not a matched-wager threshold.
      if (
        !Number.isSafeInteger(layer.amountMilliBb) ||
        layer.amountMilliBb <= 0 ||
        !Number.isSafeInteger(layer.anteMilliBb) ||
        (layer.anteMilliBb ?? 0) <= 0 ||
        layer.amountMilliBb % state.game.chipUnitMilliBb !== 0
      ) {
        throw new RangeError('Ante layer requires positive aligned funding');
      }
      previousCeilingMilliBb = layer.contributionCeilingMilliBb;
      contestablePotMilliBb += layer.amountMilliBb;
      continue;
    }
    if (!layer || layer.schemaVersion !== POKER_POT_LAYER_SCHEMA_VERSION) {
      throw new TypeError(`Expected ${POKER_POT_LAYER_SCHEMA_VERSION}`);
    }
    for (const [field, amount] of [
      ['amountMilliBb', layer.amountMilliBb],
      ['contributionFloorMilliBb', layer.contributionFloorMilliBb],
      ['contributionCeilingMilliBb', layer.contributionCeilingMilliBb],
    ] as const) {
      if (
        !Number.isSafeInteger(amount) ||
        amount < 0 ||
        amount % state.game.chipUnitMilliBb !== 0
      ) {
        throw new RangeError(`${field} must be a nonnegative aligned safe integer`);
      }
    }
    if (
      layer.amountMilliBb === 0 ||
      layer.contributionFloorMilliBb !== previousCeilingMilliBb ||
      layer.contributionCeilingMilliBb <= layer.contributionFloorMilliBb
    ) {
      throw new RangeError('Pot layers must be positive, ascending, and non-overlapping');
    }
    if (
      !Array.isArray(layer.contributorPlayerIds) ||
      layer.contributorPlayerIds.length < 2 ||
      new Set(layer.contributorPlayerIds).size !== layer.contributorPlayerIds.length ||
      layer.contributorPlayerIds.some((playerId: string) => !playerByIdMap.has(playerId))
    ) {
      throw new RangeError('A contestable layer requires at least two unique valid contributors');
    }
    if (
      !Array.isArray(layer.eligiblePlayerIds) ||
      new Set(layer.eligiblePlayerIds).size !== layer.eligiblePlayerIds.length ||
      layer.eligiblePlayerIds.some((playerId: string) => {
        const player = playerByIdMap.get(playerId);
        return !layer.contributorPlayerIds.includes(playerId) || !player || !isPlayerLive(player);
      })
    ) {
      throw new RangeError('Eligible players must be unique live contributors');
    }
    const expectedAmount =
      (layer.contributionCeilingMilliBb - layer.contributionFloorMilliBb) *
      layer.contributorPlayerIds.length;
    if (layer.amountMilliBb !== expectedAmount) {
      throw new RangeError('Pot layer amount must equal its funded threshold width');
    }
    previousCeilingMilliBb = layer.contributionCeilingMilliBb;
    contestablePotMilliBb += layer.amountMilliBb;
  }

  const unmatched = accounting.unmatchedContribution;
  if (unmatched !== null) {
    if (
      !unmatched ||
      unmatched.schemaVersion !== POKER_UNMATCHED_CONTRIBUTION_SCHEMA_VERSION ||
      !playerByIdMap.has(unmatched.playerId)
    ) {
      throw new TypeError(`Expected ${POKER_UNMATCHED_CONTRIBUTION_SCHEMA_VERSION}`);
    }
    if (
      !Number.isSafeInteger(unmatched.amountMilliBb) ||
      unmatched.amountMilliBb <= 0 ||
      !Number.isSafeInteger(unmatched.contributionFloorMilliBb) ||
      !Number.isSafeInteger(unmatched.contributionCeilingMilliBb) ||
      unmatched.contributionFloorMilliBb < 0 ||
      unmatched.amountMilliBb % state.game.chipUnitMilliBb !== 0 ||
      unmatched.contributionFloorMilliBb % state.game.chipUnitMilliBb !== 0 ||
      unmatched.contributionCeilingMilliBb % state.game.chipUnitMilliBb !== 0 ||
      unmatched.contributionCeilingMilliBb - unmatched.contributionFloorMilliBb !==
        unmatched.amountMilliBb
    ) {
      throw new RangeError(
        'Unmatched contribution must be a positive aligned threshold remainder',
      );
    }
  }
  const unmatchedMilliBb = unmatched === null ? 0 : unmatched.amountMilliBb;
  if (
    contestablePotMilliBb !== accounting.contestablePotMilliBb ||
    unmatchedMilliBb !== accounting.unmatchedMilliBb ||
    contestablePotMilliBb + unmatchedMilliBb !== state.potMilliBb
  ) {
    throw new RangeError('Contestable layers plus unmatched excess must equal the canonical pot');
  }

  const expectedLayers = derivePotLayers(state);
  const expectedUnmatched = deriveUnmatchedContribution(state);
  if (
    expectedLayers.length !== accounting.potLayers.length ||
    expectedLayers.some((layer, index) => !samePotLayer(layer, accounting.potLayers[index]!)) ||
    !sameUnmatchedContribution(expectedUnmatched, unmatched)
  ) {
    throw new RangeError('Pot accounting must match canonical contribution derivation');
  }
  return accounting;
}

export function derivePotAccounting(state: PokerState): PotAccounting {
  const potLayers = derivePotLayers(state);
  const unmatchedContribution = deriveUnmatchedContribution(state);
  const contestablePotMilliBb = potLayers.reduce((sum, layer) => sum + layer.amountMilliBb, 0);
  const accounting: PotAccounting = {
    potLayers,
    unmatchedContribution,
    contestablePotMilliBb,
    unmatchedMilliBb: unmatchedContribution === null ? 0 : unmatchedContribution.amountMilliBb,
  };
  validatePotAccounting(state, accounting);
  return deepFreeze(accounting);
}
