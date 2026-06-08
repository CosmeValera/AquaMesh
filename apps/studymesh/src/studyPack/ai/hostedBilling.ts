import { isSupabaseConfigured, supabase } from '../../auth/supabaseClient'
import {
  DEFAULT_HOSTED_AI_CREDIT_PACK_ID,
  HOSTED_AI_USAGE_CHANGED_EVENT,
  HostedAiCreditPackId,
} from './hostedCredits'

interface HostedAiBillingResponse {
  ok: boolean
  checkoutUrl?: string
  error?: {
    code?: string
    message?: string
  }
}

const HOSTED_AI_BILLING_ENDPOINT = '/api/hosted-ai-billing'

const getAccessToken = async (): Promise<string> => {
  if (!isSupabaseConfigured) {
    throw new Error('Study Credits billing needs Supabase to be configured.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw new Error(error.message || 'Could not read your Supabase session.')
  }

  const accessToken = data.session?.access_token
  if (!accessToken) {
    throw new Error('Sign in to buy Study Credits.')
  }

  return accessToken
}

const parseBillingResponse = async (
  response: Response,
): Promise<HostedAiBillingResponse> => {
  try {
    return (await response.json()) as HostedAiBillingResponse
  } catch {
    return {
      ok: false,
      error: {
        code: 'server_error',
        message: `Study Credits billing returned an unreadable response (${response.status}).`,
      },
    }
  }
}

const formatBillingError = (
  payload: HostedAiBillingResponse,
  response: Response,
): Error => {
  const code = payload.error?.code
  const message = payload.error?.message

  if (code === 'not_authenticated') {
    return new Error(message || 'Sign in to buy Study Credits.')
  }

  if (code === 'not_configured') {
    return new Error(
      message ||
        'Study Credits payments are not configured on this deployment.',
    )
  }

  if (code === 'payment_error') {
    return new Error(message || 'Could not start Stripe Checkout.')
  }

  return new Error(
    message || `Study Credits checkout failed (${response.status}).`,
  )
}

export const notifyHostedAiCreditsChanged = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(HOSTED_AI_USAGE_CHANGED_EVENT))
  }
}

export const createHostedAiCreditCheckout = async (
  packId: HostedAiCreditPackId = DEFAULT_HOSTED_AI_CREDIT_PACK_ID,
): Promise<string> => {
  const accessToken = await getAccessToken()
  const response = await fetch(HOSTED_AI_BILLING_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'createCheckout', packId }),
  })
  const payload = await parseBillingResponse(response)

  if (!response.ok || !payload.ok || !payload.checkoutUrl) {
    throw formatBillingError(payload, response)
  }

  return payload.checkoutUrl
}

export const redirectToHostedAiCreditCheckout = async (
  packId: HostedAiCreditPackId = DEFAULT_HOSTED_AI_CREDIT_PACK_ID,
): Promise<void> => {
  const checkoutUrl = await createHostedAiCreditCheckout(packId)
  window.location.assign(checkoutUrl)
}
