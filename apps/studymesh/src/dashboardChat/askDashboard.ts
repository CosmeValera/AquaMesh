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
import {
  createAiOutputLanguageInstruction,
  isLocalAiContentLanguageSupported,
  resolveContentLanguage,
  type StudyMeshLanguageCode,
} from '../language/contentLanguage'

interface AskDashboardOptions {
  dashboardTitle: string
  contextText: string
  question: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  sourceChunks: DashboardSourceChunk[]
  contentLanguage?: StudyMeshLanguageCode
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
const CONVERSATIONAL_QUESTION_PATTERN =
  /\b(?:hi|hello|hey|thanks?|thank you|thx|ty|ok|okay|cool|nice|great)\b|\bhow\s+(?:are|r)?\s*you\b|\bhow you\b|\bsay\s+hi\b/i

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
  outputLanguage,
}: Omit<AskDashboardOptions, 'history'> & {
  memory: ChatMemory
  outputLanguage: StudyMeshLanguageCode
}) => `You are StudyMesh's dashboard assistant. Help the student understand the current dashboard.

Rules:
- ${createAiOutputLanguageInstruction(outputLanguage)}
- Answer using only the provided dashboard, study, and web source context.
- Web sources in the context are allowed sources. Use them when dashboard-only material lacks the answer.
- If the student message is conversational smalltalk, a greeting, thanks, a casual acknowledgement, or a minor typo of those, answer briefly and naturally. Do not use "${SOURCE_GAP_MARKER}", do not cite sources, and do not search for dashboard/web evidence for smalltalk.
- If the answer is not supported by any provided context, start your answer with "${SOURCE_GAP_MARKER}" and explain in the output language that the provided sources do not contain enough information for the student's request.
- Do not invent facts, citations, links, or source names.
- When you use a specific source, cite it inline with its source number like [1] or [2].
- Citation format is strict: write every citation as a bracketed source number. If citing multiple sources, write separate bracket citations with spaces, like [3] [4].
- Never write bare citation numbers like 3, compressed citations like 3[4] or [3][4], or combined numbers like [34].
- Put sentence punctuation after the citations, like [3] [4].
- Only cite source numbers shown in the dashboard/source context.
- Never output JSON, code blocks, objects, arrays, "sources" fields, or structured metadata. The answer must be normal readable prose/Markdown only.
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

const stripLeakedSourcesJson = (answer: string): string => {
  const withoutFencedJson = answer.replace(
    /```(?:json)?\s*\{[\s\S]*?"sources"\s*:\s*\[[\s\S]*?}\s*```/gi,
    '',
  )
  const trimmed = withoutFencedJson.trim()

  if (/^\{\s*"sources"\s*:\s*\[[\s\S]*]\s*}\s*$/i.test(trimmed)) {
    return ''
  }

  return withoutFencedJson
    .replace(/(?:^|\n)\s*\{\s*"sources"\s*:\s*\[[\s\S]*?]\s*}\s*$/i, '')
    .trim()
}

const cleanAnswer = (answer: string): AskDashboardResult['answer'] => {
  return stripLeakedSourcesJson(answer)
    .replace(new RegExp(`^\\s*${SOURCE_GAP_MARKER}\\s*`, 'i'), '')
    .trim()
}

const isConversationalQuestion = (question: string): boolean => {
  const normalized = question
    .trim()
    .toLowerCase()
    .replace(/[!?.,]+$/g, '')
    .replace(/\s+/g, ' ')

  return (
    normalized.length <= 48 &&
    (CONVERSATIONAL_QUESTION_PATTERN.test(normalized) ||
      /^tank\s+yuo$/.test(normalized))
  )
}

const detectNeedsExternalSource = (answer: string, question: string): boolean => {
  if (isConversationalQuestion(question)) {
    return false
  }

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
  const resolvedLanguage = resolveContentLanguage({
    text: options.question,
    inheritedLanguage: options.contentLanguage,
  })
  const prompt = buildPrompt({
    ...options,
    memory: selectChatMemory(options.history, provider),
    outputLanguage: resolvedLanguage.language,
  })
  let answer: string

  if (provider === 'hosted') {
    answer = await callHostedAiModel({
      surface: 'chat',
      model: STRONG_AI_PROVIDERS.cerebras.defaultModel,
      outputLanguage: resolvedLanguage.language,
      parts: [{ text: prompt }],
      timeoutMs: STRONG_MODEL_CHAT_TIMEOUT_MS,
    })
  } else if (provider === 'local') {
    if (!isLocalAiContentLanguageSupported(resolvedLanguage.language)) {
      throw new Error(
        'Google Local AI only supports English, Spanish, and Japanese output in StudyMesh. Choose one of those languages, or switch to Hosted AI or your own provider key.',
      )
    }
    answer = await callLocalLanguageModel(prompt, {
      outputLanguage: resolvedLanguage.language,
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

  const needsExternalSource = detectNeedsExternalSource(answer, options.question)

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
