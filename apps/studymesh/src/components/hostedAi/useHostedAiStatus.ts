import React from 'react'

import {
  getHostedAiStatus,
  HOSTED_AI_USAGE_CHANGED_EVENT,
  HostedAiStatus,
  markHostedAiIntroSeen,
} from '../../quickCreate/ai'
import { useAuth } from '../../auth/AuthProvider'

const HOSTED_AI_STATUS_CACHE_KEY = 'studymesh-hosted-ai-status-v1'

interface HostedAiStatusCache {
  ownerId: string
  status: HostedAiStatus
}

const readCachedStatus = (ownerId?: string): HostedAiStatus | null => {
  if (!ownerId) {
    return null
  }

  try {
    const cached = JSON.parse(
      window.localStorage.getItem(HOSTED_AI_STATUS_CACHE_KEY) || 'null',
    ) as HostedAiStatusCache | null

    return cached?.ownerId === ownerId ? cached.status : null
  } catch {
    return null
  }
}

const writeCachedStatus = (ownerId: string, status: HostedAiStatus): void => {
  try {
    window.localStorage.setItem(
      HOSTED_AI_STATUS_CACHE_KEY,
      JSON.stringify({ ownerId, status }),
    )
  } catch {
    // Cache is visual-only; status fetch remains authoritative.
  }
}

interface UseHostedAiStatusResult {
  status: HostedAiStatus | null
  loading: boolean
  error: string
  refresh: () => Promise<void>
  markIntroSeen: () => Promise<void>
}

export const useHostedAiStatus = (): UseHostedAiStatusResult => {
  const auth = useAuth()
  const ownerId = auth.user?.id
  const [status, setStatus] = React.useState<HostedAiStatus | null>(() =>
    readCachedStatus(ownerId),
  )
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const refresh = React.useCallback(async () => {
    if (!ownerId) {
      setStatus(null)
      setError('')
      return
    }

    setLoading(true)
    try {
      const nextStatus = await getHostedAiStatus()
      setStatus(nextStatus)
      writeCachedStatus(ownerId, nextStatus)
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
    setStatus(readCachedStatus(ownerId))
    void refresh()

    const syncCachedStatus = (event: StorageEvent): void => {
      if (event.key === HOSTED_AI_STATUS_CACHE_KEY) {
        setStatus(readCachedStatus(ownerId))
      }
    }

    window.addEventListener(HOSTED_AI_USAGE_CHANGED_EVENT, refresh)
    window.addEventListener('storage', syncCachedStatus)

    return () => {
      window.removeEventListener(HOSTED_AI_USAGE_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', syncCachedStatus)
    }
  }, [ownerId, refresh])

  const markIntroSeen = React.useCallback(async () => {
    const nextStatus = await markHostedAiIntroSeen()
    setStatus(nextStatus)
    if (ownerId) {
      writeCachedStatus(ownerId, nextStatus)
    }
    setError(nextStatus.message || '')
  }, [ownerId])

  return { status, loading, error, refresh, markIntroSeen }
}
