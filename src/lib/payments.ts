import ExtPay from "extpay"

const EXTPAY_ID = process.env.PLASMO_PUBLIC_EXTPAY_ID || "pdf-sign"

let extPayInstance: ReturnType<typeof ExtPay> | null = null

function getExtPay() {
  if (!extPayInstance) {
    extPayInstance = ExtPay(EXTPAY_ID)
  }
  return extPayInstance
}

export function openUpgradePage(): void {
  getExtPay().openPaymentPage()
}

export interface ProStatus {
  paid: boolean
  paidAt: Date | null
  subscriptionCancelAt: Date | null
  subscriptionStatus?: "active" | "past_due" | "canceled"
}

export async function checkProStatus(): Promise<ProStatus> {
  try {
    const user = await getExtPay().getUser()
    return {
      paid: user.paid,
      paidAt: user.paidAt,
      subscriptionCancelAt: user.subscriptionCancelAt ?? null,
      subscriptionStatus: user.subscriptionStatus,
    }
  } catch {
    return { paid: false, paidAt: null, subscriptionCancelAt: null }
  }
}

export function onPaymentComplete(callback: () => void): void {
  try {
    getExtPay().onPaid.addListener(() => callback())
  } catch {
    // ExtensionPay not loaded
  }
}
