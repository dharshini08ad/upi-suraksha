import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useMatch, useParams, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Upi'
import { IconArrowLeft, IconBlock, IconCheckCircle, IconShieldAlert } from '../components/Icons'
import { getMerchant } from '../data/merchants'
import { VERDICT_COPY, preflight } from '../lib/preflight'
import type { Preflight } from '../lib/preflight'
import { analyzePaymentPayload, SimApiError, saveContact } from '../lib/api'
import { useWallet } from '../state/wallet'
import { useAnalytics } from '../state/analytics'

const QUICK_AMOUNTS = [500, 1000, 2500]

const rupees = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)

function inr(value: string): number {
  if (value && !/^\d+(?:\.\d{0,2})?$/.test(value)) return Number.NaN
  const n = Number(value.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function newIdempotencyKey(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

interface Receipt {
  reference: string
  balanceAfter: number | null
  blocked: boolean
  evidence?: { score: number | null; reasons: string[] }
}

export function PayScreen() {
  const { id } = useParams()
  const isRecipientRoute = useMatch('/pay/recipient') !== null
  const [searchParams] = useSearchParams()
  const listedMerchant = getMerchant(id)
  const recipientUpi = searchParams.get('upi')?.trim() ?? ''
  const recipientName = searchParams.get('name')?.trim() || recipientUpi
  const recipientPhone = searchParams.get('phone') ?? ''
  const suppliedRiskPayload = searchParams.get('payload') ?? ''
  const merchant = useMemo(() => listedMerchant ?? (isRecipientRoute && recipientUpi ? {
    id: 'recipient',
    name: recipientName,
    upiId: recipientUpi,
    phone: recipientPhone,
    category: 'UPI recipient',
    city: '',
    initials: recipientName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?',
    tone: 'blue' as const,
    verified: false,
  } : undefined), [listedMerchant, isRecipientRoute, recipientUpi, recipientName, recipientPhone])
  const customRecipient = isRecipientRoute
  const { user, booted, balance, pay } = useWallet()
  const { recordTransaction } = useAnalytics()

  const [amount, setAmount] = useState(searchParams.get('amount') ?? '')
  const [phase, setPhase] = useState<'idle' | 'checking' | 'processing' | 'done'>('idle')
  const [result, setResult] = useState<Preflight | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const idempotencyKey = useRef(newIdempotencyKey())

  const value = inr(amount)
  const valuePaise = Math.round(value * 100)
  const insufficient = balance != null && valuePaise > balance
  const invalidAmount = !Number.isFinite(value) || value <= 0 || value > 1_000_000

  // The Python analyzer screens the exact recipient and amount before payment.
  useEffect(() => {
    if (!merchant || invalidAmount) {
      setResult(null)
      setPhase('idle')
      return
    }
    setPhase('checking')
    let cancelled = false
    const localFallback = () => ({ ...preflight(merchant, value), analysis_source: 'local' as const })
    const riskPayload = suppliedRiskPayload || localFallback().payload
    void analyzePaymentPayload(riskPayload)
      .then((analysis) => {
        if (cancelled) return
        setResult({
          ...localFallback(),
          score: analysis.risk_score,
          band: analysis.risk_level,
          verdict: analysis.recommended_action === 'BLOCK' ? 'BLOCK' : analysis.recommended_action === 'WARN_AND_VERIFY' ? 'VERIFY' : 'CLEAR',
          reasons: analysis.reasons,
          analysis_source: 'api',
        })
      })
      .catch(() => {
        if (!cancelled) setResult(localFallback())
      })
      .finally(() => {
        if (!cancelled) setPhase('idle')
      })
    return () => {
      cancelled = true
    }
  }, [value, invalidAmount, merchant, suppliedRiskPayload])

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

  async function payNow() {
    if (!merchant || !result || invalidAmount) return
    if (result.verdict === 'VERIFY' && !confirmed) {
      setConfirmed(true)
      return
    }
    if (!user) return
    setPayError(null)
    setPhase('processing')
    try {
      const res = await pay({
        receiver_upi_id: merchant.upiId,
        receiver_name: merchant.name,
        amount: valuePaise,
        note: `Payment to ${merchant.name}`,
        risk_payload: suppliedRiskPayload || result.payload,
        idempotency_key: idempotencyKey.current,
        confirm_risk: confirmed,
      })
      recordTransaction(res.risk_level === 'HIGH' || res.recommended_action === 'BLOCK')
      setSaved(false)
      setReceipt({
        reference: res.reference,
        balanceAfter: res.balance_after,
        blocked: res.status === 'blocked',
        evidence: { score: res.risk_score, reasons: res.reasons },
      })
      setPhase('done')
    } catch (err) {
      setPhase('idle')
      if (err instanceof SimApiError) {
        if (err.status === 401) {
          setPayError('Your session expired. Sign in again from the home screen.')
        } else {
          setPayError(err.message)
        }
      } else {
        setPayError('Payment failed. Please try again.')
      }
    }
  }

  async function savePayee() {
    if (!merchant) return
    try {
      await saveContact({ name: merchant.name, upi_id: merchant.upiId, phone: merchant.phone })
      setSaved(true)
    } catch {
      setSaved(false)
    }
  }

  if (phase === 'done' && receipt) {
    const evidenceReasons = receipt.evidence?.reasons.length ? receipt.evidence.reasons : reasons
    return (
      <div className="container page">
        <div className={`receipt ${receipt.blocked ? 'receipt--blocked' : 'receipt--done'}`}>
          <span className={`receipt__seal receipt__seal--${receipt.blocked ? 'risk' : 'ok'}`}>
            {receipt.blocked ? <IconShieldAlert size={30} /> : <IconCheckCircle size={30} />}
          </span>
          <h1 className="receipt__title">{receipt.blocked ? 'Payment blocked' : 'Payment successful'}</h1>
          <p className="receipt__amount">{rupees(value)}</p>
          <p className="receipt__to">
            {receipt.blocked ? 'to' : 'Paid to'} <strong>{merchant.name}</strong>
            <br />
            <span className="mono">{merchant.upiId}</span>
          </p>
          <dl className="receipt__meta">
            <div>
              <dt>Reference</dt>
              <dd className="mono">{receipt.reference}</dd>
            </div>
            <div>
              <dt>Fraud score</dt>
              <dd>
                {receipt.evidence?.score ?? result?.score}/100 &middot; {result?.band}
              </dd>
            </div>
            {receipt.balanceAfter != null && !receipt.blocked ? (
              <div>
                <dt>Demo balance left</dt>
                <dd className="mono">{rupees(receipt.balanceAfter / 100)}</dd>
              </div>
            ) : null}
          </dl>
          {receipt.blocked && evidenceReasons.length ? (
            <>
              <h2>Why this payment is suspicious</h2>
              <ul className="receipt__reasons">
                {evidenceReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="paycta__note">
            {receipt.blocked
              ? 'The transaction was stopped before any debit. If someone pressured you into making this payment, report it on the cybercrime helpline at 1930.'
              : 'Simulated payment from the demo wallet — no real money moved.'}
          </p>
          <div className="btn-row">
            {!receipt.blocked && user ? (
              <button type="button" className="btn btn--quiet" disabled={saved} onClick={() => void savePayee()}>
                {saved ? 'Payee saved' : 'Save payee'}
              </button>
            ) : null}
            <Link to={customRecipient ? '/search' : `/merchant/${merchant.id}`} className="btn btn--quiet">
              {customRecipient ? 'Back to contacts' : 'Back to merchant'}
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
      <Link to={customRecipient ? '/search' : `/merchant/${merchant.id}`} className="backlink">
        <IconArrowLeft size={15} /> {customRecipient ? 'Back to contacts' : merchant.name}
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
            idempotencyKey.current = newIdempotencyKey()
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
              idempotencyKey.current = newIdempotencyKey()
              setConfirmed(false)
            }}
          >
            ₹{a}
          </button>
        ))}
      </div>

      {invalidAmount ? (
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
            <p className="verdict__text">
              {result?.analysis_source === 'api'
                ? 'Python backend local rules; identity is not verified.'
                : 'On-device rules only; the backend will still recheck before payment.'}
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
        {user && balance != null ? (
          <p className="paycta__note">
            Demo wallet balance: <strong className="mono">{rupees(balance / 100)}</strong>
            {insufficient && value > 0 ? ' — insufficient for this payment' : ''}
          </p>
        ) : (
          <p className="paycta__note">
            {booted ? (
              <><Link to="/#wallet">Sign in</Link> to the demo wallet to pay — nothing here touches real money.</>
            ) : 'Restoring your simulated wallet session…'}
          </p>
        )}
        {payError ? <p className="field-error">{payError}</p> : null}
        {blocked ? (
          <>
            <button
              type="button"
              className="btn btn--danger btn--lg btn--block"
              disabled={!booted || !user || phase === 'processing'}
              onClick={() => void payNow()}
            >
              <IconBlock /> {!booted ? 'Restoring wallet session…' : user ? 'Record blocked attempt' : 'Sign in to record blocked attempt'}
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
            disabled={
              !result ||
              invalidAmount ||
              phase === 'processing' ||
              !booted ||
              !user ||
              insufficient
            }
            onClick={payNow}
          >
            {phase === 'processing'
              ? 'Processing…'
              : !booted
                ? 'Restoring wallet session…'
                : !user
                  ? 'Sign in to pay'
                  : insufficient
                    ? 'Insufficient demo balance'
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