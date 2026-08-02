import { beforeEach, describe, expect, it } from 'vitest'

import {
  buildNextGuideIdeas,
  setPendingCreationPrompt,
  takePendingCreationPrompt,
} from '../../../src/studyGuides/nextGuideIdeas'
import type { StudyGuideRecord } from '../../../src/cloud/types'

const createRecord = (
  pages: Array<{ name: string; createdBy?: string }>,
): StudyGuideRecord =>
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
      dashboards: pages.map((page, index) => ({
        name: page.name,
        dashboardKey: `page-${index + 1}`,
        dashboardIndex: index + 1,
        dashboardCount: pages.length,
        folderName: 'Robots',
        layout: { type: 'row' },
        createdBy: page.createdBy || 'generator',
      })),
    },
  }) as unknown as StudyGuideRecord

describe('next guide ideas', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('points the deeper idea at the last lesson and the next idea elsewhere', () => {
    const ideas = buildNextGuideIdeas(
      createRecord([
        { name: 'What a robot is' },
        { name: 'Sensors' },
        { name: 'Control loops' },
      ]),
    )

    expect(ideas.map((idea) => idea.kind)).toEqual(['deeper', 'apply', 'next'])
    expect(ideas[0].focus).toBe('Control loops')
    expect(ideas[1].focus).toBe('')
    expect(ideas[2].focus).toBe('What a robot is')
  })

  it('ignores pages the learner generated on top of the guide', () => {
    const ideas = buildNextGuideIdeas(
      createRecord([
        { name: 'What a robot is' },
        { name: 'Control loops' },
        { name: 'Quiz', createdBy: 'quickCreate' },
      ]),
    )

    expect(ideas[0].focus).toBe('Control loops')
  })

  it('falls back to the topic when there is only one lesson', () => {
    const ideas = buildNextGuideIdeas(createRecord([{ name: 'Robots' }]))

    expect(ideas.every((idea) => idea.focus === '')).toBe(true)
  })

  it('hands the prompt over exactly once', () => {
    setPendingCreationPrompt('  I already know Robots. Go deeper.  ')

    expect(takePendingCreationPrompt()).toBe(
      'I already know Robots. Go deeper.',
    )
    expect(takePendingCreationPrompt()).toBe('')
  })

  it('ignores an empty handoff', () => {
    setPendingCreationPrompt('   ')

    expect(takePendingCreationPrompt()).toBe('')
  })
})
