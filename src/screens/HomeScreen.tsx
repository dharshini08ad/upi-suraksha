import { Link } from 'react-router-dom'
import { Ticker } from '../components/Ticker'
import { Avatar, MerchantRow, SearchPill } from '../components/Upi'
import { IconAt, IconLink, IconQr, IconShield, IconSearch } from '../components/Icons'
import { recentMerchants } from '../data/merchants'

/** The three safety tools — always side by side. */
const TOOLS = [
  { to: '/scan', label: 'Scan QR', hint: 'Camera or upload', Icon: IconQr },
  { to: '/link', label: 'Check Link', hint: 'Paste a UPI link', Icon: IconLink },
  { to: '/upi', label: 'Verify UPI ID', hint: 'Check the handle', Icon: IconAt },
]

const QUICK = [
  { to: '/scan', label: 'Scan QR', Icon: IconQr },
  { to: '/upi', label: 'To Merchant', Icon: IconSearch },
  { to: '/link', label: 'Check Link', Icon: IconLink },
  { to: '/history', label: 'History', Icon: IconShield },
]

export function HomeScreen() {
  const merchants = recentMerchants(4)

  return (
    <>
      <section className="appbar">
        <div className="container">
          <h1 className="appbar__hello">Secure Every UPI Payment</h1>
          <p className="appbar__sub">Verify UPI IDs, QR codes and payment links before you pay.</p>
          <SearchPill />
        </div>
      </section>

      <div className="container">
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
          <h2 className="block__title">Pay a merchant</h2>
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
            Fraud screening runs on your device every time you pay. Nothing is uploaded. If you have
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
