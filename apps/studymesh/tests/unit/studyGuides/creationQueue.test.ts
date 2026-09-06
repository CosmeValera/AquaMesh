import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  HOSTED_STUDY_GUIDE_GATEWAY_STALE_MS,
  HOSTED_STUDY_GUIDE_MANUAL_RETRY_MESSAGE,
  STUDY_GUIDE_CREATION_QUEUE_KEY,
  StudyGuideCreationQueueStorage,
  isWithinHostedGatewayStaleWindow,
} from '../../../src/studyGuides/creationQueue'
import { STUDY_GUIDES_STORAGE_FULL_MESSAGE } from '../../../src/studyGuides/storage'

describe('StudyGuideCreationQueueStorage', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.mocked(window.localStorage.getItem).mockImplementation(
      (key: string) => storage.get(key) ?? null,
    )
    vi.mocked(window.localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage.set(key, value)
      },
    )
    vi.mocked(window.localStorage.removeItem).mockImplementation(
      (key: string) => {
        storage.delete(key)
      },
    )
    vi.mocked(window.localStorage.clear).mockImplementation(() => {
      storage.clear()
    })
    window.localStorage.clear()
  })

  it('ignores invalid stored queue entries', () => {
    window.localStorage.setItem(
      STUDY_GUIDE_CREATION_QUEUE_KEY,
      JSON.stringify([
        null,
        { id: 'missing-prompt', provider: 'hosted' },
        {
          id: 'valid',
          prompt: 'Valid prompt',
          provider: 'hosted',
          status: 'queued',
          estimateSeconds: 20,
        },
      ]),
    )

    expect(StudyGuideCreationQueueStorage.getAll()).toMatchObject([
      {
        id: 'valid',
        prompt: 'Valid prompt',
        provider: 'hosted',
        status: 'queued',
        autoRetryCount: 0,
      },
    ])
  })

  it('upserts, updates, and removes jobs', () => {
    const job = StudyGuideCreationQueueStorage.upsert({
      id: 'job-1',
      prompt: 'Study biology',
      provider: 'hosted',
      status: 'queued',
      estimateSeconds: 20,
    })

    expect(job.createdAt).toBeTruthy()
    expect(
      StudyGuideCreationQueueStorage.update('job-1', {
        status: 'failed',
        errorMessage: 'Provider failed.',
      }),
    ).toMatchObject({
      id: 'job-1',
      status: 'failed',
      errorMessage: 'Provider failed.',
    })

    StudyGuideCreationQueueStorage.remove('job-1')
    expect(StudyGuideCreationQueueStorage.getAll()).toEqual([])
  })

  it('uses a friendly error when the queue is too large to save', () => {
    vi.mocked(window.localStorage.setItem).mockImplementation(() => {
      throw new DOMException(
        'Setting the value exceeded the quota.',
        'QuotaExceededError',
      )
    })

    expect(() =>
      StudyGuideCreationQueueStorage.upsert({
        id: 'job-1',
        prompt: 'Study biology',
        provider: 'hosted',
        status: 'queued',
        estimateSeconds: 20,
      }),
    ).toThrow(STUDY_GUIDES_STORAGE_FULL_MESSAGE)
  })

  it('requeues running jobs on hydration', () => {
    StudyGuideCreationQueueStorage.upsert({
      id: 'running-job',
      prompt: 'Study chemistry',
      provider: 'gemini',
      status: 'running',
      estimateSeconds: 20,
    })

    expect(StudyGuideCreationQueueStorage.requeueRetryableJobs()).toMatchObject(
      [
        {
          id: 'running-job',
          status: 'queued',
          errorMessage: null,
        },
      ],
    )
  })

  it('never restarts a hosted job the gateway cannot vouch for', () => {
    // Re-running it would be a fresh paid generation, and nobody clicked.
    StudyGuideCreationQueueStorage.upsert({
      id: 'running-job',
      prompt: 'Study chemistry',
      provider: 'hosted',
      status: 'running',
      estimateSeconds: 20,
      autoRetryCount: 0,
    })

    expect(StudyGuideCreationQueueStorage.requeueRetryableJobs()).toMatchObject(
      [
        {
          id: 'running-job',
          status: 'failed',
          autoRetryCount: 0,
          errorMessage: HOSTED_STUDY_GUIDE_MANUAL_RETRY_MESSAGE,
        },
      ],
    )
  })

  it('requeues retryable failed jobs but leaves provider failures failed', () => {
    StudyGuideCreationQueueStorage.upsert({
      id: 'network-job',
      prompt: 'Study physics',
      provider: 'gemini',
      status: 'failed',
      estimateSeconds: 20,
      errorMessage: 'Failed to fetch',
    })
    StudyGuideCreationQueueStorage.upsert({
      id: 'provider-job',
      prompt: 'Study math',
      provider: 'hosted',
      status: 'failed',
      estimateSeconds: 20,
      errorMessage: 'Cerebras hosted AI request failed.',
    })

    const jobs = StudyGuideCreationQueueStorage.requeueRetryableJobs()
    expect(jobs.find((job) => job.id === 'network-job')).toMatchObject({
      status: 'queued',
      errorMessage: null,
    })
    expect(jobs.find((job) => job.id === 'provider-job')).toMatchObject({
      status: 'failed',
      errorMessage: 'Cerebras hosted AI request failed.',
    })
  })
})

describe('resuming work a closed tab left behind', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.mocked(window.localStorage.getItem).mockImplementation(
      (key: string) => storage.get(key) ?? null,
    )
    vi.mocked(window.localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage.set(key, value)
      },
    )
    vi.mocked(window.localStorage.removeItem).mockImplementation(
      (key: string) => {
        storage.delete(key)
      },
    )
    vi.mocked(window.localStorage.clear).mockImplementation(() => {
      storage.clear()
    })
    window.localStorage.clear()
  })

  // Who may resume a job is about tabs, not providers. A BYO provider keeps
  // that the subject: a hosted job additionally needs the gateway to vouch for
  // it, which is covered separately.
  const runningJob = {
    id: 'job-1',
    prompt: 'Teach me why queues stall.',
    provider: 'gemini' as const,
    status: 'running' as const,
    estimateSeconds: 60,
    autoRetryCount: 0,
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: null,
    errorMessage: null,
    resultStudyGuideId: null,
  }

  it('resumes a running job that no tab is generating any more', () => {
    StudyGuideCreationQueueStorage.upsert(runningJob)

    StudyGuideCreationQueueStorage.requeueRetryableJobs()

    expect(StudyGuideCreationQueueStorage.getAll()[0].status).toBe('queued')
  })

  it('leaves a job the browser is still generating alone', () => {
    // Requeueing an in-flight guide starts a second paid request for a guide
    // that was already charged, which is how a batch of three cost double.
    StudyGuideCreationQueueStorage.upsert(runningJob)

    StudyGuideCreationQueueStorage.requeueRetryableJobs({
      activeJobIds: [runningJob.id],
    })

    expect(StudyGuideCreationQueueStorage.getAll()[0].status).toBe('running')
  })
})

describe('who may resume a job when several tabs are open', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.mocked(window.localStorage.getItem).mockImplementation(
      (key: string) => storage.get(key) ?? null,
    )
    vi.mocked(window.localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage.set(key, value)
      },
    )
    vi.mocked(window.localStorage.removeItem).mockImplementation(
      (key: string) => {
        storage.delete(key)
      },
    )
    vi.mocked(window.localStorage.clear).mockImplementation(() => {
      storage.clear()
    })
    window.localStorage.clear()
  })

  const job = (overrides: Record<string, unknown> = {}) => ({
    id: 'job-1',
    prompt: 'Teach me why queues stall.',
    provider: 'gemini' as const,
    status: 'running' as const,
    estimateSeconds: 60,
    autoRetryCount: 0,
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: null,
    errorMessage: null,
    resultStudyGuideId: null,
    ownerTabId: 'tab-a',
    ...overrides,
  })

  const statusNow = () => StudyGuideCreationQueueStorage.getAll()[0].status

  it('never resumes a guide another tab is still generating', () => {
    // The queue is shared through localStorage, so every open tab saw this
    // job. Resuming it here paid for the same guide a second time.
    StudyGuideCreationQueueStorage.upsert(job())

    StudyGuideCreationQueueStorage.requeueRetryableJobs({ tabId: 'tab-b' })

    expect(statusNow()).toBe('running')
  })

  it('resumes a guide this tab was generating before it reloaded', () => {
    StudyGuideCreationQueueStorage.upsert(job())

    StudyGuideCreationQueueStorage.requeueRetryableJobs({ tabId: 'tab-a' })

    expect(statusNow()).toBe('queued')
  })

  it('resumes an interrupted guide whichever tab left it behind', () => {
    StudyGuideCreationQueueStorage.upsert(job({ status: 'interrupted' }))

    StudyGuideCreationQueueStorage.requeueRetryableJobs({ tabId: 'tab-b' })

    expect(statusNow()).toBe('queued')
    // The tab that adopts it becomes the one that runs and pays for it.
    expect(StudyGuideCreationQueueStorage.getAll()[0].ownerTabId).toBe('tab-b')
  })

  it('adopts a job queued before jobs had an owner', () => {
    StudyGuideCreationQueueStorage.upsert(job({ ownerTabId: null }))

    StudyGuideCreationQueueStorage.requeueRetryableJobs({ tabId: 'tab-b' })

    expect(statusNow()).toBe('queued')
  })

  it('parks what the closing tab was generating', () => {
    StudyGuideCreationQueueStorage.upsert(job())

    StudyGuideCreationQueueStorage.markJobsInterrupted(['job-1'])

    expect(statusNow()).toBe('interrupted')
  })
})

describe('claimed skill on a queued job', () => {
  it('round-trips knownSkill and tolerates jobs stored without it', () => {
    window.localStorage.setItem(
      STUDY_GUIDE_CREATION_QUEUE_KEY,
      JSON.stringify([
        {
          id: 'legacy',
          prompt: 'Teach me consent rules',
          provider: 'hosted',
          status: 'queued',
          estimateSeconds: 20,
        },
      ]),
    )

    expect(StudyGuideCreationQueueStorage.getAll()[0].knownSkill).toBeNull()

    StudyGuideCreationQueueStorage.upsert({
      id: 'with-skill',
      prompt: 'Teach me consent rules',
      knownSkill: 'reviewing open-source contributions',
      provider: 'hosted',
      status: 'queued',
      estimateSeconds: 20,
    })

    expect(
      StudyGuideCreationQueueStorage.getAll().find(
        (job) => job.id === 'with-skill',
      )?.knownSkill,
    ).toBe('reviewing open-source contributions')
  })
})

describe('resuming a job the gateway still owns', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.mocked(window.localStorage.getItem).mockImplementation(
      (key: string) => storage.get(key) ?? null,
    )
    vi.mocked(window.localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage.set(key, value)
      },
    )
    vi.mocked(window.localStorage.removeItem).mockImplementation(
      (key: string) => {
        storage.delete(key)
      },
    )
    vi.mocked(window.localStorage.clear).mockImplementation(() => {
      storage.clear()
    })
    window.localStorage.clear()
  })

  const interruptedHostedJob = {
    id: 'server-owned-job',
    prompt: 'Study photosynthesis',
    provider: 'hosted' as const,
    status: 'interrupted' as const,
    estimateSeconds: 45,
  }

  it('does not spend the retry budget collecting work already paid for', () => {
    StudyGuideCreationQueueStorage.upsert({
      ...interruptedHostedJob,
      autoRetryCount: 0,
    })

    const [job] = StudyGuideCreationQueueStorage.requeueRetryableJobs({
      resumableJobIds: ['server-owned-job'],
    })

    expect(job).toMatchObject({ status: 'queued', autoRetryCount: 0 })
  })

  it('keeps picking a resumable job up past the retry limit', () => {
    // A learner who refreshes twice must still get the guide they paid for.
    StudyGuideCreationQueueStorage.upsert({
      ...interruptedHostedJob,
      autoRetryCount: 5,
    })

    const [job] = StudyGuideCreationQueueStorage.requeueRetryableJobs({
      resumableJobIds: ['server-owned-job'],
    })

    expect(job).toMatchObject({ status: 'queued', autoRetryCount: 5 })
    expect(job.errorMessage).toBeNull()
  })

  it('offers a retry rather than taking one when the gateway has no job', () => {
    StudyGuideCreationQueueStorage.upsert({
      ...interruptedHostedJob,
      autoRetryCount: 0,
    })

    const [job] = StudyGuideCreationQueueStorage.requeueRetryableJobs({
      resumableJobIds: [],
    })

    expect(job).toMatchObject({
      status: 'failed',
      errorMessage: HOSTED_STUDY_GUIDE_MANUAL_RETRY_MESSAGE,
    })
  })

  it('gives up on an unknown job that is out of retries', () => {
    StudyGuideCreationQueueStorage.upsert({
      ...interruptedHostedJob,
      autoRetryCount: 1,
    })

    const [job] = StudyGuideCreationQueueStorage.requeueRetryableJobs({
      resumableJobIds: ['a-different-job'],
    })

    expect(job.status).toBe('failed')
    expect(job.errorMessage).toBe(HOSTED_STUDY_GUIDE_MANUAL_RETRY_MESSAGE)
  })
})

describe('a reload must not end a hosted generation', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.mocked(window.localStorage.getItem).mockImplementation(
      (key: string) => storage.get(key) ?? null,
    )
    vi.mocked(window.localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage.set(key, value)
      },
    )
    vi.mocked(window.localStorage.removeItem).mockImplementation(
      (key: string) => {
        storage.delete(key)
      },
    )
    vi.mocked(window.localStorage.clear).mockImplementation(() => {
      storage.clear()
    })
    window.localStorage.clear()
  })

  const hostedJob = {
    id: 'hosted-job',
    prompt: 'Study the sea',
    provider: 'hosted' as const,
    status: 'running' as const,
    estimateSeconds: 20,
  }

  it('never marks a hosted job interrupted when the tab unloads', () => {
    // The gateway is generating it. Closing a tab tells us nothing.
    StudyGuideCreationQueueStorage.upsert(hostedJob)

    StudyGuideCreationQueueStorage.markJobsInterrupted(['hosted-job'])

    expect(StudyGuideCreationQueueStorage.getAll()[0].status).toBe('running')
  })

  it('still marks a BYO job interrupted, because it really did stop', () => {
    StudyGuideCreationQueueStorage.upsert({
      ...hostedJob,
      id: 'gemini-job',
      provider: 'gemini',
    })

    StudyGuideCreationQueueStorage.markJobsInterrupted(['gemini-job'])

    expect(StudyGuideCreationQueueStorage.getAll()[0].status).toBe('interrupted')
  })

  it('leaves a hosted job alone when the gateway could not be asked', () => {
    // This is the "refresh twice and it dies" bug: an unreachable gateway used
    // to be read as proof the generation was gone.
    StudyGuideCreationQueueStorage.upsert(hostedJob)

    const [job] = StudyGuideCreationQueueStorage.requeueRetryableJobs({
      resumableJobIds: [],
      unresolvedJobIds: ['hosted-job'],
    })

    expect(job).toMatchObject({ status: 'running', errorMessage: null })
  })

  it('picks a hosted job back up in a tab that did not start it', () => {
    // Hosted work belongs to the gateway, so tab ownership must not strand it.
    StudyGuideCreationQueueStorage.upsert({
      ...hostedJob,
      ownerTabId: 'a-tab-that-is-gone',
    })

    const [job] = StudyGuideCreationQueueStorage.requeueRetryableJobs({
      tabId: 'a-brand-new-tab',
      resumableJobIds: ['hosted-job'],
    })

    expect(job.status).toBe('queued')
  })

  it('resumes a collecting job so the later pages are still collected', () => {
    StudyGuideCreationQueueStorage.upsert({
      ...hostedJob,
      status: 'collecting',
    })

    const [job] = StudyGuideCreationQueueStorage.requeueRetryableJobs({
      resumableJobIds: ['hosted-job'],
    })

    expect(job.status).toBe('queued')
  })
})

describe('a hosted card the queue gave up on', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.mocked(window.localStorage.getItem).mockImplementation(
      (key: string) => storage.get(key) ?? null,
    )
    vi.mocked(window.localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage.set(key, value)
      },
    )
    vi.mocked(window.localStorage.clear).mockImplementation(() => {
      storage.clear()
    })
    window.localStorage.clear()

    StudyGuideCreationQueueStorage.upsert({
      id: 'given-up-job',
      prompt: 'Study cardano',
      provider: 'hosted',
      status: 'failed',
      estimateSeconds: 20,
      errorMessage: HOSTED_STUDY_GUIDE_MANUAL_RETRY_MESSAGE,
    })
  })

  it('is collected once the gateway turns out to have the guide', () => {
    // The generation was paid for and finished on the server. Picking it back
    // up spends nothing, and leaving it failed strands a guide the learner owns.
    const jobs = StudyGuideCreationQueueStorage.requeueRetryableJobs({
      resumableJobIds: ['given-up-job'],
    })

    expect(jobs[0]).toMatchObject({
      id: 'given-up-job',
      status: 'queued',
      errorMessage: null,
      finishedAt: null,
    })
  })

  it('stays failed while the gateway does not vouch for it', () => {
    expect(
      StudyGuideCreationQueueStorage.requeueRetryableJobs()[0],
    ).toMatchObject({
      id: 'given-up-job',
      status: 'failed',
      errorMessage: HOSTED_STUDY_GUIDE_MANUAL_RETRY_MESSAGE,
    })
  })

  it('is left untouched while the gateway cannot be asked', () => {
    expect(
      StudyGuideCreationQueueStorage.requeueRetryableJobs({
        unresolvedJobIds: ['given-up-job'],
      })[0],
    ).toMatchObject({ id: 'given-up-job', status: 'failed' })
  })
})

describe('the checklist a refresh has to survive', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.mocked(window.localStorage.getItem).mockImplementation(
      (key: string) => storage.get(key) ?? null,
    )
    vi.mocked(window.localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage.set(key, value)
      },
    )
    vi.mocked(window.localStorage.clear).mockImplementation(() => {
      storage.clear()
    })
    window.localStorage.clear()
  })

  it('stores a snapshot and hands it back after the page life ends', () => {
    StudyGuideCreationQueueStorage.upsert({
      id: 'watched-job',
      prompt: 'Study ethereum',
      provider: 'hosted',
      status: 'running',
      estimateSeconds: 20,
    })
    StudyGuideCreationQueueStorage.update('watched-job', {
      previewSnapshot: {
        title: 'Ethereum basics',
        pages: [{ title: 'What a block is', done: true }],
      },
    })

    // Re-read from storage, which is all a reloaded tab ever gets.
    expect(StudyGuideCreationQueueStorage.getAll()[0].previewSnapshot).toEqual({
      title: 'Ethereum basics',
      pages: [{ title: 'What a block is', done: true }],
    })
  })

  it('keeps the snapshot when the job is picked back up', () => {
    StudyGuideCreationQueueStorage.upsert({
      id: 'resumed-job',
      prompt: 'Study ethereum',
      provider: 'hosted',
      status: 'running',
      estimateSeconds: 20,
      previewSnapshot: { title: 'Ethereum basics' },
    })

    const jobs = StudyGuideCreationQueueStorage.requeueRetryableJobs({
      resumableJobIds: ['resumed-job'],
    })

    expect(jobs[0]).toMatchObject({
      status: 'queued',
      previewSnapshot: { title: 'Ethereum basics' },
    })
  })
})

describe('how long a hosted job is given before it counts as gone', () => {
  it('waits while the gateway would still call the generation alive', () => {
    expect(
      isWithinHostedGatewayStaleWindow({ createdAt: new Date().toISOString() }),
    ).toBe(true)
  })

  it('stops waiting once the gateway would have called it dead', () => {
    expect(
      isWithinHostedGatewayStaleWindow({
        createdAt: new Date(
          Date.now() - HOSTED_STUDY_GUIDE_GATEWAY_STALE_MS - 1000,
        ).toISOString(),
      }),
    ).toBe(false)
  })
})
