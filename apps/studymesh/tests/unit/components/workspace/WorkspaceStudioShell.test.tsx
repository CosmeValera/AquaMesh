import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import WorkspaceStudioShell from '../../../../src/components/workspace/WorkspaceStudioShell'
import { OPEN_CREATE_HUB_EVENT } from '../../../../src/customHooks/useWorkspaceActions'
import { generateStudyPackWithAi } from '../../../../src/studyPack/ai'

const createStudyPackDashboardsMock = vi.fn()
let dashboardContextText = 'Dashboard notes about photosynthesis'
let dashboardContextChunks: unknown[] = [{ text: dashboardContextText }]
const studyPathModalProps = vi.hoisted(
  () =>
    [] as Array<{
      autoCreateOnGenerate?: boolean
      autoGenerateRequest?: { prompt: string }
      onCreatePath?: (payload: {
        folderName: string
        dashboards: Array<{ name: string }>
      }) => void
      onStatusChange?: (state: string, message?: string) => void
      onDraftMetaChange?: (metadata: {
        title: string
        inputSummary: string
      }) => void
    }>,
)

vi.mock('../../../../src/customHooks/useWorkspaceActions', () => ({
  __esModule: true,
  OPEN_CREATE_HUB_EVENT: 'studymesh-open-create-hub',
  OPEN_DASHBOARD_EDITOR_EVENT: 'studymesh-open-dashboard-editor',
  OPEN_STUDY_PACK_EVENT: 'studymesh-open-study-pack',
  OPEN_STUDY_PATH_EVENT: 'studymesh-open-study-path',
  OPEN_WIDGET_EDITOR_EVENT: 'studymesh-open-widget-editor',
  useWorkspaceActions: () => ({
    createStudyPackDashboards: createStudyPackDashboardsMock,
  }),
}))

vi.mock('../../../../src/components/Dasboard/DashboardProvider', () => ({
  __esModule: true,
  useDashboards: () => ({
    openDashboards: [
      {
        id: 'dashboard-1',
        name: 'Biology Dashboard',
        layout: {
          type: 'tabset',
          children: [
            {
              type: 'tab',
              name: 'Notes',
              component: 'custom-widget',
              config: {
                customWidget: {
                  id: 'widget-1',
                  name: 'Notes',
                  components: [
                    {
                      id: 'label-1',
                      type: 'Label',
                      props: { text: 'Dashboard notes about photosynthesis' },
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    ],
    selectedDashboard: 0,
  }),
}))

vi.mock('../../../../src/dashboardChat/contextBuilder', () => ({
  __esModule: true,
  buildDashboardChatContext: () => ({ chunks: dashboardContextChunks }),
  formatDashboardChatContext: () => dashboardContextText,
}))

vi.mock('../../../../src/studyPack/ai', () => ({
  __esModule: true,
  STUDY_PACK_AI_SETTINGS_CHANGED_EVENT: 'studymesh-ai-settings-changed',
  STRONG_AI_PROVIDERS: {
    gemini: { label: 'Gemini', modeLabel: 'Own Gemini API token' },
    cerebras: { label: 'Cerebras', modeLabel: 'Own Cerebras API key' },
  },
  isStrongAiProvider: (provider: unknown) =>
    provider === 'gemini' || provider === 'cerebras',
  callStrongAiModel: vi.fn(),
  readStudyPackAiSettings: () => ({ provider: 'hosted' }),
  resolveStudyPackAiCredentials: () => ({ apiToken: '', model: '' }),
  generateStudyPackWithAi: vi.fn(),
}))

vi.mock('../../../../src/studyPack', () => ({
  __esModule: true,
  createStudyPackOrchestratorWidgets: vi.fn(() => [
    {
      name: 'Generated material',
      components: [
        {
          id: 'generated-material-notes',
          type: 'MarkdownBlock',
          props: {
            title: 'Generated notes',
            markdown: 'Generated material body',
          },
        },
      ],
    },
  ]),
}))

vi.mock('../../../../src/studyPack/practice', () => ({
  __esModule: true,
  augmentStudyPackPracticeObjects: (objects: unknown[]) => ({
    objects,
    warnings: [],
  }),
}))

vi.mock('../../../../src/studyPack/documentExtraction', () => ({
  __esModule: true,
  extractTextFromPdf: vi.fn(),
  extractTextFromPptx: vi.fn(),
}))

vi.mock('../../../../src/studyPack/imageOcr', () => ({
  __esModule: true,
  extractRawNotesFromImage: vi.fn(),
}))

vi.mock('../../../../src/components/studyPack/CreateStudyPathModal', () => ({
  __esModule: true,
  default: (props: {
    autoCreateOnGenerate?: boolean
    autoGenerateRequest?: { prompt: string }
    onCreatePath?: (payload: {
      folderName: string
      dashboards: Array<{ name: string }>
    }) => void
    onStatusChange?: (state: string, message?: string) => void
    onDraftMetaChange?: (metadata: {
      title: string
      inputSummary: string
    }) => void
  }) => {
    studyPathModalProps.push(props)
    return props.autoCreateOnGenerate ? null : (
      <div
        data-testid="create-study-path-modal"
        data-auto-generate-prompt={props.autoGenerateRequest?.prompt || ''}
      />
    )
  },
}))

vi.mock('../../../../src/components/workspace/WidgetEditorDialog', () => ({
  __esModule: true,
  default: () => null,
}))

const openCreation = (detail: Record<string, unknown> = {}) => {
  act(() => {
    window.dispatchEvent(
      new CustomEvent(OPEN_CREATE_HUB_EVENT, {
        detail,
      }),
    )
  })
}

const clickQuickCard = (label: string) => {
  const button = screen.getByRole('button', { name: `Quick Create ${label}` })
  if (!button) {
    throw new Error(`Could not find ${label} quick card button`)
  }
  fireEvent.click(button)
}

const openCreateFromMaterial = () => {
  fireEvent.click(
    screen.getByRole('button', { name: /^Add sources \(optional\)$/i }),
  )
}

const addCopiedMaterial = (text: string) => {
  fireEvent.click(screen.getByRole('button', { name: /Copied text/i }))
  fireEvent.change(screen.getByLabelText(/Copied text/i), {
    target: { value: text },
  })
  fireEvent.click(screen.getByRole('button', { name: /Add copied text/i }))
}

describe('WorkspaceStudioShell Quick Create', () => {
  beforeEach(() => {
    dashboardContextText = 'Dashboard notes about photosynthesis'
    dashboardContextChunks = [{ text: dashboardContextText }]
    studyPathModalProps.length = 0
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    Element.prototype.scrollIntoView = vi.fn()
    createStudyPackDashboardsMock.mockClear()
    createStudyPackDashboardsMock.mockReturnValue([
      {
        name: 'Generated Dashboard',
      },
    ])
    vi.mocked(generateStudyPackWithAi).mockClear()
    vi.mocked(generateStudyPackWithAi).mockResolvedValue({
      id: 'draft-pack',
      title: 'Generated Dashboard',
      sourceFormat: 'text',
      objects: [
        {
          id: 'quiz-1',
          kind: 'quiz',
          question: 'What is photosynthesis?',
          options: ['A plant process', 'A mineral', 'A planet'],
          answer: 'A plant process',
          correctIndex: 0,
        },
      ],
      warnings: [],
      sourceSummary: { title: 'Summary', bullets: [] },
    })
  })

  it('opens the Creation panel by default on desktop', () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    expect(
      screen.getByRole('button', { name: /Collapse Create panel/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Open Create panel/i }),
    ).not.toBeInTheDocument()
  })

  it('keeps the dashboard section selected by default on phones', () => {
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    expect(screen.getByRole('button', { name: /Dashboards/i })).toHaveClass(
      'MuiButton-contained',
    )
    expect(
      screen.queryByRole('button', { name: /Collapse Create panel/i }),
    ).not.toBeInTheDocument()
  })

  it('runs direct AI generation with dashboard context for quick creation', async () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation()
    clickQuickCard('Quiz')

    await waitFor(() => expect(generateStudyPackWithAi).toHaveBeenCalled())
    expect(generateStudyPackWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'quiz',
        rawNotes: expect.stringContaining(
          'Dashboard notes about photosynthesis',
        ),
      }),
    )
    expect(createStudyPackDashboardsMock).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.getByText(/Ready - Open/i)).toBeInTheDocument(),
    )
  })

  it('automatically retries failed quick creation before showing the pill as failed', async () => {
    vi.mocked(generateStudyPackWithAi)
      .mockRejectedValueOnce(new Error('Temporary model failure'))
      .mockResolvedValueOnce({
        id: 'retry-pack',
        title: 'Generated Dashboard',
        sourceFormat: 'text',
        objects: [
          {
            id: 'quiz-1',
            kind: 'quiz',
            question: 'What is photosynthesis?',
            options: ['A plant process', 'A mineral', 'A planet'],
            answer: 'A plant process',
            correctIndex: 0,
          },
        ],
        warnings: [],
        sourceSummary: { title: 'Summary', bullets: [] },
      })

    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation()
    clickQuickCard('Quiz')

    await waitFor(() =>
      expect(generateStudyPackWithAi).toHaveBeenCalledTimes(2),
    )
    await waitFor(() =>
      expect(screen.getByText(/Ready - Open/i)).toBeInTheDocument(),
    )
    expect(
      screen.queryByText(/Temporary model failure/i),
    ).not.toBeInTheDocument()
  })

  it('opens ready quick-created material inside the Creation panel', async () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation()
    clickQuickCard('Quiz')

    await waitFor(() =>
      expect(screen.getByText(/Ready - Open/i)).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByText(/Ready - Open/i))

    expect(
      screen.getByRole('button', { name: /Back to Create/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Generated material body/i)).toBeInTheDocument()
    expect(createStudyPackDashboardsMock).not.toHaveBeenCalled()
  })

  it('keeps a completed quick-create pill ready while another quick create runs', async () => {
    let resolveSecondGeneration: (
      value: Awaited<ReturnType<typeof generateStudyPackWithAi>>,
    ) => void = () => {}
    const secondGeneration = new Promise<
      Awaited<ReturnType<typeof generateStudyPackWithAi>>
    >((resolve) => {
      resolveSecondGeneration = resolve
    })
    const generatedPack = {
      id: 'draft-pack',
      title: 'Generated Dashboard',
      sourceFormat: 'text' as const,
      objects: [
        {
          id: 'quiz-1',
          kind: 'quiz' as const,
          question: 'What is photosynthesis?',
          options: ['A plant process', 'A mineral', 'A planet'],
          answer: 'A plant process',
          correctIndex: 0,
        },
      ],
      warnings: [],
      sourceSummary: { title: 'Summary', bullets: [] },
    }
    vi.mocked(generateStudyPackWithAi)
      .mockResolvedValueOnce(generatedPack)
      .mockReturnValueOnce(secondGeneration)

    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation()
    clickQuickCard('Quiz')

    await waitFor(() =>
      expect(screen.getByText(/Ready - Open/i)).toBeInTheDocument(),
    )

    clickQuickCard('Flashcards')

    await waitFor(() =>
      expect(screen.getByText(/Generating flashcards/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/Ready - Open/i)).toBeInTheDocument()

    await act(async () => {
      resolveSecondGeneration(generatedPack)
      await secondGeneration
    })
  })

  it('opens inline source controls from Add sources optional', () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation()
    openCreateFromMaterial()

    expect(screen.getByText(/^Add sources$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Upload files$/i })).toBeInTheDocument()
    expect(screen.queryByText(/Step 3: Options/i)).not.toBeInTheDocument()
    expect(generateStudyPackWithAi).not.toHaveBeenCalled()
  })

  it('keeps Study Guide as an inline prompt when the create hub event requests it', () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation({ intent: 'study-path' })

    expect(screen.getByRole('heading', { name: /^Study Guide$/i })).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: /What do you want to learn/i }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('create-study-path-modal')).not.toBeInTheDocument()
  })

  it('starts Study Guide generation from the inline prompt', async () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation()
    fireEvent.change(
      screen.getByRole('textbox', { name: /What do you want to learn/i }),
      { target: { value: 'Learn Spanish B2 grammar' } },
    )
    fireEvent.click(
      screen.getByRole('button', { name: /^Create Study Guide$/i }),
    )

    await waitFor(() =>
      expect(screen.getByText(/Creating study guide/i)).toBeInTheDocument(),
    )
    expect(screen.getByRole('heading', { name: /^Study Guide$/i })).toBeVisible()
    expect(screen.queryByTestId('create-study-path-modal')).not.toBeInTheDocument()
  })

  it('does not let an old Study Guide pill reuse a newer prompt or status', async () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation()
    fireEvent.change(
      screen.getByRole('textbox', { name: /What do you want to learn/i }),
      { target: { value: 'Learn medieval history' } },
    )
    fireEvent.click(
      screen.getByRole('button', { name: /^Create Study Guide$/i }),
    )

    await waitFor(() =>
      expect(screen.getByText(/Creating study guide/i)).toBeInTheDocument(),
    )
    const firstGenerationProps = [...studyPathModalProps]
      .reverse()
      .find(
        (props) =>
          props.autoGenerateRequest?.prompt === 'Learn medieval history',
      )
    expect(firstGenerationProps).toBeTruthy()

    act(() => {
      firstGenerationProps?.onCreatePath?.({
        folderName: 'Medieval History',
        dashboards: [{ name: 'Feudalism' }],
      })
    })

    await waitFor(() =>
      expect(screen.getByText(/Ready - Open/i)).toBeInTheDocument(),
    )

    fireEvent.change(
      screen.getByRole('textbox', { name: /What do you want to learn/i }),
      { target: { value: 'Learn organic chemistry' } },
    )
    fireEvent.click(
      screen.getByRole('button', { name: /^Create Study Guide$/i }),
    )

    await waitFor(() =>
      expect(screen.getByText(/Creating study guide/i)).toBeInTheDocument(),
    )

    act(() => {
      firstGenerationProps?.onDraftMetaChange?.({
        title: 'Learn organic chemistry',
        inputSummary: 'Learn organic chemistry',
      })
      firstGenerationProps?.onStatusChange?.(
        'running',
        'Create Study Guide is working',
      )
    })

    expect(screen.getAllByText(/Creating study guide/i)).toHaveLength(1)
    expect(screen.getByText(/Ready - Open/i)).toBeInTheDocument()
    expect(
      screen.queryByText(/Study Guide: Learn organic chemistry/i),
    ).not.toBeInTheDocument()
  })

  it('disables quick create when there is no usable dashboard or sources', () => {
    dashboardContextText = ''
    dashboardContextChunks = []

    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation()
    const flashcardsButton = screen.getByRole('button', {
      name: /^Quick Create Flashcards$/i,
    })

    expect(screen.getByText(/^No dashboard or sources$/i)).toBeInTheDocument()
    expect(flashcardsButton).toBeDisabled()
    fireEvent.click(flashcardsButton)

    expect(
      screen.queryByRole('button', { name: /^Upload files$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Add sources or open a dashboard/i),
    ).not.toBeInTheDocument()
    expect(generateStudyPackWithAi).not.toHaveBeenCalled()
  })

  it('shows disabled quick create when the dashboard is empty', async () => {
    dashboardContextText = ''
    dashboardContextChunks = []

    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation()

    expect(screen.getByText(/^No dashboard or sources$/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Quick Create Quiz$/i }),
    ).toBeDisabled()
    expect(generateStudyPackWithAi).not.toHaveBeenCalled()
  })

  it('uses pasted source material when the quick card runs', async () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation({ intent: 'quiz', openQuickOptions: true })
    addCopiedMaterial('Custom source notes about enzymes')
    expect(screen.getByText(/^From sources$/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Quick Create Quiz$/i }))

    await waitFor(() => expect(generateStudyPackWithAi).toHaveBeenCalled())
    expect(generateStudyPackWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'quiz',
        rawNotes: expect.stringContaining('Custom source notes about enzymes'),
      }),
    )
    expect(createStudyPackDashboardsMock).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.getByText(/Ready - Open/i)).toBeInTheDocument(),
    )
  })

  it('keeps added sources persistent for future quick creates', async () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation({ openQuickOptions: true })
    addCopiedMaterial('Custom source notes about enzymes')
    clickQuickCard('Quiz')

    await waitFor(() => expect(generateStudyPackWithAi).toHaveBeenCalled())
    expect(generateStudyPackWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'quiz',
        rawNotes: expect.stringContaining('Custom source notes about enzymes'),
      }),
    )
  })

  it('keeps collapsed quick actions disabled when empty', () => {
    dashboardContextText = ''
    dashboardContextChunks = []

    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation()
    fireEvent.click(
      screen.getByRole('button', { name: /Collapse Create panel/i }),
    )
    const collapsedQuizButton = screen.getByRole('button', {
      name: /Quick Create Quiz/i,
    })

    expect(collapsedQuizButton).toBeDisabled()
    fireEvent.click(collapsedQuizButton)

    expect(
      screen.queryByRole('button', { name: /^Upload files$/i }),
    ).not.toBeInTheDocument()
    expect(generateStudyPackWithAi).not.toHaveBeenCalled()
  })

  it('keeps the Creation panel collapsed for collapsed quick actions with dashboard context', async () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation()
    fireEvent.click(
      screen.getByRole('button', { name: /Collapse Create panel/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /Quick Create Quiz/i }))

    await waitFor(() => expect(generateStudyPackWithAi).toHaveBeenCalled())
    expect(
      screen.queryByRole('button', { name: /^Upload files$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Open Create panel/i }),
    ).toBeInTheDocument()
  })

  it('focuses the upload area when an empty-dashboard upload launcher opens Sources', async () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation({
      intent: 'improvedNotes',
      openQuickOptions: true,
      quickSourceFocus: 'upload',
    })

    expect(screen.getByText(/^Add sources$/i)).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /^Upload files$/i }),
      ).toHaveFocus(),
    )
  })

  it('focuses the paste textarea when an empty-dashboard paste launcher opens Sources', async () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation({
      intent: 'improvedNotes',
      openQuickOptions: true,
      quickSourceFocus: 'paste',
    })

    expect(screen.getByText(/^Add sources$/i)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByLabelText(/Copied text/i)).toHaveFocus(),
    )
  })

  it('imports current dashboard into Sources for quick creation', async () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation()
    openCreateFromMaterial()
    fireEvent.click(
      screen.getByRole('button', { name: /^Import current dashboard$/i }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /^Quick Create Quiz$/i }),
    )

    await waitFor(() => expect(generateStudyPackWithAi).toHaveBeenCalled())
    expect(generateStudyPackWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'quiz',
        rawNotes: expect.stringContaining(
          'Dashboard notes about photosynthesis',
        ),
      }),
    )
  })

  it('shows source controls after Sources is selected', () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation()
    expect(screen.queryByText(/^Add sources$/i)).not.toBeInTheDocument()
    openCreateFromMaterial()
    expect(screen.getByText(/^Add sources$/i)).toBeInTheDocument()
  })
})
