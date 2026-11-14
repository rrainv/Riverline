# Fable 5.2 session F2a: Component Kit — Core UI Primitives (Part 1 of 3)

**Paste everything below the line into a new session opened in the new repository** (after F1 / F1b). One session, one outcome.

*(Note: F2's 18 components are split into **F2a (Core UI Primitives)**, **F2b (Poker & Table Kit)**, and **F2c (Study & Teacher Kit)** so every component gets full craft, motion, 3-language sizing, and zero-defect audits without context exhaustion.)*

---

You are building Part 1 of the **Riverline** component kit (`src/ui/kit/`). Read `AGENTS.md`, `docs/STATE.md`, `docs/handoff/04_DESIGN_SPEC.md` (sections 1 to 4 and 6), and `.agents/rules/design-tokens.md`. Open `docs/design/prototypes/design-system.html`, `riverline-app.html`, and `motion-interface.html` as the visual and behavioural reference. Do not copy their code.

## Why this session matters
The component sheet at `/kit` is the visual truth of the repository. Every room will be assembled from these components without per-room style overrides.

## Outcome
The `/kit` component sheet route live in the app (with controls to switch all 7 themes, 3 languages `en`/`ru`/`he`, table pace, reduced motion, and viewport preview), displaying the first **8 core UI components** in every state, with behaviour tests and all 5 gates at zero.

## Build (in `src/ui/kit/<component>/`: component `.tsx`, styles `.module.css`, sheet entry, behaviour test `.test.tsx`)
Move the **Shell** from F1 into `src/ui/kit/shell/`, build the `/kit` component sheet harness, and build these 8 components from `04_DESIGN_SPEC.md` section 4:

1. **Panel** (`#2`): `--panel-bg`, `--panel-border`, `--radius`, `--shadow`, 18 px padding (`--panel-pad`). Micro label (`--fs-micro`), title (`--fs-title`), content. Never nested (group inside with space and `--line` hairlines).
2. **Button** (`#3`): Primary (accent fill `--accent` with `--accent-ink`, one per view, carries committed amount e.g. `"Confirm: bet 3.8 bb"`), secondary (outline `--line2`), danger (outline `--danger` and `--danger-bg` wash). Rest, hover, pressed (`scale(0.97)`), focus (`--focus-ring`), disabled (`--track` with `--text3`, never faded accent).
3. **Chip and tier badge** (`#4`): Pills, 24 to 28 px (`--h-chip`). Tier badge sits once per panel in the same corner everywhere (`Exact`, `Verified`, `Estimated`, `Unavailable`, plus qualified forms like `"Exact · all 990 runouts"`, `"Exact · price only"`). Neutral colours only.
4. **Chip button and segmented control** (`#5`): For small choices (table pace, street, filters). Selected: accent border, `--sel-bg`, `--accent-text`. Animated highlight/underline glide (`--dur-3` `--ease-inout`).
5. **Text input and token chips** (`#6`): Recessed well (`--well`, `--h-input`). Used for shorthand: tokens appear as chips as you type; an invalid token is outlined in `--danger` and named in an inline alert beside the field with the sideways invalid-input nudge (`04_DESIGN_SPEC.md` section 6.3).
6. **Fact tile** (`#13`): Label, one tabular number (`--num`), tier or unit. Two to four per panel instead of a fact table. Number counting animation (`--dur-4`, lands on exact value, no spring overshoot).
7. **Overlay** (`#17`): Tooltip, command palette, dialog, toast, phone sheet. Unified `--overlay-*` tokens. Scrim (`--scrim`, `--dur-2`) behind dialogs and palette; surface enters from 96% scale + 10 px (`--dur-3` `--ease-out`); focus moves in immediately and returns on close; Escape closes top layer; type-to-confirm for destructive dialogs.
8. **Stepper** (`#18`): Minus, value, plus, for amounts on the phone and for bet-size edits. Minimum tap target `--tap-min` on phone.

For each component:
- Show every state on `/kit`: rest, hover, pressed, focus, disabled, selected, error, loading, empty, and its longest realistic content in Russian.
- CSS Modules + tokens only (`npm run check:raw` at zero; no raw hex/rgb in SVG or TSX). Logical CSS properties; `<PokerNotation>` (`dir="ltr"`) for poker tokens/numbers.
- Extend `npm run audit:layout` and `npm run audit:theme` to walk `/kit` across all 7 themes, 3 languages, and `1920×1080` + `1366×768`.

## Before you write code
Reply with your disagreements with the spec, your questions, and a short plan ordering the 8 components. Wait for the owner's reply.

## Finish with
The five-line report, gate outputs, any tokens added, any departures from the prototype and why, and update `docs/STATE.md`.
