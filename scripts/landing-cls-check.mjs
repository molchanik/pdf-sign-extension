// Sanity check: open landing locally, measure CLS, catch console errors,
// verify hero image loaded and nav has the reserved min-height.
// Runs with project-level Playwright.

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const landingUrl =
  'file:///' +
  path.resolve(__dirname, '..', 'marketing', 'landing', 'index.html').replace(/\\/g, '/');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    errors.push({ type: msg.type(), text: msg.text() });
  }
});
page.on('pageerror', (err) => errors.push({ type: 'pageerror', text: err.message }));

await page.goto(landingUrl, { waitUntil: 'load' });

// Let animations settle — word-in stagger is ~0.25s + 6 * 0.08s + 0.85s ≈ 1.58s max.
// Give 3s to be safe.
await page.waitForTimeout(3000);

const cls = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let sum = 0;
      const entries = [];
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (!e.hadRecentInput) {
            sum += e.value;
            entries.push({
              value: e.value,
              time: e.startTime,
              sources: e.sources?.map((s) => ({
                node: s.node?.tagName + (s.node?.className ? '.' + s.node.className : ''),
                prev: s.previousRect,
                curr: s.currentRect,
              })),
            });
          }
        }
      });
      po.observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => resolve({ total: sum, entries }), 500);
    }),
);

const navMinHeight = await page
  .locator('.nav__inner')
  .evaluate((el) => getComputedStyle(el).minHeight);
const heroImg = await page.locator('img.hero__image').evaluate((img) => ({
  complete: img.complete,
  naturalWidth: img.naturalWidth,
  naturalHeight: img.naturalHeight,
  currentSrc: img.currentSrc,
  srcset: img.srcset,
  sizes: img.sizes,
}));
const h1Wght = await page
  .locator('.hero__h1')
  .evaluate((el) => getComputedStyle(el).fontVariationSettings);
const preload = await page.evaluate(() =>
  Array.from(document.querySelectorAll('link[rel="preload"][as="image"]')).map((l) => l.href),
);

await page.screenshot({ path: path.resolve(__dirname, 'landing-sanity.png'), fullPage: false });

await browser.close();

const report = {
  cls,
  navMinHeight,
  heroImg,
  h1Wght,
  preloadImages: preload,
  consoleIssues: errors,
};
console.log(JSON.stringify(report, null, 2));
