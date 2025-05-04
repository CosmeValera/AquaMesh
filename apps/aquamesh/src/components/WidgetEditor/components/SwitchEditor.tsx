import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Divider,
  Grid,
  Tabs,
  Tab,
  Paper
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import ColorLensIcon from '@mui/icons-material/ColorLens'
import NotificationsIcon from '@mui/icons-material/Notifications'

// Define props interface
interface SwitchProps {
  label?: string;
  defaultChecked?: boolean;
  labelPlacement?: 'end' | 'start' | 'top' | 'bottom';
  size?: 'small' | 'medium';
  useCustomColor?: boolean;
  customColor?: string; // thumb color
  customTrackColor?: string; // track color
  showToast?: boolean;
  onMessage?: string;
  offMessage?: string;
  toastSeverity?: 'info' | 'success' | 'warning' | 'error';
  disabled?: boolean;
  [key: string]: unknown;
}

interface SwitchEditorProps {
  props: SwitchProps; // Use defined interface
  onChange: (updatedProps: SwitchProps) => void; // Use defined interface
}

// Tab panel component for organizing the editor
const TabPanel: React.FC<{ 
  children: React.ReactNode
  value: number
  index: number 
}> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`switch-tabpanel-${index}`}
      aria-labelledby={`switch-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  )
}

const SwitchEditor: React.FC<SwitchEditorProps> = ({ props, onChange }) => {
  // Tab state
  const [tabValue, setTabValue] = useState(0)
  
  // Switch states
  const [checked, setChecked] = useState(Boolean(props.defaultChecked))
  
  // Color states
  const [useCustomColor, setUseCustomColor] = useState(Boolean(props.useCustomColor))
  const [customColor, setCustomColor] = useState((props.customColor as string) || '#1976d2')
  const [customTrackColor, setCustomTrackColor] = useState((props.customTrackColor as string) || '#90caf9')
  
  // Size & Style
  const [size, setSize] = useState((props.size as string) || 'medium')
  const [labelPlacement, setLabelPlacement] = useState((props.labelPlacement as string) || 'end')
  const [showToast, setShowToast] = useState(Boolean(props.showToast))
  
  // Initialize state based on props
  useEffect(() => {
    setChecked(Boolean(props.defaultChecked))
    if (props.customColor) {
      setCustomColor(props.customColor as string)
    } else {
      setCustomColor('#1976d2')
    }
    
    if (props.customTrackColor) {
      setCustomTrackColor(props.customTrackColor as string)
    } else {
      setCustomTrackColor('#90caf9')
    }
    
    if (props.size) {
      setSize(props.size as string)
    }
    
    if (props.labelPlacement) {
      setLabelPlacement(props.labelPlacement as string)
    }
    
    setShowToast(Boolean(props.showToast))
  }, [props])
  
  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }
  
  // Generic change handler
  const handleChange = (name: string, value: unknown) => {
    onChange({ ...props, [name]: value })
  }
  
  // Custom color toggle
  const handleCustomColorToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    setUseCustomColor(checked)
    
    if (checked) {
      handleChange('useCustomColor', true)
      handleChange('customColor', customColor)
      handleChange('customTrackColor', customTrackColor)
    } else {
      handleChange('useCustomColor', undefined)
      handleChange('customColor', undefined)
      handleChange('customTrackColor', undefined)
      setCustomColor('#1976d2')
      setCustomTrackColor('#90caf9')
    }
  }
  
  // Generate preview style based on current settings
  const previewStyles = {
    color: useCustomColor ? customColor : undefined,
    '& .MuiSwitch-track': {
      backgroundColor: useCustomColor ? customTrackColor : undefined
    }
  }
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Preview Section */}
      <Paper variant="outlined" sx={{ mb: 2, p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <FormControlLabel
          control={
            <Switch 
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              size={size as 'small' | 'medium'}
              sx={previewStyles}
            />
          }
          label={(props.label as string) || 'Switch'}
          labelPlacement={labelPlacement as 'end' | 'start' | 'top' | 'bottom'}
        />
      </Paper>
      
      {/* Tabs Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Basic" icon={<SettingsIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Style" icon={<ColorLensIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Behavior" icon={<NotificationsIcon fontSize="small" />} iconPosition="start" />
        </Tabs>
      </Box>
      
      {/* Basic Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Label Text"
              fullWidth
              value={(props.label as string) || ''}
              onChange={(e) => handleChange('label', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.defaultChecked)}
                  onChange={(e) => handleChange('defaultChecked', e.target.checked)}
                />
              }
              label="Default Checked"
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Label Placement</InputLabel>
              <Select
                value={labelPlacement}
                label="Label Placement"
                onChange={(e) => {
                  setLabelPlacement(e.target.value)
                  handleChange('labelPlacement', e.target.value)
                }}
              >
                <MenuItem value="end">End (Right)</MenuItem>
                <MenuItem value="start">Start (Left)</MenuItem>
                <MenuItem value="top">Top</MenuItem>
                <MenuItem value="bottom">Bottom</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Style Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Size</InputLabel>
              <Select
                value={size}
                label="Size"
                onChange={(e) => {
                  setSize(e.target.value)
                  handleChange('size', e.target.value)
                }}
              >
                <MenuItem value="small">Small</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>
          
          {/* Custom Color Toggle */}
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={useCustomColor}
                  onChange={handleCustomColorToggle}
                />
              }
              label="Use Custom Colors"
            />
          </Grid>
          
          {/* Custom Color Pickers - Only show if useCustomColor is true */}
          {useCustomColor && (
            <>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Switch Color (On)
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => {
                        setCustomColor(e.target.value)
                        handleChange('customColor', e.target.value)
                      }}
                      style={{ 
                        width: '36px', 
                        height: '36px', 
                        padding: 0, 
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    />
                    <TextField 
                      size="small" 
                      value={customColor}
                      onChange={(e) => {
                        setCustomColor(e.target.value)
                        handleChange('customColor', e.target.value)
                      }}
                      placeholder="#1976d2"
                      variant="outlined"
                    />
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Track Color
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <input
                      type="color"
                      value={customTrackColor}
                      onChange={(e) => {
                        setCustomTrackColor(e.target.value)
                        handleChange('customTrackColor', e.target.value)
                      }}
                      style={{ 
                        width: '36px', 
                        height: '36px', 
                        padding: 0, 
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    />
                    <TextField 
                      size="small" 
                      value={customTrackColor}
                      onChange={(e) => {
                        setCustomTrackColor(e.target.value)
                        handleChange('customTrackColor', e.target.value)
                      }}
                      placeholder="#90caf9"
                      variant="outlined"
                    />
                  </Box>
                </Box>
              </Grid>
            </>
          )}
        </Grid>
      </TabPanel>
      
      {/* Behavior Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={showToast}
                  onChange={(e) => {
                    setShowToast(e.target.checked)
                    handleChange('showToast', e.target.checked)
                  }}
                />
              }
              label="Show Toast on Toggle"
            />
          </Grid>
          
          {showToast && (
            <>
              <Grid item xs={12}>
                <TextField
                  label="On Message"
                  fullWidth
                  value={(props.onMessage as string) || 'Switch turned ON'}
                  onChange={(e) => handleChange('onMessage', e.target.value)}
                  placeholder="Switch turned ON"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Off Message"
                  fullWidth
                  value={(props.offMessage as string) || 'Switch turned OFF'}
                  onChange={(e) => handleChange('offMessage', e.target.value)}
                  placeholder="Switch turned OFF"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Toast Severity</InputLabel>
                  <Select
                    value={(props.toastSeverity as string) || 'info'}
                    label="Toast Severity"
                    onChange={(e) => handleChange('toastSeverity', e.target.value)}
                  >
                    <MenuItem value="info">Info</MenuItem>
                    <MenuItem value="success">Success</MenuItem>
                    <MenuItem value="warning">Warning</MenuItem>
                    <MenuItem value="error">Error</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}
          
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.disabled)}
                  onChange={(e) => handleChange('disabled', e.target.checked)}
                />
              }
              label="Disabled"
            />
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  )
}

export default SwitchEditor 