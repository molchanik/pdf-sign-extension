import React, { useCallback, useEffect, useRef, useState } from "react"

import { EditorHeader } from "~components/EditorHeader"
import { EditorSidebar } from "~components/EditorSidebar"
import { FileDropzone } from "~components/FileDropzone"
import { OverlayElement } from "~components/OverlayElement"
import { Paywall } from "~components/Paywall"
import { ScrollablePdfViewer, type PageInfo } from "~components/ScrollablePdfViewer"
import { getUserId } from "~lib/auth"
import { checkSignLimit, incrementSignCount } from "~lib/counter"
import { registerPreviewFonts } from "~lib/fonts"
import { downloadSignedPdf, signPdf, type ElementInput } from "~lib/pdf-signer"
import type { ActiveMode, PlacedElement, SavedSignature, SignatureElement, TextElement } from "~lib/types"

import "~styles/globals.css"

type AppState = "idle" | "editing" | "signing" | "done" | "error"

function Editor() {
  const [appState, setAppState] = useState<AppState>("idle")
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [fileName, setFileName] = useState("")

  const [elements, setElements] = useState<PlacedElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<ActiveMode>("select")

  const [pendingSignatureDataUrl, setPendingSignatureDataUrl] = useState<string | null>(null)

  const [currentPage, setCurrentPage] = useState(1)
  const [errorMsg, setErrorMsg] = useState("")

  const [isPro, setIsPro] = useState(false)
  const [used, setUsed] = useState(0)
  const [limit, setLimit] = useState(3)
  const [showPaywall, setShowPaywall] = useState(false)

  const pageScalesRef = useRef<Map<number, number>>(new Map())

  const [iconUrl, setIconUrl] = useState("")
  useEffect(() => {
    const manifest = chrome.runtime.getManifest()
    const iconPath = (manifest.icons as Record<string, string>)?.["48"]
      || (manifest.icons as Record<string, string>)?.["128"] || ""
    if (iconPath) setIconUrl(chrome.runtime.getURL(iconPath))
    registerPreviewFonts()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editingId) return
        if (selectedId) {
          setElements(prev => prev.filter(el => el.id !== selectedId))
          setSelectedId(null)
        }
      }
      if (e.key === "Escape") {
        setSelectedId(null)
        setEditingId(null)
        setActiveMode("select")
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [selectedId, editingId])

  const selectedElement = elements.find(el => el.id === selectedId) || null

  const handleFileSelect = (file: File, pages: number, bytes: ArrayBuffer) => {
    setPdfBytes(bytes)
    setPageCount(pages)
    setFileName(file.name)
    setAppState("editing")
    setElements([])
    setSelectedId(null)
    setActiveMode("select")
  }

  const handlePageClick = useCallback((pageIndex: number, x: number, y: number, _scale: number) => {
    if (activeMode === "place-signature" && pendingSignatureDataUrl) {
      const w = 150
      const h = 50
      const newEl: SignatureElement = {
        type: "signature",
        id: crypto.randomUUID(),
        pageIndex,
        x: Math.max(0, x - w / 2),
        y: Math.max(0, y - h / 2),
        width: w,
        height: h,
        dataUrl: pendingSignatureDataUrl,
      }
      setElements(prev => [...prev, newEl])
      setSelectedId(newEl.id)
      setActiveMode("select")
    } else if (activeMode === "place-text") {
      const newEl: TextElement = {
        type: "text",
        id: crypto.randomUUID(),
        pageIndex,
        x: Math.max(0, x - 60),
        y: Math.max(0, y - 12),
        width: 120,
        height: 30,
        text: "Type here",
        fontFamily: "Helvetica",
        fontSize: 16,
        color: "#000000",
        bold: false,
        italic: false,
      }
      setElements(prev => [...prev, newEl])
      setSelectedId(newEl.id)
      setEditingId(newEl.id)
      setActiveMode("select")
    } else if (activeMode === "select") {
      setSelectedId(null)
      setEditingId(null)
    }
  }, [activeMode, pendingSignatureDataUrl])

  const handleElementMove = useCallback((id: string, x: number, y: number) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, x, y } : el))
  }, [])

  const handleElementResize = useCallback((id: string, w: number, h: number) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, width: w, height: h } : el))
  }, [])

  const handleElementUpdate = useCallback((id: string, updates: Partial<PlacedElement>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el))
  }, [])

  const handleElementDelete = useCallback((id: string) => {
    setElements(prev => prev.filter(el => el.id !== id))
    setSelectedId(prev => prev === id ? null : prev)
  }, [])

  // Use ref to avoid re-creating callbacks on every elements change
  const elementsRef = useRef(elements)
  elementsRef.current = elements

  const handleElementSelect = useCallback((id: string) => {
    setSelectedId(id)
    const el = elementsRef.current.find(e => e.id === id)
    if (el?.type === "text") {
      setEditingId(id)
    } else {
      setEditingId(null)
    }
  }, [])

  const handleDoubleClick = useCallback((id: string) => {
    const el = elementsRef.current.find(e => e.id === id)
    if (el?.type === "text") {
      setEditingId(id)
      setSelectedId(id)
    }
  }, [])

  const handleTextChange = useCallback((id: string, text: string) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, text } : el))
  }, [])

  const handleEditDone = useCallback(() => {
    setEditingId(null)
  }, [])

  const handleCurrentSignatureReady = useCallback((dataUrl: string) => {
    setPendingSignatureDataUrl(dataUrl)
  }, [])

  const handleSavedSignatureSelect = useCallback((sig: SavedSignature) => {
    setPendingSignatureDataUrl(sig.dataUrl)
  }, [])

  const handleSign = async () => {
    if (!pdfBytes || elements.length === 0) return
    setAppState("signing")

    try {
      const userId = await getUserId()
      const limitResult = await checkSignLimit(userId)
      setUsed(limitResult.used)
      setLimit(limitResult.limit)
      setIsPro(limitResult.isPro)

      if (!limitResult.allowed) {
        setShowPaywall(true)
        setAppState("editing")
        return
      }

      const inputs: ElementInput[] = elements.map(el => {
        const scale = pageScalesRef.current.get(el.pageIndex) || 1
        if (el.type === "signature") {
          return {
            type: "signature" as const,
            pageIndex: el.pageIndex,
            x: el.x / scale,
            y: el.y / scale,
            width: el.width / scale,
            height: el.height / scale,
            dataUrl: el.dataUrl,
          }
        }
        return {
          type: "text" as const,
          pageIndex: el.pageIndex,
          x: el.x / scale,
          y: el.y / scale,
          width: el.width / scale,
          height: el.height / scale,
          text: el.text,
          fontFamily: el.fontFamily,
          fontSize: el.fontSize / scale,
          color: el.color,
          bold: el.bold,
          italic: el.italic,
        }
      })

      const signed = await signPdf({
        pdfBytes,
        elements: inputs,
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
    setElements([])
    setSelectedId(null)
    setEditingId(null)
    setActiveMode("select")
    setPendingSignatureDataUrl(null)
    setErrorMsg("")
  }

  const handleSettingsClick = () => {
    chrome.runtime.openOptionsPage()
  }

  if (appState === "idle") {
    return (
      <div className="editor-layout">
        <div className="flex items-center gap-2 p-4 bg-white border-b border-gray-200">
          {iconUrl ? <img src={iconUrl} alt="" className="w-6 h-6" /> : <div className="w-6 h-6" />}
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
      <EditorHeader
        fileName={fileName}
        canSign={elements.length > 0 && appState === "editing"}
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
            {(pageIndex: number, pageInfo: PageInfo | null) => {
              if (!pageInfo) return null
              const pageElements = elements.filter(el => el.pageIndex === pageIndex)
              return pageElements.map(el => (
                <OverlayElement
                  key={el.id}
                  element={el}
                  selected={el.id === selectedId}
                  isEditing={el.id === editingId}
                  maxWidth={pageInfo.width * pageInfo.scale}
                  maxHeight={pageInfo.height * pageInfo.scale}
                  onSelect={handleElementSelect}
                  onMove={handleElementMove}
                  onResize={handleElementResize}
                  onDoubleClick={handleDoubleClick}
                  onTextChange={handleTextChange}
                  onEditDone={handleEditDone}
                />
              ))
            }}
          </ScrollablePdfViewer>
        )}

        <EditorSidebar
          activeMode={activeMode}
          onModeChange={setActiveMode}
          selectedElement={selectedElement}
          onCurrentSignatureReady={handleCurrentSignatureReady}
          onSavedSignatureSelect={handleSavedSignatureSelect}
          onElementUpdate={handleElementUpdate}
          onElementDelete={handleElementDelete}
          currentPage={currentPage}
          totalPages={pageCount}
          isPro={isPro}
          used={used}
          limit={limit}
        />
      </div>

      {appState === "done" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm text-center">
            <div className="text-4xl mb-3 text-green-500">&#10003;</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Downloaded!</h2>
            <p className="text-sm text-gray-500 mb-4">Your signed PDF has been saved.</p>
            <button onClick={handleReset} className="btn-primary w-full py-2">Sign another PDF</button>
          </div>
        </div>
      )}

      {appState === "error" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm text-center">
            <div className="text-4xl mb-3 text-red-500">!</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Error</h2>
            <p className="text-sm text-red-500 mb-4">{errorMsg}</p>
            <button onClick={() => setAppState("editing")} className="btn-primary w-full py-2">Try again</button>
          </div>
        </div>
      )}

      {showPaywall && (
        <Paywall used={used} limit={limit} onClose={() => setShowPaywall(false)} />
      )}
    </div>
  )
}

export default Editor
