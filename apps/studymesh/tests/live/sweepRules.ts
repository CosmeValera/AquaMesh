/* eslint-disable no-undef, no-console, @typescript-eslint/no-explicit-any */
// Offline sweep. Reads the raw pair data a live run saved and scores candidate
// strength rules against it, so thresholds cost no model calls to tune.
//   npx tsx apps/studymesh/tests/live/sweepRules.ts <raw.json>
import { readFileSync } from 'node:fs'

interface Pair {
  kind: 'part' | 'process'
  isConcrete: boolean
  passesSwapTest: boolean
}

interface Row {
  name: string
  group: string
  ok: boolean
  selected: string[]
  expect: string
  correspondences: Pair[]
}

const rows: Row[] = JSON.parse(
  readFileSync(process.argv[2], 'utf8'),
).filter((row: Row) => row.ok)

type Basis = 'all' | 'concrete' | 'swap' | 'both'

const counts = (pairs: Pair[], basis: Basis) => {
  const kept = pairs.filter((pair) =>
    basis === 'all'
      ? true
      : basis === 'concrete'
      ? pair.isConcrete
      : basis === 'swap'
      ? pair.passesSwapTest
      : pair.isConcrete && pair.passesSwapTest,
  )

  return { total: kept.length, process: kept.filter((p) => p.kind === 'process').length }
}

const strengthOf = (
  row: Row,
  basis: Basis,
  minPairs: number,
  minProcess: number,
): 'strong' | 'weak' | 'none' => {
  if (!row.selected.length || !row.correspondences.length) {
    return 'none'
  }

  const { total, process } = counts(row.correspondences, basis)
  return total >= minPairs && process >= minProcess ? 'strong' : 'weak'
}

const labelled = rows.filter((row) => row.expect === 'strong' || row.expect === 'weak')

console.log(`rows=${rows.length} labelled=${labelled.length}\n`)
console.log(
  'basis      pairs proc | strong%  labelled-correct  misses',
)

const results: Array<{
  key: string
  strongPct: number
  correct: number
  misses: string[]
}> = []

for (const basis of ['all', 'concrete', 'swap', 'both'] as Basis[]) {
  for (const minPairs of [2, 3, 4, 5, 6]) {
    for (const minProcess of [0, 1, 2]) {
      const strong = rows.filter(
        (row) => strengthOf(row, basis, minPairs, minProcess) === 'strong',
      ).length
      const misses = labelled
        .filter(
          (row) => strengthOf(row, basis, minPairs, minProcess) !== row.expect,
        )
        .map((row) => `${row.name}→${strengthOf(row, basis, minPairs, minProcess)}`)
      const strongPct = Math.round((100 * strong) / rows.length)
      results.push({
        key: `${basis} ${minPairs} ${minProcess}`,
        strongPct,
        correct: labelled.length - misses.length,
        misses,
      })
      console.log(
        `${basis.padEnd(10)} ${String(minPairs).padStart(5)} ${String(
          minProcess,
        ).padStart(4)} | ${String(strongPct).padStart(6)}%  ${String(
          labelled.length - misses.length,
        ).padStart(3)}/${labelled.length}            ${misses.length}`,
      )
    }
  }
}

// Target band is 60-80% strong with every labelled case correct.
const inBand = results
  .filter((r) => r.strongPct >= 60 && r.strongPct <= 80)
  .sort((a, b) => b.correct - a.correct || a.misses.length - b.misses.length)

console.log('\n===== CANDIDATES IN THE 60-80% BAND =====')
for (const result of inBand.slice(0, 8)) {
  console.log(
    `  ${result.key.padEnd(14)} strong ${result.strongPct}%  labelled ${result.correct}  misses: ${
      result.misses.join(', ') || 'none'
    }`,
  )
}

console.log('\n===== PER-CASE under best candidate =====')
const best = inBand[0]
if (best) {
  const [basis, minPairs, minProcess] = best.key.split(' ')
  for (const row of rows) {
    const strength = strengthOf(
      row,
      basis as Basis,
      Number(minPairs),
      Number(minProcess),
    )
    const { total, process } = counts(row.correspondences, basis as Basis)
    const flag =
      row.expect !== 'either' && row.expect !== strength ? '  <-- MISS' : ''
    console.log(
      `  ${row.name.padEnd(42)} ${strength.padEnd(6)} kept=${total} proc=${process} expect=${row.expect}${flag}`,
    )
  }
}
