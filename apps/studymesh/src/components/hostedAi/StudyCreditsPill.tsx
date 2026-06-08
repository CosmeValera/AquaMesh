import React from 'react'
import { Box, Tooltip, Typography } from '@mui/material'

import { STUDY_CREDITS_LABEL, STUDY_CREDITS_SYMBOL } from '../../studyPack/ai'
import { useHostedAiStatus } from './useHostedAiStatus'

interface StudyCreditsPillProps {
  compact?: boolean
}

const StudyCreditsPill: React.FC<StudyCreditsPillProps> = ({ compact }) => {
  const { status, loading, error } = useHostedAiStatus()
  const count = status?.accountReady ? status.studyCredits : null
  const label =
    error && !status ? `${STUDY_CREDITS_LABEL} unavailable` : STUDY_CREDITS_LABEL
  const displayValue = loading || count === null ? '--' : count

  return (
    <Tooltip title={label}>
      <Box
        component="span"
        aria-label={STUDY_CREDITS_LABEL}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.65,
          height: compact ? 32 : 34,
          minWidth: compact ? 52 : 60,
          px: compact ? 1 : 1.2,
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.28)',
          color: 'foreground.contrastPrimary',
          bgcolor: 'rgba(255,255,255,0.1)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)',
          justifyContent: 'center',
          flex: '0 0 auto',
        }}
      >
        <Typography
          component="span"
          variant="caption"
          fontWeight={900}
          sx={{ lineHeight: 1, letterSpacing: 0 }}
        >
          {STUDY_CREDITS_SYMBOL}
        </Typography>
        <Typography
          component="span"
          variant="body2"
          fontWeight={900}
          sx={{ lineHeight: 1 }}
        >
          {displayValue}
        </Typography>
      </Box>
    </Tooltip>
  )
}

export default StudyCreditsPill
