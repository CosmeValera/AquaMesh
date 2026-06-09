import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.hoisted(() => vi.fn())

vi.mock('../../../src/auth/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}))

import {
  confirmHostedAiCreditCheckout,
  createHostedAiCreditCheckout,
} from '../../../src/studyPack/ai/hostedBilling'

describe('hosted Study Credits billing client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'session-token',
        },
      },
      error: null,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a Checkout session with the signed-in bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ok: true,
        checkoutUrl: 'https://checkout.stripe.test/session',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(createHostedAiCreditCheckout()).resolves.toBe(
      'https://checkout.stripe.test/session',
    )
    expect(fetchMock).toHaveBeenCalledWith('/api/hosted-ai-billing', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'createCheckout', packId: 'popular' }),
    })
  })

  it('throws clear auth errors before starting Checkout', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: null,
      },
      error: null,
    })

    await expect(createHostedAiCreditCheckout()).rejects.toThrow(
      'Sign in to buy Study Credits.',
    )
  })

  it('throws server payment errors from billing API response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({
          ok: false,
          error: {
            code: 'payment_error',
            message: 'Stripe Checkout failed.',
          },
        }),
      }),
    )

    await expect(createHostedAiCreditCheckout()).rejects.toThrow(
      'Stripe Checkout failed.',
    )
  })

  it('confirms a paid Checkout session with the signed-in bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      confirmHostedAiCreditCheckout('cs_test_123'),
    ).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('/api/hosted-ai-billing', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'confirmCheckout',
        sessionId: 'cs_test_123',
      }),
    })
  })
})
