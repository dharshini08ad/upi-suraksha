import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Stepper } from '../components/Stepper'
import { SampleList } from '../components/SampleList'
import {
  IconArrowRight,
  IconCamera,
  IconCheckCircle,
  IconClipboard,
  IconInfo,
  IconQr,
  IconShieldAlert,
  IconUpload,
} from '../components/Icons'
import { samplesFor } from '../data/samples'
import { decodeQr, scanUntilFound } from '../lib/qr'
import { analyzeQrImage, analyzeQrPayload, saveContact } from '../lib/api'
import type { QrAnalysisResult } from '../lib/api'
import { useAnalytics } from '../state/analytics'
import { useOptionalWallet } from '../state/wallet'

type CameraState = 'idle' | 'starting' | 'live' | 'denied' | 'unsupported' | 'error'

const IDLE_COPY: Record<CameraState, string> = {
  idle: 'The camera has not been started.',
  starting: 'Requesting camera access...',
  live: '',
  denied: 'Camera access was refused. Allow it in your browser settings and try again.',
  unsupported: 'Camera access is unavailable. Open this page on HTTPS or localhost and check that a camera is connected.',
  error: 'The camera could not start. Close other apps using it, then try again.',
}

async function decodeQrFile(file: File): Promise<string | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      try {
        return decodeQr(bitmap, bitmap.width, bitmap.height)
      } finally {
        bitmap.close()
      }
    } catch {
      // Fall back to an image element for browsers that cannot create a bitmap.
    }
  }

  const imageUrl = URL.createObjectURL(file)
  try {
    return await new Promise((resolve) => {
      const image = new Image()
      image.onload = () => {
        try {
          resolve(decodeQr(image, image.naturalWidth, image.naturalHeight))
        } catch {
          resolve(null)
        }
      }
      image.onerror = () => resolve(null)
      image.src = imageUrl
    })
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

export function ScanScreen() {
  const [camera, setCamera] = useState<CameraState>('idle')
  const [manual, setManual] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hit, setHit] = useState<string | null>(null)
  const [result, setResult] = useState<QrAnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [scanHint, setScanHint] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const stopScanRef = useRef<(() => void) | null>(null)
  const mountedRef = useRef(true)
  const cameraAttemptRef = useRef(0)

  const { recordScan } = useAnalytics()
  const wallet = useOptionalWallet()
  const user = wallet?.user ?? null
  const [recipientSaved, setRecipientSaved] = useState(false)

  const stopCamera = useCallback(() => {
    cameraAttemptRef.current += 1
    stopScanRef.current?.()
    stopScanRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cameraAttemptRef.current += 1
      stopCamera()
    }
  }, [stopCamera])

  useEffect(() => {
    if (camera !== 'live') return
    const timeout = window.setTimeout(() => setScanHint(true), 7000)
    return () => window.clearTimeout(timeout)
  }, [camera])

  async function analyse(payload: string) {
    const trimmed = payload.trim()
    if (!trimmed) {
      setError('The QR code did not contain any readable text.')
      return
    }
    setError(null)
    setResult(null)
    setRecipientSaved(false)
    setHit(trimmed)
    stopCamera()
    setCamera('idle')
    setAnalyzing(true)
    try {
      const analysis = await analyzeQrPayload(trimmed)
      setResult(analysis)
      recordScan(analysis.risk_level !== 'LOW')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'QR analysis failed. Try again or upload the image.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function startCamera() {
    const attempt = cameraAttemptRef.current + 1
    cameraAttemptRef.current = attempt
    setError(null)
    setHit(null)
    setResult(null)
    setRecipientSaved(false)
    setScanHint(false)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unsupported')
      return
    }
    setCamera('starting')
    try {
      let stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        audio: false,
      })
      if (!mountedRef.current || cameraAttemptRef.current !== attempt) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream

      if (!mountedRef.current || cameraAttemptRef.current !== attempt) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      video.srcObject = stream
      await video.play()
      if (!mountedRef.current || cameraAttemptRef.current !== attempt) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      setCamera('live')

      // Decode every frame until one code is found.
      const controller = new AbortController()
      const stop = scanUntilFound(
        () => (video.readyState >= 2 ? decodeQr(video, video.videoWidth, video.videoHeight) : null),
        (payload) => {
          void analyse(payload)
        },
        controller,
      )
      stopScanRef.current = stop
    } catch (cause) {
      if (!mountedRef.current || cameraAttemptRef.current !== attempt) return
      const name = cause instanceof Error ? cause.name : ''
      stopCamera()
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setCamera('denied')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCamera('unsupported')
      } else {
        setCamera('error')
        setError(
          name === 'NotReadableError' || name === 'TrackStartError'
            ? 'The camera is busy in another app or tab. Close it there, then retry.'
            : 'The camera could not start. Check your camera settings, then retry.',
        )
      }
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setHit(null)
    setResult(null)
    setRecipientSaved(false)
    setAnalyzing(true)
    stopCamera()
    setCamera('idle')
    try {
      const payload = await decodeQrFile(file)
      const analysis = payload ? await analyzeQrPayload(payload) : await analyzeQrImage(file)
      setHit(payload ?? analysis.analyzed_value)
      setResult(analysis)
      recordScan(analysis.risk_level !== 'LOW')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That image could not be analyzed. Try a clearer QR photo.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function saveScannedRecipient() {
    const upiId = result?.recipient_info.upi_id
    if (!upiId || !result?.is_valid) return
    try {
      await saveContact({
        name: result.recipient_info.payee_name || upiId,
        upi_id: upiId,
        verified: false,
      })
      setRecipientSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this recipient.')
    }
  }

  return (
    <>
      <Stepper current={0} />
      <div className="container page page--scan">
        <header className="page__head">
          <span className="eyebrow">UPI payment safety</span>
          <h1 className="page__title">Scan a UPI QR code</h1>
          <p className="page__lede">
            Scan a UPI code with your camera or choose a saved image. We’ll read the payee and amount,
            then flag patterns that deserve a closer look.
          </p>
        </header>

        <div className={`scanner${camera === 'live' ? ' scanner--live' : ''}`}>
          <video ref={videoRef} className="scanner__video" playsInline muted />

          {camera === 'live' ? null : (
            <div className="scanner__idle">
              <IconQr size={44} className="scanner__idle-icon" />
              <p>{IDLE_COPY[camera]}</p>
              {camera === 'denied' || camera === 'unsupported' ? (
                <p style={{ fontSize: 12, maxWidth: '30ch' }}>
                  You can still upload an image of the code or paste the request below.
                </p>
              ) : null}
            </div>
          )}

          <div className="scanner__frame" aria-hidden="true">
            <span className="scanner__corner scanner__corner--tl" />
            <span className="scanner__corner scanner__corner--tr" />
            <span className="scanner__corner scanner__corner--bl" />
            <span className="scanner__corner scanner__corner--br" />
            <span className="scanner__beam" />
          </div>

          <p className="scanner__status">
            {result
              ? 'Analysis complete. Camera stopped.'
              : analyzing
                ? 'QR code found — analysing'
                : hit
                  ? 'QR code found. Analysis could not be completed.'
                  : camera === 'live' && scanHint
                    ? 'No code yet. Fit the whole QR inside the corners and raise your phone screen brightness.'
                    : camera === 'live'
                      ? 'Scanning. Hold the code steady inside the frame.'
                          : 'Align the QR code inside the frame'}
          </p>
        </div>

        <div className="scanner__toolbar">
          <button
            type="button"
            className="btn btn--primary"
            disabled={analyzing || camera === 'starting'}
            onClick={() => (camera === 'live' ? (stopCamera(), setCamera('idle')) : void startCamera())}
          >
            <IconCamera />
            {camera === 'live' ? 'Stop camera' : camera === 'starting' ? 'Starting camera...' : 'Scan QR'}
          </button>

          <button type="button" className="btn btn--outline" disabled={analyzing} onClick={() => fileRef.current?.click()}>
            <IconUpload />
            Upload QR image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              void onFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>

        {hit ? (
          <div className="notice notice--ok" style={{ marginTop: 16, maxWidth: 720 }} role="status">
            <IconCheckCircle size={16} />
            <span>
              {analyzing ? 'QR decoded. Checking fraud risk...' : 'QR decoded'} &mdash; <span className="mono">{hit}</span>
            </span>
          </div>
        ) : null}
        {error ? (
          <div className="notice notice--risk" style={{ marginTop: 16, maxWidth: 720 }}>
            <IconInfo size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        {result ? (
          <section className={`qr-result qr-result--${result.risk_level.toLowerCase()}`} aria-live="assertive">
            <div className="qr-result__top">
              <div>
                <span className="eyebrow">Fraud analysis</span>
                <h2 className="qr-result__title">
                  {result.risk_level === 'HIGH'
                    ? 'Security alert: do not approve'
                    : result.risk_level === 'MEDIUM'
                      ? 'Verify this payment first'
                      : 'No high-risk signals detected'}
                </h2>
                <p className="qr-result__action">Recommended action: {result.recommended_action.replace(/_/g, ' ')}</p>
              </div>
              <div className="qr-result__score" aria-label={`Risk score ${result.risk_score} out of 100`}>
                <strong>{result.risk_score}</strong><span>/100</span>
                <small>{result.risk_level} RISK</small>
              </div>
            </div>

            {result.risk_level !== 'LOW' ? (
              <p className="qr-result__banner" role="alert">
                <IconShieldAlert size={18} />
                Potential Fraud Detected — Verify Before You Pay.
              </p>
            ) : null}

            <p className="qr-result__source-note">
              {result.analysis_source === 'local' ? 'On-device pattern check.' : 'Pattern-based analysis.'} It cannot
              confirm account ownership or guarantee safety; verify the payee and amount in your UPI app before paying.
            </p>

            <dl className="qr-result__details">
              {result.recipient_info.payee_name ? <div><dt>Payee</dt><dd>{result.recipient_info.payee_name}</dd></div> : null}
              {result.recipient_info.upi_id ? <div><dt>UPI ID</dt><dd className="mono">{result.recipient_info.upi_id}</dd></div> : null}
              {result.recipient_info.amount !== null ? <div><dt>Amount</dt><dd>₹{result.recipient_info.amount.toFixed(2)}</dd></div> : null}
              {result.recipient_info.transaction_ref ? <div><dt>Reference</dt><dd className="mono">{result.recipient_info.transaction_ref}</dd></div> : null}
              {result.recipient_info.domain ? <div><dt>Domain</dt><dd className="mono">{result.recipient_info.domain}</dd></div> : null}
            </dl>

            <ul className="qr-result__reasons">
              {result.reasons.map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}
            </ul>
            {result.recipient_info.upi_id && result.is_valid ? (
              <div className="btn-row">
                <Link
                  className="btn btn--primary"
                  to={`/pay/recipient?upi=${encodeURIComponent(result.recipient_info.upi_id)}&name=${encodeURIComponent(result.recipient_info.payee_name || result.recipient_info.upi_id)}&amount=${encodeURIComponent(result.recipient_info.amount?.toString() ?? '')}&payload=${encodeURIComponent(hit ?? result.analyzed_value)}`}
                >
                  Review simulated payment
                </Link>
                {user ? (
                  <button
                    type="button"
                    className="btn btn--outline"
                    disabled={recipientSaved}
                    onClick={() => void saveScannedRecipient()}
                  >
                    {recipientSaved ? 'Recipient saved' : 'Save recipient'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="panel form-panel" style={{ marginTop: 24 }}>
          <div className="panel__head">
            <span className="panel__title">Request text</span>
            <span className="tag">
              <IconClipboard size={13} /> upi://pay
            </span>
          </div>
          <form
            className="panel__body"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void analyse(manual)
            }}
          >
            <label className="field">
              <span className="field__label">Paste the QR payload or the payee UPI ID</span>
              <textarea
                className={`textarea input--mono${error ? ' is-invalid' : ''}`}
                spellCheck={false}
                placeholder="upi://pay?pa=merchant@okaxis&pn=Merchant%20Name&am=500.00&cu=INR"
                value={manual}
                onChange={(e) => {
                  setManual(e.target.value)
                  if (error) setError(null)
                }}
              />
              <span className="field__hint">
                Most UPI apps let you long-press a request to copy the underlying link. Paste that
                here if the camera cannot read the code.
              </span>
            </label>

            <div className="form-actions">
              <button type="submit" className="btn btn--primary btn--lg">
                Analyse request <IconArrowRight />
              </button>
            </div>
          </form>
        </div>

        <div style={{ maxWidth: 720, marginTop: 16 }}>
          <SampleList samples={samplesFor('QR')} onPick={(p) => void analyse(p)} />
        </div>
      </div>
    </>
  )
}
