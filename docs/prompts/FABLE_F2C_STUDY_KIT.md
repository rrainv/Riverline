# Fable 5.2 session F2c: Component Kit — Study, Grids & The Lamp (Part 3 of 3)

**Paste everything below the line into a new session opened in the new repository** (after F2b). One session, one outcome.

---

You are completing the **Riverline** component kit (`src/ui/kit/`, Part 3 of 3). Read `AGENTS.md`, `docs/STATE.md`, `docs/handoff/04_DESIGN_SPEC.md` (sections 4, 6, and 7), and `.agents/rules/design-tokens.md`. Open `docs/design/prototypes/lamp-moods.html`, `lamp-themes.html`, `riverline-app.html`, and `design-system.html` as the visual and behavioural reference. Do not copy their code.

## Outcome
All 18 components of `04_DESIGN_SPEC.md` section 4 complete on `/kit` in every state, across all 7 themes, 3 languages (`en`, `ru`, `he`), and both viewports (`1920×1080` and `1366×768`), with behaviour tests and all 5 gates at zero.

## Build (in `src/ui/kit/<component>/`: component `.tsx`, styles `.module.css`, sheet entry, behaviour test `.test.tsx`)
Build the final 3 components of the kit:

1. **Teacher callout and the Lamp** (`#14` & section 7):
   - **The Lamp**: abstract desk lamp with two simple eyes ("one light"), reading all colours from CSS tokens (never hardcoded hex in SVG) so it adapts across all seven themes (`prototypes/lamp-themes.html`). Sizes: `28px` inline, `44px` in lists, `72px` in cards, `128px` on Home/onboarding.
   - **Eight animated moods** (`prototypes/lamp-moods.html`): `idle` (3.4 s breathing loop, occasional blink), `thinking` (cool light, slow orbit, eyes drifting—used for engine loading), `curious` (beam tilts, one brow up), `speaking` (radiating rings while text types), `approving` (wider brighter beam + small spark), `celebrating` (short burst then back to idle), `stern` (beam narrows and cools—**locked owner decision, keep stern**), `resting` (dim and slow, wakes on click).
   - **Teacher callout**: the Lamp at reading-start, text typed at user's chosen typing speed (with instant completion on click/keypress and under reduced motion), tier badge, at most one action button, and user setting to hide the Lamp.
2. **Heat grid** (`#15`): One shared component powering three views:
   - **Runout grid** (4×13 playing cards, coloured by turn-card effect on hero, struck cards in play),
   - **Leak map** (hand families × players behind, coloured with `--over`/`--over-text` and `--under`/`--under-text`, brass tick for baseline, sample count),
   - **13×13 range matrix** (pairs on diagonal, suited above, offsuit below; **never mirrored in right-to-left Hebrew**; three states per cell in Personal Strategy: yours, baseline, unknown/dashed).
   - Full keyboard navigation (`ArrowUp`/`Down`/`Left`/`Right` to move ring, `Escape` to clear) and `stagger-s` entrance.
3. **Family strip** (`#16`): The plan builder's control: a horizontal strip of hands in a family ordered strongest to weakest (e.g. suited kings `AKs`..`K2s`). Set the cutoff by **dragging**, clicking, or arrow keys; the handle visibly shows its edge; live count of selected hands and combinations; optional baseline comparison tick.

For each component:
- Add all states and longest Russian strings to `/kit`.
- Ensure all 18 kit components pass `npm run typecheck`, `npm test`, `npm run check:raw`, `npm run audit:layout`, and `npm run audit:theme` at zero across all 7 themes, 3 languages, and both desktop viewports (`1920×1080` and `1366×768`).

## Before you write code
Reply with your disagreements with the spec, your questions, and your implementation plan for these 3 components. Wait for the owner's reply.

## Finish with
The five-line report, gate outputs, a summary of all 18 kit components on `/kit` (honestly noting any component that needs follow-up polish), and update `docs/STATE.md`.
