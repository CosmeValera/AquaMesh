import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import { Navigate, useNavigate } from 'react-router-dom'

import CreateStudyGuideModal from '../studyGuides/CreateStudyGuideModal'
import GuestUpgradePanel from './GuestUpgradePanel'
import { useAuth } from '../../auth/AuthProvider'
import { useHostedAiStatus } from '../hostedAi/useHostedAiStatus'
import { HOSTED_AI_GUEST_LIMIT_EVENT } from '../../quickCreate/ai'
import {
  createStudyGuideFromModalPayload,
  type StudyGuideModalPayload,
} from '../../studyGuides/createFromModalPayload'
import {
  STUDY_GUIDES_CHANGED_EVENT,
  StudyGuideStorage,
} from '../../studyGuides/storage'
import { useInterfaceText } from '../../language/interfaceLanguage'
import type { StudyGuideSummary } from '../../cloud/types'
import type { WorkspaceCreationTaskState } from '../../workspaceCreationStatus'

// Mirrors guest_allowances.study_guides_allowed. Only used until the gateway
// reports the real allowance, which it cannot do before a guest session exists.
const GUEST_FREE_QUICK_GUIDES = 3

const GuestQuickGuidePage = () => {
  const navigate = useNavigate()
  const { t } = useInterfaceText()
  const { user, loading, isAnonymous, signInAnonymously } = useAuth()
  const { status } = useHostedAiStatus()
  const [prompt, setPrompt] = useState('')
  const [generateRequest, setGenerateRequest] = useState<{
    id: number
    prompt: string
  }>()
  const [creationState, setCreationState] =
    useState<WorkspaceCreationTaskState>('idle')
  const [error, setError] = useState('')
  const [limitReached, setLimitReached] = useState(false)
  const [guides, setGuides] = useState<StudyGuideSummary[]>([])
  const requestIdRef = useRef(0)

  const allowed = status?.guest?.allowed ?? GUEST_FREE_QUICK_GUIDES
  const remaining = status?.guest?.remaining ?? GUEST_FREE_QUICK_GUIDES
  const isGuest = Boolean(user) && isAnonymous
  const isGenerating = creationState === 'running'

  useEffect(() => {
    const handleGuestLimit = () => {
      setLimitReached(true)
      setCreationState('idle')
    }

    window.addEventListener(HOSTED_AI_GUEST_LIMIT_EVENT, handleGuestLimit)

    return () => {
      window.removeEventListener(HOSTED_AI_GUEST_LIMIT_EVENT, handleGuestLimit)
    }
  }, [])

  useEffect(() => {
    // Only a guest session owns the guides listed here: a logged-out visitor may
    // still hold another account's local cache, which is not theirs to reopen.
    if (!isGuest) {
      setGuides([])
      return undefined
    }

    const refreshGuides = () => {
      setGuides(StudyGuideStorage.getSummaries())
    }

    refreshGuides()
    window.addEventListener(STUDY_GUIDES_CHANGED_EVENT, refreshGuides)

    return () => {
      window.removeEventListener(STUDY_GUIDES_CHANGED_EVENT, refreshGuides)
    }
  }, [isGuest])

  const ensureGuestSession = useCallback(async () => {
    await signInAnonymously()
  }, [signInAnonymously])

  const handleStatusChange = useCallback(
    (state: WorkspaceCreationTaskState, message?: string) => {
      setCreationState(state)
      setError(state === 'error' ? message || t('guest.generateFailed') : '')
    },
    [t],
  )

  const handleCreatePath = useCallback(
    (payload: StudyGuideModalPayload) => {
      const { record } = createStudyGuideFromModalPayload(payload)

      if (!record) {
        setCreationState('error')
        setError(t('guest.generateFailed'))
        return
      }

      const saved = StudyGuideStorage.save(record)
      navigate(`/workspace/${saved.id}`)
    },
    [navigate, t],
  )

  const startGeneration = () => {
    const nextPrompt = prompt.trim()
    if (!nextPrompt || isGenerating) {
      return
    }

    requestIdRef.current += 1
    setError('')
    setCreationState('running')
    setGenerateRequest({ id: requestIdRef.current, prompt: nextPrompt })
  }

  if (!loading && user && !isAnonymous) {
    return <Navigate to="/study-guides" replace />
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <Box
        component="header"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Container
          maxWidth="md"
          sx={{
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Button
            variant="text"
            onClick={() => navigate('/')}
            sx={{
              minWidth: 'auto',
              p: 0,
              color: 'text.primary',
              textTransform: 'none',
              '&:hover': { bgcolor: 'transparent' },
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box
                component="img"
                src="/logo.png"
                alt="RabbitHole"
                sx={{ width: 34, height: 34, display: 'block' }}
              />
              <Typography component="span" fontWeight={800} fontSize="1.15rem">
                RabbitHole
              </Typography>
            </Stack>
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/login')}
            sx={{
              borderRadius: 999,
              textTransform: 'none',
              fontWeight: 700,
              color: 'text.primary',
              borderColor: 'divider',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              },
            }}
          >
            {t('guest.signIn')}
          </Button>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ flex: 1, py: { xs: 4, md: 6 } }}>
        <Stack spacing={3}>
          <Stack spacing={1.5} alignItems="flex-start">
            <Chip
              color="primary"
              variant="outlined"
              label={`${remaining} ${t('guest.of')} ${allowed} ${t(
                'guest.freeQuickGuidesLeft',
              )}`}
              sx={{ fontWeight: 700 }}
            />
            <Typography
              variant="h4"
              component="h1"
              fontWeight={800}
              sx={{ fontSize: { xs: '1.9rem', md: '2.4rem' } }}
            >
              {t('guest.title')}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {t('guest.subtitle')}
            </Typography>
          </Stack>

          {limitReached ? (
            <GuestUpgradePanel />
          ) : (
            <Paper
              elevation={0}
              sx={{ p: { xs: 2, md: 3 }, border: 1, borderColor: 'divider' }}
            >
              <Stack spacing={2}>
                {error ? <Alert severity="error">{error}</Alert> : null}
                <TextField
                  label={t('guest.promptLabel')}
                  placeholder={t('guest.promptPlaceholder')}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  multiline
                  minRows={4}
                  fullWidth
                  disabled={isGenerating}
                />
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={startGeneration}
                  disabled={isGenerating || !prompt.trim()}
                  sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
                >
                  {isGenerating ? t('guest.generating') : t('guest.generate')}
                </Button>
                {isGenerating ? <LinearProgress /> : null}
              </Stack>
            </Paper>
          )}

          {guides.length > 0 ? (
            <Paper
              elevation={0}
              sx={{ p: { xs: 2, md: 3 }, border: 1, borderColor: 'divider' }}
            >
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={800}>
                  {t('guest.yourGuides')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('guest.yourGuidesHelp')}
                </Typography>
                {guides.map((guide) => (
                  <Stack
                    key={guide.id}
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      minWidth={0}
                    >
                      <MenuBookRoundedIcon fontSize="small" color="primary" />
                      <Typography noWrap fontWeight={700}>
                        {guide.title}
                      </Typography>
                    </Stack>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => navigate(`/workspace/${guide.id}`)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        color: 'text.primary',
                        borderColor: 'divider',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: (theme) =>
                            alpha(theme.palette.primary.main, 0.08),
                        },
                      }}
                    >
                      {t('guest.open')}
                    </Button>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          ) : null}
        </Stack>
      </Container>

      {/* Renders nothing while auto-creating: the page owns the prompt UI and the
          modal only runs the generation it is handed. */}
      <CreateStudyGuideModal
        open
        presentation="embedded"
        autoCreateOnGenerate
        openGeneratedInWorkspace={false}
        autoGenerateRequest={generateRequest}
        onBeforeGenerate={ensureGuestSession}
        onStatusChange={handleStatusChange}
        onCreatePath={handleCreatePath}
        onClose={() => setCreationState('idle')}
      />
    </Box>
  )
}

export default GuestQuickGuidePage
