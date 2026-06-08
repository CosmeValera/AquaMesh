import React from 'react'
import { Box, Tooltip, Typography } from '@mui/material'

import { STUDY_CREDITS_LABEL, STUDY_CREDITS_SYMBOL } from '../../studyPack/ai'
import { useHostedAiStatus } from './useHostedAiStatus'

interface StudyCreditsPillProps {
  compact?: boolean
  onClick?: () => void
}

const StudyCreditsPill: React.FC<StudyCreditsPillProps> = ({
  compact,
  onClick,
}) => {
  const { status, loading, error } = useHostedAiStatus()
  const count = status?.accountReady ? status.studyCredits : null
  const label =
    error && !status ? `${STUDY_CREDITS_LABEL} unavailable` : STUDY_CREDITS_LABEL
  const displayValue = loading || count === null ? '--' : count
  const isClickable = Boolean(onClick)

  return (
    <Tooltip title={label}>
      <Box
        component={isClickable ? 'button' : 'span'}
        type={isClickable ? 'button' : undefined}
        aria-label={
          isClickable ? `Open ${STUDY_CREDITS_LABEL}` : STUDY_CREDITS_LABEL
        }
        onClick={onClick}
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
          font: 'inherit',
          outline: 0,
          cursor: isClickable ? 'pointer' : 'default',
          transition:
            'background-color 140ms ease, border-color 140ms ease, transform 140ms ease',
          '&:hover': isClickable
            ? {
                bgcolor: 'rgba(255,255,255,0.18)',
                borderColor: 'rgba(255,255,255,0.4)',
              }
            : undefined,
          '&:focus-visible': isClickable
            ? {
                boxShadow:
                  '0 0 0 3px rgba(255,255,255,0.28), inset 0 1px 0 rgba(255,255,255,0.16)',
              }
            : undefined,
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
