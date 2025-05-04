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
  Slider
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
import CodeIcon from '@mui/icons-material/Code'

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
          <Tab label="Style" icon={<ColorLensIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Advanced" icon={<CodeIcon fontSize="small" />} iconPosition="start" />
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
      
      {/* Style Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={2}>
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
          
          {/* Custom Color Picker */}
          {useCustomColor && (
            <Grid item xs={12}>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Text Color
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
          )}
          
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.gutterBottom)}
                  onChange={(e) => handleChange('gutterBottom', e.target.checked)}
                />
              }
              label="Add Bottom Margin"
            />
          </Grid>
          
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
      
      {/* Advanced Tab */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Custom CSS Class"
              fullWidth
              value={(props.className as string) || ''}
              onChange={(e) => handleChange('className', e.target.value)}
              placeholder="my-custom-label-class"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Inline Styles (JSON)"
              fullWidth
              multiline
              rows={4}
              value={(props.styleJson as string) || ''}
              onChange={(e) => handleChange('styleJson', e.target.value)}
              placeholder='{"marginTop": "10px", "letterSpacing": "0.5px"}'
              helperText="Enter valid JSON for additional CSS styles"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Data Test ID"
              fullWidth
              value={(props.dataTestId as string) || ''}
              onChange={(e) => handleChange('dataTestId', e.target.value)}
              placeholder="label-test-id"
              helperText="For automated testing"
            />
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  )
}

export default LabelEditor 