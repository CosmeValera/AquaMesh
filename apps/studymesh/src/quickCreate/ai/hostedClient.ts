import { isSupabaseConfigured, supabase } from '../../auth/supabaseClient'
import type { StudyGuideNextIdea } from '../../state/store'
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
  HostedAiPreviewEvent,
  HostedAiPodcast,
  HostedAiStatus,
  HostedAiStudyGuideJob,
  HostedAiStudyGuideProgress,
  HostedAiSurface,
} from './hostedCredits'

export type HostedAiModelOptions = Pick<
  StrongAiCallOptions,
  'model' | 'parts' | 'responseSchema' | 'timeoutMs' | 'signal'
> & {
  surface: HostedAiSurface
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

const NDJSON_CONTENT_TYPE = 'application/x-ndjson'

/**
 * Same call as `callHostedAiGateway`, read line by line.
 *
 * Each line is a preview event so the creation panel can show the guide being
 * written. Only the terminal `done` line is used to build anything: it carries
 * the exact body the non-streaming call returns.
 *
 * A gateway that answers with plain JSON - an older deployment, or any failure
 * raised before the model produced output - is handled by the normal path, so
 * every existing error code keeps its message and its side effects.
 */
const callHostedAiGatewayStreaming = async (
  request: HostedAiGatewayRequest,
  onPreview?: (event: HostedAiPreviewEvent) => void,
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
    body: JSON.stringify({ ...request, stream: true }),
  })

  const isNdjson = (response.headers.get('content-type') || '').includes(
    NDJSON_CONTENT_TYPE,
  )

  if (!isNdjson || !response.body) {
    const payload = await parseGatewayResponse(response)
    if (!response.ok || !payload.ok) {
      throw formatHostedAiError(payload, response)
    }

    return payload
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let result: HostedAiGatewayResponse | undefined

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) {
      return
    }

    let event: HostedAiPreviewEvent
    try {
      event = JSON.parse(trimmed) as HostedAiPreviewEvent
    } catch {
      // A torn line cannot happen mid-stream, and a preview is never worth
      // failing a paid generation over.
      return
    }

    if (event.type === 'done' || event.type === 'error') {
      result = event.response
      return
    }

    onPreview?.(event)
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    pending += decoder.decode(value, { stream: true })
    const lines = pending.split('\n')
    pending = lines.pop() || ''
    lines.forEach(handleLine)
  }

  handleLine(pending + decoder.decode())

  if (!result) {
    throw new Error('Hosted AI ended the response before finishing the guide.')
  }

  if (!result.ok) {
    throw formatHostedAiError(result)
  }

  return result
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

/**
 * Which of these generations the gateway still has, so the queue can tell a
 * free resume from a paid retry. Costs no Carrots and calls no model. An
 * unreachable or job-less gateway simply reports none, which leaves the
 * queue's own retry rules in charge.
 */
export interface HostedStudyGuideJobLookup {
  jobs: Record<string, HostedAiStudyGuideJob>
  /**
   * Jobs the gateway could not answer for. Nothing may be concluded about
   * these: an unreachable gateway is not proof that a generation is gone, and
   * treating it as such is what made a refresh look like a failure.
   */
  unresolvedIds: string[]
}

export const getHostedStudyGuideJobs = async (
  clientJobIds: readonly string[],
): Promise<HostedStudyGuideJobLookup> => {
  const found = await Promise.all(
    clientJobIds.map(async (clientJobId) => {
      try {
        const payload = await callHostedAiGateway({
          action: 'studyGuideJob',
          clientJobId,
        })
        // The gateway says it could not look, so neither can we.
        if (payload.lookupFailed) {
          return { clientJobId, unresolved: true as const }
        }

        return { clientJobId, job: payload.job }
      } catch {
        return { clientJobId, unresolved: true as const }
      }
    }),
  )

  const jobs: Record<string, HostedAiStudyGuideJob> = {}
  const unresolvedIds: string[] = []
  found.forEach((entry) => {
    if ('unresolved' in entry) {
      unresolvedIds.push(entry.clientJobId)
      return
    }

    if (entry.job) {
      jobs[entry.job.clientJobId] = entry.job
    }
  })

  return { jobs, unresolvedIds }
}

/** A job the gateway is still working on, or has already finished for us. */
export const isResumableHostedStudyGuideJob = (
  job: HostedAiStudyGuideJob | undefined,
): boolean => job?.status === 'running' || job?.status === 'succeeded'

/**
 * The generation stopped without finishing and nothing is coming.
 *
 * Distinct from an ordinary failure because restarting costs Carrots, so the
 * card must offer a retry rather than take one.
 */
export class HostedStudyGuideDeadJobError extends Error {
  constructor() {
    super('This Study Guide stopped before it was finished.')
    this.name = 'HostedStudyGuideDeadJobError'
  }
}

const STUDY_GUIDE_JOB_POLL_MS = 3000
/** Comfortably past the gateway's own generation timeout. */
const STUDY_GUIDE_JOB_POLL_TIMEOUT_MS = 5 * 60 * 1000

const wait = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })

/**
 * Waits for a generation that is already running on the server.
 *
 * Reached after a refresh or a reopened tab: the work was paid for and is
 * still going, so the only thing left to do is collect it. No model call and
 * no charge happen on this path.
 */
const awaitHostedStudyGuideJob = async (
  clientJobId: string,
  onProgress?: (progress: HostedAiStudyGuideProgress) => void,
  signal?: AbortSignal,
): Promise<HostedAiGatewayResponse> => {
  const deadline = Date.now() + STUDY_GUIDE_JOB_POLL_TIMEOUT_MS
  let consecutiveFailures = 0

  for (;;) {
    await wait(STUDY_GUIDE_JOB_POLL_MS, signal)

    let payload: HostedAiGatewayResponse
    try {
      payload = await callHostedAiGateway(
        { action: 'studyGuideJob', clientJobId },
        signal,
      )
      consecutiveFailures = 0
    } catch (error) {
      // A blip while polling is not a lost guide. Only give up once the
      // gateway has been unreachable for a while.
      consecutiveFailures += 1
      if (consecutiveFailures >= 4 || Date.now() > deadline) {
        throw error
      }

      continue
    }

    const job = payload.job

    if (job?.status === 'succeeded' && job.response) {
      return job.response
    }

    if (job?.status === 'failed') {
      throw new Error(
        job.errorMessage || 'Hosted AI could not finish this Study Guide.',
      )
    }

    if (job?.status === 'dead') {
      throw new HostedStudyGuideDeadJobError()
    }

    if (!job) {
      throw new Error('Hosted AI lost track of this Study Guide.')
    }

    // Keeps the card's checklist moving while we wait on work we cannot see.
    if (job.progress) {
      onProgress?.(job.progress)
    }

    if (Date.now() > deadline) {
      throw new Error(
        'Hosted AI is still working on this Study Guide. Reopen it in a moment.',
      )
    }
  }
}

export const createHostedStudyGuideTransportWithQuickStart = ({
  userKnownTopics,
  outputLanguage,
  clientJobId,
  retry,
  onQuickStart,
  onBridgeBlocks,
  onLearnedSkillOptions,
  onNextGuideIdeas,
  onPreview,
  onResumed,
}: {
  userKnownTopics?: string[]
  /** Makes the generation resumable, and safe to request more than once. */
  clientJobId?: string
  /** Set only from an explicit user retry; it permits a fresh paid attempt. */
  retry?: boolean
  /**
   * Called when this call turned out to be a resume rather than a generation,
   * with whatever the gateway has finished so far.
   */
  onResumed?: (state: {
    progress?: HostedAiStudyGuideProgress
    createdAt?: string
  }) => void
  outputLanguage?: StrongAiCallOptions['outputLanguage']
  onQuickStart: (
    quickStart: NonNullable<HostedAiGatewayResponse['quickStart']>,
  ) => void
  onBridgeBlocks?: (
    bridgeBlocks: NonNullable<HostedAiGatewayResponse['bridgeBlocks']>,
  ) => void
  onLearnedSkillOptions?: (options: string[]) => void
  onNextGuideIdeas?: (ideas: StudyGuideNextIdea[]) => void
  /** Supplied only when the caller has somewhere to show the guide forming. */
  onPreview?: (event: HostedAiPreviewEvent) => void
}): HostedAiTransport => {
  return async ({
    model,
    parts,
    responseSchema,
    timeoutMs,
    signal,
  }: StrongAiCallOptions) => {
    const surface: HostedAiSurface = 'study-guide'
    // A resumable job may cost nothing, but the balance still has to cover a
    // first attempt, and the server is the one that decides which this is.
    await assertHostedAiCreditsAvailable(surface)
    dispatchHostedAiVisualSpend(surface)

    // The same tail whether the guide was watched live or collected later.
    const finishTransport = (payload: HostedAiGatewayResponse): string => {
      const text = payload.text?.trim()

      if (!text) {
        throw new Error('Hosted AI returned no text.')
      }

      if (!payload.quickStart) {
        throw new Error('Hosted AI returned no Quick Start.')
      }

      onQuickStart(payload.quickStart)
      onBridgeBlocks?.(payload.bridgeBlocks || [])
      onLearnedSkillOptions?.(payload.learnedSkillOptions || [])
      onNextGuideIdeas?.(payload.nextGuideIdeas || [])
      return text
    }

    try {
      const gatewayRequest: HostedAiGatewayRequest = {
        action: 'generateWithQuickStart',
        surface,
        model,
        outputLanguage,
        parts,
        responseSchema,
        timeoutMs,
        ...(clientJobId ? { clientJobId } : {}),
        ...(retry ? { retry: true } : {}),
        quickStartOptions: {
          ...(userKnownTopics?.length ? { userKnownTopics } : {}),
        },
      }
      const firstPayload = onPreview
        ? await callHostedAiGatewayStreaming(gatewayRequest, onPreview, signal)
        : await callHostedAiGateway(gatewayRequest, signal)

      if (firstPayload.dead) {
        throw new HostedStudyGuideDeadJobError()
      }

      // The same guide is already being generated, so wait for that one rather
      // than starting - and paying for - a second.
      if (!firstPayload.pending || !clientJobId) {
        return finishTransport(firstPayload)
      }

      // Paint what the gateway has already written before the first poll lands.
      onResumed?.({
        progress: firstPayload.progress,
        createdAt: firstPayload.createdAt,
      })
      return finishTransport(
        await awaitHostedStudyGuideJob(
          clientJobId,
          (progress) => onResumed?.({ progress }),
          signal,
        ),
      )
    } finally {
      dispatchHostedAiUsageChanged()
    }
  }
}
