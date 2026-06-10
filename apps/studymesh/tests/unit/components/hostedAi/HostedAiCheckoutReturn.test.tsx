import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HostedAiCheckoutReturn from '../../../../src/components/hostedAi/HostedAiCheckoutReturn'
import { confirmHostedAiCreditCheckout } from '../../../../src/quickCreate/ai'

vi.mock('../../../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    loading: false,
    user: { id: 'student-1' },
  }),
}))

vi.mock('../../../../src/quickCreate/ai', () => ({
  confirmHostedAiCreditCheckout: vi.fn(),
}))

const LocationProbe = () => {
  const location = useLocation()
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>
}

describe('HostedAiCheckoutReturn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('confirms successful Checkout returns and removes payment query params', async () => {
    vi.mocked(confirmHostedAiCreditCheckout).mockResolvedValue()

    render(
      <MemoryRouter
        initialEntries={[
          '/study-guides?credits=success&session_id=cs_test_123',
        ]}
      >
        <HostedAiCheckoutReturn />
        <LocationProbe />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(confirmHostedAiCreditCheckout).toHaveBeenCalledWith('cs_test_123')
    })
    expect(
      await screen.findByText('Payment confirmed. Study Credits added.'),
    ).toBeInTheDocument()
    expect(document.querySelectorAll('.studymesh-confetti-piece')).toHaveLength(
      72,
    )
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/study-guides')
    })
  })

  it('cleans cancelled Checkout returns without confirming payment', async () => {
    render(
      <MemoryRouter initialEntries={['/study-guides?credits=cancel']}>
        <HostedAiCheckoutReturn />
        <LocationProbe />
      </MemoryRouter>,
    )

    expect(
      await screen.findByText('Study Credits checkout was cancelled.'),
    ).toBeInTheDocument()
    expect(confirmHostedAiCreditCheckout).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/study-guides')
    })
  })
})
