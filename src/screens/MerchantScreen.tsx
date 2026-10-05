import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../components/Upi'
import { IconArrowLeft, IconShield, IconShieldAlert } from '../components/Icons'
import { getMerchant } from '../data/merchants'
import { VERDICT_COPY, preflight } from '../lib/preflight'

export function MerchantScreen() {
  const { id } = useParams()
  const merchant = getMerchant(id)

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

  // The same engine, run before any amount is entered.
  const check = preflight(merchant, 0)
  const copy = VERDICT_COPY[check.verdict]
  const tone = copy.tone === 'ok' ? 'ok' : copy.tone === 'warn' ? 'warn' : 'risk'

  return (
    <div className="container page">
      <Link to="/search" className="backlink">
        <IconArrowLeft size={15} /> All merchants
      </Link>

      <div className="payhead">
        <Avatar initials={merchant.initials} tone={merchant.tone} size={64} />
        <div>
          <h1 className="payhead__name">
            {merchant.name}
            {merchant.verified ? <span className="tick" aria-label="Verified merchant">✓</span> : null}
          </h1>
          <p className="payhead__vpa mono">{merchant.upiId}</p>
          <p className="payhead__meta">
            {merchant.category} &middot; {merchant.city}
          </p>
        </div>
      </div>

      <div className={`verdict verdict--${tone}`}>
        <span className="verdict__icon">
          {tone === 'risk' ? <IconShieldAlert size={20} /> : <IconShield size={20} />}
        </span>
        <div>
          <p className="verdict__title">
            {copy.label} &middot; score {check.score}/100
          </p>
          <p className="verdict__text">{check.headline}</p>
          {check.reasons.length ? (
            <ul className="verdict__list">
              {check.reasons.slice(0, 2).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <dl className="kv kv--card">
        <div className="kv__row">
          <dt className="kv__dt">UPI ID</dt>
          <dd className="kv__dd kv__dd--mono">{merchant.upiId}</dd>
        </div>
        <div className="kv__row">
          <dt className="kv__dt">Mobile</dt>
          <dd className="kv__dd kv__dd--mono">{merchant.phone}</dd>
        </div>
        <div className="kv__row">
          <dt className="kv__dt">Registry</dt>
          <dd className="kv__dd">
            {merchant.verified ? 'Present on the verified merchant list' : 'Not on the verified merchant list'}
          </dd>
        </div>
      </dl>

      <div className="paycta">
        {check.verdict === 'BLOCK' ? (
          <>
            <Link to={`/pay/${merchant.id}`} className="btn btn--danger btn--lg btn--block btn--lg">
              Review payment
            </Link>
            <p className="paycta__note">
              This payee looks unsafe. Open the review to see exactly what triggered the block.
            </p>
          </>
        ) : (
          <Link to={`/pay/${merchant.id}`} className="btn btn--primary btn--lg btn--block">
            Pay {merchant.name}
          </Link>
        )}
      </div>
    </div>
  )
}