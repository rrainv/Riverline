import {
  CANONICAL_HAND_REPLAY_SOURCE_V3_SCHEMA_VERSION,
  createCanonicalHandReplaySource,
  deriveCanonicalHandReplayEvent,
  getSharedEngineClient,
  REPLAY_FRAME_OPERATIONS,
  type ActorCallEconomics,
  type CanonicalHandReplayEvent,
  type DispatchedEquityResult,
  type EngineClient,
  type EngineResponse,
  type EquityResult,
  type PokerState,
  type ReplayFrameOperation,
  type WeightedEquityResult,
} from '../../engine-api';
import { buildRangeMatrixMask, parsePlayerHandInput } from '../shorthand';
import {
  buildSavedHandFactTitle,
  type EquityStreet,
  type RecordedActionMeta,
  type SavedHandPayload,
  type SavedHandRecord,
} from '../storage';
import type {
  CounterfactualRangeId,
  CounterfactualRangeSpec,
  HeroDecisionRecord,
  ReplayFrameMeta,
  ReviewLimitationCode,
  ReviewSessionSnapshot,
  ReviewStreetSummary,
  SavedLibraryItemSummary,
} from './types';
export const COUNTERFACTUAL_RANGE_TEMPLATES: Readonly<
  Record<Exclude<CounterfactualRangeId, 'showed'>, string>
> = {
  tight: 'QQ+, AKs, AKo',
  standard: 'TT+, AJs+, KQs, AQo+',
  loose: '77+, A9s+, KTs+, QJs, JTs, AJo+, KQo',
};

export const STARTER_FRIDAY_OBJECT_ID = 'starter-friday-section8';
export const STARTER_SPOT_OBJECT_ID = 'starter-tuesday-spot';
export const ALL_STREETS: readonly EquityStreet[] = ['preflop', 'flop', 'turn', 'river'];

export function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function deriveEffectivePotMilliBb(state: PokerState): number {
  if (state.potMilliBb > 0) return state.potMilliBb;
  if (state.recordedSettlement && state.recordedSettlement.grossPotMilliBb > 0) {
    return state.recordedSettlement.grossPotMilliBb;
  }
  if (state.terminal.isTerminal) {
    const payoutSum = Object.values(state.terminal.payoutsMilliBbByPlayer).reduce(
      (sum, amount) => sum + amount,
      0,
    );
    if (payoutSum > 0) return payoutSum;
  }
  return state.players.reduce((sum, player) => sum + player.totalPotContributionMilliBb, 0);
}

export function unwrap<T>(res: EngineResponse<T>, label: string): T {
  if (!res.ok) {
    throw new Error(`${label}: ${res.error.message}`);
  }
  return res.data;
}

export function isEquityResult(data: DispatchedEquityResult): data is EquityResult {
  return (data as { schemaVersion?: string }).schemaVersion === 'equity-result/v1';
}

export function isWeightedResult(data: DispatchedEquityResult): data is WeightedEquityResult {
  return (data as { schemaVersion?: string }).schemaVersion === 'weighted-equity-result/v1';
}

export function buildStarterRulesSnapshot(
  engine: EngineClient,
  seatCount: 2 | 6 | 8,
) {
  return unwrap(
    engine.sync.createGameRulesSnapshot({
      source: { kind: 'direct' },
      setup: { seatedPlayers: seatCount },
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
    }),
    'starter rules snapshot',
  );
}

/**
 * Canonical section-8 Friday showdown example:
 * Hero (BTN AhKh) vs BB (QsQc), 100 bb effective heads-up pot.
 * BTN opens 3 bb, BB 3-bets 10 bb, BTN calls -> 20.0 bb preflop pot.
 * Flop Qh 7c 2h: BB shoves 90 into 20, Hero calls 90 into 200 (45.0% needed vs 25.6% exact).
 * Turn 4c, River 9s: BB wins 200 bb.
 */
export function buildStarterFridayHandRecord(engineInput?: EngineClient): SavedHandRecord {
  const engine = engineInput ?? getSharedEngineClient();
  const rulesSnapshot = buildStarterRulesSnapshot(engine, 2);
  const players = [
    { playerId: 'hero', seat: 0, startingStackMilliBb: 100_000 },
    { playerId: 'seat-2', seat: 1, startingStackMilliBb: 100_000 },
  ];
  let state = unwrap(
    engine.sync.initializeRecordedHand({
      handId: 'friday-section8-ahkh',
      rulesSnapshot,
      buttonSeat: 0,
      players,
    }),
    'init friday hand',
  );
  state = unwrap(
    engine.sync.applyChance(state, {
      type: 'deal_hole',
      cardsByPlayer: { hero: ['Ah', 'Kh'] },
      hiddenPlayerIds: ['seat-2'],
    }),
    'deal friday hole',
  );

  const recordedActions: RecordedActionMeta[] = [];
  const stepAction = (
    playerId: string,
    type: RecordedActionMeta['type'],
    amountToMilliBb: number | null,
  ) => {
    const actor = state.players.find((p) => p.playerId === playerId)!;
    const street = state.street as EquityStreet;
    state = unwrap(
      engine.sync.applyAction(state, {
        schemaVersion: 'poker-action/v1',
        playerId,
        type,
        amountToMilliBb,
      }),
      `action ${playerId} ${type}`,
    );
    recordedActions.push({
      seq: recordedActions.length + 1,
      street,
      playerId,
      seatIndex: actor.seat,
      positionLabel: actor.position,
      isHero: playerId === 'hero',
      type,
      ...(amountToMilliBb !== null ? { amountMilliBb: amountToMilliBb } : {}),
    });
  };

  stepAction('hero', 'raise', 3000);
  stepAction('seat-2', 'raise', 10000);
  stepAction('hero', 'call', null);

  state = unwrap(
    engine.sync.applyChance(state, { type: 'deal_flop', cards: ['Qh', '7c', '2h'] }),
    'friday flop',
  );
  stepAction('seat-2', 'all_in', null);
  stepAction('hero', 'call', null);

  state = unwrap(engine.sync.applyChance(state, { type: 'deal_turn', cards: ['4c'] }), 'friday turn');
  state = unwrap(engine.sync.applyChance(state, { type: 'deal_river', cards: ['9s'] }), 'friday river');
  state = unwrap(
    engine.sync.applyPrivateReveal(state, { playerId: 'seat-2', cards: ['Qs', 'Qc'] }),
    'friday reveal',
  );
  state = unwrap(engine.sync.resolveShowdown(state), 'friday showdown');

  const payload: SavedHandPayload = {
    handId: 'friday-section8-ahkh',
    tablePreset: 'six_max_100bb',
    unitLabel: 'bb',
    seatCount: 6,
    startingStackBb: 100,
    heroPlayerId: 'hero',
    heroSeat: 0,
    heroPositionLabel: 'BTN',
    heroCards: ['Ah', 'Kh'],
    pokerState: state,
    recordedActions,
    heroNotes: [
      {
        actionSeq: 5,
        street: 'flop',
        reasonChip: 'draw',
        customText: '',
      },
    ],
    shorthandLine: 'r3 r10 c / Qh7c2h / allin c',
    savedKind: 'completed_hand',
    tags: ['study'],
  };

  return {
    objectId: STARTER_FRIDAY_OBJECT_ID,
    createdAt: '2026-11-14T21:15:00.000Z',
    updatedAt: '2026-11-14T21:15:00.000Z',
    archived: false,
    factTitle: buildSavedHandFactTitle(payload),
    tags: ['study'],
    payload,
  };
}

export function buildStarterSpotRecord(engine: EngineClient): SavedHandRecord {
  const rulesSnapshot = buildStarterRulesSnapshot(engine, 6);
  const players = [
    { playerId: 'seat-0', seat: 0, startingStackMilliBb: 50_000 },
    { playerId: 'seat-1', seat: 1, startingStackMilliBb: 50_000 },
    { playerId: 'seat-2', seat: 2, startingStackMilliBb: 50_000 },
    { playerId: 'seat-3', seat: 3, startingStackMilliBb: 50_000 },
    { playerId: 'seat-4', seat: 4, startingStackMilliBb: 50_000 },
    { playerId: 'hero', seat: 5, startingStackMilliBb: 50_000 },
  ];
  let state = unwrap(
    engine.sync.initializeRecordedHand({
      handId: 'tuesday-spot-jctd',
      rulesSnapshot,
      buttonSeat: 0,
      players,
    }),
    'init starter spot',
  );
  state = unwrap(
    engine.sync.applyChance(state, {
      type: 'deal_hole',
      cardsByPlayer: { hero: ['Jc', 'Td'] },
      hiddenPlayerIds: ['seat-0', 'seat-1', 'seat-2', 'seat-3', 'seat-4'],
    }),
    'deal starter spot hole',
  );

  const recordedActions: RecordedActionMeta[] = [];
  const stepAction = (
    playerId: string,
    type: RecordedActionMeta['type'],
    amountToMilliBb: number | null,
  ) => {
    const actor = state.players.find((p) => p.playerId === playerId)!;
    const street = state.street as EquityStreet;
    state = unwrap(
      engine.sync.applyAction(state, {
        schemaVersion: 'poker-action/v1',
        playerId,
        type,
        amountToMilliBb,
      }),
      `spot action ${playerId} ${type}`,
    );
    recordedActions.push({
      seq: recordedActions.length + 1,
      street,
      playerId,
      seatIndex: actor.seat,
      positionLabel: actor.position,
      isHero: playerId === 'hero',
      type,
      ...(amountToMilliBb !== null ? { amountMilliBb: amountToMilliBb } : {}),
    });
  };

  stepAction('seat-3', 'fold', null);
  stepAction('seat-4', 'fold', null);
  stepAction('hero', 'raise', 2500);
  stepAction('seat-0', 'fold', null);
  stepAction('seat-1', 'fold', null);
  stepAction('seat-2', 'call', null);
  state = unwrap(
    engine.sync.applyChance(state, { type: 'deal_flop', cards: ['Kh', '9s', '4d'] }),
    'spot flop',
  );
  stepAction('seat-2', 'check', null);
  stepAction('hero', 'bet', 4000);
  stepAction('seat-2', 'call', null);
  state = unwrap(
    engine.sync.applyChance(state, { type: 'deal_turn', cards: ['8c'] }),
    'spot turn',
  );
  stepAction('seat-2', 'bet', 9000);

  const heroPlayer = state.players.find((p) => p.playerId === 'hero')!;
  const payload: SavedHandPayload = {
    handId: 'tuesday-spot-jctd',
    tablePreset: 'home_game_50bb',
    unitLabel: '₪',
    seatCount: 6,
    startingStackBb: 50,
    heroPlayerId: 'hero',
    heroSeat: 5,
    heroPositionLabel: heroPlayer.position,
    heroCards: ['Jc', 'Td'],
    pokerState: state,
    recordedActions,
    heroNotes: [
      {
        actionSeq: 8,
        street: 'flop',
        reasonChip: 'draw',
        customText: 'Open-ended straight draw, barrelled flop then faced turn donk.',
      },
    ],
    shorthandLine: 'f f r2.5 f f c / Kh9s4d / x b4 c / 8c / b9',
    savedKind: 'mid_hand_spot',
    tags: ['review_later', 'unsure'],
  };

  return {
    objectId: STARTER_SPOT_OBJECT_ID,
    createdAt: '2026-11-13T19:40:00.000Z',
    updatedAt: '2026-11-13T19:40:00.000Z',
    archived: false,
    factTitle: buildSavedHandFactTitle(payload),
    tags: ['review_later', 'unsure'],
    payload,
  };
}

export function buildReviewReplaySession(
  engine: EngineClient,
  record: SavedHandRecord,
  isStarterSample = false,
): ReviewSessionSnapshot {
  const payload = record.payload;
  const heroId = payload.heroPlayerId;
  const rulesSnapshot =
    payload.pokerState.rulesSnapshot ??
    buildStarterRulesSnapshot(engine, payload.seatCount);

  let curState = unwrap(
    engine.sync.initializeRecordedHand({
      handId: payload.handId,
      rulesSnapshot,
      buttonSeat: payload.pokerState.buttonSeat,
      players: payload.pokerState.players.map((p) => ({
        playerId: p.playerId,
        seat: p.seat,
        startingStackMilliBb: p.startingStackMilliBb,
      })),
    }),
    'replay initialize',
  );

  const events: CanonicalHandReplayEvent[] = [];
  const frames: ReplayFrameMeta[] = [];

  const appendEvent = (
    operation: ReplayFrameOperation,
    previousState: PokerState | null,
    nextState: PokerState,
    meta: Omit<ReplayFrameMeta, 'index' | 'operation' | 'potMilliBb'>,
  ): number => {
    const sequence = events.length;
    const evt = deriveCanonicalHandReplayEvent({
      sequence,
      operation,
      previousState,
      state: nextState,
    });
    events.push(evt);
    frames.push({
      index: sequence,
      operation,
      potMilliBb: deriveEffectivePotMilliBb(nextState),
      ...meta,
    });
    return sequence;
  };

  appendEvent(REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND, null, curState, {
    street: 'preflop',
    isDecisionFrame: false,
  });

  const hiddenPlayerIds = curState.players
    .filter((p) => p.dealtIn && p.playerId !== heroId)
    .map((p) => p.playerId);
  const dealState = unwrap(
    engine.sync.applyChance(curState, {
      type: 'deal_hole',
      cardsByPlayer: { [heroId]: [...payload.heroCards] },
      hiddenPlayerIds,
    }),
    'replay deal_hole_observed',
  );
  appendEvent(
    hiddenPlayerIds.length > 0
      ? REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED
      : REPLAY_FRAME_OPERATIONS.DEAL_HOLE,
    curState,
    dealState,
    {
      street: 'preflop',
      isDecisionFrame: false,
    },
  );
  curState = dealState;

  const board = payload.pokerState.board;
  const decisions: HeroDecisionRecord[] = [];

  const flushBoardIfChance = (): void => {
    while (curState.phase === 'chance') {
      if (curState.board.length === 0 && board.length >= 3) {
        const flop = board.slice(0, 3);
        const next = unwrap(
          engine.sync.applyChance(curState, { type: 'deal_flop', cards: flop }),
          'replay flop',
        );
        appendEvent(REPLAY_FRAME_OPERATIONS.DEAL_BOARD, curState, next, {
          street: 'flop',
          boardAdded: flop,
          isDecisionFrame: false,
        });
        curState = next;
      } else if (curState.board.length === 3 && board.length >= 4) {
        const turn = board.slice(3, 4);
        const next = unwrap(
          engine.sync.applyChance(curState, { type: 'deal_turn', cards: turn }),
          'replay turn',
        );
        appendEvent(REPLAY_FRAME_OPERATIONS.DEAL_BOARD, curState, next, {
          street: 'turn',
          boardAdded: turn,
          isDecisionFrame: false,
        });
        curState = next;
      } else if (curState.board.length === 4 && board.length >= 5) {
        const river = board.slice(4, 5);
        const next = unwrap(
          engine.sync.applyChance(curState, { type: 'deal_river', cards: river }),
          'replay river',
        );
        appendEvent(REPLAY_FRAME_OPERATIONS.DEAL_BOARD, curState, next, {
          street: 'river',
          boardAdded: river,
          isDecisionFrame: false,
        });
        curState = next;
      } else {
        break;
      }
    }
  };

  for (const act of payload.recordedActions) {
    flushBoardIfChance();

    const preActionFrameIndex = frames.length - 1;
    let pendingDecision: {
      readonly economics: ActorCallEconomics;
      readonly street: EquityStreet;
      readonly boardAtDecision: readonly string[];
      readonly potBeforeDecisionMilliBb: number;
      readonly heroInvestedBeforeDecisionMilliBb: number;
      readonly livePlayerIds: readonly string[];
      readonly villainIds: readonly string[];
    } | null = null;

    if (
      act.playerId === heroId &&
      curState.phase === 'betting' &&
      curState.actingPlayerId === heroId
    ) {
      const heroBefore = curState.players.find((p) => p.playerId === heroId)!;
      const economics = unwrap(
        engine.sync.actorCallEconomics(curState, heroId),
        'decision call economics',
      );
      const liveIds = curState.players.filter((p) => !p.folded && p.dealtIn).map((p) => p.playerId);
      pendingDecision = {
        economics,
        street: curState.street as EquityStreet,
        boardAtDecision: [...curState.board],
        potBeforeDecisionMilliBb: curState.potMilliBb,
        heroInvestedBeforeDecisionMilliBb: heroBefore.totalPotContributionMilliBb,
        livePlayerIds: liveIds,
        villainIds: liveIds.filter((id) => id !== heroId),
      };
    }

    const amountToMilliBb =
      act.type === 'bet' || act.type === 'raise' ? (act.amountMilliBb ?? null) : null;
    const nextState = unwrap(
      engine.sync.applyAction(curState, {
        schemaVersion: 'poker-action/v1',
        playerId: act.playerId,
        type: act.type,
        amountToMilliBb,
      }),
      `replay action ${act.playerId} ${act.type}`,
    );

    const actionFrameIndex = appendEvent(REPLAY_FRAME_OPERATIONS.ACTION, curState, nextState, {
      street: act.street,
      actionSeq: act.seq,
      playerId: act.playerId,
      positionLabel: act.positionLabel,
      isHero: act.isHero,
      actionType: act.type,
      amountMilliBb: act.amountMilliBb,
      approximate: act.approximate,
      isDecisionFrame: Boolean(pendingDecision),
    });

    if (pendingDecision) {
      const reqFrac = pendingDecision.economics.requiredRawEquity;
      decisions.push({
        decisionIndex: decisions.length,
        actionMeta: act,
        preActionFrameIndex,
        actionFrameIndex,
        street: pendingDecision.street,
        boardAtDecision: pendingDecision.boardAtDecision,
        potBeforeDecisionMilliBb: pendingDecision.potBeforeDecisionMilliBb,
        heroInvestedBeforeDecisionMilliBb: pendingDecision.heroInvestedBeforeDecisionMilliBb,
        callEconomics: pendingDecision.economics,
        facingBet: pendingDecision.economics.callCommitmentMilliBb > 0,
        requiredEquityPct: reqFrac !== null ? roundToTenth(reqFrac * 100) : null,
        livePlayerIds: pendingDecision.livePlayerIds,
        villainIds: pendingDecision.villainIds,
      });
    }

    curState = nextState;
  }

  flushBoardIfChance();

  const revealedVillainCardsById: Record<string, readonly string[]> = {};
  if (curState.phase === 'showdown') {
    for (const recordedPlayer of payload.pokerState.players) {
      if (
        recordedPlayer.playerId !== heroId &&
        Array.isArray(recordedPlayer.holeCards) &&
        recordedPlayer.holeCards.length === 2
      ) {
        const pair: readonly [string, string] = [
          recordedPlayer.holeCards[0]!,
          recordedPlayer.holeCards[1]!,
        ];
        const nextReveal = unwrap(
          engine.sync.applyPrivateReveal(curState, {
            playerId: recordedPlayer.playerId,
            cards: pair,
          }),
          `replay reveal ${recordedPlayer.playerId}`,
        );
        appendEvent(REPLAY_FRAME_OPERATIONS.REVEAL_HOLE, curState, nextReveal, {
          street: curState.street as EquityStreet,
          revealedPlayerId: recordedPlayer.playerId,
          positionLabel: recordedPlayer.position,
          isDecisionFrame: false,
        });
        revealedVillainCardsById[recordedPlayer.playerId] = pair;
        curState = nextReveal;
      }
    }

    if (curState.phase === 'showdown' && curState.showdown.status === 'ready') {
      const settledState = unwrap(engine.sync.resolveShowdown(curState), 'replay resolve showdown');
      appendEvent(REPLAY_FRAME_OPERATIONS.SHOWDOWN, curState, settledState, {
        street: settledState.street as EquityStreet,
        isDecisionFrame: false,
      });
      curState = settledState;
    }
  }

  if (payload.pokerState.recordedSettlement && curState.recordedSettlement === null) {
    const settledRec = unwrap(
      engine.sync.applyRecordedSettlement(curState, payload.pokerState.recordedSettlement),
      'replay recorded settlement',
    );
    appendEvent(REPLAY_FRAME_OPERATIONS.RECORDED_SETTLEMENT, curState, settledRec, {
      street: settledRec.street as EquityStreet,
      isDecisionFrame: false,
    });
    curState = settledRec;
  }

  const replaySource = createCanonicalHandReplaySource({
    schemaVersion: CANONICAL_HAND_REPLAY_SOURCE_V3_SCHEMA_VERSION,
    heroPlayerId: heroId,
    events,
  });

  const streetSummaries: ReviewStreetSummary[] = ALL_STREETS.map((street) => {
    const firstFrame = frames.find((f) => f.street === street && f.index >= 1);
    if (!firstFrame) {
      return {
        street,
        firstFrameIndex: -1,
        available: false,
        potMilliBb: 0,
        spr: null,
        boardCards: [],
      };
    }
    const streetState = unwrap(
      engine.sync.projectReplayState(replaySource, firstFrame.index),
      `street summary ${street}`,
    );
    const liveStacks = streetState.players
      .filter((p) => !p.folded && p.dealtIn)
      .map((p) => p.currentStackMilliBb);
    const effectiveStackBb =
      liveStacks.length >= 2 ? Math.min(...liveStacks) / 1000 : null;
    const sprResp =
      streetState.potMilliBb > 0 && effectiveStackBb !== null && liveStacks.length === 2
        ? engine.sync.stackToPotRatio({
            opponentCount: 1,
            callAmountBb: 0,
            actorContestablePotAfterCallBb: streetState.potMilliBb / 1000,
            effectiveStackBb,
          })
        : null;
    return {
      street,
      firstFrameIndex: firstFrame.index,
      available: true,
      potMilliBb: streetState.potMilliBb,
      spr: sprResp && sprResp.ok ? sprResp.data : null,
      boardCards: [...streetState.board],
    };
  });

  const revealedIds = Object.keys(revealedVillainCardsById);
  const limitationCodes: ReviewLimitationCode[] = [];
  if (!curState.terminal.isTerminal) {
    limitationCodes.push('spot_incomplete');
  }
  if (revealedIds.length === 0) {
    limitationCodes.push('no_showdown_cards');
  }
  if (decisions.some((d) => d.villainIds.length > 1)) {
    limitationCodes.push('multiway_pot');
  }
  if (payload.recordedActions.some((a) => Boolean(a.approximate))) {
    limitationCodes.push('approximate_sizing');
  }

  return {
    record,
    isStarterSample,
    replaySource,
    frames,
    decisions,
    revealedVillainIds: revealedIds,
    revealedVillainCardsById,
    streetSummaries,
    limitationCodes,
    totalActionsCount: payload.recordedActions.length,
  };
}

export function buildCounterfactualRangeSpec(
  engine: EngineClient,
  mode: Exclude<CounterfactualRangeId, 'showed'>,
  deadCards: readonly string[],
): CounterfactualRangeSpec | null {
  const rangeString = COUNTERFACTUAL_RANGE_TEMPLATES[mode];
  const parsed = parsePlayerHandInput(rangeString, { deadCards, engine });
  if (!parsed.ok || parsed.kind !== 'range') return null;
  return {
    id: mode,
    rangeString,
    canonical: parsed.canonical,
    eligibleCombos: parsed.eligibleCombos,
    removedCombos: parsed.removedCombos,
    rangeMatrix: buildRangeMatrixMask(parsed.handClasses),
  };
}

export function summarizeRecord(record: SavedHandRecord, isStarterSample: boolean): SavedLibraryItemSummary {
  const hero = record.payload.pokerState.players.find(
    (p) => p.playerId === record.payload.heroPlayerId,
  );
  const terminal = record.payload.pokerState.terminal;
  let heroNetBb: number | null = null;
  if (terminal.isTerminal && hero) {
    const payout = terminal.payoutsMilliBbByPlayer[record.payload.heroPlayerId] ?? 0;
    heroNetBb = roundToTenth((payout - hero.totalPotContributionMilliBb) / 1000);
  }
  return {
    record,
    isStarterSample,
    isCompleted: record.payload.savedKind === 'completed_hand',
    finalPotBb: roundToTenth(deriveEffectivePotMilliBb(record.payload.pokerState) / 1000),
    board: [...record.payload.pokerState.board],
    heroPosition: record.payload.heroPositionLabel,
    actionCount: record.payload.recordedActions.length,
    heroNetBb,
  };
}

