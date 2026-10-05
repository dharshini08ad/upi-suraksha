import jsQR from 'jsqr'

/** Decoded from a canvas region; null when nothing readable is in frame. */
export type DecodeFn = (source: CanvasImageSource, width: number, height: number) => string | null

const MAX_DIMENSION = 960
const SCAN_INTERVAL_MS = 120

/** Read a QR code out of any drawable source (video frame or image). */
export const decodeQr: DecodeFn = (source, width, height) => {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  ctx.drawImage(source, 0, 0, w, h)
  const image = ctx.getImageData(0, 0, w, h)
  const result = jsQR(image.data, w, h, { inversionAttempts: 'attemptBoth' })
  if (result?.data) return result.data

  const cropSize = Math.min(width, height) * 0.72
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = MAX_DIMENSION
  cropCanvas.height = MAX_DIMENSION
  const cropContext = cropCanvas.getContext('2d', { willReadFrequently: true })
  if (!cropContext) return null

  cropContext.imageSmoothingEnabled = false
  cropContext.drawImage(
    source,
    (width - cropSize) / 2,
    (height - cropSize) / 2,
    cropSize,
    cropSize,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height,
  )
  const croppedImage = cropContext.getImageData(0, 0, cropCanvas.width, cropCanvas.height)
  return jsQR(croppedImage.data, cropCanvas.width, cropCanvas.height, { inversionAttempts: 'attemptBoth' })?.data ?? null
}

/**
 * Poll `read` on every animation frame until it returns a value or the loop
 * is cancelled. Used for live camera scanning.
 */
export function scanUntilFound(
  read: () => string | null,
  onFound: (payload: string) => void,
  controller: AbortController,
) {
  let frame = 0
  let lastScanAt = 0

  const tick = () => {
    if (controller.signal.aborted) return
    const now = performance.now()
    if (now - lastScanAt >= SCAN_INTERVAL_MS) {
      lastScanAt = now
      try {
        const found = read()
        if (found) {
          controller.abort()
          onFound(found)
          return
        }
      } catch {
        /* a frame can fail while the device is switching cameras */
      }
    }
    frame = window.requestAnimationFrame(tick)
  }

  frame = window.requestAnimationFrame(tick)

  return () => {
    controller.abort()
    window.cancelAnimationFrame(frame)
  }
}