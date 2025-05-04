import React from 'react'
import { Button, ButtonProps } from '@mui/material'

// Extend ButtonProps with any additional props needed
interface StyledButtonProps extends ButtonProps {
  buttonType?: 'primary' | 'secondary' | 'danger' | 'success' | 'info'
}

// Create a custom button component using forwardRef pattern
const StyledButton = React.forwardRef<HTMLButtonElement, StyledButtonProps>(
  ({ buttonType = 'primary', variant = 'contained', sx, ...props }, ref) => {
    // Base styles shared across all button types
    const baseStyles = {
      fontWeight: 'bold',
      transition: 'all 0.2s ease',
      borderRadius: '8px',
      boxShadow: variant === 'contained' ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none',
      textTransform: 'none' as const,
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: variant === 'contained' ? '0 4px 12px rgba(0, 0, 0, 0.2)' : '0 2px 5px rgba(0, 0, 0, 0.1)',
      },
    }

    // Type-specific styles
    const typeStyles = {
      primary: {
        backgroundColor: variant === 'contained' ? '#00D1AB' : 'transparent',
        color: variant === 'contained' ? '#191919' : '#00BC9A',
        borderColor: variant === 'outlined' ? '#00BC9A' : 'transparent',
        '&:hover': {
          backgroundColor: variant === 'contained' ? '#00E4BC' : 'rgba(0, 188, 162, 0.08)',
        },
      },
      secondary: {
        backgroundColor: variant === 'contained' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
        color: variant === 'contained' ? 'white' : 'rgba(255, 255, 255, 0.8)',
        borderColor: variant === 'outlined' ? 'rgba(255, 255, 255, 0.3)' : 'transparent',
        '&:hover': {
          backgroundColor: variant === 'contained' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
        },
      },
      danger: {
        backgroundColor: variant === 'contained' ? '#d32f2f' : 'transparent',
        color: variant === 'contained' ? 'white' : '#d32f2f',
        borderColor: variant === 'outlined' ? '#d32f2f' : 'transparent',
        '&:hover': {
          backgroundColor: variant === 'contained' ? '#b71c1c' : 'rgba(211, 47, 47, 0.08)',
        },
      },
      success: {
        backgroundColor: variant === 'contained' ? '#2e7d32' : 'transparent',
        color: variant === 'contained' ? 'white' : '#2e7d32',
        borderColor: variant === 'outlined' ? '#2e7d32' : 'transparent',
        '&:hover': {
          backgroundColor: variant === 'contained' ? '#1b5e20' : 'rgba(46, 125, 50, 0.08)',
        },
      },
      info: {
        backgroundColor: variant === 'contained' ? '#0288d1' : 'transparent',
        color: variant === 'contained' ? 'white' : '#0288d1',
        borderColor: variant === 'outlined' ? '#0288d1' : 'transparent',
        '&:hover': {
          backgroundColor: variant === 'contained' ? '#01579b' : 'rgba(2, 136, 209, 0.08)',
        },
      },
    }

    // Combine the styles with any user-provided sx prop
    const combinedSx = {
      ...baseStyles,
      ...typeStyles[buttonType],
      ...sx
    }

    return <Button ref={ref} variant={variant} sx={combinedSx} {...props} />
  }
)

// Set display name for debugging
StyledButton.displayName = 'StyledButton'

export default StyledButton 