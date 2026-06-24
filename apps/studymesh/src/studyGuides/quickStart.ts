import type { StudyGuideQuickStart } from '../state/store'
import { sanitizeUserKnownTopics } from '../profileContext'

export const STUDY_GUIDE_KEY_IDEA_MAX_WORDS = 35
export const STUDY_GUIDE_QUICK_SUMMARY_MAX_WORDS = 120

const markdownFencePattern = /^```(?:\w+)?\s*|\s*```$/g
const quickStartTargetTopicTypes = [
  'technical',
  'human_management',
  'general',
] as const
const quickStartComparisonStyles = [
  'direct_comparison',
  'neutral_explanation',
] as const

export type StudyGuideQuickStartTargetTopicType =
  (typeof quickStartTargetTopicTypes)[number]

export type StudyGuideQuickStartComparisonStyle =
  (typeof quickStartComparisonStyles)[number]

export interface StudyGuideQuickStartRelevanceDecision {
  shouldUseKnownTopic: boolean
  knownTopicsForQuickStart: string[]
  knownTopicRelevanceReason: string
  targetTopicType: StudyGuideQuickStartTargetTopicType
  comparisonStyle: StudyGuideQuickStartComparisonStyle
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
    comparisonStyle: {
      type: 'STRING',
      enum: [...quickStartComparisonStyles],
    },
  },
  required: [
    'shouldUseKnownTopic',
    'knownTopicsForQuickStart',
    'knownTopicRelevanceReason',
    'targetTopicType',
    'comparisonStyle',
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

export const createNeutralStudyGuideQuickStartRelevanceDecision =
  (): StudyGuideQuickStartRelevanceDecision => ({
    shouldUseKnownTopic: false,
    knownTopicsForQuickStart: [],
    knownTopicRelevanceReason:
      'No provided known topic was selected as a clear cognitive bridge.',
    targetTopicType: 'general',
    comparisonStyle: 'neutral_explanation',
  })

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
          /^(?:TL;?DR|Quick\s*Start|Key\s*Idea|Quick\s*Summary)\s*[:.-]?\s*/i,
          '',
        ),
    )
    .join('\n')
    .trim()

const clampWords = (value: string, maxWords: number): string =>
  value.split(/\s+/).filter(Boolean).slice(0, maxWords).join(' ')

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

const isComparisonStyle = (
  value: unknown,
): value is StudyGuideQuickStartComparisonStyle =>
  typeof value === 'string' &&
  quickStartComparisonStyles.includes(
    value as StudyGuideQuickStartComparisonStyle,
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
  const shouldUseKnownTopic =
    record.shouldUseKnownTopic === true && selectedTopics.length > 0

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
    comparisonStyle: isComparisonStyle(record.comparisonStyle)
      ? record.comparisonStyle
      : 'direct_comparison',
  }
}

export const sanitizeStudyGuideQuickStart = (
  value: Partial<StudyGuideQuickStart> | null | undefined,
): StudyGuideQuickStart | null => {
  const keyIdea = clampWords(
    stripTextLabels(String(value?.keyIdea || ''))
      .replace(/\s+/g, ' ')
      .trim(),
    STUDY_GUIDE_KEY_IDEA_MAX_WORDS,
  )
  const summaryWords = normalizeParagraphs(
    String(value?.quickSummary || ''),
  ).flatMap((paragraph) => paragraph.split(/\s+/).filter(Boolean))
  const clampedSummaryWords = summaryWords.slice(
    0,
    STUDY_GUIDE_QUICK_SUMMARY_MAX_WORDS,
  )
  const quickSummary = normalizeParagraphs(String(value?.quickSummary || ''))
    .reduce<{ paragraphs: string[]; remainingWords: number }>(
      (state, paragraph) => {
        if (state.remainingWords <= 0) {
          return state
        }

        const words = paragraph.split(/\s+/).filter(Boolean)
        const usedWords = words.slice(0, state.remainingWords)
        return {
          paragraphs: [...state.paragraphs, usedWords.join(' ')],
          remainingWords: state.remainingWords - usedWords.length,
        }
      },
      { paragraphs: [], remainingWords: clampedSummaryWords.length },
    )
    .paragraphs.filter(Boolean)
    .join('\n\n')

  if (!keyIdea || !quickSummary) {
    return null
  }

  return { keyIdea, quickSummary }
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

export const buildStudyGuideQuickStartPrompt = ({
  title,
  source,
  relevanceDecision,
}: {
  title: string
  source: string
  relevanceDecision?: StudyGuideQuickStartRelevanceDecision
}): string => {
  const decision =
    relevanceDecision || createNeutralStudyGuideQuickStartRelevanceDecision()
  const selectedTopics = sanitizeUserKnownTopics(
    decision.knownTopicsForQuickStart,
    {
      maxTopics: 2,
    },
  )
  const shouldUseKnownTopic =
    decision.shouldUseKnownTopic && selectedTopics.length > 0

  return `Create one Quick Start object for the full Study Guide "${title}".

Return strict JSON only:
{
  "keyIdea": "one sentence, maximum ${STUDY_GUIDE_KEY_IDEA_MAX_WORDS} words",
  "quickSummary": "2-3 short paragraphs, 80-120 words total"
}

Rules:
- keyIdea: one direct mental model of the topic. No Markdown. No label.
- quickSummary: 2-3 short paragraphs separated by blank lines.
- Explain the concept itself directly. Do not summarize the guide structure, sections, or page order.
- Do not write "This guide teaches...", "This guide explains...", "This page explains...", "You will learn...", or similar framing.
- Introduce at most 2-3 new technical terms. Prefer plain words for everything else.
- Avoid cute, random, or decorative analogies when a direct explanation or direct comparison is clearer.
${
  shouldUseKnownTopic
    ? `- Use only this selected known topic bridge if it improves clarity: ${selectedTopics.join(', ')}.
- Why this bridge helps: ${decision.knownTopicRelevanceReason}
- Prefer a direct comparison over a metaphor.
- Include one brief caveat about where the comparison breaks in quickSummary.`
    : `- No known topic was selected as clearly useful. Do not force a personalized analogy.
- Use a neutral beginner-friendly explanation and include one brief caveat, boundary, or common misconception in quickSummary.`
}
- Target topic type: ${decision.targetTopicType}.
- If this is a human or management topic, do not compare people to infrastructure, tools, machines, or deployment systems.

Final Study Guide content:
${source.slice(0, 60000)}`
}

export const buildStudyGuideQuickStartRelevancePrompt = ({
  title,
  prompt,
  source,
  userKnownTopics = [],
}: {
  title: string
  prompt: string
  source: string
  userKnownTopics?: string[]
}): string => {
  const safeTopics = sanitizeUserKnownTopics(userKnownTopics)

  return `Choose whether any known topic should be used to explain the Study Guide topic in its Quick Start.

Return strict JSON only with this shape:
{
  "shouldUseKnownTopic": boolean,
  "knownTopicsForQuickStart": string[],
  "knownTopicRelevanceReason": string,
  "targetTopicType": "technical" | "human_management" | "general",
  "comparisonStyle": "direct_comparison" | "neutral_explanation"
}

Decision rules:
- Goal: reduce learner cognitive effort, not personalize every Quick Start.
- Choose only from provided known topics. Never invent a known topic.
- Use at most 1 known topic. Use 2 only when both are clearly relevant and same-domain.
- Prefer same-domain direct comparisons over creative metaphors.
- Technical target + directly related technical known topic: select the best direct comparison.
- Technical target + unrelated technical known topic: ignore it.
- Human or management target: avoid infrastructure/tool analogies unless explicitly requested.
- If no topic clearly helps, set shouldUseKnownTopic false and knownTopicsForQuickStart [].
- Do not write the Quick Start.

Examples:
- Target "Vue", known ["React"]: select React.
- Target "Zustand", known ["Redux"]: select Redux.
- Target "GraphQL", known ["REST API", "Docker"]: select REST API only.
- Target "Managing very junior reports", known ["Docker"]: select none.
- Target "Data lakes", known ["MinIO"]: select MinIO only if object storage helps explain it.

Study Guide title: ${title}
Learner prompt: ${prompt || title}
Known topics, strongest first: ${safeTopics.length ? safeTopics.join(', ') : 'none'}

Study Guide content excerpt:
${source.slice(0, 12000)}`
}
