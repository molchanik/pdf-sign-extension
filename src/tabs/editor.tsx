import React, { useCallback, useEffect, useRef, useState } from "react"

import { EditorHeader } from "~components/EditorHeader"
import { EditorSidebar } from "~components/EditorSidebar"
import { FileDropzone } from "~components/FileDropzone"
import { OverlayElement } from "~components/OverlayElement"
import { Paywall } from "~components/Paywall"
import { ScrollablePdfViewer, type PageInfo } from "~components/ScrollablePdfViewer"
import { getUserEmail, isAuthenticated, signInWithGoogle } from "~lib/auth"
import { checkSignLimit, incrementSignCount } from "~lib/counter"
import { registerPreviewFonts } from "~lib/fonts"
import { checkProStatus } from "~lib/payments"
import { downloadSignedPdf, signPdf, type ElementInput } from "~lib/pdf-signer"
import type { ActiveMode, PlacedElement, SavedSignature, SignatureElement, TextElement } from "~lib/types"

import "~styles/globals.css"

type AppState = "idle" | "editing" | "signing" | "done" | "error" | "need-auth"

function Editor() {
  const [appState, setAppState] = useState<AppState>("idle")
  const [userEmail, setUserEmail] = useState<string | null>(null)
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
  const [errorType, setErrorType] = useState<"font" | "general">("general")

  const [isPro, setIsPro] = useState(false)
  const [used, setUsed] = useState(0)
  const [limit, setLimit] = useState(1)
  const [showPaywall, setShowPaywall] = useState(false)

  const pageScalesRef = useRef<Map<number, number>>(new Map())

  const [iconUrl, setIconUrl] = useState("")
  useEffect(() => {
    const manifest = chrome.runtime.getManifest()
    const iconPath = (manifest.icons as Record<string, string>)?.["48"]
      || (manifest.icons as Record<string, string>)?.["128"] || ""
    if (iconPath) setIconUrl(chrome.runtime.getURL(iconPath))
    registerPreviewFonts()

    // Check auth silently — don't block UI
    isAuthenticated().then(async (authed) => {
      if (authed) {
        const email = await getUserEmail()
        setUserEmail(email)
      }
    }).catch(() => {})
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
    setElements(prev => prev.map(el => el.id === id ? ({ ...el, ...updates } as PlacedElement) : el))
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

    // Require sign-in before downloading
    const authed = await isAuthenticated()
    if (!authed) {
      setAppState("need-auth")
      return
    }

    setAppState("signing")

    try {
      // Check ExtensionPay first — if paid, skip Supabase limit check
      const proStatus = await checkProStatus()

      let limitResult = { allowed: true, isPro: proStatus.paid, used: 0, limit: 1 }

      if (!proStatus.paid) {
        limitResult = await checkSignLimit()
      }

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
      })

      // Increment BEFORE download so a fast user can't bypass the counter
      // by triggering multiple signs while increments are in flight.
      if (!limitResult.isPro) {
        try {
          await incrementSignCount()
          setUsed(limitResult.used + 1)
        } catch (e) {
          // Increment failure blocks download — surface the error to the user
          throw new Error("Could not record this sign. Try again.")
        }
      }
      downloadSignedPdf(signed, fileName)
      setAppState("done")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signing failed"
      if (msg.includes("WinAnsi") || msg.includes("cannot encode")) {
        const usedFonts = [...new Set(
          elements.filter(el => el.type === "text").map(el => el.fontFamily)
        )]
        const stdFonts = usedFonts.filter(f => ["Helvetica", "Times-Roman", "Courier"].includes(f))
        const fontName = stdFonts.length > 0 ? stdFonts.join(", ") : "The selected font"
        setErrorMsg(fontName)
        setErrorType("font")
      } else {
        setErrorMsg(msg)
        setErrorType("general")
      }
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

  // IDLE: dropzone
  if (appState === "idle") {
    return (
      <div className="editor-layout">
        <div className="flex items-center gap-2 p-4 bg-white border-b border-gray-200">
          {iconUrl ? <img src={iconUrl} alt="" className="w-6 h-6" /> : <div className="w-6 h-6" />}
          <span className="font-bold text-gray-800">PDF Sign</span>
          {userEmail && (
            <span className="ml-auto text-xs text-gray-400">{userEmail}</span>
          )}
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
            <div className="flex gap-2">
              <button onClick={() => setAppState("editing")} className="btn-secondary flex-1 py-2">Continue editing</button>
              <button onClick={handleReset} className="btn-primary flex-1 py-2">Sign another PDF</button>
            </div>
          </div>
        </div>
      )}

      {appState === "error" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm text-center">
            {errorType === "font" ? (
              <>
                <svg className="w-12 h-12 mx-auto mb-3" viewBox="0 0 48 48" fill="none">
                  <path d="M24 4L44 40H4L24 4Z" fill="#FFF3E0" stroke="#FB8C00" strokeWidth="2" strokeLinejoin="round"/>
                  <path d="M24 18V28" stroke="#FB8C00" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="24" cy="33" r="1.5" fill="#FB8C00"/>
                </svg>
                <h2 className="text-lg font-bold text-gray-800 mb-2">Unsupported characters</h2>
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-semibold">{errorMsg}</span> supports Latin characters only.
                </p>
                <p className="text-sm text-gray-500 mb-5">
                  Switch to <span className="font-semibold">Roboto</span> or <span className="font-semibold">Open Sans</span> for Cyrillic, Greek, and other languages.
                </p>
                <button onClick={() => setAppState("editing")} className="btn-primary w-full py-2">Back to editor</button>
              </>
            ) : (
              <>
                <svg className="w-12 h-12 mx-auto mb-3" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="20" fill="#FFEBEE" stroke="#EF5350" strokeWidth="2"/>
                  <path d="M17 17L31 31M31 17L17 31" stroke="#EF5350" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                <h2 className="text-lg font-bold text-gray-800 mb-2">Error</h2>
                <p className="text-sm text-gray-500 mb-5">{errorMsg}</p>
                <button onClick={() => setAppState("editing")} className="btn-primary w-full py-2">Try again</button>
              </>
            )}
          </div>
        </div>
      )}

      {appState === "need-auth" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm text-center">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Sign in to download</h2>
            <p className="text-sm text-gray-500 mb-6">
              Sign in with Google to download your signed PDF. Your first document is free. After signing in, click "Sign &amp; Download" again.
            </p>
            {errorMsg && errorType === "general" && (
              <p className="text-sm text-red-500 mb-3">{errorMsg}</p>
            )}
            <button
              onClick={async () => {
                setErrorMsg("")
                setErrorType("general")
                try {
                  await signInWithGoogle()
                  const email = await getUserEmail()
                  setUserEmail(email)
                  setAppState("editing")
                } catch (err) {
                  setErrorMsg("Sign-in failed: " + (err instanceof Error ? err.message : String(err)))
                  setErrorType("general")
                }
              }}
              className="btn-primary w-full py-3 text-base mb-3"
            >
              Sign in with Google
            </button>
            <button
              onClick={() => { setAppState("editing"); setErrorMsg("") }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Back to editor
            </button>
            <p className="text-xs text-gray-400 mt-4">
              All PDF processing happens locally. We only use your account to track usage.
            </p>
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
