import { isSupabaseConfigured, supabase } from '../../auth/supabaseClient'
import type { StrongAiCallOptions } from './strongProviders'
import {
  HOSTED_AI_INSUFFICIENT_CREDITS_EVENT,
  HOSTED_AI_USAGE_CHANGED_EVENT,
  HOSTED_AI_VISUAL_SPEND_EVENT,
  getHostedAiCreditCost,
  isCurrencyShortageMessage,
} from './hostedCredits'
import type {
  HostedAiGatewayRequest,
  HostedAiGatewayResponse,
  HostedAiPodcast,
  HostedAiStage,
  HostedAiStatus,
  HostedAiSurface,
} from './hostedCredits'

export type HostedAiModelOptions = Pick<
  StrongAiCallOptions,
  'parts' | 'responseSchema' | 'timeoutMs' | 'signal'
> & {
  surface: HostedAiSurface
  stage?: HostedAiStage
  /** Optional: the gateway picks the model for the stage it runs. */
  model?: StrongAiCallOptions['model']
  outputLanguage?: StrongAiCallOptions['outputLanguage']
}

export type HostedAiTransport = (
  options: StrongAiCallOptions,
) => Promise<string>

const HOSTED_AI_ENDPOINT = '/api/hosted-ai'
const PODCAST_AUDIO_ENDPOINT = '/api/study-guide-podcast-audio'

const dispatchInsufficientCredits = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(HOSTED_AI_INSUFFICIENT_CREDITS_EVENT))
  }
}

const getHostedAiAccessToken = async (): Promise<string> => {
  if (!isSupabaseConfigured) {
    throw new Error('Hosted AI needs Supabase to be configured.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw new Error(error.message || 'Could not read your Supabase session.')
  }

  const accessToken = data.session?.access_token
  if (!accessToken) {
    throw new Error('Sign in to use hosted Carrots.')
  }

  return accessToken
}

const parseGatewayResponse = async (
  response: Response,
): Promise<HostedAiGatewayResponse> => {
  try {
    return (await response.json()) as HostedAiGatewayResponse
  } catch {
    return {
      ok: false,
      error: {
        code: 'server_error',
        message: `Hosted AI returned an unreadable response (${response.status}).`,
      },
    }
  }
}

const formatHostedAiError = (
  payload: HostedAiGatewayResponse,
  response?: Response,
): Error => {
  const code = payload.error?.code
  const message = payload.error?.message

  if (code === 'insufficient_credits') {
    dispatchInsufficientCredits()
    return new Error(
      message ||
        'Not enough Carrots. Buy a carrot pack, switch provider, or bring your own key.',
    )
  }

  if (code === 'not_authenticated') {
    return new Error(
      message ||
        'Your hosted AI session expired. Sign in again, then retry the request.',
    )
  }

  if (response?.status === 401) {
    return new Error(
      'Your hosted AI session expired or the gateway rejected the request. Refresh, sign in again, then retry.',
    )
  }

  if (code === 'not_configured') {
    return new Error(
      message || 'Hosted AI is not configured on this deployment yet.',
    )
  }

  if (code === 'rate_limited') {
    return new Error(
      message || 'Hosted AI is rate limited right now. Try again later.',
    )
  }

  if (code === 'provider_auth') {
    return new Error(
      'Hosted AI reached the server, but the hosted model provider rejected the API key. Check the server OpenAI/Cerebras env var, restart the dev server if needed, then retry.',
    )
  }

  if (code === 'output_format') {
    return new Error(
      'Hosted AI returned unusable structured output. Try again; if it repeats, use the stronger model for this surface or reduce the request size.',
    )
  }

  if (message) {
    return new Error(message)
  }

  return new Error(
    response
      ? `Hosted AI request failed (${response.status}).`
      : 'Hosted AI request failed.',
  )
}

const dispatchHostedAiUsageChanged = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(HOSTED_AI_USAGE_CHANGED_EVENT))
  }
}

const dispatchHostedAiVisualSpend = (surface: HostedAiSurface): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(HOSTED_AI_VISUAL_SPEND_EVENT, {
        detail: { credits: getHostedAiCreditCost(surface) },
      }),
    )
  }
}

const assertHostedAiCreditsAvailable = async (
  surface: HostedAiSurface,
): Promise<void> => {
  const status = await getHostedAiStatus()
  const requiredCredits = getHostedAiCreditCost(surface)

  if (status.studyCredits < requiredCredits) {
    dispatchInsufficientCredits()
    throw new Error(
      `Not enough Carrots. This action needs ${requiredCredits} and you have ${status.studyCredits}.`,
    )
  }
}

const callHostedAiGateway = async (
  request: HostedAiGatewayRequest,
  signal?: AbortSignal,
): Promise<HostedAiGatewayResponse> => {
  const accessToken = await getHostedAiAccessToken()
  const response = await fetch(HOSTED_AI_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    signal,
    body: JSON.stringify(request),
  })
  const payload = await parseGatewayResponse(response)

  if (!response.ok || !payload.ok) {
    throw formatHostedAiError(payload, response)
  }

  return payload
}

export const getHostedAiStatus = async (): Promise<HostedAiStatus> => {
  const payload = await callHostedAiGateway({ action: 'status' })
  if (!payload.status) {
    throw new Error('Hosted AI did not return account status.')
  }

  return payload.status
}

const callHostedAiModelUnchecked = async ({
  surface,
  stage,
  model,
  outputLanguage,
  parts,
  responseSchema,
  timeoutMs,
  signal,
}: HostedAiModelOptions): Promise<string> => {
  dispatchHostedAiVisualSpend(surface)

  try {
    const payload = await callHostedAiGateway(
      {
        action: 'generate',
        surface,
        ...(stage ? { stage } : {}),
        model,
        outputLanguage,
        parts,
        responseSchema,
        timeoutMs,
      },
      signal,
    )
    const text = payload.text?.trim()

    if (!text) {
      throw new Error('Hosted AI returned no text.')
    }

    return text
  } finally {
    dispatchHostedAiUsageChanged()
  }
}

export const isHostedAiInsufficientCreditsError = (
  error: unknown,
): boolean =>
  error instanceof Error && isCurrencyShortageMessage(error.message)

export const callHostedAiModel = async (
  options: HostedAiModelOptions,
): Promise<string> => {
  await assertHostedAiCreditsAvailable(options.surface)
  return callHostedAiModelUnchecked(options)
}

export const generateHostedAiPodcast = async ({
  sourceText,
  studyGuideId,
  sourceTitle,
  sourceScope,
  outputLanguage,
  signal,
}: {
  sourceText: string
  studyGuideId: string
  sourceTitle: string
  sourceScope: 'studyGuide' | 'currentPage'
  outputLanguage?: HostedAiModelOptions['outputLanguage']
  signal?: AbortSignal
}): Promise<HostedAiPodcast> => {
  const surface: HostedAiSurface = 'podcast'
  await assertHostedAiCreditsAvailable(surface)
  dispatchHostedAiVisualSpend(surface)

  try {
    const payload = await callHostedAiGateway(
      {
        action: 'generatePodcast',
        surface,
        outputLanguage,
        parts: [{ text: sourceText }],
        podcastOptions: {
          studyGuideId,
          sourceTitle,
          sourceScope,
        },
        timeoutMs: 90_000,
      },
      signal,
    )

    if (!payload.podcast) {
      throw new Error('Hosted AI returned no podcast.')
    }

    return payload.podcast
  } finally {
    dispatchHostedAiUsageChanged()
  }
}

export const getHostedAiPodcastAudioUrl = async (
  audioPath: string,
): Promise<string> => {
  const accessToken = await getHostedAiAccessToken()
  const response = await fetch(PODCAST_AUDIO_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ audioPath }),
  })

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean
    signedUrl?: string
    error?: { message?: string }
  } | null

  if (!response.ok || !payload?.ok || !payload.signedUrl) {
    throw new Error(payload?.error?.message || 'Could not open podcast audio.')
  }

  return payload.signedUrl
}

export const deleteHostedAiPodcastAudio = async (
  audioPath: string,
  deletedReason: 'page-deleted' | 'study-guide-deleted' = 'page-deleted',
): Promise<void> => {
  const accessToken = await getHostedAiAccessToken()
  await fetch(PODCAST_AUDIO_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'delete', audioPath, deletedReason }),
  })
}

export const createHostedAiTransport = ({
  surface,
}: {
  surface: HostedAiSurface
}): HostedAiTransport => {
  return async ({
    model,
    outputLanguage,
    parts,
    responseSchema,
    timeoutMs,
    signal,
  }: StrongAiCallOptions) => {
    await assertHostedAiCreditsAvailable(surface)

    return callHostedAiModelUnchecked({
      surface,
      model,
      outputLanguage,
      parts,
      responseSchema,
      timeoutMs,
      signal,
    })
  }
}

export const createHostedStudyGuideTransportWithQuickStart = ({
  userKnownTopics,
  outputLanguage,
  onQuickStart,
  onBridgeBlocks,
}: {
  userKnownTopics?: string[]
  outputLanguage?: StrongAiCallOptions['outputLanguage']
  onQuickStart: (
    quickStart: NonNullable<HostedAiGatewayResponse['quickStart']>,
  ) => void
  onBridgeBlocks?: (
    bridgeBlocks: NonNullable<HostedAiGatewayResponse['bridgeBlocks']>,
  ) => void
}): HostedAiTransport => {
  return async ({
    model,
    parts,
    responseSchema,
    timeoutMs,
    signal,
  }: StrongAiCallOptions) => {
    const surface: HostedAiSurface = 'study-guide'
    await assertHostedAiCreditsAvailable(surface)
    dispatchHostedAiVisualSpend(surface)

    try {
      const payload = await callHostedAiGateway(
        {
          action: 'generateWithQuickStart',
          surface,
          model,
          outputLanguage,
          parts,
          responseSchema,
          timeoutMs,
          quickStartOptions: {
            ...(userKnownTopics?.length ? { userKnownTopics } : {}),
          },
        },
        signal,
      )
      const text = payload.text?.trim()

      if (!text) {
        throw new Error('Hosted AI returned no text.')
      }

      if (!payload.quickStart) {
        throw new Error('Hosted AI returned no Quick Start.')
      }

      onQuickStart(payload.quickStart)
      onBridgeBlocks?.(payload.bridgeBlocks || [])
      return text
    } finally {
      dispatchHostedAiUsageChanged()
    }
  }
}
