/* eslint-disable no-console */
// Live harness: generates one real Study Guide per language and checks that the
// finished guide is written in the language the app resolved for the prompt.
//
// Run from the repo root (needs HOSTED_OPENAI_API_KEY in .env.local):
//   npx vitest run --config apps/studymesh/tests/live/vitest.live.config.ts
//
// One monolith call per case. The final-quiz call is skipped: drift showed up
// in the Quick Start and bridge, which the monolith call produces.
// Env: LIVE_EFFORT (default low), LIVE_CONCURRENCY (default 5).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  buildMonolithGuidePrompt,
  createMonolithGuideSchema,
  normalizeMonolithGuide,
  toJsonSchema,
  DEFAULT_OPENAI_STUDY_GUIDE_MODEL,
} from '../../../../api/hosted-ai'
import {
  resolveContentLanguage,
  type StudyMeshLanguageCode,
} from '../../src/language/contentLanguage'
import {
  buildStudyGuideKnownSkillInstruction,
  buildStudyGuideNextIdeaPrompt,
} from '../../src/studyGuides/studyGuideTitles'

const envPath = 'C:/Users/covr/Desktop/Cosme/Other/RabbitHole/.env.local'
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (match) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

const MODEL = DEFAULT_OPENAI_STUDY_GUIDE_MODEL
const EFFORT = process.env.LIVE_EFFORT || 'low'
const CONCURRENCY = Number(process.env.LIVE_CONCURRENCY || 5)

// Luna per-million-token prices, mirroring api/hosted-ai.ts.
const PRICE_IN = 0.2
const PRICE_CACHED = 0.02
const PRICE_OUT = 1.2

// The reported failure came from a Spanish interface: every detection miss
// falls back to these settings, so this is the harsh configuration to test.
const SETTINGS = {
  interfaceLanguage: 'es' as const,
  defaultContentLanguage: 'es' as StudyMeshLanguageCode,
  autoDetectAiLanguage: true,
}

interface Case {
  name: string
  /** What a human would say the prompt is written in. */
  human: StudyMeshLanguageCode
  prompt: string
  knownSkill?: string
  knownTopics?: string[]
}

const CASES: Case[] = [
  {
    name: '01 en plain',
    human: 'en',
    prompt:
      'Help me understand why a small group of maintainers can control an open-source project even when anyone can submit changes.',
  },
  {
    name: '02 en + claimed skill (the reported case)',
    human: 'en',
    prompt:
      'Teach me how consent-based decision rules work in cooperatives, community groups, and other organizations.',
    knownSkill: 'reviewing open-source contributions',
    knownTopics: ['reviewing open-source contributions', 'running retros'],
  },
  {
    name: '03 es plain',
    human: 'es',
    prompt: 'Quiero aprender cómo funciona la fotosíntesis en las plantas.',
  },
  {
    name: '04 es + claimed skill',
    human: 'es',
    prompt:
      'Explícame cómo funcionan las reglas de decisión por consenso en cooperativas y asambleas.',
    knownSkill: 'revisar contribuciones de código abierto',
    knownTopics: ['revisar contribuciones de código abierto'],
  },
  {
    name: '05 fr',
    human: 'fr',
    prompt:
      "Je veux comprendre comment fonctionne la mémoire vive d'un ordinateur.",
  },
  {
    name: '06 de',
    human: 'de',
    prompt: 'Ich möchte verstehen, wie Zinseszins funktioniert.',
  },
  {
    name: '07 it',
    human: 'it',
    prompt: 'Voglio imparare come funziona il sistema immunitario.',
  },
  {
    name: '08 nl',
    human: 'nl',
    prompt: 'Ik wil begrijpen hoe een warmtepomp werkt en wat hem efficiënt maakt.',
  },
  {
    name: '09 pl',
    human: 'pl',
    prompt: 'Chcę zrozumieć, jak działa szyfrowanie asymetryczne.',
  },
  {
    name: '10 ru',
    human: 'ru',
    prompt: 'Хочу понять, как работает алгоритм сортировки слиянием.',
  },
  {
    name: '11 ar',
    human: 'ar',
    prompt: 'أريد أن أفهم كيف تعمل الطاقة الشمسية في المنازل.',
  },
  {
    name: '12 hi',
    human: 'hi',
    prompt: 'मुझे समझना है कि मानसून कैसे काम करता है।',
  },
  {
    name: '13 zh',
    human: 'zh',
    prompt: '我想了解神经网络是如何学习的。',
  },
  {
    name: '14 ja',
    human: 'ja',
    prompt: 'ニューラルネットワークの学習の仕組みを知りたいです。',
  },
  {
    name: '15 ko',
    human: 'ko',
    prompt: '신경망이 어떻게 학습하는지 알고 싶어요.',
  },
  {
    name: '16 pt prompt (pt is not an output language)',
    human: 'es',
    prompt:
      'Eu quero aprender sobre derivadas, voce pode criar um guia de estudo?',
  },
  {
    name: '17 en short prompt',
    human: 'en',
    prompt: 'Explain graph databases.',
  },
  {
    name: '18 es with English technical terms',
    human: 'es',
    prompt:
      'Quiero aprender cómo funciona el garbage collector de la JVM y qué pasa con el heap.',
  },
  {
    name: '19 en with Spanish proper nouns',
    human: 'en',
    prompt:
      'Teach me about the Camino de Santiago and how pilgrims plan their route.',
  },
  {
    name: '20 en asking about a Portuguese topic',
    human: 'en',
    prompt:
      'Help me learn basic Portuguese greetings and polite phrases for a trip to Lisbon.',
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

  const payload = (await response.json()) as Record<string, unknown>
  if (!response.ok) {
    throw new Error(
      `${response.status} ${JSON.stringify(payload).slice(0, 400)}`,
    )
  }

  const output = (payload.output as Record<string, unknown>[]) || []
  const text = output
    .filter((item) => item?.type === 'message')
    .flatMap((item) =>
      Array.isArray(item.content)
        ? (item.content as Record<string, unknown>[])
        : [],
    )
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')

  const usage = (payload.usage as Record<string, never>) || {}
  const cachedIn =
    (usage.input_tokens_details as unknown as { cached_tokens?: number })
      ?.cached_tokens || 0
  const freshIn = Math.max(0, (Number(usage.input_tokens) || 0) - cachedIn)
  const out = Number(usage.output_tokens) || 0

  return {
    text,
    costUsd:
      (freshIn * PRICE_IN + cachedIn * PRICE_CACHED + out * PRICE_OUT) /
      1_000_000,
  }
}

/**
 * Independent of the app's own detector on purpose: a harness that reuses
 * `detectContentLanguage` would agree with itself instead of judging the guide.
 * Scripts settle the non-Latin languages; stopwords settle the rest.
 */
const detectGuideLanguage = (value: string): string => {
  const text = ` ${value.toLowerCase()} `
  if (/[\u3040-\u30ff]/.test(text)) {
    return 'ja'
  }
  if (/[\uac00-\ud7af]/.test(text)) {
    return 'ko'
  }
  if (/[\u4e00-\u9fff]/.test(text)) {
    return 'zh'
  }
  if (/[\u0600-\u06ff]/.test(text)) {
    return 'ar'
  }
  if (/[\u0900-\u097f]/.test(text)) {
    return 'hi'
  }
  if (/[\u0400-\u04ff]/.test(text)) {
    return 'ru'
  }

  const markers: Record<string, RegExp[]> = {
    en: [/\b(the|and|that|with|for|this|these|from|which|when|are|is)\b/g],
    es: [/\b(el|la|los|las|un|una|del|que|para|con|por|como|es|son|se)\b/g, /[ñ¿¡]/g],
    pt: [/\b(o|a|os|as|um|uma|do|da|dos|das|que|para|com|por|como|é|são)\b/g, /[ãõ]/g],
    fr: [/\b(le|la|les|un|une|des|du|que|pour|avec|par|comme|est|sont|dans)\b/g],
    de: [/\b(der|die|das|ein|eine|und|mit|für|von|ist|sind|nicht|auch)\b/g],
    it: [/\b(il|lo|la|gli|le|un|una|di|che|per|con|come|è|sono|nel)\b/g],
    nl: [/\b(de|het|een|en|van|met|voor|is|zijn|niet|ook|dat|die)\b/g],
    pl: [/\b(i|w|na|to|jest|nie|się|do|że|z|o|za|jak)\b/g, /[ąćęłńóśżź]/g],
  }

  const scores = Object.entries(markers)
    .map(([code, patterns]) => ({
      code,
      score: patterns.reduce(
        (total, pattern) => total + (text.match(pattern)?.length || 0),
        0,
      ),
    }))
    .sort((left, right) => right.score - left.score)

  return scores[0] && scores[0].score >= 4 ? scores[0].code : 'unknown'
}

const runCase = async (testCase: Case) => {
  const resolved = resolveContentLanguage({
    text: testCase.prompt,
    settings: SETTINGS,
  })
  // Exactly what generation.ts sends: learner prompt first, claimed-skill
  // instruction written in the language that prompt resolved to.
  const modelPrompt = buildStudyGuideNextIdeaPrompt(
    testCase.prompt,
    buildStudyGuideKnownSkillInstruction(
      testCase.knownSkill || '',
      resolved.language,
    ),
  )
  const knownTopics = testCase.knownTopics || []

  try {
    const result = await callLuna(
      buildMonolithGuidePrompt({
        topic: modelPrompt,
        titleFallback: 'Study Guide',
        folderNameFallback: 'Study Guide',
        userKnownTopics: knownTopics,
        outputLanguage: resolved.language,
      }),
      createMonolithGuideSchema(knownTopics.length > 0),
    )
    const raw = JSON.parse(result.text)
    const guide = normalizeMonolithGuide(
      raw,
      'Study Guide',
      'Study Guide',
      knownTopics,
    )
    const bridge = raw.contextPlan?.personalizedQuickStart
    const guideText = [
      guide.quickStart.keyIdea,
      guide.quickStart.quickSummary,
      bridge?.keyIdea || '',
      bridge?.quickSummary || '',
      guide.pages[0]?.rawNotes || '',
    ]
      .filter(Boolean)
      .join('\n\n')

    return {
      name: testCase.name,
      ok: true as const,
      human: testCase.human,
      resolved: resolved.language,
      resolvedSource: resolved.source,
      detected: detectGuideLanguage(guideText),
      bridgeDetected: bridge?.keyIdea
        ? detectGuideLanguage(
            `${bridge.keyIdea}\n\n${bridge.quickSummary || ''}`,
          )
        : 'n/a',
      title: guide.title,
      keyIdea: guide.quickStart.keyIdea,
      bridgeKeyIdea: bridge?.keyIdea || '',
      costUsd: result.costUsd,
    }
  } catch (error) {
    return {
      name: testCase.name,
      ok: false as const,
      human: testCase.human,
      resolved: resolved.language,
      resolvedSource: resolved.source,
      error: String(error).slice(0, 300),
      costUsd: 0,
    }
  }
}

const runInBatches = async <T,>(
  items: Case[],
  size: number,
  run: (item: Case) => Promise<T>,
): Promise<T[]> => {
  const results: T[] = []
  for (let index = 0; index < items.length; index += size) {
    results.push(...(await Promise.all(items.slice(index, index + size).map(run))))
  }
  return results
}

describe('live Study Guide language drift', () => {
  it('writes every guide in the language resolved from its prompt', async () => {
    console.log(
      `model=${MODEL} effort=${EFFORT} cases=${CASES.length} interface=${SETTINGS.interfaceLanguage}\n`,
    )
    const results = await runInBatches(CASES, CONCURRENCY, runCase)

    const resolverMisses: string[] = []
    const modelMisses: string[] = []
    let total = 0

    for (const result of results) {
      total += result.costUsd
      if (!result.ok) {
        console.log(`${result.name}\n  FAILED: ${result.error}`)
        continue
      }

      const resolverOk = result.resolved === result.human
      const modelOk =
        result.detected === result.resolved || result.detected === 'unknown'
      const bridgeOk =
        result.bridgeDetected === 'n/a' ||
        result.bridgeDetected === 'unknown' ||
        result.bridgeDetected === result.resolved

      if (!resolverOk) {
        resolverMisses.push(
          `${result.name}: prompt reads ${result.human}, resolved ${result.resolved} (${result.resolvedSource})`,
        )
      }
      if (!modelOk || !bridgeOk) {
        modelMisses.push(
          `${result.name}: asked for ${result.resolved}, guide reads ${result.detected}, bridge ${result.bridgeDetected}`,
        )
      }

      console.log(
        `${modelOk && bridgeOk ? 'PASS' : 'FAIL'} ${result.name}\n` +
          `  human=${result.human} resolved=${result.resolved} (${result.resolvedSource}) ` +
          `guide=${result.detected} bridge=${result.bridgeDetected}\n` +
          `  title: ${result.title}\n` +
          `  key  : ${result.keyIdea.slice(0, 140)}` +
          (result.bridgeKeyIdea
            ? `\n  brdg : ${result.bridgeKeyIdea.slice(0, 140)}`
            : ''),
      )
    }

    console.log(
      `\ncalls=${results.length} cost=$${total.toFixed(4)}\n` +
        `resolver misses=${resolverMisses.length}\n` +
        resolverMisses.map((line) => `  - ${line}`).join('\n') +
        `\nmodel misses=${modelMisses.length}\n` +
        modelMisses.map((line) => `  - ${line}`).join('\n'),
    )

    expect(modelMisses).toEqual([])
  })
})
