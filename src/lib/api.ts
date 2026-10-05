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
}

const configuredApiUrl = (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env
  ?.VITE_API_URL
const API_BASE_URL = (configuredApiUrl || '').replace(/\/$/, '')
const API_UNREACHABLE = 'Could not reach the analysis API. Check VITE_API_URL and make sure the backend is running.'

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
  return body as QrAnalysisResult
}

export async function analyzeQrPayload(payload: string): Promise<QrAnalysisResult> {
  if (!API_BASE_URL) throw new Error('VITE_API_URL is not configured for this deployment.')
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/analyze/qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    })
  } catch {
    throw new Error(API_UNREACHABLE)
  }
  return readAnalysis(response)
}

export async function analyzeQrImage(image: File): Promise<QrAnalysisResult> {
  if (!API_BASE_URL) throw new Error('VITE_API_URL is not configured for this deployment.')
  const form = new FormData()
  form.append('image', image)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/analyze/qr`, { method: 'POST', body: form })
  } catch {
    throw new Error(API_UNREACHABLE)
  }
  return readAnalysis(response)
}