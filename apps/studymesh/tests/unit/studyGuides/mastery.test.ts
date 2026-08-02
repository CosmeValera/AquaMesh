import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  claimFreeExplainAttempt,
  getGuideMasteryProof,
  getMasteryBand,
  guideHasQuiz,
  hasFreeExplainAttempt,
  MASTERY_CONFIDENT_PERCENT,
  MASTERY_PASS_PERCENT,
  readGuideMastery,
  recordGuideExplainResult,
  recordGuideQuizScore,
  STUDY_GUIDE_MASTERY_STORAGE_KEY,
} from '../../../src/studyGuides/mastery'
import type { StudyGuideRecord } from '../../../src/cloud/types'

const createRecord = (layouts: Record<string, unknown>[]): StudyGuideRecord =>
  ({
    id: 'guide-1',
    title: 'Robots',
    folderName: 'Robots',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    studyPath: {
      pathId: 'guide-1',
      title: 'Robots',
      folderName: 'Robots',
      selectedIndex: 0,
      dashboards: layouts.map((layout, index) => ({
        name: `Page ${index + 1}`,
        dashboardKey: `page-${index + 1}`,
        dashboardIndex: index + 1,
        dashboardCount: layouts.length,
        folderName: 'Robots',
        layout,
      })),
    },
  }) as unknown as StudyGuideRecord

describe('study guide mastery', () => {
  let storage: Record<string, string>

  beforeEach(() => {
    storage = {}
    vi.mocked(localStorage.getItem).mockImplementation(
      (key: string) => storage[key] ?? null,
    )
    vi.mocked(localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage[key] = value
      },
    )
  })

  it('passes from half the quiz and only drops the caveat above the confident mark', () => {
    expect(getMasteryBand(MASTERY_PASS_PERCENT - 1)).toBe('below')
    expect(getMasteryBand(MASTERY_PASS_PERCENT)).toBe('borderline')
    expect(getMasteryBand(MASTERY_CONFIDENT_PERCENT - 1)).toBe('borderline')
    expect(getMasteryBand(MASTERY_CONFIDENT_PERCENT)).toBe('confident')
    expect(getMasteryBand(100)).toBe('confident')
  })

  it('proves the topic from a bare pass instead of a perfect score', () => {
    const proof = getGuideMasteryProof({ quizScorePercent: 50 })

    expect(proof.proven).toBe(true)
    expect(proof.band).toBe('borderline')
  })

  it('keeps a failed attempt unproven', () => {
    expect(getGuideMasteryProof({ quizScorePercent: 40 }).proven).toBe(false)
    expect(getGuideMasteryProof({}).proven).toBe(false)
  })

  it('treats a passed explanation as proof with no caveat', () => {
    const proof = getGuideMasteryProof({
      quizScorePercent: 55,
      explainPassed: true,
    })

    expect(proof.proven).toBe(true)
    expect(proof.band).toBe('confident')
  })

  it('keeps the best quiz score so a worse retake never revokes the pass', () => {
    recordGuideQuizScore('guide-1', 80)
    recordGuideQuizScore('guide-1', 20)

    expect(readGuideMastery('guide-1').quizScorePercent).toBe(80)
    expect(getGuideMasteryProof(readGuideMastery('guide-1')).proven).toBe(true)
  })

  it('records mastery per guide', () => {
    recordGuideQuizScore('guide-1', 90)
    recordGuideExplainResult('guide-2', true)

    expect(readGuideMastery('guide-1').explainPassed).toBeUndefined()
    expect(readGuideMastery('guide-2').quizScorePercent).toBeUndefined()
    expect(JSON.parse(storage[STUDY_GUIDE_MASTERY_STORAGE_KEY])).toHaveProperty(
      'guide-2.explainPassed',
      true,
    )
  })

  it('hands out exactly one free explain attempt per guide', () => {
    expect(hasFreeExplainAttempt('guide-1')).toBe(true)
    expect(claimFreeExplainAttempt('guide-1')).toBe(true)
    expect(claimFreeExplainAttempt('guide-1')).toBe(false)
    expect(hasFreeExplainAttempt('guide-1')).toBe(false)
    expect(hasFreeExplainAttempt('guide-2')).toBe(true)
  })

  it('does not restore the free attempt when the check is retaken', () => {
    claimFreeExplainAttempt('guide-1')
    recordGuideExplainResult('guide-1', false)

    expect(hasFreeExplainAttempt('guide-1')).toBe(false)
  })

  it('detects a quiz anywhere in a page layout', () => {
    expect(
      guideHasQuiz(
        createRecord([
          {
            type: 'row',
            children: [
              { type: 'tabset', components: [{ type: 'QuizCarouselBlock' }] },
            ],
          },
        ]),
      ),
    ).toBe(true)
    expect(guideHasQuiz(createRecord([{ type: 'row', children: [] }]))).toBe(
      false,
    )
  })
})
