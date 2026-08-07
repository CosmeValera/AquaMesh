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
import type { DashboardChatSourceId } from './sourcePlanner'

interface AskDashboardOptions {
  dashboardTitle: string
  contextText: string
  question: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  sourceChunks: DashboardSourceChunk[]
  allowedSources?: DashboardChatSourceId[]
  answerStyleHint?: string
  exactAnswerCount?: number | null
  contentLanguage?: StudyMeshLanguageCode
  // 'chat-followup' when the message's single credit was already charged by
  // an earlier hosted call in the same flow (the source planner).
  hostedSurface?: 'chat' | 'chat-followup'
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
  quote?: string
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

const formatAllowedSources = (allowedSources: DashboardChatSourceId[]) => {
  const hasStudyGuide = allowedSources.includes('study-guide')
  const hasGeneral = allowedSources.includes('general')
  const hasWeb = allowedSources.includes('web')

  if (hasStudyGuide && !hasGeneral && !hasWeb) {
    return 'Use only the Study Guide/dashboard/source context. If the context does not answer the question, say briefly that the Study Guide does not cover it and suggest enabling General knowledge or Web search. Do not answer from memory.'
  }

  if (!hasStudyGuide && hasGeneral && !hasWeb) {
    return 'Use general knowledge only. Answer the student directly. Do not cite or rely on the Study Guide, dashboard context, added sources, web sources, or previous chat. Do not describe the dashboard, guide, source selection, or prior questions unless the student asks about them.'
  }

  if (!hasStudyGuide && !hasGeneral && hasWeb) {
    return 'Use only fetched web source context. If no web source context answers the question, say briefly that the web search did not provide a usable source. Do not answer from general knowledge or the Study Guide.'
  }

  const allowedLabels = [
    hasStudyGuide ? 'Study Guide/dashboard context' : '',
    hasGeneral ? 'general knowledge' : '',
    hasWeb ? 'fetched web sources' : '',
  ].filter(Boolean)

  return `Allowed answer sources: ${allowedLabels.join(
    ', ',
  )}. Do not use sources outside this list. Prefer cited context when it directly helps; use uncited general knowledge only if general knowledge is allowed.`
}

const hasFetchedWebSources = (sourceChunks: DashboardSourceChunk[]) =>
  sourceChunks.some(
    (chunk) => chunk.origin === 'web' && chunk.originType !== 'user-text',
  )

const formatCoverageFallbackRule = (
  allowedSources: DashboardChatSourceId[],
) => {
  if (allowedSources.includes('general')) {
    return 'If the provided context only partially answers the question, answer the rest from general knowledge and make that transition clear with phrasing such as "In general". If the provided context does not help, still answer from general knowledge.'
  }

  return 'If the allowed cited context only partially answers the question, answer only the supported part and briefly say what is not covered by the allowed sources.'
}

const buildPrompt = ({
  dashboardTitle,
  contextText,
  question,
  memory,
  sourceChunks,
  allowedSources = ['study-guide', 'general'],
  answerStyleHint,
  exactAnswerCount,
  outputLanguage,
}: Omit<AskDashboardOptions, 'history'> & {
  memory: ChatMemory
  outputLanguage: StudyMeshLanguageCode
}) => `You are RabbitHole's dashboard assistant. Help the student understand the current dashboard.

Rules:
- ${createAiOutputLanguageInstruction(outputLanguage)}
- Prefer the provided dashboard, study, and source context when it helps.
- Use only the parts of the context that answer the asked question. The context can contain checklists, exam methods, or steps written for another topic; leave them out unless they are about the topic asked. Never append a method or checklist just because the student mentioned an exam.
- ${formatAllowedSources(allowedSources)}
${hasFetchedWebSources(sourceChunks) ? '- Web sources were fetched for this question. Base the answer on them and cite them inline. Use general knowledge only for the parts those sources do not cover, and mark that with phrasing such as "In general".' : ''}
- Respect the student's requested answer shape and verbosity. If they ask for a plain list, exact count, table, or no explanation, follow that format without extra teaching sections.
- Match answer length to the question. A short, direct, or yes/no question gets a short, direct answer — one or two sentences, no headers or extra sections. Only write a longer, structured explanation when the student is actually asking to understand or learn something in depth.
${exactAnswerCount ? `- The student asked for exactly ${exactAnswerCount} entries. Return exactly ${exactAnswerCount} distinct entries in a numbered list. Do not use headings, category totals, ranges, duplicate entries, or follow-up questions. Identify otherwise identical entries with their standard number, position, or side.` : ''}
${answerStyleHint ? `- Extra answer style instruction: ${answerStyleHint}` : ''}
- ${formatCoverageFallbackRule(allowedSources)}
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
- Use bullets, examples, and study tips only when the question actually calls for explanation — not on every answer.
- After the full answer, on new lines, add one bookkeeping block for the citations you used: start with [[CITATION_QUOTES]], then one line per citation number formatted as "<number>: <quote>", then end with [[/CITATION_QUOTES]]. Each quote must be copied character-for-character from that source's context, not paraphrased or summarized, and short (one sentence or clause). Skip a citation's line entirely if you cannot find a short exact passage that supports it.
- The citation-quotes block is internal bookkeeping. Never mention it, describe it, or refer to it inside the visible answer.

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

const isValidExactListAnswer = (answer: string, expectedCount: number) => {
  const entries = answer
    .split('\n')
    .map((line) => line.match(/^\s*(\d{1,3})[.)]\s+(.+?)\s*$/))

  if (entries.length !== expectedCount || entries.some((entry) => !entry)) {
    return false
  }

  const names = new Set<string>()
  return entries.every((entry, index) => {
    const [, position, value] = entry as RegExpMatchArray
    const normalized = value
      .replace(/\s*\[\d{1,3}]\s*/g, ' ')
      .replace(/[.,;:]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()

    if (
      Number(position) !== index + 1 ||
      !normalized ||
      names.has(normalized)
    ) {
      return false
    }

    names.add(normalized)
    return true
  })
}

const buildExactListRepairPrompt = (
  prompt: string,
  expectedCount: number,
): string => `${prompt}

Your previous response failed the exact-list requirement. Replace it now.
- Return only a numbered list from 1 to ${expectedCount}.
- Every line must contain one distinct, unambiguous entry.
- No headings, grouping, totals, explanations, caveats, duplicate entries, or follow-up question.
- Keep every original source restriction. Do not fill gaps from unallowed sources.

Replacement answer:`

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

const callDashboardChatModel = async ({
  prompt,
  outputLanguage,
  hostedSurface = 'chat',
  signal,
}: {
  prompt: string
  outputLanguage: StudyMeshLanguageCode
  hostedSurface?: 'chat' | 'chat-followup'
  signal?: AbortSignal
}): Promise<string> => {
  const settings = readQuickCreateAiSettings()
  const provider = settings.provider || 'hosted'

  if (provider === 'hosted') {
    return callHostedAiModel({
      surface: hostedSurface,
      model: STRONG_AI_PROVIDERS.cerebras.defaultModel,
      outputLanguage,
      parts: [{ text: prompt }],
      timeoutMs: STRONG_MODEL_CHAT_TIMEOUT_MS,
      signal,
    })
  }

  if (provider === 'local') {
    if (!isLocalAiContentLanguageSupported(outputLanguage)) {
      throw new Error(
        'Google Local AI only supports English, Spanish, and Japanese output in RabbitHole. Choose one of those languages, or switch to Hosted AI or your own provider key.',
      )
    }
    return callLocalLanguageModel(prompt, {
      outputLanguage,
      promptType: 'notes',
      stepLabel: 'Ask dashboard sources',
      signal,
    })
  }

  if (isStrongAiProvider(provider)) {
    const credentials = resolveQuickCreateAiCredentials(provider)
    if (!credentials.apiToken) {
      throw new Error(
        `${STRONG_AI_PROVIDERS[provider].modeLabel} mode needs a configured API key.`,
      )
    }
    return callStrongModelText(
      provider,
      credentials.apiToken,
      credentials.model,
      prompt,
      signal,
    )
  }

  throw new Error('Choose a supported AI mode before asking the dashboard.')
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

const CITATION_QUOTES_BLOCK =
  /\[\[CITATION_QUOTES]]([\s\S]*?)\[\[\/CITATION_QUOTES]]/i

// Pulls the model's internal "which exact sentence backs which citation"
// bookkeeping block out of the raw answer so the UI can highlight and scroll
// to that text on the source page. Never shown to the student.
const extractCitationQuotes = (
  rawAnswer: string,
): { answer: string; quotes: Map<number, string> } => {
  const quotes = new Map<number, string>()
  const match = rawAnswer.match(CITATION_QUOTES_BLOCK)

  if (match) {
    match[1].split('\n').forEach((line) => {
      const lineMatch = line.match(/^\s*(\d{1,3})\s*:\s*(.+?)\s*$/)
      if (!lineMatch) {
        return
      }

      const citationNumber = Number(lineMatch[1])
      const quote = lineMatch[2].replace(/^["'“‘]+|["'”’]+$/g, '').trim()
      if (Number.isFinite(citationNumber) && quote) {
        quotes.set(citationNumber, quote)
      }
    })
  }

  return {
    answer: rawAnswer.replace(CITATION_QUOTES_BLOCK, '').trim(),
    quotes,
  }
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
  allowedSources: DashboardChatSourceId[],
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

  if (
    allowedSources.includes('general') &&
    (basis.size === 0 || isGeneralKnowledgeCue(answer))
  ) {
    basis.add('general')
  }

  if (basis.size === 0) {
    // Every answer states what it rests on. Without citations the answer came
    // from the guide context when that is the only allowed source, and from
    // model knowledge otherwise.
    basis.add(
      allowedSources.includes('study-guide') ? 'study-guide' : 'general',
    )
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
  const provider = readQuickCreateAiSettings().provider || 'hosted'
  const resolvedLanguage = resolveContentLanguage({
    text: options.question,
    inheritedLanguage: options.contentLanguage,
  })
  const prompt = buildPrompt({
    ...options,
    memory: selectChatMemory(options.history, provider),
    outputLanguage: resolvedLanguage.language,
  })
  const firstPass = extractCitationQuotes(
    await callDashboardChatModel({
      prompt,
      outputLanguage: resolvedLanguage.language,
      hostedSurface: options.hostedSurface,
      signal: options.signal,
    }),
  )
  let cleanedAnswer = cleanAnswer(firstPass.answer)
  let citationQuotes = firstPass.quotes
  const exactListCount = options.exactAnswerCount ?? null
  if (
    exactListCount &&
    !isValidExactListAnswer(cleanedAnswer, exactListCount)
  ) {
    const repairPass = extractCitationQuotes(
      await callDashboardChatModel({
        prompt: buildExactListRepairPrompt(prompt, exactListCount),
        outputLanguage: resolvedLanguage.language,
        // The repair retry never charges again: the first call in this
        // message already carried the credit.
        hostedSurface: 'chat-followup',
        signal: options.signal,
      }),
    )
    cleanedAnswer = cleanAnswer(repairPass.answer)
    citationQuotes = repairPass.quotes
  }
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
    .map((sourceRef) => {
      const quote = citationQuotes.get(sourceRef.citationNumber)
      if (quote) {
        return { ...sourceRef, quote }
      }
      // The bookkeeping block is a soft instruction the model can skip. When it
      // does, fall back to the chunk's own text so a citation-jump always has
      // something verbatim to search the page for, instead of silently
      // degrading to navigation with no highlight.
      if (!sourceRef.dashboardKey) {
        return sourceRef
      }
      const fallbackQuote = sourceRef.textPreview.replace(/\.\.\.$/, '').trim()
      return fallbackQuote ? { ...sourceRef, quote: fallbackQuote } : sourceRef
    })
  const answerBasis = deriveAnswerBasis(
    sourceRefs,
    cleanedAnswer,
    options.allowedSources || ['study-guide', 'general'],
  )

  return {
    answer: cleanedAnswer,
    sourceRefs,
    answerBasis,
    contextSupport: deriveContextSupport(sourceRefs, answerBasis),
  }
}
