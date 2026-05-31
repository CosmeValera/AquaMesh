import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock localStorage ─────────────────────────────────────────────────────────

const createMemoryStorage = () => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  })
  return store
}

// ── Import after mock ─────────────────────────────────────────────────────────

import {
  getStudyPathMasteryProgress,
  setSectionMasteryStatus,
  recordSectionQuizScore,
  recordSectionTeachBack,
  isSectionLocked,
  getNextSectionToReview,
  getStudyPathGuidedMode,
  setStudyPathGuidedMode,
  getReviewSections,
  getNextRecommendedStep,
  isSectionLockedWithGuidedMode,
  getQuickCheckQuestions,
  getStatusFromScore,
  type StudyPathSectionMasteryStatus,
} from '../../../src/studyPack/progress'
import type { DashboardLayout } from '../../../src/state/store'

const PATH_ID = 'test-path-1'
const SECTION_A = 'section-a'
const SECTION_B = 'section-b'
const SECTION_C = 'section-c'

const makeLayout = (): DashboardLayout => ({
  type: 'row',
  name: 'Test Layout',
  children: [
    {
      component: 'QuizBlock',
      config: {
        customProps: {
          question: 'What is 2+2?',
          options: ['3', '4', '5', '6'],
          correctIndex: 1,
          answer: '4',
          explanation: '2+2=4',
        },
      },
    },
  ],
})

describe('studyPathProgress', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = createMemoryStorage()
  })

  // ── Default progress creation ───────────────────────────────────────────────

  describe('getStudyPathMasteryProgress', () => {
    it('returns null for a new study path', () => {
      const result = getStudyPathMasteryProgress(PATH_ID)
      expect(result).toBeNull()
    })

    it('returns existing progress after status is set', () => {
      setSectionMasteryStatus(PATH_ID, SECTION_A, 'inProgress')
      const result = getStudyPathMasteryProgress(PATH_ID)
      expect(result).not.toBeNull()
      expect(result?.sections[SECTION_A]?.status).toBe('inProgress')
    })
  })

  // ── Section status updates ─────────────────────────────────────────────────

  describe('setSectionMasteryStatus', () => {
    it('sets status to mastered', () => {
      const result = setSectionMasteryStatus(PATH_ID, SECTION_A, 'mastered')
      expect(result.sections[SECTION_A]?.status).toBe('mastered')
      expect(result.sections[SECTION_A]?.masteredAt).toBeDefined()
    })

    it('sets status to needsReview', () => {
      const result = setSectionMasteryStatus(PATH_ID, SECTION_A, 'needsReview')
      expect(result.sections[SECTION_A]?.status).toBe('needsReview')
      expect(result.sections[SECTION_A]?.lastReviewedAt).toBeDefined()
    })

    it('overwrites previous status', () => {
      setSectionMasteryStatus(PATH_ID, SECTION_A, 'inProgress')
      const result = setSectionMasteryStatus(PATH_ID, SECTION_A, 'mastered')
      expect(result.sections[SECTION_A]?.status).toBe('mastered')
    })
  })

  // ── Quiz score recording ───────────────────────────────────────────────────

  describe('recordSectionQuizScore', () => {
    it('records a quiz score and increments attempt count', () => {
      const result = recordSectionQuizScore(PATH_ID, SECTION_A, 85)
      expect(result.sections[SECTION_A]?.lastScore).toBe(85)
      expect(result.sections[SECTION_A]?.bestScore).toBe(85)
      expect(result.sections[SECTION_A]?.quizAttempts).toBe(1)
    })

    it('keeps best score on lower subsequent scores', () => {
      recordSectionQuizScore(PATH_ID, SECTION_A, 90)
      recordSectionQuizScore(PATH_ID, SECTION_A, 70)
      const result = getStudyPathMasteryProgress(PATH_ID)
      expect(result?.sections[SECTION_A]?.bestScore).toBe(90)
    })

    it('updates best score on higher scores', () => {
      recordSectionQuizScore(PATH_ID, SECTION_A, 70)
      const result = recordSectionQuizScore(PATH_ID, SECTION_A, 95)
      expect(result.sections[SECTION_A]?.bestScore).toBe(95)
    })

    it('derives mastered status for high scores', () => {
      recordSectionQuizScore(PATH_ID, SECTION_A, 100)
      const result = getStudyPathMasteryProgress(PATH_ID)
      expect(result?.sections[SECTION_A]?.status).toBe('mastered')
    })

    it('derives needsReview for medium scores', () => {
      recordSectionQuizScore(PATH_ID, SECTION_A, 70)
      const result = getStudyPathMasteryProgress(PATH_ID)
      expect(result?.sections[SECTION_A]?.status).toBe('needsReview')
    })

    it('derives inProgress for low scores', () => {
      recordSectionQuizScore(PATH_ID, SECTION_A, 40)
      const result = getStudyPathMasteryProgress(PATH_ID)
      expect(result?.sections[SECTION_A]?.status).toBe('inProgress')
    })
  })

  // ── Teach-back recording ───────────────────────────────────────────────────

  describe('recordSectionTeachBack', () => {
    it('records teach-back feedback and increments attempt count', () => {
      const result = recordSectionTeachBack(
        PATH_ID,
        SECTION_A,
        'Good explanation!',
      )
      expect(result.sections[SECTION_A]?.teachBackAttempts).toBe(1)
      expect(result.sections[SECTION_A]?.lastTeachBackFeedback).toBe(
        'Good explanation!',
      )
    })

    it('accumulates teach-back attempts', () => {
      recordSectionTeachBack(PATH_ID, SECTION_A, 'First attempt')
      const result = recordSectionTeachBack(PATH_ID, SECTION_A, 'Second attempt')
      expect(result.sections[SECTION_A]?.teachBackAttempts).toBe(2)
    })
  })

  // ── Section locking ────────────────────────────────────────────────────────

  describe('isSectionLocked', () => {
    const sectionIds = [SECTION_A, SECTION_B, SECTION_C]

    it('returns false for first section', () => {
      expect(isSectionLocked(PATH_ID, SECTION_A, sectionIds)).toBe(false)
    })

    it('returns false when previous section is mastered', () => {
      setSectionMasteryStatus(PATH_ID, SECTION_A, 'mastered')
      expect(isSectionLocked(PATH_ID, SECTION_B, sectionIds)).toBe(false)
    })

    it('returns true when previous section is not mastered', () => {
      setSectionMasteryStatus(PATH_ID, SECTION_A, 'inProgress')
      expect(isSectionLocked(PATH_ID, SECTION_B, sectionIds)).toBe(true)
    })

    it('respects guided mode (isSectionLockedWithGuidedMode)', () => {
      setSectionMasteryStatus(PATH_ID, SECTION_A, 'inProgress')
      expect(isSectionLockedWithGuidedMode(PATH_ID, SECTION_B, sectionIds)).toBe(
        true,
      )
      setStudyPathGuidedMode(PATH_ID, false)
      expect(isSectionLockedWithGuidedMode(PATH_ID, SECTION_B, sectionIds)).toBe(
        false,
      )
    })
  })

  // ── Review queue ──────────────────────────────────────────────────────────

  describe('getReviewSections', () => {
    const dashboards = [
      { dashboardKey: SECTION_A, name: 'Section A' },
      { dashboardKey: SECTION_B, name: 'Section B' },
      { dashboardKey: SECTION_C, name: 'Section C' },
    ]

    it('returns empty array when no sections need review', () => {
      setSectionMasteryStatus(PATH_ID, SECTION_A, 'mastered')
      const result = getReviewSections(PATH_ID, dashboards)
      expect(result).toEqual([])
    })

    it('returns sections marked as needsReview', () => {
      setSectionMasteryStatus(PATH_ID, SECTION_A, 'mastered')
      setSectionMasteryStatus(PATH_ID, SECTION_B, 'needsReview')
      setSectionMasteryStatus(PATH_ID, SECTION_C, 'needsReview')
      const result = getReviewSections(PATH_ID, dashboards)
      expect(result).toHaveLength(2)
      expect(result.map((r) => r.sectionId)).toContain(SECTION_B)
      expect(result.map((r) => r.sectionId)).toContain(SECTION_C)
    })
  })

  // ── Next recommended step ─────────────────────────────────────────────────

  describe('getNextRecommendedStep', () => {
    const dashboards = [
      { dashboardKey: SECTION_A, name: 'Section A' },
      { dashboardKey: SECTION_B, name: 'Section B' },
      { dashboardKey: SECTION_C, name: 'Section C' },
    ]

    it('suggests review when a section needs review', () => {
      setSectionMasteryStatus(PATH_ID, SECTION_A, 'mastered')
      setSectionMasteryStatus(PATH_ID, SECTION_B, 'needsReview')
      const result = getNextRecommendedStep(PATH_ID, dashboards)
      expect(result.type).toBe('review')
      expect(result.sectionId).toBe(SECTION_B)
    })

    it('suggests continue for inProgress sections', () => {
      setSectionMasteryStatus(PATH_ID, SECTION_A, 'mastered')
      setSectionMasteryStatus(PATH_ID, SECTION_B, 'inProgress')
      const result = getNextRecommendedStep(PATH_ID, dashboards)
      expect(result.type).toBe('continue')
      expect(result.sectionId).toBe(SECTION_B)
    })

    it('suggests start for notStarted sections', () => {
      setSectionMasteryStatus(PATH_ID, SECTION_A, 'mastered')
      const result = getNextRecommendedStep(PATH_ID, dashboards)
      expect(result.type).toBe('start')
      expect(result.sectionId).toBe(SECTION_B)
    })

    it('returns mastered when all sections are mastered', () => {
      setSectionMasteryStatus(PATH_ID, SECTION_A, 'mastered')
      setSectionMasteryStatus(PATH_ID, SECTION_B, 'mastered')
      setSectionMasteryStatus(PATH_ID, SECTION_C, 'mastered')
      const result = getNextRecommendedStep(PATH_ID, dashboards)
      expect(result.type).toBe('mastered')
    })
  })

  // ── Teach-back heuristic feedback ──────────────────────────────────────────

  describe('recordSectionTeachBack feedback quality', () => {
    it('stores short feedback', () => {
      const result = recordSectionTeachBack(
        PATH_ID,
        SECTION_A,
        'Too short',
      )
      expect(result.sections[SECTION_A]?.lastTeachBackFeedback).toBe('Too short')
    })

    it('stores long feedback', () => {
      const longFeedback =
        'This is a detailed explanation that covers all the main points of the concept including how and why it works with several examples'
      const result = recordSectionTeachBack(PATH_ID, SECTION_A, longFeedback)
      expect(result.sections[SECTION_A]?.lastTeachBackFeedback).toBe(longFeedback)
    })
  })

  // ── Guided mode ──────────────────────────────────────────────────────────

  describe('guided mode', () => {
    it('defaults to true when not set', () => {
      expect(getStudyPathGuidedMode(PATH_ID)).toBe(true)
    })

    it('can be toggled off', () => {
      setStudyPathGuidedMode(PATH_ID, false)
      expect(getStudyPathGuidedMode(PATH_ID)).toBe(false)
    })

    it('can be toggled back on', () => {
      setStudyPathGuidedMode(PATH_ID, false)
      setStudyPathGuidedMode(PATH_ID, true)
      expect(getStudyPathGuidedMode(PATH_ID)).toBe(true)
    })
  })

  // ── Quick check question extraction ────────────────────────────────────────

  describe('getQuickCheckQuestions', () => {
    it('returns empty array for empty layout', () => {
      const result = getQuickCheckQuestions(undefined, 3)
      expect(result).toEqual([])
    })

    it('extracts quiz questions from layout', () => {
      const layout = makeLayout()
      const result = getQuickCheckQuestions(layout, 3)
      expect(result).toHaveLength(1)
      expect(result[0].question).toBe('What is 2+2?')
      expect(result[0].options).toEqual(['3', '4', '5', '6'])
      expect(result[0].correctIndex).toBe(1)
    })

    it('respects maxQuestions limit', () => {
      const layout: DashboardLayout = {
        type: 'row',
        children: [
          {
            component: 'QuizBlock',
            config: {
              customProps: {
                question: 'Q1',
                options: ['a', 'b'],
                correctIndex: 0,
              },
            },
          },
          {
            component: 'QuizBlock',
            config: {
              customProps: {
                question: 'Q2',
                options: ['a', 'b'],
                correctIndex: 0,
              },
            },
          },
          {
            component: 'QuizBlock',
            config: {
              customProps: {
                question: 'Q3',
                options: ['a', 'b'],
                correctIndex: 0,
              },
            },
          },
          {
            component: 'QuizBlock',
            config: {
              customProps: {
                question: 'Q4',
                options: ['a', 'b'],
                correctIndex: 0,
              },
            },
          },
        ],
      }
      const result = getQuickCheckQuestions(layout, 2)
      expect(result).toHaveLength(2)
    })

    it('ignores non-quiz widgets', () => {
      const layout: DashboardLayout = {
        type: 'row',
        children: [
          {
            component: 'SomeOtherWidget',
            config: {
              customProps: {
                question: 'Not a quiz',
                options: ['a', 'b'],
                correctIndex: 0,
              },
            },
          },
        ],
      }
      const result = getQuickCheckQuestions(layout, 3)
      expect(result).toEqual([])
    })
  })

  // ── Score to status derivation ─────────────────────────────────────────────

  describe('getStatusFromScore', () => {
    it('returns mastered for scores >= 85', () => {
      expect(getStatusFromScore(85, 'notStarted')).toBe('mastered')
      expect(getStatusFromScore(100, 'notStarted')).toBe('mastered')
    })

    it('returns needsReview for scores 60-84', () => {
      expect(getStatusFromScore(60, 'notStarted')).toBe('needsReview')
      expect(getStatusFromScore(70, 'notStarted')).toBe('needsReview')
      expect(getStatusFromScore(84, 'notStarted')).toBe('needsReview')
    })

    it('returns inProgress for scores 30-59', () => {
      expect(getStatusFromScore(30, 'notStarted')).toBe('inProgress')
      expect(getStatusFromScore(50, 'notStarted')).toBe('inProgress')
    })

    it('returns inProgress for scores < 30 if current is notStarted', () => {
      expect(getStatusFromScore(20, 'notStarted')).toBe('inProgress')
    })
  })
})
