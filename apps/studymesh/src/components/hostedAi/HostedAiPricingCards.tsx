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

import {
  HOSTED_AI_CREDIT_PACKS,
  HostedAiCreditPack,
  HostedAiCreditPackId,
  redirectToHostedAiCreditCheckout,
} from '../../quickCreate/ai'
import { useInterfaceText } from '../../language/interfaceLanguage'
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

const packValueLabel = (
  pack: HostedAiCreditPack,
  creditLabel: string,
): string =>
  `${Math.round(pack.credits / (pack.priceCents / 100))} ${creditLabel} / EUR`

const HostedAiPricingCards: React.FC = () => {
  const { t } = useInterfaceText()
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
          {t('ai.chooseCreditPack')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('ai.creditPackHelp')}
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
          const isPremium = pack.id === 'value'
          const buying = buyingPackId === pack.id

          return (
            <Box
              key={pack.id}
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
                component={ButtonBase}
                variant="outlined"
                type="button"
                onClick={() => void handleBuyCredits(pack.id)}
                disabled={buyingPackId !== null}
                aria-label={`${t('ai.buyCreditsFor')} ${pack.label}`}
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
                    borderColor: isPremium ? 'transparent' : '#008575',
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
                      bgcolor: isPremium ? '#ec4899' : '#008575',
                      ...(isPremium && {
                        background:
                          'linear-gradient(115deg, #f97316, #ec4899, #8b5cf6)',
                        boxShadow: '0 6px 14px rgba(236,72,153,0.28)',
                      }),
                      '& .MuiChip-label': { px: 1.2 },
                    }}
                  />
                </Stack>

                <Stack direction="row" spacing={0.85} alignItems="center">
                  <Typography variant="h4" fontWeight={950} lineHeight={1.05}>
                    {pack.credits}
                  </Typography>
                  <StudyCreditIcon size={27} />
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
                    {packValueLabel(pack, t('ai.credits'))}
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
                  {buying
                    ? t('ai.openingCheckout')
                    : `${t('ai.buyCredits')} (${pack.credits})`}
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
