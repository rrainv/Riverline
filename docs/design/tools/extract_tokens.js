// node extract_tokens.js <html-or-url> <out.json> : resolved value of every custom property on .root, per theme
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const [, , file, out] = process.argv;
const toUrl = (target) => (/^https?:\/\/|^file:\/\//i.test(target) ? target : pathToFileURL(path.resolve(target)).href);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(toUrl(file));
  await p.waitForTimeout(400);
  const res = {};
  for (const th of ['midnight', 'felt', 'slate', 'dusk', 'contrast', 'daylight', 'paper']) {
    await p.evaluate((th) => window.__comp.setState({ th, acc: null, view: 'home' }), th);
    await p.waitForTimeout(150);
    res[th] = await p.evaluate(() => {
      const root = document.querySelector('.root') || document.documentElement;
      const names = new Set();
      for (const sh of document.styleSheets) {
        let rs = [];
        try {
          rs = sh.cssRules;
        } catch (e) {}
        for (const r of rs) if (r.style) for (const n of r.style) if (n.startsWith('--')) names.add(n);
      }
      for (const n of root.style) if (n.startsWith('--')) names.add(n);
      const cs = getComputedStyle(root),
        o = {};
      Array.from(names)
        .sort()
        .forEach((n) => {
          o[n] = cs.getPropertyValue(n).trim();
        });
      return o;
    });
  }
  fs.writeFileSync(out, JSON.stringify(res, null, 1), 'utf8');
  console.log(Object.keys(res.midnight).length, 'tokens');
  await b.close();
})();
