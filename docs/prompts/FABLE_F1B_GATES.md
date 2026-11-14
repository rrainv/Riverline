# Fable 5.2 session F1b: Visual Audit Harness, Golden Harness, and CI

**Paste everything below the line into a new session opened in the new repository** (after F1a). One session, one outcome.

---

You are completing the Foundation (F1b) of **Riverline**. Read `AGENTS.md`, `docs/STATE.md`, `docs/handoff/04_DESIGN_SPEC.md` (sections 2.6, 3.3, 8), and `docs/design/tools/README.md`.

## Outcome of this session
All five permanent repository gates (`typecheck`, `test`, `check:raw`, `audit:layout`, `audit:theme`, plus `golden`) wired up, running against the production build (`vite preview`), and passing with zero across all seven themes, all three languages (`en`, `ru`, `he`), and both target desktop viewports (`1920×1080` and `1366×768`), with a GitHub Actions CI workflow enforcing them on push.

## Build
1. **Layout audit (`npm run audit:layout`):** adapt `docs/design/tools/audit.js` into `tools/audit-layout.mjs` driving the real app served by `vite preview` via Playwright and `window.__riverlineTest` / URL parameters. Walk every F1 shell state (each room's empty state, Ctrl K palette open, rail collapsed, focus mode, Settings Appearance) across all seven themes, all three languages (`en`, `ru`, `he`), and both viewports (`1920×1080` and `1366×768`). Check: clipped text (all four edges, including RTL left-edge clipping in Hebrew), overlapping text, covered text, rim text, tab alignment, small tap targets, and page errors. Exit code `1` on any defect.
2. **Theme audit (`npm run audit:theme`):** adapt `docs/design/tools/snap.js` and `docs/design/tools/analyze.py` into `tools/` so Playwright captures screenshots + text/box/border geometry JSON for the active states across all seven themes (Midnight, Felt, Slate, Dusk, Contrast, Daylight, Paper) and `analyze.py` verifies pixel-measured contrast (4.5:1 normal, 3.0:1 large), no dark leftovers in Daylight/Paper, no invisible control borders, and zero clipped text. Pass mark: zero (exits `1` on any failure).
3. **Golden numbers harness (`npm run golden`):** wire `python tools/eqexact.py --section8` to generate/verify `tools/golden/section8.golden.json` and run a Vitest golden check that validates the fixture schema and exact values from `docs/handoff/04_DESIGN_SPEC.md` section 8 (ready for the engine port in F3 to assert against).
4. **Fix any shell/theme/i18n defects** caught by `audit:layout` or `audit:theme` in any of the 7 themes, 3 languages, or 2 viewports until every gate reports zero.
5. **Continuous integration (`.github/workflows/ci.yml`):** one workflow running on push and pull_request (Node 22+, Python 3 + Pillow, Playwright Chromium) that executes `npm run typecheck`, `npm test`, `npm run golden`, `npm run check:raw`, `npm run audit:layout`, and `npm run audit:theme`.
6. **`docs/STATE.md`:** updated truthfully with the exact command and output of all gates.

## Do not
- Do not copy any code from the old repository.
- Do not weaken any audit threshold to make a failure pass; fix the layout or token instead.

## Before you write code
Reply with: (1) any risks you see in the audit setup; (2) questions for the owner; (3) your ten-line plan. Wait for the owner's reply.

## Finish with
A five-line report: what works; each gate's command and output; what is not done; anything logged in the bug inbox; the one decision you need from the owner.
