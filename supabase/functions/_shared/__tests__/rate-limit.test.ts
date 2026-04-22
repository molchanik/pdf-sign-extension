import { describe, it, expect, vi, beforeEach } from "vitest"

const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockSelect = vi.fn<() => { count: number | null; error: null | Error }>(
  () => ({ count: 0, error: null })
)

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: () => ({
    from: () => ({
      insert: mockInsert,
      select: () => ({
        eq: () => ({
          eq: () => ({
            gte: () => Promise.resolve(mockSelect()),
          }),
        }),
      }),
    }),
  }),
}))

vi.stubGlobal("Deno", {
  env: {
    get: (key: string) => ({
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    }[key]),
  },
})

import { enforceRateLimit } from "../rate-limit"

describe("enforceRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("allows request when count is below limit", async () => {
    mockSelect.mockReturnValue({ count: 5, error: null })
    await expect(
      enforceRateLimit({ endpoint: "check-limit", subject: "user-1", maxPerMinute: 30 })
    ).resolves.toBeUndefined()
    expect(mockInsert).toHaveBeenCalledOnce()
  })

  it("throws RateLimitError when over limit", async () => {
    mockSelect.mockReturnValue({ count: 30, error: null })
    await expect(
      enforceRateLimit({ endpoint: "check-limit", subject: "user-1", maxPerMinute: 30 })
    ).rejects.toThrow(/rate limit/i)
    expect(mockInsert).not.toHaveBeenCalled()
  })
})
