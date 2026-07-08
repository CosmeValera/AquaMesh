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
  signal?: AbortSignal
}

export interface AskDashboardResult {
  answer: string
  sourceRefs: DashboardAnswerSourceRef[]
  answerBasis: DashboardAnswerBasis[]
  contextSupport: DashboardAnswerContextSupport
}

export type DashboardAnswerBasis =
  | 'study-guide'
  | 'added-source'
  | 'web'
  | 'general'

export type DashboardAnswerContextSupport = 'direct' | 'partial' | 'none'

export interface DashboardAnswerSourceRef {
  citationNumber: number
  chunkId: string
  title: string
  type: string
  textPreview: string
  origin?: 'dashboard' | 'web'
  originType?: 'web' | 'user-text' | 'user-web'
  url?: string
  dashboardKey?: string
  dashboardTitle?: string
  dashboardIndex?: number
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
  outputLanguage,
}: Omit<AskDashboardOptions, 'history'> & {
  memory: ChatMemory
  outputLanguage: StudyMeshLanguageCode
}) => `You are StudyMesh's dashboard assistant. Help the student understand the current dashboard.

Rules:
- ${createAiOutputLanguageInstruction(outputLanguage)}
- Prefer the provided dashboard, study, and source context when it helps.
- If the provided context only partially answers the question, answer the rest from general knowledge and make that transition clear with phrasing such as "In general".
- If the provided context does not help, still answer from general knowledge.
- If the student message is conversational smalltalk, a greeting, thanks, a casual acknowledgement, or a minor typo of those, answer briefly and naturally. Do not cite sources for smalltalk.
- Do not invent citations, links, source names, or claims about what a source says.
- When you use a specific source, cite it inline with its source number like [1] or [2].
- Citation format is strict: write every citation as a bracketed source number. If citing multiple sources, write separate bracket citations with spaces, like [3] [4].
- Never write bare citation numbers like 3, compressed citations like 3[4] or [3][4], or combined numbers like [34].
- Put sentence punctuation after the citations, like [3] [4].
- Only cite source numbers shown in the dashboard/source context.
- Never output JSON, code blocks, objects, arrays, "sources" fields, or structured metadata. The answer must be normal readable prose/Markdown only.
- Do not add a final Sources, References, or Based on section. Use inline citations only.
- Do not say "as I said earlier" unless the student explicitly asks you to repeat or recall a prior answer.
- Be concise, clear, student-friendly, and practical.
- Use bullets, examples, and study tips when helpful.

Dashboard title: ${dashboardTitle}

Dashboard/source context:
${contextText}

Conversation memory:
${formatChatMemory(memory)}

Student question: ${question}

Answer:`

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
  return stripLeakedSourcesJson(answer).trim()
}

const callStrongModelText = async (
  provider: 'gemini' | 'cerebras',
  apiToken: string,
  model: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> => {
  try {
    return await callStrongAiModel({
      provider,
      apiToken,
      model,
      parts: [{ text: prompt }],
      timeoutMs: STRONG_MODEL_CHAT_TIMEOUT_MS,
      signal,
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

const extractUsedCitationNumbers = (answer: string): Set<number> => {
  const numbers = new Set<number>()
  for (const match of answer.matchAll(/\[(\d{1,3})]/g)) {
    const citationNumber = Number(match[1])
    if (Number.isFinite(citationNumber) && citationNumber > 0) {
      numbers.add(citationNumber)
    }
  }
  return numbers
}

const sourceRefFromChunk = (
  chunk: DashboardSourceChunk,
  sourceIndex: number,
): DashboardAnswerSourceRef => ({
  citationNumber: chunk.dashboardIndex || sourceIndex + 1,
  chunkId: chunk.id,
  title: chunk.title,
  type: chunk.type,
  textPreview:
    chunk.text.length > 240
      ? `${chunk.text.slice(0, 240).trim()}...`
      : chunk.text,
  origin: chunk.origin,
  originType: chunk.originType,
  url: chunk.url,
  dashboardKey: chunk.dashboardKey,
  dashboardTitle: chunk.dashboardTitle,
  dashboardIndex: chunk.dashboardIndex,
})

const isGeneralKnowledgeCue = (answer: string): boolean =>
  /\b(?:in general|generally|outside (?:the|this) (?:guide|source|context)|beyond (?:the|this) (?:guide|source|context))\b/i.test(
    answer,
  )

const deriveAnswerBasis = (
  sourceRefs: DashboardAnswerSourceRef[],
  answer: string,
): DashboardAnswerBasis[] => {
  const basis = new Set<DashboardAnswerBasis>()

  sourceRefs.forEach((sourceRef) => {
    if (sourceRef.origin === 'web') {
      basis.add(
        sourceRef.originType === 'user-text' ||
          sourceRef.originType === 'user-web'
          ? 'added-source'
          : 'web',
      )
      return
    }

    basis.add('study-guide')
  })

  if (basis.size === 0 || isGeneralKnowledgeCue(answer)) {
    basis.add('general')
  }

  return Array.from(basis)
}

const deriveContextSupport = (
  sourceRefs: DashboardAnswerSourceRef[],
  answerBasis: DashboardAnswerBasis[],
): DashboardAnswerContextSupport => {
  if (sourceRefs.length === 0) {
    return 'none'
  }

  return answerBasis.includes('general') ? 'partial' : 'direct'
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
      signal: options.signal,
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
      signal: options.signal,
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
      options.signal,
    )
  } else {
    throw new Error('Choose a supported AI mode before asking the dashboard.')
  }

  const cleanedAnswer = cleanAnswer(answer)
  const usedCitationNumbers = extractUsedCitationNumbers(cleanedAnswer)
  const sourceRefs = options.sourceChunks
    .map(sourceRefFromChunk)
    .filter((sourceRef, index, refs) => {
      if (!usedCitationNumbers.has(sourceRef.citationNumber)) {
        return false
      }

      return (
        refs.findIndex(
          (candidate) => candidate.citationNumber === sourceRef.citationNumber,
        ) === index
      )
    })
  const answerBasis = deriveAnswerBasis(sourceRefs, cleanedAnswer)

  return {
    answer: cleanedAnswer,
    sourceRefs,
    answerBasis,
    contextSupport: deriveContextSupport(sourceRefs, answerBasis),
  }
}
