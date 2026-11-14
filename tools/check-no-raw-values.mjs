#!/usr/bin/env node
// Fails when a stylesheet or component outside tokens/ contains a raw colour, duration or easing curve.
// Usage: node tools/check-no-raw-values.mjs [dir ...]   (default: src)
// Allow a single line with a trailing comment:  /* raw-ok: reason */  or  // raw-ok: reason
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const roots = process.argv.slice(2).length ? process.argv.slice(2) : ['src'];
const EXT = new Set(['.css', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.html']);
const SKIP_DIR = new Set(['node_modules', 'dist', 'tokens', '.git', 'engine', 'coverage']);
const RULES = [
  ['hex colour', /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b(?![0-9a-zA-Z_-])/],
  ['rgb()/hsl() colour', /\b(?:rgba?|hsla?|oklch|oklab)\(/],
  ['millisecond or second literal', /(?<![\w.-])(?!0+(?:\.0+)?m?s\b)\d*\.?\d+m?s\b(?=\s*[;,)}\s'"`]|$)/],
  ['cubic-bezier()', /cubic-bezier\(/],
];
const STYLE_CONTEXT_RE =
  /style|css`|transition|animation|color|background|border|shadow|fill|stroke|stop-color|stopColor|flood-color|floodColor|lighting-color|lightingColor|dur|delay|keyframes|animate/i;
const isStyleContext = (file, line) => extname(file) === '.css' || STYLE_CONTEXT_RE.test(line);

const problems = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      walk(p);
      continue;
    }
    if (!EXT.has(extname(name)) || /\.(test|spec)\./.test(name)) continue;
    const rel = p.replace(/\\/g, '/');
    readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (line.includes('raw-ok:')) return;
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || (trimmed.startsWith('/*') && trimmed.endsWith('*/'))) return;
        const code = line
          .replace(/var\(--[\w-]+\)/g, '')
          .replace(/&#\w+;/g, '')
          .replace(/href="#[^"]*"/g, '');
        if (!isStyleContext(p, code)) return;
        for (const [label, re] of RULES) {
          const m = code.match(re);
          if (m) problems.push(`${rel}:${i + 1}  ${label}: ${m[0]}   ${trimmed.slice(0, 90)}`);
        }
      });
  }
}
for (const r of roots) {
  try {
    walk(r);
  } catch (e) {
    console.error(`cannot read ${r}: ${e.message}`);
    process.exit(2);
  }
}
if (problems.length) {
  console.error(
    `check-no-raw-values: ${problems.length} raw value(s). Use a token from tokens/tokens.css, or add one.\n` +
      problems.join('\n')
  );
  process.exit(1);
}
console.log('check-no-raw-values: ok');
