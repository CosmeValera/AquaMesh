import React from 'react'
import { Alert, Button, Stack } from '@mui/material'

import {
  DEFAULT_HOSTED_AI_CREDIT_PACK_ID,
  HOSTED_AI_CREDIT_PACKS,
  HostedAiCreditPackId,
  readStudyPackAiSettings,
  redirectToHostedAiCreditCheckout,
  saveStudyPackAiSettings,
} from '../../studyPack/ai'

interface HostedAiCreditActionsProps {
  compact?: boolean
  message?: string
  onUseOwnApiKey?: () => void
}

const HostedAiCreditActions: React.FC<HostedAiCreditActionsProps> = ({
  compact = false,
  message,
  onUseOwnApiKey,
}) => {
  const [buying, setBuying] = React.useState(false)
  const [buyingPackId, setBuyingPackId] =
    React.useState<HostedAiCreditPackId | null>(null)
  const [error, setError] = React.useState('')

  const visiblePacks = compact
    ? HOSTED_AI_CREDIT_PACKS.filter(
        (pack) => pack.id === DEFAULT_HOSTED_AI_CREDIT_PACK_ID,
      )
    : HOSTED_AI_CREDIT_PACKS

  const handleBuyCredits = async (packId: HostedAiCreditPackId) => {
    setBuying(true)
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
      setBuying(false)
      setBuyingPackId(null)
    }
  }

  const handleUseOwnApiKey = () => {
    const current = readStudyPackAiSettings()
    saveStudyPackAiSettings({
      ...current,
      provider: 'gemini',
    })
    window.dispatchEvent(new Event('storage'))
    onUseOwnApiKey?.()
  }

  return (
    <Stack spacing={1} sx={compact ? undefined : { mt: 1.5 }}>
      {message && <Alert severity="warning">{message}</Alert>}
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {visiblePacks.map((pack) => (
          <Button
            key={pack.id}
            variant={
              pack.id === DEFAULT_HOSTED_AI_CREDIT_PACK_ID
                ? 'contained'
                : 'outlined'
            }
            size="small"
            onClick={() => handleBuyCredits(pack.id)}
            disabled={buying}
          >
            {buying && buyingPackId === pack.id
              ? 'Opening checkout...'
              : `Buy ${pack.credits} credits for ${pack.label}${
                  pack.badge ? ` - ${pack.badge}` : ''
                }`}
          </Button>
        ))}
        <Button variant="outlined" size="small" onClick={handleUseOwnApiKey}>
          Use own API key
        </Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  )
}

export default HostedAiCreditActions
