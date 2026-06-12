import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import DashboardChatPanel from '../../../../src/components/dashboardChat/DashboardChatPanel'
import type { StateDashboard } from '../../../../src/state/store'

vi.mock('../../../../src/quickCreate/ai', () => ({
  __esModule: true,
  readQuickCreateAiSettings: () => ({ provider: 'gemini' }),
}))

vi.mock(
  '../../../../src/components/WidgetEditor/components/preview/StudyBlockView',
  () => ({
    __esModule: true,
    renderMarkdown: (value: string) => <span>{value}</span>,
  }),
)

const dashboardWithContext: StateDashboard = {
  id: 'dashboard-1',
  name: 'Biology Dashboard',
  layout: {
    type: 'tabset',
    children: [
      {
        type: 'tab',
        id: 'tab-1',
        name: 'Source Notes',
        component: 'markdown',
        config: {
          customProps: {
            components: [
              {
                id: 'notes-1',
                type: 'MarkdownBlock',
                props: {
                  title: 'Photosynthesis notes',
                  markdown: 'Plants use light, water, and carbon dioxide.',
                },
              },
            ],
          },
        },
      },
    ],
  },
}

const dashboardWithoutContext: StateDashboard = {
  id: 'dashboard-2',
  name: 'Empty Dashboard',
  layout: { type: 'tabset', children: [] },
}

const renderPanel = (
  options: {
    dashboard?: StateDashboard
    onQuickCreatePage?: React.ComponentProps<
      typeof DashboardChatPanel
    >['onQuickCreatePage']
    supportsStudyGuideCreateScope?: boolean
  } = {},
) =>
  render(
    <DashboardChatPanel
      dashboard={options.dashboard ?? dashboardWithContext}
      messages={[]}
      onMessagesChange={vi.fn()}
      onClose={vi.fn()}
      onQuickCreatePage={options.onQuickCreatePage ?? vi.fn()}
      supportsStudyGuideCreateScope={options.supportsStudyGuideCreateScope}
    />,
  )

describe('DashboardChatPanel quick create menu', () => {
  it('shows one Create entry point instead of permanent quick-create buttons', () => {
    renderPanel()

    expect(screen.getByRole('button', { name: /^Create$/i })).toHaveStyle({
      height: '40px',
      minHeight: '40px',
    })
    expect(
      screen.queryByRole('button', { name: /^Quiz$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Flashcards$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Expand on this$/i }),
    ).not.toBeInTheDocument()
  })

  it('opens action menu and sends the selected quick-create request', async () => {
    const onQuickCreatePage = vi.fn().mockResolvedValue(undefined)
    renderPanel({ onQuickCreatePage })

    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Quiz$/i }))

    await waitFor(() =>
      expect(onQuickCreatePage).toHaveBeenCalledWith({
        actionId: 'quiz',
        resourceType: 'quiz',
        label: 'Quiz',
      }),
    )
  })

  it('defaults Study Guide Create to Study Guide source', async () => {
    const onQuickCreatePage = vi.fn().mockResolvedValue(undefined)
    renderPanel({ onQuickCreatePage, supportsStudyGuideCreateScope: true })

    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))

    expect(
      screen.getByText(/Excludes previous Quick Create results/i),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Quiz$/i }))

    await waitFor(() =>
      expect(onQuickCreatePage).toHaveBeenCalledWith({
        actionId: 'quiz',
        resourceType: 'quiz',
        label: 'Quiz',
        sourceScope: 'studyGuide',
      }),
    )
  })

  it('can create from only the current Study Guide page', async () => {
    const onQuickCreatePage = vi.fn().mockResolvedValue(undefined)
    renderPanel({ onQuickCreatePage, supportsStudyGuideCreateScope: true })

    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Current page$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Flashcards$/i }))

    await waitFor(() =>
      expect(onQuickCreatePage).toHaveBeenCalledWith({
        actionId: 'flashcards',
        resourceType: 'flashcards',
        label: 'Flashcards',
        sourceScope: 'currentPage',
      }),
    )
  })

  it('disables create when the dashboard has no chat context', () => {
    renderPanel({ dashboard: dashboardWithoutContext })

    expect(screen.getByRole('button', { name: /^Create$/i })).toBeDisabled()
  })

  it('shows compact progress and disables create while quick-create runs', async () => {
    let resolveQuickCreate: () => void = () => {}
    const onQuickCreatePage = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveQuickCreate = resolve
        }),
    )
    renderPanel({ onQuickCreatePage })

    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Flashcards$/i }))

    expect(screen.getByRole('button', { name: /^Create$/i })).toBeDisabled()
    expect(screen.getByText(/Creating Flashcards/i)).toBeInTheDocument()

    await act(async () => {
      resolveQuickCreate()
    })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Create$/i })).toBeEnabled(),
    )
  })
})

describe('DashboardChatPanel chat management', () => {
  it('only offers delete inside Chats and closes the menu after deleting', async () => {
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'studymesh-dashboard-chat-sessions-dashboard-1'
        ? JSON.stringify([
            {
              id: 'chat-1',
              title: 'First chat',
              messages: [
                {
                  id: 'message-1',
                  role: 'user',
                  content: 'First question',
                },
                {
                  id: 'message-2',
                  role: 'assistant',
                  content: 'First answer',
                },
              ],
              createdAt: 1,
              updatedAt: 1,
            },
            {
              id: 'chat-2',
              title: 'Second chat',
              messages: [],
              createdAt: 2,
              updatedAt: 2,
            },
          ])
        : null,
    )

    renderPanel()

    expect(
      screen.queryByRole('button', { name: 'Clear dashboard chat' }),
    ).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Chats' }))
    expect(screen.getByLabelText('Delete First chat')).toBeInTheDocument()
    expect(screen.getByText('1 reply')).toBeInTheDocument()
    expect(screen.getByText('0 replies')).toBeInTheDocument()
    expect(screen.queryByText(/messages/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Delete First chat'))

    await waitFor(() =>
      expect(
        screen.queryByLabelText('Delete Second chat'),
      ).not.toBeInTheDocument(),
    )
  })
})
