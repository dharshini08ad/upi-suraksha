import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useWallet } from '../state/wallet'
import { IconShield } from './Icons'
import { Link } from 'react-router-dom'

const rupees = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100)

/**
 * GPay-style balance card with sign-in / create-account for the simulated
 * wallet. Every figure shown here comes from the Python backend — the balance
 * is demo money, never a real bank or UPI account.
 */
export function WalletCard() {
  const { user, booted, balance, walletNote, busy, notice, signIn, signUp, signOut, refresh, clearNotice } =
    useWallet()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // A failed attempt must not linger: when the auth state changes (sign-out,
  // restored session), reset the form error so a stale message — such as a
  // previous "Could not reach the simulator" — never re-appears unasked.
  useEffect(() => {
    setError(null)
  }, [user])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    clearNotice()
    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await signIn(username.trim().toLowerCase(), password)
      } else {
        await signUp({
          username: username.trim().toLowerCase(),
          password,
          display_name: displayName.trim() || username.trim(),
          phone: phone.trim() || undefined,
        })
      }
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="wallet" className="block" aria-label="Demo wallet">
      <h2 className="block__title">
        Demo wallet <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--ink-3)' }}>(simulated)</span>
      </h2>

      {user ? (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {balance != null ? rupees(balance) : busy ? 'Loading balance…' : 'Balance unavailable'}
              </div>
              <div className="mono" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                {user.display_name} &middot; {user.username}
              </div>
            </div>
            <div className="btn-row" style={{ marginTop: 0 }}>
              <button type="button" className="btn btn--quiet" disabled={busy} onClick={() => void refresh()}>
                {busy ? 'Refreshing…' : 'Refresh'}
              </button>
              <button type="button" className="btn btn--outline" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </div>
          <p className="field__hint" style={{ marginTop: 8 }}>
            {walletNote ?? 'Simulated balance only — no real money moves.'}
          </p>
          <Link to="/wallet" className="block__more">Open simulated wallet</Link>
          {notice ? <p className="field-error">{notice}</p> : null}
        </>
      ) : !booted ? (
        <p className="field__hint">Checking for a saved session…</p>
      ) : (
        <form onSubmit={submit}>
          {notice ? <p className="field-error" role="alert">{notice}</p> : null}
          <div className="chipwrap">
            <button
              type="button"
              className={`chip${mode === 'signin' ? ' is-on' : ''}`}
              onClick={() => {
                setMode('signin')
                setError(null)
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`chip${mode === 'signup' ? ' is-on' : ''}`}
              onClick={() => {
                setMode('signup')
                setError(null)
              }}
            >
              Create account
            </button>
          </div>

          <label className="field">
            <span className="field__label">Username</span>
            <input
              className="input input--mono"
              value={username}
              autoComplete="username"
              spellCheck={false}
              placeholder="e.g. rahul.k"
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
            />
          </label>

          {mode === 'signup' ? (
            <>
              <label className="field">
                <span className="field__label">Display name</span>
                <input
                  className="input"
                  value={displayName}
                  autoComplete="name"
                  placeholder="Shown on your payments"
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Phone (optional)</span>
                <input
                  className="input input--mono"
                  value={phone}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="10-digit number"
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
                />
              </label>
            </>
          ) : null}

          <label className="field">
            <span className="field__label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'signup' ? (
              <span className="field__hint">At least 8 characters mixing letters and numbers.</span>
            ) : null}
          </label>

          {error ? <span className="field-error">{error}</span> : null}

          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create wallet'}
            </button>
          </div>

          <span className="field__hint">
            <IconShield size={13} /> Simulation only: new wallets start with ₹50,000 in demo money and nothing
            ever leaves this device. Use a throwaway password — never a real one.
          </span>
        </form>
      )}
    </section>
  )
}