import React, { createContext, useContext, useState } from 'react'
import { Snackbar, Alert, SnackbarOrigin } from '@mui/material'

export type NotificationSeverity = 'success' | 'info' | 'warning' | 'error'

interface NotificationContextProps {
  showNotification: (message: string, severity?: NotificationSeverity, position?: SnackbarOrigin) => void
  closeNotification: () => void
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
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<NotificationSeverity>('info')
  const [position, setPosition] = useState<SnackbarOrigin>({
    vertical: 'bottom',
    horizontal: 'center'
  })

  const showNotification = (
    msg: string, 
    sev: NotificationSeverity = 'info',
    pos: SnackbarOrigin = { vertical: 'bottom', horizontal: 'center' }
  ) => {
    setMessage(msg)
    setSeverity(sev)
    setPosition(pos)
    setOpen(true)
  }

  const closeNotification = () => {
    setOpen(false)
  }

  return (
    <NotificationContext.Provider value={{ showNotification, closeNotification }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={closeNotification}
        anchorOrigin={position}
      >
        <Alert 
          onClose={closeNotification} 
          severity={severity}
          variant="filled"
          elevation={6}
          sx={{ 
            width: '100%',
            '& .MuiAlert-icon': {
              fontSize: '1.25rem'
            }
          }}
        >
          {message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  )
}

export default NotificationProvider 