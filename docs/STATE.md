# State

Updated at the end of every session. The next session starts here.

**Last updated:** 2026-11-15, Hand recorder slice (`src/ui/rooms/hand/`, `src/domain/hand/`, `parseActionLine.ts`, `saved_hand.*` storage, `FeltTable` 8-seat & bet-slot fix, Bug #3 `--beat-action`/`--beat-think`, scoped daily layout matrix)

## What is true now
- Repository seeded on `main` (`0ab0621`); `feat/hand-recorder` branch holds the Hand Recorder (`/hand`) slice on top of `Equity by rows`.
- Strict TypeScript + Vite + Preact (`@preact/signals`) + CSS Modules shell built in F1a/F1b, bundled local variable fonts (`Inter` + `Rubik`), licences recorded in `docs/THIRD_PARTY.md`. Node 22+ `localStorage` Vitest warning silenced via `--no-experimental-webstorage` in `vite.config.ts`.
- Seven themes (`midnight`, `felt`, `slate`, `dusk`, `contrast`, `daylight`, `paper`), three table paces (`calm`, `normal`, `fast`), reduced motion, `showLamp`, `teacherTypingSpeed`, and three locales (`en`, `ru`, `he` with RTL mirroring, `Intl.PluralRules`, `Intl.NumberFormat`, `tNodes()`, `<PokerNotation>`) persisted in `localStorage` (`riverline.appearance.v1`), plus `--beat-action` and `--beat-think` motion tokens in `tokens/` (`docs/BUG_INBOX.md` #3 resolved).
- All 18 kit components (`src/ui/kit/`) and `/kit` state matrix harness are live, plus Equity and Hand Recorder kit extensions (`FeltTable` 8-seat `SLOTS_EIGHT` layout & cleared bet-pill coordinates at `1366x768`, `EquityRow` inline 13×13 range SVG + `barTone`, `HeatGrid` `variant="runout"`, `SideRail`, `OptionTickets`, `TokenInput`, `HistoryRail`, `CardPicker`, `Panel`).
- Clean-room strict-TS engine (`engine/`, zero DOM/window/storage/network) and typed Worker API (`src/engine-api/`) exposing `initializeRecordedHand`, `createGameRulesSnapshot` v2, `legalActions`, `applyAction`, `applyChance`, `applyPrivateReveal`, `resolveShowdown`, `actorCallEconomics`, and `actionSizeFacts`.
- **Single shorthand grammar (`src/domain/shorthand/`):** `parsePlayerHandInput` & `buildRangeMatrixMask` for hands/ranges plus `parseActionShorthandToken`, `validateActionShorthandToken`, and `tokenizeActionShorthandLine` (`f`, `x`/`k`, `c`, `allin`/`ai`/`jam`, `b<N>`/`r<N>` with optional `~` approximate marker, `/`, and compact/single card codes).
- **Storage (`src/domain/storage/`):** `riverline-study-v1` IndexedDB append-only event log (with in-memory test backend) storing both `saved_matchup.*` and `saved_hand.*` (`completed_hand` and `mid_hand_spot`), hero thinking notes, archive events, and `schemaVersion: 1` JSON backup export/import.
- **Hand recorder room (`src/ui/rooms/hand/`, `src/domain/hand/`):** Two table rules presets (`6-max · 100 bb · 0.5/1 bb` default and `Home game · 50 bb · ₪0.5/₪1` selectable 6 or 8 seats), Hero seat & hole card setup, `FeltTable` (`mode="hand"`, travelling active-seat ring, action bubbles), `OptionTickets` (select-then-confirm, pot share/SPR ladder from `engine.sync`, `~` approximate toggle, `"Everyone else folds to you"`), `HeatGrid` (`variant="runout"`) + `"Random street"` board picker, showdown opponent card reveal & settlement, `TokenInput` shorthand mode, `"What were you thinking?"` 5 reason chips + note field, `HistoryRail`, `SavedHandsView` (`Record hand` / `Saved hands` SideRail tabs), and trilingual copy (`en`, `ru`, `he` + `<PokerNotation>`).
- **Equity by rows room (`src/ui/rooms/equity/`, `src/domain/equity/`):** Board (5 slots, `CardPicker`, Random/Clear), 2–10 rows, inline range thumbnail + drawer, single header `<TierBadge>`, Street stepper, reused 4×13 `HeatGrid`, hero-effect buckets, river hand distribution, SideRail saved matchups.
- **Gates (post-final edit, all exit 0):**
  - `npm run typecheck`: `tsc --noEmit` -> exit 0
  - `npm run check:raw`: `check-no-raw-values: ok` -> exit 0
  - `npm run golden`: 2 files, 5 tests passed (live engine vs `tools/eqexact.py`) -> exit 0
  - `npm test`: 38 files, 131 tests passed -> exit 0
  - `npm run audit:layout`: 1176 states across 7 themes × 3 languages × 2 viewports (scoped `fullSet` + `kit_*`, including 4 `hand*` presets), `failures: 0 | page errors: 0` -> exit 0
  - `npm run audit:theme`: 42 runs (3557/3318 full runs, 1521/1510 `kit_*` runs), `failed runs: 0 | page errors: 0` -> exit 0

## What is next
1. **Slice 2: Review (`/review`):** Inspect saved `completed_hand` and `mid_hand_spot` records from `riverline-study-v1`, step-by-step replay via `projectReplayState`, pot-odds / MDF / SPR / all-in luck facts (`section8`), and street-by-street decision review.
2. Owner visual, feel, and linguistic review of `/hand` and `/equity` (`en`, `ru`, `he` across all 7 themes, especially `Home game · 50 bb · ₪0.5/₪1` 8-seat layout and shorthand line ergonomics).
3. Remaining room slices (`strategy`, `training`, `nights`, `learn`) per `docs/HOW_A_ROOM_IS_BUILT.md`.
4. Add git remote (`origin`) and push to run `.github/workflows/ci.yml`.

## Open with the owner
- Visual & linguistic review of `Hand recorder (/hand)` and `Equity by rows (/equity)` across English, Russian, Hebrew, and all 7 themes.
- Git remote URL (`origin`) when ready to push branches / PRs.

## Known gaps
- `lookupStrategy`, `generateTrainingDrill`, and `gradeTrainingAnswer` on `src/engine-api` intentionally return `tier: 'unavailable'` until Strategy and Training slices land.
- `Home game · 8 seats` is exercised via unit tests and `FeltTable` (`SLOTS_EIGHT`), while the automated Playwright `f1-states.mjs` presets currently capture the 6-max `hand` states (`raise`, `flop_grid`, `typed_error`, `done`).
- `top X%` shorthand syntax, saved opponent ranges (`Dan`), `"Can I call?"` strip, intuition trainer, and cross-room Review/Training deep links remain deferred (`docs/IDEA_BANK.md` #80).
- `.github/workflows/ci.yml` has not executed remotely yet (no `origin` remote configured).

## Checkpoints
| Date | Reviewer | Scope | Result |
|---|---|---|---|
| — | — | — | — |
