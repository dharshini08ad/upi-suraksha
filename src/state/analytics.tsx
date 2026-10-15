import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Live usage counters for the dashboard summary cards. Every value is derived
 * from real activity in this session — a QR/UPI/link scan, a completed fraud
 * analysis, and the count of those analyses that flagged a threat. Nothing is
 * hard-coded, so before the first check all three read zero.
 */
export interface Analytics {
  /** Verifications performed this session (QR scans, UPI ID and link checks). */
  totalScans: number
  /** Completed fraud analyses, including threats. */
  threatsDetected: number
  /** Transactions screened (payments + standalone analyses). */
  transactionsAnalyzed: number
  recordScan: (isThreat: boolean) => void
  recordTransaction: (isThreat: boolean) => void
  reset: () => void
}

const AnalyticsContext = createContext<Analytics | null>(null)

const EMPTY = { totalScans: 0, threatsDetected: 0, transactionsAnalyzed: 0 }

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [counters, setCounters] = useState(EMPTY)

  const recordScan = useCallback((isThreat: boolean) => {
    setCounters((prev) => ({
      totalScans: prev.totalScans + 1,
      threatsDetected: prev.threatsDetected + (isThreat ? 1 : 0),
      transactionsAnalyzed: prev.transactionsAnalyzed + 1,
    }))
  }, [])

  const recordTransaction = useCallback((isThreat: boolean) => {
    setCounters((prev) => ({
      totalScans: prev.totalScans,
      threatsDetected: prev.threatsDetected + (isThreat ? 1 : 0),
      transactionsAnalyzed: prev.transactionsAnalyzed + 1,
    }))
  }, [])

  const reset = useCallback(() => setCounters(EMPTY), [])

  const value = useMemo<Analytics>(
    () => ({ ...counters, recordScan, recordTransaction, reset }),
    [counters, recordScan, recordTransaction, reset],
  )

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>
}

export function useAnalytics(): Analytics {
  const ctx = useContext(AnalyticsContext)
  if (!ctx) throw new Error('useAnalytics must be used inside AnalyticsProvider')
  return ctx
}
