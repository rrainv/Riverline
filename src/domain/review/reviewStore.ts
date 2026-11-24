import { computed, effect, signal } from '@preact/signals';
import {
  EQUITY_REQUEST_SCHEMA_VERSION,
  getSharedEngineClient,
  REPLAY_FRAME_OPERATIONS,
  WEIGHTED_EQUITY_REQUEST_VERSION,
  type DispatchedEquityResult,
  type EngineClient,
  type PokerState,
} from '../../engine-api';
import { parsePlayerHandInput } from '../shorthand';
import {
  getDefaultStudyRepository,
  isStudyStorageWiped,
  type EquityStreet,
  type HeroDecisionNote,
  type SavedHandAnnotatedPayload,
  type SavedHandRecord,
  type SavedObjectTagId,
  type StudyImportResult,
  type StudyRepository,
  type ThinkingReasonId,
} from '../storage';
import type {
  CounterfactualRangeId,
  DecisionEquityEvaluation,
  DecisionsVsLuckSummary,
  HeroDecisionRecord,
  ReplayFrameMeta,
  ReviewPresetId,
  ReviewSessionSnapshot,
  ReviewSideTab,
  ReviewStore,
  SavedLibraryFilter,
  SavedLibraryItemSummary,
  SavedLibrarySort,
} from './types';
import {
  buildCounterfactualRangeSpec,
  buildReviewReplaySession,
  buildStarterFridayHandRecord,
  buildStarterSpotRecord,
  COUNTERFACTUAL_RANGE_TEMPLATES,
  deriveEffectivePotMilliBb,
  isEquityResult,
  isWeightedResult,
  roundToTenth,
  STARTER_FRIDAY_OBJECT_ID,
  STARTER_SPOT_OBJECT_ID,
  summarizeRecord,
  unwrap,
} from './reviewHelpers';
export {
  COUNTERFACTUAL_RANGE_TEMPLATES,
  buildCounterfactualRangeSpec,
  buildReviewReplaySession,
  buildStarterFridayHandRecord,
};
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
  const includeStarterSamples = (options.includeStarterSamples ?? true) && !isStudyStorageWiped();

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
  const replayBaseRecordSignal = signal<SavedHandRecord>(starterFriday);
  const frameIndexSignal = signal<number>(0);
  const selectedDecisionIndexSignal = signal<number>(0);
  const counterfactualRangeSignal = signal<CounterfactualRangeId>('showed');
  const feltExpandedSignal = signal<boolean>(
    typeof window !== 'undefined' && window.innerWidth >= 1280,
  );

  const savedFilterSignal = signal<SavedLibraryFilter>('all');
  const savedSortSignal = signal<SavedLibrarySort>('new');
  const savedSeatFilterSignal = signal<string>('all');
  const savedTagFilterSignal = signal<SavedObjectTagId | 'all'>('all');
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

  function isSameReplayHand(a: SavedHandRecord, b: SavedHandRecord): boolean {
    return (
      a.objectId === b.objectId &&
      a.payload.handId === b.payload.handId &&
      a.payload.heroPlayerId === b.payload.heroPlayerId &&
      a.payload.heroCards[0] === b.payload.heroCards[0] &&
      a.payload.heroCards[1] === b.payload.heroCards[1] &&
      a.payload.recordedActions.length === b.payload.recordedActions.length &&
      a.payload.pokerState.board.length === b.payload.pokerState.board.length &&
      a.payload.pokerState.terminal.isTerminal === b.payload.pokerState.terminal.isTerminal &&
      a.payload.shorthandLine === b.payload.shorthandLine
    );
  }

  const replaySnapshotSignal = computed<ReviewSessionSnapshot>(() => {
    const rec = replayBaseRecordSignal.value;
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
    const tagFilter = savedTagFilterSignal.value;
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

      if (tagFilter !== 'all' && !item.record.tags.includes(tagFilter)) {
        return false;
      }

      if (query) {
        const haystack = [
          item.record.factTitle,
          item.heroPosition,
          item.record.payload.shorthandLine,
          item.record.payload.handNote ?? '',
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
      const playersList = resp.data.players;
      const heroRes = playersList.find((p) => p.id === snap.record.payload.heroPlayerId);
      const villainRes = primaryVillainId
        ? playersList.find((p) => p.id === primaryVillainId)
        : undefined;
      const villainPct = villainRes ? roundToTenth(villainRes.equity * 100) : null;
      const additionalVillains = decision.villainIds
        .filter((vid) => vid !== primaryVillainId)
        .map((vid) => {
          const pRes = playersList.find((p) => p.id === vid);
          const pPlayer = snap.record.payload.pokerState.players.find((p) => p.playerId === vid);
          const rev = snap.revealedVillainCardsById[vid] ?? null;
          return {
            playerId: vid,
            positionLabel: pPlayer?.position ?? vid,
            equityPct: pRes ? roundToTenth(pRes.equity * 100) : 0,
            revealedCards: rev,
          };
        });
      const isCallAction =
        decision.facingBet &&
        (decision.actionMeta.type === 'call' || decision.actionMeta.type === 'all_in');
      const priceCmp = unwrap(
        engine.sync.compareCallEquityToRequired({
          heroEquityFraction: heroRes ? heroRes.equity : null,
          requiredEquityFraction:
            decision.facingBet ? decision.callEconomics.requiredRawEquity : null,
          isCallAction,
          isExact,
        }),
        'compareCallEquityToRequired',
      );

      decisionEvaluationSignal.value = {
        decisionIndex: decision.decisionIndex,
        mode,
        tier: isExact ? 'exact' : 'estimated',
        detailKey: isExact ? 'showdown_exact' : 'showdown_sampled',
        trials: resp.data.trials,
        heroEquityPct: priceCmp.heroEquityPct,
        villainEquityPct: villainPct,
        requiredEquityPct: priceCmp.requiredEquityPct ?? decision.requiredEquityPct,
        deltaVsRequiredPct: priceCmp.deltaVsRequiredPct,
        villainRangeSpec: null,
        villainPositionLabel: primaryVillainPlayer?.position ?? null,
        villainRevealedCards: primaryRevealedCards,
        additionalVillains,
        isMathMistake: priceCmp.behindRequiredPrice,
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

    const playersList = resp.data.players;
    const heroRes = playersList.find((p) => p.id === snap.record.payload.heroPlayerId);
    const villainRes = playersList.find((p) => p.id === primaryVillainId);
    const villainPct = villainRes ? roundToTenth(villainRes.equity * 100) : null;
    const additionalVillains = decision.villainIds
      .filter((vid) => vid !== primaryVillainId)
      .map((vid) => {
        const pRes = playersList.find((p) => p.id === vid);
        const pPlayer = snap.record.payload.pokerState.players.find((p) => p.playerId === vid);
        return {
          playerId: vid,
          positionLabel: pPlayer?.position ?? vid,
          equityPct: pRes ? roundToTenth(pRes.equity * 100) : 0,
          revealedCards: null,
        };
      });
    const isCallAction =
      decision.facingBet &&
      (decision.actionMeta.type === 'call' || decision.actionMeta.type === 'all_in');
    const priceCmp = unwrap(
      engine.sync.compareCallEquityToRequired({
        heroEquityFraction: heroRes ? heroRes.equity : null,
        requiredEquityFraction:
          decision.facingBet ? decision.callEconomics.requiredRawEquity : null,
        isCallAction,
        isExact: false,
      }),
      'compareCallEquityToRequired',
    );

    decisionEvaluationSignal.value = {
      decisionIndex: decision.decisionIndex,
      mode,
      tier: 'estimated',
      detailKey: 'opponent_assumption',
      trials: resp.data.trials,
      heroEquityPct: priceCmp.heroEquityPct,
      villainEquityPct: villainPct,
      requiredEquityPct: priceCmp.requiredEquityPct ?? decision.requiredEquityPct,
      deltaVsRequiredPct: priceCmp.deltaVsRequiredPct,
      villainRangeSpec: spec,
      villainPositionLabel: primaryVillainPlayer?.position ?? null,
      villainRevealedCards: null,
      additionalVillains,
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
    replayBaseRecordSignal.value = record;
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
    patch: SavedHandAnnotatedPayload,
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
        const nextHandNote =
          patch.handNote !== undefined ? patch.handNote : rec.payload.handNote;
        const nextRec: SavedHandRecord = {
          ...rec,
          updatedAt: new Date().toISOString(),
          tags: nextTags,
          payload: {
            ...rec.payload,
            tags: nextTags,
            heroNotes: nextNotes,
            ...(nextHandNote !== undefined ? { handNote: nextHandNote } : {}),
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

  async function setHandSummaryNote(text: string): Promise<void> {
    const rec = activeRecordSignal.value;
    await persistRecordPatch(rec.objectId, { handNote: text });
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
    if (isStudyStorageWiped() && starterRecordsSignal.value.length > 0) {
      starterRecordsSignal.value = [];
    }
    syncSavedListSignals();
    const activeId = activeRecordSignal.value.objectId;
    const refreshedActive = list.find((r) => r.objectId === activeId);
    if (refreshedActive) {
      activeRecordSignal.value = refreshedActive;
      if (!isSameReplayHand(replayBaseRecordSignal.value, refreshedActive)) {
        replayBaseRecordSignal.value = refreshedActive;
      }
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
    savedTagFilterSignal.value = 'all';
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

  const unsubscribeRepo = repository.subscribe(() => {
    void refreshSavedLibrary().catch(() => {});
  });

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
    savedTagFilterSignal,
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
    setHandSummaryNote,
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
    setSavedTagFilter(tag) {
      savedTagFilterSignal.value = tag;
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
      unsubscribeRepo();
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
