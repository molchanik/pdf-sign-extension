# Test Coverage Design — PDF Sign Extension

**Date:** 2026-04-13
**Goal:** Cover critical paths with unit tests. Protect against regressions, document behavior. No 100% coverage chasing.
**Runner:** Vitest, Node environment
**Approach:** Real libraries where possible (pdf-lib), mocks only for browser APIs and external services

## 1. fonts.ts — Pure Utilities (no mocks)

- `getFontDef`: finds font by ID, returns undefined for unknown
- `getVariantKey`: 4 combinations of bold/italic
- `FONTS` structure: 5 fonts, 3 standard + 2 custom, each with 4 variants, custom have .ttf paths

## 2. pdf-signer.ts — PDF Generation (deep testing)

Uses real pdf-lib + fontkit. Mocks: `chrome.runtime.getURL`, `fetch` (for font loading).

- Text on correct page: add text to page 0, parse result, verify text on first page
- Text content: insert "Hello World", parse output, find string
- Signature as image: insert PNG dataUrl, verify embedded image in result
- Multiple elements on different pages: text on page 0, signature on page 1, verify both
- Cyrillic with Roboto: Russian text + Roboto font, must not throw (uses real TTF from assets)
- Cyrillic with Helvetica — error: Russian text + Helvetica, must throw with "WinAnsi" in message
- Empty elements: empty array, PDF returns unchanged
- Invalid pageIndex: element beyond document bounds, silently skipped
- Encrypted/invalid PDF: invalid bytes input, throws readable error

## 3. counter.ts — Supabase Client (mock supabase.functions.invoke)

- checkSignLimit success: returns parsed response
- checkSignLimit limit reached: returns allowed: false
- checkSignLimit network error: graceful degradation, returns allowed: true
- incrementSignCount success: completes without error
- incrementSignCount error: does not throw (console.warn)

## 4. payments.ts — ExtensionPay Wrapper (mock extpay module)

- checkProStatus paid: returns paid: true with dates
- checkProStatus unpaid: returns paid: false
- checkProStatus subscription canceling: paid: true with subscriptionCancelAt date
- checkProStatus ExtPay error: fallback to paid: false, nulls
- openUpgradePage: calls openPaymentPage on ExtPay instance

## 5. Edge Functions — check-limit, sign-count (mock Deno, Supabase client)

### check-limit

- No auth header: 401
- Invalid token: 401
- Valid token, 0 usage: allowed: true
- Valid token, 1 usage: allowed: false
- Multiple month records: sums all counts
- OPTIONS: CORS headers

### sign-count

- No auth header: 401
- Invalid token: 401
- First usage: inserts row with count=1
- Repeat usage: updates existing row, increments count
- Correct month format: YYYY-MM
- OPTIONS: CORS headers

## Out of Scope

- React components (browser DOM + chrome APIs)
- auth.ts (chrome.identity OAuth flow)
- registerPreviewFonts (DOM manipulation)
- PDF rendering (canvas-based)
