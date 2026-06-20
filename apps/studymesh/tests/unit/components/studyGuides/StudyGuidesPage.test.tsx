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

vi.mock('../../../../src/components/topnavbar/TopNavBar', () => ({
  __esModule: true,
  default: () => <div data-testid="top-nav-bar" />,
}))

vi.mock('../../../../src/studyGuides/generation', () => ({
  generateStudyPathStateFromPrompt: vi.fn(async ({ id }) => ({
    pathId: id,
    title: 'AI Named Guide',
    folderName: 'AI Named Guide',
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

describe('StudyGuidesPage create flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.removeItem(STUDY_GUIDES_STORAGE_KEY)
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
      expect(generateStudyPathStateFromPrompt).toHaveBeenCalledWith({
        id: expect.any(String),
        prompt: 'Teach me French subjunctive with practice.',
      })
    })

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'AI Named Guide',
          folderName: 'AI Named Guide',
          description: 'Teach me French subjunctive with practice.',
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
    expect(generateStudyPathStateFromPrompt).toHaveBeenLastCalledWith({
      id: expect.any(String),
      prompt: 'Teach me the basics of human anatomy for an exam.',
    })
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Human Anatomy Basics',
          folderName: 'Human Anatomy Basics',
          description: 'Teach me the basics of human anatomy for an exam.',
        }),
      )
    })
  })
})
