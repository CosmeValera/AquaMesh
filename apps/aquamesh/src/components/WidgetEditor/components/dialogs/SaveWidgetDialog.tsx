import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import { CustomWidget } from '../../WidgetStorage'

interface SaveWidgetDialogProps {
  open: boolean
  onClose: () => void
  onSave: (name: string) => void
  defaultName: string
  existingWidgets: CustomWidget[]
}

const SaveWidgetDialog: React.FC<SaveWidgetDialogProps> = ({
  open,
  onClose,
  onSave,
  defaultName,
  existingWidgets,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName(defaultName === 'New Widget' ? '' : defaultName)
      setError(null)
    }
  }, [open, defaultName])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)

    // Clear errors when typing
    if (error) {
      setError(null)
    }
  }

  const handleSave = () => {
    const trimmedName = name.trim()

    // Validate name
    if (!trimmedName) {
      setError('Widget name is required')
      return
    }

    if (trimmedName === 'New Widget') {
      setError('Please provide a more descriptive name')
      return
    }

    // Check if name already exists
    if (existingWidgets.some((w) => w.name === trimmedName)) {
      setError('A widget with this name already exists')
      return
    }

    // Save if valid
    onSave(trimmedName)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        elevation: 8,
        sx: {
          borderRadius: isMobile ? 1 : 2,
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          bgcolor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          p: isMobile ? 2 : 3,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <SaveIcon sx={{ mr: isMobile ? 1 : 1.5, fontSize: isMobile ? 20 : 24 }} />
        <Typography variant={isMobile ? "h6" : "h5"} fontWeight="bold">
          Save Widget
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ p: isMobile ? 2 : 3, mt: isMobile ? 0.5 : 1 }}>
        <Typography
          variant="body1"
          color="text.secondary"
          gutterBottom
          sx={{ 
            mb: isMobile ? 1.5 : 2,
            fontSize: isMobile ? '0.875rem' : undefined
          }}
        >
          Please provide a unique name for your widget
        </Typography>

        <TextField
          label="Widget Name"
          variant="outlined"
          fullWidth
          value={name}
          onChange={handleNameChange}
          autoFocus
          error={!!error}
          helperText={error}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSave()
            }
          }}
          size={isMobile ? "small" : "medium"}
          InputLabelProps={{
            style: { fontSize: isMobile ? '0.875rem' : undefined }
          }}
          InputProps={{
            style: { fontSize: isMobile ? '0.875rem' : undefined }
          }}
          FormHelperTextProps={{
            style: { fontSize: isMobile ? '0.75rem' : undefined }
          }}
          sx={{
            mb: isMobile ? 1.5 : 2,
            '& .MuiOutlinedInput-root': {
              borderRadius: isMobile ? 1 : 1.5,
            },
          }}
        />

        {defaultName === 'New Widget' && (
          <Alert
            severity="info"
            sx={{
              borderRadius: isMobile ? 1 : 1.5,
              bgcolor: 'rgba(0, 166, 126, 0.08)', // Light green background
              color: 'rgba(0, 66, 50, 0.9)', // Darker green text
              border: '1px solid rgba(0, 166, 126, 0.2)',
              '& .MuiAlert-icon': {
                color: 'rgba(0, 166, 126, 0.9)', // Green icon
                fontSize: isMobile ? '1rem' : undefined
              },
              '& .MuiAlert-message': {
                fontSize: isMobile ? '0.75rem' : undefined
              },
              py: isMobile ? 0.5 : 1
            }}
          >
            Using the default name &quot;New Widget&quot; is not recommended. Please
            provide a descriptive name.
          </Alert>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: isMobile ? 2 : 3,
          py: isMobile ? 1.5 : 2,
          bgcolor:
            theme.palette.mode === 'dark'
              ? 'rgba(0,0,0,0.1)'
              : 'rgba(0,0,0,0.02)',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Button 
          onClick={onClose} 
          variant="outlined" 
          size={isMobile ? "small" : "medium"}
          sx={{ 
            borderRadius: isMobile ? 1 : 1.5,
            fontSize: isMobile ? '0.75rem' : undefined
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<SaveIcon fontSize={isMobile ? "small" : "medium"} />}
          size={isMobile ? "small" : "medium"}
          sx={{
            ml: 1,
            px: isMobile ? 2 : 3,
            borderRadius: isMobile ? 1 : 1.5,
            boxShadow: 2,
            fontSize: isMobile ? '0.75rem' : undefined
          }}
        >
          Save Widget
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SaveWidgetDialog
