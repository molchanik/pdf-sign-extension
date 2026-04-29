// Capture font-sensitive box metrics on the landing. Used to verify that
// switching from Google-hosted Inter to a self-hosted Inter Variable does
// not shift layout measurably (metrics-compatible font file).
//
// Usage:
//   node scripts/landing-font-metrics.mjs baseline   # writes baseline.json
//   node scripts/landing-font-metrics.mjs compare    # reads baseline.json, diffs

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baselinePath = path.resolve(__dirname, 'landing-font-baseline.json');
const landingUrl =
  'file:///' +
  path.resolve(__dirname, '..', 'marketing', 'index.html').replace(/\\/g, '/');

const mode = process.argv[2];
if (mode !== 'baseline' && mode !== 'compare') {
  console.error('usage: node scripts/landing-font-metrics.mjs <baseline|compare>');
  process.exit(1);
}

// file:// blocks cross-origin font fetches under default Chromium. Lifting
// web security and allowing file-scheme origin cross-reads lets both the
// Google-Fonts baseline and the self-hosted comparison actually load the
// font files, so the captured metrics reflect real Inter/JB Mono glyphs
// rather than a system-ui fallback.
const browser = await chromium.launch({
  headless: true,
  args: ['--allow-file-access-from-files', '--disable-web-security'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
await page.goto(landingUrl, { waitUntil: 'load' });

// Wait for font loading (document.fonts.ready) plus animations settle.
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(2500);

const selectors = [
  '.hero__h1',
  '.hero__sub',
  '.nav__brand',
  '.nav__links',
  '.trustbar__inner',
  '.btn--primary',
  '.section__h2',
];

const metrics = {};
for (const sel of selectors) {
  try {
    const el = page.locator(sel).first();
    const data = await el.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const cs = getComputedStyle(node);
      return {
        w: Math.round(rect.width * 100) / 100,
        h: Math.round(rect.height * 100) / 100,
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
      };
    });
    metrics[sel] = data;
  } catch (e) {
    metrics[sel] = { error: e.message };
  }
}

const fontFaces = await page.evaluate(() =>
  Array.from(document.fonts).map((f) => ({
    family: f.family,
    weight: f.weight,
    style: f.style,
    status: f.status,
  })),
);

await browser.close();

const report = { metrics, fontFaces };

if (mode === 'baseline') {
  await fs.writeFile(baselinePath, JSON.stringify(report, null, 2));
  console.log(`wrote baseline to ${baselinePath}`);
  console.log(JSON.stringify(report, null, 2));
} else {
  const baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
  const diffs = [];
  for (const sel of Object.keys(baseline.metrics)) {
    const b = baseline.metrics[sel];
    const c = metrics[sel];
    if (!b || !c || b.error || c.error) continue;
    const dw = Math.abs(b.w - c.w);
    const dh = Math.abs(b.h - c.h);
    if (dw > 1 || dh > 1) {
      diffs.push({ selector: sel, baseline: b, current: c, dw, dh });
    }
  }
  const result = {
    comparedSelectors: Object.keys(baseline.metrics).length,
    diffsBeyond1px: diffs.length,
    diffs,
    currentFontFaces: fontFaces,
    baselineFontFaces: baseline.fontFaces,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(diffs.length === 0 ? 0 : 2);
}
