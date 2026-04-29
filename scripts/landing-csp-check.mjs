// Smoke-checks CSP / network for the marketing landing + privacy pages.
// Usage: node scripts/landing-csp-check.mjs <base-url>
// Example: node scripts/landing-csp-check.mjs https://safepdfsign.com/
// Exits 0 on clean pass, 1 on any CSP violation / failed request, 2 on usage error.
//
// CF Pages' _headers only applies to live URLs (not file://), so this script
// must be pointed at a deployed origin: a preview branch URL during pre-merge
// or `https://safepdfsign.com/` post-merge.

import { chromium } from 'playwright';

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error('Usage: node scripts/landing-csp-check.mjs <base-url>');
  process.exit(2);
}

const targets = ['/', '/privacy'];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

let failed = false;

for (const target of targets) {
  const url = new URL(target, baseUrl).toString();
  const page = await context.newPage();
  const violations = [];
  const failures = [];

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('Content Security Policy') || text.includes('Refused to')) {
      violations.push(text);
    }
  });
  page.on('requestfailed', (req) => {
    failures.push(`${req.url()} → ${req.failure()?.errorText ?? 'unknown'}`);
  });

  console.log(`[csp-check] GET ${url}`);
  const response = await page.goto(url, { waitUntil: 'networkidle' });

  if (!response || !response.ok()) {
    console.error(`  ✗ HTTP ${response?.status() ?? 'no response'}`);
    failed = true;
  } else {
    console.log(`  ✓ HTTP ${response.status()}`);
  }

  if (violations.length > 0) {
    console.error(`  ✗ ${violations.length} CSP violation(s):`);
    for (const v of violations) console.error(`    - ${v}`);
    failed = true;
  } else {
    console.log(`  ✓ no CSP violations`);
  }

  if (failures.length > 0) {
    console.error(`  ✗ ${failures.length} failed request(s):`);
    for (const f of failures) console.error(`    - ${f}`);
    failed = true;
  } else {
    console.log(`  ✓ no failed requests`);
  }

  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
