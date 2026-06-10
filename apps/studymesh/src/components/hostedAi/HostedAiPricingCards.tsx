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
  DEFAULT_HOSTED_AI_CREDIT_PACK_ID,
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
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        {HOSTED_AI_CREDIT_PACKS.map((pack) => {
          const highlighted = Boolean(pack.badge)
          const isValue = pack.id === 'value'
          const isMax = pack.id === 'max'
          const buying = buyingPackId === pack.id

          return (
            <Box
              key={pack.id}
              sx={{
                position: 'relative',
                borderRadius: 3,
                ...(isMax && {
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
                ...(isValue && {
                  p: '1px',
                  background:
                    'linear-gradient(145deg, rgba(25,118,210,0.85), rgba(124,58,237,0.55), rgba(34,211,238,0.65))',
                  boxShadow:
                    '0 8px 20px rgba(25,118,210,0.16), 0 0 14px rgba(124,58,237,0.10)',
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
                  pt: pack.badge ? 2.75 : 2,
                  borderRadius: isMax
                    ? 'calc(12px - 2px)'
                    : isValue
                      ? 'calc(12px - 1px)'
                      : 3,
                  borderWidth: highlighted && !isMax ? 2 : 1,
                  borderColor: isMax
                    ? 'transparent'
                    : highlighted || isValue
                      ? 'primary.main'
                      : 'divider',
                  bgcolor:
                    isMax || isValue ? 'background.paper' : 'background.paper',
                  backgroundImage: isMax
                    ? 'radial-gradient(circle at 85% 10%, rgba(34,211,238,0.20), transparent 42%), radial-gradient(circle at 8% 88%, rgba(124,58,237,0.20), transparent 48%)'
                    : isValue
                      ? 'radial-gradient(circle at 90% 5%, rgba(124,58,237,0.16), transparent 42%), linear-gradient(145deg, rgba(25,118,210,0.13), transparent 68%)'
                      : 'none',
                  boxShadow: isValue ? 3 : highlighted && !isMax ? 4 : 0,
                  transition:
                    'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: isMax ? 8 : highlighted || isValue ? 6 : 3,
                    borderColor: isMax ? 'transparent' : 'primary.main',
                  },
                  '&.Mui-disabled': {
                    color: 'text.primary',
                    opacity: buying ? 0.8 : 0.56,
                  },
                }}
              >
                {pack.badge && (
                  <Chip
                    icon={<AutoAwesomeIcon />}
                    label={pack.badge}
                    color="primary"
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                    }}
                  />
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
                    color:
                      pack.id === DEFAULT_HOSTED_AI_CREDIT_PACK_ID
                        ? 'primary.contrastText'
                        : 'primary.main',
                    bgcolor:
                      pack.id === DEFAULT_HOSTED_AI_CREDIT_PACK_ID
                        ? 'primary.main'
                        : 'transparent',
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
