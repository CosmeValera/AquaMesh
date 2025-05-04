import React, { createContext, useContext, useState } from 'react'
import { SnackbarOrigin } from '@mui/material'
import EnhancedNotification, { 
  NotificationType, 
  NotificationVariant 
} from './EnhancedNotification'

interface NotificationContextProps {
  /**
   * Show a notification with the given message and options
   */
  showNotification: (options: NotificationOptions) => void

  /**
   * Close the notification
   */
  closeNotification: () => void
}

export interface NotificationOptions {
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
  position?: SnackbarOrigin
  
  /**
   * Transition type
   */
  transition?: 'slide' | 'grow' | 'fade'
  
  /**
   * Direction for slide transition
   */
  slideDirection?: 'up' | 'down' | 'left' | 'right'
  
  /**
   * Additional action component
   */
  action?: React.ReactNode
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined)

export const useNotification = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}

export const NotificationProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  // Notification state
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<NotificationOptions>({
    message: '',
    type: 'info',
    variant: 'filled',
    autoHideDuration: 5000,
    position: { vertical: 'bottom', horizontal: 'center' },
    transition: 'slide',
    slideDirection: 'up'
  })

  /**
   * Show a notification with the given options
   */
  const showNotification = (newOptions: NotificationOptions) => {
    setOptions({
      ...options,
      ...newOptions
    })
    setOpen(true)
  }

  /**
   * Close the notification
   */
  const closeNotification = () => {
    setOpen(false)
  }

  return (
    <NotificationContext.Provider value={{ showNotification, closeNotification }}>
      {children}
      <EnhancedNotification
        open={open}
        message={options.message}
        title={options.title}
        type={options.type}
        variant={options.variant}
        autoHideDuration={options.autoHideDuration}
        position={options.position}
        transition={options.transition}
        slideDirection={options.slideDirection}
        onClose={closeNotification}
        action={options.action}
      />
    </NotificationContext.Provider>
  )
}

export default NotificationProvider 