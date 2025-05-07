import React, { useState } from 'react'
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Button,
  Tooltip,
  Box,
  useTheme,
  alpha,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import EditIcon from '@mui/icons-material/Edit'
import SettingsIcon from '@mui/icons-material/Settings'
import SaveIcon from '@mui/icons-material/Save'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import VisibilityIcon from '@mui/icons-material/Visibility'
import TemplateIcon from '@mui/icons-material/Dashboard'
import ImportExportIcon from '@mui/icons-material/ImportExport'
import HistoryIcon from '@mui/icons-material/History'
import SearchIcon from '@mui/icons-material/Search'
import MoreVertIcon from '@mui/icons-material/MoreVert'

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
  hasChanges?: boolean
  isEmpty?: boolean
  showTemplateDialog: boolean
  setShowTemplateDialog: (show: boolean) => void
  showExportImportDialog: boolean
  setShowExportImportDialog: (show: boolean) => void
  handleOpenVersioningDialog: () => void
  handleOpenSearchDialog?: () => void
  widgetHasComponents?: boolean
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
  canRedo = false,
  hasChanges = true,
  isEmpty = false,
  setShowTemplateDialog,
  setShowExportImportDialog,
  handleOpenVersioningDialog,
  handleOpenSearchDialog,
  widgetHasComponents = false
}) => {
  const theme = useTheme()
  const [advancedMenuAnchor, setAdvancedMenuAnchor] = useState<null | HTMLElement>(null)
  
  const handleAdvancedMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAdvancedMenuAnchor(event.currentTarget)
  }
  
  const handleAdvancedMenuClose = () => {
    setAdvancedMenuAnchor(null)
  }

  return (
    <AppBar 
      position="static" 
      color="default" 
      elevation={0}
      className="widget-editor-toolbar"
      sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        bgcolor: theme.palette.mode === 'dark' 
          ? alpha(theme.palette.background.paper, 0.9) 
          : 'background.paper' 
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
          {/* Undo/Redo buttons*/}
          {handleUndo && handleRedo && (
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
                color: editMode ? 'primary.main' : 'foreground.contrastSecondary',
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
          
          {handleOpenSearchDialog && (
            <Tooltip title="Search components">
              <span>
                <IconButton
                  color="inherit"
                  onClick={handleOpenSearchDialog}
                  sx={{ mr: 1 }}
                  disabled={!editMode || !widgetHasComponents}
                >
                  <SearchIcon />
                </IconButton>
              </span>
            </Tooltip>
          )}
          
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
          
          {/* Advanced Features Menu Button */}
          <Tooltip title="Advanced features">
            <IconButton
              color="inherit"
              onClick={handleAdvancedMenuOpen}
              sx={{ 
                mr: 1,
                color: 'foreground.contrastSecondary' 
              }}
            >
              <MoreVertIcon />
            </IconButton>
          </Tooltip>
          
          {/* Advanced Features Menu */}
          <Menu
            anchorEl={advancedMenuAnchor}
            open={Boolean(advancedMenuAnchor)}
            onClose={handleAdvancedMenuClose}
            PaperProps={{
              elevation: 6,
              sx: {
                minWidth: 220,
                maxWidth: 320,
                overflow: 'visible',
                mt: 1,
                borderRadius: 2,
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
                '&:before': {
                  content: '""',
                  display: 'block',
                  position: 'absolute',
                  top: 0,
                  right: 14,
                  width: 10,
                  height: 10,
                  bgcolor: 'background.paper',
                  transform: 'translateY(-50%) rotate(45deg)',
                  zIndex: 0,
                },
              }
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <Box sx={{ 
              px: 2, 
              py: 1.5, 
              bgcolor: 'primary.main',
              color: 'white',
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8
            }}>
              <Typography variant="subtitle1" fontWeight="bold">
                Advanced Features
              </Typography>
            </Box>
            
            <MenuItem 
              onClick={() => {
                setShowTemplateDialog(true)
                handleAdvancedMenuClose()
              }}
              sx={{ 
                py: 1.5, 
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08)
                }
              }}
            >
              <ListItemIcon sx={{ color: theme.palette.primary.main }}>
                <TemplateIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="Templates" 
                secondary="Save, load, and manage templates"
                primaryTypographyProps={{ fontWeight: 'bold' }}
                secondaryTypographyProps={{ fontSize: '0.75rem' }}
              />
            </MenuItem>
            
            <MenuItem 
              onClick={() => {
                setShowExportImportDialog(true)
                handleAdvancedMenuClose()
              }}
              sx={{ 
                py: 1.5, 
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08)
                }
              }}
            >
              <ListItemIcon sx={{ color: theme.palette.primary.main }}>
                <ImportExportIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="Export/Import Widgets" 
                secondary="Transfer widgets between environments"
                primaryTypographyProps={{ fontWeight: 'bold' }}
                secondaryTypographyProps={{ fontSize: '0.75rem' }}
              />
            </MenuItem>
            
            <MenuItem 
              onClick={() => {
                handleOpenVersioningDialog()
                handleAdvancedMenuClose()
              }}
              sx={{ 
                py: 1.5,
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08)
                }
              }}
            >
              <ListItemIcon sx={{ color: theme.palette.primary.main }}>
                <HistoryIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="Version History" 
                secondary="View and restore previous versions"
                primaryTypographyProps={{ fontWeight: 'bold' }}
                secondaryTypographyProps={{ fontSize: '0.75rem' }}
              />
            </MenuItem>
          </Menu>
          
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSaveWidget}
            size="small"
            disabled={!hasChanges || isEmpty}
            sx={{ 
              borderRadius: 1,
              width: '155px',
              textTransform: 'none',
              '&.Mui-disabled': {
                backgroundColor: 'rgba(0, 0, 0, 0.12)',
                color: 'rgba(0, 0, 0, 0.26)'
              }
            }}
          >
            {isEmpty ? 'Empty Widget' : isUpdating && !hasChanges ? 'No changes' : isUpdating ? 'Update Widget' : 'Save Widget'}
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default EditorToolbar 