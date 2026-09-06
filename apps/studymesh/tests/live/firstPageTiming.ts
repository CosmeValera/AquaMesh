/* eslint-disable no-undef, @typescript-eslint/no-explicit-any */
// Live harness: measures how long a learner waits before page 1 is readable,
// and checks that moving the bridge after the pages did not cost bridge quality.
//
// The hosted card stands down as soon as page 1 closes, so time-to-page-1 is the
// wait that matters, not time-to-done. Streams the real monolith call and feeds
// the deltas to the real preview emitter, so the stamps are the same events the
// browser reacts to.
//
// Not part of the unit suite; it costs real money. Run with:
//   npx tsx apps/studymesh/tests/live/firstPageTiming.ts
// Env: LIVE_EFFORT (default low), LIVE_ARMS (default old,new).
import { readFileSync } from 'node:fs'

import {
  buildMonolithGuidePrompt,
  createMonolithGuideSchema,
  createMonolithPreviewEmitter,
  normalizeMonolithGuide,
  toJsonSchema,
  DEFAULT_OPENAI_STUDY_GUIDE_MODEL,
} from '../../../../api/hosted-ai'
import {
  deriveStudyGuideBridgeStrength,
  sanitizeStudyGuideBridgeCorrespondences,
} from '../../src/studyGuides/quickStart'

const envPath = 'C:/Users/covr/Desktop/Cosme/Other/RabbitHole/.env.local'
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (match) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

const MODEL = DEFAULT_OPENAI_STUDY_GUIDE_MODEL
const EFFORT = process.env.LIVE_EFFORT || 'low'
const ARMS = (process.env.LIVE_ARMS || 'old,new').split(',') as Arm[]

type Arm = 'old' | 'new'

interface Case {
  name: string
  topic: string
  knownTopics: string[]
}

// Six cases, spread across subject distance and prompt length, including one
// that should refuse to map. Taken from bridgeLive.ts so the two harnesses stay
// comparable.
const CASES: Case[] = [
  {
    name: 'caffeine / cross-domain',
    topic: 'how does caffeine affect your brain?',
    knownTopics: ['locksmithing'],
  },
  {
    name: 'inflation / hobby skills',
    topic: 'inflation',
    knownTopics: ['cooking', 'gardening', 'cycling'],
  },
  {
    name: 'bronze age / unrelated-looking skills',
    topic:
      'Why did the Bronze Age collapse happen across so many civilisations at once?',
    knownTopics: ['supply chain management', 'knitting', 'poker'],
  },
  {
    name: 'entropy / everyday skills',
    topic: 'explain entropy and the second law of thermodynamics',
    knownTopics: ['tidying a messy room', 'photography', 'chess'],
  },
  {
    name: 'trinity / far skills',
    topic: 'What is the doctrine of the Trinity and why was it contested?',
    knownTopics: ['sailing', 'jazz improvisation'],
  },
  {
    name: 'null case (should not map)',
    topic: 'what is a matrix in linear algebra?',
    knownTopics: ['galician'],
  },
]

/**
 * The shipped-before order, derived from the current schema rather than copied.
 *
 * Only the key order changed, so re-keying the live object is what isolates the
 * variable: a verbatim copy could drift from production and turn a content
 * difference into an apparent ordering result.
 */
export const oldOrderSchema = (includeContext: boolean) => {
  const current = createMonolithGuideSchema(includeContext) as any
  const order = [
    'title',
    'folderName',
    'emoji',
    'quickStart',
    'nextGuideIdeas',
    'plannedLessons',
    ...(includeContext ? ['contextPlan'] : []),
    'pages',
  ]
  const properties: Record<string, unknown> = {}
  order.forEach((key) => {
    if (!current.properties[key]) {
      throw new Error(`old order references a missing property: ${key}`)
    }

    properties[key] = current.properties[key]
  })

  return { ...current, properties, required: order }
}

/**
 * The prompt's example JSON as it was before the reorder.
 *
 * The baseline has to be what actually shipped, prompt included: leaving the new
 * example order against the old schema would make the model's hint disagree with
 * its output order and penalise the old arm for the wrong reason. Both swaps are
 * asserted, so a drifted prompt fails loudly instead of measuring nothing.
 */
const PAGES_BLOCK = `  "pages": [
    { "title": "01 - ...", "summary": "one preview sentence", "rawNotes": "Markdown lesson notes", "pageIdeas": [{ "axis": "mechanism | example | limit", "label": "...", "prompt": "..." }] }
  ]`
const NEXT_IDEAS_LINE = `  "nextGuideIdeas": [{ "axis": "curiosity | utility | connection", "label": "...", "prompt": "..." }]`
const PLANNED_LINE = `  "plannedLessons": [{ "title": "...", "summary": "..." }]`

export const toOldPrompt = (prompt: string): string => {
  const swap = (source: string, find: string, replace: string): string => {
    if (!source.includes(find)) {
      throw new Error(`prompt has drifted; could not find:\n${find}`)
    }

    return source.replace(find, replace)
  }

  // Trailing nextGuideIdeas becomes the trailing pages block. Done first, while
  // there is exactly one nextGuideIdeas in the string.
  const withPagesLast = swap(
    prompt,
    `${NEXT_IDEAS_LINE}\n}`,
    `${PAGES_BLOCK}\n}`,
  )

  // The middle pages block becomes nextGuideIdeas, back above plannedLessons.
  return swap(
    withPagesLast,
    `${PLANNED_LINE},\n${PAGES_BLOCK},`,
    `${NEXT_IDEAS_LINE},\n${PLANNED_LINE},`,
  )
}

interface Stamps {
  firstToken?: number
  meta?: number
  quickStart?: number
  bridge?: number
  firstPage?: number
  readable?: number
  done: number
}

const streamMonolith = async (
  prompt: string,
  schema: unknown,
): Promise<{ text: string; stamps: Stamps }> => {
  const started = Date.now()
  const stamps: Partial<Stamps> = {}
  const stamp = (key: keyof Stamps) => {
    if (stamps[key] === undefined) {
      stamps[key] = Date.now() - started
    }
  }

  const emitter = createMonolithPreviewEmitter((event) => {
    if (event.type === 'meta') {
      stamp('meta')
    }
    if (event.type === 'quickStart') {
      stamp('quickStart')
    }
    if (event.type === 'bridge') {
      stamp('bridge')
    }
    if (event.type === 'page' && event.index === 0) {
      stamp('firstPage')
    }
    if (event.type === 'readableGuide') {
      stamp('readable')
    }
  })

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
      stream: true,
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

  if (!response.ok || !response.body) {
    throw new Error(`${response.status} ${(await response.text()).slice(0, 400)}`)
  }

  let text = ''
  let buffer = ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data:')) {
        continue
      }

      const raw = line.slice(5).trim()
      if (!raw || raw === '[DONE]') {
        continue
      }

      const event = JSON.parse(raw) as Record<string, any>
      if (event.type === 'response.output_text.delta' && event.delta) {
        stamp('firstToken')
        text += event.delta as string
        emitter.onDelta(event.delta as string)
      }
    }
  }

  return { text, stamps: { ...stamps, done: Date.now() - started } }
}

const runCase = async (testCase: Case, arm: Arm) => {
  const includeContext = testCase.knownTopics.length > 0
  const basePrompt = buildMonolithGuidePrompt({
    topic: testCase.topic,
    titleFallback: 'Study Guide',
    folderNameFallback: 'Study Guide',
    userKnownTopics: testCase.knownTopics,
    outputLanguage: 'en',
  })

  const { text, stamps } = await streamMonolith(
    arm === 'old' ? toOldPrompt(basePrompt) : basePrompt,
    arm === 'old'
      ? oldOrderSchema(includeContext)
      : createMonolithGuideSchema(includeContext),
  )

  const raw = JSON.parse(text)
  // Throws if the guide is unusable, which is itself a result worth seeing.
  const guide = normalizeMonolithGuide(
    raw,
    'Study Guide',
    'Study Guide',
    testCase.knownTopics,
  )
  const correspondences = sanitizeStudyGuideBridgeCorrespondences(
    raw.contextPlan?.correspondences,
  )

  return {
    stamps,
    strength: deriveStudyGuideBridgeStrength(correspondences),
    selectedTopics: guide.contextPlan?.selectedTopics || [],
    pairs: correspondences.map(
      (pair) => `${pair.knownSide} -> ${pair.targetSide}`,
    ),
  }
}

const seconds = (ms: number | undefined) =>
  ms === undefined ? '  -  ' : `${(ms / 1000).toFixed(1)}s`.padStart(5)

const main = async () => {
  const rows: Array<{ name: string; arm: Arm; result: any }> = []

  for (const testCase of CASES) {
    for (const arm of ARMS) {
      try {
        const result = await runCase(testCase, arm)
        rows.push({ name: testCase.name, arm, result })
        console.log(
          `[${arm}] ${testCase.name}\n` +
            `      first token ${seconds(result.stamps.firstToken)} | ` +
            `quick start ${seconds(result.stamps.quickStart)} | ` +
            `PAGE 1 ${seconds(result.stamps.firstPage)} | ` +
            `bridge ${seconds(result.stamps.bridge)} | ` +
            `done ${seconds(result.stamps.done)}\n` +
            `      bridge ${result.strength} via ${result.selectedTopics.join(', ') || '(none)'}` +
            `${result.pairs.length ? `\n      ${result.pairs.join('\n      ')}` : ''}`,
        )
      } catch (error) {
        console.log(`[${arm}] ${testCase.name} FAILED: ${String(error)}`)
      }
    }
  }

  console.log('\n=== time to page 1 ===')
  ARMS.forEach((arm) => {
    const times = rows
      .filter((row) => row.arm === arm && row.result.stamps.firstPage)
      .map((row) => row.result.stamps.firstPage as number)
    if (!times.length) {
      return
    }

    const mean = times.reduce((sum, value) => sum + value, 0) / times.length
    console.log(
      `${arm.padEnd(4)} n=${times.length} mean ${(mean / 1000).toFixed(1)}s ` +
        `min ${(Math.min(...times) / 1000).toFixed(1)}s ` +
        `max ${(Math.max(...times) / 1000).toFixed(1)}s`,
    )
  })

  console.log('\n=== bridge strength ===')
  ARMS.forEach((arm) => {
    const counts: Record<string, number> = {}
    rows
      .filter((row) => row.arm === arm)
      .forEach((row) => {
        counts[row.result.strength] = (counts[row.result.strength] || 0) + 1
      })
    console.log(`${arm.padEnd(4)} ${JSON.stringify(counts)}`)
  })
}

// Guarded so the offline arm check can import the two helpers above without
// spending a single call.
if (!process.env.LIVE_DRY_RUN) {
  void main()
}
