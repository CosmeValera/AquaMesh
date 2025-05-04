import React from 'react'
import { Snackbar, Alert, Box } from '@mui/material'
import { Notification } from '../../types/types'

interface NotificationSystemProps {
  notification: Notification
  componentToast: {
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info' | 'warning'
  }
  handleCloseNotification: () => void
  handleCloseComponentToast: () => void
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notification,
  componentToast,
  handleCloseNotification,
  handleCloseComponentToast
}) => {
  return (
    <Box>
      {/* Main notification for editor actions */}
      <Snackbar
        open={notification.open}
        autoHideDuration={5000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ mt: 6 }}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
      
      {/* Component toast for preview actions */}
      <Snackbar
        open={componentToast.open}
        autoHideDuration={3000}
        onClose={handleCloseComponentToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={handleCloseComponentToast} 
          severity={componentToast.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {componentToast.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default NotificationSystem 