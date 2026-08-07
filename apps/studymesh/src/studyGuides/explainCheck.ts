import {
  isLocalAiContentLanguageSupported,
  type StudyMeshLanguageCode,
} from '../language/contentLanguage'
import { callHostedAiModel } from '../quickCreate/ai/hostedClient'
import { callLocalLanguageModel } from '../quickCreate/ai/localLanguageModel'
import {
  readQuickCreateAiSettings,
  resolveQuickCreateAiCredentials,
  type QuickCreateAiProvider,
} from '../quickCreate/ai/settings'
import {
  callStrongAiModel,
  isStrongAiProvider,
} from '../quickCreate/ai/strongProviders'
import { claimFreeExplainAttempt } from './mastery'

/**
 * Saying it back in your own words is the other way to earn the guide topic as
 * a declared skill. Short on purpose, like a Duolingo sentence: long enough to
 * show understanding, short enough that nobody pastes the guide back at us.
 */
export const EXPLAIN_MIN_WORDS = 10
export const EXPLAIN_MAX_WORDS = 60

/** How much of the guide the grader is allowed to read. */
const MAX_SOURCE_CHARS = 6000

export const countExplanationWords = (value: string): number =>
  value.trim() ? value.trim().split(/\s+/).length : 0

export interface ExplainCorrection {
  /** The learner's wording that is wrong or misleading, verbatim. */
  quote: string
  /** A minimal edit of quote — same opener, only the wrong words changed. */
  better: string
}

export interface ExplainCheckResult {
  passed: boolean
  /** One short sentence addressed to the learner, empty on pass. */
  feedback: string
  corrections: ExplainCorrection[]
}

export const EXPLAIN_CHECK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    verdict: { type: 'STRING', enum: ['pass', 'retry'] },
    feedback: { type: 'STRING' },
    corrections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          quote: { type: 'STRING' },
          better: { type: 'STRING' },
        },
        required: ['quote', 'better'],
      },
    },
  },
  required: ['verdict', 'feedback', 'corrections'],
}

export const buildExplainCheckPrompt = ({
  topic,
  source,
  explanation,
  outputLanguage,
}: {
  topic: string
  source: string
  explanation: string
  outputLanguage?: StudyMeshLanguageCode
}): string =>
  [
    `You are marking a short spoken-style explanation from a learner who just finished a study guide on "${topic}".`,
    'Judge only whether the learner understands the idea. Marking is generous, and close counts:',
    '- Pass when the explanation is broadly right, even if it is informal, incomplete on details, uses their own analogy, or is mostly the same idea worded loosely.',
    '- Ask for a retry only when it states something factually wrong about the topic (describes a different thing, mixes up a key mechanism), or is so vague it could describe anything.',
    '- Never fail an explanation for style, spelling, grammar, typos, or for being short.',
    '',
    'Return JSON with:',
    '- verdict: "pass" or "retry".',
    '- feedback: on retry, ONE short sentence naming the specific thing that is wrong. Empty string on pass. Warm, never condescending, never a restated lecture.',
    '- corrections: on retry, at most one item for the single most important error, quoting the learner\'s own wording verbatim ("quote") and a "better" version that is a MINIMAL edit of it — same opening words, same sentence shape, change only the few words that are actually wrong, do not rewrite the whole sentence. Empty array on pass.',
    '',
    outputLanguage
      ? `Write feedback and corrections in this language code: ${outputLanguage}.`
      : 'Write in the language the learner used.',
    '',
    'Study guide the learner read:',
    source.slice(0, MAX_SOURCE_CHARS),
    '',
    'Learner explanation:',
    explanation,
  ]
    .filter(Boolean)
    .join('\n')

const parseJsonObject = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
    if (fenced) {
      return JSON.parse(fenced)
    }

    const firstObject = text.indexOf('{')
    const lastObject = text.lastIndexOf('}')
    if (firstObject >= 0 && lastObject > firstObject) {
      return JSON.parse(text.slice(firstObject, lastObject + 1))
    }

    throw new Error('The explanation check did not return JSON.')
  }
}

const stringValue = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

export const parseExplainCheckResult = (text: string): ExplainCheckResult => {
  const parsed = parseJsonObject(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The explanation check returned an unusable answer.')
  }

  const record = parsed as Record<string, unknown>
  const corrections = Array.isArray(record.corrections)
    ? record.corrections
        .map((entry) => {
          const item = (entry || {}) as Record<string, unknown>
          return {
            quote: stringValue(item.quote),
            better: stringValue(item.better),
          }
        })
        .filter((entry) => entry.quote && entry.better)
        .slice(0, 1)
    : []

  return {
    passed: stringValue(record.verdict).toLowerCase() === 'pass',
    feedback: stringValue(record.feedback),
    corrections,
  }
}

export type ExplainCheckCost = 'free' | 'credit'

export interface ExplainCheckRun extends ExplainCheckResult {
  cost: ExplainCheckCost
}

/**
 * Hosted grading rides two surfaces on purpose. The one call a guide is
 * entitled to is free, and every later attempt is charged like any other
 * Quick Create call, so a guide can never buy more than one free generation no
 * matter how many times the dialog is opened.
 */
const HOSTED_FREE_SURFACE = 'mastery-check' as const
const HOSTED_PAID_SURFACE = 'quick-create' as const

export const resolveExplainCheckCost = (
  provider: QuickCreateAiProvider,
  freeAttemptAvailable: boolean,
): ExplainCheckCost =>
  provider === 'hosted' && !freeAttemptAvailable ? 'credit' : 'free'

export const gradeGuideExplanation = async ({
  studyGuideId,
  topic,
  source,
  explanation,
  outputLanguage,
  signal,
}: {
  studyGuideId: string
  topic: string
  source: string
  explanation: string
  outputLanguage?: StudyMeshLanguageCode
  signal?: AbortSignal
}): Promise<ExplainCheckRun> => {
  const words = countExplanationWords(explanation)
  if (words < EXPLAIN_MIN_WORDS || words > EXPLAIN_MAX_WORDS) {
    throw new Error(
      `Write between ${EXPLAIN_MIN_WORDS} and ${EXPLAIN_MAX_WORDS} words.`,
    )
  }

  const provider = readQuickCreateAiSettings().provider || 'hosted'
  const prompt = buildExplainCheckPrompt({
    topic,
    source,
    explanation,
    outputLanguage,
  })

  if (provider === 'local') {
    const localLanguage = outputLanguage || 'en'
    if (!isLocalAiContentLanguageSupported(localLanguage)) {
      throw new Error(
        'Google Local AI only supports English, Spanish, and Japanese output in RabbitHole. Choose one of those languages, or switch to Hosted AI or your own provider key.',
      )
    }

    return {
      ...parseExplainCheckResult(
        await callLocalLanguageModel(prompt, {
          outputLanguage: localLanguage,
          timeoutMs: 90 * 1000,
          signal,
        }),
      ),
      cost: 'free',
    }
  }

  if (provider === 'hosted') {
    // Claimed before the request leaves: an abandoned or failed call still
    // spends the free attempt, which is what bounds the cost per guide.
    const free = claimFreeExplainAttempt(studyGuideId)

    return {
      ...parseExplainCheckResult(
        await callHostedAiModel({
          surface: free ? HOSTED_FREE_SURFACE : HOSTED_PAID_SURFACE,
          stage: 'study_guide_mastery_check',
          outputLanguage,
          parts: [{ text: prompt }],
          responseSchema: EXPLAIN_CHECK_SCHEMA,
          timeoutMs: 60 * 1000,
          signal,
        }),
      ),
      cost: free ? 'free' : 'credit',
    }
  }

  if (!isStrongAiProvider(provider)) {
    throw new Error(`Unknown AI provider: ${provider}`)
  }

  const credentials = resolveQuickCreateAiCredentials(provider)
  if (!credentials.apiToken) {
    throw new Error(
      'This AI mode needs a configured provider key. Open the AI mode selector and add one, or switch to Hosted AI.',
    )
  }

  return {
    ...parseExplainCheckResult(
      await callStrongAiModel({
        provider,
        apiToken: credentials.apiToken,
        model: credentials.model,
        outputLanguage,
        parts: [{ text: prompt }],
        responseSchema: EXPLAIN_CHECK_SCHEMA,
        timeoutMs: 60 * 1000,
        signal,
      }),
    ),
    cost: 'free',
  }
}
