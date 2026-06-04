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
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'

import {
  signInWithGoogle,
  signUpWithEmail,
  useAuth,
} from './AuthProvider'
import {
  AuthPageFrame,
  PASSWORD_MIN_LENGTH,
  getAuthRedirectUrl,
  getErrorMessage,
  getRedirectPath,
} from './authUi'

const SignupPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading } = useAuth()
  const redirectPath = useMemo(
    () => getRedirectPath(location.search),
    [location.search],
  )
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!loading && user) {
      navigate(redirectPath, { replace: true })
    }
  }, [loading, navigate, redirectPath, user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    if (password.length < PASSWORD_MIN_LENGTH) {
      setSubmitting(false)
      setErrorMessage(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
      return
    }

    if (password !== confirmPassword) {
      setSubmitting(false)
      setErrorMessage('Passwords do not match.')
      return
    }

    try {
      await signUpWithEmail(email.trim(), password, {
        displayName: displayName.trim(),
        redirectTo: getAuthRedirectUrl(
          `/auth/callback?redirect=${encodeURIComponent(redirectPath)}`,
        ),
      })
      setSuccessMessage(
        'Account created. Check your email if confirmation is enabled.',
      )
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, 'Could not create your account.'),
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
      title="Create account"
      subtitle="Save dashboards, widgets, and study progress to your cloud workspace."
      footer={
        <Typography variant="body2" color="text.secondary" align="center">
          Already have an account?{' '}
          <Link
            component={RouterLink}
            to={`/login?redirect=${encodeURIComponent(redirectPath)}`}
            fontWeight={700}
          >
            Sign in
          </Link>
        </Typography>
      }
    >
      <Stack component="form" spacing={2.25} onSubmit={handleSubmit}>
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        {successMessage ? (
          <Alert severity="success">{successMessage}</Alert>
        ) : null}
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
          label="Name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          autoComplete="name"
          fullWidth
        />
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
          autoComplete="new-password"
          required
          fullWidth
          helperText={`Use at least ${PASSWORD_MIN_LENGTH} characters.`}
        />
        <TextField
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          startIcon={<PersonAddAltRoundedIcon />}
          disabled={submitting || googleSubmitting}
        >
          {submitting ? 'Creating account...' : 'Create account'}
        </Button>
      </Stack>
    </AuthPageFrame>
  )
}

export default SignupPage
