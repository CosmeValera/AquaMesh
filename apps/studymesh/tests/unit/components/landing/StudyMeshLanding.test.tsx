/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter, useLocation } from 'react-router-dom'

import StudyMeshLanding from '../../../../src/components/landing/StudyMeshLanding'
import { createStudyMeshTheme } from '../../../../src/theme'

const LocationProbe = () => {
  const location = useLocation()
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  )
}

const renderLanding = () => {
  const theme = createStudyMeshTheme('dark', 'rose')

  return render(
    <MemoryRouter initialEntries={['/']}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <StudyMeshLanding />
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('StudyMeshLanding', () => {
  it('renders the rebranded fixed-light hero and timeline', () => {
    renderLanding()

    expect(
      screen.getByRole('heading', {
        name: /study guides that grow with you/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /studymesh builds adaptive study guides by connecting new concepts/i,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/20 sec/i)).toBeInTheDocument()
    expect(screen.getByText(/key idea/i)).toBeInTheDocument()
    expect(screen.getByText(/60 sec/i)).toBeInTheDocument()
    expect(screen.getByText(/idea summary/i)).toBeInTheDocument()
    expect(screen.getByText(/5 pages/i)).toBeInTheDocument()
    expect(screen.getByText(/full guide/i)).toBeInTheDocument()

    expect(getComputedStyle(screen.getByTestId('studymesh-landing')).color).toBe(
      'rgb(7, 17, 39)',
    )
  })

  it('keeps the study guide CTA target unchanged', () => {
    renderLanding()

    fireEvent.click(
      screen.getAllByRole('button', { name: /create a study guide/i })[0],
    )

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/study-guides?create=1',
    )
  })
})
