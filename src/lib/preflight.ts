import type { Merchant } from '../data/merchants'
import { analyse } from './riskEngine'
import type { Analysis, RiskBand } from './types'

export type Verdict = 'CLEAR' | 'VERIFY' | 'BLOCK'

export interface Preflight {
  score: number
  band: RiskBand
  verdict: Verdict
  headline: string
  /** Short lines shown in the pay sheet. */
  reasons: string[]
  analysis: Analysis
  analysis_source?: 'api' | 'local'
  /** The payload the engine actually scored. */
  payload: string
}

export const VERDICT_COPY: Record<
  Verdict,
  { label: string; tone: 'ok' | 'warn' | 'risk'; action: string }
> = {
  CLEAR: { label: 'No high-risk patterns detected', tone: 'ok', action: 'Pay' },
  VERIFY: { label: 'Verify before paying', tone: 'warn', action: 'Pay anyway' },
  BLOCK: { label: 'Payment risk detected', tone: 'risk', action: 'Payment blocked' },
}

/** Build the exact request a UPI app would raise for this payment. */
export function buildPaymentPayload(merchant: Merchant, amount: number): string {
  const params = new URLSearchParams({
    pa: merchant.upiId,
    pn: merchant.name,
    cu: 'INR',
    tn: `Payment to ${merchant.name}`,
  })
  if (amount > 0) params.set('am', amount.toFixed(2))
  return `upi://pay?${params.toString()}`
}

/**
 * Run the fraud engine against a payment the user is about to make. This is
 * the same deterministic engine used by the standalone verification tools, so
 * a merchant that scores badly when verified also scores badly when paying.
 */
export function preflight(merchant: Merchant, amount: number): Preflight {
  const payload = buildPaymentPayload(merchant, amount)
  const analysis = analyse(payload)
  const verdict: Verdict =
    analysis.band === 'HIGH' ? 'BLOCK' : analysis.band === 'MEDIUM' ? 'VERIFY' : 'CLEAR'

  return {
    score: analysis.score,
    band: analysis.band,
    verdict,
    headline: analysis.headline,
    reasons: analysis.reasons.slice(0, 3).map((r) => r.text),
    analysis,
    payload,
  }
}