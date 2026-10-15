import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Upi'
import { IconSearch } from '../components/Icons'
import { MERCHANTS, searchMerchants } from '../data/merchants'
import { deleteContact, fetchContacts } from '../lib/api'
import type { SimContact } from '../lib/api'
import { useWallet } from '../state/wallet'

const SUGGESTIONS = [
  { label: 'Search by mobile number', q: '9876' },
  { label: 'Search by UPI ID', q: '@okaxis' },
  { label: 'Suspicious "bank" payees', q: 'rbi' },
]

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function SearchScreen() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const { user } = useWallet()
  const [contacts, setContacts] = useState<SimContact[] | null>(null)
  const [contactsError, setContactsError] = useState<string | null>(null)

  const results = useMemo(() => searchMerchants(query), [query])

  // Saved payees live on the backend, so they survive reloads.
  useEffect(() => {
    let cancelled = false
    if (!user) {
      setContacts(null)
      setContactsError(null)
      return
    }
    fetchContacts()
      .then((list) => {
        if (!cancelled) {
          setContacts(list)
          setContactsError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setContactsError(err instanceof Error ? err.message : 'Could not load saved payees.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const savedMatches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!contacts) return []
    if (!q) return contacts
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.upi_id.toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q),
    )
  }, [contacts, query])
  const typedUpi = /^[A-Za-z0-9][A-Za-z0-9._-]{1,48}@[A-Za-z0-9][A-Za-z0-9.-]{1,24}$/.test(query.trim())
  const alreadyListed = results.some((merchant) => merchant.upiId.toLowerCase() === query.trim().toLowerCase())
  const alreadySaved = savedMatches.some((contact) => contact.upi_id.toLowerCase() === query.trim().toLowerCase())

  async function removeContact(id: string) {
    try {
      await deleteContact(id)
      setContacts((prev) => (prev ?? []).filter((c) => c.id !== id))
    } catch (err) {
      setContactsError(err instanceof Error ? err.message : 'Could not remove the payee.')
    }
  }

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

      {user && (savedMatches.length > 0 || contactsError) ? (
        <section className="block" aria-label="Saved payees">
          <h2 className="block__title">Saved payees</h2>
          {contactsError ? (
            <p className="field-error">{contactsError}</p>
          ) : (
            <ul className="mlist">
              {savedMatches.map((c) => (
                <li key={c.id} className="hrow">
                  <Avatar initials={initialsOf(c.name)} tone="blue" size={40} />
                  <span className="hrow__body">
                    <span className="hrow__name">{c.name}</span>
                    <span className="hrow__meta mono">{c.upi_id}</span>
                    <span className="hrow__tag">{c.phone ? `${c.phone} · ` : ''}Saved contact · not verified</span>
                  </span>
                  <Link
                    className="btn btn--outline"
                    to={`/pay/recipient?upi=${encodeURIComponent(c.upi_id)}&name=${encodeURIComponent(c.name)}&phone=${encodeURIComponent(c.phone ?? '')}`}
                  >
                    Pay
                  </Link>
                  <button
                    type="button"
                    className="btn btn--quiet"
                    onClick={() => void removeContact(c.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {typedUpi && !alreadyListed && !alreadySaved ? (
        <div className="notice" style={{ marginTop: 14 }}>
          <span>
            No identity provider is connected. This UPI ID can be screened for local risk patterns, but its owner is not verified.
          </span>
          <Link
            to={`/pay/recipient?upi=${encodeURIComponent(query.trim())}`}
            className="btn btn--primary"
          >
            Review payment
          </Link>
        </div>
      ) : null}

      {results.length === 0 ? (
        <div className="empty">
          <h2>No merchant found</h2>
          <p>
            Phone lookup only matches saved contacts and local sample listings. No phone or UPI identity provider is connected.
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