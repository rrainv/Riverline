# State

Updated at the end of every session. The next session starts here.

**Last updated:** 2026-11-15, Equity by rows slice (First study room `src/ui/rooms/equity/`, shorthand grammar, `riverline-study-v1` storage + JSON backup/restore, kit extensions, Section 2 golden parity, `docs/HOW_A_ROOM_IS_BUILT.md`)

## What is true now
- Repository seeded on `main` (`0ab0621`) from `repo-seed/`, `handoff/`, `design/`, `reference/`, `prompts/`, and `tokens/`. Added solid `MixBar` segment tokens and Teacher Lamp `--lamp-*` tokens across all 7 themes.
- Strict TypeScript + Vite + Preact (`@preact/signals`) + CSS Modules shell built in F1a/F1b, bundled local variable fonts (`Inter` + `Rubik`), licences recorded in `docs/THIRD_PARTY.md`.
- Seven themes (`midnight`, `felt`, `slate`, `dusk`, `contrast`, `daylight`, `paper`), three table paces (`calm`, `normal`, `fast`), reduced motion, `showLamp`, `teacherTypingSpeed`, and three locales (`en`, `ru`, `he` with RTL mirroring, `Intl.PluralRules`, `Intl.NumberFormat`, `tNodes()`, `<PokerNotation>`) persisted in `localStorage` (`riverline.appearance.v1`).
- All 18 kit components (`src/ui/kit/`) and `/kit` state matrix harness are live, plus Equity-slice kit extensions (`EquityRow` inline 13×13 range matrix SVG thumbnail + combo count + `barTone`, `HeatGrid` `variant="runout"` skipping struck cells on arrow/Home/End navigation, `SideRail` section list & `Overlay` `wide`, `TextField` target height fix & input preview/errors, `CardPicker`, and `.tier` pill background contrast).
- Clean-room strict-TS engine (`engine/`, 37+ `.ts` modules, `lib: ["ES2022"]`, zero DOM/window/storage/network) and typed Worker API (`src/engine-api/`) with `projectEquityHands`, `groupRunouts` (`'effect'`), `wins`/`ties`/`trials`, and `riverCategoryShares`.
- **Single shorthand grammar (`src/domain/shorthand/`):** `parsePlayerHandInput` & `buildRangeMatrixMask` handling exact cards, range notation (`QQ+`, `AKs`, `22-77`, `A5s-A2s`), and `any`/`?`/`random` (`top X%` and saved people deferred).
- **First storage slice (`src/domain/storage/`):** `riverline-study-v1` IndexedDB append-only event log (with in-memory test backend) storing saved matchups with fact-only titles, archive support, one-file JSON export, and `schemaVersion: 1` validated JSON import.
- **Equity by rows room (`src/ui/rooms/equity/`, `src/domain/equity/`):** Board (5 slots, `CardPicker`, Random/Clear), 2–10 rows in stable seat order (`roomy` / `dense` at 3+ / `compact` at 6+ auto-collapsing `"By the river you make"`), inline range thumbnail + drawer, single header `<TierBadge>` (`Exact · all N runouts` / `Estimated ± x · N samples`), `"Equity is not EV."`, optional Refine sample toggle (`15,000` / `60,000`), Street stepper (`Preflop`–`River`), reused 4×13 `HeatGrid` (arrow keys, `Escape` stepping River -> Turn -> Flop, struck cards), hero-effect buckets, `"By the river you make"` distribution, SideRail (`Matchup` / `Saved matchups`), trilingual copy (`en`, `ru`, `he` + `<PokerNotation>` LTR isolation), and `docs/HOW_A_ROOM_IS_BUILT.md`.
- **Golden & audit gates:**
  - `src/test/section8.golden.test.ts` + `src/test/equityRoom.golden.test.ts` verified live via `tools/verify-golden.mjs` against `python tools/eqexact.py` (all 5 Section 2 fixtures + Section 8 fixtures).
  - `tools/audit-layout.mjs` & `tools/audit-theme.mjs` cover 42 states per viewport/locale/theme including 7 `equity*` states (`flop`, `turn_chosen`, `players_3`, `players_4`, `players_10`, `range_row`, `error`), with vertical `overflow-y: auto` scrollpane handling and `section[aria-busy="true"]` settle waits in `tools/f1-states.mjs`.

## What is next
1. **Next room slices (`hand`, `review`, `strategy`, `training`, `nights`, `learn`):** Follow `docs/HOW_A_ROOM_IS_BUILT.md`, extending `src/domain/shorthand/` (e.g. `top X%`, actions/amounts) and `src/domain/storage/` (`hand`, `session`, `plan`, `evidence` logs).
2. Owner visual, feel, and linguistic review of `/equity` (`en`, `ru`, `he` across all 7 themes) and `riverline-study-v1` export/import flow.
3. Add git remote (`origin`) and push to run `.github/workflows/ci.yml`.

## Open with the owner
- Visual & linguistic review of `Equity by rows` across English, Russian, Hebrew, and all 7 themes.
- When `top X%`, named player profiles (`Dan`), `"Can I call?"`, and cross-room links (`docs/IDEA_BANK.md` #80) should be scheduled.
- Git remote URL (`origin`) when ready to push.

## Known gaps
- `lookupStrategy`, `generateTrainingDrill`, and `gradeTrainingAnswer` on `src/engine-api` intentionally return `tier: 'unavailable'` until Strategy and Training slices land.
- `top X%` shorthand syntax, saved opponent ranges (`Dan`), `"Can I call?"` strip, intuition trainer, and Review/Training links are intentionally deferred (`docs/IDEA_BANK.md` #80).
- `.github/workflows/ci.yml` has not executed remotely yet (no `origin` remote configured).
- Under Node 26 + Vitest `jsdom`, `src/test/setup.ts` provides a fallback in-memory `Storage` when `window.localStorage` is shadowed as `undefined`.

## Checkpoints
| Date | Reviewer | Scope | Result |
|---|---|---|---|
| — | — | — | — |
