# Fable 5.2 session F2: Component kit

**Recommended:** Run **F2a** (`prompts/FABLE_F2A_CORE_KIT.md`), **F2b** (`prompts/FABLE_F2B_TABLE_KIT.md`), and **F2c** (`prompts/FABLE_F2C_STUDY_KIT.md`) in three separate sessions so all 18 components receive full craft, motion, 3-language sizing, and zero-defect audits without context exhaustion. Use this single combined prompt only if you want one session to plan and batch the entire kit.

**Paste everything below the line into a new Claude Fable 5.2 session opened in the new repository** (after F1).

---

You are continuing the founding of **Riverline**. Read `AGENTS.md`, then `docs/STATE.md`, then `docs/handoff/04_DESIGN_SPEC.md` in full, then `docs/handoff/06_PRODUCT_MAP.md` part 1, and `.agents/rules/design-tokens.md`. Open `docs/design/prototypes/riverline-app.html`, `design-system.html`, `motion-cards-and-table.html` and `motion-interface.html` and use them as the visual and behavioural reference. Do not copy their code.

## Why this session matters most
The previous version of this product failed because each screen was drawn once as a mockup and then rebuilt by hand, and the feel was lost in translation. This session removes the translation: the **component sheet in this repository becomes the visual truth.** Every later screen is assembled from these components and inherits their quality. Spend your care here.

## Outcome
A component sheet at `/kit` showing every shared component, in every state, switchable between seven themes, three languages and two viewport sizes (`1920×1080` and `1366×768`), with every gate at zero.

## Build (in `src/ui/kit/`, one folder per component: `.tsx` component, `.module.css` styles, messages, a sheet entry, `.test.tsx` behaviour tests)
The eighteen components of `04_DESIGN_SPEC.md` section 4:
panel · button · chip and tier badge · chip button and segmented control · text input with token chips · option tickets with the size ladder · playing card (all sizes; face, back, slot, struck, dimmed) · felt table with seat, action bubble, thinking dots, action ring, pot and chips · mix bar with the "you" pointer · equity row and bar · history rail and street strip · fact tile · teacher callout with the Lamp (eight moods) · heat grid (runout grid, leak map, 13×13 matrix) · family strip · overlays (tooltip, palette, dialog, toast, phone sheet) · stepper. The shell from F1 moves into the kit.

For each component:
1. Every state on the sheet: rest, hover, pressed, focus, disabled, selected, error, loading, empty, and its longest realistic content in Russian.
2. Styles via CSS Modules (`*.module.css`) from tokens only (including inline SVG `fill`/`stroke` via `var(--...)`). Logical properties. Poker notation left-to-right (`<bdi dir="ltr">`).
3. Keyboard operation and accessible names. Nothing interactive inside another interactive element.
4. Motion from `04_DESIGN_SPEC.md` section 6: the table in 6.3 is the contract. Card deal and flip, the fold (face down before flight, never overlapping), the showdown outline, the border draw on the chosen ticket, the mix-bar wipe with the pointer at the chosen size, the action ring, thinking dots, action bubbles above seats, number counting, row enter and leave, overlay open and close. Reduced motion and the pace setting must work on the sheet.
5. Behaviour tests (what it does), never tests of its markup or CSS.

## Rules for this session
- Tokens only; `npm run check:raw` at zero. If a value is missing, add a token to `tokens/tokens.css` with a value for every theme that needs one, and say so in the report.
- The type and space scales in the spec are the target. The prototype's in-between sizes are not. Settle each component's sizes so that Russian fits at 1366×768.
- Extend the layout audit and theme audit (running against `vite preview`) to walk every sheet entry in every theme and language at both `1920×1080` and `1366×768`. Zero is the pass mark.
- Where the spec and the prototype disagree, the spec wins; where the spec is silent, follow the prototype; where both are silent, ask.
- Propose improvements. If you see a better interaction or a cleaner state model than the prototype's, describe it in a paragraph and wait for a yes before building it.

## Do not
- Do not build rooms, engine code or storage.
- Do not introduce a component library, a CSS framework or an animation library without asking.
- Do not build Equity "Layout B" or any card-per-player layout.

## Before you write code
Reply with your disagreements with the spec, your questions, and a plan that orders the components by dependency. Wait for the owner's reply.

## Finish with
The five-line report, the gate outputs, a list of every token you added, every place you departed from the prototype and why, and the components you consider below standard, honestly.
