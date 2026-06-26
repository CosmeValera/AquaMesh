import type { QuickCreateAiProvider } from '../quickCreate/ai'

export type StudyGuideCreationProvider = QuickCreateAiProvider

export type StudyGuideCreationStatus =
  | 'queued'
  | 'running'
  | 'interrupted'
  | 'failed'
  | 'succeeded'
  | 'cancelled'

export interface StudyGuideCreationJob {
  id: string
  prompt: string
  provider: StudyGuideCreationProvider
  status: StudyGuideCreationStatus
  createdAt: string
  updatedAt: string
  estimateSeconds: number
  startedAt?: string | null
  finishedAt?: string | null
  errorMessage?: string | null
  resultStudyGuideId?: string | null
}

export const isRetryableStudyGuideCreationError = (
  message?: string | null,
): boolean =>
  /failed to fetch|network|abort|aborted|interrupted|load failed|fetch/i.test(
    message || '',
  )

export const STUDY_GUIDE_CREATION_QUEUE_CHANGED_EVENT =
  'studymesh-study-guide-creation-queue-changed'
export const STUDY_GUIDE_CREATION_QUEUE_KEY =
  'studymesh.studyGuides.creationQueue'

const nowIso = () => new Date().toISOString()

const isCreationStatus = (value: unknown): value is StudyGuideCreationStatus =>
  value === 'queued' ||
  value === 'running' ||
  value === 'interrupted' ||
  value === 'failed' ||
  value === 'succeeded' ||
  value === 'cancelled'

const isCreationProvider = (
  value: unknown,
): value is StudyGuideCreationProvider =>
  value === 'hosted' ||
  value === 'local' ||
  value === 'gemini' ||
  value === 'cerebras'

const dispatchQueueChanged = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent(STUDY_GUIDE_CREATION_QUEUE_CHANGED_EVENT),
  )
}

const normalizeJob = (value: unknown): StudyGuideCreationJob | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const source = value as Partial<StudyGuideCreationJob>
  if (
    typeof source.id !== 'string' ||
    !source.id.trim() ||
    typeof source.prompt !== 'string' ||
    !source.prompt.trim() ||
    !isCreationProvider(source.provider)
  ) {
    return null
  }

  const timestamp = nowIso()
  return {
    id: source.id,
    prompt: source.prompt,
    provider: source.provider,
    status: isCreationStatus(source.status) ? source.status : 'queued',
    createdAt:
      typeof source.createdAt === 'string' ? source.createdAt : timestamp,
    updatedAt:
      typeof source.updatedAt === 'string' ? source.updatedAt : timestamp,
    estimateSeconds:
      typeof source.estimateSeconds === 'number' &&
      Number.isFinite(source.estimateSeconds)
        ? source.estimateSeconds
        : 60,
    startedAt: typeof source.startedAt === 'string' ? source.startedAt : null,
    finishedAt:
      typeof source.finishedAt === 'string' ? source.finishedAt : null,
    errorMessage:
      typeof source.errorMessage === 'string' ? source.errorMessage : null,
    resultStudyGuideId:
      typeof source.resultStudyGuideId === 'string'
        ? source.resultStudyGuideId
        : null,
  }
}

const readQueue = (): StudyGuideCreationJob[] => {
  try {
    const stored = window.localStorage.getItem(STUDY_GUIDE_CREATION_QUEUE_KEY)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeJob)
          .filter((job): job is StudyGuideCreationJob => Boolean(job))
      : []
  } catch {
    return []
  }
}

const writeQueue = (jobs: StudyGuideCreationJob[]) => {
  window.localStorage.setItem(
    STUDY_GUIDE_CREATION_QUEUE_KEY,
    JSON.stringify(jobs),
  )
  dispatchQueueChanged()
}

const sortJobs = (jobs: StudyGuideCreationJob[]) =>
  [...jobs].sort(
    (first, second) =>
      Date.parse(first.createdAt || '') - Date.parse(second.createdAt || ''),
  )

const jobMatches = (
  first: StudyGuideCreationJob,
  second: StudyGuideCreationJob,
): boolean => JSON.stringify(first) === JSON.stringify(second)

export const StudyGuideCreationQueueStorage = {
  getAll(): StudyGuideCreationJob[] {
    return readQueue()
  },

  upsert(
    job: Omit<StudyGuideCreationJob, 'createdAt' | 'updatedAt'> &
      Partial<Pick<StudyGuideCreationJob, 'createdAt' | 'updatedAt'>>,
  ): StudyGuideCreationJob {
    const current = readQueue()
    const existing = current.find((item) => item.id === job.id)
    const nextJob: StudyGuideCreationJob = {
      ...job,
      createdAt: job.createdAt || existing?.createdAt || nowIso(),
      updatedAt: job.updatedAt || nowIso(),
      startedAt: job.startedAt ?? existing?.startedAt ?? null,
      finishedAt: job.finishedAt ?? existing?.finishedAt ?? null,
      errorMessage: job.errorMessage ?? null,
      resultStudyGuideId: job.resultStudyGuideId ?? null,
    }

    if (existing && jobMatches(existing, nextJob)) {
      return existing
    }

    writeQueue(
      sortJobs([nextJob, ...current.filter((item) => item.id !== job.id)]),
    )
    return nextJob
  },

  update(
    id: string,
    patch: Partial<Omit<StudyGuideCreationJob, 'id' | 'createdAt'>>,
  ): StudyGuideCreationJob | null {
    const current = readQueue()
    const existing = current.find((item) => item.id === id)
    if (!existing) {
      return null
    }

    const nextJob: StudyGuideCreationJob = {
      ...existing,
      ...patch,
      updatedAt: nowIso(),
    }
    writeQueue(current.map((item) => (item.id === id ? nextJob : item)))
    return nextJob
  },

  remove(id: string): void {
    writeQueue(readQueue().filter((item) => item.id !== id))
  },

  requeueRetryableJobs(): StudyGuideCreationJob[] {
    const current = readQueue()
    let changed = false
    const next = current.map((job) => {
      const shouldRequeue =
        job.status === 'running' ||
        job.status === 'interrupted' ||
        (job.status === 'failed' &&
          isRetryableStudyGuideCreationError(job.errorMessage))
      if (!shouldRequeue) {
        return job
      }

      changed = true
      return {
        ...job,
        status: 'queued' as const,
        updatedAt: nowIso(),
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
      }
    })
    if (changed) {
      writeQueue(next)
    }

    return next
  },

  markRunningJobsInterrupted(): StudyGuideCreationJob[] {
    return this.requeueRetryableJobs()
  },
}
