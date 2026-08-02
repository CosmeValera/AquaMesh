import type { StudyGuideRecord } from '../cloud/types'

/**
 * A guide topic becomes a declared skill only when the learner proves it, and
 * the proof is deliberately forgiving: half the final quiz is enough. A perfect
 * score would keep the skill out of reach of the people the lens is meant to
 * help, and the profile context it feeds is a hint for explanations, not a
 * certificate.
 */
export const MASTERY_PASS_PERCENT = 50

/**
 * Above this the pass is treated as solid and the offer carries no caveat.
 * Between the two thresholds the skill is still offered, with a suggestion to
 * review and retake first.
 */
export const MASTERY_CONFIDENT_PERCENT = 65

export type MasteryBand = 'below' | 'borderline' | 'confident'

export const getMasteryBand = (scorePercent: number): MasteryBand => {
  if (scorePercent >= MASTERY_CONFIDENT_PERCENT) {
    return 'confident'
  }

  return scorePercent >= MASTERY_PASS_PERCENT ? 'borderline' : 'below'
}

export const GUIDE_QUIZ_COMPLETED_EVENT = 'studymesh-guide-quiz-completed'

export interface GuideQuizCompletedDetail {
  correct: number
  total: number
  scorePercent: number
}

export interface GuideMasteryRecord {
  /** Best quiz score so far. A worse retake never takes a pass away. */
  quizScorePercent?: number
  quizAt?: string
  explainPassed?: boolean
  explainAt?: string
  /** Set once the one free explain-check call for this guide is spent. */
  freeExplainUsed?: boolean
}

export const STUDY_GUIDE_MASTERY_STORAGE_KEY =
  'studymesh-study-guide-mastery-v1'

type MasteryLedger = Record<string, GuideMasteryRecord>

const isMasteryRecord = (value: unknown): value is GuideMasteryRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const readLedger = (): MasteryLedger => {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const stored = window.localStorage.getItem(STUDY_GUIDE_MASTERY_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, GuideMasteryRecord] =>
          isMasteryRecord(entry[1]),
      ),
    )
  } catch {
    return {}
  }
}

const writeLedger = (ledger: MasteryLedger): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      STUDY_GUIDE_MASTERY_STORAGE_KEY,
      JSON.stringify(ledger),
    )
  } catch {
    // Best-effort: losing the ledger only costs the learner a retake.
  }
}

export const readGuideMastery = (studyGuideId: string): GuideMasteryRecord =>
  (studyGuideId && readLedger()[studyGuideId]) || {}

const updateGuideMastery = (
  studyGuideId: string,
  update: (current: GuideMasteryRecord) => GuideMasteryRecord,
): GuideMasteryRecord => {
  if (!studyGuideId) {
    return {}
  }

  const ledger = readLedger()
  const next = update(ledger[studyGuideId] || {})
  writeLedger({ ...ledger, [studyGuideId]: next })
  return next
}

export const recordGuideQuizScore = (
  studyGuideId: string,
  scorePercent: number,
): GuideMasteryRecord => {
  const safeScore = Math.max(0, Math.min(100, Math.round(scorePercent)))

  return updateGuideMastery(studyGuideId, (current) =>
    current.quizScorePercent !== undefined &&
    current.quizScorePercent >= safeScore
      ? current
      : {
          ...current,
          quizScorePercent: safeScore,
          quizAt: new Date().toISOString(),
        },
  )
}

export const recordGuideExplainResult = (
  studyGuideId: string,
  passed: boolean,
): GuideMasteryRecord =>
  updateGuideMastery(studyGuideId, (current) => ({
    ...current,
    explainPassed: current.explainPassed || passed,
    explainAt: new Date().toISOString(),
  }))

export const hasFreeExplainAttempt = (studyGuideId: string): boolean =>
  !readGuideMastery(studyGuideId).freeExplainUsed

/**
 * Spends the single free explain-check call this guide is entitled to. Written
 * before the request leaves the browser so a failed or abandoned call still
 * counts: the point is to bound how much hosted generation one guide can buy,
 * not to be generous about retries.
 */
export const claimFreeExplainAttempt = (studyGuideId: string): boolean => {
  if (!hasFreeExplainAttempt(studyGuideId)) {
    return false
  }

  updateGuideMastery(studyGuideId, (current) => ({
    ...current,
    freeExplainUsed: true,
  }))
  return true
}

export interface GuideMasteryProof {
  /** True once the learner may claim the topic as a declared skill. */
  proven: boolean
  band: MasteryBand
  quizScorePercent?: number
  explainPassed: boolean
}

export const getGuideMasteryProof = (
  mastery: GuideMasteryRecord,
): GuideMasteryProof => {
  const explainPassed = Boolean(mastery.explainPassed)
  const quizScorePercent = mastery.quizScorePercent
  const quizBand =
    quizScorePercent === undefined ? 'below' : getMasteryBand(quizScorePercent)
  // Explaining the topic in your own words is graded pass/fail, so a pass there
  // carries no caveat even when the quiz score alone would be borderline.
  const band: MasteryBand = explainPassed ? 'confident' : quizBand

  return {
    proven: explainPassed || quizBand !== 'below',
    band,
    quizScorePercent,
    explainPassed,
  }
}

const QUIZ_BLOCK_TYPES = new Set([
  'QuizCarouselBlock',
  'FocusedQuizSessionBlock',
])

const containsQuizBlock = (value: unknown, depth = 0): boolean => {
  if (!value || typeof value !== 'object' || depth > 12) {
    return false
  }

  if (Array.isArray(value)) {
    return value.some((entry) => containsQuizBlock(entry, depth + 1))
  }

  const record = value as Record<string, unknown>
  if (typeof record.type === 'string' && QUIZ_BLOCK_TYPES.has(record.type)) {
    return true
  }

  return Object.values(record).some((entry) =>
    containsQuizBlock(entry, depth + 1),
  )
}

/**
 * Whether the guide can be proved by quiz at all. Quick Guides generated
 * without practice have no quiz, so for those the explain check is the only
 * route and the offer must not wait for a score that can never arrive.
 */
export const guideHasQuiz = (record: StudyGuideRecord): boolean =>
  (record.studyPath?.dashboards || []).some((dashboard) =>
    containsQuizBlock(dashboard.layout),
  )
