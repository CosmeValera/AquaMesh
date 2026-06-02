import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  completeStudyPathDashboard,
  registerStudyPathAttempt,
  StudyPathDashboardMeta,
} from '../../../src/studyPack/progress'

const createMeta = (index: number): StudyPathDashboardMeta => ({
  studyPathId: 'french-b1',
  studyPathTitle: 'French B1',
  dashboardKey: `french-b1-${index}`,
  dashboardName: `${String(index).padStart(2, '0')} - Content`,
  dashboardIndex: index,
  dashboardCount: 7,
  folderName: 'French B1',
})

describe('study guide progress', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.mocked(localStorage.getItem).mockImplementation(
      (key: string) => storage.get(key) || null,
    )
    vi.mocked(localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage.set(key, value)
      },
    )
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      storage.delete(key)
    })
    vi.mocked(localStorage.clear).mockImplementation(() => storage.clear())
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  it('completes an unanswered dashboard with score 0', () => {
    const result = completeStudyPathDashboard(createMeta(1))

    expect(result.dashboard).toMatchObject({
      completedAt: '2026-01-01T00:00:00.000Z',
      score: 0,
      answered: 0,
      correct: 0,
      missed: 0,
    })
  })

  it('creates a final review dashboard after all seven dashboards complete', () => {
    registerStudyPathAttempt({
      ...createMeta(1),
      itemId: 'quiz-1',
      type: 'quiz',
      prompt: 'When is the subjunctive used?',
      answer: 'Only for past events',
      expectedAnswer: 'For uncertainty, doubt, wishes, obligation, or emotion',
      explanation: 'Subjunctive expresses non-certainty and subjective stance.',
      options: [
        'Only for past events',
        'For uncertainty, doubt, wishes, obligation, or emotion',
      ],
      correctIndex: 1,
      correct: false,
    })

    for (let index = 1; index <= 7; index += 1) {
      completeStudyPathDashboard(createMeta(index))
    }

    const dashboards = JSON.parse(
      localStorage.getItem('customDashboards') || '[]',
    )

    expect(dashboards).toHaveLength(1)
    expect(dashboards[0]).toMatchObject({
      id: 'study-path-review-french-b1',
      name: 'French B1 - Review missed exercises',
      folder: 'French B1',
      tags: ['study-pack', 'study-path', 'review-mistakes'],
    })
    expect(
      dashboards[0].layout.children[0].children[0].config.customProps,
    ).toMatchObject({
      studyPathId: 'french-b1',
      studyPathTitle: 'French B1',
      studyPathDashboardKey: 'study-path-review-french-b1',
      studyPathDashboardName: 'Review missed exercises',
      studyPathDashboardIndex: 8,
      studyPathDashboardCount: 8,
      studyPathFolderName: 'French B1',
    })
    expect(JSON.stringify(dashboards[0].layout)).toContain(
      'When is the subjunctive used?',
    )
  })
})
