import React from "react"

interface SizeSliderProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

export function SizeSlider({ value, onChange, disabled = false }: SizeSliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">Signature size</label>
        <span className="text-xs text-gray-400">{value}%</span>
      </div>
      <input
        type="range"
        min={25}
        max={200}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-40"
      />
    </div>
  )
}
