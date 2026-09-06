import React from 'react'
import { Badge, Box, Tooltip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'

import { useInterfaceText } from '../../language/interfaceLanguage'

interface KnownTopicsPillProps {
  count: number
  compact?: boolean
  onClick: () => void
}

const KnownTopicsPill: React.FC<KnownTopicsPillProps> = ({
  count,
  compact,
  onClick,
}) => {
  const { t } = useInterfaceText()
  const label = t('knownTopics.buttonLabel')

  return (
    <Tooltip title={label}>
      <Badge
        color="primary"
        variant="dot"
        invisible={count > 0}
        sx={{
          flexShrink: 0,
          // Pin dot to the pill corner: circular overlap offset by width, so label length moved it
          '& .MuiBadge-badge': { top: 5, right: 5 },
        }}
      >
        <Box
          component="button"
          type="button"
          aria-label={label}
          onClick={onClick}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.65,
            height: compact ? 32 : 34,
            px: compact ? 0.75 : 1.2,
            borderRadius: 999,
            border: (theme) =>
              theme.palette.mode === 'light'
                ? `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
                : `1px solid ${alpha(theme.palette.primary.light, 0.4)}`,
            color: 'foreground.contrastPrimary',
            bgcolor: (theme) =>
              theme.palette.mode === 'light'
                ? alpha(theme.palette.primary.main, 0.09)
                : alpha(theme.palette.primary.light, 0.14),
            boxShadow: (theme) =>
              theme.palette.mode === 'light'
                ? 'inset 0 1px 0 rgba(255,255,255,0.7)'
                : 'inset 0 1px 0 rgba(255,255,255,0.1)',
            flex: '0 0 auto',
            font: 'inherit',
            lineHeight: 1,
            outline: 0,
            cursor: 'pointer',
            transition: 'background-color 140ms ease, border-color 140ms ease',
            '&:hover': {
              bgcolor: (theme) =>
                theme.palette.mode === 'light'
                  ? alpha(theme.palette.primary.main, 0.16)
                  : alpha(theme.palette.primary.light, 0.22),
            },
            '&:focus-visible': {
              boxShadow: (theme) =>
                `0 0 0 3px ${alpha(theme.palette.primary.main, 0.28)}`,
            },
          }}
        >
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 20,
              height: 20,
              px: 0.5,
              borderRadius: '50%',
              bgcolor: 'background.paper',
              color: 'primary.main',
              fontSize: '0.7rem',
              fontWeight: 900,
              flexShrink: 0,
            }}
          >
            {count}
          </Box>
          {!compact && (
            <Typography
              component="span"
              variant="body2"
              fontWeight={900}
              noWrap
              sx={{ lineHeight: 1, minWidth: 0 }}
            >
              {label}
            </Typography>
          )}
        </Box>
      </Badge>
    </Tooltip>
  )
}

export default KnownTopicsPill
