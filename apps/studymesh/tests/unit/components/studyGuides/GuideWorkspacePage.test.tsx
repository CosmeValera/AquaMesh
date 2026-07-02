import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import GuideWorkspacePage, {
  AI_CHAT_MIN_WIDTH,
} from '../../../../src/components/studyGuides/GuideWorkspacePage'
import {
  STUDY_GUIDES_STORAGE_FULL_MESSAGE,
  STUDY_GUIDES_STORAGE_KEY,
  STUDY_GUIDES_SUMMARY_STORAGE_KEY,
} from '../../../../src/studyGuides/storage'

const guideWorkspaceAuthMocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
}))

const guideWorkspaceCloudMocks = vi.hoisted(() => ({
  getStudyGuide: vi.fn(),
}))

const guideWorkspaceSupabaseMocks = vi.hoisted(() => ({
  isSupabaseConfigured: false,
}))

vi.mock('../../../../src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: guideWorkspaceAuthMocks.user }),
}))

vi.mock('../../../../src/auth/supabaseClient', () => ({
  get isSupabaseConfigured() {
    return guideWorkspaceSupabaseMocks.isSupabaseConfigured
  },
  supabase: {},
}))

vi.mock('../../../../src/cloud/repository', () => ({
  createCloudRepository: () => guideWorkspaceCloudMocks,
}))

vi.mock('../../../../src/components/topnavbar/TopNavBar', () => ({
  default: () => <div data-testid="top-nav" />,
}))

vi.mock('../../../../src/components/Main', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}))

vi.mock('../../../../src/components/hostedAi/HostedAiIntroModal', () => ({
  default: () => null,
}))

vi.mock('../../../../src/components/Dasboard/StudyPathWorkspaceView', () => ({
  default: ({
    studyPath,
    onAskAi,
    onAddPage,
  }: {
    studyPath: { selectedIndex: number; dashboards: Array<{ name: string }> }
    onAskAi?: (content: string) => void
    onAddPage?: () => void
  }) => (
    <div data-testid="study-guide-panel">
      {studyPath.dashboards[studyPath.selectedIndex]?.name}
      <button type="button" onClick={() => onAskAi?.('Explain quiz miss')}>
        Ask AI from study block
      </button>
      <button type="button" onClick={() => onAddPage?.()}>
        Add page from study guide
      </button>
    </div>
  ),
}))

vi.mock('../../../../src/components/Dasboard/StudyGuidePagesPanel', () => ({
  default: () => <div data-testid="pages-panel" />,
}))

const dashboardChatPanelSpy = vi.fn()

vi.mock('../../../../src/components/dashboardChat/DashboardChatPanel', () => ({
  default: (props: Record<string, unknown>) => {
    dashboardChatPanelSpy(props)
    return <div data-testid="chat-panel" />
  },
}))

const storedGuide = {
  id: 'guide-1',
  title: 'Biology',
  folderName: 'Biology',
  studyPath: {
    pathId: 'guide-1',
    title: 'Biology',
    folderName: 'Biology',
    selectedIndex: 0,
    dashboards: [
      {
        name: 'Core lesson',
        dashboardKey: 'core',
        dashboardIndex: 1,
        dashboardCount: 1,
        folderName: 'Biology',
        layout: { type: 'row' },
        createdBy: 'generator',
        deletable: false,
      },
      {
        name: 'Review page',
        dashboardKey: 'review',
        dashboardIndex: 2,
        dashboardCount: 2,
        folderName: 'Biology',
        layout: { type: 'row' },
        createdBy: 'generator',
        deletable: false,
      },
    ],
  },
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
}

const latestStoredStudyGuidesPayload = () =>
  vi
    .mocked(localStorage.setItem)
    .mock.calls.filter(([key]) => key === STUDY_GUIDES_STORAGE_KEY)
    .at(-1)?.[1]

const storedStudyGuidesPayloads = () =>
  vi
    .mocked(localStorage.setItem)
    .mock.calls.filter(([key]) => key === STUDY_GUIDES_STORAGE_KEY)
    .map(([, value]) => value)

describe('GuideWorkspacePage responsive sections', () => {
  it('allows the desktop AI Chat panel to shrink to 310px', () => {
    expect(AI_CHAT_MIN_WIDTH).toBe(310)
  })

  beforeEach(() => {
    guideWorkspaceAuthMocks.user = null
    guideWorkspaceSupabaseMocks.isSupabaseConfigured = false
    dashboardChatPanelSpy.mockClear()
    guideWorkspaceCloudMocks.getStudyGuide.mockReset()
    vi.mocked(localStorage.setItem).mockClear()
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
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === STUDY_GUIDES_STORAGE_KEY ? JSON.stringify([storedGuide]) : null,
    )
  })

  it('renders the lazy-loaded full Study Guide after starting from summary cache only', async () => {
    guideWorkspaceAuthMocks.user = { id: 'user-1' }
    guideWorkspaceSupabaseMocks.isSupabaseConfigured = true
    guideWorkspaceCloudMocks.getStudyGuide.mockResolvedValue(storedGuide)
    vi.mocked(localStorage.getItem).mockImplementation((key) => {
      if (key === STUDY_GUIDES_STORAGE_KEY) {
        return null
      }
      if (key === STUDY_GUIDES_SUMMARY_STORAGE_KEY) {
        return JSON.stringify([
          {
            id: storedGuide.id,
            title: storedGuide.title,
            folderName: storedGuide.folderName,
            pageCount: storedGuide.studyPath.dashboards.length,
            firstPageTitle: storedGuide.studyPath.dashboards[0]?.name,
            createdAt: storedGuide.createdAt,
            updatedAt: storedGuide.updatedAt,
          },
        ])
      }
      return null
    })

    render(
      <MemoryRouter initialEntries={['/workspace/guide-1']}>
        <Routes>
          <Route
            path="/workspace/:studyGuideId"
            element={<GuideWorkspacePage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Loading Study Guide...')).toBeInTheDocument()
    expect(await screen.findByTestId('study-guide-panel')).toHaveTextContent(
      'Core lesson',
    )
    expect(screen.queryByText('Loading Study Guide...')).not.toBeInTheDocument()
    expect(guideWorkspaceCloudMocks.getStudyGuide).toHaveBeenCalledWith(
      'user-1',
      'guide-1',
    )
  })

  it('shows Pages, Study Guide, and AI Chat as phone/tablet peer sections', async () => {
    render(
      <MemoryRouter initialEntries={['/workspace/guide-1']}>
        <Routes>
          <Route
            path="/workspace/:studyGuideId"
            element={<GuideWorkspacePage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('study-guide-panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pages' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Study Guide' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI Chat' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Pages' }))
    expect(screen.getByTestId('pages-panel')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'AI Chat' }))
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
  })

  it('opens mobile AI Chat and queues Study Block explain prompts', async () => {
    render(
      <MemoryRouter initialEntries={['/workspace/guide-1']}>
        <Routes>
          <Route
            path="/workspace/:studyGuideId"
            element={<GuideWorkspacePage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByTestId('study-guide-panel')
    fireEvent.click(
      screen.getByRole('button', { name: 'Ask AI from study block' }),
    )

    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    const latestProps = dashboardChatPanelSpy.mock.calls.at(-1)?.[0] as {
      queuedQuestion?: { id: string; content: string } | null
    }

    expect(latestProps.queuedQuestion?.id).toMatch(/^study-block-explain-/)
    expect(latestProps.queuedQuestion?.content).toBe('Explain quiz miss')
  })

  it('opens chat sources on the referenced Study Guide page', async () => {
    render(
      <MemoryRouter initialEntries={['/workspace/guide-1']}>
        <Routes>
          <Route
            path="/workspace/:studyGuideId"
            element={<GuideWorkspacePage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByTestId('study-guide-panel')
    fireEvent.click(screen.getByRole('button', { name: 'AI Chat' }))
    const latestProps = dashboardChatPanelSpy.mock.calls.at(-1)?.[0] as {
      onOpenSource: (source: {
        citationNumber: number
        title: string
        type: string
        textPreview: string
        chunkId: string
        dashboardKey: string
        dashboardTitle: string
      }) => void
    }

    act(() => {
      latestProps.onOpenSource({
        citationNumber: 1,
        title: 'Review notes',
        type: 'MarkdownBlock',
        textPreview: 'Review source preview.',
        chunkId: 'chunk-1',
        dashboardKey: 'review',
        dashboardTitle: 'Review page',
      })
    })

    expect(await screen.findByText('Review page')).toBeInTheDocument()
    expect(screen.queryByText(/Review source preview/)).not.toBeInTheDocument()
  })

  it('saves assistant citations as internal Study Guide page links', async () => {
    render(
      <MemoryRouter initialEntries={['/workspace/guide-1']}>
        <Routes>
          <Route
            path="/workspace/:studyGuideId"
            element={<GuideWorkspacePage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByTestId('study-guide-panel')
    fireEvent.click(screen.getByRole('button', { name: 'AI Chat' }))
    const latestProps = dashboardChatPanelSpy.mock.calls.at(-1)?.[0] as {
      onAddAssistantMessageToGuide: (message: {
        id: string
        role: 'assistant'
        content: string
        createdAt: number
        sourceRefs: Array<{
          citationNumber: number
          title: string
          type: string
          textPreview: string
          chunkId: string
          dashboardKey: string
          dashboardTitle: string
        }>
      }) => void
    }

    act(() => {
      latestProps.onAddAssistantMessageToGuide({
        id: 'assistant-1',
        role: 'assistant',
        content: 'Use the review checklist [2].',
        createdAt: 1,
        sourceRefs: [
          {
            citationNumber: 2,
            title: 'Review notes',
            type: 'MarkdownBlock',
            textPreview: 'Review source preview.',
            chunkId: 'chunk-1',
            dashboardKey: 'review',
            dashboardTitle: 'Review page',
          },
        ],
      })
    })

    expect(localStorage.setItem).toHaveBeenCalledWith(
      STUDY_GUIDES_STORAGE_KEY,
      expect.stringContaining('studymesh-page:review'),
    )
  })

  it('shows the new Study Guide page after adding a web source from mobile chat', async () => {
    render(
      <MemoryRouter initialEntries={['/workspace/guide-1']}>
        <Routes>
          <Route
            path="/workspace/:studyGuideId"
            element={<GuideWorkspacePage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByTestId('study-guide-panel')
    fireEvent.click(screen.getByRole('button', { name: 'AI Chat' }))
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    const latestProps = dashboardChatPanelSpy.mock.calls.at(-1)?.[0] as {
      onAddExternalSourceToGuide: (source: {
        id: string
        url: string
        title: string
        text: string
        searchQuery: string
        fetchedAt: number
      }) => void
    }

    act(() => {
      latestProps.onAddExternalSourceToGuide({
        id: 'web-source-1',
        url: 'https://example.com/dinosaurs',
        title: 'Useful web source',
        text: 'Useful web source. Dinosaurs were discussed in this article with enough detail for a clean study note.',
        guidePageDraftStatus: 'ready',
        guidePageDraft: {
          title: 'Useful web source',
          markdown:
            '# Useful web source\n\nSource: [example.com](https://example.com/dinosaurs)\n\n## Dinosaur detail\nThis page explains the useful dinosaur detail.',
          generatedAt: 1,
        },
        searchQuery: 'student typo query',
        fetchedAt: 1,
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('study-guide-panel')).toHaveTextContent(
        'Useful web source',
      )
    })
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument()
    expect(localStorage.setItem).toHaveBeenCalledWith(
      STUDY_GUIDES_STORAGE_KEY,
      expect.stringContaining('Dinosaur detail'),
    )
    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      STUDY_GUIDES_STORAGE_KEY,
      expect.stringContaining('student typo query'),
    )
  })

  it('saves adjacent assistant citations as separate internal page links', async () => {
    render(
      <MemoryRouter initialEntries={['/workspace/guide-1']}>
        <Routes>
          <Route
            path="/workspace/:studyGuideId"
            element={<GuideWorkspacePage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByTestId('study-guide-panel')
    fireEvent.click(screen.getByRole('button', { name: 'AI Chat' }))
    const latestProps = dashboardChatPanelSpy.mock.calls.at(-1)?.[0] as {
      onAddAssistantMessageToGuide: (message: {
        id: string
        role: 'assistant'
        content: string
        createdAt: number
        sourceRefs: Array<{
          citationNumber: number
          title: string
          type: string
          textPreview: string
          chunkId: string
          dashboardKey: string
          dashboardTitle: string
        }>
      }) => void
    }

    act(() => {
      latestProps.onAddAssistantMessageToGuide({
        id: 'assistant-1',
        role: 'assistant',
        content:
          'Decision checklist (quick guide)\u202f1. Workflow\u202f13. Triggers\u202f1 3. Tools 1[2].',
        createdAt: 1,
        sourceRefs: [
          {
            citationNumber: 1,
            title: 'Core notes',
            type: 'MarkdownBlock',
            textPreview: 'Core source preview.',
            chunkId: 'chunk-1',
            dashboardKey: 'core',
            dashboardTitle: 'Core lesson',
          },
          {
            citationNumber: 2,
            title: 'Review notes',
            type: 'MarkdownBlock',
            textPreview: 'Review source preview.',
            chunkId: 'chunk-2',
            dashboardKey: 'review',
            dashboardTitle: 'Review page',
          },
          {
            citationNumber: 3,
            title: 'Workflow notes',
            type: 'MarkdownBlock',
            textPreview: 'Workflow source preview.',
            chunkId: 'chunk-3',
            dashboardKey: 'workflow',
            dashboardTitle: 'Workflow page',
          },
        ],
      })
    })

    const savedPayload = storedStudyGuidesPayloads().find((payload) =>
      payload.includes('Decision checklist (quick guide)'),
    )
    expect(savedPayload).toContain(
      'Decision checklist (quick guide)\u202f[1](studymesh-page:core).',
    )
    expect(savedPayload).toContain(
      'Workflow\u202f[1](studymesh-page:core) [3](studymesh-page:workflow).',
    )
    expect(savedPayload).toContain(
      'Triggers\u202f[1](studymesh-page:core) [3](studymesh-page:workflow).',
    )
    expect(savedPayload).toContain(
      '[1](studymesh-page:core) [2](studymesh-page:review)',
    )
  })

  it('does not save assistant source footers into Study Guide notes', async () => {
    render(
      <MemoryRouter initialEntries={['/workspace/guide-1']}>
        <Routes>
          <Route
            path="/workspace/:studyGuideId"
            element={<GuideWorkspacePage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByTestId('study-guide-panel')
    fireEvent.click(screen.getByRole('button', { name: 'AI Chat' }))
    const latestProps = dashboardChatPanelSpy.mock.calls.at(-1)?.[0] as {
      onAddAssistantMessageToGuide: (message: {
        id: string
        role: 'assistant'
        content: string
        createdAt: number
        sourceRefs: Array<{
          citationNumber: number
          title: string
          type: string
          textPreview: string
          chunkId: string
          dashboardKey: string
          dashboardTitle: string
        }>
      }) => void
    }

    act(() => {
      latestProps.onAddAssistantMessageToGuide({
        id: 'assistant-1',
        role: 'assistant',
        content:
          'The goal is to cut mistakes [1]. (Sources: [1] Automation overview, [2] Rundeck fundamentals)',
        createdAt: 1,
        sourceRefs: [
          {
            citationNumber: 1,
            title: 'Core notes',
            type: 'MarkdownBlock',
            textPreview: 'Core source preview.',
            chunkId: 'chunk-1',
            dashboardKey: 'core',
            dashboardTitle: 'Core lesson',
          },
          {
            citationNumber: 2,
            title: 'Review notes',
            type: 'MarkdownBlock',
            textPreview: 'Review source preview.',
            chunkId: 'chunk-2',
            dashboardKey: 'review',
            dashboardTitle: 'Review page',
          },
        ],
      })
    })

    const savedPayload = storedStudyGuidesPayloads().find((payload) =>
      payload.includes('The goal is to cut mistakes'),
    )
    expect(savedPayload).toContain('The goal is to cut mistakes')
    expect(savedPayload).toContain('studymesh-page:core')
    expect(savedPayload).not.toContain('Sources:')
    expect(savedPayload).not.toContain('Rundeck fundamentals')
  })

  it('shows a workspace storage warning when Add Page cannot save', async () => {
    render(
      <MemoryRouter initialEntries={['/workspace/guide-1']}>
        <Routes>
          <Route
            path="/workspace/:studyGuideId"
            element={<GuideWorkspacePage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByTestId('study-guide-panel')
    vi.mocked(localStorage.setItem).mockImplementation((key) => {
      if (key === STUDY_GUIDES_STORAGE_KEY) {
        throw new DOMException(
          'Setting the value exceeded the quota.',
          'QuotaExceededError',
        )
      }
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Add page from study guide' }),
    )

    expect(
      await screen.findByText(STUDY_GUIDES_STORAGE_FULL_MESSAGE),
    ).toBeInTheDocument()
  })

  it('shows a workspace storage warning when Add Source cannot save', async () => {
    render(
      <MemoryRouter initialEntries={['/workspace/guide-1']}>
        <Routes>
          <Route
            path="/workspace/:studyGuideId"
            element={<GuideWorkspacePage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByTestId('study-guide-panel')
    fireEvent.click(screen.getByRole('button', { name: 'AI Chat' }))
    const latestProps = dashboardChatPanelSpy.mock.calls.at(-1)?.[0] as {
      onAddExternalSourceToGuide: (source: {
        id: string
        url: string
        title: string
        text: string
        guidePageDraftStatus: string
        guidePageDraft: {
          title: string
          markdown: string
          generatedAt: number
        }
        searchQuery: string
        fetchedAt: number
      }) => void
    }
    vi.mocked(localStorage.setItem).mockImplementation((key) => {
      if (key === STUDY_GUIDES_STORAGE_KEY) {
        throw new DOMException(
          'Setting the value exceeded the quota.',
          'QuotaExceededError',
        )
      }
    })

    act(() => {
      latestProps.onAddExternalSourceToGuide({
        id: 'web-source-1',
        url: 'https://example.com/dinosaurs',
        title: 'Useful web source',
        text: 'Useful web source text.',
        guidePageDraftStatus: 'ready',
        guidePageDraft: {
          title: 'Useful web source',
          markdown: '# Useful web source\n\nUseful source note.',
          generatedAt: 1,
        },
        searchQuery: 'student query',
        fetchedAt: 1,
      })
    })

    expect(
      await screen.findByText(STUDY_GUIDES_STORAGE_FULL_MESSAGE),
    ).toBeInTheDocument()
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
  })

  it('shows a workspace storage warning when chat session persistence is full', async () => {
    render(
      <MemoryRouter initialEntries={['/workspace/guide-1']}>
        <Routes>
          <Route
            path="/workspace/:studyGuideId"
            element={<GuideWorkspacePage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByTestId('study-guide-panel')
    fireEvent.click(screen.getByRole('button', { name: 'AI Chat' }))
    const latestProps = dashboardChatPanelSpy.mock.calls.at(-1)?.[0] as {
      onStorageError: (error: unknown) => void
    }

    act(() => {
      latestProps.onStorageError(
        new DOMException(
          'Setting the value exceeded the quota.',
          'QuotaExceededError',
        ),
      )
    })

    expect(
      await screen.findByText(STUDY_GUIDES_STORAGE_FULL_MESSAGE),
    ).toBeInTheDocument()
  })
})
