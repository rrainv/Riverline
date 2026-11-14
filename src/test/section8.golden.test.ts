import { describe, expect, it } from 'vitest';
import goldenData from '../../tools/golden/section8.golden.json';

interface Section8GoldenFile {
  generator: string;
  fixtures: {
    AdKd_vs_QsQc_on_Ks8h4h: {
      equity_pct_1dp: number;
      wins: number;
      ties: number;
      runouts: number;
    };
    KdJd_vs_any_on_Ks8h4h: {
      combinations: number;
      equity: number;
      equity_pct_1dp: number;
      win: number;
      win_pct_1dp: number;
      tie: number;
      tie_pct_2dp: number;
      wins: number;
      ties: number;
    };
    AhKh_vs_QsQc_on_Qh7c2h: {
      equity_pct_1dp: number;
      wins: number;
      ties: number;
      runouts: number;
      turn_cards: Record<
        string,
        {
          equity: number;
          equity_pct_1dp: number;
          wins: number;
          ties: number;
          rivers: number;
        }
      >;
    };
    three_way_Qh7c2h: {
      runouts: number;
      equities_pct_1dp: number[];
    };
    three_way_Qh7c2h3h: {
      runouts: number;
      equities_pct_1dp: number[];
    };
    four_way_Qh7c2h: {
      runouts: number;
      equities_pct_1dp: number[];
    };
    pot_odds_call_9_into_27: { equity_needed_pct_1dp: number };
    pot_odds_call_1_7_into_6_7: { equity_needed_pct_1dp: number };
    pot_odds_call_90_into_110: { equity_needed_pct_1dp: number };
    pot_odds_call_2_5_into_4: { equity_needed_pct_1dp: number };
    duel_bet_3_75_into_5: {
      opponent_equity_needed_pct_1dp: number;
      called_pot_bb: number;
      effective_stack_behind_bb: number;
      spr: number;
    };
    headsup_open_2_5: {
      limp_check_pot_bb: number;
      raise_to_bb: number;
      called_pot_bb: number;
      effective_stack_behind_bb: number;
      spr: number;
    };
    all_in_luck_40bb_91_2pct: {
      equity_pct_1dp: number;
      expected_net_bb: number;
      actual_net_bb: number;
      luck_bb: number;
    };
    review_call_90_into_200_25_6pct: {
      equity_pct_1dp: number;
      displayed_pct_expected_share_bb: number;
      displayed_pct_hand_ev_bb: number;
      displayed_pct_call_vs_fold_ev_bb: number;
      displayed_pct_runout_luck_bb: number;
    };
  };
}

const golden = goldenData as Section8GoldenFile;

describe('section 8 golden fixtures (from tools/eqexact.py)', () => {
  it('records generator metadata and all verified equity scenarios', () => {
    expect(golden.generator).toBe('python tools/eqexact.py --section8');
    const f = golden.fixtures;

    expect(f.AdKd_vs_QsQc_on_Ks8h4h).toEqual({
      equity_pct_1dp: 91.2,
      wins: 903,
      ties: 0,
      runouts: 990,
    });

    expect(f.KdJd_vs_any_on_Ks8h4h.combinations).toBe(1_070_190);
    expect(f.KdJd_vs_any_on_Ks8h4h.equity_pct_1dp).toBe(83.1);
    expect(f.KdJd_vs_any_on_Ks8h4h.win_pct_1dp).toBe(82.7);
    expect(f.KdJd_vs_any_on_Ks8h4h.tie_pct_2dp).toBe(0.87);

    expect(f.AhKh_vs_QsQc_on_Qh7c2h.equity_pct_1dp).toBe(25.6);
    expect(f.AhKh_vs_QsQc_on_Qh7c2h.runouts).toBe(990);
  });

  it('matches all 45 turn card categories for AhKh vs QsQc on Qh7c2h', () => {
    const turnCards = golden.fixtures.AhKh_vs_QsQc_on_Qh7c2h.turn_cards;
    const entries = Object.entries(turnCards);
    expect(entries).toHaveLength(45);

    const nonSevenHearts = entries.filter(([c]) => c.charAt(1) === 'h' && c.charAt(0) !== '7');
    const acesOrKings = entries.filter(([c]) => c.charAt(0) === 'A' || c.charAt(0) === 'K');
    const jacksOrTensOffHeart = entries.filter(
      ([c]) => (c.charAt(0) === 'J' || c.charAt(0) === 'T') && c.charAt(1) !== 'h',
    );
    const blanksThreeToNine = entries.filter(
      ([c]) => ['3', '4', '5', '6', '8', '9'].includes(c.charAt(0)) && c.charAt(1) !== 'h',
    );
    const sevensOrTwos = entries.filter(([c]) => c.charAt(0) === '7' || c.charAt(0) === '2');
    const queenDiamonds = entries.filter(([c]) => c === 'Qd');

    expect(nonSevenHearts).toHaveLength(8);
    expect(acesOrKings).toHaveLength(6);
    expect(jacksOrTensOffHeart).toHaveLength(6);
    expect(blanksThreeToNine).toHaveLength(18);
    expect(sevensOrTwos).toHaveLength(6);
    expect(queenDiamonds).toHaveLength(1);
    expect(
      nonSevenHearts.length +
        acesOrKings.length +
        jacksOrTensOffHeart.length +
        blanksThreeToNine.length +
        sevensOrTwos.length +
        queenDiamonds.length,
    ).toBe(45);

    for (const [, v] of nonSevenHearts) expect(v.equity_pct_1dp).toBe(77.3);
    for (const [, v] of acesOrKings) expect(v.equity_pct_1dp).toBe(18.2);
    for (const [, v] of jacksOrTensOffHeart) expect(v.equity_pct_1dp).toBe(22.7);
    for (const [, v] of blanksThreeToNine) expect(v.equity_pct_1dp).toBe(15.9);
    for (const [, v] of sevensOrTwos) expect(v.equity_pct_1dp).toBe(0);
    for (const [, v] of queenDiamonds) expect(v.equity_pct_1dp).toBe(0);
  });

  it('matches multiway, pot odds, duel/headsup SPR, all-in luck, and Review EV figures', () => {
    const f = golden.fixtures;

    expect(f.three_way_Qh7c2h.runouts).toBe(903);
    expect(f.three_way_Qh7c2h.equities_pct_1dp).toEqual([20.5, 76.4, 3.1]);

    expect(f.three_way_Qh7c2h3h.equities_pct_1dp).toEqual([76.2, 23.8, 0.0]);

    expect(f.four_way_Qh7c2h.runouts).toBe(820);
    expect(f.four_way_Qh7c2h.equities_pct_1dp).toEqual([22.6, 69.3, 3.4, 4.8]);

    expect(f.pot_odds_call_9_into_27.equity_needed_pct_1dp).toBe(25.0);
    expect(f.pot_odds_call_1_7_into_6_7.equity_needed_pct_1dp).toBe(20.2);
    expect(f.pot_odds_call_90_into_110.equity_needed_pct_1dp).toBe(45.0);
    expect(f.pot_odds_call_2_5_into_4.equity_needed_pct_1dp).toBe(38.5);

    expect(f.duel_bet_3_75_into_5.opponent_equity_needed_pct_1dp).toBe(30.0);
    expect(f.duel_bet_3_75_into_5.called_pot_bb).toBe(12.5);
    expect(f.duel_bet_3_75_into_5.effective_stack_behind_bb).toBe(93.75);
    expect(f.duel_bet_3_75_into_5.spr).toBe(7.5);

    expect(f.headsup_open_2_5.limp_check_pot_bb).toBe(2.0);
    expect(f.headsup_open_2_5.called_pot_bb).toBe(5.0);
    expect(f.headsup_open_2_5.effective_stack_behind_bb).toBe(97.5);
    expect(f.headsup_open_2_5.spr).toBe(19.5);

    expect(f.all_in_luck_40bb_91_2pct.equity_pct_1dp).toBe(91.2);
    expect(f.all_in_luck_40bb_91_2pct.expected_net_bb).toBe(33.0);
    expect(f.all_in_luck_40bb_91_2pct.luck_bb).toBe(7.0);

    expect(f.review_call_90_into_200_25_6pct.equity_pct_1dp).toBe(25.6);
    expect(f.review_call_90_into_200_25_6pct.displayed_pct_expected_share_bb).toBe(51.2);
    expect(f.review_call_90_into_200_25_6pct.displayed_pct_hand_ev_bb).toBe(-48.8);
    expect(f.review_call_90_into_200_25_6pct.displayed_pct_call_vs_fold_ev_bb).toBe(-38.8);
    expect(f.review_call_90_into_200_25_6pct.displayed_pct_runout_luck_bb).toBe(-51.2);
  });
});
