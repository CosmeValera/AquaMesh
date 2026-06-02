import { ComponentData } from '../components/WidgetEditor/types/types'
import { DashboardLayout } from '../state/store'

export const OPEN_STUDY_PATH_REVIEW_DASHBOARD_EVENT =
  'studymesh-open-study-path-review-dashboard'

const STORAGE_KEY = 'studymesh-study-path-progress-v1'
const LEGACY_STORAGE_KEY = 'aquamesh-study-path-progress-v1'
const DASHBOARDS_STORAGE_KEY = 'customDashboards'
const STUDY_PACK_COLOR = '#007C66'

export type StudyPathAttemptType = 'quiz' | 'flashcard'

export interface StudyPathAttempt {
  itemId: string
  type: StudyPathAttemptType
  prompt: string
  answer: string
  expectedAnswer?: string
  explanation?: string
  options?: string[]
  correctIndex?: number
  correct: boolean
  missed: boolean
  updatedAt: string
}

export interface StudyPathDashboardProgress {
  dashboardKey: string
  dashboardName: string
  dashboardIndex: number
  dashboardCount: number
  folderName: string
  attempts: Record<string, StudyPathAttempt>
  completedAt?: string
  score: number
  answered: number
  correct: number
  missed: number
}

export interface StudyPathProgress {
  pathId: string
  title: string
  folderName: string
  dashboardCount: number
  dashboards: Record<string, StudyPathDashboardProgress>
  reviewDashboardId?: string
  reviewGeneratedAt?: string
}

interface ProgressStore {
  paths: Record<string, StudyPathProgress>
}

export interface StudyPathDashboardMeta {
  studyPathId: string
  studyPathTitle: string
  dashboardKey: string
  dashboardName: string
  dashboardIndex: number
  dashboardCount: number
  folderName: string
}

export interface RegisterStudyPathAttemptInput extends StudyPathDashboardMeta {
  itemId: string
  type: StudyPathAttemptType
  prompt: string
  answer: string
  expectedAnswer?: string
  explanation?: string
  options?: string[]
  correctIndex?: number
  correct: boolean
}

interface SavedDashboardRecord {
  id: string
  name: string
  folder?: string
  folderColor?: string
  layout: DashboardLayout
  description?: string
  tags?: string[]
  isPublic?: boolean
  createdAt: string
  updatedAt: string
}

const readStore = (): ProgressStore => {
  try {
    const stored =
      window.localStorage.getItem(STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_STORAGE_KEY)
    return stored ? (JSON.parse(stored) as ProgressStore) : { paths: {} }
  } catch {
    return { paths: {} }
  }
}

const writeStore = (store: ProgressStore): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

const readSavedDashboards = (): SavedDashboardRecord[] => {
  try {
    const stored = window.localStorage.getItem(DASHBOARDS_STORAGE_KEY)
    return stored ? (JSON.parse(stored) as SavedDashboardRecord[]) : []
  } catch {
    return []
  }
}

const writeSavedDashboards = (dashboards: SavedDashboardRecord[]): void => {
  window.localStorage.setItem(
    DASHBOARDS_STORAGE_KEY,
    JSON.stringify(dashboards),
  )
}

const getPath = (
  store: ProgressStore,
  meta: StudyPathDashboardMeta,
): StudyPathProgress => {
  const existing = store.paths[meta.studyPathId]
  if (existing) {
    return existing
  }

  const path: StudyPathProgress = {
    pathId: meta.studyPathId,
    title: meta.studyPathTitle,
    folderName: meta.folderName,
    dashboardCount: meta.dashboardCount,
    dashboards: {},
  }
  store.paths[meta.studyPathId] = path
  return path
}

const getDashboard = (
  path: StudyPathProgress,
  meta: StudyPathDashboardMeta,
): StudyPathDashboardProgress => {
  const existing = path.dashboards[meta.dashboardKey]
  if (existing) {
    return existing
  }

  const dashboard: StudyPathDashboardProgress = {
    dashboardKey: meta.dashboardKey,
    dashboardName: meta.dashboardName,
    dashboardIndex: meta.dashboardIndex,
    dashboardCount: meta.dashboardCount,
    folderName: meta.folderName,
    attempts: {},
    score: 0,
    answered: 0,
    correct: 0,
    missed: 0,
  }
  path.dashboards[meta.dashboardKey] = dashboard
  return dashboard
}

const recalculateDashboard = (
  dashboard: StudyPathDashboardProgress,
): StudyPathDashboardProgress => {
  const attempts = Object.values(dashboard.attempts)
  const answered = attempts.length
  const correct = attempts.filter((attempt) => attempt.correct).length
  const missed = attempts.filter((attempt) => attempt.missed).length

  dashboard.answered = answered
  dashboard.correct = correct
  dashboard.missed = missed
  dashboard.score = answered > 0 ? Math.round((correct / answered) * 100) : 0

  return dashboard
}

export const getStudyPathDashboardProgress = (
  meta: StudyPathDashboardMeta,
): StudyPathDashboardProgress => {
  const store = readStore()
  const path = getPath(store, meta)
  const dashboard = recalculateDashboard(getDashboard(path, meta))
  writeStore(store)
  return dashboard
}

export const registerStudyPathAttempt = (
  input: RegisterStudyPathAttemptInput,
): StudyPathDashboardProgress => {
  const store = readStore()
  const path = getPath(store, input)
  const dashboard = getDashboard(path, input)
  const now = new Date().toISOString()

  dashboard.attempts[input.itemId] = {
    itemId: input.itemId,
    type: input.type,
    prompt: input.prompt,
    answer: input.answer,
    expectedAnswer: input.expectedAnswer,
    explanation: input.explanation,
    options: input.options,
    correctIndex: input.correctIndex,
    correct: input.correct,
    missed: !input.correct,
    updatedAt: now,
  }

  recalculateDashboard(dashboard)
  writeStore(store)
  return dashboard
}

const createReviewComponents = (path: StudyPathProgress): ComponentData[] => {
  const missedAttempts = Object.values(path.dashboards)
    .sort((a, b) => a.dashboardIndex - b.dashboardIndex)
    .flatMap((dashboard) =>
      Object.values(dashboard.attempts)
        .filter((attempt) => attempt.missed)
        .map((attempt) => ({ dashboard, attempt })),
    )

  const components: ComponentData[] = [
    {
      id: `${path.pathId}-review-title`,
      type: 'Label',
      props: {
        text: `${path.title} missed exercises`,
        variant: 'h6',
        fontWeight: 800,
        gutterBottom: true,
      },
    },
    {
      id: `${path.pathId}-review-summary`,
      type: 'ListBlock',
      props: {
        __blockType: 'ListBlock',
        title: 'Review queue',
        items:
          missedAttempts.length > 0
            ? missedAttempts
                .slice(0, 6)
                .map(
                  ({ dashboard, attempt }) =>
                    `${dashboard.dashboardName}: ${attempt.prompt}`,
                )
                .join('\n')
            : 'No missed exercises recorded.',
        ordered: false,
        interactiveChecklist: false,
      },
    },
  ]

  missedAttempts.forEach(({ dashboard, attempt }, index) => {
    if (attempt.type === 'quiz') {
      const hasOptions =
        Array.isArray(attempt.options) && attempt.options.length > 0

      components.push({
        id: `${path.pathId}-review-quiz-${index + 1}`,
        type: hasOptions ? 'QuizBlock' : 'QuizzSingle',
        props: {
          __blockType: hasOptions ? 'QuizBlock' : 'QuizzSingle',
          quizMode: hasOptions ? 'multi' : 'single',
          question: `[${dashboard.dashboardName}] ${attempt.prompt}`,
          options: hasOptions ? attempt.options || [] : [],
          correctIndex: hasOptions ? attempt.correctIndex || 0 : 0,
          answer: attempt.expectedAnswer || '',
          explanation: attempt.explanation || '',
          shuffleOptions: false,
        },
      })
      return
    }

    components.push({
      id: `${path.pathId}-review-flashcard-${index + 1}`,
      type: 'FlashcardBlock',
      props: {
        __blockType: 'FlashcardBlock',
        front: `[${dashboard.dashboardName}] ${attempt.prompt}`,
        back: attempt.expectedAnswer || attempt.answer,
        hint: '',
        tag: 'Missed flashcard',
        selfGrade: true,
      },
    })
  })

  return components
}

const createReviewDashboard = (
  path: StudyPathProgress,
): SavedDashboardRecord => {
  const now = new Date().toISOString()
  const reviewDashboardId = `study-path-review-${path.pathId}`
  const components = createReviewComponents(path)
  const layout: DashboardLayout = {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 100,
        active: true,
        children: [
          {
            type: 'tab',
            name: 'Review missed exercises',
            component: 'CustomWidget',
            config: {
              customProps: {
                widgetId: `${reviewDashboardId}-widget`,
                studyPathId: path.pathId,
                studyPathTitle: path.title,
                studyPathDashboardKey: reviewDashboardId,
                studyPathDashboardName: 'Review missed exercises',
                studyPathDashboardIndex: path.dashboardCount + 1,
                studyPathDashboardCount: path.dashboardCount + 1,
                studyPathFolderName: path.folderName,
                components,
              },
            },
          },
        ],
      },
    ],
  }

  return {
    id: reviewDashboardId,
    name: `${path.title} - Review missed exercises`,
    folder: path.folderName,
    folderColor: STUDY_PACK_COLOR,
    layout,
    description: 'Generated after completing all Study Guide dashboards.',
    tags: ['study-pack', 'study-path', 'review-mistakes'],
    isPublic: false,
    createdAt: path.reviewGeneratedAt || now,
    updatedAt: now,
  }
}

const allDashboardsCompleted = (path: StudyPathProgress): boolean =>
  Array.from(
    { length: path.dashboardCount },
    (_value, index) => index + 1,
  ).every((dashboardIndex) =>
    Object.values(path.dashboards).some(
      (dashboard) =>
        dashboard.dashboardIndex === dashboardIndex &&
        Boolean(dashboard.completedAt),
    ),
  )

const saveReviewDashboard = (path: StudyPathProgress): SavedDashboardRecord => {
  const reviewDashboard = createReviewDashboard(path)
  const dashboards = readSavedDashboards()
  const existingIndex = dashboards.findIndex(
    (dashboard) => dashboard.id === reviewDashboard.id,
  )

  if (existingIndex >= 0) {
    dashboards[existingIndex] = {
      ...dashboards[existingIndex],
      ...reviewDashboard,
      createdAt: dashboards[existingIndex].createdAt,
    }
  } else {
    dashboards.push(reviewDashboard)
  }

  writeSavedDashboards(dashboards)
  return reviewDashboard
}

export const completeStudyPathDashboard = (
  meta: StudyPathDashboardMeta,
): {
  dashboard: StudyPathDashboardProgress
  reviewDashboard?: SavedDashboardRecord
} => {
  const store = readStore()
  const path = getPath(store, meta)
  const dashboard = recalculateDashboard(getDashboard(path, meta))
  const now = new Date().toISOString()

  dashboard.completedAt = now
  path.folderName = meta.folderName
  path.dashboardCount = meta.dashboardCount

  let reviewDashboard: SavedDashboardRecord | undefined
  if (allDashboardsCompleted(path)) {
    path.reviewGeneratedAt = now
    path.reviewDashboardId = `study-path-review-${path.pathId}`
    reviewDashboard = saveReviewDashboard(path)
  }

  writeStore(store)
  return { dashboard, reviewDashboard }
}
