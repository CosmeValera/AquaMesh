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

  it('generates hosted podcasts through Cerebras, Unreal Speech, and Supabase Storage', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('HOSTED_CEREBRAS_API_KEY', 'hosted-cerebras-key')
    vi.stubEnv('UNREAL_SPEECH_API_KEY', 'unreal-key')

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

      if (target === 'https://api.v8.unrealspeech.com/synthesisTasks') {
        unrealRequests.push({
          body: JSON.parse(String(init?.body)),
          headers: init?.headers,
        })
        return Promise.resolve(
          jsonResponse({
            SynthesisTask: {
              TaskId: 'task-1',
              OutputUri: 'https://audio.unrealspeech.test/podcast.mp3',
            },
          }),
        )
      }

      if (target === 'https://audio.unrealspeech.test/podcast.mp3') {
        return Promise.resolve(jsonResponse({}, true, 200))
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
      p_status: 'succeeded',
      p_provider_call_count: 2,
    })
    expect(providerBodies).toHaveLength(1)
    expect(monthlyUsageBodies).toHaveLength(1)
    expect(monthlyUsageBodies[0]).toMatchObject({
      p_owner_id: 'user-1',
      p_character_count: expect.any(Number),
      p_monthly_cap: 225000,
    })
    expect(monthlyUsageBodies[0].p_character_count).toBeGreaterThan(0)
    expect(unrealRequests).toHaveLength(1)
    expect(unrealRequests[0].body).toMatchObject({
      VoiceId: 'Sierra',
      Bitrate: '64k',
    })
    expect(String(unrealRequests[0].body.Text)).toContain('Host A:')
    expect(String(unrealRequests[0].body.Text)).toContain('Host B:')
    expect(
      (unrealRequests[0].headers as Record<string, string>).authorization,
    ).toBe('Bearer unreal-key')
    expect(storageUploads).toHaveLength(1)
    expect(storageUploads[0].url).toContain('user-1/guide-1/')
    expect((storageUploads[0].headers as Record<string, string>)['x-upsert']).toBe(
      'true',
    )
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
                        : providerBodies.length === 3
                          ? JSON.stringify({
                              keyIdea:
                                'Backend gives a useful short mental model.',
                              quickSummary:
                                'First short paragraph.\n\nSecond short paragraph with one caveat.',
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
    expect(providerBodies).toHaveLength(4)
    expect(JSON.stringify(providerBodies[1])).toContain(
      'Known topics, strongest first: Backend, Databases',
    )
    expect(JSON.stringify(providerBodies[1])).toContain('Bridge mode: auto')
    expect(JSON.stringify(providerBodies[2])).toContain(
      'Candidate known topic bridge(s): Backend',
    )
    expect(JSON.stringify(providerBodies[2])).not.toContain(
      'Candidate known topic bridge(s): Backend, Databases',
    )
    expect(JSON.stringify(providerBodies)).not.toContain('Bridge mode: force')
    expect(JSON.stringify(providerBodies[3])).toContain(
      'Create optional knowledge-context bridge note blocks',
    )
    expect(JSON.stringify(providerBodies[3])).toContain('dashboardIndex: 1')
    expect(JSON.stringify(providerBodies[3])).not.toContain('dashboardIndex: 0')
    expect(rpcBodies).toHaveLength(2)
    expect(rpcBodies[0].p_metadata).toMatchObject({ requestedCredits: 2 })
    expect(rpcBodies[1].p_provider_call_count).toBe(4)
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
