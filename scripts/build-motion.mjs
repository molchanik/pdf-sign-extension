// Bundle the self-hosted motion subset and rename the output with a content
// hash so Cloudflare Pages can never serve a stale Brotli/gzip variant after
// a redeploy.
//
// Run: `node scripts/build-motion.mjs`
//
// Steps:
//   1. esbuild scripts/motion-entry.mjs (tree-shaken to 6 named exports)
//   2. compute sha256 of the output, take first 8 hex chars
//   3. rename to marketing/assets/vendor/motion-<version>-<hash>.min.js
//   4. delete any older motion-<version>-*.min.js files
//   5. patch the import line in marketing/script.js to point at the new name
//
// The version segment comes from the `motion` package's package.json, so a
// `npm i motion@latest` followed by this script handles version bumps too.

import { build } from 'esbuild';
import { readFileSync, writeFileSync, renameSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const vendorDir = path.join(repoRoot, 'marketing', 'assets', 'vendor');
const tempOut = path.join(vendorDir, 'motion.tmp.min.js');
const scriptJs = path.join(repoRoot, 'marketing', 'script.js');

const motionVersion = JSON.parse(
  readFileSync(path.join(repoRoot, 'node_modules', 'motion', 'package.json'), 'utf8'),
).version;

await build({
  entryPoints: [path.join(repoRoot, 'scripts', 'motion-entry.mjs')],
  bundle: true,
  minify: true,
  format: 'esm',
  legalComments: 'none',
  outfile: tempOut,
});

const buf = readFileSync(tempOut);
const hash = createHash('sha256').update(buf).digest('hex').slice(0, 8);
const finalName = `motion-${motionVersion}-${hash}.min.js`;
const finalPath = path.join(vendorDir, finalName);
renameSync(tempOut, finalPath);

const stalePattern = new RegExp(`^motion-${motionVersion.replace(/\./g, '\\.')}-[0-9a-f]{8}\\.min\\.js$`);
for (const entry of readdirSync(vendorDir)) {
  if (entry === finalName) continue;
  if (stalePattern.test(entry)) {
    unlinkSync(path.join(vendorDir, entry));
  }
}

const importRegex = /\.\/assets\/vendor\/motion-[\d.]+-[0-9a-f]{8}\.min\.js/;
const original = readFileSync(scriptJs, 'utf8');
if (!importRegex.test(original)) {
  throw new Error('Could not find motion import in marketing/script.js — has the convention changed?');
}
const patched = original.replace(importRegex, `./assets/vendor/${finalName}`);
if (patched !== original) writeFileSync(scriptJs, patched);

const sizeKb = (statSync(finalPath).size / 1024).toFixed(1);
console.log(`✓ ${finalName} (${sizeKb} KB) — import in script.js patched`);
