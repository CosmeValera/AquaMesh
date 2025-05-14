import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  IconButton
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CloseIcon from '@mui/icons-material/Close'
import { dialogStyles, buttonStyles } from '../../../shared/DialogStyles'

interface DeleteConfirmationDialogProps {
  open: boolean
  title: string
  content: string
  onConfirm: () => void
  onCancel: () => void
}

const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  open,
  title,
  content,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          ...dialogStyles.paper,
          bgcolor: '#006B58' // Special background for danger dialog
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          ...dialogStyles.errorTitle,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <DeleteOutlineIcon sx={{ mr: 1.5, fontSize: 24, color: 'white' }} />
        <Typography variant="h6" sx={{ fontWeight: 500, color: 'white' }}>
          {title}
        </Typography>
        <IconButton
          size="small"
          aria-label="close"
          sx={dialogStyles.closeButton}
          onClick={onCancel}
        >
          <CloseIcon fontSize="medium" />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ ...dialogStyles.content, bgcolor: '#006B58', color: 'white' }}>
        <Typography variant="body1" sx={{ mb: 2, pt: 1.5, fontWeight: 400 }}>
          {content}
        </Typography>
        <Typography variant="body2" color="rgba(255, 255, 255, 0.7)" sx={{ mt: 1 }}>
          This action cannot be undone.
        </Typography>
      </DialogContent>
      
      <DialogActions sx={{ ...dialogStyles.centeredActions, bgcolor: '#006B58' }}>
        <Button 
          onClick={onCancel} 
          variant="outlined"
          sx={buttonStyles.secondary}
        >
          CANCEL
        </Button>
        <Button 
          onClick={onConfirm} 
          variant="contained"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          sx={buttonStyles.danger}
        >
          DELETE
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DeleteConfirmationDialog 