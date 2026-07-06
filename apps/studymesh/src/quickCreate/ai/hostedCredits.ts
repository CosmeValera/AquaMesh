import type { StudyGuideQuickStart } from '../../state/store'
import type { StudyMeshLanguageCode } from '../../language/contentLanguage'
import type { StudyGuideKnowledgeBridgeBlock } from '../../studyGuides/quickStart'

export const STUDY_CREDITS_LABEL = 'Study Credits'
export const STUDY_CREDITS_SYMBOL = 'SC'

export const HOSTED_AI_USAGE_CHANGED_EVENT = 'studymesh-hosted-ai-usage-changed'
export const HOSTED_AI_VISUAL_SPEND_EVENT = 'studymesh-hosted-ai-visual-spend'
export const HOSTED_AI_INSUFFICIENT_CREDITS_EVENT =
  'studymesh-hosted-ai-insufficient-credits'

export type HostedAiSurface =
  | 'study-guide'
  | 'quick-create'
  | 'chat'
  | 'podcast'
export type HostedAiStage =
  | 'study_guide_main'
  | 'quick_start_fallback'
  | 'quick_start_personalized'
  | 'quick_start_relevance_auto'
  | 'quick_start_relevance_force'
  | 'quick_start_forced_bridge'
  | 'knowledge_bridge_blocks'
  | 'podcast_script'
  | 'chat'
  | 'quick_create'

export const HOSTED_AI_CREDIT_COSTS: Record<HostedAiSurface, number> = {
  'study-guide': 2,
  'quick-create': 1,
  chat: 1,
  podcast: 1,
}

export const HOSTED_AI_INITIAL_FREE_CREDITS = 20
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
  action:
    | 'status'
    | 'markIntroSeen'
    | 'generate'
    | 'generateWithQuickStart'
    | 'generatePodcast'
  surface?: HostedAiSurface
  stage?: HostedAiStage
  model?: string
  outputLanguage?: StudyMeshLanguageCode
  parts?: HostedAiGatewayPart[]
  responseSchema?: Record<string, unknown>
  timeoutMs?: number
  quickStartOptions?: {
    userKnownTopics?: string[]
  }
  podcastOptions?: {
    studyGuideId: string
    sourceTitle: string
    sourceScope: 'studyGuide' | 'currentPage'
  }
}

export interface HostedAiStageCost {
  stage: HostedAiStage
  provider: string
  model: string
  promptCharacters: number
  responseCharacters: number
  inputTokens?: number
  cachedInputTokens?: number
  outputTokens?: number
  totalTokens?: number
  estimatedCostUsd?: number
}

export interface HostedAiPodcastTranscriptTurn {
  speaker: 'hostA' | 'hostB'
  text: string
}

export interface HostedAiPodcastChapter {
  title: string
  startTurn: number
}

export interface HostedAiPodcast {
  id: string
  title: string
  description: string
  audioPath: string
  mimeType: string
  transcriptTurns: HostedAiPodcastTranscriptTurn[]
  chapters: HostedAiPodcastChapter[]
  sourceTitle: string
  sourceScope: 'studyGuide' | 'currentPage'
  createdAt: string
}

export interface HostedAiGatewayResponse {
  ok: boolean
  text?: string
  quickStart?: StudyGuideQuickStart
  bridgeBlocks?: StudyGuideKnowledgeBridgeBlock[]
  podcast?: HostedAiPodcast
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
