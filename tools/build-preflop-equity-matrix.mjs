import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { build } from 'esbuild';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = path.join(ROOT_DIR, 'tools', 'data', 'preflop-equity-169x169.json');

const SUITS = ['s', 'h', 'd', 'c'];

function buildSuitPermutations() {
  const perms = [];
  function permute(curr, rem) {
    if (rem.length === 0) {
      perms.push(curr);
      return;
    }
    for (let i = 0; i < rem.length; i += 1) {
      permute([...curr, rem[i]], [...rem.slice(0, i), ...rem.slice(i + 1)]);
    }
  }
  permute([], SUITS);
  return perms;
}

const SUIT_PERMS = buildSuitPermutations();

function mapCard(card, perm) {
  const sIdx = SUITS.indexOf(card[1]);
  return card[0] + perm[sIdx];
}

function canonicalMatchupKey(c1Cards, c2Cards) {
  let best = null;
  for (let p = 0; p < SUIT_PERMS.length; p += 1) {
    const perm = SUIT_PERMS[p];
    const a0 = mapCard(c1Cards[0], perm);
    const a1 = mapCard(c1Cards[1], perm);
    const b0 = mapCard(c2Cards[0], perm);
    const b1 = mapCard(c2Cards[1], perm);
    const h = a0 < a1 ? a0 + a1 : a1 + a0;
    const v = b0 < b1 ? b0 + b1 : b1 + b0;
    const key = h + '|' + v;
    if (best === null || key < best) best = key;
  }
  return best;
}

if (!isMainThread) {
  const { bundleUrl, startIdx, step } = workerData;
  const { PREFLOP_HAND_CLASSES, HOLDEM_COMBOS, solveExactHeadsUpPreflop } = await import(bundleUrl);

  const n = PREFLOP_HAND_CLASSES.length;
  const classIndex = new Map(PREFLOP_HAND_CLASSES.map((hc, idx) => [hc, idx]));
  const combosByClass = Array.from({ length: n }, () => []);
  for (const c of HOLDEM_COMBOS) {
    combosByClass[classIndex.get(c.handClass)].push(c);
  }

  const rows = [];
  for (let i = startIdx; i < n; i += step) {
    const ciList = combosByClass[i];
    const eqRow = new Array(n - i);
    const pairRow = new Array(n - i);

    for (let j = i; j < n; j += 1) {
      const cjList = combosByClass[j];
      if (i === j) {
        let disjoint = 0;
        for (let a = 0; a < ciList.length; a += 1) {
          const [a0, a1] = ciList[a].cards;
          for (let b = 0; b < cjList.length; b += 1) {
            const [b0, b1] = cjList[b].cards;
            if (a0 !== b0 && a0 !== b1 && a1 !== b0 && a1 !== b1) {
              disjoint += 1;
            }
          }
        }
        eqRow[j - i] = 0.5;
        pairRow[j - i] = disjoint;
        continue;
      }

      const c1 = ciList[0];
      const [a0, a1] = c1.cards;
      const groups = new Map();
      let disjointForC1 = 0;
      for (let b = 0; b < cjList.length; b += 1) {
        const c2 = cjList[b];
        const [b0, b1] = c2.cards;
        if (a0 === b0 || a0 === b1 || a1 === b0 || a1 === b1) continue;
        disjointForC1 += 1;
        const key = canonicalMatchupKey(c1.cards, c2.cards);
        const existing = groups.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          groups.set(key, { count: 1, c1: c1.cards, c2: c2.cards });
        }
      }

      let weightedEq = 0;
      for (const g of groups.values()) {
        const res = solveExactHeadsUpPreflop(g.c1, g.c2);
        weightedEq += res.players[0].equity * g.count;
      }

      eqRow[j - i] = Math.round((weightedEq / disjointForC1) * 1e6) / 1e6;
      pairRow[j - i] = ciList.length * disjointForC1;
    }

    rows.push({ i, eqRow, pairRow });
  }

  parentPort.postMessage(rows);
} else {
  const startMs = Date.now();
  const tmpBundlePath = path.join(os.tmpdir(), `riverline-preflop-exact-${process.pid}.mjs`);
  try {
    await build({
      stdin: {
        contents: `
          export { PREFLOP_HAND_CLASSES } from './engine/hand-class.ts';
          export { HOLDEM_COMBOS } from './engine/holdem-combos.ts';
          export { solveExactHeadsUpPreflop } from './engine/preflop-exact.ts';
        `,
        resolveDir: ROOT_DIR,
        loader: 'ts',
      },
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile: tmpBundlePath,
      logLevel: 'silent',
    });

    const bundleUrl = pathToFileURL(tmpBundlePath).href;
    const { PREFLOP_HAND_CLASSES } = await import(bundleUrl);
    const n = PREFLOP_HAND_CLASSES.length;
    const upperEquity = new Array(n);
    const upperDisjointPairs = new Array(n);

    const numWorkers = Math.max(1, Math.min(os.cpus().length, 8));
    await Promise.all(
      Array.from({ length: numWorkers }, (_, workerIdx) =>
        new Promise((resolve, reject) => {
          const w = new Worker(new URL(import.meta.url), {
            workerData: { bundleUrl, startIdx: workerIdx, step: numWorkers },
          });
          w.on('message', (rows) => {
            for (const r of rows) {
              upperEquity[r.i] = r.eqRow;
              upperDisjointPairs[r.i] = r.pairRow;
            }
          });
          w.on('error', reject);
          w.on('exit', (code) => {
            if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
            else resolve();
          });
        }),
      ),
    );

    let totalOrderedPairs = 0;
    for (let i = 0; i < n; i += 1) {
      for (let j = i; j < n; j += 1) {
        const p = upperDisjointPairs[i][j - i];
        totalOrderedPairs += i === j ? p : 2 * p;
      }
    }
    const expectedPairs = 1326 * 1225;
    if (totalOrderedPairs !== expectedPairs) {
      throw new Error(`Disjoint pair count mismatch: got ${totalOrderedPairs}, expected ${expectedPairs}`);
    }

    const idxOf = (hc) => PREFLOP_HAND_CLASSES.indexOf(hc);
    const getEq = (a, b) => {
      const ia = idxOf(a);
      const ib = idxOf(b);
      if (ia <= ib) return upperEquity[ia][ib - ia];
      return 1 - upperEquity[ib][ia - ib];
    };

    const aaVsKk = getEq('AA', 'KK');
    const aaVs72o = getEq('AA', '72o');
    const aksVsQq = getEq('AKs', 'QQ');
    if (aaVsKk < 0.818 || aaVsKk > 0.821) throw new Error(`AA vs KK out of range: ${aaVsKk}`);
    if (aaVs72o < 0.880 || aaVs72o > 0.884) throw new Error(`AA vs 72o out of range: ${aaVs72o}`);
    if (aksVsQq < 0.460 || aksVsQq > 0.463) throw new Error(`AKs vs QQ out of range: ${aksVsQq}`);

    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(
      OUT_PATH,
      JSON.stringify(
        {
          schemaVersion: 1,
          provenanceId: 'preflop-exact-169x169-v1',
          handClasses: [...PREFLOP_HAND_CLASSES],
          upperEquity,
          upperDisjointPairs,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );

    const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(2);
    console.log(
      `Wrote ${path.relative(ROOT_DIR, OUT_PATH)} in ${elapsedSec}s (${numWorkers} workers) | pairs=${totalOrderedPairs} | AA vs KK=${aaVsKk}, AA vs 72o=${aaVs72o}, AKs vs QQ=${aksVsQq}`,
    );
  } finally {
    if (fs.existsSync(tmpBundlePath)) fs.unlinkSync(tmpBundlePath);
  }
}
