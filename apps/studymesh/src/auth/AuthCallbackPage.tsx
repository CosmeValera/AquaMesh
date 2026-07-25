import React, { useEffect, useMemo } from 'react'
import { Alert, CircularProgress, Stack, Typography } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from './AuthProvider'
import { AuthPageFrame, getRedirectPath } from './authUi'

const AuthCallbackPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading, error } = useAuth()
  const redirectPath = useMemo(
    () => getRedirectPath(location.search),
    [location.search],
  )

  useEffect(() => {
    if (!loading && user) {
      navigate(redirectPath, { replace: true })
    }
  }, [loading, navigate, redirectPath, user])

  useEffect(() => {
    if (!loading && !user && !error) {
      const timeoutId = window.setTimeout(() => {
        navigate('/login', { replace: true })
      }, 2500)

      return () => window.clearTimeout(timeoutId)
    }

    return undefined
  }, [error, loading, navigate, user])

  return (
    <AuthPageFrame
      title="Finishing sign in"
      subtitle="RabbitHole is connecting your account."
      showBackLink={false}
    >
      <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
        {error ? (
          <Alert severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        ) : (
          <>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary" align="center">
              This usually takes a moment.
            </Typography>
          </>
        )}
      </Stack>
    </AuthPageFrame>
  )
}

export default AuthCallbackPage
