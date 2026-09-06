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

/** What a snapshot claims to have finished, so two of them can be compared. */
export const hostedPreviewProgressCount = (
  progress: HostedAiStudyGuideProgress | undefined,
): number =>
  progress
    ? (progress.title ? 1 : 0) +
      (progress.keyIdea ? 1 : 0) +
      (progress.bridgeTopics?.length ? 1 : 0) +
      (progress.pages || []).filter((page) => page.done).length +
      (progress.stage === 'quiz' ? 1 : 0)
    : 0

/** The checklist as a snapshot, for storing it or comparing it to another. */
export const toHostedProgressSnapshot = (
  preview: HostedPreviewState,
): HostedAiStudyGuideProgress => ({
  title: preview.title,
  emoji: preview.emoji,
  keyIdea: preview.keyIdea,
  bridgeTopics: preview.bridgeTopics,
  pages: preview.pages,
  stage: preview.stage,
})

/**
 * Adopts a snapshot only when it knows at least as much as what is on screen.
 *
 * A gateway that cannot record progress answers with an empty snapshot every
 * time, and letting that overwrite the checklist is what emptied the card on
 * refresh. The fuller of the two wins; the clock always comes from the caller.
 */
export const mergeHostedPreviewSnapshot = (
  current: HostedPreviewState | undefined,
  snapshot: HostedAiStudyGuideProgress | undefined,
  startedAt: number,
  shape: HostedPreviewShape = {},
): HostedPreviewState => {
  if (!current) {
    return makeHostedPreviewFromSnapshot(snapshot, startedAt, shape)
  }

  return hostedPreviewProgressCount(snapshot) >=
    hostedPreviewProgressCount(toHostedProgressSnapshot(current))
    ? makeHostedPreviewFromSnapshot(snapshot, startedAt, shape)
    : { ...current, startedAt }
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
      // No number: the placeholder is replaced by the real page title the
      // moment it arrives, and only one unwritten page is ever on screen.
      label: page?.title || t('studyGuides.preview.page'),
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

export interface HostedPreviewStages {
  /** 0-100. Filling this bar is the wait that matters: it ends when the guide
   *  becomes readable and the learner can open page 1. */
  firstPagePercent: number
  /** 0-100 for everything after page 1, shown only once the first bar is full. */
  remainderPercent: number
  isFirstPageReady: boolean
}

/**
 * Splits the wait into the part the learner waits for and the part that happens
 * behind them. Page 1 arriving is a finish line, not a halfway point, so it
 * fills its own bar rather than sitting at 50% of one.
 */
export const hostedPreviewStages = (
  preview: HostedPreviewState,
): HostedPreviewStages => {
  const firstPage = preview.pages[0]
  const isFirstPageReady = Boolean(firstPage?.done)
  const expectsBridge = preview.expectsBridge || preview.bridgeTopics.length > 0

  // Title, key idea, page 1, and the bridge when this guide can have one.
  const firstSteps = expectsBridge ? 4 : 3
  const firstDone =
    (preview.title ? 1 : 0) +
    (preview.keyIdea ? 1 : 0) +
    (preview.bridgeTopics.length ? 1 : 0) +
    (isFirstPageReady ? 1 : 0)

  // The remaining pages, plus the final quiz.
  const remainderSteps = Math.max(preview.expectedPages - 1, 0) + 1
  const remainderDone =
    preview.pages.slice(1).filter((page) => page.done).length +
    (preview.stage === 'quiz' ? 0.5 : 0)

  return {
    firstPagePercent: isFirstPageReady
      ? 100
      : Math.min(95, Math.round((firstDone / firstSteps) * 100)),
    remainderPercent: Math.min(
      95,
      Math.round((remainderDone / remainderSteps) * 100),
    ),
    isFirstPageReady,
  }
}

/**
 * Splits the checklist where the guide becomes readable.
 *
 * Everything up to page 1 is the wait the learner is actually in; the rest is
 * what keeps arriving after they can already start, so the card shows it as a
 * separate group below the button instead of one long list.
 */
export const splitHostedPreviewRows = (
  preview: HostedPreviewState,
  t: (key: InterfaceTextKey) => string,
): { upToFirstPage: HostedPreviewRow[]; remainder: HostedPreviewRow[] } => {
  const rows = buildHostedPreviewRows(preview, t)
  const firstPageIndex = rows.findIndex((row) => row.id === 'page-0')
  const cut = firstPageIndex >= 0 ? firstPageIndex + 1 : rows.length

  return { upToFirstPage: rows.slice(0, cut), remainder: rows.slice(cut) }
}
