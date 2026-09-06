import { foldHostedStudyGuideProgress } from '../quickCreate/ai/hostedCredits'
import type {
  HostedAiPreviewEvent,
  HostedAiStudyGuideProgress,
} from '../quickCreate/ai/hostedCredits'
import type { InterfaceTextKey } from '../language/interfaceLanguage'

export interface HostedPreviewPage {
  title: string
  done: boolean
}

/** The hosted monolith prompt asks for exactly 3 pages (api/hosted-ai.ts). */
export const HOSTED_STUDY_GUIDE_PAGE_COUNT = 3

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
  /**
   * How many pages the guide will have. Known up front, so the checklist can
   * show its whole shape immediately instead of growing rows as they land.
   */
  expectedPages: number
  /**
   * Whether a known-topic bridge is possible at all. Only true when the learner
   * listed something they already know, so the row is never reserved for a
   * guide that could not have one.
   */
  expectsBridge: boolean
}

export interface HostedPreviewShape {
  expectedPages?: number
  expectsBridge?: boolean
}

/** Rebuilds the checklist from a snapshot the gateway recorded for this job. */
export const makeHostedPreviewFromSnapshot = (
  snapshot: HostedAiStudyGuideProgress | undefined,
  startedAt: number,
  shape: HostedPreviewShape = {},
): HostedPreviewState => ({
  startedAt,
  title: snapshot?.title || '',
  emoji: snapshot?.emoji || '',
  keyIdea: snapshot?.keyIdea || '',
  bridgeTopics: snapshot?.bridgeTopics || [],
  pages: (snapshot?.pages || []).map((page) => ({
    title: page.title || '',
    done: Boolean(page.done),
  })),
  stage: snapshot?.stage === 'quiz' ? 'quiz' : 'monolith',
  expectedPages: shape.expectedPages ?? HOSTED_STUDY_GUIDE_PAGE_COUNT,
  expectsBridge: shape.expectsBridge ?? false,
})

export const makeHostedPreview = (
  startedAt: number,
  shape: HostedPreviewShape = {},
): HostedPreviewState =>
  makeHostedPreviewFromSnapshot(undefined, startedAt, shape)

/** True once the snapshot says anything at all, so a blank one is detectable. */
export const hasHostedPreviewSignal = (preview: HostedPreviewState): boolean =>
  Boolean(preview.title || preview.keyIdea || preview.pages.length)

export const applyHostedPreviewEvent = (
  current: HostedPreviewState,
  event: HostedAiPreviewEvent,
): HostedPreviewState =>
  // The fold is shared with the gateway so a watched card and a resumed card
  // can never advance differently. Only startedAt is ours to keep.
  makeHostedPreviewFromSnapshot(
    foldHostedStudyGuideProgress(
      {
        title: current.title,
        emoji: current.emoji,
        keyIdea: current.keyIdea,
        bridgeTopics: current.bridgeTopics,
        pages: current.pages,
        stage: current.stage,
      },
      event,
    ),
    current.startedAt,
    { expectedPages: current.expectedPages, expectsBridge: current.expectsBridge },
  )

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

  // The bridge always arrives before page 1, so once a page is done and no
  // bridge came, this guide has none and the row is not reserved for it.
  const bridgeStillPossible =
    preview.expectsBridge && !preview.pages.some((page) => page.done)
  if (preview.bridgeTopics.length || bridgeStillPossible) {
    const bridgeLabel = t('studyGuides.preview.bridge')
    const topics = preview.bridgeTopics.join(', ')
    rows.push({
      id: 'bridge',
      label: topics ? `${bridgeLabel}: ${topics}` : bridgeLabel,
      done: preview.bridgeTopics.length > 0,
    })
  }

  // Every page gets a row from the start, so the learner sees the whole shape
  // of the work rather than watching steps appear out of nowhere.
  const pageRowCount = Math.max(preview.expectedPages, preview.pages.length)
  Array.from({ length: pageRowCount }).forEach((_row, index) => {
    const page = preview.pages[index]
    rows.push({
      id: `page-${index}`,
      label: page?.title || `${t('studyGuides.preview.page')} ${index + 1}`,
      done: Boolean(page?.done),
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
 * 95% waiting.
 */
export const hostedPreviewPercent = (preview: HostedPreviewState): number => {
  const expectedPages = Math.max(preview.expectedPages, preview.pages.length)
  const total = 2 + expectedPages + 1
  const done =
    (preview.title ? 1 : 0) +
    (preview.keyIdea ? 1 : 0) +
    preview.pages.filter((page) => page.done).length +
    (preview.stage === 'quiz' ? 0.5 : 0)

  return Math.min(95, Math.round((done / total) * 100))
}
