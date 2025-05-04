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
          borderRadius: '12px',
          overflow: 'hidden',
          bgcolor: 'background.paper'
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          bgcolor: 'error.main',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          px: 3,
          py: 1.5,
          position: 'relative'
        }}
      >
        <DeleteOutlineIcon sx={{ mr: 1.5, fontSize: 24, color: 'white' }} />
        <Typography variant="h6" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
        <IconButton
          size="small"
          aria-label="close"
          sx={{ 
            position: 'absolute', 
            right: 16, 
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'white'
          }}
          onClick={onCancel}
        >
          <CloseIcon fontSize="medium" />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ px: 3, pb: 0, bgcolor: '#006d5c' }}>
        <Typography variant="body1" color="white" sx={{ mb: 2, pt: 1.5, fontWeight: 400 }}>
          {content}
        </Typography>
        <Typography variant="body2" color="rgba(255, 255, 255, 0.7)" sx={{ mt: 1 }}>
          This action cannot be undone.
        </Typography>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 3, bgcolor: '#006d5c', justifyContent: 'center', gap: 2 }}>
        <Button 
          onClick={onCancel} 
          variant="outlined"
          sx={{ 
            px: 3, 
            py: 1,
            minWidth: 120,
            color: 'white',
            borderColor: 'rgba(255, 255, 255, 0.3)',
            '&:hover': {
              borderColor: 'white',
              bgcolor: 'rgba(255, 255, 255, 0.05)'
            }
          }}
        >
          CANCEL
        </Button>
        <Button 
          onClick={onConfirm} 
          variant="contained"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          sx={{ 
            px: 3, 
            py: 1,
            minWidth: 120,
            fontWeight: 500
          }}
        >
          DELETE
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DeleteConfirmationDialog 