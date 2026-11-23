import { computed, signal } from '@preact/signals';
import {
  createStrategyContext,
  getSharedEngineClient,
  HOME_GAME_CURRENCY_PRESETS,
  LEARN_CONCEPT_IDS,
  strategyContextKey,
  type EngineClient,
  type HomeGameParticipant,
  type HomeGameTransaction,
  type StrategyEvidenceEntry,
  type StrategyLeakMapProjection,
  type StrategySpotMapProjection,
} from '../../engine-api';
import { dailyStudyGoalSignal } from '../appearance';
import {
  buildSavedHandPayloadFromCompiled,
  compileShorthandTokensToState,
  createInitialDealtHandState,
  TABLE_PRESETS,
} from '../hand';
import { tokenizeActionShorthandLine } from '../shorthand';
import {
  buildSavedHandFactTitle,
  getDefaultStudyRepository,
  type LearnProgressSnapshot,
  type NightSessionRecord,
  type SavedHandRecord,
  type SavedMatchupRecord,
  type TrainingSessionPayload,
} from '../storage';
import {
  HOME_EVIDENCE_WATCH_THRESHOLD,
  type HomeGreetingBucket,
  type HomeNightCardSummary,
  type HomeNextStepItem,
  type HomeOfferItem,
  type HomePresetId,
  type HomeSectionErrors,
  type HomeStore,
  type HomeStoreOptions,
  type HomeTopLeakSummary,
  type HomeVisitState,
  type WeeklyStudySummary,
} from './types';
import { computeHomeHabitSummary } from './habitCoach';
import { computeStudyMomentum, type StudyMomentumSummary } from './studyMomentum';
import { computeWeeklyStudySummary } from './weeklySummary';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function unwrap<T>(res: { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: { readonly message: string } }): T {
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}

function buildPresetEvidence(
  nowIso: string,
  includeCoWatching: boolean,
): StrategyEvidenceEntry[] {
  const entries: StrategyEvidenceEntry[] = [];
  const utgCtx = strategyContextKey(
    createStrategyContext({
      tableSize: 6,
      stackDepthBb: 100,
      decisionFamily: 'preflop_rfi',
      position: 'UTG',
    }),
  );
  // 22 UTG entries (>= 20 threshold) so UTG shows a real wide-opening gap without "watching".
  const utgRaiseHands = [
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77',
    'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'QJs',
    'AKo', 'AQo', 'AJo', 'KQo', 'QJo', 'QTo', 'JTo',
  ];
  utgRaiseHands.forEach((handClass, idx) => {
    entries.push({
      evidenceId: `home-preset-utg-${idx}`,
      occurredAt: nowIso,
      contextKey: utgCtx,
      handClass,
      source: 'calibration',
      action: 'raise',
    });
  });

  if (includeCoWatching) {
    const coCtx = strategyContextKey(
      createStrategyContext({
        tableSize: 6,
        stackDepthBb: 100,
        decisionFamily: 'preflop_rfi',
        position: 'CO',
      }),
    );
    const coHands = ['AA', 'KK', 'QQ', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s'];
    coHands.forEach((handClass, idx) => {
      entries.push({
        evidenceId: `home-preset-co-${idx}`,
        occurredAt: nowIso,
        contextKey: coCtx,
        handClass,
        source: 'drill',
        action: 'raise',
      });
    });
  }

  return entries;
}

function buildPresetSavedHand(
  engine: EngineClient,
  options: {
    readonly objectId: string;
    readonly handId: string;
    readonly shorthandLine: string;
    readonly heroCards: readonly [string, string];
    readonly savedKind: 'completed_hand' | 'mid_hand_spot';
    readonly tags: readonly ('review_later' | 'unsure' | 'study')[];
    readonly createdAt: string;
  },
): SavedHandRecord {
  const preset = TABLE_PRESETS.six_max_100bb;
  const initialState = createInitialDealtHandState(engine, {
    handId: options.handId,
    seatCount: preset.defaultSeatCount,
    startingStackBb: preset.startingStackBb,
    heroSeatIndex: 3, // BTN
    heroCards: options.heroCards,
  });
  const compiled = compileShorthandTokensToState(
    engine,
    initialState,
    tokenizeActionShorthandLine(options.shorthandLine),
  );
  if (!compiled.ok) {
    throw new Error(`Invalid home preset hand shorthand: ${compiled.message}`);
  }
  const basePayload = buildSavedHandPayloadFromCompiled({
    handId: options.handId,
    tablePreset: 'six_max_100bb',
    unitLabel: preset.unitLabel,
    seatCount: preset.defaultSeatCount,
    startingStackBb: preset.startingStackBb,
    heroSeatIndex: 3,
    heroCards: options.heroCards,
    shorthandLine: options.shorthandLine,
    compiled,
  });
  const payload = {
    ...basePayload,
    savedKind: options.savedKind,
    tags: options.tags,
  };
  return {
    objectId: options.objectId,
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
    archived: false,
    factTitle: buildSavedHandFactTitle(payload),
    tags: options.tags,
    payload,
  };
}

function buildPresetNight(createdAt: string, settled: boolean): NightSessionRecord {
  const ils = HOME_GAME_CURRENCY_PRESETS.ils;
  const participants: HomeGameParticipant[] = [
    { playerId: 'hp-eli', displayName: 'Eli', seatNumber: 1, status: 'cashed_out' },
    { playerId: 'hp-dan', displayName: 'Dan', seatNumber: 2, status: 'cashed_out' },
    { playerId: 'hp-noa', displayName: 'Noa', seatNumber: 3, status: 'cashed_out' },
    { playerId: 'hp-yoav', displayName: 'Yoav', seatNumber: 4, status: 'cashed_out' },
    { playerId: 'hp-maya', displayName: 'Maya', seatNumber: 5, status: 'cashed_out' },
  ];
  const txs: HomeGameTransaction[] = [
    { transactionId: 'hpt-1', sessionId: 'home-friday', playerId: 'hp-eli', type: 'buy_in', amountMinor: 20_000, createdAt, note: null, correctionOfTransactionId: null, replacementOfTransactionId: null },
    { transactionId: 'hpt-2', sessionId: 'home-friday', playerId: 'hp-dan', type: 'buy_in', amountMinor: 20_000, createdAt, note: null, correctionOfTransactionId: null, replacementOfTransactionId: null },
    { transactionId: 'hpt-3', sessionId: 'home-friday', playerId: 'hp-noa', type: 'buy_in', amountMinor: 20_000, createdAt, note: null, correctionOfTransactionId: null, replacementOfTransactionId: null },
    { transactionId: 'hpt-4', sessionId: 'home-friday', playerId: 'hp-yoav', type: 'buy_in', amountMinor: 20_000, createdAt, note: null, correctionOfTransactionId: null, replacementOfTransactionId: null },
    { transactionId: 'hpt-5', sessionId: 'home-friday', playerId: 'hp-maya', type: 'buy_in', amountMinor: 20_000, createdAt, note: null, correctionOfTransactionId: null, replacementOfTransactionId: null },
    { transactionId: 'hpt-6', sessionId: 'home-friday', playerId: 'hp-eli', type: 'cash_out', amountMinor: 34_000, createdAt, note: null, correctionOfTransactionId: null, replacementOfTransactionId: null },
    { transactionId: 'hpt-7', sessionId: 'home-friday', playerId: 'hp-dan', type: 'cash_out', amountMinor: 26_000, createdAt, note: null, correctionOfTransactionId: null, replacementOfTransactionId: null },
    { transactionId: 'hpt-8', sessionId: 'home-friday', playerId: 'hp-noa', type: 'cash_out', amountMinor: 15_000, createdAt, note: null, correctionOfTransactionId: null, replacementOfTransactionId: null },
    { transactionId: 'hpt-9', sessionId: 'home-friday', playerId: 'hp-yoav', type: 'cash_out', amountMinor: 15_000, createdAt, note: null, correctionOfTransactionId: null, replacementOfTransactionId: null },
    { transactionId: 'hpt-10', sessionId: 'home-friday', playerId: 'hp-maya', type: 'cash_out', amountMinor: 10_000, createdAt, note: null, correctionOfTransactionId: null, replacementOfTransactionId: null },
  ];
  return {
    session: {
      sessionId: 'home-friday',
      title: "Friday at Dan's",
      createdAt,
      updatedAt: createdAt,
      settledAt: settled ? createdAt : null,
      status: settled ? 'completed' : 'active',
      currency: ils,
      participants,
      archived: false,
      revision: settled ? 2 : 1,
      lifecycleEvents: settled
        ? [
            { type: 'created', at: createdAt, revision: 1 },
            { type: 'settled', at: createdAt, revision: 2 },
          ]
        : [{ type: 'created', at: createdAt, revision: 1 }],
    },
    transactions: txs,
    linkedHands: [
      {
        handObjectId: 'home-preset-friday-hand',
        linkedAt: createdAt,
        shorthandSummary: 'btn r2.5 sb f bb c / Qh 7c 2h',
      },
    ],
  };
}

export function createHomeStore(options: HomeStoreOptions = {}): HomeStore {
  const engine = options.engine ?? getSharedEngineClient();
  const repository = options.repository ?? getDefaultStudyRepository();
  const nowFn = options.nowFn ?? (() => Date.now());

  const loadingSignal = signal<boolean>(false);
  const isEphemeralPresetSignal = signal<boolean>(false);
  const savedHandsSignal = signal<readonly SavedHandRecord[]>([]);
  const savedMatchupsSignal = signal<readonly SavedMatchupRecord[]>([]);
  const evidenceSignal = signal<readonly StrategyEvidenceEntry[]>([]);
  const trainingSessionsSignal = signal<readonly TrainingSessionPayload[]>([]);
  const nightsSignal = signal<readonly NightSessionRecord[]>([]);
  const learnProgressSignal = signal<LearnProgressSnapshot>({
    understoodById: {},
    trainerAttempts: [],
  });
  const sectionErrorsSignal = signal<HomeSectionErrors>({
    hands: false,
    matchups: false,
    evidence: false,
    training: false,
    nights: false,
    learn: false,
  });
  const selectedLeakCellKeySignal = signal<string | null>(null);

  const greetingBucketSignal = computed<HomeGreetingBucket>(() => {
    const hour = new Date(nowFn()).getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'evening';
  });

  const visitStateSignal = computed<HomeVisitState>(() => {
    const hasHands = savedHandsSignal.value.some((h) => !h.archived);
    const hasMatchups = savedMatchupsSignal.value.length > 0;
    const hasEvidence = evidenceSignal.value.some((e) => !e.retracted);
    const hasTraining = trainingSessionsSignal.value.length > 0;
    const hasNights = nightsSignal.value.some((n) => !n.session.archived);
    const learn = learnProgressSignal.value;
    const hasLearn =
      Object.values(learn.understoodById).some(Boolean) || learn.trainerAttempts.length > 0;
    return hasHands || hasMatchups || hasEvidence || hasTraining || hasNights || hasLearn
      ? 'returning'
      : 'first_visit';
  });

  const weeklySummarySignal = computed<WeeklyStudySummary>(() =>
    computeWeeklyStudySummary({
      trainingSessions: trainingSessionsSignal.value,
      savedHands: savedHandsSignal.value,
      learnAttempts: learnProgressSignal.value.trainerAttempts,
      nowMs: nowFn(),
    }),
  );

  const studyMomentumSignal = computed<StudyMomentumSummary>(() =>
    computeStudyMomentum({
      trainingSessions: trainingSessionsSignal.value,
      savedHands: savedHandsSignal.value,
      savedMatchups: savedMatchupsSignal.value,
      learnProgress: learnProgressSignal.value,
      dailyGoal: dailyStudyGoalSignal.value,
      nowMs: nowFn(),
    }),
  );

  const leakMapSignal = computed<StrategyLeakMapProjection>(() =>
    unwrap(engine.sync.projectStrategyLeakMap(6, 100, evidenceSignal.value)),
  );

  const spotMapSignal = computed<StrategySpotMapProjection>(() =>
    unwrap(engine.sync.projectStrategySpotMap(6, 100, evidenceSignal.value)),
  );

  const topLeakSignal = computed<HomeTopLeakSummary | null>(() => {
    const map = leakMapSignal.value;
    const samplesByPos = new Map<string, number>();
    for (const footer of map.columnFooters) {
      samplesByPos.set(footer.position, footer.sampleHands);
    }

    let best: HomeTopLeakSummary | null = null;
    for (const row of map.rows) {
      for (const cell of row.cells) {
        if (!cell.available || cell.deltaPoints === null || cell.deltaPoints === 0) continue;
        const sampleHands = samplesByPos.get(cell.position) ?? 0;
        // Unknown is never fold: skip positions with zero recorded evidence.
        if (sampleHands === 0) continue;
        const candidate: HomeTopLeakSummary = {
          key: `${cell.familyId}|${cell.position}`,
          position: cell.position,
          familyId: cell.familyId,
          deltaPoints: cell.deltaPoints,
          sampleHands,
          isWatching: sampleHands < HOME_EVIDENCE_WATCH_THRESHOLD,
          tier: map.tier,
        };
        if (
          !best ||
          Math.abs(candidate.deltaPoints) > Math.abs(best.deltaPoints) ||
          (Math.abs(candidate.deltaPoints) === Math.abs(best.deltaPoints) &&
            candidate.sampleHands > best.sampleHands)
        ) {
          best = candidate;
        }
      }
    }
    return best;
  });

  const nightCardSignal = computed<HomeNightCardSummary | null>(() => {
    const activeOrRecent = nightsSignal.value.filter((n) => !n.session.archived);
    if (activeOrRecent.length === 0) return null;

    const sorted = [...activeOrRecent].sort((a, b) => {
      if (a.session.status !== b.session.status) {
        return a.session.status === 'active' ? -1 : 1;
      }
      return b.session.updatedAt.localeCompare(a.session.updatedAt);
    });
    const chosen = sorted[0]!;
    const summary = unwrap(
      engine.sync.buildHomeGameMorningSummary(chosen.session, chosen.transactions),
    );
    const totalInDisplay = unwrap(
      engine.sync.formatHomeGameAmount(summary.totalInMinor, summary.currency),
    );
    let topNetDisplay: string | null = null;
    let topNetPlayerName: string | null = null;
    if (summary.largestWinner && summary.largestWinner.netMinor > 0) {
      topNetPlayerName = summary.largestWinner.displayName;
      topNetDisplay = unwrap(
        engine.sync.formatHomeGameAmount(summary.largestWinner.netMinor, summary.currency, {
          signed: true,
        }),
      );
    }
    return {
      sessionId: chosen.session.sessionId,
      title: chosen.session.title,
      status: chosen.session.status === 'active' ? 'active' : 'settled',
      playerCount: chosen.session.participants.length,
      linkedHandsCount: chosen.linkedHands.length,
      firstLinkedHandId: chosen.linkedHands[0]?.handObjectId ?? null,
      totalInDisplay,
      topNetDisplay,
      topNetPlayerName,
      morningSummary: summary,
    };
  });

  const nextStepsSignal = computed<readonly HomeNextStepItem[]>(() => {
    if (visitStateSignal.value === 'first_visit') {
      return [];
    }

    const raw: Omit<HomeNextStepItem, 'rank' | 'primary'>[] = [];
    const activeNight = nightsSignal.value.find(
      (n) => !n.session.archived && n.session.status === 'active',
    );
    const hands = savedHandsSignal.value.filter((h) => !h.archived);
    const midHandSpot = hands.find((h) => h.payload.savedKind === 'mid_hand_spot');
    const spotMap = spotMapSignal.value;
    const firstInProgress =
      spotMap.rows.flatMap((r) => r.cells).find((c) => c.state === 'in_progress') ?? null;

    // 1. Where you left off
    if (activeNight) {
      raw.push({
        id: `night:${activeNight.session.sessionId}`,
        kind: 'continue_night',
        action: {
          kind: 'continue_night',
          sessionId: activeNight.session.sessionId,
          tab: 'ledger',
        },
        titleText: activeNight.session.title,
        playerCount: activeNight.session.participants.length,
      });
    } else if (midHandSpot) {
      raw.push({
        id: `spot:${midHandSpot.objectId}`,
        kind: 'finish_spot',
        action: { kind: 'finish_spot', handObjectId: midHandSpot.objectId },
        titleText: midHandSpot.factTitle,
      });
    } else if (firstInProgress) {
      raw.push({
        id: `plan:${firstInProgress.rowId}:${firstInProgress.position}`,
        kind: 'finish_plan',
        action: {
          kind: 'finish_plan',
          rowId: firstInProgress.rowId,
          position: firstInProgress.position,
        },
        position: firstInProgress.position,
      });
    }

    // 2. Top strategy leak -> targeted Leak Lab drill
    const topLeak = topLeakSignal.value;
    if (topLeak) {
      raw.push({
        id: `leak:${topLeak.key}`,
        kind: 'drill_leak',
        action: {
          kind: 'drill_leak',
          position: topLeak.position,
          familyId: topLeak.familyId,
          deltaPoints: topLeak.deltaPoints,
        },
        position: topLeak.position,
        familyId: topLeak.familyId,
        deltaPoints: topLeak.deltaPoints,
        sampleCount: topLeak.sampleHands,
        isWatching: topLeak.isWatching,
      });
    }

    // 3. Hand worth reviewing
    const reviewCandidate =
      hands.find((h) => h.tags.includes('review_later') || h.tags.includes('unsure')) ??
      hands.find((h) => h.payload.savedKind === 'completed_hand') ??
      null;
    if (reviewCandidate && !raw.some((item) => item.id === `spot:${reviewCandidate.objectId}`)) {
      raw.push({
        id: `review:${reviewCandidate.objectId}`,
        kind: 'review_hand',
        action: { kind: 'review_hand', handObjectId: reviewCandidate.objectId },
        titleText: reviewCandidate.factTitle,
      });
    }

    // 4. Plan in progress (if not already step 1)
    if (raw.length < 3 && firstInProgress) {
      const planId = `plan:${firstInProgress.rowId}:${firstInProgress.position}`;
      if (!raw.some((item) => item.id === planId)) {
        raw.push({
          id: planId,
          kind: 'finish_plan',
          action: {
            kind: 'finish_plan',
            rowId: firstInProgress.rowId,
            position: firstInProgress.position,
          },
          position: firstInProgress.position,
        });
      }
    }

    // 5. Fallback quick drill if fewer than 3 steps
    if (raw.length < 3) {
      raw.push({
        id: 'drill:quick',
        kind: 'quick_drill',
        action: { kind: 'quick_drill' },
      });
    }

    return raw.slice(0, 3).map((item, idx) => ({
      ...item,
      rank: (idx + 1) as 1 | 2 | 3,
      primary: idx === 0,
    }));
  });

  const offersSignal = computed<readonly HomeOfferItem[]>(() => {
    const offers: HomeOfferItem[] = [];
    const spotMap = spotMapSignal.value;
    const hands = savedHandsSignal.value.filter((h) => !h.archived);
    const matchups = savedMatchupsSignal.value;
    const sessions = trainingSessionsSignal.value;

    const threeBetSpots = spotMap.rows
      .filter((r) => r.rowId === 'facing_3bet' || r.rowId === 'facing_late_open')
      .flatMap((r) => r.cells)
      .filter((c) => c.state === 'not_asked');

    if (threeBetSpots.length > 0) {
      const target = threeBetSpots[0]!;
      offers.push({
        id: 'offer:map_3bet',
        kind: 'map_3bet',
        action: { kind: 'finish_plan', rowId: target.rowId, position: target.position },
        unansweredSpotsCount: threeBetSpots.length,
      });
    }

    const duelCount = sessions.filter((s) => s.mode === 'heads_up_duel').length;
    if (duelCount < 2) {
      offers.push({
        id: 'offer:duel_astra',
        kind: 'duel_astra',
        action: { kind: 'quick_drill' },
        duelSessionsCount: duelCount,
      });
    }

    if (matchups.length > 0) {
      const latest = matchups[0]!;
      offers.push({
        id: 'offer:reopen_matchup',
        kind: 'reopen_matchup',
        action: { kind: 'open_equity', matchupId: latest.objectId },
        matchupTitle: latest.factTitle,
      });
    } else if (hands.length > 0) {
      offers.push({
        id: 'offer:explore_equity',
        kind: 'explore_equity',
        action: { kind: 'open_equity' },
      });
    } else {
      offers.push({
        id: 'offer:record_hand',
        kind: 'record_hand',
        action: { kind: 'record_hand' },
      });
    }

    if (offers.length < 3) {
      const understoodCount = LEARN_CONCEPT_IDS.filter(
        (id) => learnProgressSignal.value.understoodById[id],
      ).length;
      if (understoodCount < LEARN_CONCEPT_IDS.length) {
        offers.push({
          id: 'offer:learn_concept',
          kind: 'learn_concept',
          action: { kind: 'open_learn' },
        });
      }
    }

    return offers.slice(0, 3);
  });

  let inFlightHydrate: Promise<void> | null = null;

  async function hydrate(): Promise<void> {
    if (isEphemeralPresetSignal.value) return;
    if (inFlightHydrate) return inFlightHydrate;

    inFlightHydrate = (async () => {
      loadingSignal.value = true;
      try {
        const [handsRes, matchupsRes, evidenceRes, trainingRes, nightsRes, learnRes] =
          await Promise.allSettled([
            repository.listSavedHands({ includeArchived: false }),
            repository.listSavedMatchups(),
            repository.listStrategyEvidence(),
            repository.listTrainingSessions(),
            repository.listNightSessions({ includeArchived: false }),
            repository.getLearnProgress(),
          ]);

        sectionErrorsSignal.value = {
          hands: handsRes.status === 'rejected',
          matchups: matchupsRes.status === 'rejected',
          evidence: evidenceRes.status === 'rejected',
          training: trainingRes.status === 'rejected',
          nights: nightsRes.status === 'rejected',
          learn: learnRes.status === 'rejected',
        };

        if (handsRes.status === 'fulfilled') savedHandsSignal.value = handsRes.value;
        if (matchupsRes.status === 'fulfilled') savedMatchupsSignal.value = matchupsRes.value;
        if (evidenceRes.status === 'fulfilled') evidenceSignal.value = evidenceRes.value;
        if (trainingRes.status === 'fulfilled') trainingSessionsSignal.value = trainingRes.value;
        if (nightsRes.status === 'fulfilled') nightsSignal.value = nightsRes.value;
        if (learnRes.status === 'fulfilled') learnProgressSignal.value = learnRes.value;
      } finally {
        loadingSignal.value = false;
        inFlightHydrate = null;
      }
    })();

    return inFlightHydrate;
  }

  function applyPreset(preset: HomePresetId): void {
    isEphemeralPresetSignal.value = true;
    loadingSignal.value = false;
    sectionErrorsSignal.value = {
      hands: false,
      matchups: false,
      evidence: false,
      training: false,
      nights: false,
      learn: false,
    };

    const baseNow = nowFn();
    const iso = (daysAgo: number) => new Date(baseNow - daysAgo * ONE_DAY_MS).toISOString();

    if (preset === 'first_visit') {
      savedHandsSignal.value = [];
      savedMatchupsSignal.value = [];
      evidenceSignal.value = [];
      trainingSessionsSignal.value = [];
      nightsSignal.value = [];
      learnProgressSignal.value = { understoodById: {}, trainerAttempts: [] };
      selectedLeakCellKeySignal.value = null;
      return;
    }

    const fridayHand = buildPresetSavedHand(engine, {
      objectId: 'home-preset-friday-hand',
      handId: 'hp-hand-14',
      shorthandLine: 'btn r2.5 sb f bb c / Qh 7c 2h',
      heroCards: ['Ah', 'Kh'],
      savedKind: 'completed_hand',
      tags: ['review_later'],
      createdAt: iso(1),
    });

    if (preset === 'night_after') {
      savedHandsSignal.value = [fridayHand];
      savedMatchupsSignal.value = [];
      evidenceSignal.value = buildPresetEvidence(iso(1), false);
      trainingSessionsSignal.value = [
        {
          sessionId: 'hp-ts-1',
          mode: 'quick_drill',
          completedAt: iso(1),
          spotsCount: 10,
          planAlignedCount: 7,
          baselineAlignedCount: 8,
        },
      ];
      nightsSignal.value = [buildPresetNight(iso(1), true)];
      learnProgressSignal.value = {
        understoodById: { pot_odds: true },
        trainerAttempts: [
          { mode: 'pot_odds', spotId: 'po-1', firstTryCorrect: true, answeredAt: iso(1) },
        ],
      };
      selectedLeakCellKeySignal.value = null;
      return;
    }

    // 'returning'
    const midSpot = buildPresetSavedHand(engine, {
      objectId: 'home-preset-mid-spot',
      handId: 'hp-hand-spot',
      shorthandLine: 'utg r2.5 hj f co c',
      heroCards: ['Qs', 'Js'],
      savedKind: 'mid_hand_spot',
      tags: ['unsure'],
      createdAt: iso(0),
    });

    savedHandsSignal.value = [midSpot, fridayHand];
    savedMatchupsSignal.value = [
      {
        objectId: 'home-preset-matchup-1',
        createdAt: iso(2),
        factTitle: 'A♦K♦ vs Q♠Q♣ · K♠ 8♥ 4♥',
        payload: {
          schemaVersion: 1,
          factTitle: 'A♦K♦ vs Q♠Q♣ · K♠ 8♥ 4♥',
          board: ['Ks', '8h', '4h'],
          street: 'flop',
          players: [
            { id: 'p1', label: 'Hero', isHero: true, rawInput: 'AdKd', inputKind: 'exact' },
            { id: 'p2', label: 'Villain', isHero: false, rawInput: 'QsQc', inputKind: 'exact' },
          ],
        },
      },
    ];
    evidenceSignal.value = buildPresetEvidence(iso(0), true);
    trainingSessionsSignal.value = [
      {
        sessionId: 'hp-ts-1',
        mode: 'quick_drill',
        completedAt: iso(5),
        spotsCount: 10,
        planAlignedCount: 7,
        baselineAlignedCount: 8,
      },
      {
        sessionId: 'hp-ts-2',
        mode: 'quick_drill',
        completedAt: iso(3),
        spotsCount: 12,
        planAlignedCount: 9,
        baselineAlignedCount: 10,
      },
      {
        sessionId: 'hp-ts-3',
        mode: 'heads_up_duel',
        completedAt: iso(1),
        spotsCount: 10,
        planAlignedCount: 0,
        baselineAlignedCount: 0,
        netBb: 14.5,
      },
      {
        sessionId: 'hp-ts-4',
        mode: 'quick_drill',
        completedAt: iso(0),
        spotsCount: 8,
        planAlignedCount: 6,
        baselineAlignedCount: 7,
      },
    ];
    nightsSignal.value = [buildPresetNight(iso(1), true)];
    learnProgressSignal.value = {
      understoodById: { pot_odds: true, equity: true },
      trainerAttempts: [
        { mode: 'pot_odds', spotId: 'po-1', firstTryCorrect: true, answeredAt: iso(2) },
        { mode: 'equity_guess', spotId: 'eq-1', firstTryCorrect: true, answeredAt: iso(0) },
      ],
    };
    selectedLeakCellKeySignal.value = null;
  }

  const unsubscribeRepo = repository.subscribe(() => {
    if (!isEphemeralPresetSignal.value) {
      void hydrate().catch(() => {});
    }
  });

  const habitSummarySignal = computed(() =>
    computeHomeHabitSummary(savedHandsSignal.value, trainingSessionsSignal.value),
  );

  return {
    engine,
    repository,
    loadingSignal,
    isEphemeralPresetSignal,
    savedHandsSignal,
    savedMatchupsSignal,
    evidenceSignal,
    trainingSessionsSignal,
    nightsSignal,
    learnProgressSignal,
    sectionErrorsSignal,
    selectedLeakCellKeySignal,
    greetingBucketSignal,
    visitStateSignal,
    weeklySummarySignal,
    studyMomentumSignal,
    leakMapSignal,
    spotMapSignal,
    topLeakSignal,
    nextStepsSignal,
    nightCardSignal,
    offersSignal,
    habitSummarySignal,
    hydrate,
    applyPreset,
    selectLeakCell(cellKey) {
      selectedLeakCellKeySignal.value = cellKey;
    },
    dispose() {
      unsubscribeRepo();
    },
  };
}

let sharedHomeStore: HomeStore | null = null;

export function getSharedHomeStore(): HomeStore {
  if (!sharedHomeStore) {
    sharedHomeStore = createHomeStore();
  }
  return sharedHomeStore;
}

export function resetSharedHomeStore(): void {
  sharedHomeStore?.dispose();
  sharedHomeStore = null;
}
