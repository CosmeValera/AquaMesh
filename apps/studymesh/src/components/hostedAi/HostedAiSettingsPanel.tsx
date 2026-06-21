import React from 'react'
import { Alert, Box, Chip, Stack, Typography } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

import { STUDY_CREDITS_LABEL } from '../../quickCreate/ai'
import HostedAiPricingCards from './HostedAiPricingCards'
import StudyCreditIcon from './StudyCreditIcon'
import { useHostedAiStatus } from './useHostedAiStatus'

const CreditLabel = ({
  children,
  iconSize = 16,
}: {
  children: React.ReactNode
  iconSize?: number
}) => (
  <Stack direction="row" spacing={0.65} alignItems="center" component="span">
    <Box component="span">{children}</Box>
    <StudyCreditIcon size={iconSize} />
  </Stack>
)

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
            Hosted AI uses app credits for Study Guides and Quick Create.
          </Typography>
        </Box>
        <Chip
          icon={status.studyCredits === 0 ? <ErrorOutlineIcon /> : undefined}
          color={
            status.studyCredits === 0
              ? 'error'
              : status.available
              ? 'primary'
              : 'default'
          }
          label={
            status.studyCredits === 0 ? (
              `${status.studyCredits} credits`
            ) : (
              <CreditLabel iconSize={18}>{status.studyCredits}</CreditLabel>
            )
          }
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
          label={
            <CreditLabel>
              Study Guide: {status.costs['study-guide']}
            </CreditLabel>
          }
        />
        <Chip
          size="small"
          label={
            <CreditLabel>
              Quick Create: {status.costs['quick-create']}
            </CreditLabel>
          }
        />
        <Chip
          size="small"
          label={<CreditLabel>Chat: {status.costs.chat}</CreditLabel>}
        />
        <Chip
          size="small"
          label={
            <CreditLabel>Daily refill to {status.dailyFreeCredits}</CreditLabel>
          }
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
