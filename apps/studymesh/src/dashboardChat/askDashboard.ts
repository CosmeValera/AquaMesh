import {
  callLocalLanguageModel,
  callStrongAiModel,
  isStrongAiProvider,
  readStudyPackAiSettings,
  resolveStudyPackAiCredentials,
  STRONG_AI_PROVIDERS,
} from '../studyPack/ai'
import { callHostedAiModel } from '../studyPack/ai/hostedClient'
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

const buildPrompt = ({
  dashboardTitle,
  contextText,
  question,
  history,
}: AskDashboardOptions) => `You are StudyMesh's dashboard assistant. Help the student understand the current dashboard.

Rules:
- Answer using only the provided dashboard sources and study material when possible.
- If the answer is not supported by the provided context, say that the dashboard sources do not contain enough information.
- Do not invent facts, citations, links, or source names.
- Be concise, clear, student-friendly, and practical.
- Use bullets, examples, and study tips when helpful.

Dashboard title: ${dashboardTitle}

Dashboard/source context:
${contextText}

Recent chat:
${history
  .slice(-6)
  .map(
    (message) =>
      `${message.role === 'user' ? 'Student' : 'Assistant'}: ${
        message.content
      }`,
  )
  .join('\n')}

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
  const settings = readStudyPackAiSettings()
  const provider = settings.provider || 'hosted'
  const prompt = buildPrompt(options)
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
    const credentials = resolveStudyPackAiCredentials(provider)
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
