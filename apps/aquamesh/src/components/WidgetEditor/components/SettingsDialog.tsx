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
} from '@mui/material'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  showTooltips: boolean
  onShowTooltipsChange: (value: boolean) => void
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onClose,
  showTooltips,
  onShowTooltipsChange,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Widget Editor Settings</DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <Typography variant="h6" gutterBottom>Interface Options</Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={showTooltips}
                onChange={(e) => onShowTooltipsChange(e.target.checked)}
                color="primary"
              />
            }
            label="Show Component Tooltips"
          />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 3 }}>
            Display helpful tooltips when hovering over components and controls. <br/><br/>
            <b>Recommendation:</b> Keep it enabled while you learn. Disable it when it&apos;s not necessary
          </Typography>
          
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default SettingsDialog 