/* eslint-disable no-undef, no-console, @typescript-eslint/no-explicit-any */
// Live harness: runs the real monolith prompt against luna and reports the
// derived bridge strength plus measured cost per Study Guide.
// Not part of the unit suite; it costs real credits. Run with:
//   npx tsx apps/studymesh/tests/live/bridgeLive.ts
// Env: LIVE_EFFORT (default low), LIVE_ARM (new|old), LIVE_REPEATS (default 1).
import { readFileSync } from 'node:fs'

import {
  buildEnhancedGuideSource,
  buildEnhancedQuizPrompt,
  buildMonolithGuidePrompt,
  createMonolithGuideSchema,
  ENHANCED_STUDY_GUIDE_QUIZ_SCHEMA,
  normalizeMonolithGuide,
  toJsonSchema,
  DEFAULT_OPENAI_STUDY_GUIDE_MODEL,
} from '../../../../api/hosted-ai'
import { sanitizeStudyGuideBridgeCorrespondences } from '../../src/studyGuides/quickStart'

const envPath = 'C:/Users/covr/Desktop/Cosme/Other/RabbitHole/.env.local'
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (match) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

const MODEL = DEFAULT_OPENAI_STUDY_GUIDE_MODEL
const EFFORT = process.env.LIVE_EFFORT || 'low'

// Luna per-million-token prices, mirroring api/hosted-ai.ts.
const PRICE_IN = 0.2
const PRICE_CACHED = 0.02
const PRICE_OUT = 1.2

interface Case {
  name: string
  topic: string
  knownTopics: string[]
}

const CASES: Case[] = [
  {
    name: 'caffeine / 3 skills (the reported case)',
    topic: 'how does caffeine affect your brain?',
    knownTopics: ['locksmithing', 'do not disturb', 'budgeting'],
  },
  {
    name: 'caffeine / 1 skill, cross-domain',
    topic: 'how does caffeine affect your brain?',
    knownTopics: ['locksmithing'],
  },
  {
    name: 'caffeine / 1 skill, same field',
    topic: 'how does caffeine affect your brain?',
    knownTopics: ['pharmacology'],
  },
  {
    name: 'one-word prompt / hobby skills',
    topic: 'inflation',
    knownTopics: ['cooking', 'gardening', 'cycling'],
  },
  {
    name: 'history / unrelated-looking skills',
    topic:
      'Why did the Bronze Age collapse happen across so many civilisations at once?',
    knownTopics: ['supply chain management', 'knitting', 'poker'],
  },
  {
    name: 'physics / everyday skills',
    topic: 'explain entropy and the second law of thermodynamics',
    knownTopics: ['tidying a messy room', 'photography', 'chess'],
  },
  {
    name: 'theology / far skills',
    topic: 'What is the doctrine of the Trinity and why was it contested?',
    knownTopics: ['sailing', 'jazz improvisation'],
  },
  {
    name: 'null case (should not map)',
    topic: 'what is a matrix in linear algebra?',
    knownTopics: ['galician'],
  },
  {
    name: 'long multi-paragraph prompt',
    topic: `I have been running a small bakery for three years and I keep losing money in winter even though sales look fine on paper.

I do not understand cash flow properly. I want to know how money actually moves through a small business, why a profitable month can still leave me unable to pay suppliers, and what levers I have. I have no finance background at all, but I have run kitchens for a decade and I am very comfortable with recipes, prep schedules, and stock rotation.

Please teach me from the ground up.`,
    knownTopics: ['kitchen prep scheduling', 'stock rotation', 'baking'],
  },
  {
    name: 'many skills (selection pressure)',
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
    name: 'no skills at all (control)',
    topic: 'how does caffeine affect your brain?',
    knownTopics: [],
  },
  {
    name: 'human topic / tool skill (safety guard)',
    topic: 'How do I give difficult feedback to someone I manage?',
    knownTopics: ['kubernetes', 'debugging'],
  },
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
    throw new Error(
      `${response.status} ${JSON.stringify(payload).slice(0, 400)}`,
    )
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
  const costUsd =
    (freshIn * PRICE_IN + cachedIn * PRICE_CACHED + out * PRICE_OUT) / 1_000_000

  return {
    text,
    costUsd,
    inputTokens: usage.input_tokens || 0,
    outputTokens: out,
    reasoningTokens: usage.output_tokens_details?.reasoning_tokens || 0,
  }
}

const runCase = async (testCase: Case) => {
  const started = Date.now()
  try {
    const prompt = buildMonolithGuidePrompt({
      topic: testCase.topic,
      titleFallback: 'Study Guide',
      folderNameFallback: 'Study Guide',
      userKnownTopics: testCase.knownTopics,
      outputLanguage: 'en',
    })
    const result = await callLuna(
      prompt,
      createMonolithGuideSchema(testCase.knownTopics.length > 0),
    )
    const guide = normalizeMonolithGuide(
      JSON.parse(result.text),
      'Study Guide',
      'Study Guide',
      testCase.knownTopics,
    )
    const raw = JSON.parse(result.text)
    const correspondences = sanitizeStudyGuideBridgeCorrespondences(
      raw.contextPlan?.correspondences,
    )

    // The shipped guide is two provider calls, so cost the quiz call too.
    const quizResult = await callLuna(
      buildEnhancedQuizPrompt({
        topic: testCase.topic,
        source: buildEnhancedGuideSource({
          topic: testCase.topic,
          blueprint: {
            title: guide.title,
            folderName: guide.folderName,
            emoji: guide.emoji,
            quickStart: guide.quickStart,
            pages: guide.pages.map((page) => ({
              title: page.title,
              keyFacts: [],
              conciseNotes: '',
              examplesNeeded: [],
              quizSkills: [],
            })),
          } as never,
          pages: guide.pages,
        }),
        bridgeBlocks: [],
        outputLanguage: 'en',
      }),
      ENHANCED_STUDY_GUIDE_QUIZ_SCHEMA,
    )

    return {
      name: testCase.name,
      ok: true as const,
      ms: Date.now() - started,
      ...result,
      quizCostUsd: quizResult.costUsd,
      guideCostUsd: result.costUsd + quizResult.costUsd,
      title: guide.title,
      strength: guide.contextPlan?.bridgeStrength ?? 'n/a',
      leads: guide.contextPlan?.useForDefault ?? false,
      selected: guide.contextPlan?.selectedTopics ?? [],
      rawPairs: (raw.contextPlan?.correspondences || []).length,
      keptPairs: correspondences.length,
      pairs: correspondences.map(
        (entry) => `${entry.knownSide} -> ${entry.targetSide} [${entry.kind}]`,
      ),
      targetParts: raw.contextPlan?.targetParts || [],
      reason: guide.contextPlan?.reason || '',
      plainKeyIdea: guide.quickStart.keyIdea,
      bridgeKeyIdea: guide.contextPlan?.personalizedQuickStart?.keyIdea || '',
      bridgeSummary:
        guide.contextPlan?.personalizedQuickStart?.quickSummary || '',
    }
  } catch (error) {
    return {
      name: testCase.name,
      ok: false as const,
      ms: Date.now() - started,
      error: String(error).slice(0, 500),
      costUsd: 0,
      guideCostUsd: 0,
    }
  }
}

const BANNED = [
  'the comparison',
  'the analogy',
  'comparison breaks',
  'analogy breaks',
  'limited comparison',
  'breaks down',
  'is not a perfect',
  'imperfect comparison',
]

const main = async () => {
  console.log(`model=${MODEL} effort=${EFFORT} cases=${CASES.length}\n`)
  const results = await Promise.all(CASES.map(runCase))

  let total = 0
  for (const result of results) {
    total += result.guideCostUsd
    if (!result.ok) {
      console.log(`\n### ${result.name}\n  FAILED: ${result.error}`)
      continue
    }

    const text = `${result.bridgeKeyIdea} ${result.bridgeSummary}`.toLowerCase()
    const hits = BANNED.filter((phrase) => text.includes(phrase))
    console.log(`\n### ${result.name}`)
    console.log(`  title       : ${result.title}`)
    console.log(
      `  strength    : ${result.strength}  leads=${result.leads}  selected=${JSON.stringify(
        result.selected,
      )}`,
    )
    console.log(
      `  pairs       : ${result.keptPairs} kept / ${result.rawPairs} raw`,
    )
    for (const pairText of result.pairs) {
      console.log(`      - ${pairText}`)
    }
    console.log(`  targetParts : ${JSON.stringify(result.targetParts)}`)
    console.log(`  reason      : ${result.reason}`)
    console.log(`  bridge key  : ${result.bridgeKeyIdea}`)
    console.log(`  bridge sum  : ${result.bridgeSummary.replace(/\n+/g, ' | ')}`)
    console.log(`  disclaimer  : ${hits.length ? `LEAK ${JSON.stringify(hits)}` : 'clean'}`)
    console.log(
      `  cost        : guide $${result.guideCostUsd.toFixed(5)} = monolith $${result.costUsd.toFixed(
        5,
      )} + quiz $${result.quizCostUsd.toFixed(5)} (in ${result.inputTokens}, out ${result.outputTokens}, reasoning ${result.reasoningTokens}) ${result.ms}ms`,
    )
  }

  const okResults = results.filter((result) => result.ok)
  const strengths = okResults.reduce<Record<string, number>>((counts, item) => {
    const key = String((item as { strength?: string }).strength || 'n/a')
    return { ...counts, [key]: (counts[key] || 0) + 1 }
  }, {})
  console.log(`\n===== SUMMARY (${okResults.length}/${results.length} ok) =====`)
  console.log(`strengths           : ${JSON.stringify(strengths)}`)
  console.log(`full guide total    : $${total.toFixed(5)}`)
  const average = total / Math.max(1, okResults.length)
  console.log(
    `full guide average  : $${average.toFixed(5)} (${(average * 100).toFixed(3)} cents)`,
  )
}

void main()
