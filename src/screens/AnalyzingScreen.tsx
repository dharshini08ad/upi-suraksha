import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Stepper } from '../components/Stepper'
import { IconCheck, IconShield } from '../components/Icons'
import { useSession } from '../state/session'
import { useAnalytics } from '../state/analytics'
import { analyzeSubmittedInput } from '../lib/api'

const STAGES = [
  'Reading the payment request',
  'Resolving the payee handle',
  'Checking the address and redirects',
  'Comparing against known fraud patterns',
  'Computing the risk score',
]

export function AnalyzingScreen() {
  const { input, complete } = useSession()
  const { recordScan } = useAnalytics()
  const [stage, setStage] = useState(0)
  const navigate = useNavigate()
  const submittedRef = useRef(false)

  useEffect(() => {
    if (!input) return
    if (stage >= STAGES.length) {
      if (submittedRef.current) return
      submittedRef.current = true
      let cancelled = false
      void analyzeSubmittedInput(input)
        .catch(() => null)
        .then((serverResult) => {
          if (cancelled) return
          const result = complete(serverResult ?? undefined)
          if (result) recordScan(result.band !== 'LOW')
          navigate('/report', { replace: true })
        })
      return () => {
        cancelled = true
      }
    }
    const id = window.setTimeout(() => setStage((s) => s + 1), stage === STAGES.length - 1 ? 420 : 340)
    return () => window.clearTimeout(id)
  }, [stage, input, complete, navigate, recordScan])

  if (!input) return <Navigate to="/" replace />

  return (
    <>
      <Stepper current={1} />
      <div className="container analysing">
        <IconShield size={40} />
        <h1 className="analysing__title">Analysing the request</h1>
        <p className="analysing__subject">{input}</p>

        <ol className="analysing__list" style={{ listStyle: 'none', margin: '30px 0 0', padding: 0 }}>
          {STAGES.map((label, i) => {
            const state = i < stage ? 'is-done' : i === stage ? 'is-active' : ''
            return (
              <li key={label} className={`analysing__step ${state}`}>
                <span className="analysing__dot">
                  {i < stage ? <IconCheck size={10} /> : null}
                </span>
                {label}
              </li>
            )
          })}
        </ol>
      </div>
    </>
  )
}
