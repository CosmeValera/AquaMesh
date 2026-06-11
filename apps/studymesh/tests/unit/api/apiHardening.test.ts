import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyCors, getAllowedOrigins } from '../../../../../api/cors'
import hostedAiBillingHandler, {
  getStudyMeshAppUrl,
} from '../../../../../api/hosted-ai-billing'
import hostedAiHandler, {
  DEFAULT_CEREBRAS_MODEL,
  getHostedCerebrasModel,
} from '../../../../../api/hosted-ai'

const makeResponse = () => {
  const headers = new Map<string, string>()
  const response = {
    statusCode: 200,
    body: undefined as unknown,
  }
  const res = {
    setHeader: vi.fn((name: string, value: string) => {
      headers.set(name.toLowerCase(), value)
    }),
    status: vi.fn((code: number) => {
      response.statusCode = code
      return res
    }),
    json: vi.fn((body: unknown) => {
      response.body = body
    }),
    end: vi.fn(),
  }

  return {
    headers,
    response,
    res,
  }
}

describe('API payment and hosted AI hardening', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('allows configured app and extra origins', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STUDYMESH_APP_URL', 'https://app.studymesh.test/')
    vi.stubEnv(
      'STUDYMESH_ALLOWED_ORIGINS',
      'https://preview.studymesh.test, https://school.example',
    )

    expect([...getAllowedOrigins()].sort()).toEqual([
      'https://app.studymesh.test',
      'https://preview.studymesh.test',
      'https://school.example',
    ])
  })

  it('keeps localhost defaults out of production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STUDYMESH_APP_URL', 'https://app.studymesh.test')

    expect(getAllowedOrigins().has('http://localhost:3000')).toBe(false)
  })

  it('allows localhost defaults outside production', () => {
    vi.stubEnv('NODE_ENV', 'test')

    expect(getAllowedOrigins().has('http://localhost:3000')).toBe(true)
    expect(getAllowedOrigins().has('http://127.0.0.1:3000')).toBe(true)
  })

  it('rejects non-allowlisted browser origins', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STUDYMESH_APP_URL', 'https://app.studymesh.test')
    const { headers, res } = makeResponse()

    const result = applyCors(
      {
        headers: {
          origin: 'https://evil.example',
        },
      },
      res,
    )

    expect(result.allowed).toBe(false)
    expect(headers.get('access-control-allow-origin')).toBeUndefined()
  })

  it('rejects bad Origin in hosted AI route before config/auth', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STUDYMESH_APP_URL', 'https://app.studymesh.test')
    const { response, res } = makeResponse()

    await hostedAiHandler(
      {
        method: 'POST',
        headers: {
          origin: 'https://evil.example',
        },
        body: {},
      },
      res,
    )

    expect(response.statusCode).toBe(403)
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'invalid_request' },
    })
  })

  it('rejects bad Origin in billing route before config/auth', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STUDYMESH_APP_URL', 'https://app.studymesh.test')
    const { response, res } = makeResponse()

    await hostedAiBillingHandler(
      {
        method: 'POST',
        headers: {
          origin: 'https://evil.example',
        },
        body: {},
      },
      res,
    )

    expect(response.statusCode).toBe(403)
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'invalid_request' },
    })
  })

  it('echoes allowlisted origin for CORS responses', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STUDYMESH_APP_URL', 'https://app.studymesh.test')
    const { headers, res } = makeResponse()

    const result = applyCors(
      {
        headers: {
          origin: 'https://app.studymesh.test/',
        },
      },
      res,
    )

    expect(result.allowed).toBe(true)
    expect(headers.get('access-control-allow-origin')).toBe(
      'https://app.studymesh.test',
    )
  })

  it('uses server app URL for Stripe return destinations', () => {
    vi.stubEnv('STUDYMESH_APP_URL', 'https://app.studymesh.test/')

    expect(getStudyMeshAppUrl()).toBe('https://app.studymesh.test')
  })

  it('uses only server Cerebras model configuration', () => {
    vi.stubEnv('HOSTED_CEREBRAS_MODEL', '')

    expect(getHostedCerebrasModel()).toBe(DEFAULT_CEREBRAS_MODEL)

    vi.stubEnv('HOSTED_CEREBRAS_MODEL', 'server-model')

    expect(getHostedCerebrasModel()).toBe('server-model')
  })

  it('ignores caller supplied hosted AI request ids for usage accounting', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('HOSTED_CEREBRAS_API_KEY', 'hosted-cerebras-key')

    const rpcBodies: Record<string, unknown>[] = []
    const jsonResponse = (payload: unknown, ok = true, status = 200) => ({
      ok,
      status,
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    })
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const target = String(url)

      if (target.includes('/auth/v1/user')) {
        return Promise.resolve(jsonResponse({ id: 'user-1' }))
      }

      if (target.includes('/rest/v1/rpc/hosted_ai_begin_usage')) {
        rpcBodies.push(JSON.parse(String(init?.body)))
        return Promise.resolve(
          jsonResponse({
            status: {
              studyCredits: 8,
              introSeen: true,
            },
          }),
        )
      }

      if (target.includes('/rest/v1/rpc/hosted_ai_finish_usage')) {
        rpcBodies.push(JSON.parse(String(init?.body)))
        return Promise.resolve(
          jsonResponse({
            status: {
              studyCredits: 6,
              introSeen: true,
            },
          }),
        )
      }

      if (target.includes('api.cerebras.ai')) {
        return Promise.resolve(
          jsonResponse({
            choices: [{ message: { content: 'Generated study material.' } }],
          }),
        )
      }

      return Promise.resolve(
        jsonResponse({ message: 'unexpected url' }, false, 500),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const { response, res } = makeResponse()

    await hostedAiHandler(
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer user-token',
        },
        body: {
          action: 'generate',
          requestId: 'client-reused-id',
          surface: 'quick-create',
          parts: [{ text: 'Make flashcards' }],
        },
      },
      res,
    )

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      ok: true,
      text: 'Generated study material.',
    })
    expect(rpcBodies).toHaveLength(2)
    expect(rpcBodies[0].p_request_id).toEqual(rpcBodies[1].p_request_id)
    expect(rpcBodies[0].p_request_id).not.toBe('client-reused-id')
  })
})
