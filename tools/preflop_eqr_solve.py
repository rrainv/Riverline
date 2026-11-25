#!/usr/bin/env python3
"""Clean-room 169x169 2-player Preflop EQR + Rake Equilibrium Solver (DCFR).

Models:
  Opener (IP, e.g. BTN) opens `open_bb` or folds (-0.0 / 0 EV).
  Defender (OOP, e.g. BB) faces `open_bb` with 1.0 bb posted:
    - Fold: Opener wins 1.0 bb (plus 0.5 bb SB dead if 6-max).
    - Call: Realizes postflop equity with `eqr_oop` / `eqr_ip` on pot `open_bb * 2 + dead_bb` minus rake.
    - 3-Bet to `three_bet_bb`: Opener can Fold, Call (realizes with EQR), or 4-Bet Jam `stack_bb` (Defender calls/folds all-in).
"""

import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
MATRIX_PATH = ROOT_DIR / "tools" / "data" / "preflop-equity-169x169.json"
TS_OUT_PATH = ROOT_DIR / "engine" / "personal-strategy" / "preflop-eqr.ts"
PROVENANCE_ID = "preflop-eqr-dcfr-v1"


def load_equity_matrix():
    with MATRIX_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)
    hand_classes = data["handClasses"]
    n = len(hand_classes)
    eq = [[0.5] * n for _ in range(n)]
    pairs = [[0] * n for _ in range(n)]
    upper_eq = data["upperEquity"]
    upper_pairs = data["upperDisjointPairs"]
    for i in range(n):
        for j in range(i, n):
            e = float(upper_eq[i][j - i])
            p = int(upper_pairs[i][j - i])
            eq[i][j] = e
            eq[j][i] = 1.0 - e if i != j else 0.5
            pairs[i][j] = p
            pairs[j][i] = p
    combos = [sum(pairs[i]) // 1225 for i in range(n)]
    return hand_classes, combos, eq, pairs


def solve_eqr_spot(
    spot_id: str,
    label: str,
    stack_bb: float,
    open_bb: float,
    three_bet_bb: float,
    dead_sb_bb: float,
    rake_pct: float,
    rake_cap_bb: float,
    eqr_ip: float,
    eqr_oop: float,
    hand_classes: list[str],
    combos: list[int],
    eq: list[list[float]],
    pairs: list[list[int]],
    iters: int = 400,
) -> dict:
    n = len(hand_classes)
    row_sums = [sum(pairs[i]) for i in range(n)]
    p_cond = [[pairs[i][j] / row_sums[i] for j in range(n)] for i in range(n)]

    # Rake helper
    def net_pot(raw_pot: float) -> float:
        r = min(raw_pot * rake_pct, rake_cap_bb) if rake_pct > 0 else 0.0
        return max(0.0, raw_pot - r)

    # Pot sizes
    pot_srp = net_pot(open_bb * 2.0 + dead_sb_bb)
    pot_3b_call = net_pot(three_bet_bb * 2.0 + dead_sb_bb)
    pot_4b_allin = net_pot(stack_bb * 2.0 + dead_sb_bb)

    # Regrets & cumulative strategies:
    # IP Open (2: fold, open)
    r_ip_open = [[0.0, 0.0] for _ in range(n)]
    cum_ip_open = [[0.0, 0.0] for _ in range(n)]
    # OOP vs Open (3: fold, call, 3bet)
    r_oop_def = [[0.0, 0.0, 0.0] for _ in range(n)]
    cum_oop_def = [[0.0, 0.0, 0.0] for _ in range(n)]
    # IP vs 3-bet (3: fold, call, 4bet_jam)
    r_ip_vs3b = [[0.0, 0.0, 0.0] for _ in range(n)]
    cum_ip_vs3b = [[0.0, 0.0, 0.0] for _ in range(n)]
    # OOP vs 4-bet jam (2: fold, call)
    r_oop_vs4b = [[0.0, 0.0] for _ in range(n)]
    cum_oop_vs4b = [[0.0, 0.0] for _ in range(n)]

    def regret_match(reg: list[float]) -> list[float]:
        pos = [max(0.0, x) for x in reg]
        s = sum(pos)
        if s <= 0.0:
            u = 1.0 / len(reg)
            return [u] * len(reg)
        return [x / s for x in pos]

    alpha = 1.5
    gamma = 2.0

    for t in range(1, iters + 1):
        pos_disc = 1.0 if t == 1 else ((t - 1) ** alpha) / (((t - 1) ** alpha) + 1.0)
        neg_disc = 0.5
        w_t = (t / (t + 1.0)) ** gamma

        s_ip_open = [regret_match(r_ip_open[i]) for i in range(n)]
        s_oop_def = [regret_match(r_oop_def[i]) for i in range(n)]
        s_ip_vs3b = [regret_match(r_ip_vs3b[i]) for i in range(n)]
        s_oop_vs4b = [regret_match(r_oop_vs4b[i]) for i in range(n)]

        # Aggregate weighted opponent reaches
        # For IP (indexed by j = OOP):
        oop_fold_w = [p_cond[0][j] for j in range(n)]  # placeholder replaced per-i via p_cond
        oop_f_prob = [s_oop_def[j][0] for j in range(n)]
        oop_c_prob = [s_oop_def[j][1] for j in range(n)]
        oop_3b_prob = [s_oop_def[j][2] for j in range(n)]
        oop_4bc_prob = [s_oop_def[j][2] * s_oop_vs4b[j][1] for j in range(n)]
        oop_4bf_prob = [s_oop_def[j][2] * s_oop_vs4b[j][0] for j in range(n)]

        # Update IP (i)
        for i in range(n):
            p_row = p_cond[i]
            eq_row = eq[i]
            ev_vs3b_fold = -open_bb
            ev_vs3b_call = 0.0
            ev_vs3b_jam = 0.0
            ev_srp_call = 0.0
            sum_f = 0.0
            sum_c = 0.0
            sum_3b = 0.0
            for j in range(n):
                pj = p_row[j]
                sum_f += pj * oop_f_prob[j]
                wc = pj * oop_c_prob[j]
                if wc > 0.0:
                    sum_c += wc
                    e_ip = min(1.0, eq_row[j] * eqr_ip)
                    ev_srp_call += wc * (e_ip * pot_srp - open_bb)
                w3 = pj * oop_3b_prob[j]
                if w3 > 0.0:
                    sum_3b += w3
                    e_3b = min(1.0, eq_row[j] * eqr_ip)
                    ev_vs3b_call += w3 * (e_3b * pot_3b_call - three_bet_bb)
                    wf4 = pj * oop_4bf_prob[j]
                    wc4 = pj * oop_4bc_prob[j]
                    ev_vs3b_jam += wf4 * (three_bet_bb + dead_sb_bb) + wc4 * (eq_row[j] * pot_4b_allin - stack_bb)

            ev_3b_node_call = ev_vs3b_call / sum_3b if sum_3b > 1e-12 else ev_vs3b_fold
            ev_3b_node_jam = ev_vs3b_jam / sum_3b if sum_3b > 1e-12 else ev_vs3b_fold
            s3 = s_ip_vs3b[i]
            ev_vs3b_avg = s3[0] * ev_vs3b_fold + s3[1] * ev_3b_node_call + s3[2] * ev_3b_node_jam

            # Update IP vs 3bet regrets (weighted by sum_3b * s_ip_open[i][1])
            reach_ip_3b = s_ip_open[i][1]
            for a_idx, a_ev in enumerate((ev_vs3b_fold, ev_3b_node_call, ev_3b_node_jam)):
                prev = r_ip_vs3b[i][a_idx]
                disc = prev * pos_disc if prev >= 0 else prev * neg_disc
                r_ip_vs3b[i][a_idx] = disc + sum_3b * (a_ev - ev_vs3b_avg)
                cum_ip_vs3b[i][a_idx] += w_t * reach_ip_3b * s3[a_idx]

            ev_open = sum_f * (1.0 + dead_sb_bb) + ev_srp_call + sum_3b * ev_vs3b_avg
            ev_fold = 0.0
            so = s_ip_open[i]
            ev_root = so[0] * ev_fold + so[1] * ev_open
            for a_idx, a_ev in enumerate((ev_fold, ev_open)):
                prev = r_ip_open[i][a_idx]
                disc = prev * pos_disc if prev >= 0 else prev * neg_disc
                r_ip_open[i][a_idx] = disc + (a_ev - ev_root)
                cum_ip_open[i][a_idx] += w_t * so[a_idx]

        # Update OOP (j)
        s_ip_open = [regret_match(r_ip_open[i]) for i in range(n)]
        s_ip_vs3b = [regret_match(r_ip_vs3b[i]) for i in range(n)]
        for j in range(n):
            p_row = p_cond[j]
            eq_row = eq[j]
            ev_fold = -1.0
            ev_call = 0.0
            ev_3b = 0.0
            ev_4bc = 0.0
            sum_open = 0.0
            sum_4b = 0.0
            for i in range(n):
                pi = p_row[i] * s_ip_open[i][1]
                if pi <= 0.0:
                    continue
                sum_open += pi
                e_oop = min(1.0, eq_row[i] * eqr_oop)
                ev_call += pi * (e_oop * pot_srp - open_bb)

                si3 = s_ip_vs3b[i]
                ev_3b += pi * (
                    si3[0] * (open_bb + dead_sb_bb)
                    + si3[1] * (e_oop * pot_3b_call - three_bet_bb)
                )
                w4 = pi * si3[2]
                if w4 > 0.0:
                    sum_4b += w4
                    ev_4bc += w4 * (eq_row[i] * pot_4b_allin - stack_bb)

            if sum_open <= 1e-12:
                continue
            ev_call /= sum_open
            ev_3b_fold_4b = -three_bet_bb
            ev_4bc_node = ev_4bc / sum_4b if sum_4b > 1e-12 else ev_3b_fold_4b
            s4 = s_oop_vs4b[j]
            ev_vs4b_avg = s4[0] * ev_3b_fold_4b + s4[1] * ev_4bc_node
            for a_idx, a_ev in enumerate((ev_3b_fold_4b, ev_4bc_node)):
                prev = r_oop_vs4b[j][a_idx]
                disc = prev * pos_disc if prev >= 0 else prev * neg_disc
                r_oop_vs4b[j][a_idx] = disc + (sum_4b / sum_open) * (a_ev - ev_vs4b_avg)
                cum_oop_vs4b[j][a_idx] += w_t * s_oop_def[j][2] * s4[a_idx]

            ev_3bet_total = (ev_3b + sum_4b * ev_vs4b_avg) / sum_open
            sd = s_oop_def[j]
            ev_def_avg = sd[0] * ev_fold + sd[1] * ev_call + sd[2] * ev_3bet_total
            for a_idx, a_ev in enumerate((ev_fold, ev_call, ev_3bet_total)):
                prev = r_oop_def[j][a_idx]
                disc = prev * pos_disc if prev >= 0 else prev * neg_disc
                r_oop_def[j][a_idx] = disc + (a_ev - ev_def_avg)
                cum_oop_def[j][a_idx] += w_t * sd[a_idx]

    def norm_cum(cum: list[float]) -> list[float]:
        s = sum(cum)
        return [round(x / s, 3) if s > 0 else round(1.0 / len(cum), 3) for x in cum]

    total_combos = sum(combos)
    ip_open_freq = {hand_classes[i]: norm_cum(cum_ip_open[i])[1] for i in range(n)}
    oop_call_freq = {hand_classes[i]: norm_cum(cum_oop_def[i])[1] for i in range(n)}
    oop_3b_freq = {hand_classes[i]: norm_cum(cum_oop_def[i])[2] for i in range(n)}

    ip_open_pct = round(sum(combos[i] * ip_open_freq[hand_classes[i]] for i in range(n)) * 100.0 / total_combos, 1)
    oop_call_pct = round(sum(combos[i] * oop_call_freq[hand_classes[i]] for i in range(n)) * 100.0 / total_combos, 1)
    oop_3b_pct = round(sum(combos[i] * oop_3b_freq[hand_classes[i]] for i in range(n)) * 100.0 / total_combos, 1)

    return {
        "spotId": spot_id,
        "label": label,
        "stackBb": stack_bb,
        "openBb": open_bb,
        "threeBetBb": three_bet_bb,
        "rakePct": rake_pct,
        "rakeCapBb": rake_cap_bb,
        "eqrIp": eqr_ip,
        "eqrOop": eqr_oop,
        "ipOpenPct": ip_open_pct,
        "oopCallPct": oop_call_pct,
        "oopThreeBetPct": oop_3b_pct,
        "ipOpenFreqByClass": ip_open_freq,
        "oopCallFreqByClass": oop_call_freq,
        "oopThreeBetFreqByClass": oop_3b_freq,
    }


def main():
    hand_classes, combos, eq, pairs = load_equity_matrix()
    spots = [
        solve_eqr_spot(
            spot_id="btn_vs_bb_100bb_raked",
            label="BTN vs BB 100bb (5% / 2.5bb rake)",
            stack_bb=100.0,
            open_bb=2.5,
            three_bet_bb=10.0,
            dead_sb_bb=0.5,
            rake_pct=0.05,
            rake_cap_bb=2.5,
            eqr_ip=1.06,
            eqr_oop=0.88,
            hand_classes=hand_classes,
            combos=combos,
            eq=eq,
            pairs=pairs,
        ),
        solve_eqr_spot(
            spot_id="btn_vs_bb_100bb_unraked",
            label="BTN vs BB 100bb (0% rake home game)",
            stack_bb=100.0,
            open_bb=2.5,
            three_bet_bb=10.0,
            dead_sb_bb=0.5,
            rake_pct=0.0,
            rake_cap_bb=0.0,
            eqr_ip=1.06,
            eqr_oop=0.88,
            hand_classes=hand_classes,
            combos=combos,
            eq=eq,
            pairs=pairs,
        ),
    ]

    lines = [
        "import { deepFreeze } from '../freeze';",
        "",
        "export interface PreflopEqrSolvedSpot {",
        "  readonly spotId: string;",
        "  readonly label: string;",
        "  readonly stackBb: number;",
        "  readonly openBb: number;",
        "  readonly threeBetBb: number;",
        "  readonly rakePct: number;",
        "  readonly rakeCapBb: number;",
        "  readonly eqrIp: number;",
        "  readonly eqrOop: number;",
        "  readonly ipOpenPct: number;",
        "  readonly oopCallPct: number;",
        "  readonly oopThreeBetPct: number;",
        "  readonly ipOpenFreqByClass: Readonly<Record<string, number>>;",
        "  readonly oopCallFreqByClass: Readonly<Record<string, number>>;",
        "  readonly oopThreeBetFreqByClass: Readonly<Record<string, number>>;",
        "}",
        "",
        "/**",
        " * Offline 169x169 2-player Preflop EQR + Rake equilibrium spots solved via",
        " * tools/preflop_eqr_solve.py over tools/data/preflop-equity-169x169.json.",
        " */",
        "export const PREFLOP_EQR_SPOTS: readonly PreflopEqrSolvedSpot[] = Object.freeze([",
    ]
    for s in spots:
        lines.append(f"  deepFreeze<PreflopEqrSolvedSpot>({json.dumps(s)}),")
    lines.append("]);")
    lines.append("")
    lines.append("export function lookupPreflopEqrSpot(rakePct: number): PreflopEqrSolvedSpot {")
    lines.append("  return rakePct > 0 ? PREFLOP_EQR_SPOTS[0]! : PREFLOP_EQR_SPOTS[1]!;")
    lines.append("}")
    lines.append("")

    TS_OUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    for s in spots:
        print(f"{s['spotId']}: IP Open {s['ipOpenPct']}% | OOP Call {s['oopCallPct']}% | OOP 3bet {s['oopThreeBetPct']}%")


if __name__ == "__main__":
    main()
