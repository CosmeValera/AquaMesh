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
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloudQueueIcon from '@mui/icons-material/CloudQueue'
import KeyIcon from '@mui/icons-material/Key'
import MemoryIcon from '@mui/icons-material/Memory'

const aiPricing = [
  {
    title: 'Fallback mode',
    price: '0€',
    label: 'Always available',
    body: 'Basic local parsing and practice generation when you just want a quick dashboard without configuring AI.',
    icon: <CheckCircleIcon />,
    features: ['No API key', 'No payment', 'Good for quick notes'],
  },
  {
    title: 'Local Gemini Nano',
    price: '0€',
    label: 'Private on-device AI',
    body: 'Run compatible local AI in the browser when available. Slower, but private and free to use.',
    icon: <MemoryIcon />,
    features: ['No server tokens', 'Runs locally', 'Best for privacy'],
  },
  {
    title: 'BYOK Gemini',
    price: '0€',
    label: 'Use your own key',
    body: 'Bring your Gemini API key and StudyMesh uses it directly for deeper study guides and Quick Create results.',
    icon: <KeyIcon />,
    features: ['Your quota', 'Your control', 'Great quality'],
  },
  {
    title: 'Hosted API tokens',
    price: '2€',
    label: 'No API keys to manage',
    body: 'Start with 5-10 free tries. If you need more, make a one-time 2€ payment for greater hourly limits.',
    icon: <CloudQueueIcon />,
    features: ['5-10 free tries', 'One-time payment', 'Higher hourly limits'],
    highlighted: true,
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
                Choose the AI mode that fits you
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ maxWidth: 720 }}
              >
                StudyMesh is designed to stay useful even at 0€. Use free modes,
                bring your own Gemini key, run local AI, or choose hosted tokens
                when you do not want to worry about API keys, quotas, or setup.
              </Typography>
            </Stack>

            <Grid container spacing={2} alignItems="stretch">
              {aiPricing.map((plan) => (
                <Grid item xs={12} sm={6} md={3} key={plan.title}>
                  <Paper
                    elevation={0}
                    sx={{
                      height: '100%',
                      p: 2.25,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: plan.highlighted
                        ? 'primary.main'
                        : alpha(theme.palette.divider, 0.9),
                      bgcolor: plan.highlighted
                        ? alpha(theme.palette.primary.main, 0.1)
                        : alpha(theme.palette.background.paper, 0.86),
                      boxShadow: plan.highlighted
                        ? `0 18px 44px ${alpha(
                            theme.palette.primary.main,
                            0.18,
                          )}`
                        : 'none',
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
                            color: plan.highlighted
                              ? 'primary.contrastText'
                              : 'primary.main',
                            bgcolor: plan.highlighted
                              ? 'primary.main'
                              : alpha(theme.palette.primary.main, 0.1),
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
                        <Stack direction="row" spacing={0.75} alignItems="end">
                          <Typography variant="h3" fontWeight={950}>
                            {plan.price}
                          </Typography>
                          {plan.highlighted && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ pb: 0.75 }}
                            >
                              one-time
                            </Typography>
                          )}
                        </Stack>
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
                            <CheckCircleIcon
                              fontSize="small"
                              color={plan.highlighted ? 'primary' : 'success'}
                            />
                            <Typography variant="body2">{feature}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Box>
      </Container>
    </Box>
  )
}

export default StudyMeshPricingPage
