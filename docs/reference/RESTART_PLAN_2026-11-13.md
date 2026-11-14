# Riverline restart: the bigger picture (2026-11-13)

A guide, not an ultimatum. The owner decides. Short on purpose: the lesson of the last rework was that big plans plus big gates produced correction loops. So this plan has few gates, each cheap and automatic, and one rule above all: **a slice is done when the owner uses it for a real Friday, not when a checklist passes.**

## 1. Where we are

- **Design:** about 25 screens and boards on one canvas: dock shell, Home, Training hub, drill, Strategy leak map, plan builder, Equity, Review, Hand recorder (tap and typed), Leak scan, Heads-up duel, Full hand, Session report, Weekly letter, Share card, Saved library, Learn, Settings (six themes, custom theme editor), Game night on a phone, the Lamp, 18 motion moments.
- **Tools that exist and work:** the layout audit (`riverline_tools/audit.js`), the exact-equity evaluator (`eqexact.py`), a stand-in runtime for testing mockups, the Gemini review pack.
- **Decided:** new repo, engine copied in, logic.js mined not ported, web-first installable app, worker API for the engine, Preact + signals + Vite + TypeScript (proposal, agreed by Gemini), port the *visuals and behaviour* not the markup.
- **Not yet done (design debt):** see section 2.

## 2. What still needs doing, in the order I would do it

**A. Design debt (small, finish before code)**
1. Personal Strategy home: the spot map (first in, facing an open, facing a 3-bet), conflicts, "continue where it matters", the three-state matrix. The plan builder is its editor.
2. **Hebrew, Russian and right-to-left pass.** This is the largest untested risk. Every screen so far is English. Russian labels grow 200 to 300 percent, Hebrew mirrors the layout but keeps cards, ranges and amounts left to right. Do it once, early, as a test on the canvas (strings table plus a direction switch) before any code exists.
3. Onboarding end to end: where do you play, leak scan or plan builder, first drill, Home. Skippable everywhere.
4. Table rules and "My poker" (blinds, rake, stacks, saved people and lineups). Hand and Training depend on it.
5. Hand-history import (paste, strict, fail-closed) and phone-note paste.
6. Keyboard and accessibility pass; reduced-motion variants; focus order.
7. Tokens and component contracts, written once the above stops changing.

**B. Engine and architecture (not design, can start in parallel)**
1. ENGINE-MAP-001: classify every old file as engine, service, bridge, UI or mixed. Read-only. Already written, not yet run.
2. Worker API contract: flat buffers, request IDs and cancellation, seeded randomness, synchronous price and SPR maths on the main thread.
3. Storage: IndexedDB event log, one-file export and import in week one.
4. Golden numbers: every figure shown on screen comes from the engine and has a test (the pot-odds, equity, luck and SPR figures verified in this round are the first fixtures).

**C. Product decisions needed from you (none blocks design)**
- Evidence gate: keep a flat n of 15, or a credible-interval rule with a small minimum (Gemini's suggestion).
- Game night default units: chips or points rather than shekels, plus a proper legal read before any public RU/HE release.
- Open source or closed (keeps AGPL out of the app until decided).
- Spaced repetition: fixed revisit timers or FSRS.
- Online real-time-assistance warning in About and legal.

## 3. Who does what

| Role | Best for | Not for |
|---|---|---|
| **Claude Fable 5.2** | The few big, expensive jobs at the start: architecture and skeleton in one pass, the token system and the shared components, the engine port and worker API, the first vertical slices, hard correctness (equity, accounting, evidence maths, migrations). Anything where a lot of context must stay coherent at once. | Routine tickets, bug batches, string sweeps. It is the budget item; spend it where coherence matters. |
| **Claude Opus** | Feature slices after the foundation exists; independent code review; design iterations like the ones in this chat. | Cheap mechanical work. |
| **Claude Sonnet** | Normal tickets, i18n sweeps, audits, docs, test writing. | Cross-cutting design. |
| **Claude Haiku** | The bug inbox: scheduled batches of small fixes, string checks, lint-level work. No git authority. | Anything that needs judgement. |
| **Gemini (Antigravity)** | **Research:** market, legal reading lists, pedagogy, terminology validation, reference research for the baseline. **Independent review** at gates (as this round showed: sharp on consistency and numbers, overconfident on labels, so insist on scripts and reproducible checks). **Coding later,** on isolated, well-specified modules with strict file ownership: i18n catalogue tooling, audit and CI scripts, data tables, docs tests, test authoring. | Architecture decisions, the engine core, anything it cannot verify by running it. |
| **ChatGPT** | A third pair of eyes for numeric verification when two models disagree. | Primary work. |

**Cross-vendor rule:** at each gate, one model builds and a different vendor reviews. Gemini reviewing Fable's output, and the reverse, catches what self-review cannot.

## 4. The Fable 5.2 kickoff: four heavy sessions, each with a packet

Each session gets one packet: the founding draft, the design canvas link and screenshots, the tokens or components so far, the audit tools, the golden numbers, and an acceptance list. Each ends with a runnable thing the owner can open.

1. **Foundation.** New repo, TypeScript strict, Vite, Preact and signals, CI with the audit and the golden-number tests, the theme system (Midnight and Daylight at minimum), the dock shell with rail, search and focus mode, the engine copied in with its tests green, the worker RPC stub. Deliverable: the empty app that already passes every gate.
2. **Components.** About a dozen to fifteen shared pieces, built once and shown on a component sheet: shell, tier badge, playing card, felt table, seat, action tickets, mix bar, history rail, fact tile, teacher callout, the Lamp, range strip, matrix. English, Russian, Hebrew and right-to-left from the first commit. Each is geometry-tested in isolation.
3. **Slice 1: Review plus Hand recorder** on the real engine, with the typed shorthand parser shared. This is the loop only Riverline has.
4. **Slice 2: Game night, storage, export.** Then the first real Friday.

After that, Opus and Sonnet take the remaining screens as tickets, one per screen, with Haiku on the bug inbox. Fable comes back only for hard problems.

## 5. The Gemini queue (research first, coding later)

Research, in order of value:
1. **Baseline and references:** what published preflop sources exist, what their terms allow, and how a "Verified" tier could be measured honestly for 30 to 60 bb home games.
2. **Hebrew and Russian terminology:** validate the terminology sheet against how players actually talk, with sources.
3. **RTL and i18n technical review** of the shell, tables and the plan builder, before code.
4. **Pedagogy:** feedback timing, spaced repetition, deliberate practice, applied to poker study; what to avoid.
5. **Home-game and hand-capture UX:** competitors and field research, especially phone entry at a live table.
6. **Legal reading list** (not advice): study-tool disclaimers, real-money gambling adjacency, Israel and Russia, online real-time-assistance rules.
7. **Performance budget:** worker clone costs, Monte Carlo on weak laptops, motion on integrated graphics.

Coding, later and carefully: the i18n catalogue tooling, the audit and CI scripts, golden-number test authoring, docs tests. Always one owner per file set, small tickets, tests first, and a Claude review before merge.

## 6. Guardrails against correction loops

1. **Two automatic gates only:** the layout audit (overlap, clipping, covered text, tab alignment, tap targets, RTL) and the golden-number tests. Everything else is human.
2. **Components, not pages.** Fix a defect once, in the component, and every screen inherits it.
3. **Bug inbox.** One file, batch fixes on a schedule, a cheap model, no ticket per bug.
4. **Budget per slice.** Fixed effort, then stop and judge by use. Quality is judged by the owner using it, not by a gate list.
5. **Mockups are a visual reference, never a numeric spec.** Every number on screen comes from the engine.
6. **Raise disagreements; the owner decides.** Nothing here is final.

## 7. Next from me

Finish the Personal Strategy spot map, then the Hebrew, Russian and right-to-left canvas test, then write the tokens and component contracts, then prepare the Fable 5.2 packets. In parallel, you can send the first Gemini research items (the queue above is written so each can be pasted as a brief).
