import {
  detectKind,
  hasNonAscii,
  isIpHost,
  isTrustedGateway,
  lower,
  normalise,
  parseUpiId,
  registrableDomain,
} from './knowledge'
import type { ParsedInput } from './types'

/** Read `upi://pay?a=1&b=2` style parameter strings. */
function readParams(query: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!query) return out
  const body = query.replace(/^\?/, '')
  for (const pair of body.split(/[&;]/)) {
    if (!pair) continue
    const eq = pair.indexOf('=')
    const rawKey = eq === -1 ? pair : pair.slice(0, eq)
    const rawVal = eq === -1 ? '' : pair.slice(eq + 1)
    try {
      const key = decodeURIComponent(rawKey).trim().toLowerCase()
      const val = decodeURIComponent(rawVal.replace(/\+/g, ' ')).trim()
      if (key) out[key] = val
    } catch {
      /* malformed percent-encoding — ignore this pair */
    }
  }
  return out
}

function toAmount(value: string | undefined): number | null {
  if (!value) return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Some collect links bury the VPA in the path instead of a `pa` parameter. */
function scrapeVpa(text: string): string | null {
  const m = text.match(/[A-Za-z0-9][A-Za-z0-9._-]{1,48}@[A-Za-z0-9][A-Za-z0-9-]{1,24}/)
  return m ? m[0] : null
}

/**
 * Turn anything the user submits — QR payload, payment URL or a bare VPA —
 * into one normalised record the risk engine can reason about.
 */
export function parseInput(rawInput: string): ParsedInput {
  const raw = normalise(rawInput)
  const kind = detectKind(raw)
  const parseErrors: string[] = []

  const base: ParsedInput = {
    kind,
    raw,
    payload: raw,
    upiId: null,
    handle: null,
    bankSuffix: null,
    bankName: null,
    handleKnown: false,
    payeeName: null,
    amount: null,
    amountRaw: null,
    currency: null,
    note: null,
    merchantCode: null,
    url: null,
    host: null,
    registrableDomain: null,
    hostIsIp: false,
    scheme: null,
    hostHasHomoglyphs: false,
    subdomainDepth: 0,
    isUpiIntent: false,
    parseErrors,
  }

  /* ---------- bare UPI ID ---------- */
  if (kind === 'UPI_ID') {
    const vpa = parseUpiId(raw)
    return { ...base, ...vpa, isUpiIntent: false }
  }

  /* ---------- UPI intent payload (QR) ---------- */
  if (kind === 'QR') {
    const qIndex = raw.indexOf('?')
    const head = qIndex === -1 ? raw : raw.slice(0, qIndex)
    const params = readParams(qIndex === -1 ? '' : raw.slice(qIndex + 1))

    if (!/^upi:\/\/pay$/i.test(head)) {
      parseErrors.push('QR payload is not a standard UPI collect request.')
    }
    if (!params.pa) {
      parseErrors.push('QR payload carries no payee address (pa).')
    }
    if (qIndex === -1) {
      parseErrors.push('QR payload is truncated — no query parameters found.')
    }

    const vpa = parseUpiId(params.pa ?? '')
    if (params.pa && !vpa.upiId) {
      parseErrors.push('Payee address inside the QR is not a valid UPI ID.')
    }

    return {
      ...base,
      ...vpa,
      isUpiIntent: true,
      payeeName: params.pn || null,
      amount: toAmount(params.am),
      amountRaw: params.am || null,
      currency: params.cu || null,
      note: params.tn || params.tr || null,
      merchantCode: params.mc || null,
    }
  }

  /* ---------- payment link ---------- */
  let url: URL | null = null
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    parseErrors.push('This does not look like a valid web address.')
  }

  if (!url) {
    const vpa = parseUpiId(scrapeVpa(raw) ?? '')
    return { ...base, ...vpa }
  }

  const host = url.hostname.toLowerCase()
  const domain = registrableDomain(host)
  const params = readParams(url.search)
  const decoded = normalise(decodeURIComponent(url.href))
  const embeddedUpi = decoded.match(/upi:\/\/pay\?[^"'\\s]+/i)

  const vpaSource = params.pa ?? (embeddedUpi ? readParams(embeddedUpi[0].split('?')[1] ?? '').pa : null) ?? scrapeVpa(decoded)
  const vpa = parseUpiId(vpaSource ?? '')

  if (!vpa.upiId) {
    parseErrors.push('The link does not contain a UPI payee address.')
  }

  const labelCount = host ? host.split('.').length : 0
  const subdomainDepth = domain ? Math.max(0, labelCount - domain.split('.').length) : 0

  return {
    ...base,
    ...vpa,
    isUpiIntent: Boolean(embeddedUpi),
    payeeName: params.pn || params.merchant || params.name || null,
    amount: toAmount(params.am ?? params.amount),
    amountRaw: params.am ?? params.amount ?? null,
    currency: params.cu || params.currency || null,
    note: params.tn || params.note || params.tr || null,
    merchantCode: params.mc || null,
    url: raw,
    host,
    registrableDomain: domain,
    hostIsIp: isIpHost(host),
    scheme: url.protocol.replace(':', ''),
    hostHasHomoglyphs: hasNonAscii(url.hostname),
    subdomainDepth,
  }
}

export function describeGateway(host: string | null): string | null {
  return host ? isTrustedGateway(host) : null
}

export function formatAmount(amount: number | null): string {
  if (amount === null) return 'Not specified'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatVpaLabel(parsed: ParsedInput): string {
  if (parsed.upiId) return parsed.upiId
  if (parsed.host) return parsed.host
  return lower(parsed.raw)
}
