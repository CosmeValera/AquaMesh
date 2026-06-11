/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import StudyGuidesPage from '../../../../src/components/studyGuides/StudyGuidesPage'
import { STUDY_GUIDES_STORAGE_KEY } from '../../../../src/studyGuides/storage'

vi.mock('../../../../src/components/topnavbar/TopNavBar', () => ({
  __esModule: true,
  default: () => <div data-testid="top-nav-bar" />,
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

describe('StudyGuidesPage create route', () => {
  beforeEach(() => {
    localStorage.removeItem(STUDY_GUIDES_STORAGE_KEY)
  })

  it('opens the new Study Guide dialog once from create=1 and cleans the query', async () => {
    renderStudyGuidesPage('/study-guides?create=1')

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/prompt/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/study-guides')
      expect(screen.getByTestId('location')).not.toHaveTextContent('create=1')
    })
  })
})
