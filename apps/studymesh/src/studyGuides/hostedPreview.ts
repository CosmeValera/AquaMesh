import type { HostedAiPreviewEvent } from '../quickCreate/ai/hostedCredits'
import type { InterfaceTextKey } from '../language/interfaceLanguage'

export interface HostedPreviewPage {
  title: string
  done: boolean
}

/**
 * What the hosted gateway has streamed back so far.
 *
 * Purely what the learner is shown while waiting. The guide itself is always
 * built from the finished response, so nothing here has to be complete, or
 * even correct if a retry throws it away.
 */
export interface HostedPreviewState {
  startedAt: number
  title: string
  emoji: string
  keyIdea: string
  bridgeTopics: string[]
  pages: HostedPreviewPage[]
  stage: 'monolith' | 'quiz'
}

export const makeHostedPreview = (startedAt: number): HostedPreviewState => ({
  startedAt,
  title: '',
  emoji: '',
  keyIdea: '',
  bridgeTopics: [],
  pages: [],
  stage: 'monolith',
})

export const applyHostedPreviewEvent = (
  current: HostedPreviewState,
  event: HostedAiPreviewEvent,
): HostedPreviewState => {
  if (event.type === 'meta') {
    return { ...current, title: event.title, emoji: event.emoji || '' }
  }

  if (event.type === 'quickStart') {
    return { ...current, keyIdea: event.keyIdea }
  }

  if (event.type === 'bridge') {
    return { ...current, bridgeTopics: event.topics }
  }

  if (event.type === 'pageTitle' || event.type === 'page') {
    const pages = [...current.pages]
    while (pages.length <= event.index) {
      pages.push({ title: '', done: false })
    }

    pages[event.index] = {
      title: event.title || pages[event.index].title,
      done: event.type === 'page' || pages[event.index].done,
    }
    return { ...current, pages }
  }

  if (event.type === 'stage') {
    return { ...current, stage: event.stage }
  }

  if (event.type === 'reset') {
    return makeHostedPreview(current.startedAt)
  }

  return current
}

export interface HostedPreviewRow {
  id: string
  label: string
  done: boolean
}

export const buildHostedPreviewRows = (
  preview: HostedPreviewState,
  t: (key: InterfaceTextKey) => string,
): HostedPreviewRow[] => {
  const rows: HostedPreviewRow[] = [
    {
      id: 'title',
      label: preview.title
        ? `${preview.emoji ? `${preview.emoji} ` : ''}${preview.title}`
        : t('studyGuides.preview.naming'),
      done: Boolean(preview.title),
    },
    {
      id: 'keyIdea',
      label: t('studyGuides.preview.keyIdea'),
      done: Boolean(preview.keyIdea),
    },
  ]

  if (preview.bridgeTopics.length) {
    rows.push({
      id: 'bridge',
      label: `${t('studyGuides.preview.bridge')}: ${preview.bridgeTopics.join(
        ', ',
      )}`,
      done: true,
    })
  }

  preview.pages.forEach((page, index) => {
    rows.push({
      id: `page-${index}`,
      label: page.title || `${t('studyGuides.preview.page')} ${index + 1}`,
      done: page.done,
    })
  })

  rows.push({
    id: 'quiz',
    label: t('studyGuides.preview.finalQuiz'),
    done: false,
  })

  return rows
}

/** The row the checklist is currently on, for a collapsed creation card. */
export const describeHostedPreviewStep = (
  preview: HostedPreviewState,
  t: (key: InterfaceTextKey) => string,
): string =>
  buildHostedPreviewRows(preview, t).find((row) => !row.done)?.label || ''

/**
 * Share of the guide already written.
 *
 * Unlike an elapsed-time estimate this reflects real work, so it never sits at
 * 95% waiting. The page count is unknown until the pages start arriving, so
 * before then it is assumed to be the usual three.
 */
export const hostedPreviewPercent = (preview: HostedPreviewState): number => {
  const expectedPages = Math.max(3, preview.pages.length)
  const total = 2 + expectedPages + 1
  const done =
    (preview.title ? 1 : 0) +
    (preview.keyIdea ? 1 : 0) +
    preview.pages.filter((page) => page.done).length +
    (preview.stage === 'quiz' ? 0.5 : 0)

  return Math.min(95, Math.round((done / total) * 100))
}
