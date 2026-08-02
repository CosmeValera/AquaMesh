import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/AuthProvider'
import { DEMO_GUIDES, DEMO_PROFILE_SKILLS } from '../../demo/demoGuides'
import { DEMO_GENERATION_MS } from '../../demo/types'
import { prefetchDemoGuide } from '../../demo/useDemoGuide'
import { useInterfaceText } from '../../language/interfaceLanguage'
import DemoSignupNudge from './DemoSignupNudge'

const DEMO_ESTIMATE_SECONDS = Math.round(DEMO_GENERATION_MS / 1000)

const formatDuration = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  if (minutes <= 0) {
    return `${remainingSeconds}s`
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

const DemoCreatePage = () => {
  const navigate = useNavigate()
  const { t } = useInterfaceText()
  const { user, loading } = useAuth()
  const [selectedSlug, setSelectedSlug] = useState('')
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(0)
  const [nudgeOpen, setNudgeOpen] = useState(false)

  const selectedGuide = useMemo(
    () => DEMO_GUIDES.find((guide) => guide.slug === selectedSlug) || null,
    [selectedSlug],
  )
  const generating = startedAt > 0

  useEffect(() => {
    if (!loading && user && !user.is_anonymous) {
      navigate('/study-guides', { replace: true })
    }
  }, [loading, navigate, user])

  useEffect(() => {
    if (!generating) {
      return undefined
    }

    const interval = window.setInterval(() => setNow(Date.now()), 1000)

    return () => window.clearInterval(interval)
  }, [generating])

  useEffect(() => {
    if (!generating || !selectedSlug) {
      return undefined
    }

    // Cleared on unmount so navigating back mid-wait cannot fire this later.
    const timeout = window.setTimeout(() => {
      navigate(`/try/${selectedSlug}`)
    }, DEMO_GENERATION_MS)

    return () => window.clearTimeout(timeout)
  }, [generating, navigate, selectedSlug])

  const startGeneration = () => {
    if (!selectedGuide || generating) {
      return
    }

    prefetchDemoGuide(selectedGuide)
    const startTime = Date.now()
    setStartedAt(startTime)
    setNow(startTime)
  }

  const elapsedSeconds = generating
    ? Math.max(0, Math.floor((now - startedAt) / 1000))
    : 0
  const progressPercent = Math.min(
    95,
    Math.round((elapsedSeconds / DEMO_ESTIMATE_SECONDS) * 100),
  )

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: 'background.default',
        px: { xs: 2, sm: 3 },
        py: { xs: 5, md: 8 },
      }}
    >
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 760, mx: 'auto' }}>
        <Stack spacing={1.25}>
          <Typography variant="h4" fontWeight={800} color="text.primary">
            {t('demo.pageTitle')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('demo.pageSubtitle')}
          </Typography>
        </Stack>
        <Paper
          elevation={0}
          sx={(theme) => ({
            p: { xs: 2, sm: 2.75 },
            borderRadius: 3,
            border: 1,
            borderColor: alpha(theme.palette.primary.main, 0.24),
            bgcolor: 'background.paper',
          })}
        >
          <Stack spacing={2}>
            <Box>
              <Typography
                variant="subtitle2"
                fontWeight={700}
                color="text.primary"
                sx={{ mb: 0.5 }}
              >
                {t('demo.chooseTopic')}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1.25 }}
              >
                {t('demo.chooseTopicHelper')}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {DEMO_GUIDES.map((guide) => (
                  <Button
                    key={guide.slug}
                    size="small"
                    variant={
                      guide.slug === selectedSlug ? 'contained' : 'outlined'
                    }
                    disabled={generating}
                    onClick={() => setSelectedSlug(guide.slug)}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      mb: 1,
                    }}
                  >
                    {guide.chipLabel}
                  </Button>
                ))}
              </Stack>
            </Box>

            <Divider flexItem />

            {/* The declared profile is the mechanism the demo exists to show,
                so it stays visible whether or not a topic is picked, and the
                skill the chosen guide leaned on is called out by name. */}
            <Box>
              <Typography
                variant="subtitle2"
                fontWeight={700}
                color="text.primary"
                sx={{ mb: 0.5 }}
              >
                {t('demo.skillsTitle')}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1.25 }}
              >
                {t('demo.skillsHelper')}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {DEMO_PROFILE_SKILLS.map((skill) => {
                  const used = selectedGuide?.lensSkill === skill

                  return (
                    <Chip
                      key={skill}
                      label={skill}
                      icon={used ? <CheckCircleIcon /> : undefined}
                      variant={used ? 'filled' : 'outlined'}
                      sx={(theme) => ({
                        mb: 1,
                        borderRadius: 2,
                        fontWeight: used ? 700 : 500,
                        color: used
                          ? theme.palette.success.contrastText
                          : 'text.secondary',
                        bgcolor: used ? 'success.main' : 'transparent',
                        borderColor: used
                          ? 'success.main'
                          : alpha(theme.palette.text.primary, 0.24),
                        '& .MuiChip-icon': {
                          color: used
                            ? theme.palette.success.contrastText
                            : 'inherit',
                        },
                      })}
                    />
                  )
                })}
              </Stack>
              {selectedGuide ? (
                <Typography
                  variant="caption"
                  color="success.main"
                  sx={{ display: 'block', mt: 0.5, fontWeight: 650 }}
                >
                  {t('demo.lensUsed')} {selectedGuide.lensSkill}
                </Typography>
              ) : null}
            </Box>

            <Divider flexItem />

            <Typography variant="subtitle2" fontWeight={700} color="text.primary">
              {t('demo.pathTitle')}
            </Typography>

            <Box sx={{ position: 'relative' }}>
              <TextField
                fullWidth
                disabled
                multiline
                minRows={3}
                label={t('demo.promptField')}
                placeholder={t('demo.promptPlaceholder')}
                value={selectedGuide ? selectedGuide.prompt : ''}
                sx={(theme) => ({
                  '& .MuiInputBase-input.Mui-disabled': {
                    WebkitTextFillColor: theme.palette.text.primary,
                    color: 'text.primary',
                  },
                  '& .MuiInputLabel-root.Mui-disabled': {
                    color: 'text.secondary',
                  },
                })}
              />
              {/* A disabled input swallows pointer events, so the nudge needs
                  its own layer on top of the field. */}
              <Box
                component="button"
                type="button"
                aria-label={t('demo.promptLockedLabel')}
                onClick={() => setNudgeOpen(true)}
                sx={(theme) => ({
                  position: 'absolute',
                  inset: 0,
                  p: 0,
                  border: 0,
                  borderRadius: 1,
                  bgcolor: 'transparent',
                  cursor: 'pointer',
                  '&:focus-visible': {
                    outline: `3px solid ${alpha(
                      theme.palette.primary.main,
                      0.45,
                    )}`,
                    outlineOffset: 2,
                  },
                })}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t('demo.promptHelper')}
            </Typography>
            <Box>
              <Button
                variant="contained"
                size="large"
                disabled={!selectedGuide || generating}
                onClick={startGeneration}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                }}
              >
                {t('demo.createGuide')}
              </Button>
            </Box>
          </Stack>
        </Paper>
        {generating ? (
          <Paper
            elevation={0}
            sx={(theme) => ({
              p: 2.25,
              borderRadius: 3,
              border: 1,
              borderColor: alpha(theme.palette.primary.main, 0.36),
              bgcolor: 'background.paper',
              boxShadow:
                theme.palette.mode === 'dark'
                  ? '0 18px 44px rgba(0,0,0,0.28)'
                  : '0 18px 44px rgba(15,23,42,0.1)',
            })}
          >
            <Stack spacing={1.75}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box
                  sx={(theme) => ({
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                  })}
                >
                  <AutoAwesomeIcon fontSize="small" />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    color="primary.main"
                    fontWeight={700}
                  >
                    {t('demo.generating')}
                  </Typography>
                  <Typography
                    variant="subtitle1"
                    fontWeight={700}
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.22,
                    }}
                  >
                    {selectedGuide ? selectedGuide.prompt : ''}
                  </Typography>
                </Box>
              </Stack>
              <Box
                sx={(theme) => ({
                  p: 1.25,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.055),
                })}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 1 }}
                >
                  <Typography
                    variant="body2"
                    color="primary.main"
                    fontWeight={700}
                  >
                    {progressPercent}%
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {t('studyGuides.elapsed')} {formatDuration(elapsedSeconds)} ·{' '}
                    {t('studyGuides.estimatedTotal')}{' '}
                    {formatDuration(DEMO_ESTIMATE_SECONDS)}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={progressPercent}
                  aria-label={`${progressPercent}%`}
                  sx={(theme) => ({
                    height: 9,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.primary.main, 0.14),
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 1,
                    },
                  })}
                />
              </Box>
            </Stack>
          </Paper>
        ) : null}
      </Stack>
      <DemoSignupNudge
        reason={nudgeOpen ? 'lockedPrompt' : null}
        onClose={() => setNudgeOpen(false)}
      />
    </Box>
  )
}

export default DemoCreatePage
