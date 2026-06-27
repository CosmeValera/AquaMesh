import React from 'react'
import {
  Box,
  Button,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloudQueueIcon from '@mui/icons-material/CloudQueue'
import KeyIcon from '@mui/icons-material/Key'
import MemoryIcon from '@mui/icons-material/Memory'

import LandingTopNav from './LandingTopNav'
import {
  HOSTED_AI_CREDIT_PACKS,
  HOSTED_AI_INITIAL_FREE_CREDITS,
  STUDY_CREDITS_LABEL,
  STUDY_CREDITS_SYMBOL,
  getHostedAiCreditCost,
} from '../../quickCreate/ai'

const pricingBrand = {
  canvas: '#FBFDFE',
  surface: '#FFFFFF',
  subtleSurface: '#F6FAFE',
  ink: '#071127',
  muted: '#5B6680',
  softText: '#64719B',
  line: '#D9E5F3',
  blue: '#1150D8',
  blueDark: '#0D3FAE',
  sky: '#12A7E8',
  skySoft: '#E4F4FF',
  mint: '#11C9A3',
  mintDark: '#008A78',
  mintSoft: '#DDF9EF',
}

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

const StudyMeshPricingPage = () => {
  const pageColor = pricingBrand.canvas

  return (
    <Box
      data-testid="studymesh-pricing"
      sx={{
        minHeight: '100dvh',
        bgcolor: pageColor,
        color: pricingBrand.ink,
        fontFamily: '"Readex Pro", "Inter", "Segoe UI", Arial, sans-serif',
      }}
    >
      <LandingTopNav sectionHrefPrefix="/" />

      <Container maxWidth="lg" component="main">
        <Box sx={{ py: { xs: 6, md: 10 } }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 4 },
              borderRadius: 3,
              border: '1px solid',
              borderColor: alpha(pricingBrand.blue, 0.22),
              bgcolor: alpha(pricingBrand.skySoft, 0.42),
              background: `radial-gradient(circle at top right, ${alpha(
                pricingBrand.sky,
                0.2,
              )}, transparent 34%), linear-gradient(135deg, ${alpha(
                pricingBrand.skySoft,
                0.72,
              )}, ${alpha(pricingBrand.mintSoft, 0.62)})`,
            }}
          >
            <Stack spacing={1} alignItems="center" textAlign="center" mb={3}>
              <Typography
                variant="h4"
                component="h1"
                fontWeight={900}
                sx={{
                  position: 'relative',
                  display: 'inline-block',
                  color: pricingBrand.ink,
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    left: 2,
                    right: 2,
                    bottom: -4,
                    height: { xs: 3, sm: 4 },
                    borderRadius: 999,
                    bgcolor: pricingBrand.mint,
                    boxShadow: `0 2px 0 ${alpha(pricingBrand.blueDark, 0.1)}`,
                  },
                }}
              >
                Free without a subscription.
              </Typography>
              <Typography
                variant="body1"
                sx={{ maxWidth: 720, color: pricingBrand.muted, pt: 2 }}
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
                borderColor: alpha(pricingBrand.mint, 0.36),
                bgcolor: alpha(pricingBrand.surface, 0.9),
                boxShadow: `0 20px 54px ${alpha(pricingBrand.mint, 0.12)}`,
              }}
            >
              <Grid container spacing={3} alignItems="stretch">
                <Grid item xs={12} md={4}>
                  <Stack spacing={1.5} height="100%">
                    <Typography
                      variant="overline"
                      fontWeight={900}
                      sx={{ color: pricingBrand.mintDark }}
                    >
                      Free product
                    </Typography>
                    <Typography
                      variant="h2"
                      fontWeight={950}
                      lineHeight={1}
                      sx={{ color: pricingBrand.ink }}
                    >
                      0€
                    </Typography>
                    <Typography sx={{ color: pricingBrand.muted }}>
                      Create Study Guides, Quick Create results, and chat with
                      your study workspace without a StudyMesh subscription.
                    </Typography>
                    <Button
                      variant="contained"
                      href="/signup"
                      sx={{
                        mt: 'auto',
                        borderRadius: 999,
                        bgcolor: pricingBrand.blue,
                        color: pricingBrand.surface,
                        textTransform: 'none',
                        fontWeight: 900,
                        boxShadow: `0 14px 28px ${alpha(
                          pricingBrand.blue,
                          0.22,
                        )}`,
                        '&:hover': {
                          bgcolor: pricingBrand.blueDark,
                          boxShadow: `0 16px 32px ${alpha(
                            pricingBrand.blue,
                            0.28,
                          )}`,
                        },
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
                            borderColor: alpha(pricingBrand.line, 0.72),
                            bgcolor: alpha(pricingBrand.subtleSurface, 0.72),
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
                                  color: pricingBrand.mintDark,
                                  bgcolor: alpha(pricingBrand.mint, 0.12),
                                }}
                              >
                                {option.icon}
                              </Box>
                              <Typography
                                variant="caption"
                                sx={{ color: pricingBrand.softText }}
                              >
                                {option.label}
                              </Typography>
                            </Stack>
                            <Typography
                              variant="h6"
                              fontWeight={900}
                              sx={{ color: pricingBrand.ink }}
                            >
                              {option.title}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{ color: pricingBrand.muted }}
                            >
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
                                    sx={{ color: pricingBrand.mintDark }}
                                  />
                                  <Typography
                                    variant="body2"
                                    sx={{ color: pricingBrand.ink }}
                                  >
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
                  sx={{ color: pricingBrand.blue }}
                >
                  Optional Hosted AI
                </Typography>
                <Typography
                  variant="h5"
                  component="h2"
                  fontWeight={900}
                  sx={{ color: pricingBrand.ink }}
                >
                  Buy Study Credits for setup-free AI.
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ maxWidth: 680, color: pricingBrand.muted }}
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
                            ? alpha(pricingBrand.blue, 0.62)
                            : alpha(pricingBrand.line, 0.9),
                          bgcolor: highlighted
                            ? alpha(pricingBrand.blue, 0.08)
                            : alpha(pricingBrand.surface, 0.78),
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
                                  ? pricingBrand.surface
                                  : pricingBrand.blue,
                                bgcolor: highlighted
                                  ? pricingBrand.blue
                                  : alpha(pricingBrand.blue, 0.1),
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
                              sx={{ color: pricingBrand.softText }}
                            >
                              {pack.badge ?? 'Credit pack'}
                            </Typography>
                          </Stack>
                          <Box>
                            <Typography
                              variant="h6"
                              fontWeight={900}
                              sx={{ color: pricingBrand.ink }}
                            >
                              {pack.credits} {STUDY_CREDITS_SYMBOL}
                            </Typography>
                            <Typography
                              variant="h4"
                              fontWeight={950}
                              sx={{ color: pricingBrand.ink }}
                            >
                              {formatCreditPackPrice(pack.label)}
                            </Typography>
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{ color: pricingBrand.muted }}
                          >
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
                                  sx={{
                                    color: highlighted
                                      ? pricingBrand.blue
                                      : pricingBrand.mintDark,
                                  }}
                                />
                                <Typography
                                  variant="body2"
                                  sx={{ color: pricingBrand.ink }}
                                >
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
                              borderColor: highlighted
                                ? pricingBrand.blue
                                : alpha(pricingBrand.blue, 0.36),
                              bgcolor: highlighted
                                ? pricingBrand.blue
                                : alpha(pricingBrand.surface, 0.76),
                              color: highlighted
                                ? pricingBrand.surface
                                : pricingBrand.blueDark,
                              textTransform: 'none',
                              fontWeight: 900,
                              boxShadow: highlighted
                                ? `0 14px 28px ${alpha(
                                    pricingBrand.blue,
                                    0.18,
                                  )}`
                                : 'none',
                              '&:hover': {
                                borderColor: pricingBrand.blue,
                                bgcolor: highlighted
                                  ? pricingBrand.blueDark
                                  : alpha(pricingBrand.blue, 0.08),
                                boxShadow: highlighted
                                  ? `0 16px 32px ${alpha(
                                      pricingBrand.blue,
                                      0.24,
                                    )}`
                                  : 'none',
                              },
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
                  borderColor: alpha(pricingBrand.line, 0.8),
                  bgcolor: alpha(pricingBrand.surface, 0.66),
                }}
              >
                <Typography variant="body2" sx={{ color: pricingBrand.muted }}>
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
