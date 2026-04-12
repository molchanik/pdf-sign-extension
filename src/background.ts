/**
 * Service Worker for PDF Sign extension (Manifest V3).
 *
 * Responsibilities:
 * - Handle auth callback from chrome.identity
 * - Listen for ExtensionPay payment events
 * - Background tasks that don't need the popup open
 */

export {}

// Keep service worker alive for auth callbacks
chrome.runtime.onInstalled.addListener(() => {
  console.log("PDF Sign extension installed")
})

// Handle messages from popup (e.g., auth flow completion)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "AUTH_COMPLETE") {
    // Notify popup that auth is done
    sendResponse({ success: true })
  }
  return true
})
