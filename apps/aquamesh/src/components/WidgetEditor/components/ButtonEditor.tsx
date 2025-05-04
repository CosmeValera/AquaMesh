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
  Paper,
  Tooltip,
  Slider,
  InputAdornment,
  Alert,
} from '@mui/material'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
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

// Define the props interface for type safety and linting
interface ButtonProps {
  text?: string;
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  fullWidth?: boolean;
  clickAction?: 'toast' | 'none';
  showToast?: boolean;
  toastMessage?: string;
  toastSeverity?: 'info' | 'success' | 'warning' | 'error';
  fontWeight?: number | string;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  customColor?: string;
  customHoverColor?: string;
  showStartIcon?: boolean;
  iconName?: string;
  showEndIcon?: boolean;
  className?: string;
  margin?: number;
  borderRadius?: number;
  disabled?: boolean;
  dataTestId?: string;
  [key: string]: unknown;
}

interface ButtonEditorProps {
  props: ButtonProps
  onChange: (updatedProps: ButtonProps) => void
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
  const [useCustomColor, setUseCustomColor] = useState(Boolean(props.customColor))
  const [customColor, setCustomColor] = useState(props.customColor || '#1976d2')
  const [customHoverColor, setCustomHoverColor] = useState(props.customHoverColor || '#1565c0')
  
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
    const useCustColor = Boolean(props.customColor)
    if (useCustColor) {
      setCustomColor(props.customColor || '#1976d2')
      setCustomHoverColor(props.customHoverColor || '#1565c0')
    } else {
      // Reset to defaults if custom color prop is removed
      setCustomColor('#1976d2')
      setCustomHoverColor('#1565c0')
    }
    
    // Set typography states based on props
    if (props.fontWeight) {
      const weight = Number(props.fontWeight)
      setFontWeight(weight)
      setIsBold(weight >= 600)
    } else {
      setFontWeight(400) // Default if not provided
      setIsBold(false)
    }
    
    setIsItalic(Boolean(props.fontStyle === 'italic'))
    setHasUnderline(Boolean(props.textDecoration === 'underline'))
    
    // Set icon if it exists
    if (props.iconName && typeof props.iconName === 'string') {
      setSelectedIcon(props.iconName)
    } else {
      setSelectedIcon('add') // Default if not provided
    }
  }, [props]) // Rerun when any prop changes
  
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
    const checked = e.target.checked;
    setUseCustomColor(checked); // Update local state immediately
    if (checked) {
      // Apply initial custom colors when toggled on
      handleChange('customColor', customColor);
      handleChange('customHoverColor', customHoverColor);
    } else {
      // Explicitly set custom colors to undefined in props when toggled off
      handleChange('customColor', undefined);
      handleChange('customHoverColor', undefined);
      // Also reset local color state immediately for consistency
      setCustomColor('#1976d2'); // Reset to default or initial
      setCustomHoverColor('#1565c0'); // Reset to default or initial
    }
  };
  
  // Generic change handler
  const handleChange = (name: keyof ButtonProps, value: unknown) => {
    const updatedProps = { ...props, [name]: value };
    onChange(updatedProps);
  }
  
  // Preview styles based on current props
  const getPreviewStyles = () => {
    const styles: React.CSSProperties = {
      fontWeight: fontWeight,
      fontStyle: isItalic ? 'italic' : 'normal',
      textDecoration: hasUnderline ? 'underline' : 'none',
      margin: props.margin ? `${props.margin}px` : undefined,
      borderRadius: props.borderRadius !== undefined ? `${props.borderRadius}px` : undefined,
      // Apply custom colors directly if useCustomColor is true *and* they are set
      ...(useCustomColor && props.customColor && { 
        backgroundColor: props.variant === 'contained' ? props.customColor : 'transparent',
        borderColor: props.customColor,
        color: props.variant === 'contained' ? '#fff' : props.customColor, // Basic contrast assumption
        '&:hover': {
          backgroundColor: props.variant === 'contained' ? props.customHoverColor || props.customColor : 'rgba(25, 118, 210, 0.04)', // Fallback for hover
          borderColor: props.customHoverColor || props.customColor,
        }
      })
    }
    return styles
  }
  
  // Get the appropriate icon component
  const getIconComponent = (iconName: string) => {
    return AVAILABLE_ICONS[iconName as keyof typeof AVAILABLE_ICONS] || AddIcon
  }
  
  // Current icon component
  const CurrentIcon = getIconComponent(selectedIcon)
  
  // Handle button click in preview
  const handlePreviewClick = () => {
    if (props.clickAction === 'toast' && props.showToast) {
      const toastEvent = new CustomEvent('showWidgetToast', {
        detail: {
          message: props.toastMessage || 'Button Clicked!',
          severity: props.toastSeverity || 'info',
        },
      })
      document.dispatchEvent(toastEvent)
    }
    // If action is 'none', do nothing.
  }
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Preview Section */}
      <Paper variant="outlined" sx={{ mb: 2, p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <MuiButton
          variant={props.variant || 'contained'}
          color={useCustomColor ? undefined : (props.color || 'primary')}
          size={props.size || 'medium'}
          sx={getPreviewStyles()}
          endIcon={props.showEndIcon ? <OpenInNewIcon /> : undefined}
          startIcon={props.showStartIcon ? <CurrentIcon /> : undefined}
          fullWidth={Boolean(props.fullWidth)}
          disabled={Boolean(props.disabled)}
          onClick={handlePreviewClick}
          data-testid={props.dataTestId}
        >
          {props.text || 'Button Text'}
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
              value={props.text || ''}
              onChange={(e) => handleChange('text', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Variant</InputLabel>
              <Select
                value={props.variant || 'contained'}
                label="Variant"
                onChange={(e) => handleChange('variant', e.target.value as ButtonProps['variant'])}
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
                value={props.size || 'medium'}
                label="Size"
                onChange={(e) => handleChange('size', e.target.value as ButtonProps['size'])}
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
                value={props.color || 'primary'}
                label="Color"
                onChange={(e) => handleChange('color', e.target.value as ButtonProps['color'])}
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
                value={props.clickAction || 'none'}
                label="Click Action"
                onChange={(e) => handleChange('clickAction', e.target.value as ButtonProps['clickAction'])}
              >
                <MenuItem value="toast">Show Toast</MenuItem>
                <MenuItem value="none">No Action</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {/* Toast Action Options */}
          {props.clickAction === 'toast' && (
            <>              
              {/* Conditionally render Toast specific options */}
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

              {/* Only show message/severity if the toast switch is checked */}
              {Boolean(props.showToast) && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      label="Toast Message"
                      fullWidth
                      value={props.toastMessage || ''}
                      onChange={(e) => handleChange('toastMessage', e.target.value)}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Toast Severity</InputLabel>
                      <Select
                        value={props.toastSeverity || 'info'}
                        label="Toast Severity"
                        onChange={(e) => handleChange('toastSeverity', e.target.value as ButtonProps['toastSeverity'])}
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
                  aria-pressed={isBold}
                >
                  <FormatBoldIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Italic">
                <IconButton 
                  color={isItalic ? 'primary' : 'default'} 
                  onClick={toggleItalic}
                  aria-pressed={isItalic}
                >
                  <FormatItalicIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Underline">
                <IconButton 
                  color={hasUnderline ? 'primary' : 'default'} 
                  onClick={toggleUnderline}
                  aria-pressed={hasUnderline}
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
            <Tooltip title="Use Custom Colors">
              <FormControlLabel
                control={
                  <Switch
                    checked={useCustomColor}
                    onChange={handleCustomColorToggle}
                  />
                }
                label="Use Custom Colors"
                sx={{ ml: 0 }}
              />
            </Tooltip>
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
            {/* Tooltip explaining the end icon is fixed */}
             <Typography variant="caption" display="block" color="text.secondary" sx={{mt: 1}}>
                The end icon is currently fixed to <OpenInNewIcon fontSize="inherit" sx={{ verticalAlign: 'bottom' }} /> for link actions.
             </Typography>
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
              value={props.className || ''}
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
              value={props.margin ?? ''}
              onChange={(e) => handleChange('margin', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Border Radius (px)"
              type="number"
              inputProps={{ min: 0, max: 24 }}
              fullWidth
              value={props.borderRadius ?? ''}
              onChange={(e) => handleChange('borderRadius', e.target.value === '' ? undefined : Number(e.target.value))}
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
              value={props.dataTestId || ''}
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