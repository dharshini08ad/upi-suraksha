import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Stepper } from '../components/Stepper'
import { SampleList } from '../components/SampleList'
import { IconArrowRight, IconAt } from '../components/Icons'
import { samplesFor } from '../data/samples'
import { useSession } from '../state/session'

export function UpiIdScreen() {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { begin } = useSession()
  const navigate = useNavigate()

  function submit(raw: string) {
    const trimmed = raw.trim().replace(/\s+/g, '')
    if (!/^[^\s@]{2,64}@[^\s@]{2,32}$/.test(trimmed)) {
      setError('A UPI ID has two parts separated by @, for example merchant@okaxis')
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
          <h1 className="page__title">Verify a UPI ID</h1>
          <p className="page__lede">
            Check the payee handle before you approve a request. Handles are the part before the
            &#64;, and anyone can create one that reads like a bank or a government department.
          </p>
        </header>

        <div className="panel form-panel">
          <div className="panel__head">
            <span className="panel__title">UPI ID</span>
            <span className="tag">
              <IconAt size={13} /> handle&#64;bank
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
              <span className="field__label">UPI ID</span>
              <input
                className={`input input--mono${error ? ' is-invalid' : ''}`}
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="merchant@okaxis"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  if (error) setError(null)
                }}
              />
              {error ? <span className="field-error">{error}</span> : null}
              <span className="field__hint">
                Copy the UPI ID exactly as it appears on the request screen.
              </span>
            </label>

            <div className="form-actions">
              <button type="submit" className="btn btn--primary btn--lg">
                Verify UPI ID <IconArrowRight />
              </button>
            </div>
          </form>
        </div>

        <div style={{ maxWidth: 720, marginTop: 16 }}>
          <SampleList samples={samplesFor('UPI_ID')} onPick={(p) => submit(p)} />
        </div>
      </div>
    </>
  )
}
