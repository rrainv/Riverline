# Fable 5.2 session F1: Foundation

**Recommended:** Run **F1a** (`prompts/FABLE_F1A_SKELETON.md`) followed by **F1b** (`prompts/FABLE_F1B_GATES.md`) in two separate sessions so neither session hits context limits while wiring Playwright + Python Pillow audits across 7 themes × 3 languages × 2 viewports. Use this single combined prompt only if your session has a very large context and output budget.

**Paste everything below the line into a new Claude Fable 5.2 session that has the handoff package folder available** (attach `riverline_handoff.zip`, or open the session in a folder that contains it). One session, one outcome.

---

You are starting a new repository for **Riverline**, a local-first poker study application. You have no earlier context; everything you need is in the attached handoff package. This is the first of four founding sessions. After them, another model (Gemini) owns the repository long term, so everything you write must be clean enough to inherit without explanation.

## Read first, in this order
1. `handoff/01_HANDOFF_MASTER.md`
2. `repo-seed/AGENTS.md`
3. `handoff/02_DECISION_LOG.md` (sections A, B and F)
4. `handoff/04_DESIGN_SPEC.md` (sections 2, 3, 6, 12)
5. `design/tokens/TOKENS_README.md`, `design/tools/README.md`

## Outcome of this session
An empty application that already passes every gate, in seven themes and three languages: the skeleton that every later session inherits.

## Build
1. **Repository:** TypeScript strict, Vite, Preact with `@preact/signals`, Vitest, Node 22+. Use **CSS Modules (`*.module.css`)** with plain CSS reading `tokens/tokens.css` variables so component classes cannot collide globally. No CSS framework, no component library. The folder layout in `AGENTS.md` section 8.
2. **Seed files:** place `repo-seed/` at the root (`AGENTS.md`, `CLAUDE.md`, `.gitignore`, `.geminiignore`, `.gemini/settings.json`, `.agents/rules/`, `docs/`, `tools/check-no-raw-values.mjs`, `tools/eqexact.py`). Copy `handoff/` to `docs/handoff/`, `design/` to `docs/design/`, `reference/` to `docs/reference/`, `prompts/` to `docs/prompts/`. Copy `handoff/02_DECISION_LOG.md` to `docs/DECISIONS.md`, `reference/IDEA_BANK.md` to `docs/IDEA_BANK.md`, `reference/TERMINOLOGY_SHEET.md` to `docs/TERMINOLOGY.md`.
3. **Tokens:** `design/tokens/tokens.css` and `tokens.json` into `tokens/`, unchanged. Theme switching by `data-theme` on `document.documentElement`; table pace by `data-pace`; reduced motion by the system setting and `data-motion`. Persist appearance preferences in a dedicated `localStorage` key (`riverline.appearance.v1`) kept separate from future IndexedDB study data.
4. **Fonts:** Inter and Rubik bundled as local variable fonts (Latin, Cyrillic, Hebrew). Record their licences in `docs/THIRD_PARTY.md`. No network requests at runtime.
5. **Internationalisation:** message catalogues for English, Russian and Hebrew with named placeholders and plural rules; a `t()` helper; `dir` and `lang` set on `document.documentElement`; `Intl` number formatting. Hebrew mirrors through logical CSS properties; a `<bdi dir="ltr">` helper for poker notation.
6. **Shell:** top bar (logo, search-and-jump button with the Ctrl K palette, Settings, Focus mode), the floating dock with eight rooms (Home, Training, Strategy, Hand, Equity, Review, Nights, Learn), the collapsible rail that shows icons when collapsed. Support `/kit` as the route for the component sheet (populated in F2). Each room renders an honest empty state (one line, no fake content). Keyboard: Ctrl K, Escape closes the top layer, Tab order sane, visible focus ring. Follow `design/prototypes/riverline-app.html` for measurements and behaviour; do not copy its code.
7. **Deterministic test hook:** support both URL query parameters (`?room=equity&theme=daylight&lang=he&pace=calm&motion=reduced&rail=collapsed&focus=1&palette=1`) and `window.__riverlineTest.setState(...)` so Playwright audits can drive every state deterministically.
8. **Settings, Appearance only:** theme picker (seven themes), table pace, reduced motion, language. The rest of Settings comes later.
9. **Gates as npm scripts,** all passing with zero (and exiting non-zero on failure):
   - `typecheck`, `test` (Vitest behaviour test runner; one real test for the i18n helper, one for theme persistence, one for the test hook)
   - `check:raw` (`node tools/check-no-raw-values.mjs`)
   - `audit:layout` and `audit:theme`: adapt `design/tools/audit.js`, `snap.js`, `states.js` and `analyze.py` to drive the production build (`vite preview`) with Playwright through the test hook. States for now: each room's empty state, the palette open, the rail collapsed, focus mode; every theme; all three languages; 1920×1080 and 1366×768.
   - `golden`: runs `python tools/eqexact.py --section8`, writes `tools/golden/section8.golden.json`, and verifies the fixture structure.
10. **Continuous integration:** one workflow (`.github/workflows/ci.yml`) that runs all gates on push.
11. **`docs/STATE.md`:** filled in truthfully.

## Do not
- Do not copy any code from the old repository in this session.
- Do not build room content, a component beyond what the shell needs, or anything "for later".
- Do not add a dependency that is not needed for the items above. List every dependency with its licence in `docs/THIRD_PARTY.md`.
- Do not write tests that read source files as text.

## Before you write code
Reply with: (1) anything in the package you think is wrong or risky for this session, with an alternative; (2) the questions you need the owner to answer; (3) your plan in ten lines. Wait for the owner's reply.

## Finish with
A five-line report: what works; each gate's command and output; what is not done; anything logged in the bug inbox; the one decision you need from the owner. Say "not run" for anything you did not run.
