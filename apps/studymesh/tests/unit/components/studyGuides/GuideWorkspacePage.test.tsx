import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import GuideWorkspacePage, {
  AI_CHAT_MIN_WIDTH,
} from '../../../../src/components/studyGuides/GuideWorkspacePage'
import { STUDY_GUIDES_STORAGE_KEY } from '../../../../src/studyGuides/storage'

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
  }: {
    studyPath: { selectedIndex: number; dashboards: Array<{ name: string }> }
  }) => (
    <div data-testid="study-guide-panel">
      {studyPath.dashboards[studyPath.selectedIndex]?.name}
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

describe('GuideWorkspacePage responsive sections', () => {
  it('allows the desktop AI Chat panel to shrink to 310px', () => {
    expect(AI_CHAT_MIN_WIDTH).toBe(310)
  })

  beforeEach(() => {
    dashboardChatPanelSpy.mockClear()
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

    const savedPayload = vi.mocked(localStorage.setItem).mock.calls.at(-1)?.[1]
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

    const savedPayload = vi.mocked(localStorage.setItem).mock.calls.at(-1)?.[1]
    expect(savedPayload).toContain('The goal is to cut mistakes')
    expect(savedPayload).toContain('studymesh-page:core')
    expect(savedPayload).not.toContain('Sources:')
    expect(savedPayload).not.toContain('Rundeck fundamentals')
  })
})
