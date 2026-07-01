import { afterEach, describe, expect, it, vi } from 'vitest'

import { createQuickCreateOrchestratorWidgets } from '../../../src/quickCreate'
import { generateStudyPathWithAi } from '../../../src/quickCreate/ai/provider'

const makeDashboard = () => ({
  title: '01 - Target concept flow',
  summary: 'Target concept flow preview',
  rawNotes:
    'The target concept stores ordered records that producers write and consumers read.',
  practiceType: 'none',
  sourceSummary: {
    title: 'Target concept summary',
    bullets: ['The target concept retains records for later reading.'],
  },
  conceptRecap: {
    title: 'Target concept recap',
    sections: [
      {
        title: 'Stored flow',
        bullets: ['Writers append records and readers consume them.'],
        example: 'One system writes a record that another system reads later.',
      },
    ],
  },
  practice: {
    multipleChoice: [],
  },
  flashcards: [],
})

const geminiResponse = (text: string) => ({
  ok: true,
  json: async () => ({
    candidates: [{ content: { parts: [{ text }] } }],
  }),
})

describe('Study Guide knowledge bridges', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('adds selected knowledge-context bridge notes after base Study Guide generation', async () => {
    const guide = {
      title: 'Target Concept',
      folderName: 'Target Concept',
      emoji: 'T',
      dashboards: [makeDashboard()],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(JSON.stringify(guide)))
      .mockResolvedValueOnce(
        geminiResponse(
          JSON.stringify({
            shouldUseKnownTopic: true,
            knownTopicsForQuickStart: ['Specific related concept'],
            knownTopicRelevanceReason:
              'The specific related concept is the direct bridge.',
            targetTopicType: 'technical',
            bridgeStrength: 'strong',
            bridgeStrategy: 'direct_comparison',
          }),
        ),
      )
      .mockResolvedValueOnce(
        geminiResponse(
          JSON.stringify({
            keyIdea: 'The target concept is a durable record-flow mechanism.',
            quickSummary:
              'The target concept stores records so systems can write and read changes.\n\nThe comparison breaks when durability and replay matter more than simple dispatch.',
          }),
        ),
      )
      .mockResolvedValueOnce(
        geminiResponse(
          JSON.stringify({
            blocks: [
              {
                dashboardIndex: 0,
                title: 'Related concept bridge',
                body: 'If you know the specific related concept, this target concept plays a similar flow role between writers and readers. Caveat: this target concept also stores ordered records for replay.',
              },
            ],
          }),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const draft = await generateStudyPathWithAi({
      provider: 'gemini',
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'Target Concept',
      prompt: 'Target concept',
      folderName: '',
      singleRequest: true,
      userKnownTopics: [
        'Broad category',
        'Adjacent category',
        'Specific related concept',
      ],
    })
    const requestBodies = fetchMock.mock.calls.map(([, init]) =>
      String(init?.body || ''),
    )

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(requestBodies[0]).not.toContain('Known topics')
    expect(requestBodies[0]).not.toContain('Specific related concept')
    expect(requestBodies[1]).toContain(
      'Known topics, strongest first: Broad category, Adjacent category, Specific related concept',
    )
    expect(requestBodies[2]).toContain(
      'Use only this selected known topic bridge if it improves clarity: Specific related concept',
    )
    expect(requestBodies[3]).toContain(
      'Create optional knowledge-context bridge note blocks',
    )
    expect(draft.dashboards[0].objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'note',
          title: 'Related concept bridge',
          body: expect.stringContaining('target concept'),
          tags: ['knowledge-context-bridge'],
        }),
      ]),
    )

    const widgets = createQuickCreateOrchestratorWidgets(
      {
        id: 'target-bridge',
        title: 'Target Concept',
        sourceFormat: 'text',
        objects: draft.dashboards[0].objects,
        warnings: [],
        dashboardRole: 'normal',
      },
      {
        includeSourceWidget: false,
        includeSourceSummaryWidget: false,
        studyPath: {
          pathId: 'path-target',
          title: 'Target Concept',
          dashboardKey: 'path-target-1',
          dashboardName: '01 - Target concept flow',
          dashboardIndex: 1,
          dashboardCount: 1,
          folderName: 'Target Concept',
          dashboardRole: 'normal',
          practiceType: 'none',
        },
      },
    )

    expect(widgets.flatMap((widget) => widget.components)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'StudyNoteBlock',
          props: expect.objectContaining({
            title: 'Related concept bridge',
            text: expect.stringContaining('target concept'),
          }),
        }),
      ]),
    )
  })
})
