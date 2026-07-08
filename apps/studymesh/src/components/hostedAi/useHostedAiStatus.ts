import React from 'react'

import {
  getHostedAiStatus,
  HOSTED_AI_USAGE_CHANGED_EVENT,
  HOSTED_AI_VISUAL_SPEND_EVENT,
  HostedAiStatus,
} from '../../quickCreate/ai'
import { useAuth } from '../../auth/AuthProvider'

const HOSTED_AI_CREDITS_CACHE_KEY = 'studymesh-hosted-ai-credits-v1'

interface HostedAiCreditsCache {
  ownerId: string
  studyCredits: number
}

const readCachedStudyCredits = (ownerId?: string): number | null => {
  if (!ownerId) {
    return null
  }

  try {
    const cached = JSON.parse(
      window.localStorage.getItem(HOSTED_AI_CREDITS_CACHE_KEY) || 'null',
    ) as HostedAiCreditsCache | null

    return cached?.ownerId === ownerId &&
      typeof cached.studyCredits === 'number'
      ? cached.studyCredits
      : null
  } catch {
    return null
  }
}

const writeCachedStudyCredits = (
  ownerId: string,
  studyCredits: number,
): void => {
  try {
    window.localStorage.setItem(
      HOSTED_AI_CREDITS_CACHE_KEY,
      JSON.stringify({ ownerId, studyCredits }),
    )
  } catch {
    // Cache is visual-only; status fetch remains authoritative.
  }
}

interface UseHostedAiStatusResult {
  status: HostedAiStatus | null
  displayStudyCredits: number | null
  loading: boolean
  error: string
  refresh: () => Promise<void>
}

export const useHostedAiStatus = (): UseHostedAiStatusResult => {
  const auth = useAuth()
  const ownerId = auth.user?.id
  const [status, setStatus] = React.useState<HostedAiStatus | null>(null)
  const [cachedStudyCredits, setCachedStudyCredits] = React.useState<
    number | null
  >(() => readCachedStudyCredits(ownerId))
  const displayStudyCredits = status?.accountReady
    ? (cachedStudyCredits ?? status.studyCredits)
    : cachedStudyCredits
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const refresh = React.useCallback(async () => {
    if (!ownerId) {
      setStatus(null)
      setCachedStudyCredits(null)
      setError('')
      return
    }

    setLoading(true)
    try {
      const nextStatus = await getHostedAiStatus()
      setStatus(nextStatus)
      setCachedStudyCredits(nextStatus.studyCredits)
      writeCachedStudyCredits(ownerId, nextStatus.studyCredits)
      setError(nextStatus.message || '')
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Could not load Study Credits.',
      )
    } finally {
      setLoading(false)
    }
  }, [ownerId])

  React.useEffect(() => {
    setStatus(null)
    setCachedStudyCredits(readCachedStudyCredits(ownerId))
    void refresh()

    const syncCachedStudyCredits = (event: StorageEvent): void => {
      if (event.key === HOSTED_AI_CREDITS_CACHE_KEY) {
        setCachedStudyCredits(readCachedStudyCredits(ownerId))
      }
    }

    const applyVisualSpend = (event: Event): void => {
      const credits = (event as CustomEvent<{ credits?: unknown }>).detail
        ?.credits
      if (typeof credits !== 'number' || credits <= 0) {
        return
      }

      setCachedStudyCredits((current) => {
        if (current === null) {
          return current
        }

        const next = Math.max(0, current - credits)
        if (ownerId) {
          writeCachedStudyCredits(ownerId, next)
        }
        return next
      })
    }

    window.addEventListener(HOSTED_AI_USAGE_CHANGED_EVENT, refresh)
    window.addEventListener(HOSTED_AI_VISUAL_SPEND_EVENT, applyVisualSpend)
    window.addEventListener('storage', syncCachedStudyCredits)

    return () => {
      window.removeEventListener(HOSTED_AI_USAGE_CHANGED_EVENT, refresh)
      window.removeEventListener(HOSTED_AI_VISUAL_SPEND_EVENT, applyVisualSpend)
      window.removeEventListener('storage', syncCachedStudyCredits)
    }
  }, [ownerId, refresh])

  return {
    status,
    displayStudyCredits,
    loading,
    error,
    refresh,
  }
}
