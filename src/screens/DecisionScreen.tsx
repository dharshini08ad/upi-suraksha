import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Stepper } from '../components/Stepper'
import { ChipBar } from '../components/Emblem'
import {
  IconArrowRight,
  IconBlock,
  IconCheckCircle,
  IconPhone,
  IconRefresh,
  IconShieldAlert,
} from '../components/Icons'
import { BAND_COPY } from '../lib/riskEngine'
import { BRAND } from '../lib/brand'
import { useSession } from '../state/session'

type Choice = 'BLOCKED' | 'VERIFIED' | 'CONTINUED' | null

const OUTCOME = {
  BLOCKED: {
    title: 'Payment blocked',
    body: 'This request was blocked on this device. Nothing was approved and no money has left your account. Do not open the original link or QR code again.',
  },
  VERIFIED: {
    title: 'Verification recorded',
    body: 'You chose to confirm this payee independently. If the merchant confirms the same UPI ID and amount on a number you already hold, the payment can proceed.',
  },
  CONTINUED: {
    title: 'Continue in your UPI app',
    body: 'Open your UPI app, confirm the payee name and amount shown on its confirmation screen, and approve only if both match what you expected.',
  },
} as const

const SEAL: Record<string, string> = {
  HIGH: 'Security alert',
  MEDIUM: 'Advisory notice',
  LOW: 'Verification passed',
}

export function DecisionScreen() {
  const { analysis } = useSession()
  const [choice, setChoice] = useState<Choice>(null)
  const navigate = useNavigate()

  if (!analysis) return <Navigate to="/" replace />

  const copy = BAND_COPY[analysis.band]
  const reasons = analysis.reasons.length
    ? analysis.reasons
    : [{ title: 'Verification', text: 'No suspicious indicator was raised against this request.' }]

  return (
    <>
      <Stepper current={choice ? 4 : 3} />
      <div className="container">
        <div className="decision">
          <article className={`alert alert--${analysis.band}`}>
            <ChipBar />
            <header className="alert__head">
              <span className="alert__seal">
                <IconShieldAlert size={13} /> {SEAL[analysis.band]} &middot; {copy.label}
              </span>
              <h1 className="alert__title">
                {analysis.band === 'HIGH'
                  ? 'Payment Risk Detected'
                  : analysis.band === 'MEDIUM'
                    ? 'Confirm this payment first'
                    : 'Payment appears safe'}
              </h1>
              <p className="alert__sub">{copy.summary}</p>
            </header>

            <div className="alert__body">
              <h2 className="alert__section-title">
                {analysis.band === 'HIGH' ? 'Why this payment is suspicious' : 'What we found'}
              </h2>
              <ol className="alert__reasons">
                {reasons.map((reason, i) => (
                  <li key={i} className="alert__reason">
                    <span className="alert__reason-num">{i + 1}</span>
                    <p className="alert__reason-text">
                      <strong>{reason.title}.</strong> {reason.text}
                    </p>
                  </li>
                ))}
              </ol>

              <div className="alert__summary-box">
                Request under review &mdash;{' '}
                <span className="mono">
                  {analysis.parsed.upiId ?? analysis.parsed.url ?? analysis.parsed.raw}
                </span>
                <br />
                Fraud risk score <strong>{analysis.score}/100</strong> &middot; reference{' '}
                <span className="mono">{analysis.reference}</span>
              </div>

              <div className="alert__actions">
                {analysis.band === 'HIGH' ? (
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn--danger btn--lg"
                      onClick={() => setChoice('BLOCKED')}
                    >
                      <IconBlock /> Block payment
                    </button>
                    <button
                      type="button"
                      className="btn btn--quiet btn--lg"
                      onClick={() => navigate('/scan')}
                    >
                      <IconRefresh /> Verify again
                    </button>
                  </div>
                ) : analysis.band === 'MEDIUM' ? (
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn--primary btn--lg"
                      onClick={() => setChoice('VERIFIED')}
                    >
                      <IconCheckCircle /> I have verified the payee
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger-outline btn--lg"
                      onClick={() => navigate('/scan')}
                    >
                      <IconRefresh /> Verify again
                    </button>
                  </div>
                ) : (
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn--primary btn--lg"
                      onClick={() => setChoice('CONTINUED')}
                    >
                      Continue <IconArrowRight />
                    </button>
                    <button
                      type="button"
                      className="btn btn--quiet btn--lg"
                      onClick={() => navigate('/scan')}
                    >
                      <IconRefresh /> Verify again
                    </button>
                  </div>
                )}

                <p className="alert__footnote">
                  {BRAND.name} does not hold, freeze or reverse money. It only tells you what this
                  request looks like. The decision and the approval always stay in your UPI app.
                </p>
              </div>

              {choice ? (
                <div className="outcome">
                  <IconPhone size={18} />
                  <span>
                    <span className="outcome__title">{OUTCOME[choice].title}</span>
                    {OUTCOME[choice].body}
                    {choice === 'BLOCKED' ? (
                      <>
                        {' '}
                        Report it on the cybercrime helpline <strong className="mono">1930</strong>.
                      </>
                    ) : null}
                    <span className="outcome__ref">Reference {analysis.reference}</span>
                  </span>
                </div>
              ) : null}
            </div>
          </article>

          <div className="btn-row btn-row--end" style={{ marginTop: 18 }}>
            <button type="button" className="btn btn--quiet" onClick={() => navigate('/report')}>
              Back to the risk score
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
