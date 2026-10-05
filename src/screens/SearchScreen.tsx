import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Upi'
import { IconSearch } from '../components/Icons'
import { MERCHANTS, searchMerchants } from '../data/merchants'

const SUGGESTIONS = [
  { label: 'Search by mobile number', q: '9876' },
  { label: 'Search by UPI ID', q: '@okaxis' },
  { label: 'Suspicious "bank" payees', q: 'rbi' },
]

export function SearchScreen() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')

  const results = useMemo(() => searchMerchants(query), [query])

  function update(value: string) {
    setQuery(value)
    setParams(value ? { q: value } : {}, { replace: true })
  }

  return (
    <div className="container page">
      <header className="page__head">
        <h1 className="page__title">Search merchants</h1>
        <p className="page__lede">
          Find a payee by name, mobile number or UPI ID, then open the merchant to pay them.
        </p>
      </header>

      <div className="searchbox">
        <span className="searchbox__icon" aria-hidden="true">
          <IconSearch size={18} />
        </span>
        <input
          className="searchbox__input"
          type="search"
          autoFocus
          value={query}
          placeholder="Merchant name, 10-digit number or UPI ID"
          aria-label="Search merchants"
          onChange={(e) => update(e.target.value)}
        />
        {query ? (
          <button type="button" className="searchbox__clear" onClick={() => update('')} aria-label="Clear search">
            ×
          </button>
        ) : null}
      </div>

      {!query ? (
        <div className="chipwrap">
          {SUGGESTIONS.map((s) => (
            <button key={s.q} type="button" className="chip" onClick={() => update(s.q)}>
              {s.label}
            </button>
          ))}
        </div>
      ) : null}

      <p className="resultcount">
        {query
          ? `${results.length} match${results.length === 1 ? '' : 'es'} for "${query}"`
          : `All ${MERCHANTS.length} merchants on this device`}
      </p>

      {results.length === 0 ? (
        <div className="empty">
          <h2>No merchant found</h2>
          <p>
            This demo only knows merchants that are listed on the device. Nothing is searched on the
            internet.
          </p>
          <Link to="/upi" className="btn btn--outline">
            Verify a UPI ID manually
          </Link>
        </div>
      ) : (
        <ul className="mlist mlist--card">
          {results.map((m) => (
            <li key={m.id}>
              <Link to={`/merchant/${m.id}`} className="mrow">
                <Avatar initials={m.initials} tone={m.tone} />
                <span className="mrow__body">
                  <span className="mrow__name">
                    {m.name}
                    {m.verified ? (
                      <span className="tick" title="On the merchant registry" aria-label="Verified">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
                          <path d="m4.5 12.5 5 5 10-11" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    ) : null}
                  </span>
                  <span className="mrow__meta mono">{m.upiId}</span>
                  <span className="mrow__sub">
                    {m.category} &middot; {m.city} &middot; {m.phone}
                  </span>
                </span>
                <span className="mrow__chevron" aria-hidden="true">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}