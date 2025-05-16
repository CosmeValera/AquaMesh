import React, { useState, useEffect } from 'react'
import {
  Button,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  Typography,
  useTheme,
  useMediaQuery,
  Box
} from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import DashboardIcon from '@mui/icons-material/Dashboard'
import FolderIcon from '@mui/icons-material/Folder'
import { useDashboards } from './DashboardProvider'
import SavedDashboardsDialog from './DashboardLibrary'
import { Layout } from '../../types/types'

// Define saved dashboard type
interface SavedDashboard {
  id: string;
  name: string;
  layout: Layout;
  description?: string;
  tags?: string[];
  isPublic?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Phone button with label component
interface PhoneButtonProps {
  icon: React.ReactNode
  label: string
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  sx?: React.CSSProperties | Record<string, unknown>
  'data-tutorial-id'?: string
}

const PhoneButtonWithLabel: React.FC<PhoneButtonProps> = ({ icon, label, onClick, sx, ...props }) => {
  return (
    <Button
      onClick={onClick}
      sx={{
        color: 'foreground.contrastPrimary',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: '48px',
        mx: 0.5,
        px: 1,
        ...sx
      }}
      {...props}
    >
      {icon}
      <Typography variant="caption" sx={{ fontSize: '0.6rem', mt: 0.3, lineHeight: 1 }}>
        {label}
      </Typography>
    </Button>
  )
}

const DashboardOptionsMenu: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [customDashboards, setCustomDashboards] = useState<SavedDashboard[]>([])
  const [dashboardLibraryOpen, setDashboardLibraryOpen] = useState(false)
  
  const { addDashboard } = useDashboards()
  
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'))
  
  // Load saved dashboards from localStorage on component mount
  useEffect(() => {
    loadSavedDashboards()
  }, [])
  
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
  
  // Handle opening and closing dropdown
  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    loadSavedDashboards() // Refresh the list when opening menu
    setAnchorEl(event.currentTarget)
  }
  
  const handleClose = () => {
    setAnchorEl(null)
  }
  
  // Create a dashboard with predefined layout
  const createDashboardWithLayout = (dashboardName: string, layout: Layout) => {
    addDashboard({
      name: dashboardName,
      layout
    })
    handleClose()
  }
  
  // Load a saved dashboard
  const loadCustomDashboard = (dashboard: SavedDashboard) => {
    createDashboardWithLayout(dashboard.name, dashboard.layout)
  }
  
  // Open dashboard library dialog
  const handleOpenDashboardLibrary = () => {
    handleClose()
    setDashboardLibraryOpen(true)
  }
  
  // Handle dashboard library dialog close
  const handleDashboardLibraryClose = () => {
    setDashboardLibraryOpen(false)
    loadSavedDashboards() // Refresh dashboards list
  }
  
  return (
    <>
      {isPhone ? (
        <PhoneButtonWithLabel
          icon={<DashboardIcon />}
          label="Dash"
          onClick={handleMenuOpen}
          data-tutorial-id="dashboards-button"
        />
      ) : (
        <Button
          onClick={handleMenuOpen}
          sx={{ 
            color: 'foreground.contrastPrimary', 
            display: 'flex', 
            alignItems: 'center',
            minWidth: isTablet ? '40px' : 'auto',
            mx: isTablet ? 0.75 : 1,
            px: isTablet ? 1.5 : 2,
          }}
          startIcon={<DashboardIcon />}
          endIcon={isPhone ? null : <KeyboardArrowDownIcon />}
          data-tutorial-id="dashboards-button"
        >
          {isTablet ? 'D.' : 'Dashboards'}
        </Button>
      )}
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
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
        {/* Dashboard Management Section */}
        <MenuItem 
          onClick={handleOpenDashboardLibrary}
          sx={{ p: 1.5 }}
        >
          <ListItemIcon>
            <FolderIcon fontSize="small" sx={{ color: 'foreground.contrastPrimary' }}/>
          </ListItemIcon>
          Manage Dashboards
        </MenuItem>

        <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

        {/* Predefined Dashboards Section */}
        <Typography sx={{ px: 2, py: 1, fontWeight: 'bold', mt: 1, color: '#000000DE' }}>
          Predefined Dashboards
        </Typography>
        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
        <MenuItem 
          onClick={() => createDashboardWithLayout('Control Flow Dashboard', { 
            type: 'row', 
            weight: 100, 
            children: [{ type: 'tabset', weight: 100, active: true, children: [{ type: 'tab', name: 'Control Flow', component: 'ControlFlow' }] }]
          })}
          sx={{ p: 1.5 }}
        >
          Control Flow Dashboard
        </MenuItem>
        <MenuItem 
          onClick={() => createDashboardWithLayout('System Lens Dashboard', { 
            type: 'row', 
            weight: 100, 
            children: [{ type: 'tabset', weight: 100, active: true, children: [{ type: 'tab', name: 'System Lens', component: 'SystemLens' }] }]
          })}
          sx={{ p: 1.5 }}
        >
          System Lens Dashboard
        </MenuItem>
        <MenuItem 
          onClick={() => createDashboardWithLayout('Control Flow + System Lens', { 
            type: 'row', 
            weight: 100, 
            children: [
              { type: 'tabset', weight: 50, active: true, children: [{ type: 'tab', name: 'Control Flow', component: 'ControlFlow' }] },
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
            {[...customDashboards].reverse().map((dashboard) => (
              <MenuItem 
                key={dashboard.id}
                onClick={() => loadCustomDashboard(dashboard)}
                sx={{ p: 1.5 }}
              >
                {dashboard.name}
              </MenuItem>
            ))}
          </>
        )}
      </Menu>
      
      {/* Dashboard Library Dialog */}
      <SavedDashboardsDialog
        open={dashboardLibraryOpen}
        onClose={handleDashboardLibraryClose}
      />
    </>
  )
}

export default DashboardOptionsMenu 