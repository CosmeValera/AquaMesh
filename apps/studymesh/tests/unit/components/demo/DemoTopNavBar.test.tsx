/// <reference types="@testing-library/jest-dom" />
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import DemoTopNavBar from '../../../../src/components/demo/DemoTopNavBar'

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

const renderDemoTopNavBar = () =>
  render(
    <MemoryRouter initialEntries={['/try/sample-guide']}>
      <LocationProbe />
      <DemoTopNavBar />
      <Routes>
        <Route path="/" element={<div>Landing page</div>} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/try/:demoSlug" element={<div>Sample guide</div>} />
      </Routes>
    </MemoryRouter>,
  )

describe('DemoTopNavBar', () => {
  it('sends the logo home', () => {
    renderDemoTopNavBar()

    fireEvent.click(screen.getByRole('button', { name: 'RabbitHole logo' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/')
    expect(screen.getByText('Landing page')).toBeInTheDocument()
  })

  it('never shows the Admin identity, even with stale user data stored', () => {
    // 'Admin' is TopNavBar's fallback when localStorage['userData'] is missing,
    // and the most damaging thing a logged-out demo visitor could be shown.
    vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
      key === 'userData'
        ? JSON.stringify({ name: 'Admin', role: 'ADMIN_ROLE' })
        : null,
    )

    const { container } = renderDemoTopNavBar()

    expect(container.textContent).not.toMatch(/admin/i)
    expect(screen.getByTestId('demo-guest-identity')).toHaveTextContent('Guest')
  })

  it('sends Log in to the login page', () => {
    renderDemoTopNavBar()

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/login')
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('does not sell Carrots to a visitor with no account', () => {
    const { container } = renderDemoTopNavBar()

    expect(
      screen.queryByRole('button', { name: 'Open AI mode selector' }),
    ).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/carrot/i)
    expect(screen.getByTestId('demo-log-in')).toBeInTheDocument()
  })
})
