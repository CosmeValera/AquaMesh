import {
  callLocalLanguageModel,
  callStrongAiModel,
  isStrongAiProvider,
  readQuickCreateAiSettings,
  resolveQuickCreateAiCredentials,
  STRONG_AI_PROVIDERS,
} from '../quickCreate/ai'
import { callHostedAiModel } from '../quickCreate/ai/hostedClient'
import {
  createAiOutputLanguageInstruction,
  isLocalAiContentLanguageSupported,
  resolveContentLanguage,
  type StudyMeshLanguageCode,
} from '../language/contentLanguage'

export type DashboardChatSourceId = 'study-guide' | 'general' | 'web'

export interface DashboardChatSourcePlan {
  selectedSources: DashboardChatSourceId[]
  shouldSearchWeb: boolean
  searchQuery: string
  answerStyleHint: string
}

interface PlanDashboardChatSourcesOptions {
  question: string
  dashboardTitle: string
  contextSummary: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  selectedSources: DashboardChatSourceId[]
  contentLanguage?: StudyMeshLanguageCode
  signal?: AbortSignal
}

const SOURCE_PLANNER_TIMEOUT_MS = 20_000
const VALID_SOURCE_IDS: DashboardChatSourceId[] = [
  'study-guide',
  'general',
  'web',
]

const WEB_LOOKUP_CUE_PATTERN =
  /\b(?:search|look up|lookup|internet|web|online|latest|current|up[- ]?to[- ]?date|source|sources|citation|cite)\b/i

const STUDY_GUIDE_SCOPE_PATTERN =
  /\b(?:(?:in|from|according to|mentioned in|covered in|inside) (?:the |this )?(?:study )?(?:guide|dashboard|notes|material|context)|(?:guide|dashboard|notes|material|context) (?:mentions?|says?|covers?|lists?|includes?)|(?:en|segun|según|de|mencionad[oa]s? en) (?:la |el |esta |este )?(?:guia|guía|material|contexto|panel|apuntes))\b/i
const MIXED_CONTEXT_CUE_PATTERN =
  /\b(?:compare|comparison|difference|missing|omits?|outside|beyond|standard|complete|full|compara|comparación|diferencia|faltan?|omite|fuera|complet[oa]s?)\b/i

const extractJsonObject = (value: string): string => {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : value
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')

  if (start < 0 || end <= start) {
    throw new Error('Source planner did not return JSON.')
  }

  return candidate.slice(start, end + 1)
}

const normalizeSelectedSources = (
  value: unknown,
  fallback: DashboardChatSourceId[],
): DashboardChatSourceId[] => {
  if (!Array.isArray(value)) {
    return fallback
  }

  const selected = value.filter((item): item is DashboardChatSourceId =>
    VALID_SOURCE_IDS.includes(item as DashboardChatSourceId),
  )

  return Array.from(new Set(selected)).length > 0
    ? Array.from(new Set(selected))
    : fallback
}

const truncate = (value: string, maxLength: number): string =>
  value.length > maxLength ? value.slice(0, maxLength).trim() : value

const fallbackSearchQuery = (question: string): string =>
  truncate(
    question
      .replace(/\b(?:please|por favor|urgente|urgent|jeje+|haha+)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
    240,
  )

export const fallbackDashboardChatSourcePlan = (
  question: string,
  selectedSources: DashboardChatSourceId[],
): DashboardChatSourcePlan => {
  const explicitSources = selectedSources.length > 0
  const shouldSearchWeb = explicitSources
    ? selectedSources.includes('web')
    : WEB_LOOKUP_CUE_PATTERN.test(question)

  return {
    selectedSources: explicitSources
      ? selectedSources
      : shouldSearchWeb
        ? ['study-guide', 'general', 'web']
        : ['study-guide', 'general'],
    shouldSearchWeb,
    searchQuery: fallbackSearchQuery(question),
    answerStyleHint:
      'Respect the student requested format and avoid unnecessary extra sections.',
  }
}

export const applyDashboardChatSourcePolicy = (
  question: string,
  selectedSources: DashboardChatSourceId[],
  plan: DashboardChatSourcePlan,
): DashboardChatSourcePlan => {
  if (selectedSources.length > 0) {
    return plan
  }

  if (STUDY_GUIDE_SCOPE_PATTERN.test(question)) {
    const needsGeneral = MIXED_CONTEXT_CUE_PATTERN.test(question)
    const needsWeb = WEB_LOOKUP_CUE_PATTERN.test(question)
    return {
      ...plan,
      selectedSources: [
        'study-guide',
        ...(needsGeneral ? (['general'] as const) : []),
        ...(needsWeb ? (['web'] as const) : []),
      ],
      shouldSearchWeb: needsWeb,
    }
  }

  if (WEB_LOOKUP_CUE_PATTERN.test(question)) {
    return {
      ...plan,
      selectedSources: Array.from(
        new Set<DashboardChatSourceId>([
          ...plan.selectedSources,
          'general',
          'web',
        ]),
      ),
      shouldSearchWeb: true,
    }
  }

  if (plan.selectedSources.includes('web')) {
    return {
      ...plan,
      selectedSources: Array.from(
        new Set<DashboardChatSourceId>([...plan.selectedSources, 'general']),
      ),
    }
  }

  return plan
}

const buildPlannerPrompt = ({
  question,
  dashboardTitle,
  contextSummary,
  history,
  selectedSources,
  outputLanguage,
}: PlanDashboardChatSourcesOptions & {
  outputLanguage: StudyMeshLanguageCode
}) => {
  const selectedSourceText =
    selectedSources.length > 0
      ? selectedSources.join(', ')
      : 'Auto: choose the useful sources'
  const recentChat = history
    .slice(-4)
    .map(
      (message) =>
        `${message.role === 'user' ? 'Student' : 'Assistant'}: ${
          message.content
        }`,
    )
    .join('\n')

  return `Plan how StudyMesh AI Chat should answer the student's next message.

Rules:
- ${createAiOutputLanguageInstruction(outputLanguage)}
- Return strict JSON only.
- Valid selectedSources values: "study-guide", "general", "web".
- If the user explicitly selected sources, keep selectedSources inside that set.
- If the source selection is Auto, choose sources that best answer the question.
- shouldSearchWeb must be true only when "web" is selectedSources and the answer needs a fresh web lookup.
- Rewrite searchQuery for a search engine, not for a chatbot: remove filler, apologies, jokes, false starts, and corrections while preserving the actual information need and constraints.
- Do not hardcode special cases. Infer the user's real task and requested answer shape.
- answerStyleHint should briefly preserve format requirements such as list-only, table, concise, exact count, language, or no extra explanation.

JSON shape:
{
  "selectedSources": ["study-guide" | "general" | "web"],
  "shouldSearchWeb": true,
  "searchQuery": "clean search query",
  "answerStyleHint": "short instruction"
}

Dashboard title: ${dashboardTitle}

Current source selection: ${selectedSourceText}

Dashboard context summary:
${truncate(contextSummary || 'None', 1200)}

Recent chat:
${recentChat || 'None'}

Student message:
${question}`
}

const callPlannerModel = async (
  prompt: string,
  outputLanguage: StudyMeshLanguageCode,
  signal?: AbortSignal,
): Promise<string> => {
  const settings = readQuickCreateAiSettings()
  const provider = settings.provider || 'hosted'

  if (provider === 'hosted') {
    return callHostedAiModel({
      surface: 'chat',
      model: STRONG_AI_PROVIDERS.cerebras.defaultModel,
      outputLanguage,
      parts: [{ text: prompt }],
      timeoutMs: SOURCE_PLANNER_TIMEOUT_MS,
      signal,
    })
  }

  if (provider === 'local') {
    if (!isLocalAiContentLanguageSupported(outputLanguage)) {
      throw new Error('Local AI does not support this planner language.')
    }

    return callLocalLanguageModel(prompt, {
      outputLanguage,
      promptType: 'notes',
      stepLabel: 'Plan chat answer sources',
      signal,
    })
  }

  if (isStrongAiProvider(provider)) {
    const credentials = resolveQuickCreateAiCredentials(provider)
    if (!credentials.apiToken) {
      throw new Error('Source planner needs a configured provider key.')
    }

    return callStrongAiModel({
      provider,
      apiToken: credentials.apiToken,
      model: credentials.model,
      parts: [{ text: prompt }],
      timeoutMs: SOURCE_PLANNER_TIMEOUT_MS,
      signal,
    })
  }

  throw new Error('Unsupported AI provider for source planning.')
}

export const planDashboardChatSources = async (
  options: PlanDashboardChatSourcesOptions,
): Promise<DashboardChatSourcePlan> => {
  const fallback = fallbackDashboardChatSourcePlan(
    options.question,
    options.selectedSources,
  )
  const resolvedLanguage = resolveContentLanguage({
    text: options.question,
    inheritedLanguage: options.contentLanguage,
  })
  const prompt = buildPlannerPrompt({
    ...options,
    outputLanguage: resolvedLanguage.language,
  })
  const response = await callPlannerModel(
    prompt,
    resolvedLanguage.language,
    options.signal,
  )
  const parsed = JSON.parse(extractJsonObject(response)) as Record<
    string,
    unknown
  >
  const selectedSources = normalizeSelectedSources(
    parsed.selectedSources,
    fallback.selectedSources,
  ).filter((source) =>
    options.selectedSources.length > 0
      ? options.selectedSources.includes(source)
      : true,
  )
  const searchQuery = String(parsed.searchQuery || fallback.searchQuery)
    .replace(/\s+/g, ' ')
    .trim()

  return applyDashboardChatSourcePolicy(
    options.question,
    options.selectedSources,
    {
      selectedSources: selectedSources.length
        ? selectedSources
        : fallback.selectedSources,
      shouldSearchWeb:
        Boolean(parsed.shouldSearchWeb) &&
        (selectedSources.length
          ? selectedSources.includes('web')
          : fallback.selectedSources.includes('web')),
      searchQuery: searchQuery || fallback.searchQuery,
      answerStyleHint: String(
        parsed.answerStyleHint || fallback.answerStyleHint,
      ).trim(),
    },
  )
}
