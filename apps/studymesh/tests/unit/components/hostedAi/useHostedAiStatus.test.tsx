import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hostedAiMocks = vi.hoisted(() => ({
  getHostedAiStatus: vi.fn(),
  markHostedAiIntroSeen: vi.fn(),
}))

vi.mock('../../../../src/quickCreate/ai', () => ({
  getHostedAiStatus: hostedAiMocks.getHostedAiStatus,
  markHostedAiIntroSeen: hostedAiMocks.markHostedAiIntroSeen,
  HOSTED_AI_USAGE_CHANGED_EVENT: 'studymesh-hosted-ai-usage-changed',
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
    const cachedStatus = makeStatus(8)
    let resolveStatus: (status: ReturnType<typeof makeStatus>) => void
    hostedAiMocks.getHostedAiStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveStatus = resolve
      }),
    )
    localStorage.getItem.mockReturnValue(
      JSON.stringify({ ownerId: 'user-1', status: cachedStatus }),
    )

    const { result } = renderHook(() => useHostedAiStatus())

    expect(result.current.status?.studyCredits).toBe(8)
    expect(result.current.loading).toBe(true)

    resolveStatus!(makeStatus(6))

    await waitFor(() => {
      expect(result.current.status?.studyCredits).toBe(6)
    })
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'studymesh-hosted-ai-status-v1',
      expect.stringContaining('"studyCredits":6'),
    )
  })

  it('does not show another user cached credits', () => {
    hostedAiMocks.getHostedAiStatus.mockReturnValue(new Promise(() => {}))
    localStorage.getItem.mockReturnValue(
      JSON.stringify({ ownerId: 'user-2', status: makeStatus(99) }),
    )

    const { result } = renderHook(() => useHostedAiStatus())

    expect(result.current.status).toBeNull()
  })
})
