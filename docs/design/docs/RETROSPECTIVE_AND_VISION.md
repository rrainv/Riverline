# Riverline: an honest look back, and the bigger picture (2026-11-14)

Written by the manager chat. A view to argue with, not a verdict. Where I only know something from ticket reports and not from reading the old repository myself, I say so.

---

## Part 1. The original repo

### What worked

1. **The engine.** Exact equity, pot and price maths, the legal hand state machine, strategy and Personal Strategy data, saved objects, game-night accounting. It was built ticket by ticket with tests and it is the reason a restart is cheap: the hard part survives.
2. **The honesty rules.** Separate tiers for calculated facts, observed actions, the player's own plan, heuristic guidance and reference data. "Unknown is not fold or zero." "A heuristic disagreement is not a mistake." These are rare in poker tools and they are the product.
3. **Versioned contracts and owner isolation.** Hand histories that stay valid, evidence that is never rewritten, one authority per concept. Boring and valuable.
4. **Three languages from early on,** with locale-aware number formatting as real modules rather than an afterthought.
5. **The discipline of small tickets with reports.** Every change left a trail. When something went wrong it could be traced.

### What was lacking

1. **No component layer.** One 13,600-line `logic.js` and one global stylesheet. A screen was a region of a file, not a thing with a boundary. The same control existed in several slightly different copies.
2. **No design tokens.** Colours, sizes and durations were literal values in CSS. A second theme was impossible to make properly; the Daylight work in this round shows the same failure in miniature and its fix.
3. **No way to see a component alone.** Everything could only be judged inside the whole running app, so every visual change needed a full manual check.
4. **Tests that checked the source instead of the behaviour.** By the reports, the suite had grown to roughly three hundred test files, many of them asserting that a CSS rule or a string existed in a file. They passed while the screen was wrong, and they failed when someone made a harmless refactor. They cost effort in both directions.
5. **No visual truth.** There was no screenshot of "correct". Mockups lived in chat canvases; the build lived in the repo; nothing compared them.

### What held us back

1. **The gap between mockup and build.** Your own summary was that the mockups were 90 to 95 percent right and the build lost the feel. The cause was structural: mockups were drawn fresh in a modern, free environment; the build had to be squeezed into old markup and a global stylesheet. Each port lost a little, and the losses added up.
2. **Correction loops.** A change, a report, a rejection, a patch, another rejection. The project rule "after two rejected corrections with the same cause, rethink the concept" exists because this happened repeatedly. Most loops were visual defects that a machine could have caught in seconds (overlap, clipping, contrast), found instead by you, one at a time.
3. **Process weight.** Many worktrees, stabilisation branches, batch summaries, a manager pack, a current-state snapshot. Each was reasonable. Together they meant that a large share of every session went to re-establishing what was true.
4. **Planning ahead of use.** Milestones M0 to M5, long specs, review logs. A lot of design was decided before anyone had used the thing for a real evening of poker. Use would have cut half the questions.
5. **My own part.** As manager I wrote long handoffs and prescribed patches when I should have stopped and asked whether the concept was wrong. I also produced mockups faster than the build could absorb them, which widened the gap I was trying to close.

### What to rethink

| Old habit | New habit |
|---|---|
| Screens as regions of one file | About fifteen shared components, each viewable alone |
| Literal colours and sizes | Tokens only; a script fails the build otherwise |
| Mockup in chat, build in repo | The component sheet in the repo **is** the mockup |
| Source-shape tests | Behaviour tests, golden numbers from the engine, and the two visual audits |
| You find the visual defects | The layout audit and the theme audit find them first; you judge taste |
| Many gates, long reports | Two automatic gates, one bug inbox, a fixed budget per slice |
| Accepted when the checklist passes | Accepted when you use it on a real Friday |
| Design everything, then build | Build the loop only Riverline has (record, review, drill), use it, then widen |

---

## Part 2. The bigger picture

### The one sentence

**Riverline is the honest coach for the hands you actually play.** Everything else in this document is in service of one loop: you play on Friday, you record a few hands, Riverline shows you decisions apart from luck, compares what you did with what you said you would do, and gives you ten minutes of practice aimed at the gap.

No solver trainer does this, because they start from theory. No tracker does it for live home games, because they start from online hand histories. That is the opening.

### High-impact ideas, in the order I would bet on them

**A. Study workflows**

1. **The Friday loop as one flow, not five rooms.** After a game night: "3 hands recorded. Review them (6 min)" leads straight into each hand, each review ends with "drill this spot", the drills end on Home with next Friday's two rules. Rooms stay for free exploration; the loop is a guided path through them.
2. **Plan versus play as the home of Strategy.** The spot map shows where your stated plan and your recorded hands disagree. That is a fact about you, not a judgement. The leak map (plan versus baseline) is the second view, clearly labelled Estimated.
3. **"What were you thinking" before any verdict.** One tap (value, bluff, pot odds, "no idea") before the review shows numbers. It makes the review about your reasoning and it produces the most useful data in the app.
4. **A range for the opponent, never only his revealed hand.** A call is judged against what he could have had. Tight, standard and loose presets, labelled as assumptions.
5. **Ten-minute sessions with an end.** Every drill session says how long, ends on a summary and suggests nothing further. No streaks.

**B. Multi-street exploration**

6. **Equity by rows as the analysis spine** (spec in `EQUITY_BY_ROWS_SPEC.md`): players as rows, streets as a stepper, the runout grid as the "what if" surface, arrow keys to step.
7. **The street ribbon** (*new proposal*): one thin strip under any hand, with preflop, flop, turn and river as four cells, each showing pot, SPR and hero equity. Click a cell and every panel on the screen moves to that street. The same strip in Review, Equity, Replay and the recorder: one way to move through a hand everywhere.
8. **Commitment preview:** on the flop, show what the pot and stacks look like if this bet is called and the same fraction is bet on the turn. For 30 to 60 bb home games this is the decision that matters most, and it is exact arithmetic.

**C. Ergonomics**

9. **Keyboard everywhere, shown on the control.** F, C, R in drills already. Extend: arrows in grids, `[` `]` for streets, Ctrl K to jump anywhere, Escape always goes back one level.
10. **Typed shorthand as a first-class input** in the recorder, Equity and search, sharing one grammar.
11. **Focus mode** hides the dock and rail for drilling. Already in the mockup; keep.
12. **Phone for capture, desktop for study.** The phone app does Game night and quick hand notes only. No attempt to shrink the workstation.

**D. Data clarity**

13. **One tier badge per panel,** in the same place: Exact, Verified, Estimated, Unavailable. Never per number.
14. **Every aggregate shows its sample.** "4 of 5, n = 5", "watching" below the evidence gate.
15. **Bars carry their previous value** as a tick, so change is visible without reading two numbers.
16. **Colour always paired** with a sign, a word or a shape; meaning colours have separate text shades so they hold on white.

**E. Responsiveness**

17. **Engine in a worker, results streamed.** The screen never waits: exact results replace an "estimating" state; a 200 ms budget for any interface response; a visible state for anything slower.
18. **Fixed skeletons.** Panels reserve their height; nothing jumps when a number arrives.
19. **Two clocks** (see the design system): interface feedback is never slowed; only table time follows the pace setting.

### What I would not build yet

- Full hand against five bots (in the mockups; build last).
- The weekly letter as its own room (fold its content into Home first).
- Achievements, levels, XP. The mockup shows a level chip; I would not build the system behind it until the loop is used weekly. Your call.
- Any solver at runtime, any cloud account, any social feature.

### The risks nobody has tested yet

1. **Russian and Hebrew.** Every mockup is English. This is the largest unknown in the design and should be tested on the component sheet before any screen is built.
2. **Whether the loop is used.** Nobody has yet recorded a real hand on a real Friday in any version.
3. **The baseline.** "Verified" needs a measured reference for 30 to 60 bb home games. Until then every baseline comparison is Estimated, and the product has to be good while saying so.
4. **One owner, many models.** The project has changed hands between models and chats many times. The handoff package in Phase 2 exists for this risk.
