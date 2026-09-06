/* eslint-disable no-undef, no-console, @typescript-eslint/no-explicit-any */
// Prints every graded case with its pairs so both error directions can be
// judged by eye: strongs resting on mislabelled "process" pairs, and weaks
// that carry a real mapping but landed one process short.
//   npx tsx apps/studymesh/tests/live/auditPairs.ts <raw.json> [strong|weak]
import { readFileSync } from 'node:fs'

const rows = JSON.parse(readFileSync(process.argv[2], 'utf8')).filter(
  (row: any) => row.ok && row.correspondences?.length,
)
const only = process.argv[3]

const MIN_PAIRS = 4
const MIN_PROCESS = 0

for (const row of rows) {
  const pairs = row.correspondences
  const process_ = pairs.filter((p: any) => p.kind === 'process')
  const strength =
    pairs.length >= MIN_PAIRS && process_.length >= MIN_PROCESS
      ? 'strong'
      : 'weak'
  if (only && only !== strength) {
    continue
  }

  const margin =
    strength === 'strong'
      ? `+${process_.length - MIN_PROCESS} process spare`
      : `${MIN_PROCESS - process_.length} process short`

  console.log(
    `\n### ${row.name}  [${strength}] ${pairs.length} pairs, ${process_.length} process (${margin})`,
  )
  for (const pair of pairs) {
    const mark = pair.kind === 'process' ? 'P' : ' '
    console.log(
      `   ${mark} ${pair.knownSide} -> ${pair.targetSide}\n       carries: ${pair.carries}`,
    )
  }
}
