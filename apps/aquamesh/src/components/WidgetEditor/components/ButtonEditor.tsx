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
  IconButton,
  Button as MuiButton,
  Collapse,
  Paper,
  Tooltip,
  Slider,
  InputAdornment,
} from '@mui/material'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import LinkIcon from '@mui/icons-material/Link'
import NotificationsIcon from '@mui/icons-material/Notifications'
import CodeIcon from '@mui/icons-material/Code'
import SettingsIcon from '@mui/icons-material/Settings'
import PreviewIcon from '@mui/icons-material/Preview'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ColorLensIcon from '@mui/icons-material/ColorLens'
import SendIcon from '@mui/icons-material/Send'
import SaveIcon from '@mui/icons-material/Save'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

// Icon mapping for selection
const AVAILABLE_ICONS = {
  add: AddIcon,
  delete: DeleteIcon,
  link: LinkIcon,
  notification: NotificationsIcon,
  code: CodeIcon,
  settings: SettingsIcon,
  preview: PreviewIcon,
  openNew: OpenInNewIcon,
  colorLens: ColorLensIcon,
  send: SendIcon,
  save: SaveIcon,
  upload: CloudUploadIcon,
  check: CheckCircleIcon
}

interface ButtonEditorProps {
  props: Record<string, unknown>
  onChange: (updatedProps: Record<string, unknown>) => void
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
      id={`button-tabpanel-${index}`}
      aria-labelledby={`button-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  )
}

const ButtonEditor: React.FC<ButtonEditorProps> = ({ props, onChange }) => {
  // Tab state
  const [tabValue, setTabValue] = useState(0)
  
  // State for custom color picker
  const [useCustomColor, setUseCustomColor] = useState(false)
  const [customColor, setCustomColor] = useState('#1976d2')
  const [customHoverColor, setCustomHoverColor] = useState('#1565c0')
  
  // Typography states
  const [fontWeight, setFontWeight] = useState<number>(
    typeof props.fontWeight === 'number' ? props.fontWeight : 400
  )
  const [isBold, setIsBold] = useState(fontWeight >= 600)
  const [isItalic, setIsItalic] = useState(Boolean(props.fontStyle === 'italic'))
  const [hasUnderline, setHasUnderline] = useState(Boolean(props.textDecoration === 'underline'))
  
  // Initialize selected icon
  const [selectedIcon, setSelectedIcon] = useState<string>(
    typeof props.iconName === 'string' ? props.iconName : 'add'
  )
  
  // Initialize custom colors if they exist in props
  useEffect(() => {
    if (props.customColor) {
      setUseCustomColor(true)
      setCustomColor(props.customColor as string)
    }
    
    if (props.customHoverColor) {
      setCustomHoverColor(props.customHoverColor as string)
    }
    
    // Set typography states based on props
    if (props.fontWeight) {
      const weight = Number(props.fontWeight)
      setFontWeight(weight)
      setIsBold(weight >= 600)
    }
    
    setIsItalic(Boolean(props.fontStyle === 'italic'))
    setHasUnderline(Boolean(props.textDecoration === 'underline'))
    
    // Set icon if it exists
    if (props.iconName && typeof props.iconName === 'string') {
      setSelectedIcon(props.iconName)
    }
  }, [])
  
  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }
  
  // Update font styling
  const toggleBold = () => {
    const newIsBold = !isBold
    setIsBold(newIsBold)
    const newWeight = newIsBold ? 700 : 400
    setFontWeight(newWeight)
    handleChange('fontWeight', newWeight)
  }
  
  const toggleItalic = () => {
    const newIsItalic = !isItalic
    setIsItalic(newIsItalic)
    handleChange('fontStyle', newIsItalic ? 'italic' : 'normal')
  }
  
  const toggleUnderline = () => {
    const newHasUnderline = !hasUnderline
    setHasUnderline(newHasUnderline)
    handleChange('textDecoration', newHasUnderline ? 'underline' : 'none')
  }
  
  // Update custom colors
  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomColor(e.target.value)
    handleChange('customColor', e.target.value)
  }
  
  const handleHoverColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomHoverColor(e.target.value)
    handleChange('customHoverColor', e.target.value)
  }
  
  // Toggle custom color mode
  const handleCustomColorToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    setUseCustomColor(checked)
    
    if (checked) {
      // Apply custom colors
      handleChange('customColor', customColor)
      handleChange('customHoverColor', customHoverColor)
    } else {
      // Remove custom colors
      const newProps = { ...props }
      delete newProps.customColor
      delete newProps.customHoverColor
      onChange(newProps)
    }
  }
  
  // Generic change handler
  const handleChange = (name: string, value: unknown) => {
    onChange({ ...props, [name]: value })
  }
  
  // Preview styles based on current props
  const previewStyles = {
    fontWeight: fontWeight,
    fontStyle: isItalic ? 'italic' : 'normal',
    textDecoration: hasUnderline ? 'underline' : 'none',
    ...(useCustomColor && { 
      backgroundColor: props.variant === 'contained' ? customColor : 'transparent',
      borderColor: customColor,
      color: props.variant === 'contained' ? '#fff' : customColor,
      '&:hover': {
        backgroundColor: props.variant === 'contained' ? customHoverColor : 'rgba(25, 118, 210, 0.04)',
        borderColor: customHoverColor
      }
    })
  }
  
  // Get the appropriate icon component
  const getIconComponent = (iconName: string) => {
    return AVAILABLE_ICONS[iconName as keyof typeof AVAILABLE_ICONS] || AddIcon
  }
  
  // Current icon component
  const CurrentIcon = getIconComponent(selectedIcon)
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Preview Section */}
      <Paper variant="outlined" sx={{ mb: 2, p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <MuiButton
          variant={(props.variant as 'contained' | 'outlined' | 'text') || 'contained'}
          color={(props.color as 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info') || 'primary'}
          size={(props.size as 'small' | 'medium' | 'large') || 'medium'}
          sx={previewStyles}
          endIcon={props.showEndIcon ? <OpenInNewIcon /> : undefined}
          startIcon={props.showStartIcon ? <CurrentIcon /> : undefined}
        >
          {props.text as string || 'Button Text'}
        </MuiButton>
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
          <Tab label="Action" icon={<OpenInNewIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Style" icon={<ColorLensIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Advanced" icon={<CodeIcon fontSize="small" />} iconPosition="start" />
        </Tabs>
      </Box>
      
      {/* Basic Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Button Text"
              fullWidth
              value={(props.text as string) || ''}
              onChange={(e) => handleChange('text', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Variant</InputLabel>
              <Select
                value={(props.variant as string) || 'contained'}
                label="Variant"
                onChange={(e) => handleChange('variant', e.target.value)}
              >
                <MenuItem value="contained">Contained</MenuItem>
                <MenuItem value="outlined">Outlined</MenuItem>
                <MenuItem value="text">Text</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Size</InputLabel>
              <Select
                value={(props.size as string) || 'medium'}
                label="Size"
                onChange={(e) => handleChange('size', e.target.value)}
              >
                <MenuItem value="small">Small</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="large">Large</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Color</InputLabel>
              <Select
                value={(props.color as string) || 'primary'}
                label="Color"
                onChange={(e) => handleChange('color', e.target.value)}
                disabled={useCustomColor}
              >
                <MenuItem value="primary">Primary</MenuItem>
                <MenuItem value="secondary">Secondary</MenuItem>
                <MenuItem value="success">Success</MenuItem>
                <MenuItem value="error">Error</MenuItem>
                <MenuItem value="warning">Warning</MenuItem>
                <MenuItem value="info">Info</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.fullWidth)}
                  onChange={(e) => handleChange('fullWidth', e.target.checked)}
                />
              }
              label="Full Width"
            />
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Action Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Click Action</InputLabel>
              <Select
                value={(props.clickAction as string) || 'toast'}
                label="Click Action"
                onChange={(e) => handleChange('clickAction', e.target.value)}
              >
                <MenuItem value="toast">Show Toast</MenuItem>
                <MenuItem value="openUrl">Open URL</MenuItem>
                <MenuItem value="none">No Action</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {/* Toast Action Options */}
          {(props.clickAction === 'toast' || !props.clickAction) && (
            <>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(props.showToast)}
                      onChange={(e) => handleChange('showToast', e.target.checked)}
                    />
                  }
                  label="Show Toast on Click"
                />
              </Grid>
              
              {Boolean(props.showToast) && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      label="Toast Message"
                      fullWidth
                      value={(props.toastMessage as string) || ''}
                      onChange={(e) => handleChange('toastMessage', e.target.value)}
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
            </>
          )}
          
          {/* URL Action Options */}
          {props.clickAction === 'openUrl' && (
            <Grid item xs={12}>
              <TextField
                label="URL to Open"
                fullWidth
                placeholder="https://example.com"
                value={String(props.url || '')}
                onChange={(e) => handleChange('url', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          )}
        </Grid>
      </TabPanel>
      
      {/* Style Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={2}>
          {/* Typography controls */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Text Styling
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Tooltip title="Bold">
                <IconButton 
                  color={isBold ? 'primary' : 'default'} 
                  onClick={toggleBold}
                >
                  <FormatBoldIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Italic">
                <IconButton 
                  color={isItalic ? 'primary' : 'default'} 
                  onClick={toggleItalic}
                >
                  <FormatItalicIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Underline">
                <IconButton 
                  color={hasUnderline ? 'primary' : 'default'} 
                  onClick={toggleUnderline}
                >
                  <FormatUnderlinedIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
          
          {/* Font Weight Slider */}
          <Grid item xs={12}>
            <Typography gutterBottom>
              Font Weight: {fontWeight}
            </Typography>
            <Slider
              value={fontWeight}
              min={100}
              max={900}
              step={100}
              marks
              onChange={(_e, value) => {
                const newValue = Array.isArray(value) ? value[0] : value
                setFontWeight(newValue)
                setIsBold(newValue >= 600)
                handleChange('fontWeight', newValue)
              }}
            />
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
          
          {/* Custom Color Pickers */}
          {useCustomColor && (
            <>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Button Color
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <input
                      type="color"
                      value={customColor}
                      onChange={handleCustomColorChange}
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
                      onChange={handleCustomColorChange}
                      placeholder="#1976d2"
                      variant="outlined"
                    />
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Hover Color
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <input
                      type="color"
                      value={customHoverColor}
                      onChange={handleHoverColorChange}
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
                      value={customHoverColor}
                      onChange={handleHoverColorChange}
                      placeholder="#1565c0"
                      variant="outlined"
                    />
                  </Box>
                </Box>
              </Grid>
            </>
          )}
          
          {/* Icon Controls */}
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" gutterBottom>
              Button Icons
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.showStartIcon)}
                  onChange={(e) => handleChange('showStartIcon', e.target.checked)}
                />
              }
              label="Start Icon"
            />
            {Boolean(props.showStartIcon) && (
              <FormControl fullWidth sx={{ mt: 1 }}>
                <InputLabel>Icon</InputLabel>
                <Select
                  value={selectedIcon}
                  label="Icon"
                  onChange={(e) => {
                    setSelectedIcon(e.target.value)
                    handleChange('iconName', e.target.value)
                  }}
                >
                  {Object.keys(AVAILABLE_ICONS).map((iconKey) => (
                    <MenuItem key={iconKey} value={iconKey}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {React.createElement(AVAILABLE_ICONS[iconKey as keyof typeof AVAILABLE_ICONS], { fontSize: 'small', style: { marginRight: 8 } })}
                        {iconKey.charAt(0).toUpperCase() + iconKey.slice(1)}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.showEndIcon)}
                  onChange={(e) => handleChange('showEndIcon', e.target.checked)}
                />
              }
              label="End Icon (Link)"
            />
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Advanced Tab */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Custom CSS Class"
              fullWidth
              value={(props.className as string) || ''}
              onChange={(e) => handleChange('className', e.target.value)}
              placeholder="my-custom-button-class"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Margin (px)"
              type="number"
              inputProps={{ min: 0, max: 32 }}
              fullWidth
              value={(props.margin as number) || 0}
              onChange={(e) => handleChange('margin', Number(e.target.value))}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Border Radius (px)"
              type="number"
              inputProps={{ min: 0, max: 24 }}
              fullWidth
              value={(props.borderRadius as number) || 4}
              onChange={(e) => handleChange('borderRadius', Number(e.target.value))}
            />
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
          
          <Grid item xs={12}>
            <TextField
              label="Data Test ID"
              fullWidth
              value={(props.dataTestId as string) || ''}
              onChange={(e) => handleChange('dataTestId', e.target.value)}
              placeholder="button-test-id"
              helperText="For automated testing"
            />
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  )
}

export default ButtonEditor 