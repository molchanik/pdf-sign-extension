import type { SavedSignature } from "./types"

const OLD_KEY = "pdf_sign_saved_signature"
const NEW_KEY = "pdf_sign_saved_signatures"
const MAX_SAVED = 10

async function migrate(): Promise<void> {
  const result = await chrome.storage.local.get([OLD_KEY, NEW_KEY])
  if (result[OLD_KEY] && !result[NEW_KEY]) {
    const migrated: SavedSignature[] = [{
      id: crypto.randomUUID(),
      dataUrl: result[OLD_KEY],
      createdAt: Date.now(),
    }]
    await chrome.storage.local.set({ [NEW_KEY]: JSON.stringify(migrated) })
    await chrome.storage.local.remove(OLD_KEY)
  }
}

export async function loadSignatures(): Promise<SavedSignature[]> {
  await migrate()
  const result = await chrome.storage.local.get(NEW_KEY)
  if (!result[NEW_KEY]) return []
  try {
    return JSON.parse(result[NEW_KEY])
  } catch {
    return []
  }
}

export async function saveSignatureToLibrary(dataUrl: string): Promise<SavedSignature> {
  const sigs = await loadSignatures()
  const newSig: SavedSignature = {
    id: crypto.randomUUID(),
    dataUrl,
    createdAt: Date.now(),
  }
  const updated = [newSig, ...sigs].slice(0, MAX_SAVED)
  await chrome.storage.local.set({ [NEW_KEY]: JSON.stringify(updated) })
  return newSig
}

export async function deleteSignatureFromLibrary(id: string): Promise<void> {
  const sigs = await loadSignatures()
  const updated = sigs.filter(s => s.id !== id)
  await chrome.storage.local.set({ [NEW_KEY]: JSON.stringify(updated) })
}

export async function saveSignature(dataUrl: string): Promise<void> {
  await saveSignatureToLibrary(dataUrl)
}

export async function loadSignature(): Promise<string | null> {
  const sigs = await loadSignatures()
  return sigs.length > 0 ? sigs[0].dataUrl : null
}

export async function deleteSignature(): Promise<void> {
  const sigs = await loadSignatures()
  if (sigs.length > 0) {
    await deleteSignatureFromLibrary(sigs[0].id)
  }
}
