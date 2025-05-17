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
  IconButton,
  Button as MuiButton,
  Tooltip,
  useMediaQuery,
  useTheme
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import NotificationsIcon from '@mui/icons-material/Notifications'
import FormatColorTextIcon from '@mui/icons-material/FormatColorText'
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
  // Theme and responsive design
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  
  // Tab state
  const [tabValue, setTabValue] = useState(0)
  
  // State for custom color picker
  const [useCustomColor, setUseCustomColor] = useState(Boolean(props.customColor))
  const [customColor, setCustomColor] = useState(props.customColor || '#1976d2')
  const [customHoverColor, setCustomHoverColor] = useState(props.customHoverColor || '#1565c0')
  // State for custom text color picker
  const [customTextColor, setCustomTextColor] = useState(props.customTextColor || '#000000')
  
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
      : 'left'
  )
  
  // Initialize custom colors if they exist in props
  useEffect(() => {
    // Reset custom color toggle on prop change
    setUseCustomColor(Boolean(props.customColor))
    // Sync alignment from props
    if (typeof props.alignment === 'string' && ['left','center','right'].includes(props.alignment as string)) {
      setAlignment(props.alignment as 'left' | 'center' | 'right')
    } else {
      setAlignment('left')
    }
    const useCustColor = Boolean(props.customColor)
    if (useCustColor) {
      setCustomColor(props.customColor || '#1976d2')
      setCustomHoverColor(props.customHoverColor || '#1565c0')
      setCustomTextColor(props.customTextColor || '#000000')
    } else {
      // Reset to defaults if custom color prop is removed
      setCustomColor('#1976d2')
      setCustomHoverColor('#1565c0')
      setCustomTextColor('#000000')
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
  
  // Update custom text color
  const handleTextColorChange = (color: string) => {
    setCustomTextColor(color)
    handleChange('customTextColor', color)
  }
  
  const handleCustomColorToggle = (useCustom: boolean) => {
    setUseCustomColor(useCustom)
    
    if (useCustom) {
      handleChange('customColor', customColor)
      handleChange('customHoverColor', customHoverColor)
      handleChange('customTextColor', customTextColor)
    } else {
      // Remove custom color props
      const newProps = { ...props }
      delete newProps.customColor
      delete newProps.customHoverColor
      delete newProps.customTextColor
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
      color: useCustomColor ? customTextColor : undefined,
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
      const message = props.toastMessage || 'Button clicked'
      const severity = props.toastSeverity || 'info'
      document.dispatchEvent(new CustomEvent('showWidgetToast', {
        detail: { message, severity },
        bubbles: true,
      }))
    } else if (props.clickAction === 'openUrl' && props.url) {
      const url = props.url.match(/^https?:\/\//) ? props.url : `https://${props.url}`
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }
  
  // Define tabs with icons
  const editorTabs = [
    { label: 'Basic Settings', id: 'button-basic', icon: <SettingsIcon fontSize={isMobile ? "small" : "medium"} /> },
    { label: 'Styling', id: 'button-styling', icon: <FormatColorTextIcon fontSize={isMobile ? "small" : "medium"} /> },
    { label: 'Behaviour', id: 'button-behaviour', icon: <NotificationsIcon fontSize={isMobile ? "small" : "medium"} /> }
  ]
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Preview section */}
      <ComponentPreview>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          width: '100%', 
          p: isMobile ? 1 : 2,
          alignItems: (alignment === 'left' ? 'flex-start' : (alignment === 'right' ? 'flex-end' : 'center')) 
        }}>
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
                Click Action:
              </Typography>
              {props.clickAction === 'toast' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: isMobile ? '0.65rem' : undefined }}>
                    Show toast: "{props.toastMessage || 'Button clicked'}"
                  </Typography>
                  <Typography variant="caption" sx={{ 
                    color: 'text.secondary',
                    fontSize: isMobile ? '0.65rem' : undefined
                  }}>
                    Type: {props.toastSeverity || 'info'}
                  </Typography>
                </Box>
              )}
              {props.clickAction === 'openUrl' && props.url && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: isMobile ? '0.65rem' : undefined }}>
                    Open URL: {props.url}
                  </Typography>
                  <OpenInNewIcon sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }} />
                </Box>
              )}
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
            <Typography variant="caption" sx={{ 
              color: 'text.secondary',
              fontSize: isMobile ? '0.65rem' : undefined
            }}>
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                {alignment}
              </Box>
            </Typography>
            <Typography variant="caption" sx={{ 
              color: 'text.secondary',
              fontSize: isMobile ? '0.65rem' : undefined
            }}>
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                {(props.variant as string) || 'contained'}
              </Box>
            </Typography>
            <Typography variant="caption" sx={{ 
              color: 'text.secondary',
              fontSize: isMobile ? '0.65rem' : undefined
            }}>
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                {(props.size as string) || 'medium'}
              </Box>
            </Typography>
            <Typography variant="caption" sx={{ 
              color: 'text.secondary',
              fontSize: isMobile ? '0.65rem' : undefined
            }}>
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                {useCustomColor ? 'custom color' : ((props.color as string) || 'primary')}
              </Box>
            </Typography>
            {Boolean(props.showStartIcon || props.showEndIcon) && (
              <Typography variant="caption" sx={{ 
                color: 'text.secondary',
                fontSize: isMobile ? '0.65rem' : undefined
              }}>
                <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                  icon: {selectedIcon}
                </Box>
              </Typography>
            )}
            {Boolean(props.fullWidth) && (
              <Typography variant="caption" sx={{ 
                color: 'text.secondary',
                fontSize: isMobile ? '0.65rem' : undefined
              }}>
                <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                  full width
                </Box>
              </Typography>
            )}
            {Boolean(props.disabled) && (
              <Typography variant="caption" sx={{ 
                color: 'text.secondary',
                fontSize: isMobile ? '0.65rem' : undefined
              }}>
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
        <Grid container spacing={isMobile ? 1 : 2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Button Text"
              onFocus={(e) => { e.target.select() }}
              value={props.text || ''}
              onChange={(e) => handleChange('text', e.target.value)}
              variant="outlined"
              margin="dense"
              size={isMobile ? "small" : "medium"}
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
                  fontSize: isMobile ? '0.875rem' : undefined
                },
                '& .MuiOutlinedInput-input': {
                  color: '#000000',
                  fontSize: isMobile ? '0.875rem' : undefined
                },
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={isMobile ? 12 : 6}>
            <FormControl fullWidth margin="dense" size={isMobile ? "small" : "medium"} variant="outlined">
              <InputLabel id="button-variant-label" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Variant</InputLabel>
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
                    fontSize: isMobile ? '0.875rem' : undefined
                  },
                  '& .MuiInputLabel-root': {
                    color: '#191919',
                    fontSize: isMobile ? '0.875rem' : undefined
                  },
                }}
              >
                <MenuItem value="contained" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Contained</MenuItem>
                <MenuItem value="outlined" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Outlined</MenuItem>
                <MenuItem value="text" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Text</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={isMobile ? 12 : 6}>
            <FormControl fullWidth margin="dense" size={isMobile ? "small" : "medium"} variant="outlined">
              <InputLabel id="button-size-label" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Size</InputLabel>
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
                    fontSize: isMobile ? '0.875rem' : undefined
                  },
                  '& .MuiInputLabel-root': {
                    color: '#191919',
                    fontSize: isMobile ? '0.875rem' : undefined
                  },
                }}
              >
                <MenuItem value="small" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Small</MenuItem>
                <MenuItem value="medium" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Medium</MenuItem>
                <MenuItem value="large" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Large</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={isMobile ? 12 : 6}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.fullWidth)}
                  onChange={(e) => handleChange('fullWidth', e.target.checked)}
                  size={isMobile ? "small" : "medium"}
                />
              }
              label={
                <Typography sx={{ fontSize: isMobile ? '0.875rem' : undefined, color: '#191919' }}>
                  Full Width
                </Typography>
              }
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
                <Typography sx={{ fontSize: isMobile ? '0.875rem' : undefined, color: '#191919' }}>
                  Disabled
                </Typography>
              }
            />
          </Grid>
          
          <Grid item xs={12} sm={isMobile ? 12 : 6}>
            <FormControl fullWidth margin="dense" size={isMobile ? "small" : "medium"} variant="outlined">
              <InputLabel id="button-alignment-label" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Alignment</InputLabel>
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
                  '& .MuiSelect-select': { 
                    color: '#000000',
                    fontSize: isMobile ? '0.875rem' : undefined
                  },
                  '& .MuiInputLabel-root': { 
                    color: '#191919',
                    fontSize: isMobile ? '0.875rem' : undefined
                  }
                }}
              >
                <MenuItem value="left" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Left</MenuItem>
                <MenuItem value="center" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Center</MenuItem>
                <MenuItem value="right" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Right</MenuItem>
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
              tertiaryColor={customTextColor}
              onToggleCustomColor={handleCustomColorToggle}
              onPrimaryColorChange={handlePrimaryColorChange}
              onSecondaryColorChange={handleHoverColorChange}
              onTertiaryColorChange={handleTextColorChange}
              primaryLabel="Button Color"
              secondaryLabel="Hover Color"
              tertiaryLabel="Text Color"
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
                  size={isMobile ? "small" : "medium"}
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
                      fontSize: isMobile ? '0.875rem' : undefined
                    },
                    '& .MuiOutlinedInput-input': {
                      color: '#000000',
                      fontSize: isMobile ? '0.875rem' : undefined
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth margin="dense" size={isMobile ? "small" : "medium"} variant="outlined">
                  <InputLabel id="toast-severity-label" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Toast Severity</InputLabel>
                  <Select
                    labelId="toast-severity-label"
                    value={props.toastSeverity || 'info'}
                    onChange={(e) => handleChange('toastSeverity', e.target.value)}
                    label="Toast Severity"
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
                        fontSize: isMobile ? '0.875rem' : undefined
                      },
                      '& .MuiInputLabel-root': {
                        color: '#191919',
                        fontSize: isMobile ? '0.875rem' : undefined
                      },
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
          
          {props.clickAction === 'openUrl' && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="URL"
                value={props.url || ''}
                onChange={(e) => handleChange('url', e.target.value)}
                variant="outlined"
                margin="dense"
                size={isMobile ? "small" : "medium"}
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
                    fontSize: isMobile ? '0.875rem' : undefined
                  },
                  '& .MuiOutlinedInput-input': {
                    color: '#000000',
                    fontSize: isMobile ? '0.875rem' : undefined
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