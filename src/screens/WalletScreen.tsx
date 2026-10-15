import { Link } from 'react-router-dom'
import { IconArrowLeft, IconClock } from '../components/Icons'
import { useWallet } from '../state/wallet'

const money = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100)

export function WalletScreen() {
  const { user, booted, balance, walletNote, payments, busy, notice, refresh, signOut } = useWallet()

  if (!user) {
    return (
      <div className="container page">
        <header className="page__head">
          <h1 className="page__title">Simulated wallet</h1>
          <p className="page__lede">Sign in to see your private demo balance and payment records.</p>
        </header>
        <div className="empty">
          <h2>{booted ? 'Sign in to continue' : 'Checking your session…'}</h2>
          {notice ? <p className="field-error" role="alert">{notice}</p> : null}
          <Link to="/#wallet" className="btn btn--primary">Open wallet sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container page">
      <Link to="/" className="backlink"><IconArrowLeft size={15} /> Home</Link>
      <header className="page__head">
        <span className="eyebrow">SIMULATED WALLET</span>
        <h1 className="page__title">Bank balance</h1>
        <p className="page__lede">{user.display_name} · {user.username}</p>
      </header>

      <section className="panel wallet-balance" aria-label="Simulated wallet balance">
        <span className="eyebrow">DEMO BALANCE · INR</span>
        <p className="wallet-balance__amount">{balance == null ? (busy ? 'Loading balance…' : 'Balance unavailable') : money(balance)}</p>
        <p className="field__hint">{walletNote ?? 'Simulated balance only. No real bank or UPI account is connected.'}</p>
        {notice ? <p className="field-error" role="alert">{notice}</p> : null}
        <div className="btn-row">
          <button type="button" className="btn btn--outline" disabled={busy} onClick={() => void refresh()}>
            {busy ? 'Refreshing…' : 'Refresh balance'}
          </button>
          <Link to="/search" className="btn btn--primary">Pay</Link>
          <button type="button" className="btn btn--quiet" onClick={() => void signOut()}>Sign out</button>
        </div>
      </section>

      <section className="block">
        <div className="block__heading-row">
          <h2 className="block__title">Recent activity</h2>
          <Link to="/history" className="block__more">All transactions</Link>
        </div>
        {payments.length ? (
          <ul className="mlist mlist--card">
            {payments.slice(0, 3).map((payment) => (
              <li key={payment.id} className="hrow">
                <IconClock size={20} />
                <span className="hrow__body">
                  <span className="hrow__name">{payment.receiver_name ?? payment.receiver_upi_id}</span>
                  <span className="hrow__meta mono">{payment.receiver_upi_id}</span>
                </span>
                <span className="hrow__amount">{money(payment.amount)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="field__hint">No simulated payments yet.</p>}
      </section>
    </div>
  )
}