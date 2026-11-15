---
trigger: glob
description: Token and component discipline for any stylesheet or interface component
globs: ["src/ui/**", "tokens/**", "**/*.css"]
---

# Design discipline (loads when you touch interface files)

1. No hex colour, `rgb()`, `hsl()`, non-zero millisecond/second literal or `cubic-bezier()` outside `tokens/` (including inline SVG `fill`, `stroke`, `stopColor`, or `dur` attributes). Run `npm run check:raw`.
2. Style components with CSS Modules (`*.module.css`) reading `tokens/tokens.css` variables so class names never leak globally.
3. Accent as text or icon is `--accent-text`, never `--accent`. The same split holds for `--over` / `--over-text`, `--under` / `--under-text`, `--ok` / `--ok-text`.
4. Text on the felt uses `--on-felt`. Text in tooltips, bubbles, tags and dialogs uses `--overlay-ink`. Text on seats uses `--seat-text`.
5. `--text3` is the lightest text. Never lower opacity on text to make it quieter.
6. Borders of pressable things use `--line2`.
7. Disabled controls use `--track` with `--text3`, never a faded accent.
8. Animate only `transform`, `opacity` and `clip-path`, with `--dur-*` and `--ease-*`. Table time beats use `calc(var(--beat-action) * var(--pace))` and `calc(var(--beat-think) * var(--pace))` (kept under reduced motion). Reduced-motion duration overrides live in `tokens/tokens.css`.
9. Use logical properties (`margin-inline-start`, `inset-inline-end`, `text-align: start`). Poker notation gets `<bdi dir="ltr">`.
10. A room never overrides a kit component's styles. If a component needs a variant, add it to the component in `src/ui/kit/` and to the `/kit` component sheet.
11. A new token needs a value in every theme where the Midnight value would be wrong (always check Daylight and Paper), then `npm run audit:theme`.
12. After any visual change: `npm run audit:layout` and `npm run audit:theme` (running against `vite preview`). Pass mark: zero.
13. Before building a screen, list the motion moments that apply to it (`docs/handoff/04_DESIGN_SPEC.md` section 6.4) and mark each built or missing in your report.
