import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
  Typography,
  Alert,
  useTheme
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { alpha } from '@mui/material/styles'

interface VersionWarningDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  version: string
}

const VersionWarningDialog: React.FC<VersionWarningDialogProps> = ({
  open,
  onConfirm,
  onCancel,
  version
}) => {
  const theme = useTheme()

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      PaperProps={{
        sx: { 
          borderRadius: 2,
          border: `1px solid ${theme.palette.warning.main}`,
          boxShadow: 5
        }
      }}
    >
      <DialogTitle sx={{ 
        bgcolor: alpha(theme.palette.warning.main, 0.1),
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        <WarningAmberIcon color="warning" />
        <Typography fontWeight="bold">Version Restoration Warning</Typography>
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
          This action will discard all versions after the currently restored version.
        </Alert>
        <DialogContentText>
          You are about to update this widget while using an older version ({version}). 
          All versions created after this one will be discarded permanently.
        </DialogContentText>
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
          If you want to keep these future versions, you should export them before proceeding with the update.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button 
          onClick={onCancel} 
          variant="outlined"
          sx={{ borderRadius: 1.5 }}
        >
          Cancel
        </Button>
        <Button 
          onClick={onConfirm} 
          variant="contained" 
          color="warning"
          sx={{ 
            ml: 1, 
            borderRadius: 1.5,
            fontWeight: 'medium'
          }}
        >
          Update and Discard Future Versions
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default VersionWarningDialog 