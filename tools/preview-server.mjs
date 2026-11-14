import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VITE_BIN = path.join(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to resolve free port')));
        return;
      }
      const { port } = address;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

async function waitForHttpReady(url, child, getStderr, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `vite preview exited early with code ${child.exitCode}: ${getStderr().trim()}`,
      );
    }
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server not listening yet.
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for ${url}: ${getStderr().trim()}`);
}

export function buildProductionDist() {
  const result = spawnSync(process.execPath, [VITE_BIN, 'build'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`vite build failed with exit code ${result.status ?? 1}`);
  }
}

export async function startPreviewServer({ build = true } = {}) {
  if (build) {
    buildProductionDist();
  }

  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}`;
  let stderr = '';

  const child = spawn(
    process.execPath,
    [VITE_BIN, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: ROOT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForHttpReady(url, child, () => stderr);
  } catch (err) {
    await stopChild(child);
    throw err;
  }

  return {
    url,
    close: () => stopChild(child),
  };
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
      resolve();
    }, 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
