import React, { useCallback, useState } from "react"

import type { ActiveMode, PlacedElement, SavedSignature, TextElement } from "~lib/types"
import { saveSignatureToLibrary } from "~lib/storage"

import { ElementToolbar } from "./ElementToolbar"
import { LocalBadge } from "./LocalBadge"
import { SavedSignatureGrid } from "./SavedSignatureGrid"
import { SignatureCanvas } from "./SignatureCanvas"
import { SizeSlider } from "./SizeSlider"
import { TextStylePanel } from "./TextStylePanel"

interface EditorSidebarProps {
  activeMode: ActiveMode
  onModeChange: (mode: ActiveMode) => void
  selectedElement: PlacedElement | null
  onCurrentSignatureReady: (dataUrl: string) => void
  onSavedSignatureSelect: (sig: SavedSignature) => void
  onElementUpdate: (id: string, updates: Partial<PlacedElement>) => void
  onElementDelete: (id: string) => void
  currentPage: number
  totalPages: number
  isPro: boolean
  used: number
  limit: number
}

export function EditorSidebar({
  activeMode, onModeChange,
  selectedElement,
  onCurrentSignatureReady, onSavedSignatureSelect,
  onElementUpdate, onElementDelete,
  currentPage, totalPages,
  isPro, used, limit,
}: EditorSidebarProps) {
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleSignatureChange = useCallback((dataUrl: string | null) => {
    if (dataUrl) {
      setSelectedSavedId(null)
      onCurrentSignatureReady(dataUrl)
    }
  }, [onCurrentSignatureReady])

  const handleSaveToLibrary = useCallback(async () => {
    // SignatureCanvas calls saveSignature internally, but we need to refresh the grid
    setRefreshTrigger(prev => prev + 1)
  }, [])

  const handleSavedSelect = useCallback((sig: SavedSignature) => {
    setSelectedSavedId(sig.id)
    onSavedSignatureSelect(sig)
  }, [onSavedSignatureSelect])

  const selectedSig = selectedElement?.type === "signature" ? selectedElement : null
  const selectedText = selectedElement?.type === "text" ? selectedElement as TextElement : null

  return (
    <aside className="editor-sidebar">
      <ElementToolbar activeMode={activeMode} onModeChange={onModeChange} />

      {activeMode === "place-signature" && (
        <>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Draw new</h3>
            <SignatureCanvas onSignatureChange={handleSignatureChange} onSave={() => setRefreshTrigger(prev => prev + 1)} />
          </div>
          <SavedSignatureGrid
            selectedId={selectedSavedId}
            onSelect={handleSavedSelect}
            refreshTrigger={refreshTrigger}
          />
          <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded text-center">
            Click on the page to place signature
          </p>
        </>
      )}

      {activeMode === "place-text" && (
        <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded text-center">
          Click on the page to add text
        </p>
      )}

      {activeMode === "select" && selectedSig && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Signature</h3>
          <SizeSlider
            value={Math.max(25, Math.min(200, Math.round((selectedSig.width / 150) * 100)))}
            onChange={(val) => {
              const ratio = selectedSig.height / (selectedSig.width || 1)
              const newW = 150 * (val / 100)
              const newH = newW * ratio
              const cx = selectedSig.x + selectedSig.width / 2
              const cy = selectedSig.y + selectedSig.height / 2
              onElementUpdate(selectedSig.id, {
                width: newW, height: newH,
                x: cx - newW / 2, y: cy - newH / 2,
              })
            }}
          />
          <button
            onClick={() => onElementDelete(selectedSig.id)}
            className="btn-secondary text-xs py-1 text-red-500 hover:text-red-700"
          >
            Delete element
          </button>
        </div>
      )}

      {activeMode === "select" && selectedText && (
        <TextStylePanel
          element={selectedText}
          onChange={(updates) => onElementUpdate(selectedText.id, updates)}
          onDelete={() => onElementDelete(selectedText.id)}
        />
      )}

      <div className="mt-auto">
        <div className="text-[10px] text-gray-400 leading-tight mb-2 border border-gray-100 rounded p-1.5">
          <div className="font-medium text-gray-500 mb-0.5">Font language support</div>
          <div>Roboto — Latin, Cyrillic, Greek, Vietnamese</div>
          <div>Open Sans — Latin, Cyrillic, Greek</div>
          <div>Helvetica, Times, Courier — Latin only</div>
        </div>
        <div className="text-xs text-gray-400 mb-2">Page {currentPage} of {totalPages}</div>
        <LocalBadge />
        {!isPro && (
          <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2 text-center">
            {used >= limit ? "Free file used" : `${limit - used} free file remaining`}
          </div>
        )}
      </div>
    </aside>
  )
}
