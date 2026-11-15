import { describe, expect, it } from 'vitest';
import goldenJson from '../../tools/golden/section8.golden.json';
import {
  ACTION_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  allInLuckFacts,
  applyAction,
  applyChance,
  calculateEquityExact,
  createAction,
  duelCallFacts,
  initializeHand,
  potOddsFacts,
  potOddsFromAfterCall,
  reviewCallEvFacts,
} from '../../engine/index';

interface GoldenTurnCard {
  readonly equity: number;
  readonly equity_pct_1dp: number;
  readonly wins: number;
  readonly ties: number;
  readonly rivers: number;
}

interface GoldenSection8 {
  readonly generator: string;
  readonly fixtures: {
    readonly AdKd_vs_QsQc_on_Ks8h4h: {
      readonly equity_pct_1dp: number;
      readonly wins: number;
      readonly ties: number;
      readonly runouts: number;
    };
    readonly KdJd_vs_any_on_Ks8h4h: {
      readonly combinations: number;
      readonly equity: number;
      readonly equity_pct_1dp: number;
      readonly win: number;
      readonly win_pct_1dp: number;
      readonly tie: number;
      readonly tie_pct_2dp: number;
      readonly wins: number;
      readonly ties: number;
    };
    readonly AhKh_vs_QsQc_on_Qh7c2h: {
      readonly equity_pct_1dp: number;
      readonly wins: number;
      readonly ties: number;
      readonly runouts: number;
      readonly turn_cards: Readonly<Record<string, GoldenTurnCard>>;
    };
    readonly three_way_Qh7c2h: {
      readonly runouts: number;
      readonly equities: readonly [number, number, number];
      readonly equities_pct_1dp: readonly [number, number, number];
      readonly wins: readonly [number, number, number];
      readonly ties: readonly [number, number, number];
    };
    readonly three_way_Qh7c2h3h: {
      readonly runouts: number;
      readonly equities: readonly [number, number, number];
      readonly equities_pct_1dp: readonly [number, number, number];
      readonly wins: readonly [number, number, number];
      readonly ties: readonly [number, number, number];
    };
    readonly four_way_Qh7c2h: {
      readonly runouts: number;
      readonly equities: readonly [number, number, number, number];
      readonly equities_pct_1dp: readonly [number, number, number, number];
      readonly wins: readonly [number, number, number, number];
      readonly ties: readonly [number, number, number, number];
    };
    readonly pot_odds_call_9_into_27: {
      readonly call: number;
      readonly pot_before_call: number;
      readonly equity_needed_pct_1dp: number;
    };
    readonly pot_odds_call_1_7_into_6_7: {
      readonly call: number;
      readonly pot_before_call: number;
      readonly equity_needed_pct_1dp: number;
    };
    readonly pot_odds_call_90_into_110: {
      readonly call: number;
      readonly pot_before_call: number;
      readonly equity_needed_pct_1dp: number;
    };
    readonly pot_odds_call_2_5_into_4: {
      readonly call: number;
      readonly pot_before_call: number;
      readonly equity_needed_pct_1dp: number;
    };
    readonly duel_bet_3_75_into_5: {
      readonly bet: number;
      readonly pot_before_bet: number;
      readonly opponent_equity_needed_pct_1dp: number;
      readonly called_pot_bb: number;
      readonly effective_stack_behind_bb: number;
      readonly spr: number;
    };
    readonly headsup_open_2_5: {
      readonly limp_check_pot_bb: number;
      readonly raise_to_bb: number;
      readonly called_pot_bb: number;
      readonly effective_stack_behind_bb: number;
      readonly spr: number;
    };
    readonly all_in_luck_40bb_91_2pct: {
      readonly stack_each_bb: number;
      readonly final_pot_bb: number;
      readonly equity: number;
      readonly equity_pct_1dp: number;
      readonly expected_net_bb: number;
      readonly actual_net_bb: number;
      readonly luck_bb: number;
    };
    readonly review_call_90_into_200_25_6pct: {
      readonly already_in_bb: number;
      readonly call_bb: number;
      readonly total_invested_bb: number;
      readonly final_pot_bb: number;
      readonly equity: number;
      readonly equity_pct_1dp: number;
      readonly exact_expected_share_bb: number;
      readonly displayed_pct_expected_share_bb: number;
      readonly displayed_pct_hand_ev_bb: number;
      readonly displayed_pct_call_vs_fold_ev_bb: number;
      readonly displayed_pct_runout_luck_bb: number;
    };
  };
}

function loadGolden(): GoldenSection8 {
  return goldenJson as unknown as GoldenSection8;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function assertExactResult(
  result: ReturnType<typeof calculateEquityExact>,
): Extract<ReturnType<typeof calculateEquityExact>, { readonly trials: number }> {
  if ('error' in result) {
    throw new Error(`Expected exact equity result, got error: ${result.error.code} (${result.error.message})`);
  }
  return result;
}

describe('Design Spec Section 8 verified golden figures (live engine vs tools/eqexact.py)', () => {
  it('matches AdKd vs QsQc on Ks8h4h and KdJd vs any on Ks8h4h', () => {
    const golden = loadGolden().fixtures;

    const hu = assertExactResult(
      calculateEquityExact({
        schemaVersion: 'equity-request/v1',
        players: [
          { id: 'AdKd', cards: ['Ad', 'Kd'] },
          { id: 'QsQc', cards: ['Qs', 'Qc'] },
        ],
        board: ['Ks', '8h', '4h'],
      }),
    );
    expect(hu.trials).toBe(golden.AdKd_vs_QsQc_on_Ks8h4h.runouts);
    expect(hu.players[0]!.wins).toBe(golden.AdKd_vs_QsQc_on_Ks8h4h.wins);
    expect(hu.players[0]!.ties).toBe(golden.AdKd_vs_QsQc_on_Ks8h4h.ties);
    expect(round(hu.players[0]!.equity * 100, 1)).toBe(golden.AdKd_vs_QsQc_on_Ks8h4h.equity_pct_1dp);

    const vsAny = assertExactResult(
      calculateEquityExact(
        {
          schemaVersion: 'equity-request/v1',
          players: [
            { id: 'KdJd', cards: ['Kd', 'Jd'] },
            { id: 'any', cards: null },
          ],
          board: ['Ks', '8h', '4h'],
        },
        { exactLimit: 1_500_000 },
      ),
    );
    const kd = vsAny.players[0]!;
    expect(vsAny.trials).toBe(golden.KdJd_vs_any_on_Ks8h4h.combinations);
    expect(kd.wins).toBe(golden.KdJd_vs_any_on_Ks8h4h.wins);
    expect(kd.ties).toBe(golden.KdJd_vs_any_on_Ks8h4h.ties);
    expect(kd.equity).toBeCloseTo(golden.KdJd_vs_any_on_Ks8h4h.equity, 12);
    expect(round(kd.equity * 100, 1)).toBe(golden.KdJd_vs_any_on_Ks8h4h.equity_pct_1dp);
    expect(kd.winProbability).toBeCloseTo(golden.KdJd_vs_any_on_Ks8h4h.win, 12);
    expect(round(kd.winProbability * 100, 1)).toBe(golden.KdJd_vs_any_on_Ks8h4h.win_pct_1dp);
    expect(kd.tieProbability).toBeCloseTo(golden.KdJd_vs_any_on_Ks8h4h.tie, 12);
    expect(round(kd.tieProbability * 100, 2)).toBe(golden.KdJd_vs_any_on_Ks8h4h.tie_pct_2dp);
  });

  it('matches AhKh vs QsQc on Qh7c2h and all 45 exact turn cards', () => {
    const fx = loadGolden().fixtures.AhKh_vs_QsQc_on_Qh7c2h;

    const flop = assertExactResult(
      calculateEquityExact({
        schemaVersion: 'equity-request/v1',
        players: [
          { id: 'AhKh', cards: ['Ah', 'Kh'] },
          { id: 'QsQc', cards: ['Qs', 'Qc'] },
        ],
        board: ['Qh', '7c', '2h'],
      }),
    );
    expect(flop.trials).toBe(fx.runouts);
    expect(flop.players[0]!.wins).toBe(fx.wins);
    expect(flop.players[0]!.ties).toBe(fx.ties);
    expect(round(flop.players[0]!.equity * 100, 1)).toBe(fx.equity_pct_1dp);

    const turnEntries = Object.entries(fx.turn_cards);
    expect(turnEntries).toHaveLength(45);
    for (const [turnCard, expected] of turnEntries) {
      const turn = assertExactResult(
        calculateEquityExact({
          schemaVersion: 'equity-request/v1',
          players: [
            { id: 'AhKh', cards: ['Ah', 'Kh'] },
            { id: 'QsQc', cards: ['Qs', 'Qc'] },
          ],
          board: ['Qh', '7c', '2h', turnCard],
        }),
      );
      expect(turn.trials).toBe(expected.rivers);
      expect(turn.players[0]!.wins).toBe(expected.wins);
      expect(turn.players[0]!.ties).toBe(expected.ties);
      expect(turn.players[0]!.equity).toBeCloseTo(expected.equity, 12);
      expect(round(turn.players[0]!.equity * 100, 1)).toBe(expected.equity_pct_1dp);
    }
  });

  it('matches three-way flop, three-way turn, and four-way flop exact equities', () => {
    const golden = loadGolden().fixtures;

    const mw3Flop = assertExactResult(
      calculateEquityExact({
        schemaVersion: 'equity-request/v1',
        players: [
          { id: 'AhKh', cards: ['Ah', 'Kh'] },
          { id: 'QsQc', cards: ['Qs', 'Qc'] },
          { id: 'Th9h', cards: ['Th', '9h'] },
        ],
        board: ['Qh', '7c', '2h'],
      }),
    );
    expect(mw3Flop.trials).toBe(golden.three_way_Qh7c2h.runouts);
    mw3Flop.players.forEach((p, idx) => {
      expect(p.wins).toBe(golden.three_way_Qh7c2h.wins[idx]);
      expect(p.ties).toBe(golden.three_way_Qh7c2h.ties[idx]);
      expect(p.equity).toBeCloseTo(golden.three_way_Qh7c2h.equities[idx]!, 12);
      expect(round(p.equity * 100, 1)).toBe(golden.three_way_Qh7c2h.equities_pct_1dp[idx]);
    });

    const mw3Turn = assertExactResult(
      calculateEquityExact({
        schemaVersion: 'equity-request/v1',
        players: [
          { id: 'AhKh', cards: ['Ah', 'Kh'] },
          { id: 'QsQc', cards: ['Qs', 'Qc'] },
          { id: 'Th9h', cards: ['Th', '9h'] },
        ],
        board: ['Qh', '7c', '2h', '3h'],
      }),
    );
    expect(mw3Turn.trials).toBe(golden.three_way_Qh7c2h3h.runouts);
    mw3Turn.players.forEach((p, idx) => {
      expect(p.wins).toBe(golden.three_way_Qh7c2h3h.wins[idx]);
      expect(p.ties).toBe(golden.three_way_Qh7c2h3h.ties[idx]);
      expect(p.equity).toBeCloseTo(golden.three_way_Qh7c2h3h.equities[idx]!, 12);
      expect(round(p.equity * 100, 1)).toBe(golden.three_way_Qh7c2h3h.equities_pct_1dp[idx]);
    });

    const mw4Flop = assertExactResult(
      calculateEquityExact({
        schemaVersion: 'equity-request/v1',
        players: [
          { id: 'AhKh', cards: ['Ah', 'Kh'] },
          { id: 'QsQc', cards: ['Qs', 'Qc'] },
          { id: 'Th9h', cards: ['Th', '9h'] },
          { id: '7d7s', cards: ['7d', '7s'] },
        ],
        board: ['Qh', '7c', '2h'],
      }),
    );
    expect(mw4Flop.trials).toBe(golden.four_way_Qh7c2h.runouts);
    mw4Flop.players.forEach((p, idx) => {
      expect(p.wins).toBe(golden.four_way_Qh7c2h.wins[idx]);
      expect(p.ties).toBe(golden.four_way_Qh7c2h.ties[idx]);
      expect(p.equity).toBeCloseTo(golden.four_way_Qh7c2h.equities[idx]!, 12);
      expect(round(p.equity * 100, 1)).toBe(golden.four_way_Qh7c2h.equities_pct_1dp[idx]);
    });
  });

  it('matches Section 8 pot odds, duel SPR, all-in luck, and Review call EV figures via engine', () => {
    const golden = loadGolden().fixtures;

    for (const fx of [
      golden.pot_odds_call_9_into_27,
      golden.pot_odds_call_1_7_into_6_7,
      golden.pot_odds_call_90_into_110,
      golden.pot_odds_call_2_5_into_4,
    ]) {
      const facts = potOddsFacts(fx.call, fx.pot_before_call);
      expect(round(facts.requiredPercent, 1)).toBe(fx.equity_needed_pct_1dp);
    }

    // Duel flop bet 3.75 into 5 pot (after 2.5bb HU open+call, starting stack before bet = 97.5bb)
    const duelBet = duelCallFacts(
      golden.duel_bet_3_75_into_5.pot_before_bet,
      golden.duel_bet_3_75_into_5.bet,
      97.5,
    );
    expect(round(duelBet.callerPotOddsPercent, 1)).toBe(
      golden.duel_bet_3_75_into_5.opponent_equity_needed_pct_1dp,
    );
    expect(duelBet.calledPotBb).toBe(golden.duel_bet_3_75_into_5.called_pot_bb);
    expect(duelBet.effectiveStackBehindBb).toBe(golden.duel_bet_3_75_into_5.effective_stack_behind_bb);
    expect(round(duelBet.spr, 1)).toBe(golden.duel_bet_3_75_into_5.spr);

    // Heads-up 100bb open to 2.5bb and limp-check pot
    const huStart = applyChance(
      initializeHand({
        handId: 'golden-hu-open',
        game: {
          mode: GAME_MODES.HOME,
          smallBlindMilliBb: 500,
          bigBlindMilliBb: 1000,
          chipUnitMilliBb: 100,
          ante: { type: 'none', amountMilliBb: 0 },
        },
        buttonSeat: 0,
        players: [
          { playerId: 'BTN', seat: 0, startingStackMilliBb: 100_000 },
          { playerId: 'BB', seat: 1, startingStackMilliBb: 100_000 },
        ],
      }),
      {
        type: CHANCE_TYPES.DEAL_HOLE,
        cardsByPlayer: { BTN: ['As', 'Kh'], BB: ['Qs', 'Qc'] },
      },
    );
    const limped = applyAction(
      applyAction(huStart, createAction('BTN', ACTION_TYPES.CALL)),
      createAction('BB', ACTION_TYPES.CHECK),
    );
    expect(limped.potMilliBb / 1000).toBe(golden.headsup_open_2_5.limp_check_pot_bb);

    const openCalled = duelCallFacts(0, golden.headsup_open_2_5.raise_to_bb, 100);
    expect(openCalled.calledPotBb).toBe(golden.headsup_open_2_5.called_pot_bb);
    expect(openCalled.effectiveStackBehindBb).toBe(golden.headsup_open_2_5.effective_stack_behind_bb);
    expect(round(openCalled.spr, 1)).toBe(golden.headsup_open_2_5.spr);

    // All-in luck 40bb stack (80bb final pot), exact AdKd vs QsQc on Ks8h4h equity
    const huEq = assertExactResult(
      calculateEquityExact({
        schemaVersion: 'equity-request/v1',
        players: [
          { id: 'AdKd', cards: ['Ad', 'Kd'] },
          { id: 'QsQc', cards: ['Qs', 'Qc'] },
        ],
        board: ['Ks', '8h', '4h'],
      }),
    ).players[0]!.equity;
    const luck = allInLuckFacts({
      finalPotBb: golden.all_in_luck_40bb_91_2pct.final_pot_bb,
      investedBb: golden.all_in_luck_40bb_91_2pct.stack_each_bb,
      equityFraction: huEq,
      wonPotBb: golden.all_in_luck_40bb_91_2pct.final_pot_bb,
    });
    expect(round(huEq * 100, 1)).toBe(golden.all_in_luck_40bb_91_2pct.equity_pct_1dp);
    expect(round(luck.expectedNetBb, 1)).toBe(golden.all_in_luck_40bb_91_2pct.expected_net_bb);
    expect(luck.actualNetBb).toBe(golden.all_in_luck_40bb_91_2pct.actual_net_bb);
    expect(round(luck.runoutLuckBb, 1)).toBe(golden.all_in_luck_40bb_91_2pct.luck_bb);

    // Review call 90 into 200 final pot (10 already in), exact AhKh vs QsQc on Qh7c2h equity
    const fxReview = golden.review_call_90_into_200_25_6pct;
    const flopEq = assertExactResult(
      calculateEquityExact({
        schemaVersion: 'equity-request/v1',
        players: [
          { id: 'AhKh', cards: ['Ah', 'Kh'] },
          { id: 'QsQc', cards: ['Qs', 'Qc'] },
        ],
        board: ['Qh', '7c', '2h'],
      }),
    ).players[0]!.equity;
    const review = reviewCallEvFacts({
      finalPotBb: fxReview.final_pot_bb,
      heroInvestedBeforeCallBb: fxReview.already_in_bb,
      callAmountBb: fxReview.call_bb,
      equityFraction: flopEq,
      displayedEquityPercent: fxReview.equity_pct_1dp,
      wonPotBb: 0,
    });
    expect(round(review.exactExpectedShareBb, 2)).toBe(fxReview.exact_expected_share_bb);
    expect(round(review.displayedExpectedShareBb!, 1)).toBe(fxReview.displayed_pct_expected_share_bb);
    expect(round(review.handEvDisplayedBb!, 1)).toBe(fxReview.displayed_pct_hand_ev_bb);
    expect(round(review.callVsFoldEvDisplayedBb!, 1)).toBe(fxReview.displayed_pct_call_vs_fold_ev_bb);
    expect(round(review.runoutLuckDisplayedBb!, 1)).toBe(fxReview.displayed_pct_runout_luck_bb);

    // Cross-check potOddsFromAfterCall at 200 final pot for 90 call = 45.0%
    expect(round(potOddsFromAfterCall(90_000, 200_000).requiredPercent, 1)).toBe(45);
  });
});
