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
  DEFAULT_OPENAI_SUPPORT_MODEL,
  getHostedCerebrasModel,
  shuffleQuizQuestionOptions,
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

  it('uses a rewritten dashboard source search query when provided', async () => {
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
                  title: 'Human muscle reference',
                  url: 'https://example.com/muscles',
                  raw_content:
                    'The largest skeletal muscles include gluteus maximus, latissimus dorsi, quadriceps, hamstrings, and other major muscle groups.',
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
                title: 'Human muscle reference',
                url: 'https://example.com/muscles',
                content: 'Major skeletal muscle reference.',
                score: 0.8,
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
            'please urgently bones sorry muscles skeletal biggest in body',
          searchQuery: 'largest skeletal muscles in the human body',
          dashboardTitle: 'Human Anatomy',
        },
      },
      res,
    )

    const searchBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(searchBody.query).toBe('largest skeletal muscles in the human body')
    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      ok: true,
      source: {
        searchQuery: 'largest skeletal muscles in the human body',
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

  it('ranks the topic official site above an unrelated docs-shaped domain', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TAVILY_API_KEY', 'tavily-key')
    // Both candidates match the same question term in title and snippet, and
    // the decoy carries the higher Tavily score, so the official/docs domain
    // bonus is the only thing left to separate them. developer.apple.com has
    // nothing to do with Kubernetes but is shaped like a docs domain; a
    // "looks official" bonus that ignores the term ranks it first.
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('/extract')) {
        const urls = JSON.parse(String(init?.body)).urls as string[]
        return Promise.resolve({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(
            JSON.stringify({
              results: urls.map((requestedUrl) => ({
                url: requestedUrl,
                raw_content: `Kubernetes is an open source platform for managing containerized workloads and services across a cluster. ${requestedUrl}`,
              })),
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
                title: 'Kubernetes on Apple platforms - Apple Developer',
                url: 'https://developer.apple.com/kubernetes-guide',
                content:
                  'Kubernetes orchestration guidance for developers building containerized services.',
                score: 0.95,
              },
              {
                title: 'Kubernetes Documentation: Overview',
                url: 'https://kubernetes.io/docs/concepts/overview',
                content:
                  'Kubernetes is a portable, extensible, open source platform for managing containerized workloads.',
                score: 0.7,
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
          question: 'what is kubernetes',
          dashboardTitle: 'Container basics',
          contextSummary: 'Notes about virtual machines and deployment.',
        },
      },
      res,
    )

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      ok: true,
      source: { url: 'https://kubernetes.io/docs/concepts/overview' },
    })
  })

  it('falls back to the search snippet when extraction returns nothing', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TAVILY_API_KEY', 'tavily-key')
    // Extraction can fail on a paywalled or JS-only page even though the
    // search snippet already answers the question. Discarding the candidate
    // outright surfaced "web search failed" to the student instead.
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes('/extract')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(JSON.stringify({ results: [] })),
        })
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            results: [
              {
                title: 'Cytokine storm overview',
                url: 'https://www.nejm.org/cytokine-storm',
                content:
                  'A cytokine storm is an excessive immune response in which the body releases too many inflammatory cytokines too quickly, which can damage healthy tissue and cause organ failure in severe infection.',
                score: 0.88,
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
          question: 'What is a cytokine storm?',
          dashboardTitle: 'Immune response',
        },
      },
      res,
    )

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      ok: true,
      source: {
        url: 'https://www.nejm.org/cytokine-storm',
        text: expect.stringContaining('excessive immune response'),
      },
    })
  })

  it('collapses http and https copies of one page into a single candidate', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TAVILY_API_KEY', 'tavily-key')
    // Tavily regularly returns both an http and an https copy of the same
    // page. Keyed on the full URL they read as two candidates and burned two
    // of the three extract slots on one page.
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes('/extract')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(
            JSON.stringify({
              results: [
                {
                  url: 'https://www.vetmed.wisc.edu/mrna-study',
                  raw_content:
                    'An mRNA vaccine study describing trained immunity responses in lung tissue after vaccination.',
                },
                {
                  url: 'https://ufhealth.org/mrna-cancer',
                  raw_content:
                    'An mRNA cancer vaccine research programme describing immunity priming in patients.',
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
                title: 'mRNA study',
                url: 'http://www.vetmed.wisc.edu/mrna-study',
                content: 'An mRNA vaccine study on trained immunity.',
                score: 0.87,
              },
              {
                title: 'mRNA study',
                url: 'https://www.vetmed.wisc.edu/mrna-study',
                content: 'An mRNA vaccine study on trained immunity.',
                score: 0.86,
              },
              {
                title: 'mRNA cancer research',
                url: 'https://ufhealth.org/mrna-cancer',
                content: 'An mRNA cancer vaccine research programme.',
                score: 0.74,
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
          question: 'mRNA vaccine trained immunity research',
          dashboardTitle: 'Immune response',
        },
      },
      res,
    )

    const extractBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body))
    expect(extractBody.urls).toHaveLength(2)
    expect(
      extractBody.urls.filter((value: string) =>
        value.includes('vetmed.wisc.edu'),
      ),
    ).toHaveLength(1)
    expect(response.statusCode).toBe(200)
  })

  it('keeps pricing pages when the student asked about pricing', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TAVILY_API_KEY', 'tavily-key')
    // The low-quality-title penalty is meant to bury SEO listicles hijacking a
    // plain factual question. Applied to a question that is itself about
    // pricing, it buries the pages that actually answer it.
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('/extract')) {
        const urls = JSON.parse(String(init?.body)).urls as string[]
        return Promise.resolve({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(
            JSON.stringify({
              results: urls.map((requestedUrl) => ({
                url: requestedUrl,
                raw_content: `Docker Hub pricing plans and subscription tiers are described in detail for teams and individuals. ${requestedUrl}`,
              })),
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
                title: 'Docker Hub pricing and subscription plans',
                url: 'https://www.docker.com/pricing',
                content:
                  'Docker Hub pricing tiers, subscription plans, and included features for personal and team accounts.',
                score: 0.9,
              },
              {
                title: 'Docker Hub general information page',
                url: 'https://unrelatedblog.test/docker-hub-notes',
                content:
                  'Some general notes about Docker Hub usage and registries without any plan details.',
                score: 0.55,
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
          question: 'what is Docker Hub pricing',
          dashboardTitle: 'Container basics',
        },
      },
      res,
    )

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      ok: true,
      source: { url: 'https://www.docker.com/pricing' },
    })
  })

  it('does not retry a Tavily rate limit', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TAVILY_API_KEY', 'tavily-key')
    // Retrying a 429 almost always returns 429 again and spends another call
    // against a limited monthly quota.
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue('{"error":"rate limited"}'),
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
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

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toBe(502)
  })

  it('drops a second copy of the same article from one site', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TAVILY_API_KEY', 'tavily-key')
    // Wikipedia returned two URLs both titled "Neapolitan chord" for one
    // question and they took two of the three slots between them, so the model
    // received one article twice instead of two independent views.
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('/extract')) {
        const urls = JSON.parse(String(init?.body)).urls as string[]
        return Promise.resolve({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(
            JSON.stringify({
              results: urls.map((requestedUrl) => ({
                url: requestedUrl,
                raw_content: `The Neapolitan sixth chord is a chromatic chord built on the lowered second scale degree. ${requestedUrl}`,
              })),
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
                title: 'Neapolitan chord - Wikipedia',
                url: 'https://en.wikipedia.org/wiki/Neapolitan_chord',
                content: 'The Neapolitan sixth chord explained.',
                score: 0.85,
              },
              {
                title: 'Neapolitan chord - Wikipedia',
                url: 'https://en.wikipedia.org/wiki/Neapolitan_sixth',
                content: 'The Neapolitan sixth chord explained.',
                score: 0.84,
              },
              {
                title: 'Neapolitan Sixth Chords - Open Music Theory',
                url: 'https://viva.pressbooks.pub/openmusictheory/chapter/bii6',
                content:
                  'The Neapolitan sixth chord is a major triad built on the lowered second scale degree, usually in first inversion.',
                score: 0.6,
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
          question: 'what is a Neapolitan sixth chord',
          dashboardTitle: 'Harmony basics',
        },
      },
      res,
    )

    const extractBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body))
    expect(
      extractBody.urls.filter((value: string) => value.includes('wikipedia')),
    ).toHaveLength(1)
    expect(response.statusCode).toBe(200)
  })

  it('keeps the dashboard title out of an already specific question', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TAVILY_API_KEY', 'tavily-key')
    // Appending the dashboard title to a question that already names its
    // subject just adds off-topic words: "how does CRISPR Cas9 edit genes"
    // plus "Molecular biology" matched pages on unrelated molecular-biology
    // topics rather than how Cas9 works.
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('/extract')) {
        const urls = JSON.parse(String(init?.body)).urls as string[]
        return Promise.resolve({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(
            JSON.stringify({
              results: urls.map((requestedUrl) => ({
                url: requestedUrl,
                raw_content:
                  'CRISPR Cas9 cuts target DNA at a site chosen by a guide RNA, and the cell then repairs the break, which is how genes are edited.',
              })),
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
                title: 'What are genome editing and CRISPR-Cas9?',
                url: 'https://medlineplus.gov/genetics/understanding/genomicresearch/genomeediting',
                content:
                  'CRISPR Cas9 cuts DNA at a location specified by a guide RNA so that genes can be edited.',
                score: 0.8,
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
          question: 'how does CRISPR Cas9 edit genes',
          dashboardTitle: 'Molecular biology',
        },
      },
      res,
    )

    const searchQuery = String(
      JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).query,
    ).toLowerCase()
    expect(searchQuery).toContain('crispr')
    expect(searchQuery).not.toContain('molecular biology')
    expect(response.statusCode).toBe(200)
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
    vi.stubEnv('HOSTED_OPENAI_SUPPORT_MODEL', '')
    vi.stubEnv('HOSTED_OPENAI_FAST_MODEL', '')

    expect(getHostedTextProvider()).toBe('openai')
    expect(getHostedOpenAiModel()).toBe(DEFAULT_OPENAI_MODEL)
    expect(getHostedOpenAiModelForStage('study_guide_main')).toBe(
      DEFAULT_OPENAI_SUPPORT_MODEL,
    )
    expect(getHostedOpenAiModelForStage('study_guide_blueprint')).toBe(
      DEFAULT_OPENAI_STUDY_GUIDE_MODEL,
    )
    expect(getHostedOpenAiModelForStage('quick_create')).toBe(
      DEFAULT_OPENAI_FAST_MODEL,
    )
    expect(getHostedTextModel(undefined, 'study_guide_main')).toBe(
      DEFAULT_OPENAI_SUPPORT_MODEL,
    )
    expect(getHostedTextModel(undefined, 'study_guide_blueprint')).toBe(
      DEFAULT_OPENAI_STUDY_GUIDE_MODEL,
    )
    expect(getHostedTextModel(undefined, 'quick_start_personalized')).toBe(
      DEFAULT_OPENAI_SUPPORT_MODEL,
    )
    expect(getHostedTextModel(undefined, 'knowledge_bridge_blocks')).toBe(
      DEFAULT_OPENAI_SUPPORT_MODEL,
    )
    expect(getHostedTextModel(undefined, 'study_guide_page_expand')).toBe(
      DEFAULT_OPENAI_FAST_MODEL,
    )
    expect(getHostedTextModel(undefined, 'study_guide_final_quiz')).toBe(
      DEFAULT_OPENAI_FAST_MODEL,
    )

    vi.stubEnv('HOSTED_OPENAI_MODEL', 'gpt-5.4-mini-test')

    expect(getHostedTextModel()).toBe('gpt-5.4-mini-test')
    expect(getHostedTextModel(undefined, 'study_guide_blueprint')).toBe(
      'gpt-5.4-mini-test',
    )

    vi.stubEnv('HOSTED_OPENAI_STUDY_GUIDE_MODEL', 'gpt-5.6-luna-stage')
    vi.stubEnv('HOSTED_OPENAI_SUPPORT_MODEL', 'gpt-5.4-mini-stage')
    vi.stubEnv('HOSTED_OPENAI_FAST_MODEL', 'gpt-5.4-nano-stage')

    expect(getHostedTextModel(undefined, 'study_guide_blueprint')).toBe(
      'gpt-5.6-luna-stage',
    )
    expect(getHostedTextModel(undefined, 'study_guide_main')).toBe(
      'gpt-5.4-mini-stage',
    )
    expect(getHostedTextModel(undefined, 'quick_create')).toBe(
      'gpt-5.4-nano-stage',
    )
    expect(getHostedTextModel(undefined, 'quick_start_relevance_auto')).toBe(
      'gpt-5.4-mini-stage',
    )
    expect(getHostedTextModel(undefined, 'study_guide_page_expand')).toBe(
      'gpt-5.4-nano-stage',
    )
  })

  it('shuffles hosted final quiz options deterministically', () => {
    const questions = Array.from({ length: 6 }, (_, index) => ({
      question: `Application question ${index + 1}?`,
      options: ['Correct option', 'Distractor one', 'Distractor two'],
      correctIndex: 0,
      explanation: `Explanation ${index + 1}.`,
      skillTested: `Skill ${index + 1}`,
    }))

    const shuffled = questions.map(shuffleQuizQuestionOptions)

    shuffled.forEach((question, index) => {
      expect(question.options).toHaveLength(3)
      expect([...question.options].sort()).toEqual(
        [...questions[index].options].sort(),
      )
      expect(question.options[question.correctIndex]).toBe('Correct option')
      expect(shuffleQuizQuestionOptions(questions[index])).toEqual(question)
    })
    expect(
      new Set(shuffled.map((question) => question.correctIndex)).size,
    ).toBeGreaterThan(1)
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

  it('returns a friendly Carrots message for hosted AI credit failures', async () => {
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

        if (target.includes('/rest/v1/rpc/hosted_ai_begin_usage')) {
          return Promise.resolve({
            ok: false,
            status: 400,
            text: vi
              .fn()
              .mockResolvedValue(
                JSON.stringify({ message: 'insufficient Study Credits' }),
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
          authorization: 'Bearer [REDACTED:Bearer token]',
        },
        body: {
          action: 'generate',
          surface: 'quick-create',
          parts: [{ text: 'Make a quiz about vectors.' }],
        },
      },
      res,
    )

    expect(response.statusCode).toBe(402)
    expect(response.body).toMatchObject({
      ok: false,
      error: {
        code: 'insufficient_credits',
        message:
          "You don't have enough Carrots for this action. Add more Carrots or switch AI provider, then try again.",
      },
    })
  })

  it('classifies hosted model authentication failures separately', async () => {
    vi.stubEnv('HOSTED_AI_TEXT_PROVIDER', 'openai')
    vi.stubEnv('HOSTED_OPENAI_API_KEY', 'bad-hosted-openai-key')
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

    const jsonResponse = (payload: unknown, ok = true, status = 200) => ({
      ok,
      status,
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
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
          return Promise.resolve(
            jsonResponse({
              status: {
                studyCredits: 7,
                introSeen: true,
              },
            }),
          )
        }

        if (target.includes('api.openai.com')) {
          return Promise.resolve(
            jsonResponse(
              { error: { message: 'Incorrect API key provided.' } },
              false,
              401,
            ),
          )
        }

        return Promise.resolve(
          jsonResponse({ message: 'unexpected url' }, false, 500),
        )
      }),
    )

    const { response, res } = makeResponse()

    await hostedAiHandler(
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer [REDACTED:Bearer token]',
        },
        body: {
          action: 'generate',
          surface: 'chat',
          parts: [{ text: 'Explain this dashboard.' }],
        },
      },
      res,
    )

    expect(response.statusCode).toBe(502)
    expect(response.body).toMatchObject({
      ok: false,
      error: {
        code: 'provider_auth',
        message: 'Incorrect API key provided.',
      },
    })
  })

  it('classifies hosted structured output failures separately', async () => {
    vi.stubEnv('HOSTED_AI_TEXT_PROVIDER', 'openai')
    vi.stubEnv('HOSTED_OPENAI_API_KEY', 'hosted-openai-key')
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('UNREAL_SPEECH_API_KEY', 'tts-key')

    const jsonResponse = (payload: unknown, ok = true, status = 200) => ({
      ok,
      status,
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
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
          return Promise.resolve(
            jsonResponse({
              status: {
                studyCredits: 7,
                introSeen: true,
              },
            }),
          )
        }

        if (target.includes('api.openai.com')) {
          // Luna is the default for every stage now, so hosted calls go through
          // the Responses API and the reply has to carry its envelope. The text
          // inside is still unparseable, which is what this test is about.
          return Promise.resolve(
            jsonResponse({
              output: [
                { type: 'message', content: [{ text: 'not json' }] },
              ],
            }),
          )
        }

        return Promise.resolve(
          jsonResponse({ message: 'unexpected url' }, false, 500),
        )
      }),
    )

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
          parts: [{ text: 'Podcast source content. '.repeat(30) }],
          podcastOptions: {
            studyGuideId: 'guide-1',
            sourceTitle: 'Podcast Source',
            sourceScope: 'currentPage',
          },
        },
      },
      res,
    )

    expect(response.statusCode).toBe(502)
    expect(response.body).toMatchObject({
      ok: false,
      error: {
        code: 'output_format',
        message: 'Hosted AI returned an unreadable podcast script.',
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

      if (target.includes('api.openai.com')) {
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
    vi.stubEnv('HOSTED_OPENAI_SUPPORT_MODEL', 'gpt-5.4-mini-route')
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
    const providerResponse = (
      content: unknown,
      usage: Record<string, unknown>,
    ) =>
      jsonResponse({
        choices: [{ message: { content: JSON.stringify(content) } }],
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify(content) }],
          },
        ],
        usage,
      })
    const monolithGuide = {
      title: 'Guide',
      folderName: 'Guide',
      emoji: 'G',
      quickStart: {
        keyIdea: 'Main guide includes the quick start.',
        quickSummary:
          'Start with the main idea.\n\nThen use the pages in order.',
      },
      contextPlan: {
        targetParts: ['rule', 'substitution', 'simplification'],
        selectedTopics: ['Algebra'],
        correspondences: [
          {
            knownSide: 'equation',
            targetSide: 'rule',
            carries: 'the statement that must stay balanced',
            kind: 'part',
          },
          {
            knownSide: 'substituting a value',
            targetSide: 'substitution',
            carries: 'how a placeholder resolves as work proceeds',
            kind: 'process',
          },
          {
            knownSide: 'solving step by step',
            targetSide: 'simplification',
            carries: 'how the form reduces over successive passes',
            kind: 'process',
          },
          {
            knownSide: 'both sides of an equation',
            targetSide: 'the balanced pair',
            carries: 'what must stay equal through every step',
            kind: 'part',
          },
          {
            knownSide: 'checking a solution',
            targetSide: 'verification pass',
            carries: 'how a result is confirmed after the work',
            kind: 'part',
          },
        ],
        reason: 'Lets the learner reuse how balanced statements reduce.',
        breaksAt: 'no numeric solution exists on the target side',
        personalizedQuickStart: {
          keyIdea: 'Algebra gives the guide a personalized start.',
          quickSummary:
            'Algebra helps frame the first idea.\n\nThe guide still teaches the new topic directly.',
        },
        bridgeBlock: {
          title: 'Algebra bridge',
          body: 'Algebraic structure helps organize the new idea.',
        },
      },
      pages: [
        {
          title: '01 - Map',
          summary: '01 - Map preview.',
          rawNotes: '01 - Map\n\nComplete lesson notes for the map.',
        },
        {
          title: '02 - Apply',
          summary: '02 - Apply preview.',
          rawNotes:
            '02 - Apply\n\nComplete lesson notes for applying the idea.',
        },
        {
          title: '03 - Review',
          summary: '03 - Review preview.',
          rawNotes: '03 - Review\n\nComplete lesson notes for the tradeoff.',
        },
      ],
    }
    const quizQuestions = Array.from({ length: 6 }, (_, index) => ({
      question: `Application question ${index + 1}?`,
      options: ['Correct option', 'Distractor one', 'Distractor two'],
      correctIndex: 0,
      explanation: `Explanation ${index + 1}.`,
      skillTested: `Skill ${index + 1}`,
    }))
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

      if (target.includes('api.openai.com')) {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        providerBodies.push(body)
        const prompt = String(
          (body.messages as Array<{ content?: string }> | undefined)?.[0]
            ?.content ||
            body.input ||
            '',
        )

        if (prompt.includes('Write a complete, final RabbitHole Study Guide')) {
          return Promise.resolve(
            providerResponse(monolithGuide, {
              prompt_tokens: 1000,
              completion_tokens: 500,
              total_tokens: 1500,
              prompt_tokens_details: { cached_tokens: 100 },
            }),
          )
        }

        if (prompt.includes('Create 6 strong multiple-choice questions')) {
          return Promise.resolve(
            providerResponse(
              {
                questions: quizQuestions,
              },
              {
                prompt_tokens: 450,
                completion_tokens: 200,
                total_tokens: 650,
              },
            ),
          )
        }
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
    ])
    expect(rpcBodies[0]).toMatchObject({
      p_provider: 'openai',
      p_model: 'openai:gpt-5.4-mini-route',
    })
    expect(rpcBodies[1].p_provider_call_count).toBe(2)
    expect(rpcBodies[1].p_metadata).toMatchObject({
      generationStrategy: 'monolith_v1',
      estimatedCostUsdTotal: expect.any(Number),
      finalQuizQuestionCount: 6,
      contextBridgeBlockCount: 1,
      quickStartPersonalizedRewriteUsed: true,
      stageCosts: [
        expect.objectContaining({
          stage: 'study_guide_monolith',
          model: 'gpt-5.4-mini-route',
          inputTokens: 1000,
          cachedInputTokens: 100,
          outputTokens: 500,
        }),
        expect.objectContaining({
          stage: 'study_guide_final_quiz',
          model: 'gpt-5.4-nano-route',
          inputTokens: 450,
          outputTokens: 200,
        }),
      ],
    })
    expect(response.body).toMatchObject({
      ok: true,
      quickStart: {
        keyIdea: 'Algebra gives the guide a personalized start.',
      },
      bridgeBlocks: [
        {
          dashboardIndex: 1,
          title: 'Algebra bridge',
          body: 'Algebraic structure helps organize the new idea.',
        },
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

      if (target.includes('api.openai.com')) {
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

  it('bundles enhanced hosted Study Guide generation into one usage charge', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('HOSTED_AI_TEXT_PROVIDER', 'openai')
    vi.stubEnv('HOSTED_OPENAI_API_KEY', 'hosted-openai-key')

    const rpcBodies: Record<string, unknown>[] = []
    const providerBodies: Record<string, unknown>[] = []
    const jsonResponse = (payload: unknown, ok = true, status = 200) => ({
      ok,
      status,
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    })
    const providerResponse = (
      content: unknown,
      usage = {
        prompt_tokens: 600,
        completion_tokens: 240,
        total_tokens: 840,
      },
    ) =>
      jsonResponse({
        choices: [{ message: { content: JSON.stringify(content) } }],
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify(content) }],
          },
        ],
        usage,
      })
    const monolithGuide = {
      title: 'Backend Systems',
      folderName: 'Backend Systems',
      emoji: 'B',
      quickStart: {
        keyIdea:
          'Backend systems coordinate requests, state, and durable work.',
        quickSummary:
          'Backend systems receive requests and decide what work must happen.\n\nThey coordinate data, services, and reliability boundaries so user-facing apps can stay predictable.',
      },
      contextPlan: {
        targetParts: ['request', 'state', 'durable work'],
        selectedTopics: ['Backend'],
        correspondences: [
          {
            knownSide: 'handler',
            targetSide: 'request',
            carries: 'what accepts the incoming unit of work',
            kind: 'part',
          },
          {
            knownSide: 'writing to the store',
            targetSide: 'state',
            carries: 'how a result becomes visible to later calls',
            kind: 'process',
          },
          {
            knownSide: 'retry loop',
            targetSide: 'durable work',
            carries: 'how work survives a failure over time',
            kind: 'process',
          },
          {
            knownSide: 'request timeout',
            targetSide: 'work deadline',
            carries: 'the bound after which work is abandoned',
            kind: 'part',
          },
          {
            knownSide: 'connection pool',
            targetSide: 'worker capacity',
            carries: 'what limits how much runs at once',
            kind: 'part',
          },
        ],
        reason: 'Lets the learner reuse how work survives a failed call.',
        breaksAt: 'replayable log has no counterpart in a request handler',
        personalizedQuickStart: {
          keyIdea: 'Backend gives a useful short mental model.',
          quickSummary:
            'First short paragraph.\n\nSecond short paragraph with one caveat.',
        },
        bridgeBlock: {
          title: 'Backend bridge',
          body: 'Backend request flow is a useful comparison, but Kafka-style durability changes the shape.',
        },
      },
      pages: ['01 - Request Flow', '02 - Durability', '03 - Tradeoffs'].map(
        (title, index) => ({
          title,
          summary: `${title} preview.`,
          rawNotes: `${title}\n\nThis is complete shipped lesson content for page ${
            index + 1
          }. It keeps the facts grounded and finishes each paragraph cleanly.`,
        }),
      ),
    }
    const quizQuestions = Array.from({ length: 6 }, (_, index) => ({
      question: `Application question ${index + 1}?`,
      options: ['Correct option', 'Distractor one', 'Distractor two'],
      correctIndex: 0,
      explanation: `Explanation ${index + 1}.`,
      skillTested: `Skill ${index + 1}`,
    }))
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

      if (target.includes('api.openai.com')) {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        providerBodies.push(body)
        const prompt = String(
          (body.messages as Array<{ content?: string }> | undefined)?.[0]
            ?.content ||
            body.input ||
            '',
        )

        if (prompt.includes('Write a complete, final RabbitHole Study Guide')) {
          return Promise.resolve(providerResponse(monolithGuide))
        }

        if (prompt.includes('Create 6 strong multiple-choice questions')) {
          return Promise.resolve(
            providerResponse({
              questions: quizQuestions,
            }),
          )
        }
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
    // A mapped bridge leads; the plain variant stays one tap away.
    expect(response.body.quickStart).toHaveProperty('forcedBridge', {
      keyIdea: 'Backend systems coordinate requests, state, and durable work.',
      quickSummary:
        'Backend systems receive requests and decide what work must happen.\n\nThey coordinate data, services, and reliability boundaries so user-facing apps can stay predictable.',
    })
    const guide = JSON.parse(String(response.body.text)) as {
      dashboards: Array<{
        flashcards?: unknown[]
        practice?: { multipleChoice?: unknown[] }
      }>
    }
    expect(guide.dashboards).toHaveLength(3)
    expect(guide.dashboards[0]?.flashcards).toEqual([])
    expect(guide.dashboards[2]?.practice?.multipleChoice).toHaveLength(6)
    expect(providerBodies).toHaveLength(2)
    expect(providerBodies[0].model).toBe(DEFAULT_OPENAI_STUDY_GUIDE_MODEL)
    expect(providerBodies[0].input).toBeDefined()
    // The monolith carries the known-topic mapping, so it gets a small budget.
    expect(providerBodies[0].reasoning).toMatchObject({ effort: 'low' })
    expect(providerBodies[1].model).toBe(DEFAULT_OPENAI_FAST_MODEL)
    expect(JSON.stringify(providerBodies[0])).toContain(
      'Write a complete, final RabbitHole Study Guide',
    )
    expect(JSON.stringify(providerBodies[0])).toContain(
      'The learner already knows these candidate topics: Backend, Databases',
    )
    expect(JSON.stringify(providerBodies[1])).toContain(
      'Create 6 strong multiple-choice questions',
    )
    expect(rpcBodies).toHaveLength(2)
    expect(rpcBodies[0].p_metadata).toMatchObject({ requestedCredits: 3 })
    expect(rpcBodies[1].p_provider_call_count).toBe(2)
    expect(rpcBodies[1].p_metadata).toMatchObject({
      generationStrategy: 'monolith_v1',
      quickStartPersonalizedRewriteUsed: true,
      finalQuizQuestionCount: 6,
      contextBridgeBlockCount: 1,
      stageCosts: expect.arrayContaining([
        expect.objectContaining({ stage: 'study_guide_monolith' }),
        expect.objectContaining({ stage: 'study_guide_final_quiz' }),
      ]),
    })
  })

  it('keeps the hosted forced Quick Start bridge when the monolith selects no useful topic', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('HOSTED_AI_TEXT_PROVIDER', 'openai')
    vi.stubEnv('HOSTED_OPENAI_API_KEY', 'hosted-openai-key')

    const rpcBodies: Record<string, unknown>[] = []
    const providerBodies: Record<string, unknown>[] = []
    const jsonResponse = (payload: unknown, ok = true, status = 200) => ({
      ok,
      status,
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    })
    const providerResponse = (content: unknown) =>
      jsonResponse({
        choices: [{ message: { content: JSON.stringify(content) } }],
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify(content) }],
          },
        ],
        usage: {
          prompt_tokens: 500,
          completion_tokens: 200,
          total_tokens: 700,
        },
      })
    // The model rated every learner topic as a non-bridge, so selectedTopics is
    // empty. "Use my context" must still be offered from personalizedQuickStart.
    const monolithGuide = {
      title: 'Storage Guide',
      folderName: 'Storage Guide',
      emoji: 'S',
      quickStart: {
        keyIdea: 'Object storage keeps files behind bucket-style APIs.',
        quickSummary:
          'Object storage stores data as named objects.\n\nIt is useful when applications need durable files without managing local disks.',
      },
      contextPlan: {
        targetParts: ['bucket', 'object', 'access policy'],
        selectedTopics: ['Kubernetes'],
        correspondences: [],
        reason: 'Closest available point of contact for stored bytes.',
        breaksAt: 'Kubernetes schedules work, buckets only hold bytes',
        personalizedQuickStart: {
          keyIdea: 'Use Kubernetes as a loose mental bridge.',
          quickSummary:
            'Kubernetes organizes running systems.\n\nThis topic uses a different layer, but the control idea helps.',
        },
        bridgeBlock: {
          title: 'Kubernetes bridge',
          body: 'Kubernetes controls workloads, while object storage only stores bytes.',
        },
      },
      pages: ['01 - Buckets', '02 - Objects', '03 - Access'].map((title) => ({
        title,
        summary: `${title} preview.`,
        rawNotes: `${title}\n\nThis complete lesson explains the page and finishes cleanly.`,
      })),
    }
    const quizQuestions = Array.from({ length: 6 }, (_, index) => ({
      question: `Storage application question ${index + 1}?`,
      options: ['Correct option', 'Distractor one', 'Distractor two'],
      correctIndex: 0,
      explanation: `Storage explanation ${index + 1}.`,
      skillTested: `Storage skill ${index + 1}`,
    }))
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

      if (target.includes('api.openai.com')) {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        providerBodies.push(body)
        const prompt = String(
          (body.messages as Array<{ content?: string }> | undefined)?.[0]
            ?.content ||
            body.input ||
            '',
        )

        if (prompt.includes('Write a complete, final RabbitHole Study Guide')) {
          return Promise.resolve(providerResponse(monolithGuide))
        }

        if (prompt.includes('Create 6 strong multiple-choice questions')) {
          return Promise.resolve(
            providerResponse({
              questions: quizQuestions,
            }),
          )
        }
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
      keyIdea: 'Object storage keeps files behind bucket-style APIs.',
      forcedBridge: {
        keyIdea: 'Use Kubernetes as a loose mental bridge.',
      },
    })
    const guide = JSON.parse(String(response.body.text)) as {
      dashboards: Array<{ practice?: { multipleChoice?: unknown[] } }>
    }
    expect(guide.dashboards).toHaveLength(3)
    expect(guide.dashboards[2]?.practice?.multipleChoice).toHaveLength(6)
    // The opt-in view costs no extra provider call under the monolith.
    expect(providerBodies).toHaveLength(2)
    expect(providerBodies[0].model).toBe(DEFAULT_OPENAI_STUDY_GUIDE_MODEL)
    expect(providerBodies[1].model).toBe(DEFAULT_OPENAI_FAST_MODEL)
    expect(response.body.bridgeBlocks).toEqual([])
    expect(rpcBodies[1].p_provider_call_count).toBe(2)
    expect(JSON.stringify(rpcBodies[1].p_metadata)).not.toContain(
      'quick_start_relevance_force',
    )
    expect(rpcBodies[1].p_metadata).toMatchObject({
      generationStrategy: 'monolith_v1',
      forcedBridgeAvailable: true,
      finalQuizQuestionCount: 6,
      stageCosts: expect.arrayContaining([
        expect.objectContaining({ stage: 'study_guide_monolith' }),
        expect.objectContaining({ stage: 'study_guide_final_quiz' }),
      ]),
    })
    expect(rpcBodies[1].p_metadata).not.toMatchObject({
      quickStartPersonalizedRewriteUsed: true,
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
