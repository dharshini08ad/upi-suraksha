import type { Analysis } from '../lib/types'
import { formatAmount } from '../lib/parse'
import { kindLabel } from '../lib/riskEngine'

function Row({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  const empty = value === null || value === '' || value === undefined
  return (
    <>
      <dt className="kv__dt">{label}</dt>
      <dd className={`kv__dd${mono && !empty ? ' kv__dd--mono' : ''}${empty ? ' kv__dd--empty' : ''}`}>
        {empty ? 'Not present in the request' : value}
      </dd>
    </>
  )
}

/** The payload fields the platform was able to extract from the submission. */
export function SubmittedDetails({ analysis }: { analysis: Analysis }) {
  const p = analysis.parsed

  return (
    <div className="panel">
      <div className="panel__head">
        <span className="panel__title">Extracted from the request</span>
        <span className="tag">{kindLabel(p.kind)}</span>
      </div>
      <div className="panel__body">
        <dl className="kv">
          <Row label="UPI ID" value={p.upiId} mono />
          <Row label="Merchant name" value={p.payeeName} />
          <Row label="Amount" value={p.amount === null ? null : formatAmount(p.amount)} />
          <Row label="Payment note" value={p.note} />
          <Row label="Merchant code" value={p.merchantCode} />
          <Row label="Settlement suffix" value={p.bankSuffix} mono />
          <Row label="Resolved to" value={p.bankName} />
          <Row label="Payment URL" value={p.url} mono />
          <Row label="Domain" value={p.host} mono />
          <Row label="Reference" value={analysis.reference} mono />
        </dl>
      </div>
    </div>
  )
}
