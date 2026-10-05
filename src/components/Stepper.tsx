export const STEPS = ['Input', 'Analyse', 'Risk score', 'Alert', 'Action'] as const

export function Stepper({ current }: { current: number }) {
  return (
    <div className="stepper" aria-label="Verification progress">
      <div className="container">
        <ol className="stepper__inner" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {STEPS.map((step, i) => {
            const state = i < current ? 'is-done' : i === current ? 'is-current' : ''
            return (
              <li key={step} className={`step ${state}`} aria-current={i === current ? 'step' : undefined}>
                <span className="step__num">{i + 1}</span>
                {step}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
