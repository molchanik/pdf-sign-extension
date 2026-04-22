// Generate responsive variants of the hero image for use with `srcset`.
// Reads marketing/assets/hero-quill.webp (1600x1600, 196 KB) and emits
// 800x800 and 1200x1200 WebP siblings alongside it.

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// Sharp is a transitive dep (via plasmo). Resolve through that path.
const sharp = require('plasmo/node_modules/sharp');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(__dirname, '..', 'marketing', 'assets', 'hero-quill.webp');
const outDir = path.dirname(src);

const targets = [
  { size: 800, name: 'hero-quill-800.webp' },
  { size: 1200, name: 'hero-quill-1200.webp' },
];

for (const { size, name } of targets) {
  const dest = path.resolve(outDir, name);
  const info = await sharp(src)
    .resize(size, size, { fit: 'cover' })
    .webp({ quality: 82, effort: 6 })
    .toFile(dest);
  console.log(`${name}: ${size}x${size} -> ${Math.round(info.size / 1024)} KB`);
}
