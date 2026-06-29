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
import { dialogStyles } from '../shared/DialogStyles'
import {
  DEFAULT_QUICK_CREATE_AI_MODEL,
  getEnvStrongAiProviderApiKey,
  getQuickCreateAiCredentialForProvider,
  isStrongAiProvider,
  readQuickCreateAiSettings,
  saveQuickCreateAiSettings,
  StrongAiProviderCredentials,
  StrongAiProviderId,
  STRONG_AI_PROVIDERS,
  QuickCreateAiProvider,
  testLocalLanguageModel,
} from '../../quickCreate/ai'
import { useInterfaceText } from '../../language/interfaceLanguage'
import HostedAiSettingsPanel from './HostedAiSettingsPanel'

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
  const { t } = useInterfaceText()
  const [aiProvider, setAiProvider] =
    React.useState<QuickCreateAiProvider>('hosted')
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

    const settings = readQuickCreateAiSettings()
    setAiProvider(settings.provider || 'hosted')
    setStrongCredentials(settings.strongProviders || {})
    setLocalAiStatus('')
    setLocalAiProgress(null)
    setShowAiKey(false)
  }, [open])

  const persistAiSettings = (
    provider: QuickCreateAiProvider,
    credentials: StrongAiProviderCredentials,
  ) => {
    const credential = isStrongAiProvider(provider)
      ? getQuickCreateAiCredentialForProvider(
          {
            provider,
            apiToken: '',
            model: '',
            strongProviders: credentials,
          },
          provider,
        )
      : { apiToken: '', model: DEFAULT_QUICK_CREATE_AI_MODEL }

    saveQuickCreateAiSettings({
      provider,
      apiToken: credential.apiToken,
      model: credential.model,
      strongProviders: credentials,
    })
  }

  const handleAiProviderChange = (nextProvider: QuickCreateAiProvider) => {
    setAiProvider(nextProvider)
    setLocalAiStatus('')
    setLocalAiProgress(null)
    persistAiSettings(nextProvider, strongCredentials)
  }

  const updateSelectedStrongCredential = (
    changes: Partial<{ apiToken: string; model: string }>,
  ) => {
    setStrongCredentials((current) => {
      const nextCredentials = {
        ...current,
        [selectedStrongProvider]: {
          apiToken: selectedStrongCredential.apiToken,
          model: selectedStrongCredential.model,
          ...changes,
        },
      }

      persistAiSettings(aiProvider, nextCredentials)
      return nextCredentials
    })
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
    saveQuickCreateAiSettings({
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
    setLocalAiStatus(t('ai.checkingLocal'))
    setLocalAiProgress(null)

    try {
      const result = await testLocalLanguageModel((progress) => {
        setLocalAiProgress(progress)
        setLocalAiStatus(`Downloading local model ${progress}%`)
      })

      if (!result.supported) {
        setLocalAiStatus(t('ai.localUnsupported'))
      } else if (result.availability === 'unavailable') {
        setLocalAiStatus(t('ai.localUnavailable'))
      } else {
        const promptResult = result.result?.trim()
        setLocalAiStatus(
          promptResult
            ? `${t('ai.localGoogle')} ${result.availability}: ${promptResult}`
            : `${t('ai.localGoogle')} ${result.availability}: ${t(
                'ai.noPromptResult',
              )}`,
        )
      }
    } catch (error) {
      setLocalAiStatus(
        error instanceof Error ? error.message : t('ai.localTestFailed'),
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
              {t('ai.mode')}
            </Typography>
            <Typography component="span" variant="body2" color="text.secondary">
              {t('ai.modeHelp')}
            </Typography>
          </Stack>
        </Stack>
        <IconButton
          aria-label={t('ai.closeMode')}
          onClick={onClose}
          sx={{
            ...dialogStyles.closeButton,
            right: 12,
            top: 12,
            transform: 'none',
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ overflowX: 'hidden', overflowY: 'auto' }}>
        <Stack spacing={2} sx={{ pt: 2, minWidth: 0, maxWidth: '100%' }}>
          {notice && <Alert severity="warning">{notice}</Alert>}
          <Box>
            <TextField
              select
              label={t('ai.provider')}
              value={aiProvider}
              onChange={(event) =>
                handleAiProviderChange(
                  event.target.value as QuickCreateAiProvider,
                )
              }
              fullWidth
              size="small"
              helperText={t('ai.providerHelp')}
            >
              <MenuItem value="hosted">{t('ai.hosted')}</MenuItem>
              <MenuItem value="local">{t('ai.localGoogle')}</MenuItem>
              <MenuItem value="gemini">{t('ai.ownGemini')}</MenuItem>
              <MenuItem value="cerebras">{t('ai.ownCerebras')}</MenuItem>
            </TextField>
          </Box>

          {aiProvider === 'local' && (
            <Box>
              <Alert severity="info" sx={{ mb: 1.5 }}>
                {t('ai.localEstimate')}
              </Alert>
              <Button
                variant="outlined"
                size="small"
                onClick={handleTestLocalAi}
                disabled={isTestingLocalAi}
              >
                {isTestingLocalAi ? t('ai.testingLocal') : t('ai.checkLocal')}
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
                      <Tooltip
                        title={showAiKey ? 'Hide API key' : 'Show API key'}
                      >
                        <IconButton
                          aria-label={
                            showAiKey ? 'Hide API key' : 'Show API key'
                          }
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

          {aiProvider === 'hosted' && (
            <>
              <Divider />
              <HostedAiSettingsPanel />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('settings.close')}</Button>
      </DialogActions>
    </Dialog>
  )
}

export default AiModeDialog
