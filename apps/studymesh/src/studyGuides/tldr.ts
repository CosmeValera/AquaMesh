import type { ComponentData } from '../components/WidgetEditor/types/types'

export const STUDY_GUIDE_TLDR_MAX_WORDS = 100
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
}: {
  title: string
  source: string
}): string => `Write one TLDR for the full Study Guide "${title}".

Rules:
- Return only the TLDR paragraph.
- Use fewer than ${STUDY_GUIDE_TLDR_MAX_WORDS} words.
- Summarize the whole Study Guide, not just the first page.
- Do not use Markdown headings, bullets, labels, citations, or JSON.
- Keep it useful for a student deciding what this guide teaches.

Study Guide content:
${source.slice(0, 60000)}`

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
