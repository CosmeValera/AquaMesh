export const STUDY_CREDITS_LABEL = 'Study Credits'
export const STUDY_CREDITS_SYMBOL = 'SC'

export const HOSTED_AI_USAGE_CHANGED_EVENT = 'studymesh-hosted-ai-usage-changed'
export const HOSTED_AI_VISUAL_SPEND_EVENT = 'studymesh-hosted-ai-visual-spend'
export const HOSTED_AI_VISUAL_REFUND_EVENT = 'studymesh-hosted-ai-visual-refund'
export const HOSTED_AI_INSUFFICIENT_CREDITS_EVENT =
  'studymesh-hosted-ai-insufficient-credits'

export type HostedAiSurface = 'study-guide' | 'quick-create' | 'chat'

export const HOSTED_AI_CREDIT_COSTS: Record<HostedAiSurface, number> = {
  'study-guide': 2,
  'quick-create': 1,
  chat: 1,
}

export const HOSTED_AI_INITIAL_FREE_CREDITS = 20
export const HOSTED_AI_DAILY_FREE_CREDITS = 5
export const HOSTED_AI_REFILL_CURRENCY = 'eur'
export type HostedAiCreditPackId = 'starter' | 'popular' | 'value'

export interface HostedAiCreditPack {
  id: HostedAiCreditPackId
  credits: number
  priceCents: number
  currency: typeof HOSTED_AI_REFILL_CURRENCY
  label: string
  badge?: 'Economic' | 'Most popular' | 'Best value'
}

export const HOSTED_AI_CREDIT_PACKS: HostedAiCreditPack[] = [
  {
    id: 'starter',
    credits: 80,
    priceCents: 200,
    currency: HOSTED_AI_REFILL_CURRENCY,
    label: '2 EUR',
    badge: 'Economic',
  },
  {
    id: 'popular',
    credits: 250,
    priceCents: 500,
    currency: HOSTED_AI_REFILL_CURRENCY,
    label: '5 EUR',
    badge: 'Most popular',
  },
  {
    id: 'value',
    credits: 600,
    priceCents: 1000,
    currency: HOSTED_AI_REFILL_CURRENCY,
    label: '10 EUR',
    badge: 'Best value',
  },
]

export const DEFAULT_HOSTED_AI_CREDIT_PACK_ID: HostedAiCreditPackId = 'popular'

export interface HostedAiStatus {
  available: boolean
  accountReady: boolean
  introSeen: boolean
  studyCredits: number
  nextDailyRefillAt?: string
  dailyFreeCredits: number
  initialFreeCredits: number
  costs: Record<HostedAiSurface, number>
  message?: string
}

export interface HostedAiGatewayPart {
  text?: string
  inline_data?: {
    mime_type: string
    data: string
  }
}

export interface HostedAiGatewayRequest {
  action: 'status' | 'markIntroSeen' | 'generate' | 'generateWithTldr'
  surface?: HostedAiSurface
  model?: string
  parts?: HostedAiGatewayPart[]
  responseSchema?: Record<string, unknown>
  timeoutMs?: number
}

export interface HostedAiGatewayResponse {
  ok: boolean
  text?: string
  tldr?: string
  status?: HostedAiStatus
  error?: {
    code:
      | 'not_authenticated'
      | 'not_configured'
      | 'insufficient_credits'
      | 'invalid_request'
      | 'provider_error'
      | 'rate_limited'
      | 'server_error'
    message: string
  }
}

export const getHostedAiCreditCost = (surface: HostedAiSurface): number =>
  HOSTED_AI_CREDIT_COSTS[surface]
