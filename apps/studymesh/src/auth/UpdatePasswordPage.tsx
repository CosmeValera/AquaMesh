import React, { FormEvent, useState } from 'react'
import { Alert, Button, Link, Stack, TextField, Typography } from '@mui/material'
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded'
import { Link as RouterLink, useNavigate } from 'react-router-dom'

import { updatePassword } from './AuthProvider'
import {
  AuthPageFrame,
  PASSWORD_MIN_LENGTH,
  getErrorMessage,
} from './authUi'

const UpdatePasswordPage = () => {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

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
      await updatePassword(password)
      setSuccessMessage('Password updated. Redirecting to your workspace...')
      window.setTimeout(() => {
        navigate('/study-guides', { replace: true })
      }, 900)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Could not update password.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPageFrame
      title="Choose new password"
      subtitle="Set a new password for your StudyMesh account."
      footer={
        <Typography variant="body2" color="text.secondary" align="center">
          Already updated?{' '}
          <Link component={RouterLink} to="/login" fontWeight={700}>
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
        <TextField
          label="New password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
          fullWidth
          helperText={`Use at least ${PASSWORD_MIN_LENGTH} characters.`}
        />
        <TextField
          label="Confirm new password"
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
          startIcon={<LockResetRoundedIcon />}
          disabled={submitting}
        >
          {submitting ? 'Updating...' : 'Update password'}
        </Button>
      </Stack>
    </AuthPageFrame>
  )
}

export default UpdatePasswordPage
