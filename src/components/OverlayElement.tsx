import React from "react"

import type { PlacedElement } from "~lib/types"

import { ResizableOverlay } from "./ResizableOverlay"
import { TextOverlayContent } from "./TextOverlayContent"

interface OverlayElementProps {
  element: PlacedElement
  selected: boolean
  isEditing: boolean
  maxWidth: number
  maxHeight: number
  onSelect: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
  onResize: (id: string, w: number, h: number) => void
  onDoubleClick: (id: string) => void
  onTextChange: (id: string, text: string) => void
  onEditDone: () => void
}

export function OverlayElement({
  element, selected, isEditing, maxWidth, maxHeight,
  onSelect, onMove, onResize, onDoubleClick, onTextChange, onEditDone,
}: OverlayElementProps) {
  return (
    <ResizableOverlay
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      selected={selected}
      proportional={element.type === "signature"}
      onMove={(x, y) => onMove(element.id, x, y)}
      onResize={(w, h) => onResize(element.id, w, h)}
      onClick={(e) => { e.stopPropagation(); onSelect(element.id) }}
      onDoubleClick={() => onDoubleClick(element.id)}
    >
      {element.type === "signature" ? (
        <img
          src={element.dataUrl}
          alt="Signature"
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
        />
      ) : (
        <TextOverlayContent
          element={element}
          isEditing={isEditing}
          onTextChange={(text) => onTextChange(element.id, text)}
          onEditDone={onEditDone}
        />
      )}
    </ResizableOverlay>
  )
}
