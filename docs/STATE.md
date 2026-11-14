# State

Updated at the end of every session. The next session starts here.

**Last updated:** 2026-11-14, Session F1b (merged to `main`)

## What is true now
- Repository seeded on `main` (`0ab0621`) from `repo-seed/`, `handoff/`, `design/`, `reference/`, `prompts/`, and `tokens/` (`tokens.css` and `tokens.json` unchanged).
- Strict TypeScript + Vite + Preact (`@preact/signals`) + CSS Modules shell built in F1a and gated in F1b (`main`), with bundled local variable fonts (`Inter` + `Rubik`, covering Latin, Cyrillic, Hebrew) and licences recorded in `docs/THIRD_PARTY.md` (including `playwright@1.65.1`, `Apache-2.0`).
- Seven themes (`midnight`, `felt`, `slate`, `dusk`, `contrast`, `daylight`, `paper`), three table paces (`calm`, `normal`, `fast`), reduced motion (`system` / `reduced`), and three locales (`en`, `ru`, `he` with RTL mirroring, `Intl.PluralRules`, `Intl.NumberFormat`, `<PokerNotation>`) are live and persisted in `localStorage` (`riverline.appearance.v1`).
- Application shell (TopBar, collapsible icon SideRail, 8-room FloatingDock, Focus mode with `Show dock` restore pill, `Ctrl+K` / `Escape` CommandPalette, Settings Appearance, `/kit` placeholder, honest one-line empty states) and deterministic URL query + `window.__riverlineTest` hooks work.
- F1b defects caught by the new gates and fixed in `src/ui/kit/CommandPalette.module.css` (and recorded in `docs/BUG_INBOX.md`): `.input` height raised to `var(--h-input)` (`38px`) to pass the `28px` desktop target floor, and `.resultHint`/`.countChip`/`.kbd` switched to `--overlay-ink2`/`--overlay-line` to pass `4.5:1` pixel contrast in Daylight and Paper.
- `npm run typecheck` (`tsc --noEmit`): passed (`exit 0`).
- `npm test` (`vitest run`): passed, 4 test files, 16 tests (`exit 0`).
- `npm run golden` (`node tools/verify-golden.mjs`): passed (`golden: eqexact.py matches tools/golden/section8.golden.json`, `src/test/section8.golden.test.ts` 3/3 tests passed, `exit 0`).
- `npm run check:raw` (`node tools/check-no-raw-values.mjs`): passed, `check-no-raw-values: ok` (`exit 0`).
- `npm run audit:layout` (`node tools/audit-layout.mjs`): passed against `vite preview` (`audit:layout checked 546 states across 7 themes x 3 languages x 2 viewports | failures: 0 | page errors: 0`, `exit 0`).
- `npm run audit:theme -- --no-build` (`node tools/audit-theme.mjs --no-build`): passed against `vite preview` (`audit:theme runs: 22 | failed runs: 0 | page errors: 0`; 291 text runs per run across all 7 themes in `en` + `ru`/`he` in `midnight` and `daylight` at `1920x1080` and `1366x768`, `exit 0`).
- GitHub Actions workflow added at `.github/workflows/ci.yml` (runs `typecheck`, `test`, `golden`, `check:raw`, `build`, `audit:layout`, `audit:theme` on `push` and `pull_request`). Not run remotely yet (no git `origin` remote is configured in this repository).

## What is next
1. Add a git remote (`origin`) and push `main` to verify `.github/workflows/ci.yml` on GitHub Actions.
2. **Session F2a (`docs/prompts/FABLE_F2A_CORE_KIT.md`):** Core `/kit` components on a new slice branch off green `main`.
3. Owner linguistic review of the draft Russian and Hebrew shell/Settings strings in `src/i18n/locales/ru.ts` and `src/i18n/locales/he.ts`.

## Open with the owner
- Git remote URL (`origin`) if you want CI verified remotely on GitHub Actions.
- Linguistic sign-off on the draft Russian (`src/i18n/locales/ru.ts`) and Hebrew (`src/i18n/locales/he.ts`) shell/Settings labels.

## Known gaps
- `.github/workflows/ci.yml` has not executed on GitHub Actions yet (no git remote configured).
- `/kit` is an empty placeholder route; the 18 kit components are scheduled for Session F2 (`F2a`–`F2c`).
- Engine (`engine/`) and domain study IndexedDB stores do not exist yet (`F3` and `F4`).
- Under Node 26 + Vitest `jsdom`, `src/test/setup.ts` provides a fallback in-memory `Storage` when `window.localStorage` is shadowed as `undefined` by Node's `--localstorage-file` experimental global.

## Checkpoints
| Date | Reviewer | Scope | Result |
|---|---|---|---|
| — | — | — | — |
