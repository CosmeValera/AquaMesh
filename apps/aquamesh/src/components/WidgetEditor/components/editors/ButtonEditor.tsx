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
  InputAdornment,
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
import { ButtonProps, ComponentEditorProps } from '../../types/types'

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
  
  const handleCustomColorToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUseCustomColor = e.target.checked
    setUseCustomColor(newUseCustomColor)
    
    if (newUseCustomColor) {
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
      '&:hover': {
        backgroundColor: useCustomColor ? customHoverColor : undefined,
      }
    }
  }
  
  // Get icon component for preview
  const getIconComponent = (iconName: string) => {
    const IconComponent = AVAILABLE_ICONS[iconName] || AddIcon
    return <IconComponent fontSize="small" />
  }
  
  // Mock button click for preview
  const handlePreviewClick = () => {
    if (props.showToast) {
      // Display a toast when clicked in the preview
      alert(`Mock Toast: ${props.toastMessage || 'Button clicked'}`)
    }
  }
  
  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              color: 'foreground.contrastSecondary',
              '&.Mui-selected': {
                color: 'primary.main',
              }
            }
          }}
        >
          <Tab label="Basic Settings" id="button-tab-0" />
          <Tab label="Styling" id="button-tab-1" />
          <Tab label="Icons" id="button-tab-2" />
          <Tab label="Advanced" id="button-tab-3" />
        </Tabs>
      </Box>
      
      <TabPanel value={tabValue} index={0}>
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
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'primary.light',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'foreground.contrastSecondary',
                },
                '& .MuiOutlinedInput-input': {
                  color: 'foreground.contrastPrimary',
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
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.light',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                  '& .MuiSelect-select': {
                    color: 'foreground.contrastPrimary',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'foreground.contrastSecondary',
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
              <InputLabel id="button-color-label">Color</InputLabel>
              <Select
                labelId="button-color-label"
                value={props.color || 'primary'}
                onChange={(e) => handleChange('color', e.target.value)}
                label="Color"
                disabled={useCustomColor}
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.light',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                  '& .MuiSelect-select': {
                    color: 'foreground.contrastPrimary',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'foreground.contrastSecondary',
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
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.light',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                  '& .MuiSelect-select': {
                    color: 'foreground.contrastPrimary',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'foreground.contrastSecondary',
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
              sx={{ color: 'foreground.contrastPrimary' }}
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
              sx={{ color: 'foreground.contrastPrimary' }}
            />
          </Grid>
        </Grid>
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.1)', mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Text Styling
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Bold">
                  <IconButton 
                    sx={{ 
                      bgcolor: isBold ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      color: 'foreground.contrastPrimary'
                    }} 
                    onClick={toggleBold}
                  >
                    <FormatBoldIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Italic">
                  <IconButton 
                    sx={{ 
                      bgcolor: isItalic ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      color: 'foreground.contrastPrimary'
                    }} 
                    onClick={toggleItalic}
                  >
                    <FormatItalicIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Underline">
                  <IconButton 
                    sx={{ 
                      bgcolor: hasUnderline ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      color: 'foreground.contrastPrimary'
                    }} 
                    onClick={toggleUnderline}
                  >
                    <FormatUnderlinedIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Paper>
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={useCustomColor}
                  onChange={handleCustomColorToggle}
                />
              }
              label="Use Custom Colors"
              sx={{ color: 'foreground.contrastPrimary', mb: 1 }}
            />
            
            {useCustomColor && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Button Color"
                    value={customColor}
                    onChange={handleCustomColorChange}
                    variant="outlined"
                    margin="dense"
                    size="small"
                    type="color"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              bgcolor: customColor,
                              borderRadius: '2px',
                              border: '1px solid rgba(255,255,255,0.3)'
                            }}
                          />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.2)',
                        },
                        '&:hover fieldset': {
                          borderColor: 'primary.light',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        color: 'foreground.contrastSecondary',
                      },
                      '& .MuiOutlinedInput-input': {
                        color: 'foreground.contrastPrimary',
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Hover Color"
                    value={customHoverColor}
                    onChange={handleHoverColorChange}
                    variant="outlined"
                    margin="dense"
                    size="small"
                    type="color"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              bgcolor: customHoverColor,
                              borderRadius: '2px',
                              border: '1px solid rgba(255,255,255,0.3)'
                            }}
                          />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.2)',
                        },
                        '&:hover fieldset': {
                          borderColor: 'primary.light',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        color: 'foreground.contrastSecondary',
                      },
                      '& .MuiOutlinedInput-input': {
                        color: 'foreground.contrastPrimary',
                      },
                    }}
                  />
                </Grid>
              </Grid>
            )}
          </Grid>
        </Grid>
      </TabPanel>
      
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.showStartIcon)}
                  onChange={(e) => handleChange('showStartIcon', e.target.checked)}
                />
              }
              label="Show Start Icon"
              sx={{ color: 'foreground.contrastPrimary', mb: 2 }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.showEndIcon)}
                  onChange={(e) => handleChange('showEndIcon', e.target.checked)}
                />
              }
              label="Show End Icon"
              sx={{ color: 'foreground.contrastPrimary', mb: 2, ml: 2 }}
            />
          </Grid>
          
          {(props.showStartIcon || props.showEndIcon) && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: 'foreground.contrastPrimary' }}>
                Select Icon
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {Object.entries(AVAILABLE_ICONS).map(([name, Icon]) => (
                  <Tooltip key={name} title={name}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        cursor: 'pointer',
                        bgcolor: selectedIcon === name ? 'primary.dark' : 'rgba(255, 255, 255, 0.05)',
                        '&:hover': {
                          bgcolor: selectedIcon === name ? 'primary.dark' : 'rgba(255, 255, 255, 0.1)',
                        },
                      }}
                      onClick={() => {
                        setSelectedIcon(name)
                        handleChange('iconName', name)
                      }}
                    >
                      <Icon sx={{ color: 'foreground.contrastPrimary' }} />
                    </Paper>
                  </Tooltip>
                ))}
              </Box>
            </Grid>
          )}
        </Grid>
      </TabPanel>
      
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.showToast)}
                  onChange={(e) => handleChange('showToast', e.target.checked)}
                />
              }
              label="Show Toast on Click"
              sx={{ color: 'foreground.contrastPrimary' }}
            />
          </Grid>
          
          {props.showToast && (
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
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'primary.light',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'primary.main',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'foreground.contrastSecondary',
                    },
                    '& .MuiOutlinedInput-input': {
                      color: 'foreground.contrastPrimary',
                    },
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth margin="dense" size="small" variant="outlined">
                  <InputLabel id="toast-severity-label">Toast Severity</InputLabel>
                  <Select
                    labelId="toast-severity-label"
                    value={props.toastSeverity || 'success'}
                    onChange={(e) => handleChange('toastSeverity', e.target.value)}
                    label="Toast Severity"
                    sx={{
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'primary.light',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'primary.main',
                      },
                      '& .MuiSelect-select': {
                        color: 'foreground.contrastPrimary',
                      },
                      '& .MuiInputLabel-root': {
                        color: 'foreground.contrastSecondary',
                      },
                    }}
                  >
                    <MenuItem value="success">Success</MenuItem>
                    <MenuItem value="info">Info</MenuItem>
                    <MenuItem value="warning">Warning</MenuItem>
                    <MenuItem value="error">Error</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}
          
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <TextField
              fullWidth
              label="Test ID"
              value={props.dataTestId || ''}
              onChange={(e) => handleChange('dataTestId', e.target.value)}
              variant="outlined"
              margin="dense"
              size="small"
              placeholder="button-1"
              helperText="For automated testing"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'primary.light',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'foreground.contrastSecondary',
                },
                '& .MuiOutlinedInput-input': {
                  color: 'foreground.contrastPrimary',
                },
                '& .MuiFormHelperText-root': {
                  color: 'foreground.contrastSecondary',
                },
              }}
            />
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Preview section */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ color: 'foreground.contrastSecondary' }}>
          Preview
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <MuiButton
            variant={props.variant as 'contained' | 'outlined' | 'text' || 'contained'}
            color={useCustomColor ? undefined : (props.color as 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' || 'primary')}
            size={props.size as 'small' | 'medium' | 'large' || 'medium'}
            fullWidth={Boolean(props.fullWidth)}
            disabled={Boolean(props.disabled)}
            onClick={handlePreviewClick}
            startIcon={props.showStartIcon ? getIconComponent(selectedIcon) : undefined}
            endIcon={props.showEndIcon ? getIconComponent(selectedIcon) : undefined}
            sx={getPreviewStyles()}
          >
            {props.text || 'Button'}
          </MuiButton>
        </Box>
      </Box>
    </Box>
  )
}

export default ButtonEditor 