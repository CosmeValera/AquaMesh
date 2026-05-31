import { ComponentData } from '../components/WidgetEditor/types/types'
import { DashboardLayout } from '../state/store'

export const OPEN_STUDY_PATH_REVIEW_DASHBOARD_EVENT =
  'studymesh-open-study-path-review-dashboard'

// Section mastery layer (adaptive closed-loop learning)
export type StudyPathSectionMasteryStatus =
  | 'notStarted'
  | 'inProgress'
  | 'needsReview'
  | 'mastered'
  | 'locked'

export interface StudyPathSectionProgress {
  sectionId: string
  status: StudyPathSectionMasteryStatus
  quizAttempts: number
  bestScore?: number
  lastScore?: number
  teachBackAttempts: number
  lastTeachBackFeedback?: string
  lastReviewedAt?: string
  masteredAt?: string
}

export interface StudyPathMasteryProgress {
  studyPathId: string
  sections: Record<string, StudyPathSectionProgress>
  activeSectionId?: string
  updatedAt: string
  guidedMode?: boolean // undefined = default true (guided on)
}

const STORAGE_KEY = 'studymesh-study-path-progress-v1'
const LEGACY_STORAGE_KEY = 'aquamesh-study-path-progress-v1'
const MASTERY_STORAGE_KEY = 'studymesh-study-path-mastery-v1'
const DASHBOARDS_STORAGE_KEY = 'customDashboards'

interface MasteryStore {
  paths: Record<string, StudyPathMasteryProgress>
}
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
  // Legacy: mastery stored separately in mastery store
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
    description: 'Generated after completing all Study Path dashboards.',
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

// ── Section mastery layer ────────────────────────────────────────────────────

const readMasteryStore = (): MasteryStore => {
  try {
    const stored = window.localStorage.getItem(MASTERY_STORAGE_KEY)
    return stored ? (JSON.parse(stored) as MasteryStore) : { paths: {} }
  } catch {
    return { paths: {} }
  }
}

const writeMasteryStore = (store: MasteryStore): void => {
  window.localStorage.setItem(MASTERY_STORAGE_KEY, JSON.stringify(store))
}

export const getStudyPathMasteryProgress = (
  studyPathId: string,
): StudyPathMasteryProgress | null => {
  const store = readMasteryStore()
  return store.paths[studyPathId] || null
}

export const getOrCreateSectionProgress = (
  store: MasteryStore,
  studyPathId: string,
  sectionId: string,
): StudyPathSectionProgress => {
  if (!store.paths[studyPathId]) {
    store.paths[studyPathId] = {
      studyPathId,
      sections: {},
      updatedAt: new Date().toISOString(),
    }
  }

  const path = store.paths[studyPathId]
  if (!path.sections[sectionId]) {
    path.sections[sectionId] = {
      sectionId,
      status: 'notStarted',
      quizAttempts: 0,
      teachBackAttempts: 0,
    }
  }

  return path.sections[sectionId]
}

export const setSectionMasteryStatus = (
  studyPathId: string,
  sectionId: string,
  status: StudyPathSectionMasteryStatus,
): StudyPathMasteryProgress => {
  const store = readMasteryStore()
  const section = getOrCreateSectionProgress(store, studyPathId, sectionId)
  const now = new Date().toISOString()

  section.status = status

  if (status === 'mastered') {
    section.masteredAt = now
  }

  if (status === 'needsReview' || status === 'inProgress') {
    section.lastReviewedAt = now
  }

  store.paths[studyPathId].updatedAt = now
  writeMasteryStore(store)
  return store.paths[studyPathId]
}

export const recordSectionQuizScore = (
  studyPathId: string,
  sectionId: string,
  score: number,
): StudyPathMasteryProgress => {
  const store = readMasteryStore()
  const section = getOrCreateSectionProgress(store, studyPathId, sectionId)
  const now = new Date().toISOString()

  section.quizAttempts += 1
  section.lastScore = score
  section.bestScore = Math.max(score, section.bestScore ?? 0)
  section.lastReviewedAt = now

  // Auto-update status based on score
  section.status = getStatusFromScore(score, section.status)

  if (score < 70 && section.status === 'mastered') {
    section.status = 'needsReview'
  }

  store.paths[studyPathId].updatedAt = now
  writeMasteryStore(store)
  return store.paths[studyPathId]
}

export const recordSectionTeachBack = (
  studyPathId: string,
  sectionId: string,
  feedback: string,
): StudyPathMasteryProgress => {
  const store = readMasteryStore()
  const section = getOrCreateSectionProgress(store, studyPathId, sectionId)
  const now = new Date().toISOString()

  section.teachBackAttempts += 1
  section.lastTeachBackFeedback = feedback
  section.lastReviewedAt = now

  store.paths[studyPathId].updatedAt = now
  writeMasteryStore(store)
  return store.paths[studyPathId]
}

export const getNextSectionToReview = (
  studyPathId: string,
  sectionIds: string[],
): string | null => {
  const mastery = getStudyPathMasteryProgress(studyPathId)
  if (!mastery) {
    return sectionIds[0] || null
  }

  // Priority order: needsReview > inProgress > notStarted > mastered
  const priority: Record<StudyPathSectionMasteryStatus, number> = {
    needsReview: 0,
    inProgress: 1,
    notStarted: 2,
    mastered: 3,
    locked: 4,
  }

  const sorted = sectionIds
    .map((id) => ({
      id,
      progress: mastery.sections[id] || {
        sectionId: id,
        status: 'notStarted' as StudyPathSectionMasteryStatus,
        quizAttempts: 0,
        teachBackAttempts: 0,
      },
    }))
    .sort(
      (a, b) =>
        priority[a.progress.status] - priority[b.progress.status] ||
        (a.progress.lastReviewedAt ?? '').localeCompare(
          b.progress.lastReviewedAt ?? '',
        ),
    )

  return sorted[0]?.id || null
}

export const isSectionLocked = (
  studyPathId: string,
  sectionId: string,
  sectionIds: string[],
): boolean => {
  const mastery = getStudyPathMasteryProgress(studyPathId)
  if (!mastery) {
    return false
  }

  const index = sectionIds.indexOf(sectionId)
  if (index <= 0) {
    return false
  }

  // Previous section must be mastered to unlock
  const prevSectionId = sectionIds[index - 1]
  const prevProgress = mastery.sections[prevSectionId]

  return prevProgress?.status !== 'mastered'
}

// ── Guided mode ──────────────────────────────────────────────────────────────

export const getStudyPathGuidedMode = (
  studyPathId: string,
): boolean => {
  const mastery = getStudyPathMasteryProgress(studyPathId)
  // Default to true (guided on) if not set
  return mastery?.guidedMode ?? true
}

export const setStudyPathGuidedMode = (
  studyPathId: string,
  enabled: boolean,
): StudyPathMasteryProgress => {
  const store = readMasteryStore()
  if (!store.paths[studyPathId]) {
    store.paths[studyPathId] = {
      studyPathId,
      sections: {},
      updatedAt: new Date().toISOString(),
      guidedMode: enabled,
    }
  } else {
    store.paths[studyPathId].guidedMode = enabled
    store.paths[studyPathId].updatedAt = new Date().toISOString()
  }
  writeMasteryStore(store)
  return store.paths[studyPathId]
}

// ── Review queue ─────────────────────────────────────────────────────────────

export interface ReviewQueueItem {
  sectionId: string
  sectionName: string
  status: StudyPathSectionMasteryStatus
  lastReviewedAt?: string
}

export const getReviewSections = (
  studyPathId: string,
  dashboards: Array<{ dashboardKey: string; name: string }>,
): ReviewQueueItem[] => {
  const mastery = getStudyPathMasteryProgress(studyPathId)
  if (!mastery) {
    return []
  }

  return dashboards
    .map((d) => ({
      sectionId: d.dashboardKey,
      sectionName: d.name,
      progress: mastery.sections[d.dashboardKey] || {
        sectionId: d.dashboardKey,
        status: 'notStarted' as StudyPathSectionMasteryStatus,
        quizAttempts: 0,
        teachBackAttempts: 0,
      },
    }))
    .filter((d) => d.progress.status === 'needsReview')
    .sort((a, b) => {
      const aTime = a.progress.lastReviewedAt ?? ''
      const bTime = b.progress.lastReviewedAt ?? ''
      return bTime.localeCompare(aTime)
    })
}

// ── Next recommended step ────────────────────────────────────────────────────

export type NextStepType =
  | 'continue'
  | 'review'
  | 'teachBack'
  | 'mastered'
  | 'start'

export interface NextStepSuggestion {
  type: NextStepType
  message: string
  sectionId?: string
  sectionName?: string
}

export const getNextRecommendedStep = (
  studyPathId: string,
  dashboards: Array<{ dashboardKey: string; name: string }>,
): NextStepSuggestion => {
  const mastery = getStudyPathMasteryProgress(studyPathId)
  const guidedMode = getStudyPathGuidedMode(studyPathId)
  const sectionIds = dashboards.map((d) => d.dashboardKey)

  // Check for needs review sections first
  const needsReview = dashboards.filter((d) => {
    const p = mastery?.sections[d.dashboardKey]
    return p?.status === 'needsReview'
  })
  if (needsReview.length > 0) {
    return {
      type: 'review',
      message: `Review "${needsReview[0].name}" before moving on`,
      sectionId: needsReview[0].dashboardKey,
      sectionName: needsReview[0].name,
    }
  }

  // Find first non-mastered section
  for (let i = 0; i < dashboards.length; i++) {
    const d = dashboards[i]
    const p = mastery?.sections[d.dashboardKey]
    const status = p?.status ?? 'notStarted'

    if (status === 'notStarted') {
      return {
        type: 'start',
        message: `Start with "${d.name}"`,
        sectionId: d.dashboardKey,
        sectionName: d.name,
      }
    }

    if (status === 'inProgress') {
      return {
        type: 'continue',
        message: `Continue with "${d.name}"`,
        sectionId: d.dashboardKey,
        sectionName: d.name,
      }
    }

    if (status === 'mastered' && i === dashboards.length - 1) {
      return {
        type: 'mastered',
        message: "You've mastered all sections — great work!",
      }
    }
  }

  // All mastered
  return {
    type: 'mastered',
    message: "You've mastered all sections — great work!",
  }
}

// ── Section locking that respects guided mode ────────────────────────────────

export const isSectionLockedWithGuidedMode = (
  studyPathId: string,
  sectionId: string,
  sectionIds: string[],
): boolean => {
  if (!getStudyPathGuidedMode(studyPathId)) {
    return false
  }
  return isSectionLocked(studyPathId, sectionId, sectionIds)
}

// ── Quick check questions extraction ─────────────────────────────────────────

export interface QuickCheckQuestion {
  question: string
  options: string[]
  correctIndex: number
  answer: string
  explanation: string
}

const extractQuestionsFromLayout = (
  layout: DashboardLayout | undefined,
  collected: QuickCheckQuestion[],
): void => {
  if (!layout) return

  // Check if this is a QuizBlock widget
  if (layout.component === 'QuizBlock' || layout.type === 'QuizBlock') {
    const props = layout.config?.customProps ?? layout
    const question = String(props.question || '')
    const optionsRaw = props.options
    let options: string[] = []
    if (Array.isArray(optionsRaw)) {
      options = optionsRaw.map((o) => String(o))
    } else if (typeof optionsRaw === 'string') {
      try {
        options = JSON.parse(optionsRaw)
      } catch {
        options = []
      }
    }
    const correctIndex = Number(props.correctIndex ?? 0)
    const answer = String(props.answer || options[correctIndex] || '')
    const explanation = String(props.explanation || '')

    if (question && options.length > 0) {
      collected.push({ question, options, correctIndex, answer, explanation })
    }
  }

  // Recurse into children
  if (layout.children) {
    for (const child of layout.children) {
      extractQuestionsFromLayout(child, collected)
    }
  }
}

export const getQuickCheckQuestions = (
  dashboardLayout: DashboardLayout | undefined,
  maxQuestions = 3,
): QuickCheckQuestion[] => {
  const questions: QuickCheckQuestion[] = []
  extractQuestionsFromLayout(dashboardLayout, questions)
  return questions.slice(0, maxQuestions)
}

// ── Score to status derivation ───────────────────────────────────────────────

export const getStatusFromScore = (
  score: number,
  currentStatus: StudyPathSectionMasteryStatus,
): StudyPathSectionMasteryStatus => {
  if (score >= 85) return 'mastered'
  if (score >= 60) return 'needsReview'
  if (score >= 30) return 'inProgress'
  // Low score: keep current or set to inProgress
  return currentStatus === 'notStarted' ? 'inProgress' : currentStatus
}
