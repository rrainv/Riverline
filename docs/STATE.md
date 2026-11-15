# State

Updated at the end of every session. The next session starts here.

**Last updated:** 2026-11-15, Session F2c (Part 3 of 3 kit — all 18 components complete)

## What is true now
- Repository seeded on `main` (`0ab0621`) from `repo-seed/`, `handoff/`, `design/`, `reference/`, `prompts/`, and `tokens/`. Added solid `MixBar` segment tokens (`--seg-ink`, `--seg-call`, `--seg-raise-1`, `--seg-raise-2`, `--seg-raise-3`, `--seg-brass`, `--seg-ok`) and Teacher Lamp tokens (`--lamp-bulb`, `--lamp-rim`, `--lamp-eye`, `--lamp-glow`, `--lamp-stern`) to `tokens/tokens.css` and `tokens/tokens.json` across all 7 themes.
- Strict TypeScript + Vite + Preact (`@preact/signals`) + CSS Modules shell built in F1a and gated in F1b (`main`), with bundled local variable fonts (`Inter` + `Rubik`, covering Latin, Cyrillic, Hebrew) and licences recorded in `docs/THIRD_PARTY.md` (including `playwright@1.65.1`, `Apache-2.0`).
- Seven themes (`midnight`, `felt`, `slate`, `dusk`, `contrast`, `daylight`, `paper`), three table paces (`calm`, `normal`, `fast`), reduced motion (`system` / `reduced`), Lamp visibility (`showLamp`), teacher typing speed (`teacherTypingSpeed`), and three locales (`en`, `ru`, `he` with RTL mirroring, `Intl.PluralRules`, `Intl.NumberFormat`, `tNodes()` node-slot templates, `<PokerNotation>`) are live and persisted in `localStorage` (`riverline.appearance.v1`, normalized backwards-compatibly).
- Application shell moved into `src/ui/kit/shell/` (`AppShell`, `TopBar`, `SideRail`, `FloatingDock`), icons into `src/ui/kit/icons/Icons.tsx`, and `CommandPalette` into `src/ui/kit/overlay/`.
- `/kit` component sheet harness (`src/ui/kit/sheet/KitSheet.tsx` and `StateMatrix.tsx`) is live with controls to switch all 7 themes, 3 languages (`en`/`ru`/`he`), table pace, reduced motion, viewport preview (`inline`, `1920×1080`, `1366×768`, `390×844`), and 17 component section tabs (`?room=kit&kitSection=<id>` / `kitSection` in `window.__riverlineTest.setState({ kitSection })`), alongside `#1` Shell around the app.
- All 18 components of `docs/handoff/04_DESIGN_SPEC.md` §4 (F2a core + F2b poker/table + F2c study/teacher; each kit component in `src/ui/kit/<component>/` with `.tsx`, `.module.css`, `.sheet.tsx`, `.test.tsx`) are built and audited across every applicable state, theme, language (`en`, `ru`, `he`), and viewport (`1920×1080`, `1366×768`):
  - **Shell (#1):** `src/ui/kit/shell/` (`AppShell`, `TopBar`, `SideRail`, `FloatingDock`).
  - **Core (#2–#6, #13, #17, #18):** `Panel`, `Button`, `Chip`/`TierBadge`, `ChipButton`/`SegmentedControl`, `TokenInput`, `FactTile`, `Overlay`/`CommandPalette`, `Stepper`.
  - **PlayingCard (#8)** (`src/ui/kit/playing-card/PlayingCard.tsx`): `mini` (`26×36`), `small` (`30×40`), `standard` (`34×46`), `large` (`48×66`), `table` (`56×76`); `face`, `back`, `slot`, `struck`, `winning`, `dimmed`, `PlayingCardPair`; deal+flip (`--dur-4 --ease-out --stagger-m`, swaps face at edge-on midpoint) and fold (lifts, turns face down first, flies on uneven arc `--dur-4 --ease-exit`).
  - **FeltTable (#9)** (`src/ui/kit/felt-table/FeltTable.tsx`): stadium felt with double brass rim (`--felt-rim`, `--felt-rim2`), 6-max and heads-up seats, hero at bottom, dealer mark, 40% fold dim, thinking dots, above-seat action bubbles, travelling action ring (`--ease-inout`), staggered chip flight + linear pot count-up with spring bump, showdown highlight (`--accent` winning five outline), and Training hub `menu` variant.
  - **OptionTickets & SizeLadder (#7)** (`src/ui/kit/option-tickets/OptionTickets.tsx`): 2–4 shortcut buttons, SVG `pathLength="100"` border draw (`--dur-4 --ease-out`), 50% dim on unchosen siblings, separate `SizeLadder` with non-nested `−` / `+` buttons (`>= 28px`), reset action, and hover/`:focus-within` + persistent cost readouts.
  - **MixBar (#10)** (`src/ui/kit/mix-bar/MixBar.tsx`): thick action-share bar with uniform LTR `clip-path` wipe (`--dur-4 --ease-inout`), solid token fills + `--seg-ink` (>= 4.5:1 contrast), forced `dir="ltr"` raise-size axis with translated labels, and a dedicated below-bar `"you"` pointer gliding with `--dur-3 --ease-spring`.
  - **EquityRow & EquityList (#11)** (`src/ui/kit/equity-row/EquityRow.tsx`): `roomy` (`70px`), `dense` (`54px`), `compact` (`40px`), single-table row layout (no Layout B), face/range/face-down cards, reading-start `scaleX` bar + previous-street brass tick, equity % with signed delta, single `"right now"` fact, expand slot, remove action, and FLIP reorder transition.
  - **HistoryRail & StreetStrip (#12)** (`src/ui/kit/history-rail/HistoryRail.tsx`): vertical street-grouped rail with current-row accent indicator and entry slide-in (`--dur-3 --ease-out`) + horizontal 4-street strip with `mini` board cards, result, pot, and SPR.
  - **TeacherCallout & Lamp (#14)** (`src/ui/kit/lamp/Lamp.tsx`): abstract token-colored SVG desk lamp at `28 | 44 | 72 | 128` px across all 8 animated moods (`idle`, `thinking`, `curious`, `speaking`, `approving`, `celebrating` auto-returning to `idle`, `stern`, `resting` interactive wake button `>= 34px`), plus `TeacherCallout` with Lamp at reading-start, progressive typing synced to `teacherTypingSpeed` (instant on click/Enter/Space and under reduced motion), `TierBadge`, optional single action button, and `showLamp` toggle.
  - **HeatGrid (#15)** (`src/ui/kit/heat-grid/HeatGrid.tsx`): shared grid component powering `runout` (4×13 turn cards with `--ok`/`--ok-text` helps, `--over`/`--over-text` hurts, struck cards in play), `leakMap` (hand families × players behind with `--over`/`--under`, brass baseline tick, sample counts, summary footer), and `matrix13` (13×13 range matrix forced `dir="ltr"` with diagonal pairs, suited above, offsuit below, `yours | baseline | match | unknown` states), with roving focus, Arrow/Home/End/Enter/Space/Escape navigation, and `--stagger-s` entrance.
  - **FamilyStrip (#16)** (`src/ui/kit/family-strip/FamilyStrip.tsx`): plan builder control (`dir="ltr"`) ordered strongest to weakest on a `role="slider"` track with pointer drag/click + Arrow/Home/End cutoff control, visible `--accent` edge bar & knob, optional brass baseline tick, and live localized hand & combo counts.
- `npm run typecheck` (`tsc --noEmit`): passed (`exit 0`).
- `npm test` (`vitest run`): passed, 21 test files, 54 tests (`exit 0`).
- `npm run golden` (`node tools/verify-golden.mjs`): passed (`golden: eqexact.py matches tools/golden/section8.golden.json`, `src/test/section8.golden.test.ts` 3/3 tests passed, `exit 0`).
- `npm run check:raw` (`node tools/check-no-raw-values.mjs`): passed, `check-no-raw-values: ok` (`exit 0`).
- `npm run audit:layout` (`node tools/audit-layout.mjs`): passed against `vite preview` (`audit:layout checked 1218 states across 7 themes x 3 languages x 2 viewports | failures: 0 | page errors: 0`, `exit 0`).
- `npm run audit:theme` (`node tools/audit-theme.mjs`): passed against `vite preview` (`audit:theme runs: 42 | failed runs: 0 | page errors: 0`, `exit 0`).

## What is next
1. Owner visual and linguistic review of all 18 kit components on `/kit` across the 7 themes and 3 languages (`en`, `ru`, `he`), plus settling `docs/BUG_INBOX.md` item #3 and any visual polish requests.
2. Add a git remote (`origin`) and push to verify `.github/workflows/ci.yml` on GitHub Actions.
3. **Session F3:** Clean-room TypeScript `engine/` + ported behavior & golden tests.

## Open with the owner
- Visual & feel review of `/kit` (all 18 components, especially F2c `Lamp`, `HeatGrid`, `FamilyStrip` across 7 themes & `en`/`ru`/`he`).
- Git remote URL (`origin`) if you want CI verified remotely on GitHub Actions.
- Linguistic sign-off on the Russian (`src/i18n/locales/ru.ts`) and Hebrew (`src/i18n/locales/he.ts`) strings.

## Known gaps
- `.github/workflows/ci.yml` has not executed on GitHub Actions yet (no git remote configured).
- `SettingsRoom.tsx` does not expose `showLamp` / `teacherTypingSpeed` controls yet (planned for its Settings Teacher slice; both preferences exist in `riverline.appearance.v1` and `/kit`).
- Engine (`engine/`) and domain study IndexedDB stores do not exist yet (`F3` and `F4`).
- Under Node 26 + Vitest `jsdom`, `src/test/setup.ts` provides a fallback in-memory `Storage` when `window.localStorage` is shadowed as `undefined` by Node's `--localstorage-file` experimental global.

## Checkpoints
| Date | Reviewer | Scope | Result |
|---|---|---|---|
| — | — | — | — |
