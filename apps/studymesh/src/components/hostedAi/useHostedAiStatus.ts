import React from 'react'

import {
  getHostedAiStatus,
  HOSTED_AI_USAGE_CHANGED_EVENT,
  HostedAiStatus,
  markHostedAiIntroSeen,
} from '../../studyPack/ai'
import { useAuth } from '../../auth/AuthProvider'

interface UseHostedAiStatusResult {
  status: HostedAiStatus | null
  loading: boolean
  error: string
  refresh: () => Promise<void>
  markIntroSeen: () => Promise<void>
}

export const useHostedAiStatus = (): UseHostedAiStatusResult => {
  const auth = useAuth()
  const [status, setStatus] = React.useState<HostedAiStatus | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const refresh = React.useCallback(async () => {
    if (!auth.user) {
      setStatus(null)
      setError('')
      return
    }

    setLoading(true)
    try {
      const nextStatus = await getHostedAiStatus()
      setStatus(nextStatus)
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
  }, [auth.user])

  React.useEffect(() => {
    void refresh()

    window.addEventListener(HOSTED_AI_USAGE_CHANGED_EVENT, refresh)
    window.addEventListener('storage', refresh)

    return () => {
      window.removeEventListener(HOSTED_AI_USAGE_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [refresh])

  const markIntroSeen = React.useCallback(async () => {
    const nextStatus = await markHostedAiIntroSeen()
    setStatus(nextStatus)
    setError(nextStatus.message || '')
  }, [])

  return { status, loading, error, refresh, markIntroSeen }
}
