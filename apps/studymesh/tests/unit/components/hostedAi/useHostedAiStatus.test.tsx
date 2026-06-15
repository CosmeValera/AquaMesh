import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hostedAiMocks = vi.hoisted(() => ({
  getHostedAiStatus: vi.fn(),
  markHostedAiIntroSeen: vi.fn(),
}))

vi.mock('../../../../src/quickCreate/ai', () => ({
  getHostedAiStatus: hostedAiMocks.getHostedAiStatus,
  markHostedAiIntroSeen: hostedAiMocks.markHostedAiIntroSeen,
  HOSTED_AI_USAGE_CHANGED_EVENT: 'studymesh-hosted-ai-usage-changed',
  HOSTED_AI_VISUAL_SPEND_EVENT: 'studymesh-hosted-ai-visual-spend',
}))

vi.mock('../../../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
  }),
}))

import { useHostedAiStatus } from '../../../../src/components/hostedAi/useHostedAiStatus'

const makeStatus = (studyCredits: number) => ({
  available: true,
  accountReady: true,
  introSeen: true,
  studyCredits,
  dailyFreeCredits: 5,
  initialFreeCredits: 20,
  costs: {
    'study-guide': 2,
    'quick-create': 1,
    chat: 1,
  },
})

describe('useHostedAiStatus', () => {
  beforeEach(() => {
    localStorage.getItem.mockReturnValue(null)
  })

  it('shows user cached credits while authoritative status loads', async () => {
    let resolveStatus: (status: ReturnType<typeof makeStatus>) => void
    hostedAiMocks.getHostedAiStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveStatus = resolve
      }),
    )
    localStorage.getItem.mockReturnValue(
      JSON.stringify({ ownerId: 'user-1', studyCredits: 8 }),
    )

    const { result } = renderHook(() => useHostedAiStatus())

    expect(result.current.status).toBeNull()
    expect(result.current.displayStudyCredits).toBe(8)
    expect(result.current.loading).toBe(true)

    resolveStatus!(makeStatus(6))

    await waitFor(() => {
      expect(result.current.status?.studyCredits).toBe(6)
      expect(result.current.displayStudyCredits).toBe(6)
    })
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'studymesh-hosted-ai-credits-v1',
      expect.stringContaining('"studyCredits":6'),
    )
  })

  it('does not show another user cached credits', () => {
    hostedAiMocks.getHostedAiStatus.mockReturnValue(new Promise(() => {}))
    localStorage.getItem.mockReturnValue(
      JSON.stringify({ ownerId: 'user-2', studyCredits: 99 }),
    )

    const { result } = renderHook(() => useHostedAiStatus())

    expect(result.current.status).toBeNull()
    expect(result.current.displayStudyCredits).toBeNull()
  })

  it('optimistically deducts visual credits without changing status', async () => {
    hostedAiMocks.getHostedAiStatus.mockResolvedValue(makeStatus(8))

    const { result } = renderHook(() => useHostedAiStatus())

    await waitFor(() => {
      expect(result.current.status?.studyCredits).toBe(8)
    })

    act(() => {
      window.dispatchEvent(
        new CustomEvent('studymesh-hosted-ai-visual-spend', {
          detail: { credits: 2 },
        }),
      )
    })

    expect(result.current.displayStudyCredits).toBe(6)
    expect(result.current.status?.studyCredits).toBe(8)
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'studymesh-hosted-ai-credits-v1',
      JSON.stringify({ ownerId: 'user-1', studyCredits: 6 }),
    )
  })
})
