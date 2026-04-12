import React, { useCallback, useEffect, useRef, useState } from "react"

interface ResizableOverlayProps {
  x: number
  y: number
  width: number
  height: number
  maxWidth: number
  maxHeight: number
  selected: boolean
  proportional: boolean
  onMove: (x: number, y: number) => void
  onResize: (width: number, height: number) => void
  onClick: (e: React.MouseEvent) => void
  onDoubleClick?: (e: React.MouseEvent) => void
  children: React.ReactNode
}

const MIN_W = 30
const MIN_H = 10
const HANDLE_SIZE = 8

export function ResizableOverlay({
  x, y, width, height, maxWidth, maxHeight,
  selected, proportional,
  onMove, onResize, onClick, onDoubleClick,
  children,
}: ResizableOverlayProps) {
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState<string | null>(null)
  const startRef = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0, aspect: 1 })

  // Keep current props in refs to avoid re-creating mousemove handler
  const propsRef = useRef({ width, height, maxWidth, maxHeight, proportional })
  propsRef.current = { width, height, maxWidth, maxHeight, proportional }

  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove
  const onResizeRef = useRef(onResize)
  onResizeRef.current = onResize

  const handleDragStart = (e: React.MouseEvent) => {
    if (resizing) return
    e.stopPropagation()
    e.preventDefault()
    setDragging(true)
    startRef.current = { mx: e.clientX, my: e.clientY, x, y, w: width, h: height, aspect: width / (height || 1) }
  }

  const handleResizeStart = (corner: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setResizing(corner)
    // Capture initial aspect ratio at resize start — prevents drift
    startRef.current = { mx: e.clientX, my: e.clientY, x, y, w: width, h: height, aspect: width / (height || 1) }
  }

  // Stable handler — reads from refs, never re-created
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const s = startRef.current
    const p = propsRef.current
    const dx = e.clientX - s.mx
    const dy = e.clientY - s.my

    if (dragging) {
      const nx = Math.max(0, Math.min(p.maxWidth - p.width, s.x + dx))
      const ny = Math.max(0, Math.min(p.maxHeight - p.height, s.y + dy))
      onMoveRef.current(nx, ny)
      return
    }

    if (resizing) {
      let newW = s.w
      let newH = s.h
      let newX = s.x
      let newY = s.y

      if (p.proportional) {
        const aspect = s.aspect
        if (resizing === "br") {
          newW = Math.max(MIN_W, Math.min(p.maxWidth - s.x, s.w + dx))
          newH = newW / aspect
        } else if (resizing === "bl") {
          newW = Math.max(MIN_W, Math.min(s.x + s.w, s.w - dx))
          newH = newW / aspect
          newX = s.x + s.w - newW
        } else if (resizing === "tr") {
          newW = Math.max(MIN_W, Math.min(p.maxWidth - s.x, s.w + dx))
          newH = newW / aspect
          newY = s.y + s.h - newH
        } else {
          newW = Math.max(MIN_W, Math.min(s.x + s.w, s.w - dx))
          newH = newW / aspect
          newX = s.x + s.w - newW
          newY = s.y + s.h - newH
        }
      } else {
        if (resizing === "br") {
          newW = Math.max(MIN_W, Math.min(p.maxWidth - s.x, s.w + dx))
          newH = Math.max(MIN_H, Math.min(p.maxHeight - s.y, s.h + dy))
        } else if (resizing === "bl") {
          newW = Math.max(MIN_W, Math.min(s.x + s.w, s.w - dx))
          newH = Math.max(MIN_H, Math.min(p.maxHeight - s.y, s.h + dy))
          newX = s.x + s.w - newW
        } else if (resizing === "tr") {
          newW = Math.max(MIN_W, Math.min(p.maxWidth - s.x, s.w + dx))
          newH = Math.max(MIN_H, Math.min(s.y + s.h, s.h - dy))
          newY = s.y + s.h - newH
        } else {
          newW = Math.max(MIN_W, Math.min(s.x + s.w, s.w - dx))
          newH = Math.max(MIN_H, Math.min(s.y + s.h, s.h - dy))
          newX = s.x + s.w - newW
          newY = s.y + s.h - newH
        }
      }

      if (newY >= 0 && newY + newH <= p.maxHeight) {
        onResizeRef.current(newW, newH)
        onMoveRef.current(newX, newY)
      }
    }
  }, [dragging, resizing])

  const handleMouseUp = useCallback(() => {
    setDragging(false)
    setResizing(null)
  }, [])

  useEffect(() => {
    if (dragging || resizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [dragging, resizing, handleMouseMove, handleMouseUp])

  const corners = [
    { id: "tl", cls: "top-0 left-0 -translate-x-1/2 -translate-y-1/2", cursor: "nwse-resize" },
    { id: "tr", cls: "top-0 right-0 translate-x-1/2 -translate-y-1/2", cursor: "nesw-resize" },
    { id: "bl", cls: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2", cursor: "nesw-resize" },
    { id: "br", cls: "bottom-0 right-0 translate-x-1/2 translate-y-1/2", cursor: "nwse-resize" },
  ]

  return (
    <div
      data-element-overlay
      className="absolute"
      style={{ left: x, top: y, width, height, cursor: dragging ? "grabbing" : "grab" }}
      onMouseDown={handleDragStart}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {children}

      <div className={`absolute inset-0 border-2 border-dashed rounded transition-opacity ${
        selected ? "border-blue-500 opacity-100" : "border-gray-400 opacity-0 hover:opacity-50"
      }`} />

      {selected && corners.map(({ id, cls, cursor }) => (
        <div
          key={id}
          className={`absolute ${cls} bg-blue-500 border border-white rounded-sm`}
          style={{ width: HANDLE_SIZE, height: HANDLE_SIZE, cursor }}
          onMouseDown={handleResizeStart(id)}
        />
      ))}
    </div>
  )
}
