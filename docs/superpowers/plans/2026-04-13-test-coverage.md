# Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cover critical paths with unit tests for fonts, pdf-signer, counter, payments, and edge functions.

**Architecture:** Vitest in Node environment. Real pdf-lib for PDF tests, mocks for chrome.*, Supabase, ExtPay, Deno. Each module gets its own test file in `__tests__/` next to source.

**Tech Stack:** Vitest, pdf-lib, @pdf-lib/fontkit, vi.mock, vi.stubGlobal

---

## File Structure

```
vitest.config.ts                                    # Already exists, may need updates
src/lib/__tests__/fonts.test.ts                     # Already exists, needs review
src/lib/__tests__/pdf-signer.test.ts                # Create
src/lib/__tests__/counter.test.ts                   # Create
src/lib/__tests__/payments.test.ts                  # Create
supabase/functions/__tests__/check-limit.test.ts    # Create
supabase/functions/__tests__/sign-count.test.ts     # Create
src/lib/__tests__/helpers/minimal-png.ts            # Create (shared test helper)
```

---

### Task 1: Test Infrastructure Setup

**Files:**
- Modify: `vitest.config.ts`
- Modify: `package.json`
- Review: `src/lib/__tests__/fonts.test.ts`

- [ ] **Step 1: Verify vitest.config.ts handles all aliases**

```typescript
import { defineConfig } from "vitest/config"
import { resolve } from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/**/__tests__/**/*.test.ts",
      "supabase/functions/__tests__/**/*.test.ts",
    ],
  },
  resolve: {
    alias: {
      "~lib": resolve(__dirname, "src/lib"),
      "~components": resolve(__dirname, "src/components"),
    },
  },
})
```

- [ ] **Step 2: Run existing fonts.test.ts**

Run: `npm test -- src/lib/__tests__/fonts.test.ts`
Expected: All tests PASS (fonts.test.ts was created earlier)

- [ ] **Step 3: Fix any failures, then commit**

```bash
git add vitest.config.ts src/lib/__tests__/fonts.test.ts package.json package-lock.json
git commit -m "test: setup vitest and add fonts.ts tests"
```

---

### Task 2: Shared Test Helper — Minimal PNG

**Files:**
- Create: `src/lib/__tests__/helpers/minimal-png.ts`

- [ ] **Step 1: Create minimal 1x1 transparent PNG as data URL**

This is needed by pdf-signer tests for signature elements.

```typescript
// Minimal 1x1 transparent PNG as base64 data URL
// Generated from the PNG spec: IHDR(1x1, RGBA) + empty IDAT + IEND
export const MINIMAL_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg=="
```

- [ ] **Step 2: Verify the PNG is valid by decoding in a quick test**

Add to fonts.test.ts temporarily or run inline:
```bash
node -e "const b = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg==', 'base64'); console.log('PNG magic:', b.slice(0,4).toString('hex')); console.log('Size:', b.length)"
```
Expected: PNG magic `89504e47`, Size > 0

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/helpers/minimal-png.ts
git commit -m "test: add minimal PNG helper for pdf-signer tests"
```

---

### Task 3: pdf-signer.ts Tests

**Files:**
- Create: `src/lib/__tests__/pdf-signer.test.ts`
- Reference: `src/lib/pdf-signer.ts`, `src/lib/fonts.ts`, `assets/fonts/Roboto-Regular.ttf`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "fs"
import { resolve } from "path"
import { PDFDocument } from "pdf-lib"
import { signPdf, type ElementInput } from "../pdf-signer"
import { MINIMAL_PNG_DATA_URL } from "./helpers/minimal-png"

// Mock chrome.runtime.getURL — returns a file:// URL that fetch can resolve
vi.stubGlobal("chrome", {
  runtime: {
    getURL: (path: string) => resolve(__dirname, "../../../", path),
  },
})

// Mock fetch to read font files from disk
vi.stubGlobal("fetch", vi.fn(async (url: string) => {
  if (url.startsWith("data:")) {
    // Handle data URLs (for PNG signatures)
    const base64 = url.split(",")[1]
    const buffer = Buffer.from(base64, "base64")
    return { arrayBuffer: () => Promise.resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)) }
  }
  // Handle file paths (for fonts)
  const bytes = readFileSync(url)
  return { arrayBuffer: () => Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)) }
}))

async function createTestPdf(pageCount = 1): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([612, 792]) // US Letter
  }
  const bytes = await doc.save()
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

describe("signPdf", () => {
  it("returns valid PDF with no elements", async () => {
    const input = await createTestPdf()
    const result = await signPdf({ pdfBytes: input, elements: [] })
    const doc = await PDFDocument.load(result)
    expect(doc.getPages()).toHaveLength(1)
  })

  it("embeds text on the correct page", async () => {
    const input = await createTestPdf(2)
    const elements: ElementInput[] = [{
      type: "text",
      pageIndex: 0,
      x: 50, y: 50, width: 200, height: 30,
      text: "Hello World",
      fontFamily: "Helvetica",
      fontSize: 16,
      color: "#000000",
      bold: false,
      italic: false,
    }]
    const result = await signPdf({ pdfBytes: input, elements })
    const doc = await PDFDocument.load(result)
    // PDF was modified (result is larger than input)
    expect(result.length).toBeGreaterThan(new Uint8Array(input).length)
    expect(doc.getPages()).toHaveLength(2)
  })

  it("embeds text content that can be found in raw PDF bytes", async () => {
    const input = await createTestPdf()
    const elements: ElementInput[] = [{
      type: "text",
      pageIndex: 0,
      x: 50, y: 50, width: 200, height: 30,
      text: "UniqueTestString123",
      fontFamily: "Helvetica",
      fontSize: 16,
      color: "#000000",
      bold: false,
      italic: false,
    }]
    const result = await signPdf({ pdfBytes: input, elements })
    // Search for the text in raw PDF bytes
    const resultStr = Buffer.from(result).toString("latin1")
    expect(resultStr).toContain("UniqueTestString123")
  })

  it("embeds signature image", async () => {
    const input = await createTestPdf()
    const elements: ElementInput[] = [{
      type: "signature",
      pageIndex: 0,
      x: 50, y: 50, width: 150, height: 50,
      dataUrl: MINIMAL_PNG_DATA_URL,
    }]
    const result = await signPdf({ pdfBytes: input, elements })
    // Result should be larger due to embedded image
    expect(result.length).toBeGreaterThan(new Uint8Array(input).length + 50)
  })

  it("places elements on different pages", async () => {
    const input = await createTestPdf(3)
    const elements: ElementInput[] = [
      {
        type: "text", pageIndex: 0,
        x: 50, y: 50, width: 200, height: 30,
        text: "Page1Text", fontFamily: "Helvetica",
        fontSize: 16, color: "#000000", bold: false, italic: false,
      },
      {
        type: "signature", pageIndex: 2,
        x: 50, y: 50, width: 150, height: 50,
        dataUrl: MINIMAL_PNG_DATA_URL,
      },
    ]
    const result = await signPdf({ pdfBytes: input, elements })
    const doc = await PDFDocument.load(result)
    expect(doc.getPages()).toHaveLength(3)
    const resultStr = Buffer.from(result).toString("latin1")
    expect(resultStr).toContain("Page1Text")
  })

  it("handles Cyrillic text with Roboto without error", async () => {
    const input = await createTestPdf()
    const elements: ElementInput[] = [{
      type: "text", pageIndex: 0,
      x: 50, y: 50, width: 200, height: 30,
      text: "Привет мир",
      fontFamily: "Roboto",
      fontSize: 16, color: "#000000", bold: false, italic: false,
    }]
    // Should not throw
    const result = await signPdf({ pdfBytes: input, elements })
    expect(result.length).toBeGreaterThan(0)
  })

  it("throws WinAnsi error for Cyrillic with Helvetica", async () => {
    const input = await createTestPdf()
    const elements: ElementInput[] = [{
      type: "text", pageIndex: 0,
      x: 50, y: 50, width: 200, height: 30,
      text: "Привет",
      fontFamily: "Helvetica",
      fontSize: 16, color: "#000000", bold: false, italic: false,
    }]
    await expect(signPdf({ pdfBytes: input, elements }))
      .rejects.toThrow(/WinAnsi|cannot encode/)
  })

  it("skips elements with invalid pageIndex", async () => {
    const input = await createTestPdf(1)
    const elements: ElementInput[] = [{
      type: "text", pageIndex: 99,
      x: 50, y: 50, width: 200, height: 30,
      text: "Ghost",
      fontFamily: "Helvetica",
      fontSize: 16, color: "#000000", bold: false, italic: false,
    }]
    // Should not throw, just skip
    const result = await signPdf({ pdfBytes: input, elements })
    expect(result.length).toBeGreaterThan(0)
  })

  it("throws readable error for invalid PDF bytes", async () => {
    const garbage = new ArrayBuffer(100)
    await expect(signPdf({ pdfBytes: garbage, elements: [] }))
      .rejects.toThrow("Cannot open this PDF")
  })

  it("applies correct color from hex", async () => {
    const input = await createTestPdf()
    const elements: ElementInput[] = [{
      type: "text", pageIndex: 0,
      x: 50, y: 50, width: 200, height: 30,
      text: "Red",
      fontFamily: "Helvetica",
      fontSize: 16, color: "#ff0000", bold: false, italic: false,
    }]
    // Should not throw — validates hexToRgb doesn't crash
    const result = await signPdf({ pdfBytes: input, elements })
    expect(result.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npm test -- src/lib/__tests__/pdf-signer.test.ts`
Expected: All PASS

- [ ] **Step 3: Fix any failures, then commit**

```bash
git add src/lib/__tests__/pdf-signer.test.ts
git commit -m "test: add pdf-signer.ts deep tests"
```

---

### Task 4: counter.ts Tests

**Files:**
- Create: `src/lib/__tests__/counter.test.ts`
- Reference: `src/lib/counter.ts`, `src/lib/auth.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockInvoke = vi.fn()

vi.mock("../auth", () => ({
  supabase: {
    functions: {
      invoke: (...args: any[]) => mockInvoke(...args),
    },
  },
}))

import { checkSignLimit, incrementSignCount } from "../counter"

describe("checkSignLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns parsed response on success", async () => {
    mockInvoke.mockResolvedValue({
      data: { allowed: true, isPro: false, used: 0, limit: 1 },
      error: null,
    })
    const result = await checkSignLimit()
    expect(result).toEqual({ allowed: true, isPro: false, used: 0, limit: 1 })
    expect(mockInvoke).toHaveBeenCalledWith("check-limit")
  })

  it("returns allowed: false when limit reached", async () => {
    mockInvoke.mockResolvedValue({
      data: { allowed: false, isPro: false, used: 1, limit: 1 },
      error: null,
    })
    const result = await checkSignLimit()
    expect(result.allowed).toBe(false)
    expect(result.used).toBe(1)
  })

  it("returns graceful degradation on network error", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error("Network error"),
    })
    const result = await checkSignLimit()
    expect(result).toEqual({ allowed: true, isPro: false, used: 0, limit: 1 })
  })
})

describe("incrementSignCount", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls sign-count endpoint", async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null })
    await incrementSignCount()
    expect(mockInvoke).toHaveBeenCalledWith("sign-count")
  })

  it("does not throw on error", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("fail") })
    // Should not throw
    await expect(incrementSignCount()).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npm test -- src/lib/__tests__/counter.test.ts`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/counter.test.ts
git commit -m "test: add counter.ts tests with Supabase mocks"
```

---

### Task 5: payments.ts Tests

**Files:**
- Create: `src/lib/__tests__/payments.test.ts`
- Reference: `src/lib/payments.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetUser = vi.fn()
const mockOpenPaymentPage = vi.fn()

vi.mock("extpay", () => ({
  default: () => ({
    getUser: mockGetUser,
    openPaymentPage: mockOpenPaymentPage,
    startBackground: vi.fn(),
  }),
}))

// Must import AFTER vi.mock
import { checkProStatus, openUpgradePage } from "../payments"

describe("checkProStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns paid status with dates", async () => {
    const paidAt = new Date("2026-04-01")
    mockGetUser.mockResolvedValue({
      paid: true,
      paidAt,
      subscriptionCancelAt: null,
      subscriptionStatus: "active",
    })
    const result = await checkProStatus()
    expect(result.paid).toBe(true)
    expect(result.paidAt).toEqual(paidAt)
    expect(result.subscriptionCancelAt).toBeNull()
    expect(result.subscriptionStatus).toBe("active")
  })

  it("returns unpaid status", async () => {
    mockGetUser.mockResolvedValue({
      paid: false,
      paidAt: null,
      subscriptionCancelAt: null,
      subscriptionStatus: undefined,
    })
    const result = await checkProStatus()
    expect(result.paid).toBe(false)
    expect(result.paidAt).toBeNull()
  })

  it("returns cancellation date when subscription is canceling", async () => {
    const cancelAt = new Date("2026-05-13")
    mockGetUser.mockResolvedValue({
      paid: true,
      paidAt: new Date("2026-04-13"),
      subscriptionCancelAt: cancelAt,
      subscriptionStatus: "active",
    })
    const result = await checkProStatus()
    expect(result.paid).toBe(true)
    expect(result.subscriptionCancelAt).toEqual(cancelAt)
  })

  it("returns safe fallback when ExtPay throws", async () => {
    mockGetUser.mockRejectedValue(new Error("ExtPay not loaded"))
    const result = await checkProStatus()
    expect(result).toEqual({
      paid: false,
      paidAt: null,
      subscriptionCancelAt: null,
    })
  })
})

describe("openUpgradePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls ExtPay openPaymentPage", () => {
    openUpgradePage()
    expect(mockOpenPaymentPage).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npm test -- src/lib/__tests__/payments.test.ts`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/payments.test.ts
git commit -m "test: add payments.ts tests with ExtPay mocks"
```

---

### Task 6: check-limit Edge Function Tests

**Files:**
- Create: `supabase/functions/__tests__/check-limit.test.ts`
- Reference: `supabase/functions/check-limit/index.ts`

- [ ] **Step 1: Write tests**

The edge function uses `Deno.serve` and `createClient` from esm.sh. We mock both and test the handler directly.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

// Capture the handler passed to Deno.serve
let handler: (req: Request) => Promise<Response>

const mockGetUser = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()

vi.stubGlobal("Deno", {
  env: {
    get: (key: string) => ({
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    })[key],
  },
  serve: (fn: any) => { handler = fn },
})

// Mock createClient — returns different clients based on key
vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: (_url: string, key: string) => {
    if (key === "anon-key") {
      return { auth: { getUser: mockGetUser } }
    }
    // service role client
    return {
      from: () => ({
        select: () => {
          mockSelect()
          return {
            eq: () => {
              mockEq()
              return Promise.resolve({ data: [] })
            },
          }
        },
      }),
    }
  },
}))

// Import triggers Deno.serve which captures the handler
await import("../../check-limit/index.ts")

describe("check-limit edge function", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 without auth header", async () => {
    const req = new Request("http://localhost/check-limit", { method: "POST" })
    const res = await handler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Missing authorization header")
  })

  it("returns 401 for invalid token", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("bad token") })
    const req = new Request("http://localhost/check-limit", {
      method: "POST",
      headers: { authorization: "Bearer bad-token" },
    })
    const res = await handler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Invalid token")
  })

  it("returns allowed: true for 0 usage", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null })
    // Override the service role client to return empty usage
    vi.mocked(mockEq).mockImplementation(() => Promise.resolve({ data: [] }))
    const req = new Request("http://localhost/check-limit", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
    })
    const res = await handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.allowed).toBe(true)
    expect(body.used).toBe(0)
    expect(body.limit).toBe(1)
  })

  it("returns CORS headers for OPTIONS", async () => {
    const req = new Request("http://localhost/check-limit", { method: "OPTIONS" })
    const res = await handler(req)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*")
  })
})
```

Note: The mock chain for Supabase service client is complex. If the chained `.from().select().eq()` mock proves fragile, simplify by extracting the Supabase query into a helper function in the edge function and mocking that instead. Adjust during implementation as needed.

- [ ] **Step 2: Run tests**

Run: `npm test -- supabase/functions/__tests__/check-limit.test.ts`
Expected: All PASS (or adjust mocks to match actual chaining)

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/__tests__/check-limit.test.ts
git commit -m "test: add check-limit edge function tests"
```

---

### Task 7: sign-count Edge Function Tests

**Files:**
- Create: `supabase/functions/__tests__/sign-count.test.ts`
- Reference: `supabase/functions/sign-count/index.ts`

- [ ] **Step 1: Write tests**

Same mock pattern as check-limit. Key scenarios:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

let handler: (req: Request) => Promise<Response>

const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()

vi.stubGlobal("Deno", {
  env: {
    get: (key: string) => ({
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    })[key],
  },
  serve: (fn: any) => { handler = fn },
})

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: (_url: string, key: string) => {
    if (key === "anon-key") {
      return { auth: { getUser: mockGetUser } }
    }
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: mockSingle,
            }),
          }),
        }),
        insert: mockInsert,
        update: () => ({
          eq: mockUpdate,
        }),
      }),
    }
  },
}))

await import("../../sign-count/index.ts")

describe("sign-count edge function", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null })
  })

  it("returns 401 without auth header", async () => {
    const req = new Request("http://localhost/sign-count", { method: "POST" })
    const res = await handler(req)
    expect(res.status).toBe(401)
  })

  it("inserts new row for first usage", async () => {
    mockSingle.mockResolvedValue({ data: null })
    mockInsert.mockResolvedValue({ error: null })
    const req = new Request("http://localhost/sign-count", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
    })
    const res = await handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.new_count).toBe(1)
    expect(mockInsert).toHaveBeenCalled()
  })

  it("updates existing row for repeat usage", async () => {
    mockSingle.mockResolvedValue({ data: { id: "row-1", count: 2 } })
    mockUpdate.mockResolvedValue({ error: null })
    const req = new Request("http://localhost/sign-count", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
    })
    const res = await handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.new_count).toBe(3)
  })

  it("returns CORS headers for OPTIONS", async () => {
    const req = new Request("http://localhost/sign-count", { method: "OPTIONS" })
    const res = await handler(req)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*")
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npm test -- supabase/functions/__tests__/sign-count.test.ts`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/__tests__/sign-count.test.ts
git commit -m "test: add sign-count edge function tests"
```

---

### Task 8: Full Suite Run and Final Commit

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All test files pass, zero failures

- [ ] **Step 2: Commit any remaining changes**

```bash
git add -A
git commit -m "test: complete test suite — fonts, pdf-signer, counter, payments, edge functions"
git push origin main
```
