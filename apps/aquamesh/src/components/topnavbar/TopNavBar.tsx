import React, { useState, useEffect } from 'react'
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  Menu,
  MenuItem,
  Divider,
  Avatar,
  ListItemIcon,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'

import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import LogoutIcon from '@mui/icons-material/Logout'
import WidgetsIcon from '@mui/icons-material/Widgets'
import CreateIcon from '@mui/icons-material/Create'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import DeleteIcon from '@mui/icons-material/Delete'
import FolderIcon from '@mui/icons-material/Folder'

import useTopNavBarWidgets from '../../customHooks/useTopNavBarWidgets'
import { useLayout } from '../Layout/LayoutProvider'
import { ReactComponent as Logo } from '../../../public/logo.svg'
import { useViews } from '../Views/ViewsProvider'
import TutorialModal from '../tutorial/TutorialModal'
import WidgetStorage from '../WidgetEditor/WidgetStorage'
import DashboardOptionsMenu from '../Views/DashboardOptionsMenu'
import SavedWidgetsDialog from '../WidgetEditor/components/dialogs/SavedWidgetsDialog'

// Define user data type
interface UserData {
  id: string
  name: string
  role: string
}

// Define component data interface
interface ComponentData {
  id: string
  type: string
  props: Record<string, unknown>
  children?: ComponentData[]
  parentId?: string
}

// Define widget interface based on WidgetStorage
interface CustomWidget {
  id: string
  name: string
  components: ComponentData[]
  createdAt: string
  updatedAt: string
}

interface TopNavBarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const TopNavBar: React.FC<TopNavBarProps> = () => {
  // State for different dropdown menus
  const [panelsAnchorEl, setPanelsAnchorEl] = useState<null | HTMLElement>(null)
  const [userAnchorEl, setUserAnchorEl] = useState<null | HTMLElement>(null)
  const [userData, setUserData] = useState<UserData>({ id: 'admin', name: 'Admin User', role: 'ADMIN_ROLE' })
  
  // Tutorial modal state
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [showTutorialOnStartup, setShowTutorialOnStartup] = useState(() => {
    return !localStorage.getItem('aquamesh-tutorial-shown')
  })
  
  // Custom Widgets Library state
  const [widgetsLibraryOpen, setWidgetsLibraryOpen] = useState(false)
  
  const { topNavBarWidgets } = useTopNavBarWidgets()
  const { addComponent } = useLayout()
  const { addView, openViews } = useViews()
  const navigate = useNavigate()
  
  // Use theme and media query for responsive design
  const theme = useTheme()
  const isTablet = useMediaQuery(theme.breakpoints.down('md'))
  
  // Load user data from localStorage on component mount
  useEffect(() => {
    const storedUserData = localStorage.getItem('userData')
    if (storedUserData) {
      try {
        const parsedUserData = JSON.parse(storedUserData)
        setUserData(parsedUserData)
      } catch (error) {
        console.error('Failed to parse user data from localStorage', error)
      }
    }
    
    // Check if tutorial should be shown
    if (showTutorialOnStartup) {
      setTutorialOpen(true)
    }
  }, [showTutorialOnStartup])

  // Handle opening and closing dropdowns
  const handlePanelsMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setPanelsAnchorEl(event.currentTarget)
  }
  
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setUserAnchorEl(event.currentTarget)
  }
  
  const handleClose = () => {
    setPanelsAnchorEl(null)
    setUserAnchorEl(null)
  }

  const handleLogout = () => {
    handleClose()
    navigate('/login')
  }

  // Delete a custom widget
  const handleDeleteWidget = (widgetId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      WidgetStorage.deleteWidget(widgetId)
      // The deletion will trigger a refresh via the WIDGET_STORAGE_UPDATED event
    } catch (error) {
      console.error('Failed to delete widget', error)
    }
  }
  
  // Open tutorial modal
  const handleOpenTutorial = () => {
    setTutorialOpen(true)
  }
  
  // Toggle tutorial display on startup
  const handleToggleTutorialStartup = () => {
    setShowTutorialOnStartup(!showTutorialOnStartup)
  }

  // Helper function to ensure there's a view before adding a component
  const ensureViewAndAddComponent = (componentConfig: {
    id: string;
    name: string;
    component: string;
    url?: string;
    customProps?: Record<string, unknown>;
  }) => {
    // Check if there are any open views (dashboards)
    if (openViews.length === 0) {
      // If no views exist, create a default dashboard first
      addView()
      // Short delay to ensure the view is created before adding the component
      setTimeout(() => {
        addComponent(componentConfig)
      }, 100)
    } else {
      // If views already exist, add the component directly
      addComponent(componentConfig)
    }
  }
  
  // Open Custom Widgets Library dialog
  const handleOpenWidgetsLibrary = () => {
    setWidgetsLibraryOpen(true)
  }
  
  // Handle loading a widget from the library
  const handleLoadWidget = (widget: CustomWidget, editMode: boolean = false) => {
    ensureViewAndAddComponent({
      id: `custom-widget-${Date.now()}`,
      name: widget.name,
      component: 'CustomWidget',
      customProps: {
        widgetId: widget.id,
        editMode: editMode
      }
    })
    setWidgetsLibraryOpen(false)
  }

  return (
    <>
      <AppBar 
        position="static" 
        sx={{ 
          backgroundColor: 'background.header',
          boxShadow: 2,
          height: '64px'
        }}
      >
        <Toolbar>
          {/* Logo and Brand */}
          <Typography
            variant="h6"
            component="div"
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              fontWeight: isTablet ? 'normal' : 'bold',
              color: 'foreground.contrastPrimary',
              mr: 4,
              cursor: 'default'
            }}
          >
            <Logo height="32px" width="32px" style={{ marginRight: isTablet ? '-28px' : '12px' }} />
            {!isTablet && 'AquaMesh'}
          </Typography>

          {/* Main Navigation Items */}
          <Box sx={{ flexGrow: 1, display: 'flex' }}>
            {/* Dashboard Options Menu (replaced with our new component) */}
            <DashboardOptionsMenu isMobile={isTablet} />

            {/* Panels/Widgets Menu */}
            <Button
              onClick={handlePanelsMenuOpen}
              sx={{ 
                color: 'foreground.contrastPrimary', 
                display: 'flex', 
                alignItems: 'center',
                minWidth: isTablet ? '40px' : 'auto',
                mx: isTablet ? 0.5 : 1,
                px: isTablet ? 1 : 2,
              }}
              startIcon={<WidgetsIcon />}
              endIcon={<KeyboardArrowDownIcon />}
              data-tutorial-id="widgets-button"
            >
              {!isTablet ? 'Widgets' : 'W.'}
            </Button>
            <Menu
              anchorEl={panelsAnchorEl}
              open={Boolean(panelsAnchorEl)}
              onClose={handleClose}
              PaperProps={{
                sx: {
                  bgcolor: 'background.menu',
                  color: 'foreground.contrastPrimary',
                  width: '250px',
                  boxShadow: 3
                }
              }}
            >
              {/* Predefined Widgets Section */}
              <Typography sx={{ px: 2, py: 1, fontWeight: 'bold', mt: 1, color: '#000000DE' }}>
                Predefined Widgets
              </Typography>
              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
              {topNavBarWidgets.filter((widget: { name: string }) => !widget.name.includes('Custom')).map((topNavBarWidget: { name: string; items: Array<{ name: string; component: string }> }) => (
                <Box key={topNavBarWidget.name}>
                  {topNavBarWidget.items.map((item: { name: string; component: string }) => (
                    <MenuItem 
                      key={item.name} 
                      onClick={() => {
                        ensureViewAndAddComponent({
                          id: `panel-${Date.now()}`,
                          ...item,
                        })
                        handleClose()
                      }}
                      sx={{ p: 1.5 }}
                    >
                      {item.name}
                    </MenuItem>
                  ))}
                </Box>
              ))}
              
              {/* Custom Widgets Section */}
              {topNavBarWidgets.filter((widget: { name: string }) => widget.name.includes('Custom')).length > 0 && (
                <>
                  <Typography sx={{ px: 2, py: 1, fontWeight: 'bold', mt: 1, color: '#000000DE' }}>
                    Custom Widgets
                  </Typography>
                  <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
                  {topNavBarWidgets.filter((widget: { name: string }) => widget.name.includes('Custom')).map((topNavBarWidget: { name: string; items: Array<{ name: string; component: string; customProps?: { widgetId?: string } }> }) => (
                    <Box key={topNavBarWidget.name}>
                      {topNavBarWidget.items.map((item: { name: string; component: string; customProps?: { widgetId?: string } }) => (
                        <MenuItem 
                          key={item.name} 
                          onClick={() => {
                            ensureViewAndAddComponent({
                              id: `panel-${Date.now()}`,
                              ...item,
                            })
                            handleClose()
                          }}
                          sx={{ 
                            p: 1.5,
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          {item.name}
                        </MenuItem>
                      ))}
                    </Box>
                  ))}
                </>
              )}
              
              {/* Widget Management Section */}
              {userData.id === 'admin' && userData.role === 'ADMIN_ROLE' && (
                <>
                  <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
                  <MenuItem 
                    onClick={() => {
                      handleOpenWidgetsLibrary()
                      handleClose()
                    }}
                    sx={{ p: 1.5 }}
                  >
                    <ListItemIcon>
                      <FolderIcon fontSize="small" />
                    </ListItemIcon>
                    Manage Widgets
                  </MenuItem>
                </>
              )}
            </Menu>

            {/* Create Custom Widget Button */}
            {userData.id === 'admin' && userData.role === 'ADMIN_ROLE' && (
              <Button
                onClick={() => {
                  ensureViewAndAddComponent({
                    id: `widget-editor-${Date.now()}`,
                    name: "Widget Editor",
                    component: "WidgetEditor",
                  })
                  handleClose()
                }}
                sx={{ 
                  color: 'foreground.contrastPrimary', 
                  display: 'flex', 
                  alignItems: 'center',
                  minWidth: isTablet ? '40px' : 'auto',
                  mx: isTablet ? 0.5 : 1,
                  px: isTablet ? 1 : 2,
                }}
                startIcon={<CreateIcon />}
                data-tutorial-id="create-widget-button"
              >
                {!isTablet ? 'Widget Editor' : ''}
              </Button>
            )}
          </Box>

          {/* Right Side Elements */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* Help Button */}
            <Button
              onClick={handleOpenTutorial}
              sx={{ 
                color: 'foreground.contrastPrimary', 
                minWidth: 'auto',
                mx: 1
              }}
              data-tutorial-id="help-button"
              title="Open tutorial"
            >
              <HelpOutlineIcon />
            </Button>
            
            <Divider orientation="vertical" flexItem sx={{ mx: isTablet ? 1 : 2, bgcolor: 'background.light' }} />

            {/* User Menu */}
            <Button
              onClick={handleUserMenuOpen}
              sx={{ 
                color: 'foreground.contrastPrimary', 
                textTransform: 'none',
                minWidth: isTablet ? '45px' : 'auto',
                px: isTablet ? 0.5 : 2,
                display: 'flex'
              }}
              endIcon={isTablet ? null : <KeyboardArrowDownIcon />}
            >
              <Avatar 
                sx={{ 
                  width: 32, 
                  height: 32, 
                  bgcolor: 'primary.main',
                  mr: isTablet ? 0 : 1,
                  fontSize: '0.9rem'
                }}
              >
                {userData.id.substring(0, 2).toUpperCase()}
              </Avatar>
              {!isTablet && (
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.2 }}>
                    {userData.name}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.7, lineHeight: 1 }}>
                    {userData.role}
                  </Typography>
                </Box>
              )}
            </Button>
            <Menu
              anchorEl={userAnchorEl}
              open={Boolean(userAnchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={handleLogout} sx={{ color: 'white' }}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" sx={{ color: 'white' }}/>
                </ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      
      {/* Tutorial Modal */}
      <TutorialModal 
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onShowOnStartupToggle={handleToggleTutorialStartup}
      />
      
      {/* Custom Widgets Library Dialog */}
      {widgetsLibraryOpen && (
        <SavedWidgetsDialog
          open={widgetsLibraryOpen}
          widgets={WidgetStorage.getAllWidgets()}
          onClose={() => setWidgetsLibraryOpen(false)}
          onLoad={handleLoadWidget}
          onDelete={(id) => {
            WidgetStorage.deleteWidget(id)
          }}
        />
      )}
    </>
  )
}

export default TopNavBar 