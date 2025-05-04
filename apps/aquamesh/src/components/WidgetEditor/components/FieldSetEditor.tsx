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
  Slider,
  Collapse,
  IconButton
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import ColorLensIcon from '@mui/icons-material/ColorLens'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt'

interface FieldSetEditorProps {
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
      id={`fieldset-tabpanel-${index}`}
      aria-labelledby={`fieldset-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  )
}

const FieldSetEditor: React.FC<FieldSetEditorProps> = ({ props, onChange }) => {
  // Tab state
  const [tabValue, setTabValue] = useState(0)
  
  // FieldSet states
  const [collapsed, setCollapsed] = useState(Boolean(props.collapsed))
  const [previewCollapsed, setPreviewCollapsed] = useState(Boolean(props.collapsed))
  const [legendAlign, setLegendAlign] = useState((props.legendAlign as string) || 'left')
  const [borderStyle, setBorderStyle] = useState((props.borderStyle as string) || 'solid')
  const [borderRadius, setBorderRadius] = useState<number>(
    typeof props.borderRadius === 'number' ? props.borderRadius : 4
  )
  const [padding, setPadding] = useState<number>(
    typeof props.padding === 'number' ? props.padding : 2
  )
  
  // Color states
  const [useCustomColor, setUseCustomColor] = useState(Boolean(props.useCustomColor))
  const [borderColor, setBorderColor] = useState((props.borderColor as string) || '#cccccc')
  const [legendColor, setLegendColor] = useState((props.legendColor as string) || '#1976d2')
  const [backgroundColor, setBackgroundColor] = useState((props.backgroundColor as string) || '#ffffff')
  
  // Icon states
  const [iconPosition, setIconPosition] = useState((props.iconPosition as string) || 'start')
  
  // Initialize state based on props
  useEffect(() => {
    setCollapsed(Boolean(props.collapsed))
    setPreviewCollapsed(Boolean(props.collapsed))
    
    if (props.legendAlign) {
      setLegendAlign(props.legendAlign as string)
    }
    
    if (props.borderStyle) {
      setBorderStyle(props.borderStyle as string)
    }
    
    if (typeof props.borderRadius === 'number') {
      setBorderRadius(props.borderRadius)
    }
    
    if (typeof props.padding === 'number') {
      setPadding(props.padding)
    }
    
    setUseCustomColor(Boolean(props.useCustomColor))
    
    if (props.borderColor) {
      setBorderColor(props.borderColor as string)
    }
    
    if (props.legendColor) {
      setLegendColor(props.legendColor as string)
    }
    
    if (props.backgroundColor) {
      setBackgroundColor(props.backgroundColor as string)
    }
    
    if (props.iconPosition) {
      setIconPosition(props.iconPosition as string)
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
  
  // Handle collapsed toggle for preview only
  const handlePreviewCollapseToggle = () => {
    setPreviewCollapsed(!previewCollapsed)
  }
  
  // Custom color toggle
  const handleCustomColorToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    setUseCustomColor(checked)
    
    if (checked) {
      handleChange('useCustomColor', true)
      handleChange('borderColor', borderColor)
      handleChange('legendColor', legendColor)
      handleChange('backgroundColor', backgroundColor)
    } else {
      const newProps = { ...props }
      delete newProps.useCustomColor
      delete newProps.borderColor
      delete newProps.legendColor
      delete newProps.backgroundColor
      onChange(newProps)
    }
  }
  
  // Generate preview styles based on current settings
  const previewStyles = {
    border: `1px ${borderStyle} ${useCustomColor ? borderColor : '#cccccc'}`,
    borderRadius: `${borderRadius}px`,
    padding: padding,
    backgroundColor: useCustomColor ? backgroundColor : 'white',
  }
  
  const legendStyles = {
    color: useCustomColor ? legendColor : 'inherit',
    textAlign: legendAlign as 'left' | 'center' | 'right',
    paddingLeft: '8px',
    paddingRight: '8px',
    fontWeight: 'bold'
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
          minHeight: '120px'
        }}
      >
        <Box 
          sx={{ 
            ...previewStyles,
            width: '100%'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: iconPosition === 'end' ? 'space-between' : 'flex-start'
            }}
          >
            {iconPosition === 'start' && (
              <IconButton onClick={handlePreviewCollapseToggle} size="small">
                {previewCollapsed ? (
                  <KeyboardArrowDownIcon fontSize="small" sx={{ color: useCustomColor ? legendColor : 'inherit' }} />
                ) : (
                  <KeyboardArrowUpIcon fontSize="small" sx={{ color: useCustomColor ? legendColor : 'inherit' }} />
                )}
              </IconButton>
            )}
            
            <Typography variant="subtitle2" sx={legendStyles}>
              {(props.legend as string) || 'Field Set'}
            </Typography>
            
            {iconPosition === 'end' && (
              <IconButton onClick={handlePreviewCollapseToggle} size="small">
                {previewCollapsed ? (
                  <KeyboardArrowDownIcon fontSize="small" sx={{ color: useCustomColor ? legendColor : 'inherit' }} />
                ) : (
                  <KeyboardArrowUpIcon fontSize="small" sx={{ color: useCustomColor ? legendColor : 'inherit' }} />
                )}
              </IconButton>
            )}
          </Box>
          
          <Collapse in={!previewCollapsed} timeout="auto">
            <Box sx={{ mt: 1, mb: 1, p: 1, minHeight: '60px', border: '1px dashed #ccc', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary" align="center">
                Content Area
              </Typography>
            </Box>
          </Collapse>
        </Box>
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
          <Tab label="Appearance" icon={<ViewQuiltIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Style" icon={<ColorLensIcon fontSize="small" />} iconPosition="start" />
        </Tabs>
      </Box>
      
      {/* Basic Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Legend Text"
              fullWidth
              value={(props.legend as string) || ''}
              onChange={(e) => handleChange('legend', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={collapsed}
                  onChange={(e) => {
                    setCollapsed(e.target.checked)
                    setPreviewCollapsed(e.target.checked)
                    handleChange('collapsed', e.target.checked)
                  }}
                />
              }
              label="Default Collapsed"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Typography gutterBottom>
              Legend Alignment
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton 
                color={legendAlign === 'left' ? 'primary' : 'default'} 
                onClick={() => {
                  setLegendAlign('left')
                  handleChange('legendAlign', 'left')
                }}
              >
                <FormatAlignLeftIcon />
              </IconButton>
              
              <IconButton 
                color={legendAlign === 'center' ? 'primary' : 'default'} 
                onClick={() => {
                  setLegendAlign('center')
                  handleChange('legendAlign', 'center')
                }}
              >
                <FormatAlignCenterIcon />
              </IconButton>
              
              <IconButton 
                color={legendAlign === 'right' ? 'primary' : 'default'} 
                onClick={() => {
                  setLegendAlign('right')
                  handleChange('legendAlign', 'right')
                }}
              >
                <FormatAlignRightIcon />
              </IconButton>
            </Box>
          </Grid>
          
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Collapse Icon Position</InputLabel>
              <Select
                value={iconPosition}
                label="Collapse Icon Position"
                onChange={(e) => {
                  setIconPosition(e.target.value)
                  handleChange('iconPosition', e.target.value)
                }}
              >
                <MenuItem value="start">Start (Before Legend)</MenuItem>
                <MenuItem value="end">End (After Legend)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Appearance Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Border Style</InputLabel>
              <Select
                value={borderStyle}
                label="Border Style"
                onChange={(e) => {
                  setBorderStyle(e.target.value)
                  handleChange('borderStyle', e.target.value)
                }}
              >
                <MenuItem value="solid">Solid</MenuItem>
                <MenuItem value="dashed">Dashed</MenuItem>
                <MenuItem value="dotted">Dotted</MenuItem>
                <MenuItem value="none">None</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <Typography gutterBottom>
              Border Radius: {borderRadius}px
            </Typography>
            <Slider
              value={borderRadius}
              min={0}
              max={16}
              step={1}
              marks={[
                { value: 0, label: '0' },
                { value: 4, label: '4' },
                { value: 8, label: '8' },
                { value: 16, label: '16' }
              ]}
              onChange={(_e, value) => {
                const newValue = Array.isArray(value) ? value[0] : value
                setBorderRadius(newValue)
                handleChange('borderRadius', newValue)
              }}
            />
          </Grid>
          
          <Grid item xs={12}>
            <Typography gutterBottom>
              Padding: {padding}
            </Typography>
            <Slider
              value={padding}
              min={0}
              max={4}
              step={1}
              marks
              onChange={(_e, value) => {
                const newValue = Array.isArray(value) ? value[0] : value
                setPadding(newValue)
                handleChange('padding', newValue)
              }}
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.elevation)}
                  onChange={(e) => handleChange('elevation', e.target.checked)}
                />
              }
              label="Add Shadow"
            />
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
              label="Use Custom Colors"
            />
          </Grid>
          
          {/* Custom Color Pickers - Only show if useCustomColor is true */}
          {useCustomColor && (
            <>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Border Color
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <input
                      type="color"
                      value={borderColor}
                      onChange={(e) => {
                        setBorderColor(e.target.value)
                        handleChange('borderColor', e.target.value)
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
                      value={borderColor}
                      onChange={(e) => {
                        setBorderColor(e.target.value)
                        handleChange('borderColor', e.target.value)
                      }}
                      placeholder="#cccccc"
                      variant="outlined"
                    />
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Legend Color
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <input
                      type="color"
                      value={legendColor}
                      onChange={(e) => {
                        setLegendColor(e.target.value)
                        handleChange('legendColor', e.target.value)
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
                      value={legendColor}
                      onChange={(e) => {
                        setLegendColor(e.target.value)
                        handleChange('legendColor', e.target.value)
                      }}
                      placeholder="#1976d2"
                      variant="outlined"
                    />
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Background Color
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => {
                        setBackgroundColor(e.target.value)
                        handleChange('backgroundColor', e.target.value)
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
                      value={backgroundColor}
                      onChange={(e) => {
                        setBackgroundColor(e.target.value)
                        handleChange('backgroundColor', e.target.value)
                      }}
                      placeholder="#ffffff"
                      variant="outlined"
                    />
                  </Box>
                </Box>
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
                  checked={Boolean(props.legendBold)}
                  onChange={(e) => handleChange('legendBold', e.target.checked)}
                />
              }
              label="Bold Legend"
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Legend Size</InputLabel>
              <Select
                value={(props.legendSize as string) || 'medium'}
                label="Legend Size"
                onChange={(e) => handleChange('legendSize', e.target.value)}
              >
                <MenuItem value="small">Small</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="large">Large</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.animated)}
                  onChange={(e) => handleChange('animated', e.target.checked)}
                />
              }
              label="Animated Collapse/Expand"
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.saveState)}
                  onChange={(e) => handleChange('saveState', e.target.checked)}
                />
              }
              label="Remember Collapsed State (Local Storage)"
            />
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  )
}

export default FieldSetEditor 