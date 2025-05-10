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
  IconButton,
  Button as MuiButton,
  Tooltip,
} from '@mui/material'
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
import { ButtonProps, ComponentEditorProps } from '../../types/types'

import {
  TabPanelShared,
  ComponentPreview,
  EditorTabs,
  TextStylingControls,
  DualColorPicker
} from '../shared/SharedEditorComponents'

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

const ButtonEditor: React.FC<ComponentEditorProps<ButtonProps>> = ({ props, onChange }) => {
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
  
  // Alignment state for preview
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>(
    typeof props.alignment === 'string' && ['left','center','right'].includes(props.alignment as string)
      ? (props.alignment as 'left' | 'center' | 'right')
      : 'center'
  )
  
  // Initialize custom colors if they exist in props
  useEffect(() => {
    // Sync alignment from props
    if (typeof props.alignment === 'string' && ['left','center','right'].includes(props.alignment as string)) {
      setAlignment(props.alignment as 'left' | 'center' | 'right')
    } else {
      setAlignment('center')
    }
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
  
  // Handle text style changes
  const handleTextStyleChange = (prop: string, value: unknown) => {
    handleChange(prop, value)
    
    // Update local state based on the changed property
    if (prop === 'fontWeight') {
      const weightValue = value as number
      setFontWeight(weightValue)
      setIsBold(weightValue >= 600)
    } else if (prop === 'fontStyle') {
      setIsItalic(value === 'italic')
    } else if (prop === 'textDecoration') {
      setHasUnderline(value === 'underline')
    }
  }
  
  // Update custom colors
  const handlePrimaryColorChange = (color: string) => {
    setCustomColor(color)
    handleChange('customColor', color)
  }
  
  const handleHoverColorChange = (color: string) => {
    setCustomHoverColor(color)
    handleChange('customHoverColor', color)
  }
  
  const handleCustomColorToggle = (useCustom: boolean) => {
    setUseCustomColor(useCustom)
    
    if (useCustom) {
      handleChange('customColor', customColor)
      handleChange('customHoverColor', customHoverColor)
    } else {
      // Remove custom color props
      const newProps = { ...props }
      delete newProps.customColor
      delete newProps.customHoverColor
      onChange(newProps)
    }
  }
  
  // Update props on change
  const handleChange = (name: keyof ButtonProps, value: unknown) => {
    onChange({
      ...props,
      [name]: value
    })
  }
  
  // Generate preview styles
  const getPreviewStyles = () => {
    return {
      fontWeight,
      fontStyle: isItalic ? 'italic' : 'normal',
      textDecoration: hasUnderline ? 'underline' : 'none',
      backgroundColor: useCustomColor ? customColor : undefined,
      color: useCustomColor ? '#000000' : undefined, // Ensure text is black when using custom colors
      '&:hover': {
        backgroundColor: useCustomColor ? customHoverColor : undefined,
      }
    }
  }
  
  // Get icon component for preview
  const getIconComponent = (iconName: string) => {
    const IconComponent = AVAILABLE_ICONS[iconName as keyof typeof AVAILABLE_ICONS] || AddIcon
    return <IconComponent fontSize="small" />
  }
  
  // Mock button click for preview
  const handlePreviewClick = () => {
    if (props.clickAction === 'toast') {
      // Display a mock toast notification instead of alert
      console.log(`Toast notification: ${props.toastMessage || 'Button clicked'} (Severity: ${props.toastSeverity || 'info'})`)
      
      // Add a visual indicator in the preview
      const previewArea = document.querySelector('.MuiPaper-root.ComponentPreview')
      if (previewArea) {
        const mockToast = document.createElement('div')
        mockToast.textContent = `${props.toastMessage || 'Button clicked'}`
        mockToast.style.position = 'absolute'
        mockToast.style.bottom = '8px'
        mockToast.style.left = '50%'
        mockToast.style.transform = 'translateX(-50%)'
        mockToast.style.padding = '4px 12px'
        mockToast.style.borderRadius = '4px'
        mockToast.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'
        mockToast.style.color = 'white'
        mockToast.style.fontSize = '12px'
        mockToast.style.opacity = '0'
        mockToast.style.transition = 'opacity 0.3s'
        
        previewArea.appendChild(mockToast)
        
        setTimeout(() => {
          mockToast.style.opacity = '1'
        }, 50)
        
        setTimeout(() => {
          mockToast.style.opacity = '0'
          setTimeout(() => mockToast.remove(), 300)
        }, 2000)
      }
    } else if (props.clickAction === 'openUrl' && props.url) {
      console.log(`Would open URL: ${props.url}`)
    }
  }
  
  // Define tabs
  const editorTabs = [
    { label: 'Basic Settings', id: 'button-basic' },
    { label: 'Styling', id: 'button-styling' },
    { label: 'Behaviour', id: 'button-behaviour' }
  ]
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Preview section */}
      <ComponentPreview>
        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: (alignment === 'left' ? 'flex-start' : (alignment === 'right' ? 'flex-end' : 'center')) }}>
          <MuiButton
            variant={props.variant as 'contained' | 'outlined' | 'text' || 'contained'}
            color={useCustomColor ? undefined : (props.color as 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' || 'primary')}
            size={props.size as 'small' | 'medium' | 'large' || 'medium'}
            fullWidth={Boolean(props.fullWidth)}
            disabled={Boolean(props.disabled)}
            onClick={handlePreviewClick}
            startIcon={props.showStartIcon ? getIconComponent(selectedIcon) : undefined}
            endIcon={props.showEndIcon ? getIconComponent(selectedIcon) : undefined}
            sx={{
              ...getPreviewStyles(),
              ...(props.clickAction === 'openUrl' ? { 
                '&::after': { 
                  content: '""',
                  display: 'inline-block',
                  width: '1em',
                  height: '1em',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\'%3E%3C/path%3E%3Cpolyline points=\'15 3 21 3 21 9\'%3E%3C/polyline%3E%3Cline x1=\'10\' y1=\'14\' x2=\'21\' y2=\'3\'%3E%3C/line%3E%3C/svg%3E")',
                  backgroundSize: 'contain',
                  marginLeft: '5px',
                  opacity: 0.6
                }
              } : {})
            }}
          >
            {props.text || 'Button Text'}
          </MuiButton>

          {/* Action preview information */}
          {props.clickAction && (
            <Box sx={{ mt: 2, p: 1.5, width: '100%', bgcolor: 'background.paper', borderRadius: 1, border: '1px dashed rgba(0,0,0,0.1)' }}>
              <Typography variant="caption" sx={{ fontWeight: 'medium', display: 'block', mb: 0.5 }}>
                Click Action:
              </Typography>
              {props.clickAction === 'toast' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="caption">
                    Show toast: "{props.toastMessage || 'Button clicked'}"
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Type: {props.toastSeverity || 'info'}
                  </Typography>
                </Box>
              )}
              {props.clickAction === 'openUrl' && props.url && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption">
                    Open URL: {props.url}
                  </Typography>
                  <OpenInNewIcon sx={{ fontSize: '0.75rem', color: 'text.secondary' }} />
                </Box>
              )}
              {props.clickAction === 'custom' && (
                <Typography variant="caption">
                  Custom action (will trigger event)
                </Typography>
              )}
            </Box>
          )}

          {/* Properties summary */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed rgba(0,0,0,0.1)', width: '100%', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                {props.variant || 'contained'}
              </Box>
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                {props.size || 'medium'}
              </Box>
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                {useCustomColor ? 'custom color' : props.color || 'primary'}
              </Box>
            </Typography>
            {Boolean(props.showStartIcon || props.showEndIcon) && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                  icon: {selectedIcon}
                </Box>
              </Typography>
            )}
            {Boolean(props.fullWidth) && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                  full width
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
      
      {/* Tabs */}
      <EditorTabs 
        value={tabValue} 
        onChange={handleTabChange}
        tabs={editorTabs}
      />
      
      {/* Basic Settings Tab */}
      <TabPanelShared value={tabValue} index={0} id="button">
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Button Text"
              value={props.text || ''}
              onChange={(e) => handleChange('text', e.target.value)}
              variant="outlined"
              margin="dense"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'rgba(0, 0, 0, 0.23)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'primary.light',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#191919',
                },
                '& .MuiOutlinedInput-input': {
                  color: '#000000',
                },
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="dense" size="small" variant="outlined">
              <InputLabel id="button-variant-label">Variant</InputLabel>
              <Select
                labelId="button-variant-label"
                value={props.variant || 'contained'}
                onChange={(e) => handleChange('variant', e.target.value)}
                label="Variant"
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(0, 0, 0, 0.23)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.light',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                  '& .MuiSelect-select': {
                    color: '#000000',
                  },
                  '& .MuiInputLabel-root': {
                    color: '#191919',
                  },
                }}
              >
                <MenuItem value="contained">Contained</MenuItem>
                <MenuItem value="outlined">Outlined</MenuItem>
                <MenuItem value="text">Text</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="dense" size="small" variant="outlined">
              <InputLabel id="button-size-label">Size</InputLabel>
              <Select
                labelId="button-size-label"
                value={props.size || 'medium'}
                onChange={(e) => handleChange('size', e.target.value)}
                label="Size"
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(0, 0, 0, 0.23)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.light',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                  '& .MuiSelect-select': {
                    color: '#000000',
                  },
                  '& .MuiInputLabel-root': {
                    color: '#191919',
                  },
                }}
              >
                <MenuItem value="small">Small</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="large">Large</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.fullWidth)}
                  onChange={(e) => handleChange('fullWidth', e.target.checked)}
                />
              }
              label="Full Width"
              sx={{ color: '#191919' }}
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
              sx={{ color: '#191919' }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="dense" size="small" variant="outlined">
              <InputLabel id="button-alignment-label">Alignment</InputLabel>
              <Select
                labelId="button-alignment-label"
                value={alignment}
                onChange={(e) => {
                  const value = e.target.value as 'left' | 'center' | 'right';
                  setAlignment(value);
                  handleChange('alignment', value);
                }}
                label="Alignment"
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0, 0, 0, 0.23)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.light' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                  '& .MuiSelect-select': { color: '#000000' },
                  '& .MuiInputLabel-root': { color: '#191919' }
                }}
              >
                <MenuItem value="left">Left</MenuItem>
                <MenuItem value="center">Center</MenuItem>
                <MenuItem value="right">Right</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        
      </TabPanelShared>

      
      {/* Styling Tab */}
      <TabPanelShared value={tabValue} index={1} id="button">

      <Grid container spacing={2}>
        
      <Grid item xs={12} sm={6}>
            {/* Color Controls */}
            <DualColorPicker
              useCustomColor={useCustomColor}
              primaryColor={customColor}
              secondaryColor={customHoverColor}
              onToggleCustomColor={handleCustomColorToggle}
              onPrimaryColorChange={handlePrimaryColorChange}
              onSecondaryColorChange={handleHoverColorChange}
              primaryLabel="Button Color"
              secondaryLabel="Hover Color"
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="dense" size="small" variant="outlined">
              <InputLabel id="button-color-label">Color</InputLabel>
              <Select
                labelId="button-color-label"
                value={props.color || 'primary'}
                onChange={(e) => handleChange('color', e.target.value)}
                label="Color"
                disabled={useCustomColor}
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(0, 0, 0, 0.23)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.light',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                  '& .MuiSelect-select': {
                    color: '#000000',
                  },
                  '& .MuiInputLabel-root': {
                    color: '#191919',
                  },
                }}
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
            {/* Text Styling Controls */}
            <TextStylingControls
              fontWeight={fontWeight}
              isBold={isBold}
              isItalic={isItalic}
              hasUnderline={hasUnderline}
              onChange={handleTextStyleChange}
            />
          </Grid>
          
          
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(props.showStartIcon)}
                    onChange={(e) => handleChange('showStartIcon', e.target.checked)}
                  />
                }
                label="Show Start Icon"
                sx={{ color: '#191919' }}
              />
              </Box>
            </Grid>
              
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(props.showEndIcon)}
                    onChange={(e) => handleChange('showEndIcon', e.target.checked)}
                  />
                }
                label="Show End Icon"
                sx={{ color: '#191919' }}
              />
            </Box>
          </Grid>
          
          {(props.showStartIcon || props.showEndIcon) && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: '#191919', mt: 2 }}>
                Select Icon:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {Object.entries(AVAILABLE_ICONS).map(([key, Icon]) => (
                  <Tooltip key={key} title={key}>
                    <IconButton
                      onClick={() => {
                        setSelectedIcon(key)
                        handleChange('iconName', key)
                      }}
                      sx={{
                        bgcolor: selectedIcon === key ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
                        color: '#191919',
                        border: selectedIcon === key ? '1px solid #757575' : '1px solid transparent',
                      }}
                    >
                      <Icon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ))}
              </Box>
            </Grid>
          )}
        </Grid>
      </TabPanelShared>
      
      
      {/* Behaviour Tab */}
      <TabPanelShared value={tabValue} index={2} id="button">
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth margin="dense" size="small" variant="outlined">
              <InputLabel id="click-action-label">Click Action</InputLabel>
              <Select
                labelId="click-action-label"
                value={props.clickAction || 'none'}
                onChange={(e) => handleChange('clickAction', e.target.value)}
                label="Click Action"
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(0, 0, 0, 0.23)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.light',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                  '& .MuiSelect-select': {
                    color: '#000000',
                  },
                  '& .MuiInputLabel-root': {
                    color: '#191919',
                  },
                }}
              >
                <MenuItem value="toast">Show Toast</MenuItem>
                <MenuItem value="openUrl">Open URL</MenuItem>
                <MenuItem value="none">None</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {props.clickAction === 'toast' && (
            <>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Toast Message"
                  value={props.toastMessage || ''}
                  onChange={(e) => handleChange('toastMessage', e.target.value)}
                  variant="outlined"
                  margin="dense"
                  size="small"
                  placeholder="Button clicked successfully!"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: 'rgba(0, 0, 0, 0.23)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'primary.light',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'primary.main',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: '#191919',
                    },
                    '& .MuiOutlinedInput-input': {
                      color: '#000000',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth margin="dense" size="small" variant="outlined">
                  <InputLabel id="toast-severity-label">Toast Severity</InputLabel>
                  <Select
                    labelId="toast-severity-label"
                    value={props.toastSeverity || 'info'}
                    onChange={(e) => handleChange('toastSeverity', e.target.value)}
                    label="Toast Severity"
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
          
          {props.clickAction === 'openUrl' && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="URL"
                value={props.url || ''}
                onChange={(e) => handleChange('url', e.target.value)}
                variant="outlined"
                margin="dense"
                size="small"
                placeholder="https://example.com"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: 'rgba(0, 0, 0, 0.23)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'primary.light',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'primary.main',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: '#191919',
                  },
                  '& .MuiOutlinedInput-input': {
                    color: '#000000',
                  },
                }}
              />
            </Grid>
          )}
        </Grid>
      </TabPanelShared>
    </Box>
  )
}

export default ButtonEditor 