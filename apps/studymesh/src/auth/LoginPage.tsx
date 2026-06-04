import React, { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import GoogleIcon from '@mui/icons-material/Google'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'

import {
  signInWithEmail,
  signInWithGoogle,
  useAuth,
} from './AuthProvider'
import {
  AuthPageFrame,
  getAuthRedirectUrl,
  getErrorMessage,
  getRedirectPath,
} from './authUi'

const LoginPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading } = useAuth()
  const redirectPath = useMemo(
    () => getRedirectPath(location.search),
    [location.search],
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!loading && user) {
      navigate(redirectPath, { replace: true })
    }
  }, [loading, navigate, redirectPath, user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage('')

    try {
      await signInWithEmail(email.trim(), password)
      navigate(redirectPath, { replace: true })
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, 'Could not sign in with those credentials.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleSubmitting(true)
    setErrorMessage('')

    try {
      await signInWithGoogle(
        getAuthRedirectUrl(
          `/auth/callback?redirect=${encodeURIComponent(redirectPath)}`,
        ),
      )
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, 'Could not start Google sign in.'),
      )
      setGoogleSubmitting(false)
    }
  }

  return (
    <AuthPageFrame
      title="Sign in"
      subtitle="Open your StudyMesh workspace from any device."
      footer={
        <Typography variant="body2" color="text.secondary" align="center">
          New to StudyMesh?{' '}
          <Link
            component={RouterLink}
            to={`/signup?redirect=${encodeURIComponent(redirectPath)}`}
            fontWeight={700}
          >
            Create an account
          </Link>
        </Typography>
      }
    >
      <Stack component="form" spacing={2.25} onSubmit={handleSubmit}>
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        <Button
          type="button"
          variant="outlined"
          size="large"
          startIcon={<GoogleIcon />}
          onClick={handleGoogleSignIn}
          disabled={submitting || googleSubmitting}
        >
          {googleSubmitting ? 'Connecting...' : 'Continue with Google'}
        </Button>
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          fullWidth
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          fullWidth
        />
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={2}
        >
          <Link
            component={RouterLink}
            to="/reset-password"
            variant="body2"
            fontWeight={700}
          >
            Forgot password?
          </Link>
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={<LoginRoundedIcon />}
            disabled={submitting || googleSubmitting}
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </Stack>
      </Stack>
    </AuthPageFrame>
  )
}

export default LoginPage
