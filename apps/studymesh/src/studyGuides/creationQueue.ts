import { nanoid } from 'nanoid'
import type { QuickCreateAiProvider } from '../quickCreate/ai'
import { getHostedAiCreditCost } from '../quickCreate/ai/hostedCredits'
import {
  STUDY_GUIDES_STORAGE_FULL_MESSAGE,
  isStudyGuidesStorageQuotaError,
} from './storage'

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
  /** Learner text only. Nothing app-generated, so it can decide the language. */
  prompt: string
  /** Skill the reader claimed, turned into a model instruction at generation. */
  knownSkill?: string | null
  provider: StudyGuideCreationProvider
  status: StudyGuideCreationStatus
  createdAt: string
  updatedAt: string
  estimateSeconds: number
  autoRetryCount: number
  startedAt?: string | null
  finishedAt?: string | null
  errorMessage?: string | null
  resultStudyGuideId?: string | null
  /**
   * The tab that pressed Create. The queue lives in localStorage, which every
   * tab of the origin shares, so without an owner each open tab ran the same
   * job and the account paid once per tab. Missing on jobs queued before this
   * existed, which any tab may adopt.
   */
  ownerTabId?: string | null
}

const CREATION_TAB_ID_KEY = 'studymesh.studyGuides.creationTabId'

/**
 * Identifies this browser tab. Backed by sessionStorage, so it survives a
 * refresh of this tab and no other tab can ever see it: that is what lets a tab
 * reclaim its own interrupted work without letting anyone else pay for it again.
 */
export const getCreationTabId = (): string => {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    const existing = window.sessionStorage.getItem(CREATION_TAB_ID_KEY)
    if (existing) {
      return existing
    }

    const tabId = nanoid()
    window.sessionStorage.setItem(CREATION_TAB_ID_KEY, tabId)
    return tabId
  } catch {
    // Without sessionStorage the tab cannot be told apart. An empty id owns
    // nothing, so this tab only runs what it queued in this page life.
    return ''
  }
}

export const HOSTED_STUDY_GUIDE_AUTO_RETRY_LIMIT = 1
export const HOSTED_STUDY_GUIDE_MANUAL_RETRY_MESSAGE = `Creation was interrupted again. Retry will spend ${getHostedAiCreditCost(
  'study-guide',
)} Carrots.`
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

const normalizeAutoRetryCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0

const shouldAutoRetryJob = (job: StudyGuideCreationJob): boolean =>
  job.provider !== 'hosted' ||
  job.autoRetryCount < HOSTED_STUDY_GUIDE_AUTO_RETRY_LIMIT

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
    knownSkill:
      typeof source.knownSkill === 'string' && source.knownSkill.trim()
        ? source.knownSkill.trim()
        : null,
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
        : 45,
    autoRetryCount: normalizeAutoRetryCount(source.autoRetryCount),
    startedAt: typeof source.startedAt === 'string' ? source.startedAt : null,
    finishedAt:
      typeof source.finishedAt === 'string' ? source.finishedAt : null,
    errorMessage:
      typeof source.errorMessage === 'string' ? source.errorMessage : null,
    resultStudyGuideId:
      typeof source.resultStudyGuideId === 'string'
        ? source.resultStudyGuideId
        : null,
    ownerTabId:
      typeof source.ownerTabId === 'string' && source.ownerTabId
        ? source.ownerTabId
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
  try {
    window.localStorage.setItem(
      STUDY_GUIDE_CREATION_QUEUE_KEY,
      JSON.stringify(jobs),
    )
  } catch (error) {
    if (isStudyGuidesStorageQuotaError(error)) {
      throw new Error(STUDY_GUIDES_STORAGE_FULL_MESSAGE)
    }

    throw error
  }
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
    job: Omit<
      StudyGuideCreationJob,
      'createdAt' | 'updatedAt' | 'autoRetryCount'
    > &
      Partial<
        Pick<
          StudyGuideCreationJob,
          'createdAt' | 'updatedAt' | 'autoRetryCount'
        >
      >,
  ): StudyGuideCreationJob {
    const current = readQueue()
    const existing = current.find((item) => item.id === job.id)
    const nextJob: StudyGuideCreationJob = {
      ...job,
      knownSkill: job.knownSkill ?? existing?.knownSkill ?? null,
      createdAt: job.createdAt || existing?.createdAt || nowIso(),
      updatedAt: job.updatedAt || nowIso(),
      autoRetryCount: job.autoRetryCount ?? existing?.autoRetryCount ?? 0,
      startedAt: job.startedAt ?? existing?.startedAt ?? null,
      finishedAt: job.finishedAt ?? existing?.finishedAt ?? null,
      errorMessage: job.errorMessage ?? null,
      resultStudyGuideId: job.resultStudyGuideId ?? null,
      ownerTabId: job.ownerTabId ?? existing?.ownerTabId ?? null,
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

  /**
   * Resumes work a closed tab left behind, at mount time only.
   *
   * `tabId` is this tab and `activeJobIds` are the jobs it is generating in
   * this page life. A job still running in another tab is never touched:
   * resuming it would fire a second paid request for a guide already in
   * flight, which is how one batch cost once per open tab.
   */
  requeueRetryableJobs({
    tabId = '',
    activeJobIds = [],
  }: {
    tabId?: string
    activeJobIds?: readonly string[]
  } = {}): StudyGuideCreationJob[] {
    const current = readQueue()
    let changed = false
    const next = current.map((job) => {
      // A job with no owner predates this field, so any tab may adopt it.
      const isOwn = !job.ownerTabId || job.ownerTabId === tabId
      const shouldRequeue =
        !activeJobIds.includes(job.id) &&
        (job.status === 'interrupted' ||
          (job.status === 'running' && isOwn) ||
          (job.status === 'failed' &&
            isRetryableStudyGuideCreationError(job.errorMessage)))
      if (!shouldRequeue) {
        return job
      }

      changed = true
      if (!shouldAutoRetryJob(job)) {
        return {
          ...job,
          status: 'failed' as const,
          updatedAt: nowIso(),
          finishedAt: nowIso(),
          errorMessage: HOSTED_STUDY_GUIDE_MANUAL_RETRY_MESSAGE,
        }
      }

      return {
        ...job,
        status: 'queued' as const,
        updatedAt: nowIso(),
        autoRetryCount:
          job.provider === 'hosted'
            ? job.autoRetryCount + 1
            : job.autoRetryCount,
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
        // The tab that adopts the work becomes the one that runs and pays for
        // it, or the runner would skip a job it just requeued.
        ownerTabId: tabId || null,
      }
    })
    if (changed) {
      writeQueue(next)
    }

    return next
  },

  markRunningJobsInterrupted(options?: {
    tabId?: string
    activeJobIds?: readonly string[]
  }): StudyGuideCreationJob[] {
    return this.requeueRetryableJobs(options)
  },

  /**
   * Called as the tab closes. The request dies with the page, so the job is
   * parked for whichever tab opens next rather than left looking alive.
   */
  markJobsInterrupted(jobIds: readonly string[]): void {
    if (!jobIds.length) {
      return
    }

    const current = readQueue()
    let changed = false
    const next = current.map((job) => {
      if (!jobIds.includes(job.id) || job.status !== 'running') {
        return job
      }

      changed = true
      return { ...job, status: 'interrupted' as const, updatedAt: nowIso() }
    })

    if (changed) {
      writeQueue(next)
    }
  },
}
