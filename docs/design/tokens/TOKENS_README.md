# Riverline tokens

`tokens.css` is the single source for colour, type, space, depth and motion. `tokens.json` carries the same values for scripts and tests. Both were generated on 2026-11-14 from the audited prototype by reading the resolved value of every custom property in each theme, so they are what the screenshots show, not a hand-copied approximation.

## Use

```html
<html data-theme="daylight" data-pace="calm">   <!-- no attribute = Midnight, normal pace -->
<link rel="stylesheet" href="tokens.css">
```

```css
.button-primary { background: var(--accent); color: var(--accent-ink); height: var(--h-primary);
  border-radius: var(--radius-s); transition: transform var(--dur-2) var(--ease-out); }
.link { color: var(--accent-text); }            /* accent as TEXT: never var(--accent) */
```

## Rules

1. Components contain no hex colours, no `rgb()`, no millisecond literals and no `cubic-bezier()`. If a value is missing, add a token here first.
2. A fill and its text are different tokens: `--accent` / `--accent-text`, `--over` / `--over-text`, `--under` / `--under-text`, `--ok` / `--ok-text`. Text variants are tuned per theme to reach 4.5:1.
3. Text on the felt uses `--on-felt`. Text in bubbles, tooltips and seat tags uses `--overlay-ink`. Neither follows `--text`, because their backgrounds do not follow the page.
4. `--text3` is the lightest text allowed. Do not lower its opacity.
5. `--pace` multiplies table time only (bot thinking, beats between actions, card flights): `calc(var(--dur-3) * var(--pace))`. Interface feedback never uses it.

## Add a token

1. Add it to `:root` with a comment that says what it is for.
2. Give it a value in every theme block where the Midnight value would be wrong (always check Daylight and Paper).
3. Run the theme audit (`tools/README.md`). A new token is done when the audit is clean in all seven themes.

## Add a theme

A dark theme usually needs only: `--bg`, `--root-bg`, `--panel-bg`, `--text`, `--text2`, `--text3`, `--accent`, `--accent-ink`, `--accent-text`. A light theme needs the full set that `[data-theme="daylight"]` defines (46 tokens differ from Midnight); copy that block and change the ink colour. Then run the audit.

## User settings that write tokens at runtime

| Setting | Tokens |
|---|---|
| Accent colour | `--accent`, and computed: `--accent-ink` (black or white by luminance), `--accent-text` (darkened in light themes), `--sel-bg` |
| Corner radius | `--radius`, `--radius-s` |
| Heading font, weight | `--font-head`, `--head-w` |
| Card back, card face | `--cardback`, `--cardback-edge`, `--cardface` |
| Table pace | `--pace` via `data-pace` |
| Reduced motion | `data-motion="reduced"` or the system setting |
| Custom theme | background, panel, text, accent from the user; everything else derived; light or dark chosen from background luminance |

## Known gaps

- The type and space scales are the target, not what every mockup screen uses today (the mockup has in-between sizes). See `docs/DESIGN_SYSTEM.md` section 2.3.
- `--panel-bg` is a gradient in dark themes and a flat colour in light themes; use it with `background:`, not `background-color:`.
- Motion tokens exist in the prototype CSS, but most prototype rules still use literal durations. The new repo should start token-only.
- No right-to-left values yet; use logical properties in components and nothing here needs to change.
