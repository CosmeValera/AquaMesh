import {
  callLocalLanguageModel,
  callStrongAiModel,
  isStrongAiProvider,
  readQuickCreateAiSettings,
  resolveQuickCreateAiCredentials,
  STRONG_AI_PROVIDERS,
} from '../quickCreate/ai'
import { callHostedAiModel } from '../quickCreate/ai/hostedClient'
import { DashboardSourceChunk } from './contextBuilder'

interface AskDashboardOptions {
  dashboardTitle: string
  contextText: string
  question: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  sourceChunks: DashboardSourceChunk[]
}

export interface AskDashboardResult {
  answer: string
  sourceRefs: DashboardAnswerSourceRef[]
  needsExternalSource: boolean
}

export interface DashboardAnswerSourceRef {
  citationNumber: number
  chunkId: string
  title: string
  type: string
  textPreview: string
  origin?: 'dashboard' | 'web'
  url?: string
  dashboardKey?: string
  dashboardTitle?: string
  dashboardIndex?: number
}

const STRONG_MODEL_CHAT_TIMEOUT_MS = 45000
const STRONG_CHAT_RECENT_HISTORY_MESSAGES = 4
const SOURCE_GAP_MARKER = 'SOURCE_GAP:'

type ChatMemoryProvider = 'hosted' | 'local' | 'gemini' | 'cerebras' | string

interface ChatMemory {
  originalGoal?: string
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
}

const selectChatMemory = (
  history: AskDashboardOptions['history'],
  provider: ChatMemoryProvider,
): ChatMemory => {
  if (provider === 'local') {
    return { recentMessages: [] }
  }

  const originalUserMessage = history.find((message) => message.role === 'user')
  const recentMessages = history.slice(-STRONG_CHAT_RECENT_HISTORY_MESSAGES)
  const recentIncludesOriginal =
    originalUserMessage &&
    recentMessages.some((message) => message === originalUserMessage)

  return {
    originalGoal: recentIncludesOriginal
      ? undefined
      : originalUserMessage?.content,
    recentMessages,
  }
}

const formatChatMemory = ({ originalGoal, recentMessages }: ChatMemory) => {
  const sections: string[] = []

  if (originalGoal) {
    sections.push(`Original student goal: ${originalGoal}`)
  }

  if (recentMessages.length > 0) {
    sections.push(`Recent chat:
${recentMessages
  .map(
    (message) =>
      `${message.role === 'user' ? 'Student' : 'Assistant'}: ${
        message.content
      }`,
  )
  .join('\n')}`)
  }

  return sections.length > 0 ? sections.join('\n\n') : 'None'
}

const buildPrompt = ({
  dashboardTitle,
  contextText,
  question,
  memory,
}: Omit<AskDashboardOptions, 'history'> & {
  memory: ChatMemory
}) => `You are StudyMesh's dashboard assistant. Help the student understand the current dashboard.

Rules:
- Answer using only the provided dashboard, study, and web source context.
- Web sources in the context are allowed sources. Use them when dashboard-only material lacks the answer.
- If the answer is not supported by any provided context, start your answer with "${SOURCE_GAP_MARKER}" and say that the provided sources do not contain enough information.
- Do not invent facts, citations, links, or source names.
- When you use a specific source, cite it inline with its source number like [1] or [2].
- Citation format is strict: write every citation as a bracketed source number. If citing multiple sources, write separate bracket citations with spaces, like [3] [4].
- Never write bare citation numbers like 3, compressed citations like 3[4] or [3][4], or combined numbers like [34].
- Put sentence punctuation after the citations, like [3] [4].
- Only cite source numbers shown in the dashboard/source context.
- Do not add a final Sources, References, or Based on section. Use inline citations only.
- Be concise, clear, student-friendly, and practical.
- Use bullets, examples, and study tips when helpful.

Dashboard title: ${dashboardTitle}

Dashboard/source context:
${contextText}

Conversation memory:
${formatChatMemory(memory)}

Student question: ${question}

Answer:`

const sourceGapPatterns = [
  /\bdashboard sources?\b.*\b(?:do not|don't|does not|doesn't|lack|missing|not contain|insufficient|not enough)\b/i,
  /\bnot enough (?:information|context|source)/i,
  /\bno (?:source|dashboard) (?:content|context|information)/i,
  /\bprovided context\b.*\b(?:does not|doesn't|not enough|insufficient|lack)/i,
]

const cleanAnswer = (answer: string): AskDashboardResult['answer'] => {
  return answer
    .replace(new RegExp(`^\\s*${SOURCE_GAP_MARKER}\\s*`, 'i'), '')
    .trim()
}

const detectNeedsExternalSource = (answer: string): boolean => {
  if (new RegExp(`^\\s*${SOURCE_GAP_MARKER}`, 'i').test(answer)) {
    return true
  }

  return sourceGapPatterns.some((pattern) => pattern.test(answer))
}

const callStrongModelText = async (
  provider: 'gemini' | 'cerebras',
  apiToken: string,
  model: string,
  prompt: string,
): Promise<string> => {
  try {
    return await callStrongAiModel({
      provider,
      apiToken,
      model,
      parts: [{ text: prompt }],
      timeoutMs: STRONG_MODEL_CHAT_TIMEOUT_MS,
    })
  } catch (error) {
    if (
      error instanceof Error &&
      /took longer|timeout|timed out/i.test(error.message)
    ) {
      throw new Error(
        'The AI request timed out. Try a shorter question or fewer sources.',
      )
    }

    throw error
  }
}

export const askDashboardSources = async (
  options: AskDashboardOptions,
): Promise<AskDashboardResult> => {
  const settings = readQuickCreateAiSettings()
  const provider = settings.provider || 'hosted'
  const prompt = buildPrompt({
    ...options,
    memory: selectChatMemory(options.history, provider),
  })
  let answer: string

  if (provider === 'hosted') {
    answer = await callHostedAiModel({
      surface: 'chat',
      model: STRONG_AI_PROVIDERS.cerebras.defaultModel,
      parts: [{ text: prompt }],
      timeoutMs: STRONG_MODEL_CHAT_TIMEOUT_MS,
    })
  } else if (provider === 'local') {
    answer = await callLocalLanguageModel(prompt, {
      promptType: 'notes',
      stepLabel: 'Ask dashboard sources',
    })
  } else if (isStrongAiProvider(provider)) {
    const credentials = resolveQuickCreateAiCredentials(provider)
    if (!credentials.apiToken) {
      throw new Error(
        `${STRONG_AI_PROVIDERS[provider].modeLabel} mode needs a configured API key.`,
      )
    }
    answer = await callStrongModelText(
      provider,
      credentials.apiToken,
      credentials.model,
      prompt,
    )
  } else {
    throw new Error('Choose a supported AI mode before asking the dashboard.')
  }

  const needsExternalSource = detectNeedsExternalSource(answer)

  const answerSourceChunks = options.sourceChunks.map((chunk, index) => ({
    chunk,
    sourceIndex: index,
  }))

  return {
    answer: cleanAnswer(answer),
    sourceRefs: answerSourceChunks.map(({ chunk, sourceIndex }) => ({
      citationNumber: chunk.dashboardIndex || sourceIndex + 1,
      chunkId: chunk.id,
      title: chunk.title,
      type: chunk.type,
      textPreview:
        chunk.text.length > 240
          ? `${chunk.text.slice(0, 240).trim()}...`
          : chunk.text,
      origin: chunk.origin,
      url: chunk.url,
      dashboardKey: chunk.dashboardKey,
      dashboardTitle: chunk.dashboardTitle,
      dashboardIndex: chunk.dashboardIndex,
    })),
    needsExternalSource,
  }
}
