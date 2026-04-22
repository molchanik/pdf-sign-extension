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

  it("throws when check-limit returns an error", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error("Network error"),
    })
    await expect(checkSignLimit()).rejects.toThrow(/verify|usage|try again/i)
  })

  it("throws when check-limit returns null data", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null })
    await expect(checkSignLimit()).rejects.toThrow(/verify|usage|try again/i)
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

  it("throws on invoke error", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error("fail") })
    await expect(incrementSignCount()).rejects.toThrow(/record|sign/i)
  })
})
