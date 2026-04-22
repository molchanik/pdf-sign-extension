import { describe, it, expect, vi, beforeEach } from "vitest"

let handler: (req: Request) => Promise<Response>

const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockInsert = vi.fn()
const mockUpdateEq = vi.fn()

vi.mock("../_shared/rate-limit.ts", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  RateLimitError: class RateLimitError extends Error {},
}))

vi.stubGlobal("Deno", {
  env: {
    get: (key: string) => ({
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    }[key]),
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
          eq: mockUpdateEq,
        }),
      }),
    }
  },
}))

await import("../sign-count/index.ts")

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
    mockUpdateEq.mockResolvedValue({ error: null })
    const req = new Request("http://localhost/sign-count", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
    })
    const res = await handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.new_count).toBe(3)
  })

  it("returns 500 when insert fails", async () => {
    mockSingle.mockResolvedValue({ data: null })
    mockInsert.mockResolvedValue({ error: new Error("constraint violation") })
    const req = new Request("http://localhost/sign-count", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
    })
    const res = await handler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Failed to record usage")
  })

  it("returns 500 when update fails", async () => {
    mockSingle.mockResolvedValue({ data: { id: "row-1", count: 2 } })
    mockUpdateEq.mockResolvedValue({ error: new Error("timeout") })
    const req = new Request("http://localhost/sign-count", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
    })
    const res = await handler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Failed to update usage")
  })

  it("returns CORS headers for OPTIONS", async () => {
    const req = new Request("http://localhost/sign-count", { method: "OPTIONS" })
    const res = await handler(req)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*")
  })

  it("returns 429 when rate limit exceeded", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    })
    const { enforceRateLimit, RateLimitError } = await import("../_shared/rate-limit.ts")
    ;(enforceRateLimit as any).mockRejectedValueOnce(
      new RateLimitError("sign-count", "user-1")
    )
    const req = new Request("http://localhost/sign-count", {
      method: "POST",
      headers: { authorization: "Bearer good-token" },
    })
    const res = await handler(req)
    expect(res.status).toBe(429)
  })
})
