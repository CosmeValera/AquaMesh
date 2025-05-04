import React from 'react'
import {
  Button,
  ButtonProps,
  Tooltip,
  CircularProgress,
  Box,
  useTheme
} from '@mui/material'

export interface AccessibleButtonProps extends Omit<ButtonProps, 'color'> {
  /**
   * Text for the button
   */
  label: string
  
  /**
   * Optional description for screen readers (if different from label)
   */
  ariaLabel?: string
  
  /**
   * Show loading state
   */
  loading?: boolean
  
  /**
   * Loading text for screen readers
   */
  loadingText?: string
  
  /**
   * Icon to show before the text
   */
  startIcon?: React.ReactNode
  
  /**
   * Icon to show after the text
   */
  endIcon?: React.ReactNode
  
  /**
   * Whether the button is disabled
   */
  disabled?: boolean
  
  /**
   * Tooltip text
   */
  tooltip?: React.ReactNode
  
  /**
   * Custom color for the button
   * Supports MUI palette colors and hex/rgb values
   */
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | string
  
  /**
   * Use elevated styling
   */
  elevated?: boolean
  
  /**
   * Add hover animation effect
   */
  animateHover?: boolean
  
  /**
   * Button size
   */
  size?: 'small' | 'medium' | 'large'
  
  /**
   * Button variant
   */
  variant?: 'text' | 'outlined' | 'contained'
  
  /**
   * Button type
   */
  type?: 'button' | 'submit' | 'reset'
  
  /**
   * OnClick handler
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  
  /**
   * Additional CSS properties
   */
  sx?: object
}

/**
 * Enhanced accessible button with loading state, tooltips, and animations
 */
const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  label,
  ariaLabel,
  loading = false,
  loadingText = 'Loading, please wait',
  startIcon,
  endIcon,
  disabled = false,
  tooltip,
  color = 'primary',
  elevated = false,
  animateHover = false,
  size = 'medium',
  variant = 'contained',
  type = 'button',
  onClick,
  sx,
  ...rest
}) => {
  const theme = useTheme()
  
  // Determine whether the color is from the palette or custom
  const isCustomColor = !['primary', 'secondary', 'error', 'warning', 'info', 'success'].includes(color)
  
  // Get styles for different states
  const getButtonStyles = () => {
    const baseStyles = {
      position: 'relative',
      boxShadow: elevated ? 3 : 0,
      transition: 'all 0.2s ease-in-out',
      ...(isCustomColor && variant === 'contained' && {
        bgcolor: color,
        color: theme.palette.getContrastText(color),
        '&:hover': {
          bgcolor: color,
          opacity: 0.9,
        },
      }),
      ...(isCustomColor && variant === 'outlined' && {
        borderColor: color,
        color: color,
        '&:hover': {
          borderColor: color,
          bgcolor: `${color}10`, // 10% opacity
        },
      }),
      ...(isCustomColor && variant === 'text' && {
        color: color,
        '&:hover': {
          bgcolor: `${color}10`, // 10% opacity
        },
      }),
      ...(animateHover && {
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: elevated ? 5 : 2,
        },
        '&:active': {
          transform: 'translateY(0)',
          boxShadow: elevated ? 3 : 0,
        },
      }),
    }
    
    // Adjust size styles
    const sizeStyles = {
      ...(size === 'large' && {
        padding: theme.spacing(1, 3),
        fontSize: '1rem',
      }),
      ...(size === 'small' && {
        padding: theme.spacing(0.5, 1.5),
        fontSize: '0.8125rem',
      }),
    }
    
    return { ...baseStyles, ...sizeStyles, ...sx }
  }
  
  // Button with loading state or regular button
  const buttonContent = (
    <Button
      variant={variant}
      color={isCustomColor ? undefined : (color as 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success')}
      disabled={disabled || loading}
      startIcon={!loading && startIcon}
      endIcon={!loading && endIcon}
      onClick={onClick}
      type={type}
      aria-label={ariaLabel || label}
      aria-busy={loading}
      sx={getButtonStyles()}
      {...rest}
    >
      {loading ? (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          '& > span': { 
            position: 'absolute', 
            width: '1px', 
            height: '1px', 
            padding: 0, 
            margin: '-1px', 
            overflow: 'hidden', 
            clip: 'rect(0, 0, 0, 0)', 
            whiteSpace: 'nowrap', 
            border: 0 
          }
        }}>
          <CircularProgress 
            size={size === 'small' ? 16 : size === 'large' ? 24 : 20} 
            color="inherit" 
            sx={{ mr: 1 }} 
          />
          <span>{loadingText}</span>
          {label}
        </Box>
      ) : (
        label
      )}
    </Button>
  )
  
  // Wrap with tooltip if provided
  if (tooltip) {
    return (
      <Tooltip 
        title={tooltip} 
        arrow 
        placement="top"
        disableHoverListener={disabled || loading}
      >
        {buttonContent}
      </Tooltip>
    )
  }
  
  return buttonContent
}

export default AccessibleButton 