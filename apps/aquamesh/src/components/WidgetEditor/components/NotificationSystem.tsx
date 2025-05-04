import React from 'react'
import { Snackbar, Alert } from '@mui/material'
import { NotificationSeverity } from '../types/types'

interface EditorNotification {
  open: boolean;
  message: string;
  severity: NotificationSeverity;
}

interface ComponentToast {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

interface NotificationSystemProps {
  notification: EditorNotification;
  componentToast: ComponentToast;
  handleCloseNotification: () => void;
  handleCloseComponentToast: () => void;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notification,
  componentToast,
  handleCloseNotification,
  handleCloseComponentToast
}) => {
  return (
    <>
      {/* Widget editor notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={3000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Component interaction toast */}
      <Snackbar
        open={componentToast.open}
        autoHideDuration={3000}
        onClose={handleCloseComponentToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseComponentToast} severity={componentToast.severity}>
          {componentToast.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default NotificationSystem 