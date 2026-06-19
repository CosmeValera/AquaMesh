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
  sources: string[]
}

const STRONG_MODEL_CHAT_TIMEOUT_MS = 45000
const STRONG_CHAT_RECENT_HISTORY_MESSAGES = 4

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
- Answer using only the provided dashboard sources and study material when possible.
- If the answer is not supported by the provided context, say that the dashboard sources do not contain enough information.
- Do not invent facts, citations, links, or source names.
- Be concise, clear, student-friendly, and practical.
- Use bullets, examples, and study tips when helpful.

Dashboard title: ${dashboardTitle}

Dashboard/source context:
${contextText}

Conversation memory:
${formatChatMemory(memory)}

Student question: ${question}

Answer:`

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

  return {
    answer,
    sources: options.sourceChunks.slice(0, 4).map((chunk) => chunk.title),
  }
}
