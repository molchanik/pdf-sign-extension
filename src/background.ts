/**
 * Service Worker for PDF Sign extension (Manifest V3).
 *
 * Responsibilities:
 * - Handle auth callback from chrome.identity
 * - Listen for ExtensionPay payment events
 * - Background tasks that don't need the popup open
 */

import ExtPay from "extpay"

const extpay = ExtPay(process.env.PLASMO_PUBLIC_EXTPAY_ID || "pdf-sign")
extpay.startBackground()

export {}

chrome.runtime.onInstalled.addListener(() => {
  // no-op: keeps service worker registered
})

// Handle messages from popup (e.g., auth flow completion)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "AUTH_COMPLETE") {
    // Notify popup that auth is done
    sendResponse({ success: true })
  }
  return true
})
