import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
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
  default: () => <div data-testid="study-guide-panel" />,
}))

vi.mock('../../../../src/components/Dasboard/StudyGuidePagesPanel', () => ({
  default: () => <div data-testid="pages-panel" />,
}))

vi.mock('../../../../src/components/dashboardChat/DashboardChatPanel', () => ({
  default: () => <div data-testid="chat-panel" />,
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
})
