import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'
import { Navigate, useLocation } from 'react-router-dom'
import type { Session, User } from '@supabase/supabase-js'

import {
  getSupabaseConfigError,
  isSupabaseConfigured,
  supabase,
} from './supabaseClient'

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  error?: string
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUpWithPassword: (
    email: string,
    password: string,
    options?: { displayName?: string; redirectTo?: string },
  ) => Promise<void>
  sendPasswordReset: (email: string, redirectTo?: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const requireSupabaseConfig = () => {
  if (!isSupabaseConfigured) {
    throw new Error(getSupabaseConfigError())
  }
}

const mapAuthError = (error?: { message?: string } | null) => {
  if (error?.message) {
    throw new Error(error.message)
  }
}

const getDisplayName = (user: User) => {
  const metadataName =
    typeof user.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : ''

  return metadataName || user.email || 'Student'
}

const writeLegacyUserData = (user: User | null) => {
  try {
    if (!user) {
      localStorage.removeItem('userData')
      window.dispatchEvent(new CustomEvent('studymesh-user-role-changed'))
      return
    }

    const userData = {
      id: user.id,
      name: getDisplayName(user),
      email: user.email,
      role: 'ADMIN_ROLE',
    }

    localStorage.setItem('userData', JSON.stringify(userData))
    window.dispatchEvent(
      new CustomEvent('studymesh-user-role-changed', { detail: userData }),
    )
  } catch (error) {
    console.error('Failed to write auth user data', error)
  }
}

export const signInWithEmail = async (email: string, password: string) => {
  requireSupabaseConfig()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  mapAuthError(error)
}

export const signUpWithEmail = async (
  email: string,
  password: string,
  options: { displayName?: string; redirectTo?: string } = {},
) => {
  requireSupabaseConfig()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: options.redirectTo,
      data: options.displayName
        ? { display_name: options.displayName }
        : undefined,
    },
  })
  mapAuthError(error)
}

export const signInWithGoogle = async (redirectTo?: string) => {
  requireSupabaseConfig()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  mapAuthError(error)
}

export const resetPassword = async (email: string, redirectTo?: string) => {
  requireSupabaseConfig()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  })
  mapAuthError(error)
}

export const updatePassword = async (password: string) => {
  requireSupabaseConfig()
  const { error } = await supabase.auth.updateUser({ password })
  mapAuthError(error)
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>(
    getSupabaseConfigError() || undefined,
  )

  useEffect(() => {
    writeLegacyUserData(session?.user || null)
  }, [session?.user])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return undefined
    }

    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!mounted) {
          return
        }

        if (sessionError) {
          setError(sessionError.message)
        }
        setSession(data.session)
        writeLegacyUserData(data.session?.user || null)
      })
      .catch((sessionError: unknown) => {
        if (mounted) {
          setError(
            sessionError instanceof Error
              ? sessionError.message
              : 'Could not read auth session.',
          )
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      writeLegacyUserData(nextSession?.user || null)
      setError(undefined)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user || null,
      session,
      loading,
      error,
      signInWithGoogle,
      signInWithPassword: signInWithEmail,
      signUpWithPassword: signUpWithEmail,
      sendPasswordReset: resetPassword,
      updatePassword,
      signOut: async () => {
        requireSupabaseConfig()
        const { error: signOutError } = await supabase.auth.signOut()
        mapAuthError(signOutError)
        setSession(null)
        writeLegacyUserData(null)
      },
    }),
    [error, loading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          gap: 2,
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={34} />
          <Typography sx={{ mt: 2 }} color="text.secondary">
            Loading StudyMesh...
          </Typography>
        </Box>
      </Box>
    )
  }

  if (!user) {
    const redirect = `${location.pathname}${location.search}`
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(redirect)}`}
        replace
      />
    )
  }

  return <>{children}</>
}
