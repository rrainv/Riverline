# State

Updated at the end of every session. The next session starts here.

**Last updated:** 2026-11-14, Session F2a (branch `feat/f2a-core-kit`)

## What is true now
- Repository seeded on `main` (`0ab0621`) from `repo-seed/`, `handoff/`, `design/`, `reference/`, `prompts/`, and `tokens/` (`tokens.css` and `tokens.json` unchanged).
- Strict TypeScript + Vite + Preact (`@preact/signals`) + CSS Modules shell built in F1a and gated in F1b (`main`), with bundled local variable fonts (`Inter` + `Rubik`, covering Latin, Cyrillic, Hebrew) and licences recorded in `docs/THIRD_PARTY.md` (including `playwright@1.65.1`, `Apache-2.0`).
- Seven themes (`midnight`, `felt`, `slate`, `dusk`, `contrast`, `daylight`, `paper`), three table paces (`calm`, `normal`, `fast`), reduced motion (`system` / `reduced`), and three locales (`en`, `ru`, `he` with RTL mirroring, `Intl.PluralRules`, `Intl.NumberFormat`, `tNodes()` node-slot templates, `<PokerNotation>`) are live and persisted in `localStorage` (`riverline.appearance.v1`).
- Application shell moved into `src/ui/kit/shell/` (`AppShell`, `TopBar`, `SideRail`, `FloatingDock`), icons into `src/ui/kit/icons/Icons.tsx`, and `CommandPalette` into `src/ui/kit/overlay/`.
- `/kit` component sheet harness (`src/ui/kit/sheet/KitSheet.tsx` and `StateMatrix.tsx`) is live with controls to switch all 7 themes, 3 languages (`en`/`ru`/`he`), table pace, reduced motion, viewport preview (`inline`, `1920×1080`, `1366×768`, `390×844`), and component section tabs (`?room=kit&section=<id>` and `window.__riverlineTest.setState({ kitSection })`).
- First 8 core kit components (`src/ui/kit/<component>/`: `.tsx`, `.module.css`, `.sheet.tsx`, `.test.tsx`) are built and audited across every applicable state (`rest`, `hover`, `pressed`, `focus`, `disabled`, `selected`, `error`, `loading`, `empty`, and longest realistic Russian copy):
  - **Panel (#2)** (`src/ui/kit/panel/Panel.tsx`): `--panel-bg`, `--panel-border`, `--radius`, `--shadow`, `--panel-pad`, micro label, title, single-corner `tier` slot, hairline dividers, skeleton loading, empty state, and dev nested-panel detection.
  - **Button (#3)** (`src/ui/kit/button/Button.tsx`): `primary` (`--accent` fill with `--accent-ink` and committed `<PokerNotation>` amount), `secondary` (`--line2` outline), `danger` (`--danger` outline + `--danger-bg` wash + `--text` ink), `scale(0.97)` press, `--focus-ring`, `--track` + `--text3` disabled (never faded accent), three-dot busy indicator, and spring checkmark confirmation.
  - **Chip & TierBadge (#4)** (`src/ui/kit/chip/Chip.tsx`): neutral pill chips (`--h-chip`) with optional `<kbd>` shortcut badge, and `TierBadge` (`exact`, `verified`, `estimated`, dashed `unavailable`, plus qualified `{tier} · {detail}` and `{source} · {tier}` forms).
  - **ChipButton & SegmentedControl (#5)** (`src/ui/kit/choice/Choice.tsx`): `--sel-bg` + `--accent` border + `--accent-text` selected state, arrow-key roving focus (`Home`/`End`/`ArrowLeft`/`ArrowRight`), and `--dur-3 --ease-inout` gliding indicator pill.
  - **TokenInput & token chips (#6)** (`src/ui/kit/input/TokenInput.tsx`): recessed well (`--well`, `--h-input`), whitespace/Enter token chip creation, Backspace removal, caller-supplied `validateToken` callback, `--danger` outline + inline `role="alert"` with sideways invalid-input nudge (`--dur-2 --ease-out`).
  - **FactTile (#13)** (`src/ui/kit/fact-tile/FactTile.tsx`): micro label, tabular `--num` readout with unit or tier badge, and linear `requestAnimationFrame` counting over `--dur-4` (lands on exact engine value with zero spring overshoot; instant under reduced motion).
  - **Overlay (#17)** (`src/ui/kit/overlay/Overlay.tsx` + `CommandPalette.tsx`): `Tooltip`, `CommandPalette`, `Dialog` (including destructive exact object-name type-to-confirm), `Toast` (with undo action), and `PhoneSheet`, unified on `--overlay-*` and `--scrim` tokens with top-layer `Escape` stack and focus restoration.
  - **Stepper (#18)** (`src/ui/kit/stepper/Stepper.tsx`): minus, tabular `<output>` value + unit, plus, min/max clamping, keyboard arrow-key stepping, and `--tap-min` (`40px`) touch target mode.
- `npm run typecheck` (`tsc --noEmit`): passed (`exit 0`).
- `npm test` (`vitest run`): passed, 12 test files, 30 tests (`exit 0`).
- `npm run golden` (`node tools/verify-golden.mjs`): passed (`golden: eqexact.py matches tools/golden/section8.golden.json`, `src/test/section8.golden.test.ts` 3/3 tests passed, `exit 0`).
- `npm run check:raw` (`node tools/check-no-raw-values.mjs`): passed, `check-no-raw-values: ok` (`exit 0`).
- `npm run audit:layout -- --no-build` (`node tools/audit-layout.mjs --no-build`): passed against `vite preview` (`audit:layout checked 840 states across 7 themes x 3 languages x 2 viewports | failures: 0 | page errors: 0`, `exit 0`).
- `npm run audit:theme` (`node tools/audit-theme.mjs`): passed against `vite preview` (`audit:theme runs: 42 | failed runs: 0 | page errors: 0`; 873 text runs in full-sweep runs and 603 text runs in `/kit`-sweep runs across all 7 themes × 3 languages × 2 viewports, `exit 0`).

## What is next
1. **Session F2b (`docs/prompts/FABLE_F2B_POKER_KIT.md`):** Part 2 of the component kit (poker & table components: playing card, felt table & seats, action bubble, street history rail, option ticket, mix bar) on `/kit`.
2. **Session F2c (`docs/prompts/FABLE_F2C_STUDY_KIT.md`):** Part 3 of the component kit (study & teacher components: 13×13 hand matrix, hand-family strip, equity row table, the Lamp).
3. Add a git remote (`origin`) and push to verify `.github/workflows/ci.yml` on GitHub Actions.
4. Owner visual and linguistic review of `/kit` (`en`, `ru`, `he`).

## Open with the owner
- Visual review of `/kit` (Part 1: 8 core components) and approval to merge `feat/f2a-core-kit` to `main` (or proceed directly to F2b).
- Git remote URL (`origin`) if you want CI verified remotely on GitHub Actions.
- Linguistic sign-off on the Russian (`src/i18n/locales/ru.ts`) and Hebrew (`src/i18n/locales/he.ts`) strings.

## Known gaps
- `.github/workflows/ci.yml` has not executed on GitHub Actions yet (no git remote configured).
- Kit Parts 2 and 3 (components #1, #7–#12, #14–#16 in `04_DESIGN_SPEC.md` §4) are scheduled for Sessions `F2b` and `F2c`.
- Engine (`engine/`) and domain study IndexedDB stores do not exist yet (`F3` and `F4`).
- Under Node 26 + Vitest `jsdom`, `src/test/setup.ts` provides a fallback in-memory `Storage` when `window.localStorage` is shadowed as `undefined` by Node's `--localstorage-file` experimental global.

## Checkpoints
| Date | Reviewer | Scope | Result |
|---|---|---|---|
| — | — | — | — |
