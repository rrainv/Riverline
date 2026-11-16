# State

Updated at the end of every session. The next session starts here.

**Last updated:** 2026-11-16, Game Night slice (`engine/home-game/`, `src/domain/nights/`, `src/ui/rooms/nights/`, `riverline-study-v1` `night_*` events, `Stepper` `unitPosition`, `Chip` contrast fix, `/hand` & `/review` bridges)

## What is true now
- Repository seeded on `main` (`0ab0621`); `feat/hand-recorder`, `feat/review`, `feat/strategy`, `feat/training`, and now `feat/nights` hold Rooms `/hand`, `/review`, `/strategy`, `/training`, and `/nights`.
- Strict TypeScript + Vite + Preact (`@preact/signals`) + CSS Modules shell built in F1a/F1b, bundled local variable fonts (`Inter` + `Rubik`), licences recorded in `docs/THIRD_PARTY.md`. Node 22+ `localStorage` Vitest warning silenced via `--no-experimental-webstorage` in `vite.config.ts`.
- Seven themes (`midnight`, `felt`, `slate`, `dusk`, `contrast`, `daylight`, `paper`), three table paces (`calm`, `normal`, `fast`), reduced motion, `showLamp`, `teacherTypingSpeed`, and three locales (`en`, `ru`, `he` with RTL mirroring, `Intl.PluralRules`, `Intl.NumberFormat`, `tNodes()`, `<PokerNotation>`) persisted in `localStorage` (`riverline.appearance.v1`), plus `--beat-action` (`480ms`) and `--beat-think` (`720ms`) motion tokens in `tokens/` read cleanly via `readTableBeatMs()` in `src/ui/kit/state.ts`.
- All 18 kit components (`src/ui/kit/`) and `/kit` state matrix harness are live, plus Room kit extensions (`FeltTable` 3-seat/HU/8-seat slots; `OptionTickets` presets & `.kbd` contrast fix; `Stepper` `unitPosition?: 'prefix' | 'suffix'`; `Chip` `--text` contrast fix for page backgrounds; `EquityRow`; `HeatGrid`; `FamilyStrip`; `TeacherCallout` & `MixBar`; `SideRail`; `TokenInput`; `HistoryRail`; `CardPicker`; `Panel`).
- Clean-room strict-TS engine (`engine/`, zero DOM/window/storage/network) and typed Worker API (`src/engine-api/`) exposing equity, hand transitions, `projectReplayState`, `actorCallEconomics`, `actionSizeFacts`, personal strategy, training drills & Astra duel, and now `engine/home-game/` (`parseHomeGameAmount`, `formatHomeGameAmount`, `validateHomeGameLedger`, `calculateHomeGameAccounting`, `validateHomeGameSessionReadyToSettle`, `calculateFewestTransfersSettlement`, `createHomeGameCorrection`, `createHomeGameLedgerHistory`, `buildHomeGameMorningSummary`).
- **Single shorthand grammar (`src/domain/shorthand/` + `src/domain/hand/shorthandCompiler.ts`):** `parsePlayerHandInput` & `buildRangeMatrixMask` for hands/ranges plus `parseActionShorthandToken` (including optional `position` tokens `UTG..BB`), `validateActionShorthandToken`, `tokenizeActionShorthandLine`, and shared `compileShorthandTokensToState`.
- **Storage (`src/domain/storage/`):** `riverline-study-v1` IndexedDB append-only event log (with in-memory test backend) storing `saved_matchup.*`, `saved_hand.*`, `strategy_rule.set`, `strategy_evidence.recorded`, `training_session.recorded`, and `night_*` (`night_session.created`, `night_session.updated`, `night_session.settled`, `night_session.reopened`, `night_session.archived`, `night_ledger.appended`, `night_hand.linked`), plus `schemaVersion: 1` JSON backup export/import.
- **Game Night room (`/nights`, `src/ui/rooms/nights/`, `src/domain/nights/`, `engine/home-game/`):**
  - **Ledger (`NightsLedgerView` & `NightsPlayerSheetContent`):** `Chips / Points` default (`minorUnit: 0`) + optional `₪` preset (`minorUnit: 2`), zero rake, balance gate (`Still on the table` / `Balanced` / `More went in` / `More came out`), player rows with buy-in counts and net, desktop side inspector + narrow `PhoneSheet`, append-only `Correct` / `Restore` entry history, rebuy `Stepper`, cash-out `TextField` + `Stepper` + 1-tap `"Fill remaining"` for the last uncashed player.
  - **Hands (`NightsHandsView`):** Shared shorthand capture (`btn r12 sb f bb c / Qh 7c 2h`) saving real `SavedHandPayload` + `night_hand.linked` events, `"Record full hand in /hand"` auto-linking back to the active night, and `"Open in Review"` deep-links.
  - **Settle & Morning-after summary (`NightsSettleView` & `NightsPastView`):** Balance-gated settlement with exact-pair + bipartite minimum-transfer solver, `Settle the night` / `Reopen night`, factual Morning-after summary (totals, standings, linked hands), and Past nights list with archive/restore.
- **Training, Personal Strategy, Review & Saved library, Hand recorder, Equity by rows rooms:** Live and covered by unit/golden suites.
- **Gates (post-final code edit on `feat/nights`, all exit 0):**
  - `npm run typecheck`: `tsc --noEmit` -> exit 0
  - `npm test`: `49 passed (49)` files, `167 passed (167)` tests -> exit 0
  - `npm run golden`: `2 passed (2)` files, `5 passed (5)` tests (`eqexact.py` matches `tools/golden/section8.golden.json`) -> exit 0
  - `npm run check:raw`: `check-no-raw-values: ok` -> exit 0
  - `npm run audit:layout -- --room=nights --only-new`: `checked 132 states across 7 themes x 3 languages x 2 viewports | failures: 0 | page errors: 0` -> exit 0
  - `npm run audit:theme -- --room=nights --only-new --no-build`: `runs: 22 | failed runs: 0 | page errors: 0` -> exit 0

## What is next
1. Owner visual, product, and linguistic review of `/nights` (Ledger, Player sheet, Hands, Settle, Morning-after summary, Past nights across `en`, `ru`, `he` and all 7 themes).
2. Next slice: **Slice 6 — Home (`/home`) or Learn (`/learn`)** as chosen by the owner.
3. Pre-release full all-room 7-theme Playwright sweep (`npm run audit:layout` + `npm run audit:theme` without `--room`/`--only-new`), git remote (`origin`), and CI execution.

## Open with the owner
- Visual & linguistic review of `Game Night (/nights)` across English, Russian, Hebrew, and all 7 themes.
- Confirm Slice 6 target (`/home` vs `/learn`).
- Git remote URL (`origin`) when ready to push branches / PRs.

## Known gaps
- `tools/audit-layout.mjs` and `tools/audit-theme.mjs` ran scoped to `--room=nights --only-new` on this slice per Slice 5 speed instructions; a full cross-room pre-release sweep will run before merging branches to `main`.
- `My poker` saved player/group manager, shareable Morning-after PNG receipt card (`docs/IDEA_BANK.md` #49), `top X%` shorthand syntax, `"Can I call?"` strip, intuition trainer, inline equity overlay (`#82`), and postflop personal strategy rules (`#81`) remain deferred.
- `.github/workflows/ci.yml` has not executed remotely yet (no `origin` remote configured).

## Checkpoints
| Date | Reviewer | Scope | Result |
|---|---|---|---|
| — | — | — | — |
