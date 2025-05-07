import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  useTheme
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'

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
        bgcolor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 3
      }}>
        <WarningAmberIcon sx={{ color: 'inherit', mr: 1 }} />
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Version Restoration Warning
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
          This action will discard all versions after the currently restored version.
        </Alert>
        <Typography variant="body1" sx={{ mb: 1.5 }}>
          You are about to update this widget while using an older version <strong>({version})</strong>. All versions created after this one will be discarded permanently.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          If you want to keep these future versions, you should export them before proceeding with the update.
        </Typography>
      </DialogContent>
      <DialogActions sx={{
        px: 3,
        py: 2,
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.02)',
        borderTop: '1px solid',
        borderColor: 'divider'
      }}>
        <Button onClick={onCancel} variant="outlined" sx={{ borderRadius: 1.5 }}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="warning"
          sx={{ ml: 1, borderRadius: 1.5, fontWeight: 'medium' }}
        >
          Update and Discard Future Versions
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default VersionWarningDialog 