/**
 * ExtensionPay integration for Chrome Extension payments.
 * ExtensionPay is loaded as a content script — the global `extPay` object
 * is injected by their library. This module provides typed wrappers.
 *
 * Setup: add ExtensionPay script to manifest via Plasmo config.
 * See https://extensionpay.com for integration docs.
 */

declare const ExtPay: (id: string) => ExtPayInstance

interface ExtPayInstance {
  openPaymentPage: () => void
  getUser: () => Promise<{ paid: boolean; paidAt?: string; trialStartedAt?: string }>
  onPaid: { addListener: (cb: (user: { paid: boolean }) => void) => void }
}

let extPayInstance: ExtPayInstance | null = null

function getExtPay(): ExtPayInstance {
  if (!extPayInstance) {
    extPayInstance = ExtPay(process.env.PLASMO_PUBLIC_EXTPAY_ID || "pdf-sign")
  }
  return extPayInstance
}

export function openUpgradePage(): void {
  try {
    getExtPay().openPaymentPage()
  } catch {
    // Fallback: open ExtensionPay page directly
    chrome.tabs.create({
      url: "https://extensionpay.com/extension/pdf-sign"
    })
  }
}

export async function checkProStatus(): Promise<boolean> {
  try {
    const user = await getExtPay().getUser()
    return user.paid
  } catch {
    return false
  }
}

export function onPaymentComplete(callback: () => void): void {
  try {
    getExtPay().onPaid.addListener(() => callback())
  } catch {
    // ExtensionPay not loaded
  }
}
