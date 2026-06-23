import { isSupabaseConfigured, supabase } from '../../auth/supabaseClient'
import type { StrongAiCallOptions } from './strongProviders'
import {
  HOSTED_AI_INSUFFICIENT_CREDITS_EVENT,
  HOSTED_AI_USAGE_CHANGED_EVENT,
  HOSTED_AI_VISUAL_REFUND_EVENT,
  HOSTED_AI_VISUAL_SPEND_EVENT,
  getHostedAiCreditCost,
} from './hostedCredits'
import type {
  HostedAiGatewayRequest,
  HostedAiGatewayResponse,
  HostedAiStatus,
  HostedAiSurface,
} from './hostedCredits'

export type HostedAiModelOptions = Pick<
  StrongAiCallOptions,
  'model' | 'parts' | 'responseSchema' | 'timeoutMs'
> & {
  surface: HostedAiSurface
}

export type HostedAiTransport = (
  options: StrongAiCallOptions,
) => Promise<string>

const HOSTED_AI_ENDPOINT = '/api/hosted-ai'

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
    throw new Error('Sign in to use hosted Study Credits.')
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
        'Not enough Study Credits. Wait for the daily refill, switch provider, or bring your own key.',
    )
  }

  if (code === 'not_authenticated') {
    return new Error(message || 'Sign in to use hosted Study Credits.')
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

const dispatchHostedAiVisualRefund = (surface: HostedAiSurface): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(HOSTED_AI_VISUAL_REFUND_EVENT, {
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
      `Not enough Study Credits. This action needs ${requiredCredits} SC and you have ${status.studyCredits} SC.`,
    )
  }
}

const callHostedAiGateway = async (
  request: HostedAiGatewayRequest,
): Promise<HostedAiGatewayResponse> => {
  const accessToken = await getHostedAiAccessToken()
  const response = await fetch(HOSTED_AI_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
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

export const markHostedAiIntroSeen = async (): Promise<HostedAiStatus> => {
  const payload = await callHostedAiGateway({ action: 'markIntroSeen' })
  if (!payload.status) {
    throw new Error('Hosted AI did not return account status.')
  }

  dispatchHostedAiUsageChanged()
  return payload.status
}

const callHostedAiModelUnchecked = async ({
  surface,
  model,
  parts,
  responseSchema,
  timeoutMs,
}: HostedAiModelOptions): Promise<string> => {
  dispatchHostedAiVisualSpend(surface)

  try {
    const payload = await callHostedAiGateway({
      action: 'generate',
      surface,
      model,
      parts,
      responseSchema,
      timeoutMs,
    })
    const text = payload.text?.trim()

    if (!text) {
      throw new Error('Hosted AI returned no text.')
    }

    return text
  } catch (error) {
    dispatchHostedAiVisualRefund(surface)
    throw error
  } finally {
    dispatchHostedAiUsageChanged()
  }
}

export const callHostedAiModel = async (
  options: HostedAiModelOptions,
): Promise<string> => {
  await assertHostedAiCreditsAvailable(options.surface)
  return callHostedAiModelUnchecked(options)
}

export const createHostedAiTransport = ({
  surface,
}: {
  surface: HostedAiSurface
}): HostedAiTransport => {
  return async ({
    model,
    parts,
    responseSchema,
    timeoutMs,
  }: StrongAiCallOptions) => {
    await assertHostedAiCreditsAvailable(surface)

    return callHostedAiModelUnchecked({
      surface,
      model,
      parts,
      responseSchema,
      timeoutMs,
    })
  }
}

export const createHostedStudyGuideTransportWithTldr = ({
  onTldr,
}: {
  onTldr: (tldr: string) => void
}): HostedAiTransport => {
  return async ({
    model,
    parts,
    responseSchema,
    timeoutMs,
  }: StrongAiCallOptions) => {
    const surface: HostedAiSurface = 'study-guide'
    await assertHostedAiCreditsAvailable(surface)
    dispatchHostedAiVisualSpend(surface)

    try {
      const payload = await callHostedAiGateway({
        action: 'generateWithTldr',
        surface,
        model,
        parts,
        responseSchema,
        timeoutMs,
      })
      const text = payload.text?.trim()

      if (!text) {
        throw new Error('Hosted AI returned no text.')
      }

      onTldr(payload.tldr || '')
      return text
    } catch (error) {
      dispatchHostedAiVisualRefund(surface)
      throw error
    } finally {
      dispatchHostedAiUsageChanged()
    }
  }
}
