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
  Grid,
  Chip,
  Tooltip
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import NotificationsIcon from '@mui/icons-material/Notifications'
import FormatColorTextIcon from '@mui/icons-material/FormatColorText'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

import {
  TabPanelShared,
  ComponentPreview,
  EditorTabs
} from '../shared/SharedEditorComponents'

// Define props interface
interface SwitchProps {
  label?: string;
  defaultChecked?: boolean;
  labelPlacement?: 'end' | 'start' | 'top' | 'bottom';
  size?: 'small' | 'medium';
  useCustomColor?: boolean;
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

const SwitchEditor: React.FC<SwitchEditorProps> = ({ props, onChange }) => {
  // Tab state
  const [tabValue, setTabValue] = useState(0)
  
  // Switch states
  const [checked, setChecked] = useState(Boolean(props.defaultChecked))
  
  // Color states
  const [useCustomColor, setUseCustomColor] = useState(Boolean(props.useCustomColor))
  const [customTrackColor, setCustomTrackColor] = useState((props.customTrackColor as string) || '#90caf9')
  
  // Size & Style
  const [size, setSize] = useState((props.size as string) || 'medium')
  const [labelPlacement, setLabelPlacement] = useState((props.labelPlacement as string) || 'end')
  const [showToast, setShowToast] = useState(Boolean(props.showToast))
  
  // Initialize state based on props
  useEffect(() => {
    setChecked(Boolean(props.defaultChecked))
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
      handleChange('customTrackColor', customTrackColor)
    } else {
      handleChange('useCustomColor', undefined)
      handleChange('customTrackColor', undefined)
      setCustomTrackColor('#90caf9')
    }
  }
  
  // Handle switch toggle in preview
  const handleSwitchToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setChecked(isChecked);
  };
  
  // Generate preview style based on current settings
  const previewStyles = {
    '& .MuiSwitch-track': {
      backgroundColor: useCustomColor ? customTrackColor : undefined
    }
  }
  
  // Define tabs
  const editorTabs = [
    { label: 'Basic Settings', id: 'switch-basic', icon: <SettingsIcon fontSize="small" /> },
    { label: 'Styling', id: 'switch-styling', icon: <FormatColorTextIcon fontSize="small" /> },
    { label: 'Behaviour', id: 'switch-behaviour', icon: <NotificationsIcon fontSize="small" /> }
  ]
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Preview Section */}
      <ComponentPreview>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch 
                checked={checked}
                onChange={handleSwitchToggle}
                size={size as 'small' | 'medium'}
                disabled={Boolean(props.disabled)}
                sx={previewStyles}
              />
            }
            label={(props.label as string) || 'Switch'}
            labelPlacement={labelPlacement as 'end' | 'start' | 'top' | 'bottom'}
          />
          
          {/* Toast message preview */}
          {showToast && (
            <Box sx={{ mt: 2, p: 1.5, width: '100%', bgcolor: 'background.paper', borderRadius: 1, border: '1px dashed rgba(0,0,0,0.1)' }}>
              <Typography variant="caption" sx={{ fontWeight: 'medium', display: 'block', mb: 0.5 }}>
                Toast Messages:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip size="small" label="ON" color="success" sx={{ minWidth: '40px' }} />
                  <Typography variant="caption">
                    "{props.onMessage as string || 'Switch turned ON'}"
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip size="small" label="OFF" color="default" sx={{ minWidth: '40px' }} />
                  <Typography variant="caption">
                    "{props.offMessage as string || 'Switch turned OFF'}"
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
          
          {/* Properties summary */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed rgba(0,0,0,0.1)', width: '100%', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                {size}
              </Box>
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                placement: {labelPlacement}
              </Box>
            </Typography>
            {Boolean(props.defaultChecked) && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                  default: ON
                </Box>
              </Typography>
            )}
            {Boolean(props.disabled) && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                  disabled
                </Box>
              </Typography>
            )}
          </Box>
        </Box>
      </ComponentPreview>
      
      {/* Tabs Navigation */}
      <EditorTabs
        value={tabValue}
        onChange={handleTabChange}
        tabs={editorTabs}
      />
      
      {/* Basic Settings Tab */}
      <TabPanelShared value={tabValue} index={0} id="switch-basic">
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Label Text"
              fullWidth
              value={(props.label as string) || ''}
              onChange={(e) => handleChange('label', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
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
          <Grid item xs={12} sm={6}>
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

          <Grid item xs={12} sm={6}>
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

          <Grid item xs={12} sm={6}>
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
        </Grid>
      </TabPanelShared>
      
      {/* Styling Tab */}
      <TabPanelShared value={tabValue} index={1} id="switch-styling">
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Switch checked={useCustomColor} onChange={handleCustomColorToggle} />}
              label={<Box sx={{ display: 'flex', alignItems: 'center' }}>
                Use Custom Track Color
                <Tooltip title="Toggle custom track color for the switch">
                  <InfoOutlinedIcon fontSize="small" sx={{ ml: 0.5 }} />
                </Tooltip>
              </Box>}
            />
          </Grid>
          {useCustomColor && (
            <Grid item xs={12}>
              <TextField
                label="Track Color"
                fullWidth
                value={customTrackColor}
                onChange={(e) => {
                  setCustomTrackColor(e.target.value)
                  handleChange('customTrackColor', e.target.value)
                }}
                InputProps={{
                  startAdornment: (
                    <Box sx={{ width: 18, height: 18, bgcolor: customTrackColor, borderRadius: 1, mr: 1, border: '1px solid rgba(0,0,0,0.1)' }} />
                  ),
                }}
              />
            </Grid>
          )}
        </Grid>
      </TabPanelShared>
      
      {/* Behaviour Tab */}
      <TabPanelShared value={tabValue} index={2} id="switch-behaviour">
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
              label="Show Toast Message on Change"
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
                  placeholder="Message when turned ON"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Off Message"
                  fullWidth
                  value={(props.offMessage as string) || 'Switch turned OFF'}
                  onChange={(e) => handleChange('offMessage', e.target.value)}
                  placeholder="Message when turned OFF"
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
        </Grid>
      </TabPanelShared>
    </Box>
  )
}

export default SwitchEditor 