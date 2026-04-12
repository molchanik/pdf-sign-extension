import React, { useEffect, useRef } from "react"

import { getFontDef } from "~lib/fonts"
import type { TextElement } from "~lib/types"

interface TextOverlayContentProps {
  element: TextElement
  isEditing: boolean
  onTextChange: (text: string) => void
  onEditDone: () => void
}

export function TextOverlayContent({ element, isEditing, onTextChange, onEditDone }: TextOverlayContentProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.select()
        }
      })
    }
  }, [isEditing])

  const fontWeight = element.bold ? "bold" : "normal"
  const fontStyle = element.italic ? "italic" : "normal"

  const fontDef = getFontDef(element.fontFamily)
  const baseStyle: React.CSSProperties = {
    fontFamily: fontDef?.cssFallback || element.fontFamily,
    fontSize: element.fontSize,
    color: element.color,
    fontWeight,
    fontStyle,
    lineHeight: 1.3,
    width: "100%",
    height: "100%",
    overflow: "hidden",
    wordWrap: "break-word",
  }

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={element.text}
        onChange={(e) => onTextChange(e.target.value)}
        onBlur={onEditDone}
        onKeyDown={(e) => {
          if (e.key === "Escape") onEditDone()
          e.stopPropagation()
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className="resize-none border-none outline-none bg-transparent p-0 m-0"
        style={{ ...baseStyle, cursor: "text" }}
      />
    )
  }

  return (
    <div className="pointer-events-none select-none p-0 m-0" style={baseStyle}>
      {element.text || <span className="text-gray-400">Type here</span>}
    </div>
  )
}
