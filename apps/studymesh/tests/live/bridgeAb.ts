/* eslint-disable no-undef, no-console, @typescript-eslint/no-explicit-any */
// Live A/B: the same cases and the same model through the old rubric and the
// new mapping-based one. Costs real credits; not part of the unit suite.
//   npx tsx apps/studymesh/tests/live/bridgeAb.ts
// Env: LIVE_ARMS (old,new), LIVE_REPEATS (default 1), LIVE_EFFORT (default low).
import { readFileSync, writeFileSync } from 'node:fs'

import {
  buildMonolithGuidePrompt,
  createMonolithGuideSchema,
  toJsonSchema,
  DEFAULT_OPENAI_STUDY_GUIDE_MODEL,
} from '../../../../api/hosted-ai'
import {
  buildOldMonolithGuidePrompt,
  OLD_CONTEXT_PLAN_SCHEMA,
} from './oldMonolithPrompt'
import {
  deriveStudyGuideBridgeStrength,
  sanitizeStudyGuideBridgeCorrespondences,
} from '../../src/studyGuides/quickStart'

for (const line of readFileSync(
  'C:/Users/covr/Desktop/Cosme/Other/RabbitHole/.env.local',
  'utf8',
).split('\n')) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (match) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

const MODEL = DEFAULT_OPENAI_STUDY_GUIDE_MODEL
const EFFORT = process.env.LIVE_EFFORT || 'low'
const REPEATS = Number(process.env.LIVE_REPEATS || 1)
const ARMS = (process.env.LIVE_ARMS || 'old,new').split(',')
const GROUPS = (process.env.LIVE_GROUPS || '').split(',').filter(Boolean)
const DUMP = process.env.LIVE_DUMP === '1'
const PRICE_IN = 0.2
const PRICE_CACHED = 0.02
const PRICE_OUT = 1.2

interface Case {
  name: string
  group: string
  topic: string
  knownTopics: string[]
  expect?: "strong" | "weak"
}

// Spread across subject families, prompt lengths, and skill counts, because the
// failure being fixed was a rubric that only ever fired for same-field topics.
const CASES: Case[] = [
  {
    name: 'caffeine x 3 skills',
    group: 'reported',
    topic: 'how does caffeine affect your brain?',
    knownTopics: ['locksmithing', 'do not disturb', 'budgeting'],
  },
  {
    name: 'caffeine x locksmithing',
    group: 'cross-domain',
    topic: 'how does caffeine affect your brain?',
    knownTopics: ['locksmithing'],
  },
  {
    name: 'caffeine x pharmacology',
    group: 'same-field',
    topic: 'how does caffeine affect your brain?',
    knownTopics: ['pharmacology'],
  },
  {
    name: 'immune system x airport security',
    group: 'cross-domain',
    topic: 'how does the immune system fight an infection?',
    knownTopics: ['airport security'],
  },
  {
    name: 'bronze age collapse x supply chains',
    group: 'history',
    topic:
      'Why did the Bronze Age collapse happen across so many civilisations at once?',
    knownTopics: ['supply chain management', 'knitting', 'poker'],
  },
  {
    name: 'french revolution x group projects',
    group: 'history',
    topic: 'what actually caused the French Revolution?',
    knownTopics: ['organising group projects', 'budgeting'],
  },
  {
    name: 'entropy x tidying',
    group: 'physics',
    topic: 'explain entropy and the second law of thermodynamics',
    knownTopics: ['tidying a messy room', 'photography', 'chess'],
  },
  {
    name: 'special relativity x driving',
    group: 'physics',
    topic: 'why does time slow down when you move fast?',
    knownTopics: ['driving', 'music production'],
  },
  {
    name: 'trinity x jazz',
    group: 'theology',
    topic: 'What is the doctrine of the Trinity and why was it contested?',
    knownTopics: ['sailing', 'jazz improvisation'],
  },
  {
    name: 'offside rule x traffic',
    group: 'sports',
    topic: 'explain the offside rule in football',
    knownTopics: ['driving in traffic', 'chess'],
  },
  {
    name: 'periodisation x project planning',
    group: 'sports',
    topic: 'how should I structure training across a season to peak on time?',
    knownTopics: ['project planning', 'cooking'],
  },
  {
    name: 'photosynthesis x solar panels',
    group: 'biology',
    topic: 'how does photosynthesis actually work?',
    knownTopics: ['solar panels', 'cooking'],
  },
  {
    name: 'CRISPR x text editing',
    group: 'biology',
    topic: 'what is CRISPR and how does gene editing work?',
    knownTopics: ['find and replace in a text editor', 'knitting'],
  },
  {
    name: 'inflation x cooking (one word)',
    group: 'short-prompt',
    topic: 'inflation',
    knownTopics: ['cooking', 'gardening', 'cycling'],
  },
  {
    name: 'osmosis (one word)',
    group: 'short-prompt',
    topic: 'osmosis',
    knownTopics: ['making tea', 'plumbing'],
  },
  {
    name: 'bakery cash flow (long prompt)',
    group: 'long-prompt',
    topic: `I have been running a small bakery for three years and I keep losing money in winter even though sales look fine on paper.

I do not understand cash flow properly. I want to know how money actually moves through a small business, why a profitable month can still leave me unable to pay suppliers, and what levers I have. I have no finance background at all, but I have run kitchens for a decade and I am very comfortable with recipes, prep schedules, and stock rotation.

Please teach me from the ground up.`,
    knownTopics: ['kitchen prep scheduling', 'stock rotation', 'baking'],
  },
  {
    name: 'burnout (long prompt, human topic)',
    group: 'long-prompt',
    topic: `My team has shipped three big releases back to back and I can see people flagging. Two of my strongest engineers have gone quiet in standups and one has started missing deadlines she never used to miss.

I want to understand burnout properly rather than just telling everyone to take a day off. What is actually happening to people, what are the early signals, and what can a manager realistically change versus what is outside their control?`,
    knownTopics: ['endurance running', 'capacity planning'],
  },
  {
    name: 'vaccines x 6 skills (selection pressure)',
    group: 'many-skills',
    topic: 'how do vaccines train the immune system?',
    knownTopics: [
      'firefighting',
      'wine tasting',
      'version control',
      'martial arts',
      'birdwatching',
      'accounting',
    ],
  },
  {
    name: 'compound interest x 5 skills',
    group: 'many-skills',
    topic: 'why is compound interest so powerful over long periods?',
    knownTopics: [
      'sourdough starter',
      'weight training',
      'photography',
      'gardening',
      'language learning',
    ],
  },
  {
    name: 'matrix x galician (null case)',
    group: 'null',
    topic: 'what is a matrix in linear algebra?',
    knownTopics: ['galician'],
    expect: 'weak',
  },
  {
    name: 'baroque art x galician (null case)',
    group: 'null',
    topic: 'what defines Baroque painting?',
    knownTopics: ['galician'],
    expect: 'weak',
  },
  // The two the user flagged. Budgeting only shares "things have categories"
  // with a grammar; locksmithing genuinely transfers selective fit.
  {
    name: 'galician x budgeting (false strong)',
    group: 'calibration',
    topic: 'galician language',
    knownTopics: ['budgeting'],
    expect: 'weak',
  },
  {
    name: 'galician x locksmithing (true medium)',
    group: 'calibration',
    topic: 'galician language',
    knownTopics: ['locksmithing'],
  },
  {
    name: 'galician x language learning (same field)',
    group: 'calibration',
    topic: 'galician language',
    knownTopics: ['learning portuguese'],
    expect: 'strong',
  },
  {
    name: 'photosynthesis x knitting (should not map)',
    group: 'calibration',
    topic: 'how does photosynthesis actually work?',
    knownTopics: ['knitting'],
    expect: 'weak',
  },
  {
    name: 'difficult feedback x devops (safety)',
    group: 'human-safety',
    topic: 'How do I give difficult feedback to someone I manage?',
    knownTopics: ['kubernetes', 'debugging'],
  },
  {
    name: 'grief x systems (safety)',
    group: 'human-safety',
    topic: 'how do people process grief after losing a parent?',
    knownTopics: ['distributed systems', 'gardening'],
  },
  {
    name: 'german cases x programming',
    group: 'language',
    topic: 'explain the German case system for a total beginner',
    knownTopics: ['typed programming languages', 'chess'],
  },
  {
    name: 'sqrt2 irrational x debugging',
    group: 'maths',
    topic: 'why is the square root of 2 irrational?',
    knownTopics: ['debugging', 'baking'],
  },
  {
    name: 'p-values x quality control',
    group: 'maths',
    topic: 'what is a p-value really saying?',
    knownTopics: ['quality control', 'poker'],
  },
  {
    name: 'precedent x version control',
    group: 'law',
    topic: 'how does precedent work in common law?',
    knownTopics: ['version control', 'chess'],
  },
  {
    name: 'chord resolution x storytelling',
    group: 'music',
    topic: 'what makes a chord progression feel resolved?',
    knownTopics: ['storytelling', 'carpentry'],
  },
  {
    name: 'deserts x baking',
    group: 'geography',
    topic: 'why do deserts form where they do?',
    knownTopics: ['baking', 'plumbing'],
  },
  {
    name: 'catalysts x traffic',
    group: 'chemistry',
    topic: 'why do catalysts speed up reactions without being used up?',
    knownTopics: ['traffic management', 'cooking'],
  },
  {
    name: 'ship of theseus x car restoration',
    group: 'philosophy',
    topic: 'what is the ship of Theseus problem and why does it matter?',
    knownTopics: ['car restoration', 'version control'],
  },
  {
    name: 'antibiotic resistance x pest control',
    group: 'medicine',
    topic: 'how do antibiotics work and why does resistance happen?',
    knownTopics: ['pest control', 'password security'],
  },
  {
    name: 'interest rates x thermostats',
    group: 'economics',
    topic: 'what does a central bank actually do when it raises rates?',
    knownTopics: ['thermostats', 'driving'],
  },
  {
    name: 'perspective x photography',
    group: 'art',
    topic: 'what changed in European painting when perspective was invented?',
    knownTopics: ['photography', 'architecture'],
  },
  {
    name: 'recursion x russian dolls (one word-ish)',
    group: 'short-prompt',
    topic: 'recursion',
    knownTopics: ['russian dolls', 'cooking'],
  },
  {
    name: 'plate tectonics x 10 skills',
    group: 'many-skills',
    topic: 'how does plate tectonics reshape continents over time?',
    knownTopics: [
      'sourdough',
      'crochet',
      'scuba diving',
      'car maintenance',
      'spreadsheet modelling',
      'rock climbing',
      'beekeeping',
      'graphic design',
      'running',
      'board games',
    ],
  },
  {
    name: 'spanish prompt x cooking',
    group: 'non-english-prompt',
    topic: '¿por qué sube la marea dos veces al día?',
    knownTopics: ['cocinar', 'ciclismo'],
  },
  {
    name: 'no skills control',
    group: 'control',
    topic: 'how does caffeine affect your brain?',
    knownTopics: [],
  },
  // Held-out set: predicted before running, then measured. Two obvious strongs,
  // two that look far-fetched but transfer, two obvious weaks, and two that
  // sound apt while the mechanism diverges.
  {
    name: 'water cycle x distilling',
    group: 'userset',
    topic: 'How does the water cycle work?',
    knownTopics: ['distilling spirits'],
    expect: 'strong',
  },
  {
    name: 'TCP loss x registered post',
    group: 'userset',
    topic: 'How does TCP recover a lost packet?',
    knownTopics: ['registered post'],
    expect: 'strong',
  },
  {
    name: 'placebo x stage magic',
    group: 'userset',
    topic: 'How does the placebo effect actually work?',
    knownTopics: ['stage magic'],
    expect: 'strong',
  },
  {
    name: 'salty ocean x reducing a sauce',
    group: 'userset',
    topic: 'Why is the ocean salty when rivers are not?',
    knownTopics: ['reducing a sauce'],
    expect: 'strong',
  },
  {
    name: 'red in chinese culture x spreadsheets',
    group: 'userset',
    topic: 'What does the colour red mean in Chinese culture?',
    knownTopics: ['spreadsheet formulas'],
    expect: 'weak',
  },
  {
    name: 'bolivar x darts',
    group: 'userset',
    topic: 'Who was Simon Bolivar?',
    knownTopics: ['playing darts'],
    expect: 'weak',
  },
  {
    name: 'stock market x poker',
    group: 'userset',
    topic: 'How does the stock market work?',
    knownTopics: ['poker'],
    expect: 'weak',
  },
  {
    name: 'memory consolidation x phone backup',
    group: 'userset',
    topic: 'How does memory consolidation during sleep work?',
    knownTopics: ['backing up your phone'],
    expect: 'weak',
  },
]

const BANNED = [
  'the comparison',
  'the analogy',
  'comparison breaks',
  'analogy breaks',
  'limited comparison',
  'breaks down',
  'imperfect comparison',
  'is not a perfect',
  'only a loose',
  'does not map',
]

const callLuna = async (prompt: string, schema: unknown) => {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.HOSTED_OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      reasoning: { effort: EFFORT },
      max_output_tokens: 8192,
      text: {
        format: {
          type: 'json_schema',
          name: 'studymesh_response',
          strict: true,
          schema: toJsonSchema(schema as never, {
            requireAllObjectProperties: true,
          }),
        },
      },
    }),
  })

  const payload = (await response.json()) as Record<string, any>
  if (!response.ok) {
    throw new Error(`${response.status} ${JSON.stringify(payload).slice(0, 300)}`)
  }

  const text = (payload.output || [])
    .filter((item: any) => item?.type === 'message')
    .flatMap((item: any) => (Array.isArray(item.content) ? item.content : []))
    .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
  const usage = payload.usage || {}
  const cachedIn = usage.input_tokens_details?.cached_tokens || 0
  const freshIn = Math.max(0, (usage.input_tokens || 0) - cachedIn)
  const out = usage.output_tokens || 0

  return {
    text,
    costUsd:
      (freshIn * PRICE_IN + cachedIn * PRICE_CACHED + out * PRICE_OUT) /
      1_000_000,
  }
}

const oldSchema = (includeContext: boolean) => {
  const base: any = createMonolithGuideSchema(false)
  if (!includeContext) {
    return base
  }

  return {
    ...base,
    properties: { ...base.properties, contextPlan: OLD_CONTEXT_PLAN_SCHEMA },
    required: [...base.required, 'contextPlan'],
  }
}

interface Row {
  arm: string
  group: string
  name: string
  run: number
  ok: boolean
  leads: boolean
  strength: string
  pairs: number
  specificPairs: number
  concretePairs: number
  swapPairs: number
  selected: string[]
  banned: string[]
  bridgeText: string
  costUsd: number
  /** Full sanitized pairs, saved so threshold rules can be swept offline. */
  correspondences: unknown[]
  skillOptions: string[]
  expect: string
}

const runOne = async (
  testCase: Case,
  arm: string,
  run: number,
): Promise<Row> => {
  const hasTopics = testCase.knownTopics.length > 0
  const base = {
    topic: testCase.topic,
    titleFallback: 'Study Guide',
    folderNameFallback: 'Study Guide',
    userKnownTopics: testCase.knownTopics,
    outputLanguage: 'en' as const,
  }

  try {
    const result =
      arm === 'old'
        ? await callLuna(
            buildOldMonolithGuidePrompt(base),
            oldSchema(hasTopics),
          )
        : await callLuna(
            buildMonolithGuidePrompt(base),
            createMonolithGuideSchema(hasTopics),
          )
    const raw = JSON.parse(result.text)
    const plan = raw.contextPlan || {}
    const selected = Array.isArray(plan.selectedTopics)
      ? plan.selectedTopics
      : []
    const pairs = sanitizeStudyGuideBridgeCorrespondences(plan.correspondences)
    const strength =
      arm === 'old'
        ? selected.length
          ? plan.useForDefault === true
            ? 'strong'
            : 'weak'
          : 'none'
        : selected.length
        ? deriveStudyGuideBridgeStrength(pairs) === 'none'
          ? 'weak'
          : deriveStudyGuideBridgeStrength(pairs)
        : 'none'
    const bridgeText = `${plan.personalizedQuickStart?.keyIdea || ''} ${
      plan.personalizedQuickStart?.quickSummary || ''
    }`

    return {
      arm,
      group: testCase.group,
      name: testCase.name,
      run,
      ok: true,
      leads: strength === 'strong',
      strength,
      pairs: pairs.length,
      specificPairs: pairs.filter((pair) => pair.isSpecific).length,
      concretePairs: pairs.filter((pair) => pair.isConcrete).length,
      swapPairs: pairs.filter((pair) => pair.passesSwapTest).length,
      selected,
      banned: BANNED.filter((phrase) =>
        bridgeText.toLowerCase().includes(phrase),
      ),
      bridgeText: bridgeText.replace(/\s+/g, ' ').trim(),
      costUsd: result.costUsd,
      correspondences: pairs,
      skillOptions: Array.isArray(raw.learnedSkillOptions)
        ? raw.learnedSkillOptions
        : [],
      expect: testCase.expect || 'either',
    }
  } catch (error) {
    return {
      arm,
      group: testCase.group,
      name: testCase.name,
      run,
      ok: false,
      leads: false,
      strength: 'error',
      pairs: 0,
      specificPairs: 0,
      concretePairs: 0,
      swapPairs: 0,
      selected: [],
      banned: [],
      bridgeText: String(error).slice(0, 200),
      costUsd: 0,
      correspondences: [],
      skillOptions: [],
      expect: testCase.expect || "either",
    }
  }
}

const main = async () => {
  const jobs: Array<() => Promise<Row>> = []
  for (let run = 1; run <= REPEATS; run += 1) {
    for (const arm of ARMS) {
      for (const testCase of CASES.filter(
        (item) => !GROUPS.length || GROUPS.includes(item.group),
      )) {
        jobs.push(() => runOne(testCase, arm, run))
      }
    }
  }

  console.log(
    `model=${MODEL} effort=${EFFORT} arms=${ARMS.join('/')} cases=${CASES.length} repeats=${REPEATS} calls=${jobs.length}\n`,
  )

  // Bounded concurrency so a big matrix does not open 100 sockets at once.
  const rows: Row[] = []
  const queue = [...jobs]
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (;;) {
        const job = queue.shift()
        if (!job) {
          return
        }
        rows.push(await job())
      }
    }),
  )

  const armRows = (arm: string) => rows.filter((row) => row.arm === arm)
  const pct = (count: number, total: number) =>
    `${((100 * count) / Math.max(1, total)).toFixed(0)}%`

  for (const arm of ARMS) {
    const list = armRows(arm)
    const withTopics = list.filter((row) => row.ok && row.group !== 'control')
    const strong = withTopics.filter((row) => row.strength === 'strong')
    const weak = withTopics.filter((row) => row.strength === 'weak')
    const none = withTopics.filter((row) => row.strength === 'none')
    const leaks = withTopics.filter((row) => row.banned.length > 0)
    const cost = list.reduce((total, row) => total + row.costUsd, 0)

    console.log(`===== ARM: ${arm} (${withTopics.length} runs) =====`)
    console.log(
      `  strong (bridge leads): ${strong.length} (${pct(strong.length, withTopics.length)})`,
    )
    console.log(
      `  weak   (plain leads) : ${weak.length} (${pct(weak.length, withTopics.length)})`,
    )
    console.log(
      `  none   (no bridge)   : ${none.length} (${pct(none.length, withTopics.length)})`,
    )
    console.log(
      `  disclaimer leaks     : ${leaks.length} (${pct(leaks.length, withTopics.length)})`,
    )
    console.log(`  errors               : ${list.filter((row) => !row.ok).length}`)
    console.log(`  monolith cost        : $${cost.toFixed(4)}`)

    const byGroup: Record<string, { strong: number; total: number }> = {}
    for (const row of withTopics) {
      byGroup[row.group] = byGroup[row.group] || { strong: 0, total: 0 }
      byGroup[row.group].total += 1
      if (row.strength === 'strong') {
        byGroup[row.group].strong += 1
      }
    }
    console.log(
      `  strong by group      : ${Object.entries(byGroup)
        .map(([group, counts]) => `${group} ${counts.strong}/${counts.total}`)
        .join(', ')}`,
    )
    console.log('')
  }

  console.log('===== PER CASE (strength by arm, across runs) =====')
  for (const testCase of CASES) {
    const cells = ARMS.map((arm) => {
      const list = rows.filter(
        (row) => row.arm === arm && row.name === testCase.name,
      )
      const detail = list
        .map((row) => `${row.strength[0]}${row.pairs ? row.pairs : ''}`)
        .join('')
      return `${arm}:${detail || '-'}`
    }).join('  ')
    console.log(`  ${testCase.name.padEnd(40)} ${cells}`)
  }

  const rawPath = `${process.env.LIVE_OUT_DIR || '.'}/bridge_raw_${
    process.env.LIVE_TAG || 'run'
  }.json`
  writeFileSync(rawPath, JSON.stringify(rows, null, 2))
  console.log(`\nraw pair data -> ${rawPath}`)

  if (DUMP) {
    console.log('\n===== FULL BRIDGE TEXT =====')
    for (const row of rows) {
      console.log(
        `\n  [${row.arm}] ${row.name} (${row.strength}, ${row.pairs} pairs, selected=${JSON.stringify(row.selected)})`,
      )
      console.log(`      ${row.bridgeText}`)
    }
  }

  console.log('\n===== LEAK SAMPLES =====')
  for (const row of rows.filter((item) => item.banned.length)) {
    console.log(`  [${row.arm}] ${row.name}: ${JSON.stringify(row.banned)}`)
    console.log(`      ...${row.bridgeText.slice(-220)}`)
  }
}

void main()
