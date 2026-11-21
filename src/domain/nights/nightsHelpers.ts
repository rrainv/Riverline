import {
  getSharedEngineClient,
  HOME_GAME_CURRENCY_PRESETS,
  type HomeGameParticipant,
  type HomeGameTransaction,
} from '../../engine-api';
import {
  buildSavedHandPayloadFromCompiled,
  compileShorthandTokensToState,
  createInitialDealtHandState,
} from '../hand';
import { tokenizeActionShorthandLine } from '../shorthand';
import type { NightSessionRecord, SavedHandRecord } from '../storage';
import type {
  NightsHandStackBb,
  NightsPresetId,
  NightsSheetFocus,
  NightsTabId,
} from './types';
export function clampHeroSeat(seatIndex: number, count: 6 | 8): number {
  if (!Number.isFinite(seatIndex)) return 0;
  return Math.max(0, Math.min(count - 1, Math.trunc(seatIndex)));
}

export function defaultSeatCountForNight(night: NightSessionRecord | null): 6 | 8 {
  return night && night.session.participants.length > 6 ? 8 : 6;
}

export function defaultStackBbForNight(night: NightSessionRecord | null): NightsHandStackBb {
  return night?.session.currency.unitPreset === 'ils' ? 50 : 100;
}

let seqCounter = 0;

export function nextId(prefix: string): string {
  seqCounter += 1;
  return `${prefix}-${seqCounter}`;
}

export function buildPresetFixture(preset: NightsPresetId): {
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

