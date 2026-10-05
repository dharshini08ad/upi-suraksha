import { useState } from 'react'
import type { Sample } from '../data/samples'

export function SampleList({
  samples,
  onPick,
  title = 'Example requests',
}: {
  samples: Sample[]
  onPick: (payload: string) => void
  title?: string
}) {
  const [open, setOpen] = useState(false)

  if (samples.length === 0) return null

  return (
    <div className="samples">
      <button
        type="button"
        className="samples__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          {title} <span className="muted">({samples.length})</span>
        </span>
        <span className="muted">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open ? (
        <ul className="samples__list">
          {samples.map((sample) => (
            <li key={sample.id} className="sample">
              <span className="sample__text">
                <span className="sample__name">{sample.name}</span>
                <span className="muted"> &middot; {sample.context}</span>
                <code className="sample__payload">{sample.payload}</code>
              </span>
              <button type="button" className="sample__btn" onClick={() => onPick(sample.payload)}>
                Use
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
