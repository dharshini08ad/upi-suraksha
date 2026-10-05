import { useEffect, useState } from 'react'
import type { RiskBand } from '../lib/types'

const BAND_COLOUR: Record<RiskBand, string> = {
  LOW: 'var(--ok-600)',
  MEDIUM: 'var(--warn-600)',
  HIGH: 'var(--risk-600)',
}

const BAND_BADGE: Record<RiskBand, string> = {
  LOW: 'badge--ok',
  MEDIUM: 'badge--warn',
  HIGH: 'badge--risk',
}

const RADIUS = 106
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function RiskDial({
  score,
  band,
  label,
}: {
  score: number
  band: RiskBand
  label: string
}) {
  const [offset, setOffset] = useState(CIRCUMFERENCE)

  useEffect(() => {
    const id = window.setTimeout(() => {
      setOffset(CIRCUMFERENCE - (Math.max(0, Math.min(100, score)) / 100) * CIRCUMFERENCE)
    }, 140)
    return () => window.clearTimeout(id)
  }, [score])

  return (
    <div className="dial-wrap">
      <div className="dial">
        <svg className="dial__svg" viewBox="0 0 240 240" role="img" aria-label={`Fraud risk score ${score} out of 100, ${label}`}>
          <circle className="dial__track" cx="120" cy="120" r={RADIUS} />
          <circle
            className="dial__progress"
            cx="120"
            cy="120"
            r={RADIUS}
            stroke={BAND_COLOUR[band]}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="dial__center">
          <span className="dial__value">{score}</span>
          <span className="dial__denom">out of 100</span>
          <span className={`badge dial__band ${BAND_BADGE[band]}`}>{label}</span>
        </div>
      </div>

      <div className="scale">
        <div className="scale__track">
          <span className="scale__seg--ok" />
          <span className="scale__seg--warn" />
          <span className="scale__seg--risk" />
          <span className="scale__marker" style={{ left: `${Math.max(0, Math.min(100, score))}%` }} />
        </div>
        <div className="scale__labels">
          <span>Low 0&ndash;24</span>
          <span>Medium 25&ndash;59</span>
          <span>High 60&ndash;100</span>
        </div>
      </div>
    </div>
  )
}
