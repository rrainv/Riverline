# Fable 5.2 session F1a: Repository Skeleton, Tokens, i18n, and Shell

**Paste everything below the line into a new Claude Fable 5.2 (or Claude Opus 5.5 / Gemini 4 Hydrogen High) session that has the handoff package folder available** (attach `riverline_handoff.zip`, or open the session in a folder that contains it). One session, one outcome.

*(Note: F1 is split into **F1a (Skeleton, Tokens, i18n, Shell)** and **F1b (Playwright Visual Audits & Golden Harness)** so neither session hits context limits or rushes the audit harness.)*

---

You are starting a new repository for **Riverline**, a local-first poker study application. You have no earlier context; everything you need is in the attached handoff package. This is Session F1a (the first half of Foundation). After the founding sessions, Gemini owns the repository long term, so everything you write must be clean enough to inherit without explanation.

## Read first, in this order
1. `handoff/01_HANDOFF_MASTER.md`
2. `repo-seed/AGENTS.md`
3. `handoff/02_DECISION_LOG.md` (sections A, B and F)
4. `handoff/04_DESIGN_SPEC.md` (sections 2, 3, 6)
5. `design/tokens/TOKENS_README.md`

## Outcome of this session
A strict TypeScript + Vite + Preact + Signals application with CSS Modules on tokens, three languages (`en`, `ru`, `he` with RTL), seven themes, bundled local fonts, the full application shell, a deterministic test/audit hook, and passing `typecheck`, `test` (Vitest), and `check:raw` gates.

## Build
1. **Repository:** TypeScript strict, Vite, Preact with `@preact/signals`, Vitest, Node 22+. Use **CSS Modules (`*.module.css`)** with plain CSS reading `tokens/tokens.css` variables so component classes never collide globally. No CSS framework, no component library. Use the folder layout in `AGENTS.md` section 8.
2. **Seed files:** place `repo-seed/` at the root (`AGENTS.md`, `CLAUDE.md`, `.gitignore`, `.geminiignore`, `.gemini/settings.json`, `.agents/rules/`, `docs/`, `tools/check-no-raw-values.mjs`, `tools/eqexact.py`). Copy `handoff/` to `docs/handoff/`, `design/` to `docs/design/`, `reference/` to `docs/reference/`, `prompts/` to `docs/prompts/`. Copy `handoff/02_DECISION_LOG.md` to `docs/DECISIONS.md`, `reference/IDEA_BANK.md` to `docs/IDEA_BANK.md`, `reference/TERMINOLOGY_SHEET.md` to `docs/TERMINOLOGY.md`.
3. **Tokens:** `design/tokens/tokens.css` and `tokens.json` into `tokens/`, unchanged. Theme switching by `data-theme` on `document.documentElement`; table pace by `data-pace`; reduced motion by the system setting and `data-motion`. Persist appearance preferences in a dedicated `localStorage` key (`riverline.appearance.v1`) kept strictly separate from future IndexedDB study data.
4. **Fonts:** Inter and Rubik bundled as local variable fonts (Latin, Cyrillic, Hebrew). Record their licences in `docs/THIRD_PARTY.md`. No network requests at runtime.
5. **Internationalisation:** message catalogues for English, Russian and Hebrew with named placeholders and plural rules; a `t()` helper; `dir` (`ltr` / `rtl`) and `lang` set on `document.documentElement`; `Intl` number formatting. Hebrew mirrors through logical CSS properties; provide a `<PokerNotation>` (`<bdi dir="ltr">`) helper for cards, ranges, amounts and position codes.
6. **Shell:** top bar (logo, breadcrumb chip, search-and-jump button with the Ctrl K palette, Settings, Focus mode), the floating dock with eight rooms (Home, Training, Strategy, Hand, Equity, Review, Nights, Learn), the collapsible rail that shows icons when collapsed. Each room renders an honest empty state (one line, no fake content). Support `/kit` as the route for the component sheet (empty placeholder in F1a, populated in F2). Keyboard: Ctrl K, Escape closes the top layer, sane Tab order, visible focus ring. Follow `design/prototypes/riverline-app.html` for measurements and behaviour; do not copy its code.
7. **Deterministic test and audit hook:** support both URL query parameters (`?room=equity&theme=daylight&lang=he&pace=calm&motion=reduced&rail=collapsed&focus=1&palette=1`) and `window.__riverlineTest.setState({ room, theme, lang, pace, motion, railCollapsed, focusMode, paletteOpen })` so Playwright audits in F1b can drive every state deterministically.
8. **Settings, Appearance only:** theme picker (seven themes), table pace, reduced motion, language. The rest of Settings comes later.
9. **Gates for F1a (as npm scripts, all passing with zero):**
   - `npm run typecheck` (`tsc --noEmit`)
   - `npm test` (Vitest behaviour tests: i18n helper + plural/template formatting, theme/appearance persistence, URL/test-hook state switching)
   - `npm run check:raw` (`node tools/check-no-raw-values.mjs`)
   - `npm run build` (clean production build for `vite preview` in F1b)
10. **`docs/STATE.md`:** filled in truthfully with gate outputs.

## Do not
- Do not copy any code from the old repository in this session.
- Do not build room content or kit components beyond what the shell needs.
- Do not add a dependency that is not needed for the items above. List every dependency with its licence in `docs/THIRD_PARTY.md`.
- Do not write tests that read source files as text.

## Before you write code
Reply with: (1) anything in the package you think is wrong or risky for this session, with an alternative; (2) the questions you need the owner to answer; (3) your plan in ten lines. Wait for the owner's reply.

## Finish with
A five-line report: what works; each gate's command and output; what is not done (F1b audit & golden gates next); anything logged in the bug inbox; the one decision you need from the owner. Say "not run" for anything you did not run.
