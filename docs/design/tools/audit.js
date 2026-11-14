// Layout audit: clipped text (including RTL left-edge clip), overlapping text, tab alignment, small tap targets, covered text, rim text.
// Usage: node audit.js <file-or-url> [prefix] [width] [height] [static]
const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');

const file = process.argv[2];
const prefix = process.argv[3] || 'a';
const w = +(process.argv[4] || 1440);
const h = +(process.argv[5] || 900);
const toUrl = (target) => (/^https?:\/\/|^file:\/\//i.test(target) ? target : pathToFileURL(path.resolve(target)).href);

const auditFn = () => {
  const out = [];
  const vw = innerWidth, vh = innerHeight;
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
  const leaves = [];
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent.trim();
    if (!t) continue;
    const p = n.parentElement;
    if (!p || !vis(p)) continue;
    const rg = document.createRange();
    rg.selectNodeContents(n);
    const r = rg.getBoundingClientRect();
    if (r.width < 2) continue;
    leaves.push({ el: p, t: t.slice(0, 28), r });
  }
  const name = (e) =>
    (e.className && e.className.baseVal === undefined
      ? '.' + String(e.className).split(' ').filter(Boolean).slice(0, 2).join('.')
      : e.tagName.toLowerCase()) +
    '|' +
    (e.textContent || '').trim().slice(0, 14);

  // 1 clipped text: text rect outside any ancestor with overflow hidden/clip, or outside viewport (both LTR right and RTL left)
  for (const L of leaves) {
    let a = L.el;
    let clipped = false, why = '';
    while (a && a !== rootEl && a !== document.body) {
      const cs = getComputedStyle(a);
      if (cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowX === 'auto' || cs.overflowX === 'scroll') break;
      if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const ar = a.getBoundingClientRect();
        if (L.r.right > ar.right + 2 || L.r.left < ar.left - 2 || L.r.bottom > ar.bottom + 2 || L.r.top < ar.top - 2) {
          clipped = true;
          why = 'clipped by ' + name(a);
          break;
        }
      }
      a = a.parentElement;
    }
    if (L.r.right > vw + 1 || L.r.bottom > vh + 1 || L.r.left < -1) {
      clipped = true;
      why = 'outside viewport';
    }
    if (clipped) out.push({ kind: 'clip', text: L.t, why });
  }

  // 2 text overlaps between unrelated elements
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const A = leaves[i], B = leaves[j];
      if (A.el.contains(B.el) || B.el.contains(A.el) || A.el === B.el) continue;
      const x = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
      const y = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
      if (x > 3 && y > 3 && x * y > 24) out.push({ kind: 'overlap', text: A.t + ' / ' + B.t, area: Math.round(x * y) });
    }
  }

  // 3 tab text off-centre
  document.querySelectorAll('[class*="tab"]').forEach((b) => {
    if (!vis(b)) return;
    const rg = document.createRange();
    rg.selectNodeContents(b);
    const tr = rg.getBoundingClientRect(), br = b.getBoundingClientRect();
    const d = Math.abs((tr.left + tr.right) / 2 - (br.left + br.right) / 2);
    if (br.width > 40 && d > 5) out.push({ kind: 'tab-offcentre', text: b.textContent.trim().slice(0, 20), off: Math.round(d) });
  });

  // 4 small tap targets
  if (vw < 600) {
    document.querySelectorAll('button').forEach((b) => {
      if (!vis(b)) return;
      const r = b.getBoundingClientRect();
      if (r.height < 34) out.push({ kind: 'small-target', text: b.textContent.trim().slice(0, 20), h: Math.round(r.height) });
    });
  }

  // 5 text covered by an unrelated element on top of it
  for (const L of leaves) {
    const pts = [
      [(L.r.left + L.r.right) / 2, (L.r.top + L.r.bottom) / 2],
      [L.r.left + 3, (L.r.top + L.r.bottom) / 2],
      [L.r.right - 3, (L.r.top + L.r.bottom) / 2],
    ];
    let hit = 0, who = '';
    for (const [x, y] of pts) {
      if (x < 0 || y < 0 || x > vw || y > vh) continue;
      const top = document.elementFromPoint(x, y);
      if (top && top !== L.el && !L.el.contains(top) && !top.contains(L.el)) {
        hit++;
        who = name(top);
      }
    }
    if (hit >= 2) out.push({ kind: 'covered', text: L.t, by: who });
  }

  // 6 text sitting on the gold table rim
  const ovals = [...document.querySelectorAll('div')].filter((d) => {
    const cs = getComputedStyle(d);
    return cs.borderRadius.indexOf('999') >= 0 && cs.boxShadow.indexOf('191, 169, 101') >= 0;
  });
  const hasBg = (e) => {
    let a = e, k = 0;
    while (a && k < 4) {
      if (getComputedStyle(a).backgroundImage !== 'none') return true;
      const c = getComputedStyle(a).backgroundColor;
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const p = m[1].split(',').map(Number);
        const al = p.length > 3 ? p[3] : 1;
        if (al > 0.5) return true;
      }
      a = a.parentElement;
      k++;
    }
    return false;
  };
  for (const o of ovals) {
    const r = o.getBoundingClientRect(),
      cx = (r.left + r.right) / 2,
      cy = (r.top + r.bottom) / 2,
      rx = r.width / 2,
      ry = r.height / 2,
      th = 13,
      irx = rx - th,
      iry = ry - th;
    for (const L of leaves) {
      if (hasBg(L.el)) continue;
      const pts = [
        [L.r.left, L.r.top],
        [L.r.right, L.r.top],
        [L.r.left, L.r.bottom],
        [L.r.right, L.r.bottom],
        [(L.r.left + L.r.right) / 2, (L.r.top + L.r.bottom) / 2],
      ];
      for (const [x, y] of pts) {
        const dOut = (x - cx) ** 2 / rx ** 2 + (y - cy) ** 2 / ry ** 2;
        const dIn = (x - cx) ** 2 / irx ** 2 + (y - cy) ** 2 / iry ** 2;
        if (dOut <= 1.03 && dIn >= 0.96) {
          out.push({ kind: 'on-rim', text: L.t });
          break;
        }
      }
    }
  }
  return out;
};

(async () => {
  if (!file) {
    console.error('Usage: node audit.js <file-or-url> [prefix] [width] [height] [static]');
    process.exit(2);
  }
  const targetUrl = toUrl(file);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const W = (ms = 500) => page.waitForTimeout(ms);
  const nav = async (t) => {
    await page.locator('nav.dock button', { hasText: t }).click();
    await W(900);
  };
  const states = [];
  const rec = async (label) => {
    const r = await page.evaluate(auditFn);
    states.push([label, r]);
  };
  if (process.argv[6] === 'static') {
    await page.goto(targetUrl);
    await W(1200);
    await rec('static');
  } else if (w < 600) {
    await page.goto(targetUrl);
    await W(700);
    await rec('phone ledger');
    await page.locator('button.pmain').first().click();
    await W(500);
    await rec('phone sheet');
    await page.locator('.sheet button.chipb2', { hasText: 'Done' }).click();
    await W(300);
    await page.locator('button.ptab', { hasText: 'Hands' }).click();
    await W(500);
    await rec('phone hands');
    await page.locator('button.ptab', { hasText: 'Settle' }).click();
    await W(500);
    await rec('phone settle');
  } else {
    await page.goto(targetUrl);
    await W(900);
    await rec('home coach');
    await nav('Training');
    await rec('hub');
    await page.locator('button.seatd', { hasText: 'Quick drill' }).click();
    await W(600);
    await page.locator('button.tk', { hasText: 'Raise' }).click();
    await W(300);
    await page.locator('button.btn', { hasText: 'Confirm' }).click();
    await W(1000);
    await rec('drill answered');
    await nav('Strategy');
    await rec('strategy');
    await nav('Equity');
    await page.locator('button.tc').nth(3).click();
    await W(600);
    await rec('equity');
    await nav('Review');
    await rec('review');
    await page.locator('button', { hasText: 'Share this hand' }).click();
    await W(700);
    await rec('card');
    await nav('Hand');
    await page.locator('button', { hasText: 'Everyone else folds' }).click();
    await W(300);
    await page.locator('button.tk', { hasText: 'Raise to' }).click();
    await W(300);
    await rec('recorder');
    await nav('Training');
    await page.locator('button.seatd', { hasText: 'Labs' }).click();
    await W(800);
    await rec('scan where');
    await page.locator('button.optd', { hasText: 'Home game' }).click();
    await W(500);
    await rec('scan q1');
    for (const a of ['Always', 'Always', 'Sometimes', 'Never', 'Never', 'Always']) {
      await page.locator('button.tk', { hasText: a }).first().click();
      await W(250);
    }
    await W(800);
    await rec('scan result');
    await nav('Training');
    await page.locator('button.seatd', { hasText: 'Heads-up duel' }).click();
    await W(500);
    await rec('duel pre');
    await page.locator('button.tk', { hasText: 'Raise to' }).click();
    await W(200);
    await page.locator('button.btn', { hasText: 'Confirm' }).click();
    await W(2500);
    await rec('duel thinking');
    await W(7000);
    await page.locator('button.tk', { hasText: 'Bet' }).click();
    await W(300);
    await rec('duel flop');
    await page.locator('button.btn2', { hasText: 'End the session' }).click();
    await W(1000);
    await rec('report');
    await nav('Training');
    await page.locator('button.seatd', { hasText: 'Full hand' }).click();
    await W(7600);
    await rec('full hero turn');
    await nav('Home');
    await page.locator('button', { hasText: 'read the letter' }).click();
    await W(800);
    await rec('letter');
  }
  const seen = new Set();
  let totalFailures = 0;
  for (const [label, r] of states) {
    const items = r.filter((x) => {
      const k = label + x.kind + x.text;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    totalFailures += items.length;
    console.log('## ' + label + ' (' + items.length + ')');
    items.slice(0, 14).forEach((x) => console.log('  ', JSON.stringify(x)));
  }
  console.log('page errors:', JSON.stringify(errs));
  await browser.close();
  if (totalFailures > 0 || errs.length > 0) process.exit(1);
})().catch((e) => {
  console.error('FAIL', e.message.split('\n')[0]);
  process.exit(1);
});
