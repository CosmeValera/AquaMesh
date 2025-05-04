import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Switch,
  FormControlLabel,
  Divider,
  Paper,
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import WidgetsIcon from '@mui/icons-material/Widgets'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  showTooltips: boolean
  onShowTooltipsChange: (value: boolean) => void
  showDeleteConfirmation: boolean
  onShowDeleteConfirmationChange: (value: boolean) => void
  showComponentPaletteHelp: boolean
  onShowComponentPaletteHelpChange: (value: boolean) => void
  showDeleteWidgetConfirmation: boolean
  onShowDeleteWidgetConfirmationChange: (value: boolean) => void
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onClose,
  showTooltips,
  onShowTooltipsChange,
  showDeleteConfirmation,
  onShowDeleteConfirmationChange,
  showComponentPaletteHelp,
  onShowComponentPaletteHelpChange,
  showDeleteWidgetConfirmation,
  onShowDeleteWidgetConfirmationChange,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '12px',
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        Widget Editor Settings
      </DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <Typography variant="h6" gutterBottom fontWeight="medium">Interface Options</Typography>
          
          <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
              <InfoOutlinedIcon sx={{ mr: 1.5, color: 'primary.main', mt: 0.4 }} />
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showTooltips}
                      onChange={(e) => onShowTooltipsChange(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={<Typography fontWeight="medium">Show Component Tooltips</Typography>}
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 0, mb: 1 }}>
                  Display helpful tooltips when hovering over components in the palette.
                </Typography>
              </Box>
            </Box>
          </Paper>
          
          <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
              <HelpOutlineIcon sx={{ mr: 1.5, color: 'primary.main', mt: 0.4 }} />
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showComponentPaletteHelp}
                      onChange={(e) => onShowComponentPaletteHelpChange(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={<Typography fontWeight="medium">Show Component Palette Help</Typography>}
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 0, mb: 1 }}>
                  Show the help text at the bottom of the component palette.
                </Typography>
              </Box>
            </Box>
          </Paper>
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="h6" gutterBottom fontWeight="medium">Confirmation Options</Typography>
          
          <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
              <DeleteOutlineIcon sx={{ mr: 1.5, color: 'error.main', mt: 0.4 }} />
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showDeleteConfirmation}
                      onChange={(e) => onShowDeleteConfirmationChange(e.target.checked)}
                      color="error"
                    />
                  }
                  label={<Typography fontWeight="medium">Confirm Component Deletion</Typography>}
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 0, mb: 1 }}>
                  Show a confirmation dialog when deleting components. Disable for quicker editing.
                </Typography>
              </Box>
            </Box>
          </Paper>
          
          <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
              <WidgetsIcon sx={{ mr: 1.5, color: 'error.main', mt: 0.4 }} />
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showDeleteWidgetConfirmation}
                      onChange={(e) => onShowDeleteWidgetConfirmationChange(e.target.checked)}
                      color="error"
                    />
                  }
                  label={<Typography fontWeight="medium">Confirm Widget Deletion</Typography>}
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 0, mb: 1 }}>
                  Show a confirmation dialog when deleting widgets from the library. Disable for quicker management.
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button 
          onClick={onClose} 
          variant="outlined"
          color="primary"
          sx={{ px: 3 }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SettingsDialog 