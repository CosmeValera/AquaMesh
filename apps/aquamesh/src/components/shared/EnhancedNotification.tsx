import React from 'react'
import {
  Snackbar,
  Alert as MuiAlert,
  AlertProps,
  Box,
  Typography,
  IconButton,
  Slide,
  SlideProps,
  useTheme,
  Grow,
  Fade
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'

type SlideDirection = 'up' | 'down' | 'left' | 'right'
type TransitionType = 'slide' | 'grow' | 'fade'
export type NotificationVariant = 'filled' | 'outlined' | 'standard' | 'elevated'
export type NotificationType = 'success' | 'error' | 'info' | 'warning'

interface EnhancedNotificationProps {
  /**
   * Whether the notification is open
   */
  open: boolean
  
  /**
   * The message to display
   */
  message: string
  
  /**
   * Optional title for the notification
   */
  title?: string
  
  /**
   * The type of notification
   */
  type?: NotificationType
  
  /**
   * The variant of the alert
   */
  variant?: NotificationVariant
  
  /**
   * Auto hide duration in milliseconds
   */
  autoHideDuration?: number
  
  /**
   * Position of the notification
   */
  position?: {
    vertical: 'top' | 'bottom'
    horizontal: 'left' | 'center' | 'right'
  }
  
  /**
   * Transition type
   */
  transition?: TransitionType
  
  /**
   * Direction for slide transition
   */
  slideDirection?: SlideDirection
  
  /**
   * Handler for closing the notification
   */
  onClose: () => void
  
  /**
   * Additional action component
   */
  action?: React.ReactNode
}

// Custom slide transition
function SlideTransition(props: SlideProps) {
  return <Slide {...props} />
}

// Enhanced notification component
const EnhancedNotification: React.FC<EnhancedNotificationProps> = ({
  open,
  message,
  title,
  type = 'info',
  variant = 'filled',
  autoHideDuration = 5000,
  position = { vertical: 'bottom', horizontal: 'right' },
  transition = 'slide',
  slideDirection = 'up',
  onClose,
  action
}) => {
  const theme = useTheme()
  
  // Get the appropriate transition component
  const getTransition = () => {
    switch (transition) {
      case 'slide':
        return { 
          children: (props: SlideProps) => (
            <SlideTransition {...props} direction={slideDirection} />
          )
        }
      case 'grow':
        return { children: Grow }
      case 'fade':
      default:
        return { children: Fade }
    }
  }
  
  // Get icon based on notification type
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircleOutlineIcon />
      case 'error':
        return <ErrorOutlineIcon />
      case 'warning':
        return <WarningAmberIcon />
      case 'info':
      default:
        return <InfoOutlinedIcon />
    }
  }
  
  // Calculate maximum width based on position
  const getMaxWidth = () => {
    return position.horizontal === 'center' ? 500 : 400
  }
  
  // Elevated variant styling for alerts
  const getElevatedStyles = () => {
    if (variant !== 'elevated') return {}
    
    // Base styles for elevated variant
    const baseStyles = {
      boxShadow: '0px 5px 15px rgba(0,0,0,0.2)',
      borderRadius: '8px',
      border: 'none',
      padding: '16px'
    }
    
    // Type-specific styles
    switch (type) {
      case 'success':
        return {
          ...baseStyles,
          backgroundColor: theme.palette.success.light,
          color: theme.palette.success.contrastText,
          borderLeft: `6px solid ${theme.palette.success.main}`
        }
      case 'error':
        return {
          ...baseStyles,
          backgroundColor: theme.palette.error.light,
          color: theme.palette.error.contrastText,
          borderLeft: `6px solid ${theme.palette.error.main}`
        }
      case 'warning':
        return {
          ...baseStyles,
          backgroundColor: theme.palette.warning.light,
          color: theme.palette.warning.contrastText,
          borderLeft: `6px solid ${theme.palette.warning.main}`
        }
      case 'info':
      default:
        return {
          ...baseStyles,
          backgroundColor: theme.palette.info.light,
          color: theme.palette.info.contrastText,
          borderLeft: `6px solid ${theme.palette.info.main}`
        }
    }
  }
  
  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={(_, reason) => {
        if (reason !== 'clickaway') {
          onClose()
        }
      }}
      anchorOrigin={position}
      TransitionComponent={getTransition().children}
      sx={{
        maxWidth: getMaxWidth()
      }}
    >
      {variant === 'elevated' ? (
        <Box
          sx={{
            ...getElevatedStyles(),
            minWidth: '300px',
            maxWidth: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
            <Box sx={{ mt: 0.5, mr: 1.5, color: type === 'warning' ? 'warning.dark' : `${type}.main` }}>
              {getIcon()}
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              {title && (
                <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 0.5 }}>
                  {title}
                </Typography>
              )}
              <Typography variant="body2">
                {message}
              </Typography>
            </Box>
            <IconButton
              size="small"
              aria-label="close"
              color="inherit"
              onClick={onClose}
              sx={{
                mt: -0.5,
                mr: -1,
                opacity: 0.7,
                '&:hover': {
                  opacity: 1
                }
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          {action && (
            <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
              {action}
            </Box>
          )}
        </Box>
      ) : (
        <MuiAlert
          elevation={6}
          variant={variant as AlertProps['variant']}
          onClose={onClose}
          severity={type}
          sx={{ 
            width: '100%',
            alignItems: 'center'
          }}
          action={
            action || (
              <IconButton
                size="small"
                aria-label="close"
                color="inherit"
                onClick={onClose}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            )
          }
        >
          {title && (
            <Typography variant="subtitle2" fontWeight="medium" sx={{ mb: 0.5 }}>
              {title}
            </Typography>
          )}
          {message}
        </MuiAlert>
      )}
    </Snackbar>
  )
}

export default EnhancedNotification 