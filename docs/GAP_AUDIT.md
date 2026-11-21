# Planned vs. Built Gap Audit

**Date:** 2026-11-21 · **Branch:** `main` (merged from `feat/wave-4-differentiators`)

All 8 dock rooms (`/`, `/hand`, `/review`, `/strategy`, `/training`, `/nights`, `/equity`, `/learn`), `/settings`, `/kit`, all 4 planned waves (`Wave 1`–`Wave 4`), and all 6 unscoped verification gates (`typecheck`, `56/56` test files / `236/236` tests, `golden`, `check:raw`, `1,792`-state layout sweep, `42`-run theme sweep, and 8-chunk `< 300 kB` production build) are live and green.

However, most rooms shipped as initial first-pass slices while recent sessions focused on QA stabilization (`Bug Batch A/B/C`, `P1-1`) and creative R&D (`EXPLORATION_IDEAS.md`). Several foundational capabilities planned in `docs/DECISIONS.md`, `docs/handoff/06_PRODUCT_MAP.md`, `docs/handoff/04_DESIGN_SPEC.md`, `docs/design/docs/EQUITY_BY_ROWS_SPEC.md`, `docs/reference/NORTH_STAR.md`, `docs/reference/MOTION_SPEC.md`, `docs/CHECKPOINT_AND_PERF.md`, and owner feedback sessions (2026-11-16 through 2026-11-20) are still incomplete or unbuilt.

This document separates **Core Must-Have Gaps ("Before Fun")** from **Performance/Engine Foundations** and **High-Impact Differentiators**.

---

## 1. Game Night: Actual Hand Logging & Home-Game Flow (Priority: Critical — Wave 1 Partial)

**What exists today:** Exact-integer ledger (`engine/home-game/`), buy-ins/rebuys/cash-outs, append-only corrections, settlement readiness balance gate, fewest-transfers settlement, reopen settled night, `NightsPastView`, **Night-level Session Notes** in `NightsLedgerView` (disabled when settled), **enhanced `NightsHandsView` quick hand capture** (Hero 2-card `CardPicker`, 6/8 seats, Hero position selector, 30–100 bb stack depth, multiline hand note), and `/hand` context handoff (`configureFromNight`) + `"Back to tonight's game"` return action.

**Remaining gaps in code & docs:**
- **Quick shorthand still single-hero-focused:** Logging directly in `NightsHandsView` still cannot assign named ledger players to specific seats, customize uneven per-seat stacks, or enter opponent showdown reveals without switching to `"Record full hand"` (`/hand`).
- **Missing planned Game Night foundations (`NORTH_STAR.md` §7.9, `DECISIONS.md` C10–C11):**
  - Night-level **date** field & **blinds / stakes / chip-rate** metadata at creation (`NightsCreateDialog.tsx`).
  - **Banker settlement** option (currently fewest-transfers only).
  - Persistent **"My Poker" saved people / rosters / presets** manager (`NightsCreateDialog` only offers recent-name suggestion chips).
  - Dedicated **phone Game Night layout** (`phone-game-night.html`) and **thumb keypad** (`#50`).
  - **Night-level Session Report** (combined hands logged and all-in luck across the night); **Morning-after Receipt v2** (`#49`/`#86`) is **SHIPPED in Wave 4** (`NightsSettleView.tsx` with name/amount/hand toggles, copy, and `.txt` export).

---

## 2. Notes, Annotations, Search & Connected Workspaces (Priority: Critical — Wave 1 & Wave 2 Core Complete)

**What exists today:** Multiline per-decision notes & **hand-level summary notes** (`handNote`) across `HandRoom` and `ReviewRoom`, 3 fixed library tags (`review_later`, `unsure`, `study`), `handNote` + decision-note search in `SavedLibraryView`, a **sticky 2-column `FeltTable` + notes inspector** in `SavedLibraryView`, a **grouped `Ctrl K` Command Palette** indexing Rooms (including individual Settings sections), Saved Hands & Notes, Learn Concepts (EN/RU/HE), and Game Nights, `"Pin to decision note"` in `InlineEquityDrawer`, and **cross-room bridges** (`"Open in Equity"` from Hand/Review/Library with `"Back to {room}"` return context, plus `"Drill this"` from Review/Equity into Training).

**Remaining gaps in code & docs:**
- **Extended note scopes:** Still missing persistent **opponent/player notes** ("My Poker"), post-review reflection notes (`#92`), and Strategy **Teacher notes / Plan history** (`06_PRODUCT_MAP.md` §2.3).
- **Saved Library filters & tags (`NORTH_STAR.md` §7.7):** Still limited to 3 hard-coded tags (no custom tags, tag suggestions, or collections) and missing structured **poker-fact filters** (street, pot type, effective stack depth).

---

## 3. Making the App Feel Alive: Motion, Visual Craft, Sound, & Full Settings (Priority: High — Wave 2 Complete Except Licensed Audio & Micro-Choreography)

**What exists today:** Tokenized colours/motion curves across all 7 themes + `data-*` user appearance tokens (`tokens/tokens.css`), polished 8-mood `Lamp` SVG matching `lamp-moods.html` + `TeacherCallout` typing speeds, live `PlayingCard` (`deal`/`flip`/`fold`) and `FeltTable` (`chipsToPotTrigger`/`chipsToPotSeats`) wired across `HandRoom`, `HeadsUpDuelView`, `QuickDrillView`, and `ReviewRoom` (honoring `reduced` & `minimalCards`), and the **full 7-section `SettingsRoom`** (Appearance + Custom palette with WCAG 4.5:1 contrast check + Accent presets + Corner radius + Heading weight + Card face/back with preview; Table & Motion + typing preview; Teacher `showLamp`/`teacherVoice`/`askBeforeVerdict`; EN/RU/HE Language cards; Shortcuts rebinding with clash check; Data counts/Export/Import/`navigator.storage.persist()`/type-to-confirm Wipe; About & Legal with 18+/RTA/Licences).

**Remaining verified gaps in code & docs:**
- **Missing catalogued micro-choreography moments (`04_DESIGN_SPEC.md` §6.4, `MOTION_SPEC.md`):**
  - Workspace switch transition (#14) and panel content crossfades.
  - Saved Library FLIP list filtering (#19) & archive-with-undo (#40).
  - Invalid-input nudge (#20), circular theme reveal (#22), Game Night settle gate brass→jade + transfer draw (#23), Review luck-moment equity line draw (#27), Learn path node draw (#28), and street felt lighting (`#16`).
- **Audio (`NORTH_STAR.md` §7.15, `DECISIONS.md` A2.16, B11):** **0% built** (zero audio assets or sound player module in `src/` or `public/`). Waiting on real CC0 / licensed card and chip foley recordings (no synthesized placeholder sounds per `B11`) synced with table pace plus mute and volume controls.
- **Remaining unbuilt minor Settings controls:** Instant vs select-then-confirm toggle (`C3`) and Weekly Teacher Letter toggle (letter itself unbuilt).

---

## 4. Inline Equity & Full Equity Room Depth (Priority: High)

**What exists today:** `EquityRoom` (2–10 rows, exact + MC, 13×13 thumbnails, 47-card runout grid, saved matchups) and the first slice of `#82` `InlineEquityDrawer` (`E`/`Escape`, Review/Hand/Training, next-card stepping, pin to note).

**Verified gaps in code & docs:**
- **`InlineEquityDrawer.tsx` limits (`lines 49-50`, `142-235`):**
  - Restricted to `showed`, `any`, and 3 fixed templates (`tight`/`standard`/`loose`) — cannot enter a custom villain range, load your own Personal Strategy range for that spot, or evaluate **multiway** (3+ active players in a recorded hand).
  - Preflop falls back to 8,000-sample MC (`Estimated`) instead of an exact preflop lookup table (`#90`).
  - `"Pin to decision note"` appends formatted plain text into `customText` rather than storing structured calculation context alongside the pin (Hand, Review, and Saved Library now expose room-level `"Open in Equity"` buttons, though the drawer itself does not yet offer a direct `"Open in Equity"` jump).
- **Full Equity Room (`EQUITY_BY_ROWS_SPEC.md` §§5–8, `NORTH_STAR.md` §7.4):**
  - **SHIPPED in Wave 4:** `"Can I call?"` & Commitment price strip (`#74` / `#84`), **Blocker X-Ray** (`#91`), and **Runout Volatility Shape** (`#94`).
  - Remaining optional extensions: `top X%` shorthand syntax, saved player profile range lookup (`Dan`), interactive 13×13 range matrix editor, Villain runout perspective toggle, hover cross-highlighting, additional single-key shortcuts (`/`, `A`, `G`, `S`, `[`, `]`, `Delete`), and **Equity Intuition Trainer** (`#23` / `#80`).

---

## 5. Performance & Optimization (Priority: High — Wave 3 Core Complete)

**Already delivered (`C1`–`C9` + Wave 3):** Event-log in-memory cache + `BroadcastChannel`, coalesced `hydrate()`, opaque panel `backdrop-filter` removal, shared singleton Worker client, opt-in progress messages, time-sliced yields, LRU equity cache + **24-permutation suit-isomorphism preflop cache key** (`canonicalizePreflopExactHoldings`), **streaming `onCardProgress` callback in `exploreRunouts`** (`engine/runout-explorer.ts`), **acyclic 8-chunk Rollup bundle splitting** (`vite.config.ts`, largest chunk `290.80 kB` down from `1,054.58 kB` with zero warnings), `langSignal`, and `FeltTable`/`Lamp` animation isolation.

**Verified remaining optimization gaps:**
- **Unmeasured `C0` runtime profile (`CHECKPOINT_AND_PERF.md` Part C):** Browser benchmark for multi-hundred-hand IndexedDB switches and 1366×768 GPU scroll cost remains optional follow-up.
- **Whole-room signal subscriptions (`CHECKPOINT_AND_PERF.md` B4 #2–#3):** `EquityRoom.tsx` still reads both `equitySnapshotSignal` and `runoutSnapshotSignal` at component top level.
- **Unbounded log scaling (`C10`):** Every `saved_hand.*` event embeds its full `pokerState`.

---

## 6. Core Study Rooms: Planned Features Still Missing (Priority: Medium–High)

- **Training (`src/ui/rooms/training/`):**
  - **Session Report (`session_report`):** **SHIPPED in Wave 3** (`HeadsUpDuelView.tsx` now renders the 10-hand variance note, interactive 10-hand log strip with hand inspector, Top 3 Key Moments by `|netBb|`, and observed opponent VPIP/PFR/C-bet/fold-to-bet tendencies).
  - **Full Hand vs 5 bots (`full_hand_*` + Watch-rest speed)** and **Orbit sessions** (rotating positions, stack carry, rebuys).
  - **Card-aware bot lineup & `"Read the table"` (`duel-bot.ts`):** Only Astra is implemented (`chooseDuelBotAction` with basic preflop/category heuristics); missing Lyra/Orion/Vega/Nebula, configurable style presets/sliders, and hidden-style `"Read the table"` deduction + reveal.
  - **Spaced repetition / review queue** (24h / FSRS `#55`), **auto-next**, **"why is this due?"**, **Estimation / Equity intuition trainer (`#23`)**, and **Range recall quiz**.
- **Personal Strategy (`src/ui/rooms/strategy/`):**
  - **Multi-spot preflop baselines (`ENGINE_SPEC_PREFLOP_MULTISPOT.md`):** Only 6-max 100 bb RFI has baseline coverage; `30/40/50/60 bb`, `8-max`, `facing_open`, `facing_3bet`, `limp_iso`, and `push_fold` remain `Unavailable` (`drill.ts` uses `handStrengthScore` fallbacks for facing-open/3-bet; waiting on owner-authored provenance tables per `D1`).
  - **Plan vs Actual Play comparison (`06_PRODUCT_MAP.md` §1.7):** Leak Map currently diffs Plan vs Estimated Baseline, not Plan vs Recorded Play.
  - **First-session Leak Scan (`scan_*`)**, **mixed-action exact % + interval bounds** (`NORTH_STAR.md` §7.1), **Plan History**, **Teacher notes**, and **Postflop strategy rules (`#81`)**.
- **Hand Recorder & Review (`src/ui/rooms/hand/`, `src/ui/rooms/review/`):**
  - **Table Rules v1 (`NORTH_STAR.md` §6.1):** **Core shipped in Wave 3** (`HandRoom` now supports 6 or 8 seats on both presets, configurable default stacks `30–200 bb`, ante modes `none` / `1 bb BB ante` / `0.2 bb per seat`, and per-seat uneven stack overrides; custom straddles and rake percentage rules remain future extensions).
  - **Share Card (`share_card_image` / `share_card_text`):** Designed in mockups (private by default), unbuilt.
  - **Hand-history / phone-note import (`Paste a history`, PokerStars/GGPoker/loose notes `#96`).**
  - **Review Replay polish:** Playback speed controls (`#14`), unified **Street Ribbon** (`#71`), **Key moments** tagging (`NORTH_STAR.md` §7.6), and **Retry before reveal** (`#25`).
- **Home, Learn, Engine & Release:**
  - **Onboarding flow (`DECISIONS.md` A2.14):** Skippable `"Where do you play?"` → setup → first diagnostic → first review.
  - **Weekly Teacher Letter (`weekly_letter`)**, **Home `Seats` layout (`home_seats`)**, **XP / Level / Stickers / Achievements (`A2.12`)**.
  - **Contextual glossary tooltips** & **`"Explain like..."` depth control** (`round-2 #5`).
  - **Exact 169×169 Preflop Lookup Table (`#90`)**, **Offline HU Push/Fold Nash (`ENGINE_SPEC_PREFLOP_MULTISPOT.md` D6)**, and **DCFR Solver (`ENGINE_SPEC_SOLVER_WASM.md` Gate `G1`)**.
  - **PWA / installable app (`F6`)**, git `origin` remote, and live CI execution.

---

## 7. Recommended Sequence ("Core First, Then Fun")

| Wave | Focus | Status | Key Deliverables |
|---|---|---|---|
| **Wave 1 — Core Everyday Utility** | Make logging, notes, and cross-room flow feel complete | **DONE (`feat/wave-1-core-utility`)** | `NightsHandsView` hero cards / 6–8 seats / seat selector / 30–100 bb stack presets / hand note + Ledger session notes + `/hand` `configureFromNight` & return action; multiline per-decision & `handNote` summary notes + search; Saved Library sticky `FeltTable` inspector; grouped `Ctrl K` search (`rooms`, `hands`, `concepts`, `nights`); `"Open in Equity"` + `"Back to {room}"` + `"Drill this"`. |
| **Wave 2 — Feel, Craft & Settings** | Hit the mockup bar & honour LOCKED choices | **DONE (`feat/wave-2-feel-and-settings`, audio pending B11)** | Live `PlayingCard` deal/fold/flip & `FeltTable` chip flights across Hand, Duel, Quick Drill & Review; full 7-section `SettingsRoom` (Appearance/Custom theme WCAG check/Accent/Cards, Motion/Typing, Teacher voice/ask-before-verdict, Language, Shortcuts rebind+clash, Data counts/Export/Import/`persist()`/type-to-confirm Wipe, About/Legal); polished `Lamp` SVG (`lamp-moods.html`) + global shortcuts. Real CC0 foley audio gated on licensed recording curation (`B11`). |
| **Wave 3 — Perf & Engine Foundations** | Speed, exact math, & missing room backbones | **DONE (`feat/wave-3-perf-and-engine-foundations`)** | Acyclic 8-chunk Rollup bundle splitting (`max 290.80 kB`, zero warnings); streaming `onCardProgress` in `exploreRunouts`; 24-permutation suit-isomorphism preflop cache (`canonicalizePreflopExactHoldings`); Hand Recorder `Table Rules v1` (6/8 seats, `30–200 bb` stacks, BB/per-seat ante modes, uneven per-seat stacks); Heads-Up Duel `Session Report` (variance note, 10-hand strip + hand inspector, Top 3 Key Moments, observed opponent tendencies). |
| **Wave 4 — High-Impact Differentiators** | Deep study & fun ("R&D + brainstorm") | **DONE (`feat/wave-4-differentiators`)** | Equity `"Can I call?"` & Commitment price strip (`#74` / `#84`, `Exact · price only`); **Blocker X-Ray** (`#91` via `engine.sync.analyzeRange`); **Runout Volatility Shape** (`#94` upgrades/bricks/dangers); Review/Saved Library **`"What Were You Thinking?"` Mirror** (`#92` with `Watching · n = ...` and reason filtering); Game Night **Morning-After Receipt v2** (`#86` with privacy toggles, copy & `.txt` export). |
