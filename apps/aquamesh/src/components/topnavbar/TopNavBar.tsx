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
import DashboardIcon from '@mui/icons-material/Dashboard'
import WidgetsIcon from '@mui/icons-material/Widgets'
import CreateIcon from '@mui/icons-material/Create'
import DeleteIcon from '@mui/icons-material/Delete'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

import useTopNavBarWidgets from '../../customHooks/useTopNavBarWidgets'
import { useLayout } from '../Layout/LayoutProvider'
import { ReactComponent as Logo } from '../../../public/logo.svg'
import { useViews } from '../Views/ViewsProvider'
import { DefaultDashboard } from '../Views/fixture'
import { Layout } from '../../types/types'
import TutorialModal from '../tutorial/TutorialModal'

// Define user data type
interface UserData {
  id: string
  name: string
  role: string
}

interface TopNavBarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

// Define saved dashboard type
interface SavedDashboard {
  id: string;
  name: string;
  layout: Layout;
  timestamp: number;
}

const TopNavBar: React.FC<TopNavBarProps> = () => {
  // State for different dropdown menus
  const [viewsAnchorEl, setViewsAnchorEl] = useState<null | HTMLElement>(null)
  const [panelsAnchorEl, setPanelsAnchorEl] = useState<null | HTMLElement>(null)
  const [userAnchorEl, setUserAnchorEl] = useState<null | HTMLElement>(null)
  const [userData, setUserData] = useState<UserData>({ id: 'admin', name: 'Admin User', role: 'ADMIN_ROLE' })
  const [customDashboards, setCustomDashboards] = useState<SavedDashboard[]>([])
  
  // Tutorial modal state
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [showTutorialOnStartup, setShowTutorialOnStartup] = useState(() => {
    return !localStorage.getItem('aquamesh-tutorial-shown')
  })
  
  const { topNavBarWidgets } = useTopNavBarWidgets()
  const { addComponent } = useLayout()
  const { addView } = useViews()
  const navigate = useNavigate()
  
  // Use theme and media query for responsive design
  const theme = useTheme()
  const isTablet = useMediaQuery(theme.breakpoints.down('md'))
  
  // Load user data and saved dashboards from localStorage on component mount
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

    // Load saved dashboards
    loadSavedDashboards()
    
    // Check if tutorial should be shown
    if (showTutorialOnStartup) {
      setTutorialOpen(true)
    }
  }, [showTutorialOnStartup])

  const loadSavedDashboards = () => {
    try {
      const dashboards = localStorage.getItem('customDashboards')
      if (dashboards) {
        setCustomDashboards(JSON.parse(dashboards))
      }
    } catch (error) {
      console.error('Failed to load saved dashboards', error)
    }
  }

  // Delete a saved dashboard
  const handleDeleteDashboard = (id: string, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      const dashboards = customDashboards.filter(dashboard => dashboard.id !== id)
      localStorage.setItem('customDashboards', JSON.stringify(dashboards))
      setCustomDashboards(dashboards)
    } catch (error) {
      console.error('Failed to delete dashboard', error)
    }
  }
  
  // Handle opening and closing dropdowns
  const handleViewsMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    loadSavedDashboards() // Refresh the list when opening menu
    setViewsAnchorEl(event.currentTarget)
  }
  
  const handlePanelsMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setPanelsAnchorEl(event.currentTarget)
  }
  
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setUserAnchorEl(event.currentTarget)
  }
  
  const handleClose = () => {
    setViewsAnchorEl(null)
    setPanelsAnchorEl(null)
    setUserAnchorEl(null)
  }

  const handleLogout = () => {
    handleClose()
    navigate('/login')
  }
  
  // Create a view with predefined layout
  const createViewWithLayout = (viewName: string, layout: Layout) => {
    const newView: DefaultDashboard = {
      name: viewName,
      layout
    }
    
    addView(newView)
    handleClose()
  }

  // Load a saved dashboard
  const loadCustomDashboard = (dashboard: SavedDashboard) => {
    createViewWithLayout(dashboard.name, dashboard.layout)
  }
  
  // Open tutorial modal
  const handleOpenTutorial = () => {
    setTutorialOpen(true)
  }
  
  // Toggle tutorial display on startup
  const handleToggleTutorialStartup = () => {
    setShowTutorialOnStartup(!showTutorialOnStartup)
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
              mr: 4
            }}
          >
            <Logo height="32px" width="32px" style={{ marginRight: isTablet ? '4px' : '12px' }} />
            AquaMesh
          </Typography>

          {/* Main Navigation Items */}
          <Box sx={{ flexGrow: 1, display: 'flex' }}>
            {/* Dashboard/Views Menu */}
            <Button
              onClick={handleViewsMenuOpen}
              sx={{ 
                color: 'foreground.contrastPrimary', 
                display: 'flex', 
                alignItems: 'center',
                minWidth: isTablet ? '40px' : 'auto',
                mx: isTablet ? 0.5 : 1,
                px: isTablet ? 1 : 2,
              }}
              startIcon={<DashboardIcon />}
              endIcon={<KeyboardArrowDownIcon />}
              data-tutorial-id="dashboards-button"
            >
              {!isTablet ? 'Dashboards' : 'D.'}
            </Button>
            <Menu
              anchorEl={viewsAnchorEl}
              open={Boolean(viewsAnchorEl)}
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
              {/* Simple Dashboards Section */}
              <Typography sx={{ px: 2, py: 1, fontWeight: 'bold', mt: 1, color: '#000000DE' }}>
                Simple Dashboards
              </Typography>
              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
              <MenuItem 
                onClick={() => createViewWithLayout('Control Flow View', { 
                  type: 'row', 
                  weight: 100, 
                  children: [{ type: 'tabset', weight: 100, children: [{ type: 'tab', name: 'Control Flow', component: 'ControlFlow' }] }]
                })}
                sx={{ p: 1.5 }}
              >
                Control Flow View
              </MenuItem>
              <MenuItem 
                onClick={() => createViewWithLayout('System Lens View', { 
                  type: 'row', 
                  weight: 100, 
                  children: [{ type: 'tabset', weight: 100, children: [{ type: 'tab', name: 'System Lens', component: 'SystemLens' }] }]
                })}
                sx={{ p: 1.5 }}
              >
                System Lens View
              </MenuItem>

              {/* Combined Dashboards Section */}
              <Typography sx={{ px: 2, py: 1, fontWeight: 'bold', mt: 1, color: '#000000DE' }}>
                Combined Dashboards
              </Typography>
              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
              <MenuItem 
                onClick={() => createViewWithLayout('Combined View', { 
                  type: 'row', 
                  weight: 100, 
                  children: [
                    { type: 'tabset', weight: 50, children: [{ type: 'tab', name: 'Control Flow', component: 'ControlFlow' }] },
                    { type: 'tabset', weight: 50, children: [{ type: 'tab', name: 'System Lens', component: 'SystemLens' }] }
                  ]
                })}
                sx={{ p: 1.5 }}
              >
                Combined View
              </MenuItem>
              <MenuItem 
                onClick={() => createViewWithLayout('Control Flow + System Lens', { 
                  type: 'row', 
                  weight: 100, 
                  children: [
                    { type: 'tabset', weight: 50, children: [{ type: 'tab', name: 'Control Flow', component: 'ControlFlow' }] },
                    { type: 'tabset', weight: 50, children: [{ type: 'tab', name: 'System Lens', component: 'SystemLens' }] }
                  ]
                })}
                sx={{ p: 1.5 }}
              >
                Control Flow + System Lens
              </MenuItem>

              {/* Custom Dashboards Section */}
              {customDashboards.length > 0 && (
                <>
                  <Typography sx={{ px: 2, py: 1, fontWeight: 'bold', mt: 1, color: '#000000DE' }}>
                    Custom Dashboards
                  </Typography>
                  <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
                  {customDashboards.map((dashboard) => (
                    <MenuItem 
                      key={dashboard.id}
                      onClick={() => loadCustomDashboard(dashboard)}
                      sx={{ 
                        p: 1.5,
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      {dashboard.name}
                      <ListItemIcon sx={{ ml: 2, minWidth: 'auto' }}>
                        <DeleteIcon 
                          fontSize="small" 
                          onClick={(e) => handleDeleteDashboard(dashboard.id, e)}
                          sx={{ color: 'error.main' }}
                        />
                      </ListItemIcon>
                    </MenuItem>
                  ))}
                </>
              )}
            </Menu>

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
              {userData.id === 'admin' && userData.role === 'ADMIN_ROLE' && (
                <MenuItem 
                  onClick={() => {
                    addComponent({
                      id: `widget-editor-${Date.now()}`,
                      name: "Widget Editor",
                      component: "WidgetEditor",
                    })
                    handleClose()
                  }}
                  sx={{ 
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'primary.main',
                    fontWeight: 'bold',
                    p: 2
                  }}
                  data-tutorial-id="create-widget-option"
                >
                  <ListItemIcon>
                    <CreateIcon fontSize="small" color="primary" />
                  </ListItemIcon>
                  Create Custom Widget
                </MenuItem>
              )}
              
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
                        addComponent({
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
              <Typography sx={{ px: 2, py: 1, fontWeight: 'bold', mt: 1, color: '#000000DE' }}>
                Custom Widgets
              </Typography>
              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
              {topNavBarWidgets.filter((widget: { name: string }) => widget.name.includes('Custom')).map((topNavBarWidget: { name: string; items: Array<{ name: string; component: string }> }) => (
                <Box key={topNavBarWidget.name}>
                  {topNavBarWidget.items.map((item: { name: string; component: string }) => (
                    <MenuItem 
                      key={item.name} 
                      onClick={() => {
                        addComponent({
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
            </Menu>
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
    </>
  )
}

export default TopNavBar 