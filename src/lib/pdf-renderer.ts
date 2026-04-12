import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf"

if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
    "assets/pdf.worker.min.js"
  )
}

export interface RenderResult {
  scale: number
  pageWidth: number
  pageHeight: number
}

/**
 * Manages a single PDF document instance for rendering.
 * Load once, render many pages, destroy when done.
 */
export class PdfDocumentRenderer {
  private pdf: pdfjsLib.PDFDocumentProxy | null = null
  private pdfBytes: ArrayBuffer

  constructor(pdfBytes: ArrayBuffer) {
    // Copy once at construction — not per page
    this.pdfBytes = pdfBytes.slice(0)
  }

  private async ensureLoaded(): Promise<pdfjsLib.PDFDocumentProxy> {
    if (!this.pdf) {
      const data = new Uint8Array(this.pdfBytes)
      this.pdf = await pdfjsLib.getDocument({
        data,
        isEvalSupported: false
      }).promise
    }
    return this.pdf
  }

  async renderPage(
    pageIndex: number,
    canvas: HTMLCanvasElement,
    containerWidth: number
  ): Promise<RenderResult> {
    const pdf = await this.ensureLoaded()
    const page = await pdf.getPage(pageIndex + 1)

    const viewport = page.getViewport({ scale: 1 })
    const scale = containerWidth / viewport.width
    const scaledViewport = page.getViewport({ scale })

    canvas.width = scaledViewport.width
    canvas.height = scaledViewport.height

    const ctx = canvas.getContext("2d")!
    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise

    return {
      scale,
      pageWidth: viewport.width,
      pageHeight: viewport.height
    }
  }

  get numPages(): number | null {
    return this.pdf?.numPages ?? null
  }

  destroy(): void {
    if (this.pdf) {
      this.pdf.destroy()
      this.pdf = null
    }
  }
}

/**
 * Legacy single-page render function — kept for backward compatibility.
 * Prefer PdfDocumentRenderer for multi-page rendering.
 */
export async function renderPage(
  pdfBytes: ArrayBuffer,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  containerWidth: number
): Promise<RenderResult> {
  const data = new Uint8Array(pdfBytes.slice(0))
  const pdf = await pdfjsLib.getDocument({
    data,
    isEvalSupported: false
  }).promise

  const page = await pdf.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale: 1 })
  const scale = containerWidth / viewport.width
  const scaledViewport = page.getViewport({ scale })

  canvas.width = scaledViewport.width
  canvas.height = scaledViewport.height

  const ctx = canvas.getContext("2d")!
  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise

  pdf.destroy()

  return {
    scale,
    pageWidth: viewport.width,
    pageHeight: viewport.height
  }
}
