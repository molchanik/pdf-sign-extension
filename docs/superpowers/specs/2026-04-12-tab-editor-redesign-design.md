# SignPDF Tab Editor Redesign

## Problem

The current popup-based UX (360x500px) is unusable for real document work. The PDF renders at
320px width, the signature canvas is a fixed 300x100px, and state is lost when the popup closes.
For a paid product distributed via Chrome Web Store, this level of UX is not competitive.

## Solution

Move the entire signing workflow from popup to a full-browser-tab editor. The popup becomes a
minimal launcher that opens the editor tab.

## Architecture

### Popup (minimal launcher)

`src/popup.tsx` — stripped to essentials:

- "Open PDF Sign" button calls `chrome.tabs.create({ url: "tabs/editor.html" })`
- No file transfer, no signing logic, no state machine, no PDF rendering
- Compact branding: logo, one-line description, single button

Note: file transfer from popup to tab was considered via `chrome.storage.session`, but rejected
because session storage has a ~10MB quota and PDFs can be up to 50MB (67MB in base64). The tab
has its own dropzone, so transfer is unnecessary.

### Tab Editor (main screen)

`src/tabs/editor.tsx` — full-screen editor with all signing logic:

- URL: `chrome-extension://<id>/tabs/editor.html` (Plasmo native tab page)
- Full access to chrome.* APIs (storage, runtime)
- All existing lib/ modules reused without changes
- Tab always starts with its own full-screen dropzone (IDLE state)

## Layout

```
+-------------------------------------------------------------+
|  Header bar (48px)                                          |
|  [PDF Sign logo]    [filename.pdf]    [Sign & Download] [G] |
+--------------------------------------------+----------------+
|                                            |  Side Panel    |
|                                            |  (280px)       |
|           PDF Scroll Area                  |                |
|           (flex-1, all pages               |  +----------+  |
|            stacked vertically,             |  | Signature |  |
|            fit-to-width)                   |  | Canvas    |  |
|                                            |  | (resize-  |  |
|                                            |  |  able)    |  |
|                                            |  +----------+  |
|                                            |  [Clear][Save] |
|                                            |  [Use saved]   |
|                                            |                |
|                                            |  Size: ---O--- |
|                                            |                |
|                                            |  Page: 3 of 5  |
|                                            |                |
|                                            |  +----------+  |
|                                            |  | Free 0/3 |  |
|                                            |  +----------+  |
+--------------------------------------------+----------------+
|  LocalBadge: "Processing locally - no upload"               |
+-------------------------------------------------------------+
```

### PDF Scroll Area

- All pages rendered in a vertical column, each as a separate `<canvas>`
- Each page scales to fit available width (viewport width minus 280px panel minus padding)
- 12px gap between pages, background #f0f0f0

### Lazy rendering (performance)

- Render only visible pages plus 1 page buffer above/below
- `IntersectionObserver` on each canvas triggers rendering when page enters viewport
- Unrendered pages show placeholder with page number and correct aspect ratio (prevents scroll jump)
- Already-rendered pages are cached (no re-render on scroll back)

### Page indicator

- Floating badge "Page 3 of 12" at bottom center of PDF area
- Appears on scroll, fades after 1.5 seconds of inactivity
- Determined by which page occupies more than 50% of the viewport

### Side Panel (280px, fixed right)

Contains all tools:
- SignatureCanvas (resizable height)
- Action buttons (Clear, Save, Use saved)
- Size slider for placed signature
- Page counter info
- Freemium counter (if free tier)

### Responsive

- Below 768px width: panel moves below PDF area (vertical stack)

## Signature Canvas (resizable)

- Width: full panel width minus padding (~248px)
- Default height: 120px
- Resize: drag handle at bottom edge (4px bar, cursor: ns-resize), min 80px, max 300px
- signature_pad re-renders via `fromData(toData())` after resize
- Pen thickness scales proportionally with canvas size
- Save/load from chrome.storage.local (existing behavior)

## Signature Placement on PDF

### Flow

1. User draws signature in side panel
2. Clicks on desired location in PDF scroll area
3. Signature appears at click position on that page
4. Signature can be dragged and resized

### Resize handles

- 4 corner handles (8x8px squares)
- Proportional scaling (preserves aspect ratio)
- Drag from corner: scales from opposite corner
- Min size: 30x10px, max size: page width

### Size slider (in panel)

- Range: 25% to 200% of original signature size
- Default: 100%
- Changes instantly update signature size on PDF (centered on current position)
- Bidirectional sync with resize handles

### Visual styling

- Blue dashed border 2px when selected/hover only
- No border when deselected (shows real result)
- Cursor: grab (idle), grabbing (dragging)

### Cross-page placement

- Signature lands on the page the user clicks
- One signature per document (MVP)
- Clicking another page moves the signature there

### Coordinate conversion

- Screen coordinates to PDF points at final save time
- Scale factor: `pdfW = displayW / renderScale`, `pdfH = displayH / renderScale`
- Each page tracks its own renderScale

## State Machine

```
IDLE -> FILE_LOADED -> SIGNATURE_DRAWN -> PLACED -> SIGNING -> DONE
                                            ^          |
                                            +-- ERROR -+
```

| State           | UI                                                              |
| --------------- | --------------------------------------------------------------- |
| IDLE            | Full-screen dropzone                                            |
| FILE_LOADED     | PDF rendered, side panel visible, canvas empty                  |
| SIGNATURE_DRAWN | Signature in canvas, banner over PDF: "Click on the page to place your signature" |
| PLACED          | Signature on PDF, drag/resize active, "Sign & Download" enabled |
| SIGNING         | Spinner, UI blocked                                             |
| DONE            | Success message, "Sign another" option                          |
| ERROR           | Error message with retry                                        |

## Component Inventory

### Reused without changes

| Component / Module      | Path                       |
| ----------------------- | -------------------------- |
| pdf-signer              | lib/pdf-signer.ts          |
| pdf-renderer            | lib/pdf-renderer.ts        |
| signature-trim          | lib/signature-trim.ts      |
| auth                    | lib/auth.ts                |
| counter                 | lib/counter.ts             |
| payments                | lib/payments.ts            |
| storage                 | lib/storage.ts             |
| Paywall                 | components/Paywall.tsx      |
| LocalBadge              | components/LocalBadge.tsx   |
| background service worker | background.ts             |

### Modified

| Component       | Change                                              |
| --------------- | --------------------------------------------------- |
| SignatureCanvas  | Add resize handle, adaptive width                   |
| FileDropzone    | Support full-screen and compact (popup) mode         |

### New

| Component              | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| tabs/editor.tsx        | Main editor screen, state machine                   |
| ScrollablePdfViewer    | Lazy-rendered vertical scroll PDF viewer            |
| ResizableSignature     | Draggable + resizable signature overlay on PDF      |
| SizeSlider             | Signature size slider, synced with resize handles   |
| PageIndicator          | Floating "Page X of Y" badge                        |
| EditorHeader           | Top bar with filename, actions, settings link        |
| EditorSidebar          | Right panel containing all tools                    |

### Removed / replaced

| Component        | Replacement              |
| ---------------- | ------------------------ |
| SignaturePlacer   | ResizableSignature       |
| PdfPreview        | ScrollablePdfViewer      |
| popup.tsx (logic) | Stripped to launcher only |
