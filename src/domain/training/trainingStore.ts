import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import {
  EQUITY_REQUEST_SCHEMA_VERSION,
  getSharedEngineClient,
  HOLDEM_DECK,
  POKER_ACTION_SCHEMA_VERSION,
  type ActionType,
  type DuelBotStyleId,
  type EngineClient,
  type EquityResult,
  type GameRulesSnapshot,
  type LegalActionSpec,
  type PokerAction,
  type PokerState,
  type StrategyEvidenceEntry,
  type StrategyFamilyId,
  type StrategyLeakMapProjection,
  type TrainingDrillExercise,
  type TrainingDrillTarget,
  type TrainingGradeOutput,
} from '../../engine-api';
import { readTableBeatMs } from '../../ui/kit/state';
import { computeTrainingWeekStats } from '../home/weeklySummary';
import {
  getDefaultStudyRepository,
  type SavedHandPayload,
  type StudyRepository,
  type TrainingSessionPayload,
} from '../storage';
import type {
  DrillEquityCheck,
  DrillSessionStats,
  DuelBotObservationStats,
  DuelCompletedHandSummary,
  DuelHistoryItem,
  DuelLiveState,
  LeakLabTargetItem,
  TrainingActionTicketId,
  TrainingDrillFilters,
  TrainingPresetId,
  TrainingViewId,
  TrainingWeekStats,
} from './types';

export const DUEL_TOTAL_HANDS = 10;
export const DUEL_STARTING_STACK_BB = 100;

export interface TrainingStoreOptions {
  readonly engine?: EngineClient;
  readonly repository?: StudyRepository;
  readonly instantTimers?: boolean;
}

export interface TrainingStore {
  readonly activeViewSignal: Signal<TrainingViewId>;
  readonly evidenceSignal: Signal<readonly StrategyEvidenceEntry[]>;
  readonly trainingSessionsSignal: Signal<readonly TrainingSessionPayload[]>;
  readonly drillFiltersSignal: Signal<TrainingDrillFilters>;
  readonly drillExerciseSignal: Signal<TrainingDrillExercise | null>;
  readonly drillLoadingSignal: Signal<boolean>;
  readonly drillSelectedTicketSignal: Signal<TrainingActionTicketId | null>;
  readonly drillSelectedSizeIdSignal: Signal<string | null>;
  readonly drillCustomSizesBbSignal: Signal<Readonly<Record<string, number>>>;
  readonly drillGradeSignal: Signal<TrainingGradeOutput | null>;
  readonly drillEquityCheckSignal: Signal<DrillEquityCheck | null>;
  readonly drillSessionStatsSignal: Signal<DrillSessionStats>;
  readonly missedDrillQueueSignal: Signal<readonly TrainingDrillExercise[]>;
  readonly duelStateSignal: Signal<DuelLiveState | null>;
  readonly duelSelectedTicketSignal: Signal<TrainingActionTicketId | null>;
  readonly duelSelectedSizeIdSignal: Signal<string | null>;

  readonly thisWeekStatsSignal: ReadonlySignal<TrainingWeekStats>;
  readonly leakMapSignal: ReadonlySignal<StrategyLeakMapProjection>;
  readonly leakLabTargetsSignal: ReadonlySignal<readonly LeakLabTargetItem[]>;

  hydrate: () => Promise<void>;
  dispose: () => void;
  setActiveView: (view: TrainingViewId) => void;
  openQuickDrill: (options?: {
    readonly focusPosition?: string | null;
    readonly focusFamilyId?: StrategyFamilyId | null;
    readonly target?: TrainingDrillTarget | 'auto';
  }) => Promise<void>;
  openLeakLab: (targetItem?: LeakLabTargetItem) => Promise<void>;
  setDrillFilters: (patch: Partial<TrainingDrillFilters>) => Promise<void>;
  nextDrillSpot: () => Promise<void>;
  selectDrillTicket: (ticketId: TrainingActionTicketId) => void;
  selectDrillSize: (sizeId: string) => void;
  adjustDrillSize: (sizeId: string, nextBb: number) => void;
  resetDrillSizes: () => void;
  confirmDrillAnswer: () => Promise<void>;
  retryMissedSpot: () => void;
  finishDrillSession: () => Promise<void>;

  startHeadsUpDuel: (seed?: number, style?: DuelBotStyleId) => Promise<void>;
  selectDuelTicket: (ticketId: TrainingActionTicketId) => void;
  selectDuelSize: (sizeId: string) => void;
  adjustDuelSize: (sizeId: string, nextBb: number) => void;
  resetDuelSizes: () => void;
  confirmDuelAction: () => Promise<void>;
  dealNextDuelHand: () => Promise<void>;
  toggleReadTable: () => void;
  computeDuelHandEquity: () => Promise<void>;
  saveDuelHandsToReview: () => Promise<number>;
  applyPreset: (preset: TrainingPresetId) => Promise<void>;
}

import {
  buildDuelSizePresets,
  computeCallCommitBb,
  formatShorthandForDuel,
  must,
  nextId,
  roundTenth,
  seededShuffleDeck,
  toRecordedActions,
} from './trainingHelpers';
export function createTrainingStore(options: TrainingStoreOptions = {}): TrainingStore {
  const engine = options.engine ?? getSharedEngineClient();
  const repository = options.repository ?? getDefaultStudyRepository();
  const instantTimers = options.instantTimers === true;

  const activeViewSignal = signal<TrainingViewId>('hub');
  const evidenceSignal = signal<readonly StrategyEvidenceEntry[]>([]);
  const trainingSessionsSignal = signal<readonly TrainingSessionPayload[]>([]);

  const drillFiltersSignal = signal<TrainingDrillFilters>({
    tableSize: 6,
    stackDepthBb: 100,
    target: 'auto',
    focusPosition: null,
    focusFamilyId: null,
  });
  const drillExerciseSignal = signal<TrainingDrillExercise | null>(null);
  const drillLoadingSignal = signal<boolean>(false);
  const drillSelectedTicketSignal = signal<TrainingActionTicketId | null>(null);
  const drillSelectedSizeIdSignal = signal<string | null>(null);
  const drillCustomSizesBbSignal = signal<Readonly<Record<string, number>>>({});
  const drillGradeSignal = signal<TrainingGradeOutput | null>(null);
  const drillEquityCheckSignal = signal<DrillEquityCheck | null>(null);
  const drillSessionStatsSignal = signal<DrillSessionStats>({
    answeredCount: 0,
    baselineAlignedCount: 0,
    planAlignedCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    missedCount: 0,
    retryingMissed: false,
  });
  const missedDrillQueueSignal = signal<readonly TrainingDrillExercise[]>([]);

  const duelStateSignal = signal<DuelLiveState | null>(null);
  const duelSelectedTicketSignal = signal<TrainingActionTicketId | null>(null);
  const duelSelectedSizeIdSignal = signal<string | null>(null);

  let drillSeq = 0;
  let drillRequestCounter = 0;
  let drillEquitySeq = 0;
  let duelRunToken = 0;
  const activeTimers = new Set<ReturnType<typeof setTimeout>>();
  const duelDecksByHandId = new Map<string, { readonly deck: string[]; readonly boardIdx: number; readonly astraCards: readonly [string, string] }>();
  let duelRulesCache: GameRulesSnapshot | null = null;

  function clearPendingTimers(): void {
    for (const timer of activeTimers) {
      clearTimeout(timer);
    }
    activeTimers.clear();
  }

  function pauseBeat(token: '--beat-action' | '--beat-think', runToken: number): Promise<boolean> {
    if (instantTimers) return Promise.resolve(runToken === duelRunToken);
    const ms = readTableBeatMs(token);
    if (ms <= 0) return Promise.resolve(runToken === duelRunToken);
    return new Promise<boolean>((resolve) => {
      const id = setTimeout(() => {
        activeTimers.delete(id);
        resolve(runToken === duelRunToken);
      }, ms);
      activeTimers.add(id);
    });
  }

  function getDuelRules(): GameRulesSnapshot {
    if (duelRulesCache) return duelRulesCache;
    const res = engine.sync.createGameRulesSnapshot({
      source: { kind: 'direct' },
      setup: { seatedPlayers: 2 },
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
    duelRulesCache = res.data;
    return res.data;
  }

  const thisWeekStatsSignal = computed<TrainingWeekStats>(() =>
    computeTrainingWeekStats(
      trainingSessionsSignal.value,
      drillSessionStatsSignal.value.answeredCount,
    ),
  );

  const leakMapSignal = computed<StrategyLeakMapProjection>(() => {
    // Only non-drill evidence (user plan / dealt hands) feeds Leak Lab targets (DECISIONS.md C2)
    const nonDrillEvidence = evidenceSignal.value.filter((ev) => ev.source !== 'drill');
    const res = engine.sync.projectStrategyLeakMap(6, 100, nonDrillEvidence);
    if (!res.ok) throw new Error(res.error.message);
    return res.data;
  });

  const leakLabTargetsSignal = computed<readonly LeakLabTargetItem[]>(() => {
    const proj = leakMapSignal.value;
    const drillCountsByCtx = new Map<string, number>();
    for (const ev of evidenceSignal.value) {
      if (ev.source === 'drill' && !ev.retracted) {
        drillCountsByCtx.set(ev.contextKey, (drillCountsByCtx.get(ev.contextKey) ?? 0) + 1);
      }
    }
    const items: LeakLabTargetItem[] = proj.rows.flatMap((row) =>
      row.cells
        .filter(
          (cell) =>
            cell.available &&
            cell.deltaPoints !== null &&
            cell.deltaPoints !== 0,
        )
        .map((cell) => ({
          key: `${cell.position}:${cell.familyId}`,
          position: cell.position,
          familyId: cell.familyId,
          deltaPoints: cell.deltaPoints,
          userCombos: cell.userCombos,
          baselineCombos: cell.baselineCombos,
          drillCount: drillCountsByCtx.get(cell.contextKey) ?? 0,
        })),
    );
    items.sort((a, b) => {
      const gapB = Math.abs(b.deltaPoints ?? 0);
      const gapA = Math.abs(a.deltaPoints ?? 0);
      if (gapB !== gapA) return gapB - gapA;
      return a.drillCount - b.drillCount;
    });
    return items.slice(0, 6);
  });

  async function loadNextDrill(seedOverride?: number): Promise<void> {
    drillSeq += 1;
    drillRequestCounter += 1;
    const requestId = `drill-${drillRequestCounter}`;
    drillLoadingSignal.value = true;
    const filters = drillFiltersSignal.value;

    const res = await engine.async.generateTrainingDrill(
      {
        seed: seedOverride ?? 100 + drillSeq * 17,
        tableSize: filters.tableSize,
        stackDepthBb: filters.stackDepthBb,
        target: filters.target,
        ...(filters.focusPosition ? { focusPosition: filters.focusPosition } : {}),
        ...(filters.focusFamilyId ? { focusFamilyId: filters.focusFamilyId } : {}),
        evidence: evidenceSignal.value,
      },
      { requestId },
    );

    if (requestId !== `drill-${drillRequestCounter}`) return;
    drillLoadingSignal.value = false;
    if (!res.ok) return;

    drillExerciseSignal.value = res.data;
    drillSelectedTicketSignal.value = null;
    drillSelectedSizeIdSignal.value = res.data.raisePresetsBb.length > 0 ? 's0' : null;
    drillCustomSizesBbSignal.value = {};
    drillGradeSignal.value = null;
    drillEquitySeq += 1;
    drillEquityCheckSignal.value = null;
    drillSessionStatsSignal.value = {
      ...drillSessionStatsSignal.value,
      retryingMissed: false,
    };
  }

  async function flushDrillSession(): Promise<void> {
    const s = drillSessionStatsSignal.value;
    if (s.answeredCount === 0) return;
    const payload: TrainingSessionPayload = {
      sessionId: nextId('drill-sess'),
      mode: 'quick_drill',
      completedAt: new Date().toISOString(),
      spotsCount: s.answeredCount,
      planAlignedCount: s.planAlignedCount,
      baselineAlignedCount: s.baselineAlignedCount,
      focusLabel: drillFiltersSignal.value.focusPosition ?? undefined,
    };
    drillSessionStatsSignal.value = {
      answeredCount: 0,
      baselineAlignedCount: 0,
      planAlignedCount: 0,
      currentStreak: 0,
      bestStreak: 0,
      missedCount: 0,
      retryingMissed: false,
    };
    await repository.recordTrainingSession(payload);
    trainingSessionsSignal.value = [payload, ...trainingSessionsSignal.value];
  }

  function defaultSelectedDuelTicket(legal: LegalActionSpec | null): TrainingActionTicketId | null {
    if (!legal) return null;
    return null; // User always explicitly selects then confirms
  }

  function dealDuelHand(
    handNumber: number,
    sessionSeed: number,
    botStyle: DuelBotStyleId,
    priorState: DuelLiveState | null,
  ): DuelLiveState {
    const heroIsButton = handNumber % 2 === 1;
    const buttonSeat = heroIsButton ? 0 : 1;
    const handId = `duel-${sessionSeed}-h${handNumber}`;
    const deck = seededShuffleDeck(sessionSeed + handNumber * 7919);
    const heroCards: readonly [string, string] = [deck[0]!, deck[1]!];
    const astraCards: readonly [string, string] = [deck[2]!, deck[3]!];
    duelDecksByHandId.set(handId, { deck, boardIdx: 4, astraCards });

    const rules = getDuelRules();
    const initRes = engine.sync.initializeRecordedHand({
      handId,
      rulesSnapshot: rules,
      buttonSeat,
      players: [
        { playerId: 'hero', seat: 0, startingStackMilliBb: DUEL_STARTING_STACK_BB * 1000 },
        { playerId: 'astra', seat: 1, startingStackMilliBb: DUEL_STARTING_STACK_BB * 1000 },
      ],
    });
    if (!initRes.ok) throw new Error(initRes.error.message);

    const dealRes = engine.sync.applyChance(initRes.data, {
      type: 'deal_hole',
      cardsByPlayer: { hero: [...heroCards] },
      hiddenPlayerIds: ['astra'],
    });
    if (!dealRes.ok) throw new Error(dealRes.error.message);

    const state = dealRes.data;
    const isHeroTurn = state.actingPlayerId === 'hero';
    const legalSpec = isHeroTurn
      ? (() => {
          const l = engine.sync.legalActions(state);
          return l.ok ? l.data : null;
        })()
      : null;
    const callEconomics = isHeroTurn ? (() => {
      const c = engine.sync.actorCallEconomics(state, 'hero');
      return c.ok ? c.data : null;
    })() : null;

    const presets = isHeroTurn ? buildDuelSizePresets(engine, state, legalSpec) : [];

    return {
      sessionSeed,
      botStyle,
      handNumber,
      totalHands: DUEL_TOTAL_HANDS,
      heroIsButton,
      pokerState: state,
      heroCards,
      revealedAstraCards: null,
      astraThinking: false,
      heroBubble: null,
      astraBubble: null,
      heroCumulativeNetBb: priorState?.heroCumulativeNetBb ?? 0,
      lastHandNetBb: null,
      legalSpec,
      callEconomics,
      sizePresets: presets,
      customSizeAmountsBb: {},
      historyItems: [],
      handEquity: null,
      equityLoading: false,
      readTableOpen: priorState?.readTableOpen ?? false,
      botStats: priorState?.botStats ?? {
        handsPlayed: 0,
        vpipHands: 0,
        pfrHands: 0,
        cbetHands: 0,
        cbetOpps: 0,
        foldToBetCount: 0,
        facingBetCount: 0,
      },
      completedHands: priorState?.completedHands ?? [],
      finishedMatch: false,
      savedToReviewCount: priorState?.savedToReviewCount ?? 0,
    };
  }

  function recordBotStatsForHand(
    prevStats: DuelBotObservationStats,
    finalState: PokerState,
  ): DuelBotObservationStats {
    const astraActs = finalState.actionHistory.filter((a) => a.playerId === 'astra');
    const preflopActs = astraActs.filter((a) => a.street === 'preflop');
    const vpip = preflopActs.some((a) => {
      const t = a.submittedAction.type;
      return t === 'call' || t === 'raise' || t === 'bet';
    });
    const pfr = preflopActs.some((a) => {
      const t = a.submittedAction.type;
      return t === 'raise' || t === 'bet';
    });
    const heroBetCount = finalState.actionHistory.filter((a) => {
      const t = a.submittedAction.type;
      return a.playerId === 'hero' && (t === 'bet' || t === 'raise');
    }).length;
    const astraFoldedToBet = astraActs.some((a) => a.submittedAction.type === 'fold');
    return {
      handsPlayed: prevStats.handsPlayed + 1,
      vpipHands: prevStats.vpipHands + (vpip ? 1 : 0),
      pfrHands: prevStats.pfrHands + (pfr ? 1 : 0),
      cbetHands:
        prevStats.cbetHands +
        (pfr &&
        finalState.actionHistory.some(
          (a) => a.street === 'flop' && a.playerId === 'astra' && a.submittedAction.type === 'bet',
        )
          ? 1
          : 0),
      cbetOpps: prevStats.cbetOpps + (pfr && finalState.board.length >= 3 ? 1 : 0),
      foldToBetCount: prevStats.foldToBetCount + (astraFoldedToBet ? 1 : 0),
      facingBetCount: prevStats.facingBetCount + (heroBetCount > 0 ? 1 : 0),
    };
  }

  function finalizeCompletedDuelHand(live: DuelLiveState, finalState: PokerState): DuelLiveState {
    const handId = finalState.handId ?? `duel-${live.sessionSeed}-h${live.handNumber}`;
    const deckEntry = duelDecksByHandId.get(handId);
    const astraCards = deckEntry?.astraCards ?? (['2c', '3d'] as const);
    const heroPlayer = finalState.players.find((p) => p.playerId === 'hero')!;
    const heroEndBb = roundTenth(heroPlayer.currentStackMilliBb / 1000);
    const netBb = roundTenth(heroEndBb - DUEL_STARTING_STACK_BB);
    const heroCumulativeNetBb = roundTenth(live.heroCumulativeNetBb + netBb);
    const isShowdown = finalState.terminal.reason === 'showdown';

    const payload: SavedHandPayload = {
      handId,
      tablePreset: 'six_max_100bb',
      unitLabel: 'bb',
      seatCount: 2,
      startingStackBb: DUEL_STARTING_STACK_BB,
      heroPlayerId: 'hero',
      heroSeat: 0,
      heroPositionLabel: live.heroIsButton ? 'BTN' : 'BB',
      heroCards: live.heroCards,
      pokerState: finalState,
      recordedActions: toRecordedActions(finalState, live.heroIsButton ? 0 : 1),
      heroNotes: [],
      shorthandLine: formatShorthandForDuel(finalState),
      savedKind: 'completed_hand',
      tags: ['study'],
    };

    const handSummary: DuelCompletedHandSummary = {
      handNumber: live.handNumber,
      handId,
      heroCards: live.heroCards,
      astraCards,
      netBb,
      endedAtStreet: finalState.street,
      savedPayload: payload,
    };

    const nextBotStats = recordBotStatsForHand(live.botStats, finalState);
    const completedHands = [...live.completedHands, handSummary];
    const finishedMatch = live.handNumber >= DUEL_TOTAL_HANDS;

    if (finishedMatch) {
      const sessionPayload: TrainingSessionPayload = {
        sessionId: `duel-sess-${live.sessionSeed}`,
        mode: 'heads_up_duel',
        completedAt: new Date().toISOString(),
        spotsCount: completedHands.length,
        planAlignedCount: 0,
        baselineAlignedCount: 0,
        netBb: heroCumulativeNetBb,
        handsPlayed: completedHands.length,
        focusLabel: 'Astra',
      };
      trainingSessionsSignal.value = [sessionPayload, ...trainingSessionsSignal.value];
      void repository.recordTrainingSession(sessionPayload);
    }

    return {
      ...live,
      pokerState: finalState,
      revealedAstraCards: isShowdown ? astraCards : null,
      astraThinking: false,
      legalSpec: null,
      callEconomics: null,
      sizePresets: [],
      heroCumulativeNetBb,
      lastHandNetBb: netBb,
      botStats: nextBotStats,
      completedHands,
      finishedMatch,
    };
  }

  async function resolveChanceAndAdvanceDuel(
    live: DuelLiveState,
    stateInput: PokerState,
    runToken: number,
  ): Promise<void> {
    let state = stateInput;
    let historyItems = [...live.historyItems];
    const handId = state.handId ?? `duel-${live.sessionSeed}-h${live.handNumber}`;
    const deckEntry = duelDecksByHandId.get(handId);
    if (!deckEntry) return;
    let boardCursor = deckEntry.boardIdx;

    while (state.phase === 'chance' && state.pendingChance) {
      if (runToken !== duelRunToken) return;
      const needed = state.pendingChance.cardCount;
      const dealt = deckEntry.deck.slice(boardCursor, boardCursor + needed);
      boardCursor += needed;
      duelDecksByHandId.set(handId, { ...deckEntry, boardIdx: boardCursor });

      const paused = await pauseBeat('--beat-action', runToken);
      if (!paused) return;

      const chanceRes = engine.sync.applyChance(state, {
        type: state.pendingChance.type as 'deal_flop' | 'deal_turn' | 'deal_river',
        cards: dealt,
      });
      if (!chanceRes.ok) throw new Error(chanceRes.error.message);
      state = chanceRes.data;
      historyItems.push({
        id: `board-${state.street}`,
        street: state.street,
        actor: 'board',
        actionType: 'deal',
        potBb: roundTenth(state.potMilliBb / 1000),
        textKey: `training.duel.deal_${state.street}`,
        cards: dealt,
      });

      duelStateSignal.value = {
        ...duelStateSignal.value!,
        pokerState: state,
        heroBubble: null,
        astraBubble: null,
        historyItems,
      };
    }

    if (runToken !== duelRunToken) return;

    if (state.phase === 'showdown') {
      const revealIds = state.showdown?.requiredRevealPlayerIds ?? [];
      if (revealIds.includes('astra')) {
        const revRes = engine.sync.applyPrivateReveal(state, {
          playerId: 'astra',
          cards: deckEntry.astraCards,
        });
        if (!revRes.ok) throw new Error(revRes.error.message);
        state = revRes.data;
      }
      const sdRes = engine.sync.resolveShowdown(state);
      if (!sdRes.ok) throw new Error(sdRes.error.message);
      state = sdRes.data;
    }

    if (state.terminal.isTerminal) {
      duelStateSignal.value = finalizeCompletedDuelHand(
        { ...duelStateSignal.value!, historyItems },
        state,
      );
      duelSelectedTicketSignal.value = null;
      duelSelectedSizeIdSignal.value = null;
      return;
    }

    if (state.actingPlayerId === 'hero') {
      const legalRes = engine.sync.legalActions(state);
      const econRes = engine.sync.actorCallEconomics(state, 'hero');
      const legalSpec = legalRes.ok ? legalRes.data : null;
      const presets = buildDuelSizePresets(engine, state, legalSpec, live.customSizeAmountsBb);
      duelStateSignal.value = {
        ...duelStateSignal.value!,
        pokerState: state,
        astraThinking: false,
        legalSpec,
        callEconomics: econRes.ok ? econRes.data : null,
        sizePresets: presets,
        historyItems,
      };
      duelSelectedTicketSignal.value = defaultSelectedDuelTicket(legalSpec);
      duelSelectedSizeIdSignal.value = presets[1]?.id ?? presets[0]?.id ?? null;
      return;
    }

    if (state.actingPlayerId === 'astra') {
      await runAstraTurn(state, runToken);
    }
  }

  async function runAstraTurn(stateInput: PokerState, runToken: number): Promise<void> {
    if (runToken !== duelRunToken) return;
    const liveBefore = duelStateSignal.value;
    if (!liveBefore) return;
    const handId = stateInput.handId ?? `duel-${liveBefore.sessionSeed}-h${liveBefore.handNumber}`;
    const deckEntry = duelDecksByHandId.get(handId);
    if (!deckEntry) return;

    duelStateSignal.value = {
      ...liveBefore,
      pokerState: stateInput,
      astraThinking: true,
      legalSpec: null,
      callEconomics: null,
      sizePresets: [],
    };
    duelSelectedTicketSignal.value = null;

    const okAfterThink = await pauseBeat('--beat-think', runToken);
    if (!okAfterThink) return;

    const infoRes = engine.sync.projectOpponentInformation({
      pokerState: stateInput,
      actorSeat: 1,
      ownCards: deckEntry.astraCards,
    });
    if (!infoRes.ok) throw new Error(infoRes.error.message);

    const botRes = engine.sync.chooseDuelBotAction({
      actorInfo: infoRes.data,
      seed: liveBefore.sessionSeed + liveBefore.handNumber * 131 + stateInput.actionHistory.length,
      style: liveBefore.botStyle,
    });
    if (!botRes.ok) throw new Error(botRes.error.message);

    const action = botRes.data.action;
    const actRes = engine.sync.applyAction(stateInput, action);
    if (!actRes.ok) throw new Error(actRes.error.message);
    const nextState = actRes.data;

    const astraPlayer = stateInput.players.find((p) => p.playerId === 'astra');
    const amtBb =
      action.type === 'call'
        ? computeCallCommitBb(stateInput, 'astra')
        : action.type === 'all_in'
          ? roundTenth(
              (action.amountToMilliBb ??
                (astraPlayer
                  ? astraPlayer.streetContributionMilliBb + astraPlayer.currentStackMilliBb
                  : 0)) / 1000,
            )
          : action.amountToMilliBb !== null
            ? roundTenth(action.amountToMilliBb / 1000)
            : null;

    const updatedHistory: DuelHistoryItem[] = [
      ...duelStateSignal.value!.historyItems,
      {
        id: `act-${nextState.actionHistory.length}`,
        street: stateInput.street,
        actor: 'astra',
        actionType: action.type,
        amountBb: amtBb,
        textKey: `training.duel.action_${action.type}`,
      },
    ];

    const liveAfterBot: DuelLiveState = {
      ...duelStateSignal.value!,
      pokerState: nextState,
      astraThinking: false,
      astraBubble: { type: action.type, amountBb: amtBb },
      historyItems: updatedHistory,
    };
    duelStateSignal.value = liveAfterBot;

    await resolveChanceAndAdvanceDuel(liveAfterBot, nextState, runToken);
  }

  let inFlightHydrate: Promise<void> | null = null;

  return {
    activeViewSignal,
    evidenceSignal,
    trainingSessionsSignal,
    drillFiltersSignal,
    drillExerciseSignal,
    drillLoadingSignal,
    drillSelectedTicketSignal,
    drillSelectedSizeIdSignal,
    drillCustomSizesBbSignal,
    drillGradeSignal,
    drillEquityCheckSignal,
    drillSessionStatsSignal,
    missedDrillQueueSignal,
    duelStateSignal,
    duelSelectedTicketSignal,
    duelSelectedSizeIdSignal,
    thisWeekStatsSignal,
    leakMapSignal,
    leakLabTargetsSignal,

    async hydrate() {
      if (inFlightHydrate) return inFlightHydrate;
      inFlightHydrate = Promise.all([
        repository.listStrategyEvidence(),
        repository.listTrainingSessions(),
      ])
        .then(([ev, sessions]) => {
          evidenceSignal.value = ev;
          trainingSessionsSignal.value = sessions;
        })
        .finally(() => {
          inFlightHydrate = null;
        });
      return inFlightHydrate;
    },

    dispose() {
      duelRunToken += 1;
      clearPendingTimers();
    },

    setActiveView(view) {
      const prev = activeViewSignal.value;
      if (
        (prev === 'drill' || prev === 'leak_lab') &&
        (view === 'hub' || view === 'duel') &&
        drillSessionStatsSignal.value.answeredCount > 0
      ) {
        void flushDrillSession();
      }
      activeViewSignal.value = view;
    },

    async openQuickDrill(opts = {}) {
      activeViewSignal.value = 'drill';
      if (
        opts.focusPosition !== undefined ||
        opts.focusFamilyId !== undefined ||
        opts.target !== undefined
      ) {
        drillFiltersSignal.value = {
          ...drillFiltersSignal.value,
          ...(opts.target !== undefined ? { target: opts.target } : {}),
          ...(opts.focusPosition !== undefined ? { focusPosition: opts.focusPosition } : {}),
          ...(opts.focusFamilyId !== undefined ? { focusFamilyId: opts.focusFamilyId } : {}),
        };
      }
      await loadNextDrill();
    },

    async openLeakLab(targetItem) {
      activeViewSignal.value = 'leak_lab';
      const chosen = targetItem ?? leakLabTargetsSignal.value[0] ?? null;
      drillFiltersSignal.value = {
        ...drillFiltersSignal.value,
        tableSize: 6,
        stackDepthBb: 100,
        target: 'preflop_rfi',
        focusPosition: chosen?.position ?? 'CO',
        focusFamilyId: chosen?.familyId ?? 'suited_aces',
      };
      await loadNextDrill();
    },

    async setDrillFilters(patch) {
      drillFiltersSignal.value = {
        ...drillFiltersSignal.value,
        ...patch,
      };
      await loadNextDrill();
    },

    async nextDrillSpot() {
      await loadNextDrill();
    },

    selectDrillTicket(ticketId) {
      if (drillGradeSignal.value) return;
      drillSelectedTicketSignal.value = ticketId;
      const ex = drillExerciseSignal.value;
      if (ticketId === 'raise' && ex && ex.raisePresetsBb.length > 0 && !drillSelectedSizeIdSignal.value) {
        drillSelectedSizeIdSignal.value = 's0';
      }
    },

    selectDrillSize(sizeId) {
      if (drillGradeSignal.value) return;
      drillSelectedSizeIdSignal.value = sizeId;
      drillSelectedTicketSignal.value = 'raise';
    },

    adjustDrillSize(sizeId, nextBb) {
      if (drillGradeSignal.value) return;
      const ex = drillExerciseSignal.value;
      if (!ex) return;
      const min = (ex.legalSpec.raise.minToMilliBb ?? 2000) / 1000;
      const max = (ex.legalSpec.raise.maxToMilliBb ?? ex.stackDepthBb * 1000) / 1000;
      const clamped = roundTenth(Math.max(min, Math.min(max, nextBb)));
      drillCustomSizesBbSignal.value = {
        ...drillCustomSizesBbSignal.value,
        [sizeId]: clamped,
      };
    },

    resetDrillSizes() {
      if (drillGradeSignal.value) return;
      drillCustomSizesBbSignal.value = {};
    },

    async confirmDrillAnswer() {
      const ex = drillExerciseSignal.value;
      const ticket = drillSelectedTicketSignal.value;
      if (!ex || !ticket || drillGradeSignal.value) return;

      let chosenAmountToBb: number | null = null;
      if (ticket === 'raise') {
        const idx = drillSelectedSizeIdSignal.value ? Number(drillSelectedSizeIdSignal.value.slice(1)) : 0;
        const base = ex.raisePresetsBb[idx] ?? ex.raisePresetsBb[0] ?? 2.5;
        chosenAmountToBb = drillCustomSizesBbSignal.value[`s${idx}`] ?? base;
      }

      const res = await engine.async.gradeTrainingAnswer({
        exercise: ex,
        chosenActionType: ticket as ActionType,
        chosenAmountToBb,
        evidence: evidenceSignal.value,
        occurredAt: new Date().toISOString(),
      });
      if (!res.ok) return;

      const grade = res.data;
      drillGradeSignal.value = grade;
      evidenceSignal.value = [...evidenceSignal.value, grade.evidenceEntry];
      await repository.recordStrategyEvidence([grade.evidenceEntry]);

      const prev = drillSessionStatsSignal.value;
      const isUnavailable = grade.baselineTier === 'unavailable';
      const aligned = grade.comparison === 'matches' || grade.comparison === 'close';
      const nextStreak = isUnavailable ? prev.currentStreak : aligned ? prev.currentStreak + 1 : 0;
      const nextBestStreak = Math.max(prev.bestStreak, nextStreak);
      if (!isUnavailable) {
        if (aligned) {
          if (prev.retryingMissed) {
            missedDrillQueueSignal.value = missedDrillQueueSignal.value.filter(
              (item) => item.exerciseId !== ex.exerciseId,
            );
          }
        } else if (!missedDrillQueueSignal.value.some((item) => item.exerciseId === ex.exerciseId)) {
          missedDrillQueueSignal.value = [...missedDrillQueueSignal.value, ex].slice(-12);
        }
      }

      drillSessionStatsSignal.value = {
        answeredCount: prev.answeredCount + 1,
        baselineAlignedCount: prev.baselineAlignedCount + (aligned ? 1 : 0),
        planAlignedCount: prev.planAlignedCount + (grade.matchesUserPlan === true ? 1 : 0),
        currentStreak: nextStreak,
        bestStreak: nextBestStreak,
        missedCount: prev.missedCount + (!isUnavailable && !aligned ? 1 : 0),
        retryingMissed: prev.retryingMissed,
      };

      if (isUnavailable) {
        drillEquitySeq += 1;
        const eqSeq = drillEquitySeq;
        drillEquityCheckSignal.value = {
          loading: true,
          heroEquityPct: null,
          requiredEquityPct: ex.requiredEquityPct,
          marginPct: null,
          trials: null,
        };
        const eqRes = await engine.async.calculateEquity({
          schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
          board: [],
          deadCards: [],
          method: 'auto',
          samples: 6000,
          players: [
            { id: 'hero', cards: [...ex.heroCards] },
            { id: 'villain', cards: null },
          ],
        });
        if (eqSeq !== drillEquitySeq) return;
        if (eqRes.ok && 'players' in eqRes.data && 'trials' in eqRes.data) {
          const heroRes = eqRes.data.players.find((p) => p.id === 'hero');
          const heroPct = heroRes ? roundTenth(heroRes.equity * 100) : null;
          const margin = heroPct !== null ? roundTenth(heroPct - ex.requiredEquityPct) : null;
          drillEquityCheckSignal.value = {
            loading: false,
            heroEquityPct: heroPct,
            requiredEquityPct: ex.requiredEquityPct,
            marginPct: margin,
            trials: eqRes.data.trials,
          };
        } else {
          drillEquityCheckSignal.value = null;
        }
      }
    },

    retryMissedSpot() {
      const queue = missedDrillQueueSignal.value;
      const target = queue[0];
      if (!target) return;
      drillExerciseSignal.value = target;
      drillSelectedTicketSignal.value = null;
      drillSelectedSizeIdSignal.value = target.raisePresetsBb.length > 0 ? 's0' : null;
      drillCustomSizesBbSignal.value = {};
      drillGradeSignal.value = null;
      drillEquitySeq += 1;
      drillEquityCheckSignal.value = null;
      drillSessionStatsSignal.value = {
        ...drillSessionStatsSignal.value,
        retryingMissed: true,
      };
    },

    async finishDrillSession() {
      await flushDrillSession();
    },

    async startHeadsUpDuel(seed = 404, style = 'balanced') {
      if (drillSessionStatsSignal.value.answeredCount > 0) {
        void flushDrillSession();
      }
      duelRunToken += 1;
      const runToken = duelRunToken;
      clearPendingTimers();
      activeViewSignal.value = 'duel';

      const live = dealDuelHand(1, seed, style, null);
      duelStateSignal.value = live;
      duelSelectedTicketSignal.value = defaultSelectedDuelTicket(live.legalSpec);
      duelSelectedSizeIdSignal.value = live.sizePresets[1]?.id ?? live.sizePresets[0]?.id ?? null;

      if (live.pokerState.actingPlayerId === 'astra') {
        await runAstraTurn(live.pokerState, runToken);
      }
    },

    selectDuelTicket(ticketId) {
      const live = duelStateSignal.value;
      if (!live || live.astraThinking || live.pokerState.actingPlayerId !== 'hero') return;
      duelSelectedTicketSignal.value = ticketId;
      if ((ticketId === 'bet' || ticketId === 'raise') && live.sizePresets.length > 0 && !duelSelectedSizeIdSignal.value) {
        duelSelectedSizeIdSignal.value = live.sizePresets[1]?.id ?? live.sizePresets[0]?.id ?? null;
      }
    },

    selectDuelSize(sizeId) {
      const live = duelStateSignal.value;
      if (!live || live.astraThinking || !live.legalSpec) return;
      duelSelectedSizeIdSignal.value = sizeId;
      duelSelectedTicketSignal.value = live.legalSpec.bet.available ? 'bet' : 'raise';
    },

    adjustDuelSize(sizeId, nextBb) {
      const live = duelStateSignal.value;
      if (!live || !live.legalSpec) return;
      const nextCustom = { ...live.customSizeAmountsBb, [sizeId]: nextBb };
      const presets = buildDuelSizePresets(engine, live.pokerState, live.legalSpec, nextCustom);
      duelStateSignal.value = {
        ...live,
        customSizeAmountsBb: nextCustom,
        sizePresets: presets,
      };
    },

    resetDuelSizes() {
      const live = duelStateSignal.value;
      if (!live || !live.legalSpec) return;
      const presets = buildDuelSizePresets(engine, live.pokerState, live.legalSpec, {});
      duelStateSignal.value = {
        ...live,
        customSizeAmountsBb: {},
        sizePresets: presets,
      };
    },

    async confirmDuelAction() {
      const live = duelStateSignal.value;
      const ticket = duelSelectedTicketSignal.value;
      if (!live || !ticket || live.astraThinking || live.pokerState.actingPlayerId !== 'hero') return;

      let actionType: ActionType = ticket;
      let amountToMilliBb: number | null = null;
      let amountBb: number | null = null;
      if (ticket === 'call') {
        amountBb = computeCallCommitBb(live.pokerState, 'hero');
      } else if (ticket === 'bet' || ticket === 'raise') {
        const chosen =
          live.sizePresets.find((s) => s.id === duelSelectedSizeIdSignal.value) ??
          live.sizePresets[0];
        if (chosen) {
          if (chosen.id === 'allin' && live.legalSpec?.allIn.available) {
            actionType = 'all_in';
            amountBb = chosen.amountBb;
            amountToMilliBb = null;
          } else {
            amountBb = chosen.amountBb;
            amountToMilliBb = Math.round(chosen.amountBb * 1000);
          }
        }
      }

      const action: PokerAction = {
        schemaVersion: POKER_ACTION_SCHEMA_VERSION,
        playerId: 'hero',
        type: actionType,
        amountToMilliBb,
      };
      const actRes = engine.sync.applyAction(live.pokerState, action);
      if (!actRes.ok) throw new Error(actRes.error.message);
      const nextState = actRes.data;

      const updatedHistory: DuelHistoryItem[] = [
        ...live.historyItems,
        {
          id: `act-${nextState.actionHistory.length}`,
          street: live.pokerState.street,
          actor: 'hero',
          actionType,
          amountBb,
          textKey: `training.duel.action_${actionType}`,
        },
      ];

      const liveAfterHero: DuelLiveState = {
        ...live,
        pokerState: nextState,
        heroBubble: { type: actionType, amountBb },
        legalSpec: null,
        callEconomics: null,
        sizePresets: [],
        historyItems: updatedHistory,
      };
      duelStateSignal.value = liveAfterHero;
      duelSelectedTicketSignal.value = null;

      await resolveChanceAndAdvanceDuel(liveAfterHero, nextState, duelRunToken);
    },

    async dealNextDuelHand() {
      const live = duelStateSignal.value;
      if (!live || live.handNumber >= live.totalHands) return;
      duelRunToken += 1;
      const runToken = duelRunToken;
      clearPendingTimers();

      const nextLive = dealDuelHand(live.handNumber + 1, live.sessionSeed, live.botStyle, live);
      duelStateSignal.value = nextLive;
      duelSelectedTicketSignal.value = defaultSelectedDuelTicket(nextLive.legalSpec);
      duelSelectedSizeIdSignal.value = nextLive.sizePresets[1]?.id ?? nextLive.sizePresets[0]?.id ?? null;

      if (nextLive.pokerState.actingPlayerId === 'astra') {
        await runAstraTurn(nextLive.pokerState, runToken);
      }
    },

    toggleReadTable() {
      const live = duelStateSignal.value;
      if (!live) return;
      duelStateSignal.value = {
        ...live,
        readTableOpen: !live.readTableOpen,
      };
    },

    async computeDuelHandEquity() {
      const live = duelStateSignal.value;
      if (!live) return;
      duelStateSignal.value = { ...live, equityLoading: true };
      const res = await engine.async.calculateEquity({
        schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
        board: [...live.pokerState.board],
        deadCards: [],
        method: 'auto',
        samples: 10000,
        players: [
          { id: 'hero', cards: [...live.heroCards] },
          { id: 'astra', cards: null },
        ],
      });
      const current = duelStateSignal.value;
      if (!current || current.handNumber !== live.handNumber) return;
      if (res.ok && 'players' in res.data && 'method' in res.data) {
        duelStateSignal.value = {
          ...current,
          handEquity: res.data as EquityResult,
          equityLoading: false,
        };
      } else {
        duelStateSignal.value = { ...current, equityLoading: false };
      }
    },

    async saveDuelHandsToReview() {
      const live = duelStateSignal.value;
      if (!live || live.completedHands.length === 0) return 0;
      let count = 0;
      for (const h of live.completedHands) {
        await repository.saveHand(h.savedPayload);
        count += 1;
      }
      duelStateSignal.value = {
        ...duelStateSignal.value!,
        savedToReviewCount: count,
      };
      return count;
    },

    async applyPreset(preset) {
      duelRunToken += 1;
      clearPendingTimers();

      if (preset === 'hub') {
        activeViewSignal.value = 'hub';
        return;
      }

      if (preset === 'drill_question' || preset === 'drill_answered') {
        activeViewSignal.value = 'drill';
        drillFiltersSignal.value = {
          tableSize: 6,
          stackDepthBb: 100,
          target: 'preflop_facing_open',
          focusPosition: 'BTN',
          focusFamilyId: null,
        };
        await loadNextDrill(101);
        if (preset === 'drill_answered' && drillExerciseSignal.value) {
          drillSelectedTicketSignal.value = 'raise';
          drillSelectedSizeIdSignal.value = 's0';
          await this.confirmDrillAnswer();
        }
        return;
      }

      activeViewSignal.value = 'duel';

      if (preset === 'duel_preflop') {
        const live = dealDuelHand(1, 515, 'balanced', null);
        duelStateSignal.value = live;
        duelSelectedTicketSignal.value = null;
        duelSelectedSizeIdSignal.value = live.sizePresets[1]?.id ?? live.sizePresets[0]?.id ?? null;
        return;
      }

      if (preset === 'duel_thinking') {
        const base = dealDuelHand(1, 515, 'balanced', null);
        const raiseRes = engine.sync.applyAction(base.pokerState, {
          schemaVersion: POKER_ACTION_SCHEMA_VERSION,
          playerId: 'hero',
          type: 'raise',
          amountToMilliBb: 2500,
        });
        const nextState = raiseRes.ok ? raiseRes.data : base.pokerState;
        duelStateSignal.value = {
          ...base,
          pokerState: nextState,
          astraThinking: true,
          heroBubble: { type: 'raise', amountBb: 2.5 },
          legalSpec: null,
          callEconomics: null,
          sizePresets: [],
          historyItems: [
            {
              id: 'act-1',
              street: 'preflop',
              actor: 'hero',
              actionType: 'raise',
              amountBb: 2.5,
              textKey: 'training.duel.action_raise',
            },
          ],
        };
        duelSelectedTicketSignal.value = null;
        return;
      }

      if (preset === 'duel_flop_ladder') {
        const rules = getDuelRules();
        const initRes = engine.sync.initializeRecordedHand({
          handId: 'duel-flop-preset',
          rulesSnapshot: rules,
          buttonSeat: 1,
          players: [
            { playerId: 'hero', seat: 0, startingStackMilliBb: 100_000 },
            { playerId: 'astra', seat: 1, startingStackMilliBb: 100_000 },
          ],
        });
        if (!initRes.ok) throw new Error(initRes.error.message);
        let st = initRes.data;
        const heroCards: readonly [string, string] = ['As', 'Ks'];
        const astraCards: readonly [string, string] = ['Qc', 'Jd'];
        const board = ['Qh', '7c', '2h'];
        duelDecksByHandId.set('duel-flop-preset', {
          deck: HOLDEM_DECK.filter((c) => !heroCards.includes(c) && !astraCards.includes(c) && !board.includes(c)),
          boardIdx: 0,
          astraCards,
        });
        st = must(engine.sync.applyChance(st, { type: 'deal_hole', cardsByPlayer: { hero: [...heroCards] }, hiddenPlayerIds: ['astra'] }));
        st = must(engine.sync.applyAction(st, { schemaVersion: POKER_ACTION_SCHEMA_VERSION, playerId: 'astra', type: 'raise', amountToMilliBb: 2500 }));
        st = must(engine.sync.applyAction(st, { schemaVersion: POKER_ACTION_SCHEMA_VERSION, playerId: 'hero', type: 'call', amountToMilliBb: null }));
        st = must(engine.sync.applyChance(st, { type: 'deal_flop', cards: board }));

        const legalRes = engine.sync.legalActions(st);
        const econRes = engine.sync.actorCallEconomics(st, 'hero');
        const legalSpec = legalRes.ok ? legalRes.data : null;
        const presets = buildDuelSizePresets(engine, st, legalSpec, {});

        duelStateSignal.value = {
          sessionSeed: 515,
          botStyle: 'balanced',
          handNumber: 2,
          totalHands: DUEL_TOTAL_HANDS,
          heroIsButton: false,
          pokerState: st,
          heroCards,
          revealedAstraCards: null,
          astraThinking: false,
          heroBubble: null,
          astraBubble: null,
          heroCumulativeNetBb: 3.5,
          lastHandNetBb: null,
          legalSpec,
          callEconomics: econRes.ok ? econRes.data : null,
          sizePresets: presets,
          customSizeAmountsBb: {},
          historyItems: [
            { id: 'h1', street: 'preflop', actor: 'astra', actionType: 'raise', amountBb: 2.5, textKey: 'training.duel.action_raise' },
            { id: 'h2', street: 'preflop', actor: 'hero', actionType: 'call', amountBb: 1.5, textKey: 'training.duel.action_call' },
            {
              id: 'h3',
              street: 'flop',
              actor: 'board',
              actionType: 'deal',
              potBb: roundTenth(st.potMilliBb / 1000),
              textKey: 'training.duel.deal_flop',
              cards: board,
            },
          ],
          handEquity: null,
          equityLoading: false,
          readTableOpen: true,
          botStats: { handsPlayed: 2, vpipHands: 2, pfrHands: 1, cbetHands: 0, cbetOpps: 1, foldToBetCount: 0, facingBetCount: 1 },
          completedHands: [],
          finishedMatch: false,
          savedToReviewCount: 0,
        };
        duelSelectedTicketSignal.value = 'bet';
        duelSelectedSizeIdSignal.value = 'p50';
        return;
      }

      if (preset === 'duel_result') {
        // Build deterministic 10 completed hands cleanly for result summary layout inspection
        let cur = dealDuelHand(1, 515, 'balanced', null);
        const completed: DuelCompletedHandSummary[] = [];
        let cumulative = 0;
        for (let i = 1; i <= DUEL_TOTAL_HANDS; i += 1) {
          const baseHand = i === 1 ? cur : dealDuelHand(i, 515, 'balanced', cur);
          const actorId = baseHand.pokerState.actingPlayerId!;
          const foldRes = engine.sync.applyAction(baseHand.pokerState, {
            schemaVersion: POKER_ACTION_SCHEMA_VERSION,
            playerId: actorId,
            type: 'fold',
            amountToMilliBb: null,
          });
          const endState = foldRes.ok ? foldRes.data : baseHand.pokerState;
          const heroEnd = roundTenth((endState.players.find((p) => p.playerId === 'hero')?.currentStackMilliBb ?? 100_000) / 1000);
          const net = roundTenth(heroEnd - DUEL_STARTING_STACK_BB);
          cumulative = roundTenth(cumulative + net);
          const endHandId = endState.handId ?? `duel-515-h${i}`;
          const entry = duelDecksByHandId.get(endHandId);
          completed.push({
            handNumber: i,
            handId: endHandId,
            heroCards: baseHand.heroCards,
            astraCards: entry?.astraCards ?? ['2c', '3d'],
            netBb: net,
            endedAtStreet: endState.street,
            savedPayload: {
              handId: endHandId,
              tablePreset: 'six_max_100bb',
              unitLabel: 'bb',
              seatCount: 2,
              startingStackBb: DUEL_STARTING_STACK_BB,
              heroPlayerId: 'hero',
              heroSeat: 0,
              heroPositionLabel: baseHand.heroIsButton ? 'BTN' : 'BB',
              heroCards: baseHand.heroCards,
              pokerState: endState,
              recordedActions: toRecordedActions(endState, baseHand.heroIsButton ? 0 : 1),
              heroNotes: [],
              shorthandLine: formatShorthandForDuel(endState),
              savedKind: 'completed_hand',
              tags: ['study'],
            },
          });
          cur = baseHand;
        }
        duelStateSignal.value = {
          ...cur,
          handNumber: DUEL_TOTAL_HANDS,
          legalSpec: null,
          callEconomics: null,
          sizePresets: [],
          heroCumulativeNetBb: cumulative,
          lastHandNetBb: completed[completed.length - 1]?.netBb ?? 0,
          botStats: { handsPlayed: 10, vpipHands: 6, pfrHands: 4, cbetHands: 2, cbetOpps: 3, foldToBetCount: 1, facingBetCount: 3 },
          completedHands: completed,
          finishedMatch: true,
          savedToReviewCount: 0,
        };
      }
    },
  };
}

let sharedTrainingStore: TrainingStore | null = null;

export function getSharedTrainingStore(): TrainingStore {
  if (!sharedTrainingStore) {
    sharedTrainingStore = createTrainingStore();
  }
  return sharedTrainingStore;
}

export function resetSharedTrainingStore(): void {
  sharedTrainingStore?.dispose();
  sharedTrainingStore = null;
}
