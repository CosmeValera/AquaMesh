import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import GuideWorkspacePage from '../../../../src/components/studyGuides/GuideWorkspacePage'
import { STUDY_GUIDES_STORAGE_KEY } from '../../../../src/studyGuides/storage'
import {
  addLearnedTopicToProfileContext,
  getUserKnownTopics,
  LEARNED_TOPIC_PROMPTS_STORAGE_KEY,
  PROFILE_CONTEXT_STORAGE_KEY,
  readProfileContext,
  saveProfileContext,
  USER_KNOWN_TOPICS_MAX_FOR_AI,
} from '../../../../src/profileContext'
import { GUIDE_QUIZ_COMPLETED_EVENT } from '../../../../src/studyGuides/mastery'

vi.mock('../../../../src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: null }),
}))

vi.mock('../../../../src/auth/supabaseClient', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}))

vi.mock('../../../../src/cloud/repository', () => ({
  createCloudRepository: () => ({ getStudyGuide: vi.fn() }),
}))

vi.mock('../../../../src/components/topnavbar/TopNavBar', () => ({
  default: () => <div data-testid="top-nav" />,
}))

vi.mock('../../../../src/components/Main', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
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

const quizLayout = {
  type: 'row',
  children: [{ type: 'tabset', components: [{ type: 'QuizCarouselBlock' }] }],
}

const completeQuizWith = (scorePercent: number) => {
  fireEvent(
    window,
    new CustomEvent(GUIDE_QUIZ_COMPLETED_EVENT, {
      detail: { correct: scorePercent, total: 100, scorePercent },
    }),
  )
}

const createStoredGuide = (
  visitedPageKeys: string[],
  reviewLayout: Record<string, unknown> = { type: 'row' },
) => ({
  id: 'guide-1',
  title: 'Bottlenecks',
  folderName: 'Bottlenecks',
  visitedPageKeys,
  studyPath: {
    pathId: 'guide-1',
    title: 'Bottlenecks',
    folderName: 'Bottlenecks',
    selectedIndex: 1,
    dashboards: [
      {
        name: 'Core lesson',
        dashboardKey: 'core',
        dashboardIndex: 1,
        dashboardCount: 2,
        folderName: 'Bottlenecks',
        layout: { type: 'row' },
        createdBy: 'generator',
        deletable: false,
      },
      {
        name: 'Review page',
        dashboardKey: 'review',
        dashboardIndex: 2,
        dashboardCount: 2,
        folderName: 'Bottlenecks',
        layout: reviewLayout,
        createdBy: 'generator',
        deletable: false,
      },
    ],
  },
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
})

const renderWorkspace = () =>
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

describe('learned topic lens prompt', () => {
  let storage: Record<string, string>

  beforeEach(() => {
    storage = {
      [STUDY_GUIDES_STORAGE_KEY]: JSON.stringify([
        createStoredGuide(['core', 'review']),
      ]),
    }
    vi.mocked(localStorage.getItem).mockImplementation(
      (key: string) => storage[key] ?? null,
    )
    vi.mocked(localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage[key] = value
      },
    )
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      delete storage[key]
    })
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
  })

  it('keeps a newly learned topic inside the AI topic cap', () => {
    saveProfileContext({
      roles: ['software_it'],
      broadKnowledge: ['Backend', 'Databases'],
      specificKnowledge: [
        'MinIO',
        'S3',
        'Kafka',
        'Redis',
        'Postgres',
        'Nginx',
        'Docker',
        'Terraform',
      ],
    })

    const next = addLearnedTopicToProfileContext('Bottlenecks')

    expect(next?.specificKnowledge[0]).toBe('Bottlenecks')
    expect(next?.specificKnowledge).toHaveLength(9)
    expect(getUserKnownTopics(next)).toHaveLength(USER_KNOWN_TOPICS_MAX_FOR_AI)
    expect(getUserKnownTopics(next)[0]).toBe('Bottlenecks')
  })

  it('promotes an already declared topic instead of duplicating it', () => {
    saveProfileContext({
      roles: [],
      broadKnowledge: [],
      specificKnowledge: ['MinIO', 'bottlenecks', 'S3'],
    })

    const next = addLearnedTopicToProfileContext('Bottlenecks')

    expect(next?.specificKnowledge).toEqual(['Bottlenecks', 'MinIO', 'S3'])
  })

  it('offers the finished guide topic and adds it only on an explicit accept', async () => {
    renderWorkspace()

    expect(
      await screen.findByText(/you just went through/i),
    ).toBeInTheDocument()
    expect(readProfileContext()).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Add to what I know' }))

    await waitFor(() => {
      expect(readProfileContext()?.specificKnowledge).toEqual(['Bottlenecks'])
    })
    expect(JSON.parse(storage[LEARNED_TOPIC_PROMPTS_STORAGE_KEY])).toEqual({
      'guide-1': 'added',
    })
    expect(
      screen.getByText(/is part of what you know now/i),
    ).toBeInTheDocument()
  })

  it('does not offer the topic again once dismissed', async () => {
    const firstRender = renderWorkspace()

    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }))

    expect(screen.queryByText(/you just went through/i)).not.toBeInTheDocument()
    expect(JSON.parse(storage[LEARNED_TOPIC_PROMPTS_STORAGE_KEY])).toEqual({
      'guide-1': 'dismissed',
    })
    expect(storage[PROFILE_CONTEXT_STORAGE_KEY]).toBeUndefined()

    firstRender.unmount()
    renderWorkspace()

    expect(await screen.findByTestId('study-guide-panel')).toBeInTheDocument()
    expect(screen.queryByText(/you just went through/i)).not.toBeInTheDocument()
  })

  it('stays quiet while pages are still unread', async () => {
    storage[STUDY_GUIDES_STORAGE_KEY] = JSON.stringify([
      createStoredGuide(['review']),
    ])

    renderWorkspace()

    expect(await screen.findByTestId('study-guide-panel')).toBeInTheDocument()
    expect(screen.queryByText(/you just went through/i)).not.toBeInTheDocument()
  })

  it('withholds the skill until the guide quiz is passed', async () => {
    storage[STUDY_GUIDES_STORAGE_KEY] = JSON.stringify([
      createStoredGuide(['core', 'review'], quizLayout),
    ])

    renderWorkspace()

    expect(await screen.findByText(/not a pass yet/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add to what I know' }),
    ).not.toBeInTheDocument()

    completeQuizWith(40)

    expect(await screen.findByText(/40%/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add to what I know' }),
    ).not.toBeInTheDocument()
  })

  it('offers the skill from half the quiz, with a review suggestion', async () => {
    storage[STUDY_GUIDES_STORAGE_KEY] = JSON.stringify([
      createStoredGuide(['core', 'review'], quizLayout),
    ])

    renderWorkspace()
    await screen.findByText(/not a pass yet/i)

    completeQuizWith(55)

    expect(
      await screen.findByRole('button', { name: 'Add to what I know' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/but a narrow one/i)).toBeInTheDocument()
  })

  it('drops the review suggestion on a comfortable pass', async () => {
    storage[STUDY_GUIDES_STORAGE_KEY] = JSON.stringify([
      createStoredGuide(['core', 'review'], quizLayout),
    ])

    renderWorkspace()
    await screen.findByText(/not a pass yet/i)

    completeQuizWith(80)

    expect(
      await screen.findByRole('button', { name: 'Add to what I know' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/but a narrow one/i)).not.toBeInTheDocument()
  })

  it('stays quiet when the topic is already declared knowledge', async () => {
    saveProfileContext({
      roles: [],
      broadKnowledge: [],
      specificKnowledge: ['bottlenecks'],
    })

    renderWorkspace()

    expect(await screen.findByTestId('study-guide-panel')).toBeInTheDocument()
    expect(screen.queryByText(/you just went through/i)).not.toBeInTheDocument()
  })
})
