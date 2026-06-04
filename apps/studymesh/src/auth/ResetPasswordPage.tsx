import React, { FormEvent, useState } from 'react'
import { Alert, Button, Link, Stack, TextField, Typography } from '@mui/material'
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded'
import { Link as RouterLink } from 'react-router-dom'

import { resetPassword } from './AuthProvider'
import { AuthPageFrame, getAuthRedirectUrl, getErrorMessage } from './authUi'

const ResetPasswordPage = () => {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await resetPassword(
        email.trim(),
        getAuthRedirectUrl('/account/update-password'),
      )
      setSuccessMessage('Password reset link sent. Check your email.')
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, 'Could not send a password reset email.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPageFrame
      title="Reset password"
      subtitle="Enter your email and StudyMesh will send a secure reset link."
      footer={
        <Typography variant="body2" color="text.secondary" align="center">
          Remembered it?{' '}
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
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          startIcon={<MarkEmailReadRoundedIcon />}
          disabled={submitting}
        >
          {submitting ? 'Sending...' : 'Send reset link'}
        </Button>
      </Stack>
    </AuthPageFrame>
  )
}

export default ResetPasswordPage
