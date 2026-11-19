# Engine spec 2: Rust/WASM evaluator and turn/river exact DCFR solver

Status: DRAFT for owner review. Read-only research; no code written. Date: 2026-11-17.
Governing rules: AGENTS §4 (tiers), §6 (ask first), §13; DECISIONS B6 (no second engine), B7 (no solver or LLM at runtime), B20 (no copyleft); ENGINE_API.md; `docs/reference/SOLVER_PATH_RESEARCH_unverified.md` (leads only, not authority).

## 0. Decision gate (nothing below is buildable until the owner answers)

This proposal **conflicts with the current rules**, so it is a gate, not a plan of record.

| # | Conflict / need | Recommendation |
|---|---|---|
| G1 | B7 says no solver at runtime; DECISIONS §G frames solver work as "an offline pilot on the owner's own machine". A browser-side solver is a runtime solver. | Pick one: (a) keep B7 and build the solver as an **offline tool** that emits solved-spot files; (b) amend B7 explicitly for a user-triggered, cancellable, local solve. Recommendation: **(a) first**, because it needs no API change and gives the golden data; revisit (b) once the solver is measured. |
| G2 | New toolchain: Rust, wasm target, a CI job (current CI is Node 22 + Python 3.12, no Rust). | Needs a yes. Only if (b) or if the offline tool is Rust. |
| G3 | Engine-API extension (new `solver/*` messages) and tier semantics for a solved subgame. | Needs a yes; §6 below is the proposal. |
| G4 | Rust evaluator vs TS as the single evaluator (B6). | Keep TS the only evaluator (§3). |
| G5 | Licences: crates and any outside code. | Recorded in THIRD_PARTY.md before use. Candidates like b-inary postflop-solver, wasm-postflop, desktop-postflop and TexasSolver are AGPL-3.0, so they are excluded under B20. |

The unverified research file's claim that postflop-solver is "already integrated" is not supported by anything in the repo, and its extra "Calibrated (LBR)" tier is outside the four-tier vocabulary. I treat both as leads only.

## 1. Clean-room constraint

Implement from the papers: Brown & Sandholm, "Solving Imperfect-Information Games via Discounted Regret Minimization" (arXiv 1809.04040), and the CFR+ / vector-form literature. Do not read or port AGPL source. Record "clean-room, from paper X" in `docs/ENGINE_PROVENANCE.md`.

DCFR as specified: positive regrets are multiplied by t^α/(t^α+1), negative regrets by t^β/(t^β+1), and average-strategy contributions by (t/(t+1))^γ; the paper's recommended setting is α=3/2, β=0, γ=2. CFR+ is the special case α=∞, β=−∞, γ=2. A secondary source recommends alternating updates; treat as unverified until checked against the golden games.

## 2. Scope

In: heads-up turn and river subgames, given a board, both ranges, pot, effective stack, and a bet-size menu. "Exact" means exact in the sense of the stated abstraction (fixed bet sizes, no card abstraction at turn/river), solved to a measured exploitability, not "GTO".
Out: flop and preflop solving; multiway; any LLM; any claim that the result is optimal play.

## 3. Evaluator authority (B6)

Finding: the TS evaluator (`engine/evaluator.ts`) is already allocation-free (rank-mask tables, `evaluateSevenCodesUnchecked`). A turn solve needs the strength order of about 1081–1128 live combos for each of up to 48 river cards: 48 × 1081 = 51,888 evaluations per river-strength build. That is tiny.

Options:
- **A (recommended):** TS stays the only evaluator. For each river card the TS side computes a rank array for the live combos and passes it to the solver as a typed array. The Rust crate contains no hand-ranking logic. No second authority exists, so B6 holds and there is no parity gate to maintain.
- **B:** a Rust evaluator with exhaustive parity against TS. It adds a second authority and a CI cost; it is justified only if a benchmark shows the TS evaluator is the bottleneck. I do not expect that, but I have not benchmarked it.

If B is ever chosen, parity means order-isomorphism (same ordering, not equal doubles) over all 2,598,960 five-card hands and all 133,784,560 seven-card hands.

## 4. Architecture

```
src/engine-api/solver-client.ts   typed async client (new, additive)
src/engine-api/solver.worker.ts   dedicated Worker (NOT the equity worker)
engine/solver/                    pure TS: game definition, tree builder, rank-array builder, result types
solver-core/ (Rust crate)         DCFR iteration kernel only, compiled to wasm32
```

- A dedicated worker keeps equity requests responsive while a solve runs. Today `engine.worker.ts` is a 6-line wrapper around the equity handler.
- The wasm module owns arrays of regrets and cumulative strategy per decision node (A_n actions × R live combos). TS builds the tree and hands over flat typed arrays; the kernel never allocates per iteration.
- Worker creation follows the existing pattern: `new Worker(new URL('./solver.worker.ts', import.meta.url), {type:'module'})`, plus an inline fallback for tests as the equity path does.

## 5. Browser memory budget

Model (arithmetic only, `budget.py`, stdlib Python, exit 0; **not measured on any browser**). Assumptions:
- Storage: one regret array plus one cumulative-strategy array per decision node, A_n × R values each, f32 (4 bytes) or 16-bit storage (2 bytes, needs per-node scaling).
- Tree built from a bet menu with all-in included; raises capped per street; not clipped by stack depth, so each row is an upper bound for its menu.
- A turn solve repeats one river subtree for each of 48 river cards.
- Excluded: scratch/reach/value buffers, rank arrays, JS heap. Real use is higher than shown.

R = live combos (1081 river, 1128 turn); bet/raise/cap = bet sizes / raise sizes / raise cap per street.

| Menu (bet/raise/cap) | Decision nodes per street | Σ actions | River f32 | River u16 | Turn solve f32 | Turn solve u16 |
|---|---|---|---|---|---|---|
| lean (1/1/1) | 4 | 8 | 0.1 MiB | 0.0 MiB | 3.2 MiB | 1.6 MiB |
| standard (3/2/2) | 20 | 56 | 0.5 MiB | 0.2 MiB | 22.7 MiB | 11.3 MiB |
| rich (5/3/3) | 132 | 392 | 3.2 MiB | 1.6 MiB | 158.6 MiB | 79.3 MiB |

With narrower ranges (R=600 river, 650 turn) the rich turn solve is 88.1 MiB f32 and 44.0 MiB u16.

Reading: for these menus, memory is not the binding constraint; **time** is, and I have not measured time. Menus larger than "rich" scale roughly with Σ actions, so the same script is the tool for checking a proposed menu before building it.

Platform facts (from web research, secondary where noted):
- wasm32 is capped at 4 GiB. Chrome on mobile is practically ~500–700 MB, and iOS Safari can kill a tab under memory pressure.
- Memory64 shipped in Chrome 133 and Firefox 134; Safari was still missing as of early 2026 per a weak secondary source. It is also slower. Not needed at these sizes.
- Wasm linear memory never shrinks. The only reliable release is `Worker.terminate()`.

Proposed budget policy (owner to confirm): default hard cap 512 MiB for the solver worker; refuse to start a solve whose modelled footprint (this table's model plus scratch) exceeds the cap and say so plainly; an opt-in "heavy" cap of 1.5 GiB on desktop only. Both numbers are proposals, not measurements.

## 6. Worker protocol (additive to ENGINE_API.md)

Why cooperative: SharedArrayBuffer and wasm threads need COOP/COEP cross-origin isolation; the app has no such headers and no host decision. So cancellation and progress cannot rely on a shared flag. SAB stays an optional later upgrade.

Existing pattern to follow: `equity/calculate|cancel|progress|result`, request IDs, a cooperative `AbortSignalLike` checked at yields, `createChannel` latest-wins.

| Message | Direction | Payload (sketch) |
|---|---|---|
| `solver/start` | client→worker | requestId, game spec (board, ranges, pot, stack, bet menu), DCFR params (α, β, γ), stop rules (max iterations, target exploitability, wall-clock cap), seed |
| `solver/progress` | worker→client | requestId, iteration, elapsedMs, exploitability so far (if measured this tick), memory modelled |
| `solver/snapshot` | worker→client | requestId, iteration, strategy as a transferable typed array (optional, every N ticks) |
| `solver/result` | worker→client | requestId, final average strategy, final exploitability, stop reason |
| `solver/cancel` | client→worker | requestId |
| `solver/error` | worker→client | requestId, code (`over_memory`, `bad_spec`, `internal`) |

Loop discipline:
1. The worker runs the kernel in **time-sliced chunks** (a few ms of iterations), then yields to the event loop with a macrotask (`MessageChannel` or `setTimeout(0)`), so an incoming `solver/cancel` is actually delivered.
2. Progress/snapshot messages are throttled to a fixed rate, with typed arrays transferred, not copied.
3. Cancel: cooperative stop at the next yield, acknowledged by a final `solver/result` with stop reason `cancelled`. If no acknowledgement arrives within a deadline, the client calls `Worker.terminate()` and recreates the worker; this is also the memory-release path.
4. Determinism: seeded where randomness exists (DCFR itself needs none; any chance sampling uses the seeded RNG like `DEFAULT_EQUITY_SEED = 0x6d2b79f5`), so a spec plus seed reproduces a result exactly on the same build.

Envelope: results ride the existing `EngineSuccess`/`EngineFailure` shape; the tier question is §7.

## 7. Honesty tier for a solver result (needs owner decision, G3)

DCFR output is approximate, so `Exact` is wrong. Options:
- **Estimated** with a qualifier "solved within this bet menu · exploitability X% of pot", where X comes from an exact best-response computation on the final average strategy. That is a measured quantity, not a confidence score, but C1 forbids numeric confidence, so the owner must say whether a measured exploitability may appear as a stated figure.
- **Verified** only when the same spec was checked against an independent reference within a stated tolerance (§8) and the command and output are on record.

Never "GTO says" or "optimal". The solved game's abstraction (bet menu, ranges) is always named next to the result.

## 8. Verification and golden strategy

Principle (AGENTS §4): golden numbers come from `tools/eqexact.py` or the engine's exact routines; "verified" is reported only with the command and output, otherwise "not run".

1. **Evaluator facts, independently counted (run this session).** I wrote a throwaway counter from the hand-ranking rules (not from `engine/evaluator.ts`), compiled with `rustc -O`, and ran it. Output:
   - Five-card hands: 2,598,960 total; per category hands: straight flush 40, four of a kind 624, full house 3,744, flush 5,108, straight 10,200, three of a kind 54,912, two pair 123,552, one pair 1,098,240, high card 1,302,540. Distinct strength classes: 10, 156, 156, 1,277, 10, 858, 858, 2,860, 1,277 respectively; 7,462 overall.
   - Seven-card hands: 133,784,560 total; straight flush 41,584, four of a kind 224,848, full house 3,473,184, flush 4,047,644, straight 6,180,020, three of a kind 6,461,620, two pair 31,433,400, one pair 58,627,800, high card 23,294,460.
   - These agree with the figures I had recalled earlier, so they are usable as a parity oracle's expected counts. They have **not** yet been compared with `engine/evaluator.ts`; that comparison is **not run**.
2. **Kuhn poker:** player 1 game value −1/18; check the solver's converged value and exploitability. Not run (no solver exists).
3. **Analytic toy games** with known solutions (for example a clairvoyance/half-street river game) derived by hand and checked by a stdlib script under `tools/`. Not run.
4. **Exact best-response exploitability** implemented separately from the DCFR kernel, in TS or Python, so the solver does not grade itself.
5. **Independent reference solution:** an exact solve of small river spots by a separate Python tool in `tools/` (exact arithmetic, no solver code shared). Compare strategies and values within a stated tolerance. Not run.
6. **Determinism:** same spec + seed ⇒ identical output on the same build, tested twice.
7. **Cancellation tests:** cancel mid-solve returns `cancelled` within a bounded number of chunks; terminate fallback frees the worker; no result is delivered after cancel for that request ID.
8. **Memory refusal test:** a spec whose modelled footprint exceeds the cap is refused with `over_memory` before allocation.
9. **CI:** a Rust job (G2) running `cargo test` plus the wasm build, and the existing five gates unchanged.

## 9. Plan if the owner approves option (a), offline first

1. Rust crate + CLI: DCFR on Kuhn and the toy games; CI job; ledger rows.
2. Turn/river tree builder and exact best-response; golden JSON under `tools/golden/`.
3. Emit solved-spot files the app can read as data (no runtime solver; B7 intact). Tier Estimated with abstraction named.
4. Measure time on the owner's machine; only then revisit browser runtime (G1b), the memory caps and menu limits above.

## 10. Risks

- Menu growth: Σ actions grows quickly with raise options; use the budget script before accepting a menu.
- Time, not memory, is the real unknown; no iteration speed has been measured.
- Rust toolchain adds a second language to CI and to the owner's review burden.
- WASM memory is never returned without terminating the worker.
- Mobile browsers have much lower practical limits than desktop.

## 11. Sources used

Brown & Sandholm 2019, arXiv 1809.04040 (DCFR parameters); AGPL status of b-inary postflop-solver / wasm-postflop / desktop-postflop and TexasSolver from their repositories; wasm32 4 GB cap, Memory64 shipping versions, mobile limits and COOP/COEP requirement for SharedArrayBuffer from web research done earlier in this session (some secondary; flagged above).
