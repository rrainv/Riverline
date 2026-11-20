# State

Updated at the end of every session. The next session starts here.

**Last updated:** 2026-11-21, Wave 2 Feel, Craft & Settings on branch `feat/wave-2-feel-and-settings` (branched from `feat/wave-1-core-utility`)

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
- **Checkpoint P1-1 honesty & speed pass (`perf/checkpoint-and-speed`, `C1`–`C8`, `P2-3`, `P3-2`, `C9` subset):**
  - **Honesty (`C1` / P1-1):** `reviewStore.ts` + `ReviewRoom.tsx` now check `resp.data.exact`; preflop sampled known-card decisions and preflop all-in luck badge `Estimated` with sample count (`review.decision.tierSampledDetail`, `review.luck.tierSampledDetail`) and never raise `isMathMistake` on sampled equity.
  - **Storage & Hydration (`C2`–`C3`):** `createCachingStudyBackend` (`src/domain/storage/eventLog.ts`) caches `seq`-sorted events in memory, coalesces concurrent reads, updates incrementally on writes, broadcasts cross-tab invalidations on `BroadcastChannel('riverline-study-v1-sync')`, clears on `db.onversionchange`, and drops redundant `.sort()`/`.reduce()` scans; `home`, `strategy`, `training`, `nights`, and `learn` stores coalesce concurrent `hydrate()` calls.
  - **UI & Compositor (`C4`, `P2-3`, `P3-2`, `C9`):** Removed panel/rail `backdrop-filter: blur(14px)`, migrated `SettingsRoom` onto `<Panel as="div">`, updated `EquityRoom` header `--text` contrast, added `langSignal`, and converted `HomeRoom` activity bars to `transform: scaleY(...)`.
  - **Worker & Equity Engine (`C5`–`C8`):** Shared singleton Worker client (`getSharedEngineClient()`) across all 8 stores, opt-in `>= 50ms` throttled `reportProgress` in `engine/worker-handler.ts`, `>= 12ms` time-sliced yields in `engine/equity.ts` & `engine/weighted-equity.ts`, and LRU cache + sequenced runout execution + microtask `triggerRecompute()` coalescing + frozen `IDLE_RUNOUT_SNAPSHOT` in `equityStore.ts`.
- **QA Batch C P0/P1/P2 fixes (`fix/qa-batch-c`, `docs/DECISIONS.md` §W):**
  - Fixed `CardPicker` card-1 -> card-2 showdown reveal (`closeOnSelect`), `HandRoom` post-betting chip cleanup + duplicate heading removal, and `Overlay` close `aria-label` (`kit.overlay.close`).
  - Preserved `unknown !== fold` on Strategy Leak Map (`knownCombos === 0 -> deltaPoints: null`), excluded unset/`0` families from `LeakLab`, showed `openCombos` in footers and real `sampleHandsCount` in the footnote.
  - Fixed Hebrew RTL `SegmentedControl` indicator (`top: 0; left: 0`), `direction: ltr` in `PokerNotation`, `tNodes` token isolation in `ReviewRoom` & `TrainingHubView`, and `HandRoom` header wrap flex basis.
  - Fixed Heads-up Duel call/pot amounts, `allIn.amountToMilliBb` `All-in` dispatch & `100`/`97.5 bb` sizing, localized action grammar & bubbles, card-glyph + street `equityTitle`, and locked `"Show equity vs any two"` row to face-down `"Any two cards"`.
  - Switched `Review` counterfactual range eval to `method: 'auto'` + `rangeSampled`, and reframed revealed-hand behind-price alerts into hindsight comparison alongside thinking notes & villain ranges.
  - Fixed `RunoutExplorerPanel` loading struck cards + duplicate `Escape`, `OptionTickets` page-level keyboard shortcuts, `AppShell` Focus-mode `Escape` + single `TopBar` label, `FactTile` `unitPosition` (`₪250`), settled Nights status/gate wording, and copy cleanup (`TERMINOLOGY.md`, `/hand`, `hand(s)`).
  - **Gates (post-final code edit on `fix/qa-batch-c`, all exit 0):**
    - `npm run typecheck`: `tsc --noEmit` -> exit 0
    - `npm test`: `54 passed (54)` files, `193 passed (193)` tests -> exit 0
    - `npm run golden`: `2 passed (2)` files, `5 passed (5)` tests (`eqexact.py` matches `tools/golden/section8.golden.json`) -> exit 0
    - `npm run check:raw`: `check-no-raw-values: ok` -> exit 0
    - `npm run audit:layout -- --room=hand,review,equity,strategy,training,nights,learn,home`: `checked 924 states across 7 themes x 3 languages x 2 viewports | failures: 0 | page errors: 0` -> exit 0
    - `npm run audit:theme -- --room=hand,review,equity,strategy,training,nights,learn,home --no-build`: `runs: 22 | failed runs: 0 | page errors: 0` -> exit 0
- **Checkpoint cleanup + #82 Inline Equity Overlay (`feat/inline-equity-and-polish`):**
  - Aligned the 3 `engine/personal-strategy/baseline.ts` off-by-1 cutoff entries (`BTN QJs: 8 / Q3s`, `SB Kxs: 7 / K5s`, `SB QJs: 5 / Q6s`) with tests; completed `P2-2` (`compareCallEquityToRequired` in `engine/economics-facts.ts` + `EngineSyncApi` + `reviewStore.ts`), `P3-1` (`--dur-notice` token across `tokens/`, `DurationToken`, `EquityRoom.tsx`, `HandRoom.tsx`), `P3-3` (deterministic default `occurredAt` in `engine/training/grade.ts`), and `C9` (`AnimatedPotValue` in `FeltTable.tsx`, `TypedCalloutText` in `Lamp.tsx`).
  - Built `#82` / `#82a` **Inline Equity Overlay**: pure display `EquityOverlay` drawer (`src/ui/kit/equity-overlay/`), shared `buildRunoutHeatGridRows` (`src/ui/rooms/equity/equityFormatters.tsx`), and shared `InlineEquityDrawer` (`src/ui/rooms/equity/InlineEquityDrawer.tsx`) wired with 22 i18n keys (`en`/`ru`/`he`) across Review, Hand, Quick drill, and Heads-up duel.
  - **Gates (post-final code edit on `feat/inline-equity-and-polish`, all exit 0):**
    - `npm run typecheck`: `tsc --noEmit` -> exit 0
    - `npm test`: `55 passed (55)` files, `198 passed (198)` tests -> exit 0
    - `npm run golden`: `2 passed (2)` files, `5 passed (5)` tests (`eqexact.py` matches `tools/golden/section8.golden.json`) -> exit 0
    - `npm run check:raw`: `check-no-raw-values: ok` -> exit 0
    - `npm run audit:layout`: `checked 1660 states across 7 themes x 3 languages x 2 viewports | failures: 0 | page errors: 0` -> exit 0
    - `npm run audit:theme -- --no-build`: `runs: 42 | failed runs: 0 | page errors: 0` -> exit 0
- **Wave 1 — Core Everyday Utility (`feat/wave-1-core-utility`):**
  - **Storage & Notes:** Additive optional `handNote?: string` (`SavedHandPayload`, `SavedHandAnnotatedPayload`, `shorthandCompiler`) and `sessionNote?: string` (`NightSessionUpdatedPayload`, `NightSessionRecord`, preserved under `schemaVersion: 1`); multiline `<TextField>` (`multiline`, `rows`, `Ctrl`/`Cmd+Enter`); multiline decision & hand summary notes across Hand and Review (`reviewStore.setHandSummaryNote` + `handNote` search in `SavedLibraryView`); editable night session notes in `NightsLedgerView` (disabled when settled).
  - **Game Night real hand capture & `/hand` return:** Added Hero 2-card `CardPicker` slots, 6/8 seats, Hero position selector, 30–100 bb stack presets, and hand notes in `NightsHandsView` (`nightsStore`); wired `configureFromNight` and `"Back to tonight's game"` return navigation between Nights and Hand.
  - **Saved Library Inspector, Rich `Ctrl K` Palette, & Cross-Room Bridges:** Added sticky 2-column `FeltTable` + notes inspector in `SavedLibraryView`; grouped `CommandPalette` (`CommandPaletteItem`, overlay contrast tokens only) searching Rooms, Saved Hands & Notes, Learn Concepts, and Game Nights; wired `returnContextSignal`, `equityStore.loadExternalMatchup`, `"Open in Equity"`, `"Back to {room}"`, and `"Drill this"` across Hand, Review, Equity, and Training.
  - **Gates (post-final code edit on `feat/wave-1-core-utility`, all exit 0):**
    - `npm run typecheck`: `tsc --noEmit` -> exit 0
    - `npm test`: `55 passed (55)` files, `210 passed (210)` tests -> exit 0
    - `npm run golden`: `2 passed (2)` files, `5 passed (5)` tests (`eqexact.py` matches `tools/golden/section8.golden.json`) -> exit 0
    - `npm run check:raw`: `check-no-raw-values: ok` -> exit 0
    - `npm run audit:layout -- --room=nights,hand,review,equity,home,kit`: `checked 1308 states across 7 themes x 3 languages x 2 viewports | failures: 0 | page errors: 0` -> exit 0
    - `npm run audit:theme -- --room=nights,hand,review,equity,home,kit --no-build`: `runs: 42 | failed runs: 0 | page errors: 0` -> exit 0

- **Wave 2 — Feel, Craft & Settings (`feat/wave-2-feel-and-settings`):**
  - **Extended Appearance & Preferences (`tokens/tokens.css`, `src/domain/appearance.ts`):** Added token overrides (`data-corners`, `data-head-weight`, `data-card-face`, `data-card-back`, `data-accent` light/dark WCAG variants, `[data-cards='minimal']`), backwards-compatible preferences (`minimalCards`, `cornerStyle`, `headingWeight`, `cardFace`, `cardBack`, `accentPreset`, `customTheme` with live WCAG 2.1 `4.5:1` contrast evaluation, `teacherVoice`, `askBeforeVerdict`, `shortcuts` with collision detection & normalized matching).
  - **Storage Counts & Wipe (`src/domain/storage/eventLog.ts`):** Added `clearAllEvents()`, `getStorageCounts()`, and `clearAllData()` on `StudyRepository` with `BroadcastChannel` cache clearing (`schemaVersion: 1` preserved).
  - **Full 7-Section LOCKED `SettingsRoom` (`src/ui/rooms/SettingsRoom.tsx` + `src/ui/rooms/settings/`):** Built Appearance (7 themes, 6 accent swatches, custom palette + WCAG contrast warning, corner radius, heading weight, card face/back + live `PlayingCard` preview), Table & Motion (pace, reduced motion, minimal card animation, typing speed + live sample replay), Teacher (`showLamp`, `teacherVoice` blunt/gentle comparison, `askBeforeVerdict`), Language (EN/RU/HE), Shortcuts (8 actions click-to-rebind with clash check & reset), Data (stored counts, JSON backup export/import, `navigator.storage.persist()`, type-to-confirm `"Delete all data"` dialog), and About & Legal (18+ study-only, RTA policy, silent audio status, licences), wired into `SideRail`, `TopBar`, `CommandPalette`, and `__riverlineTest.setState`.
  - **Live Card/Chip Motions, Rebound Shortcuts, & `Lamp` Polish:** Wired `PlayingCard` (`deal`/`flip`/`fold`) and `FeltTable` (`chipsToPotTrigger`/`chipsToPotSeats`) into `HandRoom`, `HeadsUpDuelView`, `QuickDrillView`, and `ReviewRoom` (honoring `reduced` & `minimalCards`); wired `matchesShortcutEvent` in `AppShell`, `OptionTickets`, `HandRoom`, `HeadsUpDuelView`, and `InlineEquityDrawer`; honored `askBeforeVerdict` & `teacherVoice` in `ReviewRoom` without changing numbers or honesty tiers; polished all 8 `Lamp` SVG moods to match `lamp-moods.html` using tokens only. Audio remains silent per `B11` pending curated CC0 recordings.
  - **Gates (post-final code edit on `feat/wave-2-feel-and-settings`, all exit 0):**
    - `npm run typecheck`: `tsc --noEmit` -> exit 0
    - `npm test`: `56 passed (56)` files, `228 passed (228)` tests -> exit 0
    - `npm run golden`: `2 passed (2)` files, `5 passed (5)` tests (`eqexact.py` matches `tools/golden/section8.golden.json`) -> exit 0
    - `npm run check:raw`: `check-no-raw-values: ok` -> exit 0
    - `npm run audit:layout -- --room=settings,hand,training,review,home,kit`: `checked 1308 states across 7 themes x 3 languages x 2 viewports | failures: 0 | page errors: 0` -> exit 0
    - `npm run audit:theme -- --room=settings,hand,training,review,home,kit --no-build`: `runs: 42 | failed runs: 0 | page errors: 0` -> exit 0

## What is next
1. Proceed to **Wave 3 — Perf & Engine Foundations** from [`docs/GAP_AUDIT.md`](GAP_AUDIT.md) (route/locale/`/kit` code splitting to trim `1,054.58 kB` bundle, streaming Runout Explorer + `C0` benchmark, exact 169×169 preflop lookup `#90` + offline HU Push/Fold Nash `D6` + multi-spot preflop tables, `Table Rules v1`, and `Session Report`), and curate licensed CC0 foley audio (`B11`) when recordings are ready.
2. Manual visual/UX verification pass on `feat/wave-2-feel-and-settings`, plus confirmation of `ENGINE_SPEC_SOLVER_WASM.md` gate `G1` and comment-aligned `baseline.ts` values (`Q3s`, `K5s`, `Q6s`).
3. Git remote (`origin`) setup and CI execution.

## Open with the owner
- Curated CC0 / licensed acoustic foley recordings (`B11`) when ready to add sound.
- Wave 3 go-ahead (`dist/assets/index-*.js` code splitting, streaming Runout Explorer, 169×169 preflop lookup + HU Push/Fold Nash, `Table Rules v1`, `Session Report`).
- Decision on `ENGINE_SPEC_SOLVER_WASM.md` gate `G1` (offline solver tool vs runtime Worker), and final confirmation of the comment-aligned `engine/personal-strategy/baseline.ts` values (`Q3s`, `K5s`, `Q6s`).
- Pick Wave 4 differentiator priority (`#84` Commitment River + `#93` Rules Lab vs `#83` Range Walk + `#88` Texture Sort + `#91` Blocker X-Ray vs `#86` Morning-after Receipt).

## Known gaps
- All remaining items previously listed here from `docs/CHECKPOINT_AND_PERF.md` (`P2-2`, `P3-1`, `P3-3`, and `FeltTable`/`Lamp` per-frame isolation) and the unscoped all-room 7-theme Playwright sweep (`1660` layout states, `42` theme runs on `feat/inline-equity-and-polish`) are complete.
- CC0 foley audio (`B11`), minor unbuilt catalogued micro-choreography transitions + instant-confirm setting (`C3`), and Wave 3–4 planned items (route code splitting, streaming Runout Explorer, 169×169 lookup, Push/Fold Nash, `Table Rules v1`, `Session Report`, `Home` Seats alternative, `Weekly letter`, `XP / Level`, `My poker` saved player/group manager, Morning-after receipt `#49`/`#86`, `top X%` shorthand syntax, `"Can I call?"` strip, intuition trainer, and postflop personal strategy rules `#81`) remain queued. See [`docs/GAP_AUDIT.md`](GAP_AUDIT.md) for the full planned-vs-built inventory.
- `.github/workflows/ci.yml` has not executed remotely yet (no `origin` remote configured).

## Checkpoints
| Date | Reviewer | Scope | Result |
|---|---|---|---|
| 2026-11-17 | Claude (read-only) + local verification | Checkpoint & Perf Audit (`docs/CHECKPOINT_AND_PERF.md`) | P1-1 fixed; C1–C8 + Vibrancy pass verified |
| 2026-11-19 | Live QA + `fix/qa-batch-c` | QA Batch C P0/P1/P2 fixes across Hand, Strategy, Training/Duel, Review, Equity, Nights, & RTL | All 6 gates exit 0 (`54/54` files, `193/193` tests, `924` layout states, `22` theme runs) |
| 2026-11-19 | `feat/inline-equity-and-polish` | Baseline alignment, `P2-2`, `P3-1`, `P3-3`, `C9`, & `#82`/`#82a` Inline Equity Overlay across Review, Hand, and Training | All 6 gates exit 0 (`55/55` files, `198/198` tests, `1660` layout states, `42` theme runs) |
| 2026-11-20 | `feat/wave-1-core-utility` | Wave 1 Core Utility (Game Night quick hand capture & session notes, multiline notes, Saved Library felt inspector, grouped `Ctrl K` search, & cross-room Equity/Training bridges) | All 6 gates exit 0 (`55/55` files, `210/210` tests, `1308` scoped layout states, `42` theme runs) |
| 2026-11-21 | `feat/wave-2-feel-and-settings` | Wave 2 Feel, Craft & Settings (live deal/fold/flip & chip-flight wiring, full 7-section SettingsRoom, WCAG custom palette checker, shortcuts rebinding, Data persistence/wipe, About & Legal, Lamp SVG polish) | All 6 gates exit 0 (`56/56` files, `228/228` tests, `1308` scoped layout states, `42` theme runs) |
