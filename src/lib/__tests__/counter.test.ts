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

  it("returns graceful degradation on null data with no error", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null })
    const result = await checkSignLimit()
    expect(result).toEqual({ allowed: true, isPro: false, used: 0, limit: 1 })
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
