import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { analyse } from '../lib/riskEngine'
import type { Analysis } from '../lib/types'

interface SessionValue {
  /** The payload the user submitted, or null before the first submission. */
  input: string | null
  /** The verification result for the current payload. */
  analysis: Analysis | null
  begin: (payload: string) => void
  complete: () => Analysis | null
  reset: () => void
}

export const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [input, setInput] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)

  const begin = useCallback((payload: string) => {
    setInput(payload)
    setAnalysis(null)
  }, [])

  const complete = useCallback(() => {
    if (!input) return null
    const result = analyse(input)
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
