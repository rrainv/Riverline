# The original repository: what to take, what to leave, and the risks

**How much to trust this file.** The outgoing manager never had the old repository open in this handoff session. Everything below comes from ticket reports, the old north-star document, the manager's working notes and the owner's statements. Paths marked *(seen in reports)* appeared in worker reports; the overall structure is reliable, individual file names may have moved. **Your first act on the old repository is to verify this file** by running the read-only task in `prompts/ENGINE_MAP_001.md`, and to correct it.

**The old repository is read-only for you.** Never edit, commit, clean, stash or reset anything in it. It is the owner's fallback and holds work that was never committed.

---

## 1. Facts

| Item | Value |
|---|---|
| Location | `C:\Users\sjzns\Projects\poker-gto-app` (the owner's laptop; a desktop PC holds an older copy and the owner's real study data) |
| Main branch | `codex/stabilization` (remote `origin/codex/stabilization`) |
| Platform | Windows with Git Bash; Node 22 or later (`.nvmrc` says 24); line endings LF only |
| What it is | A vanilla JavaScript browser application with a thin Electron host; no framework, no bundler for the app code |
| Run it | `node tools/dev-web-server.mjs`, then `http://127.0.0.1:3000/` |
| Component sheet | `http://127.0.0.1:3000/__dev/component-sheet.html` (`tools/dev-pages/component-sheet.*`) |
| Tests | `node --test tests/*.test.js tests/*.test.mjs`; a runner with areas at `tools/run-tests.mjs` and `tests/areas.json` |
| Browser smoke | `node tests/tooling/verify_beta_candidate_browser.mjs` |
| Agent reports | `docs/archive/agent-reports/<year-month>/` |
| Worktrees | At least nine agent worktrees under `.claude/worktrees/` with their own branches (Analyze redesign, extraction and CI work). Some hold uncommitted or unmerged work. |
| Protected files | `.codex/config.toml`, `.gitignore`, `repo_dump.py`, `repo_dump.txt`, local auth configuration, helper and backup artifacts |

Known committed landmarks (hashes from the manager's notes): reference integrity recovery `8541e76`; Saved library `37fd148`; Training history in Saved `2a444e2`; Game night input fix `5ae58de`; decision-input truth fixes `da78be7`; later Analyze extraction work up to `a7507fc`.

## 2. Structure (as far as reports show)

```
app/
  index.html                      one page, all workspaces
  styles.css                      one global stylesheet
  assets/                         card back (riverline-card-back.svg), icons, sounds
  src/
    core/logic.js                 ~13,600 lines: most rendering, event wiring and screen state
    application/*.mjs             extracted application services, e.g.
                                  training-quick-drill(-bootstrap), analysis-explanation,
                                  analyze-spot-setup, poker-sizing-presentation,
                                  locale-number-format(-bootstrap), locale-number-input,
                                  range-calibration-workspace, personal-strategy-hand-workspace,
                                  exploit-review-workspace, exploit-teacher-language, study-language
    ui/*.mjs                      newer UI modules (e.g. drill-components.mjs)
    views/                        a few extracted views
    personal-strategy/            Personal Strategy domain (e.g. node-coach.mjs)
    home-game/                    game-night organiser: exact-money accounting
    sync/                         account and sync scaffolding (one Supabase browser client)
    locales/                      i18n.js and per-area translation files (EN, RU, HE)
shared/poker-domain/              the rules and maths core: cards, actions, legality, accounting,
                                  hand evaluator, equity, combos, weighted ranges
tests/                            ~300 test files, helpers (css-model.mjs, browser-app.mjs),
                                  tooling (audit_i18n.cjs, browser-runtime.mjs, capture-screens.mjs)
tools/                            dev server, test runner, dev pages
docs/                             NORTH_STAR.md, STATE.md, ISSUE_REGISTER.md, TERMINOLOGY.md,
                                  project/DESIGN_SYSTEM.md, design/, research/, archive/
```

## 3. Borrowed, available, left behind

### 3.1 Already borrowed (it is in this package, not in the new repo yet)

| What | Where it is now |
|---|---|
| The product principles and honesty rules | `01_HANDOFF_MASTER.md`, `repo-seed/AGENTS.md` |
| Engine invariants and contract names | Section 5 below |
| Terminology for three languages | `reference/TERMINOLOGY_SHEET.md` |
| Voice rules | `reference/VOICE_GUIDE.md` (with one supersession, noted in the decision log S3) |
| Feature inventory and every recorded idea | `06_PRODUCT_MAP.md`, `reference/IDEA_BANK.md` |
| Design lessons (mockup QA rules, composition rules) | `04_DESIGN_SPEC.md`, `reference/MOCKUP_QA.md` |
| Verified numeric examples | `04_DESIGN_SPEC.md` section 8 |

No code has been copied yet.

### 3.2 To copy into the new repository (the engine)

Copy with tests, keep behaviour identical, wrap behind the worker API. Do not "improve" while copying; open an entry in the bug inbox instead.

1. `shared/poker-domain/`: cards, deck, legality, hand state machine, pot and side-pot accounting, hand evaluator, exact equity and Monte Carlo, combinatorics, weighted ranges.
2. Strategy: the strategy provider, baseline data, the claim and source-acceptance policy.
3. Training: practice planner, generation, session and grading modules, Training Memory (`training-memory/v1`).
4. Personal Strategy: intended-strategy evidence with corrections and lineage.
5. Saved study objects (`saved-study-object/v1`, kinds Hand and Spot), Replay.
6. Game night: the exact-money organiser domain.
7. Explanations: the analysis-explanation service and factual projections.
8. Locale: number formatting and input modules; the translation catalogues as a starting word list (re-keyed for the new message format).
9. Assets: the card back, the icon set (the owner prefers the app's icons to mockup icons).

The exact list is the output of ENGINE-MAP-001: every old file classified as **engine** (copy), **service** (copy if it has no DOM), **bridge** (rewrite thin), **UI** (leave), or **mixed** (extract the pure part, with a test that pins its behaviour first).

### 3.3 Available for inspiration, not for copying

- `app/src/core/logic.js`: the record of how every screen behaved, including edge cases that took months to find (decimal input, "facing 0 bb", focus order, language switch as a presentation-only event). Read the relevant region before building the same screen. Take the *cases*, write them as behaviour tests, and implement fresh.
- `app/styles.css` and `docs/project/DESIGN_SYSTEM.md`: older token names and measurements. The new tokens replace them.
- `tests/`: mine for behaviour and numeric cases. Skip anything that asserts source text or CSS shape.
- `docs/ISSUE_REGISTER.md` and `docs/archive/agent-reports/`: known bugs and their causes. Useful before rebuilding the same feature.
- The component sheet: proof that viewing components alone helps; the new one is built from the kit instead.

### 3.4 Left behind on purpose

| What | Why |
|---|---|
| `logic.js` as code | The reason for the reset. |
| The global stylesheet | No tokens, no component boundaries. |
| The old Equity, Home, Settings, Analyze and Training screens as layouts | Redesigned. |
| Source-shape tests and CSS-model tests | They certified wrong screens. |
| Electron host | Web-first; a wrapper is a later choice. |
| Account, sign-in and sync UI | Not in the first version. The domain code may be copied dormant only if it has no side effects; otherwise leave it. |
| The worktree and ticket ceremony, verification tiers, manager pack | Replaced by slices, two gates and a state file. |
| "Chippy" art and the sidebar-with-hubs shell | Superseded (decision log S1, S2). |
| Old sounds | The owner finds them cheap and synthetic. |

## 4. Risks in the old patterns (and what each costs if repeated)

1. **A god file.** Rendering, state and event wiring for most screens in one module. Every change risked every screen; agents had to read thousands of lines to change ten. *New repo:* a room is a folder; a component is a file; no module renders another module's DOM.
2. **Global CSS with literal values.** A second theme or a spacing change meant hunting through one file. *New repo:* tokens only, styles scoped per component.
3. **Extraction by seams.** The old repo was being un-knotted one bounded extraction at a time, with mount, owner, generation and disposal fences so that stale async work could not write into the wrong user's state. Those fences encode real bugs. *New repo:* keep the idea (a store owns its data; async results carry a request ID and are dropped if stale) without the old machinery.
4. **Hidden work.** A rule called PERF-001 existed because screens once recomputed strategy and 169-cell matrices on every keystroke. *New repo:* the worker API, cancellation and "compute when visible" make this structural; still measure it.
5. **Versioned contracts that must not be flattened.** Hand state has three versions, table rules two, replay three, saved objects one. Recorded evidence is immutable; corrections are appended. A casual "clean-up" migration would destroy history. *New repo:* copy the contracts as they are; any change is a confirm-first decision.
6. **Reference data with a history.** The baseline's reference data once had an integrity problem that needed a recovery and an independent review; whether older Training Memory records were exposed to bad references was checked on one machine only. *New repo:* treat every reference table as Estimated until its source, licence and coverage are recorded; never infer validation from a hash or from plausible output.
7. **Uncommitted and unmerged work.** The Analyze composition work and several worktrees were never fully merged. *Consequence:* the tip of the main branch is not the whole truth. Ask the owner which branch or worktree to read for a given feature; do not assume.
8. **Secrets and local configuration.** There is local auth configuration for a Supabase project. Never copy it, print it or commit it.
9. **The owner's real data lives in the old app** (browser storage on the desktop PC). Until an export exists, nothing may endanger it. An export path for saved hands is one of the first things the new app owes the owner.
10. **Tests that lie in both directions.** Passing while the screen is wrong; failing on harmless refactors. If you find yourself writing a test that reads a source file as text, stop.
11. **Locale traps already paid for:** decimal separators per language, "fold" in Hebrew, numbers and cards inside right-to-left text, button text that grows two to three times in Russian. The locale modules and their tests carry these lessons; copy them early.

## 5. Engine invariants to preserve (from the old north-star document)

- One canonical owner per concept; consumers project. Never repair a missing field by building a second implementation in a renderer.
- Rules and maths identity: a versioned game-rules definition and an immutable rules snapshot.
- Exact decision economics: the facing size is wager-to; the call amount is the exact incremental, stack-capped price; contestable money and ineligible money differ; an ante is dead money. Regression case: 100 bb, blinds 0.5 and 1, a 1 bb big-blind ante, small blind calls: pot 3 bb, threshold one sixth, and a small-blind win settles 102 to 98.
- Range mathematics: inclusion weight, action probability, conditioned reach and uncertainty are four different values. Equity over known cards is conditional. Combo coverage is not probability coverage. Joint sampling rejects colliding card sets; it never renormalises sequentially.
- Correcting derived accounting is not rewriting source evidence. Imported recorded pots, rake and awards stay immutable.
- Historical records keep the evidence of their time and never silently acquire newer authority.
- Language switch is presentation only, never an identity or data event.
- Bots see only what their seat could know; replay never leaks later information backward; a hand in progress is embargoed from analysis.
- Local-first: everything meaningful works without sign-in. Guest and account data are isolated.
- No hidden heavy work: one strategy resolution per decision update; coalesced rapid input; nothing computed for panels nobody sees.

## 6. How to use the old repository safely

1. Open it in a separate, read-only context. If your tool allows, mount it read-only.
2. To learn how something behaved: read the smallest region that answers the question; write the behaviour down as a test in the new repo; close the old file.
3. To copy engine code: copy the module and its tests together; run the tests in the new repo before changing a line; record the source commit hash in the new file's header and in `docs/ENGINE_PROVENANCE.md`.
4. Never copy a file that touches the DOM, `window`, storage or the network into `engine/`.
5. If old behaviour looks wrong, do not fix it silently in the copy. Add a failing test that states the expected behaviour, log it, and ask.
