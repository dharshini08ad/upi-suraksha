import {
  HIGH_RISK_TLDS,
  KNOWN_HANDLES,
  domainMatches,
  isShortener,
  isTrustedGateway,
  looksNumericHandle,
  lower,
  matchingTokens,
} from './knowledge'
import { BRAND } from './brand'
import { parseInput } from './parse'
import type {
  Analysis,
  CheckCategory,
  CheckResult,
  CheckStatus,
  Finding,
  InputKind,
  ParsedInput,
  Recommendation,
  RiskBand,
} from './types'

export const ENGINE_VERSION = BRAND.ruleset

const LOW_MAX = 24
const MEDIUM_MAX = 59

/** Domains that genuinely belong to the institutions the tokens refer to. */
const OFFICIAL_DOMAINS: { token: string; domain: string; label: string }[] = [
  { token: 'rbi', domain: 'rbi.org.in', label: 'Reserve Bank of India' },
  { token: 'npci', domain: 'npci.org.in', label: 'NPCI' },
  { token: 'uidai', domain: 'uidai.gov.in', label: 'UIDAI' },
  { token: 'aadhaar', domain: 'uidai.gov.in', label: 'UIDAI' },
  { token: 'incometax', domain: 'incometax.gov.in', label: 'Income Tax Department' },
  { token: 'epfo', domain: 'epfindia.gov.in', label: 'EPFO' },
  { token: 'esic', domain: 'esic.gov.in', label: 'ESIC' },
  { token: 'cyber', domain: ' cybercrime.gov.in', label: 'Cyber Crime Cell' },
]

/** Words that indicate the note is giving instructions rather than describing a bill. */
const INSTRUCTION_WORDS = [
  'click',
  'scan',
  'share',
  'send',
  'open the link',
  'tap',
  'enter',
  'submit',
  'complete the',
  'install',
  'download',
  'call',
  'whatsapp',
]

const SENSITIVE_WORDS = ['otp', 'pin', 'cvv', 'password', 'mpin', 'atm pin', 'aadhaar number', 'pan number', 'card number']

/** Notes that reference nothing, so they cannot be tied back to a real purchase. */
const GENERIC_NOTES = [
  'pay now',
  'pay',
  'payment',
  'upi',
  'upi payment',
  'send money',
  'transfer',
  'transfer money',
  'done',
  'thanks',
  'thank you',
  'amount',
]

const BANK_TOKENS = ['sbi', 'icici', 'hdfc', 'axis', 'paytm', 'ybl', 'bank', 'kotak', 'yes bank', 'indusind']

/* ------------------------------------------------------------------
   Finding collector
   ------------------------------------------------------------------ */

class Findings {
  private items: Finding[] = []

  add(
    category: CheckCategory,
    weight: number,
    severity: Finding['severity'],
    source: string,
    text: string,
  ) {
    if (weight <= 0) return
    this.items.push({ category, weight, severity, source, text })
  }

  critical(category: CheckCategory, weight: number, source: string, text: string) {
    this.add(category, weight, 'critical', source, text)
  }

  warn(category: CheckCategory, weight: number, source: string, text: string) {
    this.add(category, weight, 'warning', source, text)
  }

  info(category: CheckCategory, weight: number, source: string, text: string) {
    this.add(category, weight, 'info', source, text)
  }

  for(category: CheckCategory): Finding[] {
    return this.items.filter((f) => f.category === category)
  }

  all(): Finding[] {
    return this.items
  }

  total(): number {
    return this.items.reduce((sum, f) => sum + f.weight, 0)
  }
}

function analyseUrlDomain(p: ParsedInput, out: Findings) {
  if (!p.host) {
    out.info('url', 0, 'Domain', 'No web address was submitted, so domain checks were not applicable.')
    return
  }

  if (p.hostIsIp) {
    out.critical(
      'url',
      30,
      'Domain',
      `The link points directly at the server address ${p.host} instead of a registered domain.`,
    )
  }

  if (p.hostHasHomoglyphs) {
    out.critical(
      'url',
      25,
      'Domain',
      'The address mixes alphabets, so letters that look identical are not the same characters.',
    )
  }

  if (lower(p.host).includes('xn--')) {
    out.critical('url', 20, 'Domain', 'The address is punycode-encoded, commonly used to reproduce official domains.')
  }

  if (p.scheme === 'http') {
    out.warn('url', 12, 'Transport', 'The link is not encrypted. Payment links must use https.')
  }

  const shortener = isShortener(p.host)
  if (shortener) {
    out.warn(
      'url',
      18,
      'Redirect',
      `The link was shortened with ${shortener}, so the real destination is hidden behind a redirect.`,
    )
  }

  const tld = HIGH_RISK_TLDS.find((t) => p.host!.endsWith(t))
  if (tld) {
    out.warn('url', 12, 'TLD', `The domain ends in ${tld}, a suffix heavily used for short-lived fraud sites.`)
  }

  const official = OFFICIAL_DOMAINS.find(
    (o) => p.host!.includes(o.token) && !domainMatches(p.registrableDomain ?? '', o.domain),
  )
  if (official) {
    out.critical(
      'url',
      20,
      'Impersonation',
      `The address uses the ${official.label} name but is not on ${official.domain}, the only official domain.`,
    )
  }

  if (p.subdomainDepth >= 3) {
    out.warn(
      'url',
      8,
      'Domain',
      'The address has four or more parts, a common way of burying the real domain out of sight.',
    )
  }

  const trusted = isTrustedGateway(p.host)
  if (trusted) {
    out.info('url', 0, 'Domain', `The link is hosted on ${trusted}, a registered bank or payment gateway domain.`)
  }
}

function analyseVpa(p: ParsedInput, out: Findings) {
  if (!p.upiId || !p.handle) {
    out.critical('vpa', 26, 'UPI ID', 'No valid UPI ID could be read from this request.')
    return
  }

  if (!/^[a-z0-9._-]{2,64}$/.test(p.handle)) {
    out.warn('vpa', 12, 'UPI ID', 'The UPI ID contains characters that the UPI specification does not allow.')
  }

  if (looksNumericHandle(p.handle)) {
    out.critical('vpa', 18, 'UPI ID', 'The payee handle is a number only, a pattern seen in throwaway accounts.')
  }

  if (p.handle.length > 32) {
    out.warn('vpa', 8, 'UPI ID', `The payee handle is unusually long at ${p.handle.length} characters.`)
  }

  if (!p.handleKnown) {
    for (const bank of BANK_TOKENS) {
      if (p.handle.includes(bank)) {
        out.critical(
          'vpa',
          18,
          'Impersonation',
          `The UPI ID imitates ${KNOWN_HANDLES[p.handle] ?? 'a bank'} but is not operated by it.`,
        )
        break
      }
    }

    const tokens = matchingTokens(p.handle).slice(0, 2)
    for (const token of tokens) {
      const text = `The payee handle contains "${token.token}", the signature of a scam posing as ${token.label}.`
      if (token.critical) out.critical('vpa', 8, 'Impersonation', text)
      else out.warn('vpa', 8, 'Impersonation', text)
    }

    if (tokens.length >= 2) {
      out.critical(
        'vpa',
        12,
        'Impersonation',
        'Two or more official-sounding keywords are combined in one handle. Registered merchants do not use handles built this way.',
      )
    }

    out.warn(
      'vpa',
      12,
      'Directory',
      'The payee handle is not on the verified beneficiary list and could not be matched to a registered merchant.',
    )

    // Real merchant handles are short names, not stacks of keywords.
    if (p.handle.split('.').length >= 3) {
      out.warn(
        'vpa',
        10,
        'Handle structure',
        `The payee handle is assembled from ${p.handle.split('.').length} separate keyword segments rather than a merchant name.`,
      )
    }
  }

  if (p.bankSuffix && !KNOWN_HANDLES[p.bankSuffix]) {
    out.info('vpa', 6, 'Settlement', `The settlement suffix @${p.bankSuffix} is not a recognised bank suffix.`)
  }
}

function analyseRecipient(p: ParsedInput, out: Findings) {
  if (!p.payeeName) {
    out.warn(
      'recipient',
      10,
      'Payee name',
      'No payee name was declared, so your UPI app will only display the bare UPI ID.',
    )
    return
  }

  const official = OFFICIAL_DOMAINS.find((o) => p.payeeName!.toLowerCase().includes(o.token))
  if (official && !p.handleKnown) {
    out.critical(
      'recipient',
      20,
      'Payee name',
      `The payee name claims to be ${official.label}. No merchant or bank may collect UPI payments under that name.`,
    )
  } else if (!official) {
    const token = matchingTokens(p.payeeName)[0]
    if (token) {
      out.warn(
        'recipient',
        8,
        'Payee name',
        `The payee name mentions ${token.label}, which is not part of a normal merchant name.`,
      )
    }
  }

  if (p.handle) {
    const nameKey = p.payeeName.toLowerCase().replace(/[^a-z0-9]/g, '')
    const handleKey = p.handle.replace(/[^a-z0-9]/g, '')
    if (nameKey && handleKey && nameKey !== handleKey) {
      const overlaps = nameKey.includes(handleKey) || handleKey.includes(nameKey)
      if (!overlaps) {
        out.warn(
          'recipient',
          8,
          'Name match',
          `The declared name "${p.payeeName}" does not correspond to the payee handle "${p.handle}".`,
        )
      }
    }
  }
}

function analyseQr(p: ParsedInput, out: Findings) {
  if (p.kind !== 'QR') return

  for (const error of p.parseErrors) {
    if (/truncated/i.test(error)) {
      out.critical('qr', 20, 'QR integrity', 'The QR payload is cut off and cannot be read in full.')
    } else if (/not a standard UPI collect request/i.test(error)) {
      out.warn('qr', 12, 'QR integrity', 'The QR does not raise a native UPI request and redirects through a page.')
    } else {
      out.critical('qr', 18, 'QR integrity', error)
    }
  }

  if (!p.merchantCode) {
    out.info(
      'qr',
      3,
      'Merchant code',
      'No merchant category code was embedded, so the merchant type could not be cross-checked.',
    )
  }
}

function analyseContext(p: ParsedInput, out: Findings) {
  if (p.amount === null) {
    out.warn('context', 10, 'Amount', 'No amount is attached, so you would enter it yourself after approving.')
  } else if (p.amount > 0 && p.amount <= 1) {
    out.critical(
      'context',
      20,
      'Amount',
      `A token amount of \u20b9${p.amount.toFixed(2)} is the standard bait used to trigger a small authorisation.`,
    )
  } else if (p.amount >= 50000) {
    out.warn('context', 10, 'Amount', 'This is a high-value request. Large transfers are harder to reverse.')
  }

  const note = lower(p.note)
  if (note) {
    const sensitive = SENSITIVE_WORDS.find((w) => note.includes(w))
    if (sensitive) {
      out.critical(
        'context',
        20,
        'Payment note',
        `The note asks for your ${sensitive.toUpperCase()}. No merchant or bank ever needs this to take a UPI payment.`,
      )
    }
    const instruction = INSTRUCTION_WORDS.find((w) => note.includes(w))
    if (instruction) {
      out.warn(
        'context',
        12,
        'Payment note',
        'The note carries instructions to act, which is how payment-redirect fraud is set up.',
      )
    } else if (GENERIC_NOTES.includes(note.replace(/[.!]/g, '').trim())) {
      out.warn(
        'context',
        8,
        'Payment note',
        'The note carries no bill, invoice or order reference, so it cannot be tied to a purchase.',
      )
    }
  }

  if (p.currency && p.currency.toUpperCase() !== 'INR') {
    out.warn('context', 8, 'Currency', `The request is denominated in ${p.currency} rather than INR.`)
  }

  if (p.kind === 'LINK' && !p.isUpiIntent) {
    out.warn('context', 10, 'Delivery', 'The payment is routed through a web page instead of a native UPI request.')
  }
}

/* ------------------------------------------------------------------
   Presentation of results
   ------------------------------------------------------------------ */

const CHECK_META: Record<CheckCategory, { label: string; pass: string; na: string }> = {
  recipient: {
    label: 'Recipient verification',
    pass: 'The declared payee name is consistent with the payee handle behind it.',
    na: 'No payee name was supplied with this request.',
  },
  vpa: {
    label: 'UPI ID verification',
    pass: 'The UPI ID is well formed and its handle is held by a known payment provider.',
    na: 'No UPI ID was present to verify.',
  },
  qr: {
    label: 'QR authenticity',
    pass: 'The code is a complete, native UPI collect request with a merchant reference.',
    na: 'This was not submitted as a QR code, so authenticity could not be assessed.',
  },
  url: {
    label: 'URL / domain safety',
    pass: 'The address is an encrypted link on a registered payment or bank domain.',
    na: 'No web address was submitted, so domain checks were not applicable.',
  },
  context: {
    label: 'Transaction context',
    pass: 'The amount and payment note are consistent with an ordinary purchase.',
    na: 'Not enough transaction detail was submitted.',
  },
}

const CATEGORY_REASON_TITLE: Record<CheckCategory, string> = {
  recipient: 'Payee identity',
  vpa: 'UPI ID',
  qr: 'QR code',
  url: 'Link and domain',
  context: 'Payment request',
}

const SEVERITY_ORDER: Record<Finding['severity'], number> = { critical: 0, warning: 1, info: 2 }

export function bandFor(score: number): RiskBand {
  if (score <= LOW_MAX) return 'LOW'
  if (score <= MEDIUM_MAX) return 'MEDIUM'
  return 'HIGH'
}

export function recommendationFor(band: RiskBand): Recommendation {
  if (band === 'HIGH') return 'BLOCK'
  if (band === 'MEDIUM') return 'VERIFY'
  return 'ALLOW'
}

export const BAND_COPY: Record<
  RiskBand,
  { label: string; headline: string; summary: string; badge: string }
> = {
  LOW: {
    label: 'Low risk',
    headline: 'No significant fraud indicators found',
    summary:
      'The payee, the address and the amount all match the pattern of an ordinary merchant request. Confirm the name and amount shown in your UPI app before approving.',
    badge: 'Allow',
  },
  MEDIUM: {
    label: 'Medium risk',
    headline: 'Verify the payee before you approve',
    summary:
      'One or more signals could not be confirmed against the verification records. Confirm this request with the merchant using a contact number you already hold.',
    badge: 'Verify',
  },
  HIGH: {
    label: 'High risk',
    headline: 'Matches known fraud patterns',
    summary:
      'This request reproduces the structure of UPI impersonation and payment-redirect fraud. Do not approve it, and do not share any PIN, OTP or card detail.',
    badge: 'Block',
  },
}

function statusFor(findings: Finding[], notApplicable: boolean): CheckStatus {
  if (notApplicable) return 'NA'
  if (findings.some((f) => f.severity === 'critical')) return 'FAIL'
  if (findings.some((f) => f.severity === 'warning')) return 'REVIEW'
  return 'PASS'
}

function buildCheck(
  id: CheckCategory,
  findings: Finding[],
  parsed: ParsedInput,
): CheckResult {
  const meta = CHECK_META[id]
  const notApplicable =
    id === 'qr'
      ? parsed.kind !== 'QR'
      : id === 'url'
        ? !parsed.host
        : id === 'recipient'
          ? !parsed.payeeName && !parsed.upiId
          : false

  const sorted = [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  const points = findings.reduce((sum, f) => sum + f.weight, 0)
  const status = statusFor(sorted, notApplicable)

  let detail: string
  if (notApplicable) detail = meta.na
  else if (sorted.length === 0) detail = meta.pass
  else if (sorted.length === 1) detail = sorted[0].text
  else detail = `${sorted[0].text} ${sorted.length - 1} further point${sorted.length > 2 ? 's' : ''} raised.`

  return { id, label: meta.label, status, detail, points, findings: sorted }
}

function makeReference(seed: string): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}`
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return `UK-${stamp}-${hash.toString(36).toUpperCase().padStart(6, '0').slice(0, 6)}`
}

/**
 * Run the full verification pipeline over a submitted payload.
 * Deterministic: the same input always produces the same score and findings.
 */
export function analyse(rawInput: string): Analysis {
  const parsed = parseInput(rawInput)
  const out = new Findings()

  analyseUrlDomain(parsed, out)
  analyseVpa(parsed, out)
  analyseRecipient(parsed, out)
  analyseQr(parsed, out)
  analyseContext(parsed, out)

  const score = Math.max(0, Math.min(100, out.total()))
  const band = bandFor(score)

  const checks: CheckResult[] = [
    buildCheck('recipient', out.for('recipient'), parsed),
    buildCheck('vpa', out.for('vpa'), parsed),
    buildCheck('qr', out.for('qr'), parsed),
    buildCheck('url', out.for('url'), parsed),
    buildCheck('context', out.for('context'), parsed),
  ]

  const indicators = out
    .all()
    .filter((f) => f.severity !== 'info')
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.weight - a.weight)

  const reasons = indicators.slice(0, 5).map((f) => ({
    title: CATEGORY_REASON_TITLE[f.category],
    text: f.text,
  }))

  const copy = BAND_COPY[band]

  return {
    reference: makeReference(parsed.raw),
    engineVersion: ENGINE_VERSION,
    createdAt: new Date().toISOString(),
    parsed,
    score,
    band,
    recommendation: recommendationFor(band),
    headline: copy.headline,
    summary: copy.summary,
    checks,
    indicators,
    reasons,
  }
}

export function kindLabel(kind: InputKind): string {
  switch (kind) {
    case 'QR':
      return 'Scanned QR code'
    case 'LINK':
      return 'Payment link'
    case 'UPI_ID':
      return 'UPI ID'
    default:
      return 'Submission'
  }
}




