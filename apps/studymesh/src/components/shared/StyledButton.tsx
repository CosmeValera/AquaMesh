import React from 'react'
import { Button, ButtonProps } from '@mui/material'
import { alpha, darken, useTheme } from '@mui/material/styles'

// Extend ButtonProps with any additional props needed
interface StyledButtonProps extends ButtonProps {
  buttonType?: 'primary' | 'secondary' | 'danger' | 'success' | 'info'
}

// Create a custom button component using forwardRef pattern
const StyledButton = React.forwardRef<HTMLButtonElement, StyledButtonProps>(
  ({ buttonType = 'primary', variant = 'contained', sx, ...props }, ref) => {
    const theme = useTheme()
    const tonalAlpha = theme.palette.mode === 'dark' ? 0.18 : 0.1
    const secondaryBg =
      variant === 'contained'
        ? alpha(
            theme.palette.primary.main,
            theme.palette.mode === 'dark' ? 0.22 : 0.12,
          )
        : 'transparent'
    const secondaryHoverBg =
      variant === 'contained'
        ? alpha(
            theme.palette.primary.main,
            theme.palette.mode === 'dark' ? 0.3 : 0.18,
          )
        : theme.palette.action.hover

    // Base styles shared across all button types
    const baseStyles = {
      fontWeight: 'bold',
      transition: 'all 0.2s ease',
      borderRadius: '8px',
      boxShadow:
        variant === 'contained' ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none',
      textTransform: 'none' as const,
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow:
          variant === 'contained'
            ? '0 4px 12px rgba(0, 0, 0, 0.2)'
            : '0 2px 5px rgba(0, 0, 0, 0.1)',
      },
    }

    // Type-specific styles
    const typeStyles = {
      primary: {
        backgroundColor:
          variant === 'contained' ? 'primary.light' : 'transparent',
        color:
          variant === 'contained' ? 'primary.contrastText' : 'primary.main',
        borderColor: variant === 'outlined' ? 'primary.main' : 'transparent',
        '&:hover': {
          backgroundColor:
            variant === 'contained' ? 'primary.main' : 'action.hover',
        },
      },
      secondary: {
        backgroundColor: secondaryBg,
        color: variant === 'contained' ? 'text.primary' : 'text.secondary',
        borderColor: variant === 'outlined' ? 'divider' : 'transparent',
        '&:hover': {
          backgroundColor: secondaryHoverBg,
        },
      },
      danger: {
        backgroundColor: variant === 'contained' ? 'error.main' : 'transparent',
        color: variant === 'contained' ? 'error.contrastText' : 'error.main',
        borderColor: variant === 'outlined' ? 'error.main' : 'transparent',
        '&:hover': {
          backgroundColor:
            variant === 'contained'
              ? darken(theme.palette.error.main, 0.12)
              : alpha(theme.palette.error.main, tonalAlpha),
        },
      },
      success: {
        backgroundColor:
          variant === 'contained' ? 'success.main' : 'transparent',
        color:
          variant === 'contained' ? 'success.contrastText' : 'success.main',
        borderColor: variant === 'outlined' ? 'success.main' : 'transparent',
        '&:hover': {
          backgroundColor:
            variant === 'contained'
              ? darken(theme.palette.success.main, 0.12)
              : alpha(theme.palette.success.main, tonalAlpha),
        },
      },
      info: {
        backgroundColor: variant === 'contained' ? 'info.main' : 'transparent',
        color: variant === 'contained' ? 'info.contrastText' : 'info.main',
        borderColor: variant === 'outlined' ? 'info.main' : 'transparent',
        '&:hover': {
          backgroundColor:
            variant === 'contained'
              ? darken(theme.palette.info.main, 0.12)
              : alpha(theme.palette.info.main, tonalAlpha),
        },
      },
    }

    // Combine the styles with any user-provided sx prop
    const combinedSx = {
      ...baseStyles,
      ...typeStyles[buttonType],
      ...sx,
    }

    return <Button ref={ref} variant={variant} sx={combinedSx} {...props} />
  },
)

// Set display name for debugging
StyledButton.displayName = 'StyledButton'

export default StyledButton
