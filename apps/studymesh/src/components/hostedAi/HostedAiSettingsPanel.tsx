import React from 'react'
import { Alert, Box, Chip, Stack, Typography } from '@mui/material'
import TollIcon from '@mui/icons-material/Toll'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

import { STUDY_CREDITS_LABEL } from '../../studyPack/ai'
import HostedAiPricingCards from './HostedAiPricingCards'
import { useHostedAiStatus } from './useHostedAiStatus'

const HostedAiSettingsPanel: React.FC = () => {
  const { status, loading, error } = useHostedAiStatus()

  if (!status && loading) {
    return (
      <Alert severity="info" sx={{ mb: 1.5 }}>
        Loading {STUDY_CREDITS_LABEL}...
      </Alert>
    )
  }

  if (!status) {
    return (
      <Alert severity="warning" sx={{ mb: 1.5 }}>
        {error || `${STUDY_CREDITS_LABEL} unavailable.`}
      </Alert>
    )
  }

  return (
    <Box
      sx={{
        mb: 1.5,
        p: 2,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={900} color="text.primary">
            {STUDY_CREDITS_LABEL}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Hosted AI uses app credits. Images still use OCR or image-capable
            providers before text generation.
          </Typography>
        </Box>
        <Chip
          icon={status.studyCredits === 0 ? <ErrorOutlineIcon /> : <TollIcon />}
          color={
            status.studyCredits === 0
              ? 'error'
              : status.available
                ? 'primary'
                : 'default'
          }
          label={`${status.studyCredits} credits`}
          sx={{
            fontWeight: 900,
            ...(status.studyCredits === 0 && {
              boxShadow: '0 0 0 3px rgba(211,47,47,0.14)',
            }),
          }}
        />
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        sx={{ mt: 1.5 }}
      >
        <Chip
          size="small"
          label={`Study Guide: ${status.costs['study-guide']}`}
        />
        <Chip
          size="small"
          label={`Quick Create: ${status.costs['quick-create']}`}
        />
        <Chip size="small" label={`Chat: ${status.costs.chat}`} />
        <Chip
          size="small"
          label={`Daily refill to ${status.dailyFreeCredits}`}
        />
      </Stack>
      {status.message && (
        <Alert
          severity={status.available ? 'info' : 'warning'}
          sx={{ mt: 1.5 }}
        >
          {status.message}
        </Alert>
      )}
      <HostedAiPricingCards />
    </Box>
  )
}

export default HostedAiSettingsPanel
