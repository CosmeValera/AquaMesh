/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import StudyGuidesPage from '../../../../src/components/studyGuides/StudyGuidesPage'
import {
  STUDY_GUIDES_STORAGE_KEY,
  StudyGuideStorage,
} from '../../../../src/studyGuides/storage'
import { generateStudyPathStateFromPrompt } from '../../../../src/studyGuides/generation'
import {
  STUDY_GUIDE_CREATION_QUEUE_KEY,
  StudyGuideCreationQueueStorage,
} from '../../../../src/studyGuides/creationQueue'

vi.mock('../../../../src/components/topnavbar/TopNavBar', () => ({
  __esModule: true,
  default: () => <div data-testid="top-nav-bar" />,
}))

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
    screen.getAllByRole('button', { name: /new study guide/i })[0],
  )
  const promptInput = await screen.findByLabelText(/study guide prompt/i)
  fireEvent.change(promptInput, { target: { value: prompt } })
  fireEvent.click(screen.getByRole('button', { name: /create guide/i }))
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
}

describe('StudyGuidesPage create flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    const storedGuides: ReturnType<typeof StudyGuideStorage.getAll> = []
    const getAllSpy = vi
      .spyOn(StudyGuideStorage, 'getAll')
      .mockImplementation(() => [...storedGuides])
    const saveSpy = vi
      .spyOn(StudyGuideStorage, 'save')
      .mockImplementation((guide) => {
        storedGuides.push(guide)
        return guide
      })
    renderStudyGuidesPage('/study-guides')

    fireEvent.click(
      screen.getAllByRole('button', { name: /new study guide/i })[0],
    )

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByLabelText(/guide name/i)).not.toBeInTheDocument()
    const promptInput = screen.getByLabelText(/study guide prompt/i)
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
    getAllSpy.mockRestore()
    saveSpy.mockRestore()
  })

  it('keeps a failed Study Guide card retryable with the original prompt', async () => {
    vi.mocked(generateStudyPathStateFromPrompt)
      .mockRejectedValueOnce(
        new Error(
          'Gemini could not follow the requested output format. StudyMesh retried with a simpler JSON prompt.',
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
      screen.getAllByRole('button', { name: /new study guide/i })[0],
    )
    await screen.findByLabelText(/study guide prompt/i)
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
    fireEvent.click(screen.getByText('Retry'))

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

  it('auto-retries running jobs after a refresh', async () => {
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
    expect(generateStudyPathStateFromPrompt).toHaveBeenCalledTimes(1)

    firstRender.unmount()
    renderStudyGuidesPage('/study-guides')

    expect(await screen.findByText('Creating')).toBeInTheDocument()
    expect(screen.getByText('Refresh-sensitive prompt')).toBeInTheDocument()
    await waitFor(() => {
      expect(generateStudyPathStateFromPrompt).toHaveBeenCalledTimes(2)
    })
    resolvers[1]('Retried Guide')

    await waitFor(() => {
      expect(
        screen.getByTestId('newly-created-study-guide-card'),
      ).toHaveTextContent('Retried Guide')
    })
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
    const getAllSpy = vi.spyOn(StudyGuideStorage, 'getAll').mockReturnValue([
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
      screen.getAllByRole('button', { name: /new study guide/i }),
    ).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /list view/i }))
    await waitFor(() => {
      expect(
        window.localStorage.getItem('studymesh.studyGuides.viewMode'),
      ).toBe('list')
    })
    expect(
      screen.getAllByRole('button', { name: /new study guide/i }),
    ).toHaveLength(1)

    expect(
      screen.getByRole('table', { name: /study guides list/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Pages')).toBeInTheDocument()
    expect(screen.getByText('Prompt')).toBeInTheDocument()
    expect(screen.getByText('Created')).toBeInTheDocument()
    expect(screen.getByText('🔢')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /most recent/i }))
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

    getAllSpy.mockRestore()
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
      screen.getByRole('button', { name: /open algebra options/i }),
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
      await screen.findByRole('table', { name: /study guides list/i }),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: /open music theory options/i }),
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
})
