/* eslint-disable */
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
  Tooltip,
  useMediaQuery,
  useTheme
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import NotificationsIcon from '@mui/icons-material/Notifications'
import FormatColorTextIcon from '@mui/icons-material/FormatColorText'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

import {
  TabPanelShared,
  ComponentPreview,
  EditorTabs,
  CustomColorControl
} from '../shared/SharedEditorComponents'

// Define props interface
interface SwitchProps {
  label?: string;
  defaultChecked?: boolean;
  labelPlacement?: 'end' | 'start' | 'top' | 'bottom';
  size?: 'small' | 'medium';
  useCustomColor?: boolean;
  customTrackColor?: string; // track color
  useCustomLabelColor?: boolean;
  customLabelColor?: string;
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
  // Theme and responsive design
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  
  // Tab state
  const [tabValue, setTabValue] = useState(0)
  
  // Switch states
  const [checked, setChecked] = useState(Boolean(props.defaultChecked))
  
  // Color states
  const [useCustomColor, setUseCustomColor] = useState(Boolean(props.useCustomColor))
  const [customTrackColor, setCustomTrackColor] = useState((props.customTrackColor as string) || '#90caf9')
  
  // Label color states
  const [useCustomLabelColor, setUseCustomLabelColor] = useState(Boolean(props.useCustomLabelColor))
  const [customLabelColor, setCustomLabelColor] = useState((props.customLabelColor as string) || '#000000')
  
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
    
    // Sync label color
    setUseCustomLabelColor(Boolean(props.useCustomLabelColor))
    if (props.customLabelColor) {
      setCustomLabelColor(props.customLabelColor as string)
    } else {
      setCustomLabelColor('#000000')
    }
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
    // Update both useCustomColor and customTrackColor in one onChange call
    onChange({
      ...props,
      useCustomColor: checked,
      customTrackColor: checked ? customTrackColor : undefined,
    })
    if (!checked) {
      setCustomTrackColor('#90caf9')
    }
  }
  
  // Label color toggle
  const handleLabelColorToggle = (useCustom: boolean) => {
    setUseCustomLabelColor(useCustom)
    // Update both useCustomLabelColor and customLabelColor in one onChange call
    onChange({
      ...props,
      useCustomLabelColor: useCustom,
      customLabelColor: useCustom ? customLabelColor : undefined,
    })
    if (!useCustom) {
      setCustomLabelColor('#000000')
    }
  }
  
  // Label color change
  const handleLabelColorChange = (color: string) => {
    setCustomLabelColor(color)
    handleChange('customLabelColor', color)
  }
  
  // Handle switch toggle in preview
  const handleSwitchToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setChecked(isChecked);
    // Dispatch toast event for preview
    if (showToast) {
      const message = isChecked
        ? (props.onMessage as string) || 'Switch turned ON'
        : (props.offMessage as string) || 'Switch turned OFF';
      const severity = (props.toastSeverity as string) as 'success' | 'error' | 'info' | 'warning';
      document.dispatchEvent(new CustomEvent('showWidgetToast', {
        detail: { message, severity },
        bubbles: true,
      }));
    }
  };
  
  // Generate preview style based on current settings
  const previewStyles = {
    '& .MuiSwitch-track': {
      backgroundColor: useCustomColor ? customTrackColor : undefined
    }
  }
  
  // Define tabs
  const editorTabs = [
    { label: 'Basic Settings', id: 'switch-basic', icon: <SettingsIcon fontSize={isMobile ? "small" : "medium"} /> },
    { label: 'Styling', id: 'switch-styling', icon: <FormatColorTextIcon fontSize={isMobile ? "small" : "medium"} /> },
    { label: 'Behaviour', id: 'switch-behaviour', icon: <NotificationsIcon fontSize={isMobile ? "small" : "medium"} /> }
  ]
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Preview Section */}
      <ComponentPreview>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          p: isMobile ? 1 : 2
        }}>
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
            label={
              <Typography 
                component="span" 
                sx={{ 
                  color: useCustomLabelColor ? customLabelColor : '#000000',
                  fontSize: isMobile ? '0.875rem' : undefined
                }}
              >
                {(props.label as string) || 'Switch'}
              </Typography>
            }
            labelPlacement={labelPlacement as 'end' | 'start' | 'top' | 'bottom'}
          />
          
          {/* Toast message preview */}
          {showToast && (
            <Box sx={{ 
              mt: isMobile ? 1 : 2, 
              p: isMobile ? 1 : 1.5, 
              width: '100%', 
              bgcolor: 'background.paper', 
              borderRadius: 1, 
              border: '1px dashed rgba(0,0,0,0.1)' 
            }}>
              <Typography 
                variant="caption" 
                sx={{ 
                  fontWeight: 'medium', 
                  display: 'block', 
                  mb: 0.5,
                  fontSize: isMobile ? '0.65rem' : undefined
                }}
              >
                Toast Messages:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip size="small" label="ON" color="success" sx={{ minWidth: '40px' }} />
                  <Typography variant="caption" sx={{ fontSize: isMobile ? '0.65rem' : undefined }}>
                    "{props.onMessage as string || 'Switch turned ON'}"
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip size="small" label="OFF" color="default" sx={{ minWidth: '40px' }} />
                  <Typography variant="caption" sx={{ fontSize: isMobile ? '0.65rem' : undefined }}>
                    "{props.offMessage as string || 'Switch turned OFF'}"
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
          
          {/* Properties summary */}
          <Box sx={{ 
            mt: isMobile ? 1 : 2, 
            pt: isMobile ? 1 : 2, 
            borderTop: '1px dashed rgba(0,0,0,0.1)', 
            width: '100%', 
            display: 'flex', 
            justifyContent: 'center', 
            flexWrap: 'wrap', 
            gap: isMobile ? 0.5 : 1 
          }}>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'text.secondary',
                fontSize: isMobile ? '0.65rem' : undefined
              }}
            >
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                {size}
              </Box>
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'text.secondary',
                fontSize: isMobile ? '0.65rem' : undefined
              }}
            >
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                placement: {labelPlacement}
              </Box>
            </Typography>
            {Boolean(props.defaultChecked) && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'text.secondary',
                  fontSize: isMobile ? '0.65rem' : undefined
                }}
              >
                <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                  default: ON
                </Box>
              </Typography>
            )}
            {Boolean(props.disabled) && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'text.secondary',
                  fontSize: isMobile ? '0.65rem' : undefined
                }}
              >
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
        <Grid container spacing={isMobile ? 1 : 2}>
          <Grid item xs={12}>
            <TextField
              label="Label Text"
              fullWidth
              onFocus={(e) => { e.target.select() }}
              value={(props.label as string) || ''}
              onChange={(e) => handleChange('label', e.target.value)}
              size={isMobile ? "small" : "medium"}
              InputLabelProps={{
                style: { fontSize: isMobile ? '0.875rem' : undefined }
              }}
              InputProps={{
                style: { fontSize: isMobile ? '0.875rem' : undefined }
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={isMobile ? 12 : 6}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.defaultChecked)}
                  onChange={(e) => handleChange('defaultChecked', e.target.checked)}
                  size={isMobile ? "small" : "medium"}
                />
              }
              label={
                <Typography sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>
                  Default Checked
                </Typography>
              }
              sx={{
                '& .MuiFormControlLabel-label': {
                  fontSize: isMobile ? '0.875rem' : undefined
                }
              }}
            />
          </Grid>
          <Grid item xs={12} sm={isMobile ? 12 : 6}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.disabled)}
                  onChange={(e) => handleChange('disabled', e.target.checked)}
                  size={isMobile ? "small" : "medium"}
                />
              }
              label={
                <Typography sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>
                  Disabled
                </Typography>
              }
              sx={{
                '& .MuiFormControlLabel-label': {
                  fontSize: isMobile ? '0.875rem' : undefined
                }
              }}
            />
          </Grid>

          <Grid item xs={12} sm={isMobile ? 12 : 6}>
            <FormControl fullWidth size={isMobile ? "small" : "medium"}>
              <InputLabel sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Label Placement</InputLabel>
              <Select
                value={labelPlacement}
                label="Label Placement"
                onChange={(e) => {
                  setLabelPlacement(e.target.value)
                  handleChange('labelPlacement', e.target.value)
                }}
                sx={{
                  '.MuiSelect-select': {
                    fontSize: isMobile ? '0.875rem' : undefined
                  }
                }}
              >
                <MenuItem value="end" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>End (Right)</MenuItem>
                <MenuItem value="start" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Start (Left)</MenuItem>
                <MenuItem value="top" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Top</MenuItem>
                <MenuItem value="bottom" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Bottom</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={isMobile ? 12 : 6}>
            <FormControl fullWidth size={isMobile ? "small" : "medium"}>
              <InputLabel sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Size</InputLabel>
              <Select
                value={size}
                label="Size"
                onChange={(e) => {
                  setSize(e.target.value)
                  handleChange('size', e.target.value)
                }}
                sx={{
                  '.MuiSelect-select': {
                    fontSize: isMobile ? '0.875rem' : undefined
                  }
                }}
              >
                <MenuItem value="small" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Small</MenuItem>
                <MenuItem value="medium" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Medium</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </TabPanelShared>
      
      {/* Styling Tab */}
      <TabPanelShared value={tabValue} index={1} id="switch-styling">
        <Grid container spacing={isMobile ? 1 : 2}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch 
                  checked={useCustomColor} 
                  onChange={handleCustomColorToggle}
                  size={isMobile ? "small" : "medium"}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>
                    Use Custom Track Color
                  </Typography>
                  <Tooltip title="Toggle custom track color for the switch">
                    <InfoOutlinedIcon fontSize={isMobile ? "small" : "medium"} sx={{ ml: 0.5 }} />
                  </Tooltip>
                </Box>
              }
              sx={{
                '& .MuiFormControlLabel-label': {
                  fontSize: isMobile ? '0.875rem' : undefined
                }
              }}
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
                size={isMobile ? "small" : "medium"}
                InputLabelProps={{
                  style: { fontSize: isMobile ? '0.875rem' : undefined }
                }}
                InputProps={{
                  style: { fontSize: isMobile ? '0.875rem' : undefined },
                  startAdornment: (
                    <Box sx={{ 
                      width: isMobile ? 16 : 18, 
                      height: isMobile ? 16 : 18, 
                      bgcolor: customTrackColor, 
                      borderRadius: 1, 
                      mr: 1, 
                      border: '1px solid rgba(0,0,0,0.1)' 
                    }} />
                  ),
                }}
              />
            </Grid>
          )}
          <Grid item xs={12}>
            <CustomColorControl
              useCustomColor={useCustomLabelColor}
              customColor={customLabelColor}
              onToggleCustomColor={handleLabelColorToggle}
              onColorChange={handleLabelColorChange}
              label="Use Custom Label Color"
            />
          </Grid>
        </Grid>
      </TabPanelShared>
      
      {/* Behaviour Tab */}
      <TabPanelShared value={tabValue} index={2} id="switch-behaviour">
        <Grid container spacing={isMobile ? 1 : 2}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={showToast}
                  onChange={(e) => {
                    setShowToast(e.target.checked)
                    handleChange('showToast', e.target.checked)
                  }}
                  size={isMobile ? "small" : "medium"}
                />
              }
              label={
                <Typography sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>
                  Show Toast Message on Change
                </Typography>
              }
              sx={{
                '& .MuiFormControlLabel-label': {
                  fontSize: isMobile ? '0.875rem' : undefined
                }
              }}
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
                  size={isMobile ? "small" : "medium"}
                  InputLabelProps={{
                    style: { fontSize: isMobile ? '0.875rem' : undefined }
                  }}
                  InputProps={{
                    style: { fontSize: isMobile ? '0.875rem' : undefined }
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Off Message"
                  fullWidth
                  value={(props.offMessage as string) || 'Switch turned OFF'}
                  onChange={(e) => handleChange('offMessage', e.target.value)}
                  placeholder="Message when turned OFF"
                  size={isMobile ? "small" : "medium"}
                  InputLabelProps={{
                    style: { fontSize: isMobile ? '0.875rem' : undefined }
                  }}
                  InputProps={{
                    style: { fontSize: isMobile ? '0.875rem' : undefined }
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth size={isMobile ? "small" : "medium"}>
                  <InputLabel sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Toast Severity</InputLabel>
                  <Select
                    value={(props.toastSeverity as string) || 'info'}
                    label="Toast Severity"
                    onChange={(e) => handleChange('toastSeverity', e.target.value)}
                    sx={{
                      '.MuiSelect-select': {
                        fontSize: isMobile ? '0.875rem' : undefined
                      }
                    }}
                  >
                    <MenuItem value="info" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Info</MenuItem>
                    <MenuItem value="success" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Success</MenuItem>
                    <MenuItem value="warning" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Warning</MenuItem>
                    <MenuItem value="error" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Error</MenuItem>
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