import { describe, it, expect, vi, beforeEach } from "vitest"

// Capture the handler passed to Deno.serve
let handler: (req: Request) => Promise<Response>

const mockGetUser = vi.fn()
const mockUsageData = vi.fn<() => any[]>(() => [])

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
          eq: () => Promise.resolve({ data: mockUsageData() }),
        }),
      }),
    }
  },
}))

// Import triggers Deno.serve which captures the handler
await import("../check-limit/index.ts")

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

  it("returns allowed: false when usage reaches limit", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null })
    mockUsageData.mockReturnValue([{ count: 1 }])
    const req = new Request("http://localhost/check-limit", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
    })
    const res = await handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.allowed).toBe(false)
    expect(body.used).toBe(1)
    expect(body.limit).toBe(1)
  })

  it("returns CORS headers for OPTIONS", async () => {
    const req = new Request("http://localhost/check-limit", { method: "OPTIONS" })
    const res = await handler(req)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*")
  })
})
