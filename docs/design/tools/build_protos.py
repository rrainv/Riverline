#!/usr/bin/env python3
import html
import json
import os
import re
import sys
import mkshim

HERE = os.path.dirname(os.path.abspath(__file__))
P = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'canvas-source')
O = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, '..', 'prototypes')


def props_of(t):
    m = re.search(r"data-props='([^']*)'", t)
    if not m:
        return {}
    d = json.loads(html.unescape(m.group(1)))
    return {k: v.get('default') for k, v in d.items() if isinstance(v, dict) and 'default' in v}


main_src = 'Main.tok.dc.html' if os.path.exists(os.path.join(P, 'Main.tok.dc.html')) else 'Main.dc.html'
jobs = [
    (main_src, 'riverline-app.html', 'Riverline: the app (all screens, live themes)', None),
    (main_src, 'equity-by-rows.html', 'Riverline: equity by rows', {'view': 'equity', 'turn': None}),
    (main_src, 'riverline-app-daylight.html', 'Riverline: the app in Daylight', {'th': 'daylight'}),
    ('LampMoods.dc.html', 'lamp-moods.html', 'Riverline: the Lamp, eight moods', None),
    ('LampThemes.dc.html', 'lamp-themes.html', 'Riverline: the Lamp in six themes', None),
    ('MotionCards.dc.html', 'motion-cards-and-table.html', 'Riverline motion: cards and table', None),
    ('MotionInterface.dc.html', 'motion-interface.html', 'Riverline motion: interface and progress', None),
    ('PhoneNight.dc.html', 'phone-game-night.html', 'Riverline: game night on a phone', None),
]
for src, out, title, init in jobs:
    src_path = src if os.path.exists(src) else os.path.join(P, src)
    out_path = os.path.join(O, out)
    with open(src_path, encoding='utf-8') as fh:
        t = fh.read()
    mkshim.make(t, props_of(t), out_path, title, init)
    with open(out_path, encoding='utf-8') as fh:
        print(out, len(fh.read()))
