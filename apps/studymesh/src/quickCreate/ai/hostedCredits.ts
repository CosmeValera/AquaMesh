import type {
  StudyGuideNextIdea,
  StudyGuideQuickStart,
} from '../../state/store'
import type { StudyMeshLanguageCode } from '../../language/contentLanguage'
import type { StudyGuideKnowledgeBridgeBlock } from '../../studyGuides/quickStart'

export const STUDY_CREDITS_LABEL = 'Carrots'
export const STUDY_CREDITS_SYMBOL = 'SC'

// Shortage detection has to stay two-part: a shortage phrase AND the currency name.
// Matching the currency name alone would classify any message that merely mentions
// Carrots as a shortage, including billing-config errors.
// Both wordings are accepted so the server-side SQL raise and any message cached from
// an earlier session still resolve after the Study Credits to Carrots rename.
const CURRENCY_NAME_SOURCE = '(?:study credits|carrots)'
const SHORTAGE_PHRASE_SOURCE =
  "(?:not enough|insufficient|don't have enough|do not have enough)"
const CURRENCY_SHORTAGE_PATTERN = new RegExp(
  `${SHORTAGE_PHRASE_SOURCE}.*${CURRENCY_NAME_SOURCE}|${CURRENCY_NAME_SOURCE}.*${SHORTAGE_PHRASE_SOURCE}`,
  'i',
)

export const isCurrencyShortageMessage = (message?: string | null): boolean =>
  Boolean(message && CURRENCY_SHORTAGE_PATTERN.test(message))

export const HOSTED_AI_USAGE_CHANGED_EVENT = 'studymesh-hosted-ai-usage-changed'
export const HOSTED_AI_VISUAL_SPEND_EVENT = 'studymesh-hosted-ai-visual-spend'
export const HOSTED_AI_INSUFFICIENT_CREDITS_EVENT =
  'studymesh-hosted-ai-insufficient-credits'

export type HostedAiSurface =
  | 'study-guide'
  | 'quick-create'
  | 'study-page'
  | 'chat'
  | 'chat-followup'
  | 'podcast'
export type HostedAiStage =
  | 'study_guide_main'
  | 'study_guide_monolith'
  | 'study_guide_blueprint'
  | 'study_guide_page_expand'
  | 'study_guide_final_quiz'
  | 'study_guide_known_topic_prefilter'
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
  'study-guide': 3,
  'quick-create': 1,
  // One more page inside a guide the reader already paid for. Its own surface
  // rather than 'quick-create' so the price can move without a migration.
  'study-page': 1,
  chat: 1,
  // Follow-up model calls inside one chat message (answer, list repair).
  // The single chat credit is charged upfront by the planner call.
  'chat-followup': 0,
  podcast: 1,
}

export const HOSTED_AI_INITIAL_FREE_CREDITS = 30
export const HOSTED_AI_DAILY_FREE_CREDIT_FLOOR = 7
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
    credits: 150,
    priceCents: 200,
    currency: HOSTED_AI_REFILL_CURRENCY,
    label: '2 EUR',
    badge: 'Economic',
  },
  {
    id: 'popular',
    credits: 450,
    priceCents: 500,
    currency: HOSTED_AI_REFILL_CURRENCY,
    label: '5 EUR',
    badge: 'Most popular',
  },
  {
    id: 'value',
    credits: 1000,
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
  dailyFreeCreditFloor: number
  nextDailyRefillAt?: string
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
  /** Skill names offered after the quiz, generated with the guide. */
  learnedSkillOptions?: string[]
  /** Follow-up guides offered once the learner claims the topic. */
  nextGuideIdeas?: StudyGuideNextIdea[]
  podcast?: HostedAiPodcast
  status?: HostedAiStatus
  error?: {
    code:
      | 'not_authenticated'
      | 'not_configured'
      | 'insufficient_credits'
      | 'invalid_request'
      | 'output_format'
      | 'provider_auth'
      | 'provider_error'
      | 'rate_limited'
      | 'server_error'
    message: string
  }
}

export const getHostedAiCreditCost = (surface: HostedAiSurface): number =>
  HOSTED_AI_CREDIT_COSTS[surface]
