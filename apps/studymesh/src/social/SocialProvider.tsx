import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../auth/supabaseClient'
import { createSocialRepository } from './repository'
import type { SocialOverview } from './types'

const emptyOverview: SocialOverview = {
  profile: null,
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  guideShares: [],
  notifications: [],
  unreadMessages: 0,
}

interface SocialContextValue {
  overview: SocialOverview
  loading: boolean
  error: string
  unreadCount: number
  refresh: () => Promise<void>
}

const SocialContext = createContext<SocialContextValue | null>(null)
const fallbackSocialContext: SocialContextValue = {
  overview: emptyOverview,
  loading: false,
  error: '',
  unreadCount: 0,
  refresh: async () => undefined,
}

export const SocialProvider = ({ children }: { children: React.ReactNode }) => {
  const auth = useAuth()
  const repository = useMemo(() => createSocialRepository(supabase), [])
  const [overview, setOverview] = useState(emptyOverview)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!auth.user) {
      setOverview(emptyOverview)
      return
    }
    setLoading(true)
    try {
      setOverview(await repository.loadOverview())
      setError('')
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'Social sync failed.',
      )
    } finally {
      setLoading(false)
    }
  }, [auth.user, repository])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!auth.user) {
      return undefined
    }

    const touch = () => void repository.touchPresence().catch(() => undefined)
    touch()
    const presenceTimer = window.setInterval(touch, 60_000)
    const channel = supabase
      .channel(`social:${auth.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'social_friendships' },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'social_direct_messages' },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'social_guide_shares' },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'social_notifications' },
        () => void refresh(),
      )
      .subscribe()

    return () => {
      window.clearInterval(presenceTimer)
      void supabase.removeChannel(channel)
    }
  }, [auth.user, refresh, repository])

  const unreadCount =
    overview.unreadMessages +
    overview.notifications.filter((notification) => !notification.readAt)
      .length

  return (
    <SocialContext.Provider
      value={{ overview, loading, error, unreadCount, refresh }}
    >
      {children}
    </SocialContext.Provider>
  )
}

export const useSocial = () => {
  const context = useContext(SocialContext)
  return context || fallbackSocialContext
}
