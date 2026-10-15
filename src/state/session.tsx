import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { analyse } from '../lib/riskEngine'
import type { Analysis, CheckResult, Finding, RiskBand } from '../lib/types'
import type { ApiAnalysisResult } from '../lib/api'

interface SessionValue {
  /** The payload the user submitted, or null before the first submission. */
  input: string | null
  /** The verification result for the current payload. */
  analysis: Analysis | null
  begin: (payload: string) => void
  complete: (serverResult?: ApiAnalysisResult) => Analysis | null
  reset: () => void
}

export const SessionContext = createContext<SessionValue | null>(null)

function fromServerAnalysis(payload: string, result: ApiAnalysisResult): Analysis {
  const local = analyse(payload)
  const band = result.risk_level as RiskBand
  const recommendation = result.recommended_action === 'BLOCK'
    ? 'BLOCK'
    : result.recommended_action === 'WARN_AND_VERIFY'
      ? 'VERIFY'
      : 'ALLOW'
  const category: Finding['category'] = result.input_type === 'url' ? 'url' : result.input_type === 'qr' ? 'qr' : 'vpa'
  const severity: Finding['severity'] = band === 'HIGH' ? 'critical' : band === 'MEDIUM' ? 'warning' : 'info'
  const reasons = result.reasons.map((text) => ({ title: 'Python local rule', text }))
  const indicators: Finding[] = result.reasons.map((text) => ({
    category,
    weight: result.reasons.length ? Math.ceil(result.risk_score / result.reasons.length) : 0,
    severity,
    source: 'Python backend rules',
    text,
  }))
  const status: CheckResult['status'] = band === 'HIGH' ? 'FAIL' : band === 'MEDIUM' ? 'REVIEW' : 'PASS'
  const checks: CheckResult[] = [
    {
      id: category,
      label: 'Python backend pattern analysis',
      status,
      detail: result.reasons.join(' ') || 'No known malicious patterns were found by local rules.',
      points: result.risk_score,
      findings: indicators,
    },
    {
      id: 'recipient',
      label: 'Request format',
      status: result.is_valid ? 'PASS' : 'FAIL',
      detail: result.is_valid ? 'The submitted value matches a supported format.' : 'The submitted value is invalid or incomplete.',
      points: 0,
      findings: [],
    },
    {
      id: 'context',
      label: 'Account ownership',
      status: result.recipient_info.upi_id ? 'REVIEW' : 'NA',
      detail: 'No identity provider is configured; account ownership and status are not verified.',
      points: 0,
      findings: [],
    },
  ]

  return {
    ...local,
    parsed: {
      ...local.parsed,
      upiId: result.recipient_info.upi_id ?? local.parsed.upiId,
      payeeName: result.recipient_info.payee_name ?? local.parsed.payeeName,
      amount: result.recipient_info.amount ?? local.parsed.amount,
      host: result.recipient_info.domain ?? local.parsed.host,
    },
    score: result.risk_score,
    band,
    recommendation,
    headline: band === 'HIGH' ? 'Potential risk detected' : band === 'MEDIUM' ? 'Verify this request' : 'No high-risk pattern detected',
    summary: 'This score reflects local pattern checks only. It does not verify identity or guarantee safety.',
    engineVersion: 'Python backend local rules',
    checks,
    indicators,
    reasons,
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [input, setInput] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)

  const begin = useCallback((payload: string) => {
    setInput(payload)
    setAnalysis(null)
  }, [])

  const complete = useCallback((serverResult?: ApiAnalysisResult) => {
    if (!input) return null
    const result = serverResult
      ? fromServerAnalysis(input, serverResult)
      : {
          ...analyse(input),
          engineVersion: 'On-device fallback rules',
          summary: 'The Python analysis service was unavailable. This local pattern check does not verify account ownership or guarantee safety.',
        }
    setAnalysis(result)
    return result
  }, [input])

  const reset = useCallback(() => {
    setInput(null)
    setAnalysis(null)
  }, [])

  const value = useMemo<SessionValue>(
    () => ({ input, analysis, begin, complete, reset }),
    [input, analysis, begin, complete, reset],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
