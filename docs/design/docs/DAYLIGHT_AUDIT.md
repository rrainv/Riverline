# Daylight overhaul: audit report (2026-11-14)

## Result in one table

Measured by script on the app board in 43 states (every room, every sub-state that has its own layout), at 1440×900.

| Theme | Text below 4.5:1 | Dark leftovers | Invisible control borders | Clipped text |
|---|---|---|---|---|
| **Daylight, before** (41 states) | **240** | **11** | **45** | **10** |
| **Daylight, after** | **0** | 2 (both intended, see below) | **0** | **0** |
| Paper (new light theme) | 0 | 2 (same two) | 0 | 0 |
| Midnight, before | 23 | n/a | 0 | 10 |
| Midnight, after | 0 | n/a | 0 | 0 |
| Felt, Slate, Dusk, Contrast, after | 0 | n/a | 0 | 0 |

3,611 text runs are measured per theme. The two remaining "dark" elements in light themes are deliberate: the green felt table (an object, green in every theme) and the current-step dot in the duel's street tracker (a filled accent dot).

Phone Game night was not part of the 43 states. It now has a Daylight variant, checked by eye in four states (ledger, player sheet, typed hand, settle): `screenshots/phone/`.

## What was wrong (root cause, not the list of symptoms)

Daylight was a dark theme with about sixty `.light` overrides layered on top. Every component was written with dark values (`rgba(255,255,255,.07)` borders, `#0f1d17` popovers, white text on seats), and Daylight worked only where someone had remembered to add an override. New components arrived dark. That is why the Training table's seats were still blackish after the previous round: the seat component had no override, and nothing would ever have told us.

Patching the seats would have fixed one symptom and left the mechanism that produces them.

## What changed

1. **Every colour in the app board is now a role token** (72 tokens). All `.light` overrides are deleted. A theme is a set of token values and nothing else.
2. **Fill and text are separate tokens.** The accent as a fill is `--accent`; the accent as text is `--accent-text`, darkened in light themes. Same for over / under / ok. This one split accounts for most of the 240 contrast failures: brass and jade text on white.
3. **Things that sit on their own background got their own ink.** Text on the felt (`--on-felt`), text in floating bubbles and tags (`--overlay-ink`), text on seats (`--seat-text`). They no longer follow the page text colour, which is what turned labels dark-on-dark-green in Daylight.
4. **Seats are light discs in light themes**, with a ring that separates them from the felt, and dark ink for their marks.
5. **Borders of anything pressable** use `--line2`, tuned to stay visible on white (the 45 invisible borders were 7%-white hairlines on a white panel).
6. **Cards**: ivory faces stay; the card shadow gains a hairline in light themes so an ivory card reads on a white panel. Suit colours on the turn grid have light-theme values.
7. **Data colours** (heat cells in the leak map and turn grid, the mix bar, sparklines) have a light-theme palette: stronger tints, dark text on cells.
8. **Overlays** (search palette, tooltips, action bubbles, typing bubble) are white with a real shadow in light themes instead of near-black.
9. **The share card** keeps its dark look in every theme on purpose (it is an image for a group chat) by re-scoping the dark tokens inside it.
10. **Custom themes** pick the light or dark token set from the background's luminance, so a user-made light theme gets the same treatment.
11. **Paper** is a second light theme (warm cream, brown ink) built to prove the system: it took nine values and passed the audit on the first run.

Fixed along the way because the audit found them, in every theme: ten clipped texts (palette list, ladder steppers, family list), 23 low-contrast texts in Midnight (`--text3` was too dim on raised surfaces), six in Felt, one in Slate.

## What I looked at by eye

All 43 Daylight states on one sheet (`screenshots/contact-sheets/all-states_daylight.jpg`), plus full-size checks of the Training hub, the duel with the ladder open, Equity, the search palette, the spot map, the plan builder and Settings. Paper: the full-hand table. Individual files: `screenshots/daylight/`.

## How the audit works (so it can run in the new repo)

`tools/snap.js` drives the prototype through `tools/states.js` (the 43 states), takes a screenshot of each and records every text run and every control with its box. `tools/analyze.py` then measures, from the pixels:
- **contrast** of each text run against what is really behind it (it samples the screenshot, so gradients and transparency are handled);
- **dark artifacts**: in a light theme, any element whose background is darker than a threshold;
- **control borders**: any button, input or chip whose edge differs from its surroundings by less than a visible step;
- **clipping**: text wider or taller than the box that holds it.

Text covered by an overlay, disabled controls and the felt are excluded by rule, and the rules are in the script.

## Limits (read before trusting the zeros)

1. **It is the mockup, on sample data, in English, at 1440×900.** Russian and Hebrew will change text fit; 1366×768 is not measured.
2. **Hover, focus and pressed states are not in the 43 states.** They use the same tokens (`--hover`, the focus ring), and I checked several by hand, but they are not counted.
3. **Fonts:** the screenshots were taken without Rubik and Inter (the sandbox has no network), so glyph shapes differ slightly from what you will see. Colours and contrast are unaffected.
4. **The Lamp and the two motion boards are still Midnight-only.** They are demonstrations rather than app screens, but the Lamp appears on Home and in the scan, where it is already token-driven and looks right; the standalone mood boards are not converted.
5. **Disabled primary buttons** in Daylight are pale (white on light green at 45% opacity). They are exempt from contrast rules, but they look washed out. The design system page shows the replacement (grey track with grey text); the app board still uses the old style.
6. **A script cannot say a theme is beautiful.** It says nothing is unreadable or invisible. Whether Daylight feels like Riverline is your call; my own view is that it now reads as a designed light theme, and that the leak map is the weakest screen in it (pale tints on white carry less than the same map on dark).
7. Browser automation is not your Firefox at 100% zoom. Please look at the canvas in Settings › Appearance › Daylight before treating this as accepted.
