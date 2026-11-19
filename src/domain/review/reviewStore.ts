import { computed, effect, signal } from '@preact/signals';
import {
  CANONICAL_HAND_REPLAY_SOURCE_V3_SCHEMA_VERSION,
  createCanonicalHandReplaySource,
  deriveCanonicalHandReplayEvent,
  EQUITY_REQUEST_SCHEMA_VERSION,
  getSharedEngineClient,
  REPLAY_FRAME_OPERATIONS,
  WEIGHTED_EQUITY_REQUEST_VERSION,
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
  getDefaultStudyRepository,
  type EquityStreet,
  type HeroDecisionNote,
  type RecordedActionMeta,
  type SavedHandPayload,
  type SavedHandRecord,
  type SavedObjectTagId,
  type StudyImportResult,
  type StudyRepository,
  type ThinkingReasonId,
} from '../storage';
import type {
  CounterfactualRangeId,
  CounterfactualRangeSpec,
  DecisionEquityEvaluation,
  DecisionsVsLuckSummary,
  HeroDecisionRecord,
  ReplayFrameMeta,
  ReviewLimitationCode,
  ReviewPresetId,
  ReviewSessionSnapshot,
  ReviewSideTab,
  ReviewStore,
  ReviewStreetSummary,
  SavedLibraryFilter,
  SavedLibraryItemSummary,
  SavedLibrarySort,
} from './types';

export const COUNTERFACTUAL_RANGE_TEMPLATES: Readonly<
  Record<Exclude<CounterfactualRangeId, 'showed'>, string>
> = {
  tight: 'QQ+, AKs, AKo',
  standard: 'TT+, AJs+, KQs, AQo+',
  loose: '77+, A9s+, KTs+, QJs, JTs, AJo+, KQo',
};

const STARTER_FRIDAY_OBJECT_ID = 'starter-friday-section8';
const STARTER_SPOT_OBJECT_ID = 'starter-tuesday-spot';
const ALL_STREETS: readonly EquityStreet[] = ['preflop', 'flop', 'turn', 'river'];

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function deriveEffectivePotMilliBb(state: PokerState): number {
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

function unwrap<T>(res: EngineResponse<T>, label: string): T {
  if (!res.ok) {
    throw new Error(`${label}: ${res.error.message}`);
  }
  return res.data;
}

function isEquityResult(data: DispatchedEquityResult): data is EquityResult {
  return (data as { schemaVersion?: string }).schemaVersion === 'equity-result/v1';
}

function isWeightedResult(data: DispatchedEquityResult): data is WeightedEquityResult {
  return (data as { schemaVersion?: string }).schemaVersion === 'weighted-equity-result/v1';
}

function buildStarterRulesSnapshot(
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

function buildStarterSpotRecord(engine: EngineClient): SavedHandRecord {
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
      streetState.potMilliBb > 0 && effectiveStackBb !== null
        ? engine.sync.stackToPotRatio({
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

function summarizeRecord(record: SavedHandRecord, isStarterSample: boolean): SavedLibraryItemSummary {
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

export interface CreateReviewStoreOptions {
  readonly engine?: EngineClient;
  readonly repository?: StudyRepository;
  readonly autoLoadSaved?: boolean;
  readonly includeStarterSamples?: boolean;
  readonly initialPreset?: ReviewPresetId;
}

export function createReviewStore(options: CreateReviewStoreOptions = {}): ReviewStore {
  const engine = options.engine ?? getSharedEngineClient();
  const repository = options.repository ?? getDefaultStudyRepository();
  const includeStarterSamples = options.includeStarterSamples ?? true;

  const starterFriday = buildStarterFridayHandRecord(engine);
  const starterSpot = buildStarterSpotRecord(engine);

  const starterRecordsSignal = signal<readonly SavedHandRecord[]>(
    includeStarterSamples ? [starterFriday, starterSpot] : [],
  );
  const repoRecordsSignal = signal<readonly SavedHandRecord[]>([]);

  const savedHandsSignal = signal<readonly SavedHandRecord[]>(
    includeStarterSamples ? [starterFriday, starterSpot] : [],
  );

  const activeSideTabSignal = signal<ReviewSideTab>('review');
  const activeRecordSignal = signal<SavedHandRecord>(starterFriday);
  const frameIndexSignal = signal<number>(0);
  const selectedDecisionIndexSignal = signal<number>(0);
  const counterfactualRangeSignal = signal<CounterfactualRangeId>('showed');
  const feltExpandedSignal = signal<boolean>(false);

  const savedFilterSignal = signal<SavedLibraryFilter>('all');
  const savedSortSignal = signal<SavedLibrarySort>('new');
  const savedSeatFilterSignal = signal<string>('all');
  const savedSearchSignal = signal<string>('');
  const backupStatusSignal = signal<
    | { readonly kind: 'idle' }
    | { readonly kind: 'imported'; readonly importedCount: number }
    | { readonly kind: 'error'; readonly detail: string }
  >({ kind: 'idle' });

  const decisionEvaluationSignal = signal<DecisionEquityEvaluation>({
    decisionIndex: 0,
    mode: 'showed',
    tier: 'exact',
    detailKey: 'showdown_exact',
    trials: null,
    heroEquityPct: null,
    villainEquityPct: null,
    requiredEquityPct: null,
    deltaVsRequiredPct: null,
    villainRangeSpec: null,
    villainPositionLabel: null,
    villainRevealedCards: null,
    isMathMistake: false,
    isLoading: false,
  });

  const decisionsVsLuckSignal = signal<DecisionsVsLuckSummary>({
    tier: 'unavailable',
    isAvailable: false,
    unavailableReason: 'spot_incomplete',
    trials: null,
    showdownHeroEquityPct: null,
    decisiveCallNeededPct: null,
    decisiveCallAmountBb: null,
    callVsFoldEvBb: null,
    handEvBb: null,
    runoutLuckBb: null,
    actualNetBb: null,
    finalPotBb: 0,
    wonShowdown: false,
    unitLabel: 'bb',
    isLoading: false,
  });

  const decisionChannel = engine.createChannel<DispatchedEquityResult>('review-decision-equity');
  const luckChannel = engine.createChannel<DispatchedEquityResult>('review-luck-equity');

  function syncSavedListSignals(): void {
    const repoList = repoRecordsSignal.value;
    savedHandsSignal.value =
      repoList.length > 0 ? repoList : starterRecordsSignal.value;
  }

  const replaySnapshotSignal = computed<ReviewSessionSnapshot>(() => {
    const rec = activeRecordSignal.value;
    const isStarter =
      rec.objectId === STARTER_FRIDAY_OBJECT_ID || rec.objectId === STARTER_SPOT_OBJECT_ID;
    return buildReviewReplaySession(engine, rec, isStarter);
  });

  const currentFrameMetaSignal = computed<ReplayFrameMeta>(() => {
    const snap = replaySnapshotSignal.value;
    const idx = Math.max(0, Math.min(snap.frames.length - 1, frameIndexSignal.value));
    return snap.frames[idx] ?? snap.frames[0]!;
  });

  const currentPokerStateSignal = computed<PokerState>(() => {
    const snap = replaySnapshotSignal.value;
    const idx = Math.max(0, Math.min(snap.frames.length - 1, frameIndexSignal.value));
    return unwrap(
      engine.sync.projectReplayState(snap.replaySource, idx),
      'projectReplayState',
    );
  });

  const currentDecisionSignal = computed<HeroDecisionRecord | null>(() => {
    const snap = replaySnapshotSignal.value;
    if (snap.decisions.length === 0) return null;
    const idx = Math.max(0, Math.min(snap.decisions.length - 1, selectedDecisionIndexSignal.value));
    return snap.decisions[idx] ?? snap.decisions[0]!;
  });

  const activeHeroNoteSignal = computed<HeroDecisionNote | null>(() => {
    const decision = currentDecisionSignal.value;
    if (!decision) return null;
    const rec = activeRecordSignal.value;
    return (
      rec.payload.heroNotes.find((note) => note.actionSeq === decision.actionMeta.seq) ?? null
    );
  });

  const savedLibraryItemsSignal = computed<readonly SavedLibraryItemSummary[]>(() => {
    const usingStarters = repoRecordsSignal.value.length === 0;
    return savedHandsSignal.value.map((rec) => summarizeRecord(rec, usingStarters));
  });

  const availableSeatFiltersSignal = computed<readonly string[]>(() => {
    const seats = new Set<string>();
    for (const item of savedLibraryItemsSignal.value) {
      seats.add(item.heroPosition);
    }
    return [...seats];
  });

  const filteredSavedItemsSignal = computed<readonly SavedLibraryItemSummary[]>(() => {
    const items = savedLibraryItemsSignal.value;
    const filter = savedFilterSignal.value;
    const seatFilter = savedSeatFilterSignal.value;
    const sort = savedSortSignal.value;
    const query = savedSearchSignal.value.trim().toLowerCase();

    const filtered = items.filter((item) => {
      if (filter === 'archived') {
        if (!item.record.archived) return false;
      } else {
        if (item.record.archived) return false;
        if (filter === 'hands' && !item.isCompleted) return false;
        if (filter === 'spots' && item.isCompleted) return false;
      }

      if (seatFilter !== 'all' && item.heroPosition !== seatFilter) {
        return false;
      }

      if (query) {
        const haystack = [
          item.record.factTitle,
          item.heroPosition,
          item.record.payload.shorthandLine,
          ...item.record.payload.heroNotes.map((n) => n.customText ?? ''),
          ...item.record.tags,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });

    if (sort === 'big') {
      return [...filtered].sort((a, b) => b.finalPotBb - a.finalPotBb);
    }
    return [...filtered].sort((a, b) =>
      b.record.updatedAt.localeCompare(a.record.updatedAt),
    );
  });

  let decisionRunNonce = 0;
  let luckRunNonce = 0;

  async function runDecisionEvaluation(
    snap: ReviewSessionSnapshot,
    decision: HeroDecisionRecord | null,
    mode: CounterfactualRangeId,
  ): Promise<void> {
    decisionRunNonce += 1;
    const runId = decisionRunNonce;

    if (!decision) {
      decisionChannel.cancel();
      decisionEvaluationSignal.value = {
        decisionIndex: 0,
        mode,
        tier: 'unavailable',
        detailKey: 'unavailable',
        trials: null,
        heroEquityPct: null,
        villainEquityPct: null,
        requiredEquityPct: null,
        deltaVsRequiredPct: null,
        villainRangeSpec: null,
        villainPositionLabel: null,
        villainRevealedCards: null,
        isMathMistake: false,
        isLoading: false,
      };
      return;
    }

    const primaryVillainId =
      decision.villainIds.find((id) => Boolean(snap.revealedVillainCardsById[id])) ??
      decision.villainIds[0] ??
      null;
    const primaryVillainPlayer = primaryVillainId
      ? snap.record.payload.pokerState.players.find((p) => p.playerId === primaryVillainId)
      : undefined;
    const primaryRevealedCards = primaryVillainId
      ? snap.revealedVillainCardsById[primaryVillainId] ?? null
      : null;

    if (mode === 'showed') {
      const hasKnownOpponent = decision.villainIds.some((id) =>
        Boolean(snap.revealedVillainCardsById[id]),
      );
      if (!hasKnownOpponent || decision.villainIds.length === 0) {
        decisionChannel.cancel();
        decisionEvaluationSignal.value = {
          decisionIndex: decision.decisionIndex,
          mode,
          tier: 'unavailable',
          detailKey: 'unavailable',
          trials: null,
          heroEquityPct: null,
          villainEquityPct: null,
          requiredEquityPct: decision.requiredEquityPct,
          deltaVsRequiredPct: null,
          villainRangeSpec: null,
          villainPositionLabel: primaryVillainPlayer?.position ?? null,
          villainRevealedCards: null,
          isMathMistake: false,
          isLoading: false,
        };
        return;
      }

      decisionEvaluationSignal.value = {
        decisionIndex: decision.decisionIndex,
        mode,
        tier: 'exact',
        detailKey: 'showdown_exact',
        trials: null,
        heroEquityPct: null,
        villainEquityPct: null,
        requiredEquityPct: decision.requiredEquityPct,
        deltaVsRequiredPct: null,
        villainRangeSpec: null,
        villainPositionLabel: primaryVillainPlayer?.position ?? null,
        villainRevealedCards: primaryRevealedCards,
        isMathMistake: false,
        isLoading: true,
      };

      const resp = await decisionChannel.run((callOptions) =>
        engine.async.calculateEquity(
          {
            schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
            board: [...decision.boardAtDecision],
            deadCards: [],
            method: 'auto',
            samples: 10_000,
            players: [
              { id: snap.record.payload.heroPlayerId, cards: [...snap.record.payload.heroCards] },
              ...decision.villainIds.map((vid) => ({
                id: vid,
                cards: snap.revealedVillainCardsById[vid]
                  ? [...snap.revealedVillainCardsById[vid]!]
                  : null,
              })),
            ],
          },
          callOptions,
        ),
      );

      if (!resp || runId !== decisionRunNonce) return;
      if (!resp.ok || !isEquityResult(resp.data)) {
        decisionEvaluationSignal.value = {
          ...decisionEvaluationSignal.value,
          tier: 'unavailable',
          detailKey: 'unavailable',
          isLoading: false,
        };
        return;
      }

      const isExact = Boolean(resp.data.exact);
      const heroRes = resp.data.players.find((p) => p.id === snap.record.payload.heroPlayerId);
      const villainRes = primaryVillainId
        ? resp.data.players.find((p) => p.id === primaryVillainId)
        : undefined;
      const heroPct = heroRes ? roundToTenth(heroRes.equity * 100) : null;
      const villainPct = villainRes ? roundToTenth(villainRes.equity * 100) : null;
      const reqPct = decision.requiredEquityPct;
      const deltaPct =
        heroPct !== null && reqPct !== null ? roundToTenth(heroPct - reqPct) : null;
      const isCallAction =
        decision.facingBet &&
        (decision.actionMeta.type === 'call' || decision.actionMeta.type === 'all_in');
      const isMistake = Boolean(
        isExact && isCallAction && heroPct !== null && reqPct !== null && heroPct + 0.05 < reqPct,
      );

      decisionEvaluationSignal.value = {
        decisionIndex: decision.decisionIndex,
        mode,
        tier: isExact ? 'exact' : 'estimated',
        detailKey: isExact ? 'showdown_exact' : 'showdown_sampled',
        trials: resp.data.trials,
        heroEquityPct: heroPct,
        villainEquityPct: villainPct,
        requiredEquityPct: reqPct,
        deltaVsRequiredPct: deltaPct,
        villainRangeSpec: null,
        villainPositionLabel: primaryVillainPlayer?.position ?? null,
        villainRevealedCards: primaryRevealedCards,
        isMathMistake: isMistake,
        isLoading: false,
      };
      return;
    }

    // Counterfactual opponent range assumption
    const rangeDeadCards = [...snap.record.payload.heroCards, ...decision.boardAtDecision];
    const parsedRange = parsePlayerHandInput(COUNTERFACTUAL_RANGE_TEMPLATES[mode], {
      deadCards: rangeDeadCards,
      engine,
    });
    const spec = buildCounterfactualRangeSpec(engine, mode, rangeDeadCards);
    if (!parsedRange.ok || parsedRange.kind !== 'range' || !spec || spec.eligibleCombos === 0 || !primaryVillainId) {
      decisionChannel.cancel();
      decisionEvaluationSignal.value = {
        decisionIndex: decision.decisionIndex,
        mode,
        tier: 'unavailable',
        detailKey: 'unavailable',
        trials: null,
        heroEquityPct: null,
        villainEquityPct: null,
        requiredEquityPct: decision.requiredEquityPct,
        deltaVsRequiredPct: null,
        villainRangeSpec: spec,
        villainPositionLabel: primaryVillainPlayer?.position ?? null,
        villainRevealedCards: null,
        isMathMistake: false,
        isLoading: false,
      };
      return;
    }

    decisionEvaluationSignal.value = {
      decisionIndex: decision.decisionIndex,
      mode,
      tier: 'estimated',
      detailKey: 'opponent_assumption',
      trials: null,
      heroEquityPct: null,
      villainEquityPct: null,
      requiredEquityPct: decision.requiredEquityPct,
      deltaVsRequiredPct: null,
      villainRangeSpec: spec,
      villainPositionLabel: primaryVillainPlayer?.position ?? null,
      villainRevealedCards: null,
      isMathMistake: false,
      isLoading: true,
    };

    const resp = await decisionChannel.run((callOptions) =>
      engine.async.calculateEquity(
        {
          schemaVersion: WEIGHTED_EQUITY_REQUEST_VERSION,
          board: [...decision.boardAtDecision],
          deadCards: [],
          method: 'auto',
          samples: 6_000,
          players: [
            {
              id: snap.record.payload.heroPlayerId,
              kind: 'exact',
              cards: [...snap.record.payload.heroCards],
            },
            {
              id: primaryVillainId,
              kind: 'range',
              range: parsedRange.weightedRange,
              sourceRole: 'explicit_opponent_model',
              sourceId: `counterfactual:${mode}`,
              weightSemantics: 'relative_combo_likelihood',
            },
            ...decision.villainIds
              .filter((vid) => vid !== primaryVillainId)
              .map((vid) => ({ id: vid, kind: 'uniform_unknown' as const })),
          ],
        },
        callOptions,
      ),
    );

    if (!resp || runId !== decisionRunNonce) return;
    if (!resp.ok || !isWeightedResult(resp.data)) {
      decisionEvaluationSignal.value = {
        ...decisionEvaluationSignal.value,
        tier: 'unavailable',
        detailKey: 'unavailable',
        isLoading: false,
      };
      return;
    }

    const heroRes = resp.data.players.find((p) => p.id === snap.record.payload.heroPlayerId);
    const villainRes = resp.data.players.find((p) => p.id === primaryVillainId);
    const heroPct = heroRes ? roundToTenth(heroRes.equity * 100) : null;
    const villainPct = villainRes ? roundToTenth(villainRes.equity * 100) : null;
    const reqPct = decision.requiredEquityPct;
    const deltaPct = heroPct !== null && reqPct !== null ? roundToTenth(heroPct - reqPct) : null;

    decisionEvaluationSignal.value = {
      decisionIndex: decision.decisionIndex,
      mode,
      tier: 'estimated',
      detailKey: 'opponent_assumption',
      trials: resp.data.trials,
      heroEquityPct: heroPct,
      villainEquityPct: villainPct,
      requiredEquityPct: reqPct,
      deltaVsRequiredPct: deltaPct,
      villainRangeSpec: spec,
      villainPositionLabel: primaryVillainPlayer?.position ?? null,
      villainRevealedCards: null,
      // Mistake label is earned only on exact known-cards math, never on opponent assumptions.
      isMathMistake: false,
      rangeSampled: resp.data.method !== 'exact',
      isLoading: false,
    };
  }

  async function runDecisionsVsLuckEvaluation(snap: ReviewSessionSnapshot): Promise<void> {
    luckRunNonce += 1;
    const runId = luckRunNonce;

    const finalState = unwrap(
      engine.sync.projectReplayState(snap.replaySource, snap.frames.length - 1),
      'luck finalState',
    );
    const heroId = snap.record.payload.heroPlayerId;
    const unitLabel = snap.record.payload.unitLabel;
    const finalPotBb = roundToTenth(deriveEffectivePotMilliBb(finalState) / 1000);
    const heroFinalPlayer = finalState.players.find((p) => p.playerId === heroId);
    const heroInvestedTotalBb = heroFinalPlayer
      ? heroFinalPlayer.totalPotContributionMilliBb / 1000
      : 0;
    const payoutMilliBb = finalState.terminal.payoutsMilliBbByPlayer[heroId] ?? 0;
    const wonPotBb = payoutMilliBb / 1000;
    const actualNetBb = finalState.terminal.isTerminal
      ? roundToTenth(wonPotBb - heroInvestedTotalBb)
      : null;

    if (!finalState.terminal.isTerminal) {
      luckChannel.cancel();
      decisionsVsLuckSignal.value = {
        tier: 'unavailable',
        isAvailable: false,
        unavailableReason: 'spot_incomplete',
        trials: null,
        showdownHeroEquityPct: null,
        decisiveCallNeededPct: null,
        decisiveCallAmountBb: null,
        callVsFoldEvBb: null,
        handEvBb: null,
        runoutLuckBb: null,
        actualNetBb: null,
        finalPotBb,
        wonShowdown: false,
        unitLabel,
        isLoading: false,
      };
      return;
    }

    const liveAtTerminal = finalState.players.filter((p) => !p.folded && p.dealtIn);
    const revealedVillains = liveAtTerminal.filter(
      (p) => p.playerId !== heroId && Boolean(snap.revealedVillainCardsById[p.playerId]),
    );
    const allLiveOpponentsRevealed =
      liveAtTerminal.length >= 2 &&
      revealedVillains.length === liveAtTerminal.filter((p) => p.playerId !== heroId).length &&
      !heroFinalPlayer?.folded;

    if (!allLiveOpponentsRevealed) {
      luckChannel.cancel();
      decisionsVsLuckSignal.value = {
        tier: 'unavailable',
        isAvailable: false,
        unavailableReason: 'no_showdown_cards',
        trials: null,
        showdownHeroEquityPct: null,
        decisiveCallNeededPct: null,
        decisiveCallAmountBb: null,
        callVsFoldEvBb: null,
        handEvBb: null,
        runoutLuckBb: null,
        actualNetBb,
        finalPotBb,
        wonShowdown: wonPotBb > 0,
        unitLabel,
        isLoading: false,
      };
      return;
    }

    const actionFrames = snap.frames.filter((f) => f.operation === REPLAY_FRAME_OPERATIONS.ACTION);
    const lastActionFrame = actionFrames[actionFrames.length - 1];
    const allInDecisionState = lastActionFrame
      ? unwrap(
          engine.sync.projectReplayState(snap.replaySource, lastActionFrame.index),
          'luck allInDecisionState',
        )
      : finalState;
    const equityBoard = [...allInDecisionState.board];

    // Decisive call: Hero's last call (or call-all-in) facing a bet on or just before betting closed
    const callDecisions = snap.decisions.filter(
      (d) =>
        d.facingBet &&
        (d.actionMeta.type === 'call' || d.actionMeta.type === 'all_in') &&
        d.street === allInDecisionState.street,
    );
    const decisiveCall = callDecisions[callDecisions.length - 1] ?? null;

    decisionsVsLuckSignal.value = {
      tier: 'exact',
      isAvailable: true,
      unavailableReason: null,
      trials: null,
      showdownHeroEquityPct: null,
      decisiveCallNeededPct: decisiveCall?.requiredEquityPct ?? null,
      decisiveCallAmountBb: decisiveCall
        ? roundToTenth(decisiveCall.callEconomics.callCommitmentMilliBb / 1000)
        : null,
      callVsFoldEvBb: null,
      handEvBb: null,
      runoutLuckBb: null,
      actualNetBb,
      finalPotBb,
      wonShowdown: wonPotBb > 0,
      unitLabel,
      isLoading: true,
    };

    const eqResp = await luckChannel.run((callOptions) =>
      engine.async.calculateEquity(
        {
          schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
          board: equityBoard,
          deadCards: [],
          method: 'auto',
          samples: 10_000,
          players: [
            { id: heroId, cards: [...snap.record.payload.heroCards] },
            ...revealedVillains.map((v) => ({
              id: v.playerId,
              cards: [...snap.revealedVillainCardsById[v.playerId]!],
            })),
          ],
        },
        callOptions,
      ),
    );

    if (!eqResp || runId !== luckRunNonce) return;
    if (!eqResp.ok || !isEquityResult(eqResp.data)) {
      decisionsVsLuckSignal.value = {
        ...decisionsVsLuckSignal.value,
        tier: 'unavailable',
        isAvailable: false,
        trials: null,
        isLoading: false,
      };
      return;
    }

    const isExact = Boolean(eqResp.data.exact);
    const heroEqRes = eqResp.data.players.find((p) => p.id === heroId);
    if (!heroEqRes) return;

    const eqFrac = heroEqRes.equity;
    const displayedEqPct = roundToTenth(eqFrac * 100);

    if (decisiveCall) {
      const facts = unwrap(
        engine.sync.allInLuckAndEv({
          finalPotBb,
          heroInvestedBeforeCallBb: decisiveCall.heroInvestedBeforeDecisionMilliBb / 1000,
          callAmountBb: decisiveCall.callEconomics.callCommitmentMilliBb / 1000,
          equityFraction: eqFrac,
          displayedEquityPercent: displayedEqPct,
          wonPotBb,
        }),
        'allInLuckAndEv',
      );
      decisionsVsLuckSignal.value = {
        tier: isExact ? 'exact' : 'estimated',
        isAvailable: true,
        unavailableReason: null,
        trials: eqResp.data.trials,
        showdownHeroEquityPct: displayedEqPct,
        decisiveCallNeededPct: decisiveCall.requiredEquityPct,
        decisiveCallAmountBb: roundToTenth(decisiveCall.callEconomics.callCommitmentMilliBb / 1000),
        callVsFoldEvBb: roundToTenth(facts.callVsFoldEvDisplayedBb ?? facts.callVsFoldEvExactBb),
        handEvBb: roundToTenth(facts.handEvDisplayedBb ?? facts.handEvExactBb),
        runoutLuckBb: roundToTenth(facts.runoutLuckDisplayedBb ?? facts.runoutLuckExactBb),
        actualNetBb: roundToTenth(facts.actualNetBb),
        finalPotBb,
        wonShowdown: wonPotBb > 0,
        unitLabel,
        isLoading: false,
      };
      return;
    }

    const luckOnly = unwrap(
      engine.sync.allInLuck({
        finalPotBb,
        investedBb: heroInvestedTotalBb,
        equityFraction: eqFrac,
        wonPotBb,
      }),
      'allInLuck',
    );
    decisionsVsLuckSignal.value = {
      tier: isExact ? 'exact' : 'estimated',
      isAvailable: true,
      unavailableReason: null,
      trials: eqResp.data.trials,
      showdownHeroEquityPct: displayedEqPct,
      decisiveCallNeededPct: null,
      decisiveCallAmountBb: null,
      callVsFoldEvBb: null,
      handEvBb: roundToTenth(luckOnly.expectedNetBb),
      runoutLuckBb: roundToTenth(luckOnly.runoutLuckBb),
      actualNetBb: roundToTenth(luckOnly.actualNetBb),
      finalPotBb,
      wonShowdown: wonPotBb > 0,
      unitLabel,
      isLoading: false,
    };
  }

  const disposeDecisionEffect = effect(() => {
    const snap = replaySnapshotSignal.value;
    const decision = currentDecisionSignal.value;
    const mode = counterfactualRangeSignal.value;
    void runDecisionEvaluation(snap, decision, mode);
  });

  const disposeLuckEffect = effect(() => {
    const snap = replaySnapshotSignal.value;
    void runDecisionsVsLuckEvaluation(snap);
  });

  function openSavedHand(record: SavedHandRecord): void {
    activeRecordSignal.value = record;
    const snap = buildReviewReplaySession(
      engine,
      record,
      record.objectId === STARTER_FRIDAY_OBJECT_ID || record.objectId === STARTER_SPOT_OBJECT_ID,
    );
    const defaultDecision = snap.decisions.length > 0 ? snap.decisions.length - 1 : 0;
    selectedDecisionIndexSignal.value = defaultDecision;
    const targetFrame =
      snap.decisions[defaultDecision]?.actionFrameIndex ?? snap.frames.length - 1;
    frameIndexSignal.value = targetFrame;
    counterfactualRangeSignal.value =
      snap.revealedVillainIds.length > 0 ? 'showed' : 'standard';
    activeSideTabSignal.value = 'review';
  }

  function openStarterFridayHand(): void {
    openSavedHand(starterFriday);
  }

  function jumpToFrame(frameIndex: number): void {
    const snap = replaySnapshotSignal.value;
    const clamped = Math.max(0, Math.min(snap.frames.length - 1, frameIndex));
    frameIndexSignal.value = clamped;
    const exactDec = snap.decisions.find(
      (d) => d.actionFrameIndex === clamped || d.preActionFrameIndex === clamped,
    );
    if (exactDec) {
      selectedDecisionIndexSignal.value = exactDec.decisionIndex;
    }
  }

  function stepFrame(delta: -1 | 1): void {
    jumpToFrame(frameIndexSignal.value + delta);
  }

  function selectDecision(decisionIndex: number): void {
    const snap = replaySnapshotSignal.value;
    if (snap.decisions.length === 0) return;
    const clamped = Math.max(0, Math.min(snap.decisions.length - 1, decisionIndex));
    selectedDecisionIndexSignal.value = clamped;
    const target = snap.decisions[clamped];
    if (target) {
      frameIndexSignal.value = target.actionFrameIndex;
    }
  }

  function selectStreet(street: EquityStreet): void {
    const snap = replaySnapshotSignal.value;
    const summary = snap.streetSummaries.find((s) => s.street === street);
    if (summary && summary.available && summary.firstFrameIndex >= 0) {
      frameIndexSignal.value = summary.firstFrameIndex;
      const decOnStreet = snap.decisions.find((d) => d.street === street);
      if (decOnStreet) {
        selectedDecisionIndexSignal.value = decOnStreet.decisionIndex;
      }
    }
  }

  function setActiveSideTab(tab: ReviewSideTab): void {
    activeSideTabSignal.value = tab;
    if (tab === 'saved') {
      void refreshSavedLibrary();
    }
  }

  function setCounterfactualRange(mode: CounterfactualRangeId): void {
    const snap = replaySnapshotSignal.value;
    if (mode === 'showed' && snap.revealedVillainIds.length === 0) return;
    counterfactualRangeSignal.value = mode;
  }

  function toggleFeltExpanded(): void {
    feltExpandedSignal.value = !feltExpandedSignal.value;
  }

  async function persistRecordPatch(
    objectId: string,
    patch: { readonly tags?: readonly SavedObjectTagId[]; readonly heroNotes?: readonly HeroDecisionNote[] },
  ): Promise<void> {
    const isStarter =
      objectId === STARTER_FRIDAY_OBJECT_ID || objectId === STARTER_SPOT_OBJECT_ID;

    if (isStarter) {
      const updated = starterRecordsSignal.value.map((rec) => {
        if (rec.objectId !== objectId) return rec;
        const nextTags = patch.tags ? [...patch.tags] : rec.tags;
        const nextNotes = patch.heroNotes
          ? patch.heroNotes.map((n) => ({ ...n }))
          : rec.payload.heroNotes;
        const nextRec: SavedHandRecord = {
          ...rec,
          updatedAt: new Date().toISOString(),
          tags: nextTags,
          payload: {
            ...rec.payload,
            tags: nextTags,
            heroNotes: nextNotes,
          },
        };
        if (activeRecordSignal.value.objectId === objectId) {
          activeRecordSignal.value = nextRec;
        }
        return nextRec;
      });
      starterRecordsSignal.value = updated;
      syncSavedListSignals();
      return;
    }

    const updated = await repository.annotateSavedHand(objectId, patch);
    await refreshSavedLibrary();
    if (updated && activeRecordSignal.value.objectId === objectId) {
      activeRecordSignal.value = updated;
    }
  }

  async function toggleThinkingReason(reason: ThinkingReasonId): Promise<void> {
    const decision = currentDecisionSignal.value;
    if (!decision) return;
    const rec = activeRecordSignal.value;
    const seq = decision.actionMeta.seq;
    const list = rec.payload.heroNotes.map((n) => ({ ...n }));
    const idx = list.findIndex((n) => n.actionSeq === seq);
    const existing = idx >= 0 ? list[idx]! : undefined;
    const nextReason = existing?.reasonChip === reason ? undefined : reason;

    if (!nextReason && !existing?.customText?.trim()) {
      if (idx >= 0) list.splice(idx, 1);
    } else {
      const nextNote: HeroDecisionNote = {
        actionSeq: seq,
        street: decision.street,
        ...(nextReason ? { reasonChip: nextReason } : {}),
        ...(existing?.customText ? { customText: existing.customText } : {}),
      };
      if (idx >= 0) list[idx] = nextNote;
      else list.push(nextNote);
    }

    await persistRecordPatch(rec.objectId, { heroNotes: list });
  }

  async function setThinkingCustomText(text: string): Promise<void> {
    const decision = currentDecisionSignal.value;
    if (!decision) return;
    const rec = activeRecordSignal.value;
    const seq = decision.actionMeta.seq;
    const list = rec.payload.heroNotes.map((n) => ({ ...n }));
    const idx = list.findIndex((n) => n.actionSeq === seq);
    const existing = idx >= 0 ? list[idx]! : undefined;

    if (!existing?.reasonChip && !text.trim()) {
      if (idx >= 0) list.splice(idx, 1);
    } else {
      const nextNote: HeroDecisionNote = {
        actionSeq: seq,
        street: decision.street,
        ...(existing?.reasonChip ? { reasonChip: existing.reasonChip } : {}),
        ...(text ? { customText: text } : {}),
      };
      if (idx >= 0) list[idx] = nextNote;
      else list.push(nextNote);
    }

    await persistRecordPatch(rec.objectId, { heroNotes: list });
  }

  async function toggleSavedTag(objectId: string, tag: SavedObjectTagId): Promise<void> {
    const target =
      savedHandsSignal.value.find((r) => r.objectId === objectId) ??
      (activeRecordSignal.value.objectId === objectId ? activeRecordSignal.value : undefined);
    if (!target) return;
    const hasTag = target.tags.includes(tag);
    const nextTags = hasTag
      ? target.tags.filter((tItem) => tItem !== tag)
      : [...target.tags, tag];
    await persistRecordPatch(objectId, { tags: nextTags });
  }

  async function toggleActiveHandTag(tag: SavedObjectTagId): Promise<void> {
    await toggleSavedTag(activeRecordSignal.value.objectId, tag);
  }

  async function refreshSavedLibrary(): Promise<SavedHandRecord[]> {
    const list = await repository.listSavedHands({ includeArchived: true });
    repoRecordsSignal.value = list;
    syncSavedListSignals();
    const activeId = activeRecordSignal.value.objectId;
    const refreshedActive = list.find((r) => r.objectId === activeId);
    if (refreshedActive) {
      activeRecordSignal.value = refreshedActive;
    }
    return savedHandsSignal.value as SavedHandRecord[];
  }

  async function archiveSavedItem(objectId: string): Promise<void> {
    const isStarter =
      objectId === STARTER_FRIDAY_OBJECT_ID || objectId === STARTER_SPOT_OBJECT_ID;
    if (isStarter) {
      starterRecordsSignal.value = starterRecordsSignal.value.map((r) =>
        r.objectId === objectId ? { ...r, archived: true } : r,
      );
      syncSavedListSignals();
      return;
    }
    await repository.archiveSavedHand(objectId);
    await refreshSavedLibrary();
  }

  async function restoreSavedItem(objectId: string): Promise<void> {
    const isStarter =
      objectId === STARTER_FRIDAY_OBJECT_ID || objectId === STARTER_SPOT_OBJECT_ID;
    if (isStarter) {
      starterRecordsSignal.value = starterRecordsSignal.value.map((r) =>
        r.objectId === objectId ? { ...r, archived: false } : r,
      );
      syncSavedListSignals();
      return;
    }
    await repository.restoreSavedHand(objectId);
    await refreshSavedLibrary();
  }

  async function exportBackupJson(): Promise<string> {
    const bundle = await repository.exportBundle();
    return JSON.stringify(bundle, null, 2);
  }

  async function importBackupJson(rawText: string): Promise<StudyImportResult> {
    const res = await repository.importBundle(rawText, { applyAppearance: false });
    if (res.ok) {
      await refreshSavedLibrary();
      backupStatusSignal.value = { kind: 'imported', importedCount: res.importedCount };
    } else {
      backupStatusSignal.value = {
        kind: 'error',
        detail: res.detail ?? res.errorCode,
      };
    }
    return res;
  }

  function applyPreset(preset: ReviewPresetId): void {
    savedFilterSignal.value = 'all';
    savedSortSignal.value = 'new';
    savedSeatFilterSignal.value = 'all';
    savedSearchSignal.value = '';
    backupStatusSignal.value = { kind: 'idle' };
    feltExpandedSignal.value = false;

    if (preset === 'saved') {
      openSavedHand(starterFriday);
      activeSideTabSignal.value = 'saved';
      return;
    }

    openSavedHand(starterFriday);
    activeSideTabSignal.value = 'review';
    if (preset === 'counterfactual') {
      counterfactualRangeSignal.value = 'loose';
    } else {
      counterfactualRangeSignal.value = 'showed';
    }
  }

  // Initialize default selection onto §8 Friday Decision 3 (Flop all-in call)
  openSavedHand(starterFriday);

  if (options.autoLoadSaved !== false && typeof indexedDB !== 'undefined') {
    void refreshSavedLibrary().catch(() => {
      // IndexedDB may be unavailable in restricted headless environments.
    });
  }

  return {
    engine,
    repository,
    activeSideTabSignal,
    activeRecordSignal,
    frameIndexSignal,
    selectedDecisionIndexSignal,
    counterfactualRangeSignal,
    feltExpandedSignal,
    savedHandsSignal,
    savedFilterSignal,
    savedSortSignal,
    savedSeatFilterSignal,
    savedSearchSignal,
    backupStatusSignal,
    replaySnapshotSignal,
    currentFrameMetaSignal,
    currentPokerStateSignal,
    currentDecisionSignal,
    activeHeroNoteSignal,
    decisionEvaluationSignal,
    decisionsVsLuckSignal,
    savedLibraryItemsSignal,
    filteredSavedItemsSignal,
    availableSeatFiltersSignal,
    setActiveSideTab,
    openSavedHand,
    openStarterFridayHand,
    jumpToFrame,
    stepFrame,
    selectDecision,
    selectStreet,
    setCounterfactualRange,
    toggleFeltExpanded,
    toggleThinkingReason,
    setThinkingCustomText,
    toggleActiveHandTag,
    refreshSavedLibrary,
    setSavedFilter(filter) {
      savedFilterSignal.value = filter;
    },
    setSavedSort(sort) {
      savedSortSignal.value = sort;
    },
    setSavedSeatFilter(seatLabel) {
      savedSeatFilterSignal.value = seatLabel;
    },
    setSavedSearch(query) {
      savedSearchSignal.value = query;
    },
    toggleSavedTag,
    archiveSavedItem,
    restoreSavedItem,
    exportBackupJson,
    importBackupJson,
    applyPreset,
    dispose() {
      disposeDecisionEffect();
      disposeLuckEffect();
      decisionChannel.cancel();
      luckChannel.cancel();
    },
  };
}

let sharedReviewStore: ReviewStore | null = null;

export function getSharedReviewStore(): ReviewStore {
  if (!sharedReviewStore) {
    sharedReviewStore = createReviewStore();
  }
  return sharedReviewStore;
}

export function resetSharedReviewStore(): void {
  if (sharedReviewStore) {
    sharedReviewStore.dispose();
    sharedReviewStore = null;
  }
}
