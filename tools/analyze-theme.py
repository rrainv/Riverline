#!/usr/bin/env python3
"""Pixel-measured theme audit for Riverline.

Usage: python tools/analyze-theme.py <dir> [light]
Checks pixel-measured contrast (4.5:1 normal, 3.0:1 large), dark leftovers in light themes,
invisible control borders, and clipped text. Pass mark: zero failures (exits 1 otherwise).
"""
import collections
import glob
import json
import os
import sys
from PIL import Image

d = sys.argv[1]
light = len(sys.argv) > 2 and sys.argv[2] == 'light'


def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def lum(p):
    return 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2])


def cr(a, b):
    x, y = lum(a), lum(b)
    return (max(x, y) + 0.05) / (min(x, y) + 0.05)


ALLOW = ('pc.bk', '.bk', 'mfelt', 'sharecard', 'sharetext', '.sw', 'swatch', 'felt', 'oval', 'pc.', 'span.pc', 'lampw', 'disc', 'btn', 'chip.acc')
clip = collections.OrderedDict()
tot = 0
fails = collections.OrderedDict()
dark = collections.OrderedDict()
bord = collections.OrderedDict()
per = {}

for jf in sorted(f for f in glob.glob(os.path.join(d, '*.json')) if not os.path.basename(f).startswith('_')):
    st = os.path.basename(jf)[:-5]
    with open(jf, encoding='utf-8') as fh:
        J = json.load(fh)
    im = Image.open(jf[:-5] + '.png').convert('RGB')
    W, H = im.size
    px = im.load()
    nf = 0
    for L in J['leaves']:
        x0 = max(0, int(L['x']) - 1)
        y0 = max(0, int(L['y']))
        x1 = min(W, int(L['x'] + L['w']) + 2)
        y1 = min(H, int(L['y'] + L['h']) + 1)
        if x1 - x0 < 3 or y1 - y0 < 4:
            continue
        pts = [px[x, y] for y in range(y0, y1) for x in range(x0, x1)]
        bk = collections.Counter((p[0] >> 4, p[1] >> 4, p[2] >> 4) for p in pts)
        top = bk.most_common(1)[0][0]
        bgp = [p for p in pts if (p[0] >> 4, p[1] >> 4, p[2] >> 4) == top]
        bg = tuple(sum(c[i] for c in bgp) / len(bgp) for i in range(3))
        ds = sorted(pts, key=lambda p: -(abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2])))
        k = max(2, len(pts) // 60)
        fgp = ds[:k]
        fg = tuple(sum(c[i] for c in fgp) / k for i in range(3))
        c = cr(fg, bg)
        big = L['fs'] >= 24 or (L['fs'] >= 18.6 and L['fw'] >= 700)
        need = 3.0 if big else 4.5
        if L.get('clipped'):
            clip.setdefault((L['path'], L['t'][:24]), st)
            continue
        if L.get('covered'):
            continue
        tot += 1
        if L['dis'] or L['op'] < 0.75:
            continue
        if c < need:
            nf += 1
            key = (L['path'], L['t'][:22])
            if key not in fails or c < fails[key][0]:
                fails[key] = (round(c, 2), need, st, int(L['fs']))
    per[st] = nf
    if light:
        for B in J['boxes']:
            if B.get('allow') or any(a in B['path'] for a in ALLOW):
                continue
            xs = [min(W - 1, max(0, int(B['x'] + B['w'] * f))) for f in (0.12, 0.5, 0.88)]
            ys = [min(H - 1, max(0, int(B['y'] + B['h'] * f))) for f in (0.2, 0.8)]
            lm = sorted(lum(px[x, y]) for x in xs for y in ys)[2]
            if lm < 0.10:
                dark.setdefault(B['path'], (round(lm, 3), st))
    for B in J['borders']:
        y = min(H - 1, max(0, int(B['y'] + B['h'] / 2)))
        xb = int(round(B['x']))
        xo = max(0, xb - 5)
        xi = min(W - 1, xb + int(B['bw']) + 6)
        if xb < 6 or xb > W - 12:
            continue
        c = max(cr(px[min(W - 1, max(0, x)), y], px[xo, y]) for x in range(xb - 1, xb + 3))
        inner = cr(px[xi, y], px[xo, y])
        if c < 1.25 and inner < 1.12:
            bord.setdefault((B['path'], B['t'][:16]), (round(c, 2), st))

print(
    'text runs measured:',
    tot,
    '| contrast failures (unique):',
    len(fails),
    '| dark artifacts:',
    len(dark),
    '| invisible control borders:',
    len(bord),
    '| clipped text:',
    len(clip),
)
for (p, t), st in list(clip.items())[:12]:
    print('  CLIP [%s] %s | %s' % (st, t, p[-60:]))
per_nonzero = {k: v for k, v in per.items() if v}
if per_nonzero:
    print('per state:', per_nonzero)
show = int(os.environ.get('SHOW', '25'))
for (p, t), (c, need, st, fs) in list(sorted(fails.items(), key=lambda kv: kv[1][0]))[:show]:
    print('  C %.2f<%s %dpx [%s] %s | %s' % (c, need, fs, st, t, p[-70:]))
for p, (l, st) in list(dark.items())[:show]:
    print('  DARK %.3f [%s] %s' % (l, st, p[-80:]))
for (p, t), (c, st) in list(bord.items())[:show]:
    print('  BORDER %.2f [%s] %s | %s' % (c, st, t, p[-60:]))

with open(os.path.join(d, '_summary.json'), 'w', encoding='utf-8') as fh:
    json.dump(
        {
            'total': tot,
            'fails': [[p, t, *v] for (p, t), v in fails.items()],
            'dark': [[p, *v] for p, v in dark.items()],
            'borders': [[p, t, *v] for (p, t), v in bord.items()],
            'clipped': [[p, t, st] for (p, t), st in clip.items()],
            'per': per,
        },
        fh,
        ensure_ascii=False,
    )

if len(fails) + len(dark) + len(bord) + len(clip) > 0:
    sys.exit(1)
