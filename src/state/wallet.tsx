import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Verdict } from '../lib/preflight'

export interface Payment {
  id: string
  merchantName: string
  upiId: string
  amount: number
  verdict: Verdict
  score: number
  reference: string
  at: string
  blocked: boolean
}

interface WalletValue {
  payments: Payment[]
  record: (payment: Omit<Payment, 'id' | 'at'>) => Payment
  clear: () => void
}

const WalletContext = createContext<WalletValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [payments, setPayments] = useState<Payment[]>([])

  const record = useCallback((payment: Omit<Payment, 'id' | 'at'>) => {
    const entry: Payment = {
      ...payment,
      id: `TXN${Date.now().toString(36).toUpperCase()}`,
      at: new Date().toISOString(),
    }
    setPayments((prev) => [entry, ...prev])
    return entry
  }, [])

  const clear = useCallback(() => setPayments([]), [])

  const value = useMemo<WalletValue>(() => ({ payments, record, clear }), [payments, record, clear])

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider')
  return ctx
}