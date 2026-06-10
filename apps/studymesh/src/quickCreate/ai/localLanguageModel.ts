import {
  LocalAiPromptType,
  runLocalAiPrompt,
} from './localAiSessionManager'

type LocalLanguage = 'en' | 'es' | 'ja'

type LocalLanguageModelAvailability =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'

interface LocalLanguageModelSession {
  prompt: (
    prompt: string | LocalLanguageModelPromptMessage[],
    options?: { signal?: AbortSignal },
  ) => Promise<string>
  destroy?: () => void
}
type LocalLanguageModelExpectedOutput = {
  type: 'text'
  languages: LocalLanguage[]
}
type LocalLanguageModelExpectedInput =
  | { type: 'text'; languages: LocalLanguage[] }
  | { type: 'image' }

interface LocalLanguageModelPromptMessage {
  role: 'user'
  content: Array<
    | { type: 'text'; value: string }
    | {
        type: 'image'
        value: Blob | HTMLCanvasElement | ImageBitmap | ImageData
      }
  >
}

interface LocalLanguageModelMonitor extends EventTarget {
  addEventListener(
    type: 'downloadprogress',
    listener: (event: Event & { loaded?: number; total?: number }) => void,
  ): void
}

interface LocalLanguageModelFactory {
  availability: (options?: {
    languages?: LocalLanguage[]
    outputLanguage?: LocalLanguage
    expectedInputs?: LocalLanguageModelExpectedInput[]
    expectedOutputs?: LocalLanguageModelExpectedOutput[]
  }) => Promise<LocalLanguageModelAvailability>

  create: (options?: {
    outputLanguage?: LocalLanguage
    expectedInputs?: LocalLanguageModelExpectedInput[]
    expectedOutputs?: LocalLanguageModelExpectedOutput[]
    monitor?: (monitor: LocalLanguageModelMonitor) => void
  }) => Promise<LocalLanguageModelSession>
}

declare global {
  interface Window {
    LanguageModel?: LocalLanguageModelFactory
  }

  // Chrome exposes this on globalThis/window in current Prompt API builds.
  // Keeping both declarations avoids unsafe global indexing in app code.
  // eslint-disable-next-line no-var
  var LanguageModel: LocalLanguageModelFactory | undefined
}

export interface TestLocalLanguageModelResult {
  supported: boolean
  availability?: LocalLanguageModelAvailability
  result?: string
  progress?: number
}

export type LocalAiStudyPathStep =
  | 'planner'
  | 'markdown1'
  | 'markdown2'
  | 'practice'
  | 'flashcards'
  | 'quizzes'

export interface LocalAiProgressEvent {
  phase: 'download' | 'smoke' | 'generation' | 'complete' | 'timeout'
  percent: number
  label: string
  dashboardIndex?: number
  dashboardCount?: number
  threadId?: number
  threadCount?: number
  attempt?: number
  attemptCount?: number
  timeoutMs?: number
  studyPathStep?: LocalAiStudyPathStep
  studyPathPipeline?: {
    percent: number
    estimatedRemainingMs: number
    label: string
    steps: Array<{
      id: string
      label: string
      status: 'pending' | 'running' | 'complete' | 'failed'
      percent: number
    }>
  }
  dashboardProgress?: Array<{
    dashboardIndex: number
    dashboardCount: number
    status: 'pending' | 'running' | 'complete' | 'failed'
    label: string
    percent: number
    threadId?: number
    threadCount?: number
    attempt?: number
    attemptCount?: number
    studyPathStep?: LocalAiStudyPathStep
  }>
}

const LOCAL_AI_TIMEOUT_MS = 90 * 1000
const LOCAL_AI_CREATE_TIMEOUT_MS = 60 * 1000
const LOCAL_AI_SMOKE_TIMEOUT_MS = 60 * 1000
const LOCAL_AI_COOLDOWN_MS = 8000
const LOCAL_AI_TIMEOUT_MESSAGE =
  'Local AI timed out. Try again, choose a smaller path, or use Own Gemini token.'
const LOCAL_AI_COOLDOWN_MESSAGE =
  'Chrome Local AI is cooling down after a timeout. Refresh the page if it keeps happening.'
const LOCAL_AI_SMOKE_FAILURE_MESSAGE =
  'Chrome Local AI is busy or unstable. Refresh the page, try again, or use Own Gemini token.'
let localAiCooldownUntil = 0
let localAiLastTimeoutStage: 'create' | 'prompt' | 'smoke' | null = null

const debugLocalAi = (
  stage: string,
  details: Record<string, unknown> = {},
): void => {
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'development') {
    return
  }

  console.debug('[StudyMesh Local AI]', stage, {
    at: new Date().toISOString(),
    ...details,
  })
}

const markLocalAiCooldown = (stage: 'create' | 'prompt' | 'smoke'): void => {
  localAiCooldownUntil = Date.now() + LOCAL_AI_COOLDOWN_MS
  localAiLastTimeoutStage = stage
  debugLocalAi('cooldown:start', {
    stage,
    cooldownMs: LOCAL_AI_COOLDOWN_MS,
    until: localAiCooldownUntil,
  })
}

const assertLocalAiIsReady = (): void => {
  const remainingMs = localAiCooldownUntil - Date.now()
  if (localAiCooldownUntil > 0 && remainingMs <= 0) {
    localAiCooldownUntil = 0
    localAiLastTimeoutStage = null
    return
  }

  if (remainingMs > 0) {
    debugLocalAi('cooldown:reject', {
      remainingMs,
      lastTimeoutStage: localAiLastTimeoutStage,
    })
    throw new Error(LOCAL_AI_COOLDOWN_MESSAGE)
  }
}

const summarizePrompt = (
  prompt: string | LocalLanguageModelPromptMessage[],
): Record<string, unknown> => {
  if (typeof prompt === 'string') {
    return {
      promptKind: 'text',
      promptLength: prompt.length,
      promptPreview: prompt.slice(0, 300),
    }
  }

  const textParts = prompt.flatMap((message) =>
    message.content
      .filter(
        (part): part is { type: 'text'; value: string } => part.type === 'text',
      )
      .map((part) => part.value),
  )
  const imageCount = prompt.reduce(
    (count, message) =>
      count + message.content.filter((part) => part.type === 'image').length,
    0,
  )

  return {
    promptKind: 'multimodal',
    messageCount: prompt.length,
    imageCount,
    textLength: textParts.join('\n').length,
    textPreview: textParts.join('\n').slice(0, 300),
  }
}

const getLanguageModel = (): LocalLanguageModelFactory | undefined => {
  if (typeof window !== 'undefined' && window.LanguageModel) {
    return window.LanguageModel
  }

  if (typeof globalThis !== 'undefined' && globalThis.LanguageModel) {
    return globalThis.LanguageModel
  }

  return undefined
}

export const isLocalLanguageModelSupported = (): boolean =>
  Boolean(getLanguageModel())

export const getLocalLanguageModelAvailability = async (
  language: LocalLanguage = 'en',
  expectedInputs?: LocalLanguageModelExpectedInput[],
  expectedOutputs?: LocalLanguageModelExpectedOutput[],
): Promise<LocalLanguageModelAvailability> => {
  const languageModel = getLanguageModel()
  if (!languageModel) {
    return 'unavailable'
  }

  try {
    const startedAt = performance.now()
    debugLocalAi('availability:start', { language, expectedInputs })
    const availability = await languageModel.availability({
      languages: [language],
      outputLanguage: language,
      expectedInputs: expectedInputs || [
        { type: 'text' as const, languages: [language] },
      ],
      expectedOutputs: expectedOutputs || [
        { type: 'text' as const, languages: [language] },
      ],
    })
    debugLocalAi('availability:end', {
      availability,
      durationMs: Math.round(performance.now() - startedAt),
    })
    return availability
  } catch {
    debugLocalAi('availability:error', { language })
    return 'unavailable'
  }
}

const createPromptProgressTimer = (
  timeoutMs: number,
  phase: LocalAiProgressEvent['phase'],
  label: string,
  onProgress?: (event: LocalAiProgressEvent) => void,
  metadata: Pick<
    LocalAiProgressEvent,
    | 'dashboardIndex'
    | 'dashboardCount'
    | 'attempt'
    | 'attemptCount'
    | 'studyPathStep'
    | 'threadId'
    | 'threadCount'
  > = {},
): (() => void) => {
  if (!onProgress) {
    return () => undefined
  }

  const startedAt = Date.now()
  const emitPendingProgress = () => {
    const elapsedMs = Math.max(0, Date.now() - startedAt)
    const percent = Math.min(99, Math.floor((elapsedMs / timeoutMs) * 100))
    onProgress({
      phase,
      percent,
      label,
      timeoutMs,
      ...metadata,
    })
  }

  emitPendingProgress()
  const intervalId = window.setInterval(emitPendingProgress, 1000)

  return () => window.clearInterval(intervalId)
}

const parseLocalAiSmokeJson = (result: string): unknown => {
  const trimmed = result.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const firstObject = trimmed.indexOf('{')
    const lastObject = trimmed.lastIndexOf('}')
    if (firstObject >= 0 && lastObject > firstObject) {
      return JSON.parse(trimmed.slice(firstObject, lastObject + 1))
    }

    throw new Error('Local AI smoke test returned invalid JSON.')
  }
}

export const callLocalLanguageModel = async (
  prompt: string | LocalLanguageModelPromptMessage[],
  options: {
    outputLanguage?: LocalLanguage
    timeoutMs?: number
    onProgress?: (event: LocalAiProgressEvent) => void
    expectedInputs?: LocalLanguageModelExpectedInput[]
    timeoutStage?: 'prompt' | 'smoke'
    progressLabel?: string
    dashboardIndex?: number
    dashboardCount?: number
    attempt?: number
    attemptCount?: number
    studyPathStep?: LocalAiStudyPathStep
    threadId?: number
    threadCount?: number
    signal?: AbortSignal
    promptType?: LocalAiPromptType
    stepLabel?: string
    dashboardTitle?: string
  } = {},
): Promise<string> => {
  assertLocalAiIsReady()

  const languageModel = getLanguageModel()
  if (!languageModel) {
    throw new Error(
      'Google Local AI is not supported in this browser. Use Google Chrome with the built-in AI model downloaded, or choose another provider.',
    )
  }

  const outputLanguage = options.outputLanguage || 'en'
  const expectedInputs = options.expectedInputs || [
    { type: 'text' as const, languages: [outputLanguage] },
  ]
  const expectedOutputs = [
    { type: 'text' as const, languages: [outputLanguage] },
  ]
  const availability = await getLocalLanguageModelAvailability(
    outputLanguage,
    expectedInputs,
    expectedOutputs,
  )
  if (availability === 'unavailable') {
    throw new Error(
      'Google Local AI is unavailable in this browser. Use Google Chrome with the local model enabled and downloaded.',
    )
  }

  try {
    const createStartedAt = performance.now()
    debugLocalAi('create:start', { outputLanguage, expectedInputs })
    const promptStartedAt = performance.now()
    debugLocalAi('prompt:start', {
      ...summarizePrompt(prompt),
      timeoutMs: options.timeoutMs || LOCAL_AI_TIMEOUT_MS,
    })
    const promptTimeoutStage = options.timeoutStage || 'prompt'
    const promptTimeoutMs = options.timeoutMs || LOCAL_AI_TIMEOUT_MS
    const promptProgressPhase =
      promptTimeoutStage === 'smoke' ? 'smoke' : 'generation'
    const promptProgressLabel =
      options.progressLabel ||
      (promptProgressPhase === 'smoke'
        ? 'Checking Local AI readiness'
        : 'Local AI is running on your device')
    const stopPromptProgress = createPromptProgressTimer(
      promptTimeoutMs,
      promptProgressPhase,
      promptProgressLabel,
      options.onProgress,
      {
        dashboardIndex: options.dashboardIndex,
        dashboardCount: options.dashboardCount,
        attempt: options.attempt,
        attemptCount: options.attemptCount,
        studyPathStep: options.studyPathStep,
        threadId: options.threadId,
        threadCount: options.threadCount,
      },
    )
    const createSession = async () => {
      const createPromise = languageModel.create({
        outputLanguage,
        expectedInputs,
        expectedOutputs,
        monitor: (monitor) => {
          monitor.addEventListener('downloadprogress', (event) => {
            const total = Number(event.total || 0)
            const loaded = Number(event.loaded || 0)
            if (total > 0) {
              options.onProgress?.({
                phase: 'download',
                percent: Math.round((loaded / total) * 100),
                label: 'Downloading local model',
                dashboardIndex: options.dashboardIndex,
                dashboardCount: options.dashboardCount,
                attempt: options.attempt,
                attemptCount: options.attemptCount,
                studyPathStep: options.studyPathStep,
                threadId: options.threadId,
                threadCount: options.threadCount,
              })
            }
          })
        },
      })

      return createPromise
    }
    const result = await runLocalAiPrompt({
      createSession,
      prompt,
      promptType:
        options.promptType ||
        options.studyPathStep ||
        (promptTimeoutStage === 'smoke' ? 'smoke' : 'unknown'),
      stepLabel: options.stepLabel || options.progressLabel,
      dashboardTitle: options.dashboardTitle,
      promptPreview:
        typeof prompt === 'string'
          ? prompt.slice(0, 240)
          : String(summarizePrompt(prompt).textPreview || '').slice(0, 240),
      timeoutMs: promptTimeoutMs,
      createTimeoutMs: LOCAL_AI_CREATE_TIMEOUT_MS,
      timeoutMessage:
        promptTimeoutStage === 'smoke'
          ? LOCAL_AI_SMOKE_FAILURE_MESSAGE
          : LOCAL_AI_TIMEOUT_MESSAGE,
      createTimeoutMessage:
        'Local AI timed out while creating a session. Try again, choose a smaller path, or use Own Gemini token.',
      externalSignal: options.signal,
      onCreateTimeout: () => {
        markLocalAiCooldown('create')
      },
      onTimeout: () => {
        options.onProgress?.({
          phase: 'timeout',
          percent: 100,
          label:
            promptTimeoutStage === 'smoke'
              ? LOCAL_AI_SMOKE_FAILURE_MESSAGE
              : LOCAL_AI_TIMEOUT_MESSAGE,
          timeoutMs: promptTimeoutMs,
          dashboardIndex: options.dashboardIndex,
          dashboardCount: options.dashboardCount,
          attempt: options.attempt,
          attemptCount: options.attemptCount,
          studyPathStep: options.studyPathStep,
          threadId: options.threadId,
          threadCount: options.threadCount,
        })
        markLocalAiCooldown(promptTimeoutStage)
      },
    }).catch((error) => {
      stopPromptProgress()

      throw error
    })
    debugLocalAi('create:end', {
      durationMs: Math.round(performance.now() - createStartedAt),
    })
    stopPromptProgress()
    options.onProgress?.({
      phase: 'complete',
      percent: 100,
      label:
        promptTimeoutStage === 'smoke'
          ? 'Local AI readiness check complete'
          : 'Local AI generation complete',
      timeoutMs: promptTimeoutMs,
      dashboardIndex: options.dashboardIndex,
      dashboardCount: options.dashboardCount,
      attempt: options.attempt,
      attemptCount: options.attemptCount,
      studyPathStep: options.studyPathStep,
      threadId: options.threadId,
      threadCount: options.threadCount,
    })
    debugLocalAi('prompt:end', {
      durationMs: Math.round(performance.now() - promptStartedAt),
      resultLength: String(result || '').length,
    })
    return String(result || '').trim()
  } catch (error) {
    debugLocalAi('error', {
      message: error instanceof Error ? error.message : String(error),
    })
    if (error instanceof Error) {
      throw error
    }

    throw new Error('Google Local AI failed before returning a response.')
  }
}

export const resetLocalLanguageModelCooldownForTests = (): void => {
  localAiCooldownUntil = 0
  localAiLastTimeoutStage = null
}


export const testLocalLanguageModel = async (
  onProgress?: (percent: number) => void,
): Promise<TestLocalLanguageModelResult> => {
  if (!isLocalLanguageModelSupported()) {
    return {
      supported: false,
      availability: 'unavailable',
    }
  }

  const availability = await getLocalLanguageModelAvailability('en')
  if (availability === 'unavailable') {
    return {
      supported: true,
      availability,
    }
  }

  let latestProgress: number | undefined
  const result = await callLocalLanguageModel(
    'Return exactly one word: hello',
    {
      outputLanguage: 'en',
      timeoutMs: 60 * 1000,
      onProgress: (event) => {
        latestProgress = event.percent
        onProgress?.(event.percent)
      },
      promptType: 'smoke',
    },
  )

  return {
    supported: true,
    availability,
    result,
    progress: latestProgress,
  }
}
