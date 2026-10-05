import { Navigate, useNavigate } from 'react-router-dom'
import { Stepper } from '../components/Stepper'
import { RiskDial } from '../components/RiskDial'
import { CheckList, IndicatorList } from '../components/CheckList'
import { SubmittedDetails } from '../components/SubmittedDetails'
import { ChipBar } from '../components/Emblem'
import { IconArrowRight, IconBlock, IconCheckCircle, IconRefresh } from '../components/Icons'
import { BAND_COPY } from '../lib/riskEngine'
import { useSession } from '../state/session'

const ACTION_COPY = {
  ALLOW: { hint: 'No blocking reason was found. Review the details, then continue in your UPI app.' },
  VERIFY: { hint: 'Confirm the payee with the merchant before you approve this request.' },
  BLOCK: { hint: 'This request should not be approved. Do not enter a PIN or OTP for it.' },
} as const

export function ReportScreen() {
  const { analysis } = useSession()
  const navigate = useNavigate()

  if (!analysis) return <Navigate to="/" replace />

  const copy = BAND_COPY[analysis.band]

  return (
    <>
      <Stepper current={2} />
      <div className="container report">
        <div className="report__grid">
          <div>
            <div className={`score-card score-card--${analysis.band}`}>
              <ChipBar />
              <RiskDial score={analysis.score} band={analysis.band} label={copy.label} />
              <h1 className="score-card__headline">{analysis.headline}</h1>
              <p className="score-card__summary">{analysis.summary}</p>

              <div className="score-card__meta">
                <div className="score-card__meta-row">
                  <span>Recommendation</span>
                  <span>{copy.badge}</span>
                </div>
                <div className="score-card__meta-row">
                  <span>Reference</span>
                  <span>{analysis.reference}</span>
                </div>
                <div className="score-card__meta-row">
                  <span>Ruleset</span>
                  <span>{analysis.engineVersion}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="report__side">
            <div className="report__actions">
              <p className="report__actions-hint">{ACTION_COPY[analysis.recommendation].hint}</p>
              <button
                type="button"
                className="btn btn--danger btn--lg"
                onClick={() => navigate('/decision')}
              >
                {analysis.recommendation === 'BLOCK' ? <IconBlock /> : <IconArrowRight />}
                View alert
              </button>
              <button type="button" className="btn btn--quiet" onClick={() => navigate('/scan')}>
                <IconRefresh /> Verify again
              </button>
            </div>

            <section className="panel panel--flush">
              <div className="panel__head">
                <span className="panel__title">Verification checks</span>
                <span className="tag">5 checks</span>
              </div>
              <CheckList checks={analysis.checks} />
            </section>

            <section className="panel panel--flush">
              <div className="panel__head">
                <span className="panel__title">Suspicious indicators</span>
                <span className="tag">{analysis.indicators.length} raised</span>
              </div>
              <IndicatorList indicators={analysis.indicators} />
            </section>

            <SubmittedDetails analysis={analysis} />

            <section className="notice">
              <IconCheckCircle size={16} />
              <span>
                A low score means nothing suspicious was found, not that the merchant is guaranteed.
                Always read the payee name and amount on your own UPI app before approving.
              </span>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
