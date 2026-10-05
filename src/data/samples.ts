import type { InputKind, RiskBand } from '../lib/types'

export interface Sample {
  id: string
  name: string
  /** Shown under the name so the reviewer knows what the payload represents. */
  context: string
  /** Which input screen offers this sample. */
  for: InputKind
  payload: string
  expected: RiskBand
}

/**
 * Realistic payloads used for the demo. They are shaped like the strings a
 * UPI QR, a payment SMS or a "pay any merchant" link actually carry.
 */
export const SAMPLES: Sample[] = [
  {
    id: 'retailer',
    name: 'Neighbourhood retailer QR',
    context: 'Static counter QR printed at a kirana store',
    for: 'QR',
    payload:
      'upi://pay?pa=sharma.electricals@okaxis&pn=Sharma%20Electricals&am=2780.00&cu=INR&tn=Bill%20INV%2F8891&mc=5411',
    expected: 'LOW',
  },
  {
    id: 'gadget',
    name: 'Gadget store counter QR',
    context: 'QR on the bill, amount fixed by the store',
    for: 'QR',
    payload:
      'upi://pay?pa=amazonpay@aplaxaxis&pn=Amazon%20Pay&am=1249.00&cu=INR&tn=Order%20MN%2F2841993&mc=5493',
    expected: 'LOW',
  },
  {
    id: 'fuel',
    name: 'Fuel bill payment link',
    context: 'Link forwarded by a fleet operator',
    for: 'LINK',
    payload:
      'https://billdesk.axisbank.com/upi/collect?pa=bharatpetro.hub@ybl&pn=Bharat%20Petro%20Hub&am=1850.00&cu=INR&tn=Fuel%20Bill%20No%2099431',
    expected: 'LOW',
  },
  {
    id: 'trader',
    name: 'Wholesale trader link',
    context: 'Shortened link received by SMS from an unknown number',
    for: 'LINK',
    payload:
      'https://bit.ly/3xK9dUpiCollect?pa=metro.traders.singh@okhdfcbank&pn=Metro%20Traders&am=1560.00&cu=INR&tn=Pay%20now',
    expected: 'MEDIUM',
  },
  {
    id: 'canteen',
    name: 'Canteen top-up QR',
    context: 'Photo of a college canteen code re-uploaded to a group',
    for: 'QR',
    payload: 'upi://pay?pa=canteen2026@okaxis&pn=Campus%20Canteen',
    expected: 'MEDIUM',
  },
  {
    id: 'salary',
    name: 'Salary credit notice',
    context: 'Payroll link forwarded by a colleague over chat',
    for: 'LINK',
    payload:
      'https://payments.hdfcbank.co.in/upi/collect?pa=peopleops.payroll@hdfcbank&pn=Meridian%20Infotech%20Payroll&am=34500.00&cu=INR&tn=Salary%20Jun%202026%20EIS%2041',
    expected: 'MEDIUM',
  },
  {
    id: 'kyc',
    name: 'Account KYC pending QR',
    context: 'QR sent as a "customer care" message on WhatsApp',
    for: 'QR',
    payload:
      'upi://pay?pa=kycverify.pending@ybl&pn=KYC%20Verify%20Pending&am=1.00&cu=INR&tn=Your%20UPI%20PIN%20is%20required%20to%20verify',
    expected: 'HIGH',
  },
  {
    id: 'refund',
    name: 'Refund collection link',
    context: 'Link claiming to release a cashback refund',
    for: 'LINK',
    payload:
      'https://upi-refund-verify.page.link/collect?pa=refund.support@paytm&pn=Cashback%20Refund%20Desk&am=1.00&cu=INR&tn=Submit%20your%20UPI%20PIN%20to%20release%20refund',
    expected: 'HIGH',
  },
  {
    id: 'prize',
    name: 'Prize claim UPI ID',
    context: 'A bare UPI ID sent in a lottery winner message',
    for: 'UPI_ID',
    payload: 'lucky.winner.claim.rbi.kyc@ybl',
    expected: 'HIGH',
  },
]

export function samplesFor(kind: InputKind): Sample[] {
  return SAMPLES.filter((s) => s.for === kind)
}
