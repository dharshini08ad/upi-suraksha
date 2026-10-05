/**
 * Renders every route to static markup so broken markup or a bad hook shows up
 * as a failure instead of a blank screen. Run with: npm run smoke
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import type { ReactElement } from 'react'
import App from '../src/App'
import { ScanScreen } from '../src/screens/ScanScreen'
import { SessionContext } from '../src/state/session'
import { analyse } from '../src/lib/riskEngine'

const NOOP = () => undefined

const HIGH =
  'upi://pay?pa=kycverify.pending@ybl&pn=KYC%20Verify%20Pending&am=1.00&cu=INR&tn=Your%20UPI%20PIN%20is%20required%20to%20verify'
const LOW = 'upi://pay?pa=amazonpay@aplaxaxis&pn=Amazon%20Pay&am=1249.00&cu=INR&tn=Order%20MN%2F2841993&mc=5493'

function render(route: string, payload?: string, direct?: ReactElement) {
  const analysis = payload ? analyse(payload) : null
  return renderToStaticMarkup(
    <StaticRouter location={route}>
      <SessionContext.Provider
        value={{
          input: payload ?? null,
          analysis,
          begin: NOOP,
          complete: NOOP,
          reset: NOOP,
        }}
      >
        {direct ?? <App />}
      </SessionContext.Provider>
    </StaticRouter>,
  )
}

interface Case {
  name: string
  route: string
  payload?: string
  expect: string[]
  /** Render this instead of <App>, used for lazily loaded routes. */
  direct?: ReactElement
}

const CASES: Case[] = [
  {
    name: 'Home',
    route: '/',
    expect: [
      'Secure Every UPI Payment',
      'Scan QR',
      'Check Payment Link',
      'Verify UPI ID',
      'UPI Suraksha',
      'Flag of India',
      'ticker__track',
      'Never share your UPI PIN',
    ],
  },
  {
    name: 'Scan QR',
    route: '/scan',
    expect: ['Scan a UPI QR code', 'Upload QR image', 'Scan QR'],
    direct: <ScanScreen />,
  },
  { name: 'Payment link', route: '/link', expect: ['Check a payment link', 'Payment URL'] },
  { name: 'UPI ID', route: '/upi', expect: ['Verify a UPI ID', 'merchant@okaxis'] },
  { name: '404', route: '/nope', expect: ['not part of the service'] },
  {
    name: 'Report (high risk, 91)',
    route: '/report',
    payload: HIGH,
    expect: ['>91<', 'Transaction context', 'Suspicious indicators', 'kycverify.pending@ybl', 'Matches known fraud patterns'],
  },
  {
    name: 'Report (low risk, 0)',
    route: '/report',
    payload: LOW,
    expect: ['>0<', 'No significant fraud indicators found', 'Verified'],
  },
  {
    name: 'Alert (high risk)',
    route: '/decision',
    payload: HIGH,
    expect: ['Payment Risk Detected', 'Block payment', 'Verify again', 'Why this payment is suspicious'],
  },
  {
    name: 'Alert (low risk)',
    route: '/decision',
    payload: LOW,
    expect: ['Payment appears safe', 'Continue'],
  },
]

let failures = 0
for (const testCase of CASES) {
  try {
    const html = render(testCase.route, testCase.payload, testCase.direct)
    const missing = testCase.expect.filter((needle) => !html.includes(needle))
    if (missing.length) {
      failures += 1
      console.log(`FAIL  ${testCase.name} - missing: ${missing.join(', ')}`)
    } else {
      console.log(`ok    ${testCase.name} (${html.length} chars)`)
    }
  } catch (error) {
    failures += 1
    console.log(`FAIL  ${testCase.name} - ${(error as Error).message}`)
  }
}

console.log(failures === 0 ? '\nAll routes render.' : `\n${failures} route(s) failed.`)
process.exit(failures === 0 ? 0 : 1)

