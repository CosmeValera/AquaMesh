import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  HOSTED_STUDY_GUIDE_MANUAL_RETRY_MESSAGE,
  STUDY_GUIDE_CREATION_QUEUE_KEY,
  StudyGuideCreationQueueStorage,
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
      provider: 'hosted',
      status: 'running',
      estimateSeconds: 20,
    })

    expect(StudyGuideCreationQueueStorage.requeueRetryableJobs()).toMatchObject(
      [
        {
          id: 'running-job',
          status: 'queued',
          autoRetryCount: 1,
          errorMessage: null,
        },
      ],
    )
  })

  it('stops hosted auto retry after one recovery attempt', () => {
    StudyGuideCreationQueueStorage.upsert({
      id: 'running-job',
      prompt: 'Study chemistry',
      provider: 'hosted',
      status: 'running',
      estimateSeconds: 20,
      autoRetryCount: 1,
    })

    expect(StudyGuideCreationQueueStorage.requeueRetryableJobs()).toMatchObject(
      [
        {
          id: 'running-job',
          status: 'failed',
          autoRetryCount: 1,
          errorMessage: HOSTED_STUDY_GUIDE_MANUAL_RETRY_MESSAGE,
        },
      ],
    )
  })

  it('requeues retryable failed jobs but leaves provider failures failed', () => {
    StudyGuideCreationQueueStorage.upsert({
      id: 'network-job',
      prompt: 'Study physics',
      provider: 'hosted',
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
      autoRetryCount: 1,
      errorMessage: null,
    })
    expect(jobs.find((job) => job.id === 'provider-job')).toMatchObject({
      status: 'failed',
      errorMessage: 'Cerebras hosted AI request failed.',
    })
  })
})
