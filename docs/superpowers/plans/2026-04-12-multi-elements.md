# Multi-Element Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support multiple signatures and text fields on any page, with unified drag/resize, text formatting, saved signature library, and batch embedding into the final PDF.

**Architecture:** A unified `PlacedElement` type (signature | text) stored in an `elements[]` array. One `ResizableOverlay` component handles drag/resize for all element types. The sidebar becomes context-sensitive based on `activeMode` and `selectedId`. `signPdf` accepts an array of elements instead of a single signature.

**Tech Stack:** React 18, TypeScript, pdf-lib (StandardFonts for text), signature_pad, Tailwind CSS, Plasmo.

**Spec:** `docs/superpowers/specs/2026-04-12-multi-elements-design.md`

---

## File Structure

```
src/
├── tabs/
│   └── editor.tsx                     # REWRITE — new state machine, elements[], activeMode
├── lib/
│   ├── pdf-signer.ts                  # REWRITE — accept elements[], render text with drawText
│   ├── storage.ts                     # REWRITE — multi-signature storage + migration
│   └── types.ts                       # NEW — shared PlacedElement types
├── components/
│   ├── ResizableOverlay.tsx            # NEW — generic drag+resize, replaces ResizableSignature
│   ├── OverlayElement.tsx             # NEW — renders one PlacedElement (img or text) inside overlay
│   ├── TextOverlayContent.tsx         # NEW — text display + inline editing
│   ├── SavedSignatureGrid.tsx         # NEW — grid of saved signature thumbnails
│   ├── TextStylePanel.tsx             # NEW — font/size/color/bold/italic controls
│   ├── ElementToolbar.tsx             # NEW — [+ Signature] [+ Text] buttons
│   ├── EditorSidebar.tsx              # REWRITE — context-sensitive panel
│   ├── ScrollablePdfViewer.tsx        # MODIFY — overlay data attr rename
│   ├── SignatureCanvas.tsx            # UNCHANGED
│   ├── EditorHeader.tsx               # MODIFY — canSign logic change
│   ├── SizeSlider.tsx                 # UNCHANGED (reused inside sidebar)
│   ├── PageIndicator.tsx              # UNCHANGED
│   ├── LocalBadge.tsx                 # UNCHANGED
│   ├── Paywall.tsx                    # UNCHANGED
│   └── FileDropzone.tsx               # UNCHANGED
```

---

### Task 1: Create shared types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Create types.ts with all shared type definitions**

```typescript
// src/lib/types.ts

export interface PlacedElementBase {
  id: string
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
}

export interface SignatureElement extends PlacedElementBase {
  type: "signature"
  dataUrl: string
}

export interface TextElement extends PlacedElementBase {
  type: "text"
  text: string
  fontFamily: "Helvetica" | "Times-Roman" | "Courier"
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
}

export type PlacedElement = SignatureElement | TextElement

export type ActiveMode = "select" | "place-signature" | "place-text"

export interface SavedSignature {
  id: string
  dataUrl: string
  createdAt: number
}
```

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

---

### Task 2: Rewrite storage.ts for multi-signature

**Files:**
- Rewrite: `src/lib/storage.ts`

- [ ] **Step 1: Replace storage.ts with multi-signature support + migration**

```typescript
// src/lib/storage.ts
import type { SavedSignature } from "./types"

const OLD_KEY = "pdf_sign_saved_signature"
const NEW_KEY = "pdf_sign_saved_signatures"
const MAX_SAVED = 10

async function migrate(): Promise<void> {
  const result = await chrome.storage.local.get([OLD_KEY, NEW_KEY])
  if (result[OLD_KEY] && !result[NEW_KEY]) {
    const migrated: SavedSignature[] = [{
      id: crypto.randomUUID(),
      dataUrl: result[OLD_KEY],
      createdAt: Date.now(),
    }]
    await chrome.storage.local.set({ [NEW_KEY]: JSON.stringify(migrated) })
    await chrome.storage.local.remove(OLD_KEY)
  }
}

export async function loadSignatures(): Promise<SavedSignature[]> {
  await migrate()
  const result = await chrome.storage.local.get(NEW_KEY)
  if (!result[NEW_KEY]) return []
  try {
    return JSON.parse(result[NEW_KEY])
  } catch {
    return []
  }
}

export async function saveSignatureToLibrary(dataUrl: string): Promise<SavedSignature> {
  const sigs = await loadSignatures()
  const newSig: SavedSignature = {
    id: crypto.randomUUID(),
    dataUrl,
    createdAt: Date.now(),
  }
  const updated = [newSig, ...sigs].slice(0, MAX_SAVED)
  await chrome.storage.local.set({ [NEW_KEY]: JSON.stringify(updated) })
  return newSig
}

export async function deleteSignatureFromLibrary(id: string): Promise<void> {
  const sigs = await loadSignatures()
  const updated = sigs.filter(s => s.id !== id)
  await chrome.storage.local.set({ [NEW_KEY]: JSON.stringify(updated) })
}

// Keep backward-compatible single-signature helpers for SignatureCanvas
export async function saveSignature(dataUrl: string): Promise<void> {
  await saveSignatureToLibrary(dataUrl)
}

export async function loadSignature(): Promise<string | null> {
  const sigs = await loadSignatures()
  return sigs.length > 0 ? sigs[0].dataUrl : null
}
```

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

---

### Task 3: Create ResizableOverlay (generalized from ResizableSignature)

**Files:**
- Create: `src/components/ResizableOverlay.tsx`

- [ ] **Step 1: Create ResizableOverlay component**

This is the existing ResizableSignature logic but accepts `children` instead of a `dataUrl`, adds `selected` prop for border visibility, `proportional` prop to toggle aspect-ratio lock, and `onClick`/`onDoubleClick` handlers.

```typescript
// src/components/ResizableOverlay.tsx
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
  const startRef = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 })
  const aspectRatio = width / (height || 1)

  const handleDragStart = (e: React.MouseEvent) => {
    if (resizing) return
    e.stopPropagation()
    e.preventDefault()
    setDragging(true)
    startRef.current = { mx: e.clientX, my: e.clientY, x, y, w: width, h: height }
  }

  const handleResizeStart = (corner: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setResizing(corner)
    startRef.current = { mx: e.clientX, my: e.clientY, x, y, w: width, h: height }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const s = startRef.current
    const dx = e.clientX - s.mx
    const dy = e.clientY - s.my

    if (dragging) {
      const nx = Math.max(0, Math.min(maxWidth - width, s.x + dx))
      const ny = Math.max(0, Math.min(maxHeight - height, s.y + dy))
      onMove(nx, ny)
    }

    if (resizing) {
      let newW = s.w
      let newH = s.h
      let newX = s.x
      let newY = s.y

      if (proportional) {
        if (resizing === "br") {
          newW = Math.max(MIN_W, Math.min(maxWidth - s.x, s.w + dx))
          newH = newW / aspectRatio
        } else if (resizing === "bl") {
          newW = Math.max(MIN_W, Math.min(s.x + s.w, s.w - dx))
          newH = newW / aspectRatio
          newX = s.x + s.w - newW
        } else if (resizing === "tr") {
          newW = Math.max(MIN_W, Math.min(maxWidth - s.x, s.w + dx))
          newH = newW / aspectRatio
          newY = s.y + s.h - newH
        } else {
          newW = Math.max(MIN_W, Math.min(s.x + s.w, s.w - dx))
          newH = newW / aspectRatio
          newX = s.x + s.w - newW
          newY = s.y + s.h - newH
        }
      } else {
        // Free resize (text elements)
        if (resizing === "br") {
          newW = Math.max(MIN_W, Math.min(maxWidth - s.x, s.w + dx))
          newH = Math.max(MIN_H, Math.min(maxHeight - s.y, s.h + dy))
        } else if (resizing === "bl") {
          newW = Math.max(MIN_W, Math.min(s.x + s.w, s.w - dx))
          newH = Math.max(MIN_H, Math.min(maxHeight - s.y, s.h + dy))
          newX = s.x + s.w - newW
        } else if (resizing === "tr") {
          newW = Math.max(MIN_W, Math.min(maxWidth - s.x, s.w + dx))
          newH = Math.max(MIN_H, Math.min(s.y + s.h, s.h - dy))
          newY = s.y + s.h - newH
        } else {
          newW = Math.max(MIN_W, Math.min(s.x + s.w, s.w - dx))
          newH = Math.max(MIN_H, Math.min(s.y + s.h, s.h - dy))
          newX = s.x + s.w - newW
          newY = s.y + s.h - newH
        }
      }

      if (newY >= 0 && newY + newH <= maxHeight) {
        onResize(newW, newH)
        onMove(newX, newY)
      }
    }
  }, [dragging, resizing, width, height, maxWidth, maxHeight, aspectRatio, proportional, onMove, onResize])

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

      {/* Border: always visible when selected, gray on hover when not selected */}
      <div className={`absolute inset-0 border-2 border-dashed rounded transition-opacity ${
        selected ? "border-blue-500 opacity-100" : "border-gray-400 opacity-0 hover:opacity-50"
      }`} />

      {/* Corner handles: visible when selected */}
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
```

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

---

### Task 4: Create TextOverlayContent

**Files:**
- Create: `src/components/TextOverlayContent.tsx`

- [ ] **Step 1: Create TextOverlayContent component**

```typescript
// src/components/TextOverlayContent.tsx
import React, { useEffect, useRef, useState } from "react"
import type { TextElement } from "~lib/types"

interface TextOverlayContentProps {
  element: TextElement
  isEditing: boolean
  onTextChange: (text: string) => void
  onEditDone: () => void
}

export function TextOverlayContent({ element, isEditing, onTextChange, onEditDone }: TextOverlayContentProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [localText, setLocalText] = useState(element.text)

  useEffect(() => {
    setLocalText(element.text)
  }, [element.text])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  const fontWeight = element.bold ? "bold" : "normal"
  const fontStyle = element.italic ? "italic" : "normal"

  const baseStyle: React.CSSProperties = {
    fontFamily: element.fontFamily,
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
        value={localText}
        onChange={(e) => setLocalText(e.target.value)}
        onBlur={() => { onTextChange(localText); onEditDone() }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { onTextChange(localText); onEditDone() }
          e.stopPropagation() // Don't trigger Delete handler
        }}
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
```

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

---

### Task 5: Create OverlayElement

**Files:**
- Create: `src/components/OverlayElement.tsx`

- [ ] **Step 1: Create OverlayElement — renders one PlacedElement inside ResizableOverlay**

```typescript
// src/components/OverlayElement.tsx
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
```

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

---

### Task 6: Create SavedSignatureGrid

**Files:**
- Create: `src/components/SavedSignatureGrid.tsx`

- [ ] **Step 1: Create SavedSignatureGrid component**

```typescript
// src/components/SavedSignatureGrid.tsx
import React, { useEffect, useState } from "react"
import type { SavedSignature } from "~lib/types"
import { deleteSignatureFromLibrary, loadSignatures } from "~lib/storage"

interface SavedSignatureGridProps {
  selectedId: string | null
  onSelect: (sig: SavedSignature) => void
  refreshTrigger: number  // increment to reload from storage
}

export function SavedSignatureGrid({ selectedId, onSelect, refreshTrigger }: SavedSignatureGridProps) {
  const [signatures, setSignatures] = useState<SavedSignature[]>([])

  useEffect(() => {
    loadSignatures().then(setSignatures)
  }, [refreshTrigger])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteSignatureFromLibrary(id)
    setSignatures(prev => prev.filter(s => s.id !== id))
  }

  if (signatures.length === 0) return null

  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">Saved signatures</p>
      <div className="grid grid-cols-3 gap-2">
        {signatures.map((sig) => (
          <div
            key={sig.id}
            onClick={() => onSelect(sig)}
            className={`relative cursor-pointer border-2 rounded p-1 bg-white hover:border-blue-300 transition-colors ${
              selectedId === sig.id ? "border-blue-500" : "border-gray-200"
            }`}
          >
            <img src={sig.dataUrl} alt="Saved" className="w-full h-8 object-contain" />
            <button
              onClick={(e) => handleDelete(e, sig.id)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs leading-none flex items-center justify-center hover:bg-red-600"
            >
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

---

### Task 7: Create TextStylePanel

**Files:**
- Create: `src/components/TextStylePanel.tsx`

- [ ] **Step 1: Create TextStylePanel component**

```typescript
// src/components/TextStylePanel.tsx
import React from "react"
import type { TextElement } from "~lib/types"

interface TextStylePanelProps {
  element: TextElement
  onChange: (updates: Partial<TextElement>) => void
  onDelete: () => void
}

const FONTS: { value: TextElement["fontFamily"]; label: string }[] = [
  { value: "Helvetica", label: "Helvetica" },
  { value: "Times-Roman", label: "Times" },
  { value: "Courier", label: "Courier" },
]

const COLORS = [
  { value: "#000000", label: "Black" },
  { value: "#0000FF", label: "Blue" },
  { value: "#FF0000", label: "Red" },
]

export function TextStylePanel({ element, onChange, onDelete }: TextStylePanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Text Style</h3>

      {/* Font family */}
      <select
        value={element.fontFamily}
        onChange={(e) => onChange({ fontFamily: e.target.value as TextElement["fontFamily"] })}
        className="text-sm border border-gray-300 rounded px-2 py-1"
      >
        {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>

      {/* Font size */}
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

      {/* Color presets + custom */}
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

      {/* Bold / Italic */}
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

      {/* Delete */}
      <button onClick={onDelete} className="btn-secondary text-xs py-1 text-red-500 hover:text-red-700">
        Delete element
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

---

### Task 8: Create ElementToolbar

**Files:**
- Create: `src/components/ElementToolbar.tsx`

- [ ] **Step 1: Create ElementToolbar component**

```typescript
// src/components/ElementToolbar.tsx
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
```

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

---

### Task 9: Rewrite EditorSidebar (context-sensitive)

**Files:**
- Rewrite: `src/components/EditorSidebar.tsx`

- [ ] **Step 1: Replace EditorSidebar with context-sensitive version**

```typescript
// src/components/EditorSidebar.tsx
import React, { useCallback, useState } from "react"
import type { ActiveMode, PlacedElement, SavedSignature, TextElement } from "~lib/types"
import { saveSignatureToLibrary } from "~lib/storage"
import { ElementToolbar } from "./ElementToolbar"
import { LocalBadge } from "./LocalBadge"
import { SavedSignatureGrid } from "./SavedSignatureGrid"
import { SignatureCanvas } from "./SignatureCanvas"
import { SizeSlider } from "./SizeSlider"
import { TextStylePanel } from "./TextStylePanel"

interface EditorSidebarProps {
  activeMode: ActiveMode
  onModeChange: (mode: ActiveMode) => void
  selectedElement: PlacedElement | null
  onCurrentSignatureReady: (dataUrl: string) => void
  onSavedSignatureSelect: (sig: SavedSignature) => void
  onElementUpdate: (id: string, updates: Partial<PlacedElement>) => void
  onElementDelete: (id: string) => void
  currentPage: number
  totalPages: number
  isPro: boolean
  used: number
  limit: number
}

export function EditorSidebar({
  activeMode, onModeChange,
  selectedElement,
  onCurrentSignatureReady, onSavedSignatureSelect,
  onElementUpdate, onElementDelete,
  currentPage, totalPages,
  isPro, used, limit,
}: EditorSidebarProps) {
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleSignatureChange = useCallback((dataUrl: string | null) => {
    if (dataUrl) {
      setSelectedSavedId(null)
      onCurrentSignatureReady(dataUrl)
    }
  }, [onCurrentSignatureReady])

  const handleSaveSignature = useCallback(async (dataUrl: string) => {
    await saveSignatureToLibrary(dataUrl)
    setRefreshTrigger(prev => prev + 1)
  }, [])

  const handleSavedSelect = useCallback((sig: SavedSignature) => {
    setSelectedSavedId(sig.id)
    onSavedSignatureSelect(sig)
  }, [onSavedSignatureSelect])

  const selectedSig = selectedElement?.type === "signature" ? selectedElement : null
  const selectedText = selectedElement?.type === "text" ? selectedElement as TextElement : null

  return (
    <aside className="editor-sidebar">
      <ElementToolbar activeMode={activeMode} onModeChange={onModeChange} />

      {/* Place signature mode */}
      {activeMode === "place-signature" && (
        <>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Draw new</h3>
            <SignatureCanvas onSignatureChange={handleSignatureChange} />
          </div>
          <SavedSignatureGrid
            selectedId={selectedSavedId}
            onSelect={handleSavedSelect}
            refreshTrigger={refreshTrigger}
          />
          <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded text-center">
            Click on the page to place signature
          </p>
        </>
      )}

      {/* Place text mode */}
      {activeMode === "place-text" && (
        <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded text-center">
          Click on the page to add text
        </p>
      )}

      {/* Selected signature element */}
      {activeMode === "select" && selectedSig && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Signature</h3>
          <SizeSlider
            value={Math.round((selectedSig.width / 150) * 100)}
            onChange={(val) => {
              const newW = 150 * (val / 100)
              const newH = newW * (selectedSig.height / selectedSig.width)
              onElementUpdate(selectedSig.id, { width: newW, height: newH })
            }}
          />
          <button
            onClick={() => onElementDelete(selectedSig.id)}
            className="btn-secondary text-xs py-1 text-red-500 hover:text-red-700"
          >
            Delete element
          </button>
        </div>
      )}

      {/* Selected text element */}
      {activeMode === "select" && selectedText && (
        <TextStylePanel
          element={selectedText}
          onChange={(updates) => onElementUpdate(selectedText.id, updates)}
          onDelete={() => onElementDelete(selectedText.id)}
        />
      )}

      <div className="mt-auto">
        <div className="text-xs text-gray-400 mb-2">Page {currentPage} of {totalPages}</div>
        <LocalBadge />
        {!isPro && (
          <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2 text-center">
            Free: {used}/{limit} signatures this month
          </div>
        )}
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

---

### Task 10: Rewrite pdf-signer.ts for multi-element

**Files:**
- Rewrite: `src/lib/pdf-signer.ts`

- [ ] **Step 1: Replace pdf-signer.ts with multi-element support**

```typescript
// src/lib/pdf-signer.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

interface SignElementInput {
  type: "signature"
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  dataUrl: string
}

interface TextElementInput {
  type: "text"
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  text: string
  fontFamily: "Helvetica" | "Times-Roman" | "Courier"
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
}

export type ElementInput = SignElementInput | TextElementInput

export interface SignOptions {
  pdfBytes: ArrayBuffer
  elements: ElementInput[]
  addWatermark: boolean
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return rgb(r, g, b)
}

const FONT_MAP: Record<string, Record<string, StandardFonts>> = {
  "Helvetica": {
    "normal-normal": StandardFonts.Helvetica,
    "bold-normal": StandardFonts.HelveticaBold,
    "normal-italic": StandardFonts.HelveticaOblique,
    "bold-italic": StandardFonts.HelveticaBoldOblique,
  },
  "Times-Roman": {
    "normal-normal": StandardFonts.TimesRoman,
    "bold-normal": StandardFonts.TimesRomanBold,
    "normal-italic": StandardFonts.TimesRomanItalic,
    "bold-italic": StandardFonts.TimesRomanBoldItalic,
  },
  "Courier": {
    "normal-normal": StandardFonts.Courier,
    "bold-normal": StandardFonts.CourierBold,
    "normal-italic": StandardFonts.CourierOblique,
    "bold-italic": StandardFonts.CourierBoldOblique,
  },
}

export async function signPdf(opts: SignOptions): Promise<Uint8Array> {
  let pdfDoc: PDFDocument
  try {
    pdfDoc = await PDFDocument.load(opts.pdfBytes)
  } catch {
    throw new Error("Cannot open this PDF. It may be encrypted or password-protected.")
  }

  const pages = pdfDoc.getPages()
  const embeddedFonts = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedFont>>>()

  for (const el of opts.elements) {
    if (el.pageIndex < 0 || el.pageIndex >= pages.length) continue
    const page = pages[el.pageIndex]
    const { height: pageHeight } = page.getSize()

    if (el.type === "signature") {
      const pngBytes = await fetch(el.dataUrl).then(r => r.arrayBuffer())
      const pngImage = await pdfDoc.embedPng(pngBytes)
      const pdfY = pageHeight - el.y - el.height
      page.drawImage(pngImage, { x: el.x, y: pdfY, width: el.width, height: el.height })
    }

    if (el.type === "text") {
      const boldKey = el.bold ? "bold" : "normal"
      const italicKey = el.italic ? "italic" : "normal"
      const fontKey = `${el.fontFamily}-${boldKey}-${italicKey}`
      const stdFont = FONT_MAP[el.fontFamily]?.[`${boldKey}-${italicKey}`] || StandardFonts.Helvetica

      if (!embeddedFonts.has(fontKey)) {
        embeddedFonts.set(fontKey, await pdfDoc.embedFont(stdFont))
      }
      const font = embeddedFonts.get(fontKey)!

      const pdfY = pageHeight - el.y - el.fontSize
      page.drawText(el.text, {
        x: el.x,
        y: pdfY,
        size: el.fontSize,
        font,
        color: hexToRgb(el.color),
        maxWidth: el.width,
        lineHeight: el.fontSize * 1.3,
      })
    }
  }

  if (opts.addWatermark) {
    const lastPage = pages[pages.length - 1]
    lastPage.drawText("Signed with PDF Sign \u2014 pdfsign.app", {
      x: 40, y: 18, size: 7, color: rgb(0.6, 0.6, 0.6),
    })
  }

  return pdfDoc.save()
}

export function downloadSignedPdf(pdfBytes: Uint8Array, originalFileName: string): void {
  const blob = new Blob([pdfBytes], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = originalFileName.replace(/\.pdf$/i, "") + "-signed.pdf"
  link.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

---

### Task 11: Update ScrollablePdfViewer overlay attr

**Files:**
- Modify: `src/components/ScrollablePdfViewer.tsx`

- [ ] **Step 1: Change data attribute from `data-signature-overlay` to `data-element-overlay`**

In `ScrollablePdfViewer.tsx` line 116, change the closest check:

```typescript
// Before:
if ((e.target as HTMLElement).closest("[data-signature-overlay]")) return
// After:
if ((e.target as HTMLElement).closest("[data-element-overlay]")) return
```

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

---

### Task 12: Update EditorHeader canSign logic

**Files:**
- Modify: `src/components/EditorHeader.tsx`

No code change needed — the `canSign` prop is already a boolean passed from editor.tsx. The logic change happens in editor.tsx (Task 13) where `canSign={elements.length > 0}` replaces `canSign={appState === "placed"}`.

This task is a no-op. Move to Task 13.

---

### Task 13: Rewrite editor.tsx with new state machine

**Files:**
- Rewrite: `src/tabs/editor.tsx`

- [ ] **Step 1: Replace editor.tsx with multi-element state machine**

```typescript
// src/tabs/editor.tsx
import React, { useCallback, useEffect, useRef, useState } from "react"

import { EditorHeader } from "~components/EditorHeader"
import { EditorSidebar } from "~components/EditorSidebar"
import { FileDropzone } from "~components/FileDropzone"
import { OverlayElement } from "~components/OverlayElement"
import { Paywall } from "~components/Paywall"
import { ScrollablePdfViewer, type PageInfo } from "~components/ScrollablePdfViewer"
import { getUserId } from "~lib/auth"
import { checkSignLimit, incrementSignCount } from "~lib/counter"
import { downloadSignedPdf, signPdf, type ElementInput } from "~lib/pdf-signer"
import type { ActiveMode, PlacedElement, SavedSignature, SignatureElement, TextElement } from "~lib/types"

import "~styles/globals.css"

type AppState = "idle" | "editing" | "signing" | "done" | "error"

function Editor() {
  const [appState, setAppState] = useState<AppState>("idle")
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [fileName, setFileName] = useState("")

  const [elements, setElements] = useState<PlacedElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<ActiveMode>("select")

  // Current signature ready for placement (drawn or selected from saved)
  const [pendingSignatureDataUrl, setPendingSignatureDataUrl] = useState<string | null>(null)

  const [currentPage, setCurrentPage] = useState(1)
  const [errorMsg, setErrorMsg] = useState("")

  const [isPro, setIsPro] = useState(false)
  const [used, setUsed] = useState(0)
  const [limit, setLimit] = useState(3)
  const [showPaywall, setShowPaywall] = useState(false)

  const pageScalesRef = useRef<Map<number, number>>(new Map())

  // Icon URL
  const [iconUrl, setIconUrl] = useState("")
  useEffect(() => {
    const manifest = chrome.runtime.getManifest()
    const iconPath = (manifest.icons as Record<string, string>)?.["48"]
      || (manifest.icons as Record<string, string>)?.["128"] || ""
    if (iconPath) setIconUrl(chrome.runtime.getURL(iconPath))
  }, [])

  // Delete key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editingId) return // Don't delete while editing text
        if (selectedId) {
          setElements(prev => prev.filter(el => el.id !== selectedId))
          setSelectedId(null)
        }
      }
      if (e.key === "Escape") {
        setSelectedId(null)
        setEditingId(null)
        setActiveMode("select")
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [selectedId, editingId])

  const selectedElement = elements.find(el => el.id === selectedId) || null

  const handleFileSelect = (file: File, pages: number, bytes: ArrayBuffer) => {
    setPdfBytes(bytes)
    setPageCount(pages)
    setFileName(file.name)
    setAppState("editing")
    setElements([])
    setSelectedId(null)
    setActiveMode("select")
  }

  const handlePageClick = useCallback((pageIndex: number, x: number, y: number, _scale: number) => {
    if (activeMode === "place-signature" && pendingSignatureDataUrl) {
      const w = 150
      const h = 50
      const newEl: SignatureElement = {
        type: "signature",
        id: crypto.randomUUID(),
        pageIndex,
        x: Math.max(0, x - w / 2),
        y: Math.max(0, y - h / 2),
        width: w,
        height: h,
        dataUrl: pendingSignatureDataUrl,
      }
      setElements(prev => [...prev, newEl])
      setSelectedId(newEl.id)
      setActiveMode("select")
    } else if (activeMode === "place-text") {
      const newEl: TextElement = {
        type: "text",
        id: crypto.randomUUID(),
        pageIndex,
        x: Math.max(0, x - 60),
        y: Math.max(0, y - 12),
        width: 120,
        height: 30,
        text: "Type here",
        fontFamily: "Helvetica",
        fontSize: 16,
        color: "#000000",
        bold: false,
        italic: false,
      }
      setElements(prev => [...prev, newEl])
      setSelectedId(newEl.id)
      setEditingId(newEl.id)
      setActiveMode("select")
    } else if (activeMode === "select") {
      setSelectedId(null)
      setEditingId(null)
    }
  }, [activeMode, pendingSignatureDataUrl])

  const handleElementMove = useCallback((id: string, x: number, y: number) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, x, y } : el))
  }, [])

  const handleElementResize = useCallback((id: string, w: number, h: number) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, width: w, height: h } : el))
  }, [])

  const handleElementUpdate = useCallback((id: string, updates: Partial<PlacedElement>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el))
  }, [])

  const handleElementDelete = useCallback((id: string) => {
    setElements(prev => prev.filter(el => el.id !== id))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  const handleElementSelect = useCallback((id: string) => {
    setSelectedId(id)
    setEditingId(null)
  }, [])

  const handleDoubleClick = useCallback((id: string) => {
    const el = elements.find(e => e.id === id)
    if (el?.type === "text") {
      setEditingId(id)
      setSelectedId(id)
    }
  }, [elements])

  const handleTextChange = useCallback((id: string, text: string) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, text } : el))
  }, [])

  const handleEditDone = useCallback(() => {
    setEditingId(null)
  }, [])

  const handleCurrentSignatureReady = useCallback((dataUrl: string) => {
    setPendingSignatureDataUrl(dataUrl)
  }, [])

  const handleSavedSignatureSelect = useCallback((sig: SavedSignature) => {
    setPendingSignatureDataUrl(sig.dataUrl)
  }, [])

  const handleSign = async () => {
    if (!pdfBytes || elements.length === 0) return
    setAppState("signing")

    try {
      const userId = await getUserId()
      const limitResult = await checkSignLimit(userId)
      setUsed(limitResult.used)
      setLimit(limitResult.limit)
      setIsPro(limitResult.isPro)

      if (!limitResult.allowed) {
        setShowPaywall(true)
        setAppState("editing")
        return
      }

      const inputs: ElementInput[] = elements.map(el => {
        const scale = pageScalesRef.current.get(el.pageIndex) || 1
        if (el.type === "signature") {
          return {
            type: "signature" as const,
            pageIndex: el.pageIndex,
            x: el.x / scale,
            y: el.y / scale,
            width: el.width / scale,
            height: el.height / scale,
            dataUrl: el.dataUrl,
          }
        }
        return {
          type: "text" as const,
          pageIndex: el.pageIndex,
          x: el.x / scale,
          y: el.y / scale,
          width: el.width / scale,
          height: el.height / scale,
          text: el.text,
          fontFamily: el.fontFamily,
          fontSize: el.fontSize / scale,
          color: el.color,
          bold: el.bold,
          italic: el.italic,
        }
      })

      const signed = await signPdf({
        pdfBytes,
        elements: inputs,
        addWatermark: !limitResult.isPro,
      })

      downloadSignedPdf(signed, fileName)
      await incrementSignCount(userId)
      setUsed(limitResult.used + 1)
      setAppState("done")
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Signing failed")
      setAppState("error")
    }
  }

  const handleReset = () => {
    setAppState("idle")
    setPdfBytes(null)
    setPageCount(0)
    setFileName("")
    setElements([])
    setSelectedId(null)
    setEditingId(null)
    setActiveMode("select")
    setPendingSignatureDataUrl(null)
    setErrorMsg("")
  }

  const handleSettingsClick = () => {
    chrome.runtime.openOptionsPage()
  }

  // IDLE
  if (appState === "idle") {
    return (
      <div className="editor-layout">
        <div className="flex items-center gap-2 p-4 bg-white border-b border-gray-200">
          {iconUrl ? <img src={iconUrl} alt="" className="w-6 h-6" /> : <div className="w-6 h-6" />}
          <span className="font-bold text-gray-800">PDF Sign</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-xl">
            <FileDropzone onFileSelect={handleFileSelect} fullScreen />
          </div>
        </div>
      </div>
    )
  }

  // Main editor
  return (
    <div className="editor-layout">
      <EditorHeader
        fileName={fileName}
        canSign={elements.length > 0 && appState === "editing"}
        isSigning={appState === "signing"}
        onSignClick={handleSign}
        onSettingsClick={handleSettingsClick}
      />

      <div className="editor-main">
        {pdfBytes && (
          <ScrollablePdfViewer
            pdfBytes={pdfBytes}
            pageCount={pageCount}
            onPageClick={handlePageClick}
            currentPage={currentPage}
            onCurrentPageChange={setCurrentPage}
            pageScalesRef={pageScalesRef}
          >
            {(pageIndex: number, pageInfo: PageInfo | null) => {
              if (!pageInfo) return null
              const pageElements = elements.filter(el => el.pageIndex === pageIndex)
              return pageElements.map(el => (
                <OverlayElement
                  key={el.id}
                  element={el}
                  selected={el.id === selectedId}
                  isEditing={el.id === editingId}
                  maxWidth={pageInfo.width * pageInfo.scale}
                  maxHeight={pageInfo.height * pageInfo.scale}
                  onSelect={handleElementSelect}
                  onMove={handleElementMove}
                  onResize={handleElementResize}
                  onDoubleClick={handleDoubleClick}
                  onTextChange={handleTextChange}
                  onEditDone={handleEditDone}
                />
              ))
            }}
          </ScrollablePdfViewer>
        )}

        <EditorSidebar
          activeMode={activeMode}
          onModeChange={setActiveMode}
          selectedElement={selectedElement}
          onCurrentSignatureReady={handleCurrentSignatureReady}
          onSavedSignatureSelect={handleSavedSignatureSelect}
          onElementUpdate={handleElementUpdate}
          onElementDelete={handleElementDelete}
          currentPage={currentPage}
          totalPages={pageCount}
          isPro={isPro}
          used={used}
          limit={limit}
        />
      </div>

      {appState === "done" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm text-center">
            <div className="text-4xl mb-3 text-green-500">&#10003;</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Downloaded!</h2>
            <p className="text-sm text-gray-500 mb-4">Your signed PDF has been saved.</p>
            <button onClick={handleReset} className="btn-primary w-full py-2">Sign another PDF</button>
          </div>
        </div>
      )}

      {appState === "error" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm text-center">
            <div className="text-4xl mb-3 text-red-500">!</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Error</h2>
            <p className="text-sm text-red-500 mb-4">{errorMsg}</p>
            <button onClick={() => setAppState("editing")} className="btn-primary w-full py-2">Try again</button>
          </div>
        </div>
      )}

      {showPaywall && (
        <Paywall used={used} limit={limit} onClose={() => setShowPaywall(false)} />
      )}
    </div>
  )
}

export default Editor
```

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

---

### Task 14: Delete old ResizableSignature

**Files:**
- Delete: `src/components/ResizableSignature.tsx`

- [ ] **Step 1: Delete ResizableSignature.tsx**

Verify no remaining imports:
- Search all `.tsx` files for `ResizableSignature` — should be zero (editor.tsx was rewritten, no other file imports it)

Delete `src/components/ResizableSignature.tsx`.

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

---

### Task 15: Build and browser test

- [ ] **Step 1: Full build**

Run: `cd D:/GIT/SignPDF && npm run build`

- [ ] **Step 2: Browser test checklist**

1. Load extension in Chrome, click popup → "Open PDF Editor"
2. Drop PDF → pages render
3. Click "+ Signature" → draw signature → click on page 1 → signature appears
4. Click "+ Signature" again → draw different signature → click on page 2 → second signature appears
5. Click on first signature → selected (blue border + handles) → drag, resize
6. Click "+ Text" → click on page → text element appears with "Type here"
7. Double-click text → edit inline → type name → click away → text saved
8. Select text → sidebar shows font/size/color/bold/italic → change each → text updates
9. Select text → press Delete → element removed
10. Click "Sign & Download" → PDF downloads with all elements embedded
11. Open downloaded PDF → verify signatures and text are at correct positions

- [ ] **Step 3: Fix any issues found**
