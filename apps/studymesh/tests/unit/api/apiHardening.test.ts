import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyCors, getAllowedOrigins } from '../../../../../api/cors'
import hostedAiBillingHandler, {
  getStudyMeshAppUrl,
} from '../../../../../api/hosted-ai-billing'
import hostedAiHandler, {
  DEFAULT_CEREBRAS_MODEL,
  DEFAULT_OPENAI_FAST_MODEL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_STUDY_GUIDE_MODEL,
  getHostedCerebrasModel,
  getHostedOpenAiModel,
  getHostedOpenAiModelForStage,
  getHostedTextModel,
  getHostedTextProvider,
} from '../../../../../api/hosted-ai'
import dashboardSourceHandler from '../../../../../api/dashboard-source'
import podcastAudioCleanupHandler from '../../../../../api/podcast-audio-cleanup'
import podcastAudioHandler from '../../../../../api/study-guide-podcast-audio'

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

  it('rejects bad Origin in dashboard source route', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STUDYMESH_APP_URL', 'https://app.studymesh.test')
    const { response, res } = makeResponse()

    await dashboardSourceHandler(
      {
        method: 'POST',
        headers: {
          origin: 'https://evil.example',
        },
        body: {
          question: 'What is Ansible?',
          dashboardTitle: 'Infrastructure',
        },
      },
      res,
    )

    expect(response.statusCode).toBe(403)
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'invalid_request' },
    })
  })

  it('requires Tavily configuration for dashboard source search', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TAVILY_API_KEY', '')
    const { response, res } = makeResponse()

    await dashboardSourceHandler(
      {
        method: 'POST',
        headers: {},
        body: {
          question: 'What is Ansible?',
          dashboardTitle: 'Infrastructure',
        },
      },
      res,
    )

    expect(response.statusCode).toBe(500)
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'server_error' },
    })
  })

  it('rejects invalid dashboard source search requests', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TAVILY_API_KEY', 'tavily-key')
    const { response, res } = makeResponse()

    await dashboardSourceHandler(
      {
        method: 'POST',
        headers: {},
        body: { question: '' },
      },
      res,
    )

    expect(response.statusCode).toBe(400)
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'invalid_request' },
    })
  })

  it('returns invalid request when hosted AI receives malformed JSON', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('HOSTED_CEREBRAS_API_KEY', 'hosted-cerebras-key')
    const { response, res } = makeResponse()
    const req = {
      method: 'POST',
      headers: {},
    } as { method: string; headers: Record<string, string>; body?: unknown }
    Object.defineProperty(req, 'body', {
      get() {
        throw new Error('Invalid JSON')
      },
    })

    await hostedAiHandler(req, res)

    expect(response.statusCode).toBe(400)
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'invalid_request' },
    })
  })

  it('returns invalid request when dashboard source receives malformed JSON', async () => {
    const { response, res } = makeResponse()
    const req = {
      method: 'POST',
      headers: {},
    } as { method: string; headers: Record<string, string>; body?: unknown }
    Object.defineProperty(req, 'body', {
      get() {
        throw new Error('Invalid JSON')
      },
    })

    await dashboardSourceHandler(req, res)

    expect(response.statusCode).toBe(400)
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'invalid_request' },
    })
  })

  it('requires auth for dashboard source search in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STUDYMESH_APP_URL', 'https://app.studymesh.test')
    vi.stubEnv('TAVILY_API_KEY', 'tavily-key')
    const { response, res } = makeResponse()

    await dashboardSourceHandler(
      {
        method: 'POST',
        headers: {
          origin: 'https://app.studymesh.test',
        },
        body: {
          question: 'What is Ansible?',
          dashboardTitle: 'Infrastructure',
        },
      },
      res,
    )

    expect(response.statusCode).toBe(401)
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'not_authenticated' },
    })
  })

  it('maps Tavily dashboard source search results into web source text', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TAVILY_API_KEY', 'tavily-key')
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes('/extract')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(
            JSON.stringify({
              results: [
                {
                  title: 'Ansible docs',
                  url: 'https://docs.example/ansible',
                  raw_content:
                    'Ansible automates provisioning and configuration management for repeatable infrastructure work with playbooks and inventories.',
                },
              ],
            }),
          ),
        })
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            results: [
              {
                title: 'Ansible docs',
                url: 'https://docs.example/ansible',
                content: 'Official docs for Ansible automation playbooks.',
                score: 0.84,
                favicon: 'https://docs.example/favicon.ico',
              },
            ],
          }),
        ),
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { response, res } = makeResponse()

    await dashboardSourceHandler(
      {
        method: 'POST',
        headers: {},
        body: {
          question: 'What is Ansible?',
          dashboardTitle: 'Infrastructure',
          contextSummary: 'Provisioning notes',
        },
      },
      res,
    )

    expect(response.statusCode).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"include_raw_content":false'),
      }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.tavily.com/extract',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"extract_depth":"basic"'),
      }),
    )
    expect(fetchMock.mock.calls[0][1]?.body).not.toContain('Provisioning notes')
    expect(response.body).toMatchObject({
      ok: true,
      source: {
        title: 'Ansible docs',
        url: 'https://docs.example/ansible',
        text: expect.stringContaining('Ansible automates provisioning'),
        searchQuery: expect.stringContaining(
          'What is Ansible official overview',
        ),
        score: 0.84,
        favicon: 'https://docs.example/favicon.ico',
      },
    })
  })

  it('prioritizes missing question terms over already-covered context topics', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TAVILY_API_KEY', 'tavily-key')
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('/extract')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(
            JSON.stringify({
              results: [
                {
                  title: 'Ansible and Terraform compared with automation tools',
                  url: 'https://example.test/ansible-terraform',
                  raw_content:
                    'Ansible focuses on configuration management and task automation, while Terraform focuses on declarative infrastructure provisioning. Both can be orchestrated by other automation platforms.',
                },
              ],
            }),
          ),
        })
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            results: [
              {
                title: 'n8n vs Rundeck: Which Automation Tool Wins?',
                url: 'https://example.test/n8n-rundeck',
                content:
                  'n8n and Rundeck are compared here. Ansible is only briefly mentioned as something Rundeck can run.',
                score: 0.95,
              },
              {
                title: 'Ansible and Terraform compared with automation tools',
                url: 'https://example.test/ansible-terraform',
                content:
                  'Ansible focuses on configuration management and task automation, while Terraform focuses on declarative infrastructure provisioning. Both can be orchestrated by other automation platforms.',
                score: 0.75,
              },
            ],
          }),
        ),
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { response, res } = makeResponse()

    await dashboardSourceHandler(
      {
        method: 'POST',
        headers: {},
        body: {
          question:
            'difference between n8n and rundeck vs ansible or terraform',
          dashboardTitle: 'Automation tools',
          contextSummary:
            'n8n is a visual workflow automation tool. Rundeck is an operations job runner.',
        },
      },
      res,
    )

    const searchBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(searchBody).toMatchObject({
      search_depth: 'basic',
      include_raw_content: false,
      include_answer: false,
      include_favicon: true,
    })
    expect(String(searchBody.query).toLowerCase()).toContain('ansible')
    expect(String(searchBody.query).toLowerCase()).toContain('terraform')
    const extractBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body))
    expect(extractBody.urls).toContain('https://example.test/ansible-terraform')
    expect(extractBody.urls.length).toBeLessThanOrEqual(3)
    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      ok: true,
      source: {
        title: 'Ansible and Terraform compared with automation tools',
        url: 'https://example.test/ansible-terraform',
      },
    })
  })

  it('keeps simple definition lookups focused on the requested entity', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TAVILY_API_KEY', 'tavily-key')
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes('/extract')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(
            JSON.stringify({
              results: [
                {
                  title: 'What is AWS?',
                  url: 'https://aws.amazon.com/what-is-aws/',
                  raw_content:
                    'Amazon Web Services is a cloud computing platform with compute, storage, database, networking, analytics, machine learning, and other cloud services.',
                },
              ],
            }),
          ),
        })
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            results: [
              {
                title: 'What is AWS?',
                url: 'https://aws.amazon.com/what-is-aws/',
                content:
                  'Amazon Web Services cloud platform overview and services.',
                score: 0.9,
              },
            ],
          }),
        ),
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { response, res } = makeResponse()

    await dashboardSourceHandler(
      {
        method: 'POST',
        headers: {},
        body: {
          question: 'what is aws',
          dashboardTitle: 'Kubernetes basics',
          contextSummary:
            'Pods, deployments, services, ingress, and Kubernetes cluster components.',
        },
      },
      res,
    )

    const searchBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(String(searchBody.query).toLowerCase()).toContain('what is aws')
    expect(String(searchBody.query).toLowerCase()).not.toContain('kubernetes')
    expect(String(searchBody.query).toLowerCase()).not.toContain('comparison')
    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      ok: true,
      source: {
        title: 'What is AWS?',
        url: 'https://aws.amazon.com/what-is-aws/',
        text: expect.stringContaining('Amazon Web Services'),
      },
    })
  })

  it('returns usable error when Tavily finds no readable source', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TAVILY_API_KEY', 'tavily-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(
            JSON.stringify({
              results: [{ title: 'Thin result', url: 'https://example.test' }],
            }),
          ),
        }),
      ),
    )
    const { response, res } = makeResponse()

    await dashboardSourceHandler(
      {
        method: 'POST',
        headers: {},
        body: {
          question: 'What is Pulumi?',
          dashboardTitle: 'Infrastructure',
        },
      },
      res,
    )

    expect(response.statusCode).toBe(415)
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'unsupported_content' },
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

  it('uses only server OpenAI provider and model configuration', () => {
    vi.stubEnv('HOSTED_AI_TEXT_PROVIDER', 'openai')
    vi.stubEnv('HOSTED_OPENAI_MODEL', '')
    vi.stubEnv('HOSTED_OPENAI_STUDY_GUIDE_MODEL', '')
    vi.stubEnv('HOSTED_OPENAI_FAST_MODEL', '')

    expect(getHostedTextProvider()).toBe('openai')
    expect(getHostedOpenAiModel()).toBe(DEFAULT_OPENAI_MODEL)
    expect(getHostedOpenAiModelForStage('study_guide_main')).toBe(
      DEFAULT_OPENAI_STUDY_GUIDE_MODEL,
    )
    expect(getHostedOpenAiModelForStage('quick_create')).toBe(
      DEFAULT_OPENAI_FAST_MODEL,
    )
    expect(getHostedTextModel(undefined, 'study_guide_main')).toBe(
      DEFAULT_OPENAI_STUDY_GUIDE_MODEL,
    )

    vi.stubEnv('HOSTED_OPENAI_MODEL', 'gpt-5.4-mini-test')

    expect(getHostedTextModel()).toBe('gpt-5.4-mini-test')

    vi.stubEnv('HOSTED_OPENAI_STUDY_GUIDE_MODEL', 'gpt-5.4-mini-stage')
    vi.stubEnv('HOSTED_OPENAI_FAST_MODEL', 'gpt-5.4-nano-stage')

    expect(getHostedTextModel(undefined, 'study_guide_main')).toBe(
      'gpt-5.4-mini-stage',
    )
    expect(getHostedTextModel(undefined, 'quick_create')).toBe(
      'gpt-5.4-nano-stage',
    )
  })

  it('returns missing config when hosted OpenAI key is absent', async () => {
    vi.stubEnv('HOSTED_AI_TEXT_PROVIDER', 'openai')
    vi.stubEnv('HOSTED_OPENAI_API_KEY', '')
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

    const { response, res } = makeResponse()

    await hostedAiHandler(
      {
        method: 'POST',
        headers: {},
        body: { action: 'status' },
      },
      res,
    )

    expect(response.statusCode).toBe(500)
    expect(response.body).toMatchObject({
      ok: false,
      error: {
        code: 'not_configured',
        message:
          'Hosted AI gateway is missing server configuration: HOSTED_OPENAI_API_KEY.',
      },
    })
  })

  it('returns Supabase RPC details for hosted AI database failures', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('HOSTED_CEREBRAS_API_KEY', 'hosted-cerebras-key')

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const target = String(url)

        if (target.includes('/auth/v1/user')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue(JSON.stringify({ id: 'user-1' })),
          })
        }

        if (target.includes('/rest/v1/rpc/hosted_ai_get_or_create_account')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            text: vi
              .fn()
              .mockResolvedValue(
                JSON.stringify({ message: 'relation profiles does not exist' }),
              ),
          })
        }

        return Promise.resolve({
          ok: false,
          status: 500,
          text: vi.fn().mockResolvedValue(JSON.stringify({})),
        })
      }),
    )

    const { response, res } = makeResponse()

    await hostedAiHandler(
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer user-token',
        },
        body: {
          action: 'status',
        },
      },
      res,
    )

    expect(response.statusCode).toBe(500)
    expect(response.body).toMatchObject({
      ok: false,
      error: {
        code: 'server_error',
        message: 'Hosted AI database error: relation profiles does not exist',
      },
    })
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

  it('routes hosted generation through OpenAI with strict JSON schema', async () => {
    vi.stubEnv('HOSTED_AI_TEXT_PROVIDER', 'openai')
    vi.stubEnv('HOSTED_OPENAI_API_KEY', 'hosted-openai-key')
    vi.stubEnv('HOSTED_OPENAI_MODEL', 'gpt-5.4-mini')
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

    const rpcBodies: Record<string, unknown>[] = []
    const providerBodies: Record<string, unknown>[] = []
    const providerHeaders: HeadersInit[] = []
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
              studyCredits: 7,
              introSeen: true,
            },
          }),
        )
      }

      if (target.includes('api.openai.com/v1/chat/completions')) {
        providerBodies.push(JSON.parse(String(init?.body)))
        providerHeaders.push(init?.headers || {})
        return Promise.resolve(
          jsonResponse({
            choices: [
              {
                message: {
                  content: '{"title":"OpenAI generated material"}',
                },
              },
            ],
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
          authorization: 'Bearer [REDACTED:Bearer token]',
        },
        body: {
          action: 'generate',
          surface: 'quick-create',
          parts: [{ text: 'Make a quiz' }],
          responseSchema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              supportArtifacts: {
                type: 'object',
                properties: {
                  contrastTable: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      headers: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                      rows: {
                        type: 'array',
                        items: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                      },
                    },
                    required: ['headers', 'rows'],
                  },
                },
                required: ['contrastTable'],
              },
            },
            required: ['title'],
          },
        },
      },
      res,
    )

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      ok: true,
      text: '{"title":"OpenAI generated material"}',
    })
    expect(rpcBodies[0]).toMatchObject({
      p_provider: 'openai',
      p_model: 'openai:gpt-5.4-mini',
    })
    expect(providerHeaders[0]).toMatchObject({
      authorization: 'Bearer hosted-openai-key',
    })
    expect(providerBodies[0]).toMatchObject({
      model: 'gpt-5.4-mini',
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'studymesh_response',
          strict: true,
        },
      },
    })
    expect(
      (providerBodies[0].response_format as Record<string, unknown>)
        .json_schema,
    ).toMatchObject({
      schema: {
        type: 'object',
        required: ['title', 'supportArtifacts'],
        additionalProperties: false,
      },
    })
    const schema = (
      (providerBodies[0].response_format as Record<string, unknown>)
        .json_schema as Record<string, unknown>
    ).schema as {
      properties: {
        supportArtifacts: {
          properties: {
            contrastTable: {
              required: string[]
            }
          }
        }
      }
    }
    expect(
      schema.properties.supportArtifacts.properties.contrastTable.required,
    ).toEqual(['title', 'headers', 'rows'])
  })

  it('stores OpenAI per-stage usage costs and routes Study Guide stages by model', async () => {
    vi.stubEnv('HOSTED_AI_TEXT_PROVIDER', 'openai')
    vi.stubEnv('HOSTED_OPENAI_API_KEY', 'hosted-openai-key')
    vi.stubEnv('HOSTED_OPENAI_STUDY_GUIDE_MODEL', 'gpt-5.4-mini-route')
    vi.stubEnv('HOSTED_OPENAI_FAST_MODEL', 'gpt-5.4-nano-route')
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

    const rpcBodies: Record<string, unknown>[] = []
    const providerBodies: Record<string, unknown>[] = []
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
        return Promise.resolve(jsonResponse({ status: { studyCredits: 8 } }))
      }

      if (target.includes('/rest/v1/rpc/hosted_ai_finish_usage')) {
        rpcBodies.push(JSON.parse(String(init?.body)))
        return Promise.resolve(jsonResponse({ status: { studyCredits: 6 } }))
      }

      if (target.includes('api.openai.com/v1/chat/completions')) {
        const body = JSON.parse(String(init?.body))
        providerBodies.push(body)
        const prompt = String(body.messages?.[0]?.content || '')

        if (prompt.includes('Choose whether any known topic')) {
          return Promise.resolve(
            jsonResponse({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      shouldUseKnownTopic: true,
                      knownTopicsForQuickStart: ['Algebra'],
                      knownTopicRelevanceReason: 'Algebra helps.',
                      targetTopicType: 'general',
                      bridgeStrength: 'strong',
                      bridgeStrategy: 'direct_comparison',
                    }),
                  },
                },
              ],
              usage: {
                prompt_tokens: 200,
                completion_tokens: 50,
                total_tokens: 250,
              },
            }),
          )
        }

        if (
          prompt.includes(
            'Create optional knowledge-context bridge note blocks',
          )
        ) {
          return Promise.resolve(
            jsonResponse({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      blocks: [
                        {
                          dashboardIndex: 1,
                          title: 'Algebra bridge',
                          body: 'Algebraic structure helps organize the new idea.',
                        },
                      ],
                    }),
                  },
                },
              ],
              usage: {
                prompt_tokens: 300,
                completion_tokens: 100,
                total_tokens: 400,
                prompt_tokens_details: { cached_tokens: 25 },
              },
            }),
          )
        }

        return Promise.resolve(
          jsonResponse({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: 'Guide',
                    folderName: 'Guide',
                    quickStart: {
                      keyIdea: 'Main guide includes the quick start.',
                      quickSummary:
                        'Start with the main idea.\n\nThen use the pages in order.',
                    },
                    dashboards: [
                      {
                        title: '01 - Map',
                        summary: 'Map preview.',
                        rawNotes: 'First page notes teach the map.',
                        dashboardRole: 'normal',
                        practiceType: 'none',
                      },
                      {
                        title: '02 - Apply',
                        summary: 'Apply preview.',
                        rawNotes: 'Second page notes apply the idea.',
                        dashboardRole: 'normal',
                        practiceType: 'none',
                      },
                    ],
                  }),
                },
              },
            ],
            usage: {
              prompt_tokens: 1000,
              completion_tokens: 500,
              total_tokens: 1500,
              prompt_tokens_details: { cached_tokens: 100 },
            },
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
        headers: { authorization: 'Bearer user-token' },
        body: {
          action: 'generateWithQuickStart',
          surface: 'study-guide',
          parts: [{ text: 'Create study guide' }],
          quickStartOptions: { userKnownTopics: ['Algebra'] },
        },
      },
      res,
    )

    expect(response.statusCode).toBe(200)
    expect(providerBodies.map((body) => body.model)).toEqual([
      'gpt-5.4-mini-route',
      'gpt-5.4-nano-route',
      'gpt-5.4-nano-route',
    ])
    expect(rpcBodies[0]).toMatchObject({
      p_provider: 'openai',
      p_model: 'openai:gpt-5.4-mini-route',
    })
    expect(rpcBodies[1].p_provider_call_count).toBe(3)
    expect(rpcBodies[1].p_metadata).toMatchObject({
      estimatedCostUsdTotal: expect.any(Number),
      stageCosts: [
        expect.objectContaining({
          stage: 'study_guide_main',
          model: 'gpt-5.4-mini-route',
          inputTokens: 1000,
          cachedInputTokens: 100,
          outputTokens: 500,
        }),
        expect.objectContaining({
          stage: 'quick_start_relevance_auto',
          model: 'gpt-5.4-nano-route',
          inputTokens: 200,
          outputTokens: 50,
        }),
        expect.objectContaining({
          stage: 'knowledge_bridge_blocks',
          model: 'gpt-5.4-nano-route',
          inputTokens: 300,
          cachedInputTokens: 25,
          outputTokens: 100,
        }),
      ],
    })
    expect(
      Number(
        (rpcBodies[1].p_metadata as { estimatedCostUsdTotal: number })
          .estimatedCostUsdTotal,
      ),
    ).toBeGreaterThan(0)
  })

  it('maps OpenAI rate limits to hosted rate_limited errors', async () => {
    vi.stubEnv('HOSTED_AI_TEXT_PROVIDER', 'openai')
    vi.stubEnv('HOSTED_OPENAI_API_KEY', 'hosted-openai-key')
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

    const jsonResponse = (payload: unknown, ok = true, status = 200) => ({
      ok,
      status,
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    })
    const fetchMock = vi.fn((url: string) => {
      const target = String(url)

      if (target.includes('/auth/v1/user')) {
        return Promise.resolve(jsonResponse({ id: 'user-1' }))
      }

      if (target.includes('/rest/v1/rpc/hosted_ai_begin_usage')) {
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
        return Promise.resolve(jsonResponse({}))
      }

      if (target.includes('api.openai.com/v1/chat/completions')) {
        return Promise.resolve(
          jsonResponse(
            {
              error: {
                message: 'Rate limit reached for requests.',
              },
            },
            false,
            429,
          ),
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
          authorization: 'Bearer [REDACTED:Bearer token]',
        },
        body: {
          action: 'generate',
          surface: 'quick-create',
          parts: [{ text: 'Make a quiz' }],
        },
      },
      res,
    )

    expect(response.statusCode).toBe(429)
    expect(response.body).toMatchObject({
      ok: false,
      error: {
        code: 'rate_limited',
        message: 'Rate limit reached for requests.',
      },
    })
  })

  it('generates hosted podcasts through Cerebras, Unreal Speech, and Supabase Storage', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('HOSTED_CEREBRAS_API_KEY', 'hosted-cerebras-key')
    vi.stubEnv('UNREAL_SPEECH_API_KEY', 'unreal-key')
    vi.stubEnv('UNREAL_SPEECH_HOST_A_VOICE_ID', 'Sierra')

    const rpcBodies: Record<string, unknown>[] = []
    const monthlyUsageBodies: Record<string, unknown>[] = []
    const providerBodies: Record<string, unknown>[] = []
    const unrealRequests: Array<{
      body: Record<string, unknown>
      headers?: HeadersInit
    }> = []
    const storageUploads: Array<{
      url: string
      body?: BodyInit | null
      headers?: HeadersInit
    }> = []
    const expectedTurnTexts = [
      'La fotosíntesis convierte la luz en energía utilizable.',
      'El ATP ayuda a las células a mover esa energía.',
      'La idea clave es la conversión de energía.',
      'Eso conecta toda la lección.',
    ]
    const jsonResponse = (payload: unknown, ok = true, status = 200) => ({
      ok,
      status,
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
      arrayBuffer: vi
        .fn()
        .mockResolvedValue(new TextEncoder().encode('ID3mp3').buffer),
    })
    const audioResponse = (bytes: number[]) => {
      const buffer = Uint8Array.from(bytes)

      return {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}'),
        arrayBuffer: vi.fn().mockResolvedValue(buffer.buffer),
      }
    }
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const target = String(url)

      if (target.includes('/auth/v1/user')) {
        return Promise.resolve(jsonResponse({ id: 'user-1' }))
      }

      if (target.includes('/rest/v1/hosted_ai_usage_events')) {
        return Promise.resolve(jsonResponse([]))
      }

      if (target.includes('/rest/v1/rpc/hosted_ai_begin_usage')) {
        rpcBodies.push(JSON.parse(String(init?.body)))
        return Promise.resolve(
          jsonResponse({
            status: {
              studyCredits: 9,
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
              studyCredits: 8,
              introSeen: true,
            },
          }),
        )
      }

      if (target.includes('/rest/v1/rpc/podcast_tts_reserve_monthly_usage')) {
        monthlyUsageBodies.push(JSON.parse(String(init?.body)))
        return Promise.resolve(
          jsonResponse([
            {
              owner_id: 'user-1',
              usage_month: '2026-07',
              characters_used: 240,
              monthly_cap: 225000,
            },
          ]),
        )
      }

      if (target.includes('/rest/v1/rpc/podcast_audio_register')) {
        rpcBodies.push(JSON.parse(String(init?.body)))
        return Promise.resolve(jsonResponse(null))
      }

      if (target.includes('/rest/v1/podcast_audio_objects')) {
        return Promise.resolve(jsonResponse([]))
      }

      if (target.includes('api.cerebras.ai')) {
        providerBodies.push(JSON.parse(String(init?.body)))
        const transcriptTurns =
          providerBodies.length === 1
            ? [
                {
                  speaker: 'hostA',
                  text: 'A fotossíntese transforma luz em energia utilizável.',
                },
                {
                  speaker: 'hostB',
                  text: 'O ATP ajuda as células a mover essa energia.',
                },
                {
                  speaker: 'hostA',
                  text: 'A ideia principal é a conversão de energia.',
                },
                {
                  speaker: 'hostB',
                  text: 'Isso conecta toda a lição.',
                },
              ]
            : [
                {
                  speaker: 'hostA',
                  text: 'La fotosíntesis convierte la luz en energía utilizable.',
                },
                {
                  speaker: 'hostB',
                  text: 'El ATP ayuda a las células a mover esa energía.',
                },
                {
                  speaker: 'hostA',
                  text: 'La idea clave es la conversión de energía.',
                },
                {
                  speaker: 'hostB',
                  text: 'Eso conecta toda la lección.',
                },
              ]
        return Promise.resolve(
          jsonResponse({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: 'Podcast: Biology',
                    description: 'A short recap.',
                    transcriptTurns,
                    chapters: [{ title: 'Energy', startTurn: 0 }],
                  }),
                },
              },
            ],
          }),
        )
      }

      if (target === 'https://api.v8.unrealspeech.com/synthesisTasks') {
        const requestNumber = unrealRequests.length + 1
        unrealRequests.push({
          body: JSON.parse(String(init?.body)),
          headers: init?.headers,
        })
        return Promise.resolve(
          jsonResponse({
            SynthesisTask: {
              TaskId: `task-${requestNumber}`,
              OutputUri: `https://audio.unrealspeech.test/segment-${requestNumber}.mp3`,
            },
          }),
        )
      }

      if (target.startsWith('https://audio.unrealspeech.test/segment-')) {
        const segment = Number(target.match(/segment-(\d+)\.mp3/)?.[1] || '0')
        return Promise.resolve(audioResponse([0xff, 0xfb, segment]))
      }

      if (target.includes('/storage/v1/object/study-guide-podcasts/')) {
        storageUploads.push({
          url: target,
          body: init?.body,
          headers: init?.headers,
        })
        return Promise.resolve(jsonResponse({ Key: 'podcast.mp3' }))
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
          authorization: 'Bearer [REDACTED:Bearer token]',
        },
        body: {
          action: 'generatePodcast',
          surface: 'podcast',
          outputLanguage: 'es',
          parts: [
            {
              text: 'Photosynthesis uses light to create usable energy for plants. ATP stores energy for cells. '.repeat(
                8,
              ),
            },
          ],
          podcastOptions: {
            studyGuideId: 'guide-1',
            sourceTitle: 'Biology',
            sourceScope: 'studyGuide',
          },
        },
      },
      res,
    )

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      ok: true,
      podcast: {
        title: 'Podcast: Biology',
        audioPath: expect.stringContaining('user-1/guide-1/'),
      },
    })
    expect(rpcBodies[0]).toMatchObject({
      p_surface: 'podcast',
      p_provider: 'cerebras',
    })
    expect(rpcBodies[1]).toMatchObject({
      p_audio_path: expect.stringContaining('user-1/guide-1/'),
      p_keep_count: 5,
    })
    expect(rpcBodies[2]).toMatchObject({
      p_status: 'succeeded',
      p_provider_call_count: 6,
    })
    expect(providerBodies).toHaveLength(2)
    expect(JSON.stringify(providerBodies[0])).toContain(
      'Output language: Spanish',
    )
    expect(JSON.stringify(providerBodies[1])).toContain(
      'previous podcast script was rejected',
    )
    expect(monthlyUsageBodies).toHaveLength(1)
    expect(monthlyUsageBodies[0]).toMatchObject({
      p_owner_id: 'user-1',
      p_character_count: expectedTurnTexts.join('').length,
      p_monthly_cap: 225000,
    })
    expect(unrealRequests).toHaveLength(4)
    expect(unrealRequests.map((request) => request.body.Text)).toEqual(
      expectedTurnTexts,
    )
    expect(unrealRequests.map((request) => request.body.VoiceId)).toEqual([
      'ef_dora',
      'em_alex',
      'ef_dora',
      'em_alex',
    ])
    expect(
      unrealRequests.every((request) => request.body.Bitrate === '64k'),
    ).toBe(true)
    expect(
      unrealRequests.every(
        (request) => !String(request.body.Text).includes('Host '),
      ),
    ).toBe(true)
    expect(
      (unrealRequests[0].headers as Record<string, string>).authorization,
    ).toBe('Bearer unreal-key')
    expect(storageUploads).toHaveLength(1)
    expect(storageUploads[0].url).toContain('user-1/guide-1/')
    expect(Buffer.from(storageUploads[0].body as Buffer)).toEqual(
      Buffer.from([0xff, 0xfb, 1, 0xff, 0xfb, 2, 0xff, 0xfb, 3, 0xff, 0xfb, 4]),
    )
    expect(
      (storageUploads[0].headers as Record<string, string>)['x-upsert'],
    ).toBe('true')
    expect(
      (storageUploads[0].headers as Record<string, string>)['content-type'],
    ).toBe('audio/mpeg')
  })

  it('refuses hosted podcast TTS before Unreal Speech when the monthly free cap is reached', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('HOSTED_CEREBRAS_API_KEY', 'hosted-cerebras-key')
    vi.stubEnv('UNREAL_SPEECH_API_KEY', 'unreal-key')

    const rpcBodies: Record<string, unknown>[] = []
    const providerBodies: Record<string, unknown>[] = []
    const jsonResponse = (payload: unknown, ok = true, status = 200) => ({
      ok,
      status,
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
      arrayBuffer: vi
        .fn()
        .mockResolvedValue(new TextEncoder().encode('ID3mp3').buffer),
    })
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const target = String(url)

      if (target.includes('/auth/v1/user')) {
        return Promise.resolve(jsonResponse({ id: 'user-1' }))
      }

      if (target.includes('/rest/v1/hosted_ai_usage_events')) {
        return Promise.resolve(jsonResponse([]))
      }

      if (target.includes('/rest/v1/rpc/hosted_ai_begin_usage')) {
        rpcBodies.push(JSON.parse(String(init?.body)))
        return Promise.resolve(
          jsonResponse({
            status: {
              studyCredits: 9,
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
              studyCredits: 9,
              introSeen: true,
            },
          }),
        )
      }

      if (target.includes('/rest/v1/rpc/podcast_tts_reserve_monthly_usage')) {
        return Promise.resolve(
          jsonResponse(
            { message: 'Monthly free podcast audio limit reached.' },
            false,
            429,
          ),
        )
      }

      if (target.includes('api.cerebras.ai')) {
        providerBodies.push(JSON.parse(String(init?.body)))
        return Promise.resolve(
          jsonResponse({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: 'Podcast: Biology',
                    description: 'A short recap.',
                    transcriptTurns: [
                      {
                        speaker: 'hostA',
                        text: 'Photosynthesis turns light into usable energy.',
                      },
                      {
                        speaker: 'hostB',
                        text: 'ATP helps cells move that energy around.',
                      },
                      {
                        speaker: 'hostA',
                        text: 'The key idea is energy conversion.',
                      },
                      {
                        speaker: 'hostB',
                        text: 'That connects the lesson together.',
                      },
                    ],
                    chapters: [{ title: 'Energy', startTurn: 0 }],
                  }),
                },
              },
            ],
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
          authorization: 'Bearer [REDACTED:Bearer token]',
        },
        body: {
          action: 'generatePodcast',
          surface: 'podcast',
          parts: [
            {
              text: 'Photosynthesis uses light to create usable energy for plants. ATP stores energy for cells. '.repeat(
                8,
              ),
            },
          ],
          podcastOptions: {
            studyGuideId: 'guide-1',
            sourceTitle: 'Biology',
            sourceScope: 'studyGuide',
          },
        },
      },
      res,
    )

    expect(response.statusCode).toBe(429)
    expect(response.body).toMatchObject({
      ok: false,
      error: {
        code: 'rate_limited',
        message: 'Monthly free podcast audio limit reached.',
      },
    })
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('api.v8.unrealspeech.com'),
      ),
    ).toBe(false)
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('/storage/v1/object/'),
      ),
    ).toBe(false)
    expect(providerBodies).toHaveLength(1)
    expect(rpcBodies[1]).toMatchObject({
      p_status: 'failed',
      p_error_code: 'rate_limited',
      p_error_message: 'Monthly free podcast audio limit reached.',
    })
  })

  it('returns a playable Supabase Storage signed URL for podcast audio', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

    const jsonResponse = (payload: unknown, ok = true, status = 200) => ({
      ok,
      status,
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    })
    const fetchMock = vi.fn((url: string) => {
      const target = String(url)

      if (target.includes('/auth/v1/user')) {
        return Promise.resolve(jsonResponse({ id: 'user-1' }))
      }

      if (target.includes('/rest/v1/podcast_audio_objects')) {
        return Promise.resolve(jsonResponse([]))
      }

      if (
        target.includes(
          '/storage/v1/object/sign/study-guide-podcasts/user-1/guide-1/podcast.mp3',
        )
      ) {
        return Promise.resolve(
          jsonResponse({
            signedURL:
              '/object/sign/study-guide-podcasts/user-1/guide-1/podcast.mp3?token=signed-token',
          }),
        )
      }

      return Promise.resolve(
        jsonResponse({ message: 'unexpected url' }, false, 500),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const { response, res } = makeResponse()

    await podcastAudioHandler(
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer [REDACTED:Bearer token]',
        },
        body: {
          audioPath: 'user-1/guide-1/podcast.mp3',
        },
      },
      res,
    )

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      ok: true,
      signedUrl:
        'https://supabase.test/storage/v1/object/sign/study-guide-podcasts/user-1/guide-1/podcast.mp3?token=signed-token',
    })
  })

  it('reports expired podcast audio without deleting the transcript page', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

    const jsonResponse = (payload: unknown, ok = true, status = 200) => ({
      ok,
      status,
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    })
    const fetchMock = vi.fn((url: string) => {
      const target = String(url)

      if (target.includes('/auth/v1/user')) {
        return Promise.resolve(jsonResponse({ id: 'user-1' }))
      }

      if (target.includes('/rest/v1/podcast_audio_objects')) {
        return Promise.resolve(
          jsonResponse([{ deleted_at: '2026-07-03T18:00:00.000Z' }]),
        )
      }

      return Promise.resolve(
        jsonResponse({ message: 'unexpected url' }, false, 500),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const { response, res } = makeResponse()

    await podcastAudioHandler(
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer [REDACTED:Bearer token]',
        },
        body: {
          audioPath: 'user-1/guide-1/podcast.mp3',
        },
      },
      res,
    )

    expect(response.statusCode).toBe(410)
    expect(response.body).toMatchObject({
      ok: false,
      error: {
        code: 'expired',
        message: 'Audio expired, regenerate podcast.',
      },
    })
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/storage/v1/object/sign/'),
      expect.anything(),
    )
  })

  it('requires bearer auth for scheduled podcast audio cleanup', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    const { response, res } = makeResponse()

    await podcastAudioCleanupHandler(
      {
        method: 'GET',
        headers: {},
      },
      res,
    )

    expect(response.statusCode).toBe(401)
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'not_authorized' },
    })
  })

  it('deletes expired Study Guides before recomputing podcast cleanup', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

    const rpcCalls: string[] = []
    const storageDeleteBodies: unknown[] = []
    const markDeletedBodies: unknown[] = []
    const deletedStudyGuideUrls: string[] = []
    let studyGuideQueryCount = 0
    let podcastQueryCount = 0
    const jsonResponse = (payload: unknown, ok = true, status = 200) => ({
      ok,
      status,
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    })
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const target = String(url)

      if (
        target.includes(
          '/rest/v1/rpc/study_guides_refresh_retention_candidates',
        )
      ) {
        rpcCalls.push('study-guides-refresh')
        expect(JSON.parse(String(init?.body))).toEqual({ p_keep_count: 50 })
        return Promise.resolve(jsonResponse({}))
      }

      if (
        target.includes(
          '/rest/v1/rpc/podcast_audio_refresh_retention_candidates',
        )
      ) {
        rpcCalls.push('podcast-audio-refresh')
        expect(JSON.parse(String(init?.body))).toEqual({ p_keep_count: 5 })
        return Promise.resolve(jsonResponse({}))
      }

      if (target.includes('/rest/v1/user_study_guides')) {
        if (init?.method === 'DELETE') {
          deletedStudyGuideUrls.push(target)
          return Promise.resolve(jsonResponse({}))
        }

        studyGuideQueryCount += 1
        expect(target).toContain(
          'order=retention_candidate_at.asc%2Ccreated_at.asc',
        )
        return Promise.resolve(
          jsonResponse(
            studyGuideQueryCount === 1
              ? [
                  {
                    owner_id: 'user-1',
                    id: 'guide-old',
                    study_path: {
                      dashboards: [
                        {
                          layout: {
                            config: {
                              customProps: {
                                components: [
                                  {
                                    type: 'PodcastBlock',
                                    props: {
                                      podcast: {
                                        audioPath:
                                          'user-1/guide-old/podcast-from-guide.mp3',
                                      },
                                    },
                                  },
                                  {
                                    type: 'PodcastBlock',
                                    props: {
                                      podcast: {
                                        audioPath:
                                          'other-user/guide-old/not-owned.mp3',
                                      },
                                    },
                                  },
                                ],
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                ]
              : [],
          ),
        )
      }

      if (target.includes('/rest/v1/podcast_audio_objects')) {
        podcastQueryCount += 1
        expect(target).toContain('order=candidate_at.asc%2Ccreated_at.asc')
        return Promise.resolve(
          jsonResponse(
            podcastQueryCount === 1
              ? [
                  {
                    owner_id: 'user-1',
                    audio_path: 'user-1/podcast-only/podcast-old.mp3',
                  },
                ]
              : [],
          ),
        )
      }

      if (target.includes('/storage/v1/object/study-guide-podcasts')) {
        storageDeleteBodies.push(JSON.parse(String(init?.body)))
        return Promise.resolve(jsonResponse([]))
      }

      if (target.includes('/rest/v1/rpc/podcast_audio_mark_deleted')) {
        markDeletedBodies.push(JSON.parse(String(init?.body)))
        return Promise.resolve(jsonResponse({}))
      }

      return Promise.resolve(
        jsonResponse({ message: 'unexpected url' }, false, 500),
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const { response, res } = makeResponse()

    await podcastAudioCleanupHandler(
      {
        method: 'GET',
        headers: {
          authorization: 'Bearer cron-secret',
        },
      },
      res,
    )

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      ok: true,
      deletedCount: 3,
      deletedStudyGuideCount: 1,
      deletedStudyGuidePodcastAudioCount: 1,
      deletedPodcastAudioCount: 1,
    })
    expect(rpcCalls).toEqual(['study-guides-refresh', 'podcast-audio-refresh'])
    expect(storageDeleteBodies).toEqual([
      {
        prefixes: ['user-1/guide-old/podcast-from-guide.mp3'],
      },
      {
        prefixes: ['user-1/podcast-only/podcast-old.mp3'],
      },
    ])
    expect(markDeletedBodies).toEqual([
      {
        p_owner_id: 'user-1',
        p_audio_path: 'user-1/guide-old/podcast-from-guide.mp3',
        p_deleted_reason: 'study-guide-expired',
      },
      {
        p_owner_id: 'user-1',
        p_audio_path: 'user-1/podcast-only/podcast-old.mp3',
        p_deleted_reason: 'expired',
      },
    ])
    expect(deletedStudyGuideUrls).toHaveLength(1)
    expect(deletedStudyGuideUrls[0]).toContain('owner_id=eq.user-1')
    expect(deletedStudyGuideUrls[0]).toContain('id=eq.guide-old')
  })

  it('bundles hosted Study Guide Quick Start into one usage charge', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('HOSTED_CEREBRAS_API_KEY', 'hosted-cerebras-key')

    const rpcBodies: Record<string, unknown>[] = []
    const providerBodies: Record<string, unknown>[] = []
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
        providerBodies.push(JSON.parse(String(init?.body)))
        return Promise.resolve(
          jsonResponse({
            choices: [
              {
                message: {
                  content:
                    providerBodies.length === 1
                      ? JSON.stringify({
                          title: 'Guide',
                          folderName: 'Guide',
                          quickStart: {
                            keyIdea:
                              'Backend gives a useful short mental model.',
                            quickSummary:
                              'First short paragraph.\n\nSecond short paragraph with one caveat.',
                          },
                          dashboards: [
                            {
                              title: '01 - Backend flow',
                              summary: 'Backend flow preview.',
                              rawNotes:
                                'Backend systems receive requests and coordinate durable work.',
                              dashboardRole: 'normal',
                              practiceType: 'none',
                            },
                            {
                              title: '02 - Backend durability',
                              summary: 'Backend durability preview.',
                              rawNotes:
                                'Backend systems can coordinate durable asynchronous work.',
                              dashboardRole: 'normal',
                              practiceType: 'none',
                            },
                          ],
                        })
                      : providerBodies.length === 2
                        ? JSON.stringify({
                            shouldUseKnownTopic: true,
                            knownTopicsForQuickStart: ['Backend'],
                            knownTopicRelevanceReason:
                              'Backend is the useful bridge.',
                            targetTopicType: 'technical',
                            bridgeStrength: 'strong',
                            bridgeStrategy: 'direct_comparison',
                          })
                        : JSON.stringify({
                            blocks: [
                              {
                                dashboardIndex: 1,
                                title: 'Backend bridge',
                                body: 'Backend request flow is a useful comparison, but Kafka-style durability changes the shape.',
                              },
                            ],
                          }),
                },
              },
            ],
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
          action: 'generateWithQuickStart',
          surface: 'study-guide',
          parts: [{ text: 'Create study guide' }],
          quickStartOptions: {
            userKnownTopics: ['Backend', 'Databases'],
          },
        },
      },
      res,
    )

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      ok: true,
      text: expect.any(String),
      quickStart: {
        keyIdea: 'Backend gives a useful short mental model.',
        quickSummary:
          'First short paragraph.\n\nSecond short paragraph with one caveat.',
      },
      bridgeBlocks: [
        {
          dashboardIndex: 1,
          title: 'Backend bridge',
          body: 'Backend request flow is a useful comparison, but Kafka-style durability changes the shape.',
        },
      ],
    })
    expect(response.body.quickStart).not.toHaveProperty('forcedBridge')
    expect(providerBodies).toHaveLength(3)
    expect(JSON.stringify(providerBodies[1])).toContain(
      'Known topics, strongest first: Backend, Databases',
    )
    expect(JSON.stringify(providerBodies[1])).toContain('Bridge mode: auto')
    expect(JSON.stringify(providerBodies[2])).not.toContain(
      'Candidate known topic bridge(s): Backend, Databases',
    )
    expect(JSON.stringify(providerBodies)).not.toContain('Bridge mode: force')
    expect(JSON.stringify(providerBodies[2])).toContain(
      'Create optional knowledge-context bridge note blocks',
    )
    expect(JSON.stringify(providerBodies[2])).toContain('dashboardIndex: 1')
    expect(JSON.stringify(providerBodies[2])).not.toContain('dashboardIndex: 0')
    expect(rpcBodies).toHaveLength(2)
    expect(rpcBodies[0].p_metadata).toMatchObject({ requestedCredits: 2 })
    expect(rpcBodies[1].p_provider_call_count).toBe(3)
  })

  it('keeps hosted forced Quick Start bridge when auto relevance finds no useful topic', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('HOSTED_CEREBRAS_API_KEY', 'hosted-cerebras-key')

    const rpcBodies: Record<string, unknown>[] = []
    const providerBodies: Record<string, unknown>[] = []
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
        return Promise.resolve(jsonResponse({ status: { studyCredits: 8 } }))
      }

      if (target.includes('/rest/v1/rpc/hosted_ai_finish_usage')) {
        rpcBodies.push(JSON.parse(String(init?.body)))
        return Promise.resolve(jsonResponse({ status: { studyCredits: 6 } }))
      }

      if (target.includes('api.cerebras.ai')) {
        providerBodies.push(JSON.parse(String(init?.body)))
        const prompt = String(
          (
            JSON.parse(String(init?.body)).messages as Array<{
              content: string
            }>
          )[0].content,
        )
        if (prompt.includes('Bridge mode: auto')) {
          return Promise.resolve(
            jsonResponse({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      shouldUseKnownTopic: false,
                      knownTopicsForQuickStart: [],
                      knownTopicRelevanceReason: 'No strong bridge.',
                      targetTopicType: 'technical',
                      bridgeStrength: 'none',
                      bridgeStrategy: 'none',
                    }),
                  },
                },
              ],
            }),
          )
        }

        if (prompt.includes('Bridge mode: force')) {
          return Promise.resolve(
            jsonResponse({
              choices: [
                {
                  message: {
                    content: prompt.includes('keyIdea')
                      ? JSON.stringify({
                          keyIdea: 'Use Kubernetes as a loose mental bridge.',
                          quickSummary:
                            'Kubernetes organizes running systems.\n\nThis topic uses a different layer, but the control idea helps.',
                        })
                      : JSON.stringify({
                          shouldUseKnownTopic: true,
                          knownTopicsForQuickStart: ['Kubernetes'],
                          knownTopicRelevanceReason: 'Closest useful bridge.',
                          targetTopicType: 'technical',
                          bridgeStrength: 'weak',
                          bridgeStrategy: 'light_reference',
                        }),
                  },
                },
              ],
            }),
          )
        }

        return Promise.resolve(
          jsonResponse({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: 'Guide',
                    folderName: 'Guide',
                    quickStart: {
                      keyIdea: 'Neutral key idea.',
                      quickSummary: 'First paragraph.\n\nSecond paragraph.',
                    },
                    dashboards: [
                      {
                        title: '01 - Map',
                        summary: 'Map preview.',
                        rawNotes: 'Map notes.',
                        dashboardRole: 'normal',
                        practiceType: 'none',
                      },
                    ],
                  }),
                },
              },
            ],
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
        headers: { authorization: 'Bearer user-token' },
        body: {
          action: 'generateWithQuickStart',
          surface: 'study-guide',
          parts: [{ text: 'Create study guide' }],
          quickStartOptions: { userKnownTopics: ['Kubernetes'] },
        },
      },
      res,
    )

    expect(response.statusCode).toBe(200)
    expect(response.body.quickStart).toMatchObject({
      keyIdea: 'Neutral key idea.',
      forcedBridge: {
        keyIdea: 'Use Kubernetes as a loose mental bridge.',
      },
    })
    expect(providerBodies).toHaveLength(4)
    expect(JSON.stringify(providerBodies[2])).toContain('Bridge mode: force')
    expect(JSON.stringify(providerBodies[3])).toContain('Bridge mode: force')
    expect(rpcBodies[1].p_provider_call_count).toBe(4)
    expect(rpcBodies[1].p_metadata).toMatchObject({
      stageCosts: expect.arrayContaining([
        expect.objectContaining({ stage: 'quick_start_relevance_force' }),
        expect.objectContaining({ stage: 'quick_start_forced_bridge' }),
      ]),
    })
  })

  it('maps hosted Study Guide risky retry guard to rate limit before provider call', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('HOSTED_CEREBRAS_API_KEY', 'hosted-cerebras-key')

    const fetchMock = vi.fn((url: string) => {
      const target = String(url)

      if (target.includes('/auth/v1/user')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(JSON.stringify({ id: 'user-1' })),
        })
      }

      if (target.includes('/rest/v1/rpc/hosted_ai_begin_usage')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          text: vi.fn().mockResolvedValue(
            JSON.stringify({
              message:
                'Hosted Study Guide retry limit reached. Try again later.',
            }),
          ),
        })
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify({})),
      })
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
          action: 'generateWithQuickStart',
          surface: 'study-guide',
          parts: [{ text: 'Create study guide' }],
        },
      },
      res,
    )

    expect(response.statusCode).toBe(429)
    expect(response.body).toMatchObject({
      ok: false,
      error: {
        code: 'rate_limited',
        message: 'Hosted Study Guide retry limit reached. Try again later.',
      },
    })
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('cerebras.ai')),
    ).toBe(false)
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('/rest/v1/rpc/hosted_ai_finish_usage'),
      ),
    ).toBe(false)
  })
})
