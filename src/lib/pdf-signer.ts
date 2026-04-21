import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

import { getFontDef, getVariantKey, loadFontBytes } from "./fonts"

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
  fontFamily: string
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
}

export type ElementInput = SignElementInput | TextElementInput

interface SignOptions {
  pdfBytes: ArrayBuffer
  elements: ElementInput[]
}

function hexToRgb(hex: string) {
  if (!hex || hex.length < 7 || hex[0] !== "#") return rgb(0, 0, 0)
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  if (isNaN(r) || isNaN(g) || isNaN(b)) return rgb(0, 0, 0)
  return rgb(r, g, b)
}

export async function signPdf(opts: SignOptions): Promise<Uint8Array> {
  let pdfDoc: PDFDocument
  try {
    pdfDoc = await PDFDocument.load(opts.pdfBytes)
  } catch {
    throw new Error("Cannot open this PDF. It may be encrypted or password-protected.")
  }

  pdfDoc.registerFontkit(fontkit)

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
      const fontDef = getFontDef(el.fontFamily)
      const variantKey = getVariantKey(el.bold, el.italic)
      const cacheKey = `${el.fontFamily}-${variantKey}`

      if (!embeddedFonts.has(cacheKey)) {
        if (fontDef?.isStandard) {
          const stdFont = fontDef.variants[variantKey] as StandardFonts || StandardFonts.Helvetica
          embeddedFonts.set(cacheKey, await pdfDoc.embedFont(stdFont))
        } else if (fontDef) {
          const path = fontDef.variants[variantKey] as string
          const bytes = await loadFontBytes(path)
          embeddedFonts.set(cacheKey, await pdfDoc.embedFont(bytes))
        } else {
          embeddedFonts.set(cacheKey, await pdfDoc.embedFont(StandardFonts.Helvetica))
        }
      }

      const font = embeddedFonts.get(cacheKey)!
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

  return pdfDoc.save()
}

export function downloadSignedPdf(pdfBytes: Uint8Array, originalFileName: string): void {
  const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = originalFileName.replace(/\.pdf$/i, "") + "-signed.pdf"
  link.click()
  URL.revokeObjectURL(url)
}
