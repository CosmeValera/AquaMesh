type LocalAiPromptStatus =
  | 'creating'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'stale'
  | 'destroyed'

export type LocalAiPromptType =
  | 'quick-create'
  | 'smoke'
  | 'planner'
  | 'concepts'
  | 'notes'
  | 'markdown1'
  | 'markdown2'
  | 'practice'
  | 'flashcards'
  | 'quizzes'
  | 'unknown'

export interface LocalAiManagedSession {
  id: string
  promptType: LocalAiPromptType
  stepLabel?: string
  dashboardTitle?: string
  status: LocalAiPromptStatus
  createdAt: number
  lastActivityAt: number
  completedAt?: number
  destroyedAt?: number
  durationMs: number
  hasAbortController: boolean
  promptPreview: string
  errorMessage?: string
  destroyed: boolean
  stale: boolean
}

export interface LocalAiPromptSession<TPrompt> {
  prompt: (
    prompt: TPrompt,
    options?: { signal?: AbortSignal },
  ) => Promise<string>
  destroy?: () => void
}

export interface RunLocalAiPromptOptions<TPrompt, TSession> {
  createSession: () => Promise<TSession>
  prompt: TPrompt
  promptType?: LocalAiPromptType
  stepLabel?: string
  dashboardTitle?: string
  promptPreview?: string
  timeoutMs?: number
  createTimeoutMs?: number
  timeoutMessage?: string
  createTimeoutMessage?: string
  externalSignal?: AbortSignal
  onCreateTimeout?: (lateSessionPromise: Promise<TSession>) => void
  onTimeout?: () => void
}

const LOCAL_AI_STALE_RUNNING_MS = 5 * 60 * 1000
const LOCAL_AI_STALE_IDLE_MS = 2 * 60 * 1000
const LOCAL_AI_HISTORY_LIMIT = 50
const DEV_LOG_ENABLED =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development'

const sessions = new Map<string, LocalAiManagedSession>()
const activeControllers = new Map<string, AbortController>()
const activeDestroyers = new Map<string, () => void>()
const subscribers = new Set<() => void>()
let nextSessionNumber = 1

const now = (): number => Date.now()

const makeSessionId = (): string => {
  const id = `local-ai-${nextSessionNumber}`
  nextSessionNumber += 1
  return id
}

const logLocalAiLifecycle = (
  event: string,
  details: Record<string, unknown> = {},
): void => {
  if (!DEV_LOG_ENABLED) {
    return
  }

  console.debug(`[LocalAI] ${event}`, details)
}

const notifySubscribers = (): void => {
  subscribers.forEach((subscriber) => subscriber())
}

const computeStale = (session: LocalAiManagedSession, currentTime = now()) =>
  (session.status === 'creating' || session.status === 'running') &&
  (currentTime - session.createdAt > LOCAL_AI_STALE_RUNNING_MS ||
    currentTime - session.lastActivityAt > LOCAL_AI_STALE_IDLE_MS)

const updateSession = (
  id: string,
  updates: Partial<LocalAiManagedSession>,
): void => {
  const current = sessions.get(id)
  if (!current) {
    return
  }

  const updated = {
    ...current,
    ...updates,
    durationMs:
      (updates.completedAt || updates.destroyedAt || now()) - current.createdAt,
  }
  sessions.set(id, updated)
  notifySubscribers()
}

const trimHistory = (): void => {
  const inactive = Array.from(sessions.values())
    .filter(
      (session) =>
        session.status !== 'creating' && session.status !== 'running',
    )
    .sort((first, second) => first.createdAt - second.createdAt)

  while (sessions.size > LOCAL_AI_HISTORY_LIMIT && inactive.length > 0) {
    const next = inactive.shift()
    if (next) {
      sessions.delete(next.id)
    }
  }
}

const abortError = (): Error => {
  const error = new Error('Local AI generation was cancelled.')
  error.name = 'AbortError'
  return error
}

const makeTimeoutPromise = <T>(
  timeoutMs: number | undefined,
  id: string,
  stage: 'create' | 'prompt',
  controller: AbortController,
  message: string,
  onTimeout?: () => void,
): { promise: Promise<T>; clear: () => void } => {
  if (!timeoutMs || timeoutMs <= 0) {
    return {
      promise: new Promise<T>(() => undefined),
      clear: () => undefined,
    }
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const promise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      logLocalAiLifecycle(`${stage} timed out`, { id, timeoutMs })
      onTimeout?.()
      reject(new Error(message))
      controller.abort()
    }, timeoutMs)
  })

  return {
    promise,
    clear: () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    },
  }
}

const makeAbortPromise = <T>(
  controller: AbortController,
): { promise: Promise<T>; clear: () => void } => {
  if (controller.signal.aborted) {
    return {
      promise: Promise.reject(abortError()),
      clear: () => undefined,
    }
  }

  let abort: (() => void) | undefined
  const promise = new Promise<T>((_resolve, reject) => {
    abort = () => reject(abortError())
    controller.signal.addEventListener('abort', abort, { once: true })
  })

  return {
    promise,
    clear: () => {
      if (abort) {
        controller.signal.removeEventListener('abort', abort)
      }
    },
  }
}

export const subscribeToLocalAiSessionDebugState = (
  subscriber: () => void,
): (() => void) => {
  subscribers.add(subscriber)
  return () => subscribers.delete(subscriber)
}

export const getLocalAiSessionDebugState = (): LocalAiManagedSession[] => {
  const currentTime = now()
  return Array.from(sessions.values())
    .map((session) => ({
      ...session,
      durationMs:
        (session.completedAt || session.destroyedAt || currentTime) -
        session.createdAt,
      stale: computeStale(session, currentTime),
      status: computeStale(session, currentTime) ? 'stale' : session.status,
    }))
    .sort((first, second) => second.createdAt - first.createdAt)
}

export const cancelLocalAiSession = (id: string): void => {
  const session = sessions.get(id)
  if (!session) {
    return
  }

  logLocalAiLifecycle('cancelled session', { id })
  activeControllers.get(id)?.abort()
  activeDestroyers.get(id)?.()
  updateSession(id, {
    status: 'cancelled',
    completedAt: now(),
    lastActivityAt: now(),
  })
}

export const destroyLocalAiSession = (id: string): void => {
  const session = sessions.get(id)
  if (!session) {
    return
  }

  activeControllers.get(id)?.abort()
  activeDestroyers.get(id)?.()
  activeControllers.delete(id)
  activeDestroyers.delete(id)
  updateSession(id, {
    status: 'destroyed',
    destroyed: true,
    destroyedAt: now(),
    lastActivityAt: now(),
  })
  logLocalAiLifecycle('destroyed session', { id })
}

export const cancelAllLocalAiSessions = (): void => {
  Array.from(sessions.values())
    .filter(
      (session) =>
        session.status === 'creating' ||
        session.status === 'running' ||
        session.status === 'stale',
    )
    .forEach((session) => cancelLocalAiSession(session.id))
}

export const destroyAllLocalAiSessions = (): void => {
  Array.from(sessions.keys()).forEach((id) => destroyLocalAiSession(id))
}

export const clearCompletedLocalAiSessionHistory = (): void => {
  Array.from(sessions.values()).forEach((session) => {
    if (session.status !== 'creating' && session.status !== 'running') {
      sessions.delete(session.id)
    }
  })
  notifySubscribers()
}

export const resetLocalAiSessionManagerForTests = (): void => {
  destroyAllLocalAiSessions()
  sessions.clear()
  activeControllers.clear()
  activeDestroyers.clear()
  nextSessionNumber = 1
  notifySubscribers()
}

export const runLocalAiPrompt = async <
  TPrompt,
  TSession extends LocalAiPromptSession<TPrompt>,
>({
  createSession,
  prompt,
  promptType = 'unknown',
  stepLabel,
  dashboardTitle,
  promptPreview = '',
  timeoutMs,
  createTimeoutMs,
  timeoutMessage = 'Local AI prompt timed out.',
  createTimeoutMessage = 'Local AI timed out while creating a session.',
  externalSignal,
  onCreateTimeout,
  onTimeout,
}: RunLocalAiPromptOptions<TPrompt, TSession>): Promise<string> => {
  const id = makeSessionId()
  const controller = new AbortController()
  const createdAt = now()
  let session: TSession | null = null
  let createPromise: Promise<TSession> | null = null
  let sessionDestroyed = false
  let externalAbortCleanup: (() => void) | undefined
  const destroySession = () => {
    if (sessionDestroyed) {
      return
    }

    sessionDestroyed = true
    session?.destroy?.()
  }

  sessions.set(id, {
    id,
    promptType,
    stepLabel,
    dashboardTitle,
    status: 'creating',
    createdAt,
    lastActivityAt: createdAt,
    durationMs: 0,
    hasAbortController: true,
    promptPreview,
    destroyed: false,
    stale: false,
  })
  activeControllers.set(id, controller)
  notifySubscribers()
  logLocalAiLifecycle('created session record', { id, promptType, stepLabel })

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      const abort = () => controller.abort()
      externalSignal.addEventListener('abort', abort, { once: true })
      externalAbortCleanup = () =>
        externalSignal.removeEventListener('abort', abort)
    }
  }

  try {
    if (controller.signal.aborted) {
      throw abortError()
    }

    createPromise = createSession()
    const createTimeout = makeTimeoutPromise<TSession>(
      createTimeoutMs,
      id,
      'create',
      controller,
      createTimeoutMessage,
      () => onCreateTimeout?.(createPromise),
    )
    const createAbort = makeAbortPromise<TSession>(controller)
    try {
      session = await Promise.race([
        createPromise,
        createTimeout.promise,
        createAbort.promise,
      ])
    } finally {
      createTimeout.clear()
      createAbort.clear()
    }

    activeDestroyers.set(id, destroySession)
    updateSession(id, {
      status: 'running',
      lastActivityAt: now(),
    })
    logLocalAiLifecycle('prompt started', { id, promptType, stepLabel })

    if (controller.signal.aborted) {
      throw abortError()
    }

    const promptTimeout = makeTimeoutPromise<string>(
      timeoutMs,
      id,
      'prompt',
      controller,
      timeoutMessage,
      onTimeout,
    )
    const promptAbort = makeAbortPromise<string>(controller)
    try {
      const result = await Promise.race([
        session.prompt(prompt, { signal: controller.signal }),
        promptTimeout.promise,
        promptAbort.promise,
      ])
      updateSession(id, {
        status: 'completed',
        completedAt: now(),
        lastActivityAt: now(),
      })
      logLocalAiLifecycle('prompt completed', { id, promptType })
      return String(result || '').trim()
    } finally {
      promptTimeout.clear()
      promptAbort.clear()
    }
  } catch (error) {
    const wasCancelled =
      controller.signal.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    updateSession(id, {
      status: wasCancelled ? 'cancelled' : 'failed',
      completedAt: now(),
      lastActivityAt: now(),
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    logLocalAiLifecycle(wasCancelled ? 'prompt cancelled' : 'prompt failed', {
      id,
      message: error instanceof Error ? error.message : String(error),
    })
    throw error
  } finally {
    externalAbortCleanup?.()
    try {
      destroySession()
      if (!session && createPromise) {
        createPromise
          .then((lateSession) => lateSession.destroy?.())
          .catch(() => undefined)
      }
    } finally {
      activeControllers.delete(id)
      activeDestroyers.delete(id)
      updateSession(id, {
        destroyed: true,
        destroyedAt: now(),
        lastActivityAt: now(),
      })
      trimHistory()
      logLocalAiLifecycle('destroyed session', { id })
    }
  }
}
