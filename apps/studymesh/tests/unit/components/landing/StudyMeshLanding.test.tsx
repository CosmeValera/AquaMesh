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
    expect(screen.getAllByText(/20 sec/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/key idea/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/60 sec/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/idea summary/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/5 pages/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/full guide/i).length).toBeGreaterThan(0)
    expect(
      screen.getByRole('heading', {
        name: /same question\. adapted answer\./i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/studymesh adapts the answer/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/choose what you already know - watch the same question change/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /photography/i }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /gaming/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tech/i })).toBeInTheDocument()
    expect(screen.getAllByText(/what is a trade-off/i).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/improving one thing usually means giving up something else/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/think of exposure settings/i)).toBeInTheDocument()
    expect(screen.getByText(/with photography context/i)).toBeInTheDocument()
    expect(screen.getByText(/one question/i))
      .toBeInTheDocument()

    expect(getComputedStyle(screen.getByTestId('studymesh-landing')).color).toBe(
      'rgb(7, 17, 39)',
    )
  })

  it('switches knowledge context examples from the landing carousel', () => {
    renderLanding()

    expect(screen.getByText(/think of exposure settings/i)).toBeInTheDocument()
    expect(screen.getAllByText(/what is a trade-off/i).length).toBeGreaterThan(0)

    fireEvent.click(
      screen.getByRole('button', { name: /show next knowledge context/i }),
    )

    expect(screen.getByRole('button', { name: /gaming/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText(/think of a character build/i)).toBeInTheDocument()
    expect(
      screen.getByText(/improving one thing usually means giving up something else/i),
    ).toBeInTheDocument()
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
