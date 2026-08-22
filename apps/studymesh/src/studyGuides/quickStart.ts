import type {
  StudyGuideQuickStart,
  StudyGuideQuickStartVariant,
} from '../state/store'
import {
  createAiOutputLanguageInstruction,
  type StudyMeshLanguageCode,
} from '../language/contentLanguagePrompt'
import {
  sanitizeUserKnownTopics,
  USER_KNOWN_TOPICS_DIRECT_MAX,
} from '../profileContext'

export const STUDY_GUIDE_KEY_IDEA_MAX_WORDS = 35
export const STUDY_GUIDE_QUICK_SUMMARY_MAX_WORDS = 120
const STUDY_GUIDE_QUICK_SUMMARY_SENTENCE_OVERFLOW_WORDS = 24
const STUDY_GUIDE_BRIDGE_BODY_SOFT_MAX_CHARS = 700
const STUDY_GUIDE_BRIDGE_TITLE_MAX_CHARS = 80

const markdownFencePattern = /^```(?:\w+)?\s*|\s*```$/g
const completeSentenceEndPattern = /[.!?]["')\]]?$/
const quickStartTargetTopicTypes = [
  'technical',
  'human_management',
  'general',
] as const
const studyGuideBridgeModes = ['auto', 'force'] as const

export type StudyGuideQuickStartTargetTopicType =
  (typeof quickStartTargetTopicTypes)[number]

// Strength and strategy are derived in code now, so neither needs a runtime
// enum array: nothing validates a model-supplied value against them.
export type StudyGuideQuickStartBridgeStrength = 'none' | 'weak' | 'strong'

export type StudyGuideQuickStartBridgeStrategy =
  | 'direct_comparison'
  | 'analogy_skeleton'
  | 'light_reference'
  | 'none'

export type StudyGuideBridgeMode = (typeof studyGuideBridgeModes)[number]

export const normalizeStudyGuideBridgeMode = (
  value: unknown,
): StudyGuideBridgeMode => (value === 'force' ? 'force' : 'auto')

const bridgeCorrespondenceKinds = ['part', 'process'] as const

export type StudyGuideBridgeCorrespondenceKind =
  (typeof bridgeCorrespondenceKinds)[number]

/** One mapped pair between a known topic and the new topic. */
export interface StudyGuideBridgeCorrespondence {
  knownSide: string
  targetSide: string
  carries: string
  kind: StudyGuideBridgeCorrespondenceKind
  /**
   * Swap test: another domain the same pair would fit, or "none". Measured and
   * found too generous to gate on, because a model asked to name a domain names
   * one. Kept because it is recorded per pair and `tests/live/sweepRules.ts`
   * needs it to re-tune the thresholds against fresh runs.
   */
  alsoWorksFor: string
  /** Diagnostic, not a gate: alsoWorksFor came back "none". */
  passesSwapTest: boolean
  /** Diagnostic, not a gate: neither side's head noun is a shared-property word. */
  isConcrete: boolean
  /** Diagnostic, not a gate: both of the above agree. */
  isSpecific: boolean
}

export const STUDY_GUIDE_BRIDGE_STRONG_MIN_CORRESPONDENCES = 3
export const STUDY_GUIDE_BRIDGE_MAX_CORRESPONDENCES = 6
const STUDY_GUIDE_BRIDGE_SIDE_MAX_CHARS = 80
const STUDY_GUIDE_BRIDGE_CARRIES_MAX_CHARS = 120
const STUDY_GUIDE_BRIDGE_CARRIES_MIN_CHARS = 8

export const STUDY_GUIDE_BRIDGE_CORRESPONDENCE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      knownSide: { type: 'STRING' },
      targetSide: { type: 'STRING' },
      carries: { type: 'STRING' },
      kind: { type: 'STRING', enum: [...bridgeCorrespondenceKinds] },
      alsoWorksFor: { type: 'STRING' },
    },
    required: ['knownSide', 'targetSide', 'carries', 'kind', 'alsoWorksFor'],
  },
}

const genericSwapAnswers = new Set(['', 'none', 'n/a', 'na', 'nothing', '-'])

/**
 * Head nouns that name a shared property rather than a working part. A pair
 * built on one of these ("budget categories -> grammar categories") says only
 * that both things have categories, which is true of almost any two subjects.
 */
const abstractHeadNouns = new Set([
  'approach',
  'aspects',
  'categories',
  'category',
  'choices',
  'components',
  'concepts',
  'context',
  'data',
  'elements',
  'framework',
  'goals',
  'information',
  'management',
  'method',
  'organization',
  'organisation',
  'parts',
  'patterns',
  'planning',
  'principles',
  'process',
  'resources',
  'rules',
  'standards',
  'structure',
  'system',
  'systems',
  'things',
  'types',
  'values',
])

const hasAbstractHeadNoun = (value: string): boolean => {
  const words = value.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean)
  const head = words[words.length - 1]

  return Boolean(head) && abstractHeadNouns.has(head)
}

const normalizeBridgeSide = (value: unknown, maxChars: number): string =>
  (typeof value === 'string' ? value : '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars)

/**
 * Keeps only pairs that actually map two different things and say what the
 * mapping carries. A pair whose sides are the same word shares vocabulary
 * rather than mechanism, so it is dropped rather than counted.
 */
export const sanitizeStudyGuideBridgeCorrespondences = (
  value: unknown,
): StudyGuideBridgeCorrespondence[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const seenKnown = new Set<string>()
  const seenTarget = new Set<string>()

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null
      }

      const record = entry as Record<string, unknown>
      const knownSide = normalizeBridgeSide(
        record.knownSide,
        STUDY_GUIDE_BRIDGE_SIDE_MAX_CHARS,
      )
      const targetSide = normalizeBridgeSide(
        record.targetSide,
        STUDY_GUIDE_BRIDGE_SIDE_MAX_CHARS,
      )
      const carries = normalizeBridgeSide(
        record.carries,
        STUDY_GUIDE_BRIDGE_CARRIES_MAX_CHARS,
      )
      const kind: StudyGuideBridgeCorrespondenceKind =
        record.kind === 'process' ? 'process' : 'part'
      const alsoWorksFor = normalizeBridgeSide(
        record.alsoWorksFor,
        STUDY_GUIDE_BRIDGE_SIDE_MAX_CHARS,
      )

      if (
        !knownSide ||
        !targetSide ||
        carries.length < STUDY_GUIDE_BRIDGE_CARRIES_MIN_CHARS ||
        knownSide.toLowerCase() === targetSide.toLowerCase()
      ) {
        return null
      }

      // Two independent filters: the model's own swap answer, and a purely
      // mechanical check that neither side is built on a shared-property noun.
      const passesSwapTest = genericSwapAnswers.has(
        alsoWorksFor.toLowerCase().replace(/[.!]$/, ''),
      )
      const isConcrete =
        !hasAbstractHeadNoun(knownSide) && !hasAbstractHeadNoun(targetSide)

      return {
        knownSide,
        targetSide,
        carries,
        kind,
        alsoWorksFor,
        passesSwapTest,
        isConcrete,
        isSpecific: isConcrete && passesSwapTest,
      }
    })
    .filter((entry): entry is StudyGuideBridgeCorrespondence => Boolean(entry))
    .filter((entry) => {
      const knownKey = entry.knownSide.toLowerCase()
      const targetKey = entry.targetSide.toLowerCase()
      if (seenKnown.has(knownKey) || seenTarget.has(targetKey)) {
        return false
      }

      seenKnown.add(knownKey)
      seenTarget.add(targetKey)
      return true
    })
    .slice(0, STUDY_GUIDE_BRIDGE_MAX_CORRESPONDENCES)
}

export interface StudyGuideBridgeStrengthRule {
  minPairs: number
  /** Pairs transferring something that happens over time. */
  minProcessPairs: number
}

/**
 * Tuned against three independent sweeps of 42 live guides each (64/74/74%
 * strong, 14 of 15 labelled cases correct). Breadth is what separates a real
 * mapping from a shared property: a topic that only shares a property with the
 * target runs out of pairs after two or three, while a real one keeps going.
 *
 * Three alternatives were measured and rejected on the same data. Gating on the
 * model's own "would this pair fit another domain?" answer collapsed to ~10%
 * strong, because a model asked to name a domain always names one. Demanding a
 * second *process* pair dropped to 57% and produced false weaks: caffeine ->
 * locksmithing lists keyway, key cut, inserted key and jammed lock, all static
 * roles, and a good structural analogy should not be punished for that. Raising
 * only the pair count without any process requirement let purely static lists
 * through.
 */
export const STUDY_GUIDE_BRIDGE_STRENGTH_RULE: StudyGuideBridgeStrengthRule = {
  minPairs: 5,
  minProcessPairs: 1,
}

/**
 * Strength is derived, never asserted by the model. Counting mapped parts is a
 * listing task a small model does well; grading a bridge is a judgement task it
 * does badly, and it answered "weak" for every candidate when asked directly.
 */
export const deriveStudyGuideBridgeStrength = (
  correspondences: StudyGuideBridgeCorrespondence[],
  rule: StudyGuideBridgeStrengthRule = STUDY_GUIDE_BRIDGE_STRENGTH_RULE,
): StudyGuideQuickStartBridgeStrength => {
  if (!correspondences.length) {
    return 'none'
  }

  const processPairs = correspondences.filter(
    (entry) => entry.kind === 'process',
  )

  return correspondences.length >= rule.minPairs &&
    processPairs.length >= rule.minProcessPairs
    ? 'strong'
    : 'weak'
}

export const deriveStudyGuideBridgeStrategy = (
  strength: StudyGuideQuickStartBridgeStrength,
): StudyGuideQuickStartBridgeStrategy =>
  strength === 'strong'
    ? 'analogy_skeleton'
    : strength === 'weak'
    ? 'direct_comparison'
    : 'none'

export interface StudyGuideQuickStartRelevanceDecision {
  shouldUseKnownTopic: boolean
  knownTopicsForQuickStart: string[]
  /** Only ever a reason the bridge helps. Never a disclaimer. */
  knownTopicRelevanceReason: string
  targetTopicType: StudyGuideQuickStartTargetTopicType
  bridgeStrength: StudyGuideQuickStartBridgeStrength
  bridgeStrategy: StudyGuideQuickStartBridgeStrategy
  /** Mechanism parts of the new topic the bridge has to attach to. */
  targetParts: string[]
  /** Mapped pairs. Strength is derived from these, not asserted. */
  correspondences: StudyGuideBridgeCorrespondence[]
  /** 6-12 words on where the mapping stops. Only set when bridgeStrength is 'weak'. */
  weakFitReason?: string
}

export interface StudyGuideKnowledgeBridgeBlock {
  dashboardIndex: number
  title: string
  body: string
}

export type StudyGuideKnowledgeContextMode = 'none' | 'single' | 'multiple'

export interface StudyGuideKnowledgeContextPlan {
  mode: StudyGuideKnowledgeContextMode
  topics: string[]
  shouldRunAutoRelevance: boolean
  shouldRunForcedRelevanceSelector: boolean
  /**
   * True when there are more known topics than fit in one selection call.
   * Callers should run the known-topic prefilter pass first and swap the
   * plan's `topics` for its narrowed result before running the normal
   * relevance-selection call.
   */
  shouldRunKnownTopicPrefilter: boolean
}

export const resolveStudyGuideKnowledgeContextPlan = (
  userKnownTopics: unknown,
): StudyGuideKnowledgeContextPlan => {
  const topics = sanitizeUserKnownTopics(userKnownTopics)
  const mode =
    topics.length === 0 ? 'none' : topics.length === 1 ? 'single' : 'multiple'

  return {
    mode,
    topics,
    shouldRunAutoRelevance: topics.length > 0,
    shouldRunForcedRelevanceSelector: topics.length > 1,
    shouldRunKnownTopicPrefilter: topics.length > USER_KNOWN_TOPICS_DIRECT_MAX,
  }
}

export const STUDY_GUIDE_KNOWN_TOPIC_PREFILTER_MIN = 20
export const STUDY_GUIDE_KNOWN_TOPIC_PREFILTER_MAX = 30

export const STUDY_GUIDE_KNOWN_TOPIC_PREFILTER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    selectedTopics: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
  },
  required: ['selectedTopics'],
}

export const STUDY_GUIDE_QUICK_START_RELEVANCE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    targetParts: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    knownTopicsForQuickStart: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    correspondences: STUDY_GUIDE_BRIDGE_CORRESPONDENCE_SCHEMA,
    knownTopicRelevanceReason: { type: 'STRING' },
    breaksAt: { type: 'STRING' },
    targetTopicType: {
      type: 'STRING',
      enum: [...quickStartTargetTopicTypes],
    },
  },
  required: [
    'targetParts',
    'knownTopicsForQuickStart',
    'correspondences',
    'knownTopicRelevanceReason',
    'breaksAt',
    'targetTopicType',
  ],
}

export const STUDY_GUIDE_QUICK_START_SCHEMA = {
  type: 'OBJECT',
  properties: {
    keyIdea: { type: 'STRING' },
    quickSummary: { type: 'STRING' },
  },
  required: ['keyIdea', 'quickSummary'],
}

export const STUDY_GUIDE_KNOWLEDGE_BRIDGE_BLOCKS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    blocks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          dashboardIndex: { type: 'NUMBER' },
          title: { type: 'STRING' },
          body: { type: 'STRING' },
        },
        required: ['dashboardIndex', 'title', 'body'],
      },
    },
  },
  required: ['blocks'],
}

export const createNeutralStudyGuideQuickStartRelevanceDecision =
  (): StudyGuideQuickStartRelevanceDecision => ({
    shouldUseKnownTopic: false,
    knownTopicsForQuickStart: [],
    knownTopicRelevanceReason:
      'No provided known topic mapped onto the new topic.',
    targetTopicType: 'general',
    bridgeStrength: 'none',
    bridgeStrategy: 'none',
    targetParts: [],
    correspondences: [],
  })

/**
 * Force mode keeps whatever the audition found. It never downgrades a bridge to
 * 'weak' on its own: strength comes from the mapped correspondences, so a real
 * cross-domain match can still lead the Quick Start.
 */
export const ensureForcedStudyGuideQuickStartRelevanceDecision = (
  decision: StudyGuideQuickStartRelevanceDecision | undefined,
  userKnownTopics: string[] = [],
): StudyGuideQuickStartRelevanceDecision | undefined => {
  const safeTopics = sanitizeUserKnownTopics(userKnownTopics, { maxTopics: 4 })
  if (!safeTopics.length) {
    return undefined
  }

  if (
    decision?.shouldUseKnownTopic &&
    decision.knownTopicsForQuickStart.length
  ) {
    return decision
  }

  const base = decision || createNeutralStudyGuideQuickStartRelevanceDecision()
  const correspondences = base.correspondences || []
  const strength = deriveStudyGuideBridgeStrength(correspondences)

  return {
    ...base,
    shouldUseKnownTopic: true,
    knownTopicsForQuickStart: base.knownTopicsForQuickStart.length
      ? base.knownTopicsForQuickStart
      : safeTopics.slice(0, 1),
    // The base reason describes a declined bridge, so it must not survive into
    // a field the generator reads as "why this helps".
    knownTopicRelevanceReason: correspondences.length
      ? base.knownTopicRelevanceReason
      : 'Learner asked to see this topic through their own knowledge.',
    bridgeStrength: strength === 'none' ? 'weak' : strength,
    bridgeStrategy:
      strength === 'none' ? 'light_reference' : deriveStudyGuideBridgeStrategy(strength),
  }
}

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

    throw new Error('Study Guide Quick Start response was not JSON.')
  }
}

const stringValue = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

export const buildStudyGuideKnownTopicPrefilterPrompt = ({
  title,
  prompt,
  candidateTopics,
}: {
  title: string
  prompt: string
  candidateTopics: string[]
}): string => `The learner has too many known topics to pass directly to the next step. Narrow the candidate list down before topic selection runs.

Return strict JSON only:
{ "selectedTopics": string[] }

Rules:
- Choose only from the candidate list below. Never invent a topic. Copy each selected topic exactly as written.
- Select between ${STUDY_GUIDE_KNOWN_TOPIC_PREFILTER_MIN} and ${STUDY_GUIDE_KNOWN_TOPIC_PREFILTER_MAX} topics.
- Prefer topics that are, or could plausibly be, related to the Study Guide topic below, even as a loose or cross-domain comparison. When in doubt, include a topic rather than drop it.
- If fewer than ${STUDY_GUIDE_KNOWN_TOPIC_PREFILTER_MIN} candidates exist in total, return all of them.
- Order selectedTopics with the most likely-relevant topics first.
- Do not explain your choice. Do not write anything except the JSON object.

Study Guide title: ${title}
Learner prompt: ${prompt || title}

Candidate known topics (${candidateTopics.length} total):
${candidateTopics.join(', ')}`

export const parseStudyGuideKnownTopicPrefilterResult = (
  text: string,
  candidateTopics: string[],
): string[] => {
  const fallback = candidateTopics.slice(0, STUDY_GUIDE_KNOWN_TOPIC_PREFILTER_MAX)
  const candidateByLower = new Map(
    candidateTopics.map((topic) => [topic.toLowerCase(), topic]),
  )

  let parsed: unknown
  try {
    parsed = parseJsonObject(text)
  } catch {
    return fallback
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return fallback
  }

  const record = parsed as Record<string, unknown>
  const selected = Array.isArray(record.selectedTopics)
    ? record.selectedTopics
        .map((topic) => candidateByLower.get(stringValue(topic).toLowerCase()))
        .filter((topic): topic is string => Boolean(topic))
        .filter((topic, index, topics) => topics.indexOf(topic) === index)
    : []

  return selected.length
    ? selected.slice(0, STUDY_GUIDE_KNOWN_TOPIC_PREFILTER_MAX)
    : fallback
}

const stripTextLabels = (value: string): string =>
  value
    .replace(markdownFencePattern, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/^#{1,6}\s+/, '')
        .replace(/^[-*]\s+/, '')
        .replace(
          /^(?:Quick\s*Start|Key\s*Idea|Quick\s*Summary)\s*[:.-]?\s*/i,
          '',
        ),
    )
    .join('\n')
    .trim()

const wordsFromText = (value: string): string[] =>
  value.split(/\s+/).filter(Boolean)

const findCompleteSentenceWordCount = (
  words: string[],
  minWords: number,
): number | null => {
  for (
    let index = words.length - 1;
    index >= Math.max(0, minWords - 1);
    index -= 1
  ) {
    if (completeSentenceEndPattern.test(words[index])) {
      return index + 1
    }
  }

  return null
}

const clampParagraphToCompleteSentence = (
  paragraph: string,
  maxWords: number,
  overflowWords = 0,
): string => {
  const words = wordsFromText(paragraph)
  if (words.length <= maxWords) {
    return words.join(' ')
  }

  const overflowSlice = words.slice(0, maxWords + overflowWords)
  const overflowSentenceWordCount = findCompleteSentenceWordCount(
    overflowSlice,
    maxWords,
  )
  if (overflowSentenceWordCount) {
    return words.slice(0, overflowSentenceWordCount).join(' ')
  }

  const priorSentenceWordCount = findCompleteSentenceWordCount(
    words.slice(0, maxWords),
    1,
  )
  if (priorSentenceWordCount) {
    return words.slice(0, priorSentenceWordCount).join(' ')
  }

  // Word budgets are enforced in the prompts. When a model still overruns with
  // one unbroken sentence, keeping the overrun reads better than clipping it.
  return words.join(' ')
}

// keyIdea is one sentence, so prefer a sentence that ends inside the cap and
// otherwise keep the model's sentence whole rather than cutting it mid-thought.
const clampKeyIdeaToCompleteSentence = (value: string): string => {
  const words = wordsFromText(value)
  if (words.length <= STUDY_GUIDE_KEY_IDEA_MAX_WORDS) {
    return words.join(' ')
  }

  const withinCapWordCount = findCompleteSentenceWordCount(
    words.slice(0, STUDY_GUIDE_KEY_IDEA_MAX_WORDS),
    1,
  )
  if (withinCapWordCount) {
    return words.slice(0, withinCapWordCount).join(' ')
  }

  const overflowWordCount = findCompleteSentenceWordCount(
    words,
    STUDY_GUIDE_KEY_IDEA_MAX_WORDS,
  )
  return overflowWordCount
    ? words.slice(0, overflowWordCount).join(' ')
    : words.join(' ')
}

// Trims to the last sentence that ends within the budget. When the text has no
// sentence break in range it is kept whole, so bodies never end mid-word.
export const trimToCompleteSentenceWithinChars = (
  value: string,
  maxChars: number,
): string => {
  if (value.length <= maxChars) {
    return value
  }

  const sentenceEnd = value
    .slice(0, maxChars)
    .match(/^[\s\S]*[.!?]["')\]]?(?=\s|$)/)

  return sentenceEnd ? sentenceEnd[0].trim() : value
}

/**
 * A slug is every segment lowercase alphanumeric, so real hyphenated words
 * survive: "e-commerce" and "x-ray" keep their one-letter part, and anything
 * containing a space is already a written title.
 */
const isSlugShapedTitle = (value: string): boolean => {
  if (!value || /\s/.test(value) || !/[-_]/.test(value)) {
    return false
  }

  const segments = value.split(/[-_]/)

  return (
    segments.length > 1 &&
    segments.every(
      (segment) =>
        /^[a-z0-9]+$/.test(segment) &&
        (segment.length > 1 || /^[0-9]$/.test(segment)),
    )
  )
}

/**
 * Model titles arrive as prose, Title Case, or slugs. Slug separators become
 * spaces and only the first letter is forced, so whatever casing the model
 * chose for the remaining words survives.
 */
export const normalizeStudyGuideTitle = (value: unknown): string => {
  const raw = (typeof value === 'string' ? value : '')
    .replace(/\s+/g, ' ')
    .trim()
  const text = isSlugShapedTitle(raw) ? raw.split(/[-_]/).join(' ') : raw

  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : ''
}

export const trimTitleToWordBoundary = (
  value: string,
  maxChars: number,
): string => {
  if (value.length <= maxChars) {
    return value
  }

  return (
    value
      .slice(0, maxChars)
      .replace(/\s+\S*$/, '')
      .trim() || value
  )
}

const normalizeParagraphs = (value: string): string[] =>
  stripTextLabels(value)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

const isTargetTopicType = (
  value: unknown,
): value is StudyGuideQuickStartTargetTopicType =>
  typeof value === 'string' &&
  quickStartTargetTopicTypes.includes(
    value as StudyGuideQuickStartTargetTopicType,
  )

const sanitizeTargetParts = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [])
    .map((part) => normalizeBridgeSide(part, STUDY_GUIDE_BRIDGE_SIDE_MAX_CHARS))
    .filter(Boolean)
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .slice(0, 6)

export const parseStudyGuideQuickStartRelevanceDecision = (
  text: string,
  userKnownTopics: string[] = [],
): StudyGuideQuickStartRelevanceDecision => {
  const neutral = createNeutralStudyGuideQuickStartRelevanceDecision()
  const safeTopics = sanitizeUserKnownTopics(userKnownTopics)
  if (!safeTopics.length) {
    return neutral
  }

  let parsed: unknown
  try {
    parsed = parseJsonObject(text)
  } catch {
    return neutral
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return neutral
  }

  const record = parsed as Record<string, unknown>
  const safeTopicByLower = new Map(
    safeTopics.map((topic) => [topic.toLowerCase(), topic]),
  )
  const selectedTopics = Array.isArray(record.knownTopicsForQuickStart)
    ? record.knownTopicsForQuickStart
        .map((topic) => safeTopicByLower.get(stringValue(topic).toLowerCase()))
        .filter((topic): topic is string => Boolean(topic))
        .filter((topic, index, topics) => topics.indexOf(topic) === index)
        .slice(0, 2)
    : []
  const targetTopicType = isTargetTopicType(record.targetTopicType)
    ? record.targetTopicType
    : neutral.targetTopicType
  const correspondences = sanitizeStudyGuideBridgeCorrespondences(
    record.correspondences,
  )
  const bridgeStrength = deriveStudyGuideBridgeStrength(correspondences)
  const shouldUseKnownTopic =
    selectedTopics.length > 0 && bridgeStrength !== 'none'

  if (!shouldUseKnownTopic) {
    return {
      ...neutral,
      targetTopicType,
      targetParts: sanitizeTargetParts(record.targetParts),
    }
  }

  const weakFitReason =
    bridgeStrength === 'weak'
      ? trimTitleToWordBoundary(stringValue(record.breaksAt), 90)
      : ''

  return {
    shouldUseKnownTopic,
    knownTopicsForQuickStart: selectedTopics,
    knownTopicRelevanceReason:
      stringValue(record.knownTopicRelevanceReason).slice(0, 240) ||
      'The selected topic maps onto how the new topic works.',
    ...(weakFitReason ? { weakFitReason } : {}),
    targetTopicType,
    bridgeStrength,
    bridgeStrategy: deriveStudyGuideBridgeStrategy(bridgeStrength),
    targetParts: sanitizeTargetParts(record.targetParts),
    correspondences,
  }
}

const sanitizeStudyGuideQuickStartVariant = (
  value: Partial<StudyGuideQuickStartVariant> | null | undefined,
): StudyGuideQuickStartVariant | null => {
  const keyIdea = clampKeyIdeaToCompleteSentence(
    stripTextLabels(String(value?.keyIdea || ''))
      .replace(/\s+/g, ' ')
      .trim(),
  )
  const quickSummary = normalizeParagraphs(String(value?.quickSummary || ''))
    .reduce<{ paragraphs: string[]; remainingWords: number }>(
      (state, paragraph) => {
        if (state.remainingWords <= 0) {
          return state
        }

        const paragraphWords = wordsFromText(paragraph)
        const usedText =
          paragraphWords.length <= state.remainingWords
            ? paragraphWords.join(' ')
            : clampParagraphToCompleteSentence(
                paragraph,
                state.remainingWords,
                STUDY_GUIDE_QUICK_SUMMARY_SENTENCE_OVERFLOW_WORDS,
              )
        const usedWords = wordsFromText(usedText)
        return {
          paragraphs: usedText
            ? [...state.paragraphs, usedText]
            : state.paragraphs,
          remainingWords: Math.max(0, state.remainingWords - usedWords.length),
        }
      },
      { paragraphs: [], remainingWords: STUDY_GUIDE_QUICK_SUMMARY_MAX_WORDS },
    )
    .paragraphs.filter(Boolean)
    .join('\n\n')

  if (!keyIdea || !quickSummary) {
    return null
  }

  const bridgeTopics = sanitizeUserKnownTopics(value?.bridgeTopics, {
    maxTopics: 2,
  })
  const weakFitReason = bridgeTopics.length
    ? trimTitleToWordBoundary(String(value?.weakFitReason || ''), 90)
    : ''

  return bridgeTopics.length
    ? {
        keyIdea,
        quickSummary,
        bridgeTopics,
        ...(weakFitReason ? { weakFitReason } : {}),
      }
    : { keyIdea, quickSummary }
}

export const sanitizeStudyGuideQuickStart = (
  value: Partial<StudyGuideQuickStart> | null | undefined,
): StudyGuideQuickStart | null => {
  const base = sanitizeStudyGuideQuickStartVariant(value)
  if (!base) {
    return null
  }

  const forcedBridge = sanitizeStudyGuideQuickStartVariant(value?.forcedBridge)
  return forcedBridge ? { ...base, forcedBridge } : base
}

export const parseStudyGuideQuickStart = (
  text: string,
): StudyGuideQuickStart | null => {
  let parsed: unknown
  try {
    parsed = parseJsonObject(text)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }

  return sanitizeStudyGuideQuickStart(parsed as Partial<StudyGuideQuickStart>)
}

export const parseStudyGuideKnowledgeBridgeBlocks = (
  text: string,
  dashboardCount: number,
  allowedDashboardIndexes?: number[],
): StudyGuideKnowledgeBridgeBlock[] => {
  let parsed: unknown
  try {
    parsed = parseJsonObject(text)
  } catch {
    return []
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return []
  }

  const blocks = Array.isArray((parsed as Record<string, unknown>).blocks)
    ? (parsed as Record<string, unknown>).blocks
    : []
  const usedIndexes = new Set<number>()
  const allowedIndexes = Array.isArray(allowedDashboardIndexes)
    ? new Set(allowedDashboardIndexes)
    : null

  return blocks
    .map((block) => {
      if (!block || typeof block !== 'object' || Array.isArray(block)) {
        return null
      }

      const record = block as Record<string, unknown>
      const dashboardIndex =
        typeof record.dashboardIndex === 'number'
          ? Math.trunc(record.dashboardIndex)
          : -1
      const title = trimTitleToWordBoundary(
        stripTextLabels(stringValue(record.title)).replace(/\s+/g, ' ').trim(),
        STUDY_GUIDE_BRIDGE_TITLE_MAX_CHARS,
      )
      const body = trimToCompleteSentenceWithinChars(
        stripTextLabels(stringValue(record.body))
          .replace(/\n{3,}/g, '\n\n')
          .trim(),
        STUDY_GUIDE_BRIDGE_BODY_SOFT_MAX_CHARS,
      )

      if (
        dashboardIndex < 0 ||
        dashboardIndex >= dashboardCount ||
        (allowedIndexes && !allowedIndexes.has(dashboardIndex)) ||
        usedIndexes.has(dashboardIndex) ||
        !title ||
        !body
      ) {
        return null
      }

      usedIndexes.add(dashboardIndex)
      return { dashboardIndex, title, body }
    })
    .filter((block): block is StudyGuideKnowledgeBridgeBlock => Boolean(block))
    .slice(0, 2)
}

export const buildStudyGuideQuickStartPrompt = ({
  title,
  source,
  relevanceDecision,
  bridgeMode = 'auto',
  outputLanguage,
}: {
  title: string
  source: string
  relevanceDecision?: StudyGuideQuickStartRelevanceDecision
  bridgeMode?: StudyGuideBridgeMode
  outputLanguage?: StudyMeshLanguageCode
}): string => {
  const decision =
    relevanceDecision || createNeutralStudyGuideQuickStartRelevanceDecision()
  const mode = normalizeStudyGuideBridgeMode(bridgeMode)
  const forcedBridge = mode === 'force'
  const selectedTopics = sanitizeUserKnownTopics(
    decision.knownTopicsForQuickStart,
    {
      maxTopics: forcedBridge ? 4 : 2,
    },
  )
  const shouldUseKnownTopic =
    decision.shouldUseKnownTopic && selectedTopics.length > 0

  return `Create one Quick Start object for the full Study Guide "${title}".

Return strict JSON only:
{
  "keyIdea": "one sentence, maximum 35 words, ideally 25-35 words",
  "quickSummary": "2-3 short paragraphs, 70-100 words total"
}

Rules:
- ${createAiOutputLanguageInstruction(outputLanguage)}
- keyIdea: one direct mental model of the topic. No Markdown. No label.
- keyIdea must explain the category or mental box the topic belongs to, not internal architecture.
- keyIdea introduces at most 1 technical term, avoids listing components, and avoids implementation details unless they are the essence of the concept.
- Prefer "what is this like or for?" over "how does it work internally?".
- quickSummary: 2-3 short paragraphs separated by blank lines, under 100 words total.
- Every quickSummary paragraph must end as a complete sentence.
- If the word target is tight, finish the current sentence cleanly instead of ending mid-thought.
- Prefer a shorter complete summary over using the full limit.
- Explain the concept itself directly. Do not summarize the guide structure, sections, or page order.
- Do not write "This guide teaches...", "This guide explains...", "This page explains...", "You will learn...", or similar framing.
- Introduce at most 2-3 new technical terms. Prefer plain words for everything else.
- Avoid analogies that share only a label or a mood. An analogy earns its place by transferring a mechanism.
- Bridge mode: ${mode}.
${
  shouldUseKnownTopic
    ? `- Explain this through what the learner already knows: ${selectedTopics.join(
        ', ',
      )}.
- What the mapping lets them reuse: ${decision.knownTopicRelevanceReason}
- Bridge strength: ${decision.bridgeStrength}.
${
  decision.correspondences?.length
    ? `- Use these mapped pairs. They are the explanation, not decoration:
${decision.correspondences
  .map(
    (pair) =>
      `  - ${pair.knownSide} -> ${pair.targetSide} (carries: ${pair.carries})`,
  )
  .join('\n')}
- Run at least ${
        decision.bridgeStrength === 'strong' ? 'three' : 'one'
      } of those pairs inside quickSummary, in the known topic's own vocabulary.`
    : `- No pairs were mapped in advance. Keep the known topic to one concrete mention.`
}
${
  decision.bridgeStrength === 'strong'
    ? `- keyIdea must be stated in the known topic's terms. The learner should meet the mapping in the first sentence, not at the end.
- Do not hedge the mapping. It was verified before reaching you.`
    : `- keyIdea stays neutral. Explain the topic directly first, then bring the known topic in as one concrete comparison.
${
  decision.weakFitReason
    ? `- You may spend at most one short clause on where the mapping stops: ${decision.weakFitReason}`
    : `- You may spend at most one short clause on where the mapping stops.`
}`
}
- Write as if the mapping is simply true. Never write about the comparison itself: no "the comparison", "the analogy", "this comparison is limited", "the comparison breaks down", "provides only a limited comparison", "unlike the mechanisms involved in".
- Never offer the two subjects being different kinds of thing as a limitation. Every explanation through a known topic crosses subjects; saying so teaches nothing.
- Any caveat in quickSummary must be about the topic itself (a boundary, a common misconception, something the learner would get wrong), not about the known topic being imperfect.`
    : forcedBridge
    ? `- Force bridge was requested, but no known topic mapped onto this one. Use a neutral beginner-friendly explanation.
- Do not invent a bridge. Include one brief caveat, boundary, or common misconception about the topic in quickSummary.`
    : `- No known topic mapped onto this one. Do not force a personalized analogy.
- Use a neutral beginner-friendly explanation and include one brief caveat, boundary, or common misconception about the topic in quickSummary.`
}
- Target topic type: ${decision.targetTopicType}.
- If this is a human or management topic, do not compare people to infrastructure, tools, machines, or deployment systems.
- Good bridge shape: the known topic's parts do the same jobs as the new topic's parts, so the learner can predict how the new one behaves.
- Bad bridge shape: starting with low-level internals, trivia, implementation mechanisms, or a comparison that only shares vocabulary.

Final Study Guide content:
${source.slice(0, 60000)}`
}

export const buildStudyGuideQuickStartRelevancePrompt = ({
  title,
  prompt,
  source,
  userKnownTopics = [],
  bridgeMode = 'auto',
  outputLanguage,
}: {
  title: string
  prompt: string
  source: string
  userKnownTopics?: string[]
  bridgeMode?: StudyGuideBridgeMode
  outputLanguage?: StudyMeshLanguageCode
}): string => {
  const safeTopics = sanitizeUserKnownTopics(userKnownTopics)
  const mode = normalizeStudyGuideBridgeMode(bridgeMode)

  return `Map the Study Guide topic onto one topic the learner already knows. You are not writing the Quick Start and you are not rating the bridge. You are listing the parts that map.

Return strict JSON only with this shape:
{
  "targetParts": string[],
  "knownTopicsForQuickStart": string[],
  "correspondences": [
    { "knownSide": "...", "targetSide": "...", "carries": "...", "kind": "part" | "process", "alsoWorksFor": "..." }
  ],
  "knownTopicRelevanceReason": string,
  "breaksAt": string,
  "targetTopicType": "technical" | "human_management" | "general"
}

Step 1 - targetParts:
- ${createAiOutputLanguageInstruction(outputLanguage)}
- List 3-5 moving parts of the Study Guide topic: the things that act, the things acted on, and what changes over time.
- Take them from the content excerpt below, not from general impressions of the subject.
- Write each part as a short concrete noun phrase. No full sentences.

Step 2 - pick one known topic:
- Choose only from the provided known topics. Never invent one.
- Pick the single candidate whose own moving parts line up with the most targetParts. Use 2 only when both add different mappings.
- Cross-domain is allowed and often best. A locksmith's lock and key can map onto a molecular receptor; a household budget can map onto an energy balance. Do not reject a candidate for coming from a different field.
- Judge candidates only on whether their parts map. Do not judge them on being broad, narrow, technical, everyday, or unrelated-sounding.

Step 3 - correspondences (this is the real output):
- Once you have chosen, map that candidate as completely as you can. List every pair that holds, not only the first one or two, and work through each targetPart in turn before stopping. Extra candidates must not cost the chosen one depth.
- One entry per matched pair, up to ${STUDY_GUIDE_BRIDGE_MAX_CORRESPONDENCES}.
- knownSide: the specific part inside the known topic. targetSide: the part inside the Study Guide topic it maps to.
- carries: what the pair transfers, in a few words. State the role or the causal job, not the resemblance.
- kind: "process" when the pair transfers something that happens over time (a change, a build-up, a feedback, an adaptation); "part" when it transfers a fixed role or component.
- Label kind honestly. "process" only when something changes, accumulates, decays, or feeds back over time. A fixed role or component is "part". Never label a static role as a process to make the mapping look richer.
- alsoWorksFor: does the knownSide depend on something that exists only in this known topic? If yes, answer "none". If the knownSide is a general idea that any subject could supply, name one other everyday domain that supplies it just as well.
- Worked example. "budget categories -> grammar categories" leans on the general idea of having categories, which filing cabinets and wardrobes supply too, so alsoWorksFor is "filing cabinets". "a key's cut -> a verb ending" leans on a cut, which exists only in locks and keys, so alsoWorksFor is "none".
- A pair only counts when knowing the known side lets the learner predict how the target side behaves. Naming a shared property is not predicting behaviour.
- Do not write a pair whose two sides are the same word, or that only shares a label, a mood, or a general theme.
- Prefer concrete nouns on the known side. Pairs built from abstract words like "categories", "choices", "resources", "structure", or "standards" are almost always swap-test failures.
- Return [] when nothing genuinely maps. An empty list is a correct and useful answer.
- Bridge mode: ${mode}. In force mode, still return [] rather than inventing pairs; the caller handles the empty case.

Other fields:
- knownTopicRelevanceReason: one short sentence on what the mapping lets the learner reuse. Only ever a reason it helps. Never a caveat, never a disclaimer, never a limitation.
- breaksAt: 6-12 words naming the first place the mapping stops being true, in terms of the two topics' own parts.
- breaksAt must never be "different fields", "one is physical and one is biological", "these are made of different things", or any variation on the two subjects being different kinds of thing. That is true of every mapping and says nothing.
- targetTopicType: for human or management targets, do not map people onto machines, infrastructure, or tools.
- Do not write the Quick Start. Do not explain the topic.

Study Guide title: ${title}
Learner prompt: ${prompt || title}
Known topics, most recently learned first: ${
    safeTopics.length ? safeTopics.join(', ') : 'none'
  }

Study Guide content excerpt:
${source.slice(0, 12000)}`
}

export const buildStudyGuideKnowledgeBridgeBlocksPrompt = ({
  title,
  prompt,
  dashboards,
  relevanceDecision,
  bridgeMode = 'auto',
  outputLanguage,
}: {
  title: string
  prompt: string
  dashboards: Array<{
    dashboardIndex?: number
    title: string
    summary?: string
    rawNotes?: string
  }>
  relevanceDecision?: StudyGuideQuickStartRelevanceDecision
  bridgeMode?: StudyGuideBridgeMode
  outputLanguage?: StudyMeshLanguageCode
}): string => {
  const decision =
    relevanceDecision || createNeutralStudyGuideQuickStartRelevanceDecision()
  const mode = normalizeStudyGuideBridgeMode(bridgeMode)
  const selectedTopics = sanitizeUserKnownTopics(
    decision.knownTopicsForQuickStart,
    { maxTopics: 2 },
  )

  if (!decision.shouldUseKnownTopic || selectedTopics.length === 0) {
    return `Return strict JSON only: {"blocks":[]}`
  }

  const dashboardExcerpt = dashboards
    .map((dashboard, index) =>
      [
        `dashboardIndex: ${dashboard.dashboardIndex ?? index}`,
        `title: ${dashboard.title || `Dashboard ${index + 1}`}`,
        dashboard.summary ? `summary: ${dashboard.summary}` : '',
        dashboard.rawNotes
          ? `notes excerpt: ${dashboard.rawNotes.slice(0, 1200)}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n---\n\n')

  return `Create optional knowledge-context bridge note blocks for a RabbitHole Study Guide.

Return strict JSON only:
{
  "blocks": [
    {
      "dashboardIndex": 0,
      "title": "short note title",
      "body": "60-85 words"
    }
  ]
}

Rules:
- ${createAiOutputLanguageInstruction(outputLanguage)}
- The base Study Guide already exists. Do not rewrite lessons.
- Bridge mode: ${mode}.
- Selected known topic bridge: ${selectedTopics.join(', ')}.
- Bridge reason: ${decision.knownTopicRelevanceReason}
- Bridge strength: ${decision.bridgeStrength}.
- Bridge strategy: ${decision.bridgeStrategy}.
- The dashboards below are already eligible for bridge notes. Do not mention first-page or quiz-page placement rules.
- Auto mode: add 0-2 blocks total. Return [] if no dashboard has a natural bridge.
- Force mode: add 1 block when a safe bridge can help one eligible dashboard; return [] only when every possible bridge would mislead.
- Use each dashboardIndex at most once. dashboardIndex is zero-based.
- Each block must connect one freshly taught concept to the selected known topic.
- Keep body short, concrete, and note-like: under 85 words.
- End each body with a complete sentence, never mid-thought.
- Do not repeat the Quick Start.
- Do not force analogies. If bridge strength is weak, use at most one light reference.
- Write as if the mapping is true. Do not write about the comparison itself, and never offer the two subjects being different kinds of thing as a limitation.
- Add a caveat only when a learner would draw a specific wrong conclusion, and make it about the topic.
- For topics involving identity, history, politics, culture, or people, keep the bridge factual and avoid reductive claims.

Study Guide title: ${title}
Learner prompt: ${prompt || title}

Dashboards:
${dashboardExcerpt.slice(0, 16000)}`
}
