import { Link } from 'react-router-dom'
import { IconInfo, IconPhone } from './Icons'
import { BRAND } from '../lib/brand'

export function AppFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div>
            <h2 className="footer__heading">{BRAND.name}</h2>
            <p className="footer__blurb">
              A verification front end for UPI payments. It reads a QR code, a payment link or a UPI
              ID, scores the request out of 100 and recommends whether to allow, verify or block it.
            </p>
          </div>

          <div>
            <h2 className="footer__heading">Verify a payment</h2>
            <ul className="footer__list">
              <li>
                <Link to="/scan">Scan a QR code</Link>
              </li>
              <li>
                <Link to="/link">Check a payment link</Link>
              </li>
              <li>
                <Link to="/upi">Verify a UPI ID</Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="footer__heading">If you have paid already</h2>
            <ul className="footer__list">
              <li>
                <span className="nowrap">
                  <IconPhone size={14} /> Report to the cybercrime helpline
                </span>{' '}
                <strong className="mono">1930</strong>
              </li>
              <li>Contact your bank and ask them to freeze the beneficiary VPA.</li>
              <li>Keep the screenshot, the SMS and the UPI transaction reference.</li>
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <div className="disclaimer">
            <IconInfo size={16} />
            <span>
              Demonstration interface. {BRAND.name}, the {BRAND.operator} and this service are
              fictional and are not a Government of India service. QR payloads are sent to the
              configured analysis API for local risk checks. This service does not make or authorize
              payments.
            </span>
          </div>
          <span className="nowrap">Ruleset {BRAND.ruleset}</span>
        </div>
      </div>
    </footer>
  )
}
