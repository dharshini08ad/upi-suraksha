import { Link } from 'react-router-dom'
import { IconBlock, IconCheckCircle } from '../components/Icons'
import { useWallet } from '../state/wallet'

const money = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)

export function HistoryScreen() {
  const { payments, clear } = useWallet()

  return (
    <div className="container page">
      <header className="page__head">
        <h1 className="page__title">Payment history</h1>
        <p className="page__lede">
          Every payment screened on this device, with the fraud score it received at the moment you
          pressed pay.
        </p>
      </header>

      {payments.length === 0 ? (
        <div className="empty">
          <h2>No payments yet</h2>
          <p>Search for a merchant and pay them to see the fraud screening in action.</p>
          <Link to="/search" className="btn btn--primary">
            Find a merchant
          </Link>
        </div>
      ) : (
        <>
          <ul className="mlist mlist--card">
            {payments.map((p) => (
              <li key={p.id} className="hrow">
                <span className={`hrow__seal ${p.blocked ? 'hrow__seal--risk' : 'hrow__seal--ok'}`}>
                  {p.blocked ? <IconBlock size={16} /> : <IconCheckCircle size={16} />}
                </span>
                <span className="hrow__body">
                  <span className="hrow__name">{p.merchantName}</span>
                  <span className="hrow__meta mono">{p.upiId}</span>
                  <span className="hrow__tag">
                    {p.blocked ? 'Blocked' : p.verdict} &middot; score {p.score}/100 &middot;{' '}
                    {new Date(p.at).toLocaleString('en-IN')}
                  </span>
                </span>
                <span className="hrow__amount">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn--quiet" onClick={clear}>
              Clear history
            </button>
          </div>
        </>
      )}
    </div>
  )
}