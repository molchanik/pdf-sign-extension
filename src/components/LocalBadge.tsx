import React from "react"

export function LocalBadge() {
  return (
    <div className="flex items-center gap-1.5 py-1 px-2 bg-green-50 rounded text-xs text-green-700">
      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      Processing locally &middot; no upload
    </div>
  )
}
