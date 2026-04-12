import React, { useEffect, useState } from "react"

import type { SavedSignature } from "~lib/types"
import { deleteSignatureFromLibrary, loadSignatures } from "~lib/storage"

interface SavedSignatureGridProps {
  selectedId: string | null
  onSelect: (sig: SavedSignature) => void
  refreshTrigger: number
}

export function SavedSignatureGrid({ selectedId, onSelect, refreshTrigger }: SavedSignatureGridProps) {
  const [signatures, setSignatures] = useState<SavedSignature[]>([])

  useEffect(() => {
    loadSignatures().then(setSignatures)
  }, [refreshTrigger])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteSignatureFromLibrary(id)
    setSignatures(prev => prev.filter(s => s.id !== id))
  }

  if (signatures.length === 0) return null

  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">Saved signatures</p>
      <div className="grid grid-cols-3 gap-2">
        {signatures.map((sig) => (
          <div
            key={sig.id}
            onClick={() => onSelect(sig)}
            className={`relative cursor-pointer border-2 rounded p-1 bg-white hover:border-blue-300 transition-colors ${
              selectedId === sig.id ? "border-blue-500" : "border-gray-200"
            }`}
          >
            <img src={sig.dataUrl} alt="Saved" className="w-full h-8 object-contain" />
            <button
              onClick={(e) => handleDelete(e, sig.id)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs leading-none flex items-center justify-center hover:bg-red-600"
            >
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
