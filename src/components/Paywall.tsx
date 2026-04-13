import React from "react"

import { openUpgradePage } from "~lib/payments"

interface Props {
  used: number
  limit: number
  onClose: () => void
}

export function Paywall({ used, limit, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 mx-4 max-w-sm w-full">
        <div className="text-center">
          <div className="text-3xl mb-2">&#x1F512;</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Free limit reached
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Your free file has been used. Upgrade to Pro for unlimited signing.
          </p>

          <div className="bg-blue-50 rounded-lg p-3 mb-4 text-left">
            <p className="text-sm font-medium text-blue-900 mb-1">
              Pro — $2.99/mo or $29.99/yr
            </p>
            <ul className="text-xs text-blue-700 space-y-0.5">
              <li>&#x2713; Unlimited files</li>
              <li>&#x2713; All fonts</li>
            </ul>
          </div>

          <button
            onClick={() => openUpgradePage()}
            className="btn-primary w-full mb-2">
            Upgrade to Pro
          </button>
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-600">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
