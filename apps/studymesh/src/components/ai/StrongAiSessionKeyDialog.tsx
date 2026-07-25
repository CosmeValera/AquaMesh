import React, { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  saveQuickCreateAiSessionKey,
  StrongAiProviderId,
  STRONG_AI_PROVIDERS,
} from '../../quickCreate/ai'

interface StrongAiSessionKeyDialogProps {
  open: boolean
  provider: StrongAiProviderId
  model: string
  onCancel: () => void
  onSaved: () => void
}

const StrongAiSessionKeyDialog: React.FC<StrongAiSessionKeyDialogProps> = ({
  open,
  provider,
  model,
  onCancel,
  onSaved,
}) => {
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const providerConfig = STRONG_AI_PROVIDERS[provider]

  useEffect(() => {
    if (open) {
      setApiKey('')
      setError('')
    }
  }, [open, provider])

  const saveKey = () => {
    const token = apiKey.trim()
    if (!token) {
      setError(`Paste your ${providerConfig.label} API key to continue.`)
      return
    }

    saveQuickCreateAiSessionKey(provider, token, model)
    onSaved()
  }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      fullWidth
      maxWidth="xs"
      aria-labelledby="strong-ai-session-key-title"
    >
      <DialogTitle id="strong-ai-session-key-title">
        {providerConfig.label} API key
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Enter your API key for this browser session. RabbitHole will not save
            it in local storage.
          </Typography>
          {error ? <Alert severity="warning">{error}</Alert> : null}
          <TextField
            autoFocus
            fullWidth
            type="password"
            label="API key"
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.target.value)
              setError('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                saveKey()
              }
            }}
            helperText="Session-only. You may need to enter it again after closing the app."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={saveKey}>
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default StrongAiSessionKeyDialog
