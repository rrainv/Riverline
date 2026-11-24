#!/usr/bin/env python3
"""Exact 169x169 HU SB-vs-BB short-stack push/fold Nash solver (DCFR, no ante, SB=0.5, BB=1.0)."""

import argparse
import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
MATRIX_PATH = ROOT_DIR / "tools" / "data" / "preflop-equity-169x169.json"
TS_OUT_PATH = ROOT_DIR / "engine" / "personal-strategy" / "pushfold-table.ts"
PROVENANCE_ID = "pushfold-hu-nash-exact-v2"


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
    assert sum(combos) == 1326, f"Expected 1326 combos, got {sum(combos)}"
    return hand_classes, combos, eq, pairs


def solve_pushfold_stack(
    stack_bb: float,
    hand_classes: list[str],
    combos: list[int],
    eq: list[list[float]],
    pairs: list[list[int]],
    iters: int = 3000,
) -> dict:
    n = len(hand_classes)
    alpha = 1.5
    gamma = 2.0

    row_sums = [sum(pairs[i]) for i in range(n)]
    p_cond = [[pairs[i][j] / row_sums[i] for j in range(n)] for i in range(n)]
    payoff_call = [[(2.0 * eq[i][j] - 1.0) * stack_bb for j in range(n)] for i in range(n)]

    r_sb_jam = [0.0] * n
    r_sb_fold = [0.0] * n
    r_bb_call = [0.0] * n
    r_bb_fold = [0.0] * n

    sb_strat = [0.5] * n
    bb_strat = [0.5] * n

    avg_sb_jam = [0.0] * n
    avg_sb_w = 0.0
    avg_bb_call = [0.0] * n
    avg_bb_w = [0.0] * n

    for t in range(1, iters + 1):
        t_a = t ** alpha
        pos_w = t_a / (t_a + 1.0)
        neg_w = 0.5  # beta = 0 => t^0 / (t^0 + 1) = 0.5
        strat_w = (t / (t + 1.0)) ** gamma

        # Update SB regrets & strategy
        for s in range(n):
            ps = p_cond[s]
            pcs = payoff_call[s]
            ev_jam = 0.0
            for b in range(n):
                ev_jam += ps[b] * ((1.0 - bb_strat[b]) * 1.0 + bb_strat[b] * pcs[b])
            ev_fold = -0.5
            ev_cur = sb_strat[s] * ev_jam + (1.0 - sb_strat[s]) * ev_fold

            rj = r_sb_jam[s] * (pos_w if r_sb_jam[s] > 0.0 else neg_w) + (ev_jam - ev_cur)
            rf = r_sb_fold[s] * (pos_w if r_sb_fold[s] > 0.0 else neg_w) + (ev_fold - ev_cur)
            r_sb_jam[s] = rj
            r_sb_fold[s] = rf

            pj = rj if rj > 0.0 else 0.0
            pf = rf if rf > 0.0 else 0.0
            tot = pj + pf
            sb_strat[s] = pj / tot if tot > 0.0 else 0.5

        # Update BB regrets & strategy
        reach_sb = [0.0] * n
        for b in range(n):
            pb = p_cond[b]
            r_reach = 0.0
            ev_call = 0.0
            for s in range(n):
                w = pb[s] * sb_strat[s]
                r_reach += w
                ev_call += w * (-payoff_call[s][b])
            reach_sb[b] = r_reach
            ev_fold = r_reach * (-1.0)
            ev_cur = bb_strat[b] * ev_call + (1.0 - bb_strat[b]) * ev_fold

            rc = r_bb_call[b] * (pos_w if r_bb_call[b] > 0.0 else neg_w) + (ev_call - ev_cur)
            rf = r_bb_fold[b] * (pos_w if r_bb_fold[b] > 0.0 else neg_w) + (ev_fold - ev_cur)
            r_bb_call[b] = rc
            r_bb_fold[b] = rf

            pc = rc if rc > 0.0 else 0.0
            pf = rf if rf > 0.0 else 0.0
            tot = pc + pf
            bb_strat[b] = pc / tot if tot > 0.0 else 0.5

        avg_sb_w += strat_w
        for i in range(n):
            avg_sb_jam[i] += strat_w * sb_strat[i]
            wb = strat_w * reach_sb[i]
            avg_bb_call[i] += wb * bb_strat[i]
            avg_bb_w[i] += wb

    sb_avg = [avg_sb_jam[i] / avg_sb_w for i in range(n)]
    bb_avg = [
        (avg_bb_call[i] / avg_bb_w[i]) if avg_bb_w[i] > 1e-12 else bb_strat[i]
        for i in range(n)
    ]

    # Exact Nash Best-Response Exploitability
    sb_ev = 0.0
    br_sb_ev = 0.0
    for s in range(n):
        ps = p_cond[s]
        pcs = payoff_call[s]
        ev_jam = 0.0
        for b in range(n):
            ev_jam += ps[b] * ((1.0 - bb_avg[b]) * 1.0 + bb_avg[b] * pcs[b])
        ev_fold = -0.5
        w = combos[s] / 1326.0
        sb_ev += w * (sb_avg[s] * ev_jam + (1.0 - sb_avg[s]) * ev_fold)
        br_sb_ev += w * (ev_jam if ev_jam > ev_fold else ev_fold)

    br_bb_ev = 0.0
    for b in range(n):
        pb = p_cond[b]
        r_reach = 0.0
        ev_call = 0.0
        for s in range(n):
            ws = pb[s] * sb_avg[s]
            r_reach += ws
            ev_call += ws * (-payoff_call[s][b])
        ev_fold = r_reach * (-1.0)
        best_vs_jam = ev_call if ev_call > ev_fold else ev_fold
        br_bb_ev += (combos[b] / 1326.0) * ((1.0 - r_reach) * 0.5 + best_vs_jam)

    exploitability_bb = 0.5 * (br_sb_ev + br_bb_ev)
    assert exploitability_bb < 0.002, (
        f"Stack {stack_bb}bb exploitability {exploitability_bb:.6f} >= 0.002"
    )

    sb_jam_pct = round(100.0 * sum(combos[i] * sb_avg[i] for i in range(n)) / 1326.0, 1)
    bb_call_pct = round(100.0 * sum(combos[i] * bb_avg[i] for i in range(n)) / 1326.0, 1)

    sb_freq_map = {hand_classes[i]: round(sb_avg[i], 4) for i in range(n)}
    bb_freq_map = {hand_classes[i]: round(bb_avg[i], 4) for i in range(n)}

    return {
        "stackBb": stack_bb,
        "sbJamPct": sb_jam_pct,
        "bbCallPct": bb_call_pct,
        "sbEvBb": round(sb_ev, 5),
        "exploitabilityBb": round(exploitability_bb, 6),
        "provenanceId": PROVENANCE_ID,
        "sbJamFreqByClass": sb_freq_map,
        "bbCallFreqByClass": bb_freq_map,
    }


def write_typescript_table(rows: list[dict], hand_classes: list[str]) -> None:
    lines = [
        "import { deepFreeze } from '../freeze';",
        "",
        "export interface PushFoldDepthRow {",
        "  readonly stackBb: number;",
        "  readonly sbJamPct: number;",
        "  readonly bbCallPct: number;",
        "  readonly sbEvBb: number;",
        "  readonly exploitabilityBb: number;",
        f"  readonly provenanceId: '{PROVENANCE_ID}';",
        "  readonly sbJamFreqByClass: Readonly<Record<string, number>>;",
        "  readonly bbCallFreqByClass: Readonly<Record<string, number>>;",
        "}",
        "",
        "/**",
        " * Exact 169x169 HU SB-vs-BB short-stack push/fold Nash equilibrium (no ante, 0.5/1 bb),",
        " * computed offline via tools/pushfold_exact.py over tools/data/preflop-equity-169x169.json.",
        " */",
        "export const PUSHFOLD_REFERENCE_TABLE: readonly PushFoldDepthRow[] = Object.freeze([",
    ]
    for r in rows:
        sb_entries = ", ".join(f"'{hc}': {r['sbJamFreqByClass'][hc]}" for hc in hand_classes)
        bb_entries = ", ".join(f"'{hc}': {r['bbCallFreqByClass'][hc]}" for hc in hand_classes)
        lines.append("  deepFreeze<PushFoldDepthRow>({")
        lines.append(f"    stackBb: {r['stackBb']},")
        lines.append(f"    sbJamPct: {r['sbJamPct']},")
        lines.append(f"    bbCallPct: {r['bbCallPct']},")
        lines.append(f"    sbEvBb: {r['sbEvBb']},")
        lines.append(f"    exploitabilityBb: {r['exploitabilityBb']},")
        lines.append(f"    provenanceId: '{PROVENANCE_ID}',")
        lines.append(f"    sbJamFreqByClass: {{ {sb_entries} }},")
        lines.append(f"    bbCallFreqByClass: {{ {bb_entries} }},")
        lines.append("  }),")
    lines.extend([
        "]);",
        "",
        "export function lookupPushFoldRow(effectiveStackBb: number): PushFoldDepthRow {",
        "  let best = PUSHFOLD_REFERENCE_TABLE[0]!;",
        "  let bestDiff = Math.abs(best.stackBb - effectiveStackBb);",
        "  for (const row of PUSHFOLD_REFERENCE_TABLE) {",
        "    const diff = Math.abs(row.stackBb - effectiveStackBb);",
        "    if (diff < bestDiff) {",
        "      best = row;",
        "      bestDiff = diff;",
        "    }",
        "  }",
        "  return best;",
        "}",
        "",
    ])
    TS_OUT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--write-ts", action="store_true")
    args = parser.parse_args()

    hand_classes, combos, eq, pairs = load_equity_matrix()
    rows = [
        solve_pushfold_stack(s, hand_classes, combos, eq, pairs)
        for s in (3, 5, 8, 10, 12, 15)
    ]

    if args.write_ts:
        write_typescript_table(rows, hand_classes)

    if args.json:
        print(json.dumps({"provenanceId": PROVENANCE_ID, "rows": rows}, indent=2))
    else:
        for r in rows:
            print(
                f"{r['stackBb']:2d}bb | SB jam {r['sbJamPct']:5.1f}% | BB call {r['bbCallPct']:5.1f}% | SB EV {r['sbEvBb']:+.4f} bb | expl {r['exploitabilityBb']:.6f} bb"
            )


if __name__ == "__main__":
    main()
