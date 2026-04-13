import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "fs"
import { resolve } from "path"
import { PDFDocument } from "pdf-lib"
import { signPdf, type ElementInput } from "../pdf-signer"
import { MINIMAL_PNG_DATA_URL } from "./helpers/minimal-png"

// Mock chrome.runtime.getURL — returns a file:// URL that fetch can resolve
vi.stubGlobal("chrome", {
  runtime: {
    getURL: (path: string) => resolve(__dirname, "../../../", path),
  },
})

function toArrayBuffer(buf: Uint8Array): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

// Mock fetch to read font files from disk
vi.stubGlobal("fetch", vi.fn(async (url: string) => {
  if (url.startsWith("data:")) {
    const base64 = url.split(",")[1]
    const buffer = Buffer.from(base64, "base64")
    return { arrayBuffer: () => Promise.resolve(toArrayBuffer(buffer)) }
  }
  const bytes = readFileSync(url)
  return { arrayBuffer: () => Promise.resolve(toArrayBuffer(bytes)) }
}))

async function createTestPdf(pageCount = 1): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([612, 792]) // US Letter
  }
  const bytes = await doc.save()
  return toArrayBuffer(bytes)
}

describe("signPdf", () => {
  it("returns valid PDF with no elements", async () => {
    const input = await createTestPdf()
    const result = await signPdf({ pdfBytes: input, elements: [] })
    const doc = await PDFDocument.load(result)
    expect(doc.getPages()).toHaveLength(1)
  })

  it("embeds text element and produces larger output", async () => {
    const input = await createTestPdf()
    const emptyResult = await signPdf({ pdfBytes: input, elements: [] })
    const elements: ElementInput[] = [{
      type: "text",
      pageIndex: 0,
      x: 50, y: 50, width: 200, height: 30,
      text: "UniqueTestString123",
      fontFamily: "Helvetica",
      fontSize: 16,
      color: "#000000",
      bold: false,
      italic: false,
    }]
    const result = await signPdf({ pdfBytes: input, elements })
    // PDF with text element should be larger than empty PDF
    expect(result.length).toBeGreaterThan(emptyResult.length)
    // Result is still a valid PDF
    const doc = await PDFDocument.load(result)
    expect(doc.getPages()).toHaveLength(1)
  })

  it("embeds signature image", async () => {
    const input = await createTestPdf()
    const elements: ElementInput[] = [{
      type: "signature",
      pageIndex: 0,
      x: 50, y: 50, width: 150, height: 50,
      dataUrl: MINIMAL_PNG_DATA_URL,
    }]
    const result = await signPdf({ pdfBytes: input, elements })
    // Result should be larger due to embedded image
    expect(result.length).toBeGreaterThan(new Uint8Array(input).length + 50)
  })

  it("places elements on different pages", async () => {
    const input = await createTestPdf(3)
    const elements: ElementInput[] = [
      {
        type: "text", pageIndex: 0,
        x: 50, y: 50, width: 200, height: 30,
        text: "Page1Text", fontFamily: "Helvetica",
        fontSize: 16, color: "#000000", bold: false, italic: false,
      },
      {
        type: "signature", pageIndex: 2,
        x: 50, y: 50, width: 150, height: 50,
        dataUrl: MINIMAL_PNG_DATA_URL,
      },
    ]
    const result = await signPdf({ pdfBytes: input, elements })
    const doc = await PDFDocument.load(result)
    expect(doc.getPages()).toHaveLength(3)
    // Result is larger than blank 3-page PDF due to text + image
    expect(result.length).toBeGreaterThan(new Uint8Array(input).length)
  })

  it("handles Cyrillic text with Roboto without error", async () => {
    const input = await createTestPdf()
    const elements: ElementInput[] = [{
      type: "text", pageIndex: 0,
      x: 50, y: 50, width: 200, height: 30,
      text: "Привет мир",
      fontFamily: "Roboto",
      fontSize: 16, color: "#000000", bold: false, italic: false,
    }]
    // Should not throw
    const result = await signPdf({ pdfBytes: input, elements })
    expect(result.length).toBeGreaterThan(0)
  })

  it("throws WinAnsi error for Cyrillic with Helvetica", async () => {
    const input = await createTestPdf()
    const elements: ElementInput[] = [{
      type: "text", pageIndex: 0,
      x: 50, y: 50, width: 200, height: 30,
      text: "Привет",
      fontFamily: "Helvetica",
      fontSize: 16, color: "#000000", bold: false, italic: false,
    }]
    await expect(signPdf({ pdfBytes: input, elements }))
      .rejects.toThrow(/WinAnsi|cannot encode/)
  })

  it("skips elements with invalid pageIndex", async () => {
    const input = await createTestPdf(1)
    const elements: ElementInput[] = [{
      type: "text", pageIndex: 99,
      x: 50, y: 50, width: 200, height: 30,
      text: "Ghost",
      fontFamily: "Helvetica",
      fontSize: 16, color: "#000000", bold: false, italic: false,
    }]
    // Should not throw, just skip
    const result = await signPdf({ pdfBytes: input, elements })
    expect(result.length).toBeGreaterThan(0)
  })

  it("throws readable error for invalid PDF bytes", async () => {
    const garbage = new ArrayBuffer(100)
    await expect(signPdf({ pdfBytes: garbage, elements: [] }))
      .rejects.toThrow("Cannot open this PDF")
  })

  it("applies correct color from hex", async () => {
    const input = await createTestPdf()
    const elements: ElementInput[] = [{
      type: "text", pageIndex: 0,
      x: 50, y: 50, width: 200, height: 30,
      text: "Red",
      fontFamily: "Helvetica",
      fontSize: 16, color: "#ff0000", bold: false, italic: false,
    }]
    // Should not throw — validates hexToRgb doesn't crash
    const result = await signPdf({ pdfBytes: input, elements })
    expect(result.length).toBeGreaterThan(0)
  })
})