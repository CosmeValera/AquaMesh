import { afterEach, describe, expect, it, vi } from 'vitest'

import hostedAiHandler from '../../../../../api/hosted-ai'

/**
 * Collects the NDJSON lines the handler writes, and lets a test pretend the
 * learner closed the tab by making `write` throw from a chosen line onwards.
 */
const makeStreamingResponse = (failWritesFrom = Number.POSITIVE_INFINITY) => {
  const headers = new Map<string, string>()
  const lines: Record<string, unknown>[] = []
  const response = { statusCode: 200, body: undefined as unknown, ended: false }
  let writeCount = 0

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
    write: vi.fn((chunk: string) => {
      writeCount += 1
      if (writeCount > failWritesFrom) {
        throw new Error('socket closed')
      }

      chunk
        .split('\n')
        .filter((line) => line.trim())
        .forEach((line) => lines.push(JSON.parse(line)))
      return true
    }),
    end: vi.fn(() => {
      response.ended = true
    }),
  }

  return { headers, lines, response, res }
}

const GUIDE = {
  title: 'Vector Basics',
  folderName: 'Maths',
  emoji: 'V',
  quickStart: {
    keyIdea: 'A vector is a direction with a length attached to it.',
    quickSummary: 'Add them tip to tail, scale them by a single number.',
  },
  nextGuideIdeas: [{ title: 'Dot products', summary: 'Measuring alignment.' }],
  plannedLessons: [{ title: 'Cross products', summary: 'Left for later.' }],
  pages: [
    {
      title: 'What a vector is',
      summary: 'Direction plus magnitude.',
      rawNotes: 'Arrows in space.',
      pageIdeas: ['magnitude'],
    },
    {
      title: 'Adding vectors',
      summary: 'Tip to tail.',
      rawNotes: 'Order does not matter.',
      pageIdeas: ['commutativity'],
    },
    {
      title: 'Scaling vectors',
      summary: 'Multiply by a scalar.',
      rawNotes: 'Negative flips direction.',
      pageIdeas: ['scalars'],
    },
  ],
}

const QUIZ = {
  questions: Array.from({ length: 6 }).map((_item, index) => ({
    question: `Question ${index + 1}?`,
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    explanation: 'Because A.',
    skillTested: 'vectors',
  })),
  learnedSkill: 'vector arithmetic',
}

/** One SSE frame per delta, the way the Responses API sends them. */
const makeSseStream = (text: string, chunkSize = 40) => {
  const frames: string[] = []
  for (let index = 0; index < text.length; index += chunkSize) {
    frames.push(
      `event: response.output_text.delta\ndata: ${JSON.stringify({
        type: 'response.output_text.delta',
        delta: text.slice(index, index + chunkSize),
      })}\n\n`,
    )
  }

  frames.push(
    `event: response.completed\ndata: ${JSON.stringify({
      type: 'response.completed',
      response: { usage: { input_tokens: 900, output_tokens: 1400 } },
    })}\n\n`,
  )

  const encoder = new TextEncoder()
  let cursor = 0

  return {
    getReader: () => ({
      read: () =>
        Promise.resolve(
          cursor < frames.length
            ? { done: false, value: encoder.encode(frames[cursor++]) }
            : { done: true, value: undefined },
        ),
    }),
  }
}

const jsonResponse = (payload: unknown, ok = true, status = 200) => ({
  ok,
  status,
  text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
})

const bufferedResponsesPayload = (value: unknown) => ({
  output: [{ type: 'message', content: [{ text: JSON.stringify(value) }] }],
  usage: { input_tokens: 500, output_tokens: 300 },
})

const stubHostedEnv = () => {
  vi.stubEnv('HOSTED_AI_TEXT_PROVIDER', 'openai')
  vi.stubEnv('HOSTED_OPENAI_API_KEY', 'hosted-openai-key')
  vi.stubEnv('SUPABASE_URL', 'https://supabase.test')
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
}

interface FetchInit {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

interface JobRow {
  client_job_id: string
  status: 'running' | 'succeeded' | 'failed'
  result?: unknown
  error_message?: string | null
  updated_at: string
}

/**
 * Stands in for the hosted_study_guide_jobs table, including the unique index
 * on (user_id, client_job_id) that the whole no-double-charge guarantee rests
 * on. Seeded rows let a test act as a refresh of an earlier request.
 */
const makeJobsTable = (seed: JobRow[] = []) => {
  const rows = new Map(seed.map((row) => [row.client_job_id, { ...row }]))

  const idFromQuery = (target: string) =>
    decodeURIComponent(
      new URL(target, 'https://supabase.test').searchParams
        .get('client_job_id')
        ?.replace('eq.', '') || '',
    )

  const handle = (target: string, init: FetchInit = {}) => {
    const method = (init.method || 'GET').toUpperCase()
    const body = init.body ? JSON.parse(String(init.body)) : {}

    if (method === 'POST') {
      if (rows.has(body.client_job_id)) {
        // resolution=ignore-duplicates: a conflict returns nothing.
        return jsonResponse([])
      }

      const row: JobRow = {
        client_job_id: body.client_job_id,
        status: 'running',
        updated_at: new Date().toISOString(),
      }
      rows.set(row.client_job_id, row)
      return jsonResponse([row])
    }

    const id = idFromQuery(target)

    if (method === 'GET') {
      const row = rows.get(id)
      return jsonResponse(row ? [row] : [])
    }

    if (method === 'DELETE') {
      rows.delete(id)
      return jsonResponse([])
    }

    if (method === 'PATCH') {
      const row = rows.get(id)
      if (!row) {
        return jsonResponse([])
      }

      // The steal path only matches a row that is already stale.
      if (target.includes('updated_at=lt.')) {
        const cutoff = Date.parse(
          decodeURIComponent(
            new URL(target, 'https://supabase.test').searchParams.get(
              'updated_at',
            ) || '',
          ).replace('lt.', ''),
        )
        if (!(Date.parse(row.updated_at) < cutoff)) {
          return jsonResponse([])
        }
      }

      Object.assign(row, body, { updated_at: new Date().toISOString() })
      return jsonResponse([row])
    }

    return jsonResponse([])
  }

  return { rows, handle }
}

/** `openAiResponses` are answered in order, one per call to /v1/responses. */
const stubGatewayFetch = (
  openAiResponses: unknown[],
  jobs = makeJobsTable(),
) => {
  let modelCall = 0
  const fetchMock = vi.fn((url: string, init?: FetchInit) => {
    const target = String(url)

    if (target.includes('/auth/v1/user')) {
      return Promise.resolve(jsonResponse({ id: 'user-1' }))
    }

    if (target.includes('/rest/v1/hosted_study_guide_jobs')) {
      return Promise.resolve(jobs.handle(target, init))
    }

    if (target.includes('/rest/v1/rpc/hosted_ai_begin_usage')) {
      return Promise.resolve(jsonResponse({ study_credits: 27 }))
    }

    if (target.includes('/rest/v1/rpc/hosted_ai_finish_usage')) {
      return Promise.resolve(jsonResponse({ study_credits: 27 }))
    }

    if (target.includes('/v1/responses')) {
      const next = openAiResponses[modelCall]
      modelCall += 1
      return Promise.resolve(next)
    }

    return Promise.resolve(jsonResponse({}, false, 500))
  })
  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

const countCalls = (fetchMock: ReturnType<typeof vi.fn>, fragment: string) =>
  fetchMock.mock.calls.filter((call) => String(call[0]).includes(fragment))
    .length

const resumableRequest = (clientJobId: string, stream = false) => ({
  method: 'POST',
  headers: { authorization: 'Bearer token' },
  body: {
    action: 'generateWithQuickStart',
    surface: 'study-guide',
    stream,
    clientJobId,
    parts: [{ text: 'Learner prompt: teach me vectors.' }],
  },
})

const studyGuideRequest = (stream: boolean) => ({
  method: 'POST',
  headers: { authorization: 'Bearer token' },
  body: {
    action: 'generateWithQuickStart',
    surface: 'study-guide',
    stream,
    parts: [{ text: 'Learner prompt: teach me vectors.' }],
  },
})

describe('hosted Study Guide preview stream', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('previews the guide as it is written, then sends the finished body', async () => {
    stubHostedEnv()
    stubGatewayFetch([
      { ok: true, status: 200, body: makeSseStream(JSON.stringify(GUIDE)) },
      jsonResponse(bufferedResponsesPayload(QUIZ)),
    ])
    const { headers, lines, res } = makeStreamingResponse()

    await hostedAiHandler(studyGuideRequest(true), res)

    expect(headers.get('content-type')).toContain('application/x-ndjson')
    expect(headers.get('cache-control')).toBe('no-store')

    const types = lines.map((line) => line.type)
    // Every early field must arrive before the first page is announced.
    expect(types.indexOf('quickStart')).toBeLessThan(types.indexOf('pageTitle'))
    expect(types.filter((type) => type === 'pageTitle')).toHaveLength(3)
    expect(types.filter((type) => type === 'page')).toHaveLength(3)
    expect(types.at(-1)).toBe('done')

    expect(lines.find((line) => line.type === 'meta')).toMatchObject({
      title: 'Vector Basics',
    })
    expect(lines.find((line) => line.type === 'quickStart')).toMatchObject({
      keyIdea: GUIDE.quickStart.keyIdea,
    })
    expect(
      lines
        .filter((line) => line.type === 'pageTitle')
        .map((line) => line.title),
    ).toEqual(['What a vector is', 'Adding vectors', 'Scaling vectors'])

    const done = lines.at(-1) as { response: Record<string, unknown> }
    expect(done.response.ok).toBe(true)
    expect(done.response.quickStart).toMatchObject({
      keyIdea: GUIDE.quickStart.keyIdea,
    })
    expect(String(done.response.text)).toContain('What a vector is')
  })

  it('sends the same guide whether or not the client asked to stream', async () => {
    stubHostedEnv()
    stubGatewayFetch([
      { ok: true, status: 200, body: makeSseStream(JSON.stringify(GUIDE)) },
      jsonResponse(bufferedResponsesPayload(QUIZ)),
    ])
    const streamed = makeStreamingResponse()
    await hostedAiHandler(studyGuideRequest(true), streamed.res)

    stubGatewayFetch([
      jsonResponse(bufferedResponsesPayload(GUIDE)),
      jsonResponse(bufferedResponsesPayload(QUIZ)),
    ])
    const buffered = makeStreamingResponse()
    await hostedAiHandler(studyGuideRequest(false), buffered.res)

    const streamedBody = (
      streamed.lines.at(-1) as { response: Record<string, unknown> }
    ).response
    const bufferedBody = buffered.response.body as Record<string, unknown>

    expect(buffered.lines).toHaveLength(0)
    expect(streamedBody.text).toEqual(bufferedBody.text)
    expect(streamedBody.quickStart).toEqual(bufferedBody.quickStart)
    expect(streamedBody.learnedSkillOptions).toEqual(
      bufferedBody.learnedSkillOptions,
    )
  })

  it('answers a pre-generation failure as plain JSON with its real status', async () => {
    stubHostedEnv()
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const target = String(url)

        if (target.includes('/auth/v1/user')) {
          return Promise.resolve(jsonResponse({ id: 'user-1' }))
        }

        if (target.includes('/rest/v1/rpc/hosted_ai_begin_usage')) {
          return Promise.resolve(
            jsonResponse({ message: 'insufficient Study Credits' }, false, 400),
          )
        }

        return Promise.resolve(jsonResponse({}, false, 500))
      }),
    )
    const { lines, response, res } = makeStreamingResponse()

    await hostedAiHandler(studyGuideRequest(true), res)

    // Nothing was previewed, so the client still gets the status it expects.
    expect(lines).toHaveLength(0)
    expect(response.statusCode).toBe(402)
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'insufficient_credits' },
    })
  })

  it('reports a failure after previewing as a final error line', async () => {
    stubHostedEnv()
    stubGatewayFetch([
      { ok: true, status: 200, body: makeSseStream(JSON.stringify(GUIDE)) },
      jsonResponse({ error: { message: 'Incorrect API key' } }, false, 401),
      jsonResponse({ error: { message: 'Incorrect API key' } }, false, 401),
    ])
    const { lines, res } = makeStreamingResponse()

    await hostedAiHandler(studyGuideRequest(true), res)

    const last = lines.at(-1) as { type: string; response: { ok: boolean } }
    expect(lines.some((line) => line.type === 'quickStart')).toBe(true)
    expect(last.type).toBe('error')
    expect(last.response.ok).toBe(false)
    expect(res.end).toHaveBeenCalled()
  })

  it('finishes the guide even when the reader has gone away', async () => {
    stubHostedEnv()
    const fetchMock = stubGatewayFetch([
      { ok: true, status: 200, body: makeSseStream(JSON.stringify(GUIDE)) },
      jsonResponse(bufferedResponsesPayload(QUIZ)),
    ])
    // Fails from the second write on, the way a closed socket would.
    const { res } = makeStreamingResponse(1)

    await expect(
      hostedAiHandler(studyGuideRequest(true), res),
    ).resolves.toBeUndefined()

    // The quiz call still ran, and usage was still settled.
    const targets = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(targets.filter((url) => url.includes('/v1/responses'))).toHaveLength(
      2,
    )
    expect(targets.some((url) => url.includes('hosted_ai_finish_usage'))).toBe(
      true,
    )
  })
})

describe('hosted Study Guide job resumption', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('records the finished guide against the job', async () => {
    stubHostedEnv()
    const jobs = makeJobsTable()
    stubGatewayFetch(
      [
        jsonResponse(bufferedResponsesPayload(GUIDE)),
        jsonResponse(bufferedResponsesPayload(QUIZ)),
      ],
      jobs,
    )
    const { response, res } = makeStreamingResponse()

    await hostedAiHandler(resumableRequest('job-abc'), res)

    expect((response.body as { ok: boolean }).ok).toBe(true)
    const row = jobs.rows.get('job-abc')
    expect(row?.status).toBe('succeeded')
    expect((row?.result as { text: string }).text).toContain('What a vector is')
  })

  it('returns the same guide for a replay without charging or calling a model', async () => {
    stubHostedEnv()
    const jobs = makeJobsTable([
      {
        client_job_id: 'job-done',
        status: 'succeeded',
        result: { ok: true, text: 'ALREADY GENERATED GUIDE' },
        updated_at: new Date().toISOString(),
      },
    ])
    const fetchMock = stubGatewayFetch([], jobs)
    const { response, res } = makeStreamingResponse()

    await hostedAiHandler(resumableRequest('job-done'), res)

    expect(response.body).toMatchObject({
      ok: true,
      text: 'ALREADY GENERATED GUIDE',
    })
    // The two things that cost money never happened.
    expect(countCalls(fetchMock, '/v1/responses')).toBe(0)
    expect(countCalls(fetchMock, 'hosted_ai_begin_usage')).toBe(0)
  })

  it('reports a generation already in flight instead of starting a second', async () => {
    stubHostedEnv()
    const jobs = makeJobsTable([
      {
        client_job_id: 'job-live',
        status: 'running',
        updated_at: new Date().toISOString(),
      },
    ])
    const fetchMock = stubGatewayFetch([], jobs)
    const { response, res } = makeStreamingResponse()

    await hostedAiHandler(resumableRequest('job-live'), res)

    expect(response.body).toMatchObject({ ok: true, pending: true })
    expect(countCalls(fetchMock, '/v1/responses')).toBe(0)
    expect(countCalls(fetchMock, 'hosted_ai_begin_usage')).toBe(0)
  })

  it('takes over a job whose function died', async () => {
    stubHostedEnv()
    const jobs = makeJobsTable([
      {
        client_job_id: 'job-stale',
        status: 'running',
        updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
    ])
    const fetchMock = stubGatewayFetch(
      [
        jsonResponse(bufferedResponsesPayload(GUIDE)),
        jsonResponse(bufferedResponsesPayload(QUIZ)),
      ],
      jobs,
    )
    const { response, res } = makeStreamingResponse()

    await hostedAiHandler(resumableRequest('job-stale'), res)

    expect((response.body as { ok: boolean }).ok).toBe(true)
    expect(countCalls(fetchMock, '/v1/responses')).toBe(2)
    expect(jobs.rows.get('job-stale')?.status).toBe('succeeded')
  })

  it('lets a failed job be retried, and records a failure', async () => {
    stubHostedEnv()
    const jobs = makeJobsTable([
      {
        client_job_id: 'job-failed',
        status: 'failed',
        error_message: 'earlier failure',
        updated_at: new Date().toISOString(),
      },
    ])
    stubGatewayFetch(
      [
        jsonResponse({ error: { message: 'Incorrect API key' } }, false, 401),
        jsonResponse({ error: { message: 'Incorrect API key' } }, false, 401),
      ],
      jobs,
    )
    const { response, res } = makeStreamingResponse()

    await hostedAiHandler(resumableRequest('job-failed'), res)

    expect((response.body as { ok: boolean }).ok).toBe(false)
    expect(jobs.rows.get('job-failed')?.status).toBe('failed')
  })

  it('reads a job only within the caller account', async () => {
    stubHostedEnv()
    const jobs = makeJobsTable([
      {
        client_job_id: 'job-x',
        status: 'succeeded',
        result: { ok: true, text: 'guide' },
        updated_at: new Date().toISOString(),
      },
    ])
    const fetchMock = stubGatewayFetch([], jobs)
    const { response, res } = makeStreamingResponse()

    await hostedAiHandler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer token' },
        body: { action: 'studyGuideJob', clientJobId: 'job-x' },
      },
      res,
    )

    expect(response.body).toMatchObject({
      ok: true,
      job: { clientJobId: 'job-x', status: 'succeeded' },
    })
    const jobQuery = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .find((url) => url.includes('hosted_study_guide_jobs'))
    expect(jobQuery).toContain('user_id=eq.user-1')
  })

  it('rejects a job id that is not shaped like one', async () => {
    stubHostedEnv()
    stubGatewayFetch([])
    const { response, res } = makeStreamingResponse()

    await hostedAiHandler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer token' },
        body: { action: 'studyGuideJob', clientJobId: "x'; drop table--" },
      },
      res,
    )

    expect(response.statusCode).toBe(400)
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'invalid_request' },
    })
  })

  it('generates normally when no job id is supplied', async () => {
    stubHostedEnv()
    const jobs = makeJobsTable()
    const fetchMock = stubGatewayFetch(
      [
        jsonResponse(bufferedResponsesPayload(GUIDE)),
        jsonResponse(bufferedResponsesPayload(QUIZ)),
      ],
      jobs,
    )
    const { response, res } = makeStreamingResponse()

    await hostedAiHandler(studyGuideRequest(false), res)

    expect((response.body as { ok: boolean }).ok).toBe(true)
    expect(jobs.rows.size).toBe(0)
    expect(countCalls(fetchMock, '/v1/responses')).toBe(2)
  })
})
