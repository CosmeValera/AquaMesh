import React, { FormEvent, useState } from 'react'
import {
  Alert,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/AuthProvider'
import { PASSWORD_MIN_LENGTH, getErrorMessage } from '../../auth/authUi'
import { useInterfaceText } from '../../language/interfaceLanguage'

const GuestUpgradePanel = () => {
  const navigate = useNavigate()
  const { t } = useInterfaceText()
  const { upgradeGuestAccount } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')

    if (password.length < PASSWORD_MIN_LENGTH) {
      setErrorMessage(t('guest.passwordTooShort'))
      return
    }

    setSubmitting(true)
    try {
      await upgradeGuestAccount(
        email.trim(),
        password,
        displayName.trim() || undefined,
      )
      navigate('/study-guides')
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('guest.upgradeFailed')))
      setSubmitting(false)
    }
  }

  return (
    <Paper
      elevation={0}
      sx={{ p: { xs: 2, md: 3 }, border: 1, borderColor: 'divider' }}
    >
      <Stack component="form" spacing={2.25} onSubmit={handleSubmit}>
        <Stack spacing={1}>
          <Typography variant="h6" component="h2" fontWeight={800}>
            {t('guest.upgradeTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('guest.upgradeBody')}
          </Typography>
        </Stack>
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        <TextField
          label={t('guest.name')}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          autoComplete="name"
          fullWidth
        />
        <TextField
          label={t('guest.email')}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          fullWidth
        />
        <TextField
          label={t('guest.password')}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
          fullWidth
          helperText={`${t('guest.passwordHelpPrefix')} ${PASSWORD_MIN_LENGTH} ${t(
            'guest.passwordHelpSuffix',
          )}`}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          startIcon={<PersonAddAltRoundedIcon />}
          disabled={submitting}
          sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
        >
          {submitting ? t('guest.creatingAccount') : t('guest.createAccount')}
        </Button>
      </Stack>
    </Paper>
  )
}

export default GuestUpgradePanel
