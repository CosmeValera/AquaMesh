import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import WorkspaceStudioShell from '../../../../src/components/workspace/WorkspaceStudioShell'
import { OPEN_CREATE_HUB_EVENT } from '../../../../src/customHooks/useWorkspaceActions'
import { generateStudyPackWithAi } from '../../../../src/studyPack/ai'

const createStudyPackDashboardsMock = vi.fn()
let dashboardContextText = 'Dashboard notes about photosynthesis'
let dashboardContextChunks: unknown[] = [{ text: dashboardContextText }]

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
  readStudyPackAiSettings: () => ({ provider: 'basic' }),
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
  default: (props: { allowDashboardSource?: boolean }) => (
    <div
      data-testid="create-study-path-modal"
      data-allow-dashboard-source={String(props.allowDashboardSource)}
    />
  ),
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
  fireEvent.click(screen.getByRole('button', { name: /^Sources$/i }))
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

  it('opens the Sources section from the creation tabs', () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation()
    openCreateFromMaterial()

    expect(screen.getByRole('heading', { name: /^Sources$/i })).toBeInTheDocument()
    expect(screen.getByText(/^Add sources$/i)).toBeInTheDocument()
    expect(screen.queryByText(/Step 3: Options/i)).not.toBeInTheDocument()
    expect(generateStudyPackWithAi).not.toHaveBeenCalled()
  })

  it('opens Study Path directly when the create hub event requests it', () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation({ intent: 'study-path' })

    const studyPathModal = screen.getByTestId('create-study-path-modal')
    expect(studyPathModal).toBeInTheDocument()
    expect(studyPathModal).toHaveAttribute('data-allow-dashboard-source', 'false')
  })

  it('source quick cards select output without generating until sources exist', () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation()
    openCreateFromMaterial()
    fireEvent.click(
      screen.getByRole('button', { name: /^Quick Create Flashcards$/i }),
    )

    expect(screen.getByText(/Flashcards selected/i)).toBeInTheDocument()
    expect(generateStudyPackWithAi).not.toHaveBeenCalled()
  })

  it('uses pasted source material from Sources when the bottom CTA runs', async () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation({ intent: 'quiz', openQuickOptions: true })
    addCopiedMaterial('Custom source notes about enzymes')
    fireEvent.click(screen.getByRole('button', { name: /^Create Quiz$/i }))

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

  it('keeps Current dashboard quick create separate from session sources', async () => {
    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation({ openQuickOptions: true })
    addCopiedMaterial('Custom source notes about enzymes')
    fireEvent.click(screen.getByRole('button', { name: /^Current dashboard$/i }))
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
  })

  it('disables Current dashboard and falls back to Sources when the dashboard is empty', async () => {
    dashboardContextText = ''
    dashboardContextChunks = []

    render(
      <WorkspaceStudioShell>
        <div>Dashboard canvas</div>
      </WorkspaceStudioShell>,
    )

    openCreation()

    expect(
      screen.getByRole('button', { name: /^Current dashboard$/i }),
    ).toBeDisabled()
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /^Sources$/i }),
      ).toBeInTheDocument(),
    )
    expect(
      screen.getByRole('button', { name: /^Upload files$/i }),
    ).toBeInTheDocument()
    expect(generateStudyPackWithAi).not.toHaveBeenCalled()
  })

  it('opens the Creation panel from a collapsed quick action and preselects Sources', () => {
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
    fireEvent.click(screen.getByRole('button', { name: /Quick Create Quiz/i }))

    expect(screen.getByRole('heading', { name: /^Sources$/i })).toBeInTheDocument()
    expect(screen.getByText(/Quiz selected/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Sources$/i })).toHaveClass(
      'MuiButton-contained',
    )
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
      screen.queryByRole('heading', { name: /^Sources$/i }),
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

    expect(screen.getByRole('heading', { name: /^Sources$/i })).toBeInTheDocument()
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

    expect(screen.getByRole('heading', { name: /^Sources$/i })).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: /^Sources$/i }))
    expect(screen.getByText(/^Add sources$/i)).toBeInTheDocument()
  })
})
