import { describe, it, expect, vi, beforeEach } from "vitest"

let handler: (req: Request) => Promise<Response>

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

vi.mock("../_shared/rate-limit.ts", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  RateLimitError: class RateLimitError extends Error {},
}))

vi.stubGlobal("Deno", {
  env: {
    get: (key: string) => ({
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      OAUTH_CLIENT_IDS:
        "836027625583-prod.apps.googleusercontent.com," +
        "836027625583-dev.apps.googleusercontent.com",
    }[key]),
  },
  serve: (fn: any) => { handler = fn },
})

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: () => ({
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({ data: null, error: null }),
        generateLink: vi.fn().mockResolvedValue({
          data: { properties: { hashed_token: "hash-abc" } },
          error: null,
        }),
      },
    },
  }),
}))

await import("../google-signin/index.ts")

describe("google-signin — aud check", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("accepts token when aud matches prod client id", async () => {
    // userinfo
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      email: "user@example.com",
      sub: "google-sub-1",
    })))
    // tokeninfo
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      aud: "836027625583-prod.apps.googleusercontent.com",
    })))

    const req = new Request("http://localhost/google-signin", {
      method: "POST",
      body: JSON.stringify({ google_access_token: "valid-token" }),
    })
    const res = await handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.token_hash).toBe("hash-abc")
  })

  it("rejects token with unexpected aud", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      email: "user@example.com",
      sub: "google-sub-1",
    })))
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      aud: "evil-attacker.apps.googleusercontent.com",
    })))

    const req = new Request("http://localhost/google-signin", {
      method: "POST",
      body: JSON.stringify({ google_access_token: "stolen-token" }),
    })
    const res = await handler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/audience|aud/i)
  })

  it("returns 429 when rate limit exceeded", async () => {
    const { enforceRateLimit, RateLimitError } = await import("../_shared/rate-limit.ts")
    ;(enforceRateLimit as any).mockRejectedValueOnce(
      new RateLimitError("google-signin", "1.2.3.4")
    )
    const req = new Request("http://localhost/google-signin", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
      body: JSON.stringify({ google_access_token: "any-token" }),
    })
    const res = await handler(req)
    expect(res.status).toBe(429)
  })
})
