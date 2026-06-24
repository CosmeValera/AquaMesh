import type { ComponentData } from '../components/WidgetEditor/types/types'
import { sanitizeUserKnownTopics } from '../profileContext'

export const STUDY_GUIDE_TLDR_MAX_WORDS = 120
export const STUDY_GUIDE_TLDR_PROP = 'studyGuideTldr'

const markdownFencePattern = /^```(?:\w+)?\s*|\s*```$/g

const tldrTargetTopicTypes = [
  'technical',
  'human_management',
  'general',
] as const
const tldrComparisonStyles = [
  'direct_comparison',
  'neutral_explanation',
] as const

export type StudyGuideTldrTargetTopicType =
  (typeof tldrTargetTopicTypes)[number]

export type StudyGuideTldrComparisonStyle =
  (typeof tldrComparisonStyles)[number]

export interface StudyGuideTldrRelevanceDecision {
  shouldUseKnownTopic: boolean
  knownTopicsForTldr: string[]
  knownTopicRelevanceReason: string
  targetTopicType: StudyGuideTldrTargetTopicType
  comparisonStyle: StudyGuideTldrComparisonStyle
}

export const STUDY_GUIDE_TLDR_RELEVANCE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    shouldUseKnownTopic: { type: 'BOOLEAN' },
    knownTopicsForTldr: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    knownTopicRelevanceReason: { type: 'STRING' },
    targetTopicType: {
      type: 'STRING',
      enum: [...tldrTargetTopicTypes],
    },
    comparisonStyle: {
      type: 'STRING',
      enum: [...tldrComparisonStyles],
    },
  },
  required: [
    'shouldUseKnownTopic',
    'knownTopicsForTldr',
    'knownTopicRelevanceReason',
    'targetTopicType',
    'comparisonStyle',
  ],
}

export const createNeutralStudyGuideTldrRelevanceDecision =
  (): StudyGuideTldrRelevanceDecision => ({
    shouldUseKnownTopic: false,
    knownTopicsForTldr: [],
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

    throw new Error('Study Guide TLDR relevance decision was not JSON.')
  }
}

const stringValue = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

const isTargetTopicType = (
  value: unknown,
): value is StudyGuideTldrTargetTopicType =>
  typeof value === 'string' &&
  tldrTargetTopicTypes.includes(value as StudyGuideTldrTargetTopicType)

const isComparisonStyle = (
  value: unknown,
): value is StudyGuideTldrComparisonStyle =>
  typeof value === 'string' &&
  tldrComparisonStyles.includes(value as StudyGuideTldrComparisonStyle)

export const parseStudyGuideTldrRelevanceDecision = (
  text: string,
  userKnownTopics: string[] = [],
): StudyGuideTldrRelevanceDecision => {
  const neutral = createNeutralStudyGuideTldrRelevanceDecision()
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
  const selectedTopics = Array.isArray(record.knownTopicsForTldr)
    ? record.knownTopicsForTldr
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
    knownTopicsForTldr: selectedTopics,
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

export const sanitizeStudyGuideTldr = (value: string): string => {
  const normalized = value
    .replace(markdownFencePattern, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/^#{1,6}\s+/, '')
        .replace(/^[-*]\s+/, '')
        .replace(/^TL;?DR\s*[:.-]?\s*/i, ''),
    )
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, STUDY_GUIDE_TLDR_MAX_WORDS)
    .join(' ')
}

export const buildStudyGuideTldrPrompt = ({
  title,
  source,
  relevanceDecision,
}: {
  title: string
  source: string
  relevanceDecision?: StudyGuideTldrRelevanceDecision
}): string => {
  const decision =
    relevanceDecision || createNeutralStudyGuideTldrRelevanceDecision()
  const selectedTopics = sanitizeUserKnownTopics(decision.knownTopicsForTldr, {
    maxTopics: 2,
  })
  const shouldUseKnownTopic =
    decision.shouldUseKnownTopic && selectedTopics.length > 0

  return `Write one global TL;DR for the full Study Guide "${title}".

Rules:
- Return only the TL;DR paragraph.
- Target 80-120 words. Maximum ${STUDY_GUIDE_TLDR_MAX_WORDS} words.
- Start with the simplest useful mental model for the learner.
- Explain the concept itself directly. Do not summarize the guide structure, sections, or page order.
- Do not write "This guide teaches...", "This guide explains...", "This page explains...", "You will learn...", or similar framing.
- Introduce at most 2-3 new terms. Prefer plain words for everything else.
- Avoid cute, random, or decorative analogies when a direct explanation or direct comparison is clearer.
${
  shouldUseKnownTopic
    ? `- Use only this selected known topic bridge: ${selectedTopics.join(', ')}.
- Why this bridge helps: ${decision.knownTopicRelevanceReason}
- Prefer a direct comparison over a metaphor.
- Include one brief caveat about where the comparison breaks.`
    : `- No known topic was selected as clearly useful. Do not force a personalized analogy.
- Use a neutral simple explanation and include one brief caveat, boundary, or common misconception.`
}
- Target topic type: ${decision.targetTopicType}.
- If this is a human or management topic, do not compare people to infrastructure, tools, machines, or deployment systems.
- Do not use Markdown headings, bullets, labels, citations, or JSON.
- No academic wording unless necessary.

Final Study Guide content:
${source.slice(0, 60000)}`
}

export const buildStudyGuideTldrRelevancePrompt = ({
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

  return `Choose whether any known topic should be used to explain the Study Guide topic in its TL;DR.

Return strict JSON only with this shape:
{
  "shouldUseKnownTopic": boolean,
  "knownTopicsForTldr": string[],
  "knownTopicRelevanceReason": string,
  "targetTopicType": "technical" | "human_management" | "general",
  "comparisonStyle": "direct_comparison" | "neutral_explanation"
}

Decision rules:
- Goal: reduce learner cognitive effort, not personalize every TL;DR.
- Choose only from provided known topics. Never invent a known topic.
- Use at most 1 known topic. Use 2 only when both are clearly relevant and same-domain.
- Prefer same-domain direct comparisons over creative metaphors.
- Technical target + directly related technical known topic: select the best direct comparison.
- Technical target + unrelated technical known topic: ignore it.
- Human or management target: avoid infrastructure/tool analogies unless explicitly requested.
- If no topic clearly helps, set shouldUseKnownTopic false and knownTopicsForTldr [].
- Do not write the TL;DR.

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

const clearStudyGuideTldr = (props: Record<string, unknown>) => {
  const nextProps = { ...props }
  delete nextProps[STUDY_GUIDE_TLDR_PROP]
  return nextProps
}

export const applyStudyGuideTldrToWidgets = <
  TWidget extends { components: ComponentData[] },
>(
  widgets: TWidget[],
  tldr: string | undefined,
  isFirstPage: boolean,
): TWidget[] => {
  const safeTldr = sanitizeStudyGuideTldr(tldr || '')
  let assigned = false

  return widgets.map((widget) => ({
    ...widget,
    components: widget.components.map((component) => {
      const shouldAssign =
        isFirstPage &&
        Boolean(safeTldr) &&
        !assigned &&
        component.type === 'MarkdownBlock'

      if (shouldAssign) {
        assigned = true
        return {
          ...component,
          props: {
            ...component.props,
            [STUDY_GUIDE_TLDR_PROP]: safeTldr,
          },
        }
      }

      if (
        Object.prototype.hasOwnProperty.call(
          component.props,
          STUDY_GUIDE_TLDR_PROP,
        )
      ) {
        return {
          ...component,
          props: clearStudyGuideTldr(component.props),
        }
      }

      return component
    }),
  }))
}
