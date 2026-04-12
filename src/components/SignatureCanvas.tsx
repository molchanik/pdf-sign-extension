import React, { useCallback, useEffect, useRef, useState } from "react"
import SignaturePad from "signature_pad"

import { loadSignature, saveSignature } from "~lib/storage"
import { trimCanvas } from "~lib/signature-trim"

interface Props {
  onSignatureChange: (dataUrl: string | null) => void
  onSave?: () => void
}

const PEN_PRESETS = [
  { label: "Fine", min: 0.5, max: 1.5 },
  { label: "Medium", min: 1.5, max: 3 },
  { label: "Thick", min: 3, max: 5.5 },
  { label: "Marker", min: 5, max: 8 },
]

export function SignatureCanvas({ onSignatureChange, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const [hasSaved, setHasSaved] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)
  const [canvasHeight, setCanvasHeight] = useState(120)
  const [penPreset, setPenPreset] = useState(1) // index into PEN_PRESETS, default Medium

  const initPad = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const existingData = padRef.current?.toData() || []

    if (padRef.current) {
      padRef.current.off()
    }

    const w = container.clientWidth
    canvas.width = w
    canvas.height = canvasHeight

    const scale = canvasHeight / 120
    const preset = PEN_PRESETS[penPreset]
    const pad = new SignaturePad(canvas, {
      penColor: "#1a1a2e",
      minWidth: preset.min * scale,
      maxWidth: preset.max * scale,
      backgroundColor: "rgba(0,0,0,0)"
    })

    pad.addEventListener("endStroke", () => {
      setIsEmpty(pad.isEmpty())
      const trimmed = trimCanvas(canvas)
      onSignatureChange(trimmed || null)
    })

    padRef.current = pad

    if (existingData.length > 0) {
      pad.fromData(existingData)
      setIsEmpty(false)
    }
  }, [canvasHeight, penPreset, onSignatureChange])

  // Single effect: init pad + check saved signatures
  // Re-runs when canvasHeight or penPreset changes (initPad is recreated)
  useEffect(() => {
    initPad()
  }, [initPad])

  useEffect(() => {
    loadSignature().then((saved) => {
      if (saved) setHasSaved(true)
    })
  }, [])

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = canvasHeight

    const onMove = (ev: MouseEvent) => {
      const newH = Math.min(300, Math.max(80, startHeight + ev.clientY - startY))
      setCanvasHeight(newH)
    }
    const onUp = () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  const handleClear = () => {
    padRef.current?.clear()
    setIsEmpty(true)
    onSignatureChange(null)
  }

  const handleUseSaved = async () => {
    const saved = await loadSignature()
    if (!saved) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1)
      const x = (canvas.width - img.width * scale) / 2
      const y = (canvas.height - img.height * scale) / 2
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale)

      setIsEmpty(false)
      const trimmed = trimCanvas(canvas)
      onSignatureChange(trimmed || null)
    }
    img.src = saved
  }

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const trimmed = trimCanvas(canvas)
    if (trimmed) {
      await saveSignature(trimmed)
      setHasSaved(true)
      onSave?.()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-500">Draw your signature below</p>
      <div ref={containerRef} className="w-full">
        <canvas
          ref={canvasRef}
          className="border border-gray-300 rounded-t cursor-crosshair bg-white w-full"
          style={{ height: canvasHeight }}
        />
        <div
          onMouseDown={handleResizeStart}
          className="h-1 bg-gray-300 hover:bg-blue-400 cursor-ns-resize rounded-b transition-colors"
        />
      </div>

      {/* Pen width selector */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 shrink-0">Pen:</span>
        {PEN_PRESETS.map((preset, i) => (
          <button
            key={preset.label}
            onClick={() => setPenPreset(i)}
            className={`flex-1 text-xs py-1 rounded transition-colors ${
              penPreset === i
                ? "bg-blue-100 text-blue-700 border border-blue-300"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
            title={preset.label}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={handleClear} disabled={isEmpty} className="btn-secondary text-xs py-1 px-3">
          Clear
        </button>
        {hasSaved && (
          <button onClick={handleUseSaved} className="btn-secondary text-xs py-1 px-3">
            Use saved
          </button>
        )}
        {!isEmpty && (
          <button onClick={handleSave} className="btn-secondary text-xs py-1 px-3 ml-auto">
            Save
          </button>
        )}
      </div>
    </div>
  )
}
