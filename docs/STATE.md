# State

Updated at the end of every session. The next session starts here.

**Last updated:** 2026-11-16, Home slice (`src/domain/home/`, `src/ui/rooms/home/`, shared `weeklySummary`, `HeatGrid` `compact`, `App.tsx` cross-room deep-links, `homePreset` audit states)

## What is true now
- Repository seeded on `main` (`0ab0621`); `feat/hand-recorder`, `feat/review`, `feat/strategy`, `feat/training`, `feat/nights`, and now `feat/home` hold Rooms `/`, `/hand`, `/review`, `/strategy`, `/training`, and `/nights` (only `/learn` remains on `EmptyRoom`).
- Strict TypeScript + Vite + Preact (`@preact/signals`) + CSS Modules shell built in F1a/F1b, bundled local variable fonts (`Inter` + `Rubik`), licences recorded in `docs/THIRD_PARTY.md`. Node 22+ `localStorage` Vitest warning silenced via `--no-experimental-webstorage` in `vite.config.ts`.
- Seven themes (`midnight`, `felt`, `slate`, `dusk`, `contrast`, `daylight`, `paper`), three table paces (`calm`, `normal`, `fast`), reduced motion, `showLamp`, `teacherTypingSpeed`, and three locales (`en`, `ru`, `he` with RTL mirroring, `Intl.PluralRules`, `Intl.NumberFormat`, `tNodes()`, `<PokerNotation>`) persisted in `localStorage` (`riverline.appearance.v1`), plus `--beat-action` (`480ms`) and `--beat-think` (`720ms`) motion tokens in `tokens/` read cleanly via `readTableBeatMs()` in `src/ui/kit/state.ts`.
- All 18 kit components (`src/ui/kit/`) and `/kit` state matrix harness are live, plus Room kit extensions (`FeltTable` 3-seat/HU/8-seat slots; `OptionTickets` presets & `.kbd` contrast fix; `Stepper` `unitPosition?: 'prefix' | 'suffix'`; `Chip` `--text` contrast fix; `EquityRow`; `HeatGrid` including `compact?: boolean`; `FamilyStrip`; `TeacherCallout` & `MixBar`; `SideRail`; `TokenInput`; `HistoryRail`; `CardPicker`; `Panel`).
- Clean-room strict-TS engine (`engine/`, zero DOM/window/storage/network) and typed Worker API (`src/engine-api/`) exposing equity, hand transitions, `projectReplayState`, `actorCallEconomics`, `actionSizeFacts`, personal strategy, training drills & Astra duel, and `engine/home-game/`.
- **Single shorthand grammar (`src/domain/shorthand/` + `src/domain/hand/shorthandCompiler.ts`):** `parsePlayerHandInput` & `buildRangeMatrixMask` for hands/ranges plus `parseActionShorthandToken` (including optional `position` tokens `UTG..BB`), `validateActionShorthandToken`, `tokenizeActionShorthandLine`, and shared `compileShorthandTokensToState`.
- **Storage (`src/domain/storage/`):** `riverline-study-v1` IndexedDB append-only event log (with in-memory test backend) storing `saved_matchup.*`, `saved_hand.*`, `strategy_rule.set`, `strategy_evidence.recorded`, `training_session.recorded`, and `night_*`, plus `schemaVersion: 1` JSON backup export/import.
- **Home continuity hub (`/`, `src/domain/home/`, `src/ui/rooms/home/`):**
  - **Coach layout (`HomeRoom`):** `Lamp` (`128px`) with time-of-day greeting, honest study summary, compact 4-row `HeatGrid` (`compact`, `variant="leakMap"`) snapshot showing `"Watching · n = ..."` below 20 recorded evidence samples and never treating zero-sample `unknown` cells as folds/leaks, plus `Open` link to `/strategy` Leak Map.
  - **Continuity & next steps:** `first_visit` honest starter vs `returning` up to 3 prioritized Next Steps (only step 1 uses `primary` fill), adaptive **Last game night** morning-after card (hidden when no nights exist), **This week** card with shared 7-day rolling aggregation (`computeWeeklyStudySummary` / `computeTrainingWeekStats` reused by `TrainingStore`), 7-day token activity bars, `"Training ›"` header link, and data-backed `"Try this"` offers with one-click deep-links across `/training`, `/strategy`, `/review`, `/hand`, `/equity`, and `/nights`.
- **Game Night, Training, Personal Strategy, Review & Saved library, Hand recorder, Equity by rows rooms:** Live and covered by unit/golden suites.
- **Gates (post-final code edit on `feat/home`, all exit 0):**
  - `npm run typecheck`: `tsc --noEmit` -> exit 0
  - `npm test`: `51 passed (51)` files, `177 passed (177)` tests -> exit 0
  - `npm run golden`: `2 passed (2)` files, `5 passed (5)` tests (`eqexact.py` matches `tools/golden/section8.golden.json`) -> exit 0
  - `npm run check:raw`: `check-no-raw-values: ok` -> exit 0
  - `npm run audit:layout -- --room=home --only-new`: `checked 66 states across 7 themes x 3 languages x 2 viewports | failures: 0 | page errors: 0` -> exit 0
  - `npm run audit:theme -- --room=home --only-new --no-build`: `runs: 22 | failed runs: 0 | page errors: 0` -> exit 0

## What is next
1. Owner visual, product, and linguistic review of `/` (`HomeRoom`: `home`, `home_first_visit`, `home_night_after` across `en`, `ru`, `he` and all 7 themes).
2. Next slice: **Slice 7 — Learn (`/learn`)** (or `Settings` expansion / pre-release sweep as chosen by the owner).
3. Pre-release full all-room 7-theme Playwright sweep (`npm run audit:layout` + `npm run audit:theme` without `--room`/`--only-new`), git remote (`origin`), and CI execution.

## Open with the owner
- Visual & linguistic review of `Home (/)` across English, Russian, Hebrew, and all 7 themes.
- Confirm next slice (`Learn (/learn)` vs `Settings` full panel vs `Weekly letter`).
- Git remote URL (`origin`) when ready to push branches / PRs.

## Known gaps
- `tools/audit-layout.mjs` and `tools/audit-theme.mjs` ran scoped to `--room=home --only-new` on this slice per Slice 6 speed instructions; a full cross-room pre-release sweep will run before merging branches to `main`.
- `Home` Seats alternative (`home_seats`), `Weekly letter`, `XP / Level`, `Learn (/learn)`, `My poker` saved player/group manager, shareable Morning-after PNG receipt card (`docs/IDEA_BANK.md` #49), `top X%` shorthand syntax, `"Can I call?"` strip, intuition trainer, inline equity overlay (`#82`), and postflop personal strategy rules (`#81`) remain deferred.
- `.github/workflows/ci.yml` has not executed remotely yet (no `origin` remote configured).

## Checkpoints
| Date | Reviewer | Scope | Result |
|---|---|---|---|
| — | — | — | — |
