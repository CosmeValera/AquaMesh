import React, { useState, useEffect } from 'react'
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Menu, MenuItem, Tooltip } from '@mui/material'
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs'

import { ReactComponent as AddIcon } from '../../icons/add.svg'
import { ReactComponent as CloseIcon } from '../../icons/close.svg'
import SaveIcon from '@mui/icons-material/Save'
import MoreVertIcon from '@mui/icons-material/MoreVert'

import LayoutView from '../Layout/Layout'

import { useViews } from './ViewsProvider'
import './tabs.scss'

// Define custom dashboard type for localStorage
interface SavedDashboard {
  id: string;
  name: string;
  layout: any;
  timestamp: number;
}

// Dashboard Storage utilities
const DashboardStorage = {
  getAll: (): SavedDashboard[] => {
    try {
      const dashboards = localStorage.getItem('customDashboards');
      return dashboards ? JSON.parse(dashboards) : [];
    } catch (error) {
      console.error('Failed to parse saved dashboards', error);
      return [];
    }
  },
  
  save: (name: string, layout: any): void => {
    try {
      const dashboards = DashboardStorage.getAll();
      const newDashboard: SavedDashboard = {
        id: `dashboard-${Date.now()}`,
        name,
        layout,
        timestamp: Date.now()
      };
      
      localStorage.setItem('customDashboards', JSON.stringify([...dashboards, newDashboard]));
    } catch (error) {
      console.error('Failed to save dashboard', error);
    }
  },
  
  delete: (id: string): void => {
    try {
      const dashboards = DashboardStorage.getAll();
      const filteredDashboards = dashboards.filter(dashboard => dashboard.id !== id);
      localStorage.setItem('customDashboards', JSON.stringify(filteredDashboards));
    } catch (error) {
      console.error('Failed to delete dashboard', error);
    }
  }
};

const Views = () => {
  const {
    openViews,
    selectedView,
    setSelectedView,
    removeView,
    addView,
    updateLayout,
  } = useViews()
  
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [currentTabIndex, setCurrentTabIndex] = useState<number | null>(null);

  const handleSaveDialogOpen = (index: number) => {
    setCurrentTabIndex(index);
    setDashboardName(openViews[index]?.name || '');
    setSaveDialogOpen(true);
  };

  const handleSaveDialogClose = () => {
    setSaveDialogOpen(false);
    setDashboardName('');
    setCurrentTabIndex(null);
  };

  const handleSaveDashboard = () => {
    if (currentTabIndex !== null && dashboardName.trim() !== '') {
      const currentView = openViews[currentTabIndex];
      DashboardStorage.save(dashboardName, currentView.layout);
      handleSaveDialogClose();
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, index: number) => {
    setMenuAnchorEl(event.currentTarget);
    setCurrentTabIndex(index);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setCurrentTabIndex(null);
  };

  return (
    <Box>
      <Tabs
        selectedIndex={selectedView}
        onSelect={(index) => setSelectedView(index)}
        style={{ position: 'relative' }}
      >
        <TabList>
          {openViews.map((view, index) => (
            <Tab key={view.id}>
              <Typography
                variant="subtitle2"
                sx={{
                  flex: '1 0 0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginLeft: '0.5rem'
                }}
              >
                {view.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Tooltip title="Save Dashboard">
                  <IconButton
                    size="small"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleSaveDialogOpen(index);
                    }}
                    sx={{
                      p: 0.5,
                      mr: 0.5,
                      color: 'primary.light',
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    <SaveIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Box
                  className="close"
                  sx={{
                    display: 'flex',
                    p: 0.5,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: '999px',
                    transition: 'all .25s ease',
                    '&:hover': {
                      backgroundColor: 'action.contrastHover',
                    },
                  }}
                >
                  <CloseIcon
                    width={16}
                    height={16}
                    onClick={(ev) => {
                      // NOTE prevent the tab being closed from being selected too!
                      ev.stopPropagation()
                      removeView(view.id)
                    }}
                  />
                </Box>
              </Box>
            </Tab>
          ))}
          <Button
            size="small"
            variant="text"
            disableRipple
            sx={{
              position: 'relative',
              top: '3px',
              marginBottom: '8px',
              minWidth: 'fit-content',
              display: 'flex',
              alignItems: 'middle',
              gap: '8px',
              fontSize: '13px',
              p: '4px 12px',
              color: 'primary.light',
              transition: 'all .25s ease',
              '.MuiButton-startIcon': {
                transition: 'all .25s ease',
                m: 0,
                color: 'primary.light',
              },
              ':hover': {
                backgroundColor: 'transparent',
                color: 'primary.main',
                '.MuiButton-startIcon': {
                  color: 'primary.main',
                },
              },
            }}
            startIcon={<AddIcon width={16} height={16} />}
            onClick={() => addView()}
          />
        </TabList>
        {openViews.map((view) => (
          <TabPanel key={view.id}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                backgroundColor: 'background.default',
              }}
            >
              <Box sx={{ position: 'relative', flex: '1' }}>
                <LayoutView
                  layout={view.layout}
                  updateLayout={updateLayout}
                />
              </Box>
            </Box>
          </TabPanel>
        ))}
      </Tabs>

      {/* Save Dashboard Dialog */}
      <Dialog open={saveDialogOpen} onClose={handleSaveDialogClose}>
        <DialogTitle>Save Dashboard</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Dashboard Name"
            type="text"
            fullWidth
            variant="outlined"
            value={dashboardName}
            onChange={(e) => setDashboardName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSaveDialogClose}>Cancel</Button>
          <Button 
            onClick={handleSaveDashboard} 
            variant="contained" 
            color="primary"
            disabled={dashboardName.trim() === ''}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tab Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (currentTabIndex !== null) {
            handleSaveDialogOpen(currentTabIndex);
            handleMenuClose();
          }
        }}>
          Save Dashboard
        </MenuItem>
      </Menu>
    </Box>
  )
}

export default Views