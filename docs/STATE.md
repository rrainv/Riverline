# State

Updated at the end of every session. The next session starts here.

**Last updated:** 2026-11-15, Session F3 (Clean-room TypeScript `engine/`, `src/engine-api/` Web Worker client, locale numbers, Section 8 live golden tests, provenance)

## What is true now
- Repository seeded on `main` (`0ab0621`) from `repo-seed/`, `handoff/`, `design/`, `reference/`, `prompts/`, and `tokens/`. Added solid `MixBar` segment tokens and Teacher Lamp `--lamp-*` tokens across all 7 themes.
- Strict TypeScript + Vite + Preact (`@preact/signals`) + CSS Modules shell built in F1a/F1b, bundled local variable fonts (`Inter` + `Rubik`), licences recorded in `docs/THIRD_PARTY.md`.
- Seven themes (`midnight`, `felt`, `slate`, `dusk`, `contrast`, `daylight`, `paper`), three table paces (`calm`, `normal`, `fast`), reduced motion, `showLamp`, `teacherTypingSpeed`, and three locales (`en`, `ru`, `he` with RTL mirroring, `Intl.PluralRules`, `Intl.NumberFormat`, `tNodes()`, `<PokerNotation>`) persisted in `localStorage` (`riverline.appearance.v1`).
- All 18 kit components of `docs/handoff/04_DESIGN_SPEC.md` §4 (`src/ui/kit/`) and `/kit` state matrix harness are live (verified in F2c: `audit:layout` 1218 states / 0 failures, `audit:theme` 42 runs / 0 failures).
- **Clean-room strict-TS engine (`engine/`, 37 `.ts` modules + `engine/tsconfig.json`, `lib: ["ES2022"]`, zero `DOM`/`window`/storage/network, zero `any`)** implemented on `feat/f3-engine` covering all 31 `shared/poker-domain/` modules, `deriveActionSizeFacts` (`poker-gto-app` `f2bc809`), `economics-facts.ts`, `range-analysis.ts`, `equity-hand-analysis.ts`, `runout-explorer.ts`, `worker-handler.ts`, and `privacy-fences.ts`, with full provenance in `docs/ENGINE_PROVENANCE.md`.
- **Typed Worker API (`src/engine-api/`):** `docs/ENGINE_API.md` surface implemented (`types.ts`, `client.ts`, `engine.worker.ts`, `index.ts`) with synchronous canonical/economics helpers (`sync`), asynchronous Web Worker equity & runout computation (`async`) with inline fallback, `{ ok, requestId, tier, qualifier, method, data }` envelopes, request-ID & `AbortSignal` cancellation, `createChannel` latest-wins supersession, and `tier: 'unavailable'` stubs for deferred Strategy (`lookupStrategy`) and Training (`generateTrainingDrill`, `gradeTrainingAnswer`).
- **Locale number formatting & input (`src/i18n/localeNumbers.ts`, `localeNumberInput.ts`):** Rewritten cleanly in TypeScript from `0921c04` + `origin/codex/stabilization` (`48fdb56` / `ae61622`), handling `en`/`ru`/`he` formatting, `.`/`,` parsing, `-` unknown fallback, `\u2066...\u2069` RTL isolation, paste normalization, and `riverline:languagechange` updates.
- **Behavior, regression & live golden verification:**
  - `engine/__tests__/` (5 files, 40 tests): cards/amounts/positions/rules (`v1`/`v2`), HU & multiway transitions, nested side pots & odd chips, v3 recorded settlement & v2 isolation, Step 7 BBA `100bb` settlement (`102`/`98`), decision economics & action-size facts, 500-hand fast-vs-canonical evaluator parity, weighted range math (4 quantities kept apart) & joint sampling collision rejection (`margin95`), bot `ownCards` fence, progressive replay non-leakage, and active full-hand training embargo.
  - `src/engine-api/client.test.ts` (5 tests) and `src/i18n/localeNumbers.test.tsx` (6 tests).
  - `src/test/section8.golden.test.ts` (4 tests): live-computes all Section 8 fixtures (including `KdJd vs any` across 1,070,190 combos, all 45 turn cards for `AhKh vs QsQc on Qh7c2h`, 3-way & 4-way exact equities, pot odds, duel SPR, all-in luck, and Review EV) directly against `tools/golden/section8.golden.json` (`python tools/eqexact.py --section8 --with-vs-any`).
- **Full Vitest suite (`npx vitest run`):** 28 test files, 106 tests passed.

## What is next
1. **Session F4:** Implement IndexedDB append-only domain event stores & derived views (`hand`, `session`, `plan`, `evidence`, `settings`, `saved objects`) wired to `engine/` via `src/engine-api/`.
2. Owner visual/linguistic review of `/kit` (18 kit components across 7 themes and `en`/`ru`/`he`), plus settling `docs/BUG_INBOX.md` item #3 when F4/table beat timing lands.
3. Add git remote (`origin`) and push to run `.github/workflows/ci.yml` on GitHub Actions.

## Open with the owner
- Review F3 deliverables (`docs/ENGINE_API.md`, `docs/ENGINE_PROVENANCE.md`, Section 8 golden parity, Worker timings).
- Visual & feel review of `/kit` and Russian/Hebrew translations (`src/i18n/locales/{ru,he}.ts`).
- Git remote URL (`origin`) when ready to push.

## Known gaps
- `lookupStrategy`, `generateTrainingDrill`, and `gradeTrainingAnswer` on `src/engine-api` intentionally return `tier: 'unavailable'` (`deferred_to_strategy_slice` / `deferred_to_training_slice`) until Strategy and Training slices land.
- `.github/workflows/ci.yml` has not executed remotely yet (no `origin` remote configured).
- Domain IndexedDB stores (`F4`) and workspace room functionality do not exist yet; `SettingsRoom.tsx` `showLamp`/`teacherTypingSpeed` UI waits for Settings Teacher slice.
- Under Node 26 + Vitest `jsdom`, `src/test/setup.ts` provides a fallback in-memory `Storage` when `window.localStorage` is shadowed as `undefined`.

## Checkpoints
| Date | Reviewer | Scope | Result |
|---|---|---|---|
| — | — | — | — |
