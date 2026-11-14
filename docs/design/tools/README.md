# Riverline design tools

Small scripts used to build and check the prototypes and to serve as the starting gates for the new repository. Node 22+ with Playwright (Chromium), Python 3 with Pillow (`pip install Pillow`). Cross-platform (Windows, Linux, macOS); no network needed.

| File | What it does |
|---|---|
| `mkshim.py` | Turns a design-canvas board (`*.dc.html`) into one self-contained, interactive HTML file. Exposes `window.__comp` (with `setState`) so tests can drive it. Reads `#view=equity&th=daylight` from the address. |
| `build_protos.py` | Builds every standalone prototype in `prototypes/` from `canvas-source/`. |
| `states.js` | The 43 named app states (room plus sub-state) that every audit and screenshot run walks through. |
| `snap.js` | `node snap.js <html-or-url> <outdir> <theme> [audit] [state,state] [width] [height]`: screenshots each state; with `audit` also records every text run (including LTR and RTL clipping), box, and control border. Exits non-zero on page errors. |
| `analyze.py` | `python analyze.py <dir> [light]`: the **theme audit**. Measures real contrast from pixels, finds dark leftovers in light themes, invisible control borders and clipped text. Pass mark: zero (exits `1` if any failure is found). |
| `audit.js` | `node audit.js <html-or-url> [prefix] [width] [height] [static]`: the **layout audit**: overlapping elements, covered text, clipped text (all four edges), text touching a rim, misaligned tabs, small tap targets. Pass mark: zero (exits `1` if any failure is found). |
| `eqexact.py` | Independent exact equity by enumeration, with CLI (`--section8`, `match`, `turn`, `vs-any`). The source of golden numbers. Never replace its output with a typed value. |
| `eqtest.js` | Drives the Equity prototype (typing players, keyboard stepping, errors) and prints the rows for comparison with `eqexact.py`. |
| `extract_tokens.js` | Reads the resolved value of every custom property in each theme from the running prototype. |
| `gen_tokens.py` | Writes `tokens/tokens.css` and `tokens/tokens.json` from that extract. |
| `rl_tokenize.py` | The one-off refactor that moved the app board from literal colours to tokens (kept for the record). |

## Typical runs

```bash
python build_protos.py                                                # rebuild prototypes from ../canvas-source
node snap.js ../prototypes/riverline-app.html out_daylight daylight audit   # screenshots + measurements, 43 states
python analyze.py out_daylight light                                  # theme audit (omit "light" for dark themes)
node audit.js ../prototypes/riverline-app.html a 1440 900             # layout audit
python eqexact.py --section8                                          # JSON golden fixtures for 04_DESIGN_SPEC.md section 8
```

## For the new repo

In F1 (`F1b`), adapt three of these into `tools/` as permanent gates pointed at `vite preview` (`/kit` and the app states) across all 7 themes, 3 languages (`en`, `ru`, `he`), and both viewports (`1920×1080` and `1366×768`):
- `npm run audit:layout` (from `audit.js`)
- `npm run audit:theme` (from `snap.js` + `analyze.py`)
- `npm run golden` (from `eqexact.py --section8`)
- `npm run check:raw` (`repo-seed/tools/check-no-raw-values.mjs`)
