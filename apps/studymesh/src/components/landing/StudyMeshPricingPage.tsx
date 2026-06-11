import React from 'react'
import {
  Box,
  Button,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloudQueueIcon from '@mui/icons-material/CloudQueue'
import KeyIcon from '@mui/icons-material/Key'
import MemoryIcon from '@mui/icons-material/Memory'

import {
  HOSTED_AI_CREDIT_PACKS,
  HOSTED_AI_DAILY_FREE_CREDITS,
  HOSTED_AI_INITIAL_FREE_CREDITS,
  STUDY_CREDITS_SYMBOL,
  getHostedAiCreditCost,
} from '../../quickCreate/ai'

const formatCreditPackPrice = (label: string) => label.replace(' EUR', '€')

const freeOptions = [
  {
    title: 'Own AI key',
    price: '0€',
    label: 'Use your own key',
    body: 'Bring your Gemini or Cerebras API key and StudyMesh stays free for Study Guides, Quick Create, and chat.',
    icon: <KeyIcon />,
    features: [
      'No StudyMesh subscription',
      'Your provider quota',
      'Strong AI quality',
    ],
  },
  {
    title: 'Local AI',
    price: '0€',
    label: 'Private on-device AI',
    body: 'Run compatible browser-local AI when available. It is slower, private, and free to use.',
    icon: <MemoryIcon />,
    features: ['No hosted tokens', 'Runs locally', 'Good privacy path'],
  },
]

const navItems = [
  ['Features', '/#features'],
  ['Pricing', '/pricing'],
]

const StudyMeshPricingPage = () => {
  const navigate = useNavigate()
  const theme = useTheme()
  const pageColor = theme.palette.background.default

  const openCreateStudyGuide = () => {
    navigate('/study-guides?create=1')
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: pageColor,
        color: 'text.primary',
      }}
    >
      <Box
        component="header"
        sx={{
          borderBottom: '1px solid',
          borderColor: alpha(theme.palette.divider, 0.56),
          bgcolor: alpha(pageColor, 0.86),
          backdropFilter: 'blur(18px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            height: 72,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr auto', md: '1fr auto 1fr' },
            alignItems: 'center',
            columnGap: 2,
          }}
        >
          <Button
            variant="text"
            onClick={() => navigate('/')}
            sx={{
              justifySelf: 'start',
              minWidth: 'auto',
              p: 0,
              color: 'text.primary',
              textTransform: 'none',
              '&:hover': { bgcolor: 'transparent' },
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                component="img"
                src="/logo.png"
                alt="StudyMesh logo"
                sx={{ width: 36, height: 36, display: 'block' }}
              />
              <Typography variant="h6" fontWeight={900}>
                StudyMesh
              </Typography>
            </Stack>
          </Button>
          <Stack
            component="nav"
            direction="row"
            spacing={4}
            alignItems="center"
            justifyContent="center"
            sx={{ display: { xs: 'none', md: 'flex' } }}
          >
            {navItems.map(([label, href]) => (
              <Button
                key={label}
                href={href}
                variant="text"
                sx={{
                  minWidth: 'auto',
                  px: 0,
                  color: alpha(theme.palette.text.primary, 0.78),
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: '0.98rem',
                  '&:hover': {
                    bgcolor: 'transparent',
                    color: 'primary.main',
                  },
                }}
              >
                {label}
              </Button>
            ))}
          </Stack>
          <Button
            variant="outlined"
            endIcon={<ArrowForwardIcon />}
            onClick={openCreateStudyGuide}
            sx={{
              justifySelf: 'end',
              borderRadius: 999,
              px: { xs: 2, sm: 3 },
              py: 1.05,
              color: 'primary.dark',
              borderColor: alpha(theme.palette.primary.main, 0.32),
              bgcolor: alpha(theme.palette.background.paper, 0.72),
              boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, 0.08)}`,
              textTransform: 'none',
              fontWeight: 900,
              '&:hover': {
                borderColor: alpha(theme.palette.primary.main, 0.5),
                bgcolor: alpha(theme.palette.primary.main, 0.08),
              },
            }}
          >
            Create a Study Guide
          </Button>
        </Container>
      </Box>

      <Container maxWidth="lg" component="main">
        <Box sx={{ py: { xs: 6, md: 10 } }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 4 },
              borderRadius: 3,
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.22),
              bgcolor:
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.primary.dark, 0.24)
                  : alpha(theme.palette.primary.light, 0.1),
              background:
                theme.palette.mode === 'dark'
                  ? `radial-gradient(circle at top right, ${alpha(
                      theme.palette.primary.main,
                      0.24,
                    )}, transparent 34%), ${alpha(
                      theme.palette.background.paper,
                      0.74,
                    )}`
                  : `radial-gradient(circle at top right, ${alpha(
                      theme.palette.primary.light,
                      0.38,
                    )}, transparent 34%), linear-gradient(135deg, ${alpha(
                      theme.palette.primary.light,
                      0.14,
                    )}, ${alpha(theme.palette.success.light, 0.14)})`,
            }}
          >
            <Stack spacing={1} alignItems="center" textAlign="center" mb={3}>
              <Typography
                variant="overline"
                fontWeight={900}
                color="primary.main"
              >
                Pricing
              </Typography>
              <Typography variant="h4" component="h1" fontWeight={900}>
                Free forever with your own AI key.
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ maxWidth: 720 }}
              >
                No app subscription. No credit card required to start. Use
                StudyMesh for free with your own API key or local AI. Hosted AI
                is optional when you want setup-free generation.
              </Typography>
            </Stack>

            <Grid container spacing={2} alignItems="stretch">
              {freeOptions.map((plan) => (
                <Grid item xs={12} md={6} key={plan.title}>
                  <Paper
                    elevation={0}
                    sx={{
                      height: '100%',
                      p: 2.25,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: alpha(theme.palette.success.main, 0.3),
                      bgcolor: alpha(theme.palette.background.paper, 0.86),
                    }}
                  >
                    <Stack spacing={1.5} height="100%">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            color: 'success.main',
                            bgcolor: alpha(theme.palette.success.main, 0.12),
                          }}
                        >
                          {plan.icon}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {plan.label}
                        </Typography>
                      </Stack>
                      <Box>
                        <Typography variant="h6" fontWeight={900}>
                          {plan.title}
                        </Typography>
                        <Typography variant="h3" fontWeight={950}>
                          {plan.price}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {plan.body}
                      </Typography>
                      <Stack spacing={0.75} sx={{ mt: 'auto' }}>
                        {plan.features.map((feature) => (
                          <Stack
                            key={feature}
                            direction="row"
                            spacing={0.75}
                            alignItems="center"
                          >
                            <CheckCircleIcon fontSize="small" color="success" />
                            <Typography variant="body2">{feature}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                      <Button
                        variant="outlined"
                        href="/signup"
                        sx={{
                          mt: 1,
                          borderRadius: 999,
                          textTransform: 'none',
                          fontWeight: 900,
                        }}
                      >
                        Start free
                      </Button>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            <Box sx={{ mt: { xs: 4, md: 5 } }}>
              <Stack spacing={1} alignItems="center" textAlign="center" mb={3}>
                <Typography
                  variant="overline"
                  fontWeight={900}
                  color="primary.main"
                >
                  Optional Hosted AI
                </Typography>
                <Typography variant="h5" component="h2" fontWeight={900}>
                  Need setup-free AI? Use Study Credits.
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ maxWidth: 760 }}
                >
                  New accounts start with {HOSTED_AI_INITIAL_FREE_CREDITS}{' '}
                  {STUDY_CREDITS_SYMBOL}. Free daily refill brings your balance
                  back up to {HOSTED_AI_DAILY_FREE_CREDITS}{' '}
                  {STUDY_CREDITS_SYMBOL}. Study Guides cost{' '}
                  {getHostedAiCreditCost('study-guide')}{' '}
                  {STUDY_CREDITS_SYMBOL}; Quick Create and chat cost{' '}
                  {getHostedAiCreditCost('quick-create')}{' '}
                  {STUDY_CREDITS_SYMBOL}.
                </Typography>
              </Stack>

              <Grid container spacing={2} alignItems="stretch">
                {HOSTED_AI_CREDIT_PACKS.map((pack) => {
                  const highlighted = pack.id !== 'starter'

                  return (
                    <Grid item xs={12} md={4} key={pack.id}>
                      <Paper
                        elevation={0}
                        sx={{
                          height: '100%',
                          p: 2.25,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: highlighted
                            ? 'primary.main'
                            : alpha(theme.palette.divider, 0.9),
                          bgcolor: highlighted
                            ? alpha(theme.palette.primary.main, 0.1)
                            : alpha(theme.palette.background.paper, 0.86),
                          boxShadow: highlighted
                            ? `0 18px 44px ${alpha(
                                theme.palette.primary.main,
                                0.16,
                              )}`
                            : 'none',
                        }}
                      >
                        <Stack spacing={1.5} height="100%">
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <Box
                              sx={{
                                width: 38,
                                height: 38,
                                borderRadius: '50%',
                                display: 'grid',
                                placeItems: 'center',
                                color: highlighted
                                  ? 'primary.contrastText'
                                  : 'primary.main',
                                bgcolor: highlighted
                                  ? 'primary.main'
                                  : alpha(theme.palette.primary.main, 0.1),
                              }}
                            >
                              {highlighted ? (
                                <AutoAwesomeIcon />
                              ) : (
                                <CloudQueueIcon />
                              )}
                            </Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {pack.badge ?? 'Credit pack'}
                            </Typography>
                          </Stack>
                          <Box>
                            <Typography variant="h6" fontWeight={900}>
                              {pack.credits} {STUDY_CREDITS_SYMBOL}
                            </Typography>
                            <Typography variant="h3" fontWeight={950}>
                              {formatCreditPackPrice(pack.label)}
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            One-time Study Credits purchase for hosted AI.
                            Credits stay in your StudyMesh account.
                          </Typography>
                          <Stack spacing={0.75} sx={{ mt: 'auto' }}>
                            {[
                              'No API key to manage',
                              'Use for Study Guides',
                              'Use for Quick Create and chat',
                            ].map((feature) => (
                              <Stack
                                key={feature}
                                direction="row"
                                spacing={0.75}
                                alignItems="center"
                              >
                                <CheckCircleIcon
                                  fontSize="small"
                                  color={highlighted ? 'primary' : 'success'}
                                />
                                <Typography variant="body2">
                                  {feature}
                                </Typography>
                              </Stack>
                            ))}
                          </Stack>
                          <Button
                            variant={highlighted ? 'contained' : 'outlined'}
                            href="/signup"
                            sx={{
                              mt: 1,
                              borderRadius: 999,
                              textTransform: 'none',
                              fontWeight: 900,
                            }}
                          >
                            Sign up
                          </Button>
                        </Stack>
                      </Paper>
                    </Grid>
                  )
                })}
              </Grid>
            </Box>
          </Paper>
        </Box>
      </Container>
    </Box>
  )
}

export default StudyMeshPricingPage
