# Multi-Element Placement: Signatures & Text Fields

## Problem

The current editor supports only one signature per document. Users need to sign multiple pages
and add text fields (name, date, custom text) to complete real-world documents.

## Solution

Unified overlay system where all placeable elements (signatures and text fields) share the same
data model, drag/resize behavior, and rendering pipeline. Multiple elements of any type can be
placed on any page.

## Data Model

```typescript
interface PlacedElementBase {
  id: string              // crypto.randomUUID()
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
}

interface SignatureElement extends PlacedElementBase {
  type: "signature"
  dataUrl: string         // PNG data URL
}

interface TextElement extends PlacedElementBase {
  type: "text"
  text: string
  fontFamily: "Helvetica" | "Times-Roman" | "Courier"
  fontSize: number        // 12-72pt
  color: string           // hex "#000000"
  bold: boolean
  italic: boolean
}

type PlacedElement = SignatureElement | TextElement
```

## Editor State

```typescript
const [elements, setElements] = useState<PlacedElement[]>([])
const [selectedId, setSelectedId] = useState<string | null>(null)
const [activeMode, setActiveMode] = useState<"select" | "place-signature" | "place-text">("select")
```

- `elements[]` — all placed elements across all pages
- `selectedId` — currently selected element ID (or null)
- `activeMode` — what happens on PDF click: select, place signature, or place text

## State Machine

```
idle -> editing -> signing -> done
                     ^          |
                     +-- error -+
```

| State   | UI                                                                        |
| ------- | ------------------------------------------------------------------------- |
| idle    | Full-screen dropzone                                                      |
| editing | PDF visible, sidebar visible, user adds/edits elements                    |
| signing | Spinner, UI blocked                                                       |
| done    | Success overlay, "Sign another"                                           |
| error   | Error overlay, "Try again" returns to editing                             |

"Sign & Download" button is enabled when `elements.length > 0`.

`activeMode` is a UI interaction mode within the `editing` state, not a separate app state.

## Sidebar (Context-Sensitive)

### Top — Element Toolbar

Two buttons always visible in editing state:

```
[+ Signature]  [+ Text]
```

- "+ Signature" sets `activeMode` to `"place-signature"`, shows signature selection section
- "+ Text" sets `activeMode` to `"place-text"`

### Middle — Context Panel

**When `activeMode === "place-signature"`:**
- SignatureCanvas (draw new)
- Saved signatures grid (thumbnails, 2-3 per row)
  - Click thumbnail: select that signature for placement (blue border highlight)
  - X button on thumbnail: delete saved signature
- Drawing a new signature in canvas makes it the "current" for placement
- Message: "Click on the page to place"

**When `activeMode === "place-text"`:**
- Message: "Click on the page to add text"

**When a signature element is selected:**
- Size slider (25-200%)
- Delete button

**When a text element is selected:**
- Font family: dropdown (Helvetica / Times / Courier)
- Font size: number input (12-72)
- Color: 3 presets (black #000000 / blue #0000FF / red #FF0000) + custom hex input
- Bold / Italic: toggle buttons
- Delete button

**When nothing selected and `activeMode === "select"`:**
- Toolbar buttons [+ Signature] [+ Text]
- General info

### Bottom (always visible)

- Page indicator
- LocalBadge
- Free counter

## Interaction with PDF

### Click Modes

- `activeMode === "select"`: click on element selects it; click on empty area deselects
- `activeMode === "place-signature"`: click on page places signature at click point, switches
  back to `"select"`, selects the new element
- `activeMode === "place-text"`: click on page creates text element with "Type here" placeholder,
  switches to `"select"`, selects the element, focuses text input

### Drag and Resize

Same for both types — unified ResizableOverlay component:
- Drag: move within page bounds
- Corner handles: proportional resize for signatures (preserves aspect ratio), free resize for
  text (width and height independent — user controls the bounding box, text wraps within it)
- Min size: 30x10px

### Text Editing

- Double-click on text element: inline textarea appears for editing
- Single click: select only (drag/resize)
- Enter or click outside: finish editing, save text
- Text renders as DOM element with CSS styles matching font settings

### Deletion

- Select element → "Delete" button in panel
- Or Delete/Backspace key (when not editing text)

### Visual Styling

| State                 | Appearance                                        |
| --------------------- | ------------------------------------------------- |
| Selected              | Blue dashed border 2px + corner handles           |
| Hover (not selected)  | Light gray border 1px                             |
| Not selected, no hover | No border                                        |

## Saved Signatures

### Storage

Key: `"pdf_sign_saved_signatures"`

```typescript
interface SavedSignature {
  id: string
  dataUrl: string
  createdAt: number
}
```

Maximum 10 saved signatures.

### Migration

On first load: read old key `"pdf_sign_saved_signature"`. If present, convert to array format
under new key, delete old key.

### UI

Grid of thumbnails in sidebar when in `place-signature` mode. Click to select for placement,
X to delete.

## Signing (pdf-signer.ts changes)

### New Interface

```typescript
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

type ElementInput = SignElementInput | TextElementInput

interface SignOptions {
  pdfBytes: ArrayBuffer
  elements: ElementInput[]
  addWatermark: boolean
}
```

### Processing

1. Load PDF via pdf-lib
2. For each element:
   - signature: embedPng + drawImage (existing logic, per element)
   - text: drawText with StandardFonts (Helvetica/HelveticaBold/HelveticaOblique/HelveticaBoldOblique,
     Times-Roman/Times-Bold/Times-Italic/Times-BoldItalic, Courier/Courier-Bold/Courier-Oblique/
     Courier-BoldOblique). Font variant selected by bold+italic combination.
3. Coordinate conversion: screen coords / scale to PDF points, Y inverted. For text:
   `pdfFontSize = screenFontSize / scale`
4. Watermark on last page (if free tier)
5. Save and download

### Freemium

One "signing" per document, not per element. Users pay for signed documents.

## Component Structure

### New Components

| Component              | Purpose                                                                           |
| ---------------------- | --------------------------------------------------------------------------------- |
| ResizableOverlay.tsx   | Universal overlay with drag + resize handles, accepts children                    |
| OverlayElement.tsx     | Renders one PlacedElement inside ResizableOverlay (img for sig, div for text)      |
| TextOverlayContent.tsx | Text display + inline editing on double-click                                     |
| SavedSignatureGrid.tsx | Grid of saved signature thumbnails with select and delete                          |
| TextStylePanel.tsx     | Font family / size / color / bold / italic controls                               |
| ElementToolbar.tsx     | [+ Signature] [+ Text] buttons                                                   |

### Modified Components

| Component            | Change                                                                         |
| -------------------- | ------------------------------------------------------------------------------ |
| EditorSidebar.tsx    | Full rewrite: context panel based on activeMode and selectedId                 |
| ScrollablePdfViewer  | Children render prop receives array of elements for each page                  |
| editor.tsx           | New state: elements[], selectedId, activeMode. Simplified state machine.       |
| lib/pdf-signer.ts    | Accept elements[] array, render text via drawText with StandardFonts           |
| lib/storage.ts       | Array of saved signatures + migration from single signature                    |

### Removed Components

| Component           | Reason                      |
| ------------------- | --------------------------- |
| ResizableSignature  | Replaced by ResizableOverlay |
| SizeSlider          | Integrated into sidebar      |

### Unchanged

All other lib/ modules (pdf-renderer, signature-trim, auth, counter, payments), background.ts,
options.tsx, popup.tsx, LocalBadge, Paywall, FileDropzone, PageIndicator, EditorHeader.
SignatureCanvas unchanged — same draw/save/load behavior, output feeds into new flow.
