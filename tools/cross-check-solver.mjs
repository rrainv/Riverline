#!/usr/bin/env node
/**
 * Riverline Solver Reference Cross-Check Script
 * Verifies internal DCFR + pairwise best-response exploitability across:
 *   1. Analytic / Python exact oracles (Kuhn -1/18, Clairvoyance 2.5/7.5, 169x169 Push/Fold Nash)
 *   2. River spots (dry, paired, flush, raked 5%/2.5bb)
 *   3. Turn->River exact_isomorphic vs all_rivers parity & 2-street pairwise BR
 *   4. Preflop EQR 100bb raked vs unraked equilibrium spots
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function runStep(label, cmd, args) {
  const start = Date.now();
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8', shell: process.platform === 'win32' });
  const ms = Date.now() - start;
  if (res.status !== 0) {
    console.error(`[FAIL] ${label} (${ms}ms)`);
    console.error(res.stdout || res.stderr);
    process.exit(1);
  }
  console.log(`[PASS] ${label} (${ms}ms)`);
  if (res.stdout.trim()) {
    for (const line of res.stdout.trim().split(/\r?\n/).slice(-6)) {
      console.log(`       ${line}`);
    }
  }
}

console.log('Riverline Solver Reference Cross-Check');
console.log('------------------------------------------------------------------------');
runStep('Python exact Section 8 / equity oracle', 'node', ['tools/verify-golden.mjs']);
if (existsSync(resolve(ROOT, 'tools/river_toy_exact.py'))) {
  runStep('Python exact river toy oracle', 'python', ['tools/river_toy_exact.py']);
}
runStep('TypeScript DCFR benchmark & Push/Fold Nash', 'node', ['tools/benchmark-solver.mjs']);
runStep('Turn->River isomorphism & 2-street pairwise BR tests', 'npx', [
  'vitest',
  'run',
  'engine/__tests__/solver_pilot.test.ts',
]);
console.log('------------------------------------------------------------------------');
console.log('Cross-check complete: all mathematical oracles & parity suites green.');
