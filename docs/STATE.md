# State

Updated at the end of every session. The next session starts here.

**Last updated:** 2026-11-14, Session F1a (branch `feat/f1a-skeleton`)

## What is true now
- Repository seeded on `main` (`0ab0621`) from `repo-seed/`, `handoff/`, `design/`, `reference/`, `prompts/`, and `tokens/` (`tokens.css` and `tokens.json` unchanged).
- Strict TypeScript + Vite + Preact (`@preact/signals`) + CSS Modules shell built on `feat/f1a-skeleton`, with bundled local variable fonts (`Inter` + `Rubik`, covering Latin, Cyrillic, Hebrew) and licences recorded in `docs/THIRD_PARTY.md`.
- Seven themes (`midnight`, `felt`, `slate`, `dusk`, `contrast`, `daylight`, `paper`), three table paces (`calm`, `normal`, `fast`), reduced motion (`system` / `reduced`), and three locales (`en`, `ru`, `he` with RTL mirroring, `Intl.PluralRules`, `Intl.NumberFormat`, `<PokerNotation>`) are live and persisted in `localStorage` (`riverline.appearance.v1`).
- Application shell (TopBar, collapsible icon SideRail, 8-room FloatingDock, Focus mode with `Show dock` restore pill, `Ctrl+K` / `Escape` CommandPalette, Settings Appearance, `/kit` placeholder, honest one-line empty states) and deterministic URL query + `window.__riverlineTest` hooks work.
- `npm run typecheck` (`tsc --noEmit`): passed (`exit 0`).
- `npm test` (`vitest run`): passed, 3 test files, 13 behaviour tests (`exit 0`).
- `npm run check:raw` (`node tools/check-no-raw-values.mjs`): passed, `check-no-raw-values: ok` (`exit 0`).
- `npm run build` (`vite build`): passed in `724ms`, `dist/` produced with 9 bundled `.woff2` font files (`exit 0`).

## What is next
1. **Session F1b (`docs/prompts/FABLE_F1B_GATES.md`):** Build the Playwright `audit:layout` and `audit:theme` gates against `vite preview` (7 themes × 3 languages × 2 viewports: `1920×1080` and `1366×768`), wire the `golden` harness (`tools/eqexact.py`), and add CI configuration.
2. Owner linguistic review of the draft Russian and Hebrew shell/Settings strings in `src/i18n/locales/ru.ts` and `src/i18n/locales/he.ts`.

## Open with the owner
- Linguistic sign-off on the draft Russian (`src/i18n/locales/ru.ts`) and Hebrew (`src/i18n/locales/he.ts`) shell/Settings labels, and whether to merge `feat/f1a-skeleton` into `main` now or after F1b. *(Recommended: review RU/HE wording during F1b visual audit screenshots, then merge `feat/f1a-skeleton` after F1b passes.)*

## Known gaps
- `npm run golden`, `npm run audit:layout`, and `npm run audit:theme` are **not run** (they do not exist yet; scheduled for Session F1b).
- `/kit` is an empty placeholder route; the 18 kit components are scheduled for Session F2 (`F2a`–`F2c`).
- Engine (`engine/`) and domain study IndexedDB stores do not exist yet (`F3` and `F4`).
- Under Node 26 + Vitest `jsdom`, `src/test/setup.ts` provides a fallback in-memory `Storage` when `window.localStorage` is shadowed as `undefined` by Node's `--localstorage-file` experimental global.

## Checkpoints
| Date | Reviewer | Scope | Result |
|---|---|---|---|
| — | — | — | — |
