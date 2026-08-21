import { afterEach, describe, expect, it, vi } from 'vitest'

import { createQuickCreateOrchestratorWidgets } from '../../../src/quickCreate'
import { generateStudyPathWithAi } from '../../../src/quickCreate/ai/provider'

const makeDashboard = (index: number, practiceType = 'none') => ({
  title: `${String(index).padStart(2, '0')} - Target concept flow`,
  summary: 'Target concept flow preview',
  rawNotes:
    'The target concept stores ordered records that producers write and consumers read.\n\n## Target concept flow',
  dashboardRole: 'normal',
  practiceType,
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
      dashboards: [
        makeDashboard(1, 'none'),
        makeDashboard(2, 'quiz'),
        makeDashboard(3, 'none'),
      ],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(JSON.stringify(guide)))
      .mockResolvedValueOnce(
        geminiResponse(
          JSON.stringify({
            targetParts: ['record', 'producer', 'retention'],
            knownTopicsForQuickStart: ['Specific related concept'],
            correspondences: [
              {
                knownSide: 'entry',
                targetSide: 'record',
                carries: 'the unit that gets stored',
                kind: 'part',
              },
              {
                knownSide: 'writer',
                targetSide: 'producer',
                carries: 'who appends new units',
                kind: 'part',
              },
              {
                knownSide: 'archival window',
                targetSide: 'retention',
                carries: 'how old units age out over time',
                kind: 'process',
              },
            ],
            knownTopicRelevanceReason:
              'Lets the learner reuse how appended entries age out.',
            breaksAt: 'replay has no counterpart on the known side',
            targetTopicType: 'technical',
          }),
        ),
      )
      .mockResolvedValueOnce(
        geminiResponse(
          JSON.stringify({
            keyIdea: 'The target concept is a durable record-flow mechanism.',
            quickSummary:
              'The target concept stores records so systems can write and read changes.\n\nRetention decides how long a record stays readable.',
          }),
        ),
      )
      .mockResolvedValueOnce(
        geminiResponse(
          JSON.stringify({
            keyIdea:
              'Every write is an entry appended to a log that ages out on a schedule.',
            quickSummary:
              'A writer appends an entry and a reader picks it up later.\n\nThe archival window decides when an entry stops being readable.',
          }),
        ),
      )
      .mockResolvedValueOnce(
        geminiResponse(
          JSON.stringify({
            blocks: [
              {
                dashboardIndex: 0,
                title: 'First page ignored',
                body: 'This should be ignored because first pages cannot receive bridge notes.',
              },
              {
                dashboardIndex: 1,
                title: 'Quiz page ignored',
                body: 'This should be ignored because quiz pages cannot receive bridge notes.',
              },
              {
                dashboardIndex: 2,
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

    const bodyContaining = (needle: string) =>
      requestBodies.find((body) => body.includes(needle)) || ''

    // guide, audition, plain Quick Start, bridged Quick Start, bridge blocks
    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(requestBodies[0]).not.toContain('Known topics')
    expect(requestBodies[0]).not.toContain('Specific related concept')
    expect(
      bodyContaining('Map the Study Guide topic onto one topic'),
    ).toContain(
      'Known topics, most recently learned first: Broad category, Adjacent category, Specific related concept',
    )

    const bridgeBody = bodyContaining(
      'Explain this through what the learner already knows: Specific related concept',
    )
    expect(bridgeBody).toContain('Bridge strength: strong')
    expect(bridgeBody).toContain('archival window -> retention')
    expect(bridgeBody).toContain('Run at least three of those pairs')

    const blocksBody = bodyContaining(
      'Create optional knowledge-context bridge note blocks',
    )
    expect(blocksBody).toContain('dashboardIndex: 2')
    expect(blocksBody).not.toContain('dashboardIndex: 0')
    expect(blocksBody).not.toContain('dashboardIndex: 1')

    // A mapped bridge leads, and the plain variant stays one tap away.
    expect(draft.quickStart?.keyIdea).toBe(
      'Every write is an entry appended to a log that ages out on a schedule.',
    )
    expect(draft.quickStart?.bridgeTopics).toEqual(['Specific related concept'])
    expect(draft.quickStart?.weakFitReason).toBeUndefined()
    expect(draft.quickStart?.forcedBridge?.keyIdea).toBe(
      'The target concept is a durable record-flow mechanism.',
    )
    expect(draft.dashboards[0].objects).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tags: ['knowledge-context-bridge'],
        }),
      ]),
    )
    expect(draft.dashboards[1].objects).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tags: ['knowledge-context-bridge'],
        }),
      ]),
    )
    expect(draft.dashboards[2].objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'note',
          title: 'Related concept bridge',
          body: expect.stringContaining('target concept'),
          tags: ['knowledge-context-bridge'],
        }),
      ]),
    )
    expect(draft.dashboards[2].rawNotes).not.toMatch(
      /##\s+Target concept flow\s*$/,
    )

    const widgets = createQuickCreateOrchestratorWidgets(
      {
        id: 'target-bridge',
        title: 'Target Concept',
        sourceFormat: 'text',
        objects: draft.dashboards[2].objects,
        warnings: [],
        dashboardRole: 'normal',
      },
      {
        includeSourceWidget: false,
        includeSourceSummaryWidget: false,
        studyPath: {
          pathId: 'path-target',
          title: 'Target Concept',
          dashboardKey: 'path-target-3',
          dashboardName: '03 - Target concept flow',
          dashboardIndex: 3,
          dashboardCount: 3,
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
            suggestedTypes: [],
          }),
        }),
      ]),
    )
  })

  it('skips knowledge-context work when the learner has no known topics', async () => {
    const guide = {
      title: 'Target Concept',
      folderName: 'Target Concept',
      emoji: 'T',
      quickStart: {
        keyIdea: 'Target concept has a plain default start.',
        quickSummary:
          'The guide starts without learner context.\\n\\nNo alternate context view is needed.',
      },
      dashboards: [makeDashboard(1, 'none'), makeDashboard(2, 'none')],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(JSON.stringify(guide)))
    vi.stubGlobal('fetch', fetchMock)

    const draft = await generateStudyPathWithAi({
      provider: 'gemini',
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'Target Concept',
      prompt: 'Target concept',
      folderName: '',
      singleRequest: true,
      userKnownTopics: [],
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(draft.quickStart?.keyIdea).toBe(
      'Target concept has a plain default start.',
    )
    expect(draft.quickStart?.forcedBridge).toBeUndefined()
  })

  it('creates a one-topic forced Quick Start without a forced selector call', async () => {
    const guide = {
      title: 'Object Storage',
      folderName: 'Object Storage',
      emoji: 'S',
      dashboards: [makeDashboard(1, 'none'), makeDashboard(2, 'none')],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(JSON.stringify(guide)))
      .mockResolvedValueOnce(
        geminiResponse(
          JSON.stringify({
            targetParts: ['bucket', 'object'],
            knownTopicsForQuickStart: [],
            correspondences: [],
            knownTopicRelevanceReason: '',
            breaksAt: '',
            targetTopicType: 'technical',
          }),
        ),
      )
      .mockResolvedValueOnce(
        geminiResponse(
          JSON.stringify({
            keyIdea: 'Object storage keeps files behind bucket-style APIs.',
            quickSummary:
              'Object storage stores data as named objects.\\n\\nThe guide explains lookup, metadata, and access control directly.',
          }),
        ),
      )
      .mockResolvedValueOnce(
        geminiResponse(
          JSON.stringify({
            keyIdea: 'Use Kubernetes as a loose mental bridge.',
            quickSummary:
              'Kubernetes organizes running systems.\\n\\nObject storage works at a different layer, but the control idea helps.',
          }),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const draft = await generateStudyPathWithAi({
      provider: 'gemini',
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'Object Storage',
      prompt: 'Object storage',
      folderName: '',
      singleRequest: true,
      userKnownTopics: ['Kubernetes'],
    })
    const requestBodies = fetchMock.mock.calls.map(([, init]) =>
      String(init?.body || ''),
    )

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(
      requestBodies.filter(
        (body) =>
          body.includes('Map the Study Guide topic onto one topic') &&
          body.includes('Bridge mode: force'),
      ),
    ).toHaveLength(0)
    expect(requestBodies[3]).toContain(
      'Explain this through what the learner already knows: Kubernetes',
    )
    expect(requestBodies[3]).toContain('Bridge mode: force')
    // Nothing mapped, so the forced view must not claim a reason it helps.
    expect(requestBodies[3]).not.toContain(
      'What the mapping lets them reuse: No provided known topic',
    )
    expect(draft.quickStart?.keyIdea).toBe(
      'Object storage keeps files behind bucket-style APIs.',
    )
    expect(draft.quickStart?.forcedBridge?.keyIdea).toBe(
      'Use Kubernetes as a loose mental bridge.',
    )
  })

  it('still creates an alternate forced Quick Start when nothing maps', async () => {
    const guide = {
      title: 'Kafka',
      folderName: 'Kafka',
      emoji: 'K',
      dashboards: [makeDashboard(1, 'none'), makeDashboard(2, 'none')],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(JSON.stringify(guide)))
      .mockResolvedValueOnce(
        geminiResponse(
          JSON.stringify({
            targetParts: ['partition', 'consumer'],
            knownTopicsForQuickStart: [],
            correspondences: [],
            knownTopicRelevanceReason: '',
            breaksAt: '',
            targetTopicType: 'technical',
          }),
        ),
      )
      .mockResolvedValueOnce(
        geminiResponse(
          JSON.stringify({
            keyIdea: 'Kafka is a durable event-streaming log.',
            quickSummary:
              'Kafka stores ordered records in partitions and lets consumers replay them later.',
          }),
        ),
      )
      .mockResolvedValueOnce(
        geminiResponse(
          JSON.stringify({
            keyIdea: 'Kafka is still best understood as a durable event log.',
            quickSummary:
              'A web app hands each request straight to whoever answers it. Kafka keeps the record instead, so a consumer can read it again later.',
          }),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const draft = await generateStudyPathWithAi({
      provider: 'gemini',
      apiToken: 'test-token',
      model: 'gemini-test',
      title: 'Kafka',
      prompt: 'Kafka',
      folderName: '',
      singleRequest: true,
      userKnownTopics: ['web development', 'valencian'],
    })
    const requestBodies = fetchMock.mock.calls.map(([, init]) =>
      String(init?.body || ''),
    )

    // One audition call covers every candidate, so there is no second selector.
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(requestBodies[3]).toContain(
      'Explain this through what the learner already knows: web development',
    )
    expect(requestBodies[3]).toContain('Bridge mode: force')
    expect(draft.quickStart?.keyIdea).toBe(
      'Kafka is a durable event-streaming log.',
    )
    expect(draft.quickStart?.forcedBridge?.bridgeTopics).toEqual([
      'web development',
    ])
    expect(draft.dashboards[1].objects).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tags: ['knowledge-context-bridge'],
        }),
      ]),
    )
  })
})
