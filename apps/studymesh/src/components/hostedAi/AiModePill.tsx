import React from 'react'
import { Box, Tooltip, Typography } from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'

import {
  STUDY_CREDITS_LABEL,
  STUDY_CREDITS_SYMBOL,
  StudyPackAiProvider,
} from '../../studyPack/ai'
import { useHostedAiStatus } from './useHostedAiStatus'

export const aiModeShortLabels: Record<StudyPackAiProvider, string> = {
  local: 'AI: Local',
  gemini: 'AI: Gemini',
  cerebras: 'AI: Cerebras',
  hosted: 'AI',
}

interface AiModePillProps {
  compact?: boolean
  provider: StudyPackAiProvider
  onClick: () => void
}

const AiModePill: React.FC<AiModePillProps> = ({
  compact,
  provider,
  onClick,
}) => {
  const { status, loading, error } = useHostedAiStatus()
  const count = status?.accountReady ? status.studyCredits : null
  const hostedValue = loading || count === null ? '--' : count
  const isHosted = provider === 'hosted'
  const tooltip = isHosted
    ? error && !status
      ? `${STUDY_CREDITS_LABEL} unavailable`
      : `${STUDY_CREDITS_LABEL}: ${hostedValue}`
    : aiModeShortLabels[provider]

  return (
    <Tooltip title={tooltip}>
      <Box
        component="button"
        type="button"
        aria-label="Open AI mode selector"
        onClick={onClick}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.65,
          height: compact ? 32 : 34,
          minWidth: isHosted ? (compact ? 52 : 60) : compact ? 72 : 96,
          maxWidth: compact && !isHosted ? 88 : 128,
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
          cursor: 'pointer',
          transition:
            'background-color 140ms ease, border-color 140ms ease, transform 140ms ease',
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.18)',
            borderColor: 'rgba(255,255,255,0.4)',
          },
          '&:focus-visible': {
            boxShadow:
              '0 0 0 3px rgba(255,255,255,0.28), inset 0 1px 0 rgba(255,255,255,0.16)',
          },
        }}
      >
        {isHosted ? (
          <>
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
              {hostedValue}
            </Typography>
          </>
        ) : (
          <>
            <AutoAwesomeIcon sx={{ fontSize: 16 }} />
            <Typography
              component="span"
              variant="body2"
              fontWeight={900}
              noWrap
              sx={{ lineHeight: 1, minWidth: 0 }}
            >
              {aiModeShortLabels[provider]}
            </Typography>
          </>
        )}
      </Box>
    </Tooltip>
  )
}

export default AiModePill
