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
  Paper,
  IconButton,
  Slider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import ColorLensIcon from '@mui/icons-material/ColorLens'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify'

// Define some default colors for color picker
const DEFAULT_COLORS = [
  '#2196F3', // blue
  '#F44336', // red
  '#4CAF50', // green  
  '#FF9800', // orange
  '#9C27B0', // purple
  '#795548', // brown
  '#607D8B', // blue-grey
  '#E91E63', // pink
  '#000000', // black
  '#666666', // dark grey
]

interface LabelEditorProps {
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
      id={`label-tabpanel-${index}`}
      aria-labelledby={`label-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  )
}

// Color picker modal component
interface ColorPickerProps {
  open: boolean
  currentColor: string
  onClose: () => void
  onSave: (color: string) => void
}

const ColorPickerModal: React.FC<ColorPickerProps> = ({ open, currentColor, onClose, onSave }) => {
  const [selectedColor, setSelectedColor] = useState(currentColor)

  // Reset selected color when modal opens with a new color
  useEffect(() => {
    setSelectedColor(currentColor)
  }, [currentColor, open])

  const handleSave = () => {
    onSave(selectedColor)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Choose Color</DialogTitle>
      <DialogContent>
        <Box sx={{ textAlign: 'center', p: 2 }}>
          <input
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            style={{ 
              width: '100px', 
              height: '100px', 
              padding: 0, 
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          />
        </Box>
        
        {/* Predefined colors palette */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', mt: 2 }}>
          {DEFAULT_COLORS.map((color, index) => (
            <Box 
              key={index}
              sx={{ 
                width: 30, 
                height: 30, 
                bgcolor: color, 
                borderRadius: '4px',
                cursor: 'pointer',
                border: selectedColor === color ? '2px solid #000' : '1px solid rgba(0,0,0,0.2)',
              }}
              onClick={() => setSelectedColor(color)}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Apply Color
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const LabelEditor: React.FC<LabelEditorProps> = ({ props, onChange }) => {
  // Tab state
  const [tabValue, setTabValue] = useState(0)
  
  // Text formatting states
  const [variant, setVariant] = useState((props.variant as string) || 'body1')
  const [fontWeight, setFontWeight] = useState<number>(
    typeof props.fontWeight === 'number' ? props.fontWeight : 400
  )
  const [isBold, setIsBold] = useState(fontWeight >= 600)
  const [isItalic, setIsItalic] = useState(Boolean(props.fontStyle === 'italic'))
  const [hasUnderline, setHasUnderline] = useState(Boolean(props.textDecoration === 'underline'))
  const [textAlign, setTextAlign] = useState((props.textAlign as string) || 'left')
  
  // Color states
  const [useCustomColor, setUseCustomColor] = useState(Boolean(props.useCustomColor))
  const [customColor, setCustomColor] = useState((props.customColor as string) || '#1976d2')
  
  // Color picker state
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  
  // Initialize state based on props
  useEffect(() => {
    if (props.variant) {
      setVariant(props.variant as string)
    }
    
    if (props.fontWeight) {
      const weight = Number(props.fontWeight)
      setFontWeight(weight)
      setIsBold(weight >= 600)
    }
    
    setIsItalic(Boolean(props.fontStyle === 'italic'))
    setHasUnderline(Boolean(props.textDecoration === 'underline'))
    
    if (props.textAlign) {
      setTextAlign(props.textAlign as string)
    }
    
    setUseCustomColor(Boolean(props.useCustomColor))
    
    if (props.customColor) {
      setCustomColor(props.customColor as string)
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
  
  // Toggle text formatting
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
  
  // Custom color toggle
  const handleCustomColorToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    setUseCustomColor(checked)
    
    if (checked) {
      handleChange('useCustomColor', true)
      handleChange('customColor', customColor)
    } else {
      const newProps = { ...props }
      delete newProps.useCustomColor
      delete newProps.customColor
      onChange(newProps)
    }
  }
  
  // Open color picker
  const openColorPicker = () => {
    setColorPickerOpen(true)
  }
  
  // Apply selected color
  const applyColor = (color: string) => {
    setCustomColor(color)
    handleChange('customColor', color)
  }
  
  // Preview styles based on current settings
  const previewStyles = {
    fontWeight: fontWeight,
    fontStyle: isItalic ? 'italic' : 'normal',
    textDecoration: hasUnderline ? 'underline' : 'none',
    textAlign: textAlign,
    color: useCustomColor ? customColor : 'inherit'
  }
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Preview Section */}
      <Paper 
        variant="outlined" 
        sx={{ 
          mb: 2, 
          p: 2, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: '80px'
        }}
      >
        <Typography
          variant={variant as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'subtitle1' | 'subtitle2' | 'body1' | 'body2'}
          sx={previewStyles}
        >
          {(props.text as string) || 'Label Text'}
        </Typography>
      </Paper>
      
      {/* Tabs Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Content" icon={<SettingsIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Typography" icon={<FormatBoldIcon fontSize="small" />} iconPosition="start" />
        </Tabs>
      </Box>
      
      {/* Content Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Text Content"
              fullWidth
              multiline
              rows={3}
              value={(props.text as string) || ''}
              onChange={(e) => handleChange('text', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Styling Options
            </Typography>
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
              label="Use Custom Color"
            />
          </Grid>
          
          {/* Custom Color Picker - Only show if useCustomColor is true */}
          {useCustomColor && (
            <Grid item xs={12}>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Text Color
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box 
                    sx={{ 
                      width: '36px', 
                      height: '36px', 
                      bgcolor: customColor,
                      borderRadius: '4px',
                      border: '1px solid rgba(0,0,0,0.2)',
                      cursor: 'pointer' 
                    }}
                    onClick={openColorPicker}
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
                    InputProps={{
                      endAdornment: (
                        <IconButton size="small" onClick={openColorPicker}>
                          <ColorLensIcon fontSize="small" />
                        </IconButton>
                      )
                    }}
                  />
                </Box>
              </Box>
            </Grid>
          )}
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.noWrap)}
                  onChange={(e) => handleChange('noWrap', e.target.checked)}
                />
              }
              label="No Text Wrapping"
            />
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Typography Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Text Variant</InputLabel>
              <Select
                value={variant}
                label="Text Variant"
                onChange={(e) => {
                  setVariant(e.target.value)
                  handleChange('variant', e.target.value)
                }}
              >
                <MenuItem value="h1">Heading 1</MenuItem>
                <MenuItem value="h2">Heading 2</MenuItem>
                <MenuItem value="h3">Heading 3</MenuItem>
                <MenuItem value="h4">Heading 4</MenuItem>
                <MenuItem value="h5">Heading 5</MenuItem>
                <MenuItem value="h6">Heading 6</MenuItem>
                <MenuItem value="subtitle1">Subtitle 1</MenuItem>
                <MenuItem value="subtitle2">Subtitle 2</MenuItem>
                <MenuItem value="body1">Body 1</MenuItem>
                <MenuItem value="body2">Body 2</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <IconButton 
                color={isBold ? 'primary' : 'default'} 
                onClick={toggleBold}
              >
                <FormatBoldIcon />
              </IconButton>
              
              <IconButton 
                color={isItalic ? 'primary' : 'default'} 
                onClick={toggleItalic}
              >
                <FormatItalicIcon />
              </IconButton>
              
              <IconButton 
                color={hasUnderline ? 'primary' : 'default'} 
                onClick={toggleUnderline}
              >
                <FormatUnderlinedIcon />
              </IconButton>
            </Box>
          </Grid>
          
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
            <Typography gutterBottom>
              Text Alignment
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton 
                color={textAlign === 'left' ? 'primary' : 'default'} 
                onClick={() => {
                  setTextAlign('left')
                  handleChange('textAlign', 'left')
                }}
              >
                <FormatAlignLeftIcon />
              </IconButton>
              
              <IconButton 
                color={textAlign === 'center' ? 'primary' : 'default'} 
                onClick={() => {
                  setTextAlign('center')
                  handleChange('textAlign', 'center')
                }}
              >
                <FormatAlignCenterIcon />
              </IconButton>
              
              <IconButton 
                color={textAlign === 'right' ? 'primary' : 'default'} 
                onClick={() => {
                  setTextAlign('right')
                  handleChange('textAlign', 'right')
                }}
              >
                <FormatAlignRightIcon />
              </IconButton>
              
              <IconButton 
                color={textAlign === 'justify' ? 'primary' : 'default'} 
                onClick={() => {
                  setTextAlign('justify')
                  handleChange('textAlign', 'justify')
                }}
              >
                <FormatAlignJustifyIcon />
              </IconButton>
            </Box>
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Color Picker Modal */}
      <ColorPickerModal
        open={colorPickerOpen}
        currentColor={customColor}
        onClose={() => setColorPickerOpen(false)}
        onSave={applyColor}
      />
    </Box>
  )
}

export default LabelEditor 