# Complete design, token and motion specification

Status on 2026-11-14. This is the specification the new repository builds against. It is self-contained; the files in `design/` are its working artifacts. The owner decides; items marked *proposal* are not yet approved.

**Artifacts** (all under `design/`):

| Artifact | Path | Use |
|---|---|---|
| Tokens | `tokens/tokens.css`, `tokens/tokens.json`, `tokens/TOKENS_README.md` | The single source of visual values. Copy into the repo unchanged. |
| The app prototype | `prototypes/riverline-app.html` | Every room, interactive, seven themes in Settings. The visual and behavioural reference. |
| Equity prototype | `prototypes/equity-by-rows.html` | Working equity table with typed players. |
| Design-system page | `prototypes/design-system.html` | Built only from `tokens.css`: swatches with measured contrast, type, space, components, motion tokens and motion demos; theme, pace and reduced-motion switches. The model for the repo's component sheet. |
| Motion boards | `prototypes/motion-cards-and-table.html`, `prototypes/motion-interface.html` | The crafted moments (deal, flip, fold, showdown, chips, border draw, mix bar, numbers, tabs). Press Replay. |
| The Lamp | `prototypes/lamp-moods.html`, `prototypes/lamp-themes.html` | Eight moods; the Lamp in six themes and in use. |
| Phone | `prototypes/phone-game-night.html` | Game night at 390×844. |
| Screenshots | `screenshots/midnight`, `daylight`, `paper` (43 states each), `phone/`, `design-system/`, `contact-sheets/` (all seven themes) | Stills of every state. |
| Reports | `docs/DAYLIGHT_AUDIT.md`, `docs/DESIGN_SYSTEM.md`, `docs/EQUITY_BY_ROWS_SPEC.md` | Audit numbers and method; a shorter design-system narrative; the Equity spec. |
| Tools | `tools/` | Prototype builder, the two audits, the exact-equity evaluator, the token extractor. |
| Source | `canvas-source/*.dc.html` | The design-canvas boards. A proprietary canvas format: read them for markup and CSS, do not try to run them. |

How to read the prototype's source: each standalone HTML file contains the board's CSS in a `<style>` block, its markup in a `<template>`, and a `Component` class whose `renderVals()` builds the view model. It is a mockup: copy **measurements, structure, states and behaviour**, not the code.

---

## 1. Identity and the rules that outrank the rest

**Feel.** A calm, premium study desk at night: a lamp, felt, brass, paper cards. Dense with useful facts, never cramped. Things move as physical things move. It never performs.

**Never.** Casino (neon, jackpots, confetti, fake 3D). Generic admin dashboard. A phone app stretched onto a desktop. An "AI demo" that explains itself in every line.

**Owner rules, in priority order:**
1. **Almost no dead space.** Every region answers a question. No empty area larger than about 160×160 px while useful information exists elsewhere. No long strips whose content would fit in a fraction of the space; no label far left with its value far right; no full-width button for a short label. If there is nothing useful to show, the region shrinks.
2. **One primary action per view,** filled with the accent. Everything else is outline or text. Selected tabs are not filled.
3. **No duplicated information.** A value appears once. A state is signalled once (no "Selected" word on a highlighted thing).
4. **Show states visually.** Unknown cards are face-down cards; an unanswered cell is dashed; a folded seat is dimmed.
5. **The same feature is the same component with the same behaviour everywhere.**
6. **Calm surface, deep data.** The two to four numbers that matter are visible; nearly everything else is one hover, click or expand away, never on another page.
7. **Quiet copy.** Do not state what people already know. No filler, no hype.
8. **No control for a feature that does not exist.**

**Three tests for any screen.** Does it help the next decision? Is it honest (numbers say where they come from; unknown looks unknown)? Would a serious design do the job better?

---

## 2. Colour: tokens and themes

### 2.1 The rule

Components read tokens. A component never contains a hex colour, `rgb()`, a millisecond value or a `cubic-bezier()`. A theme is only a set of token values. The check `repo-seed/tools/check-no-raw-values.mjs` enforces it.

### 2.2 Roles

| Group | Tokens | Rule |
|---|---|---|
| Surfaces | `--bg`, `--root-bg`, `--root-glow`, `--panel-bg`, `--panel-border`, `--shadow`, `--well`, `--tint`, `--hover`, `--track`, `--sel-bg`, `--scrim`, `--dock-bg`, `--pill-bg`, `--seg-gap` | Three levels only: page, panel, recessed well. No panel inside a panel; group with space and hairlines. |
| Text | `--text`, `--text2`, `--text3` | All three reach 4.5:1 on every surface in every theme. There is no lighter grey. Never lower their opacity. |
| Lines | `--line`, `--line2`, `--line3` | Divider; border of anything pressable (visible on white); dashed or emphasised. |
| Accent | `--accent`, `--accent-ink`, `--accent-text`, `--brass`, `--brass-text` | `--accent` for fills and rings. **Accent used as text or icon is `--accent-text`.** `--accent-ink` is text on an accent fill. |
| Meaning | `--over` / `--over-text`, `--under` / `--under-text`, `--ok` / `--ok-text`, `--danger` / `--danger-bg` | "Wider or hurts you", "tighter", "matches", destructive. Fill and text are separate tokens. Colour never carries meaning alone: add a sign, a word or a shape. |
| Overlays | `--overlay-bg`, `--overlay-line`, `--overlay-ink`, `--overlay-ink2`, `--overlay-shadow` | Tooltips, action bubbles, seat tags, palette, dialogs: one look for everything that floats. |
| Table | `--felt`, `--felt-rim`, `--felt-rim2`, `--on-felt`, `--on-felt2`, `--seat-bg`, `--seat-line`, `--seat-ink`, `--seat-text`, `--seat-ring` | The felt is green in every theme: it is an object, not a surface. Text on it uses `--on-felt`. Seats are light discs in light themes. |
| Cards | `--cardface`, `--card-ink`, `--card-red`, `--cardback`, `--cardback-edge`, `--pcshadow` | Faces are the same in every theme. In light themes the shadow adds a hairline. |
| Depth | `--elev-1` cards and chips, `--elev-2` bubbles and tooltips, `--elev-3` dock, `--elev-4` dialogs | Four steps. |

**Accent means action,** never approval. Tiers and "inside or outside the baseline" use neutral colours so that the accent never reads as "correct". The default accent in Midnight is brass (`#e0bf6a`); jade and others are user options.

### 2.3 Every colour token: Midnight and the two light themes

Resolved values read from the running prototype.

| Token | Midnight | Daylight | Paper |
|---|---|---|---|
| `--bg` | `#07150f` | `#f4f7f4` | `#f6f1e7` |
| `--root-bg` | `radial-gradient(ellipse 85% 75% at 50% 36%,#1f5a43 0%,#123a2b 46%,#07150f 100%)` | `linear-gradient(180deg,#f4f7f4,#e6ede8)` | `linear-gradient(180deg,#f6f1e7,#ece4d3)` |
| `--root-glow` | `rgba(255,226,160,.15)` | `transparent` | `transparent` |
| `--panel-bg` | `linear-gradient(180deg,rgba(38,54,46,.80),rgba(21,33,27,.78))` | `#ffffff` | `#fdfaf3` |
| `--panel-border` | `1px solid rgba(255,255,255,.09)` | `1px solid rgba(16,40,28,.18)` | `1px solid rgba(48,36,12,.18)` |
| `--shadow` | `inset 0 1px 0 rgba(255,255,255,.07),0 14px 34px rgba(0,0,0,.34)` | `0 1px 2px rgba(16,40,28,.05),0 10px 28px rgba(16,40,28,.08)` | `0 1px 2px rgba(48,36,12,.05),0 10px 28px rgba(48,36,12,.08)` |
| `--well` | `rgba(0,0,0,.22)` | `rgba(16,40,28,.045)` | `rgba(48,36,12,.045)` |
| `--tint` | `rgba(255,255,255,.03)` | `rgba(16,40,28,.02)` | `rgba(48,36,12,.02)` |
| `--hover` | `rgba(255,255,255,.07)` | `rgba(16,40,28,.055)` | `rgba(48,36,12,.055)` |
| `--track` | `rgba(0,0,0,.38)` | `rgba(16,40,28,.10)` | `rgba(48,36,12,.10)` |
| `--sel-bg` | `color-mix(in srgb,#e0bf6a 10%,transparent)` | `color-mix(in srgb,#1f7350 12%,transparent)` | `color-mix(in srgb,#7a5a12 12%,transparent)` |
| `--scrim` | `rgba(3,10,7,.62)` | `rgba(16,40,28,.38)` | `rgba(48,36,12,.38)` |
| `--dock-bg` | `rgba(10,24,18,.72)` | `rgba(255,255,255,.93)` | `rgba(255,255,255,.93)` |
| `--pill-bg` | `rgba(10,24,18,.6)` | `#ffffff` | `#ffffff` |
| `--seg-gap` | `rgba(8,16,12,.55)` | `rgba(255,255,255,.92)` | `rgba(255,255,255,.92)` |
| `--text` | `#f2f5f1` | `#0f1713` | `#231d12` |
| `--text2` | `#c6cec8` | `#3a4740` | `#4d4433` |
| `--text3` | `#adbab2` | `#5a685f` | `#6b604a` |
| `--line` | `rgba(255,255,255,.10)` | `rgba(16,40,28,.10)` | `rgba(48,36,12,.10)` |
| `--line2` | `rgba(255,255,255,.22)` | `rgba(16,40,28,.24)` | `rgba(48,36,12,.24)` |
| `--line3` | `rgba(255,255,255,.3)` | `rgba(16,40,28,.42)` | `rgba(48,36,12,.42)` |
| `--accent` | `#e0bf6a` | `#1f7350` | `#7a5a12` |
| `--accent-ink` | `#07120d` | `#ffffff` | `#ffffff` |
| `--accent-text` | `#e0bf6a` | `#195e42` | `#644a0f` |
| `--brass` | `#e0bf6a` | `#c59b36` | `#c59b36` |
| `--brass-text` | `#e0bf6a` | `#7a5a12` | `#7a5a12` |
| `--over` | `#e0925a` | same | same |
| `--over-text` | `#eeaa78` | `#9a4a12` | `#9a4a12` |
| `--under` | `#68b4c2` | same | same |
| `--under-text` | `#8ed0db` | `#17697a` | `#17697a` |
| `--ok` | `#42ad7b` | `#2f9a68` | `#2f9a68` |
| `--ok-text` | `#6fd1a2` | `#1b7347` | `#1b7347` |
| `--danger` | `#e08a7a` | `#b42318` | `#b42318` |
| `--danger-bg` | `rgba(224,138,122,.1)` | `rgba(180,35,24,.07)` | `rgba(180,35,24,.07)` |
| `--overlay-bg` | `rgba(8,20,15,.94)` | `#ffffff` | `#ffffff` |
| `--overlay-line` | `rgba(255,255,255,.16)` | `rgba(16,40,28,.2)` | `rgba(48,36,12,.2)` |
| `--overlay-ink` | `#f2f5f1` | `#0f1713` | `#231d12` |
| `--overlay-ink2` | `#cfe0d4` | `#3a4740` | `#4d4433` |
| `--overlay-shadow` | `0 6px 16px rgba(0,0,0,.45)` | `0 6px 18px rgba(16,40,28,.2)` | `0 6px 18px rgba(48,36,12,.2)` |
| `--felt` | `radial-gradient(ellipse at 50% 30%,#2f7657 0%,#215641 55%,#17382a 100%)` | same | same |
| `--felt-rim` | `#bfa965` | same | same |
| `--felt-rim2` | `#6a5a2c` | same | same |
| `--on-felt` | `#ffffff` | same | same |
| `--on-felt2` | `#e9f3ec` | same | same |
| `--seat-bg` | `radial-gradient(circle at 34% 28%,#34453c,#121b17 72%)` | `radial-gradient(circle at 34% 28%,#ffffff,#e3eae5 72%)` | `radial-gradient(circle at 34% 28%,#ffffff,#e3eae5 72%)` |
| `--seat-line` | `rgba(255,255,255,.18)` | `rgba(16,40,28,.26)` | `rgba(48,36,12,.26)` |
| `--seat-ink` | `#e0bf6a` | `#1f6a46` | `#6b4e0f` |
| `--seat-text` | `#f2f5f1` | `#0f1713` | `#231d12` |
| `--seat-ring` | `rgba(0,0,0,.18)` | `rgba(255,255,255,.32)` | `rgba(255,255,255,.32)` |
| `--card-ink` | `#1a1f1c` | same | same |
| `--card-red` | `#c2412f` | same | same |
| `--pcshadow` | `0 2px 6px rgba(0,0,0,.28)` | `0 0 0 1px rgba(16,40,28,.18),0 2px 5px rgba(16,40,28,.16)` | `0 0 0 1px rgba(48,36,12,.18),0 2px 5px rgba(48,36,12,.16)` |
| `--elev-1` | `0 2px 6px rgba(0,0,0,.28)` | `0 1px 3px rgba(16,40,28,.16)` | `0 1px 3px rgba(48,36,12,.16)` |
| `--elev-2` | `0 8px 16px rgba(0,0,0,.45)` | `0 4px 12px rgba(16,40,28,.18)` | `0 4px 12px rgba(48,36,12,.18)` |
| `--elev-3` | `0 14px 34px rgba(0,0,0,.45)` | `0 10px 28px rgba(16,40,28,.16)` | `0 10px 28px rgba(48,36,12,.16)` |
| `--elev-4` | `0 24px 50px rgba(0,0,0,.5)` | `0 18px 40px rgba(16,40,28,.22)` | `0 18px 40px rgba(48,36,12,.22)` |

Card and preference tokens (same in every theme unless the user changes them): `--cardface` `#f6f2e8`, `--cardback` `#1a3a2c`, `--cardback-edge` `#bfa965`, `--radius` 18px, `--radius-s` 12px, `--font` Inter, `--font-head` and `--font-num` Rubik, `--head-w` 600.


### 2.4 The other dark themes (only what differs from Midnight)

**Felt** (9 tokens differ)

| Token | Value |
|---|---|
| `--bg` | `#0a1f16` |
| `--root-bg` | `radial-gradient(ellipse 85% 75% at 50% 36%,#2f7a5c 0%,#164532 46%,#0a1f16 100%)` |
| `--panel-bg` | `linear-gradient(180deg,rgba(30,60,47,.88),rgba(18,40,31,.86))` |
| `--sel-bg` | `color-mix(in srgb,#e8cf84 10%,transparent)` |
| `--text3` | `#c4d5c9` |
| `--accent` | `#e8cf84` |
| `--accent-text` | `#e8cf84` |
| `--danger` | `#f0a596` |
| `--seat-ink` | `#e8cf84` |

**Slate** (11 tokens differ)

| Token | Value |
|---|---|
| `--bg` | `#0d1219` |
| `--root-bg` | `radial-gradient(ellipse 85% 75% at 50% 36%,#2b3646 0%,#1b2330 46%,#0d1219 100%)` |
| `--panel-bg` | `linear-gradient(180deg,rgba(46,58,74,.84),rgba(28,36,48,.82))` |
| `--sel-bg` | `color-mix(in srgb,#7fb2e5 10%,transparent)` |
| `--text` | `#e9edf2` |
| `--text2` | `#b7c1cc` |
| `--text3` | `#a7b1bd` |
| `--accent` | `#7fb2e5` |
| `--accent-text` | `#7fb2e5` |
| `--danger` | `#eb9c8e` |
| `--seat-ink` | `#7fb2e5` |

**Dusk** (10 tokens differ)

| Token | Value |
|---|---|
| `--bg` | `#120d26` |
| `--root-bg` | `radial-gradient(ellipse 85% 75% at 50% 36%,#3d3068 0%,#241b47 46%,#120d26 100%)` |
| `--panel-bg` | `linear-gradient(180deg,rgba(56,45,98,.84),rgba(34,26,64,.82))` |
| `--sel-bg` | `color-mix(in srgb,#b9a2ff 10%,transparent)` |
| `--text` | `#f1ecff` |
| `--text2` | `#c9c0e6` |
| `--text3` | `#b6acd9` |
| `--accent` | `#b9a2ff` |
| `--accent-text` | `#b9a2ff` |
| `--seat-ink` | `#b9a2ff` |

**Contrast** (14 tokens differ)

| Token | Value |
|---|---|
| `--bg` | `#000` |
| `--root-bg` | `#000` |
| `--panel-bg` | `#0d0d0d` |
| `--panel-border` | `1px solid rgba(255,255,255,.6)` |
| `--shadow` | `none` |
| `--sel-bg` | `color-mix(in srgb,#ffffff 10%,transparent)` |
| `--text` | `#fff` |
| `--text2` | `#f0f0f0` |
| `--text3` | `#d4d4d4` |
| `--line` | `rgba(255,255,255,.32)` |
| `--line2` | `rgba(255,255,255,.62)` |
| `--accent` | `#ffffff` |
| `--accent-text` | `#ffffff` |
| `--seat-ink` | `#ffffff` |



### 2.5 Theme notes

- **Midnight** (default): forest green page with a warm lamp glow at the top, near-black green panels, brass accent.
- **Daylight:** cool white with green ink and a deep green accent. Built as a full token set, not as overrides. Seats are white discs with a ring; overlays are white with a real shadow; heat cells use stronger tints with dark text; the page has no glow.
- **Paper** (*proposal*, built): warm cream with brown ink and a brass-brown accent.
- **Felt, Slate, Dusk:** dark variants (green room, cool blue-grey, violet).
- **Contrast:** black and white, heavy borders, no shadows.
- **Custom:** the user gives background, panel, text and accent; everything else is derived; light or dark is chosen from the background's luminance; contrast is calculated and shown live. A custom theme cannot be audited in advance, so the editor must warn below 4.5:1.
- **The share card** keeps the dark tokens in every theme (it is an image for a chat).
- **User settings that write tokens at runtime:** accent (and computed `--accent-ink`, `--accent-text`, `--sel-bg`), corner radius, heading font and weight, card back and face, table pace, reduced motion.
- *Proposals:* follow the system (dark at night, light by day); a separate table theme; a print stylesheet on Paper tokens.

### 2.6 Audit result

Theme audit over 43 app states, 3,611 text runs per theme: zero text below 4.5:1, zero invisible control borders, zero clipped text in all seven themes; in the light themes two dark elements remain on purpose (the felt, and the filled current-street dot). Before the token work Daylight had 240 contrast failures, 11 dark leftovers, 45 invisible borders and 10 clipped texts. Method and limits: `design/docs/DAYLIGHT_AUDIT.md`. **Limits to remember:** English only, 1440×900, hover and focus states not walked, fonts were fallbacks in the sandbox, and a script cannot judge beauty.

---

## 3. Type, space, shape

### 3.1 Type

Families: **Inter** for text; **Rubik** for headings and numbers (one family for Latin, Cyrillic and Hebrew). Bundle the fonts in the app (variable files); never load them at runtime. Tabular figures for every number. Text blocks stop at about 70 characters.

| Token | px | Use |
|---|---|---|
| `--fs-micro` | 11 | uppercase labels only (letter-spacing 0.09em, weight 600) |
| `--fs-caption` | 12 | hints, footnotes, sub-lines |
| `--fs-small` | 13 | secondary rows, chips |
| `--fs-body` | 14 | default |
| `--fs-lead` | 16 | teacher text, questions |
| `--fs-title` | 20 | panel titles |
| `--fs-display` | 26 | screen headline, big numbers |
| `--fs-hero` | 38 | at most one per screen: a result total |

Weights: 400 body, 500 names, 600 labels and controls, 700 card ranks and the hero number. Heading weight is a user setting (500, 600, 700). Line heights: 1.2 tight, 1.4 snug, 1.5 body.

**Honest note.** The prototype uses sixteen font sizes, including 11.5, 12.5, 13.5 and 14.5, which crept in while fitting English text into tight panels. The scale above is the target. Settle sizes per component during the localisation pass (Russian labels grow two to three times), not by copying the prototype.

### 3.2 Space, radius, size

- Space scale: 2, 4, 6, 8, 12, 16, 18, 24, 32. Panel gutter and panel padding are both 18. (The prototype also uses 10 and 14; map them per component.)
- Radius: panels 18 (user setting 8, 18, 26); controls 12 (6, 12, 18); cards 6; pills full.
- Control heights: chip 28, control 34, input 38, primary 44. Phone tap targets at least 40.
- Focus: a 2 px accent ring with a 2 px offset on everything focusable, in every theme.
- Layers: panel 1, table 2, bubble 5, dock 20, overlay 40, dialog 60, toast 80.

### 3.3 Layout

- Desktop first. Test at **1920×1080 and 1366×768**, 100 percent zoom, with the dock visible. (The prototype is 1440×900.)
- Shell measurements in the prototype (at 1440×900): content starts 76 px from the top and 40 px from each side; rail 206 px wide, 64 px collapsed; content begins 266 px from the left (124 px with the rail collapsed) and ends 104 px above the bottom to clear the dock (24 px in focus mode); the dock floats 18 px above the bottom edge, centred, with a 26 px radius and a blurred backdrop.
- A fixed skeleton per room: regions that change reserve their height; feedback replaces the answer area in place; hover never moves layout; nothing jumps when a number arrives.
- At most two levels of containment.
- Three levels of emphasis inside a panel: label, value, explanation. A fourth means two panels.

---

## 4. Components (build once, on a component sheet, in every state, in three languages)

Each has five visible states where it is interactive: rest, hover, pressed (scale 0.97), focus, disabled. Disabled never carries an instruction and uses the track colour with `--text3`, not a faded accent.

| # | Component | What it is and its rules |
|---|---|---|
| 1 | **Shell**: top bar, dock, rail | Section 2.0 of the product map. The dock marks the current room once. The rail collapses to icons. Focus mode hides both. |
| 2 | **Panel** | `--panel-bg`, `--panel-border`, `--radius`, `--shadow`, 18 px padding. A micro label, a title, content. Never nested. |
| 3 | **Button** | Primary (accent fill, one per view), secondary (outline `--line2`), danger (outline and wash). The primary carries the amount when it commits one ("Confirm: bet 3.8 bb"). |
| 4 | **Chip and tier badge** | Pills, 24 to 28 px. The tier badge sits once per panel, same corner everywhere: "Exact · all 990 runouts", "Baseline · Estimated". Tiers use neutral colours. |
| 5 | **Chip button and segmented control** | For small choices (table pace, street, filters). Selected: accent border, `--sel-bg`, `--accent-text`. |
| 6 | **Text input and token chips** | Recessed well. Used for shorthand: tokens appear as chips as you type; a bad token is red-outlined and named in a message beside the field. |
| 7 | **Option tickets** | The decision control: two to four tickets (Fold, Call, Raise to...), each a real button with its key shown. Select, then confirm with the primary button. The chosen ticket's border draws around it; the others step back to 50 percent. Sizes live in one place: a size ladder under the tickets (editable presets, reset), never inside a ticket. Costs are visible: on hover per size, and persistently for the selected size. |
| 8 | **Playing card** | Sizes: mini, small (30×40), standard (34×46), large (48×66), table. Rank over suit, rank weight 700. States: face, back (with the brass edge), slot (dashed), struck (in play), dimmed. Two cards shown as an illustration: one face up in front, one face down behind. |
| 9 | **Felt table** | A stadium-shaped felt with a brass rim; **hero at the bottom**; seats around; pot in the middle; board cards on the felt; nothing overlaps a seat; text never touches the rim. Contains: **seat** (disc, name tag, stack, style line, dealer mark; folded dims to 40 percent), **action bubble** (above the seat), **thinking dots**, **action ring** (travels between seats), **chips**. Also used as a menu in the Training hub, where seats are natural seats with a label. |
| 10 | **Mix bar** | A thick bar of action shares with labels inside segments; fills as one uniform wipe from left to right; a "you" pointer below the bar at the position of the chosen size (bigger raise further right); the pointer never covers a label. Text on segments must pass contrast. |
| 11 | **Equity row and bar** | Section 3 of `design/docs/EQUITY_BY_ROWS_SPEC.md`. A bar with a tick for the previous value; the number once. |
| 12 | **History rail and street strip** | The one history component: vertical, grouped by street, current row highlighted, new rows slide in. A horizontal street strip for the result by street. |
| 13 | **Fact tile** | A label, one number, a tier or unit. Two to four per panel instead of a fact table. |
| 14 | **Teacher callout and the Lamp** | The Lamp at the left, text typed at the user's chosen speed, at most one action. Section 7. |
| 15 | **Heat grid** | One component for the runout grid (4×13 cards), the leak map (families by players behind) and the 13×13 matrix (never mirrored in right-to-left). Cells carry a value, a tint from the meaning colours with theme-specific text, a ring for the current cell, a struck state, and arrow-key navigation with Escape to clear. |
| 16 | **Family strip** | The plan builder's control: a row of hands in a family from strongest to weakest; drag, click or arrow keys to set the cutoff; the handle shows its edge. |
| 17 | **Overlay**: tooltip, palette, dialog, toast, phone sheet | One look (`--overlay-*`). Scrim behind dialogs and the palette. Focus moves in at once and returns on close. Type-to-confirm for destructive dialogs. |
| 18 | **Stepper** | Minus, value, plus, for amounts on the phone and for size edits. |

Composition rules carried from earlier work: spacing over boxes; one action colour language; ledger-style numbers; one look per object wherever it appears; small visuals instead of words where they are clearer; context in free space; no interactive element inside another.

---

## 5. Screens

All rooms and their states are described in `06_PRODUCT_MAP.md` with screenshot names. The 43 captured states: `collapsed_rail`, `drill_question`, `drill_answered`, `duel_preflop`, `duel_thinking`, `duel_flop_ladder`, `duel_result`, `equity_flop`, `equity_turn_card`, `equity_flush_card`, `equity_multiway`, `focus_mode`, `full_hand_bot_thinking`, `full_hand_hero_turn`, `full_hand_watch`, `home_coach`, `home_seats`, `learn_concept`, `learn_trainer`, `plan_builder`, `plan_spot_map`, `recorder_raise`, `recorder_flop_grid`, `recorder_typed_error`, `recorder_done`, `review_hand`, `saved_library`, `scan_where`, `scan_question`, `scan_first_read`, `search_palette`, `session_report`, `settings_appearance`, `settings_data`, `settings_language`, `settings_motion`, `settings_shortcuts`, `settings_teacher`, `share_card_image`, `share_card_text`, `strategy_leak_map`, `training_hub`, `weekly_letter`. The same list, as states a test can drive, is `design/tools/states.js`.

---

## 6. Motion

### 6.1 Tokens

| Token | Value | For |
|---|---|---|
| `--dur-1` | 120 ms | press, hover, tick |
| `--dur-2` | 200 ms | chip, tab, tooltip; anything leaving |
| `--dur-3` | 320 ms | panel and view change, rows |
| `--dur-4` | 520 ms | card flight, bar growth, border draw |
| `--ease-out` | cubic-bezier(.23, 1, .32, 1) | default: arriving and responding |
| `--ease-inout` | cubic-bezier(.65, 0, .35, 1) | travelling from A to B: action ring, pointer |
| `--ease-spring` | cubic-bezier(.34, 1.36, .64, 1) | one small overshoot on objects: a chip landing, a winning seat |
| `--ease-exit` | cubic-bezier(.55, 0, .8, .4) | leaving: folds, dismissals |
| `--stagger-s` | 12 ms | grids |
| `--stagger-m` | 70 ms | lists, option tickets, dealt cards |
| `--pace` | 1 (Calm 1.35, Fast 0.6) | multiplies table time only |

These token values are a *proposal* until the owner has felt them in a real build. The prototype's own rules still use about a dozen literal durations (140 to 340 ms); they map onto the four tokens.

### 6.2 Rules

1. **Two clocks.** Interface feedback always runs at token speed. Table time (a bot thinking, the beat between two actions, a card flight) is multiplied by `--pace`. The owner asked for slower table actions; slowing the interface would make it feel broken.
2. **Frequency decides how much.** Something done a hundred times a day barely animates; something rare may delight.
3. **Keyboard is instant.** The result of a keyboard action appears at once; decoration may follow.
4. **Leaving is faster than arriving,** and the two never overlap at full opacity. In-place swaps stack in one grid cell; the old content leaves in about 110 ms before the new enters.
5. **Transform and opacity only** (and clip-path). No animated width, height, top, left or box-shadow. Bars grow with `scaleX` from the reading-start edge. Rows that make room move by transform (FLIP). Target 60 frames per second on an integrated-graphics laptop, in Firefox.
6. **Springs are for objects, not facts.** A chip may overshoot; a percentage counts straight to the engine value and stops on it.
7. **One thing moves at a time per region.** The equity bars wait for the last board card.
8. **Motion carries meaning or it goes.** The only idle motion is the Lamp's breathing and a waiting seat's pulse.
9. **Transitions never leave stale content.** Remove old content by timeout as well as by animation end; a quick second tap cancels the first swap.
10. **Reduced motion** (system setting or the app's own): travel, flips, rolls and staggers are removed; **the pauses between table actions stay**, because they are information. "Minimal card animation" is a separate setting that keeps interface motion but shows cards without flight.

### 6.3 One rule per kind of thing

| Thing | Enter | Change | Leave |
|---|---|---|---|
| View (room change) | rise 10 px and fade, `dur-3` `ease-out`, after the old view left | | fade and lift 8 px, `dur-2` `ease-exit` |
| Panel content swap | fade in `dur-2` after 110 ms | | fade in 110 ms |
| Row | drop 10 px and fade, `dur-3` | siblings move by FLIP; no automatic re-sort | `dur-2` `ease-exit`, then siblings close the gap |
| Card | fly from the deck `dur-4` `ease-out`, then flip (the face swaps at the edge-on midpoint); `stagger-m` | lift 4 px on hover in grids | **fold:** lift, turn face down, toss to the muck on an uneven arc, `dur-4` `ease-exit`; cards never overlap and are never face up in flight |
| Seat | pop `dur-3` `ease-spring` | action ring travels `dur-3 × pace` `ease-inout`; thinking dots loop; action bubble appears **above the seat** `dur-2` and stays long enough to read (`× pace`) | folded seat dims to 40 percent `dur-2` |
| Showdown | hole cards turn | the winning five lift with an **outline**; the rest dim; a result line | |
| Chips | arc to the pot, `stagger-m`, kept light | pot label bumps once (`ease-spring`) and the number counts | |
| Option ticket | rise with `stagger-m` | chosen: border draws around it `dur-4`; others to 50 percent | |
| Confirm | | the button acknowledges with a short press and a check; the amount stays readable | |
| Mix bar | uniform wipe left to right `dur-4` `ease-inout` | the "you" pointer slides to the chosen size `dur-3` `ease-spring` | |
| Number | | counts for `dur-4`, lands exactly | |
| Tabs and rail | | underline or highlight glides `dur-3` `ease-inout`; content comes from the direction of travel | |
| Menu, palette, dialog | scrim `dur-2`; surface from 96 percent and 10 px `dur-3` `ease-out`; focus moves in immediately | | `dur-2` |
| Toast | from the dock edge `dur-3` | | `dur-2` |
| Invalid input | | a short sideways nudge, a warm edge, the message opens beside the field | |
| Loading | the content's shape shimmers | content replaces it line by line | |
| Theme change | colours cross-fade `dur-3` (*proposal:* a circular reveal from the chosen swatch) | | |
| The Lamp | fade | mood change cross-fades; breathing loop 3.4 s; rings while text types | fade |

### 6.4 The inventory of moments

Forty-one moments were catalogued and approved as a direction in October (`reference/MOTION_SPEC.md`): choosing an action, confirming, answer reveal, changing numbers, chips to pot, dealing the board, "all details", tabs, saving, painting a range, session progress, toast, sidebar, workspace switch, whose turn, showdown, history rail, equity updating, filtering a list, invalid input, loading, theme change, game-night settle, building the plan, review stepping, the luck moment, the learning path, trainer answer, opening Home, the motion setting, settings categories, switches, sliders, rebinding a shortcut, switching language, opening a lesson, lesson steps, library inspector, archive with undo, search as you type. **Use that list as the checklist of what should move on each screen;** use the tokens and rules above for how. The older file's durations and its "tempo" model are superseded.

For each screen you build, list the moments that apply and mark each built or missing. The owner rejected a screen in October because approved animations were missing.

### 6.5 Fresh ideas (*proposals*)

Shared-element card travel from the Saved list into Review; an equity tick trail when stepping turn cards quickly; scrubbing a hand along the history rail; three quiet sounds (card, chip, confirm) tied to the pace setting; phone haptics for money commits.

---

## 7. The Lamp

An abstract desk lamp with two simple eyes: "one light". More serious than a mascot; a teacher who happens to be a lamp. No mouth, no limbs, no jokes about losses.

**Eight moods** (`prototypes/lamp-moods.html`, all animated, no sound):

| Mood | What it does | When | Example line |
|---|---|---|---|
| Idle | breathes, blinks now and then; always present, never loud | default | "Good evening. Ten minutes on your big blind?" |
| Thinking | cool light, a slow orbit, eyes drifting | while the engine works | "Let me look at the hands you folded." |
| Curious | the beam tilts, one brow up | when asking a question | "Why did you call there?" |
| Speaking | rings radiate while a line is shown; quiet by default | while text types | "Here is what I would change tonight." |
| Approving | a wider, brighter beam and a small spark | a gap closed | "That is a leak closed. Three this month." |
| Celebrating | a short burst, then back to idle; rare | levels and achievements | "Level 7. You earned that." |
| **Stern** | the beam narrows and cools | **only when the maths earns the word** | "You called off 100 bb needing 45% with 26%. That one is on you." |
| Resting | dim and slow; wakes on a click | away or paused | "…" |

**Stern stays** (owner decision, against a review that suggested cutting it).

- **A teacher moment in Review, start to finish:** you open the hand (the Lamp is simply there); it asks why (one tap); it works it out ("counting 990 runouts with both hands known"); it names the mistake ("you needed 45% and had 26%"); it offers a fix ("five minutes on call-or-fold against shoves?").
- **Sizes in use:** 28 px inline with a line, 44 in lists, 72 in cards, 128 on Home and in onboarding.
- **Themes:** the Lamp reads its colours from tokens and is shown in six themes on `prototypes/lamp-themes.html` (idle, approving, stern in each). The two Lamp boards themselves are drawn on a Midnight page.
- **Use:** beside the teacher's lines on Home, in the leak scan, in Review, in the weekly letter, in empty states, and in its Thinking mood as the loading state for engine work. Never over content. A setting hides it.
- The Lamp, like the voice setting, can change tone; it never changes the strength of a claim.

---

## 8. Numbers in the prototype that are verified

Computed by exact enumeration with `design/tools/eqexact.py` and, where marked, independently confirmed by the Gemini review. Use them as the first golden tests.

| Fact | Value |
|---|---|
| A♦K♦ vs Q♠Q♣ on K♠ 8♥ 4♥, two cards to come | hero 91.2% (903 of 990 runouts, no ties) ✓ also by Gemini |
| K♦J♦ vs any two cards on K♠ 8♥ 4♥ | hero 83.1% (win 82.7%, tie 0.87%, 1,070,190 combinations) ✓ also by Gemini |
| A♥K♥ vs Q♠Q♣ on Q♥ 7♣ 2♥ | hero 25.6% (990 runouts) ✓ also by Gemini |
| Same, by turn card | a heart other than the 7: 77.3% (8 cards); ace or king: 18.2% (6); jack or ten, not hearts: 22.7% (6); blanks 3 to 9: 15.9% (18); a 7 or a 2 (the board pairs; 6 cards, including 7♥): 0%, drawing dead; Q♦ (1 card): 0%, drawing dead. 8 + 6 + 6 + 18 + 6 + 1 = 45 turn cards |
| Three-way: plus T♥9♥, flop | 20.5 / 76.4 / 3.1 (903 runouts); turn 3♥: 76.2 / 23.8 / 0.0 |
| Four-way: plus 7♦7♠, flop | 22.6 / 69.3 / 3.4 / 4.8 (820 runouts) |
| Pot odds: call 9 after a bet of 9 into 18 | 25.0% |
| Pot odds: call 1.7 after a bet of 1.7 into 5 | 20.2% |
| Pot odds: call 90 after a shove of 90 into 20 | 45.0% |
| Pot odds: call 2.5 into a pot of 4 | 38.5% |
| Duel: a bet of 3.75 into 5 | the opponent needs 30.0%; if called the pot is 12.5 and SPR is 7.5 (93.75 behind) |
| Heads-up: small blind limps, big blind checks | pot 2 bb. Raise to 2.5, called: pot 5 bb; SPR with 97.5 behind: 19.5 |
| All-in luck: 40 bb each, hero 91.2%, hero wins | expected +33.0 bb, luck about +7.0 bb |
| Review example: call 90 into a final pot of 200 with 25.6% | expected share 51.2 bb of the pot against 100 bb put in over the hand: −48.8 bb expected for the hand; the actual −100 bb is −51.2 bb of run-out luck |

**A wording defect to fix when building Review:** the prototype labels −48.8 bb as "Your call, against his hand". That figure is the expected result of the whole hand from the moment of the call, not the value of the call compared with folding (which is −38.8 bb, since 10 bb were already in). Say exactly which one is shown.

Everything else in the prototype (leak sizes, session results, counts, the baseline's mixes) is illustrative.

---

## 9. Copy and voice

One voice in every language: a calm, honest, blunt coach. Full guide: `reference/VOICE_GUIDE.md`, with one change (below).

1. Facts first, then why, then how sure.
2. Say what it rests on: source, tier, sample.
3. Describe actions, never the person. No "nit", "fish", "passive player".
4. **Verdict words only where exact evidence earns them.** "Mistake" may be used for an exact price or equity error. For any comparison with the baseline or a range assumption use: inside or outside the baseline's mix, close, the baseline leans to, wider, tighter. (This replaces the older guide's total ban on "mistake"; the owner asked for a blunter teacher.)
5. Luck is named as luck.
6. Uncertainty in one plain line ("Not enough hands yet to say: 4 so far").
7. Quiet copy: no filler, no hype, no exclamation marks except a real celebration.
8. Short by default, deeper on demand.
9. Units always: "2.5 bb", "38.5%". Mix shares rounded to 5 percent; exact maths to one decimal.
10. Never "always" or "never" for strategy unless the source is exact.
11. No em or en dashes in product sentences. No "Selected". No "heuristic". Never "GTO says", "optimal", "perfect".
12. Feature names such as "Leak map" and "Leak scan" are in the approved mockups. "Leak" is not used as a label on a person.
13. Errors name the thing: "Q♥ is already in play." Empty states: one line and one action.

---

## 10. Languages and right-to-left

- English, Russian and Hebrew from the first component. The owner judges Russian and Hebrew wording personally.
- Terms: `reference/TERMINOLOGY_SHEET.md`. General interface words get standard translations; poker terms follow real usage (Russian loanwords except fold = пас; Hebrew loanwords); abbreviations and position codes stay Latin (UTG, BTN, bb, SPR, EV). Russian uses «ты». Hebrew uses masculine singular.
- Logical CSS properties everywhere, so Hebrew mirrors without a second stylesheet. Cards, ranges, amounts and abbreviations are left-to-right islands. The 13×13 matrix and the runout grid are never mirrored. Bars grow from the reading-start edge.
- Messages are templates with named values and plural rules; never concatenate.
- Numbers, dates and currency through `Intl`, with the old repo's locale number modules as the reference for decimal input.
- Budget for growth: Russian labels are often two to three times the English length. A component is not done until it holds Russian without clipping; the layout audit checks this.

**This is the largest untested risk in the design.** No restart screen has been drawn in Russian or Hebrew.

---

## 11. Accessibility baseline

4.5:1 for all text; 3:1 for control borders and meaningful graphics; a visible focus ring on everything; every control reachable and operable by keyboard; real buttons, links and inputs with labels; no interactive element inside another; live regions for results that appear without focus moving (equity after picking a card, a bot's action); reduced motion honoured; targets at least 40 px on touch layouts; colour never the only signal.

---

## 12. What the gates check (and what only the owner can)

| Check | Tool | Pass mark |
|---|---|---|
| Overlap, covered text, text on a rim, tab alignment, small targets | `design/tools/audit.js` (layout audit) | zero |
| Contrast, dark leftovers in light themes, invisible borders, clipped text, in every theme | `design/tools/snap.js` + `analyze.py` (theme audit) | zero |
| Raw values in component styles | `repo-seed/tools/check-no-raw-values.mjs` | zero |
| Numbers | golden tests from `eqexact.py` and the engine | exact match |
| Whether it feels like Riverline, whether the motion is right, whether the wording is natural in Russian and Hebrew | the owner, in Firefox | the owner's word |
