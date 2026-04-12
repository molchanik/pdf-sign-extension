# Tab Editor Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the PDF signing workflow from a 360px popup to a full-browser-tab editor with scrollable PDF viewer, resizable signature canvas, and drag-to-place signature with resize handles.

**Architecture:** Plasmo tab page (`src/tabs/editor.tsx`) becomes the main editor. Popup becomes a one-button launcher. All existing lib/ modules reused unchanged. New components: ScrollablePdfViewer (lazy-rendered), ResizableSignature (drag + corner resize), EditorHeader, EditorSidebar.

**Tech Stack:** React 18, TypeScript, Plasmo (tab pages), pdf-lib, pdfjs-dist, signature_pad, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-04-12-tab-editor-redesign-design.md`

---

## File Structure

```
src/
├── tabs/
│   └── editor.tsx                    # NEW — main editor, state machine, full layout
├── popup.tsx                         # REWRITE — strip to launcher (single button)
├── components/
│   ├── EditorHeader.tsx              # NEW — top bar: logo, filename, Sign & Download, settings
│   ├── EditorSidebar.tsx             # NEW — right panel: signature canvas, buttons, slider, counter
│   ├── ScrollablePdfViewer.tsx       # NEW — lazy-rendered vertical PDF scroll with IntersectionObserver
│   ├── ResizableSignature.tsx        # NEW — draggable + resizable signature overlay on PDF page
│   ├── SizeSlider.tsx                # NEW — range input 25%-200%, synced with resize handles
│   ├── PageIndicator.tsx             # NEW — floating "Page X of Y" badge
│   ├── SignatureCanvas.tsx           # MODIFY — add bottom resize handle, adaptive width
│   ├── FileDropzone.tsx              # MODIFY — add fullScreen prop for tab vs popup mode
│   ├── LocalBadge.tsx                # UNCHANGED
│   └── Paywall.tsx                   # UNCHANGED
├── lib/                              # ALL UNCHANGED
│   ├── pdf-signer.ts
│   ├── pdf-renderer.ts
│   ├── signature-trim.ts
│   ├── auth.ts
│   ├── counter.ts
│   ├── payments.ts
│   └── storage.ts
├── background.ts                     # UNCHANGED
├── options.tsx                       # UNCHANGED
└── styles/
    └── globals.css                   # MODIFY — add editor layout utilities
```

---

### Task 1: Strip popup.tsx to launcher

**Files:**
- Rewrite: `src/popup.tsx`

- [ ] **Step 1: Replace popup.tsx with minimal launcher**

```tsx
import React from "react"
import "./styles/globals.css"

function Popup() {
  const handleOpen = () => {
    chrome.tabs.create({ url: "./tabs/editor.html" })
    window.close()
  }

  return (
    <div style={{ width: 300, padding: 24 }} className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <img src="/assets/icon.png" alt="PDF Sign" className="w-8 h-8" />
        <h1 className="text-lg font-bold text-gray-800">PDF Sign</h1>
      </div>
      <p className="text-sm text-gray-500 text-center">
        Sign PDF documents locally — no upload required
      </p>
      <button onClick={handleOpen} className="btn-primary w-full py-3 text-base">
        Open PDF Editor
      </button>
    </div>
  )
}

export default Popup
```

- [ ] **Step 2: Build and verify**

Run: `cd D:/GIT/SignPDF && npm run build`
Expected: Build succeeds. `build/chrome-mv3-prod/popup.html` exists and contains only the launcher.

- [ ] **Step 3: Commit**

```bash
git add src/popup.tsx
git commit -m "refactor: strip popup to minimal launcher button"
```

---

### Task 2: Create tabs/editor.tsx skeleton with IDLE state

**Files:**
- Create: `src/tabs/editor.tsx`
- Modify: `src/components/FileDropzone.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add fullScreen prop to FileDropzone**

In `src/components/FileDropzone.tsx`, add `fullScreen?: boolean` to props. When `fullScreen` is true, the dropzone renders with `min-h-screen` and larger text/icon. The existing compact behavior remains the default.

```tsx
interface FileDropzoneProps {
  onFileSelect: (file: File, pageCount: number, arrayBuffer: ArrayBuffer) => void
  fullScreen?: boolean
}

export function FileDropzone({ onFileSelect, fullScreen = false }: FileDropzoneProps) {
  // ... existing state (dragActive, error) ...

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-xl cursor-pointer transition-colors
        flex flex-col items-center justify-center gap-3
        ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
        ${fullScreen ? "min-h-[80vh] p-12" : "p-8"}
      `}
    >
      {/* Same SVG icon, but larger when fullScreen */}
      <svg className={fullScreen ? "w-16 h-16 text-gray-400" : "w-10 h-10 text-gray-400"} /* ... existing SVG ... */ />
      <p className={`text-gray-500 ${fullScreen ? "text-lg" : "text-sm"}`}>
        Drag & drop PDF here or <span className="text-blue-600 underline">browse</span>
      </p>
      <p className="text-xs text-gray-400">Max 50 MB</p>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileInput} />
    </div>
  )
}
```

- [ ] **Step 2: Add editor layout styles to globals.css**

Append to `src/styles/globals.css`:

```css
.editor-layout {
  @apply flex flex-col h-screen bg-gray-100;
}
.editor-main {
  @apply flex flex-1 overflow-hidden;
}
.editor-pdf-area {
  @apply flex-1 overflow-y-auto bg-gray-200 relative;
}
.editor-sidebar {
  @apply w-[280px] bg-white border-l border-gray-200 overflow-y-auto p-4 flex flex-col gap-4 shrink-0;
}
@media (max-width: 767px) {
  .editor-main {
    @apply flex-col;
  }
  .editor-sidebar {
    @apply w-full border-l-0 border-t;
  }
}
```

- [ ] **Step 3: Create tabs/editor.tsx with IDLE state only**

```tsx
import React, { useState } from "react"
import { FileDropzone } from "~components/FileDropzone"
import "~styles/globals.css"

type AppState = "idle" | "file_loaded" | "signature_drawn" | "placed" | "signing" | "done" | "error"

function Editor() {
  const [appState, setAppState] = useState<AppState>("idle")
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [fileName, setFileName] = useState("")

  const handleFileSelect = (file: File, pages: number, bytes: ArrayBuffer) => {
    setPdfBytes(bytes)
    setPageCount(pages)
    setFileName(file.name)
    setAppState("file_loaded")
  }

  if (appState === "idle") {
    return (
      <div className="editor-layout">
        <div className="flex items-center gap-2 p-4">
          <img src="/assets/icon.png" alt="" className="w-6 h-6" />
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

  return (
    <div className="editor-layout">
      <div className="p-4 text-gray-500">Editor loaded: {fileName} ({pageCount} pages)</div>
    </div>
  )
}

export default Editor
```

- [ ] **Step 4: Build and verify**

Run: `cd D:/GIT/SignPDF && npm run build`
Expected: Build succeeds. `build/chrome-mv3-prod/tabs/editor.html` exists. Loading extension in Chrome → clicking popup "Open PDF Editor" → opens new tab with full-screen dropzone.

- [ ] **Step 5: Commit**

```bash
git add src/tabs/editor.tsx src/components/FileDropzone.tsx src/styles/globals.css
git commit -m "feat: add editor tab skeleton with full-screen dropzone"
```

---

### Task 3: Create EditorHeader

**Files:**
- Create: `src/components/EditorHeader.tsx`

- [ ] **Step 1: Create EditorHeader component**

```tsx
import React from "react"

interface EditorHeaderProps {
  fileName: string
  canSign: boolean
  isSigning: boolean
  onSignClick: () => void
  onSettingsClick: () => void
}

export function EditorHeader({ fileName, canSign, isSigning, onSignClick, onSettingsClick }: EditorHeaderProps) {
  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0">
      <div className="flex items-center gap-2">
        <img src="/assets/icon.png" alt="" className="w-5 h-5" />
        <span className="font-bold text-gray-800 text-sm">PDF Sign</span>
      </div>

      <div className="flex-1 text-center">
        <span className="text-sm text-gray-600 truncate max-w-xs inline-block">{fileName}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onSignClick}
          disabled={!canSign || isSigning}
          className="btn-primary px-4 py-1.5 text-sm"
        >
          {isSigning ? "Signing..." : "Sign & Download"}
        </button>
        <button
          onClick={onSettingsClick}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`
Expected: Build succeeds (component not wired yet, just compiles).

- [ ] **Step 3: Commit**

```bash
git add src/components/EditorHeader.tsx
git commit -m "feat: add EditorHeader component"
```

---

### Task 4: Modify SignatureCanvas for resizable height

**Files:**
- Modify: `src/components/SignatureCanvas.tsx`

- [ ] **Step 1: Add resize handle to SignatureCanvas**

Keep all existing signature_pad logic. Changes:
1. Remove fixed `width`/`height` props — width comes from container, height is stateful
2. Add a drag handle at the bottom edge (4px bar, cursor: ns-resize)
3. On drag: change canvas height between 80px and 300px
4. After resize: re-render existing signature via `signaturePad.fromData(signaturePad.toData())`

Key additions to the component:

```tsx
interface SignatureCanvasProps {
  onSignatureChange: (dataUrl: string | null) => void
}

export function SignatureCanvas({ onSignatureChange }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasHeight, setCanvasHeight] = useState(120)
  const [savedExists, setSavedExists] = useState(false)

  // Existing: init signature_pad, handle endStroke, clear, save, load

  // NEW: resize logic
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = canvasHeight
    const data = padRef.current?.toData() || []

    const onMove = (ev: MouseEvent) => {
      const newH = Math.min(300, Math.max(80, startHeight + ev.clientY - startY))
      setCanvasHeight(newH)
    }
    const onUp = () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      // Re-render signature after resize
      requestAnimationFrame(() => {
        if (padRef.current && data.length > 0) {
          padRef.current.fromData(data)
        }
      })
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  // Canvas width from container
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const w = container.clientWidth
    canvas.width = w
    canvas.height = canvasHeight
    // re-init pad if needed
  }, [canvasHeight])

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        className="border border-gray-300 rounded-t cursor-crosshair w-full"
        style={{ height: canvasHeight }}
      />
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="h-1 bg-gray-300 hover:bg-blue-400 cursor-ns-resize rounded-b transition-colors"
      />
      {/* Existing buttons: Clear, Save, Use saved */}
      <div className="flex gap-2 mt-2">
        {/* ... existing buttons ... */}
      </div>
    </div>
  )
}
```

The key behavior:
- Canvas takes full container width (will be ~248px in the 280px sidebar with padding)
- Height defaults to 120px, user drags bottom handle to resize (80-300px range)
- After resize completes (mouseup), existing strokes are re-rendered via `fromData(toData())`
- Pen minWidth/maxWidth scale proportionally: `minWidth: 1.5 * (canvasHeight / 120)`, `maxWidth: 3 * (canvasHeight / 120)`

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/SignatureCanvas.tsx
git commit -m "feat: add resizable height to SignatureCanvas"
```

---

### Task 5: Create SizeSlider

**Files:**
- Create: `src/components/SizeSlider.tsx`

- [ ] **Step 1: Create SizeSlider component**

```tsx
import React from "react"

interface SizeSliderProps {
  value: number  // 25-200, percentage of original size
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
```

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/SizeSlider.tsx
git commit -m "feat: add SizeSlider component"
```

---

### Task 6: Create PageIndicator

**Files:**
- Create: `src/components/PageIndicator.tsx`

- [ ] **Step 1: Create PageIndicator component**

```tsx
import React, { useEffect, useState } from "react"

interface PageIndicatorProps {
  currentPage: number
  totalPages: number
}

export function PageIndicator({ currentPage, totalPages }: PageIndicatorProps) {
  const [visible, setVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setVisible(true)
    if (timeoutId) clearTimeout(timeoutId)
    const id = setTimeout(() => setVisible(false), 1500)
    setTimeoutId(id)
    return () => { if (timeoutId) clearTimeout(timeoutId) }
  }, [currentPage])

  return (
    <div
      className={`
        absolute bottom-4 left-1/2 -translate-x-1/2
        bg-black/70 text-white text-xs px-3 py-1.5 rounded-full
        transition-opacity duration-300 pointer-events-none
        ${visible ? "opacity-100" : "opacity-0"}
      `}
    >
      Page {currentPage} of {totalPages}
    </div>
  )
}
```

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/PageIndicator.tsx
git commit -m "feat: add PageIndicator floating badge"
```

---

### Task 7: Create ScrollablePdfViewer with lazy rendering

**Files:**
- Create: `src/components/ScrollablePdfViewer.tsx`

This is the most complex new component. It renders all PDF pages in a vertical scroll container with IntersectionObserver-based lazy rendering.

- [ ] **Step 1: Create ScrollablePdfViewer**

```tsx
import React, { useCallback, useEffect, useRef, useState } from "react"
import { renderPage, type RenderResult } from "~lib/pdf-renderer"
import { PageIndicator } from "./PageIndicator"

interface PageInfo {
  rendered: boolean
  scale: number
  width: number   // original PDF width in points
  height: number  // original PDF height in points
}

interface ScrollablePdfViewerProps {
  pdfBytes: ArrayBuffer
  pageCount: number
  onPageClick?: (pageIndex: number, x: number, y: number, scale: number) => void
  currentPage: number
  onCurrentPageChange: (page: number) => void
  pageScalesRef: React.MutableRefObject<Map<number, number>>
  children?: (pageIndex: number, pageInfo: PageInfo | null) => React.ReactNode  // render overlay per page
}

export function ScrollablePdfViewer({
  pdfBytes,
  pageCount,
  onPageClick,
  currentPage,
  onCurrentPageChange,
  pageScalesRef,
  children,
}: ScrollablePdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const [pageInfos, setPageInfos] = useState<Map<number, PageInfo>>(new Map())
  const renderedSet = useRef<Set<number>>(new Set())

  // Estimate page dimensions before rendering (assume A4 ratio 1:1.414 as default)
  const getEstimatedHeight = (containerWidth: number) => containerWidth * 1.414

  const renderPageAt = useCallback(async (pageIndex: number) => {
    if (renderedSet.current.has(pageIndex)) return
    const canvas = canvasRefs.current.get(pageIndex)
    if (!canvas) return
    const container = canvas.parentElement
    if (!container) return

    renderedSet.current.add(pageIndex)
    const containerWidth = container.clientWidth

    try {
      const result: RenderResult = await renderPage(pdfBytes, pageIndex, canvas, containerWidth)
      const info: PageInfo = {
        rendered: true,
        scale: result.scale,
        width: result.pageWidth,
        height: result.pageHeight,
      }
      setPageInfos(prev => new Map(prev).set(pageIndex, info))
      pageScalesRef.current.set(pageIndex, result.scale)
    } catch (err) {
      console.error(`Failed to render page ${pageIndex}:`, err)
      renderedSet.current.delete(pageIndex)
    }
  }, [pdfBytes, pageScalesRef])

  // IntersectionObserver for lazy rendering
  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-page-index"))
            if (!isNaN(idx)) renderPageAt(idx)
          }
        }
      },
      { root: scrollEl, rootMargin: "200px 0px" } // 200px buffer for pre-rendering
    )

    canvasRefs.current.forEach((canvas, _idx) => {
      const wrapper = canvas.closest("[data-page-index]")
      if (wrapper) observer.observe(wrapper)
    })

    return () => observer.disconnect()
  }, [pageCount, renderPageAt])

  // Track current page on scroll
  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const handleScroll = () => {
      const scrollTop = scrollEl.scrollTop
      const scrollMid = scrollTop + scrollEl.clientHeight / 2
      let cumulative = 0
      for (let i = 0; i < pageCount; i++) {
        const wrapper = scrollEl.querySelector(`[data-page-index="${i}"]`) as HTMLElement
        if (!wrapper) continue
        const h = wrapper.offsetHeight + 12 // 12px gap
        if (cumulative + h > scrollMid) {
          if (i + 1 !== currentPage) onCurrentPageChange(i + 1)
          break
        }
        cumulative += h
      }
    }

    scrollEl.addEventListener("scroll", handleScroll, { passive: true })
    return () => scrollEl.removeEventListener("scroll", handleScroll)
  }, [pageCount, currentPage, onCurrentPageChange])

  const handleCanvasClick = (pageIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!onPageClick) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const scale = pageScalesRef.current.get(pageIndex) || 1
    onPageClick(pageIndex, x, y, scale)
  }

  return (
    <div ref={scrollRef} className="editor-pdf-area">
      <div className="flex flex-col items-center gap-3 py-4">
        {Array.from({ length: pageCount }, (_, i) => {
          const info = pageInfos.get(i)
          return (
            <div
              key={i}
              data-page-index={i}
              className="relative bg-white shadow-sm"
              style={info ? undefined : { aspectRatio: "1 / 1.414", width: "100%", maxWidth: "calc(100% - 32px)" }}
              onClick={(e) => handleCanvasClick(i, e)}
            >
              <canvas
                ref={(el) => { if (el) canvasRefs.current.set(i, el); else canvasRefs.current.delete(i) }}
                className="block"
              />
              {!info && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                  Page {i + 1}
                </div>
              )}
              {/* Render signature overlay if on this page */}
              {children?.(i, info || null)}
            </div>
          )
        })}
      </div>
      <PageIndicator currentPage={currentPage} totalPages={pageCount} />
    </div>
  )
}
```

Key design decisions:
- `canvasRefs` stored in a Map keyed by page index
- `IntersectionObserver` with 200px rootMargin (renders 1 page ahead/behind)
- `children` render prop for per-page overlays (used by ResizableSignature in Task 8)
- `pageScalesRef` is a ref (not state) to avoid re-renders — editor reads it at sign time
- Page placeholder uses A4 aspect ratio (1:1.414) before real dimensions are known
- Scroll tracking uses midpoint of visible area to determine current page

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/ScrollablePdfViewer.tsx
git commit -m "feat: add ScrollablePdfViewer with lazy rendering"
```

---

### Task 8: Create ResizableSignature

**Files:**
- Create: `src/components/ResizableSignature.tsx`

- [ ] **Step 1: Create ResizableSignature component**

This component renders the signature image as an absolutely-positioned overlay on a PDF page. It supports drag-to-move and corner-handle resize.

```tsx
import React, { useRef, useState, useEffect, useCallback } from "react"

interface ResizableSignatureProps {
  dataUrl: string
  x: number
  y: number
  width: number
  height: number
  maxWidth: number
  maxHeight: number
  onMove: (x: number, y: number) => void
  onResize: (width: number, height: number) => void
}

const MIN_W = 30
const MIN_H = 10
const HANDLE_SIZE = 8

export function ResizableSignature({
  dataUrl, x, y, width, height, maxWidth, maxHeight, onMove, onResize,
}: ResizableSignatureProps) {
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState<string | null>(null) // "tl" | "tr" | "bl" | "br"
  const startRef = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 })
  const aspectRatio = width / height

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
      // Proportional resize from corner
      let newW = s.w
      let newH = s.h
      let newX = s.x
      let newY = s.y

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
      } else if (resizing === "tl") {
        newW = Math.max(MIN_W, Math.min(s.x + s.w, s.w - dx))
        newH = newW / aspectRatio
        newX = s.x + s.w - newW
        newY = s.y + s.h - newH
      }

      if (newH >= MIN_H && newY >= 0 && newY + newH <= maxHeight) {
        onResize(newW, newH)
        onMove(newX, newY)
      }
    }
  }, [dragging, resizing, width, height, maxWidth, maxHeight, aspectRatio, onMove, onResize])

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
    { id: "tl", style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
    { id: "tr", style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
    { id: "bl", style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
    { id: "br", style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
  ]

  const cursorMap: Record<string, string> = { tl: "nwse-resize", tr: "nesw-resize", bl: "nesw-resize", br: "nwse-resize" }

  return (
    <div
      className="absolute group"
      style={{ left: x, top: y, width, height, cursor: dragging ? "grabbing" : "grab" }}
      onMouseDown={handleDragStart}
    >
      <img src={dataUrl} alt="Signature" className="w-full h-full object-contain pointer-events-none" draggable={false} />

      {/* Dashed border — visible on hover/active */}
      <div className="absolute inset-0 border-2 border-dashed border-blue-500 opacity-0 group-hover:opacity-100 rounded transition-opacity" />

      {/* Corner resize handles */}
      {corners.map(({ id, style }) => (
        <div
          key={id}
          className="absolute bg-blue-500 border border-white opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            ...style,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            cursor: cursorMap[id],
          }}
          onMouseDown={handleResizeStart(id)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/ResizableSignature.tsx
git commit -m "feat: add ResizableSignature with drag and corner resize"
```

---

### Task 9: Create EditorSidebar

**Files:**
- Create: `src/components/EditorSidebar.tsx`

- [ ] **Step 1: Create EditorSidebar component**

```tsx
import React from "react"
import { SignatureCanvas } from "./SignatureCanvas"
import { SizeSlider } from "./SizeSlider"
import { LocalBadge } from "./LocalBadge"

interface EditorSidebarProps {
  appState: string
  signatureDataUrl: string | null
  onSignatureChange: (dataUrl: string | null) => void
  sigScale: number
  onSigScaleChange: (val: number) => void
  currentPage: number
  totalPages: number
  isPro: boolean
  used: number
  limit: number
}

export function EditorSidebar({
  appState,
  signatureDataUrl,
  onSignatureChange,
  sigScale,
  onSigScaleChange,
  currentPage,
  totalPages,
  isPro,
  used,
  limit,
}: EditorSidebarProps) {
  return (
    <aside className="editor-sidebar">
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Signature</h3>
        <SignatureCanvas onSignatureChange={onSignatureChange} />
      </div>

      {appState === "signature_drawn" && (
        <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded text-center">
          Click on the page to place your signature
        </p>
      )}

      {(appState === "placed" || signatureDataUrl) && (
        <SizeSlider
          value={sigScale}
          onChange={onSigScaleChange}
          disabled={appState !== "placed"}
        />
      )}

      <div className="text-xs text-gray-400">
        Page {currentPage} of {totalPages}
      </div>

      <div className="mt-auto">
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

- [ ] **Step 3: Commit**

```bash
git add src/components/EditorSidebar.tsx
git commit -m "feat: add EditorSidebar component"
```

---

### Task 10: Wire editor.tsx — full state machine

**Files:**
- Modify: `src/tabs/editor.tsx`

This is the main integration task. Wire all components into the editor with the complete state machine.

- [ ] **Step 1: Implement full editor state machine**

Replace the skeleton `editor.tsx` with the complete implementation:

```tsx
import React, { useCallback, useRef, useState } from "react"
import { FileDropzone } from "~components/FileDropzone"
import { EditorHeader } from "~components/EditorHeader"
import { EditorSidebar } from "~components/EditorSidebar"
import { ScrollablePdfViewer } from "~components/ScrollablePdfViewer"
import { ResizableSignature } from "~components/ResizableSignature"
import { Paywall } from "~components/Paywall"
import { signPdf, downloadSignedPdf } from "~lib/pdf-signer"
import { getUserId } from "~lib/auth"
import { checkSignLimit, incrementSignCount } from "~lib/counter"
import "~styles/globals.css"

type AppState = "idle" | "file_loaded" | "signature_drawn" | "placed" | "signing" | "done" | "error"

interface SigPosition {
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
}

function Editor() {
  // Core state
  const [appState, setAppState] = useState<AppState>("idle")
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [fileName, setFileName] = useState("")
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [sigPosition, setSigPosition] = useState<SigPosition | null>(null)
  const [sigScale, setSigScale] = useState(100)
  const [baseSigSize, setBaseSigSize] = useState({ w: 150, h: 50 })
  const [currentPage, setCurrentPage] = useState(1)
  const [errorMsg, setErrorMsg] = useState("")

  // Freemium state
  const [isPro, setIsPro] = useState(false)
  const [used, setUsed] = useState(0)
  const [limit, setLimit] = useState(3)
  const [showPaywall, setShowPaywall] = useState(false)

  // Refs
  const pageScalesRef = useRef<Map<number, number>>(new Map())

  // --- Handlers ---

  const handleFileSelect = (file: File, pages: number, bytes: ArrayBuffer) => {
    setPdfBytes(bytes)
    setPageCount(pages)
    setFileName(file.name)
    setAppState("file_loaded")
    setSigPosition(null)
    setSignatureDataUrl(null)
    setSigScale(100)
  }

  const handleSignatureChange = (dataUrl: string | null) => {
    setSignatureDataUrl(dataUrl)
    if (dataUrl && appState === "file_loaded") {
      setAppState("signature_drawn")
    }
    if (!dataUrl && appState === "signature_drawn") {
      setAppState("file_loaded")
    }
  }

  const handlePageClick = useCallback((pageIndex: number, x: number, y: number, scale: number) => {
    if (appState !== "signature_drawn" && appState !== "placed") return
    if (!signatureDataUrl) return

    const w = baseSigSize.w * (sigScale / 100)
    const h = baseSigSize.h * (sigScale / 100)
    // Center signature on click position
    setSigPosition({
      pageIndex,
      x: Math.max(0, x - w / 2),
      y: Math.max(0, y - h / 2),
      width: w,
      height: h,
    })
    setAppState("placed")
  }, [appState, signatureDataUrl, baseSigSize, sigScale])

  const handleSigMove = useCallback((x: number, y: number) => {
    setSigPosition(prev => prev ? { ...prev, x, y } : null)
  }, [])

  const handleSigResize = useCallback((width: number, height: number) => {
    setSigPosition(prev => prev ? { ...prev, width, height } : null)
    // Sync slider: new scale = newWidth / baseWidth * 100
    const newScale = Math.round((width / baseSigSize.w) * 100)
    setSigScale(Math.max(25, Math.min(200, newScale)))
  }, [baseSigSize.w])

  const handleSigScaleChange = useCallback((val: number) => {
    setSigScale(val)
    setSigPosition(prev => {
      if (!prev) return null
      const newW = baseSigSize.w * (val / 100)
      const newH = baseSigSize.h * (val / 100)
      // Keep centered on current center
      const cx = prev.x + prev.width / 2
      const cy = prev.y + prev.height / 2
      return {
        ...prev,
        width: newW,
        height: newH,
        x: cx - newW / 2,
        y: cy - newH / 2,
      }
    })
  }, [baseSigSize])

  const handleSign = async () => {
    if (!pdfBytes || !signatureDataUrl || !sigPosition) return
    setAppState("signing")

    try {
      const userId = await getUserId()
      const limitResult = await checkSignLimit(userId)
      setUsed(limitResult.used)
      setLimit(limitResult.limit)
      setIsPro(limitResult.isPro)

      if (!limitResult.allowed) {
        setShowPaywall(true)
        setAppState("placed")
        return
      }

      const scale = pageScalesRef.current.get(sigPosition.pageIndex) || 1
      const signed = await signPdf({
        pdfBytes,
        signatureDataUrl,
        pageIndex: sigPosition.pageIndex,
        x: sigPosition.x / scale,
        y: sigPosition.y / scale,
        width: sigPosition.width / scale,
        height: sigPosition.height / scale,
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
    setSignatureDataUrl(null)
    setSigPosition(null)
    setSigScale(100)
    setErrorMsg("")
  }

  const handleSettingsClick = () => {
    chrome.runtime.openOptionsPage()
  }

  // --- IDLE: full-screen dropzone ---
  if (appState === "idle") {
    return (
      <div className="editor-layout">
        <div className="flex items-center gap-2 p-4 bg-white border-b border-gray-200">
          <img src="/assets/icon.png" alt="" className="w-6 h-6" />
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

  // --- Main editor layout ---
  return (
    <div className="editor-layout">
      <EditorHeader
        fileName={fileName}
        canSign={appState === "placed"}
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
            {(pageIndex, pageInfo) =>
              sigPosition && sigPosition.pageIndex === pageIndex && signatureDataUrl && pageInfo ? (
                <ResizableSignature
                  dataUrl={signatureDataUrl}
                  x={sigPosition.x}
                  y={sigPosition.y}
                  width={sigPosition.width}
                  height={sigPosition.height}
                  maxWidth={pageInfo.width * pageInfo.scale}
                  maxHeight={pageInfo.height * pageInfo.scale}
                  onMove={handleSigMove}
                  onResize={handleSigResize}
                />
              ) : null
            }
          </ScrollablePdfViewer>
        )}

        <EditorSidebar
          appState={appState}
          signatureDataUrl={signatureDataUrl}
          onSignatureChange={handleSignatureChange}
          sigScale={sigScale}
          onSigScaleChange={handleSigScaleChange}
          currentPage={currentPage}
          totalPages={pageCount}
          isPro={isPro}
          used={used}
          limit={limit}
        />
      </div>

      {/* Done overlay */}
      {appState === "done" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm text-center">
            <div className="text-4xl mb-3">&#10003;</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Downloaded!</h2>
            <p className="text-sm text-gray-500 mb-4">Your signed PDF has been saved.</p>
            <button onClick={handleReset} className="btn-primary w-full py-2">Sign another PDF</button>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {appState === "error" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm text-center">
            <div className="text-4xl mb-3 text-red-500">!</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Error</h2>
            <p className="text-sm text-red-500 mb-4">{errorMsg}</p>
            <button onClick={() => setAppState("placed")} className="btn-primary w-full py-2">Try again</button>
          </div>
        </div>
      )}

      {/* Paywall */}
      {showPaywall && (
        <Paywall used={used} limit={limit} onClose={() => setShowPaywall(false)} />
      )}
    </div>
  )
}

export default Editor
```

- [ ] **Step 2: Build and verify**

Run: `cd D:/GIT/SignPDF && npm run build`
Expected: Build succeeds. Load extension in Chrome → click popup → editor tab opens → drop PDF → pages render → draw signature → click on PDF → signature appears → drag/resize works → Sign & Download works.

- [ ] **Step 3: Commit**

```bash
git add src/tabs/editor.tsx
git commit -m "feat: wire full editor state machine with all components"
```

---

### Task 11: Delete replaced components and clean up

**Files:**
- Delete: `src/components/SignaturePlacer.tsx`
- Delete: `src/components/PdfPreview.tsx`

- [ ] **Step 1: Remove unused components**

Delete `src/components/SignaturePlacer.tsx` and `src/components/PdfPreview.tsx`. These are replaced by `ResizableSignature` and `ScrollablePdfViewer`.

Verify no remaining imports:
- Search all `.tsx` files for `SignaturePlacer` and `PdfPreview` imports
- There should be none (popup.tsx was rewritten, editor.tsx uses new components)

- [ ] **Step 2: Build verify**

Run: `cd D:/GIT/SignPDF && npm run build`
Expected: Build succeeds with no missing import errors.

- [ ] **Step 3: Commit**

```bash
git add -u src/components/SignaturePlacer.tsx src/components/PdfPreview.tsx
git commit -m "chore: remove replaced SignaturePlacer and PdfPreview components"
```

---

### Task 12: Browser testing and bug fixes

**Files:**
- Potentially any file from Tasks 1-11

- [ ] **Step 1: Load extension and test full flow**

1. `cd D:/GIT/SignPDF && npm run build`
2. Open `chrome://extensions/` → click refresh on PDF Sign
3. Click popup → "Open PDF Editor" → new tab should open
4. Drop a PDF → all pages should render in scroll view
5. Draw signature → "Click on the page to place" message appears in sidebar
6. Click on PDF page → signature appears at click position
7. Drag signature → moves within page bounds
8. Drag corner handle → signature resizes proportionally
9. Move size slider → signature resizes, slider syncs
10. Click "Sign & Download" → PDF downloads with signature

- [ ] **Step 2: Fix any issues found during testing**

Common issues to watch for:
- PDF.js worker path: ensure `assets/pdf.worker.min.js` is in `web_accessible_resources`
- Canvas sizing: ensure canvases get correct dimensions after container layout
- Coordinate conversion: verify signature lands at correct PDF position in downloaded file
- Scroll behavior: verify lazy rendering triggers as pages scroll into view

- [ ] **Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: browser testing fixes for tab editor"
```

---

### Task 13: Responsive layout verification

**Files:**
- Potentially: `src/styles/globals.css`, `src/tabs/editor.tsx`

- [ ] **Step 1: Test responsive breakpoint**

Resize browser window below 768px width. Verify:
- Sidebar moves below PDF area (vertical stack)
- PDF still renders and scrolls
- Signature canvas still works
- Sign & Download still works

- [ ] **Step 2: Fix any responsive issues**

If sidebar doesn't stack properly, verify the `@media (max-width: 767px)` styles in `globals.css` are applied.

- [ ] **Step 3: Final build and commit**

```bash
cd D:/GIT/SignPDF && npm run build
git add -A
git commit -m "fix: verify responsive layout at 768px breakpoint"
```
