// node snap.js <html-or-url> <outdir> <theme> [audit] [state,state] [width] [height] : screenshots (+ audit JSON) for every state
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { walk } = require('./states.js');

const [, , file, out, theme, mode, onlyArg, wArg, hArg] = process.argv;
const vw = +(wArg || 1440);
const vh = +(hArg || 900);
const toUrl = (target) => (/^https?:\/\/|^file:\/\//i.test(target) ? target : pathToFileURL(path.resolve(target)).href);

const collect = () => {
  const rootEl = document.getElementById('app') || document.body;
  const vis = (e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    if (!(r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05)) return false;
    let a = e.parentElement;
    while (a && a !== rootEl && a !== document.body) {
      if (+getComputedStyle(a).opacity < 0.05) return false;
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
    let dis = false, a = p, op = 1;
    while (a && a !== rootEl && a !== document.body) {
      if (a.disabled) dis = true;
      op *= +getComputedStyle(a).opacity;
      a = a.parentElement;
    }
    const cx = Math.min(innerWidth - 1, Math.max(0, (r.left + r.right) / 2));
    const cy = Math.min(innerHeight - 1, Math.max(0, (r.top + r.bottom) / 2));
    const top = document.elementFromPoint(cx, cy);
    const covered = !(top && (top === p || p.contains(top) || top.contains(p)));
    let clipped = false;
    a = p;
    while (a && a !== rootEl && a !== document.body) {
      const c2 = getComputedStyle(a);
      if (c2.overflowY === 'auto' || c2.overflowY === 'scroll' || c2.overflowX === 'auto' || c2.overflowX === 'scroll') break;
      if (c2.overflow !== 'visible' || c2.overflowY !== 'visible' || c2.overflowX !== 'visible') {
        const ar = a.getBoundingClientRect();
        // Check all four edges so both LTR (right edge) and RTL Hebrew (left edge) horizontal clipping are caught
        if (r.bottom > ar.bottom + 2 || r.top < ar.top - 2 || r.right > ar.right + 2 || r.left < ar.left - 2) {
          clipped = true;
          break;
        }
      }
      a = a.parentElement;
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
  const boxes = [], borders = [];
  rootEl.querySelectorAll('*').forEach((e) => {
    if (e.closest('svg') || !vis(e)) return;
    const r = e.getBoundingClientRect();
    if (r.width < 14 || r.height < 14 || r.width > 1300) return;
    const cs = getComputedStyle(e);
    const m = cs.backgroundColor.match(/[\d.]+/g) || [];
    const al = m.length > 3 ? +m[3] : 1;
    const hasBg = (m.length >= 3 && al > 0.35) || cs.backgroundImage !== 'none';
    if (hasBg) boxes.push({ x: r.left, y: r.top, w: r.width, h: r.height, path: elPath(e), bi: cs.backgroundImage !== 'none' });
    const bw = parseFloat(cs.borderLeftWidth);
    const bcm = cs.borderLeftColor.match(/[\d.]+/g) || [];
    const bal = bcm.length > 3 ? +bcm[3] : 1;
    const tp = document.elementFromPoint(Math.max(0, r.left + 2), r.top + r.height / 2);
    const bcov = !(tp && (tp === e || e.contains(tp)));
    if (bal > 0.05 && !bcov && +cs.opacity > 0.9 && bw >= 1 && cs.borderLeftStyle !== 'none' && /^(button|input)$/i.test(e.tagName) && !e.disabled) {
      borders.push({ x: r.left, y: r.top, w: r.width, h: r.height, bw, path: elPath(e), t: (e.textContent || '').trim().slice(0, 24) });
    }
  });
  return { leaves, boxes, borders };
};

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(toUrl(file));
  await page.waitForTimeout(700);
  await walk(
    page,
    theme,
    async (label) => {
      await page.screenshot({ path: `${out}/${label}.png` });
      if (mode === 'audit') fs.writeFileSync(`${out}/${label}.json`, JSON.stringify(await page.evaluate(collect)), 'utf8');
    },
    onlyArg ? onlyArg.split(',') : null
  );
  console.log(theme, 'done; page errors:', JSON.stringify(errs));
  await browser.close();
  if (errs.length > 0) process.exit(1);
})().catch((e) => {
  console.error('FAIL', e.message.split('\n')[0]);
  process.exit(1);
});
