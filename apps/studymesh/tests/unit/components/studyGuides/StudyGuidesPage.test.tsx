/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import StudyGuidesPage from '../../../../src/components/studyGuides/StudyGuidesPage'
import {
  STUDY_GUIDES_STORAGE_FULL_MESSAGE,
  StudyGuideStorage,
} from '../../../../src/studyGuides/storage'
import {
  buildReadableStudyPathState,
  generateStudyPathStateFromPrompt,
} from '../../../../src/studyGuides/generation'
import {
  HOSTED_STUDY_GUIDE_MANUAL_RETRY_MESSAGE,
  STUDY_GUIDE_CREATION_QUEUE_KEY,
  StudyGuideCreationQueueStorage,
} from '../../../../src/studyGuides/creationQueue'
const deleteHostedAiPodcastAudioMock = vi.hoisted(() => vi.fn())
const useHostedAiStatusMock = vi.hoisted(() => vi.fn())

vi.mock('../../../../src/quickCreate/ai', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../src/quickCreate/ai')
  >('../../../../src/quickCreate/ai')

  return {
    ...actual,
    deleteHostedAiPodcastAudio: deleteHostedAiPodcastAudioMock,
  }
})

vi.mock('../../../../src/components/topnavbar/TopNavBar', () => ({
  __esModule: true,
  default: () => <div data-testid="top-nav-bar" />,
}))

vi.mock('../../../../src/components/hostedAi/useHostedAiStatus', () => ({
  useHostedAiStatus: useHostedAiStatusMock,
}))

// The page asks the gateway which hosted jobs it still owns before it will run
// anything. Default: it owns them, which is the ordinary resume case.
const gatewayOwnsEveryJob = async (ids: readonly string[]) => ({
  jobs: Object.fromEntries(
    ids.map((clientJobId) => [clientJobId, { clientJobId, status: 'running' }]),
  ),
  unresolvedIds: [] as string[],
})
const getHostedStudyGuideJobsMock = vi.hoisted(() => vi.fn())

type HostedClientModule =
  typeof import('../../../../src/quickCreate/ai/hostedClient')

vi.mock('../../../../src/quickCreate/ai/hostedClient', async () => {
  const actual = await vi.importActual<HostedClientModule>(
    '../../../../src/quickCreate/ai/hostedClient',
  )

  return {
    ...actual,
    getHostedStudyGuideJobs: getHostedStudyGuideJobsMock,
  }
})

vi.mock('../../../../src/studyGuides/generation', () => ({
  generateStudyPathStateFromPrompt: vi.fn(async ({ id }) => ({
    pathId: id,
    title: 'AI Named Guide',
    folderName: 'AI Named Guide',
    emoji: '🧠',
    dashboards: [
      {
        id: `${id}-dashboard-1`,
        name: '01 - Start',
        layout: { type: 'row' },
        dashboardKey: `${id}-1`,
        dashboardIndex: 1,
        dashboardCount: 1,
        folderName: 'AI Named Guide',
        createdBy: 'generator',
        deletable: false,
      },
    ],
    selectedIndex: 0,
    pinnedDashboardKeys: [],
  })),
  buildReadableStudyPathState: vi.fn(async ({ id }) => ({
    pathId: id,
    title: 'Early Page Guide',
    folderName: 'Early Page Guide',
    emoji: '📖',
    dashboards: [
      {
        id: `${id}-dashboard-1`,
        name: '01 - First page',
        layout: { type: 'row' },
        dashboardKey: `${id}-1`,
        dashboardIndex: 1,
        dashboardCount: 1,
        folderName: 'Early Page Guide',
        createdBy: 'generator',
        deletable: false,
      },
    ],
    selectedIndex: 0,
    pinnedDashboardKeys: [],
  })),
}))

const LocationProbe = () => {
  const location = useLocation()
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  )
}

const StateProbe = () => {
  const location = useLocation()
  return (
    <div data-testid="router-state">{JSON.stringify(location.state)}</div>
  )
}

const renderStudyGuidesPage = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/study-guides"
          element={
            <>
              <StudyGuidesPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )

const makeStoredGuide = ({
  id,
  title,
  description,
  createdAt,
  pinnedAt,
  emoji,
}: {
  id: string
  title: string
  description: string
  createdAt: string
  pinnedAt?: string | null
  emoji?: string
}) => ({
  id,
  title,
  folderName: title,
  description,
  emoji,
  studyPath: {
    pathId: id,
    title,
    folderName: title,
    dashboards: [
      {
        id: `${id}-dashboard-1`,
        name: '01 - Start',
        layout: { type: 'row' },
        dashboardKey: `${id}-1`,
        dashboardIndex: 1,
        dashboardCount: 1,
        folderName: title,
      },
    ],
    selectedIndex: 0,
    pinnedDashboardKeys: [],
  },
  createdAt,
  updatedAt: createdAt,
  pinnedAt,
})

const makeGeneratedStudyPath = (id: string, title: string) => ({
  pathId: id,
  title,
  folderName: title,
  emoji: '✨',
  dashboards: [
    {
      id: `${id}-dashboard-1`,
      name: '01 - Start',
      layout: { type: 'row' },
      dashboardKey: `${id}-1`,
      dashboardIndex: 1,
      dashboardCount: 1,
      folderName: title,
      createdBy: 'generator',
      deletable: false,
    },
  ],
  selectedIndex: 0,
  pinnedDashboardKeys: [],
})

const createGuideFromPrompt = async (prompt: string) => {
  fireEvent.click(
    screen.getAllByRole('button', { name: /new quick guide/i })[0],
  )
  const promptInput = await screen.findByLabelText(/quick guide prompt/i)
  fireEvent.change(promptInput, { target: { value: prompt } })
  fireEvent.click(screen.getByRole('button', { name: /create guide/i }))
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
}

describe('StudyGuidesPage create flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // clearAllMocks leaves implementations in place, so a test that gives the
    // gateway a different answer would otherwise change every test after it.
    getHostedStudyGuideJobsMock.mockImplementation(gatewayOwnsEveryJob)
    deleteHostedAiPodcastAudioMock.mockResolvedValue(undefined)
    useHostedAiStatusMock.mockReturnValue({
      status: null,
      displayStudyCredits: 30,
      loading: false,
      error: '',
      refresh: vi.fn(),
    })
    const storage = new Map<string, string>()
    vi.mocked(window.localStorage.getItem).mockImplementation(
      (key: string) => storage.get(key) ?? null,
    )
    vi.mocked(window.localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage.set(key, value)
      },
    )
    vi.mocked(window.localStorage.removeItem).mockImplementation(
      (key: string) => {
        storage.delete(key)
      },
    )
    vi.mocked(window.localStorage.clear).mockImplementation(() => {
      storage.clear()
    })
    window.localStorage.clear()
  })

  it('does not auto-open the new Study Guide dialog from create=1', async () => {
    renderStudyGuidesPage('/study-guides?create=1')

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/study-guides')
      expect(screen.getByTestId('location')).toHaveTextContent('create=1')
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('creates a Study Guide from prompt only and keeps the AI title', async () => {
    const storedGuides: ReturnType<typeof StudyGuideStorage.getSummaries> = []
    const getSummariesSpy = vi
      .spyOn(StudyGuideStorage, 'getSummaries')
      .mockImplementation(() => [...storedGuides])
    const saveSpy = vi
      .spyOn(StudyGuideStorage, 'save')
      .mockImplementation((guide) => {
        storedGuides.push({
          id: guide.id,
          title: guide.title,
          folderName: guide.folderName,
          description: guide.description,
          emoji: guide.emoji || guide.studyPath.emoji,
          pinnedAt: guide.pinnedAt ?? null,
          pageCount: guide.studyPath.dashboards.length,
          firstPageTitle: guide.studyPath.dashboards[0]?.name,
          createdAt: guide.createdAt,
          updatedAt: guide.updatedAt,
        })
        return guide
      })
    renderStudyGuidesPage('/study-guides')

    fireEvent.click(
      screen.getAllByRole('button', { name: /new quick guide/i })[0],
    )

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByLabelText(/guide name/i)).not.toBeInTheDocument()
    const promptInput = screen.getByLabelText(/quick guide prompt/i)
    expect(promptInput).toBeRequired()
    expect(screen.getByRole('button', { name: /create guide/i })).toBeDisabled()

    fireEvent.change(promptInput, {
      target: { value: 'Teach me French subjunctive with practice.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create guide/i }))

    await waitFor(() => {
      expect(generateStudyPathStateFromPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          prompt: 'Teach me French subjunctive with practice.',
          provider: 'hosted',
        }),
      )
    })

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'AI Named Guide',
          folderName: 'AI Named Guide',
          description: 'Teach me French subjunctive with practice.',
          emoji: '🧠',
        }),
      )
    })
    expect(screen.getByTestId('location')).toHaveTextContent('/study-guides')
    expect(
      await screen.findByTestId('newly-created-study-guide-card'),
    ).toHaveTextContent('AI Named Guide')
    expect(screen.queryByText(/% read/i)).not.toBeInTheDocument()
    getSummariesSpy.mockRestore()
    saveSpy.mockRestore()
  })

  it('shows a friendly error when the creation queue cannot be saved', async () => {
    vi.mocked(window.localStorage.setItem).mockImplementation((key: string) => {
      if (key === STUDY_GUIDE_CREATION_QUEUE_KEY) {
        throw new DOMException(
          'Setting the value exceeded the quota.',
          'QuotaExceededError',
        )
      }
    })
    renderStudyGuidesPage('/study-guides')

    fireEvent.click(
      screen.getAllByRole('button', { name: /new quick guide/i })[0],
    )
    fireEvent.change(await screen.findByLabelText(/quick guide prompt/i), {
      target: { value: 'Teach me organic chemistry.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create guide/i }))

    expect(
      await screen.findByText(STUDY_GUIDES_STORAGE_FULL_MESSAGE),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(generateStudyPathStateFromPrompt).not.toHaveBeenCalled()
  })

  it('keeps a failed Study Guide card retryable with the original prompt', async () => {
    vi.mocked(generateStudyPathStateFromPrompt)
      .mockRejectedValueOnce(
        new Error(
          'Gemini could not follow the requested output format. RabbitHole retried with a simpler JSON prompt.',
        ),
      )
      .mockImplementationOnce(async ({ id }) => ({
        pathId: id,
        title: 'Human Anatomy Basics',
        folderName: 'Human Anatomy Basics',
        emoji: '🫀',
        dashboards: [
          {
            id: `${id}-dashboard-1`,
            name: '01 - Foundations',
            layout: { type: 'row' },
            dashboardKey: `${id}-1`,
            dashboardIndex: 1,
            dashboardCount: 1,
            folderName: 'Human Anatomy Basics',
            createdBy: 'generator',
            deletable: false,
          },
        ],
        selectedIndex: 0,
        pinnedDashboardKeys: [],
      }))
    const saveSpy = vi.spyOn(StudyGuideStorage, 'save')
    renderStudyGuidesPage('/study-guides')

    fireEvent.click(
      screen.getAllByRole('button', { name: /new quick guide/i })[0],
    )
    await screen.findByLabelText(/quick guide prompt/i)
    fireEvent.click(screen.getByRole('button', { name: /human anatomy/i }))
    fireEvent.click(screen.getByRole('button', { name: /create guide/i }))

    expect(await screen.findByText('Failed')).toBeInTheDocument()
    expect(
      screen.getByText('Teach me the basics of human anatomy for an exam.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Gemini could not follow the requested output format/i),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => {
      expect(generateStudyPathStateFromPrompt).toHaveBeenCalledTimes(2)
    })
    expect(generateStudyPathStateFromPrompt).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        prompt: 'Teach me the basics of human anatomy for an exam.',
        provider: 'hosted',
      }),
    )
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Human Anatomy Basics',
          folderName: 'Human Anatomy Basics',
          description: 'Teach me the basics of human anatomy for an exam.',
        }),
      )
    })
    saveSpy.mockRestore()
  })

  it('runs several hosted Study Guides in parallel', async () => {
    const resolvers: Array<(title: string) => void> = []
    vi.mocked(generateStudyPathStateFromPrompt).mockImplementation(
      ({ id }) =>
        new Promise((resolve) => {
          resolvers.push((title) => resolve(makeGeneratedStudyPath(id, title)))
        }),
    )
    const saveSpy = vi.spyOn(StudyGuideStorage, 'save')
    renderStudyGuidesPage('/study-guides')

    await createGuideFromPrompt('First guide prompt')
    await createGuideFromPrompt('Second guide prompt')
    await createGuideFromPrompt('Third guide prompt')

    await waitFor(() => {
      expect(screen.getByText('First guide prompt')).toBeInTheDocument()
      expect(screen.getByText('Second guide prompt')).toBeInTheDocument()
      expect(screen.getByText('Third guide prompt')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(generateStudyPathStateFromPrompt).toHaveBeenCalledTimes(3)
    })

    resolvers[0]('First Generated Guide')
    resolvers[1]('Second Generated Guide')
    resolvers[2]('Third Generated Guide')

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledTimes(3)
    })
    expect(saveSpy.mock.calls.map(([guide]) => guide.title)).toEqual([
      'First Generated Guide',
      'Second Generated Guide',
      'Third Generated Guide',
    ])
    expect(StudyGuideCreationQueueStorage.getAll()).toEqual([])
    saveSpy.mockRestore()
  })

  it('resumes a queued Study Guide from local queue storage', async () => {
    StudyGuideCreationQueueStorage.upsert({
      id: 'queued-guide',
      prompt: 'Stored queue prompt',
      provider: 'hosted',
      status: 'queued',
      estimateSeconds: 20,
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      resultStudyGuideId: null,
    })
    vi.mocked(generateStudyPathStateFromPrompt).mockImplementation(
      async ({ id }) => makeGeneratedStudyPath(id, 'Stored Generated Guide'),
    )
    const saveSpy = vi.spyOn(StudyGuideStorage, 'save')

    renderStudyGuidesPage('/study-guides')

    await waitFor(() => {
      expect(generateStudyPathStateFromPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'queued-guide',
          prompt: 'Stored queue prompt',
          provider: 'hosted',
        }),
      )
    })
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Stored Generated Guide' }),
      )
    })
    expect(StudyGuideCreationQueueStorage.getAll()).toEqual([])
    saveSpy.mockRestore()
  })

  it('shows a buy credit pack action for failed hosted guides when credits are under cost', async () => {
    useHostedAiStatusMock.mockReturnValue({
      status: null,
      displayStudyCredits: 2,
      loading: false,
      error: '',
      refresh: vi.fn(),
    })
    StudyGuideCreationQueueStorage.upsert({
      id: 'failed-credit-guide',
      prompt: 'git common commands',
      provider: 'hosted',
      status: 'failed',
      estimateSeconds: 20,
      startedAt: null,
      finishedAt: new Date().toISOString(),
      errorMessage:
        'Not enough Carrots. This action needs 3 and you have 2.',
      resultStudyGuideId: null,
    })
    // The generation never started, so the gateway has no such job and there is
    // nothing to collect. Only a click may spend Carrots on it.
    getHostedStudyGuideJobsMock.mockResolvedValue({
      jobs: {},
      unresolvedIds: [],
    })
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    renderStudyGuidesPage('/study-guides')

    const buyButton = await screen.findByRole('button', {
      name: /buy a carrot pack/i,
    })
    expect(buyButton).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^retry/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(buyButton)

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'studymesh-hosted-ai-insufficient-credits',
        detail: { showNotice: false },
      }),
    )
  })

  it('keeps retry available for failed hosted guides once credits cover the cost', async () => {
    useHostedAiStatusMock.mockReturnValue({
      status: null,
      displayStudyCredits: 3,
      loading: false,
      error: '',
      refresh: vi.fn(),
    })
    StudyGuideCreationQueueStorage.upsert({
      id: 'retry-credit-guide',
      prompt: 'git common commands',
      provider: 'hosted',
      status: 'failed',
      estimateSeconds: 20,
      startedAt: null,
      finishedAt: new Date().toISOString(),
      errorMessage:
        'Not enough Carrots. This action needs 3 and you have 2.',
      resultStudyGuideId: null,
    })
    getHostedStudyGuideJobsMock.mockResolvedValue({
      jobs: {},
      unresolvedIds: [],
    })

    renderStudyGuidesPage('/study-guides')

    expect(
      await screen.findByRole('button', { name: /^retry/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /buy a carrot pack/i }),
    ).not.toBeInTheDocument()
  })

  it('shows determinate progress with timing for a running guide', async () => {
    const startedAt = new Date(Date.now() - 10_000).toISOString()
    StudyGuideCreationQueueStorage.upsert({
      id: 'running-progress-guide',
      prompt: 'Running progress prompt',
      provider: 'hosted',
      status: 'running',
      estimateSeconds: 20,
      startedAt,
      finishedAt: null,
      errorMessage: null,
      resultStudyGuideId: null,
    })
    vi.mocked(generateStudyPathStateFromPrompt).mockImplementation(
      () => new Promise(() => undefined),
    )

    renderStudyGuidesPage('/study-guides')

    const progress = await screen.findByRole('progressbar', { name: /%/ })
    expect(
      Number(progress.getAttribute('aria-valuenow')),
    ).toBeGreaterThanOrEqual(0)
    expect(Number(progress.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(
      100,
    )
    expect(
      screen.getByText(/Elapsed \d+s · Estimated total 20s/),
    ).toBeInTheDocument()
  })

  it('never pays twice for a guide that is still generating', async () => {
    // Remounting is not a refresh: the tab is still generating. Resuming here
    // started a second paid request for a guide already charged, which is how
    // a batch of three cost double.
    const resolvers: Array<(title: string) => void> = []
    vi.mocked(generateStudyPathStateFromPrompt).mockImplementation(
      ({ id }) =>
        new Promise((resolve) => {
          resolvers.push((title) => resolve(makeGeneratedStudyPath(id, title)))
        }),
    )
    const firstRender = renderStudyGuidesPage('/study-guides')

    await createGuideFromPrompt('Refresh-sensitive prompt')
    await screen.findByText('Creating')
    // Hosted generation lives on the server, so the card must not tell the
    // learner to keep the tab open. Local and BYO providers still do.
    expect(screen.queryByText(/keep this tab open/i)).not.toBeInTheDocument()
    expect(generateStudyPathStateFromPrompt).toHaveBeenCalledTimes(1)

    firstRender.unmount()
    renderStudyGuidesPage('/study-guides')

    expect(await screen.findByText('Creating')).toBeInTheDocument()
    expect(screen.getByText('Refresh-sensitive prompt')).toBeInTheDocument()
    expect(generateStudyPathStateFromPrompt).toHaveBeenCalledTimes(1)

    // The first request was never aborted, so its guide still lands.
    resolvers[0]('Resumed Guide')

    expect(await screen.findByText('Resumed Guide')).toBeInTheDocument()
  })

  it('shows only the wait up to page 1 from the first frame', async () => {
    // The card used to show just a bar for the first seconds. It now names the
    // steps immediately - but only as far as the guide becoming readable. What
    // comes after that appears later, under the button, so the learner is not
    // shown work they do not have to wait for.
    vi.mocked(generateStudyPathStateFromPrompt).mockImplementation(
      () => new Promise(() => undefined),
    )
    renderStudyGuidesPage('/study-guides')

    await createGuideFromPrompt('First frame prompt')
    await screen.findByText('Creating')

    expect(screen.getByText('Key idea')).toBeInTheDocument()
    expect(screen.getByText('Page')).toBeInTheDocument()
    expect(screen.queryByText('Final quiz')).not.toBeInTheDocument()
  })

  it('restarts the clock and the bar when a guide is retried', async () => {
    // A retry buys a new generation. Carrying the old elapsed time and a bar
    // near the end would describe work that is not happening.
    vi.mocked(generateStudyPathStateFromPrompt)
      .mockRejectedValueOnce(new Error('Hosted AI is unavailable.'))
      .mockImplementationOnce(() => new Promise(() => undefined))
    renderStudyGuidesPage('/study-guides')

    await createGuideFromPrompt('Retry clock prompt')
    const retryButton = await screen.findByRole('button', { name: /retry/i })

    fireEvent.click(retryButton)

    await screen.findByText('Creating')
    await waitFor(() => {
      expect(screen.getByText(/Elapsed 0s/)).toBeInTheDocument()
    })
  })

  it('turns into a normal guide as soon as page 1 is written', async () => {
    // No extra button and no second progress bar: once page 1 exists the guide
    // is real, so the creating card stands down and the guide card takes over
    // with the pages it has so far.
    let releaseGeneration: (() => void) | undefined
    vi.mocked(generateStudyPathStateFromPrompt).mockImplementation(
      async ({ id, onPreview }) => {
        onPreview?.({ type: 'readableGuide', text: '{"streamed":"guide"}' })
        await new Promise<void>((resolve) => {
          releaseGeneration = resolve
        })
        return makeGeneratedStudyPath(id, 'Finished Guide')
      },
    )
    renderStudyGuidesPage('/study-guides')

    await createGuideFromPrompt('Early read prompt')

    expect(await screen.findByText('Early Page Guide')).toBeInTheDocument()
    expect(buildReadableStudyPathState).toHaveBeenCalledWith(
      expect.objectContaining({ guideText: '{"streamed":"guide"}' }),
    )

    // The creating card is gone, and only one generation was paid for.
    await waitFor(() => {
      expect(screen.queryByText('Creating')).not.toBeInTheDocument()
    })
    expect(generateStudyPathStateFromPrompt).toHaveBeenCalledTimes(1)

    releaseGeneration?.()
  })

  it('opens page 1 on a refreshed tab that never saw it streamed', async () => {
    // The readableGuide event only reaches the tab that started the generation.
    // A reloaded one has to take page 1 off the job row, or it watches the
    // checklist complete with nothing to open.
    StudyGuideCreationQueueStorage.upsert({
      id: 'resumed-early-guide',
      prompt: 'Resumed early prompt',
      provider: 'hosted',
      status: 'running',
      estimateSeconds: 20,
      startedAt: new Date(Date.now() - 18_000).toISOString(),
      finishedAt: null,
      errorMessage: null,
      resultStudyGuideId: null,
    })
    getHostedStudyGuideJobsMock.mockResolvedValue({
      jobs: {
        'resumed-early-guide': {
          clientJobId: 'resumed-early-guide',
          status: 'running',
          progress: {
            title: 'Cardano basics',
            keyIdea: 'A layered proof of stake network.',
            pages: [{ title: 'The pieces', done: true }],
            readableGuideText: '{"resumed":"guide"}',
          },
        },
      },
      unresolvedIds: [],
    })
    vi.mocked(generateStudyPathStateFromPrompt).mockImplementation(
      () => new Promise(() => undefined),
    )

    renderStudyGuidesPage('/study-guides')

    await waitFor(() => {
      expect(buildReadableStudyPathState).toHaveBeenCalledWith(
        expect.objectContaining({ guideText: '{"resumed":"guide"}' }),
      )
    })
    expect(await screen.findByText('Early Page Guide')).toBeInTheDocument()

    // The creating card stands down exactly as it does for a watched guide,
    // and page 1 was never rebuilt more than once.
    await waitFor(() => {
      expect(screen.queryByText('Creating')).not.toBeInTheDocument()
    })
    expect(buildReadableStudyPathState).toHaveBeenCalledTimes(1)
  })

  it('keeps showing the creating card before page 1 exists', async () => {
    vi.mocked(generateStudyPathStateFromPrompt).mockImplementation(
      () => new Promise(() => undefined),
    )
    renderStudyGuidesPage('/study-guides')

    await createGuideFromPrompt('No early page prompt')

    expect(await screen.findByText('Creating')).toBeInTheDocument()
  })
  it('auto-requeues retryable fetch failures without showing a failed card', async () => {
    vi.mocked(generateStudyPathStateFromPrompt)
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockImplementationOnce(async ({ id }) =>
        makeGeneratedStudyPath(id, 'Retried Fetch Guide'),
      )
    const saveSpy = vi.spyOn(StudyGuideStorage, 'save')
    renderStudyGuidesPage('/study-guides')

    await createGuideFromPrompt('Transient network prompt')

    await waitFor(() => {
      expect(generateStudyPathStateFromPrompt).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Retried Fetch Guide' }),
      )
    })
    expect(screen.queryByText('Failed')).not.toBeInTheDocument()
    saveSpy.mockRestore()
  })

  it('stops hosted auto retry after one retryable failure recovery', async () => {
    vi.mocked(generateStudyPathStateFromPrompt)
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockRejectedValueOnce(new Error('Failed to fetch'))
    renderStudyGuidesPage('/study-guides')

    await createGuideFromPrompt('Repeated network prompt')

    await waitFor(() => {
      expect(generateStudyPathStateFromPrompt).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('Failed')).toBeInTheDocument()
    expect(
      screen.getByText(HOSTED_STUDY_GUIDE_MANUAL_RETRY_MESSAGE),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry 3/i })).toBeInTheDocument()
  })

  it('keeps non-retryable provider failures failed for manual retry', async () => {
    vi.mocked(generateStudyPathStateFromPrompt).mockRejectedValueOnce(
      new Error('Cerebras hosted AI request failed.'),
    )
    renderStudyGuidesPage('/study-guides')

    await createGuideFromPrompt('Provider failure prompt')

    expect(await screen.findByText('Failed')).toBeInTheDocument()
    expect(
      screen.getByText('Cerebras hosted AI request failed.'),
    ).toBeInTheDocument()
    expect(generateStudyPathStateFromPrompt).toHaveBeenCalledTimes(1)
  })

  it('offers inline search, list view, and title sorting', async () => {
    const getSummariesSpy = vi
      .spyOn(StudyGuideStorage, 'getSummaries')
      .mockReturnValue([
        makeStoredGuide({
          id: 'z-guide',
          title: 'Zoology',
          description: 'Animal classification prompt',
          createdAt: '2026-01-03T00:00:00.000Z',
        }),
        makeStoredGuide({
          id: 'a-guide',
          title: 'Algebra',
          description: 'Linear equations prompt',
          createdAt: '2026-01-01T00:00:00.000Z',
          emoji: '🔢',
        }),
        makeStoredGuide({
          id: 'm-guide',
          title: 'Music Theory',
          description: 'Intervals prompt',
          createdAt: '2026-01-02T00:00:00.000Z',
        }),
      ])
    renderStudyGuidesPage('/study-guides')

    expect(
      screen.queryByPlaceholderText(/search guides/i),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /search guides/i }))
    expect(screen.getByPlaceholderText(/search guides/i)).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /new quick guide/i }),
    ).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /list view/i }))
    await waitFor(() => {
      expect(
        window.localStorage.getItem('studymesh.studyGuides.viewMode'),
      ).toBe('list')
    })
    expect(
      screen.getAllByRole('button', { name: /new quick guide/i }),
    ).toHaveLength(1)

    expect(
      screen.getByRole('table', { name: /quick guides list/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText(/pages/i)).toBeInTheDocument()
    expect(screen.getByText('Prompt')).toBeInTheDocument()
    expect(screen.getByText('Created')).toBeInTheDocument()
    expect(screen.getByText('🔢')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /recent/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /title/i }))
    expect(window.localStorage.getItem('studymesh.studyGuides.sortMode')).toBe(
      'title',
    )

    const titles = screen
      .getAllByText(/Algebra|Music Theory|Zoology/)
      .map((element) => element.textContent)
    expect(titles).toEqual(['Algebra', 'Music Theory', 'Zoology'])

    fireEvent.click(screen.getByRole('button', { name: /search guides/i }))
    fireEvent.change(screen.getByPlaceholderText(/search guides/i), {
      target: { value: 'linear' },
    })
    expect(screen.getByText('Algebra')).toBeInTheDocument()
    expect(screen.queryByText('Zoology')).not.toBeInTheDocument()

    getSummariesSpy.mockRestore()
  })

  it('pins guides to the top from grid and list views', async () => {
    StudyGuideStorage.save(
      makeStoredGuide({
        id: 'z-guide',
        title: 'Zoology',
        description: 'Animal classification prompt',
        createdAt: '2026-01-03T00:00:00.000Z',
      }),
    )
    StudyGuideStorage.save(
      makeStoredGuide({
        id: 'a-guide',
        title: 'Algebra',
        description: 'Linear equations prompt',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    )
    StudyGuideStorage.save(
      makeStoredGuide({
        id: 'm-guide',
        title: 'Music Theory',
        description: 'Intervals prompt',
        createdAt: '2026-01-02T00:00:00.000Z',
      }),
    )
    renderStudyGuidesPage('/study-guides')

    fireEvent.click(
      screen.getByRole('button', { name: /open options.*algebra/i }),
    )
    fireEvent.click(
      await screen.findByRole('menuitem', { name: /pin to top/i }),
    )

    await waitFor(() => {
      expect(StudyGuideStorage.getById('a-guide')?.pinnedAt).toBeTruthy()
    })

    await waitFor(() => {
      const titles = screen
        .getAllByText(/Algebra|Music Theory|Zoology/)
        .map((element) => element.textContent)
      expect(titles).toEqual(['Algebra', 'Zoology', 'Music Theory'])
    })

    fireEvent.click(screen.getByRole('button', { name: /list view/i }))
    expect(
      await screen.findByRole('table', { name: /quick guides list/i }),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: /open options.*music theory/i }),
    )
    fireEvent.click(
      await screen.findByRole('menuitem', { name: /pin to top/i }),
    )

    await waitFor(() => {
      expect(StudyGuideStorage.getById('m-guide')?.pinnedAt).toBeTruthy()
    })

    await waitFor(() => {
      const titles = screen
        .getAllByText(/Algebra|Music Theory|Zoology/)
        .map((element) => element.textContent)
      expect(titles).toEqual(['Music Theory', 'Algebra', 'Zoology'])
    })
  })

  it('deletes embedded podcast audio when deleting a full Study Guide', async () => {
    const guide = makeStoredGuide({
      id: 'podcast-guide',
      title: 'Podcast Guide',
      description: 'Audio recap prompt',
      createdAt: '2026-01-04T00:00:00.000Z',
    })
    guide.studyPath.dashboards[0].layout = {
      type: 'row',
      config: {
        customProps: {
          components: [
            {
              id: 'podcast-player',
              type: 'PodcastBlock',
              props: {
                podcast: {
                  audioPath: 'user-1/podcast-guide/podcast-audio.mp3',
                },
              },
            },
          ],
        },
      },
    }
    StudyGuideStorage.save(guide)
    renderStudyGuidesPage('/study-guides')

    fireEvent.click(
      screen.getByRole('button', { name: /open options.*podcast guide/i }),
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: /delete/i }))

    expect(deleteHostedAiPodcastAudioMock).toHaveBeenCalledWith(
      'user-1/podcast-guide/podcast-audio.mp3',
      'study-guide-deleted',
    )
    expect(StudyGuideStorage.getById('podcast-guide')).toBeNull()
  })

  it('shows a friendly error when the Study Guide library is too large to save', () => {
    vi.mocked(window.localStorage.setItem).mockImplementation(() => {
      throw new DOMException(
        'Setting the value exceeded the quota.',
        'QuotaExceededError',
      )
    })

    expect(() =>
      StudyGuideStorage.save(
        makeStoredGuide({
          id: 'large-guide',
          title: 'Large guide',
          description: 'Large local guide',
          createdAt: '2026-01-04T00:00:00.000Z',
        }),
      ),
    ).toThrow(STUDY_GUIDES_STORAGE_FULL_MESSAGE)
  })

})

describe('follow-up guides handed over from a finished quiz', () => {
  const PROMPTS = [
    { prompt: 'Teach me why queues stall.', knownSkill: 'Bottlenecks' },
    {
      prompt: 'Teach me how to measure throughput.',
      knownSkill: 'Bottlenecks',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    getHostedStudyGuideJobsMock.mockImplementation(gatewayOwnsEveryJob)
    useHostedAiStatusMock.mockReturnValue({
      status: null,
      displayStudyCredits: 30,
      loading: false,
      error: '',
      refresh: vi.fn(),
    })
    const storage = new Map<string, string>()
    vi.mocked(window.localStorage.getItem).mockImplementation(
      (key: string) => storage.get(key) ?? null,
    )
    vi.mocked(window.localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage.set(key, value)
      },
    )
    vi.mocked(window.localStorage.removeItem).mockImplementation(
      (key: string) => {
        storage.delete(key)
      },
    )
    vi.mocked(window.localStorage.clear).mockImplementation(() => {
      storage.clear()
    })
    window.localStorage.clear()
  })

  const renderWithHandoverState = (createGuidePrompts: unknown) =>
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/study-guides', state: { createGuidePrompts } },
        ]}
      >
        <Routes>
          <Route
            path="/study-guides"
            element={
              <>
                <StudyGuidesPage />
                <StateProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

  it('opens the multi-create dialog listing every handed-over prompt', async () => {
    renderWithHandoverState(PROMPTS)

    expect(await screen.findByText('Create 2 guides')).toBeInTheDocument()
    expect(screen.getByText(/Teach me why queues stall/)).toBeInTheDocument()
    expect(
      screen.getByText(/Teach me how to measure throughput/),
    ).toBeInTheDocument()
  })

  it('prices the whole batch, not one guide', async () => {
    renderWithHandoverState(PROMPTS)

    const confirm = await screen.findByRole('button', { name: /^Create 2/ })
    expect(confirm).toHaveTextContent('6')
  })

  it('starts one creation per prompt on confirm', async () => {
    renderWithHandoverState(PROMPTS)

    fireEvent.click(await screen.findByRole('button', { name: /^Create 2/ }))

    // The queue drains as jobs finish, so the generator call is the signal.
    await waitFor(() => {
      expect(generateStudyPathStateFromPrompt).toHaveBeenCalledTimes(2)
    })
    // The claimed skill reaches generation as its own field, so the prompt
    // that picks the guide's language stays the learner's own words.
    expect(
      vi
        .mocked(generateStudyPathStateFromPrompt)
        .mock.calls.map(([options]) => ({
          prompt: options.prompt,
          knownSkill: options.knownSkill,
        }))
        .sort((left, right) => left.prompt.localeCompare(right.prompt)),
    ).toEqual(
      [...PROMPTS].sort((left, right) =>
        left.prompt.localeCompare(right.prompt),
      ),
    )
  })

  it('clears the router state so a reload does not reopen the dialog', async () => {
    renderWithHandoverState(PROMPTS)

    await screen.findByText('Create 2 guides')
    await waitFor(() => {
      expect(screen.getByTestId('router-state')).toHaveTextContent('null')
    })
  })

  it('ignores a state that carries no usable prompt', async () => {
    renderWithHandoverState([{ prompt: '   ' }])

    await waitFor(() => {
      expect(screen.getByTestId('router-state')).toBeInTheDocument()
    })
    expect(screen.queryByText(/^Create \d+ guides$/)).not.toBeInTheDocument()
  })
})

describe('several tabs open on the guide list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getHostedStudyGuideJobsMock.mockImplementation(gatewayOwnsEveryJob)
    useHostedAiStatusMock.mockReturnValue({
      status: null,
      displayStudyCredits: 30,
      loading: false,
      error: '',
      refresh: vi.fn(),
    })
    const storage = new Map<string, string>()
    vi.mocked(window.localStorage.getItem).mockImplementation(
      (key: string) => storage.get(key) ?? null,
    )
    vi.mocked(window.localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage.set(key, value)
      },
    )
    vi.mocked(window.localStorage.removeItem).mockImplementation(
      (key: string) => {
        storage.delete(key)
      },
    )
    vi.mocked(window.localStorage.clear).mockImplementation(() => {
      storage.clear()
    })
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('does not generate or pay for a guide another tab queued', async () => {
    // The queue is shared through localStorage. Before jobs carried an owner,
    // every open tab ran the same job, so one batch cost once per open tab.
    StudyGuideCreationQueueStorage.upsert({
      id: 'job-from-other-tab',
      prompt: 'Queued by another tab',
      provider: 'hosted',
      status: 'queued',
      estimateSeconds: 45,
      autoRetryCount: 0,
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      resultStudyGuideId: null,
      ownerTabId: 'some-other-tab',
    })

    renderStudyGuidesPage('/study-guides')

    // It still shows the card, so the other tabs mirror the progress.
    expect(await screen.findByText('Queued by another tab')).toBeInTheDocument()
    expect(generateStudyPathStateFromPrompt).not.toHaveBeenCalled()
  })

  it('generates a guide it queued itself', async () => {
    renderStudyGuidesPage('/study-guides')

    await createGuideFromPrompt('Queued by this tab')

    await waitFor(() => {
      expect(generateStudyPathStateFromPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'Queued by this tab' }),
      )
    })
  })
})
