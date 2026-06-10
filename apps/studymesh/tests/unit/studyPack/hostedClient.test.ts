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
  callHostedAiModel,
  createHostedAiTransport,
} from '../../../src/studyPack/ai/hostedClient'
import { HOSTED_AI_INSUFFICIENT_CREDITS_EVENT } from '../../../src/studyPack/ai/hostedCredits'

const statusPayload = (studyCredits: number) => ({
  ok: true,
  status: {
    available: true,
    accountReady: true,
    introSeen: true,
    studyCredits,
    dailyFreeCredits: 5,
    initialFreeCredits: 20,
    costs: {
      'study-guide': 2,
      'quick-create': 1,
      chat: 1,
    },
  },
})

const gatewayResponse = (
  payload: Record<string, unknown>,
  ok = true,
  status = 200,
) => ({
  ok,
  status,
  json: vi.fn().mockResolvedValue(payload),
})

describe('hosted AI client credit failures', () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'session-token' } },
      error: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('announces insufficient credits found by the preflight balance check', async () => {
    const listener = vi.fn()
    window.addEventListener(HOSTED_AI_INSUFFICIENT_CREDITS_EVENT, listener)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(gatewayResponse(statusPayload(0))),
    )

    await expect(
      callHostedAiModel({
        surface: 'chat',
        parts: [{ text: 'Question' }],
      }),
    ).rejects.toThrow(/not enough study credits/i)
    expect(listener).toHaveBeenCalledTimes(1)

    window.removeEventListener(HOSTED_AI_INSUFFICIENT_CREDITS_EVENT, listener)
  })

  it('announces insufficient credits returned by the generation gateway', async () => {
    const listener = vi.fn()
    window.addEventListener(HOSTED_AI_INSUFFICIENT_CREDITS_EVENT, listener)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(gatewayResponse(statusPayload(5)))
        .mockResolvedValueOnce(
          gatewayResponse(
            {
              ok: false,
              error: {
                code: 'insufficient_credits',
                message: 'Insufficient Study Credits.',
              },
            },
            false,
            402,
          ),
        ),
    )

    const transport = createHostedAiTransport({ surface: 'study-guide' })
    await expect(transport({ parts: [{ text: 'Create guide' }] })).rejects.toThrow(
      'Insufficient Study Credits.',
    )
    expect(listener).toHaveBeenCalledTimes(1)

    window.removeEventListener(HOSTED_AI_INSUFFICIENT_CREDITS_EVENT, listener)
  })
})
