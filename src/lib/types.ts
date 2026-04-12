export interface PlacedElementBase {
  id: string
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
}

export interface SignatureElement extends PlacedElementBase {
  type: "signature"
  dataUrl: string
}

export interface TextElement extends PlacedElementBase {
  type: "text"
  text: string
  fontFamily: string
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
}

export type PlacedElement = SignatureElement | TextElement

export type ActiveMode = "select" | "place-signature" | "place-text"

export interface SavedSignature {
  id: string
  dataUrl: string
  createdAt: number
}
