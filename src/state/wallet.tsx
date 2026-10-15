import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  SimApiError,
  createPayment,
  fetchSimMe,
  fetchTransactions,
  fetchWallet,
  getToken,
  loginSimUser,
  logoutSimUser,
  registerSimUser,
  setToken,
} from '../lib/api'
import type { PaymentInput, PaymentResult, SimTransaction, SimUser } from '../lib/api'

/**
 * Session + wallet state for the simulated UPI wallet, backed by the Python
 * backend. On boot the stored bearer token is validated against /api/auth/me;
 * the balance and history always come from the server, never local memory, so
 * what you see is exactly what the backend has recorded.
 *
 * All money here is SIMULATED (integer paise in a demo wallet) — no real
 * balance, bank, or UPI switch is involved.
 */
interface WalletValue {
  /** Signed-in simulator user, or null when signed out. */
  user: SimUser | null
  /** True once the stored session token has been checked on boot. */
  booted: boolean
  /** Wallet balance in paise; null until the server has reported it. */
  balance: number | null
  /** Server-provided "simulated money" disclaimer shown with the balance. */
  walletNote: string | null
  /** Payment history exactly as the backend recorded it (newest first). */
  payments: SimTransaction[]
  /** A background refresh (wallet/history/session) is running. */
  busy: boolean
  /** Non-fatal message from a boot or refresh cycle. */
  notice: string | null
  signIn: (username: string, password: string) => Promise<void>
  signUp: (input: {
    username: string
    password: string
    display_name: string
    phone?: string
  }) => Promise<void>
  signOut: () => Promise<void>
  /** Runs a fraud-checked payment, then refreshes balance + history. */
  pay: (input: PaymentInput) => Promise<PaymentResult>
  /** Re-reads the session, balance and history from the server. */
  refresh: () => Promise<void>
  clearNotice: () => void
}

const WalletContext = createContext<WalletValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SimUser | null>(null)
  const [booted, setBooted] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [walletNote, setWalletNote] = useState<string | null>(null)
  const [payments, setPayments] = useState<SimTransaction[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const clearSession = useCallback(() => {
    setUser(null)
    setBalance(null)
    setWalletNote(null)
    setPayments([])
    setToken(null)
    // A sign-out must also drop any stale connection/refresh error, otherwise
    // the old message re-appears on the sign-in form after signing out.
    setNotice(null)
  }, [])

  const loadWalletAndHistory = useCallback(async () => {
    const [wallet, history] = await Promise.all([fetchWallet(), fetchTransactions()])
    setBalance(wallet.balance)
    setWalletNote(wallet.note)
    setPayments(history)
  }, [])

  // Boot: restore the session stored in localStorage, if any.
  useEffect(() => {
    let cancelled = false

    async function boot() {
      if (!getToken()) {
        if (!cancelled) setBooted(true)
        return
      }
      try {
        const me = await fetchSimMe()
        if (cancelled) return
        setUser(me)
        // Mark the wallet as loading while the balance/history fetch runs,
        // otherwise the UI briefly shows "Balance unavailable" instead of the
        // loading state on session restore.
        setBusy(true)
        await loadWalletAndHistory()
      } catch (err) {
        if (cancelled) return
        if (err instanceof SimApiError) {
          if (err.status === 401) {
            // Token expired or revoked — drop it silently.
            setToken(null)
          } else {
            setNotice(err.message)
          }
        } else if (err instanceof Error) {
          // Never fail silently — surface unexpected errors as a notice.
          setNotice(err.message)
        }
      } finally {
        if (!cancelled) {
          setBooted(true)
          setBusy(false)
        }
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [loadWalletAndHistory])

  const signIn = useCallback(
    async (username: string, password: string) => {
      const { user: me } = await loginSimUser({ username, password })
      setUser(me)
      setBusy(true)
      try {
        await loadWalletAndHistory()
        setNotice(null)
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'Signed in, but the simulated wallet could not be loaded.')
        throw err
      } finally {
        setBusy(false)
      }
    },
    [loadWalletAndHistory],
  )

  const signUp = useCallback(
    async (input: { username: string; password: string; display_name: string; phone?: string }) => {
      const { user: me } = await registerSimUser(input)
      setUser(me)
      setBusy(true)
      try {
        await loadWalletAndHistory()
        setNotice(null)
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'Account created, but the simulated wallet could not be loaded.')
        throw err
      } finally {
        setBusy(false)
      }
    },
    [loadWalletAndHistory],
  )

  const signOut = useCallback(async () => {
    try {
      await logoutSimUser()
    } catch {
      // Best effort — even if the backend is unreachable the local session goes.
    }
    clearSession()
  }, [clearSession])

  const pay = useCallback(
    async (input: PaymentInput) => {
      const result = await createPayment(input)
      // The server accepted/blocked the payment — re-read balance + history so
      // the UI reflects the authoritative state. A failure here must not mask
      // the payment result.
      try {
        await loadWalletAndHistory()
      } catch {
        /* keep the payment result; the user can hit Refresh */
      }
      return result
    },
    [loadWalletAndHistory],
  )

  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      const me = await fetchSimMe()
      setUser(me)
      await loadWalletAndHistory()
      setNotice(null)
    } catch (err) {
      if (err instanceof SimApiError) {
        if (err.status === 401) {
          clearSession()
          setNotice('Your session expired. Sign in again to load the demo wallet.')
        } else {
          setNotice(err.message)
        }
      } else if (err instanceof Error) {
        // Surface unexpected failures (e.g. malformed response) instead of
        // leaving the UI silently stale.
        setNotice(err.message)
      }
    } finally {
      setBusy(false)
    }
  }, [clearSession, loadWalletAndHistory])

  const clearNotice = useCallback(() => setNotice(null), [])

  const value = useMemo<WalletValue>(
    () => ({
      user,
      booted,
      balance,
      walletNote,
      payments,
      busy,
      notice,
      signIn,
      signUp,
      signOut,
      pay,
      refresh,
      clearNotice,
    }),
    [user, booted, balance, walletNote, payments, busy, notice, signIn, signUp, signOut, pay, refresh, clearNotice],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider')
  return ctx
}

export function useOptionalWallet(): WalletValue | null {
  return useContext(WalletContext)
}
