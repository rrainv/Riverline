# State

Updated at the end of every session. The next session starts here.

**Last updated:** 2026-11-19, Vibrancy & Depth pass (`main` `629a2a0`) + Checkpoint P1-1 honesty & C1–C8 speed pass on branch `perf/checkpoint-and-speed`

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
  - **Gates (post-final code edit on `perf/checkpoint-and-speed`, all exit 0):**
    - `npm run typecheck`: `tsc --noEmit` -> exit 0
    - `npm test`: `54 passed (54)` files, `190 passed (190)` tests -> exit 0
    - `npm run golden`: `2 passed (2)` files, `5 passed (5)` tests (`eqexact.py` matches `tools/golden/section8.golden.json`) -> exit 0
    - `npm run check:raw`: `check-no-raw-values: ok` -> exit 0
    - `npm run audit:layout -- --room=review,equity,home,settings,strategy,training --only-new`: `checked 88 states across 7 themes x 3 languages x 2 viewports | failures: 0 | page errors: 0` -> exit 0
    - `npm run audit:layout -- --room=settings,home,equity --no-build`: `checked 286 states across 7 themes x 3 languages x 2 viewports | failures: 0 | page errors: 0` -> exit 0
    - `npm run audit:theme -- --room=review,equity,home,settings,strategy,training --only-new --no-build`: `runs: 22 | failed runs: 0 | page errors: 0` -> exit 0
    - `npm run audit:theme -- --room=settings,home,equity --no-build`: `runs: 22 | failed runs: 0 | page errors: 0` -> exit 0

## What is next
1. Owner speed/visual check on `http://localhost:5173` (vibrancy & depth pass, un-blurred panels, preflop sampled Review behavior, room switch latency).
2. Confirm the 3 `engine/personal-strategy/baseline.ts` index/comment mismatches (`Q2s`/`Q3s`, `K4s`/`K5s`, `Q5s`/`Q6s`) and choose the first feature prototype to build (`#82` Inline Equity Overlay, `#83` Range Walk, or `#84` Commitment River).
3. Pre-release full all-room 7-theme Playwright sweep (`npm run audit:layout` + `npm run audit:theme` without `--room`/`--only-new`), git remote (`origin`), and CI execution.

## Open with the owner
- Speed and visual feel check of the Vibrancy & Depth pass + `perf/checkpoint-and-speed` changes.
- Decision on the 3 `engine/personal-strategy/baseline.ts` entries (`BTN QJs: Q2s vs Q3s`, `SB Kxs: K4s vs K5s`, `SB QJs: Q5s vs Q6s`) and `ENGINE_SPEC_SOLVER_WASM.md` gate `G1` (offline solver tool vs runtime Worker).
- Pick next feature slice (`#82` Inline Equity Overlay, `#83` Range Walk, `#84` Commitment River, or `Settings` expansion).

## Known gaps
- Remaining items from `docs/CHECKPOINT_AND_PERF.md` not in Slice 1 (`P2-2` moving Review's `0.05%` call verdict rule into `engine/`, `P3-1` extracting Equity/Hand timer constants to tokens, `P3-3` optional `occurredAt` clock injection in `engine/training/grade.ts`, and `FeltTable`/`Lamp` per-frame ref isolation) remain optional follow-ups.
- `tools/audit-layout.mjs` and `tools/audit-theme.mjs` ran scoped across `review,equity,home,settings,strategy,training`; full cross-room pre-release sweep (`hand`, `nights`, `learn`, `kit`) remains for before final release merge.
- `Home` Seats alternative (`home_seats`), `Weekly letter`, `XP / Level`, full `Settings` panels (custom theme editor, shortcuts, data wipe), `My poker` saved player/group manager, shareable Morning-after PNG receipt card (`docs/IDEA_BANK.md` #49), `top X%` shorthand syntax, `"Can I call?"` strip, intuition trainer, inline equity overlay (`#82`), and postflop personal strategy rules (`#81`) remain deferred.
- `.github/workflows/ci.yml` has not executed remotely yet (no `origin` remote configured).

## Checkpoints
| Date | Reviewer | Scope | Result |
|---|---|---|---|
| 2026-11-17 | Claude (read-only) + local verification | Checkpoint & Perf Audit (`docs/CHECKPOINT_AND_PERF.md`) | P1-1 fixed; C1–C8 + Vibrancy pass verified |
