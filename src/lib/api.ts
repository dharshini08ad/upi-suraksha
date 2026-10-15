import { analyse as analyseQrLocally } from './riskEngine'
import { detectKind } from './knowledge'

export type ApiRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type ApiRecommendation = 'ALLOW' | 'WARN_AND_VERIFY' | 'BLOCK'

export interface ApiAnalysisResult {
  input_type: 'qr' | 'upi' | 'url'
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

export interface QrAnalysisResult extends ApiAnalysisResult {
  input_type: 'qr'
}

const configuredApiUrl = (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env
  ?.VITE_API_URL
const isDevelopment = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true
const API_BASE_URL = (configuredApiUrl || (isDevelopment ? 'http://127.0.0.1:8001' : '')).replace(/\/$/, '')

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

async function readAnalysis(response: Response): Promise<ApiAnalysisResult> {
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
    return { ...await readAnalysis(response), input_type: 'qr' }
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
  return { ...await readAnalysis(response), input_type: 'qr' }
}

async function analyzeWithBackend(path: string, body: Record<string, string>): Promise<ApiAnalysisResult> {
  if (!API_BASE_URL) throw new Error('The Python analysis service is not configured. Set VITE_API_URL.')
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return readAnalysis(response)
}

export function analyzePaymentPayload(payload: string): Promise<ApiAnalysisResult> {
  return analyzeWithBackend('/api/analyze/qr', { payload })
}

export function analyzeSubmittedInput(payload: string): Promise<ApiAnalysisResult> {
  const kind = detectKind(payload)
  if (kind === 'UPI_ID') return analyzeWithBackend('/api/analyze/upi', { upi_id: payload })
  if (kind === 'LINK') return analyzeWithBackend('/api/analyze/url', { url: payload })
  return analyzeWithBackend('/api/analyze/qr', { payload })
}



// ---------------------------------------------------------------------------
// Simulated wallet API (auth, wallet, contacts, payments)
//
// Everything below talks to the Python backend's /api/auth, /api/wallet,
// /api/contacts and /api/payments endpoints. All balances and transfers are
// SIMULATED — no real bank, UPI switch, or money movement is involved.
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'upi_suraksha_token'

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token)
    else window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable — session simply won't persist */
  }
}

export interface SimUser {
  id: string
  username: string
  display_name: string
  phone: string | null
}

export interface SimContact {
  id: string
  name: string
  upi_id: string
  phone: string | null
  verified: boolean
  source?: string
  created_at?: number
}

export interface SimTransaction {
  id: string
  reference: string
  receiver_upi_id: string
  receiver_name: string | null
  amount: number
  note: string | null
  status: string
  risk_score: number | null
  risk_level: string | null
  recommended_action: string | null
  analysis?: Record<string, unknown> | null
  created_at: number
  simulated: boolean
}

export class SimApiError extends Error {
  status: number
  detail: unknown
  constructor(message: string, status: number, detail?: unknown) {
    super(message)
    this.name = 'SimApiError'
    this.status = status
    this.detail = detail
  }
}

async function simFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new SimApiError('The simulator backend is not configured. Set VITE_API_URL.', 0)
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10_000)
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, signal: controller.signal })
  } catch {
    const message = controller.signal.aborted
      ? `Simulator request timed out at ${API_BASE_URL}${path}.`
      : `Could not reach the simulator at ${API_BASE_URL}. Check its port and CORS settings.`
    throw new SimApiError(message, 0)
  } finally {
    window.clearTimeout(timeout)
  }

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : detail && typeof detail === 'object' && 'message' in detail
          ? String((detail as { message: string }).message)
          : `Request failed (${response.status}).`
    throw new SimApiError(message, response.status, detail)
  }
  return body as T
}

export async function registerSimUser(input: {
  username: string
  password: string
  display_name: string
  phone?: string
}): Promise<{ token: string; user: SimUser }> {
  const res = await simFetch<{ token: string; user: SimUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  setToken(res.token)
  return res
}

export async function loginSimUser(input: {
  username: string
  password: string
}): Promise<{ token: string; user: SimUser }> {
  const res = await simFetch<{ token: string; user: SimUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  setToken(res.token)
  return res
}

export async function logoutSimUser(): Promise<void> {
  try {
    await simFetch('/api/auth/logout', { method: 'POST' })
  } finally {
    setToken(null)
  }
}

export function fetchSimMe(): Promise<SimUser> {
  return simFetch<SimUser>('/api/auth/me')
}

export interface SimWallet {
  balance: number
  currency: 'INR'
  simulated: boolean
  note: string
}

export function fetchWallet(): Promise<SimWallet> {
  return simFetch<SimWallet>('/api/wallet')
}

export function fetchContacts(query = ''): Promise<SimContact[]> {
  return simFetch<SimContact[]>(`/api/contacts?q=${encodeURIComponent(query)}`)
}

export function saveContact(input: {
  name: string
  upi_id: string
  phone?: string
  verified?: boolean
}): Promise<SimContact> {
  return simFetch<SimContact>('/api/contacts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteContact(id: string): Promise<{ status: string }> {
  return simFetch<{ status: string }>(`/api/contacts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function searchContacts(query = ''): Promise<SimContact[]> {
  return simFetch<SimContact[]>(`/api/contacts/search?q=${encodeURIComponent(query)}`)
}

export interface PaymentInput {
  receiver_upi_id: string
  receiver_name?: string
  amount: number // paise
  note?: string
  risk_payload?: string
  idempotency_key?: string
  confirm_risk?: boolean
}

export interface PaymentResult {
  reference: string
  status: string
  amount: number
  receiver_upi_id: string
  receiver_name: string | null
  risk_score: number | null
  risk_level: string | null
  recommended_action: string | null
  detected_threats: string[]
  reasons: string[]
  created_at: number
  balance_after: number | null
  simulated: boolean
}

export function createPayment(input: PaymentInput): Promise<PaymentResult> {
  return simFetch<PaymentResult>('/api/payments', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchTransactions(query = ''): Promise<SimTransaction[]> {
  return simFetch<SimTransaction[]>(`/api/payments?q=${encodeURIComponent(query)}`)
}

export function fetchTransaction(reference: string): Promise<SimTransaction> {
  return simFetch<SimTransaction>(`/api/payments/${encodeURIComponent(reference)}`)
}
