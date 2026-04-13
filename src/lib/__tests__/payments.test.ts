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
