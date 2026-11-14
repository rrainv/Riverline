# Fable 5.2 session F3: Clean-room TypeScript engine & worker API

**Paste everything below the line into a new Claude Fable 5.2 (or Gemini 4 Hydrogen High / XHigh) session opened in the new repository, with read-only access to the old repository** at `C:\Users\sjzns\Projects\poker-gto-app` (or wherever the owner has it). Never modify the old repository.

---

You are continuing the founding of **Riverline**. Read `AGENTS.md`, `docs/STATE.md`, `docs/handoff/03_LEGACY_REPO.md` in full, `.agents/rules/engine-truth.md`, and `docs/handoff/06_PRODUCT_MAP.md` part 1.

## Outcome
A lean, zero-bloat, strict-TypeScript `engine/` built via **clean-room rewrite** from the proven core poker engine (`shared/poker-domain/` + locale number formatting/input) behind a typed asynchronous API in a Web Worker, with ported behaviour tests green and the verified figures of `docs/handoff/04_DESIGN_SPEC.md` section 8 passing as golden tests.

## Clean-Room Rewrite & Lean Policy (Zero Anchor Code)
**Do NOT bulk-copy `app/src/` or blindly copy legacy JS into `engine/`!** To keep the new repository clean, strongly typed, and free of v1 sprawl:
- **Inspect & rewrite in F3 (Core):** Read `shared/poker-domain/` (cards, evaluator, equity, legality, pot/side-pot accounting, ranges, settlement) + `locale-number-format.mjs` & `locale-number-input.mjs` and their behaviour tests in the old repo (read-only). Extract their contracts, invariants, edge cases, and versioned data schemas, then **rewrite them cleanly in strict TypeScript (`engine/*.ts`)** instead of copying legacy JS.
- **Port behaviour tests to verify equivalence:** Port the old repo's behaviour/unit tests (no source-shape or CSS-reading tests) and run them against the rewritten TypeScript modules alongside `tools/eqexact.py` golden tests. Versioned data contracts must remain compatible unless the owner explicitly approves a migration.
- **Defer to their slices (and merge overlaps):** `home-game/`, `personal-strategy/`, `training-memory/`, `saved-study-objects/`, and `hand-review`/`hand-history` stay in the old repo until their slice arrives. When a slice needs one, inspect for overlapping v1 files, consolidate their rules, and rewrite cleanly.
- **Leave behind permanently:** `app/assets/audio/foley/` (owner disliked v1 sounds), `account-identity/`, `account-profile/`, `authentication/`, `sync/`, `tutorial/`, `welcome-orientation*`, all `*-bootstrap.mjs` / `*-workspace.mjs` / `*-view-model.mjs` / `*-presentation*.mjs` UI glue, and all 110 source-shape/CSS-reading tests.

## Steps
1. **Verify map & worktrees (read-only).** Read `docs/handoff/ENGINE_MAP.md` (and `docs/prompts/ENGINE_MAP_001.md` if deeper detail is needed). Check `origin/codex/stabilization` vs `0921c04` (`HEAD`) and `.claude/worktrees/` for any `shared/poker-domain/` differences, and confirm the exact F3 module scope with the owner before writing code.
2. **Inspect & rewrite cleanly in TypeScript.** For each approved `shared/poker-domain/` module, inspect the old JS source and its behaviour tests (read-only), design clean strict-TypeScript modules in `engine/` (no `any`, no DOM/storage/network access), and port the behaviour tests (no source-shape tests) to prove 100% behavioral and numeric equivalence. Record every inspected source file, its source commit, and its new `engine/` target in `docs/ENGINE_PROVENANCE.md`.
3. **Preserve contracts & flag suspected bugs.** Preserve all versioned data schemas and poker invariants. If old behaviour looks wrong, do **not** silently alter it — write a failing test stating the expected behaviour, log it in `docs/BUG_INBOX.md`, and ask the owner.
4. **API.** Design `src/engine-api` as a small typed surface: equity (known cards, ranges, unknown hands; exact when cheap, sampled with seed, count and margin otherwise), hand state (legal actions, apply action, pot and price facts), evaluator and hand categories, strategy lookup with its tier, training generation and grading, accounting. Every call returns its tier and method with its result. Requests carry IDs and can be cancelled. Randomness is seeded. Cheap arithmetic (price, SPR) is available synchronously through the same typed surface. Write the API as a short document first (`docs/ENGINE_API.md`) and get the owner's yes.
5. **Worker.** Run the engine in a Web Worker; measure message cost; avoid copying large structures per call. Report timings for: two-player exact equity on a flop, four-player exact equity on a flop, a ten-player sampled preflop equity, one strategy lookup.
6. **Golden numbers.** Generate fixtures with `python tools/eqexact.py --section8` (and `--with-vs-any`) for every figure in section 8 of the design spec, store each with the command that produced it, and test the engine against them via `npm run golden` / `npm test`. If the engine disagrees with the independent evaluator, stop and report; do not adjust either to match.
7. **Regression cases** from `03_LEGACY_REPO.md` section 5: the big-blind ante settlement case (`100 bb`, blinds `0.5/1`, `1 bb` BBA, SB calls -> pot `3 bb`, threshold `1/6`, SB win settles `102` to `98`), the four range-mathematics values kept apart, joint sampling rejecting colliding card sets, and the bot and replay privacy fences. Each gets a test.
8. **Locale numbers.** Inspect the number-formatting and number-input modules in the old repo, rewrite them cleanly in TypeScript, and port their tests (decimal separators per language, Hebrew RTL isolation).

## Do not
- Do not touch any file in the old repository.
- Do not copy `logic.js`, any legacy JS file verbatim, any file that touches the DOM, or any test that reads source files as text.
- Do not flatten or migrate versioned contracts without owner approval.
- Do not copy local auth configuration or secrets.

## Before you write code
If `ENGINE_MAP.md` is missing or stale, run step 1 and stop for the owner's confirmation of the F3 module scope and `docs/ENGINE_API.md`.

## Finish with
The five-line report, gate outputs, worker timings, any discrepancies between the engine and `eqexact.py`, and the complete `docs/ENGINE_PROVENANCE.md`.
