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
const quickStartBridgeStrengths = ['none', 'weak', 'strong'] as const
const quickStartBridgeStrategies = [
  'direct_comparison',
  'analogy_skeleton',
  'light_reference',
  'none',
] as const
const studyGuideBridgeModes = ['auto', 'force'] as const

export type StudyGuideQuickStartTargetTopicType =
  (typeof quickStartTargetTopicTypes)[number]

export type StudyGuideQuickStartBridgeStrength =
  (typeof quickStartBridgeStrengths)[number]

export type StudyGuideQuickStartBridgeStrategy =
  (typeof quickStartBridgeStrategies)[number]

export type StudyGuideBridgeMode = (typeof studyGuideBridgeModes)[number]

export const normalizeStudyGuideBridgeMode = (
  value: unknown,
): StudyGuideBridgeMode => (value === 'force' ? 'force' : 'auto')

export interface StudyGuideQuickStartRelevanceDecision {
  shouldUseKnownTopic: boolean
  knownTopicsForQuickStart: string[]
  knownTopicRelevanceReason: string
  targetTopicType: StudyGuideQuickStartTargetTopicType
  bridgeStrength: StudyGuideQuickStartBridgeStrength
  bridgeStrategy: StudyGuideQuickStartBridgeStrategy
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
    shouldUseKnownTopic: { type: 'BOOLEAN' },
    knownTopicsForQuickStart: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    knownTopicRelevanceReason: { type: 'STRING' },
    targetTopicType: {
      type: 'STRING',
      enum: [...quickStartTargetTopicTypes],
    },
    bridgeStrength: {
      type: 'STRING',
      enum: [...quickStartBridgeStrengths],
    },
    bridgeStrategy: {
      type: 'STRING',
      enum: [...quickStartBridgeStrategies],
    },
  },
  required: [
    'shouldUseKnownTopic',
    'knownTopicsForQuickStart',
    'knownTopicRelevanceReason',
    'targetTopicType',
    'bridgeStrength',
    'bridgeStrategy',
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
      'No provided known topic was selected as a clear cognitive bridge.',
    targetTopicType: 'general',
    bridgeStrength: 'none',
    bridgeStrategy: 'none',
  })

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

  return {
    ...(decision || createNeutralStudyGuideQuickStartRelevanceDecision()),
    shouldUseKnownTopic: true,
    knownTopicsForQuickStart: safeTopics,
    knownTopicRelevanceReason:
      'Learner-context view requested. Choose the closest available learner context from these candidates, but frame the bridge as weak if the match is imperfect.',
    bridgeStrength: 'weak',
    bridgeStrategy: 'light_reference',
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

const isBridgeStrength = (
  value: unknown,
): value is StudyGuideQuickStartBridgeStrength =>
  typeof value === 'string' &&
  quickStartBridgeStrengths.includes(
    value as StudyGuideQuickStartBridgeStrength,
  )

const isBridgeStrategy = (
  value: unknown,
): value is StudyGuideQuickStartBridgeStrategy =>
  typeof value === 'string' &&
  quickStartBridgeStrategies.includes(
    value as StudyGuideQuickStartBridgeStrategy,
  )

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
  const bridgeStrength = isBridgeStrength(record.bridgeStrength)
    ? record.bridgeStrength
    : neutral.bridgeStrength
  const bridgeStrategy = isBridgeStrategy(record.bridgeStrategy)
    ? record.bridgeStrategy
    : neutral.bridgeStrategy
  const shouldUseKnownTopic =
    record.shouldUseKnownTopic === true &&
    selectedTopics.length > 0 &&
    bridgeStrength !== 'none' &&
    bridgeStrategy !== 'none'

  if (!shouldUseKnownTopic) {
    return {
      ...neutral,
      targetTopicType: isTargetTopicType(record.targetTopicType)
        ? record.targetTopicType
        : neutral.targetTopicType,
      knownTopicRelevanceReason:
        stringValue(record.knownTopicRelevanceReason).slice(0, 240) ||
        neutral.knownTopicRelevanceReason,
    }
  }

  return {
    shouldUseKnownTopic,
    knownTopicsForQuickStart: selectedTopics,
    knownTopicRelevanceReason:
      stringValue(record.knownTopicRelevanceReason).slice(0, 240) ||
      'Selected known topic is a direct cognitive bridge.',
    targetTopicType: isTargetTopicType(record.targetTopicType)
      ? record.targetTopicType
      : neutral.targetTopicType,
    bridgeStrength,
    bridgeStrategy:
      bridgeStrength === 'weak' && bridgeStrategy !== 'light_reference'
        ? 'light_reference'
        : bridgeStrategy,
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

  return { keyIdea, quickSummary }
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
- Avoid cute, random, or decorative analogies when a direct explanation or direct comparison is clearer.
- Bridge mode: ${mode}.
${
  shouldUseKnownTopic
    ? `- Candidate known topic bridge(s): ${selectedTopics.join(', ')}.
- Why this bridge helps: ${decision.knownTopicRelevanceReason}
- Bridge strength: ${decision.bridgeStrength}.
- Bridge strategy: ${decision.bridgeStrategy}.
- If bridge mode is force and multiple candidate topics are listed, choose the single candidate that best reduces confusion for this target topic; do not use the first candidate by default.
- If bridge strength is strong, the selected known topic must lead the Quick Start. Do not save it for a final caveat.
- If bridge mode is force and bridge strength is weak, keep keyIdea neutral, explain the topic directly first, then use the selected topic as a short contrast in quickSummary.
- If bridge mode is force, state where the comparison breaks. Do not pretend a weak bridge is exact.
- If bridge strategy is analogy_skeleton, start from the known topic, sustain the mapping through the explanation, then briefly say where the analogy breaks.
- If bridge strategy is direct_comparison, compare the new concept directly with the selected known topic.
- If bridge strategy is light_reference, use a normal explanation and mention the known topic at most once.
- Include one brief caveat about where the comparison breaks in quickSummary.`
    : forcedBridge
    ? `- Force bridge was requested, but no safe known topic was selected. Use a neutral beginner-friendly explanation.
- Do not invent a bridge. Include one brief caveat, boundary, or common misconception in quickSummary.`
    : `- No known topic was selected as clearly useful. Do not force a personalized analogy.
- Use a neutral beginner-friendly explanation and include one brief caveat, boundary, or common misconception in quickSummary.`
}
- Target topic type: ${decision.targetTopicType}.
- If this is a human or management topic, do not compare people to infrastructure, tools, machines, or deployment systems.
- Good bridge shape: "The new topic is in the same family as the known topic, but differs in this one important boundary."
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

  return `Choose whether any known topic should be used to explain the Study Guide topic in its Quick Start.

Return strict JSON only with this shape:
{
  "shouldUseKnownTopic": boolean,
  "knownTopicsForQuickStart": string[],
  "knownTopicRelevanceReason": string,
  "targetTopicType": "technical" | "human_management" | "general",
  "bridgeStrength": "none" | "weak" | "strong",
  "bridgeStrategy": "direct_comparison" | "analogy_skeleton" | "light_reference" | "none"
}

Decision rules:
- ${createAiOutputLanguageInstruction(outputLanguage)}
- Bridge mode: ${mode}.
- Goal: reduce learner cognitive effort, not personalize every Quick Start.
- Choose only from provided known topics. Never invent a known topic.
- Use at most 1 known topic. Use 2 only when both are clearly relevant and same-domain.
- Prefer same-domain direct comparisons over creative metaphors.
- A strong bridge means the Quick Start should be built through the selected known topic, not mention it as a footnote.
- A weak bridge means the topic may be mentioned lightly once, but the Quick Start should mostly be neutral.
- No useful bridge means ignore userKnownTopics completely.
- Technical target + directly related technical known topic: select the best direct comparison.
- Technical target + unrelated technical known topic: ignore it.
- Use direct_comparison when the known topic and target topic share a domain, purpose, or problem space and the difference can be stated precisely.
- Prefer specific topics over broad categories when both are provided and relevant.
- Prefer a narrower domain bridge over a broad category bridge.
- Use analogy_skeleton only when the known topic maps structurally to the new concept across multiple parts and the limits are easy to state.
- Use light_reference only for weak but genuinely helpful bridges.
- Human or management target: avoid infrastructure/tool analogies unless explicitly requested.
- Auto mode: if no topic clearly helps, set shouldUseKnownTopic false, knownTopicsForQuickStart [], bridgeStrength "none", and bridgeStrategy "none".
- Force mode: the user explicitly wants the closest useful bridge from their knowledge. Rank the provided known topics by usefulness and select the least-bad bridge, even when the bridge is only weak.
- Force mode: do not return no bridge merely because every option is imperfect. Return no bridge only if every available comparison would actively mislead the learner, be unsafe, or be dehumanizing.
- Force mode: if the bridge is weak but still useful as a contrast, select it with bridgeStrength "weak" and bridgeStrategy "light_reference"; explain in knownTopicRelevanceReason that it is imperfect.
- Force mode: interpret learner topic wording flexibly, but do not use hidden hardcoded topic-pair rules.
- Do not write the Quick Start.

Generic examples:
- Target "specific tool or concept", known ["same-domain predecessor or alternative", "unrelated tool"]: select the same-domain predecessor or alternative only.
- Target "process with parts and flow", known ["structurally similar process"]: select it only when the mapping helps more than a direct explanation.
- Target "human or social topic", known ["infrastructure tool"]: select none unless the user explicitly asks for that metaphor.
- Target "narrow domain topic", known ["broad category", "specific related topic"]: select the specific related topic only.

Study Guide title: ${title}
Learner prompt: ${prompt || title}
Known topics, strongest first: ${
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
- Do not force analogies. If bridge is only weak, use at most one light reference.
- Include one caveat when the comparison could mislead.
- For topics involving identity, history, politics, culture, or people, keep the bridge factual and avoid reductive claims.

Study Guide title: ${title}
Learner prompt: ${prompt || title}

Dashboards:
${dashboardExcerpt.slice(0, 16000)}`
}
