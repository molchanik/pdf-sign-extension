import React, { useCallback, useRef, useState } from "react"
import { PDFDocument } from "pdf-lib"

interface Props {
  onFileSelect: (file: File, pageCount: number, arrayBuffer: ArrayBuffer) => void
  fullScreen?: boolean
}

export function FileDropzone({ onFileSelect, fullScreen = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const MAX_SIZE_MB = 50

  const processFile = useCallback(
    async (file: File) => {
      setError(null)

      if (file.type !== "application/pdf") {
        setError("Please select a PDF file.")
        return
      }

      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`File too large (max ${MAX_SIZE_MB}MB).`)
        return
      }

      setLoading(true)
      try {
        const arrayBuffer = await file.arrayBuffer()
        // Use pdf-lib for page count — it works reliably in extension context
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
        const pages = pdfDoc.getPageCount()
        onFileSelect(file, pages, arrayBuffer)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error("PDF load error:", msg)
        setError(`Cannot read this PDF: ${msg}`)
      } finally {
        setLoading(false)
      }
    },
    [onFileSelect]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
      // Reset input so the same file can be selected again
      if (e.target) e.target.value = ""
    },
    [processFile]
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        flex flex-col items-center justify-center gap-3
        border-2 border-dashed rounded-xl cursor-pointer
        transition-colors duration-150
        ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
        ${fullScreen ? "min-h-[80vh] p-12" : "p-6"}
      `}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        onChange={handleChange}
        className="hidden"
      />

      {loading ? (
        <p className="text-sm text-gray-500">Reading PDF...</p>
      ) : (
        <>
          <svg
            className={`${fullScreen ? "w-16 h-16" : "w-8 h-8"} text-gray-400`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className={`text-gray-600 ${fullScreen ? "text-lg" : "text-sm"}`}>
            Drop a PDF here or <span className="text-blue-600 underline">browse</span>
          </p>
          <p className="text-xs text-gray-400">Max 50 MB</p>
        </>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
