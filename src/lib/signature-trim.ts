/**
 * Trim transparent edges from a canvas, returning a cropped PNG data URL.
 * Without trimming, the signature occupies the full canvas and appears tiny on PDF.
 */
export function trimCanvas(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""

  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  let top = height
  let bottom = 0
  let left = width
  let right = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha > 0) {
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
        left = Math.min(left, x)
        right = Math.max(right, x)
      }
    }
  }

  const pad = 4
  top = Math.max(0, top - pad)
  bottom = Math.min(height, bottom + pad)
  left = Math.max(0, left - pad)
  right = Math.min(width, right + pad)

  const trimWidth = right - left
  const trimHeight = bottom - top

  if (trimWidth <= 0 || trimHeight <= 0) return ""

  const trimmed = document.createElement("canvas")
  trimmed.width = trimWidth
  trimmed.height = trimHeight
  trimmed
    .getContext("2d")!
    .drawImage(
      canvas,
      left,
      top,
      trimWidth,
      trimHeight,
      0,
      0,
      trimWidth,
      trimHeight
    )

  return trimmed.toDataURL("image/png")
}
