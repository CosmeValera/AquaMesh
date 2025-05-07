import React, { useState } from 'react'
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Tooltip,
  Button,
  Box,
  useTheme,
  alpha,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import VisibilityIcon from '@mui/icons-material/Visibility'
import SaveIcon from '@mui/icons-material/Save'
import MenuIcon from '@mui/icons-material/Menu'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import SettingsIcon from '@mui/icons-material/Settings'
import TemplateIcon from '@mui/icons-material/Dashboard'
import ImportExportIcon from '@mui/icons-material/ImportExport'
import HistoryIcon from '@mui/icons-material/History'
import SearchIcon from '@mui/icons-material/Search'
import MoreVertIcon from '@mui/icons-material/MoreVert'

interface EditorToolbarProps {
  editMode: boolean
  toggleEditMode: () => void
  showSidebar: boolean
  toggleSidebar: () => void
  handleSaveWidget: () => void
  setShowWidgetList: (show: boolean) => void
  handleUndo: () => void
  handleRedo: () => void
  canUndo: boolean
  canRedo: boolean
  isUpdating: boolean
  hasChanges: boolean
  setShowSettingsModal: (show: boolean) => void
  setShowTemplateDialog: (show: boolean) => void
  setShowExportImportDialog: (show: boolean) => void
  handleOpenVersioningDialog: () => void
  handleOpenSearchDialog: () => void
  widgetHasComponents: boolean
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editMode,
  toggleEditMode,
  showSidebar,
  toggleSidebar,
  handleSaveWidget,
  setShowWidgetList,
  handleUndo,
  handleRedo,
  canUndo,
  canRedo,
  isUpdating,
  hasChanges,
  setShowSettingsModal,
  setShowTemplateDialog,
  setShowExportImportDialog,
  handleOpenVersioningDialog,
  handleOpenSearchDialog,
  widgetHasComponents
}) => {
  const theme = useTheme()
  const [advancedMenuAnchor, setAdvancedMenuAnchor] = useState<null | HTMLElement>(null)

  const handleOpenAdvancedMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAdvancedMenuAnchor(event.currentTarget)
  }

  const handleCloseAdvancedMenu = () => {
    setAdvancedMenuAnchor(null)
  }

  const handleAdvancedMenuItemClick = (callback: () => void) => {
    callback()
    handleCloseAdvancedMenu()
  }

  return (
    <AppBar 
      position="static" 
      color="default" 
      elevation={0}
      sx={{ 
        bgcolor: theme.palette.mode === 'dark' 
          ? alpha(theme.palette.background.paper, 0.9) 
          : 'background.paper',
        borderBottom: 1,
        borderColor: 'divider'
      }}
    >
      <Toolbar variant="dense">
        {/* Menu toggle for component palette */}
        <Tooltip title={`${showSidebar ? 'Hide' : 'Show'} component palette`}>
          <IconButton
            edge="start"
            color="inherit"
            onClick={toggleSidebar}
            sx={{ mr: 1 }}
          >
            <MenuIcon />
          </IconButton>
        </Tooltip>

        {/* Title */}
        <Typography variant="h6" color="inherit" sx={{ flexGrow: 0, minWidth: 140 }}>
          Widget Editor
        </Typography>

        {/* Edit/Preview mode toggle */}
        <Tooltip title={editMode ? 'Switch to preview mode' : 'Switch to edit mode'}>
          <IconButton 
            color="inherit" 
            onClick={toggleEditMode}
            sx={{ 
              ml: 1,
              bgcolor: editMode ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
              '&:hover': {
                bgcolor: editMode 
                  ? alpha(theme.palette.primary.main, 0.2)
                  : alpha(theme.palette.action.hover, 0.1)
              }
            }}
          >
            {editMode ? <VisibilityIcon /> : <EditIcon />}
          </IconButton>
        </Tooltip>
        
        {/* Search components button */}
        <Tooltip title="Search components">
          <IconButton
            color="inherit"
            onClick={handleOpenSearchDialog}
            sx={{ ml: 1 }}
            disabled={!editMode || !widgetHasComponents}
          >
            <SearchIcon />
          </IconButton>
        </Tooltip>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Undo/Redo buttons */}
        <Tooltip title="Undo">
          <span>
            <IconButton 
              color="inherit" 
              onClick={handleUndo}
              disabled={!canUndo}
            >
              <UndoIcon />
            </IconButton>
          </span>
        </Tooltip>
        
        <Tooltip title="Redo">
          <span>
            <IconButton 
              color="inherit" 
              onClick={handleRedo}
              disabled={!canRedo}
            >
              <RedoIcon />
            </IconButton>
          </span>
        </Tooltip>

        {/* Open widget list */}
        <Tooltip title="Open saved widgets">
          <IconButton 
            color="inherit" 
            onClick={() => setShowWidgetList(true)}
            sx={{ mr: 1 }}
          >
            <FolderOpenIcon />
          </IconButton>
        </Tooltip>

        {/* Advanced features menu */}
        <Tooltip title="Advanced features">
          <IconButton 
            color="inherit" 
            onClick={handleOpenAdvancedMenu}
            sx={{ mr: 1 }}
          >
            <MoreVertIcon />
          </IconButton>
        </Tooltip>
        
        <Menu
          anchorEl={advancedMenuAnchor}
          open={Boolean(advancedMenuAnchor)}
          onClose={handleCloseAdvancedMenu}
        >
          <MenuItem onClick={() => handleAdvancedMenuItemClick(() => setShowTemplateDialog(true))}>
            <ListItemIcon>
              <TemplateIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Choose Template</ListItemText>
          </MenuItem>
          
          <MenuItem onClick={() => handleAdvancedMenuItemClick(() => setShowExportImportDialog(true))}>
            <ListItemIcon>
              <ImportExportIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export/Import Widgets</ListItemText>
          </MenuItem>
          
          <MenuItem onClick={() => handleAdvancedMenuItemClick(handleOpenVersioningDialog)}>
            <ListItemIcon>
              <HistoryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Version History</ListItemText>
          </MenuItem>
          
          <MenuItem onClick={() => handleAdvancedMenuItemClick(() => setShowSettingsModal(true))}>
            <ListItemIcon>
              <SettingsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Settings</ListItemText>
          </MenuItem>
        </Menu>

        {/* Save button */}
        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSaveWidget}
          disabled={!editMode || (!hasChanges && isUpdating)}
          sx={{ borderRadius: '4px' }}
        >
          {isUpdating ? 'Update' : 'Save'}
        </Button>
      </Toolbar>
    </AppBar>
  )
}

export default EditorToolbar 