import { Link } from 'react-router-dom'
import { IconBlock, IconCheckCircle } from '../components/Icons'
import { useWallet } from '../state/wallet'

const money = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100)

/** The backend stamps transactions in epoch seconds. */
function when(epoch: number): string {
  const millis = epoch > 1e12 ? epoch : epoch * 1000
  return new Date(millis).toLocaleString('en-IN')
}

export function HistoryScreen() {
  const { user, payments, busy, notice, refresh } = useWallet()

  if (!user) {
    return (
      <div className="container page">
        <header className="page__head">
          <h1 className="page__title">Payment history</h1>
        </header>
        <div className="empty">
          <h2>Sign in to see your history</h2>
          <p>
            The demo wallet keeps its payment history on the simulator backend, so it survives reloads —
            but only for a signed-in account.
          </p>
          <Link to="/" className="btn btn--primary">
            Open the demo wallet
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container page">
      <header className="page__head">
        <h1 className="page__title">Payment history</h1>
        <p className="page__lede">
          Every simulated payment recorded by the backend, with the fraud score it received at the moment
          you pressed pay.
        </p>
      </header>

      {notice ? <p className="field-error">{notice}</p> : null}

      {payments.length === 0 ? (
        <div className="empty">
          <h2>No payments yet</h2>
          <p>Search for a merchant and pay them to see the fraud screening in action.</p>
          <Link to="/search" className="btn btn--primary">
            Find a merchant
          </Link>
        </div>
      ) : (
        <ul className="mlist mlist--card">
          {payments.map((p) => {
            const blocked = p.status === 'blocked' || p.recommended_action === 'BLOCK'
            const reasons = Array.isArray(p.analysis?.reasons)
              ? p.analysis.reasons.filter((reason): reason is string => typeof reason === 'string')
              : []
            return (
              <li key={p.id} className="hrow">
                <span className={`hrow__seal ${blocked ? 'hrow__seal--risk' : 'hrow__seal--ok'}`}>
                  {blocked ? <IconBlock size={16} /> : <IconCheckCircle size={16} />}
                </span>
                <span className="hrow__body">
                  <span className="hrow__name">{p.receiver_name ?? 'UPI payee'}</span>
                  <span className="hrow__meta mono">
                    {p.receiver_upi_id}
                  </span>
                  <span className="hrow__tag">
                    {blocked ? 'Blocked' : 'Completed'} &middot; {p.risk_level ?? 'Risk unavailable'} risk &middot; score {p.risk_score ?? '—'}/100 &middot;{' '}
                    {when(p.created_at)}
                  </span>
                  <span className="hrow__meta mono">Transaction ID {p.id} &middot; Ref {p.reference}</span>
                  {reasons.length ? <span className="hrow__tag">Fraud result: {reasons.join(' ')}</span> : null}
                </span>
                <span className="hrow__amount">{money(p.amount)}</span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn--quiet" disabled={busy} onClick={() => void refresh()}>
          {busy ? 'Refreshing…' : 'Refresh history'}
        </button>
      </div>
    </div>
  )
}