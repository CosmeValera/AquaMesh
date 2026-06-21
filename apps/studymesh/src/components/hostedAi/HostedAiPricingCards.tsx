import React from 'react'
import {
  Alert,
  Box,
  ButtonBase,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import StarIcon from '@mui/icons-material/Star'

import {
  HOSTED_AI_CREDIT_PACKS,
  HostedAiCreditPack,
  HostedAiCreditPackId,
  redirectToHostedAiCreditCheckout,
} from '../../quickCreate/ai'
import StudyCreditIcon from './StudyCreditIcon'

const packBadgeLabel = (pack: HostedAiCreditPack): string => {
  if (pack.id === 'starter') {
    return 'Starter'
  }

  if (pack.id === 'popular') {
    return 'Popular'
  }

  return 'Best value'
}

const packValueLabel = (pack: HostedAiCreditPack): string =>
  `${Math.round(pack.credits / (pack.priceCents / 100))} credits / EUR`

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
    <Stack spacing={1.5} sx={{ mt: 2.5 }}>
      <Box>
        <Typography variant="h6" fontWeight={950}>
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
          const highlighted = pack.id !== 'starter'
          const buying = buyingPackId === pack.id

          return (
            <Paper
              key={pack.id}
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
                minHeight: 198,
                p: 2,
                borderRadius: 2.5,
                borderWidth: highlighted ? 2 : 1,
                borderColor: highlighted ? '#008575' : 'divider',
                bgcolor: 'background.paper',
                boxShadow: highlighted ? '0 10px 24px rgba(0,137,123,0.10)' : 0,
                transition:
                  'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  boxShadow: '0 16px 34px rgba(0,137,123,0.16)',
                  borderColor: '#008575',
                },
                '&.Mui-disabled': {
                  color: 'text.primary',
                  opacity: buying ? 0.8 : 0.56,
                },
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                sx={{ mb: 1.25 }}
              >
                <Chip
                  label={packBadgeLabel(pack)}
                  size="small"
                  sx={{
                    height: 26,
                    fontWeight: 950,
                    color: '#fff',
                    bgcolor: '#008575',
                    '& .MuiChip-label': { px: 1.2 },
                  }}
                />
                {pack.badge ? (
                  <Stack direction="row" spacing={0.65} alignItems="center">
                    <StarIcon sx={{ fontSize: 17, color: '#008575' }} />
                    <Typography
                      variant="body2"
                      fontWeight={900}
                      sx={{ color: '#008575' }}
                    >
                      {pack.badge}
                    </Typography>
                  </Stack>
                ) : null}
              </Stack>

              <Stack direction="row" spacing={0.85} alignItems="center">
                <Typography variant="h4" fontWeight={950} lineHeight={1.05}>
                  {pack.credits}
                </Typography>
                <StudyCreditIcon size={27} />
                <Typography
                  variant="subtitle2"
                  fontWeight={950}
                  sx={{ color: '#008575' }}
                >
                  Study Credits
                </Typography>
              </Stack>

              <Divider sx={{ my: 1.4 }} />

              <Stack
                direction="row"
                alignItems="baseline"
                justifyContent="space-between"
                gap={1}
              >
                <Typography variant="h5" fontWeight={950}>
                  {pack.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {packValueLabel(pack)}
                </Typography>
              </Stack>

              <Box
                sx={{
                  mt: 2,
                  py: 0.9,
                  px: 1.5,
                  borderRadius: 1.5,
                  textAlign: 'center',
                  fontWeight: 950,
                  color: '#008575',
                  bgcolor: 'transparent',
                  border: '1px solid',
                  borderColor: '#008575',
                }}
              >
                {buying ? 'Opening checkout...' : `Buy ${pack.credits} credits`}
              </Box>
            </Paper>
          )
        })}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  )
}

export default HostedAiPricingCards
