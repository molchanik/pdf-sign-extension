# PDF Sign

Chrome extension for signing PDF documents locally. Your file never leaves your browser.

## Features

- **Full-tab editor** — PDF opens in a dedicated browser tab with scrollable multi-page viewer
- **Multiple signatures** — draw new or pick from saved library, place on any page
- **Text fields** — name, date, custom text with font/size/color/bold/italic formatting
- **Drag & resize** — move and scale any element with corner handles
- **5 fonts** — Helvetica, Times, Courier (Latin only) + Roboto, Open Sans (Latin, Cyrillic, Greek)
- **Pen width presets** — Fine, Medium, Thick, Marker
- **100% local** — all processing happens in browser memory, no server upload
- **Freemium** — 1 free file (sign in with Google to download), then Pro $2.99/mo or $29.99/yr (via ExtensionPay)

## Tech Stack

| Layer      | Technology                            |
| ---------- | ------------------------------------- |
| Framework  | Plasmo (Chrome Extension, Manifest V3) |
| UI         | React 18, TypeScript, Tailwind CSS    |
| PDF read   | pdfjs-dist (PDF.js)                   |
| PDF write  | pdf-lib + @pdf-lib/fontkit            |
| Signatures | signature_pad                         |
| Auth       | Supabase (Google OAuth)                |
| Payments   | ExtensionPay                          |

## Project Structure

```
src/
├── tabs/editor.tsx              # Main editor — state machine, layout
├── popup.tsx                    # Minimal launcher (opens editor tab)
├── background.ts                # Service worker (MV3)
├── options.tsx                  # Settings page
├── components/
│   ├── ScrollablePdfViewer.tsx  # Lazy-rendered vertical PDF scroll
│   ├── ResizableOverlay.tsx     # Universal drag + resize overlay
│   ├── OverlayElement.tsx       # Renders signature or text element
│   ├── TextOverlayContent.tsx   # Inline text editing
│   ├── SignatureCanvas.tsx      # Drawing with pen width presets
│   ├── EditorSidebar.tsx        # Context-sensitive tools panel
│   ├── EditorHeader.tsx         # Top bar with Sign & Download
│   ├── TextStylePanel.tsx       # Font/size/color/bold/italic
│   ├── SavedSignatureGrid.tsx   # Saved signature thumbnails
│   ├── ElementToolbar.tsx       # [+ Signature] [+ Text] buttons
│   ├── FileDropzone.tsx         # PDF drag & drop upload
│   ├── SizeSlider.tsx           # Range input for signature size
│   ├── PageIndicator.tsx        # Floating "Page X of Y"
│   ├── LocalBadge.tsx           # "Processing locally" indicator
│   └── Paywall.tsx              # Upgrade modal
├── lib/
│   ├── pdf-signer.ts            # Embed signatures + text into PDF
│   ├── pdf-renderer.ts          # PDF.js rendering (PdfDocumentRenderer)
│   ├── fonts.ts                 # Font definitions + TTF loader
│   ├── types.ts                 # Shared TypeScript types
│   ├── storage.ts               # chrome.storage wrapper (multi-sig)
│   ├── signature-trim.ts        # Canvas transparent edge trimming
│   ├── auth.ts                  # Supabase auth (Google OAuth)
│   ├── counter.ts               # Freemium usage counter
│   └── payments.ts              # ExtensionPay integration
└── styles/globals.css           # Tailwind + custom utilities
```

## Setup

### Prerequisites

- Node.js 18+
- npm
- Supabase project (for auth + usage tracking)

### Install

```bash
npm install
```

### Configure

Copy `.env.local` and fill in your Supabase credentials:

```
PLASMO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PLASMO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
PLASMO_PUBLIC_EXTPAY_ID=your-extension-id
```

### Database

Run the migration in Supabase SQL Editor:

```bash
# File: supabase/migrations/001_initial.sql
```

### Edge Functions

```bash
supabase functions deploy check-limit
supabase functions deploy sign-count
```

### Build

```bash
npm run build          # Production build → build/chrome-mv3-prod/
npm run dev            # Development with hot reload
```

### Test

```bash
npm test              # Run all tests (Vitest)
npm run test:watch    # Watch mode
```

Covers: pdf-signer, fonts, counter, payments, edge functions (check-limit, sign-count).

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `build/chrome-mv3-prod/` (production) or `build/chrome-mv3-dev/` (development)

## How It Works

1. Click extension icon → **Open PDF Editor** → full-tab editor opens (no login required)
2. Drop a PDF → pages render with lazy loading (IntersectionObserver)
3. **+ Signature** → draw or pick saved → click on page to place
4. **+ Text** → click on page → type text, style with sidebar controls
5. Drag, resize, delete any element across pages
6. **Sign & Download** → sign in with Google (if not already) → pdf-lib embeds all elements → browser downloads signed PDF

All coordinates convert from screen space (top-left origin) to PDF space (bottom-left origin) at sign time. Custom fonts are embedded as TTF via fontkit.
