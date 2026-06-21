import React from 'react'
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Typography,
} from '@mui/material'
import Brightness6Icon from '@mui/icons-material/Brightness6'
import ColorLensIcon from '@mui/icons-material/ColorLens'

import AccentColorPicker from '../../theme/AccentColorPicker'
import ThemeModeToggle from '../shared/ThemeModeToggle'

interface AppearanceDialogProps {
  open: boolean
  onClose: () => void
}

const AppearanceDialog: React.FC<AppearanceDialogProps> = ({
  open,
  onClose,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>Appearance</DialogTitle>
    <DialogContent dividers>
      <Box sx={{ display: 'grid', gap: 2.5 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Brightness6Icon
              fontSize="small"
              sx={{ color: 'primary.main', mr: 1 }}
            />
            <Typography variant="body2" fontWeight={700}>
              Light / dark mode
            </Typography>
          </Box>
          <ThemeModeToggle compact />
        </Box>

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <ColorLensIcon
              fontSize="small"
              sx={{ color: 'primary.main', mr: 1 }}
            />
            <Typography variant="body2" fontWeight={700}>
              Accent color
            </Typography>
          </Box>
          <AccentColorPicker dense />
        </Box>
      </Box>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Close</Button>
    </DialogActions>
  </Dialog>
)

export default AppearanceDialog
