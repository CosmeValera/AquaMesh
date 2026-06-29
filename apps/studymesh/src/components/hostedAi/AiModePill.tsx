import React from 'react'
import { Box, Tooltip, Typography } from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

import { QuickCreateAiProvider } from '../../quickCreate/ai'
import { useInterfaceText } from '../../language/interfaceLanguage'
import { useHostedAiStatus } from './useHostedAiStatus'
import StudyCreditIcon from './StudyCreditIcon'

export const aiModeShortLabels: Record<QuickCreateAiProvider, string> = {
  local: 'AI: Local',
  gemini: 'AI: Gemini',
  cerebras: 'AI: Cerebras',
  hosted: 'AI',
}

interface AiModePillProps {
  compact?: boolean
  provider: QuickCreateAiProvider
  onClick: () => void
}

const AiModePill: React.FC<AiModePillProps> = ({
  compact,
  provider,
  onClick,
}) => {
  const { t } = useInterfaceText()
  const { status, displayStudyCredits, error } = useHostedAiStatus()
  const count = displayStudyCredits
  const hostedValue = count === null ? '--' : count
  const isHosted = provider === 'hosted'
  const hasNoCredits = isHosted && count === 0
  const tooltip = isHosted
    ? error && !status && count === null
      ? t('ai.studyCreditsUnavailable')
      : `${t('ai.studyCredits')}: ${hostedValue}`
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
          border: hasNoCredits
            ? '1px solid rgba(255,255,255,0.55)'
            : (theme) =>
                theme.palette.mode === 'light'
                  ? '1px solid rgba(0,137,123,0.28)'
                  : '1px solid rgba(255,255,255,0.28)',
          color: hasNoCredits ? '#fff' : 'foreground.contrastPrimary',
          bgcolor: hasNoCredits
            ? 'error.main'
            : (theme) =>
                theme.palette.mode === 'light'
                  ? 'rgba(0,137,123,0.08)'
                  : 'rgba(255,255,255,0.1)',
          boxShadow: hasNoCredits
            ? '0 0 0 2px rgba(211,47,47,0.25), inset 0 1px 0 rgba(255,255,255,0.2)'
            : (theme) =>
                theme.palette.mode === 'light'
                  ? 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 5px rgba(0,137,123,0.12)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.16)',
          justifyContent: 'center',
          flex: '0 0 auto',
          font: 'inherit',
          lineHeight: 1,
          outline: 0,
          cursor: 'pointer',
          transition:
            'background-color 140ms ease, border-color 140ms ease, transform 140ms ease',
          '&:hover': {
            bgcolor: hasNoCredits
              ? 'error.dark'
              : (theme) =>
                  theme.palette.mode === 'light'
                    ? 'rgba(0,137,123,0.13)'
                    : 'rgba(255,255,255,0.18)',
            borderColor: (theme) =>
              theme.palette.mode === 'light'
                ? 'rgba(0,137,123,0.38)'
                : 'rgba(255,255,255,0.4)',
          },
          '&:focus-visible': {
            boxShadow:
              '0 0 0 3px rgba(255,255,255,0.28), inset 0 1px 0 rgba(255,255,255,0.16)',
          },
        }}
      >
        {isHosted ? (
          <>
            {hasNoCredits && (
              <ErrorOutlineIcon sx={{ fontSize: 17, color: '#fff' }} />
            )}
            <Typography
              component="span"
              variant="body2"
              fontWeight={900}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                lineHeight: 1,
                color: hasNoCredits ? '#fff' : 'inherit',
              }}
            >
              {hostedValue}
            </Typography>
            {!hasNoCredits && <StudyCreditIcon size={compact ? 17 : 19} />}
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
