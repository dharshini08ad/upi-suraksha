import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../components/Upi'
import { IconArrowLeft, IconBlock, IconCheckCircle, IconShieldAlert } from '../components/Icons'
import { getMerchant } from '../data/merchants'
import { VERDICT_COPY, preflight } from '../lib/preflight'
import type { Preflight } from '../lib/preflight'
import { useWallet } from '../state/wallet'

const QUICK_AMOUNTS = [500, 1000, 2500]

const rupees = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)

function inr(value: string): number {
  const n = Number(value.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function PayScreen() {
  const { id } = useParams()
  const merchant = getMerchant(id)
  const { record } = useWallet()

  const [amount, setAmount] = useState('')
  const [phase, setPhase] = useState<'idle' | 'checking' | 'processing' | 'done'>('idle')
  const [result, setResult] = useState<Preflight | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [receipt, setReceipt] = useState<{ id: string; reference: string } | null>(null)

  const value = inr(amount)

  // Live fraud screening: re-runs the engine whenever the amount changes.
  useEffect(() => {
    if (!merchant || value <= 0) {
      setResult(null)
      setPhase('idle')
      return
    }
    setPhase('checking')
    const handle = window.setTimeout(() => {
      if (!merchant) return
      setResult(preflight(merchant, value))
      setPhase('idle')
    }, 280)
    return () => window.clearTimeout(handle)
  }, [value, merchant])

  const copy = result ? VERDICT_COPY[result.verdict] : null
  const blocked = result?.verdict === 'BLOCK'
  const reasons = useMemo(() => result?.reasons ?? [], [result])

  if (!merchant) {
    return (
      <div className="container page">
        <div className="empty">
          <h2>Merchant not found</h2>
          <Link to="/search" className="btn btn--outline">
            Back to search
          </Link>
        </div>
      </div>
    )
  }

  function pay() {
    if (!merchant || !result || value <= 0 || blocked) return
    if (result.verdict === 'VERIFY' && !confirmed) {
      setConfirmed(true)
      return
    }
    setPhase('processing')
    window.setTimeout(() => {
      const entry = record({
        merchantName: merchant.name,
        upiId: merchant.upiId,
        amount: value,
        verdict: result.verdict,
        score: result.score,
        reference: result.analysis.reference,
        blocked: false,
      })
      setReceipt({ id: entry.id, reference: entry.reference })
      setPhase('done')
    }, 1100)
  }

  function blockIt() {
    if (!merchant || !result) return
    record({
      merchantName: merchant.name,
      upiId: merchant.upiId,
      amount: value,
      verdict: 'BLOCK',
      score: result.score,
      reference: result.analysis.reference,
      blocked: true,
    })
    setPhase('done')
    setReceipt(null)
  }

  if (phase === 'done') {
    return (
      <div className="container page">
        <div className="receipt">
          <span className={`receipt__seal receipt__seal--${receipt ? 'ok' : 'risk'}`}>
            {receipt ? <IconCheckCircle size={30} /> : <IconShieldAlert size={30} />}
          </span>
          <h1 className="receipt__title">{receipt ? 'Payment successful' : 'Payment blocked'}</h1>
          <p className="receipt__amount">{rupees(value)}</p>
          <p className="receipt__to">
            to <strong>{merchant.name}</strong>
            <br />
            <span className="mono">{merchant.upiId}</span>
          </p>
          <dl className="receipt__meta">
            <div>
              <dt>Reference</dt>
              <dd className="mono">{receipt?.reference ?? result?.analysis.reference}</dd>
            </div>
            <div>
              <dt>Fraud score</dt>
              <dd>
                {result?.score}/100 &middot; {result?.band}
              </dd>
            </div>
          </dl>
          <div className="btn-row">
            <Link to={`/merchant/${merchant.id}`} className="btn btn--quiet">
              Back to merchant
            </Link>
            <Link to="/history" className="btn btn--primary">
              View history
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container page">
      <Link to={`/merchant/${merchant.id}`} className="backlink">
        <IconArrowLeft size={15} /> {merchant.name}
      </Link>

      <div className="payhead payhead--compact">
        <Avatar initials={merchant.initials} tone={merchant.tone} size={48} />
        <div>
          <h1 className="payhead__name">Paying {merchant.name}</h1>
          <p className="payhead__vpa mono">{merchant.upiId}</p>
        </div>
      </div>

      <div className="amountbox">
        <span className="amountbox__rupee">₹</span>
        <input
          className="amountbox__input"
          type="text"
          inputMode="decimal"
          autoFocus
          placeholder="0"
          aria-label="Amount in rupees"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value.replace(/[^\d.]/g, '').slice(0, 9))
            setConfirmed(false)
          }}
        />
      </div>

      <div className="chipwrap chipwrap--center">
        {QUICK_AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            className={`chip${value === a ? ' is-on' : ''}`}
            onClick={() => {
              setAmount(String(a))
              setConfirmed(false)
            }}
          >
            ₹{a}
          </button>
        ))}
      </div>

      {/* The fraud gate — swap this for a backend call when one exists. */}
      {value <= 0 ? (
        <div className="verdict verdict--idle">
          <span className="verdict__text">Enter an amount to run the fraud check.</span>
        </div>
      ) : phase === 'checking' ? (
        <div className="verdict verdict--idle">
          <span className="verdict__text">Checking this payment for fraud…</span>
        </div>
      ) : (
        <div className={`verdict verdict--${copy?.tone}`}>
          <span className="verdict__icon">
            {blocked ? <IconShieldAlert size={20} /> : <IconCheckCircle size={20} />}
          </span>
          <div>
            <p className="verdict__title">
              {copy?.label} &middot; score {result?.score}/100
            </p>
            {reasons.length ? (
              <ul className="verdict__list">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="verdict__text">No suspicious indicator was raised against this payee.</p>
            )}
          </div>
        </div>
      )}

      <div className="paycta">
        {blocked ? (
          <>
            <button type="button" className="btn btn--danger btn--lg btn--block" onClick={blockIt}>
              <IconBlock /> Block payment
            </button>
            <p className="paycta__note">
              No money can leave this device without your UPI PIN. Do not share your PIN with anyone
              claiming to be this merchant.
            </p>
          </>
        ) : (
          <button
            type="button"
            className={`btn btn--lg btn--block ${
              result?.verdict === 'VERIFY' ? 'btn--warn' : 'btn--primary'
            }`}
            disabled={!result || value <= 0 || phase === 'processing'}
            onClick={pay}
          >
            {phase === 'processing'
              ? 'Processing…'
              : result?.verdict === 'VERIFY' && !confirmed
                ? 'Pay anyway — I have verified'
                : `Pay ${rupees(value)}`}
          </button>
        )}
      </div>

      {confirmed && result?.verdict === 'VERIFY' ? (
        <p className="paycta__note">
          Confirm on a number you already hold before approving. If the merchant cannot confirm this
          exact UPI ID and amount, cancel.
        </p>
      ) : null}
    </div>
  )
}