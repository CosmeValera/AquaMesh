import React from 'react'
import {
  Alert,
  Box,
  ButtonBase,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'

import {
  HOSTED_AI_CREDIT_PACKS,
  HostedAiCreditPackId,
  redirectToHostedAiCreditCheckout,
} from '../../studyPack/ai'

const HostedAiPricingCards: React.FC = () => {
  const [buyingPackId, setBuyingPackId] =
    React.useState<HostedAiCreditPackId | null>(null)
  const [error, setError] = React.useState('')

  const handleBuyCredits = async (packId: HostedAiCreditPackId) => {
    setBuyingPackId(packId)
    setError('')

    try {
      await redirectToHostedAiCreditCheckout(packId)
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Could not start Study Credits checkout.',
      )
      setBuyingPackId(null)
    }
  }

  return (
    <Stack spacing={1.5} sx={{ mt: 2 }}>
      <Box>
        <Typography variant="h6" fontWeight={900}>
          Choose a credit pack
        </Typography>
        <Typography variant="body2" color="text.secondary">
          One-time purchases. Credits stay in your StudyMesh account.
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(3, minmax(0, 1fr))',
          },
          gap: 1.5,
        }}
      >
        {HOSTED_AI_CREDIT_PACKS.map((pack) => {
          const highlighted = pack.badge !== undefined && pack.id !== 'starter'
          const isPremium = pack.id === 'value'
          const buying = buyingPackId === pack.id

          return (
            <Box
              key={pack.id}
              sx={{
                position: 'relative',
                borderRadius: 3,
                ...(isPremium && {
                  p: '2px',
                  background:
                    'linear-gradient(115deg, #7c3aed, #22d3ee, #f59e0b, #ec4899, #7c3aed)',
                  backgroundSize: '300% 300%',
                  animation: 'premiumBorderFlow 5s ease infinite',
                  boxShadow:
                    '0 12px 30px rgba(124, 58, 237, 0.22), 0 0 24px rgba(34, 211, 238, 0.16)',
                  '@keyframes premiumBorderFlow': {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' },
                  },
                }),
              }}
            >
              <Paper
                component={ButtonBase}
                variant="outlined"
                type="button"
                onClick={() => void handleBuyCredits(pack.id)}
                disabled={buyingPackId !== null}
                aria-label={`Buy ${pack.credits} credits for ${pack.label}${
                  pack.badge ? ` - ${pack.badge}` : ''
                }`}
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  textAlign: 'left',
                  font: 'inherit',
                  width: '100%',
                  minHeight: 190,
                  p: 2,
                  borderRadius: isPremium ? 'calc(12px - 2px)' : 3,
                  borderWidth: highlighted && !isPremium ? 2 : 1,
                  borderColor: isPremium
                    ? 'transparent'
                    : highlighted
                      ? 'primary.main'
                      : 'divider',
                  bgcolor: 'background.paper',
                  backgroundImage: isPremium
                    ? 'radial-gradient(circle at 85% 10%, rgba(34,211,238,0.20), transparent 42%), radial-gradient(circle at 8% 88%, rgba(124,58,237,0.20), transparent 48%)'
                    : 'none',
                  boxShadow: highlighted && !isPremium ? 4 : 0,
                  transition:
                    'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: isPremium ? 8 : highlighted ? 6 : 3,
                    borderColor: isPremium ? 'transparent' : 'primary.main',
                  },
                  '&.Mui-disabled': {
                    color: 'text.primary',
                    opacity: buying ? 0.8 : 0.56,
                  },
                }}
              >
                {pack.badge && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                    <Chip
                      icon={<AutoAwesomeIcon />}
                      label={pack.badge}
                      size="small"
                      sx={{
                        fontWeight: 900,
                        whiteSpace: 'nowrap',
                        ...(isPremium && {
                          color: '#fff',
                          background:
                            'linear-gradient(115deg, #7c3aed, #22d3ee, #f59e0b, #ec4899, #7c3aed)',
                          backgroundSize: '300% 300%',
                          animation: 'premiumBorderFlow 5s ease infinite',
                          boxShadow:
                            '0 4px 12px rgba(124,58,237,0.28), 0 0 12px rgba(34,211,238,0.16)',
                          '& .MuiChip-icon': {
                            color: '#fff',
                          },
                        }),
                        ...(!isPremium && {
                          color: 'primary.contrastText',
                          bgcolor: 'primary.main',
                        }),
                      }}
                    />
                  </Box>
                )}
                <Typography
                  variant="overline"
                  color="text.secondary"
                  fontWeight={800}
                >
                  Study Credits
                </Typography>
                <Typography variant="h4" fontWeight={950} lineHeight={1.1}>
                  {pack.credits}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  credits
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Typography variant="h5" fontWeight={900} sx={{ mt: 2 }}>
                  {pack.label}
                </Typography>
                <Box
                  sx={{
                    mt: 1.25,
                    py: 0.75,
                    px: 1.5,
                    borderRadius: 1.5,
                    textAlign: 'center',
                    fontWeight: 900,
                    color: 'primary.main',
                    bgcolor: 'transparent',
                    border: 1,
                    borderColor: 'primary.main',
                  }}
                >
                  {buying ? 'Opening checkout...' : 'Buy pack'}
                </Box>
              </Paper>
            </Box>
          )
        })}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  )
}

export default HostedAiPricingCards
