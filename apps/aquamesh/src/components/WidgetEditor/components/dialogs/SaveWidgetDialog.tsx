import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  useTheme,
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
          borderRadius: 2,
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          bgcolor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          p: 3,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <SaveIcon sx={{ mr: 1.5, fontSize: 24 }} />
        <Typography variant="h5" fontWeight="bold">
          Save Widget
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 3, mt: 1 }}>
        <Typography
          variant="body1"
          color="text.secondary"
          gutterBottom
          sx={{ mb: 2 }}
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
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5,
            },
          }}
        />

        {defaultName === 'New Widget' && (
          <Alert
            severity="info"
            sx={{
              borderRadius: 1.5,
              bgcolor: 'rgba(0, 166, 126, 0.08)', // Light green background
              color: 'rgba(0, 66, 50, 0.9)', // Darker green text
              border: '1px solid rgba(0, 166, 126, 0.2)',
              '& .MuiAlert-icon': {
                color: 'rgba(0, 166, 126, 0.9)', // Green icon
              },
            }}
          >
            Using the default name "New Widget" is not recommended. Please
            provide a descriptive name.
          </Alert>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          bgcolor:
            theme.palette.mode === 'dark'
              ? 'rgba(0,0,0,0.1)'
              : 'rgba(0,0,0,0.02)',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 1.5 }}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<SaveIcon />}
          sx={{
            ml: 1,
            px: 3,
            borderRadius: 1.5,
            boxShadow: 2,
          }}
        >
          Save Widget
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SaveWidgetDialog
