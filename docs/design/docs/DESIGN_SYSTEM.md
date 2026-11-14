# Riverline design system: look, feel and motion (2026-11-14)

This is the working spec for the new repo. It replaces the colour, type and motion sections of `DESIGN_LANGUAGE_V2.md` and `MOTION_SPEC.md` where they differ; the older files stay as history. The owner decides; anything marked *proposal* is not yet approved.

Live reference: `prototypes/design-system.html` (built only from `tokens/tokens.css`; switch themes, pace and reduced motion on the page).

## 1. What it should feel like

A calm, premium study desk at night: a lamp, felt, brass, paper cards. Dense with useful facts and never cramped. It moves like physical things move (cards have weight, chips land, a ring travels), and it never performs (no confetti, no jackpots, no praise for nothing).

Three tests for any screen, unchanged from the earlier language:
1. Does it help the next decision?
2. Is it honest? Numbers say where they come from; unknown looks unknown.
3. Would a serious design do the job better?

Owner rules that outrank everything below: almost no dead space; one primary action per view; never signal one state twice; show states visually; the same feature looks and behaves the same everywhere; no placeholder controls for features that do not exist (rail placeholders in the mockup are marked as such).

## 2. Tokens: the one rule

**Components read tokens. Components never hold a raw colour, a raw duration or a raw curve.** A theme is only a set of token values. This single rule is what fixed Daylight: before it, Daylight was a dark theme with about sixty light overrides, and every new component arrived dark. After it, a new component is correct in all seven themes on the day it is written.

Enforced by a script, not by review (see `tools/README.md`): a grep-level check fails the build if a component stylesheet contains a hex colour, `rgb(`, a millisecond literal or `cubic-bezier(`.

Files:
- `tokens/tokens.css`: the source. Midnight on `:root`; each other theme is a `[data-theme]` block holding only what differs.
- `tokens/tokens.json`: the same values for scripts and tests.
- `tokens/TOKENS_README.md`: naming, how to add a token, how to add a theme.

### 2.1 Colour roles

| Group | Tokens | Rule |
|---|---|---|
| Surfaces | `bg`, `root-bg`, `root-glow`, `panel-bg`, `panel-border`, `shadow`, `well`, `tint`, `hover`, `track`, `sel-bg`, `scrim`, `dock-bg`, `pill-bg` | Three levels only: page, panel, recessed well. No panel inside a panel. |
| Text | `text`, `text2`, `text3` | All three reach 4.5:1 on every surface in every theme. There is no fourth, lighter grey. |
| Lines | `line`, `line2`, `line3` | `line` divides; `line2` is the border of anything you can press (3:1 in light themes); `line3` is dashed or emphasised. |
| Accent | `accent`, `accent-ink`, `accent-text` | `accent` is for fills and rings. **Accent used as text or as an icon must be `accent-text`,** which is darkened automatically in light themes. This one split removed most Daylight failures. |
| Meaning | `over` / `over-text`, `under` / `under-text`, `ok` / `ok-text`, `danger` / `danger-bg` | Fill and text variants are separate tokens for the same reason. Colour never carries meaning alone: every use also has a word, a sign or a shape. |
| Overlays | `overlay-bg`, `overlay-line`, `overlay-ink`, `overlay-ink2`, `overlay-shadow` | Tooltips, action bubbles, seat tags, the palette. One look for everything that floats. |
| Table | `felt`, `felt-rim`, `on-felt`, `on-felt2`, `seat-bg`, `seat-line`, `seat-ink`, `seat-text`, `seat-ring` | The felt is green in every theme (it is an object, not a surface). Text on it uses `on-felt`, never `text`. Seats are light discs in light themes: this was the "blackish seats" defect. |
| Cards | `cardface`, `card-ink`, `card-red`, `cardback`, `cardback-edge`, `pcshadow` | Card faces are the same in every theme. In light themes the card shadow adds a hairline so an ivory card reads on a white panel. |
| Depth | `elev-1` to `elev-4` | Four steps, named by use: cards, bubbles, dock, dialogs. |

### 2.2 Themes

| Theme | Kind | Character | Audit result (43 states) |
|---|---|---|---|
| Midnight | dark, default | forest green, brass accent, lamp glow | see `DAYLIGHT_AUDIT.md` |
| Felt | dark | brighter green, the table colour as the room | |
| Slate | dark | cool blue-grey, blue accent | |
| Dusk | dark | violet | |
| Contrast | dark | pure black and white, no shadows, heavy borders | |
| Daylight | light | cool white with green ink, deep green accent | |
| Paper | light, new | warm cream with brown ink, brass-brown accent | |
| Custom | either | four colours from the user; light or dark chosen from background luminance; contrast calculated live | not auditable in advance |

Theme refinements I propose (not built):
1. **Follow the system** as a setting: Midnight after dark, Daylight by day.
2. **Table theme separate from app theme** (kept from the earlier language): a calm Daylight app around a rich green or blue felt. The tokens already separate the two.
3. **Sepia night** (*proposal*): Paper's ink on a dark warm brown, for people who find green-black cold.
4. **Print**: a print stylesheet for Review and the session report that uses Paper tokens and drops shadows. Cheap once tokens exist.

### 2.3 Type

Two families: Inter for text, Rubik for headings and numbers (Rubik covers Latin, Cyrillic and Hebrew in one family; Georgia remains a user option for headings). **Fonts are bundled in the app, not loaded from Google** (local-first, offline); the prototypes load them from Google only because they are single files.

| Token | px | Use |
|---|---|---|
| `fs-micro` | 11 | uppercase labels only |
| `fs-caption` | 12 | hints, footnotes, sub-lines |
| `fs-small` | 13 | secondary rows, chips |
| `fs-body` | 14 | default |
| `fs-lead` | 16 | teacher text, questions |
| `fs-title` | 20 | panel titles |
| `fs-display` | 26 | screen headline, big numbers |
| `fs-hero` | 38 | at most one per screen: a result total |

All numbers use tabular figures. Text blocks stop at about 70 characters. Weights: 400 body, 500 names, 600 labels and controls, 700 card ranks and the hero number.

**Honest note:** the mockup uses sixteen font sizes, including in-between ones (12.5, 13.5, 14.5). They crept in while fitting text into tight panels. The scale above is the target; the mapping is 11.5→12, 12.5→12 or 13, 13.5→13 or 14, 14.5→14, 15→14 or 16, 17/18/19→20 or 16, 22→20 or 26. Russian and Hebrew will change the fit anyway, so settle sizes per component during the localisation pass, not by copying the mockup.

### 2.4 Space, radius, size

Space scale: 2, 4, 6, 8, 12, 16, 18, 24, 32. Gutter between panels and padding inside panels are both 18. (The mockup also uses 10 and 14 often; map 10→8 or 12 and 14→12 or 16 per component.)
Radius: panels 18 (user setting 8 / 18 / 26), controls 12 (6 / 12 / 18), cards 6, pills full.
Control heights: chip 28, control 34, input 38, primary 44. Phone tap targets are at least 40.
Focus: a 2 px accent ring with a 2 px offset on everything focusable, in every theme.

## 3. Layout and hierarchy

- **Shell:** floating dock (eight rooms), a collapsible rail for the room's sections, a top bar with search (Ctrl K), Settings and Focus mode. Owner-approved.
- **One primary action per view,** filled with the accent. Everything else is outline or text.
- **Three levels of emphasis** inside a panel: label (micro, uppercase), value (body or larger), explanation (small, `text2`). If a panel needs a fourth, it is two panels.
- **Fixed skeleton:** regions that change reserve their height; feedback replaces the answer area in place; hover never moves layout.
- **Progressive detail:** the two to four numbers that matter are tiles; the rest is one click away, never on a separate page.
- **Tested at 1920×1080 and 1366×768**, 100% zoom, with the dock visible.

## 4. Motion system

### 4.1 Tokens

| Token | Value | For |
|---|---|---|
| `dur-1` | 120 ms | press, hover, tick |
| `dur-2` | 200 ms | chip, tab, tooltip, anything leaving |
| `dur-3` | 320 ms | panel and view change, rows |
| `dur-4` | 520 ms | card flight, bar growth, border draw |
| `ease-out` | (.23, 1, .32, 1) | default: things arriving and responding |
| `ease-inout` | (.65, 0, .35, 1) | things travelling from A to B: the action ring, the mix pointer |
| `ease-spring` | (.34, 1.36, .64, 1) | one small overshoot on objects: a chip landing, a seat that wins |
| `ease-exit` | (.55, 0, .8, .4) | things leaving: folds, dismissals |
| `stagger-s` | 12 ms | grids (turn cards, matrix cells) |
| `stagger-m` | 70 ms | lists, option tickets, dealt cards |
| `pace` | 1 (calm 1.35, fast 0.6) | multiplies bot thinking time and the beats between table actions only |

The mockup today uses about a dozen ad-hoc durations (140, 160, 180, 220, 240, 340 ms and so on). They map onto the four tokens; nothing needs a fifth.

### 4.2 Rules

1. **Two clocks.** Interface feedback (press, hover, tab, panel) always runs at token speed and is never slowed by a setting. Table time (a bot thinking, the gap between two actions, a card flight) is multiplied by `pace`. The owner asked for slower table actions; slowing the whole interface would make it feel broken.
2. **Keyboard is instant.** An action triggered from the keyboard shows its result at once; decoration may follow, the result may not wait.
3. **Leaving is faster than arriving** (`dur-2` out, `dur-3` in), and the two never overlap at full opacity.
4. **Transform and opacity only.** No animated width, height, top, left or box-shadow. Bars grow with `scaleX`. Rows that make room move by transform (FLIP). This is also the performance rule for weak laptops.
5. **Springs are for objects, not for facts.** A chip may overshoot. A percentage may not: numbers count straight to the engine value and stop exactly on it.
6. **One thing moves at a time per region.** If the board deals, the equity bars wait for the last card.
7. **Motion carries meaning or it goes.** The border draws around the option you chose; the ring shows whose turn it is; the tick on a bar shows where the number was. No idle decoration except the Lamp's breathing.
8. **Reduced motion** (system setting, or our own): travel, flips, rolls and staggers are removed; opacity changes of 1 ms remain; **the pauses between table actions stay**, because they are information, not decoration. A separate "Minimal card animation" setting keeps the interface motion but shows cards without flight.

### 4.3 One rule per kind of thing

| Thing | Enter | Change | Leave |
|---|---|---|---|
| View (room change) | rise 10 px, fade, `dur-3` `ease-out`, after the old view left | n/a | fade, lift 8 px, `dur-2` `ease-exit` |
| Panel content swap | grid-stacked; new content fades in `dur-2` after 110 ms | n/a | fades in 110 ms |
| Row (equity, history, list) | drop 10 px and fade, `dur-3` | siblings move by FLIP, `dur-3` `ease-out`; **no automatic re-sort** | `dur-2` `ease-exit`, then siblings close the gap |
| Card | fly from the deck `dur-4` `ease-out`, then flip (face swaps at the edge-on midpoint); `stagger-m` between cards | lift 4 px on hover in grids | fold: lift, turn face down, toss to the muck on an uneven arc, `dur-4` `ease-exit`; never overlapping, never face up in flight |
| Seat | pop `dur-3` `ease-spring` on deal-in | action ring travels `dur-3 × pace` `ease-inout`; thinking dots loop; action bubble appears above the seat `dur-2` | folded seat dims to 40% in `dur-2` |
| Option ticket | rise with `stagger-m` | chosen: border draws around it `dur-4`; others step back to 50% | n/a |
| Mix bar | uniform wipe left to right `dur-4` `ease-inout` | pointer slides to the chosen size `dur-3` `ease-spring` (the pointer is an object) | n/a |
| Number | n/a | counts for `dur-4`, lands exactly | n/a |
| Menu, palette, dialog | scrim `dur-2`; surface from 96% and 10 px, `dur-3` `ease-out`; focus moves in immediately | n/a | `dur-2` |
| Toast | from the dock edge `dur-3` | n/a | `dur-2` |
| Theme change | colours cross-fade `dur-3` (*proposal*: circular reveal from the chosen swatch, kept from the old spec) | n/a | n/a |
| The Lamp | fade | eight moods; breathing loop 3.4 s; speaking rings while text types; **stern stays** (owner decision) | fade |

### 4.4 Fresh ideas (proposals, none built)

1. **Shared-element card travel:** a hand's two cards fly from the Saved list into the Review header when you open it. One motion that says "this is the same hand".
2. **Equity tick trail:** when you step turn cards with the arrow keys, the previous tick fades over 600 ms, so quick stepping leaves a short trail showing the spread of outcomes.
3. **Scrub the hand:** drag along the history rail to scrub the table state forward and back (Replay as a timeline, no play button).
4. **Sound, later:** three quiet sounds only (card, chip, confirm), off by default, tied to the same pace setting.
5. **Haptics on phone** for rebuy and cash-out commits in Game night.

## 5. Feedback and states

Every interactive element has five visible states: rest, hover, pressed (scale 0.97), focus, disabled. Disabled never carries an instruction and uses `track` + `text3`, not opacity on the accent (opacity made white-on-pale-green in Daylight).
Selected = accent border + `sel-bg` + nothing else (no "Selected" word).
Unknown = dashed border and face-down cards; never empty, never zero.
Loading = the shape of the content shimmering, then the content line by line.
Errors name the thing that failed ("Q♥ is already in play"), sit next to the field, and use `over-text`, not red panels.

## 6. Accessibility baseline

4.5:1 for all text; 3:1 for control borders and for graphics that carry meaning; focus always visible; every control reachable and operable by keyboard; no interactive element inside another; live regions for results that appear without focus moving (equity after a card is picked, a bot's action); logical CSS properties so Hebrew mirrors without a second stylesheet; poker notation isolated left to right.

## 7. What is still not designed (do not assume)

- Russian and Hebrew on any screen. Every mockup is English. This is the largest untested risk.
- 1366×768: the mockup is drawn at 1440×900 only.
- Onboarding end to end, table rules ("My poker"), hand-history import.
- Phone layouts other than Game night.
- The motion and Lamp boards exist only in Midnight.
