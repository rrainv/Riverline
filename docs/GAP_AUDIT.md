# Planned vs. Built Gap Audit

**Date:** 2026-11-20 · **Branch:** `feat/inline-equity-and-polish`

All 8 dock rooms (`/`, `/hand`, `/review`, `/strategy`, `/training`, `/nights`, `/equity`, `/learn`), `/settings`, `/kit`, and all 6 verification gates (`typecheck`, `55/55` test files / `198/198` tests, `golden`, `check:raw`, `1,660`-state layout sweep, `42`-run theme sweep) are live and green.

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
  - **Night-level Session Report** (combined hands logged and all-in luck across the night) and **Morning-after Receipt** export (`#49`/`#86`).

---

## 2. Notes, Annotations, Search & Connected Workspaces (Priority: Critical — Wave 1 Core Complete)

**What exists today:** Multiline per-decision notes & **hand-level summary notes** (`handNote`) across `HandRoom` and `ReviewRoom`, 3 fixed library tags (`review_later`, `unsure`, `study`), `handNote` + decision-note search in `SavedLibraryView`, a **sticky 2-column `FeltTable` + notes inspector** in `SavedLibraryView`, a **grouped `Ctrl K` Command Palette** indexing Rooms, Saved Hands & Notes, Learn Concepts (EN/RU/HE), and Game Nights, `"Pin to decision note"` in `InlineEquityDrawer`, and **cross-room bridges** (`"Open in Equity"` from Hand/Review/Library with `"Back to {room}"` return context, plus `"Drill this"` from Review/Equity into Training).

**Remaining gaps in code & docs:**
- **Extended note scopes:** Still missing persistent **opponent/player notes** ("My Poker"), post-review reflection notes (`#92`), and Strategy **Teacher notes / Plan history** (`06_PRODUCT_MAP.md` §2.3).
- **Saved Library filters & tags (`NORTH_STAR.md` §7.7):** Still limited to 3 hard-coded tags (no custom tags, tag suggestions, or collections) and missing structured **poker-fact filters** (street, pot type, effective stack depth).
- **Command Palette Settings deep-links:** `06_PRODUCT_MAP.md` §2.11 also envisioned jumping directly to individual **Settings sections** (to be wired when Wave 2 builds full Settings).

---

## 3. Making the App Feel Alive: Motion, Visual Craft, Sound, & Full Settings (Priority: High)

**What exists today:** Tokenized colours/motion curves across all 7 themes (`tokens/tokens.css`), 8 Lamp moods in `/kit`, `FeltTable` & `PlayingCard` CSS keyframes in `/kit`, and a minimal `SettingsRoom` (Theme, Pace, Reduced motion, Language).

**Verified gaps in code & docs:**
- **Card & chip animations built in `/kit` are not wired into live rooms:** `PlayingCard` (`motion="deal" | "fold" | "flip"`) and `FeltTable` (`chipFlights`) have **zero call sites in `src/ui/rooms/`**. Real tables in Hand, Duel, Quick Drill, Review, and Equity swap cards and pots abruptly instead of dealing/flipping, tossing folded cards face-down to the muck (`DECISIONS.md` A4.1), or arcing chips to the pot (`A4.10`).
- **Missing catalogued choreography moments (`04_DESIGN_SPEC.md` §6.4, `MOTION_SPEC.md`):**
  - Workspace switch transition (#14) and panel content crossfades.
  - Saved Library FLIP list filtering (#19) & archive-with-undo (#40).
  - Invalid-input nudge (#20), circular theme reveal (#22), Game Night settle gate brass→jade + transfer draw (#23), Review luck-moment equity line draw (#27), Learn path node draw (#28), and street felt lighting (`#16`).
- **Visual craft & Lamp fidelity (owner QA 2026-11-16 & 2026-11-17):** Owner noted the Lamp illustration still falls short of `lamp-moods.html`, screens still read flat/monotone relative to `riverline-app.html` floating panel depth and accents, and MixBar/Strategy visual contrast needs another polish pass.
- **Audio (`NORTH_STAR.md` §7.15, `DECISIONS.md` A2.16, B11):** **0% built** (zero audio assets or sound player module in `src/` or `public/`). Needs real CC0 / licensed card and chip foley recordings (no synthesized placeholder sounds per `B11`) synced with table pace plus mute and volume controls.
- **Missing LOCKED Settings & Data Safety controls (`DECISIONS.md` A3.11, C3, C16, `06_PRODUCT_MAP.md` §2.9):**
  - `SettingsRoom.tsx` exposes only **4 settings**, omitting even `showLamp` and `teacherTypingSpeed` which already exist in `src/domain/appearance.ts` (`lines 33-48`).
  - Missing **Custom theme editor** (bg/panel/text/accent + live 4.5:1 contrast readout), accent swatches, corner radius (`sharp`/`soft`/`round`), heading font & weight, card back (`forest`/`lattice`/`brass`), and card face (`ivory`/`white`/`slate`) with live preview.
  - Missing **minimal card animation** toggle and **instant vs select-then-confirm** setting (`C3`).
  - Missing **Teacher** panel (blunt vs gentle coach, weekly letter toggle, ask-before-verdict toggle).
  - Missing **Shortcuts** reference & rebinding with clash check.
  - Missing **Data** panel in Settings (stored counts, Backup Export/Import surfaced alongside Saved Library, `navigator.storage.persist()` status `#36`, and **type-to-confirm "Delete all data"** `C16`).
  - Missing **About & Legal** section (real-time-assistance warning `#59`, study-only notice, third-party licences).

---

## 4. Inline Equity & Full Equity Room Depth (Priority: High)

**What exists today:** `EquityRoom` (2–10 rows, exact + MC, 13×13 thumbnails, 47-card runout grid, saved matchups) and the first slice of `#82` `InlineEquityDrawer` (`E`/`Escape`, Review/Hand/Training, next-card stepping, pin to note).

**Verified gaps in code & docs:**
- **`InlineEquityDrawer.tsx` limits (`lines 49-50`, `142-235`):**
  - Restricted to `showed`, `any`, and 3 fixed templates (`tight`/`standard`/`loose`) — cannot enter a custom villain range, load your own Personal Strategy range for that spot, or evaluate **multiway** (3+ active players in a recorded hand).
  - Preflop falls back to 8,000-sample MC (`Estimated`) instead of an exact preflop lookup table (`#90`).
  - `"Pin to decision note"` appends formatted plain text into `customText` rather than storing structured calculation context alongside the pin (Hand, Review, and Saved Library now expose room-level `"Open in Equity"` buttons, though the drawer itself does not yet offer a direct `"Open in Equity"` jump).
- **Full Equity Room (`EQUITY_BY_ROWS_SPEC.md` §§5–8, `NORTH_STAR.md` §7.4):**
  - Missing `"Can I call?"` pot/bet calculator strip (`#74`).
  - Missing `top X%` shorthand syntax and saved player profile range lookup (`Dan`).
  - Range input is text-only (no interactive visual 13×13 matrix editor or direct Strategy range picker).
  - Missing Range-vs-Range UX polish, selectable runout perspective (Villain vs Hero), and hover cross-highlighting between effect groups (`flush`, `straight`, `board_pair`) and runout grid cells.
  - Missing specified keyboard shortcuts (`/`, `A`, `G`, `S`, `[`, `]`, `Delete` with undo) — currently `EquityRoom.tsx:154-158` only binds `Escape`.
  - Missing **Equity Intuition Trainer** (`#23` / `#80`).

---

## 5. Performance & Optimization (Priority: High)

**Already delivered (`C1`–`C9`):** Event-log in-memory cache + `BroadcastChannel`, coalesced `hydrate()`, opaque panel `backdrop-filter` removal, shared singleton Worker client, opt-in progress messages, time-sliced yields, LRU equity cache, `langSignal`, and `FeltTable`/`Lamp` animation isolation.

**Verified remaining optimization gaps:**
- **Monolithic `989.17 kB` main bundle (`dist/assets/index-*.js`, `App.tsx`, `vite.config.ts`):** `App.tsx` eagerly imports all 8 rooms, all 8 domain stores, `/kit` (`KitSheet`), and all 3 locale catalogues in one bundle. Splitting lazy route chunks, `/kit`, and non-active locales will cut initial parse and room startup work significantly.
- **Unmeasured `C0` runtime profile (`CHECKPOINT_AND_PERF.md` Part C):** No browser benchmark has yet measured multi-hundred-hand IndexedDB switches, Worker `setTimeout(0)` 4ms nesting clamps vs `MessageChannel` yields, or 1366×768 GPU cost from `FloatingDock` blur over scrollcontainers.
- **Batch-only Runout Explorer (`engine/runout-explorer.ts`):** Evaluates all 45–52 turn/river cards before returning a single result instead of streaming cells progressively as they complete.
- **Whole-room signal subscriptions (`CHECKPOINT_AND_PERF.md` B4 #2–#3):** `App.tsx` reads multiple store signals at root and creates fresh callbacks per render; `EquityRoom.tsx` reads both `equitySnapshotSignal` and `runoutSnapshotSignal` at component top level (triggering 4 whole-room re-renders per recompute).
- **Unbounded log scaling (`C10`):** Every `saved_hand.*` event embeds its full `pokerState`; IndexedDB has no `type` index or separate summary index for multi-season histories.

---

## 6. Core Study Rooms: Planned Features Still Missing (Priority: Medium–High)

- **Training (`src/ui/rooms/training/`):**
  - **Session Report (`session_report`):** `HeadsUpDuelView.tsx:310-345` ends matches with a minimal 2-line summary instead of the designed Session Report (raw result + variance caveat, exact all-in Decisions vs Luck, 3 key moments, watching tendencies, per-hand strip).
  - **Full Hand vs 5 bots (`full_hand_*` + Watch-rest speed)** and **Orbit sessions** (rotating positions, stack carry, rebuys).
  - **Card-aware bot lineup & `"Read the table"` (`duel-bot.ts`):** Only Astra is implemented (`chooseDuelBotAction` with basic preflop/category heuristics); missing Lyra/Orion/Vega/Nebula, configurable style presets/sliders, and hidden-style `"Read the table"` deduction + reveal.
  - **Spaced repetition / review queue** (24h / FSRS `#55`), **auto-next**, **"why is this due?"**, **Estimation / Equity intuition trainer (`#23`)**, and **Range recall quiz**.
- **Personal Strategy (`src/ui/rooms/strategy/`):**
  - **Multi-spot preflop baselines (`ENGINE_SPEC_PREFLOP_MULTISPOT.md`):** Only 6-max 100 bb RFI has baseline coverage; `30/40/50/60 bb`, `8-max`, `facing_open`, `facing_3bet`, `limp_iso`, and `push_fold` remain `Unavailable` (`drill.ts` uses `handStrengthScore` fallbacks for facing-open/3-bet).
  - **Plan vs Actual Play comparison (`06_PRODUCT_MAP.md` §1.7):** Leak Map currently diffs Plan vs Estimated Baseline, not Plan vs Recorded Play.
  - **First-session Leak Scan (`scan_*`)**, **mixed-action exact % + interval bounds** (`NORTH_STAR.md` §7.1), **Plan History**, **Teacher notes**, and **Postflop strategy rules (`#81`)**.
- **Hand Recorder & Review (`src/ui/rooms/hand/`, `src/ui/rooms/review/`):**
  - **Table Rules v1 (`NORTH_STAR.md` §6.1):** `HandRoom` offers only 2 fixed presets (`6-max 100 bb` and `Home game 50 bb ₪0.5/₪1`); missing custom blinds, straddles, antes, rake, and uneven per-seat stacks (`#27`).
  - **Share Card (`share_card_image` / `share_card_text`):** Designed in mockups (private by default), unbuilt.
  - **Hand-history / phone-note import (`Paste a history`, PokerStars/GGPoker/loose notes `#96`).**
  - **Review Replay polish:** Playback speed controls (`#14`), unified **Street Ribbon** (`#71`), **Key moments** tagging (`NORTH_STAR.md` §7.6), and **Retry before reveal** (`#25`).
- **Home, Learn, Engine & Release:**
  - **Onboarding flow (`DECISIONS.md` A2.14):** Skippable `"Where do you play?"` → setup → first diagnostic → first review.
  - **Weekly Teacher Letter (`weekly_letter`)**, **Home `Seats` layout (`home_seats`)**, **XP / Level / Stickers / Achievements (`A2.12`)**.
  - **Contextual glossary tooltips** & **`"Explain like..."` depth control** (`round-2 #5`).
  - **Exact 169×169 Preflop Lookup (`#90`)**, **Offline HU Push/Fold Nash (`ENGINE_SPEC_PREFLOP_MULTISPOT.md` D6)**, and **DCFR Solver (`ENGINE_SPEC_SOLVER_WASM.md` Gate `G1`)**.
  - **PWA / installable app (`F6`)**, git `origin` remote, and live CI execution.

---

## 7. Recommended Sequence ("Core First, Then Fun")

| Wave | Focus | Status | Key Deliverables |
|---|---|---|---|
| **Wave 1 — Core Everyday Utility** | Make logging, notes, and cross-room flow feel complete | **DONE (`feat/wave-1-core-utility`)** | `NightsHandsView` hero cards / 6–8 seats / seat selector / 30–100 bb stack presets / hand note + Ledger session notes + `/hand` `configureFromNight` & return action; multiline per-decision & `handNote` summary notes + search; Saved Library sticky `FeltTable` inspector; grouped `Ctrl K` search (`rooms`, `hands`, `concepts`, `nights`); `"Open in Equity"` + `"Back to {room}"` + `"Drill this"`. |
| **Wave 2 — Feel, Craft & Settings** | Hit the mockup bar & honour LOCKED choices | **NEXT** | Wire `PlayingCard` deal/fold/flip & `FeltTable` `chipFlights` into live rooms; build full `SettingsRoom` (custom theme, accent, card styles, `showLamp`/`teacherTypingSpeed`, shortcuts, Data backup/persist/wipe, About/Legal); polish Lamp & colour vibrancy; add real CC0 foley audio. |
| **Wave 3 — Perf & Engine Foundations** | Speed, exact math, & missing room backbones | QUEUED | Route/locale/`/kit` code splitting (cut `989.17 kB` bundle); streaming Runout Explorer + `C0` benchmark; exact 169×169 preflop lookup (`#90`) + offline HU Push/Fold Nash (`D6`) + multi-spot preflop tables; `Table Rules v1` & `Session Report`. |
| **Wave 4 — High-Impact Differentiators** | Deep study & fun ("R&D + brainstorm") | QUEUED | `#84` Commitment River + `#93` Rules Lab; `#83` Range Walk + `#88` Texture Sort + `#91` Blocker X-Ray (reusing `engine/range-analysis.ts`); `#92` Thinking Mirror; `#86` Morning-after Receipt; Full Hand / Orbit / card-aware bots; DCFR solver pilot (pending Gate `G1`). |
