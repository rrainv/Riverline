# State

Updated at the end of every session. The next session starts here.

**Last updated:** 2026-11-16, Training slice (`engine/training/`, `src/domain/training/`, `src/ui/rooms/training/`, `riverline-study-v1` `training_session.recorded` + `seatCount: 2` HU saved hands, `--room`/`--only-new` audit filters, `OptionTickets` & `FeltTable` extensions)

## What is true now
- Repository seeded on `main` (`0ab0621`); `feat/hand-recorder`, `feat/review`, `feat/strategy`, and now `feat/training` hold Rooms `/hand`, `/review`, `/strategy`, and `/training`.
- Strict TypeScript + Vite + Preact (`@preact/signals`) + CSS Modules shell built in F1a/F1b, bundled local variable fonts (`Inter` + `Rubik`), licences recorded in `docs/THIRD_PARTY.md`. Node 22+ `localStorage` Vitest warning silenced via `--no-experimental-webstorage` in `vite.config.ts`.
- Seven themes (`midnight`, `felt`, `slate`, `dusk`, `contrast`, `daylight`, `paper`), three table paces (`calm`, `normal`, `fast`), reduced motion, `showLamp`, `teacherTypingSpeed`, and three locales (`en`, `ru`, `he` with RTL mirroring, `Intl.PluralRules`, `Intl.NumberFormat`, `tNodes()`, `<PokerNotation>`) persisted in `localStorage` (`riverline.appearance.v1`), plus `--beat-action` (`480ms`) and `--beat-think` (`720ms`) motion tokens in `tokens/` read cleanly via `readTableBeatMs()` in `src/ui/kit/state.ts`.
- All 18 kit components (`src/ui/kit/`) and `/kit` state matrix harness are live, plus Room kit extensions (`FeltTable` 3-seat menu `SLOTS_MENU_THREE`, heads-up `SLOTS_HEADSUP`, and 8-seat `SLOTS_EIGHT`; `OptionTickets` `label`/`displayAmount`/`adjustable` preset support & `.kbd` `--text2` contrast fix; `EquityRow`; `HeatGrid` `variant="runout"` / `matrix13` / `leakMap`; `FamilyStrip`; `TeacherCallout` & `MixBar`; `SideRail`; `TokenInput`; `HistoryRail`; `CardPicker`; `Panel`).
- Clean-room strict-TS engine (`engine/`, zero DOM/window/storage/network) and typed Worker API (`src/engine-api/`) exposing equity, hand transitions, `projectReplayState`, `actorCallEconomics`, `actionSizeFacts`, personal strategy (`lookupStrategy`, matrix/spot-map/leak-map), and now live `generateTrainingDrill`, `gradeTrainingAnswer`, and sync `chooseDuelBotAction`.
- **Single shorthand grammar (`src/domain/shorthand/`):** `parsePlayerHandInput` & `buildRangeMatrixMask` for hands/ranges plus `parseActionShorthandToken`, `validateActionShorthandToken`, and `tokenizeActionShorthandLine`.
- **Storage (`src/domain/storage/`):** `riverline-study-v1` IndexedDB append-only event log (with in-memory test backend) storing `saved_matchup.*`, `saved_hand.*` (`seatCount: 2 | 6 | 8`, `created`, `archived`, `restored`, `annotated`), `strategy_rule.set`, `strategy_evidence.recorded`, and `training_session.recorded` (`TrainingSessionPayload`), plus `schemaVersion: 1` JSON backup export/import.
- **Training room (`src/ui/rooms/training/`, `src/domain/training/`, `engine/training/`):**
  - **Training Hub (`TrainingHubView`):** 3-seat menu `FeltTable` (`Quick drill`, `Heads-up duel`, `Leak lab`; `Full hand` omitted per `DECISIONS.md` A3.12), `This week` `FactTile` stats from persisted `training_session.recorded` events, and top Strategy plan leaks linking straight into Leak lab.
  - **Quick drill & Leak lab (`QuickDrillView`):** Table/stack/spot-type filters, exact pot price & required equity readout, blind decision first (Personal Strategy plan and baseline mix hidden until answered), `OptionTickets` + adjustable raise `SizeLadder`, revealed `MixBar` with LTR `"you"` pointer, and `TeacherCallout` + `Lamp` mood feedback. Records `strategy_evidence.recorded` and `training_session.recorded`.
  - **Heads-up duel (`HeadsUpDuelView`):** 10-hand 100 bb match against bot **Astra** paced by `--beat-think` and `--beat-action` multiplied by `--pace`, thinking indicator + action bubbles, `OptionTickets` + `[33%, 50%, 75%, 100%, All-in]` `SizeLadder` with hovered/selected exact `call` / `pot if called` / `behind` / `SPR` / `odds` readouts, `HistoryRail`, small-sample honest `"Read the table"` observed counts, post-hand `Show equity vs any two` (`calculateEquity`), 10-hand summary, and `"Save 10 hands for Review"` (`seatCount: 2` `'saved_hand.created'`).
  - **Audit tooling speedup:** `tools/audit-layout.mjs` and `tools/audit-theme.mjs` now support `--room=<room[,room2]>` and `--only-new` (documented in `AGENTS.md` §11), and `docs/IDEA_BANK.md` #82 logs the Inline Equity Overlay.
- **Personal Strategy, Review & Saved library, Hand recorder, Equity by rows rooms:** Live and covered by existing unit/golden suites.
- **Gates (post-final edit on `feat/training`, all exit 0):**
  - `npm run typecheck`: `tsc --noEmit` -> exit 0
  - `npm test`: `46 passed (46)` files, `154 passed (154)` tests -> exit 0
  - `npm run golden`: `2 passed (2)` files, `5 passed (5)` tests (`eqexact.py` matches `tools/golden/section8.golden.json`) -> exit 0
  - `npm run check:raw`: `check-no-raw-values: ok` -> exit 0
  - `npm run audit:layout -- --room=training --only-new`: `checked 154 states across 7 themes x 3 languages x 2 viewports | failures: 0 | page errors: 0` -> exit 0
  - `npm run audit:theme -- --room=training --only-new --no-build`: `runs: 22 | failed runs: 0 | page errors: 0` -> exit 0

## What is next
1. Owner visual, product, and linguistic review of `/training` (Hub, Quick drill, Leak lab, Heads-up duel vs Astra across `en`, `ru`, `he` and all 7 themes).
2. Next slice: **Slice 5 — Nights (`/nights`)** (or `/learn` as chosen by the owner), recording live poker night ledger, buy-ins/rebuys/cash-outs, settlement transfers, and linking recorded hands to evenings.
3. Pre-release full all-room 7-theme Playwright sweep (`npm run audit:layout` + `npm run audit:theme` without `--room`/`--only-new`), git remote (`origin`), and CI execution.

## Open with the owner
- Visual & linguistic review of `Training (/training)` across English, Russian, Hebrew, and all 7 themes.
- Confirm Slice 5 target (`/nights` vs `/learn`).
- Git remote URL (`origin`) when ready to push branches / PRs.

## Known gaps
- `tools/audit-layout.mjs` and `tools/audit-theme.mjs` ran scoped to `--room=training --only-new` on this slice per Slice 4 speed instructions; a full cross-room pre-release sweep will run before merging branches to `main`.
- `top X%` shorthand syntax, saved opponent ranges (`Dan`), `"Can I call?"` strip, intuition trainer, inline equity overlay (`docs/IDEA_BANK.md` #82), and postflop personal strategy rules (#81) remain deferred.
- Timed auto-play card-flight choreography between Hero/Board in Duel uses the `FeltTable` CSS/beat timers (`--beat-think` / `--beat-action` × `--pace`), while interactive click-driven duel card flights remain minimal CSS entrance/exit transitions rather than multi-phase Bézier arcs.
- `.github/workflows/ci.yml` has not executed remotely yet (no `origin` remote configured).

## Checkpoints
| Date | Reviewer | Scope | Result |
|---|---|---|---|
| — | — | — | — |
