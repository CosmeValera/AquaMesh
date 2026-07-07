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
  createHostedStudyGuideTransportWithQuickStart,
} from '../../../src/quickCreate/ai/hostedClient'
import {
  HOSTED_AI_INSUFFICIENT_CREDITS_EVENT,
  HOSTED_AI_VISUAL_SPEND_EVENT,
} from '../../../src/quickCreate/ai/hostedCredits'

const statusPayload = (studyCredits: number) => ({
  ok: true,
  status: {
    available: true,
    accountReady: true,
    introSeen: true,
    studyCredits,
    initialFreeCredits: 30,
    dailyFreeCreditFloor: 7,
    costs: {
      'study-guide': 3,
      'quick-create': 1,
      chat: 1,
      podcast: 1,
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
    await expect(
      transport({ parts: [{ text: 'Create guide' }] }),
    ).rejects.toThrow('Insufficient Study Credits.')
    expect(listener).toHaveBeenCalledTimes(1)

    window.removeEventListener(HOSTED_AI_INSUFFICIENT_CREDITS_EVENT, listener)
  })

  it('does not send reusable request ids for hosted AI generation calls', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(gatewayResponse(statusPayload(5)))
      .mockResolvedValueOnce(gatewayResponse({ ok: true, text: 'first' }))
      .mockResolvedValueOnce(gatewayResponse(statusPayload(5)))
      .mockResolvedValueOnce(gatewayResponse({ ok: true, text: 'second' }))
    vi.stubGlobal('fetch', fetchMock)

    const transport = createHostedAiTransport({ surface: 'study-guide' })

    await expect(transport({ parts: [{ text: 'Plan guide' }] })).resolves.toBe(
      'first',
    )
    await expect(
      transport({ parts: [{ text: 'Repair guide' }] }),
    ).resolves.toBe('second')

    const requestBodies = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body)),
    )
    expect(requestBodies.map((body) => body.action)).toEqual([
      'status',
      'generate',
      'status',
      'generate',
    ])
    expect(requestBodies[1]).not.toHaveProperty('requestId')
    expect(requestBodies[3]).not.toHaveProperty('requestId')
  })

  it('announces the visual credit cost before hosted generation finishes', async () => {
    let resolveGeneration: (
      response: ReturnType<typeof gatewayResponse>,
    ) => void
    const listener = vi.fn()
    window.addEventListener(HOSTED_AI_VISUAL_SPEND_EVENT, listener)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(gatewayResponse(statusPayload(8)))
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveGeneration = resolve
          }),
        ),
    )

    const pending = callHostedAiModel({
      surface: 'chat',
      parts: [{ text: 'Question' }],
    })

    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledTimes(1)
    })
    expect(listener.mock.calls[0][0]).toMatchObject({
      detail: { credits: 1 },
    })

    resolveGeneration!(gatewayResponse({ ok: true, text: 'Answer' }))
    await expect(pending).resolves.toBe('Answer')

    window.removeEventListener(HOSTED_AI_VISUAL_SPEND_EVENT, listener)
  })

  it('keeps the visual credit spend when hosted generation fails', async () => {
    const spendListener = vi.fn()
    window.addEventListener(HOSTED_AI_VISUAL_SPEND_EVENT, spendListener)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(gatewayResponse(statusPayload(8)))
        .mockResolvedValueOnce(
          gatewayResponse(
            {
              ok: false,
              error: {
                code: 'provider_error',
                message: 'Model failed.',
              },
            },
            false,
            502,
          ),
        ),
    )

    await expect(
      callHostedAiModel({
        surface: 'study-guide',
        parts: [{ text: 'Create guide' }],
      }),
    ).rejects.toThrow('Model failed.')

    expect(spendListener.mock.calls[0][0]).toMatchObject({
      detail: { credits: 3 },
    })

    window.removeEventListener(HOSTED_AI_VISUAL_SPEND_EVENT, spendListener)
  })

  it('bundles hosted Study Guide Quick Start generation under one visual charge', async () => {
    const spendListener = vi.fn()
    window.addEventListener(HOSTED_AI_VISUAL_SPEND_EVENT, spendListener)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(gatewayResponse(statusPayload(8)))
        .mockResolvedValueOnce(
          gatewayResponse({
            ok: true,
            text: '{"title":"Guide","dashboards":[]}',
            quickStart: {
              keyIdea: 'Backend helps explain the guide topic quickly.',
              quickSummary: 'First short paragraph.\n\nSecond short paragraph.',
            },
          }),
        ),
    )

    const onQuickStart = vi.fn()
    const transport = createHostedStudyGuideTransportWithQuickStart({
      userKnownTopics: ['Backend', 'Databases'],
      onQuickStart,
    })

    await expect(
      transport({
        provider: 'cerebras',
        apiToken: '',
        model: 'gpt-oss-120b',
        parts: [{ text: 'Create guide' }],
        timeoutMs: 60000,
      }),
    ).resolves.toBe('{"title":"Guide","dashboards":[]}')

    expect(onQuickStart).toHaveBeenCalledWith({
      keyIdea: 'Backend helps explain the guide topic quickly.',
      quickSummary: 'First short paragraph.\n\nSecond short paragraph.',
    })
    expect(spendListener.mock.calls[0][0]).toMatchObject({
      detail: { credits: 3 },
    })
    const requestBodies = vi
      .mocked(fetch)
      .mock.calls.map(([, init]) => JSON.parse(String(init?.body)))
    expect(requestBodies[1]).toMatchObject({
      action: 'generateWithQuickStart',
      surface: 'study-guide',
      quickStartOptions: {
        userKnownTopics: ['Backend', 'Databases'],
      },
    })

    window.removeEventListener(HOSTED_AI_VISUAL_SPEND_EVENT, spendListener)
  })
})
