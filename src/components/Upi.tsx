import { Link } from 'react-router-dom'
import type { Merchant } from '../data/merchants'

export function Avatar({
  initials,
  tone,
  size = 44,
}: {
  initials: string
  tone: Merchant['tone']
  size?: number
}) {
  return (
    <span className={`avatar avatar--${tone}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </span>
  )
}

export function SearchPill() {
  return (
    <div className="searchpill">
      <span className="searchpill__icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="10.8" cy="10.8" r="6.3" />
          <path d="m15.5 15.5 4 4" strokeLinecap="round" />
        </svg>
      </span>
      <Link
        to="/search"
        className="searchpill__link"
        aria-label="Search merchants by name, mobile number or UPI ID"
      >
        <span className="searchpill__input">Search by name, mobile number or UPI ID</span>
      </Link>
    </div>
  )
}

/** Merchant row used on the home screen and in search results. */
export function MerchantRow({ merchant }: { merchant: Merchant }) {
  return (
    <li>
      <Link to={`/merchant/${merchant.id}`} className="mrow">
        <Avatar initials={merchant.initials} tone={merchant.tone} />
        <span className="mrow__body">
          <span className="mrow__name">
            {merchant.name}
          </span>
          <span className="mrow__meta mono">{merchant.upiId}</span>
        </span>
        <span className="mrow__chevron" aria-hidden="true">
          ›
        </span>
      </Link>
    </li>
  )
}