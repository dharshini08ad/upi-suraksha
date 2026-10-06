import { analyse as analyseQrLocally } from './riskEngine'

export type ApiRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type ApiRecommendation = 'ALLOW' | 'WARN_AND_VERIFY' | 'BLOCK'

export interface QrAnalysisResult {
  input_type: 'qr'
  risk_score: number
  risk_level: ApiRiskLevel
  detected_threats: string[]
  reasons: string[]
  recipient_info: {
    upi_id: string | null
    payee_name: string | null
    amount: number | null
    transaction_ref: string | null
    note: string | null
    domain: string | null
  }
  recommended_action: ApiRecommendation
  is_valid: boolean
  analyzed_value: string
  analysis_source: 'api' | 'local'
}

const configuredApiUrl = (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env
  ?.VITE_API_URL
const API_BASE_URL = (configuredApiUrl || '').replace(/\/$/, '')

function buildLocalQrResult(payload: string): QrAnalysisResult {
  const analysis = analyseQrLocally(payload)
  const parsed = analysis.parsed

  return {
    input_type: 'qr',
    risk_score: analysis.score,
    risk_level: analysis.band,
    detected_threats: analysis.indicators.map((finding) => finding.text),
    reasons: analysis.reasons.map((reason) => `${reason.title}: ${reason.text}`),
    recipient_info: {
      upi_id: parsed.upiId,
      payee_name: parsed.payeeName,
      amount: parsed.amount,
      transaction_ref: parsed.merchantCode,
      note: parsed.note,
      domain: parsed.host,
    },
    recommended_action:
      analysis.recommendation === 'BLOCK'
        ? 'BLOCK'
        : analysis.recommendation === 'VERIFY'
          ? 'WARN_AND_VERIFY'
          : 'ALLOW',
    is_valid: parsed.parseErrors.length === 0,
    analyzed_value: payload.trim(),
    analysis_source: 'local',
  }
}

async function readAnalysis(response: Response): Promise<QrAnalysisResult> {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = typeof body?.detail === 'string' ? body.detail : `Analysis request failed (${response.status}).`
    throw new Error(detail)
  }
  if (
    !body ||
    typeof body.risk_score !== 'number' ||
    !['LOW', 'MEDIUM', 'HIGH'].includes(body.risk_level) ||
    !Array.isArray(body.reasons) ||
    !body.recipient_info
  ) {
    throw new Error('The analysis API returned an invalid response. Check VITE_API_URL and the backend deployment.')
  }
  return { ...body, analysis_source: 'api' } as QrAnalysisResult
}

export async function analyzeQrPayload(payload: string): Promise<QrAnalysisResult> {
  if (!API_BASE_URL) return buildLocalQrResult(payload)
  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze/qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    })
    if (response.status >= 500) return buildLocalQrResult(payload)
    return await readAnalysis(response)
  } catch {
    return buildLocalQrResult(payload)
  }
}

export async function analyzeQrImage(image: File): Promise<QrAnalysisResult> {
  if (!API_BASE_URL) {
    throw new Error('No readable QR code was found in this image. Try a sharper, uncropped image.')
  }
  const form = new FormData()
  form.append('image', image)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/analyze/qr`, { method: 'POST', body: form })
  } catch {
    throw new Error('Could not read this image on the device, and the image analysis service is unavailable.')
  }
  return readAnalysis(response)
}