import React, { useState } from 'react'
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Button,
  Box,
  useTheme,
  useMediaQuery,
  alpha,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import EditIcon from '@mui/icons-material/Edit'
import SettingsIcon from '@mui/icons-material/Settings'
import SaveIcon from '@mui/icons-material/Save'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import TemplateIcon from '@mui/icons-material/Dashboard'
import ImportExportIcon from '@mui/icons-material/ImportExport'
import HistoryIcon from '@mui/icons-material/History'
import SearchIcon from '@mui/icons-material/Search'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import VersionWarningDialog from '../dialogs/VersionWarningDialog'
import TooltipStyled from '../../../../components/TooltipStyled'

interface EditorToolbarProps {
  editMode: boolean
  showSidebar: boolean
  toggleSidebar: () => void
  toggleEditMode: () => void
  handleSaveWidget: (isMajorUpdate?: boolean) => void
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
  isLatestVersion?: boolean
  currentWidgetVersion?: string
  showAdvancedInToolbar?: boolean
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
  widgetHasComponents = false,
  isLatestVersion = true,
  currentWidgetVersion = '1.0',
  showAdvancedInToolbar = false
}) => {
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'))
  const [advancedMenuAnchor, setAdvancedMenuAnchor] = useState<null | HTMLElement>(null)
  const [showVersionWarning, setShowVersionWarning] = useState(false)
  
  const handleAdvancedMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAdvancedMenuAnchor(event.currentTarget)
  }
  
  const handleAdvancedMenuClose = () => {
    setAdvancedMenuAnchor(null)
  }

  const handleSaveButtonClick = () => {
    if (!isLatestVersion && isUpdating) {
      // If not on the latest version and trying to update, show warning
      setShowVersionWarning(true)
    } else {
      // Otherwise proceed normally
      handleSaveWidget(false)
    }
  }

  const handleVersionWarningConfirm = () => {
    setShowVersionWarning(false)
    handleSaveWidget(false) // Regular save after warning
  }

  return (
    <>
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
            : 'background.paper',
          minHeight: isPhone ? 48 : 64
        }}
      >
        <Toolbar 
          variant={isPhone ? "dense" : "regular"}
          sx={{ 
            minHeight: isPhone ? 48 : 64,
            padding: isPhone ? '0px 4px' : '0px 16px' 
          }}
        >
          {(editMode || isPhone) && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={toggleSidebar}
              sx={{ 
                mr: 2, 
                color: showSidebar ? 'primary.main' : 'foreground.contrastSecondary', 
                // flexGrow: !isDesktop ? 1 : 0, 
                justifyContent: 'flex-start',
              }}
            >
              <MenuIcon sx={{ fontSize: isPhone ? '1.25rem' : '1.5rem', ml: '1rem' }} />
            </IconButton>
          )}
          
          {!isDesktop &&(
            <Box
              sx={{ 
                flexGrow: 1,
                color: 'foreground.contrastPrimary'
              }}
            >
              
            </Box>
          )}
          {isDesktop &&(
            <Typography 
              variant="h6" 
              sx={{ 
                flexGrow: 1,
                color: 'foreground.contrastPrimary'
              }}
            >
              Widget Editor
            </Typography>
          )}          
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* Undo/Redo buttons */}
            {!isPhone && !!handleUndo && !!handleRedo && (
              <>
                <TooltipStyled title="Undo (Ctrl+Z)">
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
                </TooltipStyled>
                
                <TooltipStyled title="Redo (Ctrl+Y)">
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
                </TooltipStyled>
                
                {!isPhone && <Divider orientation="vertical" flexItem sx={{ mx: 1, height: '24px', alignSelf: 'center' }} />}
              </>
            )}
            
            <TooltipStyled title="Toggle edit/preview mode">
              <IconButton 
                color="inherit" 
                onClick={toggleEditMode}
                sx={{ 
                  mr: isPhone ? 0.5 : 1,
                  color: !editMode ? 'primary.main' : 'foreground.contrastSecondary',
                  bgcolor: !editMode ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                  padding: isPhone ? '4px' : '8px',
                  '&:hover': {
                    bgcolor: !editMode 
                      ? alpha(theme.palette.primary.main, 0.2)
                      : alpha(theme.palette.action.hover, 0.1)
                  }
                }}
              >
                <EditIcon sx={{ fontSize: isPhone ? '1.25rem' : '1.5rem' }} />
              </IconButton>
            </TooltipStyled>
            
            {!isPhone && !!handleOpenSearchDialog && (
              <TooltipStyled title="Search components">
                <span>
                  <IconButton
                    color="inherit"
                    onClick={handleOpenSearchDialog}
                    sx={{ 
                      mr: 1,
                      color: 'foreground.contrastSecondary' 
                    }}
                    disabled={!editMode || !widgetHasComponents}
                  >
                    <SearchIcon />
                  </IconButton>
                </span>
              </TooltipStyled>
            )}
            
            {!isPhone && <Divider orientation="vertical" flexItem sx={{ mx: 1, height: '24px', alignSelf: 'center' }} />}
            
            <TooltipStyled title="Open saved widget">
              <IconButton 
                color="inherit" 
                onClick={() => setShowWidgetList(true)}
                sx={{ 
                  mr: isPhone ? 0.5 : 1,
                  color: 'foreground.contrastSecondary',
                  padding: isPhone ? '4px' : '8px'
                }}
              >
                <FolderOpenIcon sx={{ fontSize: isPhone ? '1.25rem' : '1.5rem' }} />
              </IconButton>
            </TooltipStyled>
            
            
            <TooltipStyled title="Editor settings">
              <IconButton 
                color="inherit" 
                onClick={() => setShowSettingsModal(true)}
                sx={{ 
                  mr: isPhone ? 0.5 : 1,
                  color: 'foreground.contrastSecondary',
                  padding: isPhone ? '4px' : '8px'
                }}
              >
                <SettingsIcon sx={{ fontSize: isPhone ? '1.25rem' : '1.5rem' }} />
              </IconButton>
            </TooltipStyled>
            
            {/* Advanced Features in Toolbar (when enabled, only on desktop) */}
            {isDesktop && showAdvancedInToolbar && (
              <>
                <Divider orientation="vertical" flexItem sx={{ mx: 1, height: '24px', alignSelf: 'center' }} />  
                <TooltipStyled title="Templates">
                  <IconButton
                    color="inherit"
                    onClick={() => setShowTemplateDialog(true)}
                    sx={{ 
                      mr: 1,
                      color: 'foreground.contrastSecondary'
                    }}
                  >
                    <TemplateIcon />
                  </IconButton>
                </TooltipStyled>
                
                <TooltipStyled title="Export/Import Widgets">
                  <IconButton
                    color="inherit"
                    onClick={() => setShowExportImportDialog(true)}
                    sx={{ 
                      mr: 1,
                      color: 'foreground.contrastSecondary'
                    }}
                  >
                    <ImportExportIcon />
                  </IconButton>
                </TooltipStyled>
                
                <TooltipStyled title="Version History">
                  <IconButton
                    color="inherit"
                    onClick={handleOpenVersioningDialog}
                    sx={{ 
                      mr: 1,
                      color: 'foreground.contrastSecondary'
                    }}
                  >
                    <HistoryIcon />
                  </IconButton>
                </TooltipStyled>
              </>
            )}
            
            {/* Advanced Features Menu Button (shown when not on desktop or advanced features not inline) */}
            {(!isDesktop || !showAdvancedInToolbar) && (
              <TooltipStyled title="Advanced features">
                <IconButton
                  color="inherit"
                  onClick={handleAdvancedMenuOpen}
                  sx={{ 
                    mr: isPhone ? 0.5 : 1,
                    color: 'foreground.contrastSecondary',
                    padding: isPhone ? '4px' : '8px'
                  }}
                >
                  <MoreVertIcon sx={{ fontSize: isPhone ? '1.25rem' : '1.5rem' }} />
                </IconButton>
              </TooltipStyled>
            )}
            
            <Divider orientation="vertical" flexItem sx={{ mr: isPhone ? 1 : 2, height: isPhone ? '20px' : '24px', alignSelf: 'center' }} />
            
            {/* Advanced Features Menu */}
            <Menu
              anchorEl={advancedMenuAnchor}
              open={Boolean(advancedMenuAnchor)}
              onClose={handleAdvancedMenuClose}
              PaperProps={{
                elevation: 6,
                sx: {
                  minWidth: isPhone ? 180 : 220,
                  maxWidth: isPhone ? 280 : 320,
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
                    transform: 'translateY(-50%) rotate(45deg)',
                    zIndex: 0,
                  },
                  '& .MuiListItemText-primary, & .MuiListItemText-secondary': {
                    color: theme.palette.common.white
                  },
                  '& .MuiListItemIcon-root': {
                    color: theme.palette.common.white
                  }
                }
              }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              {isPhone && !!handleUndo && !!handleRedo && (
                <>
                  <MenuItem
                    onClick={() => { handleUndo() ; handleAdvancedMenuClose() }}
                    disabled={!canUndo}
                    sx={{
                      py: 1.5,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                    }}
                  >
                    <ListItemIcon sx={{ color: theme.palette.common.white }}>
                      <UndoIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Undo"
                      primaryTypographyProps={{ fontWeight: 'bold', color: theme.palette.common.white }}
                    />
                  </MenuItem>
                  <MenuItem
                    onClick={() => { handleRedo() ; handleAdvancedMenuClose() }}
                    disabled={!canRedo}
                    sx={{
                      py: 1.5,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                    }}
                  >
                    <ListItemIcon sx={{ color: theme.palette.common.white }}>
                      <RedoIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Redo"
                      primaryTypographyProps={{ fontWeight: 'bold', color: theme.palette.common.white }}
                    />
                  </MenuItem>
                </>
              )}
              {isPhone && !!handleOpenSearchDialog && (
                <MenuItem
                  onClick={() => { handleOpenSearchDialog() ; handleAdvancedMenuClose() }}
                  disabled={!editMode || !widgetHasComponents}
                  sx={{
                    py: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                  }}
                >
                  <ListItemIcon sx={{ color: theme.palette.common.white }}>
                    <SearchIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Search Components"
                    secondary="Search available components"
                    primaryTypographyProps={{ fontWeight: 'bold', color: theme.palette.common.white }}
                    secondaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 'light', color: theme.palette.common.white }}
                  />
                </MenuItem>
              )}
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
                    bgcolor: alpha(theme.palette.primary.main, 0.2)
                  }
                }}
              >
                <ListItemIcon sx={{ color: theme.palette.common.white }}>
                  <TemplateIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Templates" 
                  secondary="Save, load, and manage templates"
                  primaryTypographyProps={{ fontWeight: 'bold', color: theme.palette.common.white }}
                  secondaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 'light', color: theme.palette.common.white }}
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
                    bgcolor: alpha(theme.palette.primary.main, 0.2)
                  }
                }}
              >
                <ListItemIcon sx={{ color: theme.palette.common.white }}>
                  <ImportExportIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Export/Import Widgets" 
                  secondary="Transfer widgets between environments"
                  primaryTypographyProps={{ fontWeight: 'bold', color: theme.palette.common.white }}
                  secondaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 'light', color: theme.palette.common.white }}
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
                    bgcolor: alpha(theme.palette.primary.main, 0.2)
                  }
                }}
              >
                <ListItemIcon sx={{ color: theme.palette.common.white }}>
                  <HistoryIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Version History" 
                  secondary="View and restore previous versions"
                  primaryTypographyProps={{ fontWeight: 'bold', color: theme.palette.common.white }}
                  secondaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 'light', color: theme.palette.common.white }}
                />
              </MenuItem>
            </Menu>
            
            {/* Save Button or Icon */}
            {isPhone ? (
              <TooltipStyled title={isEmpty ? 'Empty Widget' : isUpdating && !hasChanges ? 'No changes' : isUpdating ? 'Update Widget' : 'Save Widget'}>
                <span>
                  <IconButton
                    color="inherit"
                    onClick={handleSaveButtonClick}
                    disabled={!editMode || (!hasChanges && isUpdating) || isEmpty}
                    sx={{
                      color: (!editMode || (!hasChanges && isUpdating) || isEmpty) 
                        ? 'action.disabled' 
                        : 'primary.main',
                      padding: isPhone ? '4px' : '8px'
                    }}
                  >
                    <SaveIcon sx={{ fontSize: isPhone ? '1.25rem' : '1.5rem' }} />
                  </IconButton>
                </span>
              </TooltipStyled>
            ) : (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveButtonClick}
                size="small"
                disabled={!editMode || (!hasChanges && isUpdating) || isEmpty}
                startIcon={<SaveIcon />}
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
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Version Warning Dialog */}
      <VersionWarningDialog
        open={showVersionWarning}
        onConfirm={handleVersionWarningConfirm}
        onCancel={() => setShowVersionWarning(false)}
        version={currentWidgetVersion || '1.0'}
      />
    </>
  )
}

export default EditorToolbar 