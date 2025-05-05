import React from 'react'
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Button,
  Tooltip,
  Box
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import EditIcon from '@mui/icons-material/Edit'
import SettingsIcon from '@mui/icons-material/Settings'
import SaveIcon from '@mui/icons-material/Save'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'

interface EditorToolbarProps {
  editMode: boolean
  showSidebar: boolean
  toggleSidebar: () => void
  toggleEditMode: () => void
  handleSaveWidget: () => void
  setShowWidgetList: (show: boolean) => void
  setShowSettingsModal: (show: boolean) => void
  isUpdating: boolean
  handleUndo?: () => void
  handleRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editMode,
  showSidebar,
  toggleSidebar,
  toggleEditMode,
  handleSaveWidget,
  setShowWidgetList,
  setShowSettingsModal,
  isUpdating,
  handleUndo,
  handleRedo,
  canUndo = false,
  canRedo = false
}) => {
  return (
    <AppBar 
      position="static" 
      color="default" 
      elevation={0}
      sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        bgcolor: 'background.paper' 
      }}
    >
      <Toolbar variant="dense">
        {editMode && (
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={toggleSidebar}
            sx={{ mr: 2, color: showSidebar ? 'primary.main' : 'foreground.contrastSecondary' }}
          >
            <MenuIcon />
          </IconButton>
        )}
        
        <Typography 
          variant="h6" 
          sx={{ 
            flexGrow: 1,
            color: 'foreground.contrastPrimary'
          }}
        >
          Widget Editor
        </Typography>
        
        <Box>
          {/* Undo/Redo buttons - only show in edit mode */}
          {editMode && handleUndo && handleRedo && (
            <>
              <Tooltip title="Undo (Ctrl+Z)">
                <span>
                  <IconButton 
                    color="inherit" 
                    onClick={handleUndo}
                    disabled={!canUndo}
                    sx={{ 
                      mr: 1,
                      color: canUndo ? 'foreground.contrastSecondary' : 'action.disabled'
                    }}
                  >
                    <UndoIcon />
                  </IconButton>
                </span>
              </Tooltip>
              
              <Tooltip title="Redo (Ctrl+Y)">
                <span>
                  <IconButton 
                    color="inherit" 
                    onClick={handleRedo}
                    disabled={!canRedo}
                    sx={{ 
                      mr: 1,
                      color: canRedo ? 'foreground.contrastSecondary' : 'action.disabled'
                    }}
                  >
                    <RedoIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
          
          <Tooltip title="Toggle edit mode">
            <IconButton 
              color="inherit" 
              onClick={toggleEditMode}
              sx={{ 
                mr: 1,
                color: editMode ? 'primary.main' : 'foreground.contrastSecondary' 
              }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Open saved widget">
            <IconButton 
              color="inherit" 
              onClick={() => setShowWidgetList(true)}
              sx={{ 
                mr: 1,
                color: 'foreground.contrastSecondary' 
              }}
            >
              <FolderOpenIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Editor settings">
            <IconButton 
              color="inherit" 
              onClick={() => setShowSettingsModal(true)}
              sx={{ 
                mr: 1,
                color: 'foreground.contrastSecondary' 
              }}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSaveWidget}
            size="small"
            sx={{ 
              borderRadius: 1,
              textTransform: 'none'
            }}
          >
            {isUpdating ? 'Update Widget' : 'Save Widget'}
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default EditorToolbar 