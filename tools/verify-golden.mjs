import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GOLDEN_PATH = path.join(ROOT_DIR, 'tools', 'golden', 'section8.golden.json');
const EQEXACT_PY = path.join(ROOT_DIR, 'tools', 'eqexact.py');
const VITEST_BIN = path.join(ROOT_DIR, 'node_modules', 'vitest', 'vitest.mjs');

function resolvePython() {
  for (const cmd of process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) {
    const probe = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
    if (probe.status === 0) return cmd;
  }
  throw new Error('Python 3 interpreter not found on PATH');
}

const pythonCmd = resolvePython();
const pyRes = spawnSync(pythonCmd, [EQEXACT_PY, '--section8', '--with-vs-any'], {
  cwd: ROOT_DIR,
  encoding: 'utf8',
});

if (pyRes.status !== 0) {
  console.error('eqexact.py failed:', pyRes.stderr);
  process.exit(pyRes.status ?? 1);
}

const generatedObj = JSON.parse(pyRes.stdout);
const canonical = JSON.stringify(generatedObj, null, 2) + '\n';

if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(GOLDEN_PATH), { recursive: true });
  fs.writeFileSync(GOLDEN_PATH, canonical, 'utf8');
  console.log('golden: wrote', path.relative(ROOT_DIR, GOLDEN_PATH));
} else {
  if (!fs.existsSync(GOLDEN_PATH)) {
    console.error('golden: missing', path.relative(ROOT_DIR, GOLDEN_PATH), '(run with --write to generate)');
    process.exit(1);
  }
  const existing = fs.readFileSync(GOLDEN_PATH, 'utf8').replace(/\r\n/g, '\n');
  if (existing !== canonical) {
    console.error('golden: tools/golden/section8.golden.json differs from python tools/eqexact.py --section8 --with-vs-any');
    process.exit(1);
  }
  console.log('golden: eqexact.py matches tools/golden/section8.golden.json');
}

const testRes = spawnSync(
  process.execPath,
  [VITEST_BIN, 'run', 'src/test/section8.golden.test.ts'],
  { cwd: ROOT_DIR, stdio: 'inherit' },
);

process.exit(testRes.status ?? 1);
