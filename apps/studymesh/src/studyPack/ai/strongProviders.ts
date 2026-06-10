export type StrongAiProviderId = 'gemini' | 'cerebras'

export interface StrongAiProviderConfig {
  id: StrongAiProviderId
  label: string
  modeLabel: string
  defaultModel: string
  envKey: string
  docsUrl: string
  supportsImageInput: boolean
  rateLimitMessage: string
}

export interface StrongAiCallOptions {
  provider: StrongAiProviderId
  apiToken: string
  model: string
  parts: Array<{
    text?: string
    inline_data?: {
      mime_type: string
      data: string
    }
  }>
  responseSchema?: Record<string, unknown>
  timeoutMs: number
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
    finishReason?: string
  }>
  error?: {
    message?: string
    status?: string
  }
}

interface CerebrasResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
    finish_reason?: string
  }>
  error?: {
    message?: string
    type?: string
    code?: string
  }
}

export const STRONG_AI_PROVIDERS: Record<
  StrongAiProviderId,
  StrongAiProviderConfig
> = {
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    modeLabel: 'Own Gemini API token',
    defaultModel: 'gemini-2.5-flash',
    envKey: 'GEMINI_API_KEY',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
    supportsImageInput: true,
    rateLimitMessage:
      'Gemini rate limit reached for today. Try again later, switch AI mode, or check your Gemini API quota.',
  },
  cerebras: {
    id: 'cerebras',
    label: 'Cerebras',
    modeLabel: 'Own Cerebras API key',
    defaultModel: 'gpt-oss-120b',
    envKey: 'CEREBRAS_API_KEY',
    docsUrl: 'https://inference-docs.cerebras.ai/quickstart',
    supportsImageInput: false,
    rateLimitMessage:
      'Cerebras free limit reached. Try again later, switch providers, or check your Cerebras usage limits.',
  },
}

export const DEFAULT_STRONG_AI_PROVIDER: StrongAiProviderId = 'gemini'
export const DEFAULT_STUDY_PACK_AI_MODEL =
  STRONG_AI_PROVIDERS[DEFAULT_STRONG_AI_PROVIDER].defaultModel

export const isStrongAiProvider = (
  value: unknown,
): value is StrongAiProviderId => value === 'gemini' || value === 'cerebras'

export const getStrongAiProviderConfig = (
  provider: StrongAiProviderId,
): StrongAiProviderConfig => STRONG_AI_PROVIDERS[provider]

export const getEnvStrongProviderApiKey = (
  provider: StrongAiProviderId,
): string =>
  typeof process !== 'undefined'
    ? String(process.env[STRONG_AI_PROVIDERS[provider].envKey] || '').trim()
    : ''

const withTimeout = async (
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<Response>,
): Promise<Response> => {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await run(controller.signal)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(
        'Strong model request took longer than 5 minutes, so StudyMesh stopped the request. Try again with shorter notes, fewer generated blocks, or another AI mode.',
      )
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const convertSchemaType = (type: unknown): string | undefined => {
  if (typeof type !== 'string') {
    return undefined
  }

  const lower = type.toLowerCase()
  return lower === 'number' ? 'number' : lower
}

const toJsonSchema = (schema: unknown): unknown => {
  if (Array.isArray(schema)) {
    return schema.map(toJsonSchema)
  }

  if (!schema || typeof schema !== 'object') {
    return schema
  }

  const record = schema as Record<string, unknown>
  const next: Record<string, unknown> = {}

  Object.entries(record).forEach(([key, value]) => {
    if (key === 'type') {
      const type = convertSchemaType(value)
      if (type) {
        next.type = type
      }
      return
    }

    next[key] = toJsonSchema(value)
  })

  if (next.type === 'object') {
    next.additionalProperties = false
  }

  return next
}

const callGemini = async ({
  apiToken,
  model,
  parts,
  responseSchema,
  timeoutMs,
}: StrongAiCallOptions): Promise<string> => {
  const response = await withTimeout(timeoutMs, (signal) =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiToken,
        },
        signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: responseSchema
              ? 'application/json'
              : 'text/plain',
            ...(responseSchema ? { responseSchema } : {}),
          },
        }),
      },
    ),
  )

  const payload = (await response.json()) as GeminiResponse
  if (!response.ok) {
    const message = payload.error?.message || ''
    const status = payload.error?.status || ''
    if (
      response.status === 429 ||
      status === 'RESOURCE_EXHAUSTED' ||
      /rate limit|quota|peak requests/i.test(message)
    ) {
      throw new Error(
        `${STRONG_AI_PROVIDERS.gemini.rateLimitMessage} ${message}`.trim(),
      )
    }

    throw new Error(message || `Gemini request failed (${response.status}).`)
  }

  const candidate = payload.candidates?.[0]
  const text = candidate?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim()

  if (!text) {
    throw new Error(
      candidate?.finishReason
        ? `Gemini returned no text (${candidate.finishReason}).`
        : 'Gemini returned no text.',
    )
  }

  return text
}

const callCerebras = async ({
  apiToken,
  model,
  parts,
  responseSchema,
  timeoutMs,
}: StrongAiCallOptions): Promise<string> => {
  if (parts.some((part) => part.inline_data)) {
    throw new Error(
      'Cerebras text mode cannot read images directly. Use Basic OCR, Google Local AI, or Gemini image extraction for images.',
    )
  }

  const prompt = parts
    .map((part) => part.text || '')
    .filter(Boolean)
    .join('\n\n')
  const responseFormat = responseSchema
    ? {
        type: 'json_schema',
        json_schema: {
          name: 'studymesh_response',
          strict: true,
          schema: toJsonSchema(responseSchema),
        },
      }
    : undefined
  const response = await withTimeout(timeoutMs, (signal) =>
    fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      signal,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_completion_tokens: 8192,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
    }),
  )

  const payload = (await response.json()) as CerebrasResponse
  if (!response.ok) {
    const message = payload.error?.message || ''
    if (response.status === 401 || /auth|api key|token/i.test(message)) {
      throw new Error(
        `Cerebras API key was rejected. Check the key in Settings. ${message}`.trim(),
      )
    }

    if (response.status === 429 || /rate limit|quota|limit/i.test(message)) {
      throw new Error(
        `${STRONG_AI_PROVIDERS.cerebras.rateLimitMessage} ${message}`.trim(),
      )
    }

    throw new Error(message || `Cerebras request failed (${response.status}).`)
  }

  const choice = payload.choices?.[0]
  const text = choice?.message?.content?.trim()
  if (!text) {
    throw new Error(
      choice?.finish_reason
        ? `Cerebras returned no text (${choice.finish_reason}).`
        : 'Cerebras returned no text.',
    )
  }

  return text
}

export const callStrongAiModel = async (
  options: StrongAiCallOptions,
): Promise<string> =>
  options.provider === 'cerebras' ? callCerebras(options) : callGemini(options)
