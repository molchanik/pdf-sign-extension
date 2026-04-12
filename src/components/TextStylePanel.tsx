import React from "react"

import { FONTS } from "~lib/fonts"
import type { TextElement } from "~lib/types"

interface TextStylePanelProps {
  element: TextElement
  onChange: (updates: Partial<TextElement>) => void
  onDelete: () => void
}

const COLORS = [
  { value: "#000000", label: "Black" },
  { value: "#0000FF", label: "Blue" },
  { value: "#FF0000", label: "Red" },
]

export function TextStylePanel({ element, onChange, onDelete }: TextStylePanelProps) {
  const currentFont = FONTS.find(f => f.id === element.fontFamily)

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Text Style</h3>

      <select
        value={element.fontFamily}
        onChange={(e) => onChange({ fontFamily: e.target.value })}
        className="text-sm border border-gray-300 rounded px-2 py-1"
        style={{ fontFamily: currentFont?.cssFallback }}
      >
        {FONTS.map(f => (
          <option key={f.id} value={f.id} style={{ fontFamily: f.cssFallback }}>
            {f.label}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Size</label>
        <input
          type="number"
          min={12}
          max={72}
          value={element.fontSize}
          onChange={(e) => onChange({ fontSize: Math.max(12, Math.min(72, Number(e.target.value))) })}
          className="w-16 text-sm border border-gray-300 rounded px-2 py-1"
        />
      </div>

      <div className="flex items-center gap-1">
        {COLORS.map(c => (
          <button
            key={c.value}
            onClick={() => onChange({ color: c.value })}
            className={`w-6 h-6 rounded-full border-2 ${element.color === c.value ? "border-blue-500" : "border-gray-300"}`}
            style={{ backgroundColor: c.value }}
            title={c.label}
          />
        ))}
        <input
          type="color"
          value={element.color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="w-6 h-6 rounded cursor-pointer border border-gray-300"
          title="Custom color"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onChange({ bold: !element.bold })}
          className={`px-3 py-1 text-sm font-bold rounded ${element.bold ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}
        >
          B
        </button>
        <button
          onClick={() => onChange({ italic: !element.italic })}
          className={`px-3 py-1 text-sm italic rounded ${element.italic ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}
        >
          I
        </button>
      </div>

      <button onClick={onDelete} className="btn-secondary text-xs py-1 text-red-500 hover:text-red-700">
        Delete element
      </button>
    </div>
  )
}
