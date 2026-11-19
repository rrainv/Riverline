import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import {
  getSharedEngineClient,
  HOME_GAME_CURRENCY_PRESETS,
  minorToMajorNumber,
  type EngineClient,
  type HomeGameAccounting,
  type HomeGameLedgerHistoryItem,
  type HomeGameMorningSummary,
  type HomeGameParticipant,
  type HomeGameSettlement,
  type HomeGameSettleReadiness,
  type HomeGameTransaction,
} from '../../engine-api';
import {
  buildSavedHandPayloadFromCompiled,
  compileShorthandTokensToState,
  createInitialDealtHandState,
  TABLE_PRESETS,
} from '../hand';
import {
  tokenizeActionShorthandLine,
  validateActionShorthandToken,
} from '../shorthand';
import {
  getDefaultStudyRepository,
  type NightSessionRecord,
  type SavedHandRecord,
  type StudyRepository,
} from '../storage';
import type {
  CreateNightInput,
  NightsPresetId,
  NightsSheetFocus,
  NightsShorthandPreview,
  NightsStore,
  NightsTabId,
} from './types';

let seqCounter = 0;

function nextId(prefix: string): string {
  seqCounter += 1;
  return `${prefix}-${seqCounter}`;
}

function buildPresetFixture(preset: NightsPresetId): {
  readonly sessions: readonly NightSessionRecord[];
  readonly handsById: Readonly<Record<string, SavedHandRecord>>;
  readonly tab: NightsTabId;
  readonly selectedPlayerId: string | null;
  readonly sheetFocus: NightsSheetFocus;
  readonly handInput: string;
} {
  if (preset === 'empty') {
    return {
      sessions: [],
      handsById: {},
      tab: 'ledger',
      selectedPlayerId: null,
      sheetFocus: null,
      handInput: '',
    };
  }
  const t0 = '2026-11-16T18:40:00.000Z';
  const t1 = '2026-11-16T19:25:00.000Z';
  const t2 = '2026-11-16T20:10:00.000Z';
  const t3 = '2026-11-16T21:45:00.000Z';
  const ils = HOME_GAME_CURRENCY_PRESETS.ils;
  const chips = HOME_GAME_CURRENCY_PRESETS.chips;

  const settledMode = preset === 'settle_ready' || preset === 'morning_after';
  const allCashed = preset === 'settle_ready' || preset === 'morning_after';

  const participants: HomeGameParticipant[] = [
    {
      playerId: 'p-eli',
      displayName: 'Eli',
      seatNumber: 1,
      status: allCashed ? 'cashed_out' : 'active',
    },
    { playerId: 'p-dan', displayName: 'Dan', seatNumber: 2, status: 'cashed_out' },
    { playerId: 'p-noa', displayName: 'Noa', seatNumber: 3, status: 'cashed_out' },
    {
      playerId: 'p-yoav',
      displayName: 'Yoav',
      seatNumber: 4,
      status: allCashed ? 'cashed_out' : 'active',
    },
    { playerId: 'p-maya', displayName: 'Maya', seatNumber: 5, status: 'cashed_out' },
  ];

  const baseTxs: HomeGameTransaction[] = [
    {
      transactionId: 'ptx-1',
      sessionId: 'preset-friday',
      playerId: 'p-eli',
      type: 'buy_in',
      amountMinor: 20_000,
      createdAt: t0,
      note: null,
      correctionOfTransactionId: null,
      replacementOfTransactionId: null,
    },
    {
      transactionId: 'ptx-2',
      sessionId: 'preset-friday',
      playerId: 'p-dan',
      type: 'buy_in',
      amountMinor: 20_000,
      createdAt: t0,
      note: null,
      correctionOfTransactionId: null,
      replacementOfTransactionId: null,
    },
    {
      transactionId: 'ptx-3',
      sessionId: 'preset-friday',
      playerId: 'p-dan',
      type: 'rebuy',
      amountMinor: 10_000,
      createdAt: t1,
      note: null,
      correctionOfTransactionId: null,
      replacementOfTransactionId: null,
    },
    {
      transactionId: 'ptx-4',
      sessionId: 'preset-friday',
      playerId: 'p-dan',
      type: 'rebuy',
      amountMinor: 10_000,
      createdAt: t2,
      note: null,
      correctionOfTransactionId: null,
      replacementOfTransactionId: null,
    },
    {
      transactionId: 'ptx-5',
      sessionId: 'preset-friday',
      playerId: 'p-noa',
      type: 'buy_in',
      amountMinor: 20_000,
      createdAt: t0,
      note: null,
      correctionOfTransactionId: null,
      replacementOfTransactionId: null,
    },
    {
      transactionId: 'ptx-6',
      sessionId: 'preset-friday',
      playerId: 'p-noa',
      type: 'rebuy',
      amountMinor: 20_000,
      createdAt: t1,
      note: null,
      correctionOfTransactionId: null,
      replacementOfTransactionId: null,
    },
    {
      transactionId: 'ptx-7',
      sessionId: 'preset-friday',
      playerId: 'p-yoav',
      type: 'buy_in',
      amountMinor: 20_000,
      createdAt: t0,
      note: null,
      correctionOfTransactionId: null,
      replacementOfTransactionId: null,
    },
    {
      transactionId: 'ptx-8',
      sessionId: 'preset-friday',
      playerId: 'p-maya',
      type: 'buy_in',
      amountMinor: 20_000,
      createdAt: t0,
      note: null,
      correctionOfTransactionId: null,
      replacementOfTransactionId: null,
    },
    {
      transactionId: 'ptx-9',
      sessionId: 'preset-friday',
      playerId: 'p-dan',
      type: 'cash_out',
      amountMinor: 65_000,
      createdAt: t3,
      note: null,
      correctionOfTransactionId: null,
      replacementOfTransactionId: null,
    },
    {
      transactionId: 'ptx-10',
      sessionId: 'preset-friday',
      playerId: 'p-noa',
      type: 'cash_out',
      amountMinor: 10_000,
      createdAt: t3,
      note: null,
      correctionOfTransactionId: null,
      replacementOfTransactionId: null,
    },
    {
      transactionId: 'ptx-11',
      sessionId: 'preset-friday',
      playerId: 'p-maya',
      type: 'cash_out',
      amountMinor: 28_000,
      createdAt: t3,
      note: null,
      correctionOfTransactionId: null,
      replacementOfTransactionId: null,
    },
  ];

  const extraCashOuts: HomeGameTransaction[] = allCashed
    ? [
        {
          transactionId: 'ptx-12',
          sessionId: 'preset-friday',
          playerId: 'p-eli',
          type: 'cash_out',
          amountMinor: 22_000,
          createdAt: t3,
          note: null,
          correctionOfTransactionId: null,
          replacementOfTransactionId: null,
        },
        {
          transactionId: 'ptx-13',
          sessionId: 'preset-friday',
          playerId: 'p-yoav',
          type: 'cash_out',
          amountMinor: 15_000,
          createdAt: t3,
          note: null,
          correctionOfTransactionId: null,
          replacementOfTransactionId: null,
        },
      ]
    : [];

  const engine = getSharedEngineClient();
  const baseHand = createInitialDealtHandState(engine, {
    handId: 'preset-hand-1',
    seatCount: 6,
    startingStackBb: 50,
    heroSeatIndex: 0,
    heroCards: ['Ah', 'Kh'],
  });
  const compiled = compileShorthandTokensToState(
    engine,
    baseHand,
    tokenizeActionShorthandLine('btn r12 sb f bb c / Qh 7c 2h'),
  );
  const samplePayload = compiled.ok
    ? buildSavedHandPayloadFromCompiled({
        handId: 'preset-hand-1',
        tablePreset: 'home_game_50bb',
        unitLabel: '₪',
        seatCount: 6,
        startingStackBb: 50,
        heroSeatIndex: 0,
        heroCards: ['Ah', 'Kh'],
        shorthandLine: 'BTN r12 f c / Qh 7c 2h',
        compiled,
      })
    : null;

  const handsById: Record<string, SavedHandRecord> = samplePayload
    ? {
        'preset-hand-1': {
          objectId: 'preset-hand-1',
          createdAt: t2,
          updatedAt: t2,
          archived: false,
          factTitle: 'BTN A♥ K♥ · Q♥ 7♣ 2♥ · ₪25.5',
          tags: [],
          payload: samplePayload,
        },
      }
    : {};

  const fridayNight: NightSessionRecord = {
    session: {
      sessionId: 'preset-friday',
      title: "Friday at Dan's",
      status: preset === 'morning_after' ? 'completed' : 'active',
      currency: ils,
      participants,
      createdAt: t0,
      updatedAt: t3,
      settledAt: preset === 'morning_after' ? t3 : null,
      archived: false,
      revision: settledMode ? 4 : 2,
      lifecycleEvents: [
        { type: 'created', at: t0, revision: 1 },
        ...(preset === 'morning_after'
          ? [{ type: 'settled' as const, at: t3, revision: 4 }]
          : []),
      ],
    },
    transactions: [...baseTxs, ...extraCashOuts],
    linkedHands: samplePayload
      ? [
          {
            handObjectId: 'preset-hand-1',
            linkedAt: t2,
            shorthandSummary: 'BTN r12 f c / Qh 7c 2h',
          },
        ]
      : [],
  };

  const tuesdayChips: NightSessionRecord = {
    session: {
      sessionId: 'preset-tuesday',
      title: 'Tuesday points',
      status: 'completed',
      currency: chips,
      participants: [
        { playerId: 'tp-1', displayName: 'Eli', seatNumber: 1, status: 'cashed_out' },
        { playerId: 'tp-2', displayName: 'Dan', seatNumber: 2, status: 'cashed_out' },
      ],
      createdAt: '2026-11-10T19:00:00.000Z',
      updatedAt: '2026-11-10T22:00:00.000Z',
      settledAt: '2026-11-10T22:00:00.000Z',
      archived: false,
      revision: 2,
      lifecycleEvents: [
        { type: 'created', at: '2026-11-10T19:00:00.000Z', revision: 1 },
        { type: 'settled', at: '2026-11-10T22:00:00.000Z', revision: 2 },
      ],
    },
    transactions: [
      {
        transactionId: 'ttx-1',
        sessionId: 'preset-tuesday',
        playerId: 'tp-1',
        type: 'buy_in',
        amountMinor: 200,
        createdAt: '2026-11-10T19:00:00.000Z',
        note: null,
        correctionOfTransactionId: null,
        replacementOfTransactionId: null,
      },
      {
        transactionId: 'ttx-2',
        sessionId: 'preset-tuesday',
        playerId: 'tp-2',
        type: 'buy_in',
        amountMinor: 200,
        createdAt: '2026-11-10T19:00:00.000Z',
        note: null,
        correctionOfTransactionId: null,
        replacementOfTransactionId: null,
      },
      {
        transactionId: 'ttx-3',
        sessionId: 'preset-tuesday',
        playerId: 'tp-1',
        type: 'cash_out',
        amountMinor: 260,
        createdAt: '2026-11-10T22:00:00.000Z',
        note: null,
        correctionOfTransactionId: null,
        replacementOfTransactionId: null,
      },
      {
        transactionId: 'ttx-4',
        sessionId: 'preset-tuesday',
        playerId: 'tp-2',
        type: 'cash_out',
        amountMinor: 140,
        createdAt: '2026-11-10T22:00:00.000Z',
        note: null,
        correctionOfTransactionId: null,
        replacementOfTransactionId: null,
      },
    ],
    linkedHands: [],
  };

  const tab: NightsTabId =
    preset === 'hands'
      ? 'hands'
      : preset === 'settle_blocked' || preset === 'settle_ready' || preset === 'morning_after'
        ? 'settle'
        : 'ledger';

  return {
    sessions: [fridayNight, tuesdayChips],
    handsById,
    tab,
    selectedPlayerId: preset === 'sheet' ? 'p-eli' : null,
    sheetFocus: preset === 'sheet' ? 'rebuy' : null,
    handInput: preset === 'hands' ? 'btn r12 sb f bb c / Qh 7c 2h' : '',
  };
}

export interface CreateNightsStoreOptions {
  readonly engine?: EngineClient;
  readonly repository?: StudyRepository;
  readonly initialPreset?: NightsPresetId;
}

export function createNightsStore(options: CreateNightsStoreOptions = {}): NightsStore {
  const engine = options.engine ?? getSharedEngineClient();
  const repository = options.repository ?? getDefaultStudyRepository();

  const sessionsSignal: Signal<readonly NightSessionRecord[]> = signal([]);
  const savedHandsByIdSignal: Signal<Readonly<Record<string, SavedHandRecord>>> = signal({});
  const activeNightIdSignal: Signal<string | null> = signal(null);
  const activeTabSignal: Signal<NightsTabId> = signal('ledger');
  const selectedPlayerIdSignal: Signal<string | null> = signal(null);
  const sheetFocusSignal: Signal<NightsSheetFocus> = signal(null);
  const rebuyDraftMajorSignal: Signal<number> = signal(100);
  const cashOutDraftTextSignal: Signal<string> = signal('0');
  const handShorthandInputSignal: Signal<string> = signal('');
  const handHeroCardsSignal: Signal<readonly [string, string]> = signal(['As', 'Kd']);
  const errorMessageSignal: Signal<string | null> = signal(null);
  const toastMessageSignal: Signal<string | null> = signal(null);
  const showArchivedSignal: Signal<boolean> = signal(false);
  const createModalOpenSignal: Signal<boolean> = signal(false);
  const isEphemeralPresetSignal: Signal<boolean> = signal(false);

  const activeNightSignal: ReadonlySignal<NightSessionRecord | null> = computed(() => {
    const list = sessionsSignal.value;
    const id = activeNightIdSignal.value;
    if (list.length === 0) return null;
    if (id) {
      const found = list.find((s) => s.session.sessionId === id);
      if (found) return found;
    }
    return list.find((s) => !s.session.archived) ?? list[0] ?? null;
  });

  const activeAccountingSignal: ReadonlySignal<HomeGameAccounting | null> = computed(() => {
    const night = activeNightSignal.value;
    if (!night) return null;
    const res = engine.sync.calculateHomeGameAccounting(night.session, night.transactions);
    return res.ok ? res.data : null;
  });

  const settleReadinessSignal: ReadonlySignal<HomeGameSettleReadiness | null> = computed(() => {
    const night = activeNightSignal.value;
    if (!night) return null;
    const res = engine.sync.validateHomeGameSessionReadyToSettle(
      night.session,
      night.transactions,
    );
    return res.ok ? res.data : null;
  });

  const settlementSignal: ReadonlySignal<HomeGameSettlement | null> = computed(() => {
    const night = activeNightSignal.value;
    const readiness = settleReadinessSignal.value;
    if (!night || !readiness) return null;
    if (!readiness.accounting.readyToSettle) return null;
    const res = engine.sync.calculateFewestTransfersSettlement(night.session, night.transactions);
    return res.ok ? res.data : null;
  });

  const ledgerHistorySignal: ReadonlySignal<readonly HomeGameLedgerHistoryItem[]> = computed(() => {
    const night = activeNightSignal.value;
    if (!night) return [];
    const res = engine.sync.createHomeGameLedgerHistory(night.session, night.transactions);
    return res.ok ? res.data : [];
  });

  const morningSummarySignal: ReadonlySignal<HomeGameMorningSummary | null> = computed(() => {
    const night = activeNightSignal.value;
    if (!night) return null;
    const res = engine.sync.buildHomeGameMorningSummary(night.session, night.transactions);
    return res.ok ? res.data : null;
  });

  const remainingOnTableMinorSignal: ReadonlySignal<number | null> = computed(() => {
    const acc = activeAccountingSignal.value;
    if (!acc) return null;
    return acc.totalInMinor - acc.totalOutMinor;
  });

  const shorthandPreviewSignal: ReadonlySignal<NightsShorthandPreview> = computed(() => {
    const raw = handShorthandInputSignal.value;
    const tokens = tokenizeActionShorthandLine(raw);
    if (tokens.length === 0) {
      return {
        tokens: [],
        valid: false,
        actionCount: 0,
        boardCardCount: 0,
        errorToken: null,
      };
    }

    const chipStates = tokens.map((tok) => ({
      text: tok,
      valid: validateActionShorthandToken(tok).valid,
    }));
    const firstBad = chipStates.find((c) => !c.valid);
    if (firstBad) {
      return {
        tokens: chipStates,
        valid: false,
        actionCount: 0,
        boardCardCount: 0,
        errorToken: firstBad.text,
      };
    }

    const night = activeNightSignal.value;
    const startingStackBb =
      night?.session.currency.unitPreset === 'ils'
        ? TABLE_PRESETS.home_game_50bb.startingStackBb
        : TABLE_PRESETS.six_max_100bb.startingStackBb;

    const baseState = createInitialDealtHandState(engine, {
      handId: 'preview-night-hand',
      seatCount: 6,
      startingStackBb,
      heroSeatIndex: 0,
      heroCards: handHeroCardsSignal.value,
    });
    const compiled = compileShorthandTokensToState(engine, baseState, tokens);
    if (!compiled.ok) {
      return {
        tokens: chipStates.map((c) =>
          c.text === compiled.failedToken ? { text: c.text, valid: false } : c,
        ),
        valid: false,
        actionCount: 0,
        boardCardCount: 0,
        errorToken: compiled.failedToken || compiled.message,
      };
    }

    return {
      tokens: chipStates,
      valid: compiled.actionCount > 0,
      actionCount: compiled.actionCount,
      boardCardCount: compiled.boardCardCount,
      errorToken: null,
    };
  });

  const recentPlayerNamesSignal: ReadonlySignal<readonly string[]> = computed(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const s of sessionsSignal.value) {
      for (const p of s.session.participants) {
        const key = p.displayName.trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          names.push(key);
        }
      }
    }
    return names;
  });

  async function refreshFromRepository(preferredNightId?: string): Promise<void> {
    const [nights, hands] = await Promise.all([
      repository.listNightSessions({ includeArchived: true }),
      repository.listSavedHands({ includeArchived: true }),
    ]);
    const handMap: Record<string, SavedHandRecord> = {};
    for (const h of hands) {
      handMap[h.objectId] = h;
    }
    savedHandsByIdSignal.value = handMap;
    sessionsSignal.value = nights;
    isEphemeralPresetSignal.value = false;
    if (preferredNightId) {
      activeNightIdSignal.value = preferredNightId;
    } else if (
      !activeNightIdSignal.value ||
      !nights.some((n) => n.session.sessionId === activeNightIdSignal.value)
    ) {
      activeNightIdSignal.value =
        nights.find((n) => !n.session.archived)?.session.sessionId ??
        nights[0]?.session.sessionId ??
        null;
    }
  }

  let inFlightHydrate: Promise<void> | null = null;

  async function hydrate(): Promise<void> {
    if (isEphemeralPresetSignal.value) return;
    if (inFlightHydrate) return inFlightHydrate;
    inFlightHydrate = refreshFromRepository().finally(() => {
      inFlightHydrate = null;
    });
    return inFlightHydrate;
  }

  function selectNight(sessionId: string): void {
    activeNightIdSignal.value = sessionId;
    selectedPlayerIdSignal.value = null;
    errorMessageSignal.value = null;
  }

  function setActiveTab(tab: NightsTabId): void {
    activeTabSignal.value = tab;
    errorMessageSignal.value = null;
  }

  function setCreateModalOpen(open: boolean): void {
    createModalOpenSignal.value = open;
    errorMessageSignal.value = null;
  }

  function openPlayerSheet(playerId: string, focus: NightsSheetFocus = null): void {
    const night = activeNightSignal.value;
    const acc = activeAccountingSignal.value;
    if (!night || !acc) return;
    const currency = night.session.currency;
    const result = acc.participantResults.find((r) => r.playerId === playerId);
    if (!result) return;

    selectedPlayerIdSignal.value = playerId;
    sheetFocusSignal.value = focus;
    errorMessageSignal.value = null;

    const defaultStepMajor = minorToMajorNumber(currency.stepMinor, currency.minorUnit);
    rebuyDraftMajorSignal.value = defaultStepMajor * 2;

    if (result.status === 'cashed_out') {
      const cashMajor = minorToMajorNumber(result.totalOutMinor, currency.minorUnit);
      cashOutDraftTextSignal.value = String(cashMajor);
    } else if (
      acc.pendingPlayerIds.length === 1 &&
      acc.pendingPlayerIds[0] === playerId &&
      acc.totalInMinor >= acc.totalOutMinor
    ) {
      const remMajor = minorToMajorNumber(
        acc.totalInMinor - acc.totalOutMinor,
        currency.minorUnit,
      );
      cashOutDraftTextSignal.value = String(remMajor);
    } else {
      cashOutDraftTextSignal.value = '0';
    }
  }

  function closePlayerSheet(): void {
    selectedPlayerIdSignal.value = null;
    sheetFocusSignal.value = null;
    errorMessageSignal.value = null;
  }

  function setRebuyDraftMajor(amountMajor: number): void {
    rebuyDraftMajorSignal.value = amountMajor;
  }

  function setCashOutDraftText(text: string): void {
    cashOutDraftTextSignal.value = text;
    errorMessageSignal.value = null;
  }

  function stepCashOutDraft(deltaMajor: number): void {
    const night = activeNightSignal.value;
    if (!night) return;
    const currency = night.session.currency;
    const parsed = engine.sync.parseHomeGameAmount(
      cashOutDraftTextSignal.value.trim() || '0',
      currency.minorUnit,
    );
    const currentMajor = parsed.ok ? minorToMajorNumber(parsed.data, currency.minorUnit) : 0;
    const nextMajor = Math.max(0, Math.round((currentMajor + deltaMajor) * 100) / 100);
    cashOutDraftTextSignal.value = String(nextMajor);
    errorMessageSignal.value = null;
  }

  function fillRemainingCashOut(): void {
    const night = activeNightSignal.value;
    const remMinor = remainingOnTableMinorSignal.value;
    if (!night || remMinor === null) return;
    const remMajor = minorToMajorNumber(Math.max(0, remMinor), night.session.currency.minorUnit);
    cashOutDraftTextSignal.value = String(remMajor);
    errorMessageSignal.value = null;
  }

  async function createNight(input: CreateNightInput): Promise<NightSessionRecord | null> {
    errorMessageSignal.value = null;
    const trimmedTitle = input.title.trim();
    if (!trimmedTitle) {
      errorMessageSignal.value = 'Title is required';
      return null;
    }

    const currency = HOME_GAME_CURRENCY_PRESETS[input.unitPreset];
    const validPlayers = input.players
      .map((p) => ({
        displayName: p.displayName.trim(),
        initialBuyInInput: p.initialBuyInInput.trim(),
      }))
      .filter((p) => p.displayName.length > 0);

    if (validPlayers.length < 2) {
      errorMessageSignal.value = 'At least two players are required';
      return null;
    }

    const parsedBuyIns: number[] = [];
    for (const p of validPlayers) {
      const rawAmt = p.initialBuyInInput || String(minorToMajorNumber(currency.defaultBuyInMinor, currency.minorUnit));
      const parsed = engine.sync.parseHomeGameAmount(rawAmt, currency.minorUnit);
      if (!parsed.ok || parsed.data < 0) {
        errorMessageSignal.value = parsed.ok ? 'Buy-in cannot be negative' : parsed.error.message;
        return null;
      }
      parsedBuyIns.push(parsed.data);
    }

    const participants: HomeGameParticipant[] = validPlayers.map((p, idx) => ({
      playerId: nextId('player'),
      displayName: p.displayName,
      seatNumber: idx + 1,
      status: 'active',
    }));

    const created = await repository.createNightSession({
      title: trimmedTitle,
      currency,
      participants,
    });

    for (let i = 0; i < participants.length; i += 1) {
      const amountMinor = parsedBuyIns[i]!;
      if (amountMinor > 0) {
        await repository.appendNightTransaction({
          sessionId: created.session.sessionId,
          playerId: participants[i]!.playerId,
          type: 'buy_in',
          amountMinor,
        });
      }
    }

    createModalOpenSignal.value = false;
    activeTabSignal.value = 'ledger';
    selectedPlayerIdSignal.value = null;
    await refreshFromRepository(created.session.sessionId);
    return activeNightSignal.value;
  }

  async function addPlayer(displayName: string, initialBuyInInput?: string): Promise<boolean> {
    const night = activeNightSignal.value;
    if (!night) return false;
    if (night.session.status === 'completed') {
      errorMessageSignal.value = 'Reopen the night before adding players';
      return false;
    }
    const cleanName = displayName.trim();
    if (!cleanName) return false;
    const currency = night.session.currency;

    let buyInMinor = 0;
    if (initialBuyInInput && initialBuyInInput.trim()) {
      const parsed = engine.sync.parseHomeGameAmount(initialBuyInInput.trim(), currency.minorUnit);
      if (!parsed.ok || parsed.data < 0) {
        errorMessageSignal.value = parsed.ok ? 'Buy-in cannot be negative' : parsed.error.message;
        return false;
      }
      buyInMinor = parsed.data;
    }

    const newPlayer: HomeGameParticipant = {
      playerId: nextId('player'),
      displayName: cleanName,
      seatNumber: night.session.participants.length + 1,
      status: 'active',
    };
    await repository.updateNightSession(night.session.sessionId, {
      participants: [...night.session.participants, newPlayer],
    });
    if (buyInMinor > 0) {
      await repository.appendNightTransaction({
        sessionId: night.session.sessionId,
        playerId: newPlayer.playerId,
        type: 'buy_in',
        amountMinor: buyInMinor,
      });
    }
    await refreshFromRepository(night.session.sessionId);
    return true;
  }

  async function addRebuy(playerId: string, amountMajor: number): Promise<boolean> {
    const night = activeNightSignal.value;
    if (!night) return false;
    if (night.session.status === 'completed') {
      errorMessageSignal.value = 'Reopen the night before adding a rebuy';
      return false;
    }
    const parsed = engine.sync.parseHomeGameAmount(
      String(amountMajor),
      night.session.currency.minorUnit,
    );
    if (!parsed.ok || parsed.data <= 0) {
      errorMessageSignal.value = parsed.ok ? 'Rebuy must be positive' : parsed.error.message;
      return false;
    }
    await repository.appendNightTransaction({
      sessionId: night.session.sessionId,
      playerId,
      type: 'rebuy',
      amountMinor: parsed.data,
    });
    await refreshFromRepository(night.session.sessionId);
    return true;
  }

  async function cashOutPlayer(playerId: string, amountText: string): Promise<boolean> {
    const night = activeNightSignal.value;
    if (!night) return false;
    if (night.session.status === 'completed') {
      errorMessageSignal.value = 'Reopen the night before editing cash-outs';
      return false;
    }
    const parsed = engine.sync.parseHomeGameAmount(
      amountText.trim() || '0',
      night.session.currency.minorUnit,
    );
    if (!parsed.ok || parsed.data < 0) {
      errorMessageSignal.value = parsed.ok ? 'Cash-out cannot be negative' : parsed.error.message;
      return false;
    }
    const amountMinor = parsed.data;

    // Reverse any uncorrected cash_out transactions for this player append-only.
    const historyRes = engine.sync.createHomeGameLedgerHistory(night.session, night.transactions);
    if (historyRes.ok) {
      for (const item of historyRes.data) {
        const activeEntry =
          item.corrected && item.replacement
            ? item.replacement
            : item.corrected
              ? null
              : item.original;
        if (
          activeEntry &&
          activeEntry.playerId === playerId &&
          activeEntry.type === 'cash_out'
        ) {
          const corrRes = engine.sync.createHomeGameCorrection(
            activeEntry,
            nextId('ntx'),
            new Date().toISOString(),
            'Cash-out updated',
          );
          if (corrRes.ok) {
            await repository.appendNightTransaction(corrRes.data);
          }
        }
      }
    }

    if (amountMinor > 0) {
      await repository.appendNightTransaction({
        sessionId: night.session.sessionId,
        playerId,
        type: 'cash_out',
        amountMinor,
      });
    }

    const updatedParticipants = night.session.participants.map((p) =>
      p.playerId === playerId ? { ...p, status: 'cashed_out' as const } : p,
    );
    await repository.updateNightSession(night.session.sessionId, {
      participants: updatedParticipants,
    });

    selectedPlayerIdSignal.value = null;
    sheetFocusSignal.value = null;
    await refreshFromRepository(night.session.sessionId);
    return true;
  }

  async function returnPlayerToTable(playerId: string): Promise<boolean> {
    const night = activeNightSignal.value;
    if (!night || night.session.status === 'completed') return false;

    const historyRes = engine.sync.createHomeGameLedgerHistory(night.session, night.transactions);
    if (historyRes.ok) {
      for (const item of historyRes.data) {
        const activeEntry =
          item.corrected && item.replacement
            ? item.replacement
            : item.corrected
              ? null
              : item.original;
        if (
          activeEntry &&
          activeEntry.playerId === playerId &&
          activeEntry.type === 'cash_out'
        ) {
          const corrRes = engine.sync.createHomeGameCorrection(
            activeEntry,
            nextId('ntx'),
            new Date().toISOString(),
            'Returned to table',
          );
          if (corrRes.ok) {
            await repository.appendNightTransaction(corrRes.data);
          }
        }
      }
    }

    const updatedParticipants = night.session.participants.map((p) =>
      p.playerId === playerId ? { ...p, status: 'active' as const } : p,
    );
    await repository.updateNightSession(night.session.sessionId, {
      participants: updatedParticipants,
    });
    await refreshFromRepository(night.session.sessionId);
    return true;
  }

  async function correctLedgerEntry(transactionId: string): Promise<boolean> {
    const night = activeNightSignal.value;
    if (!night || night.session.status === 'completed') return false;
    const original = night.transactions.find((t) => t.transactionId === transactionId);
    if (!original) return false;

    const corrRes = engine.sync.createHomeGameCorrection(
      original,
      nextId('ntx'),
      new Date().toISOString(),
    );
    if (!corrRes.ok) {
      errorMessageSignal.value = corrRes.error.message;
      return false;
    }

    const checkAcc = engine.sync.calculateHomeGameAccounting(night.session, [
      ...night.transactions,
      corrRes.data,
    ]);
    if (!checkAcc.ok) {
      errorMessageSignal.value = checkAcc.error.message;
      return false;
    }

    await repository.appendNightTransaction(corrRes.data);
    await refreshFromRepository(night.session.sessionId);
    return true;
  }

  async function restoreLedgerEntry(originalTransactionId: string): Promise<boolean> {
    const night = activeNightSignal.value;
    if (!night || night.session.status === 'completed') return false;
    const original = night.transactions.find((t) => t.transactionId === originalTransactionId);
    if (!original || original.type === 'correction') return false;

    const replacement: HomeGameTransaction = {
      transactionId: nextId('ntx'),
      sessionId: night.session.sessionId,
      playerId: original.playerId,
      type: original.type,
      amountMinor: original.amountMinor,
      createdAt: new Date().toISOString(),
      note: 'Restored entry',
      correctionOfTransactionId: null,
      replacementOfTransactionId: original.transactionId,
    };
    const checkAcc = engine.sync.calculateHomeGameAccounting(night.session, [
      ...night.transactions,
      replacement,
    ]);
    if (!checkAcc.ok) {
      errorMessageSignal.value = checkAcc.error.message;
      return false;
    }

    await repository.appendNightTransaction(replacement);
    await refreshFromRepository(night.session.sessionId);
    return true;
  }

  async function settleActiveNight(): Promise<boolean> {
    const night = activeNightSignal.value;
    if (!night) return false;
    const readiness = engine.sync.validateHomeGameSessionReadyToSettle(
      night.session,
      night.transactions,
    );
    if (!readiness.ok || !readiness.data.ok) {
      errorMessageSignal.value = 'Ledger is not balanced or players are still active';
      return false;
    }
    await repository.settleNightSession(night.session.sessionId);
    await refreshFromRepository(night.session.sessionId);
    return true;
  }

  async function reopenActiveNight(): Promise<boolean> {
    const night = activeNightSignal.value;
    if (!night || night.session.status !== 'completed') return false;
    await repository.reopenNightSession(night.session.sessionId);
    await refreshFromRepository(night.session.sessionId);
    return true;
  }

  async function archiveNight(sessionId: string, archived: boolean): Promise<boolean> {
    await repository.archiveNightSession(sessionId, archived);
    await refreshFromRepository();
    return true;
  }

  function setHandShorthandInput(text: string): void {
    handShorthandInputSignal.value = text;
    errorMessageSignal.value = null;
  }

  async function saveQuickShorthandHand(): Promise<SavedHandRecord | null> {
    const night = activeNightSignal.value;
    if (!night) return null;
    const rawLine = handShorthandInputSignal.value.trim();
    const tokens = tokenizeActionShorthandLine(rawLine);
    if (tokens.length === 0) return null;

    const isIls = night.session.currency.unitPreset === 'ils';
    const tablePreset = isIls ? 'home_game_50bb' : 'six_max_100bb';
    const presetSpec = TABLE_PRESETS[tablePreset];
    const handId = nextId('night-hand');
    const baseState = createInitialDealtHandState(engine, {
      handId,
      seatCount: 6,
      startingStackBb: presetSpec.startingStackBb,
      heroSeatIndex: 0,
      heroCards: handHeroCardsSignal.value,
    });
    const compiled = compileShorthandTokensToState(engine, baseState, tokens);
    if (!compiled.ok) {
      errorMessageSignal.value = compiled.message;
      return null;
    }

    const payload = buildSavedHandPayloadFromCompiled({
      handId,
      tablePreset,
      unitLabel: presetSpec.unitLabel,
      seatCount: 6,
      startingStackBb: presetSpec.startingStackBb,
      heroSeatIndex: 0,
      heroCards: handHeroCardsSignal.value,
      shorthandLine: rawLine,
      compiled,
    });

    const saved = await repository.saveHand(payload);
    await repository.linkHandToNight({
      nightSessionId: night.session.sessionId,
      handObjectId: saved.objectId,
      shorthandSummary: rawLine,
    });
    handShorthandInputSignal.value = '';
    await refreshFromRepository(night.session.sessionId);
    return saved;
  }

  function dismissToast(): void {
    toastMessageSignal.value = null;
  }

  function clearError(): void {
    errorMessageSignal.value = null;
  }

  function applyPreset(preset: NightsPresetId): void {
    const fixture = buildPresetFixture(preset);
    isEphemeralPresetSignal.value = true;
    sessionsSignal.value = fixture.sessions;
    savedHandsByIdSignal.value = fixture.handsById;
    activeNightIdSignal.value = fixture.sessions[0]?.session.sessionId ?? null;
    activeTabSignal.value = fixture.tab;
    selectedPlayerIdSignal.value = fixture.selectedPlayerId;
    sheetFocusSignal.value = fixture.sheetFocus;
    rebuyDraftMajorSignal.value = 100;
    cashOutDraftTextSignal.value = '0';
    handShorthandInputSignal.value = fixture.handInput;
    errorMessageSignal.value = null;
    toastMessageSignal.value = null;
    createModalOpenSignal.value = false;
  }

  if (options.initialPreset) {
    applyPreset(options.initialPreset);
  }

  return {
    engine,
    repository,
    sessionsSignal,
    savedHandsByIdSignal,
    activeNightIdSignal,
    activeTabSignal,
    selectedPlayerIdSignal,
    sheetFocusSignal,
    rebuyDraftMajorSignal,
    cashOutDraftTextSignal,
    handShorthandInputSignal,
    handHeroCardsSignal,
    errorMessageSignal,
    toastMessageSignal,
    showArchivedSignal,
    createModalOpenSignal,
    isEphemeralPresetSignal,
    activeNightSignal,
    activeAccountingSignal,
    settleReadinessSignal,
    settlementSignal,
    ledgerHistorySignal,
    morningSummarySignal,
    remainingOnTableMinorSignal,
    shorthandPreviewSignal,
    recentPlayerNamesSignal,
    hydrate,
    selectNight,
    setActiveTab,
    setCreateModalOpen,
    createNight,
    addPlayer,
    openPlayerSheet,
    closePlayerSheet,
    setRebuyDraftMajor,
    setCashOutDraftText,
    stepCashOutDraft,
    fillRemainingCashOut,
    addRebuy,
    cashOutPlayer,
    returnPlayerToTable,
    correctLedgerEntry,
    restoreLedgerEntry,
    settleActiveNight,
    reopenActiveNight,
    archiveNight,
    setHandShorthandInput,
    saveQuickShorthandHand,
    dismissToast,
    clearError,
    applyPreset,
    dispose() {},
  };
}

let sharedNightsStore: NightsStore | null = null;

export function getSharedNightsStore(): NightsStore {
  if (!sharedNightsStore) {
    sharedNightsStore = createNightsStore();
  }
  return sharedNightsStore;
}

export function resetSharedNightsStore(): void {
  if (sharedNightsStore) {
    sharedNightsStore.dispose();
    sharedNightsStore = null;
  }
}
