import React from 'react'
import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import KeyIcon from '@mui/icons-material/Key'
import MemoryIcon from '@mui/icons-material/Memory'

import StudyCreditIcon from '../hostedAi/StudyCreditIcon'
import LandingTopNav from './LandingTopNav'
import {
  HOSTED_AI_CREDIT_PACKS,
  HOSTED_AI_INITIAL_FREE_CREDITS,
  STUDY_CREDITS_LABEL,
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

const pricingCreditIconFilter =
  'drop-shadow(0 0 1px rgba(0,95,88,0.95)) drop-shadow(0 0 2px rgba(0,95,88,0.28))'

const packBadgeLabel = (packId: string): string => {
  if (packId === 'starter') {
    return 'Starter'
  }

  if (packId === 'popular') {
    return 'Popular'
  }

  return 'Best value'
}

const packValueLabel = (credits: number, priceCents: number): string =>
  `${Math.round(credits / (priceCents / 100))} credits / EUR`

const CreditAmount = ({
  amount,
  size = 'body2',
  iconSize = 18,
}: {
  amount: number
  size?: 'body2' | 'h6'
  iconSize?: number
}) => (
  <Box
    component="span"
    aria-label={`${amount} Study Credits`}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.45,
      verticalAlign: 'text-bottom',
      color: pricingBrand.ink,
      fontWeight: 900,
    }}
  >
    <Typography
      component="span"
      variant={size}
      sx={{ color: 'inherit', fontWeight: 'inherit', lineHeight: 1 }}
    >
      {amount}
    </Typography>
    <StudyCreditIcon size={iconSize} filter={pricingCreditIconFilter} />
  </Box>
)

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
                  display: 'inline-block',
                  color: pricingBrand.ink,
                  textDecorationLine: 'underline',
                  textDecorationColor: pricingBrand.mint,
                  textDecorationThickness: { xs: 3, sm: 4 },
                  textUnderlineOffset: '0.28em',
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
                  {STUDY_CREDITS_LABEL} pay for hosted generation when you do
                  not want to manage an API key.
                </Typography>
              </Stack>

              <Grid container spacing={2} alignItems="stretch">
                {HOSTED_AI_CREDIT_PACKS.map((pack) => {
                  const highlighted = pack.id !== 'starter'
                  const isPremium = pack.id === 'value'

                  return (
                    <Grid item xs={12} md={4} key={pack.id}>
                      <Box
                        sx={{
                          borderRadius: 2.5,
                          ...(isPremium && {
                            p: '2px',
                            background:
                              'linear-gradient(115deg, #7c3aed, #22d3ee, #f59e0b, #ec4899, #7c3aed)',
                            backgroundSize: '300% 300%',
                            animation: 'premiumBorderFlow 5s ease infinite',
                            boxShadow:
                              '0 14px 34px rgba(124,58,237,0.20), 0 0 24px rgba(34,211,238,0.16)',
                            '@keyframes premiumBorderFlow': {
                              '0%': { backgroundPosition: '0% 50%' },
                              '50%': { backgroundPosition: '100% 50%' },
                              '100%': { backgroundPosition: '0% 50%' },
                            },
                          }),
                        }}
                      >
                        <Paper
                          elevation={0}
                          variant="outlined"
                          sx={{
                            position: 'relative',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: 0,
                            p: 2,
                            borderRadius: isPremium ? 'calc(20px - 2px)' : 2.5,
                            borderWidth: highlighted && !isPremium ? 2 : 1,
                            borderColor: isPremium
                              ? 'transparent'
                              : highlighted
                                ? '#008575'
                                : 'divider',
                            bgcolor: 'background.paper',
                            backgroundImage: isPremium
                              ? 'radial-gradient(circle at 92% 8%, rgba(34,211,238,0.20), transparent 42%), radial-gradient(circle at 4% 94%, rgba(124,58,237,0.20), transparent 48%)'
                              : 'none',
                            boxShadow:
                              highlighted && !isPremium
                                ? '0 10px 24px rgba(0,137,123,0.10)'
                                : 0,
                            transition:
                              'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
                            '&:hover': {
                              transform: 'translateY(-3px)',
                              boxShadow: isPremium
                                ? '0 16px 36px rgba(124,58,237,0.22), 0 0 26px rgba(34,211,238,0.18)'
                                : '0 16px 34px rgba(0,137,123,0.16)',
                              borderColor: isPremium
                                ? 'transparent'
                                : '#008575',
                            },
                          }}
                        >
                          <Stack spacing={1.35}>
                            <Stack
                              direction="row"
                              alignItems="center"
                              justifyContent="space-between"
                              gap={1}
                              sx={{ mb: 0.15 }}
                            >
                              <Chip
                                label={packBadgeLabel(pack.id)}
                                size="small"
                                sx={{
                                  height: 26,
                                  fontWeight: 950,
                                  color: '#fff',
                                  bgcolor: isPremium ? '#ec4899' : '#008575',
                                  ...(isPremium && {
                                    background:
                                      'linear-gradient(115deg, #f97316, #ec4899, #8b5cf6)',
                                    boxShadow:
                                      '0 6px 14px rgba(236,72,153,0.28)',
                                  }),
                                  '& .MuiChip-label': { px: 1.2 },
                                }}
                              />
                            </Stack>
                            <Stack
                              direction="row"
                              spacing={0.85}
                              alignItems="center"
                              aria-label={`${pack.credits} Study Credits`}
                            >
                              <Typography
                                variant="h4"
                                fontWeight={950}
                                lineHeight={1.05}
                              >
                                {pack.credits}
                              </Typography>
                              <StudyCreditIcon size={27} />
                            </Stack>

                            <Divider sx={{ my: 0.05 }} />

                            <Stack
                              direction="row"
                              alignItems="baseline"
                              justifyContent="space-between"
                              gap={1}
                            >
                              <Typography variant="h5" fontWeight={950}>
                                {pack.label}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {packValueLabel(pack.credits, pack.priceCents)}
                              </Typography>
                            </Stack>
                            <Stack
                              spacing={0.75}
                              sx={{
                                mt: 0.45,
                                py: 1,
                                px: 1.1,
                                borderRadius: 1.5,
                                bgcolor: alpha('#008575', 0.045),
                                border: '1px solid',
                                borderColor: alpha('#008575', 0.11),
                              }}
                            >
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
                                    sx={{ color: '#008575' }}
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
                              variant="outlined"
                              href="/signup"
                              sx={{
                                py: 0.9,
                                px: 1.5,
                                borderRadius: 1.5,
                                color: '#008575',
                                bgcolor: 'transparent',
                                borderColor: '#008575',
                                textTransform: 'none',
                                fontWeight: 950,
                                fontSize: '1rem',
                                '&:hover': {
                                  bgcolor: alpha('#008575', 0.06),
                                  borderColor: '#008575',
                                },
                              }}
                            >
                              Sign up
                            </Button>
                          </Stack>
                        </Paper>
                      </Box>
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
                  New accounts start with{' '}
                  <CreditAmount amount={HOSTED_AI_INITIAL_FREE_CREDITS} />.
                  After that, Study Credits only increase through completed
                  credit purchases. Study Guides cost{' '}
                  <CreditAmount amount={getHostedAiCreditCost('study-guide')} />
                  ; Quick Create and chat cost{' '}
                  <CreditAmount
                    amount={getHostedAiCreditCost('quick-create')}
                  />
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
