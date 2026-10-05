import type { CheckResult, Finding } from '../lib/types'
import { IconCheck, IconCross, IconMinus, IconWarning } from './Icons'

const STATUS_META = {
  PASS: { label: 'Verified', check: 'check--pass', badge: 'badge--ok', Icon: IconCheck },
  REVIEW: { label: 'Needs review', check: 'check--review', badge: 'badge--warn', Icon: IconWarning },
  FAIL: { label: 'Failed', check: 'check--fail', badge: 'badge--risk', Icon: IconCross },
  NA: { label: 'Not applicable', check: 'check--na', badge: 'badge--neutral', Icon: IconMinus },
} as const

export function CheckList({ checks }: { checks: CheckResult[] }) {
  return (
    <ul className="checks">
      {checks.map((check) => {
        const meta = STATUS_META[check.status]
        return (
          <li key={check.id} className={`check ${meta.check}`}>
            <span className="check__icon">
              <meta.Icon size={13} />
            </span>
            <div>
              <div className="check__title">
                {check.label}
                <span className={`badge ${meta.badge}`}>{meta.label}</span>
              </div>
              <p className="check__detail">{check.detail}</p>
              {check.points > 0 ? (
                <p className="check__points">
                  {check.points} point{check.points === 1 ? '' : 's'} added to the risk score
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function IndicatorList({ indicators }: { indicators: Finding[] }) {
  if (indicators.length === 0) {
    return (
      <p className="indicators-empty">
        No suspicious indicators were raised against this request.
      </p>
    )
  }

  return (
    <ul className="indicators">
      {indicators.map((finding, i) => (
        <li key={`${finding.category}-${i}`} className={`indicator indicator--${finding.severity}`}>
          <span className="indicator__bar" aria-hidden="true" />
          <p className="indicator__text">
            {finding.text}
            <span className="indicator__src">{finding.source}</span>
          </p>
        </li>
      ))}
    </ul>
  )
}
