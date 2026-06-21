import React from 'react'
import { Box } from '@mui/material'

interface StudyCreditIconProps {
  size?: number
}

const StudyCreditIcon: React.FC<StudyCreditIconProps> = ({ size = 20 }) => (
  <Box
    component="img"
    src="/images/study-credits/study-credit.png"
    alt=""
    aria-hidden="true"
    sx={{
      width: size,
      height: size,
      display: 'block',
      objectFit: 'contain',
      flex: '0 0 auto',
      filter: (theme) =>
        theme.palette.mode === 'dark'
          ? 'drop-shadow(0 0 1px rgba(255,255,255,0.9)) drop-shadow(0 0 2px rgba(255,255,255,0.35))'
          : 'drop-shadow(0 0 1px rgba(0,95,88,0.95)) drop-shadow(0 0 2px rgba(0,95,88,0.28))',
    }}
  />
)

export default StudyCreditIcon
