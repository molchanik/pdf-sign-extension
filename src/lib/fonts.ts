import { StandardFonts } from "pdf-lib"

interface FontDef {
  id: string
  label: string
  cssFallback: string              // CSS font-family for preview
  variants: Record<string, string | StandardFonts>  // "normal-normal" → file path or StandardFonts enum
  isStandard: boolean
}

export const FONTS: FontDef[] = [
  {
    id: "Helvetica",
    label: "Helvetica",
    cssFallback: "Helvetica, Arial, sans-serif",
    isStandard: true,
    variants: {
      "normal-normal": StandardFonts.Helvetica,
      "bold-normal": StandardFonts.HelveticaBold,
      "normal-italic": StandardFonts.HelveticaOblique,
      "bold-italic": StandardFonts.HelveticaBoldOblique,
    },
  },
  {
    id: "Times-Roman",
    label: "Times",
    cssFallback: "'Times New Roman', Times, serif",
    isStandard: true,
    variants: {
      "normal-normal": StandardFonts.TimesRoman,
      "bold-normal": StandardFonts.TimesRomanBold,
      "normal-italic": StandardFonts.TimesRomanItalic,
      "bold-italic": StandardFonts.TimesRomanBoldItalic,
    },
  },
  {
    id: "Courier",
    label: "Courier",
    cssFallback: "'Courier New', Courier, monospace",
    isStandard: true,
    variants: {
      "normal-normal": StandardFonts.Courier,
      "bold-normal": StandardFonts.CourierBold,
      "normal-italic": StandardFonts.CourierOblique,
      "bold-italic": StandardFonts.CourierBoldOblique,
    },
  },
  {
    id: "Roboto",
    label: "Roboto",
    cssFallback: "Roboto, 'Helvetica Neue', Arial, sans-serif",
    isStandard: false,
    variants: {
      "normal-normal": "assets/fonts/Roboto-Regular.ttf",
      "bold-normal": "assets/fonts/Roboto-Bold.ttf",
      "normal-italic": "assets/fonts/Roboto-Italic.ttf",
      "bold-italic": "assets/fonts/Roboto-BoldItalic.ttf",
    },
  },
  {
    id: "OpenSans",
    label: "Open Sans",
    cssFallback: "'Open Sans', Roboto, sans-serif",
    isStandard: false,
    variants: {
      "normal-normal": "assets/fonts/OpenSans-Regular.ttf",
      "bold-normal": "assets/fonts/OpenSans-Bold.ttf",
      "normal-italic": "assets/fonts/OpenSans-Italic.ttf",
      "bold-italic": "assets/fonts/OpenSans-BoldItalic.ttf",
    },
  },
]

const fontCache = new Map<string, ArrayBuffer>()

export async function loadFontBytes(path: string): Promise<ArrayBuffer> {
  if (fontCache.has(path)) return fontCache.get(path)!
  const url = chrome.runtime.getURL(path)
  const response = await fetch(url)
  const bytes = await response.arrayBuffer()
  fontCache.set(path, bytes)
  return bytes
}

export function getFontDef(fontId: string): FontDef | undefined {
  return FONTS.find(f => f.id === fontId)
}

export function getVariantKey(bold: boolean, italic: boolean): string {
  return `${bold ? "bold" : "normal"}-${italic ? "italic" : "normal"}`
}

// Register custom fonts as CSS @font-face for preview
let fontsRegistered = false
export function registerPreviewFonts(): void {
  if (typeof document === "undefined" || fontsRegistered) return
  fontsRegistered = true
  const style = document.createElement("style")
  const rules: string[] = []

  for (const font of FONTS) {
    if (font.isStandard) continue
    for (const [variant, path] of Object.entries(font.variants)) {
      if (typeof path !== "string") continue
      const [weight, style_] = variant.split("-")
      const url = chrome.runtime.getURL(path)
      rules.push(`
        @font-face {
          font-family: '${font.id}';
          src: url('${url}') format('truetype');
          font-weight: ${weight === "bold" ? "700" : "400"};
          font-style: ${style_ === "italic" ? "italic" : "normal"};
        }
      `)
    }
  }

  style.textContent = rules.join("\n")
  document.head.appendChild(style)
}
