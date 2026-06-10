import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import DashboardChatPanel from '../../../../src/components/dashboardChat/DashboardChatPanel'
import type { StateDashboard } from '../../../../src/state/store'

vi.mock('../../../../src/studyPack/ai', () => ({
  __esModule: true,
  readStudyPackAiSettings: () => ({ provider: 'gemini' }),
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
  } = {},
) =>
  render(
    <DashboardChatPanel
      dashboard={options.dashboard ?? dashboardWithContext}
      messages={[]}
      onMessagesChange={vi.fn()}
      onClose={vi.fn()}
      onQuickCreatePage={options.onQuickCreatePage ?? vi.fn()}
    />,
  )

describe('DashboardChatPanel quick create menu', () => {
  it('shows one Create entry point instead of permanent quick-create buttons', () => {
    renderPanel()

    expect(
      screen.getByRole('button', { name: /^Create$/i }),
    ).toBeInTheDocument()
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

