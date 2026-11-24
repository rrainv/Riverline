import type {
  EngineClient,
  GameRulesSnapshot,
  PokerState,
} from '../../engine-api';
import type { RecordedActionMeta, SavedHandPayload } from '../storage';
import {
  ORBIT_BOTS,
  ORBIT_STARTING_STACK_BB,
  ORBIT_TOTAL_HANDS,
  type OrbitCompletedHandSummary,
  type OrbitLiveState,
} from './orbitTypes';
import {
  buildDuelSizePresets,
  formatShorthandForDuel,
  roundTenth,
  seededShuffleDeck,
} from './trainingHelpers';
import type { TrainingActionTicketId } from './types';

export interface OrbitDeckEntry {
  readonly deck: readonly string[];
  readonly botCardsByPlayer: Readonly<Record<string, readonly [string, string]>>;
  readonly boardIdx: number;
}

const SIX_MAX_POSITION_LABELS = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'] as const;

export function getSixMaxPositionLabel(seat: number, buttonSeat: number): string {
  const offset = (((seat - buttonSeat) % 6) + 6) % 6;
  return SIX_MAX_POSITION_LABELS[offset] ?? 'BTN';
}

export function createSixMaxOrbitRules(engine: EngineClient): GameRulesSnapshot {
  const res = engine.sync.createGameRulesSnapshot({
    source: { kind: 'direct' },
    setup: { seatedPlayers: 6 },
    definition: {
      schemaVersion: 'game-rules-definition/v2',
      variant: 'no_limit_texas_holdem',
      format: 'cash',
      tableSize: { minimumSeated: 2, maximumSeated: 10 },
      blinds: { smallBlindMilliBb: 500, bigBlindMilliBb: 1000, chipUnitMilliBb: 100 },
      ante: { type: 'none', amountMilliBb: 0 },
      straddle: { type: 'none' },
      collectionPolicy: { type: 'none' },
      recordedSettlementPolicy: { type: 'source_recorded_rake', rakeModel: 'unknown' },
    },
  });
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}

export function defaultSelectedOrbitTicket(
  legalSpec: OrbitLiveState['legalSpec'],
): TrainingActionTicketId | null {
  if (!legalSpec) return null;
  if (legalSpec.check.available) return 'check';
  if (legalSpec.call.available) return 'call';
  if (legalSpec.bet.available) return 'bet';
  if (legalSpec.raise.available) return 'raise';
  if (legalSpec.allIn.available) return 'all_in';
  if (legalSpec.fold.available) return 'fold';
  return null;
}

export function toOrbitRecordedActions(
  finalState: PokerState,
  buttonSeat: number,
): RecordedActionMeta[] {
  return finalState.actionHistory.map((act, idx) => {
    const sub = act.submittedAction;
    const player = finalState.players.find((p) => p.playerId === act.playerId);
    const seat = player?.seat ?? 0;
    return {
      seq: idx + 1,
      street: act.street,
      playerId: act.playerId,
      seatIndex: seat,
      positionLabel: getSixMaxPositionLabel(seat, buttonSeat),
      isHero: act.playerId === 'hero',
      type: sub.type,
      ...(sub.amountToMilliBb !== null ? { amountMilliBb: sub.amountToMilliBb } : {}),
    };
  });
}

export function getOrbitActorName(playerId: string): string {
  if (playerId === 'hero') return 'Hero';
  return ORBIT_BOTS.find((b) => b.playerId === playerId)?.name ?? playerId;
}

export function dealSixMaxOrbitHand(
  engine: EngineClient,
  rules: GameRulesSnapshot,
  handNumber: number,
  sessionSeed: number,
  prev: OrbitLiveState | null,
  decksByHandId: Map<string, OrbitDeckEntry>,
): OrbitLiveState {
  const handSeed = sessionSeed + handNumber * 7919;
  const deck = seededShuffleDeck(handSeed);
  const heroCards: readonly [string, string] = [deck[0]!, deck[1]!];
  const botCardsByPlayer: Record<string, readonly [string, string]> = {};
  for (let idx = 0; idx < ORBIT_BOTS.length; idx += 1) {
    const bot = ORBIT_BOTS[idx]!;
    const cardOffset = 2 + idx * 2;
    botCardsByPlayer[bot.playerId] = [deck[cardOffset]!, deck[cardOffset + 1]!];
  }

  const buttonSeat = (handNumber - 1) % 6;
  const heroPositionLabel = getSixMaxPositionLabel(0, buttonSeat);
  const handId = `orbit-${sessionSeed}-h${handNumber}`;
  decksByHandId.set(handId, {
    deck,
    botCardsByPlayer,
    boardIdx: 2 + ORBIT_BOTS.length * 2,
  });

  const players = [
    { playerId: 'hero', seat: 0, startingStackMilliBb: ORBIT_STARTING_STACK_BB * 1000 },
    ...ORBIT_BOTS.map((bot) => ({
      playerId: bot.playerId,
      seat: bot.seat,
      startingStackMilliBb: ORBIT_STARTING_STACK_BB * 1000,
    })),
  ];

  const initRes = engine.sync.initializeRecordedHand({
    handId,
    rulesSnapshot: rules,
    buttonSeat,
    players,
  });
  if (!initRes.ok) throw new Error(initRes.error.message);

  const dealRes = engine.sync.applyChance(initRes.data, {
    type: 'deal_hole',
    cardsByPlayer: { hero: [...heroCards] },
    hiddenPlayerIds: ORBIT_BOTS.map((b) => b.playerId),
  });
  if (!dealRes.ok) throw new Error(dealRes.error.message);

  const pokerState = dealRes.data;
  const isHeroTurn = pokerState.actingPlayerId === 'hero';
  const legalRes = isHeroTurn ? engine.sync.legalActions(pokerState) : null;
  const econRes = isHeroTurn ? engine.sync.actorCallEconomics(pokerState, 'hero') : null;
  const legalSpec = legalRes && legalRes.ok ? legalRes.data : null;
  const customSizes = prev?.customSizeAmountsBb ?? {};
  const sizePresets = legalSpec
    ? buildDuelSizePresets(engine, pokerState, legalSpec, customSizes)
    : [];

  return {
    sessionSeed,
    handNumber,
    totalHands: ORBIT_TOTAL_HANDS,
    buttonSeat,
    heroPositionLabel,
    heroCards,
    pokerState,
    revealedCardsByPlayer: {},
    thinkingPlayerId:
      !isHeroTurn && pokerState.actingPlayerId ? pokerState.actingPlayerId : null,
    bubblesByPlayer: {},
    legalSpec,
    callEconomics: econRes && econRes.ok ? econRes.data : null,
    sizePresets,
    customSizeAmountsBb: customSizes,
    heroCumulativeNetBb: prev ? prev.heroCumulativeNetBb : 0,
    lastHandNetBb: null,
    historyItems: [],
    completedHands: prev ? prev.completedHands : [],
    finishedOrbit: false,
    savedToReviewCount: prev ? prev.savedToReviewCount : null,
  };
}

export function finalizeCompletedOrbitHand(
  live: OrbitLiveState,
  finalState: PokerState,
  decksByHandId: Map<string, OrbitDeckEntry>,
): OrbitLiveState {
  const handId = finalState.handId ?? `orbit-${live.sessionSeed}-h${live.handNumber}`;
  const deckEntry = decksByHandId.get(handId);
  const heroPlayer = finalState.players.find((p) => p.playerId === 'hero');
  const heroEndBb = heroPlayer ? heroPlayer.currentStackMilliBb / 1000 : ORBIT_STARTING_STACK_BB;
  const netBb = roundTenth(heroEndBb - ORBIT_STARTING_STACK_BB);
  const heroCumulativeNetBb = roundTenth(live.heroCumulativeNetBb + netBb);
  const isShowdown = finalState.terminal.reason === 'showdown';

  const revealedCardsByPlayer: Record<string, readonly [string, string]> = {};
  if (isShowdown && deckEntry) {
    for (const bot of ORBIT_BOTS) {
      const botPlayer = finalState.players.find((p) => p.playerId === bot.playerId);
      if (botPlayer && !botPlayer.folded && deckEntry.botCardsByPlayer[bot.playerId]) {
        revealedCardsByPlayer[bot.playerId] = deckEntry.botCardsByPlayer[bot.playerId]!;
      }
    }
  }

  const payload: SavedHandPayload = {
    handId,
    tablePreset: 'six_max_100bb',
    unitLabel: 'bb',
    seatCount: 6,
    startingStackBb: ORBIT_STARTING_STACK_BB,
    heroPlayerId: 'hero',
    heroSeat: 0,
    heroPositionLabel: live.heroPositionLabel,
    heroCards: live.heroCards,
    pokerState: finalState,
    recordedActions: toOrbitRecordedActions(finalState, live.buttonSeat),
    heroNotes: [],
    shorthandLine: formatShorthandForDuel(finalState),
    savedKind: 'completed_hand',
    tags: ['study'],
  };

  const handSummary: OrbitCompletedHandSummary = {
    handNumber: live.handNumber,
    handId,
    heroPositionLabel: live.heroPositionLabel,
    heroCards: live.heroCards,
    revealedCardsByPlayer,
    netBb,
    endedAtStreet: finalState.street,
    winnerPlayerIds: [...finalState.terminal.winnerPlayerIds],
    savedPayload: payload,
  };

  const completedHands = [...live.completedHands, handSummary];
  const finishedOrbit = live.handNumber >= ORBIT_TOTAL_HANDS;

  return {
    ...live,
    pokerState: finalState,
    revealedCardsByPlayer,
    thinkingPlayerId: null,
    legalSpec: null,
    callEconomics: null,
    sizePresets: [],
    heroCumulativeNetBb,
    lastHandNetBb: netBb,
    completedHands,
    finishedOrbit,
  };
}
