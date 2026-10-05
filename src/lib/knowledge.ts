import type { InputKind } from './types'

/* ------------------------------------------------------------------
   Reference data
   ------------------------------------------------------------------ */

/** Known-good VPA handles mapped to the institution that operates them. */
export const KNOWN_HANDLES: Record<string, string> = {
  ybl: 'Paytm Payments Bank',
  paytm: 'Paytm Payments Bank',
  paytmmp: 'Paytm Payments Pvt Ltd',
  aplaxaxis: 'Axis Bank (Amazon Pay UPI)',
  amazonpay: 'Axis Bank (Amazon Pay UPI)',
  okaxis: 'Axis Bank',
  okicici: 'ICICI Bank',
  icici: 'ICICI Bank',
  oksbi: 'State Bank of India',
  sbi: 'State Bank of India',
  onlinesbi: 'State Bank of India',
  okhdfcbank: 'HDFC Bank',
  hdfcbank: 'HDFC Bank',
  hdfc: 'HDFC Bank',
  yessbank: 'Yes Bank',
  ibl: 'IndusInd Bank',
  upi: 'NPCI (UPI)',
  phonepe: 'PhonePe',
  googlepay: 'Google Pay',
  cred: 'CRED',
  freecharge: 'Freecharge',
  slice: 'Slice Technologies',
  khatabook: 'Khatabook',
  getsimpl: 'Simpl',
  bajaj: 'Bajaj Finserv',
}

/** Domains operated by banks, PSPs and NPCI that are allowed to collect payments. */
export const TRUSTED_GATEWAY_DOMAINS: string[] = [
  'npci.org.in',
  'npci.org',
  'paytm.in',
  'paytm.com',
  'phonepe.com',
  'phonepe.in',
  'gpay.app.goo.gl',
  'razorpay.com',
  'billdesk.com',
  'ccavenue.com',
  'axisbank.com',
  'axisbank.co.in',
  'icici.com',
  'icicibank.com',
  'onlinesbi.com',
  'hdfcbank.com',
  'hsbc.co.in',
  'kotak.com',
  'yesbank.com',
  'indusind.com',
  'federalbank.co.in',
  'airtelpay.in',
  'amazon.in',
  'amazon.com',
]

/** TLDs disproportionately used for throwaway fraud infrastructure. */
export const HIGH_RISK_TLDS: string[] = [
  '.xyz',
  '.top',
  '.click',
  '.link',
  '.buzz',
  '.icu',
  '.shop',
  '.live',
  '.online',
  '.site',
  '.fun',
  '.rest',
  '.monster',
  '.quest',
  '.cfd',
  '.sbs',
  '.cyou',
  '.lol',
]

/** Public URL shorteners hide the true destination behind a redirect. */
export const URL_SHORTENERS: string[] = [
  'bit.ly',
  'tinyurl.com',
  't.co',
  'cutt.ly',
  'is.gd',
  'tiny.cc',
  'rb.gy',
  'rebrand.ly',
  'shorturl.at',
  'short.link',
  'lnkd.in',
  't.ly',
  'wa.link',
]

/**
 * Words fraudsters put in domains, links and UPI handles to look official.
 * Matching any of these outside a trusted domain is a strong red flag.
 */
export const IMPERSONATION_TOKENS: { token: string; label: string; critical?: boolean }[] = [
  { token: 'rbi', label: 'Reserve Bank of India' },
  { token: 'reservebank', label: 'Reserve Bank of India' },
  { token: 'npci', label: 'NPCI' },
  { token: 'uidai', label: 'UIDAI / Aadhaar' },
  { token: 'aadhaar', label: 'UIDAI / Aadhaar', critical: true },
  { token: 'incometax', label: 'Income Tax Department' },
  { token: 'epfo', label: 'EPFO' },
  { token: 'esic', label: 'ESIC' },
  { token: 'cyber', label: 'Cyber Crime Cell' },
  { token: 'police', label: 'Law Enforcement' },
  { token: 'court', label: 'Court / Legal Notice' },
  { token: 'govt', label: 'Government of India' },
  { token: 'government', label: 'Government of India' },
  { token: 'sarkar', label: 'Government of India' },
  { token: 'kyc', label: 'KYC verification' },
  { token: 'netbanking', label: 'Net banking' },
  { token: 'otp', label: 'OTP' },
  { token: 'pin', label: 'UPI PIN' },
  { token: 'cvv', label: 'Card CVV', critical: true },
  { token: 'refund', label: 'Refund' },
  { token: 'prize', label: 'Prize / Lottery' },
  { token: 'lottery', label: 'Prize / Lottery' },
  { token: 'reward', label: 'Reward' },
  { token: 'bonus', label: 'Bonus' },
  { token: 'giftcard', label: 'Gift card' },
  { token: 'cashback', label: 'Cashback' },
  { token: 'subsidy', label: 'Subsidy / Scheme' },
  { token: 'pension', label: 'Pension' },
  { token: 'customer', label: 'Customer care' },
  { token: 'care', label: 'Customer care' },
  { token: 'support', label: 'Support desk' },
  { token: 'helpline', label: 'Helpline' },
  { token: 'verify', label: 'Verification' },
  { token: 'update', label: 'Account update' },
  { token: 'secure', label: 'Secure login' },
  { token: 'login', label: 'Login page', critical: true },
  { token: 'account', label: 'Bank account' },
  { token: 'confirm', label: 'Confirmation request' },
]

const NUMERIC_HANDLE = /^\d+$/

const MULTI_PART_SUFFIXES = [
  'co.in',
  'net.in',
  'org.in',
  'gen.in',
  'firm.in',
  'ind.in',
  'gov.in',
  'ac.in',
  'edu.in',
  'res.in',
  'com.au',
  'co.uk',
  'co.nz',
  'com.br',
  'co.jp',
  'co.za',
]

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

/* ------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------ */

export function lower(v: string | null | undefined): string {
  return (v ?? '').toLowerCase()
}

export function normalise(raw: string): string {
  return raw.replace(/\u00a0/g, ' ').replace(/&amp;/g, '&').trim()
}

export function detectKind(raw: string): InputKind {
  const v = normalise(raw)
  if (/^upi:\/\//i.test(v)) return 'QR'
  if (/^https?:\/\//i.test(v)) return 'LINK'
  if (/^[^\s@]+@[^\s@]+$/.test(v)) return 'UPI_ID'
  // A bare domain with a path is still a link.
  if (/^[\w-]+(\.[\w-]+)+\//i.test(v)) return 'LINK'
  return 'QR'
}

export function registrableDomain(host: string): string | null {
  if (!host) return null
  const labels = host.toLowerCase().replace(/^\.+|\.+$/g, '').split('.')
  if (labels.length < 2) return labels.join('.') || null
  const lastTwo = labels.slice(-2).join('.')
  if (MULTI_PART_SUFFIXES.includes(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join('.')
  }
  return lastTwo
}

export function domainMatches(host: string, domain: string): boolean {
  const h = lower(host)
  const d = lower(domain)
  return h === d || h.endsWith('.' + d)
}

export function isTrustedGateway(host: string): string | null {
  const clean = lower(host).replace(/:\d+$/, '')
  for (const allowed of TRUSTED_GATEWAY_DOMAINS) {
    if (domainMatches(clean, allowed)) return allowed
  }
  return null
}

export function isShortener(host: string): string | null {
  const clean = lower(host).replace(/:\d+$/, '')
  for (const s of URL_SHORTENERS) {
    if (domainMatches(clean, s)) return s
  }
  return null
}

export function matchingTokens(haystack: string) {
  const h = lower(haystack)
  return IMPERSONATION_TOKENS.filter((t) => h.includes(t.token))
}

export function hasNonAscii(value: string): boolean {
  return /[^\u0000-\u007F]/.test(value)
}

export function looksNumericHandle(handle: string): boolean {
  return NUMERIC_HANDLE.test(handle)
}

export function isIpHost(host: string): boolean {
  return IPV4.test(host)
}

export function parseUpiId(value: string): {
  upiId: string | null
  handle: string | null
  bankSuffix: string | null
  bankName: string | null
  handleKnown: boolean
} {
  const raw = value.trim()
  const at = raw.lastIndexOf('@')
  if (at <= 0 || at === raw.length - 1) {
    return {
      upiId: null,
      handle: null,
      bankSuffix: null,
      bankName: null,
      handleKnown: false,
    }
  }
  const handle = raw.slice(0, at).toLowerCase()
  const bankSuffix = raw.slice(at + 1).toLowerCase()
  const bankName = KNOWN_HANDLES[handle] ?? KNOWN_HANDLES[bankSuffix] ?? null
  return {
    upiId: raw,
    handle,
    bankSuffix,
    bankName,
    handleKnown: Boolean(KNOWN_HANDLES[handle]),
  }
}

