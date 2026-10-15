import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ticker } from '../components/Ticker'
import { Avatar, MerchantRow, SearchPill } from '../components/Upi'
import {
  IconAt,
  IconCamera,
  IconCheckCircle,
  IconLink,
  IconQr,
  IconSearch,
  IconShield,
  IconShieldAlert,
} from '../components/Icons'
import { recentMerchants } from '../data/merchants'
import { useAnalytics } from '../state/analytics'
import { WalletCard } from '../components/WalletCard'
import { fetchContacts } from '../lib/api'
import type { SimContact } from '../lib/api'
import { useWallet } from '../state/wallet'

/** The three safety tools — always side by side. */
const TOOLS = [
  { to: '/scan', label: 'Scan QR', hint: 'Camera or upload', Icon: IconQr },
  { to: '/link', label: 'Check Link', hint: 'Paste a UPI link', Icon: IconLink },
  { to: '/upi', label: 'Verify UPI ID', hint: 'Check the handle', Icon: IconAt },
]

const QUICK = [
  { to: '/scan', label: 'Scan QR', Icon: IconQr },
  { to: '/search', label: 'Pay', Icon: IconSearch },
  { to: '/wallet', label: 'Bank balance', Icon: IconCheckCircle },
  { to: '/history', label: 'History', Icon: IconShield },
]

export function HomeScreen() {
  const merchants = recentMerchants(4)
  const { user, balance } = useWallet()
  const [contacts, setContacts] = useState<SimContact[]>([])
  const [contactsError, setContactsError] = useState<string | null>(null)
  const { totalScans, threatsDetected, transactionsAnalyzed } = useAnalytics()

  useEffect(() => {
    let cancelled = false
    if (!user) {
      setContacts([])
      setContactsError(null)
      return
    }
    fetchContacts()
      .then((items) => {
        if (!cancelled) setContacts(items.slice(0, 4))
      })
      .catch((error: unknown) => {
        if (!cancelled) setContactsError(error instanceof Error ? error.message : 'Could not load saved contacts.')
      })
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero__inner rise">
            <div>
              <span className="hero__pill">
                <span className="hero__flagbar" aria-hidden="true" />
                UPI Suraksha · simulated payments
              </span>
              <h1 className="hero__title">
                Pay with care.
              </h1>
              <p className="hero__sub">
                Review UPI IDs, QR codes, and payment links with local risk rules before a simulated payment.
              </p>
              <div className="hero__ctas">
                <Link to="/search" className="btn btn--primary">
                  <IconSearch /> Pay
                </Link>
                <Link to="/scan" className="btn btn--outline">
                  <IconCamera /> Scan QR
                </Link>
              </div>
              <Link to="/wallet" className="hero__balance">
                <span>{user && balance != null ? `Simulated balance ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(balance / 100)}` : 'Demo wallet starts with ₹50,000 simulated balance'}</span>
                <span aria-hidden="true">›</span>
              </Link>
              <div className="hero__trust">
                <span className="hero__trust-item">
                  <IconShield size={15} /> Local risk rules
                </span>
                <span className="hero__trust-item">
                  <IconCheckCircle size={15} /> No bank integration
                </span>
                <span className="hero__trust-item">
                  <IconShieldAlert size={15} /> Identity not verified
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <div className="rise" style={{ marginBottom: 22 }}>
          <SearchPill />
        </div>

        <div className="rise" style={{ marginBottom: 22 }}>
          <WalletCard />
        </div>

        <section className="stats" aria-label="Security summary">
          <div className="stat stat--scans rise">
            <span className="stat__icon">
              <IconQr size={24} />
            </span>
            <div className="stat__body">
              <div className="stat__value">{totalScans}</div>
              <div className="stat__label">Total Scans</div>
              <div className="stat__hint">QR, UPI ID &amp; link checks</div>
            </div>
          </div>
          <div className="stat stat--threats rise">
            <span className="stat__icon">
              <IconShieldAlert size={24} />
            </span>
            <div className="stat__body">
              <div className="stat__value">{threatsDetected}</div>
              <div className="stat__label">Threats Detected</div>
              <div className="stat__hint">High-risk patterns flagged</div>
            </div>
          </div>
          <div className="stat stat--txns rise">
            <span className="stat__icon">
              <IconCheckCircle size={24} />
            </span>
            <div className="stat__body">
              <div className="stat__value">{transactionsAnalyzed}</div>
              <div className="stat__label">Transactions Analyzed</div>
              <div className="stat__hint">Screened before you pay</div>
            </div>
          </div>
        </section>

        <div className="quickrow">
          {QUICK.map(({ to, label, Icon }) => (
            <Link key={to + label} to={to} className="quick">
              <span className="quick__icon">
                <Icon size={20} />
              </span>
              <span className="quick__label">{label}</span>
            </Link>
          ))}
        </div>

        <section className="block">
          <div className="block__heading-row">
            <h2 className="block__title">Saved contacts</h2>
            <Link to="/search" className="block__more">Manage</Link>
          </div>
          {contactsError ? <p className="field-error">{contactsError}</p> : null}
          {!user ? (
            <p className="field__hint">Sign in to save and use your contacts across sessions.</p>
          ) : contacts.length ? (
            <ul className="mlist mlist--card">
              {contacts.map((contact) => {
                const initials = contact.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
                const payTo = `/pay/recipient?upi=${encodeURIComponent(contact.upi_id)}&name=${encodeURIComponent(contact.name)}&phone=${encodeURIComponent(contact.phone ?? '')}`
                return (
                  <li key={contact.id}>
                    <Link to={payTo} className="mrow">
                      <Avatar initials={initials || '?'} tone="blue" />
                      <span className="mrow__body">
                        <span className="mrow__name">{contact.name}</span>
                        <span className="mrow__meta mono">{contact.upi_id}</span>
                        <span className="mrow__sub">Saved contact · not identity verified</span>
                      </span>
                      <span className="mrow__chevron" aria-hidden="true">›</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="field__hint">No saved contacts yet. Save a recipient after a simulated payment or QR scan.</p>
          )}
        </section>

        <section className="block">
          <h2 className="block__title">Sample merchants</h2>
          <p className="field__hint">Local demo listings only; these entries do not verify account ownership.</p>
          <ul className="mlist">
            {merchants.map((m) => (
              <MerchantRow key={m.id} merchant={m} />
            ))}
          </ul>
          <Link to="/search" className="block__more">
            See all merchants
          </Link>
        </section>

        <section className="block">
          <h2 className="block__title">Safety tools</h2>
          <div className="toolgrid">
            {TOOLS.map(({ to, label, hint, Icon }) => (
              <Link key={to} to={to} className="tool">
                <span className="tool__icon">
                  <Icon size={22} />
                </span>
                <span className="tool__label">{label}</span>
                <span className="tool__hint">{hint}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="notice" style={{ marginTop: 20, marginBottom: 8 }}>
          <IconShield size={18} />
          <span>
            Risk checks use local rules and do not verify account ownership or guarantee safety. Payments here are simulated. If you have
            been defrauded, call the cybercrime helpline on <strong className="mono">1930</strong>.
          </span>
        </section>
      </div>

      <Ticker />

      <section className="merchantstrip">
        <div className="container">
          <span className="merchantstrip__label">
            <Avatar initials="S" tone="blue" size={30} />
            Send money to a saved payee
          </span>
          <Link to="/search" className="btn btn--primary">
            Search merchants
          </Link>
        </div>
      </section>
    </>
  )
}
