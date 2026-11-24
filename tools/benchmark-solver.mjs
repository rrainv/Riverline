import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonMode = process.argv.includes('--json');

function resolvePython() {
  for (const cmd of process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) {
    const probe = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
    if (probe.status === 0) return cmd;
  }
  throw new Error('Python 3 interpreter not found on PATH');
}

function fmtFreqs(actions) {
  return actions
    .map((a) => `${a.actionLabel} ${(a.frequency * 100).toFixed(1)}%`)
    .join(', ');
}

const tmpBundlePath = path.join(os.tmpdir(), `riverline-benchmark-solver-${process.pid}.mjs`);

try {
  await build({
    stdin: {
      contents: `
        export * from './engine/solver/index.ts';
        export { HOLDEM_COMBOS } from './engine/holdem-combos.ts';
        export { PUSHFOLD_REFERENCE_TABLE } from './engine/personal-strategy/pushfold-table.ts';
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

  const mod = await import(pathToFileURL(tmpBundlePath).href);
  const {
    buildSolvedSpotArtifact,
    computeRiverBestResponse,
    expandHandClassesToComboMap,
    HOLDEM_COMBOS,
    PILOT_SPOT_SPECS,
    PUSHFOLD_REFERENCE_TABLE,
    solveKuhnDcfr,
    solveRiverSubgame,
    solveTurnSubgame,
  } = mod;

  const checks = [];
  const pushCheck = (name, passed, detail, elapsedMs) => {
    checks.push({ name, passed, detail, elapsedMs });
  };

  // 1. Kuhn Poker DCFR
  {
    const t0 = Date.now();
    const res = solveKuhnDcfr(20000);
    const elapsedMs = Date.now() - t0;
    const exact = -1 / 18;
    const passed = Math.abs(res.p0Value - exact) < 0.002 && res.exploitability < 0.002;
    pushCheck(
      'kuhn_dcfr',
      passed,
      {
        p0Value: Number(res.p0Value.toFixed(6)),
        exactP0: Number(exact.toFixed(6)),
        exploitability: Number(res.exploitability.toFixed(6)),
      },
      elapsedMs,
    );
  }

  // 2. Half-Street Clairvoyance River
  {
    const t0 = Date.now();
    const board = ['Ks', 'Qd', '7c', '2h', '4s'];
    const oopRangeByCombo = {};
    const ipRangeByCombo = {};
    for (const c of HOLDEM_COMBOS) {
      if (board.includes(c.cards[0]) || board.includes(c.cards[1])) continue;
      if (c.handClass === 'QJs') oopRangeByCombo[c.id] = 1;
      if (c.handClass === 'KK') ipRangeByCombo[c.id] = 1;
      if (c.handClass === '98s' && c.cards[0] !== '8c') ipRangeByCombo[c.id] = 1;
    }
    const solve = solveRiverSubgame(
      {
        spotId: 'clairvoyance-benchmark',
        board,
        potBb: 10,
        effectiveStackBb: 10,
        oopRangeByCombo,
        ipRangeByCombo,
        betMenu: { betPcts: [1.0], raisePcts: [], raiseCap: 0, includeAllIn: false },
      },
      { alpha: 1.5, beta: 0, gamma: 2, iterations: 600 },
    );
    const br = computeRiverBestResponse(solve);
    const elapsedMs = Date.now() - t0;
    const passed =
      Math.abs(br.oopEvBb + br.ipEvBb - 10) < 1e-6 &&
      br.exploitabilityPctPot < 0.5 &&
      Math.abs(br.oopEvBb - 2.5) < 0.35 &&
      Math.abs(br.ipEvBb - 7.5) < 0.35;
    pushCheck(
      'clairvoyance_river',
      passed,
      {
        oopEvBb: Number(br.oopEvBb.toFixed(4)),
        ipEvBb: Number(br.ipEvBb.toFixed(4)),
        exploitabilityPctPot: Number(br.exploitabilityPctPot.toFixed(4)),
      },
      elapsedMs,
    );
  }

  // 3. 3 Pilot River Spots
  for (const item of PILOT_SPOT_SPECS) {
    const t0 = Date.now();
    const art = buildSolvedSpotArtifact(item.spec, {
      titleKey: item.titleKey,
      provenanceId: item.provenanceId,
      abstractionLabel: item.abstractionLabel,
    });
    const elapsedMs = Date.now() - t0;
    const evSumErr = Math.abs(art.oopEvBb + art.ipEvBb - item.spec.potBb);
    const passed = evSumErr < 0.01 && art.exploitabilityPctPot < 0.5 && art.oopRootActions.length > 0;
    pushCheck(
      item.spec.spotId,
      passed,
      {
        oopEvBb: art.oopEvBb,
        ipEvBb: art.ipEvBb,
        exploitabilityPctPot: art.exploitabilityPctPot,
        oopRoot: fmtFreqs(art.oopRootActions),
        ipVsCheck: fmtFreqs(art.ipFacingCheckActions),
      },
      elapsedMs,
    );
  }

  // 4. Turn-to-River Canonical Spot (8 river cards)
  {
    const t0 = Date.now();
    const turnRes = solveTurnSubgame(
      {
        spotId: 'turn-benchmark-kq72',
        turnBoard: ['Ks', 'Qd', '7c', '2h'],
        potBb: 12,
        effectiveStackBb: 30,
        oopRangeByCombo: expandHandClassesToComboMap(['QQ', 'JJ', 'AQo']),
        ipRangeByCombo: expandHandClassesToComboMap(['KK', 'AA', '98s']),
        turnBetMenu: { betPcts: [0.5], raisePcts: [], raiseCap: 0, includeAllIn: true },
        riverCardSubset: ['4s', '9c', 'Td', 'Ah', '3d', '6c', '8s', 'Jc'],
      },
      { alpha: 1.5, beta: 0, gamma: 2, iterations: 60 },
    );
    const elapsedMs = Date.now() - t0;
    const freqSum = turnRes.turnRootActions.reduce((acc, a) => acc + a.frequency, 0);
    const passed =
      turnRes.riverCardsEvaluated === 8 &&
      Math.abs(turnRes.oopEvBb + turnRes.ipEvBb - 12) < 0.05 &&
      Math.abs(freqSum - 1) < 0.02;
    pushCheck(
      'turn_kq72_8rivers',
      passed,
      {
        oopEvBb: Number(turnRes.oopEvBb.toFixed(4)),
        ipEvBb: Number(turnRes.ipEvBb.toFixed(4)),
        riverCardsEvaluated: turnRes.riverCardsEvaluated,
        turnRoot: fmtFreqs(turnRes.turnRootActions),
      },
      elapsedMs,
    );
  }

  // 5. Exact HU Push/Fold Nash Parity
  {
    const t0 = Date.now();
    const pyCmd = resolvePython();
    const pyRes = spawnSync(pyCmd, ['tools/pushfold_exact.py', '--json'], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
    });
    const elapsedMs = Date.now() - t0;
    if (pyRes.status !== 0) {
      pushCheck('pushfold_hu_nash_exact', false, { error: pyRes.stderr }, elapsedMs);
    } else {
      const parsed = JSON.parse(pyRes.stdout);
      const pyRows = parsed.rows ?? [];
      let allMatch = pyRows.length === PUSHFOLD_REFERENCE_TABLE.length;
      const diffs = [];
      for (const pyRow of pyRows) {
        const tsRow = PUSHFOLD_REFERENCE_TABLE.find((r) => r.stackBb === pyRow.stackBb);
        if (
          !tsRow ||
          tsRow.sbJamPct !== pyRow.sbJamPct ||
          tsRow.bbCallPct !== pyRow.bbCallPct ||
          pyRow.exploitabilityBb >= 0.002
        ) {
          allMatch = false;
          diffs.push({ stackBb: pyRow.stackBb, py: pyRow.sbJamPct, ts: tsRow?.sbJamPct });
        }
      }
      pushCheck(
        'pushfold_hu_nash_exact',
        allMatch,
        {
          depths: pyRows.map((r) => `${r.stackBb}bb:${r.sbJamPct}%/${r.bbCallPct}%(expl=${r.exploitabilityBb})`),
          diffs,
        },
        elapsedMs,
      );
    }
  }

  const allPassed = checks.every((c) => c.passed);

  if (jsonMode) {
    console.log(JSON.stringify({ passed: allPassed, checks }, null, 2));
  } else {
    console.log('Riverline Solver Benchmark Harness');
    console.log('------------------------------------------------------------------------');
    for (const c of checks) {
      const status = c.passed ? 'PASS' : 'FAIL';
      const summary =
        c.name === 'kuhn_dcfr'
          ? `p0=${c.detail.p0Value} (exact ${c.detail.exactP0}), expl=${c.detail.exploitability}`
          : c.name === 'clairvoyance_river'
            ? `OOP=${c.detail.oopEvBb}bb, IP=${c.detail.ipEvBb}bb, expl=${c.detail.exploitabilityPctPot}% pot`
            : c.name === 'turn_kq72_8rivers'
              ? `OOP=${c.detail.oopEvBb}bb, IP=${c.detail.ipEvBb}bb, rivers=${c.detail.riverCardsEvaluated}, root=[${c.detail.turnRoot}]`
              : c.name === 'pushfold_hu_nash_exact'
                ? (c.detail.depths ?? []).join(' | ')
                : `OOP=${c.detail.oopEvBb}bb, IP=${c.detail.ipEvBb}bb, expl=${c.detail.exploitabilityPctPot}% pot | OOP=[${c.detail.oopRoot}]`;
      console.log(`[${status}] ${c.name.padEnd(26)} (${String(c.elapsedMs).padStart(4)}ms) ${summary}`);
    }
    console.log('------------------------------------------------------------------------');
    console.log(`Result: ${checks.filter((c) => c.passed).length}/${checks.length} checks passed.`);
  }

  process.exit(allPassed ? 0 : 1);
} finally {
  if (fs.existsSync(tmpBundlePath)) fs.unlinkSync(tmpBundlePath);
}
