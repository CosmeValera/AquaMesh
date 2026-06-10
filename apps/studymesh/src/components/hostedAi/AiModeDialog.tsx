import React from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'

import { dispatchWorkspaceOnboardingNotice } from '../onboarding/onboardingEvents'
import {
  DEFAULT_STUDY_PACK_AI_MODEL,
  getEnvStrongAiProviderApiKey,
  getStudyPackAiCredentialForProvider,
  isStrongAiProvider,
  readStudyPackAiSettings,
  saveStudyPackAiSettings,
  StrongAiProviderCredentials,
  StrongAiProviderId,
  STRONG_AI_PROVIDERS,
  StudyPackAiProvider,
  testLocalLanguageModel,
} from '../../studyPack/ai'
import HostedAiSettingsPanel from './HostedAiSettingsPanel'

const LOCAL_AI_ESTIMATE_COPY =
  'Local AI runs on your device and can be slow. Performance depends on your hardware but it may take around 10 mins for each prompt.'

const aiProviderLabels: Record<StudyPackAiProvider, string> = {
  local: 'Google Local AI',
  gemini: 'Own Gemini API token',
  cerebras: 'Own Cerebras API key',
  hosted: 'Hosted AI',
}

interface AiModeDialogProps {
  open: boolean
  onClose: () => void
  notice?: string
}

const AiModeDialog: React.FC<AiModeDialogProps> = ({
  open,
  onClose,
  notice,
}) => {
  const [aiProvider, setAiProvider] =
    React.useState<StudyPackAiProvider>('hosted')
  const [strongCredentials, setStrongCredentials] =
    React.useState<StrongAiProviderCredentials>({})
  const [localAiStatus, setLocalAiStatus] = React.useState('')
  const [localAiProgress, setLocalAiProgress] = React.useState<number | null>(
    null,
  )
  const [isTestingLocalAi, setIsTestingLocalAi] = React.useState(false)
  const [showAiKey, setShowAiKey] = React.useState(false)

  const selectedStrongProvider: StrongAiProviderId = isStrongAiProvider(
    aiProvider,
  )
    ? aiProvider
    : 'gemini'
  const selectedStrongConfig = STRONG_AI_PROVIDERS[selectedStrongProvider]
  const selectedStrongCredential = strongCredentials[
    selectedStrongProvider
  ] || {
    apiToken: '',
    model: selectedStrongConfig.defaultModel,
  }
  const hasEnvToken = Boolean(
    getEnvStrongAiProviderApiKey(selectedStrongProvider),
  )
  const hasTypedAiKey = Boolean(selectedStrongCredential.apiToken.trim())

  React.useEffect(() => {
    if (!open) {
      return
    }

    const settings = readStudyPackAiSettings()
    setAiProvider(settings.provider || 'hosted')
    setStrongCredentials(settings.strongProviders || {})
    setLocalAiStatus('')
    setLocalAiProgress(null)
    setShowAiKey(false)
  }, [open])

  const updateSelectedStrongCredential = (
    changes: Partial<{ apiToken: string; model: string }>,
  ) => {
    setStrongCredentials((current) => ({
      ...current,
      [selectedStrongProvider]: {
        apiToken: selectedStrongCredential.apiToken,
        model: selectedStrongCredential.model,
        ...changes,
      },
    }))
  }

  const handleSaveAiSettings = () => {
    const credential = isStrongAiProvider(aiProvider)
      ? getStudyPackAiCredentialForProvider(
          {
            provider: aiProvider,
            apiToken: '',
            model: '',
            strongProviders: strongCredentials,
          },
          aiProvider,
        )
      : { apiToken: '', model: DEFAULT_STUDY_PACK_AI_MODEL }

    saveStudyPackAiSettings({
      provider: aiProvider,
      apiToken: credential.apiToken,
      model: credential.model,
      strongProviders: strongCredentials,
    })
    dispatchWorkspaceOnboardingNotice(
      `AI mode changed to ${aiProviderLabels[aiProvider]}.`,
    )
  }

  const handleClearAiToken = () => {
    if (!isStrongAiProvider(aiProvider)) {
      return
    }

    const model =
      strongCredentials[aiProvider]?.model ||
      STRONG_AI_PROVIDERS[aiProvider].defaultModel
    const nextCredentials = {
      ...strongCredentials,
      [aiProvider]: {
        apiToken: '',
        model,
      },
    }

    setStrongCredentials(nextCredentials)
    saveStudyPackAiSettings({
      provider: aiProvider,
      apiToken: '',
      model,
      strongProviders: nextCredentials,
    })
  }

  const handleCopyAiToken = async () => {
    const token = selectedStrongCredential.apiToken.trim()
    if (!token || !navigator.clipboard) {
      return
    }

    try {
      await navigator.clipboard.writeText(token)
      dispatchWorkspaceOnboardingNotice('API key copied.')
    } catch {
      dispatchWorkspaceOnboardingNotice('Could not copy API key.')
    }
  }

  const handleTestLocalAi = async () => {
    setIsTestingLocalAi(true)
    setLocalAiStatus('Checking Google Local AI...')
    setLocalAiProgress(null)

    try {
      const result = await testLocalLanguageModel((progress) => {
        setLocalAiProgress(progress)
        setLocalAiStatus(`Downloading local model ${progress}%`)
      })

      if (!result.supported) {
        setLocalAiStatus(
          'Google Local AI is not supported in this browser. Use Google Chrome with the built-in AI model enabled.',
        )
      } else if (result.availability === 'unavailable') {
        setLocalAiStatus(
          'Google Local AI is unavailable. The browser may need Chrome, model access, or a downloaded local model.',
        )
      } else {
        const promptResult = result.result?.trim()
        setLocalAiStatus(
          promptResult
            ? `Google Local AI ${result.availability}: ${promptResult}`
            : `Google Local AI ${result.availability}: No prompt result returned.`,
        )
      }
    } catch (error) {
      setLocalAiStatus(
        error instanceof Error
          ? error.message
          : 'Google Local AI test failed.',
      )
    } finally {
      setIsTestingLocalAi(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 7 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <AutoAwesomeIcon color="primary" />
          <Stack spacing={0.25}>
            <Typography component="span" variant="h6" fontWeight={900}>
              AI Mode
            </Typography>
            <Typography component="span" variant="body2" color="text.secondary">
              Choose how StudyMesh generates study materials.
            </Typography>
          </Stack>
        </Stack>
        <IconButton
          aria-label="Close AI mode"
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 2 }}>
          {notice && <Alert severity="warning">{notice}</Alert>}
          <Box>
            <TextField
              select
              label="AI provider"
              value={aiProvider}
              onChange={(event) =>
                setAiProvider(event.target.value as StudyPackAiProvider)
              }
              fullWidth
              size="small"
              helperText="Used by Create From Notes, Create Study Guide, and dashboard chat."
            >
              <MenuItem value="hosted">Hosted AI</MenuItem>
              <MenuItem value="local">Google Local AI</MenuItem>
              <MenuItem value="gemini">Own Gemini API token</MenuItem>
              <MenuItem value="cerebras">Own Cerebras API key</MenuItem>
            </TextField>
          </Box>

          {aiProvider === 'local' && (
            <Box>
              <Alert severity="info" sx={{ mb: 1.5 }}>
                {LOCAL_AI_ESTIMATE_COPY}
              </Alert>
              <Button
                variant="outlined"
                size="small"
                onClick={handleTestLocalAi}
                disabled={isTestingLocalAi}
              >
                {isTestingLocalAi
                  ? 'Testing local AI...'
                  : 'Check Google Local AI'}
              </Button>
              {localAiProgress !== null && (
                <LinearProgress
                  variant="determinate"
                  value={localAiProgress}
                  sx={{ mt: 1 }}
                />
              )}
              {localAiStatus && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  {localAiStatus}
                </Typography>
              )}
            </Box>
          )}

          {isStrongAiProvider(aiProvider) && (
            <Box>
              <TextField
                label="API key"
                type={showAiKey ? 'text' : 'password'}
                value={selectedStrongCredential.apiToken}
                onChange={(event) =>
                  updateSelectedStrongCredential({
                    apiToken: event.target.value,
                  })
                }
                fullWidth
                size="small"
                placeholder={
                  hasEnvToken
                    ? 'Using .env key unless you enter one here'
                    : `Paste your ${selectedStrongConfig.label} API key for this session`
                }
                helperText="Saved for this browser session only."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={showAiKey ? 'Hide API key' : 'Show API key'}>
                        <IconButton
                          aria-label={showAiKey ? 'Hide API key' : 'Show API key'}
                          edge="end"
                          size="small"
                          onClick={() => setShowAiKey((shown) => !shown)}
                          sx={{
                            color: 'text.secondary',
                            '&:hover': {
                              bgcolor: 'action.hover',
                              color: 'text.primary',
                            },
                          }}
                        >
                          {showAiKey ? (
                            <VisibilityOffIcon fontSize="small" />
                          ) : (
                            <VisibilityIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Copy API key">
                        <span>
                          <IconButton
                            aria-label="Copy API key"
                            edge="end"
                            size="small"
                            disabled={!hasTypedAiKey}
                            onClick={handleCopyAiToken}
                            sx={{
                              color: 'text.secondary',
                              '&.Mui-disabled': {
                                color: 'text.primary',
                                opacity: 0.72,
                              },
                              '&:hover': {
                                bgcolor: 'action.hover',
                                color: 'text.primary',
                              },
                            }}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 1.5 }}
              />
              <TextField
                label="Model"
                value={selectedStrongCredential.model}
                onChange={(event) =>
                  updateSelectedStrongCredential({
                    model: event.target.value,
                  })
                }
                fullWidth
                size="small"
                sx={{ mb: 1.5 }}
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  label={
                    selectedStrongCredential.apiToken.trim()
                      ? 'Session key active'
                      : hasEnvToken
                        ? '.env key available'
                        : 'No key configured'
                  }
                  color={
                    selectedStrongCredential.apiToken.trim() || hasEnvToken
                      ? 'primary'
                      : 'default'
                  }
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleClearAiToken}
                >
                  Clear key
                </Button>
              </Stack>
            </Box>
          )}

          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label={`Mode: ${aiProviderLabels[aiProvider]}`} />
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="contained" size="small" onClick={handleSaveAiSettings}>
              Save AI mode
            </Button>
          </Stack>

          {aiProvider === 'hosted' && (
            <>
              <Divider />
              <HostedAiSettingsPanel />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default AiModeDialog
