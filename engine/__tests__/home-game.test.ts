import { describe, expect, it } from 'vitest';
import {
  buildHomeGameMorningSummary,
  calculateFewestTransfersSettlement,
  calculateHomeGameAccounting,
  createHomeGameCorrection,
  createHomeGameLedgerHistory,
  formatHomeGameAmount,
  formatMinorUnitsDecimal,
  HOME_GAME_CURRENCY_PRESETS,
  HomeGameDomainError,
  minorToMajorNumber,
  parseHomeGameAmount,
  validateHomeGameLedger,
  validateHomeGameSessionReadyToSettle,
  type HomeGameParticipant,
  type HomeGameSession,
  type HomeGameTransaction,
} from '../index';

const T0 = '2026-11-16T20:00:00.000Z';
const T1 = '2026-11-16T21:00:00.000Z';
const T2 = '2026-11-16T22:30:00.000Z';

function makeSession(
  participants: HomeGameParticipant[],
  preset: 'chips' | 'ils' = 'ils',
  status: 'active' | 'completed' = 'active',
): HomeGameSession {
  return {
    sessionId: 'night-1',
    title: "Friday at Dan's",
    status,
    currency: HOME_GAME_CURRENCY_PRESETS[preset],
    participants,
    createdAt: T0,
    updatedAt: T1,
    settledAt: status === 'completed' ? T2 : null,
    archived: false,
    revision: 1,
    lifecycleEvents: [{ type: 'created', at: T0, revision: 1 }],
  };
}

function tx(
  id: string,
  playerId: string,
  type: HomeGameTransaction['type'],
  amountMinor: number,
  extra: Partial<HomeGameTransaction> = {},
): HomeGameTransaction {
  return {
    transactionId: id,
    sessionId: 'night-1',
    playerId,
    type,
    amountMinor,
    createdAt: T1,
    note: null,
    correctionOfTransactionId: null,
    replacementOfTransactionId: null,
    ...extra,
  };
}

describe('engine/home-game', () => {
  it('parses and formats exact amounts without binary floating-point drift', () => {
    expect(parseHomeGameAmount('0.10', 2) + parseHomeGameAmount('0.20', 2)).toBe(30);
    expect(parseHomeGameAmount('123456789.01', 2)).toBe(12_345_678_901);
    expect(parseHomeGameAmount('250', 0)).toBe(250);
    expect(minorToMajorNumber(28_350, 2)).toBe(283.5);
    expect(formatMinorUnitsDecimal(-12_345, 2)).toBe('-123.45');
    expect(formatMinorUnitsDecimal(20_000, 2, { trimWholeDecimals: true })).toBe('200');
    expect(formatHomeGameAmount(25_000, HOME_GAME_CURRENCY_PRESETS.ils, { signed: true })).toBe('+₪250');
    expect(formatHomeGameAmount(-150, HOME_GAME_CURRENCY_PRESETS.chips, { signed: true })).toBe('−150 pts');

    expect(() => parseHomeGameAmount('1.001', 2)).toThrow(/at most 2 decimal places/);
    expect(() => parseHomeGameAmount('1.5', 0)).toThrow(/at most 0 decimal places/);
    expect(() => parseHomeGameAmount('1e3', 2)).toThrow(/exact decimal/);
  });

  it('aggregates buy-in, rebuy, add-on, cash-out and participant net results', () => {
    const session = makeSession([
      { playerId: 'a', displayName: 'Eli', seatNumber: 1, status: 'cashed_out' },
      { playerId: 'b', displayName: 'Dan', seatNumber: 2, status: 'cashed_out' },
    ]);
    const ledger = [
      tx('t1', 'a', 'buy_in', 10_000),
      tx('t2', 'a', 'rebuy', 5_000),
      tx('t3', 'a', 'add_on', 2_500),
      tx('t4', 'a', 'cash_out', 21_000),
      tx('t5', 'b', 'buy_in', 10_000),
      tx('t6', 'b', 'cash_out', 6_500),
    ];

    const acc = calculateHomeGameAccounting(session, ledger);
    expect(acc.totalInMinor).toBe(27_500);
    expect(acc.totalOutMinor).toBe(27_500);
    expect(acc.balanceMinor).toBe(0);
    expect(acc.balanced).toBe(true);
    expect(acc.readyToSettle).toBe(true);
    expect(acc.participantResults).toEqual([
      {
        playerId: 'a',
        displayName: 'Eli',
        seatNumber: 1,
        status: 'cashed_out',
        totalInMinor: 17_500,
        totalOutMinor: 21_000,
        netMinor: 3_500,
        buyInCount: 3,
      },
      {
        playerId: 'b',
        displayName: 'Dan',
        seatNumber: 2,
        status: 'cashed_out',
        totalInMinor: 10_000,
        totalOutMinor: 6_500,
        netMinor: -3_500,
        buyInCount: 1,
      },
    ]);
  });

  it('blocks settlement explicitly when players are still active or totals are unbalanced', () => {
    const pendingSession = makeSession([
      { playerId: 'a', displayName: 'Eli', seatNumber: 1, status: 'active' },
      { playerId: 'b', displayName: 'Dan', seatNumber: 2, status: 'cashed_out' },
    ]);
    const pendingReadiness = validateHomeGameSessionReadyToSettle(pendingSession, [
      tx('t1', 'a', 'buy_in', 20_000),
      tx('t2', 'b', 'buy_in', 20_000),
      tx('t3', 'b', 'cash_out', 20_000),
    ]);
    expect(pendingReadiness.ok).toBe(false);
    if (!pendingReadiness.ok) {
      expect(pendingReadiness.reason).toBe('pending_cashout');
      expect(pendingReadiness.pendingPlayerIds).toEqual(['a']);
    }

    const allOut = makeSession([
      { playerId: 'a', displayName: 'Eli', seatNumber: 1, status: 'cashed_out' },
      { playerId: 'b', displayName: 'Dan', seatNumber: 2, status: 'cashed_out' },
    ]);
    const shortLedger = [
      tx('t1', 'a', 'buy_in', 10_000),
      tx('t2', 'b', 'buy_in', 10_000),
      tx('t3', 'a', 'cash_out', 15_000),
      tx('t4', 'b', 'cash_out', 4_500),
    ];
    const shortCheck = validateHomeGameSessionReadyToSettle(allOut, shortLedger);
    expect(shortCheck.ok).toBe(false);
    if (!shortCheck.ok) {
      expect(shortCheck.reason).toBe('more_in_than_out');
      expect(shortCheck.balanceMinor).toBe(-500);
    }

    const overLedger = [
      tx('t1', 'a', 'buy_in', 10_000),
      tx('t2', 'b', 'buy_in', 10_000),
      tx('t3', 'a', 'cash_out', 15_000),
      tx('t4', 'b', 'cash_out', 5_500),
    ];
    const overCheck = validateHomeGameSessionReadyToSettle(allOut, overLedger);
    expect(overCheck.ok).toBe(false);
    if (!overCheck.ok) {
      expect(overCheck.reason).toBe('more_out_than_in');
      expect(overCheck.balanceMinor).toBe(500);
    }

    expect(() => calculateFewestTransfersSettlement(allOut, shortLedger)).toThrow(HomeGameDomainError);
  });

  it('enforces append-only corrections and replacements without mutating history', () => {
    const session = makeSession([
      { playerId: 'a', displayName: 'Eli', seatNumber: 1, status: 'cashed_out' },
      { playerId: 'b', displayName: 'Dan', seatNumber: 2, status: 'cashed_out' },
    ]);
    const wrong = tx('wrong', 'a', 'buy_in', 15_000);
    const correction = createHomeGameCorrection(wrong, 'corr-1', T2, 'Typed 150 instead of 100');
    const replacement = tx('rep-1', 'a', 'buy_in', 10_000, {
      replacementOfTransactionId: wrong.transactionId,
    });
    const ledger = [wrong, correction, replacement];

    const acc = calculateHomeGameAccounting(session, ledger);
    expect(acc.participantResults[0]?.totalInMinor).toBe(10_000);
    expect(acc.participantResults[0]?.buyInCount).toBe(1);

    const history = createHomeGameLedgerHistory(session, ledger);
    expect(history).toHaveLength(1);
    expect(history[0]?.corrected).toBe(true);
    expect(history[0]?.correction?.transactionId).toBe('corr-1');
    expect(history[0]?.replacement?.transactionId).toBe('rep-1');

    expect(() =>
      validateHomeGameLedger(session, [
        wrong,
        correction,
        createHomeGameCorrection(wrong, 'corr-2', T2),
      ]),
    ).toThrow(/cannot be corrected twice/);

    expect(() => createHomeGameCorrection(correction, 'corr-on-corr', T2)).toThrow(
      /cannot reverse another correction/,
    );
  });

  it('computes deterministic fewest-transfers settlement including exact-pair & subset minimization', () => {
    // 4 players: +100, +80, -100, -80 => optimal is 2 transfers (not 3).
    const session = makeSession(
      [
        { playerId: 'a', displayName: 'Eli', seatNumber: 1, status: 'cashed_out' },
        { playerId: 'b', displayName: 'Dan', seatNumber: 2, status: 'cashed_out' },
        { playerId: 'c', displayName: 'Noa', seatNumber: 3, status: 'cashed_out' },
        { playerId: 'd', displayName: 'Yoav', seatNumber: 4, status: 'cashed_out' },
        { playerId: 'e', displayName: 'Maya', seatNumber: 5, status: 'cashed_out' },
      ],
      'chips',
    );
    const ledger = [
      tx('ia', 'a', 'buy_in', 200),
      tx('oa', 'a', 'cash_out', 300), // +100
      tx('ib', 'b', 'buy_in', 200),
      tx('ob', 'b', 'cash_out', 280), // +80
      tx('ic', 'c', 'buy_in', 200),
      tx('oc', 'c', 'cash_out', 100), // -100
      tx('id', 'd', 'buy_in', 200),
      tx('od', 'd', 'cash_out', 120), // -80
      tx('ie', 'e', 'buy_in', 200),
      tx('oe', 'e', 'cash_out', 200), // 0 (ignored)
    ];

    const first = calculateFewestTransfersSettlement(session, ledger);
    const second = calculateFewestTransfersSettlement(session, ledger);
    expect(first).toEqual(second);
    expect(first.totalTransferredMinor).toBe(180);
    expect(first.transfers).toEqual([
      { fromPlayerId: 'c', fromName: 'Noa', toPlayerId: 'a', toName: 'Eli', amountMinor: 100 },
      { fromPlayerId: 'd', fromName: 'Yoav', toPlayerId: 'b', toName: 'Dan', amountMinor: 80 },
    ]);

    // 5 players with two independent zero-sum subsets: {+100, -60, -40} and {+50, -50} => 3 transfers (not 4).
    const subsetLedger = [
      tx('ia', 'a', 'buy_in', 200),
      tx('oa', 'a', 'cash_out', 300), // +100
      tx('ib', 'b', 'buy_in', 200),
      tx('ob', 'b', 'cash_out', 250), // +50
      tx('ic', 'c', 'buy_in', 200),
      tx('oc', 'c', 'cash_out', 140), // -60
      tx('id', 'd', 'buy_in', 200),
      tx('od', 'd', 'cash_out', 160), // -40
      tx('ie', 'e', 'buy_in', 200),
      tx('oe', 'e', 'cash_out', 150), // -50
    ];
    const subsetSettlement = calculateFewestTransfersSettlement(session, subsetLedger);
    expect(subsetSettlement.transfers).toHaveLength(3);
    expect(subsetSettlement.totalTransferredMinor).toBe(150);

    // Zero cash-out participant works cleanly without a positive cash_out tx.
    const zeroCashOutSession = makeSession(
      [
        { playerId: 'a', displayName: 'Eli', seatNumber: 1, status: 'cashed_out' },
        { playerId: 'b', displayName: 'Dan', seatNumber: 2, status: 'cashed_out' },
      ],
      'chips',
    );
    const zeroSettlement = calculateFewestTransfersSettlement(zeroCashOutSession, [
      tx('ia', 'a', 'buy_in', 200),
      tx('ib', 'b', 'buy_in', 200),
      tx('oa', 'a', 'cash_out', 400),
    ]);
    expect(zeroSettlement.transfers).toEqual([
      { fromPlayerId: 'b', fromName: 'Dan', toPlayerId: 'a', toName: 'Eli', amountMinor: 200 },
    ]);
  });

  it('builds a factual morning-after summary', () => {
    const session = makeSession(
      [
        { playerId: 'a', displayName: 'Eli', seatNumber: 1, status: 'cashed_out' },
        { playerId: 'b', displayName: 'Dan', seatNumber: 2, status: 'cashed_out' },
      ],
      'chips',
      'completed',
    );
    const summary = buildHomeGameMorningSummary(session, [
      tx('ia', 'a', 'buy_in', 200),
      tx('oa', 'a', 'cash_out', 320),
      tx('ib', 'b', 'buy_in', 200),
      tx('ob', 'b', 'cash_out', 80),
    ]);
    expect(summary.settled).toBe(true);
    expect(summary.totalInMinor).toBe(400);
    expect(summary.totalOutMinor).toBe(400);
    expect(summary.transferCount).toBe(1);
    expect(summary.largestWinner?.playerId).toBe('a');
    expect(summary.standings.map((s) => s.playerId)).toEqual(['a', 'b']);
  });
});
