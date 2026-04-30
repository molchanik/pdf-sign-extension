import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { resolve } from "path"
import { PDFDocument } from "pdf-lib"

// FileDropzone calls PDFDocument.load(arrayBuffer) without ignoreEncryption,
// then matches `e.message.includes("encrypted")` to surface a human-readable
// "This PDF is password-protected. Remove the password first..." notice.
//
// These tests guard the upstream contract: pdf-lib must throw on an encrypted
// document and the error message must contain the "encrypted" substring.
// React-component rendering is not exercised here (no @testing-library/react
// in this project) — the rejection logic in FileDropzone is straightforward
// pattern-matching once pdf-lib has thrown, so locking down the throw side
// is enough to keep the upload-step user-facing message wired correctly.

const CORPUS = resolve(__dirname, "../../../scripts/show-hn-stress/corpus")

function loadFixture(filename: string): ArrayBuffer {
  const bytes = readFileSync(resolve(CORPUS, filename))
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
}

describe("FileDropzone upload-step contract", () => {
  it("rejects user-password-encrypted PDF with 'encrypted' in error message", async () => {
    const buf = loadFixture("encrypted-user-password.pdf")

    await expect(PDFDocument.load(buf)).rejects.toThrow(/encrypted/)
  })

  it("rejects owner-password-only encrypted PDF with 'encrypted' in error message", async () => {
    // Owner-password documents (no user-password) are rare in the wild.
    // pdf-lib treats them the same as user-encrypted — refuses to load
    // without ignoreEncryption. FileDropzone surfaces the same notice.
    const buf = loadFixture("encrypted-owner-only.pdf")

    await expect(PDFDocument.load(buf)).rejects.toThrow(/encrypted/)
  })

  it("loads a normal unencrypted PDF without throwing and reports page count", async () => {
    const buf = loadFixture("acroform-prefilled.pdf")

    const doc = await PDFDocument.load(buf)

    expect(doc.getPageCount()).toBeGreaterThan(0)
  })

  it("loads multipage unencrypted PDF and reports the correct page count", async () => {
    const buf = loadFixture("large-501-pages.pdf")

    const doc = await PDFDocument.load(buf)

    expect(doc.getPageCount()).toBe(501)
  })
})
