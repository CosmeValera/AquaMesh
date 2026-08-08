import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { ThemeProvider, alpha } from '@mui/material/styles'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CheckIcon from '@mui/icons-material/Check'
import LinkIcon from '@mui/icons-material/Link'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/AuthProvider'
import { DEMO_GUIDES, DEMO_PROFILE_SKILLS } from '../../demo/demoGuides'
import { DEMO_GENERATION_MS } from '../../demo/types'
import { prefetchDemoGuide } from '../../demo/useDemoGuide'
import { useInterfaceText } from '../../language/interfaceLanguage'
import LandingTopNav from '../landing/LandingTopNav'
import StudyMeshFooter from '../landing/StudyMeshFooter'
import { createStudyMeshTheme } from '../../theme'
import { readStoredAccentColorId } from '../../theme/accentColors'

/** The landing canvas, so the shared nav and footer sit on what they expect. */
const DEMO_CANVAS = '#FBFDFE'
const DEMO_FONT = '"Readex Pro", "Inter", "Segoe UI", Arial, sans-serif'

const DEMO_ESTIMATE_SECONDS = Math.round(DEMO_GENERATION_MS / 1000)

/** How long the context library reads as "ranking" after a topic is picked. */
export const DEMO_MATCH_MS = 600

/** One sweep of the scan light. Almost two fit inside the match. */
const DEMO_SCAN_MS = 450

const formatDuration = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  if (minutes <= 0) {
    return `${remainingSeconds}s`
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

/** One numbered block of the page, so the three steps read as one sequence. */
const DemoStep: React.FC<{
  index: number
  title: string
  helper: string
  children: React.ReactNode
}> = ({ index, title, helper, children }) => (
  <Box sx={{ p: { xs: 2, sm: 3 } }}>
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box
        aria-hidden
        sx={(theme) => ({
          mt: 0.35,
          width: 22,
          height: 22,
          flexShrink: 0,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1,
          color: 'primary.main',
          bgcolor: alpha(theme.palette.primary.main, 0.12),
        })}
      >
        {index}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h6" fontWeight={800} color="text.primary">
          {title}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.25, mb: 2 }}
        >
          {helper}
        </Typography>
        {children}
      </Box>
    </Stack>
  </Box>
)

const DemoCreatePage = () => {
  const navigate = useNavigate()
  const { t } = useInterfaceText()
  const { user, loading } = useAuth()
  const [selectedSlug, setSelectedSlug] = useState('')
  const [matching, setMatching] = useState(false)
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(0)

  const selectedGuide = useMemo(
    () => DEMO_GUIDES.find((guide) => guide.slug === selectedSlug) || null,
    [selectedSlug],
  )
  // The landing chrome is light-only, so /try renders light whatever the
  // visitor's stored app theme is. Their accent choice still carries over.
  const landingTheme = useMemo(
    () => createStudyMeshTheme('light', readStoredAccentColorId()),
    [],
  )
  const generating = startedAt > 0
  // The topic is picked and the match has settled, so Create guide is the only
  // thing left to do. The button says so itself rather than adding a line of
  // copy to a page this change is shortening.
  const ctaReady = Boolean(selectedGuide) && !matching && !generating
  // The match is prepared data, so it would otherwise land instantly. The
  // ranking pass is the mechanism this page is about, so it gets shown running.
  const matchedGuide = matching ? null : selectedGuide

  const pickTopic = (slug: string) => {
    if (slug === selectedSlug) {
      return
    }

    setSelectedSlug(slug)
    setMatching(true)
  }

  // /try is its own page, so it opens at the top even when something did reach
  // it through an in-app route change rather than a fresh document load.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (!loading && user && !user.is_anonymous) {
      navigate('/study-guides', { replace: true })
    }
  }, [loading, navigate, user])

  useEffect(() => {
    if (!matching) {
      return undefined
    }

    const timeout = window.setTimeout(
      () => setMatching(false),
      DEMO_MATCH_MS,
    )

    return () => window.clearTimeout(timeout)
  }, [matching, selectedSlug])

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
    if (!selectedGuide || matching || generating) {
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
    <ThemeProvider theme={landingTheme}>
      <Box
        sx={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: DEMO_CANVAS,
          fontFamily: DEMO_FONT,
        }}
      >
        <LandingTopNav sectionHrefPrefix="/" />
        <Box
          component="main"
          sx={{
            flex: 1,
            px: { xs: 2, sm: 3 },
            py: { xs: 5, md: 8 },
          }}
        >
          <Stack spacing={3} sx={{ width: '100%', maxWidth: 820, mx: 'auto' }}>
            <Stack spacing={2} alignItems="flex-start">
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                sx={(theme) => ({
                  px: 1.5,
                  py: 0.6,
                  borderRadius: 999,
                  border: 1,
                  borderColor: alpha(theme.palette.primary.main, 0.32),
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  color: 'primary.main',
                })}
              >
                <AutoAwesomeIcon sx={{ fontSize: 15 }} />
                <Typography variant="caption" fontWeight={700}>
                  {t('demo.liveBadge')}
                </Typography>
              </Stack>
              <Typography
                variant="h3"
                fontWeight={800}
                color="text.primary"
                sx={{
                  fontSize: { xs: '2rem', sm: '2.5rem' },
                  lineHeight: 1.12,
                  letterSpacing: '-0.02em',
                }}
              >
                {t('demo.pageTitle')}
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ maxWidth: 660, lineHeight: 1.6 }}
              >
                {t('demo.pageSubtitle')}
              </Typography>
            </Stack>

            <Paper
              elevation={0}
              sx={(theme) => ({
                mt: 1,
                borderRadius: 4,
                border: 1,
                borderColor: alpha(theme.palette.text.primary, 0.12),
                bgcolor: 'background.paper',
                overflow: 'hidden',
                boxShadow:
              theme.palette.mode === 'dark'
                ? '0 24px 60px rgba(0,0,0,0.32)'
                : '0 24px 60px rgba(15,23,42,0.07)',
              })}
            >
              <DemoStep
                index={1}
                title={t('demo.chooseTopic')}
                helper={t('demo.chooseTopicHelper')}
              >
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {DEMO_GUIDES.map((guide) => {
                    const active = guide.slug === selectedSlug

                    return (
                      <Button
                        key={guide.slug}
                        disableElevation
                        variant={active ? 'contained' : 'outlined'}
                        disabled={generating}
                        onClick={() => pickTopic(guide.slug)}
                        sx={(theme) => ({
                          px: 2,
                          py: 0.85,
                          borderRadius: 999,
                          textTransform: 'none',
                          fontWeight: active ? 700 : 600,
                          color: active ? undefined : 'text.primary',
                          borderColor: active
                            ? undefined
                            : alpha(theme.palette.text.primary, 0.24),
                          '&:hover': {
                            borderColor: active
                              ? undefined
                              : theme.palette.primary.main,
                            bgcolor: active
                              ? undefined
                              : alpha(theme.palette.primary.main, 0.06),
                          },
                          '&.Mui-disabled': {
                            color: active
                              ? theme.palette.primary.contrastText
                              : alpha(theme.palette.text.primary, 0.45),
                            borderColor: alpha(theme.palette.text.primary, 0.16),
                            bgcolor: active
                              ? alpha(theme.palette.primary.main, 0.6)
                              : 'transparent',
                          },
                        })}
                      >
                        {guide.chipLabel}
                      </Button>
                    )
                  })}
                </Box>
              </DemoStep>

              <Divider />

              {/* The declared library is the mechanism the demo exists to show, so
              it stays visible whether or not a topic is picked, and the context
              the chosen guide leaned on is called out by name. */}
              <DemoStep
                index={2}
                title={t('demo.skillsTitle')}
                helper={t('demo.skillsHelper')}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    gap: 1.25,
                  }}
                >
                  {DEMO_PROFILE_SKILLS.map((skill) => {
                    const matched = matchedGuide?.lensSkill === skill.name

                    return (
                      <Paper
                        key={skill.name}
                        elevation={0}
                        data-scanning={matching ? 'true' : undefined}
                        sx={(theme) => ({
                          position: 'relative',
                          overflow: 'hidden',
                          p: 1.75,
                          borderRadius: 2.5,
                          border: 1,
                          borderColor: matched
                            ? theme.palette.success.main
                            : alpha(theme.palette.text.primary, 0.14),
                          bgcolor: matched
                            ? alpha(
                              theme.palette.success.main,
                              theme.palette.mode === 'dark' ? 0.18 : 0.1,
                            )
                            : 'background.paper',
                          transition: 'border-color 160ms, background-color 160ms',
                          '@keyframes studymesh-demo-context-scan': {
                            '0%': { transform: 'translateX(-100%)' },
                            '100%': { transform: 'translateX(200%)' },
                          },
                          // The ranking pass sweeps every card, so the light runs
                          // on all five and only then does one of them settle.
                          '&[data-scanning="true"]': {
                            borderColor: alpha(theme.palette.primary.main, 0.28),
                            bgcolor: alpha(theme.palette.primary.main, 0.07),
                            '&::after': {
                              content: '""',
                              position: 'absolute',
                              inset: 0,
                              width: '55%',
                              background: `linear-gradient(90deg, transparent, ${alpha(
                                theme.palette.primary.main,
                                theme.palette.mode === 'dark' ? 0.28 : 0.2,
                              )}, transparent)`,
                              // No per-card delay: the five sweeps have to start on
                              // the same frame or the pass reads as a stagger.
                              animation: `studymesh-demo-context-scan ${DEMO_SCAN_MS}ms linear infinite`,
                              pointerEvents: 'none',
                            },
                            '@media (prefers-reduced-motion: reduce)': {
                              '&::after': { animation: 'none', opacity: 0.35 },
                            },
                          },
                        })}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="flex-start"
                          justifyContent="space-between"
                        >
                          <Typography
                            variant="subtitle2"
                            fontWeight={700}
                            sx={(theme) => ({
                              color: matched
                                ? theme.palette.mode === 'dark'
                                  ? theme.palette.success.light
                                  : theme.palette.success.dark
                                : theme.palette.text.primary,
                            })}
                          >
                            {skill.name}
                          </Typography>
                          {matched ? (
                            <Chip
                              size="small"
                              icon={<CheckIcon />}
                              label={t('demo.autoMatched')}
                              sx={(theme) => ({
                                flexShrink: 0,
                                height: 24,
                                borderRadius: 999,
                                fontWeight: 700,
                                color: theme.palette.success.contrastText,
                                bgcolor: theme.palette.success.dark,
                                '& .MuiChip-icon': {
                                  fontSize: 15,
                                  color: theme.palette.success.contrastText,
                                },
                              })}
                            />
                          ) : null}
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 0.5 }}
                        >
                          {skill.keywords}
                        </Typography>
                      </Paper>
                    )
                  })}
                </Box>

                <Paper
                  elevation={0}
                  sx={(theme) => ({
                    mt: 2,
                    p: 2,
                    borderRadius: 2.5,
                    border: 1,
                    borderStyle: matchedGuide ? 'solid' : 'dashed',
                    borderColor: matchedGuide
                      ? alpha(theme.palette.success.main, 0.5)
                      : alpha(theme.palette.text.primary, 0.2),
                    bgcolor: matchedGuide
                      ? alpha(theme.palette.success.main, 0.05)
                      : 'transparent',
                  })}
                >
                  {matchedGuide ? (
                    <>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <LinkIcon
                          sx={(theme) => ({
                            fontSize: 18,
                            color:
                          theme.palette.mode === 'dark'
                            ? theme.palette.success.light
                            : theme.palette.success.dark,
                          })}
                        />
                        <Typography
                          variant="subtitle2"
                          fontWeight={700}
                          sx={(theme) => ({
                            color:
                          theme.palette.mode === 'dark'
                            ? theme.palette.success.light
                            : theme.palette.success.dark,
                          })}
                        >
                          {t('demo.matchedLabel')} {matchedGuide.lensSkill}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="body2"
                        color="text.primary"
                        sx={{ mt: 1, lineHeight: 1.6 }}
                      >
                        {matchedGuide.lensExplanation}
                      </Typography>
                    </>
                  ) : (
                    <Typography
                      variant="body2"
                      color={matching ? 'primary.main' : 'text.secondary'}
                      fontWeight={matching ? 650 : 400}
                    >
                      {matching ? t('demo.matching') : t('demo.matchPending')}
                    </Typography>
                  )}
                </Paper>
              </DemoStep>

              <Divider />

              <DemoStep
                index={3}
                title={t('demo.pathTitle')}
                helper={t('demo.pathHelper')}
              >
                {/* The prompt is a fixed capture, so it renders as a read-only
                panel rather than a field. Nothing about it is interactive: the
                helper line under Create guide already says it is a sample. */}
                <Box
                  data-testid="demo-prompt-panel"
                  sx={(theme) => ({
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    p: 2,
                    borderRadius: 2.5,
                    border: 1,
                    borderColor: alpha(theme.palette.text.primary, 0.14),
                    bgcolor: alpha(
                      theme.palette.text.primary,
                      theme.palette.mode === 'dark' ? 0.06 : 0.03,
                    ),
                  })}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: 'block',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('demo.promptField')}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      mt: 0.75,
                      lineHeight: 1.55,
                      color: selectedGuide ? 'text.primary' : 'text.secondary',
                    }}
                  >
                    {selectedGuide
                      ? selectedGuide.prompt
                      : t('demo.promptPlaceholder')}
                  </Typography>
                  {matchedGuide ? (
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 0.75 }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {t('demo.explainedThrough')}
                      </Typography>
                      <Chip
                        size="small"
                        label={matchedGuide.lensSkill}
                        sx={(theme) => ({
                          height: 24,
                          borderRadius: 999,
                          fontWeight: 600,
                          color:
                        theme.palette.mode === 'dark'
                          ? theme.palette.success.light
                          : theme.palette.success.dark,
                          bgcolor: alpha(
                            theme.palette.success.main,
                            theme.palette.mode === 'dark' ? 0.24 : 0.14,
                          ),
                        })}
                      />
                    </Stack>
                  ) : null}
                </Box>

                <Box sx={{ mt: 2.5 }}>
                  <Button
                    variant="contained"
                    size="large"
                    disableElevation
                    startIcon={<AutoAwesomeIcon />}
                    disabled={!selectedGuide || matching || generating}
                    data-cta-ready={ctaReady ? 'true' : undefined}
                    onClick={startGeneration}
                    sx={(theme) => ({
                      px: 3,
                      py: 1.25,
                      borderRadius: 999,
                      textTransform: 'none',
                      fontWeight: 700,
                      '&.Mui-disabled': {
                        color: alpha(theme.palette.text.primary, 0.45),
                        bgcolor: alpha(theme.palette.text.primary, 0.1),
                      },
                      '@keyframes studymesh-demo-cta-ready': {
                        '0%, 100%': {
                          boxShadow: `0 0 0 0 ${alpha(
                            theme.palette.primary.main,
                            0.42,
                          )}`,
                        },
                        '50%': {
                          boxShadow: `0 0 0 9px ${alpha(
                            theme.palette.primary.main,
                            0,
                          )}`,
                        },
                      },
                      // Only box-shadow moves, so the button never changes size
                      // while the status around it changes. Three pulses, then
                      // a resting ring: it points at the next step once and
                      // then stops asking for attention.
                      ...(ctaReady
                        ? {
                          boxShadow: `0 0 0 3px ${alpha(
                            theme.palette.primary.main,
                            0.24,
                          )}`,
                          animation:
                              'studymesh-demo-cta-ready 1600ms ease-out 3',
                          '@media (prefers-reduced-motion: reduce)': {
                            animation: 'none',
                          },
                        }
                        : {}),
                    })}
                  >
                    {t('demo.createGuide')}
                  </Button>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 1.25 }}
                  >
                    {t('demo.promptHelper')}
                  </Typography>
                </Box>
              </DemoStep>
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
                        {t('studyGuides.elapsed')} {formatDuration(elapsedSeconds)}{' '}
                    · {t('studyGuides.estimatedTotal')}{' '}
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
        </Box>
        <StudyMeshFooter sectionHrefPrefix="/" />
      </Box>
    </ThemeProvider>
  )
}

export default DemoCreatePage
