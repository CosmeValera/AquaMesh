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
  HOSTED_AI_INITIAL_FREE_CREDITS,
  STUDY_CREDITS_LABEL,
  STUDY_CREDITS_SYMBOL,
  getHostedAiCreditCost,
} from '../../quickCreate/ai'

const formatCreditPackPrice = (label: string) => label.replace(' EUR', '€')

const freeOptions = [
  {
    title: 'Bring your own key',
    label: 'Use your own key',
    body: 'Connect Gemini or Cerebras and use your own provider quota for Study Guides, Quick Create, and chat.',
    icon: <KeyIcon />,
    features: ['Your provider quota', 'Gemini or Cerebras', 'Direct control'],
  },
  {
    title: 'Local AI',
    label: 'Private on-device AI',
    body: 'Run compatible browser-local AI when available, with generation kept on your device.',
    icon: <MemoryIcon />,
    features: ['No hosted credits', 'Works locally', 'Private by design'],
  },
]

const navItems = [
  ['Features', '/#growing-guide'],
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
            height: { xs: 64, sm: 72 },
            display: 'grid',
            gridTemplateColumns: { xs: 'auto 1fr auto', md: '1fr auto 1fr' },
            alignItems: 'center',
            justifyContent: { xs: 'space-between', md: 'stretch' },
            columnGap: { xs: 1.25, sm: 2 },
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
                sx={{
                  width: { xs: 32, sm: 36 },
                  height: { xs: 32, sm: 36 },
                  display: 'block',
                }}
              />
              <Typography
                variant="h6"
                fontWeight={900}
                sx={{ display: { xs: 'none', sm: 'block' } }}
              >
                StudyMesh
              </Typography>
            </Stack>
          </Button>
          <Stack
            component="nav"
            direction="row"
            spacing={{ xs: 1.5, md: 4 }}
            alignItems="center"
            justifyContent="center"
            sx={{ display: 'flex' }}
          >
            {navItems.map(([label, href]) => (
              <Button
                key={label}
                href={href}
                variant="text"
                sx={{
                  display: {
                    xs: label === 'Pricing' ? 'inline-flex' : 'none',
                    md: 'inline-flex',
                  },
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
              minWidth: { xs: 88, sm: 'auto' },
              px: { xs: 1.75, sm: 3 },
              py: { xs: 0.85, sm: 1.05 },
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
              '& .MuiButton-endIcon': {
                display: { xs: 'none', sm: 'inherit' },
              },
            }}
          >
            <Box
              component="span"
              sx={{ display: { xs: 'none', sm: 'inline' } }}
            >
              Create a Study Guide
            </Box>
            <Box
              component="span"
              sx={{ display: { xs: 'inline', sm: 'none' } }}
            >
              Create
            </Box>
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
                Free without a subscription.
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ maxWidth: 720 }}
              >
                No credit card required to start. Use StudyMesh for free with
                your own API key or local AI. Hosted AI is optional when you
                want setup-free generation.
              </Typography>
            </Stack>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, md: 3.5 },
                borderRadius: 2,
                border: '1px solid',
                borderColor: alpha(theme.palette.success.main, 0.36),
                bgcolor: alpha(theme.palette.background.paper, 0.9),
                boxShadow: `0 20px 54px ${alpha(
                  theme.palette.success.main,
                  0.12,
                )}`,
              }}
            >
              <Grid container spacing={3} alignItems="stretch">
                <Grid item xs={12} md={4}>
                  <Stack spacing={1.5} height="100%">
                    <Typography variant="overline" fontWeight={900}>
                      Free product
                    </Typography>
                    <Typography variant="h2" fontWeight={950} lineHeight={1}>
                      0€
                    </Typography>
                    <Typography color="text.secondary">
                      Create Study Guides, Quick Create results, and chat with
                      your study workspace without a StudyMesh subscription.
                    </Typography>
                    <Button
                      variant="contained"
                      href="/signup"
                      sx={{
                        mt: 'auto',
                        borderRadius: 999,
                        textTransform: 'none',
                        fontWeight: 900,
                      }}
                    >
                      Start free
                    </Button>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Grid container spacing={2} height="100%">
                    {freeOptions.map((option) => (
                      <Grid item xs={12} sm={6} key={option.title}>
                        <Box
                          sx={{
                            height: '100%',
                            p: 2,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: alpha(theme.palette.divider, 0.72),
                            bgcolor: alpha(
                              theme.palette.background.default,
                              0.42,
                            ),
                          }}
                        >
                          <Stack spacing={1.25} height="100%">
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
                                  color: 'success.main',
                                  bgcolor: alpha(
                                    theme.palette.success.main,
                                    0.12,
                                  ),
                                }}
                              >
                                {option.icon}
                              </Box>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {option.label}
                              </Typography>
                            </Stack>
                            <Typography variant="h6" fontWeight={900}>
                              {option.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {option.body}
                            </Typography>
                            <Stack spacing={0.75} sx={{ mt: 'auto' }}>
                              {option.features.map((feature) => (
                                <Stack
                                  key={feature}
                                  direction="row"
                                  spacing={0.75}
                                  alignItems="center"
                                >
                                  <CheckCircleIcon
                                    fontSize="small"
                                    color="success"
                                  />
                                  <Typography variant="body2">
                                    {feature}
                                  </Typography>
                                </Stack>
                              ))}
                            </Stack>
                          </Stack>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              </Grid>
            </Paper>

            <Box sx={{ mt: { xs: 4.5, md: 6 } }}>
              <Stack spacing={1} alignItems="center" textAlign="center" mb={3}>
                <Typography
                  variant="overline"
                  fontWeight={900}
                  color="primary.main"
                >
                  Optional Hosted AI
                </Typography>
                <Typography variant="h5" component="h2" fontWeight={900}>
                  Buy Study Credits for setup-free AI.
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ maxWidth: 680 }}
                >
                  {STUDY_CREDITS_LABEL} ({STUDY_CREDITS_SYMBOL}) pay for hosted
                  generation when you do not want to manage an API key.
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
                          p: 2,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: highlighted
                            ? alpha(theme.palette.primary.main, 0.62)
                            : alpha(theme.palette.divider, 0.9),
                          bgcolor: highlighted
                            ? alpha(theme.palette.primary.main, 0.08)
                            : alpha(theme.palette.background.paper, 0.78),
                        }}
                      >
                        <Stack spacing={1.35} height="100%">
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <Box
                              sx={{
                                width: 34,
                                height: 34,
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
                                <AutoAwesomeIcon fontSize="small" />
                              ) : (
                                <CloudQueueIcon fontSize="small" />
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
                            <Typography variant="h4" fontWeight={950}>
                              {formatCreditPackPrice(pack.label)}
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            One-time credit purchase. Credits stay in your
                            StudyMesh account.
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

              <Paper
                elevation={0}
                sx={{
                  mt: 2,
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: alpha(theme.palette.divider, 0.8),
                  bgcolor: alpha(theme.palette.background.paper, 0.66),
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  New accounts start with {HOSTED_AI_INITIAL_FREE_CREDITS}{' '}
                  {STUDY_CREDITS_SYMBOL}. After that, Study Credits only
                  increase through completed credit purchases. Study Guides cost{' '}
                  {getHostedAiCreditCost('study-guide')} {STUDY_CREDITS_SYMBOL};
                  Quick Create and chat cost{' '}
                  {getHostedAiCreditCost('quick-create')} {STUDY_CREDITS_SYMBOL}
                  .
                </Typography>
              </Paper>
            </Box>
          </Paper>
        </Box>
      </Container>
    </Box>
  )
}

export default StudyMeshPricingPage
