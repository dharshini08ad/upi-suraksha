import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Stepper } from '../components/Stepper'
import { SampleList } from '../components/SampleList'
import { IconArrowRight, IconLink } from '../components/Icons'
import { samplesFor } from '../data/samples'
import { useSession } from '../state/session'

export function LinkScreen() {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { begin } = useSession()
  const navigate = useNavigate()

  function submit(raw: string) {
    const trimmed = raw.trim()
    if (!/^https?:\/\//i.test(trimmed) && !/^[\w-]+(\.[\w-]+)+\//i.test(trimmed)) {
      setError('Enter the full payment link, including https://')
      return
    }
    setError(null)
    begin(trimmed)
    navigate('/analyse')
  }

  return (
    <>
      <Stepper current={0} />
      <div className="container page">
        <header className="page__head">
          <span className="eyebrow">Step 1 &middot; Input</span>
          <h1 className="page__title">Check a payment link</h1>
          <p className="page__lede">
            Paste the full link you received by SMS, email or chat. The address, the redirect chain
            and the payee hidden inside it are checked before you open it.
          </p>
        </header>

        <div className="panel form-panel">
          <div className="panel__head">
            <span className="panel__title">Payment link</span>
            <span className="tag">
              <IconLink size={13} /> https
            </span>
          </div>
          <form
            className="panel__body"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              submit(value)
            }}
          >
            <label className="field">
              <span className="field__label">Payment URL</span>
              <input
                className={`input input--mono${error ? ' is-invalid' : ''}`}
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://upi.example-bank.co.in/collect?pa=merchant@okaxis&am=500.00"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  if (error) setError(null)
                }}
              />
              {error ? <span className="field-error">{error}</span> : null}
              <span className="field__hint">
                Paste the whole link. Do not open it in your browser first.
              </span>
            </label>

            <div className="form-actions">
              <button type="submit" className="btn btn--primary btn--lg">
                Analyse link <IconArrowRight />
              </button>
            </div>
          </form>
        </div>

        <div style={{ maxWidth: 720, marginTop: 16 }}>
          <SampleList samples={samplesFor('LINK')} onPick={(p) => submit(p)} />
        </div>
      </div>
    </>
  )
}
