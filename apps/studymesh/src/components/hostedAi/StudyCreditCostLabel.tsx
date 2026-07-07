import React from 'react'
import { Box, Stack } from '@mui/material'
import { alpha } from '@mui/material/styles'

import StudyCreditIcon from './StudyCreditIcon'

interface StudyCreditCostLabelProps {
  amount: number
  iconSize?: number
  variant?: 'inline' | 'badge' | 'contained' | 'tooltip'
}

const StudyCreditCostLabel: React.FC<StudyCreditCostLabelProps> = ({
  amount,
  iconSize,
  variant = 'inline',
}) => (
  <Stack
    component="span"
    direction="row"
    alignItems="center"
    sx={(theme) => {
      const isBadge = variant === 'badge'
      const isContained = variant === 'contained'
      const isTooltip = variant === 'tooltip'
      return {
        display: 'inline-flex',
        gap: isTooltip ? 0.45 : 0.35,
        lineHeight: 1,
        fontWeight: 950,
        whiteSpace: 'nowrap',
        ...(isBadge
          ? {
              minHeight: 22,
              px: 0.75,
              py: 0.25,
              borderRadius: 999,
              border: 1,
              borderColor:
                theme.palette.mode === 'dark'
                  ? alpha('#38bdf8', 0.24)
                  : alpha('#0ea5e9', 0.18),
              bgcolor:
                theme.palette.mode === 'dark'
                  ? alpha('#0ea5e9', 0.14)
                  : alpha('#e0f2fe', 0.9),
              color:
                theme.palette.mode === 'dark' ? '#38bdf8' : '#0369a1',
              boxShadow:
                theme.palette.mode === 'dark'
                  ? `inset 0 1px 0 ${alpha('#ffffff', 0.05)}, 0 8px 18px ${alpha('#020617', 0.16)}`
                  : `inset 0 1px 0 ${alpha('#ffffff', 0.9)}, 0 4px 12px ${alpha('#0ea5e9', 0.16)}`,
              fontSize: 12,
            }
          : {}),
        ...(isContained
          ? {
              minHeight: 24,
              px: 0.85,
              py: 0.25,
              borderRadius: 999,
              border: 1,
              borderColor: 'rgba(255,255,255,0.34)',
              bgcolor: 'rgba(255,255,255,0.2)',
              color: 'inherit',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)',
              fontSize: 12,
            }
          : {}),
        ...(isTooltip
          ? {
              color: 'inherit',
              fontSize: 13,
            }
          : {}),
      }
    }}
  >
    <Box component="span">{amount}</Box>
    <StudyCreditIcon
      size={
        iconSize ??
        (variant === 'contained' ? 15 : variant === 'tooltip' ? 14 : 13)
      }
    />
  </Stack>
)

export default StudyCreditCostLabel
