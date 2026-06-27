/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'

import StudyMeshPricingPage from '../../../../src/components/landing/StudyMeshPricingPage'
import { createStudyMeshTheme } from '../../../../src/theme'

const renderPricingPage = (
  theme = createStudyMeshTheme('light'),
) => {
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
    expect(screen.getByText(/no credit card required/i)).toBeInTheDocument()
    expect(screen.getByText('Free product')).toBeInTheDocument()
    expect(screen.getByText('0€')).toBeInTheDocument()

    expect(screen.getByText('Bring your own key')).toBeInTheDocument()
    expect(screen.getByText('Local AI')).toBeInTheDocument()
    expect(screen.queryByText('Own AI key')).not.toBeInTheDocument()
    expect(screen.queryByText('Basic fallback')).not.toBeInTheDocument()
    expect(screen.queryByText(/strong ai quality/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/good privacy path/i)).not.toBeInTheDocument()

    expect(screen.getByText(/Study Credits pay for hosted generation/i)).toBeInTheDocument()
    expect(screen.getByLabelText('80 Study Credits')).toBeInTheDocument()
    expect(screen.getByText('2€')).toBeInTheDocument()
    expect(screen.getByLabelText('250 Study Credits')).toBeInTheDocument()
    expect(screen.getByText('5€')).toBeInTheDocument()
    expect(screen.getByLabelText('600 Study Credits')).toBeInTheDocument()
    expect(screen.getByText('10€')).toBeInTheDocument()

    expect(screen.getByLabelText('20 Study Credits')).toBeInTheDocument()
    expect(screen.getByLabelText('2 Study Credits')).toBeInTheDocument()
    expect(screen.getByLabelText('1 Study Credits')).toBeInTheDocument()
    expect(
      screen.getByText(/only increase through completed credit purchases/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/study guides cost/i),
    ).toBeInTheDocument()
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

    expect(screen.getByRole('link', { name: /knowledge context/i })).toHaveAttribute(
      'href',
      '/#knowledge-context',
    )
    expect(screen.getByRole('link', { name: /growing guides/i })).toHaveAttribute(
      'href',
      '/#growing-guide',
    )
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
