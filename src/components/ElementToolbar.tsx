import React from "react"

import type { ActiveMode } from "~lib/types"

interface ElementToolbarProps {
  activeMode: ActiveMode
  onModeChange: (mode: ActiveMode) => void
}

export function ElementToolbar({ activeMode, onModeChange }: ElementToolbarProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onModeChange(activeMode === "place-signature" ? "select" : "place-signature")}
        className={`flex-1 text-xs py-2 px-3 rounded font-medium transition-colors ${
          activeMode === "place-signature"
            ? "bg-blue-100 text-blue-700 border border-blue-300"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        + Signature
      </button>
      <button
        onClick={() => onModeChange(activeMode === "place-text" ? "select" : "place-text")}
        className={`flex-1 text-xs py-2 px-3 rounded font-medium transition-colors ${
          activeMode === "place-text"
            ? "bg-blue-100 text-blue-700 border border-blue-300"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        + Text
      </button>
    </div>
  )
}
