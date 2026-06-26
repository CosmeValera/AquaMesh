import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyCors, getAllowedOrigins } from '../../../../../api/cors'
import hostedAiBillingHandler, {
  getStudyMeshAppUrl,
} from '../../../../../api/hosted-ai-billing'
import hostedAiHandler, {
  DEFAULT_CEREBRAS_MODEL,
  getHostedCerebrasModel,
} from '../../../../../api/hosted-ai'
import dashboardSourceHandler from '../../../../../api/dashboard-source'

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
                      ? '{"title":"Guide","dashboards":[]}'
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
                            keyIdea:
                              'Backend gives a useful short mental model.',
                            quickSummary:
                              'First short paragraph.\n\nSecond short paragraph with one caveat.',
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
      text: '{"title":"Guide","dashboards":[]}',
      quickStart: {
        keyIdea: 'Backend gives a useful short mental model.',
        quickSummary:
          'First short paragraph.\n\nSecond short paragraph with one caveat.',
      },
    })
    expect(providerBodies).toHaveLength(3)
    expect(JSON.stringify(providerBodies[1])).toContain(
      'Known topics, strongest first: Backend, Databases',
    )
    expect(JSON.stringify(providerBodies[2])).toContain(
      'Use only this selected known topic bridge if it improves clarity: Backend',
    )
    expect(JSON.stringify(providerBodies[2])).not.toContain(
      'Use only this selected known topic bridge if it improves clarity: Backend, Databases',
    )
    expect(rpcBodies).toHaveLength(2)
    expect(rpcBodies[0].p_metadata).toMatchObject({ requestedCredits: 2 })
    expect(rpcBodies[1].p_provider_call_count).toBe(3)
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
