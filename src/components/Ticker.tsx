/**
 * Continuously running advisory strip. The list is duplicated and translated
 * by exactly -50% so the loop is seamless, and it stops on hover / focus.
 */
const MESSAGES = [
  'Never share your UPI PIN or OTP with anyone, for any reason.',
  'No bank or regulator ever asks for KYC through a payment QR code.',
  'A ₹1 request is bait — it exists only to trigger a fake authorisation.',
  'Check the payee name and amount on your own UPI app before approving.',
  'Shortened links hide the real payee. Ask the merchant to resend the QR.',
  'Report suspected fraud on the cybercrime helpline 1930.',
]

export function Ticker() {
  const run = [...MESSAGES, ...MESSAGES]

  return (
    <section className="ticker" aria-label="Safety advisories">
      <div className="ticker__label">
        <span className="ticker__pulse" aria-hidden="true" />
        Advisories
      </div>

      <div className="ticker__viewport">
        <div className="ticker__track">
          {run.map((message, i) => (
            <span className="ticker__item" key={i} aria-hidden={i >= MESSAGES.length}>
              {message}
              <span className="ticker__dot" aria-hidden="true">
                ◆
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}