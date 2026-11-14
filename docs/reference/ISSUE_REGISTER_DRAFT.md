# Riverline issue register (draft)

Status: draft reconstructed by the Manager on 2026-10-07 from the manager-chat history: PRODUCT-QA-SWEEP-2026-10, the owner's UI/UX QA report (2026-10-02), REPO-WORKFLOW-AUDIT-2026-10, VISUAL-DESIGN-REVIEW-2026-10, and the debt recorded by every ticket since 2026-09-29. It is a guide, not an ultimatum; the owner decides priorities.

**Instructions for the docs-reset worker:** merge this with `docs/project/QA_BACKLOG.md` and `PRODUCT_RETURN_QUEUE.md`. Verify each "open" item against current code before keeping it (some may already be fixed); keep existing IDs where they exist; deduplicate; record anything the repo has that this draft lacks. Feature direction lives in NORTH_STAR.md; this register tracks bugs, findings, debt and small wants.

Legend: Severity **P1** blocks a core flow or misleads; **P2** clear quality/usability problem; **P3** polish. Milestone **M1/M2/M3/Later**. Status **Fixed** (with ticket), **Open**, **Partial**, **Decision** (needs owner).

---

## A. Truth, correctness and money

| ID | Source | Issue | Sev | Status | MS | Notes |
|---|---|---|---|---|---|---|
| QA-SWEEP-001 | sweep | Home Game: empty Cash out recorded a 0 final cash-out, uncorrectable | P1 | Fixed (HOMEGAME-LEDGER-INPUT-001) | — | Typed-0 correctability still open, see HG-002 |
| QA-SWEEP-002 | sweep | Home Game: typed amounts wiped by other seats' actions; Enter did nothing | P2 | Fixed (HOMEGAME-LEDGER-INPUT-001) | — | |
| QA-SWEEP-023 | sweep | Guest Home Game claimed data saved; dead saved-player/group controls for Guest | P3 | Fixed (HOMEGAME-LEDGER-INPUT-001) | — | |
| HG-002 / QA-HOME-GAME-INPUT-004 | ticket debt | Typed 0 cash-out must be a correctable recorded fact; existing stuck account sessions need a route | P1 | Decision made (option B, append-only final-state correction record) | M1 | HOMEGAME-ZERO-CASHOUT-001 |
| HG-003 | owner | A correction can only be corrected once | P2 | Open | M1 | Corrections must be correctable repeatedly |
| HG-004 | owner | Initial buy-in of 0 allowed | P2 | Open | M1 | Truth-fixes ticket |
| QA-SWEEP-003 | sweep | Analyze typed 2.5 became 25 (decimal eaten) | P1 | Fixed (DECISION-INPUT-TRUTH-001) | — | |
| QA-SWEEP-004 | sweep | "facing 0 bb · 1 bb to call" wording | P2 | Fixed (DECISION-INPUT-TRUTH-001) | — | |
| QA-SWEEP-008 | sweep | Replay header showed live pot/actor vs frame | P2 | Fixed (DECISION-INPUT-TRUTH-001) | — | |
| QA-SWEEP-027 | sweep | Action-panel jargon ("amount-to") | P3 | Fixed (DECISION-INPUT-TRUTH-001) | — | |
| QA-SWEEP-007 | sweep | Language switch turned Training source into "Source unavailable" | P2 | Fixed (LANGUAGE-SWITCH-EVENT-001) | — | |
| OWNER-12 | owner report #12 | Strategy adjustment sliders appear to do nothing | P1 | Open | M1 | Hide until M3 adjustment engine |
| OWNER-17 | owner report #17 | Randomized spot table incoherent (pot 6bb, all stacks 100bb), no history | P1 | Open | M1 | Spot generator contract (NORTH_STAR §6.2) |
| QA-DECISION-INPUT-009 | ticket debt | Equity "Random … ready." status not tied to stage; Training Memory panel still says "Facing N bb" | P3 | Partial (Saved part fixed) | M1 | |
| REF-DEBT-001 | recovery review | Analyze reference heading can use provider-declared display name and drops localization | P2 | Open | M3 (before any real reference) | Must fix before registering a reference |
| QA-ANALYZE-COMPOSITION-004 | ticket debt | Mix-bar RTL fix applied only to Analyze; Training mix rows still broken in HE | P2 | Open | M1 | |

## B. Layout, density and stability (systemic)

| ID | Source | Issue | Sev | Status | MS | Notes |
|---|---|---|---|---|---|---|
| OWNER-2/3/8/9/10 | owner report | Oversized panels and dead space app-wide (Home, Home Game, Personal Strategy, Training post-answer, Full Hand) | P2 | Open | M1 | Layout & stability foundation + comfort contract |
| OWNER-14/15/16 | owner report | Over-compression: tab outlines and rail borders cut into text; stepper cramped | P2 | Open | M1 | One inset scale for tabs/rails/panels |
| OWNER-12-REFLOW | owner report | UI reflows when inputs change (app-wide) | P2 | Open | M1 | Reserved heights, stable dimensions |
| OWNER-2b | owner report | Load flicker: sidebar leaf, character images pop in; "Enter Riverline" hover flicker | P2 | Open | M1 | App-ready gate, preloading, hover without layout change |
| OWNER-11 | owner report | Card slot sizing inconsistent (hero larger than board/dead) | P2 | Open | M1 | Card size scale by context |
| OWNER-18 | owner report | Stepper/mini cards cut off or positioned too high | P2 | Open | M1 | Shared card rules |
| OWNER-19 | owner report | "Heuristic fallback" shown 3–4 times on one page | P2 | Partial (Analyze body fixed) | M1 | One status/provenance indicator per surface |
| OWNER-20 | owner report | Explain leaves dead space under columns | P3 | Open | M1 | Adaptive to content |
| OWNER-1 | owner report | Sidebar header arrow and text end at the same point | P3 | Open | M1 | |
| QA-SHELL-002 | ticket debt | Legacy `[dir=rtl] header` double-flip still affects other headers | P2 | Open | M1 | |
| QA-SHELL-003 | ticket debt | Hand status line still above workspace | P3 | Open | M1 (Hand foundation) | Fixed for Analyze |
| QA-SHELL-004 | ticket debt | Training shows its own "Heuristic fallback" labels besides header badge | P3 | Open | M1 | |
| QA-SHELL-005 | ticket debt | Unaudited states for one-accent rule (Full Hand states, Saved detail, Personal inner) | P3 | Open | M1 | |
| QA-SHELL-006 | ticket debt | Home, Saved, Training sparse at 1920 in wide frame | P2 | Open | M1/M2 | |
| QA-SHELL-007 | ticket debt | Home tour step 1 uses Guest wording for signed-in users; empty context lines | P3 | Open | M2 | |
| QA-SHELL-008 | ticket debt | Layouts under 820px unchecked | P3 | Open | Later | Mobile out of scope |
| DS-FOUNDATION-005 | ticket debt | Un-migrated component families (shell nav, Hand legal-action buttons, fact strips, Personal/Training tabs, Equity fields, Settings choice cards); ~225 literal font sizes | P2 | Open | M1 (per screen) | |
| DS-CSS-DEBT | ticket debt | 44 `!important` in retired legacy theme blocks; legacy Analyze rules kept for old tests; preset colours duplicated in CSS and theme JS (guarded by test) | P3 | Open | M1 | |
| MOTION-DEBT | audio recon | Two competing CSS duration scales; no in-app reduced-motion toggle | P3 | Open | M1 | |

## C. Screen-specific findings

### Hand / Replay / Table
| ID | Source | Issue | Sev | Status | MS |
|---|---|---|---|---|---|
| QA-SWEEP-009 | sweep | Setup preview table oversized, Hero off-screen, layout jumps on Start | P2 | Open | M1 (foundation) |
| QA-SWEEP-017 | sweep | Street/status label drawn under top seat's cards | P3 | Open | M1 |
| QA-SWEEP-018 | sweep | Seat panels translucent (rail shows through) | P3 | Open | M1 |
| QA-SWEEP-019 | sweep | Stack text overflows seat (Full Hand) | P3 | Open | M1 |
| QA-SWEEP-020 | sweep | Normal pre-hand state shows orange "Hand mode unavailable" warning | P3 | Open | M1 |
| QA-SWEEP-021 | sweep | Native selects cut off values (RU/EN) | P3 | Open | M1 |
| HAND-WANT-1 | owner want | Bet-size presets, showdown winner line, keyboard actions, "everyone else folds" | — | Planned | M2 |

### Analyze
| ID | Source | Issue | Sev | Status | MS |
|---|---|---|---|---|---|
| OWNER-16-STEPPER | owner report | Action header (stepper) readability: competing fonts, cramped "Turn Waiting for turn…" | P2 | Open | M1 |
| OWNER-13 | owner report | Game & accounting limited to Home/ClubGG presets | P2 | Planned | M2 (Game Profiles) |
| ANALYZE-OPP | ticket debt | "Opponent assumptions" disclosure not built (no data) | P3 | Open | M3 |
| QA-ANALYZE-COMPOSITION-003 | ticket debt | Overridden legacy Analyze CSS still present; fact table/Spot-table toggle not on DS components | P3 | Open | M1 |
| GEOMETRY-TOOL | ticket debt | `verify_product_ui002r3_geometry.cjs` still probes removed Betting context strip | P3 | Open | M1 |

### Training
| ID | Source | Issue | Sev | Status | MS |
|---|---|---|---|---|---|
| OWNER-9 | owner report | Post-answer panel huge; hides cards and position | P2 | Open | M1 (Training redesign) |
| OWNER-10 | owner report | Full Hand: visual bugs, text alignment, spacing, oversized panels | P2 | Open | M1 |
| QA-SWEEP-010 | sweep | Full Hand lineup tiles: names clipped, run together with position/behaviour | P2 | Open | M1 |
| QA-SWEEP-026 | sweep | Training Memory: "No decisions recorded" above decisions; cards as text | P3 | Open | M1 |
| TM-RAW-ID | ticket debt | Training Memory panel shows raw `source@version` | P3 | Open | M1 |
| QA-SWEEP-030 | sweep | Full Hand header stays "Make the decision" through summary and Review | P3 | Open | M1 |
| QA-SWEEP-028 | sweep | Native `window.confirm` dialogs (unstyled, blocking, partly untranslated) | P3 | Open | M1 |
| WATCH-REST | sweep/owner want | Watch Rest takes ~45–55s with no speed/skip | P2 | Open | M1 (Full Hand quality pass) |

### Equity
| ID | Source | Issue | Sev | Status | MS |
|---|---|---|---|---|---|
| OWNER-7 | owner report | Layout breaks at 5+ players; full-width "Add player"; duplicate result panels; IA needs rework | P2 | Planned | M2 (rework); M1 foundation fixes |
| QA-SWEEP-005 | sweep | Spade mini-cards invisible in Runout Explorer | P2 | Open (verify; may be fixed by DS card rules) | M1 |
| QA-SWEEP-006 | sweep | Card-outcome preview positioned off-screen | P2 | Open | M1 |
| QA-SWEEP-031 | sweep | Precision mismatch (27.05% vs 27.1%), chip-style cards, mislabeled range select | P3 | Open | M2 |
| EQ-LOCALE | sweep narrative | Numbers use Russian formatting in English mode | P3 | Open | M1 |

### Personal Strategy
| ID | Source | Issue | Sev | Status | MS |
|---|---|---|---|---|---|
| OWNER-8 | owner report | Panels too long/large; whole tab needs work | P2 | Planned | M2 (rework); M1 foundation |
| QA-SWEEP-011 | sweep | Raw JSON, UUIDs, fingerprints in disclosures | P2 | Open | M1 |
| PS-TENTATIVE | sweep narrative | Copy says answers "don't fill in nearby hands" while neighbours show Tentative | P3 | Open | M1 |
| PS-MATRIX-CONTRAST | sweep narrative | Range matrix strategy colours faint | P3 | Partial (Analyze fixed) | M2 |
| PS-MATRIXEDIT-TERMS | sweep narrative | Matrix Edit status labels don't match Understanding terminology | P3 | Open | M2 |

### Saved
| ID | Source | Issue | Sev | Status | MS |
|---|---|---|---|---|---|
| OWNER-5 | owner report | Hover adds almost no information; tag system needs rework | P2 | Planned | M2 |
| OWNER-6 | owner report | Training history bubbles ("Revisit due…") display issues; "Answered" column cut off | P2 | Open | M1 |
| QA-SAVED-COMPOSITION-004 | ticket debt | Search doesn't cover auto-titles | P3 | Open | M2 |
| SAVED-FELT | design review | Inspector felt card preview from mockup; richer header context line | P3 | Open | M1 |
| QA-SWEEP-024 | sweep | "Pot 0 bb" on completed hands; colliding auto-titles | P3 | Fixed (SAVED-COMPOSITION-002) | — |

### Home / Study Inbox / onboarding
| ID | Source | Issue | Sev | Status | MS |
|---|---|---|---|---|---|
| QA-SWEEP-012 | sweep | Welcome focus escapes to hidden content under overlay | P2 | Open | M1 |
| QA-SWEEP-025 | sweep | Study Inbox: nested duplicate disclosure, generic "Saved"/"Open source" | P3 | Open | M2 |
| REPO-AUDIT-003 | audit | Home Personal Strategy card promised in spec, no DOM target; dead query on every Home load | P2 | Open | M2 (Home redesign decides) |
| QA-SWEEP-032 | sweep | Defensive/meta copy in Settings/Guide; dash typo in Guide intro | P3 | Open | M1 |

### Home Game
| ID | Source | Issue | Sev | Status | MS |
|---|---|---|---|---|---|
| OWNER-4 | owner report | Blinds optional, per-player buy-ins missing, player configuration needs rework | P2 | Planned | M2 (rework); 0 buy-in in M1 |
| HG-GLYPH | owner screenshot | ₪ renders as an empty box (font lacks glyph) | P3 | Open | M1 |
| HG-SEATS | owner screenshot | Seat cards noisy (empty fields, big name blocks) | P2 | Planned | M2 |

### Settings / Guide / i18n
| ID | Source | Issue | Sev | Status | MS |
|---|---|---|---|---|---|
| QA-SWEEP-015 | sweep | Selected option caption contrast | P2 | Fixed (DS-FOUNDATION-001) | — |
| QA-SWEEP-014 | sweep | RU/HE Home vs Home Game same label | P2 | Fixed (SHELL-001) | — |
| QA-SWEEP-013 | sweep | Home tour steps spotlight wrong elements | P2 | Fixed (SHELL-001) | — |
| QA-SWEEP-029 | sweep | Nav self-tooltips overlap | P3 | Fixed (SHELL-001) | — |
| QA-SWEEP-016 | sweep | Card picker: 52 Tab stops, no arrow navigation, ArrowDown scrolls page | P2 | Open | M1 |
| QA-SWEEP-022 | sweep | Untranslated strings ("Random private cards ready", "Training Memory" in RU prose) | P3 | Open | M1 |
| QA-LANGUAGE-SWITCH-003 | ticket debt | ~45 elements carry static `data-i18n` keys overwritten by code (latent stale text) | P2 | Open | M1 |
| OWNER-I18N | owner report | Translation quality, poker terminology, overflow, RTL as app-wide requirement | P2 | Planned | M1 (completeness) / later (native polish) |
| HE-SAVED-ORDER | design review | Hebrew Saved cards reversed | P2 | Fixed (DS-FOUNDATION-001) | — |
| REPLAY-RAW-KEY | design review | `replay.status.saved` raw key at 1366 | P3 | Fixed (DECISION-INPUT-TRUTH-001) | — |

## D. Repository, tests, docs and workflow

| ID | Source | Issue | Sev | Status | MS | Notes |
|---|---|---|---|---|---|---|
| REPO-AUDIT-001 | audit | Docs vs commits disagree on acceptance | P1 | Open | M1 | Docs reset |
| REPO-AUDIT-002 | audit | Personal Strategy local v2 vs remote v1 sync contract; RET-ACCOUNT-003 mislabelled | P1 | Decision | Later | Account work |
| REPO-AUDIT-004 | audit | Electron test in CI glob | P2 | Fixed (REPO-HYGIENE-001) | — | |
| REPO-AUDIT-005/006/007/008 | audit | Stale ACTIVE NEXT, undocumented checkpoints, stale claims, unreadable planning docs | P2 | Open | M1 | Docs reset |
| REPO-AUDIT-009 | audit | ~98 test files assert source text of logic.js/CSS; copied `sourceBetween` helpers | P2 | Open | M1 | Test hygiene; per-extraction rule |
| REPO-AUDIT-010 | audit | logic.js ~14k lines; next extraction candidates: Home rendering, Training Memory panel, Equity results | P2 | Open | M1/M2 | Follow redesigns |
| REPO-AUDIT-011 | audit | UI-side poker helpers (handClass, preflopBasePot, strategyAccountingContext, SPR) | P3 | Open | M2 | Move to shared domain when touched |
| REPO-AUDIT-012 | audit | 22 unused exports | P3 | Open | M1 | |
| REPO-AUDIT-013 | audit | Root artifacts; server.py unused; root package-lock coupled to a test; empty reference-data dir; `.claude/*.lock` not ignored | P3 | Partial | M1 | Owner decisions pending |
| REPO-AUDIT-014/015 | audit | Line endings; Node/Python versions | P3 | Fixed (REPO-HYGIENE-001) | — | |
| REPO-AUDIT-016 | audit | Workflow docs vendor-specific/contradictory; no minimum read set | P2 | Open | M1 | Docs reset |
| REPO-AUDIT-017 | audit | .git 71 MB from retired ONNX blobs | P3 | Won't fix | — | Don't rewrite history |
| TEST-DIT001-PREEXIST | tickets | Two decision_input_truth001 tests were already failing at HEAD before later tickets | P3 | Open (verify) | M1 | Test hygiene |
| A11Y-CVD | Argon research | Check action colours under colour blindness; add non-colour cues where missing | P2 | Open | M1 | Design refresh |
| A11Y-MATRIX-KEYS | Argon research | Range matrix: one tab stop with arrow-key navigation (same family as QA-SWEEP-016) | P2 | Open | M1 | Components v4 |
| FLAKY-SAVED-KEY | tickets | Saved keyboard test fails under parallel load (seen 3×) | P2 | Open | M1 | |
| EVIDENCE-ARCHIVE | recovery | full_diff.patch, status.txt, %TEMP% recovery snapshot (ACL-denied) and logs need a durable archive | P3 | Open | M1 | Riverline_archive folder |
| WIP-BACKUP | manager | Uncommitted Analyze work (+ amendments) only in working tree | P1 | Open | M1 (first action) | wip/ branch |

## E. Small wants and preserved ideas (not bugs)

| ID | Want | MS |
|---|---|---|
| WANT-TUTORIAL-INDEX | Tutorial index in Learn hub | M2 |
| WANT-EQUITY-GRID | Visual range picker in Equity (reuse PS matrix) | M3 (pull if cheap) |
| WANT-SAVED-TITLES | Meaningful auto-titles | Fixed (SAVED-COMPOSITION-002) |
| WANT-BACK-TO-REVIEW | Back to Review after Explain | M3 |
| WANT-WATCH-SPEED | Watch Rest skip (M1) and speed (M2); same item as WATCH-REST | M1/M2 |
| WANT-SHORTCUTS | Shortcuts sheet; command palette later | M2 / M3 |
| WANT-DERIVATIONS | Hover number derivations | M3 |
| WANT-AUTO-NEXT | Training speed: auto-next after feedback, optional timer | M2 |
| WANT-REVISIT-WHY | Transparent scheduling: every due or revisit item says why it is due | M2 |
| WANT-SIMILAR-SPOTS | "Similar saved spots" next to a decision | M3 |
| WANT-PRINT-SHEET | Printable strategy sheet | M3 |
| WANT-LEAK-REPORT | Leak report vs your plan | M3 |
| WANT-SPOT-OF-DAY | Spot of the day | M3 |
| WANT-FOCUS-MODE | Focus mode | M3 |
| WANT-HG-HISTORY-STATS | Home Game per-person lifetime stats | Later |
| WANT-HG-SHARE | Share Home Game results; live-night helpers | M3 |
| WANT-GLOSSARY-TOOLTIPS | Glossary tooltips | M2 |
| WANT-GUIDED-WEEK | Guided first week | M3 |
| WANT-RANGE-V-RANGE | Range vs range on a board | M3 |
| WANT-COMPETITIVE-PASS | Competitive reference pass for feature ideas | M3 |
| AUDIO-RECON items | Mixer, assets, System category, provenance doc out of date | M3 |
| WANT-SHORTCUT-REBIND | Configurable keyboard shortcuts with clash check and reset (key contract in M1, rebinding M2) | M2 |
| WANT-LEGAL-DOCS | Privacy policy, cookie/local storage notice, terms, licences and third-party notices, study-tool disclaimer, contact, accessibility statement (Settings › About & legal); professional review before sharing | Later (gate for first real release) |

## F. Independent review findings (2026-10)

| ID | Finding | Status | MS |
|---|---|---|---|
| REVIEW-DOC-01 | NORTH_STAR Equity input types, fold example, verdict "leans" state, mockups-as-spec | Fixed in NORTH_STAR draft | — |
| REVIEW-DOC-02 | Shortcut keys inconsistent across mockups; Settings › Shortcuts incomplete | Key contract adopted as proposal | M1 |
| REVIEW-DOC-03 | Disabled "coming later" controls in Settings | Rule: no placeholder controls | M1 |
| REVIEW-DOC-04 | Missing About & legal placeholder; Chippy vs Help & guide category | Open | Later/M3 |
| REVIEW-MATH-01 | Mockup numbers wrong (Equity runouts, Style, Learn wording, Home Game totals) | Rule: golden numbers from engine; corrections in MOCKUP_REVIEW_LOG | M1 |
| REVIEW-MATH-02 | Scoped "Exact" labels; MC confidence level; luck needs known cards | Adopted in NORTH_STAR | M1/M2 |
| REVIEW-MATH-03 | Estimated mixes shown at 1% precision; trace actions | Round to 5%, hide <5% | M1 |
| REVIEW-EVID-01 | Evidence gate, no VPIP from drills | Adopted in NORTH_STAR | M2 |
| REVIEW-PS-01 | Plan bounds with Sometimes; spot map from Table rules; HJ group | Adopted in NORTH_STAR | M2 |
| REVIEW-HG-01 | Balance gate must count only recorded entries | Adopted | M2 |
| REVIEW-ORBIT-01 | Stack carry/top-up undefined | Design question | M3 |
| REVIEW-BASE-01 | Review example: heuristic suggests raise/fold mixes that look dubious (AK on K84 two-tone) | For the baseline audit | M1 |
| REVIEW-IDEA-10 | Money-mode reconstruction (type ₪, stored in bb) | Candidate | M2 |
| DATA-SAFETY-M1 | Request persistent storage; guard Delete all data (type to confirm); export early M2; import M3 | Decided | M1/M2/M3 |
