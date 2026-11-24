import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VITEST_BIN = path.join(ROOT_DIR, 'node_modules', 'vitest', 'vitest.mjs');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT_DIR, stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
run(pyCmd, ['tools/river_toy_exact.py', '--json']);
run(pyCmd, ['tools/pushfold_exact.py', '--json']);
run(process.execPath, [VITEST_BIN, 'run', 'engine/__tests__/solver_pilot.test.ts']);
