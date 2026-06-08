import { isSupabaseConfigured, supabase } from '../../auth/supabaseClient'
import type { StrongAiCallOptions } from './strongProviders'
import {
  HOSTED_AI_USAGE_CHANGED_EVENT,
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
  requestId?: string
}

export type HostedAiTransport = (
  options: StrongAiCallOptions,
) => Promise<string>

const HOSTED_AI_ENDPOINT = '/api/hosted-ai'

const createRequestId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `hosted-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

export const callHostedAiModel = async ({
  surface,
  requestId = createRequestId(),
  model,
  parts,
  responseSchema,
  timeoutMs,
}: HostedAiModelOptions): Promise<string> => {
  const payload = await callHostedAiGateway({
    action: 'generate',
    requestId,
    surface,
    model,
    parts,
    responseSchema,
    timeoutMs,
  })
  const text = payload.text?.trim()

  dispatchHostedAiUsageChanged()

  if (!text) {
    throw new Error('Hosted AI returned no text.')
  }

  return text
}

export const createHostedAiTransport = ({
  surface,
  requestId = createRequestId(),
}: {
  surface: HostedAiSurface
  requestId?: string
}): HostedAiTransport => async ({
  model,
  parts,
  responseSchema,
  timeoutMs,
}: StrongAiCallOptions) =>
  callHostedAiModel({
    surface,
    requestId,
    model,
    parts,
    responseSchema,
    timeoutMs,
  })
