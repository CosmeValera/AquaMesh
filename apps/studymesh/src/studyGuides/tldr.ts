import type { ComponentData } from '../components/WidgetEditor/types/types'
import { sanitizeUserKnownTopics } from '../profileContext'

export const STUDY_GUIDE_TLDR_MAX_WORDS = 120
export const STUDY_GUIDE_TLDR_PROP = 'studyGuideTldr'

const markdownFencePattern = /^```(?:\w+)?\s*|\s*```$/g

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
  userKnownTopics = [],
}: {
  title: string
  source: string
  userKnownTopics?: string[]
}): string => {
  const safeTopics = sanitizeUserKnownTopics(userKnownTopics)

  return `Write one global TL;DR for the full Study Guide "${title}".

Rules:
- Return only the TL;DR paragraph.
- Target 80-120 words. Maximum ${STUDY_GUIDE_TLDR_MAX_WORDS} words.
- Start with the simplest useful mental model for the learner.
- Summarize the concept itself, not the guide structure or page order.
- Do not write "This guide teaches...", "This guide explains...", "This page explains...", "You will learn...", or similar framing.
${
  safeTopics.length
    ? `- User known topics, strongest first: ${safeTopics.join(', ')}.
- Use 1 or 2 relevant known topics to create an analogy or comparison.
- Do not use every known topic. Ignore topics that do not fit.
- Briefly explain where the analogy or comparison breaks.`
    : `- No user known topics were provided.
- Use one simple everyday analogy.
- Briefly explain where the analogy breaks.`
}
- Do not use Markdown headings, bullets, labels, citations, or JSON.
- No academic wording unless necessary.

Final Study Guide content:
${source.slice(0, 60000)}`
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
