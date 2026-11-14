# Fable 5.2 session F2b: Component Kit — Poker & Table Components (Part 2 of 3)

**Paste everything below the line into a new session opened in the new repository** (after F2a). One session, one outcome.

---

You are building Part 2 of the **Riverline** component kit (`src/ui/kit/`). Read `AGENTS.md`, `docs/STATE.md`, `docs/handoff/04_DESIGN_SPEC.md` (sections 4 and 6), and `.agents/rules/design-tokens.md`. Open `docs/design/prototypes/riverline-app.html`, `equity-by-rows.html`, `motion-cards-and-table.html`, and `motion-interface.html` as the visual and behavioural reference. Do not copy their code.

## Outcome
The 6 poker and table components built in `src/ui/kit/`, rendered on `/kit` in every state (including interactive motion replay triggers on the sheet), with behaviour tests and all 5 gates at zero across all 7 themes, 3 languages, and 2 viewports.

## Build (in `src/ui/kit/<component>/`: component `.tsx`, styles `.module.css`, sheet entry, behaviour test `.test.tsx`)
Build these 6 components from `04_DESIGN_SPEC.md` section 4 and section 6.3:

1. **Playing card** (`#8`): Sizes: mini, small (30×40), standard (34×46), large (48×66), table. Rank over suit, rank weight 700 (`--fw-bold`), `--cardface`, `--card-ink`, `--card-red`, `--pcshadow`. States: face, back (`--cardback` with `--cardback-edge` brass rim), slot (dashed `--line3`), struck (in play), dimmed. Two-card illustration variant (one face up in front, one face down behind). Motion: deal flight (`--dur-4` `--ease-out`, `--stagger-m`) + flip (face swaps at edge-on midpoint); **fold** (cards lift, turn face down first, toss to muck on uneven arc `--dur-4` `--ease-exit`—never overlapping, never face up in flight).
2. **Felt table** (`#9`): Stadium-shaped felt (`--felt`) with brass rim (`--felt-rim`, `--felt-rim2`); **hero at the bottom**; seats around; pot in the middle; board cards on the felt; nothing overlaps a seat; text never touches the rim (`--on-felt`, `--on-felt2`). Includes:
   - **Seat**: disc (`--seat-bg`, `--seat-line`, `--seat-ring`, `--seat-ink`, `--seat-text`), name tag, stack, style line, dealer mark; folded seat dims to 40% (`--dur-2`).
   - **Action bubble**: appears **above the seat** (`--dur-2`, stays readable `× var(--pace)`).
   - **Thinking dots**: visible looping dots while a bot thinks.
   - **Action ring**: travels between seats (`calc(var(--dur-3) * var(--pace))` `--ease-inout`).
   - **Chips**: light arc to pot (`--stagger-m`), pot label bumps once (`--ease-spring`) and counts.
   - **Showdown state**: hole cards turn; winning five lift with an **outline**; rest dim.
   - **Menu variant** (for the Training hub): natural seats with labels to pick a mode.
3. **Option tickets and size ladder** (`#7`): Two to four tickets (`Fold`, `Call`, `Raise to...`), each a real `<button>` showing its keyboard shortcut. Select, then confirm with the primary button. Chosen ticket draws its border around it (`--dur-4`) while others step back to 50% opacity. Sizes live in one place: a customisable **size ladder** under the tickets (editable presets + reset), never inside a ticket. Costs: shown on hover per size (labelled with its own size) AND persistently for the currently selected size.
4. **Mix bar** (`#10`): Thick bar of action shares with labels inside segments; fills as **one uniform wipe from left to right** (`--dur-4` `--ease-inout`, not segment by segment); a `"you"` pointer below the bar slides (`--dur-3` `--ease-spring`) to the position of the chosen raise size (bigger raise sits further right) and never covers a label. Text on segments must pass 4.5:1 contrast in every theme.
5. **Equity row and bar** (`#11`): Player row (who, hand/range/unknown cards, equity bar with `scaleX` from reading-start edge and a tick for the previous street's value, equity percentage once with delta, one "right now" fact, remove action). Dense and compact density modes. Row enter/leave (`--dur-3` / `--dur-2` with FLIP). **Never build Layout B (card-per-player grid).**
6. **History rail and street strip** (`#12`): The one history component: vertical, grouped by street, current row highlighted, new rows slide in. Plus the horizontal street strip showing result/pot/SPR by street.

For each component:
- Respect the **two clocks** rule (`--pace` multiplies table time only; interface feedback runs at token speed) and **reduced motion** (removes travel/flips/rolls, keeps table action pauses).
- Add every component and its states to `/kit`, run `npm run typecheck`, `npm test`, `npm run check:raw`, `npm run audit:layout`, and `npm run audit:theme` across all 7 themes, 3 languages, and 2 viewports to zero.

## Before you write code
Reply with your disagreements with the spec, your questions, and a short plan ordering the 6 components. Wait for the owner's reply.

## Finish with
The five-line report, gate outputs, any tokens added, any departures from the prototype and why, and update `docs/STATE.md`.
