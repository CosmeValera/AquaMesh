import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import DashboardChatPanel, {
  AI_CHAT_PET_CHANGED_EVENT,
  AI_CHAT_PET_STORAGE_KEY,
  aiChatPets,
  getAiChatPetSrc,
} from '../../../../src/components/dashboardChat/DashboardChatPanel'
import { askDashboardSources } from '../../../../src/dashboardChat/askDashboard'
import { fetchDashboardExternalSource } from '../../../../src/dashboardChat/externalSources'
import { prepareDashboardExternalSourcePageDraft } from '../../../../src/dashboardChat/sourcePageDrafts'
import { planDashboardChatSources } from '../../../../src/dashboardChat/sourcePlanner'
import type { StateDashboard } from '../../../../src/state/store'
import { AccentColorProvider } from '../../../../src/theme/AccentColorContext'
import {
  accentColorOptions,
  getAccentColorById,
  type AccentColorId,
} from '../../../../src/theme/accentColors'
import { PREFILL_DASHBOARD_CHAT_EVENT } from '../../../../src/components/workspace/workspaceEvents'

vi.mock('../../../../src/quickCreate/ai', () => ({
  __esModule: true,
  readQuickCreateAiSettings: () => ({ provider: 'gemini' }),
}))

vi.mock('../../../../src/dashboardChat/askDashboard', () => ({
  __esModule: true,
  askDashboardSources: vi.fn(),
}))

vi.mock('../../../../src/dashboardChat/externalSources', () => ({
  __esModule: true,
  fetchDashboardExternalSource: vi.fn(),
}))

vi.mock('../../../../src/dashboardChat/sourcePageDrafts', () => ({
  __esModule: true,
  prepareDashboardExternalSourcePageDraft: vi.fn(),
}))

vi.mock('../../../../src/dashboardChat/sourcePlanner', () => ({
  __esModule: true,
  fallbackDashboardChatSourcePlan: vi.fn(
    (question: string, selectedSources: string[]) => ({
      selectedSources: selectedSources.length
        ? selectedSources
        : ['study-guide', 'general'],
      shouldSearchWeb: selectedSources.includes('web'),
      searchQuery: question,
      answerStyleHint: 'Respect the prompt.',
    }),
  ),
  planDashboardChatSources: vi.fn(),
}))

vi.mock('../../../../src/components/study/StudyBlockView', () => ({
  __esModule: true,
  renderMarkdown: (
    value: string,
    options?: {
      renderCitation?: (citationNumber: number, key: string) => React.ReactNode
    },
  ) => (
    <span>
      {value.split(/(\[\d+\])/).map((part, index) => {
        const citation = part.match(/^\[(\d+)\]$/)
        return citation && options?.renderCitation
          ? options.renderCitation(Number(citation[1]), `${part}-${index}`)
          : part
      })}
    </span>
  ),
}))

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
    onOpenSource?: React.ComponentProps<
      typeof DashboardChatPanel
    >['onOpenSource']
    onAddExternalSourceToGuide?: React.ComponentProps<
      typeof DashboardChatPanel
    >['onAddExternalSourceToGuide']
    onMessagesChange?: React.ComponentProps<
      typeof DashboardChatPanel
    >['onMessagesChange']
    queuedDraft?: React.ComponentProps<typeof DashboardChatPanel>['queuedDraft']
    onQueuedDraftConsumed?: React.ComponentProps<
      typeof DashboardChatPanel
    >['onQueuedDraftConsumed']
    supportsStudyGuideCreateScope?: boolean
    messages?: React.ComponentProps<typeof DashboardChatPanel>['messages']
    accentColorId?: AccentColorId
  } = {},
) => {
  const accentColorId = options.accentColorId ?? 'purple'
  const accentColor = getAccentColorById(accentColorId)

  return render(
    <AccentColorProvider
      value={{
        accentColorId,
        accentColor,
        setAccentColorId: vi.fn(),
        options: accentColorOptions,
      }}
    >
      <DashboardChatPanel
        dashboard={options.dashboard ?? dashboardWithContext}
        messages={options.messages ?? []}
        onMessagesChange={options.onMessagesChange ?? vi.fn()}
        onClose={vi.fn()}
        onQuickCreatePage={options.onQuickCreatePage ?? vi.fn()}
        onOpenSource={options.onOpenSource}
        onAddExternalSourceToGuide={options.onAddExternalSourceToGuide}
        queuedDraft={options.queuedDraft}
        onQueuedDraftConsumed={options.onQueuedDraftConsumed}
        supportsStudyGuideCreateScope={options.supportsStudyGuideCreateScope}
      />
    </AccentColorProvider>,
  )
}

const enableWebSourceSelection = () => {
  fireEvent.click(screen.getByRole('button', { name: /Answer sources/i }))
  fireEvent.click(screen.getByRole('menuitem', { name: /Web search/i }))
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
}

const enableGeneralSourceSelection = () => {
  fireEvent.click(screen.getByRole('button', { name: /Answer sources/i }))
  fireEvent.click(screen.getByRole('menuitem', { name: /General knowledge/i }))
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
}

beforeEach(() => {
  HTMLElement.prototype.scrollTo = vi.fn()
  vi.mocked(localStorage.getItem).mockReset()
  vi.mocked(localStorage.getItem).mockReturnValue(null)
  vi.mocked(localStorage.setItem).mockReset()
  vi.mocked(askDashboardSources).mockReset()
  vi.mocked(planDashboardChatSources).mockReset()
  vi.mocked(planDashboardChatSources).mockResolvedValue({
    selectedSources: ['study-guide', 'general'],
    shouldSearchWeb: false,
    searchQuery: 'default search query',
    answerStyleHint: 'Respect the prompt.',
  })
  vi.mocked(askDashboardSources).mockResolvedValue({
    answer: 'Use the dashboard source notes [1].',
    sourceRefs: [
      {
        citationNumber: 1,
        chunkId: 'notes-1',
        title: 'Photosynthesis notes',
        type: 'MarkdownBlock',
        textPreview: 'Plants use light, water, and carbon dioxide.',
        dashboardKey: 'dashboard-page-1',
        dashboardTitle: 'Source Notes',
      },
    ],
    answerBasis: ['study-guide'],
    contextSupport: 'direct',
  })
  vi.mocked(fetchDashboardExternalSource).mockReset()
  vi.mocked(fetchDashboardExternalSource).mockResolvedValue([
    {
      id: 'web-source-1',
      url: 'https://example.com/ansible',
      title: 'Ansible guide',
      text: 'Ansible automates provisioning and configuration management.',
      searchQuery: 'How does Ansible compare? Biology Dashboard',
      score: 0.9,
      fetchedAt: 1,
    },
  ])
  vi.mocked(prepareDashboardExternalSourcePageDraft).mockReset()
  vi.mocked(prepareDashboardExternalSourcePageDraft).mockResolvedValue({
    title: 'Ansible source notes',
    markdown:
      '# Ansible source notes\n\nSource: [example.com](https://example.com/ansible)\n\n## Why this source matters\nAnsible helps explain the missing comparison.\n\n## Key points\n- Ansible automates provisioning and configuration management.',
    generatedAt: 1,
  })
})

describe('DashboardChatPanel quick create menu', () => {
  it('opens a translucent face-only companion picker from the chat header', () => {
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Choose AI companion' }))

    expect(
      screen.getByRole('listbox', { name: 'AI companions' }),
    ).toBeInTheDocument()
    for (const pet of aiChatPets) {
      expect(
        screen.getByRole('option', { name: `Choose ${pet.label}` }),
      ).toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole('option', { name: 'Choose Parrot' }))

    expect(localStorage.setItem).toHaveBeenCalledWith(
      AI_CHAT_PET_STORAGE_KEY,
      'parrot',
    )
    expect(
      screen.getByRole('listbox', { name: 'AI companions' }),
    ).toBeInTheDocument()
  })

  it('refreshes the active companion face when the shared pet event fires', () => {
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === AI_CHAT_PET_STORAGE_KEY ? 'parrot' : null,
    )

    const { container } = renderPanel()

    act(() => {
      window.dispatchEvent(new CustomEvent(AI_CHAT_PET_CHANGED_EVENT))
    })

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      getAiChatPetSrc(aiChatPets[2], 'face'),
    )
  })

  it('keeps the empty chat compact and shows its prompt ideas directly', () => {
    renderPanel()

    expect(
      screen.queryByText(/Ask questions based on the sources/i),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Summarize the key ideas' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: "Explain this like I'm new" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Generate exam-style questions' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'What should I review first?' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'More ideas' }),
    ).not.toBeInTheDocument()
  })

  it('persists answer source selection locally', async () => {
    renderPanel()

    enableWebSourceSelection()

    await waitFor(() =>
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'studymesh-dashboard-chat-source-selection',
        JSON.stringify(['web']),
      ),
    )
  })

  it('honors Study Guide only source selection without web lookup', async () => {
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /Answer sources/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /^Study Guide$/i }))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    fireEvent.change(screen.getByPlaceholderText('Ask anything'), {
      target: { value: 'What are the biggest muscles?' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Send dashboard question' }),
    )

    await waitFor(() => expect(askDashboardSources).toHaveBeenCalled())
    expect(fetchDashboardExternalSource).not.toHaveBeenCalled()
    expect(vi.mocked(askDashboardSources).mock.calls[0][0]).toMatchObject({
      allowedSources: ['study-guide'],
    })
  })

  it('prefills a queued explain draft without sending it', async () => {
    const onMessagesChange = vi.fn()
    const onQueuedDraftConsumed = vi.fn()
    renderPanel({
      onMessagesChange,
      onQueuedDraftConsumed,
      queuedDraft: {
        id: 'explain-draft-1',
        content: ' Explain photosynthesis ',
      },
    })

    const input = screen.getByPlaceholderText('Ask anything')
    await waitFor(() => expect(input).toHaveValue('Explain photosynthesis'))
    expect(onQueuedDraftConsumed).toHaveBeenCalledWith('explain-draft-1')
    expect(askDashboardSources).not.toHaveBeenCalled()
    expect(input).not.toHaveFocus()

    fireEvent.click(
      screen.getByRole('button', { name: 'Send dashboard question' }),
    )

    await waitFor(() => expect(askDashboardSources).toHaveBeenCalled())
  })

  it('replaces an existing draft when an explain prefill event arrives', async () => {
    renderPanel()
    const input = screen.getByPlaceholderText('Ask anything')
    fireEvent.change(input, { target: { value: 'Existing draft' } })

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PREFILL_DASHBOARD_CHAT_EVENT, {
          detail: { content: 'Replacement explain prompt' },
        }),
      )
    })

    await waitFor(() => expect(input).toHaveValue('Replacement explain prompt'))
    expect(askDashboardSources).not.toHaveBeenCalled()
    expect(input).not.toHaveFocus()
  })

  it('shows one Create entry point instead of permanent quick-create buttons', () => {
    renderPanel()

    expect(screen.getByRole('button', { name: /^Create$/i })).toHaveStyle({
      height: '32px',
      minHeight: '32px',
      width: '32px',
    })
    expect(
      screen.getByRole('button', { name: /^Create$/i }),
    ).not.toHaveTextContent('Create')
    expect(
      screen.queryByRole('button', { name: /^Quiz$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Flashcards$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Podcast$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Expand on this$/i }),
    ).not.toBeInTheDocument()
  })

  it('focuses the chat textbox when the composer surface is clicked', () => {
    renderPanel()

    fireEvent.mouseDown(screen.getByTestId('dashboard-chat-composer'))

    expect(screen.getByPlaceholderText('Ask anything')).toHaveFocus()
  })

  it('focuses the chat textbox when the composer action row is clicked', () => {
    renderPanel()

    fireEvent.mouseDown(screen.getByTestId('dashboard-chat-composer-actions'))

    expect(screen.getByPlaceholderText('Ask anything')).toHaveFocus()
  })

  it('opens action menu and sends the selected quick-create request', async () => {
    const onQuickCreatePage = vi.fn().mockResolvedValue(undefined)
    renderPanel({ onQuickCreatePage })

    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))
    expect(screen.getByRole('button', { name: /^Quiz$/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Flashcards$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Podcast$/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Expand on this$/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('quick-create-action-icon-quiz')).toHaveStyle({
      color: '#7B1FA2',
    })
    expect(
      screen.getByTestId('quick-create-action-icon-flashcards'),
    ).toHaveStyle({
      color: '#7B1FA2',
    })
    expect(screen.getByTestId('quick-create-action-icon-podcast')).toHaveStyle({
      color: '#7B1FA2',
    })
    fireEvent.click(screen.getByRole('button', { name: /^Quiz$/i }))

    await waitFor(() =>
      expect(onQuickCreatePage).toHaveBeenCalledWith(
        {
          actionId: 'quiz',
          resourceType: 'quiz',
          label: 'Quiz',
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
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
      expect(onQuickCreatePage).toHaveBeenCalledWith(
        {
          actionId: 'quiz',
          resourceType: 'quiz',
          label: 'Quiz',
          sourceScope: 'studyGuide',
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    )
  })

  it('sends podcast quick-create requests from the Study Guide source', async () => {
    const onQuickCreatePage = vi.fn().mockResolvedValue(undefined)
    renderPanel({ onQuickCreatePage, supportsStudyGuideCreateScope: true })

    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Podcast$/i }))

    await waitFor(() =>
      expect(onQuickCreatePage).toHaveBeenCalledWith(
        {
          actionId: 'podcast',
          resourceType: 'podcast',
          label: 'Podcast',
          sourceScope: 'studyGuide',
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    )
  })

  it('allows multiple quick-create tasks to run at the same time', async () => {
    const resolvers = new Map<string, () => void>()
    const onQuickCreatePage = vi.fn(
      (request: { actionId: string }) =>
        new Promise<void>((resolve) => {
          resolvers.set(request.actionId, resolve)
        }),
    )
    renderPanel({ onQuickCreatePage })

    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Quiz$/i }))

    expect(
      await screen.findByTestId('dashboard-chat-quick-create-task-quiz'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Create$/i })).not.toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Flashcards$/i }))

    expect(
      await screen.findByTestId('dashboard-chat-quick-create-task-flashcards'),
    ).toBeInTheDocument()
    expect(onQuickCreatePage).toHaveBeenCalledTimes(2)

    await act(async () => {
      resolvers.get('flashcards')?.()
    })

    await waitFor(() =>
      expect(
        screen.queryByTestId('dashboard-chat-quick-create-task-flashcards'),
      ).not.toBeInTheDocument(),
    )
    expect(
      screen.getByTestId('dashboard-chat-quick-create-task-quiz'),
    ).toBeInTheDocument()
  })

  it('cancels a quick-create task without showing a failure alert', async () => {
    let signal: AbortSignal | undefined
    const onQuickCreatePage = vi.fn(
      (_request, options?: { signal?: AbortSignal }) =>
        new Promise<void>((_resolve, reject) => {
          signal = options?.signal
          options?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Cancelled', 'AbortError'))
          })
        }),
    )
    renderPanel({ onQuickCreatePage })

    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Quiz$/i }))

    expect(
      await screen.findByTestId('dashboard-chat-quick-create-task-quiz'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cancel Quiz/i }))

    await waitFor(() =>
      expect(
        screen.queryByTestId('dashboard-chat-quick-create-task-quiz'),
      ).not.toBeInTheDocument(),
    )
    expect(signal?.aborted).toBe(true)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('dismisses quick-create failure alerts', async () => {
    const onQuickCreatePage = vi
      .fn()
      .mockRejectedValue(
        new Error(
          'Daily podcast generation limit reached. Try again tomorrow.',
        ),
      )
    renderPanel({ onQuickCreatePage, supportsStudyGuideCreateScope: true })

    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Podcast$/i }))

    expect(
      await screen.findByText(
        'Daily podcast generation limit reached. Try again tomorrow.',
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Dismiss alert/i }))

    expect(
      screen.queryByText(
        'Daily podcast generation limit reached. Try again tomorrow.',
      ),
    ).not.toBeInTheDocument()
  })

  it('can create from only the current Study Guide page', async () => {
    const onQuickCreatePage = vi.fn().mockResolvedValue(undefined)
    renderPanel({ onQuickCreatePage, supportsStudyGuideCreateScope: true })

    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Current page$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Flashcards$/i }))

    await waitFor(() =>
      expect(onQuickCreatePage).toHaveBeenCalledWith(
        {
          actionId: 'flashcards',
          resourceType: 'flashcards',
          label: 'Flashcards',
          sourceScope: 'currentPage',
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    )
  })

  it('adds pasted source without AI and uses it in later chat answers', async () => {
    renderPanel({ dashboard: dashboardWithoutContext })

    fireEvent.click(screen.getByRole('button', { name: /^Add source$/i }))
    const sourceDialog = screen.getByRole('dialog', {
      name: 'Add source to AI Chat',
    })
    expect(within(sourceDialog).queryByLabelText('Title (optional)')).toBeNull()
    fireEvent.click(
      within(sourceDialog).getByRole('button', { name: /^Copied text$/i }),
    )
    const pasteDialog = screen.getByRole('dialog', {
      name: 'Paste copied text',
    })
    fireEvent.change(
      within(pasteDialog).getByRole('textbox', { name: 'Source text' }),
      {
        target: {
          value:
            'ATP stores usable energy for cells. Mitochondria produce ATP during cellular respiration.',
        },
      },
    )
    const insertSourceButton = within(pasteDialog).getByRole('button', {
      name: /^Insert$/i,
    })
    await waitFor(() => expect(insertSourceButton).toBeEnabled())
    fireEvent.click(insertSourceButton)

    expect(fetchDashboardExternalSource).not.toHaveBeenCalled()
    expect(askDashboardSources).not.toHaveBeenCalled()
    expect(await screen.findByText('Pasted source')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    fireEvent.change(screen.getByPlaceholderText('Ask anything'), {
      target: { value: 'How does ATP work?' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Send dashboard question' }),
    )

    await waitFor(() => expect(askDashboardSources).toHaveBeenCalled())
    expect(
      vi.mocked(askDashboardSources).mock.calls[0][0].contextText,
    ).toContain('ATP stores usable energy for cells.')
  })

  it('adds text file source without asking AI', async () => {
    renderPanel({ dashboard: dashboardWithoutContext })

    fireEvent.click(screen.getByRole('button', { name: /^Add source$/i }))
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    const file = new File(
      ['File source text about glycolysis and ATP production.'],
      'glycolysis.md',
      { type: 'text/markdown' },
    )

    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(fetchDashboardExternalSource).not.toHaveBeenCalled()
    expect(askDashboardSources).not.toHaveBeenCalled()
    expect(await screen.findByText('glycolysis.md')).toBeInTheDocument()
  })

  it('adds webpage source through extraction without asking AI', async () => {
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: /^Add source$/i }))
    const dialog = screen.getByRole('dialog', {
      name: 'Add source to AI Chat',
    })
    fireEvent.change(within(dialog).getByLabelText('Webpage URL'), {
      target: { value: 'google.com' },
    })
    fireEvent.keyDown(within(dialog).getByLabelText('Webpage URL'), {
      key: 'Enter',
    })

    await waitFor(() =>
      expect(fetchDashboardExternalSource).toHaveBeenCalledWith({
        url: 'https://google.com',
        dashboardTitle: 'Biology Dashboard',
      }),
    )
    expect(askDashboardSources).not.toHaveBeenCalled()
    expect(await screen.findByText('Ansible guide')).toBeInTheDocument()
  })

  it('limits added source context to the top three user sources per answer', async () => {
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'studymesh-dashboard-chat-sessions-dashboard-2'
        ? JSON.stringify([
            {
              id: 'source-chat',
              title: 'Source chat',
              messages: [],
              externalSources: [1, 2, 3, 4].map((index) => ({
                id: `user-source-${index}`,
                url: `studymesh://user-source/${index}`,
                title: `Source ${index}`,
                text: `Shared source content ${index}.`,
                originType: 'user-text',
                searchQuery: `Source ${index}`,
                fetchedAt: index,
              })),
              createdAt: 1,
              updatedAt: 1,
            },
          ])
        : null,
    )
    renderPanel({ dashboard: dashboardWithoutContext })

    await screen.findByText('Source 1')
    fireEvent.change(screen.getByPlaceholderText('Ask anything'), {
      target: { value: 'summarize shared content' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Send dashboard question' }),
    )

    await waitFor(() => expect(askDashboardSources).toHaveBeenCalled())
    const contextText =
      vi.mocked(askDashboardSources).mock.calls[0][0].contextText
    expect(contextText).toContain('Source 1')
    expect(contextText).toContain('Source 2')
    expect(contextText).toContain('Source 3')
    expect(contextText).not.toContain('Source 4')
  })

  it('removes added sources from later chat context', async () => {
    renderPanel({ dashboard: dashboardWithoutContext })

    fireEvent.click(screen.getByRole('button', { name: /^Add source$/i }))
    const dialog = screen.getByRole('dialog', {
      name: 'Add source to AI Chat',
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: /^Copied text$/i }),
    )
    const pasteDialog = screen.getByRole('dialog', {
      name: 'Paste copied text',
    })
    fireEvent.change(
      within(pasteDialog).getByRole('textbox', { name: 'Source text' }),
      {
        target: { value: 'Temporary source text with enough content to save.' },
      },
    )
    const addPastedSourceButton = within(pasteDialog).getByRole('button', {
      name: /^Insert$/i,
    })
    await waitFor(() => expect(addPastedSourceButton).toBeEnabled())
    fireEvent.click(addPastedSourceButton)

    expect(await screen.findByText('Pasted source')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /^Remove source: Pasted source$/i }),
    )

    expect(screen.queryByText('Pasted source')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ask anything')).toBeEnabled()
  })

  it('disables create when the dashboard has no chat context', () => {
    renderPanel({ dashboard: dashboardWithoutContext })

    expect(screen.getByRole('button', { name: /^Create$/i })).toBeDisabled()
  })

  it('focuses the composer surface even before chat has study material', () => {
    renderPanel({ dashboard: dashboardWithoutContext })

    fireEvent.mouseDown(screen.getByTestId('dashboard-chat-composer'))

    expect(screen.getByPlaceholderText('Ask anything')).toHaveFocus()
  })

  it('shows compact progress and keeps create available while quick-create runs', async () => {
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

    expect(screen.getByRole('button', { name: /^Create$/i })).toBeEnabled()
    expect(screen.getByText(/Creating Flashcards/i)).toBeInTheDocument()
    expect(screen.getByText(/0s\s*\/\s*~\s*25s/i)).toBeInTheDocument()
    expect(screen.queryByText(/\d+s\s*\/\s*25s/i)).not.toBeInTheDocument()

    await act(async () => {
      resolveQuickCreate()
    })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Create$/i })).toBeEnabled(),
    )
    expect(screen.queryByText(/Creating Flashcards/i)).not.toBeInTheDocument()
  })
})

describe('DashboardChatPanel chat management', () => {
  const getLastPersistedChatSessions = () => {
    const calls = vi.mocked(localStorage.setItem).mock.calls
    const [, value] = calls[calls.length - 1]
    return JSON.parse(value)
  }

  const countEmptyChatSessions = (sessions: { messages: unknown[] }[]) =>
    sessions.filter((session) => session.messages.length === 0).length

  it('scrolls to the latest message when opening a chat with history', async () => {
    renderPanel({
      messages: [
        {
          id: 'message-1',
          role: 'user',
          content: 'Earlier question',
          createdAt: 1,
        },
        {
          id: 'message-2',
          role: 'assistant',
          content: 'Latest answer',
          createdAt: 2,
        },
      ],
    })

    await waitFor(() =>
      expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith(
        expect.objectContaining({
          behavior: 'auto',
        }),
      ),
    )
  })

  it('keeps one empty chat at the top when loading saved sessions', async () => {
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'studymesh-dashboard-chat-sessions-dashboard-1'
        ? JSON.stringify([
            {
              id: 'chat-1',
              title: 'Existing chat',
              messages: [
                {
                  id: 'message-1',
                  role: 'user',
                  content: 'Existing question',
                  createdAt: 1,
                },
              ],
              createdAt: 1,
              updatedAt: 1,
            },
            {
              id: 'empty-1',
              title: 'Old empty',
              messages: [],
              createdAt: 2,
              updatedAt: 2,
            },
            {
              id: 'empty-2',
              title: 'Another empty',
              messages: [],
              createdAt: 3,
              updatedAt: 3,
            },
          ])
        : null,
    )

    renderPanel()

    await waitFor(() => expect(localStorage.setItem).toHaveBeenCalled())

    const sessions = getLastPersistedChatSessions()
    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toMatchObject({
      id: 'empty-1',
      title: 'New chat',
      messages: [],
    })
    expect(sessions[1]).toMatchObject({ id: 'chat-1' })
  })

  it('selects the existing empty chat instead of creating another new chat', async () => {
    const Harness = () => {
      const [panelMessages, setPanelMessages] = React.useState<
        React.ComponentProps<typeof DashboardChatPanel>['messages']
      >([])

      return (
        <DashboardChatPanel
          dashboard={dashboardWithContext}
          messages={panelMessages}
          onMessagesChange={setPanelMessages}
          onClose={vi.fn()}
          onQuickCreatePage={vi.fn()}
        />
      )
    }

    render(<Harness />)

    fireEvent.change(screen.getByPlaceholderText('Ask anything'), {
      target: { value: 'What is photosynthesis?' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Send dashboard question' }),
    )

    expect(
      await screen.findByText(/Use the dashboard source notes/i),
    ).toBeInTheDocument()

    let sessions = getLastPersistedChatSessions()
    expect(countEmptyChatSessions(sessions)).toBe(1)
    expect(sessions[0].messages).toHaveLength(0)
    expect(sessions[1].messages).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))

    sessions = getLastPersistedChatSessions()
    expect(countEmptyChatSessions(sessions)).toBe(1)
    expect(sessions[0].messages).toHaveLength(0)
    expect(screen.getAllByText('New chat').length).toBeGreaterThan(0)
  })

  it('answers smalltalk without dashboard RAG or web lookup', async () => {
    const Harness = () => {
      const [panelMessages, setPanelMessages] = React.useState<
        React.ComponentProps<typeof DashboardChatPanel>['messages']
      >([])

      return (
        <DashboardChatPanel
          dashboard={dashboardWithContext}
          messages={panelMessages}
          onMessagesChange={setPanelMessages}
          onClose={vi.fn()}
          onQuickCreatePage={vi.fn()}
        />
      )
    }

    render(<Harness />)

    fireEvent.change(screen.getByPlaceholderText('Ask anything'), {
      target: { value: 'say hi twice' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Send dashboard question' }),
    )

    expect(await screen.findByText('Hi! Hi!')).toBeInTheDocument()
    expect(askDashboardSources).not.toHaveBeenCalled()
    expect(fetchDashboardExternalSource).not.toHaveBeenCalled()
    expect(screen.queryByText(/searching web/i)).not.toBeInTheDocument()
  })

  it('answers recall from previous final web answer without Tavily', async () => {
    const messages = [
      {
        id: 'user-1',
        role: 'user' as const,
        content: 'what are RKE2, AWS, and Terraform',
        createdAt: 1,
      },
      {
        id: 'assistant-1',
        role: 'assistant' as const,
        content:
          'AWS means Amazon Web Services. Terraform is declarative infrastructure as code.',
        externalSourceIds: ['web-source-aws'],
        createdAt: 2,
      },
    ]
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'studymesh-dashboard-chat-sessions-dashboard-1'
        ? JSON.stringify([
            {
              id: 'chat-1',
              title: 'Cloud tools',
              messages,
              externalSources: [
                {
                  id: 'web-source-aws',
                  url: 'https://docs.example/aws',
                  title: 'AWS docs',
                  text: 'AWS means Amazon Web Services, a cloud platform for compute, storage, networking, and managed services.',
                  searchQuery: 'AWS Terraform',
                  usedInAnswer: true,
                  coveredEntities: ['aws', 'terraform'],
                  fetchedAt: 1,
                },
              ],
              memoryItems: [
                {
                  userQuestion: 'what are RKE2, AWS, and Terraform',
                  finalAssistantAnswer:
                    'AWS means Amazon Web Services. Terraform is declarative infrastructure as code.',
                  coveredEntities: ['aws', 'terraform', 'rke2'],
                  usedSourceIds: ['web-source-aws'],
                  sourceSummaries: ['AWS docs: AWS means Amazon Web Services.'],
                  createdAt: '2026-01-01T00:00:00.000Z',
                },
              ],
              createdAt: 1,
              updatedAt: 2,
            },
          ])
        : null,
    )
    const Harness = () => {
      const [panelMessages, setPanelMessages] =
        React.useState<
          React.ComponentProps<typeof DashboardChatPanel>['messages']
        >(messages)

      return (
        <DashboardChatPanel
          dashboard={dashboardWithContext}
          messages={panelMessages}
          onMessagesChange={setPanelMessages}
          onClose={vi.fn()}
          onQuickCreatePage={vi.fn()}
        />
      )
    }

    render(<Harness />)

    fireEvent.change(screen.getByPlaceholderText('Ask anything'), {
      target: { value: 'remind me what you said about aws' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Send dashboard question' }),
    )

    expect(
      await screen.findByText(
        /Earlier, I said: AWS means Amazon Web Services/i,
      ),
    ).toBeInTheDocument()
    expect(askDashboardSources).not.toHaveBeenCalled()
    expect(fetchDashboardExternalSource).not.toHaveBeenCalled()
  })

  it('uses each pet face image in chat and full image in the empty-chat hero', () => {
    aiChatPets.forEach((pet) => {
      expect(getAiChatPetSrc(pet, 'full')).toBe(
        `/images/studymesh-ai-pet-${pet.id}.png`,
      )
      expect(getAiChatPetSrc(pet, 'face')).toBe(
        `/images/studymesh-ai-pet-${pet.id}-face.png`,
      )
    })
  })

  it('clips assistant face images inside their circular avatars', () => {
    const { container } = renderPanel({
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Answer',
          createdAt: 1,
        },
      ],
    })

    const faceImage = container.querySelector<HTMLImageElement>(
      '[data-testid="assistant-pet-face"]',
    )

    expect(faceImage).toHaveStyle({
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    })
    expect(faceImage?.parentElement).toHaveStyle({
      borderRadius: '50%',
      overflow: 'hidden',
    })
  })

  it('floats user message actions without reserving vertical message space', () => {
    renderPanel({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: 'What is recursion?',
          createdAt: 1,
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Recursion is a function calling itself.',
          createdAt: 2,
        },
      ],
    })

    const actionToolbar = screen
      .getByRole('button', { name: 'Copy prompt' })
      .closest('.studymesh-user-message-actions')

    expect(actionToolbar).toHaveStyle({
      position: 'absolute',
      bottom: '-18px',
    })
    expect(actionToolbar).not.toHaveStyle({ height: '26px' })
  })

  it('keeps chat input and create available after more than five replies', async () => {
    const messages = Array.from({ length: 6 }).flatMap((_, index) => [
      {
        id: `user-${index}`,
        role: 'user' as const,
        content: `Question ${index}`,
        createdAt: index * 2,
      },
      {
        id: `assistant-${index}`,
        role: 'assistant' as const,
        content: `Answer ${index}`,
        createdAt: index * 2 + 1,
      },
    ])
    renderPanel({ messages })

    const input = screen.getByPlaceholderText('Ask anything')
    fireEvent.change(input, {
      target: { value: 'Can I still ask another question?' },
    })

    expect(input).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Send dashboard question' }),
    ).toBeEnabled()
    expect(screen.getByRole('button', { name: /^Create$/i })).toBeEnabled()

    fireEvent.click(
      screen.getByRole('button', { name: 'Send dashboard question' }),
    )

    await waitFor(() => expect(askDashboardSources).toHaveBeenCalled())
  })

  it('renders inline citations and hides the old Based on block', () => {
    const onOpenSource = vi.fn()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderPanel({
      onOpenSource,
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content:
            'Photosynthesis stores energy [1]. Web context [12]. Unknown [9].',
          createdAt: 1,
          sourceRefs: [
            {
              citationNumber: 1,
              chunkId: 'notes-1',
              title: 'Photosynthesis notes',
              type: 'MarkdownBlock',
              textPreview: 'Plants use light, water, and carbon dioxide.',
              dashboardKey: 'lesson-1',
              dashboardTitle: 'Lesson 1',
            },
            {
              citationNumber: 12,
              chunkId: 'web-source-1',
              title: 'External photosynthesis source',
              type: 'web source',
              textPreview: 'External source preview.',
              origin: 'web',
              url: 'https://example.com/photosynthesis',
            },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open source 1' }))

    expect(onOpenSource).toHaveBeenCalledWith(
      expect.objectContaining({ citationNumber: 1, dashboardKey: 'lesson-1' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open web source 12' }))
    expect(openSpy).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Based on:')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Open source 9' }),
    ).not.toBeInTheDocument()
    expect(document.body).toHaveTextContent('[9]')
    openSpy.mockRestore()
  })

  it('adds user text citation sources as Study Guide pages', () => {
    const onAddExternalSourceToGuide = vi.fn()
    const messages = [
      {
        id: 'assistant-1',
        role: 'assistant' as const,
        content: 'Use the uploaded source [1].',
        createdAt: 1,
        sourceRefs: [
          {
            citationNumber: 1,
            chunkId: 'user-source-1',
            title: 'Uploaded notes.txt',
            type: 'pasted source',
            textPreview: 'Inline source text.',
            origin: 'web',
            originType: 'user-text' as const,
            url: 'studymesh://user-source/1',
          },
        ],
      },
    ]
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'studymesh-dashboard-chat-sessions-dashboard-1'
        ? JSON.stringify([
            {
              id: 'chat-1',
              title: 'Uploaded notes',
              messages,
              externalSources: [
                {
                  id: 'user-source-1',
                  url: 'studymesh://user-source/1',
                  title: 'Uploaded notes.txt',
                  text: 'Inline source text that should become a guide page.',
                  originType: 'user-text',
                  searchQuery: 'Uploaded notes.txt',
                  fetchedAt: 1,
                },
              ],
              createdAt: 1,
              updatedAt: 1,
            },
          ])
        : null,
    )

    renderPanel({ messages, onAddExternalSourceToGuide })

    fireEvent.click(
      screen.getByRole('button', { name: 'Add source as page 1' }),
    )

    expect(onAddExternalSourceToGuide).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-source-1',
        guidePageDraftStatus: 'ready',
        guidePageDraft: expect.objectContaining({
          title: 'Uploaded notes.txt',
          markdown: expect.stringContaining(
            'Inline source text that should become a guide page.',
          ),
        }),
      }),
    )
  })

  it('opens user webpage citation sources through the external confirmation', () => {
    const messages = [
      {
        id: 'assistant-1',
        role: 'assistant' as const,
        content: 'Use the webpage source [1].',
        createdAt: 1,
        sourceRefs: [
          {
            citationNumber: 1,
            chunkId: 'user-web-source-1',
            title: 'Example source',
            type: 'user webpage',
            textPreview: 'Webpage source text.',
            origin: 'web',
            originType: 'user-web' as const,
            url: 'https://example.com/source',
          },
        ],
      },
    ]

    renderPanel({ messages })

    fireEvent.click(screen.getByRole('button', { name: 'Open added source 1' }))

    expect(
      screen.getByRole('dialog', { name: 'Open external source?' }),
    ).toBeInTheDocument()
    expect(screen.getByText('https://example.com/source')).toBeInTheDocument()
  })

  it('does not render a bottom sources section after answers', () => {
    renderPanel({
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Photosynthesis stores energy [1].',
          createdAt: 1,
          sourceRefs: [
            {
              citationNumber: 1,
              chunkId: 'notes-1',
              title: 'Photosynthesis notes',
              type: 'MarkdownBlock',
              textPreview: 'Plants use light, water, and carbon dioxide.',
              dashboardTitle: 'Lesson 1',
            },
          ],
        },
      ],
    })

    expect(
      screen.queryByRole('button', { name: 'Sources (1)' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/MarkdownBlock/)).not.toBeInTheDocument()
  })

  it('offers assistant copy, retry, and add actions', async () => {
    const onMessagesChange = vi.fn()
    const onAddAssistantMessageToGuide = vi.fn()
    const messages = [
      {
        id: 'user-1',
        role: 'user' as const,
        content: 'Explain photosynthesis',
        createdAt: 1,
      },
      {
        id: 'assistant-1',
        role: 'assistant' as const,
        content: 'It stores light energy [1].',
        createdAt: 2,
      },
    ]
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'studymesh-dashboard-chat-sessions-dashboard-1'
        ? JSON.stringify([
            {
              id: 'chat-1',
              title: 'Explain photosynthesis',
              messages,
              createdAt: 1,
              updatedAt: 2,
            },
          ])
        : null,
    )
    render(
      <DashboardChatPanel
        dashboard={dashboardWithContext}
        messages={messages}
        onMessagesChange={onMessagesChange}
        onClose={vi.fn()}
        onQuickCreatePage={vi.fn()}
        onAddAssistantMessageToGuide={onAddAssistantMessageToGuide}
      />,
    )
    onMessagesChange.mockClear()

    fireEvent.click(
      screen.getByRole('button', { name: 'Add answer to Study Guide' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry answer' }))

    expect(onAddAssistantMessageToGuide).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'assistant-1' }),
    )
    expect(onMessagesChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'assistant', pending: true }),
      ]),
    )
    await waitFor(() => expect(askDashboardSources).toHaveBeenCalled())
  })

  it('shows a compact source selector label without Auto as a menu option', () => {
    renderPanel()

    const sourceButton = screen.getByRole('button', {
      name: 'Answer sources: Auto',
    })
    expect(sourceButton).toHaveTextContent('Auto')

    fireEvent.click(sourceButton)

    expect(
      screen.queryByRole('menuitem', { name: /Auto/i }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: /Study Guide/i }))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(
      screen.getByRole('button', { name: 'Answer sources: Study Guide' }),
    ).toHaveTextContent('Study Guide')

    fireEvent.click(
      screen.getByRole('button', { name: 'Answer sources: Study Guide' }),
    )
    fireEvent.click(
      screen.getByRole('menuitem', { name: /General knowledge/i }),
    )
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(
      screen.getByRole('button', {
        name: 'Answer sources: Study Guide, General knowledge',
      }),
    ).toHaveTextContent('SG, GK')
  })

  it('searches web before answering when Web search is selected', async () => {
    const onMessagesChange = vi.fn()
    vi.mocked(planDashboardChatSources).mockResolvedValueOnce({
      selectedSources: ['web'],
      shouldSearchWeb: true,
      searchQuery: 'Ansible comparison',
      answerStyleHint: 'Answer directly.',
    })
    vi.mocked(askDashboardSources).mockResolvedValueOnce({
      answer: 'Ansible automates provisioning [2].',
      sourceRefs: [
        {
          citationNumber: 2,
          chunkId: 'web-source-1',
          title: 'Ansible guide',
          type: 'web source',
          textPreview:
            'Ansible automates provisioning and configuration management.',
          origin: 'web',
          url: 'https://example.com/ansible',
        },
      ],
      answerBasis: ['web'],
      contextSupport: 'direct',
    })
    const Harness = () => {
      const [panelMessages, setPanelMessages] = React.useState<
        React.ComponentProps<typeof DashboardChatPanel>['messages']
      >([])

      return (
        <DashboardChatPanel
          dashboard={dashboardWithContext}
          messages={panelMessages}
          onMessagesChange={(nextMessages) => {
            onMessagesChange(nextMessages)
            setPanelMessages(nextMessages)
          }}
          onClose={vi.fn()}
          onQuickCreatePage={vi.fn()}
          onAddExternalSourceToGuide={vi.fn()}
        />
      )
    }

    render(<Harness />)

    fireEvent.change(screen.getByPlaceholderText('Ask anything'), {
      target: { value: 'How does Ansible compare?' },
    })
    enableWebSourceSelection()
    enableGeneralSourceSelection()
    fireEvent.click(
      screen.getByRole('button', { name: 'Send dashboard question' }),
    )

    await waitFor(() =>
      expect(fetchDashboardExternalSource).toHaveBeenCalledWith(
        expect.objectContaining({
          question: 'How does Ansible compare?',
          searchQuery: 'Ansible comparison',
          dashboardTitle: 'Biology Dashboard',
          contextSummary: expect.stringContaining('Photosynthesis notes'),
        }),
      ),
    )
    await waitFor(() => expect(askDashboardSources).toHaveBeenCalledTimes(1))
    expect(
      vi.mocked(askDashboardSources).mock.calls[0][0].contextText,
    ).toContain('Ansible automates provisioning')
    expect(onMessagesChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'assistant', pending: true }),
      ]),
    )
    expect(screen.queryByText('Add web source')).not.toBeInTheDocument()
    expect(await screen.findByText('Found source')).toBeInTheDocument()
    await waitFor(() =>
      expect(prepareDashboardExternalSourcePageDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          question: 'How does Ansible compare?',
          answer: 'Ansible automates provisioning [2].',
          source: expect.objectContaining({ id: 'web-source-1' }),
        }),
      ),
    )
    expect(
      await screen.findByRole('button', {
        name: 'Add this source: Ansible guide',
      }),
    ).toBeEnabled()
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    fireEvent.click(
      screen.getByRole('button', { name: 'Open source: Ansible guide' }),
    )
    expect(openSpy).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveTextContent('Ansible guide')
    fireEvent.click(screen.getByRole('button', { name: 'Open source' }))
    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com/ansible',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('still answers and shows a non-blocking error card when web lookup fails', async () => {
    vi.mocked(planDashboardChatSources).mockResolvedValueOnce({
      selectedSources: ['web', 'general'],
      shouldSearchWeb: true,
      searchQuery: 'Ansible comparison',
      answerStyleHint: 'Answer directly.',
    })
    vi.mocked(askDashboardSources).mockResolvedValueOnce({
      answer: 'In general, Ansible automates provisioning.',
      sourceRefs: [],
      answerBasis: ['general'],
      contextSupport: 'none',
    })
    vi.mocked(fetchDashboardExternalSource).mockRejectedValueOnce(
      new Error('Web search is not configured.'),
    )
    const Harness = () => {
      const [panelMessages, setPanelMessages] = React.useState<
        React.ComponentProps<typeof DashboardChatPanel>['messages']
      >([])

      return (
        <DashboardChatPanel
          dashboard={dashboardWithContext}
          messages={panelMessages}
          onMessagesChange={setPanelMessages}
          onClose={vi.fn()}
          onQuickCreatePage={vi.fn()}
        />
      )
    }

    render(<Harness />)

    fireEvent.change(screen.getByPlaceholderText('Ask anything'), {
      target: { value: 'How does Ansible compare?' },
    })
    enableWebSourceSelection()
    fireEvent.click(
      screen.getByRole('button', { name: 'Send dashboard question' }),
    )

    expect(
      await screen.findByText('Web search is not configured.'),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('In general, Ansible automates provisioning.'),
    ).toBeInTheDocument()
    expect(askDashboardSources).toHaveBeenCalledTimes(1)
  })

  it('does not include a previous summarize request in follow-up web lookup', async () => {
    vi.mocked(planDashboardChatSources).mockResolvedValueOnce({
      selectedSources: ['web'],
      shouldSearchWeb: true,
      searchQuery: 'rundeck n8n terraform ansible comparison',
      answerStyleHint: 'Answer directly.',
    })
    vi.mocked(askDashboardSources).mockResolvedValueOnce({
      answer: 'Rundeck provides operations orchestration [2].',
      sourceRefs: [],
      answerBasis: ['web'],
      contextSupport: 'direct',
    })
    vi.mocked(fetchDashboardExternalSource).mockResolvedValue([
      {
        id: 'web-source-rundeck',
        url: 'https://docs.example/rundeck',
        title: 'Rundeck documentation',
        text: 'Rundeck provides job orchestration, runbooks, RBAC, and scheduling for operations automation.',
        searchQuery: 'Rundeck documentation',
        fetchedAt: 1,
      },
    ])
    const initialMessages = [
      {
        id: 'user-1',
        role: 'user' as const,
        content: 'Summarize the key ideas',
        createdAt: 1,
      },
      {
        id: 'assistant-1',
        role: 'assistant' as const,
        content:
          'Terraform is declarative infrastructure as code. Ansible uses playbooks for configuration management.',
        createdAt: 2,
      },
    ]
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'studymesh-dashboard-chat-sessions-dashboard-1'
        ? JSON.stringify([
            {
              id: 'chat-1',
              title: 'Vue and React',
              messages: initialMessages,
              createdAt: 1,
              updatedAt: 2,
            },
          ])
        : null,
    )

    renderPanel()
    fireEvent.change(screen.getByPlaceholderText('Ask anything'), {
      target: {
        value:
          'what about rundeck and n8n? are they similar to terraform and ansible?',
      },
    })
    enableWebSourceSelection()
    fireEvent.click(
      screen.getByRole('button', { name: 'Send dashboard question' }),
    )

    await waitFor(() => expect(fetchDashboardExternalSource).toHaveBeenCalled())
    const lookupQuestion = vi.mocked(fetchDashboardExternalSource).mock
      .calls[0][0].question
    expect(lookupQuestion).toContain('what about rundeck and n8n')
    expect(lookupQuestion.toLowerCase()).not.toContain('summarize')
  })

  it('uses the previous answer topic when a follow-up asks for sources', async () => {
    vi.mocked(planDashboardChatSources).mockResolvedValueOnce({
      selectedSources: ['study-guide', 'general', 'web'],
      shouldSearchWeb: true,
      searchQuery: 'Vue React JavaScript UI framework comparison sources',
      answerStyleHint: 'Answer directly.',
    })
    vi.mocked(askDashboardSources).mockResolvedValueOnce({
      answer: 'Vue and React can be compared using their official docs [2].',
      sourceRefs: [
        {
          citationNumber: 2,
          chunkId: 'web-source-vue-react',
          title: 'Vue and React docs',
          type: 'web source',
          textPreview: 'Vue and React are JavaScript UI frameworks.',
          origin: 'web',
          url: 'https://example.com/vue-react',
        },
      ],
      answerBasis: ['web'],
      contextSupport: 'direct',
    })
    vi.mocked(fetchDashboardExternalSource).mockResolvedValue([
      {
        id: 'web-source-vue-react',
        url: 'https://example.com/vue-react',
        title: 'Vue and React docs',
        text: 'Vue and React are JavaScript UI frameworks for components, state, templates, JSX, and user interfaces.',
        searchQuery: 'Vue React comparison',
        fetchedAt: 1,
      },
    ])
    const initialMessages = [
      {
        id: 'user-1',
        role: 'user' as const,
        content: 'difference between vue and react ?',
        createdAt: 1,
      },
      {
        id: 'assistant-1',
        role: 'assistant' as const,
        content:
          'Vue is a progressive JavaScript framework with templates. React is a UI library using JSX and component state.',
        createdAt: 2,
      },
    ]
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'studymesh-dashboard-chat-sessions-dashboard-1'
        ? JSON.stringify([
            {
              id: 'chat-1',
              title: 'Vue and React',
              messages: initialMessages,
              createdAt: 1,
              updatedAt: 2,
            },
          ])
        : null,
    )

    renderPanel()
    fireEvent.change(screen.getByPlaceholderText('Ask anything'), {
      target: { value: 'what is your source to say that ?' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Send dashboard question' }),
    )

    await waitFor(() => expect(fetchDashboardExternalSource).toHaveBeenCalled())
    const lookupQuestion = vi.mocked(fetchDashboardExternalSource).mock
      .calls[0][0].question
    expect(lookupQuestion.toLowerCase()).toContain('vue')
    expect(lookupQuestion.toLowerCase()).toContain('react')
    expect(lookupQuestion.toLowerCase()).toContain('javascript')
    expect(lookupQuestion.toLowerCase()).not.toContain('synonym')
  })

  it('shows Add as page only when Study Guide supplies a web-source callback', async () => {
    const onAddExternalSourceToGuide = vi.fn()
    const messages = [
      {
        id: 'assistant-1',
        role: 'assistant' as const,
        content: 'The dashboard sources do not contain enough information.',
        webLookup: { status: 'found' as const, sourceId: 'web-source-1' },
        sourceRefs: [
          {
            citationNumber: 1,
            chunkId: 'web-source-1',
            title: 'Ansible guide',
            type: 'web source',
            textPreview: 'Ansible automates provisioning.',
            origin: 'web' as const,
            url: 'https://example.com/ansible',
          },
        ],
        createdAt: 1,
      },
    ]
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'studymesh-dashboard-chat-sessions-dashboard-1'
        ? JSON.stringify([
            {
              id: 'chat-1',
              title: 'Ansible',
              messages,
              externalSources: [
                {
                  id: 'web-source-1',
                  url: 'https://example.com/ansible',
                  title: 'Ansible guide',
                  text: 'Ansible automates provisioning and configuration management.',
                  guidePageDraftStatus: 'ready',
                  guidePageDraft: {
                    title: 'Ansible source notes',
                    markdown:
                      '# Ansible source notes\n\nSource: [example.com](https://example.com/ansible)\n\n## Key points\n- Ansible automates provisioning.',
                    generatedAt: 1,
                  },
                  searchQuery: 'Ansible',
                  fetchedAt: 1,
                },
              ],
              createdAt: 1,
              updatedAt: 1,
            },
          ])
        : null,
    )

    renderPanel({ messages, onAddExternalSourceToGuide })

    expect(screen.getByRole('button', { name: 'Copy answer' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Retry answer' })).toBeEnabled()

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Add this source: Ansible guide',
      }),
    )

    expect(onAddExternalSourceToGuide).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'web-source-1' }),
    )
  })

  it('shows a retry action when the web source page draft failed', async () => {
    const messages = [
      {
        id: 'assistant-1',
        role: 'assistant' as const,
        content: 'The dashboard sources do not contain enough information.',
        webLookup: { status: 'found' as const, sourceId: 'web-source-1' },
        sourceRefs: [
          {
            citationNumber: 1,
            chunkId: 'web-source-1',
            title: 'Ansible guide',
            type: 'web source',
            textPreview: 'Boilerplate only.',
            origin: 'web' as const,
            url: 'https://example.com/ansible',
          },
        ],
        createdAt: 1,
      },
    ]
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'studymesh-dashboard-chat-sessions-dashboard-1'
        ? JSON.stringify([
            {
              id: 'chat-1',
              title: 'Ansible',
              messages,
              externalSources: [
                {
                  id: 'web-source-1',
                  url: 'https://example.com/ansible',
                  title: 'Ansible guide',
                  text: 'Boilerplate only.',
                  guidePageDraftStatus: 'failed',
                  guidePageDraftError:
                    'Source page draft was not clean enough.',
                  searchQuery: 'Ansible',
                  fetchedAt: 1,
                },
              ],
              createdAt: 1,
              updatedAt: 1,
            },
          ])
        : null,
    )

    renderPanel({ messages, onAddExternalSourceToGuide: vi.fn() })

    expect(
      await screen.findByRole('button', {
        name: 'Add this source: Ansible guide',
      }),
    ).toBeEnabled()
    expect(screen.getByText('Retry preparing page')).toBeInTheDocument()
    expect(
      screen.getByText('Source page draft was not clean enough.'),
    ).toBeInTheDocument()
  })

  it('rejects the previous found source and searches again when asked for another source', async () => {
    vi.mocked(planDashboardChatSources).mockResolvedValueOnce({
      selectedSources: ['study-guide', 'web'],
      shouldSearchWeb: true,
      searchQuery: 'Ansible official documentation',
      answerStyleHint: 'Answer directly.',
    })
    const messages = [
      {
        id: 'user-1',
        role: 'user' as const,
        content: 'How does Ansible compare?',
        createdAt: 1,
      },
      {
        id: 'assistant-1',
        role: 'assistant' as const,
        content: 'Found source',
        webLookup: { status: 'found' as const, sourceId: 'web-source-bad' },
        createdAt: 2,
      },
    ]
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'studymesh-dashboard-chat-sessions-dashboard-1'
        ? JSON.stringify([
            {
              id: 'chat-1',
              title: 'How does Ansible compare?',
              messages,
              externalSources: [
                {
                  id: 'web-source-bad',
                  url: 'https://bad.example/ansible-alternatives',
                  title: 'Alternatives page',
                  text: 'Thin Ansible alternatives content.',
                  searchQuery: 'Ansible',
                  fetchedAt: 1,
                },
              ],
              createdAt: 1,
              updatedAt: 2,
            },
          ])
        : null,
    )
    vi.mocked(fetchDashboardExternalSource).mockResolvedValueOnce([
      {
        id: 'web-source-good',
        url: 'https://docs.example/ansible',
        title: 'Ansible documentation',
        text: 'Ansible automates configuration management with playbooks.',
        searchQuery: 'Ansible official documentation',
        fetchedAt: 3,
      },
    ])
    renderPanel({ messages })

    fireEvent.change(screen.getByPlaceholderText('Ask anything'), {
      target: { value: "don't use that source, try another source" },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Send dashboard question' }),
    )

    await waitFor(() =>
      expect(fetchDashboardExternalSource).toHaveBeenCalledWith(
        expect.objectContaining({
          question: expect.stringContaining('How does Ansible compare?'),
          rejectedDomains: ['bad.example'],
          rejectedUrls: ['https://bad.example/ansible-alternatives'],
        }),
      ),
    )
  })

  it('only offers delete inside Chats and keeps the menu open after deleting', async () => {
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
    expect(
      screen.getByRole('button', { name: 'Delete chat: First chat' }),
    ).toBeInTheDocument()
    expect(screen.getByText('1 reply')).toBeInTheDocument()
    expect(screen.getByText('0 replies')).toBeInTheDocument()
    expect(screen.queryByText(/messages/)).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete chat: First chat' }),
    )

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Delete chat: First chat' }),
      ).not.toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('button', { name: 'Delete chat: New chat' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('0 replies')).toBeInTheDocument()
  })
})
