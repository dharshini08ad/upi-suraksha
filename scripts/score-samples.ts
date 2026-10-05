/**
 * Prints the score the engine assigns to every bundled sample.
 * Run with: npm run scorecheck
 */
import { writeFileSync } from 'node:fs'
import { SAMPLES } from '../src/data/samples'
import { analyse } from '../src/lib/riskEngine'
import type { RiskBand } from '../src/lib/types'

const pad = (v: string | number, n: number) => String(v).padEnd(n)

const lines: string[] = []
const say = (s = '') => lines.push(s)

say('')
say(pad('SAMPLE', 28) + pad('BAND', 9) + pad('SCORE', 7) + 'EXPECTED')
say('-'.repeat(58))

let failures = 0

for (const sample of SAMPLES) {
  const result = analyse(sample.payload)
  const ok = result.band === (sample.expected as RiskBand)
  if (!ok) failures += 1
  say(pad(sample.name, 28) + pad(result.band, 9) + pad(`${result.score}/100`, 7) + sample.expected + (ok ? '' : '   <-- MISMATCH'))
  for (const check of result.checks) {
    if (check.status !== 'PASS') {
      say('    ' + pad(check.label, 28) + pad(check.status, 8) + '+' + check.points)
    }
  }
}

say('-'.repeat(58))
say(failures === 0 ? 'All samples land in the expected band.' : `${failures} sample(s) off band.`)

const report = lines.join('\n')
console.log(report)
writeFileSync('score-report.txt', report + '\n', 'utf8')
process.exit(failures === 0 ? 0 : 1)
