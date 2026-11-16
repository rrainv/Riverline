# State

Updated at the end of every session. The next session starts here.

**Last updated:** 2026-11-16, Bug Batch B (`#7` Review 3-column layout, `#8` Hand/Learn/QuickDrill `1440×900` fit, `#10` Strategy/Nights empty-state polish) on branch `fix/bug-batch-b`

## What is true now
- Repository seeded on `main` (`0ab0621`); `feat/hand-recorder`, `feat/review`, `feat/strategy`, `feat/training`, `feat/nights`, `feat/home`, and now `feat/learn` cover all 8 dock rooms (`/`, `/hand`, `/review`, `/strategy`, `/training`, `/nights`, `/equity`, `/learn`), `/settings` (Appearance starter), and `/kit` (`EmptyRoom` removed).
- Strict TypeScript + Vite + Preact (`@preact/signals`) + CSS Modules shell built in F1a/F1b, bundled local variable fonts (`Inter` + `Rubik`), licences recorded in `docs/THIRD_PARTY.md`. Node 22+ `localStorage` Vitest warning silenced via `--no-experimental-webstorage` in `vite.config.ts`.
- Seven themes (`midnight`, `felt`, `slate`, `dusk`, `contrast`, `daylight`, `paper`), three table paces (`calm`, `normal`, `fast`), reduced motion, `showLamp`, `teacherTypingSpeed`, and three locales (`en`, `ru`, `he` with RTL mirroring, `Intl.PluralRules`, `Intl.NumberFormat`, `tNodes()`, `<PokerNotation>`) persisted in `localStorage` (`riverline.appearance.v1`), plus `--beat-action` (`480ms`) and `--beat-think` (`720ms`) motion tokens in `tokens/` read cleanly via `readTableBeatMs()` in `src/ui/kit/state.ts`.
- All 18 kit components (`src/ui/kit/`) and `/kit` state matrix harness are live, plus Room kit extensions (`FeltTable` 3-seat/HU/8-seat slots; `OptionTickets` presets & `.kbd` contrast fix; `Stepper` `unitPosition?: 'prefix' | 'suffix'`; `Chip` `--text` contrast fix; `EquityRow`; `HeatGrid` including `compact?: boolean`; `FamilyStrip`; `TeacherCallout` & `MixBar`; `SideRail`; `TokenInput`; `HistoryRail`; `CardPicker`; `Panel`).
- Clean-room strict-TS engine (`engine/`, zero DOM/window/storage/network) and typed Worker API (`src/engine-api/`) exposing equity, hand transitions, `projectReplayState`, `actorCallEconomics`, `actionSizeFacts`, personal strategy, training drills & Astra duel, and `engine/home-game/`.
- **Single shorthand grammar (`src/domain/shorthand/` + `src/domain/hand/shorthandCompiler.ts`):** `parsePlayerHandInput` & `buildRangeMatrixMask` for hands/ranges plus `parseActionShorthandToken` (including optional `position` tokens `UTG..BB`), `validateActionShorthandToken`, `tokenizeActionShorthandLine`, and shared `compileShorthandTokensToState`.
- **Storage (`src/domain/storage/`):** `riverline-study-v1` IndexedDB append-only event log (with in-memory test backend) storing `saved_matchup.*`, `saved_hand.*`, `strategy_rule.set`, `strategy_evidence.recorded`, `training_session.recorded`, `night_*`, `learn_concept.updated`, and `learn_trainer.recorded`, plus `schemaVersion: 1` JSON backup export/import.
- **Learn (`/learn`, `engine/learn/`, `src/domain/learn/`, `src/ui/rooms/learn/`):**
  - **Guided concept path:** 9 concepts (`Pot odds`, `Equity`, `Ranges`, `Blockers`, `Position`, `SPR and commitment`, `Bluffing and fold equity`, `Value betting`, `Why multiway is different`) openable in any order, with exact engine-computed worked examples (`potOddsFacts`, `calculateEquityExact`, `conditionHoldemRange`, `playersBehindForPosition`, `deriveStackToPotRatio`, `deriveMinimumDefenseFrequency`), persistent `Understood` state, and `"Drill it in Training"` deep-link.
  - **Exact Pot-odds & Outs quick trainer:** One-click instant grading via `OptionTickets` (`showConfirm={false}`, `outcome?: 'correct' | 'wrong'`), exact pot-odds spots and structural draw-outs spots (`createRangeAnalysisFacts` `drawOuts.uniqueCompletionCardCount` counting overlaps once without double-counting), and persistent first-try accuracy counters per mode.
  - **Trilingual glossary & Honest limits:** Full EN/RU/HE glossary from `docs/TERMINOLOGY.md` with category filters and instant search across all 3 languages (`LearnGlossaryView`), plus **Where Riverline is weak** (`LearnWeaknessesView`) with `Estimated`/`Unavailable` `TierBadge` disclosures and direct room links.
- **Home continuity hub (`/`, `src/domain/home/`, `src/ui/rooms/home/`):**
  - **Coach layout (`HomeRoom`):** `Lamp` (`128px`) with time-of-day greeting, honest study summary, compact 4-row `HeatGrid` (`compact`, `variant="leakMap"`) snapshot showing `"Watching · n = ..."` below 20 recorded evidence samples and never treating zero-sample `unknown` cells as folds/leaks, plus `Open` link to `/strategy` Leak Map.
  - **Continuity & next steps:** `first_visit` honest starter vs `returning` up to 3 prioritized Next Steps (only step 1 uses `primary` fill), adaptive **Last game night** morning-after card (hidden when no nights exist), **This week** card with shared 7-day rolling aggregation (`computeWeeklyStudySummary` / `computeTrainingWeekStats` reused by `TrainingStore`), 7-day token activity bars, `"Training ›"` header link, and data-backed `"Try this"` offers with one-click deep-links across `/training`, `/strategy`, `/review`, `/hand`, `/equity`, and `/nights`.
- **Game Night, Training, Personal Strategy, Review & Saved library, Hand recorder, Equity by rows rooms:** Live and covered by unit/golden suites.
- **Bug Batch B (`fix/bug-batch-b`, `docs/BUG_INBOX.md` `#7`, `#8`, `#10` Fixed):**
  - **Review (`#7`):** Reorganized `ReviewRoom` into top hand summary bar (`PlayingCard`s `small`, starter chip, `HAND_TAGS`, quick actions, and `Total` net bb readout), 3 floating columns (`Hero's decisions` + `Hand replay` controls & toggleable history / `Decision` dense equity rows + counterfactual villain range + thinking note / `Decisions vs luck` two `FactTile`s + three decomposition bars + standalone `TeacherCallout`), and standalone bottom `StreetStrip` clearing `FloatingDock` at `1440×900`.
  - **1440×900 Fit (`#8`):** Compacted `FeltTable` (`274px`) and single-row `OptionTickets` grid (`minmax(108px, 1fr)`), moved `Recorded action line` + `Undo step` to the top right column in `HandRoom` (with `What were you thinking?` below the felt), moved `priceBox` above `Estimated baseline mix` with raise ladder open only on Raise in `QuickDrillView`, and tightened `LearnRoom` (`Path & trainer` + compact 2-entry `Poker glossary`) to clear `FloatingDock` at `1440×900` with `overflowPx: 0`. Also increased `PlayingCard` `.faceLayer` gap (`2px` -> `4px`) and set `HandRoom` `.roomSubtitle` to `--text`.
  - **Empty States (`#10`):** Added progress bar + honest `"Pick any open spot..."` empty guidance banner, `--well` contrast separation, `--line2` borders, hatched `cannot_happen` cells, and hover micro-lifts to `SpotMapView`; added trilingual `NightsEmptyState` (`PlayingCardPair` mark, `New night` CTA, and 3 capability cards) across empty Ledger/Hands/Settle tabs plus `nights_empty` preset (`tools/f1-states.mjs`) with zero fake data (`A3.12`).
- **Gates (post-final code edit on `fix/bug-batch-b`, all exit 0):**
  - `npm run typecheck`: `tsc --noEmit` -> exit 0
  - `npm test`: `54 passed (54)` files, `187 passed (187)` tests -> exit 0
  - `npm run golden`: `2 passed (2)` files, `5 passed (5)` tests (`eqexact.py` matches `tools/golden/section8.golden.json`) -> exit 0
  - `npm run check:raw`: `check-no-raw-values: ok` -> exit 0
  - `npm run audit:layout -- --room=review,hand,learn,strategy,nights --only-new`: `checked 308 states across 7 themes x 3 languages x 2 viewports | failures: 0 | page errors: 0` -> exit 0
  - `npm run audit:theme -- --room=review,hand,learn,strategy,nights --only-new --no-build`: `runs: 22 | failed runs: 0 | page errors: 0` -> exit 0

## What is next
1. Owner visual, product, and linguistic review of `Review`, `Hand`, `Learn`, `Quick drill`, `Strategy`, and `Nights` empty states at `1440×900` across English, Russian, Hebrew, and all 7 themes.
2. Next slice: **Settings expansion** (Appearance customiser, Motion, Teacher, Language, Shortcuts, Data export/wipe) or **Pre-release full all-room 7-theme sweep & branch integration** as chosen by the owner.
3. Pre-release full all-room 7-theme Playwright sweep (`npm run audit:layout` + `npm run audit:theme` without `--room`/`--only-new`), git remote (`origin`), and CI execution.

## Open with the owner
- Visual & linguistic review of Bug Batch B (`#7`, `#8`, `#10`) plus `/learn`.
- Confirm next slice (`Settings` full panel vs `Weekly letter` vs pre-release sweep & merge).
- Git remote URL (`origin`) when ready to push branches / PRs.

## Known gaps
- `tools/audit-layout.mjs` and `tools/audit-theme.mjs` ran scoped to `--room=review,hand,learn,strategy,nights --only-new` on this batch per daily-slice instructions; a full cross-room pre-release sweep will run before merging branches to `main`.
- `Home` Seats alternative (`home_seats`), `Weekly letter`, `XP / Level`, full `Settings` panels (custom theme editor, shortcuts, data wipe), `My poker` saved player/group manager, shareable Morning-after PNG receipt card (`docs/IDEA_BANK.md` #49), `top X%` shorthand syntax, `"Can I call?"` strip, intuition trainer, inline equity overlay (`#82`), and postflop personal strategy rules (`#81`) remain deferred.
- `.github/workflows/ci.yml` has not executed remotely yet (no `origin` remote configured).

## Checkpoints
| Date | Reviewer | Scope | Result |
|---|---|---|---|
| — | — | — | — |
