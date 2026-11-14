#!/usr/bin/env python3
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RAW_PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'tokens_raw.json')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, '..', 'tokens')

with open(RAW_PATH, encoding='utf-8') as fh:
    d = json.load(fh)
m = dict(d['midnight'])
m['--root-bg'] = 'radial-gradient(ellipse 85% 75% at 50% 36%,#1f5a43 0%,#123a2b 46%,#07150f 100%)'
for th in d:
    d[th].setdefault('--root-bg', m['--root-bg'])
d['midnight'] = m
MOTION = ['--dur-1', '--dur-2', '--dur-3', '--dur-4', '--ease-out', '--ease-inout', '--ease-spring', '--ease-exit']
PREF = ['--radius', '--radius-s', '--font', '--font-head', '--font-num', '--head-w', '--cardface', '--cardback', '--cardback-edge']
GROUPS = [
    ('Surfaces', ['--bg', '--root-bg', '--root-glow', '--panel-bg', '--panel-border', '--shadow', '--well', '--tint', '--hover', '--track', '--sel-bg', '--scrim', '--dock-bg', '--pill-bg', '--seg-gap']),
    ('Text', ['--text', '--text2', '--text3']),
    ('Lines', ['--line', '--line2', '--line3']),
    ('Accent and brand', ['--accent', '--accent-ink', '--accent-text', '--brass', '--brass-text']),
    ('Meaning (data colours)', ['--over', '--over-text', '--under', '--under-text', '--ok', '--ok-text', '--danger', '--danger-bg']),
    ('Overlays (tooltips, bubbles, palette)', ['--overlay-bg', '--overlay-line', '--overlay-ink', '--overlay-ink2', '--overlay-shadow']),
    ('Table and seats', ['--felt', '--felt-rim', '--felt-rim2', '--on-felt', '--on-felt2', '--seat-bg', '--seat-line', '--seat-ink', '--seat-text', '--seat-ring']),
    ('Playing cards', ['--card-ink', '--card-red', '--pcshadow']),
    ('Elevation', ['--elev-1', '--elev-2', '--elev-3', '--elev-4']),
]
NOTE = {
    '--bg': 'flat fallback behind the page gradient',
    '--root-bg': 'page background',
    '--root-glow': 'warm lamp glow at the top of the page; transparent in light themes',
    '--panel-bg': 'every panel',
    '--panel-border': 'panel edge',
    '--shadow': 'panel shadow',
    '--well': 'recessed fields: inputs, tracks inside panels',
    '--tint': 'barely-there fill for unanswered cells',
    '--hover': 'hover fill on any neutral control',
    '--track': 'empty part of bars',
    '--sel-bg': 'selected option fill',
    '--scrim': 'behind dialogs and the search palette',
    '--dock-bg': 'floating dock',
    '--pill-bg': 'top-bar pills',
    '--seg-gap': 'hairline between mix-bar segments',
    '--text': 'primary text, 4.5:1 or better on every surface',
    '--text2': 'secondary text, 4.5:1 or better',
    '--text3': 'tertiary text and labels, 4.5:1 or better (never lighter)',
    '--line': 'quiet divider',
    '--line2': 'control border, 3:1 against its surface in light themes',
    '--line3': 'dashed and emphasised border',
    '--accent': 'fills and rings only',
    '--accent-ink': 'text on an accent fill',
    '--accent-text': 'accent used as text or icon; darkened automatically in light themes',
    '--brass': 'brass fill',
    '--brass-text': 'brass as text',
    '--over': '"too wide / hurts you" fill',
    '--over-text': 'same meaning as text',
    '--under': '"too tight" fill',
    '--under-text': 'same meaning as text',
    '--ok': 'match fill',
    '--ok-text': 'match as text',
    '--danger': 'destructive',
    '--danger-bg': 'destructive panel wash',
    '--felt': 'table felt: stays green in every theme',
    '--on-felt': 'text drawn on the felt (always light)',
    '--on-felt2': 'secondary text on the felt',
    '--seat-bg': 'seat disc',
    '--seat-ink': 'icon inside a seat',
    '--seat-text': 'seat label text',
    '--seat-ring': 'ring that separates a seat from the felt',
    '--seat-line': 'seat border',
    '--card-ink': 'black suits on a card face',
    '--card-red': 'red suits on a card face',
    '--pcshadow': 'small card shadow; adds a hairline in light themes so ivory cards read on white',
    '--elev-1': 'cards, chips',
    '--elev-2': 'bubbles, tooltips',
    '--elev-3': 'panels that float, the dock',
    '--elev-4': 'dialogs, the palette',
}
SCALE = """
  /* ---- Type scale (rationalised; see TOKENS_README for the mapping from the mockup's in-between sizes) */
  --fs-micro: 11px;    /* uppercase labels */
  --fs-caption: 12px;  /* hints, footnotes, table sub-lines */
  --fs-small: 13px;    /* secondary rows, chips */
  --fs-body: 14px;     /* default */
  --fs-lead: 16px;     /* teacher text, question text */
  --fs-title: 20px;    /* panel titles */
  --fs-display: 26px;  /* screen headline, big numbers */
  --fs-hero: 38px;     /* one per screen at most: result totals */
  --lh-tight: 1.2; --lh-snug: 1.4; --lh-body: 1.5;
  --fw-regular: 400; --fw-medium: 500; --fw-semibold: 600; --fw-bold: 700;
  --ls-label: .09em; --ls-display: -.02em;
  --num: tabular-nums;  /* use as font-variant-numeric on every number */

  /* ---- Space scale */
  --sp-1: 2px; --sp-2: 4px; --sp-3: 6px; --sp-4: 8px; --sp-5: 12px; --sp-6: 16px; --sp-7: 18px; --sp-8: 24px; --sp-9: 32px;
  --gutter: var(--sp-7);       /* between panels */
  --panel-pad: var(--sp-7);    /* inside panels */

  /* ---- Radius */
  --radius: 18px;      /* panels (user setting: 8 / 18 / 26) */
  --radius-s: 12px;    /* controls (user setting: 6 / 12 / 18) */
  --radius-card: 6px;  /* playing cards */
  --radius-pill: 999px;

  /* ---- Control sizes */
  --h-chip: 28px; --h-control: 34px; --h-input: 38px; --h-primary: 44px;
  --tap-min: 40px;     /* minimum touch target on phone layouts */
  --focus-ring: 2px solid var(--accent); --focus-offset: 2px;

  /* ---- Layers */
  --z-panel: 1; --z-table: 2; --z-bubble: 5; --z-dock: 20; --z-overlay: 40; --z-dialog: 60; --z-toast: 80;

  /* ---- Motion */
  --dur-1: 120ms;  /* press, hover, tick */
  --dur-2: 200ms;  /* small state change: chip, tab, tooltip */
  --dur-3: 320ms;  /* panel and view change, bar growth */
  --dur-4: 520ms;  /* card flight, border draw, big reveals */
  --ease-out: cubic-bezier(.23,1,.32,1);       /* default: things arriving */
  --ease-inout: cubic-bezier(.65,0,.35,1);     /* things travelling A to B: ring, pointer */
  --ease-spring: cubic-bezier(.34,1.36,.64,1); /* one small overshoot: chips landing, seat pop */
  --ease-exit: cubic-bezier(.55,0,.8,.4);      /* things leaving: folds, dismissals */
  --stagger-s: 12ms;   /* grids (turn cards, matrix cells) */
  --stagger-m: 70ms;   /* lists and option tickets */
  --pace: 1;           /* table pace multiplier for bot thinking and action beats: calm 1.35, normal 1, fast .6 */
"""


def block(vals, indent='  ', only=None):
    s = ''
    for g, keys in GROUPS:
        rows = [k for k in keys if k in vals and (only is None or k in only)]
        if not rows:
            continue
        s += '\n%s/* ---- %s */\n' % (indent, g)
        for k in rows:
            n = NOTE.get(k, '')
            s += '%s%s: %s;%s\n' % (indent, k, vals[k], ('  /* %s */' % n) if (n and only is None) else '')
    return s


css = (
    """/* Riverline design tokens. Generated from the audited prototype (Main.dc.html) on 2026-11-14.
   One file is the single source for colour, type, space, depth and motion. Components may read tokens; they may not hold raw colours.
   Themes: Midnight is the default on :root. Every other theme only overrides what differs.
   Light themes (daylight, paper) also set color-scheme so native controls and scrollbars follow.
   Checked by tools/theme_audit: every text run 4.5:1 or better, every control border visible, in 43 app states. */

:root {
  color-scheme: dark;
  --font: Inter, system-ui, sans-serif;
  --font-head: Rubik, Inter, sans-serif;   /* user setting: Rubik / Inter / Georgia */
  --font-num: Rubik, Inter, sans-serif;
  --head-w: 600;                            /* user setting: 500 / 600 / 700 */
  --cardface: #f6f2e8;                      /* user setting: ivory / white / slate */
  --cardback: #1a3a2c; --cardback-edge: #bfa965;
"""
    + block(m)
    + SCALE
    + '}\n'
)
for th in ['felt', 'slate', 'dusk', 'contrast', 'daylight', 'paper']:
    diff = {k for k in d[th] if d[th][k] != m.get(k) and k not in MOTION and k not in PREF}
    light = th in ('daylight', 'paper')
    css += '\n/* ================= %s%s ================= */\n[data-theme="%s"] {\n%s' % (
        th.capitalize(),
        ' (light)' if light else '',
        th,
        '  color-scheme: light;\n' if light else '',
    )
    css += block(d[th], only=diff) + '}\n'
css += """
/* ================= Motion preferences ================= */
[data-pace="calm"] { --pace: 1.35; }
[data-pace="fast"] { --pace: .6; }
@media (prefers-reduced-motion: reduce) { :root { --dur-1: 1ms; --dur-2: 1ms; --dur-3: 1ms; --dur-4: 1ms; --stagger-s: 0ms; --stagger-m: 0ms; } }
[data-motion="reduced"] { --dur-1: 1ms; --dur-2: 1ms; --dur-3: 1ms; --dur-4: 1ms; --stagger-s: 0ms; --stagger-m: 0ms; }
/* Reduced motion removes travel, flips and rolls. It keeps the pauses between table actions (they carry meaning), so --pace is not zeroed. */
"""
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, 'tokens.css'), 'w', encoding='utf-8') as fh:
    fh.write(css)
js = {
    '$meta': {'generated': '2026-11-14', 'source': 'Main.dc.html (audited prototype)', 'default': 'midnight', 'light': ['daylight', 'paper']},
    'themes': {th: {k[2:]: v for k, v in d[th].items() if k not in MOTION and k not in PREF} for th in d},
    'type': {
        'family': {'body': 'Inter, system-ui, sans-serif', 'head': 'Rubik, Inter, sans-serif', 'num': 'Rubik, Inter, sans-serif'},
        'size': {'micro': 11, 'caption': 12, 'small': 13, 'body': 14, 'lead': 16, 'title': 20, 'display': 26, 'hero': 38},
        'lineHeight': {'tight': 1.2, 'snug': 1.4, 'body': 1.5},
        'weight': {'regular': 400, 'medium': 500, 'semibold': 600, 'bold': 700},
        'tracking': {'label': '.09em', 'display': '-.02em'},
    },
    'space': [2, 4, 6, 8, 12, 16, 18, 24, 32],
    'radius': {'panel': {'sharp': 8, 'soft': 18, 'round': 26}, 'control': {'sharp': 6, 'soft': 12, 'round': 18}, 'card': 6, 'pill': 999},
    'size': {'chip': 28, 'control': 34, 'input': 38, 'primary': 44, 'tapMin': 40},
    'motion': {
        'duration': {'1': 120, '2': 200, '3': 320, '4': 520},
        'ease': {'out': [0.23, 1, 0.32, 1], 'inout': [0.65, 0, 0.35, 1], 'spring': [0.34, 1.36, 0.64, 1], 'exit': [0.55, 0, 0.8, 0.4]},
        'stagger': {'s': 12, 'm': 70},
        'pace': {'calm': 1.35, 'normal': 1, 'fast': 0.6},
    },
    'layer': {'panel': 1, 'table': 2, 'bubble': 5, 'dock': 20, 'overlay': 40, 'dialog': 60, 'toast': 80},
}
with open(os.path.join(OUT, 'tokens.json'), 'w', encoding='utf-8') as fh:
    json.dump(js, fh, indent=1, ensure_ascii=False)
print(len(css), 'css bytes')
