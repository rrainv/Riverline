# State

Updated at the end of every session. The next session starts here.

**Last updated:** 2026-11-15, Review & Saved library slice (`src/ui/rooms/review/`, `src/domain/review/`, `src/engine-api/` replay & §8 economics, unified `saved_hand.*` library, `EquityRow` & `ReviewRoom` contrast/layout fixes)

## What is true now
- Repository seeded on `main` (`0ab0621`); `feat/hand-recorder` holds Hand Recorder (`/hand`), and `feat/review` holds the Review (`/review`) and unified Saved library slice.
- Strict TypeScript + Vite + Preact (`@preact/signals`) + CSS Modules shell built in F1a/F1b, bundled local variable fonts (`Inter` + `Rubik`), licences recorded in `docs/THIRD_PARTY.md`. Node 22+ `localStorage` Vitest warning silenced via `--no-experimental-webstorage` in `vite.config.ts`.
- Seven themes (`midnight`, `felt`, `slate`, `dusk`, `contrast`, `daylight`, `paper`), three table paces (`calm`, `normal`, `fast`), reduced motion, `showLamp`, `teacherTypingSpeed`, and three locales (`en`, `ru`, `he` with RTL mirroring, `Intl.PluralRules`, `Intl.NumberFormat`, `tNodes()`, `<PokerNotation>`) persisted in `localStorage` (`riverline.appearance.v1`), plus `--beat-action` and `--beat-think` motion tokens in `tokens/` (`docs/BUG_INBOX.md` #3 resolved).
- All 18 kit components (`src/ui/kit/`) and `/kit` state matrix harness are live, plus Equity, Hand Recorder, and Review kit extensions (`FeltTable` 8-seat `SLOTS_EIGHT` layout & cleared bet-pill coordinates, `EquityRow` wrapping range pill at `168px` & `barTone`, `HeatGrid` `variant="runout"`, `SideRail`, `OptionTickets`, `TokenInput`, `HistoryRail`, `CardPicker`, `Panel`).
- Clean-room strict-TS engine (`engine/`, zero DOM/window/storage/network) and typed Worker API (`src/engine-api/`) exposing hand replay projection (`projectReplayState`), `initializeRecordedHand`, `createGameRulesSnapshot` v2, `legalActions`, `applyAction`, `applyChance`, `applyPrivateReveal`, `resolveShowdown`, `actorCallEconomics`, `actionSizeFacts`, weighted range equity, and §8 all-in equity/luck helpers.
- **Single shorthand grammar (`src/domain/shorthand/`):** `parsePlayerHandInput` & `buildRangeMatrixMask` for hands/ranges plus `parseActionShorthandToken`, `validateActionShorthandToken`, and `tokenizeActionShorthandLine` (`f`, `x`/`k`, `c`, `allin`/`ai`/`jam`, `b<N>`/`r<N>` with optional `~` approximate marker, `/`, and compact/single card codes).
- **Storage (`src/domain/storage/`):** `riverline-study-v1` IndexedDB append-only event log (with in-memory test backend) storing `saved_matchup.*` and `saved_hand.*` (`created`, `archived`, additive `saved_hand.restored` and `saved_hand.annotated` with `tags` + `heroNotes`), and `schemaVersion: 1` JSON backup export/import.
- **Review & Saved library room (`src/ui/rooms/review/`, `src/domain/review/`):** Built-in §8 Friday showdown starter sample alongside hands/spots saved from `/hand`; step-by-step replay (`projectReplayState` without leaking hidden villain cards before showdown, `StreetStrip`, `HistoryRail`, optional `FeltTable`, decision tabs); Decision panel (`requiredEquityPct`, `heroEquityPct`, `deltaVsRequiredPct`, per-decision thinking note editing, counterfactual villain ranges `showed` / `tight` / `standard` / `loose` graded `Estimated · opponent assumption` with `isMathMistake: false`); **Decisions vs luck** panel strictly under `Exact · known cards` (`Unavailable` when incomplete/mucked) showing both `callVsFoldEvBb` (`-38.8 bb` on Friday showdown) and `handEvBb` (`-48.8 bb`), `runoutLuckBb` (`-51.2 bb`), `actualNetBb` (`-100.0 bb`), and RTL-safe `scaleX` decomposition bars; unified Saved library tab (`filter`, `sort`, seat filter, search, tags, open in Review or `Open in Recorder`, archive/restore, JSON export/import).
- **Hand recorder room (`src/ui/rooms/hand/`, `src/domain/hand/`):** Two table rules presets (`6-max · 100 bb · 0.5/1 bb` default and `Home game · 50 bb · ₪0.5/₪1` selectable 6 or 8 seats), Hero seat & hole card setup, `FeltTable` (`mode="hand"`), `OptionTickets`, `HeatGrid` (`variant="runout"`), `TokenInput` shorthand mode, thinking reason chips + note, `HistoryRail`, `"Open in Review"` save button (`SavedHandsView.tsx` removed and `Saved hands` SideRail item routed to `/review` `saved` tab; `adaptSavedPayloadForRecorder` adapts HU/`buttonSeat` hands into `/hand`), and trilingual copy (`en`, `ru`, `he` + `<PokerNotation>`).
- **Equity by rows room (`src/ui/rooms/equity/`, `src/domain/equity/`):** Board (5 slots, `CardPicker`, Random/Clear), 2–10 rows, inline range thumbnail + drawer, single header `<TierBadge>`, Street stepper, reused 4×13 `HeatGrid`, hero-effect buckets, river hand distribution, SideRail saved matchups.
- **Gates (post-final edit, all exit 0):**
  - `npm run typecheck`: `tsc --noEmit` -> exit 0
  - `npm run check:raw`: `check-no-raw-values: ok` -> exit 0
  - `npm run golden`: 2 files, 5 tests passed (live engine vs `tools/eqexact.py`) -> exit 0
  - `npm test`: 40 files, 137 tests passed -> exit 0
  - `npm run audit:layout`: `audit:layout checked 1220 states across 7 themes x 3 languages x 2 viewports | failures: 0 | page errors: 0` -> exit 0
  - `npm run audit:theme`: `audit:theme runs: 42 | failed runs: 0 | page errors: 0` -> exit 0

## What is next
1. Owner visual, product, and linguistic review of `/review` (Replay, counterfactual villain ranges, `callVsFoldEvBb` vs `handEvBb`, Saved library), `/hand`, and `/equity` (`en`, `ru`, `he` across all 7 themes).
2. Next slice (Strategy `/strategy`, or as selected by the owner) per `docs/HOW_A_ROOM_IS_BUILT.md`.
3. Remaining room slices (`training`, `nights`, `learn`) and optional timed replay playback (`--beat-action` auto-step play/pause).
4. Add git remote (`origin`) and push to run `.github/workflows/ci.yml`.

## Open with the owner
- Visual & linguistic review of `Review (/review)` (including `Decisions vs luck` and Saved library), `Hand recorder (/hand)`, and `Equity by rows (/equity)` across English, Russian, Hebrew, and all 7 themes.
- Confirm target for the next slice (e.g. `Strategy (/strategy)`).
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
