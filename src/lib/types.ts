/**
 * Domain types for the UPI Kavach verification service.
 */

export type InputKind = 'QR' | 'LINK' | 'UPI_ID'

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH'

export type CheckStatus = 'PASS' | 'REVIEW' | 'FAIL' | 'NA'

export type Severity = 'critical' | 'warning' | 'info'

export type Recommendation = 'ALLOW' | 'VERIFY' | 'BLOCK'

export type CheckCategory =
  | 'recipient'
  | 'vpa'
  | 'qr'
  | 'url'
  | 'context'

export interface ParsedInput {
  /** What the user submitted. */
  kind: InputKind
  raw: string
  /** Normalised payload string the engine works on. */
  payload: string
  /** Full VPA, e.g. merchant@okaxis */
  upiId: string | null
  /** Left side of the VPA */
  handle: string | null
  /** Right side of the VPA */
  bankSuffix: string | null
  /** Resolved institution label for the VPA suffix */
  bankName: string | null
  /** True when the handle is on the known-good list */
  handleKnown: boolean
  payeeName: string | null
  amount: number | null
  amountRaw: string | null
  currency: string | null
  note: string | null
  merchantCode: string | null
  /** URL extracted from a payment link, if any */
  url: string | null
  /** Host of the submitted URL, if any */
  host: string | null
  /** Registrable (eTLD+1) domain of the submitted URL */
  registrableDomain: string | null
  /** True when the URL resolves to a raw IP address */
  hostIsIp: boolean
  scheme: string | null
  /** Non-ASCII / mixed-script characters spotted in the host */
  hostHasHomoglyphs: boolean
  /** Number of labels before the registrable domain */
  subdomainDepth: number
  /** True when the QR payload carried an upi:// intent */
  isUpiIntent: boolean
  /** Problems that make the submission unreadable */
  parseErrors: string[]
}

export interface Finding {
  category: CheckCategory
  weight: number
  severity: Severity
  text: string
  /** Which signal surfaced this finding, shown as small caps under the text */
  source: string
}

export interface CheckResult {
  id: CheckCategory
  label: string
  status: CheckStatus
  detail: string
  points: number
  findings: Finding[]
}

export interface Analysis {
  reference: string
  engineVersion: string
  createdAt: string
  parsed: ParsedInput
  score: number
  band: RiskBand
  recommendation: Recommendation
  headline: string
  summary: string
  checks: CheckResult[]
  indicators: Finding[]
  /** Plain-language reasons for the alert screen */
  reasons: { title: string; text: string }[]
}
