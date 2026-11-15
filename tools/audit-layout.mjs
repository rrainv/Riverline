// Layout audit against production build served by vite preview.
// Usage: node tools/audit-layout.mjs [--no-build] [--room=<room[,room2]>] [--only-new]
import { chromium } from 'playwright';
import { startPreviewServer } from './preview-server.mjs';
import { LOCALES, selectAuditStates, THEMES, VIEWPORTS, waitForSettled } from './f1-states.mjs';

const auditFn = () => {
  const out = [];
  const vw = innerWidth;
  const vh = innerHeight;
  const rootEl = document.getElementById('app') || document.body;
  const activeDialog = document.querySelector('[role="dialog"][aria-modal="true"]');

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

  const name = (e) =>
    (e.className && e.className.baseVal === undefined
      ? '.' + String(e.className).split(' ').filter(Boolean).slice(0, 2).join('.')
      : e.tagName.toLowerCase()) +
    '|' +
    (e.textContent || '').trim().slice(0, 14);

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
    if (r.width < 2 || r.height < 2) continue;
    leaves.push({
      el: p,
      t: t.slice(0, 28),
      r,
      inDialog: activeDialog ? activeDialog.contains(p) : true,
    });
  }

  const findVScroll = (el) => {
    let a = el.parentElement;
    while (a && a !== rootEl && a !== document.body) {
      const cs = getComputedStyle(a);
      if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') return a;
      a = a.parentElement;
    }
    return null;
  };

  for (const L of leaves) {
    L.vScroll = findVScroll(L.el);
  }

  // 1. Clipped text: text rect outside any non-scrollable ancestor, or truncated by overflow:hidden, or outside viewport (LTR + RTL)
  for (const L of leaves) {
    let a = L.el;
    let clipped = false;
    let why = '';
    while (a && a !== rootEl && a !== document.body) {
      const cs = getComputedStyle(a);
      if (
        cs.overflowY === 'auto' ||
        cs.overflowY === 'scroll' ||
        cs.overflowX === 'auto' ||
        cs.overflowX === 'scroll'
      ) {
        break;
      }
      if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const ar = a.getBoundingClientRect();
        if (
          L.r.right > ar.right + 2 ||
          L.r.left < ar.left - 2 ||
          L.r.bottom > ar.bottom + 2 ||
          L.r.top < ar.top - 2
        ) {
          clipped = true;
          why = 'clipped by ' + name(a);
          break;
        }
        if (
          (cs.overflowX === 'hidden' || cs.overflowX === 'clip') &&
          a.clientWidth > 0 &&
          a.scrollWidth > a.clientWidth + 2
        ) {
          clipped = true;
          why = 'ellipsis/overflow in ' + name(a);
          break;
        }
      }
      a = a.parentElement;
    }
    if (!clipped) {
      if (L.vScroll) {
        const sr = L.vScroll.getBoundingClientRect();
        if (L.r.right > vw + 1 || L.r.left < -1 || sr.top < -1 || sr.bottom > vh + 1) {
          clipped = true;
          why = 'outside viewport';
        }
      } else if (L.r.right > vw + 1 || L.r.bottom > vh + 1 || L.r.left < -1 || L.r.top < -1) {
        clipped = true;
        why = 'outside viewport';
      }
    }
    if (clipped) out.push({ kind: 'clip', text: L.t, why });
  }

  // 2. Text overlaps between unrelated elements in the active layer
  const visibleRectInScroll = (L) => {
    if (!L.vScroll) return L.r;
    const sr = L.vScroll.getBoundingClientRect();
    return {
      left: Math.max(L.r.left, sr.left),
      right: Math.min(L.r.right, sr.right),
      top: Math.max(L.r.top, sr.top),
      bottom: Math.min(L.r.bottom, sr.bottom),
    };
  };
  const activeLeaves = activeDialog ? leaves.filter((L) => L.inDialog) : leaves;
  for (let i = 0; i < activeLeaves.length; i++) {
    for (let j = i + 1; j < activeLeaves.length; j++) {
      const A = activeLeaves[i];
      const B = activeLeaves[j];
      if (A.el.contains(B.el) || B.el.contains(A.el) || A.el === B.el) continue;
      const ar = A.vScroll && A.vScroll === B.vScroll ? A.r : visibleRectInScroll(A);
      const br = A.vScroll && A.vScroll === B.vScroll ? B.r : visibleRectInScroll(B);
      if (ar.right <= ar.left || ar.bottom <= ar.top || br.right <= br.left || br.bottom <= br.top) {
        continue;
      }
      const x = Math.min(ar.right, br.right) - Math.max(ar.left, br.left);
      const y = Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top);
      if (x > 3 && y > 3 && x * y > 24) {
        out.push({ kind: 'overlap', text: A.t + ' / ' + B.t, area: Math.round(x * y) });
      }
    }
  }

  // 3. Tab text off-centre
  document.querySelectorAll('[role="tab"], [class*="tab"]').forEach((b) => {
    if (!vis(b)) return;
    if (activeDialog && !activeDialog.contains(b)) return;
    const rg = document.createRange();
    rg.selectNodeContents(b);
    const tr = rg.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const d = Math.abs((tr.left + tr.right) / 2 - (br.left + br.right) / 2);
    if (br.width > 40 && d > 5) {
      out.push({ kind: 'tab-offcentre', text: (b.textContent || '').trim().slice(0, 20), off: Math.round(d) });
    }
  });

  // 4. Small tap / click targets (40px on narrow viewports, 28px on desktop matching --h-chip)
  const minTarget = vw < 600 ? 40 : 28;
  document
    .querySelectorAll('button, a[href], input, select, [role="button"], [role="option"]')
    .forEach((b) => {
      if (!vis(b)) return;
      if (activeDialog && !activeDialog.contains(b)) return;
      if (b.getAttribute('tabindex') === '-1' && b.getBoundingClientRect().width >= vw * 0.9) return;
      const r = b.getBoundingClientRect();
      if (r.height < minTarget || r.width < minTarget) {
        out.push({
          kind: 'small-target',
          text: (b.textContent || b.getAttribute('aria-label') || b.tagName).trim().slice(0, 24),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    });

  // 5. Text covered by an unrelated element on top of it (scoped to active layer)
  for (const L of activeLeaves) {
    const sr = L.vScroll ? L.vScroll.getBoundingClientRect() : null;
    const minY = sr ? Math.max(0, sr.top) : 0;
    const maxY = sr ? Math.min(vh, sr.bottom) : vh;
    const pts = [
      [(L.r.left + L.r.right) / 2, (L.r.top + L.r.bottom) / 2],
      [L.r.left + 3, (L.r.top + L.r.bottom) / 2],
      [L.r.right - 3, (L.r.top + L.r.bottom) / 2],
    ];
    let hit = 0;
    let who = '';
    for (const [x, y] of pts) {
      if (x < 0 || x > vw || y < minY || y > maxY) continue;
      const top = document.elementFromPoint(x, y);
      if (top && top !== L.el && !L.el.contains(top) && !top.contains(L.el)) {
        hit++;
        who = name(top);
      }
    }
    if (hit >= 2) out.push({ kind: 'covered', text: L.t, by: who });
  }

  // 6. Text sitting on the gold table rim
  const ovals = [...document.querySelectorAll('div')].filter((d) => {
    const cs = getComputedStyle(d);
    return cs.borderRadius.indexOf('999') >= 0 && cs.boxShadow.indexOf('191, 169, 101') >= 0;
  });
  const hasBg = (e) => {
    let a = e;
    let k = 0;
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
    const r = o.getBoundingClientRect();
    const cx = (r.left + r.right) / 2;
    const cy = (r.top + r.bottom) / 2;
    const rx = r.width / 2;
    const ry = r.height / 2;
    const th = 13;
    const irx = rx - th;
    const iry = ry - th;
    for (const L of activeLeaves) {
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

async function run() {
  const noBuild = process.argv.includes('--no-build');
  const { states: selectedStates, isFiltered } = selectAuditStates(process.argv.slice(2));
  const preview = await startPreviewServer({ build: !noBuild });
  const browser = await chromium.launch();
  const failures = [];
  const pageErrors = [];
  let checkedStates = 0;

  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: vp });
      page.on('pageerror', (err) => pageErrors.push(`${vp.width}x${vp.height}: ${err.message}`));

      if (!isFiltered) {
        // Verify URL query override boot + Ctrl+K / Escape keyboard flow at this viewport
        await page.goto(
          `${preview.url}/?room=settings&theme=daylight&lang=he&rail=collapsed&focus=0`,
          { waitUntil: 'networkidle' },
        );
        await waitForSettled(page);
        const queryState = await page.evaluate(() => ({
          testState: window.__riverlineTest?.getState(),
          dir: document.documentElement.dir,
          theme: document.documentElement.dataset.theme,
          lang: document.documentElement.lang,
        }));
        if (
          queryState.testState?.room !== 'settings' ||
          queryState.testState?.theme !== 'daylight' ||
          queryState.testState?.lang !== 'he' ||
          queryState.testState?.railCollapsed !== true ||
          queryState.dir !== 'rtl' ||
          queryState.theme !== 'daylight' ||
          queryState.lang !== 'he'
        ) {
          failures.push({
            scope: `${vp.width}x${vp.height} query_boot`,
            defects: [{ kind: 'state-mismatch', details: queryState }],
          });
        }

        // Keyboard Ctrl+K open & Escape close
        await page.keyboard.press('Control+k');
        await waitForSettled(page);
        const openedByKey = await page.evaluate(() => Boolean(window.__riverlineTest?.getState().paletteOpen));
        if (!openedByKey) {
          failures.push({
            scope: `${vp.width}x${vp.height} keyboard_palette_open`,
            defects: [{ kind: 'keyboard', text: 'Ctrl+K did not open palette' }],
          });
        }
        await page.keyboard.press('Escape');
        await waitForSettled(page);
        const closedByKey = await page.evaluate(() => window.__riverlineTest?.getState().paletteOpen === false);
        if (!closedByKey) {
          failures.push({
            scope: `${vp.width}x${vp.height} keyboard_palette_close`,
            defects: [{ kind: 'keyboard', text: 'Escape did not close palette' }],
          });
        }
      } else {
        await page.goto(preview.url, { waitUntil: 'networkidle' });
        await waitForSettled(page);
      }

      // Daily slice sweep matrix: all selected states for all 7 EN themes + RU/HE in midnight & daylight;
      // kit_* states across remaining theme/locale pairs.
      const fullSet = new Set([
        'en|midnight',
        'en|felt',
        'en|slate',
        'en|dusk',
        'en|contrast',
        'en|daylight',
        'en|paper',
        'ru|midnight',
        'ru|daylight',
        'he|midnight',
        'he|daylight',
      ]);
      for (const theme of THEMES) {
        for (const lang of LOCALES) {
          const isFull = fullSet.has(`${lang}|${theme}`);
          const statesForPair = isFull
            ? selectedStates
            : selectedStates.filter((st) => st.label.startsWith('kit_'));
          if (statesForPair.length === 0) continue;
          for (const st of statesForPair) {
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

            const expectedDir = lang === 'he' ? 'rtl' : 'ltr';
            const domCheck = await page.evaluate(() => ({
              dir: document.documentElement.dir,
              theme: document.documentElement.dataset.theme,
              lang: document.documentElement.lang,
            }));
            const defects = await page.evaluate(auditFn);
            if (domCheck.dir !== expectedDir || domCheck.theme !== theme || domCheck.lang !== lang) {
              defects.push({ kind: 'dom-attr-mismatch', expected: { expectedDir, theme, lang }, domCheck });
            }

            checkedStates++;
            if (defects.length > 0) {
              failures.push({
                scope: `${vp.width}x${vp.height} ${theme} ${lang} ${st.label}`,
                defects,
              });
            }
          }
        }
      }

      await page.close();
    }
  } finally {
    await browser.close();
    await preview.close();
  }

  console.log(
    `audit:layout checked ${checkedStates} states across ${THEMES.length} themes x ${LOCALES.length} languages x ${VIEWPORTS.length} viewports | failures: ${failures.length} | page errors: ${pageErrors.length}`,
  );
  for (const f of failures.slice(0, 25)) {
    console.error(`  FAIL [${f.scope}] (${f.defects.length}):`);
    for (const d of f.defects.slice(0, 8)) {
      console.error('   ', JSON.stringify(d));
    }
  }
  if (pageErrors.length > 0) {
    console.error('  PAGE ERRORS:', JSON.stringify(pageErrors));
  }

  if (failures.length > 0 || pageErrors.length > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('audit:layout fatal:', err);
  process.exit(1);
});
