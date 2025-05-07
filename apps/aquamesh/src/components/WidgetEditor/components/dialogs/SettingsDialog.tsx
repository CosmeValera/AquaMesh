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
  Divider,
  Paper,
  Grid,
  Chip,
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import WidgetsIcon from '@mui/icons-material/Widgets'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import SaveIcon from '@mui/icons-material/Save'
import EditIcon from '@mui/icons-material/Edit'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import SettingsIcon from '@mui/icons-material/Settings'
import DashboardIcon from '@mui/icons-material/Dashboard'
import SearchIcon from '@mui/icons-material/Search'

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
  showDeleteDashboardConfirmation?: boolean
  onShowDeleteDashboardConfirmationChange?: (value: boolean) => void
  showAdvancedInToolbar?: boolean
  onShowAdvancedInToolbarChange?: (value: boolean) => void
}

// Keyboard shortcut card component
interface ShortcutCardProps {
  icon: React.ReactNode
  title: string
  shortcut: string
  color?: string
}

const ShortcutCard: React.FC<ShortcutCardProps> = ({ icon, title, shortcut, color = 'primary.main' }) => (
  <Paper
    elevation={0}
    sx={{
      p: 1.5,
      display: 'flex',
      alignItems: 'center',
      mb: 1.5,
      borderRadius: 2,
      border: '1px solid',
      borderColor: 'divider',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
      }
    }}
  >
    <Box sx={{ 
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      bgcolor: color,
      borderRadius: '50%',
      width: 36,
      height: 36,
      mr: 2
    }}>
      {icon}
    </Box>
    <Box sx={{ flex: 1 }}>
      <Typography variant="body2" fontWeight="medium">
        {title}
      </Typography>
    </Box>
    <Chip
      label={shortcut}
      size="small"
      sx={{
        fontFamily: 'monospace',
        fontWeight: 'bold',
        bgcolor: 'rgba(0,0,0,0.05)',
        border: '1px solid rgba(0,0,0,0.1)',
        borderRadius: 1,
        px: 0.5
      }}
    />
  </Paper>
)

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
  showDeleteDashboardConfirmation,
  onShowDeleteDashboardConfirmationChange,
  showAdvancedInToolbar = false,
  onShowAdvancedInToolbarChange,
}) => {
  // Create safe handlers for all possibly undefined callbacks
  const handleTooltipsChange = (checked: boolean) => {
    if (onShowTooltipsChange) {
      onShowTooltipsChange(checked)
    }
  }

  const handleComponentPaletteHelpChange = (checked: boolean) => {
    if (onShowComponentPaletteHelpChange) {
      onShowComponentPaletteHelpChange(checked)
    }
  }

  const handleAdvancedInToolbarChange = (checked: boolean) => {
    if (onShowAdvancedInToolbarChange) {
      onShowAdvancedInToolbarChange(checked)
    }
  }

  const handleDeleteDashboardConfirmationChange = (checked: boolean) => {
    if (onShowDeleteDashboardConfirmationChange) {
      onShowDeleteDashboardConfirmationChange(checked)
    }
  }

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
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <InfoOutlinedIcon sx={{ mr: 1.5, color: 'primary.main' }} />
                  <Typography fontWeight="medium">Show Component Tooltips</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Switch
                    checked={showTooltips}
                    onChange={(e) => handleTooltipsChange(e.target.checked)}
                    color="primary"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 5, mb: 1 }}>
                  Display helpful tooltips when hovering over components in the palette.
                </Typography>
              </Box>
            </Box>
          </Paper>
          
          <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <HelpOutlineIcon sx={{ mr: 1.5, color: 'primary.main' }} />
                  <Typography fontWeight="medium">Show Component Palette Help</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Switch
                    checked={showComponentPaletteHelp}
                    onChange={(e) => handleComponentPaletteHelpChange(e.target.checked)}
                    color="primary"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 5, mb: 1 }}>
                  Show the help text at the bottom of the component palette.
                </Typography>
              </Box>
            </Box>
          </Paper>
          
          <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <SearchIcon fontSize="small" sx={{ mr: 1.5, color: 'primary.main' }} />
                  <Typography fontWeight="medium">Show Advanced Features in Toolbar</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Switch
                    checked={showAdvancedInToolbar}
                    onChange={(e) => handleAdvancedInToolbarChange(e.target.checked)}
                    color="primary"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 5, mb: 1 }}>
                  Display Templates, Export/Import, and Version History buttons directly in the toolbar for easy access.
                </Typography>
              </Box>
            </Box>
          </Paper>
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="h6" gutterBottom fontWeight="medium">Confirmation Options</Typography>
          
          <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <DeleteOutlineIcon sx={{ mr: 1.5, color: 'error.main' }} />
                  <Typography fontWeight="medium">Confirm Component Deletion</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Switch
                    checked={showDeleteConfirmation}
                    onChange={(e) => onShowDeleteConfirmationChange(e.target.checked)}
                    color="primary"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 5, mb: 1 }}>
                  Show a confirmation dialog when deleting components. Disable for quicker editing.
                </Typography>
              </Box>
            </Box>
          </Paper>
          
          <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <WidgetsIcon sx={{ mr: 1.5, color: 'error.main' }} />
                  <Typography fontWeight="medium">Confirm Widget Deletion</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Switch
                    checked={showDeleteWidgetConfirmation}
                    onChange={(e) => onShowDeleteWidgetConfirmationChange(e.target.checked)}
                    color="primary"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 5, mb: 1 }}>
                  Show a confirmation dialog when deleting widgets from the library. Disable for quicker management.
                </Typography>
              </Box>
            </Box>
          </Paper>
          
          <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <DashboardIcon sx={{ mr: 1.5, color: 'error.main' }} />
                  <Typography fontWeight="medium">Confirm Dashboard Deletion</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Switch
                    checked={showDeleteDashboardConfirmation}
                    onChange={(e) => handleDeleteDashboardConfirmationChange(e.target.checked)}
                    color="primary"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 5, mb: 1 }}>
                  Show a confirmation dialog when deleting dashboards. Disable for quicker dashboard management.
                </Typography>
              </Box>
            </Box>
          </Paper>
          
          <Divider sx={{ my: 3 }} />
          
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            mb: 2.5
          }}>
            <KeyboardIcon sx={{ mr: 1.5, color: 'primary.main', fontSize: 28 }} />
            <Typography variant="h6" fontWeight="medium">
              Keyboard Shortcuts
            </Typography>
          </Box>
          
          <Paper 
            elevation={0} 
            sx={{ 
              p: 3, 
              mb: 2, 
              bgcolor: 'background.default', 
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <ShortcutCard 
                  icon={<UndoIcon />} 
                  title="Undo" 
                  shortcut="Ctrl + Z" 
                  color="#3f51b5"
                />
                
                <ShortcutCard 
                  icon={<RedoIcon />} 
                  title="Redo" 
                  shortcut="Ctrl + Y" 
                  color="#3f51b5"
                />
                
                <ShortcutCard 
                  icon={<SaveIcon />} 
                  title="Save Widget" 
                  shortcut="Ctrl + S" 
                  color="#4caf50"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <ShortcutCard 
                  icon={<EditIcon />} 
                  title="Toggle Edit Mode" 
                  shortcut="Ctrl + E" 
                  color="#ff9800"
                />
                
                <ShortcutCard 
                  icon={<FolderOpenIcon />} 
                  title="Open/Close Library" 
                  shortcut="Ctrl + O" 
                  color="#9c27b0"
                />
                
                <ShortcutCard 
                  icon={<SettingsIcon />} 
                  title="Open/Close Settings" 
                  shortcut="Ctrl + ," 
                  color="#2196f3"
                />
              </Grid>
            </Grid>
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button 
          onClick={onClose} 
          variant="contained"
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