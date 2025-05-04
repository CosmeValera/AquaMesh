import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  Fade,
  useTheme
} from '@mui/material'
import WarningIcon from '@mui/icons-material/Warning'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'

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
  onCancel
}) => {
  const theme = useTheme()
  
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="delete-confirmation-title"
      aria-describedby="delete-confirmation-description"
      maxWidth="sm"
      fullWidth
      TransitionComponent={Fade}
      PaperProps={{
        sx: {
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
        }
      }}
    >
      <Paper
        elevation={0}
        sx={{
          bgcolor: theme.palette.error.dark,
          color: theme.palette.error.contrastText,
          py: 2,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}
      >
        <WarningIcon fontSize="large" />
        <Typography variant="h6" component="div" id="delete-confirmation-title" fontWeight="bold">
          {title}
        </Typography>
      </Paper>
      
      <DialogContent sx={{ pt: 4, pb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <DeleteOutlineIcon sx={{ color: 'error.main', mr: 1.5, fontSize: 28 }} />
          <Typography variant="body1" id="delete-confirmation-description">
            {content}
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
        <Button 
          onClick={onCancel} 
          variant="outlined"
          color="inherit"
          sx={{ 
            borderColor: 'divider',
            color: 'text.secondary',
            px: 3,
            '&:hover': {
              bgcolor: 'action.hover',
              borderColor: 'divider'
            }
          }}
        >
          Cancel
        </Button>
        <Button 
          onClick={onConfirm} 
          variant="contained" 
          color="error"
          startIcon={<DeleteOutlineIcon />}
          sx={{ 
            px: 3,
            '&:hover': {
              bgcolor: 'error.dark',
              transform: 'translateY(-2px)',
              transition: 'all 0.2s'
            },
            boxShadow: 2
          }}
          autoFocus
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DeleteConfirmationDialog 