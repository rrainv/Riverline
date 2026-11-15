// Theme audit against production build served by vite preview.
// Captures screenshots + geometry JSON and runs tools/analyze-theme.py per theme/locale/viewport.
// Usage: node tools/audit-theme.mjs [--no-build]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startPreviewServer } from './preview-server.mjs';
import { F1_STATES, LIGHT_THEMES, LOCALES, THEMES, VIEWPORTS, waitForSettled } from './f1-states.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_ROOT = path.join(ROOT_DIR, '.tmp', 'audit-theme');
const ANALYZE_PY = path.join(ROOT_DIR, 'tools', 'analyze-theme.py');

const collectFn = () => {
  const rootEl = document.getElementById('app') || document.body;
  const vis = (e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    if (
      !(
        r.width > 1 &&
        r.height > 1 &&
        cs.visibility !== 'hidden' &&
        cs.display !== 'none' &&
        +cs.opacity > 0.05
      )
    ) {
      return false;
    }
    let a = e.parentElement;
    while (a && a !== rootEl && a !== document.body) {
      const acs = getComputedStyle(a);
      if (acs.visibility === 'hidden' || acs.display === 'none' || +acs.opacity < 0.05) {
        return false;
      }
      a = a.parentElement;
    }
    return true;
  };
  const nm = (e) => {
    let s = e.tagName.toLowerCase();
    const c = e.getAttribute('class');
    if (c) s += '.' + c.trim().split(/\s+/).slice(0, 3).join('.');
    return s;
  };
  const elPath = (e) => {
    const a = [];
    let x = e;
    for (let i = 0; i < 3 && x && x !== rootEl && x !== document.body; i++) {
      a.unshift(nm(x));
      x = x.parentElement;
    }
    return a.join(' > ');
  };

  const findVScroll = (el) => {
    let a = el.parentElement;
    while (a && a !== rootEl && a !== document.body) {
      const c2 = getComputedStyle(a);
      if (c2.overflowY === 'auto' || c2.overflowY === 'scroll') return a;
      a = a.parentElement;
    }
    return null;
  };

  const leaves = [];
  const w = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = n.textContent.trim();
    if (!t) continue;
    const p = n.parentElement;
    if (!p || !vis(p) || p.closest('svg')) continue;
    const rg = document.createRange();
    rg.selectNodeContents(n);
    const r = rg.getBoundingClientRect();
    if (r.width < 3 || r.height < 5) continue;
    if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
    const cs = getComputedStyle(p);
    let dis = false;
    let a = p;
    let op = 1;
    while (a && a !== rootEl && a !== document.body) {
      if (a.disabled) dis = true;
      op *= +getComputedStyle(a).opacity;
      a = a.parentElement;
    }
    const vScroll = findVScroll(p);
    const sr = vScroll ? vScroll.getBoundingClientRect() : null;
    const outOfScrollVert = Boolean(sr && (r.bottom > sr.bottom - 1 || r.top < sr.top + 1));
    const cx = Math.min(innerWidth - 1, Math.max(0, (r.left + r.right) / 2));
    const cy = Math.min(innerHeight - 1, Math.max(0, (r.top + r.bottom) / 2));
    const top = document.elementFromPoint(cx, cy);
    const covered = outOfScrollVert || !(top && (top === p || p.contains(top) || top.contains(p)));
    let clipped = false;
    a = p;
    while (a && a !== rootEl && a !== document.body) {
      const c2 = getComputedStyle(a);
      if (
        c2.overflowY === 'auto' ||
        c2.overflowY === 'scroll' ||
        c2.overflowX === 'auto' ||
        c2.overflowX === 'scroll'
      ) {
        break;
      }
      if (c2.overflow !== 'visible' || c2.overflowY !== 'visible' || c2.overflowX !== 'visible') {
        const ar = a.getBoundingClientRect();
        if (
          r.bottom > ar.bottom + 2 ||
          r.top < ar.top - 2 ||
          r.right > ar.right + 2 ||
          r.left < ar.left - 2
        ) {
          clipped = true;
          break;
        }
        if (
          (c2.overflowX === 'hidden' || c2.overflowX === 'clip') &&
          a.clientWidth > 0 &&
          a.scrollWidth > a.clientWidth + 2
        ) {
          clipped = true;
          break;
        }
      }
      a = a.parentElement;
    }
    if (!clipped) {
      if (sr) {
        if (r.right > innerWidth + 1 || r.left < -1 || sr.top < -1 || sr.bottom > innerHeight + 1) {
          clipped = true;
        }
      } else if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1) {
        clipped = true;
      }
    }
    leaves.push({
      covered,
      clipped,
      t: t.slice(0, 40),
      x: r.left,
      y: r.top,
      w: r.width,
      h: r.height,
      fs: parseFloat(cs.fontSize),
      fw: +cs.fontWeight || 400,
      dis,
      op,
      path: elPath(p),
    });
  }

  const boxes = [];
  const borders = [];
  rootEl.querySelectorAll('*').forEach((e) => {
    if (e.closest('svg') || !vis(e)) return;
    const r = e.getBoundingClientRect();
    if (r.width < 14 || r.height < 14 || r.width > 1300) return;
    const cs = getComputedStyle(e);
    const m = cs.backgroundColor.match(/[\d.]+/g) || [];
    const al = m.length > 3 ? +m[3] : 1;
    const hasBg = (m.length >= 3 && al > 0.35) || cs.backgroundImage !== 'none';
    if (hasBg) {
      boxes.push({
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        path: elPath(e),
        bi: cs.backgroundImage !== 'none',
        allow: Boolean(e.closest('[data-audit-allow]')),
      });
    }
    const vs = findVScroll(e);
    const vsr = vs ? vs.getBoundingClientRect() : null;
    const outVScroll = Boolean(vsr && (r.top + r.height / 2 > vsr.bottom - 1 || r.top + r.height / 2 < vsr.top + 1));
    const bw = parseFloat(cs.borderLeftWidth);
    const bcm = cs.borderLeftColor.match(/[\d.]+/g) || [];
    const bal = bcm.length > 3 ? +bcm[3] : 1;
    const tp = document.elementFromPoint(Math.max(0, r.left + 2), r.top + r.height / 2);
    const bcov = outVScroll || !(tp && (tp === e || e.contains(tp)));
    if (
      bal > 0.05 &&
      !bcov &&
      +cs.opacity > 0.9 &&
      bw >= 1 &&
      cs.borderLeftStyle !== 'none' &&
      /^(button|input)$/i.test(e.tagName) &&
      !e.disabled
    ) {
      borders.push({
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        bw,
        path: elPath(e),
        t: (e.textContent || '').trim().slice(0, 24),
      });
    }
  });

  return { leaves, boxes, borders };
};

function buildSweepTargets() {
  const fullSet = new Set(['en|midnight', 'en|felt', 'en|slate', 'en|dusk', 'en|contrast', 'en|daylight', 'en|paper', 'ru|midnight', 'ru|daylight', 'he|midnight', 'he|daylight']);
  const targets = [];
  for (const theme of THEMES) {
    for (const lang of LOCALES) {
      const isFull = fullSet.has(`${lang}|${theme}`);
      targets.push({
        theme,
        lang,
        states: isFull ? F1_STATES : F1_STATES.filter((st) => st.label.startsWith('kit_')),
      });
    }
  }
  return targets;
}

function resolvePython() {
  for (const cmd of process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) {
    const probe = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
    if (probe.status === 0) return cmd;
  }
  throw new Error('Python 3 interpreter not found on PATH');
}

async function run() {
  const noBuild = process.argv.includes('--no-build');
  const pythonCmd = resolvePython();
  fs.rmSync(OUT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(OUT_ROOT, { recursive: true });

  const preview = await startPreviewServer({ build: !noBuild });
  const browser = await chromium.launch();
  const pageErrors = [];
  const capturedRuns = [];

  try {
    const sweepTargets = buildSweepTargets();
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: vp });
      page.on('pageerror', (err) => pageErrors.push(`${vp.width}x${vp.height}: ${err.message}`));
      await page.goto(preview.url, { waitUntil: 'networkidle' });
      await waitForSettled(page);

      for (const { theme, lang, states } of sweepTargets) {
        const dir = path.join(OUT_ROOT, `${vp.width}x${vp.height}_${theme}_${lang}`);
        fs.mkdirSync(dir, { recursive: true });

        for (const st of states) {
          await page.evaluate(
            ({ theme, lang, patch }) => {
              window.__riverlineTest.setState({
                ...patch,
                theme,
                lang,
                motion: 'reduced',
              });
            },
            { theme, lang, patch: st.patch },
          );
          await waitForSettled(page);
          await page.screenshot({ path: path.join(dir, `${st.label}.png`) });
          const data = await page.evaluate(collectFn);
          fs.writeFileSync(path.join(dir, `${st.label}.json`), JSON.stringify(data), 'utf8');
        }

        capturedRuns.push({
          label: `${vp.width}x${vp.height} ${theme} ${lang}`,
          dir,
          light: LIGHT_THEMES.has(theme),
        });
      }

      await page.close();
    }
  } finally {
    await browser.close();
    await preview.close();
  }

  let analyzeFailures = 0;
  for (const runInfo of capturedRuns) {
    const args = [ANALYZE_PY, runInfo.dir];
    if (runInfo.light) args.push('light');
    const res = spawnSync(pythonCmd, args, { encoding: 'utf8' });
    const summaryLine = (res.stdout || '').trim().split(/\r?\n/)[0] || '';
    console.log(`[${runInfo.label}] ${summaryLine}`);
    if (res.status !== 0) {
      analyzeFailures++;
      if (res.stdout) console.error(res.stdout.trim());
      if (res.stderr) console.error(res.stderr.trim());
    }
  }

  if (pageErrors.length > 0) {
    console.error('audit:theme page errors:', JSON.stringify(pageErrors));
  }
  console.log(
    `audit:theme runs: ${capturedRuns.length} | failed runs: ${analyzeFailures} | page errors: ${pageErrors.length}`,
  );

  if (analyzeFailures > 0 || pageErrors.length > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('audit:theme fatal:', err);
  process.exit(1);
});
