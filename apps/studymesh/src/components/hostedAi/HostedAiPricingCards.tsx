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
                overflow: 'visible',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                textAlign: 'left',
                font: 'inherit',
                minHeight: 190,
                p: 2,
                pt: pack.badge ? 2.75 : 2,
                borderRadius: 3,
                borderWidth: highlighted ? 2 : 1,
                borderColor: highlighted ? 'primary.main' : 'divider',
                bgcolor: highlighted ? 'primary.50' : 'background.paper',
                boxShadow: highlighted ? 4 : 0,
                transition:
                  'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: highlighted ? 6 : 3,
                  borderColor: 'primary.main',
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
                    top: 0,
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
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
          )
        })}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  )
}

export default HostedAiPricingCards
