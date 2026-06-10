import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelAllLocalAiSessions,
  cancelLocalAiSession,
  getLocalAiSessionDebugState,
  resetLocalAiSessionManagerForTests,
  runLocalAiPrompt,
} from '../../../src/quickCreate/ai'

const createAbortAwarePrompt = (resolveAfterMs = 1000) =>
  vi.fn(
    (_prompt: string, options?: { signal?: AbortSignal }) =>
      new Promise<string>((resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const error = new Error('Aborted')
          error.name = 'AbortError'
          reject(error)
        })

        if (resolveAfterMs > 0) {
          setTimeout(() => resolve('done'), resolveAfterMs)
        }
      }),
  )

describe('localAiSessionManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetLocalAiSessionManagerForTests()
  })

  afterEach(() => {
    resetLocalAiSessionManagerForTests()
    vi.useRealTimers()
  })

  it('destroys the session after success', async () => {
    const destroy = vi.fn()
    const prompt = vi.fn().mockResolvedValue('ok')

    await expect(
      runLocalAiPrompt({
        createSession: async () => ({ prompt, destroy }),
        prompt: 'Return ok',
        promptType: 'smoke',
      }),
    ).resolves.toBe('ok')

    expect(destroy).toHaveBeenCalledTimes(1)
    expect(getLocalAiSessionDebugState()[0]).toMatchObject({
      status: 'completed',
      destroyed: true,
    })
  })

  it('destroys the session after failure', async () => {
    const destroy = vi.fn()
    const prompt = vi.fn().mockRejectedValue(new Error('failed'))

    await expect(
      runLocalAiPrompt({
        createSession: async () => ({ prompt, destroy }),
        prompt: 'Fail',
        promptType: 'quick-create',
      }),
    ).rejects.toThrow('failed')

    expect(destroy).toHaveBeenCalledTimes(1)
    expect(getLocalAiSessionDebugState()[0]).toMatchObject({
      status: 'failed',
      destroyed: true,
      errorMessage: 'failed',
    })
  })

  it('cancels and destroys one active session', async () => {
    const destroy = vi.fn()
    const prompt = createAbortAwarePrompt()
    const request = runLocalAiPrompt({
      createSession: async () => ({ prompt, destroy }),
      prompt: 'Long prompt',
      promptType: 'planner',
    })

    await vi.waitFor(() => {
      expect(getLocalAiSessionDebugState()[0]?.status).toBe('running')
    })

    const id = getLocalAiSessionDebugState()[0].id
    cancelLocalAiSession(id)

    await expect(request).rejects.toThrow('cancelled')
    expect(destroy).toHaveBeenCalled()
    expect(getLocalAiSessionDebugState()[0]).toMatchObject({
      status: 'cancelled',
      destroyed: true,
    })
  })

  it('cancelAllLocalAiSessions cancels active sessions', async () => {
    const firstDestroy = vi.fn()
    const secondDestroy = vi.fn()
    const firstRequest = runLocalAiPrompt({
      createSession: async () => ({
        prompt: createAbortAwarePrompt(),
        destroy: firstDestroy,
      }),
      prompt: 'First',
      promptType: 'notes',
    })
    const secondRequest = runLocalAiPrompt({
      createSession: async () => ({
        prompt: createAbortAwarePrompt(),
        destroy: secondDestroy,
      }),
      prompt: 'Second',
      promptType: 'quizzes',
    })

    await vi.waitFor(() => {
      expect(
        getLocalAiSessionDebugState().filter(
          (session) => session.status === 'running',
        ),
      ).toHaveLength(2)
    })

    cancelAllLocalAiSessions()

    await expect(firstRequest).rejects.toThrow('cancelled')
    await expect(secondRequest).rejects.toThrow('cancelled')
    expect(firstDestroy).toHaveBeenCalled()
    expect(secondDestroy).toHaveBeenCalled()
    expect(
      getLocalAiSessionDebugState().every(
        (session) => session.status === 'cancelled' && session.destroyed,
      ),
    ).toBe(true)
  })

  it('marks long-running sessions as stale in debug state', async () => {
    const request = runLocalAiPrompt({
      createSession: async () => ({
        prompt: createAbortAwarePrompt(0),
        destroy: vi.fn(),
      }),
      prompt: 'Long prompt',
      promptType: 'markdown1',
    })

    await vi.waitFor(() => {
      expect(getLocalAiSessionDebugState()[0]?.status).toBe('running')
    })

    vi.advanceTimersByTime(6 * 60 * 1000)

    expect(getLocalAiSessionDebugState()[0]).toMatchObject({
      status: 'stale',
      stale: true,
    })

    cancelAllLocalAiSessions()
    await expect(request).rejects.toThrow('cancelled')
  })
})
