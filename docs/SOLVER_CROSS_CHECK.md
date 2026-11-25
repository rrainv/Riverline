# Solver Cross-Check & Verification Methodology

**Last verified:** 2026-11-25

Riverline verifies its equilibrium and equity numbers against independent exact oracles rather than grading itself with shared code (`B6`, `B20`).

## 1. Automated Cross-Checks (`node tools/cross-check-solver.mjs`)

| Target | Independent Oracle | Measured Tolerance / Result |
|---|---|---|
| Section 8 Equity & Pot Odds | `tools/eqexact.py` (`tools/golden/section8.golden.json`) | Exact match (`0.00%` error) |
| Kuhn Poker DCFR | Analytic Nash (`P1 EV = -1/18 = -0.055556`) | `p0 = -0.055582`, `expl = 0.001231` |
| Half-Street Clairvoyance River | Analytic Nash (`P=10, B=10 -> OOP 2.5bb, IP 7.5bb`) | `OOP = 2.4981bb, IP = 7.5019bb`, `expl = 0.0376% pot` |
| Pilot River Spots (Dry / Paired / Flush) | Independent `O(R^2)` pairwise best-response (`computeRiverBestResponse`) | `< 0.5% pot` exploitability (`0.184%` – `0.422%`) |
| Turn -> River Suit-Isomorphic Compression | `exact_isomorphic` vs un-compressed `all_rivers` + `computeTurnBestResponsePairwise` | `< 0.01 bb` EV parity, `< 0.02% pot` BR parity |
| HU Push/Fold Nash (`3..15 bb`) | Exact `169 x 169` equity matrix (`1,624,350` pairs) in `tools/pushfold_exact.py` | `< 0.00002 bb/hand` exploitability |
| Preflop EQR + Rake (`100 bb`) | Offline 2-player DCFR (`tools/preflop_eqr_solve.py`) | Raked (`5%/2.5bb`): BTN `52.2%`, BB `72.8%/14.3%`; Unraked: BTN `57.8%`, BB `82.0%/14.5%` |

## 2. External Competitor Comparison Protocol (PioSOLVER / GTO Wizard / Desktop-Postflop)

When comparing a Riverline solve against an external solver:
1. **Use an identical game tree:** Match exact pot, effective stack, rake `%` + cap, OOP/IP ranges, and exact bet/raise sizes (pick multiples of `0.5 bb` since Riverline snaps sizings to `0.5 bb`).
2. **Keep `B20` clean:** Run external AGPL solvers (e.g., Desktop-Postflop / TexasSolver) only as external black-box oracles; never copy or port AGPL source into `engine/` or `src/`.
3. **Compare:** OOP EV (`bb`), IP EV (`bb`), root action frequencies (`%`), and exploitability (`% pot`).
