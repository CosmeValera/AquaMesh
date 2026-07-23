/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'

import StudyMeshPricingPage from '../../../../src/components/landing/StudyMeshPricingPage'
import { createStudyMeshTheme } from '../../../../src/theme'

const renderPricingPage = (theme = createStudyMeshTheme('light')) => {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <StudyMeshPricingPage />
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('StudyMeshPricingPage', () => {
  it('markets free use first and shows hosted Study Credit packs', () => {
    renderPricingPage()

    expect(
      screen.getByRole('heading', {
        name: /free without a subscription/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(/no credit card required/i).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('Free product')).toBeInTheDocument()
    expect(screen.getByText('0€')).toBeInTheDocument()

    expect(screen.getByText('Bring your own key')).toBeInTheDocument()
    expect(screen.getByText('Local AI')).toBeInTheDocument()
    expect(screen.queryByText('Own AI key')).not.toBeInTheDocument()
    expect(screen.queryByText('Basic fallback')).not.toBeInTheDocument()
    expect(screen.queryByText(/strong ai quality/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/good privacy path/i)).not.toBeInTheDocument()

    expect(
      screen.getByText(/Study Credits pay for hosted generation/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('150 Study Credits')).toBeInTheDocument()
    expect(screen.getByText('2 EUR')).toBeInTheDocument()
    expect(screen.getByText('75 credits / EUR')).toBeInTheDocument()
    expect(screen.getByLabelText('450 Study Credits')).toBeInTheDocument()
    expect(screen.getByText('5 EUR')).toBeInTheDocument()
    expect(screen.getByText('90 credits / EUR')).toBeInTheDocument()
    expect(screen.getByLabelText('1000 Study Credits')).toBeInTheDocument()
    expect(screen.getByText('10 EUR')).toBeInTheDocument()
    expect(screen.getByText('100 credits / EUR')).toBeInTheDocument()
    expect(screen.getByText('Starter')).toBeInTheDocument()
    expect(screen.getByText('Popular')).toBeInTheDocument()
    expect(screen.getByText('Best value')).toBeInTheDocument()
    expect(screen.getAllByText('No API key to manage')).toHaveLength(3)
    expect(screen.getAllByText('Use for Quick Guides')).toHaveLength(3)
    expect(
      screen.getAllByText('Use for Quiz, Flashcards, Podcast, and chat'),
    ).toHaveLength(3)

    expect(screen.getByLabelText('30 Study Credits')).toBeInTheDocument()
    expect(screen.getByLabelText('3 Study Credits')).toBeInTheDocument()
    expect(screen.getByLabelText('1 Study Credits')).toBeInTheDocument()
    expect(
      screen.getByText(/2 Quick Guides \+ 1 more creation/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/quick guides cost/i)).toBeInTheDocument()
    expect(screen.queryByText(/\bSC\b/)).not.toBeInTheDocument()

    const signupButtons = screen.getAllByRole('link', { name: /^sign up$/i })
    expect(signupButtons).toHaveLength(3)
    signupButtons.forEach((button) => {
      expect(button).toHaveAttribute('href', '/signup')
    })

    expect(screen.queryByText(/yearly billing/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/monthly billing/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/higher hourly limits/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/one-time 2/i)).not.toBeInTheDocument()

    const header = screen.getByRole('banner')
    expect(
      within(header).getByRole('link', { name: /knowledge bridge/i }),
    ).toHaveAttribute('href', '/#knowledge-context')
    expect(
      within(header).getByRole('link', { name: /growing guides/i }),
    ).toHaveAttribute('href', '/#growing-guide')

    const footer = screen.getByTestId('studymesh-footer')
    expect(footer).toBeInTheDocument()
    expect(
      within(footer).getByRole('link', { name: /knowledge bridge/i }),
    ).toHaveAttribute('href', '/#knowledge-context')
    expect(
      within(footer).getByRole('link', { name: /growing guides/i }),
    ).toHaveAttribute('href', '/#growing-guide')
    expect(
      within(footer).getByRole('link', { name: /create a quick guide/i }),
    ).toHaveAttribute('href', '/study-guides?create=1')
  })

  it('keeps fixed pricing colors under dark mode and custom accent', () => {
    renderPricingPage(createStudyMeshTheme('dark', 'rose'))

    const page = screen.getByTestId('studymesh-pricing')
    expect(window.getComputedStyle(page).backgroundColor).toBe(
      'rgb(251, 253, 254)',
    )
    expect(window.getComputedStyle(page).color).toBe('rgb(7, 17, 39)')

    const startFree = screen.getByRole('link', { name: /start free/i })
    expect(['rgb(17, 80, 216)', 'rgb(13, 63, 174)']).toContain(
      window.getComputedStyle(startFree).backgroundColor,
    )
    expect(window.getComputedStyle(startFree).color).toBe('rgb(255, 255, 255)')
  })
})
