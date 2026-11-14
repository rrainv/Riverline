# Gemini second opinion: triage (2026-11-13)

Source: `Riverline_Second_Opinion.md` (6,470 words, 22 screenshots, 8 sections) and a Tailwind prototype of five redesigned screens (not rendered: it loads Tailwind from a CDN; reviewed from its code).

## Verdict in one line
A thorough, mostly sharp review with **real catches and some confident errors**. Its best work is the maths and consistency audit of the screenshots. Its weakest work is where it labels things [Verified] without showing the method, and where it recommends cutting the owner's explicit design choices.

## What I checked myself

| Gemini claim | My check | Verdict |
|---|---|---|
| Equity screen: J♠ turn called "a blank"; true equity 22.7% (10 of 44 rivers); blanks are 15.9%; group "Blanks 3 to J: 17.6%" mixes two values | Recomputed all 45 turn cards exactly. J and T non-hearts = 10/44 = 22.7% (6 cards); true blanks = 7/44 = 15.9% (18 cards); the old group averaged both. By-river categories also showed flop numbers under a turn heading. | **Correct. Fixed.** |
| Duel tooltip says 30% and SPR 7.5, "should be 25.0% and 9.5" | The tooltip was on the hovered 75% option (3.75 bb): 3.75/12.5 = 30.0%, SPR 93.75/12.5 = 7.5. Those are right for 75%. 25.0% and 9.5 are right for the selected 50%. | **Wrong (misread which size was hovered).** Real issue underneath: hover and selection disagree on screen. Fixed with a persistent price line for the selected size and a labelled tooltip. |
| Review grades the call using the villain's revealed hand ("Minus EV. A mistake.") | True. Known-card equity is hindsight; the call's quality depends on his possible range. | **Correct, important. Fixed wording** ("lost to the hand he showed", range reading marked Estimated). Engine fix (range selector) is idea 45. |
| AKs shows 10% fold in the drill | True, implausible sample mix. | **Correct. Fixed** (no fold segment). |
| Scan result says "5 of 6 differ" but shows 3 | True. | **Correct. Fixed** (says the other gaps are in the map). |
| Scan map puts BB under first-in columns | True, mixed meanings. | **Correct. Fixed** (column "BB defend"). |
| Report: "raised 5 of 10 button hands" | True: heads-up, she has the button 5 times. | **Correct. Fixed** (4 of 5, n = 5). |
| Letter cites 14 drill answers, below our own n = 15 gate | True. | **Correct. Fixed** (sample 18), and the gate itself is now an open decision. |
| Typed shorthand flags a valid hand | The tokens were appended to a hand already in progress, so "c" was genuinely invalid. The semantics were unclear, not the parser. | **Partly right.** Example now starts a clean hand; note says "continues after the actions above". |
| Hero prints "You" twice; "raises to 3" bubble collides | True. | **Correct. Fixed** (icon in the disc; bubbles moved off neighbours). |
| Multiple gold accents (Level chip, hint chip) | True for the mockup chrome. | **Fixed** (neutral chips). |
| Phone: no visible Rebuy / Cash out; small tap targets | True. | **Correct. Fixed** (row buttons, 40 px targets). |
| All five exact numbers I listed | 91.2%, 83.1%, 25.6%, pot odds, luck +7.0: all match my own computation. | **Correct.** |
| Its idea 3 numbers ("sets only 25.2%") | Sets-only range vs AhKh on Qh7c2h is 25.6% by my count. | **Slightly off.** Use the engine, not the report. |
| GTO Wizard price range "$35.10 to $206.10" | Those are PokerNews 10% first-purchase figures; list prices are $39/$49 Starter and Ultra $229/$279 early-bird, rising to $289/$359. GTO Gecko $24.99 to $39.99 confirmed. | **Mostly right, sloppy.** Market table is directionally fine, not citable as is. |
| Israeli law, RTA bans, partnerships | Not independently verified. | **Unverified.** Treat as leads for a proper legal read. |

## Where I disagree
- **"Reject the dock plus rail" and "reject the table as a menu":** these are explicit owner choices, and the owner liked the result. The dead-space measurement for the hub was a fair point; the hub table was enlarged and now fills its panel. Keep, revisit after real use.
- **"Cut XP, achievements, the Lamp's moods":** direct conflicts with decided direction. The Lamp's "stern" mood is the one item worth an owner decision.
- **"Postpone Full hand vs five bots":** reasonable on scope. Keep it in the mockups, build it last.

## Where it changed my mind
1. **Port-the-mockup is risky** if it means copying markup. Gemini's alternative (extract tokens plus about a dozen shared components, test them in isolation) is what I would do anyway: port the *visuals and behaviour*, not the HTML.
2. **Cheap automated gates beat big plans.** Its Playwright geometry-check idea is now built and proven on the mockups (`riverline_tools/audit.js`): it found the tab misalignment, covered text and rim collisions within minutes.
3. **The n = 15 evidence gate is arbitrary.** A credible-interval rule with a small minimum is better. Owner decision.
4. **Ask "what were you thinking" before showing a verdict.** Adopt in Review.
5. **Game night default to chips or points**, with a proper legal read for RU/HE. Adopt.

## Not adopted for now (owner decision needed)
- Replace the 6-question scan with spot-based calibration (good idea; mockup first).
- FSRS in place of fixed revisits.
- Stack choice. Gemini ranks Preact + signals first, which matches the proposal; its Svelte and Solid concerns (agent friendliness) are plausible but unmeasured.
- Motion changes: it cited a spec line ("base divided by tempo") and asked to cap durations and avoid blur filters. Plausible; worth a short test on a weak laptop rather than a rule change now.

## Process note
Gemini labelled everything [Verified], including things it had not computed (duel tooltip) and things that need a source (law, prices). Use its [Observed] findings freely, its [Verified] maths after a recompute, and its [Opinion]s as input.
