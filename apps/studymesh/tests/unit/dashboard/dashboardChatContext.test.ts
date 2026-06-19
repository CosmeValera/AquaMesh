import { describe, expect, it } from 'vitest'
import {
  buildDashboardChatContext,
  selectDashboardChatChunks,
} from '../../../src/dashboardChat/contextBuilder'

const dashboard = {
  id: 'dashboard-1',
  name: 'French Subjunctive',
  layout: {
    type: 'row',
    children: [
      {
        type: 'tabset',
        children: [
          {
            type: 'tab',
            name: 'Source notes',
            component: 'CustomWidget',
            config: {
              customProps: {
                components: [
                  {
                    id: 'source-markdown',
                    type: 'MarkdownBlock',
                    props: {
                      __blockType: 'MarkdownBlock',
                      title: 'Source notes',
                      markdown:
                        'Use the subjunctive after il faut que and other trigger phrases.',
                    },
                  },
                  {
                    id: 'quiz',
                    type: 'QuizBlock',
                    props: {
                      __blockType: 'QuizBlock',
                      question: 'Which mood follows il faut que?',
                      answer: 'The subjunctive.',
                      explanation: 'Il faut que is a subjunctive trigger.',
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    ],
  },
}

describe('dashboard chat context builder', () => {
  it('extracts useful source chunks from dashboard widget custom props', () => {
    const context = buildDashboardChatContext(dashboard)

    expect(context.dashboardTitle).toBe('French Subjunctive')
    expect(context.chunks).toHaveLength(2)
    expect(context.chunks[0].text).toContain('subjunctive')
    expect(context.chunks[1].text).toContain('Which mood follows')
  })

  it('ranks chunks by the user question', () => {
    const context = buildDashboardChatContext(dashboard)
    const chunks = selectDashboardChatChunks(context, 'trigger phrases')

    expect(chunks[0].title).toBe('Source notes')
  })

  const studyPathWorkspace = {
    id: 'path-1',
    name: 'Spanish Study Guide Workspace',
    kind: 'studyPathContainer' as const,
    layout: {
      type: 'row',
      children: [],
    },
    studyPath: {
      pathId: 'spanish-path',
      title: 'Spanish Basics',
      folderName: 'Spanish',
      selectedIndex: 0,
      dashboards: [
        {
          id: 'lesson-dashboard',
          name: 'Lesson 1',
          dashboardKey: 'lesson-1',
          dashboardIndex: 0,
          dashboardCount: 2,
          folderName: 'Spanish',
          layout: dashboard.layout,
        },
        {
          id: 'lesson-dashboard-2',
          name: 'Lesson 2',
          dashboardKey: 'lesson-2',
          dashboardIndex: 1,
          dashboardCount: 2,
          folderName: 'Spanish',
          layout: {
            type: 'row',
            children: [
              {
                type: 'tab',
                name: 'Generated quiz',
                component: 'CustomWidget',
                config: {
                  customProps: {
                    components: [
                      {
                        id: 'quiz-only',
                        type: 'QuizBlock',
                        props: {
                          __blockType: 'QuizBlock',
                          question: 'What is estar used for?',
                          answer: 'Temporary states.',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      ],
    },
  }

  it('extracts source chunks from dashboards inside a study guide workspace', () => {
    const context = buildDashboardChatContext(studyPathWorkspace)

    expect(context.dashboardTitle).toBe('Spanish Basics')
    expect(context.chunks).toHaveLength(3)
    expect(context.chunks[0].title).toBe('Lesson 1: Source notes')
    expect(context.chunks[0].text).toContain('subjunctive')
    expect(context.chunks[0]).toMatchObject({
      dashboardKey: 'lesson-1',
      dashboardTitle: 'Lesson 1',
      dashboardIndex: 1,
    })
  })

  it('can limit local chat context to source notes in the selected study guide dashboard', () => {
    const context = buildDashboardChatContext(studyPathWorkspace, {
      sourceNotesOnly: true,
      studyPathScope: 'selected',
    })

    expect(context.chunks).toHaveLength(1)
    expect(context.chunks[0].title).toBe('Lesson 1: Source notes')
  })

  it('keeps selected Study Guide chunks ordered by page number for citations', () => {
    const context = buildDashboardChatContext(studyPathWorkspace)
    const chunks = selectDashboardChatChunks(context, 'subjunctive estar')

    expect(chunks.map((chunk) => chunk.dashboardIndex)).toEqual([1, 1, 2])
  })
})
