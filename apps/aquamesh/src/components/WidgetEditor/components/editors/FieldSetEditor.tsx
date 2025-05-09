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
  Tabs,
  Tab,
  Slider,
  Collapse,
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt'

// Define props interface
interface FieldSetProps {
  legend?: string;
  collapsed?: boolean;
  iconPosition?: 'start' | 'end';
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  borderRadius?: number;
  padding?: number;
  borderColor?: string;
  legendColor?: string;
  animated?: boolean;
  useCustomBorderColor?: boolean;
  useCustomLegendColor?: boolean;
  [key: string]: unknown;
}

interface FieldSetEditorProps {
  props: FieldSetProps;
  onChange: (updatedProps: FieldSetProps) => void;
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
  const [borderStyle, setBorderStyle] = useState((props.borderStyle as string) || 'solid')
  const [borderRadius, setBorderRadius] = useState<number>(
    typeof props.borderRadius === 'number' ? props.borderRadius : 4
  )
  const [padding, setPadding] = useState<number>(
    typeof props.padding === 'number' ? props.padding : 2
  )
  
  // Color states
  const [useCustomBorderColor, setUseCustomBorderColor] = useState(props.useCustomBorderColor === true)
  const [useCustomLegendColor, setUseCustomLegendColor] = useState(props.useCustomLegendColor === true)
  const [animated, setAnimated] = useState(props.animated !== false)
  
  // Icon states
  const [iconPosition, setIconPosition] = useState((props.iconPosition as string) || 'start')
  
  // Initialize state based on props
  useEffect(() => {
    setCollapsed(Boolean(props.collapsed))
    setPreviewCollapsed(Boolean(props.collapsed))
    
    
    if (props.borderStyle) {
      setBorderStyle(props.borderStyle as string)
    } else {
      setBorderStyle('solid')
    }
    
    if (typeof props.borderRadius === 'number') {
      setBorderRadius(props.borderRadius)
    } else {
      setBorderRadius(4)
    }
    
    if (typeof props.padding === 'number') {
      setPadding(props.padding)
    } else {
      setPadding(2)
    }
    
    if (props.animated !== undefined) {
      setAnimated(props.animated)
    } else {
      handleChange('animated', true)
    }

    if (props.useCustomBorderColor !== undefined) {
      setUseCustomBorderColor(props.useCustomBorderColor as boolean)
    } else {
      handleChange('useCustomBorderColor', false)
    }

    if (props.useCustomLegendColor !== undefined) {
      setUseCustomLegendColor(props.useCustomLegendColor as boolean)
    } else {
      handleChange('useCustomLegendColor', false)
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
  
  // Generate preview styles based on current settings
  const previewStyles = {
    border: `1px ${borderStyle} ${useCustomBorderColor ? (props.borderColor || '#cccccc') : '#cccccc'}`,
    borderRadius: `${borderRadius}px`,
    padding: padding,
    backgroundColor: 'transparent',
  }
  
  const legendStyles = {
    color: useCustomLegendColor ? props.legendColor || '#00C49A' : '#00C49A',
    paddingLeft: '8px',
    paddingRight: '8px',
    fontWeight: 'bold' as const,
    width: 'auto',
    display: 'block'
  }
  
  // Preview styles and render methods
  const previewContent = (
    <Box sx={{ p: 1, bgcolor: 'rgba(0,0,0,0.04)', borderRadius: 1 }}>
      <Typography variant="body2" sx={{ fontSize: '0.875rem', opacity: 0.7 }}>
        Content will appear here
      </Typography>
    </Box>
  )
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Preview Section */}
      <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, mb: 2 }}>
        <Box sx={{ width: '100%', maxWidth: '300px', mx: 'auto' }}>
          <Box 
            sx={{ 
              position: 'relative',
              ...previewStyles
            }}
          >
            {/* Legend */}
            <Box sx={{ 
              position: 'absolute', 
              top: -10, 
              left: '10',
              right: '10',
              transform: 'none',
              bgcolor: 'background.paper',
              px: 1
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {iconPosition === 'start' && !previewCollapsed && (
                  <KeyboardArrowUpIcon 
                    fontSize="small" 
                    onClick={handlePreviewCollapseToggle}
                    sx={{ cursor: 'pointer', color: useCustomLegendColor ? props.legendColor : 'primary.main' }}
                  />
                )}
                {iconPosition === 'start' && previewCollapsed && (
                  <KeyboardArrowDownIcon 
                    fontSize="small" 
                    onClick={handlePreviewCollapseToggle}
                    sx={{ cursor: 'pointer', color: useCustomLegendColor ? props.legendColor : 'primary.main' }}
                  />
                )}
                
                <Typography 
                  variant="subtitle2" 
                  sx={legendStyles}
                >
                  {props.legend || 'Legend'}
                </Typography>
                
                {iconPosition === 'end' && !previewCollapsed && (
                  <KeyboardArrowUpIcon 
                    fontSize="small" 
                    onClick={handlePreviewCollapseToggle}
                    sx={{ cursor: 'pointer', color: useCustomLegendColor ? props.legendColor : 'primary.main' }}
                  />
                )}
                {iconPosition === 'end' && previewCollapsed && (
                  <KeyboardArrowDownIcon 
                    fontSize="small" 
                    onClick={handlePreviewCollapseToggle}
                    sx={{ cursor: 'pointer', color: useCustomLegendColor ? props.legendColor : 'primary.main' }}
                  />
                )}
              </Box>
            </Box>
            
            {/* Content area */}
            <Collapse in={!previewCollapsed} timeout={animated ? 300 : 0}>
              <Box sx={{ p: 2 }}>
                {previewContent}
              </Box>
            </Collapse>
          </Box>
          
          {/* Preview info */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
              <span>Style: {borderStyle}</span>
              {Boolean(padding) && (
                <>
                  <span>•</span>
                  <span>Padding: {padding}</span>
                </>
              )}
              {Boolean(collapsed) && (
                <>
                  <span>•</span>
                  <span>Initially Collapsed</span>
                </>
              )}
            </Typography>
          </Box>
        </Box>
      </Box>
      
      {/* Tabs Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Basic Settings" icon={<SettingsIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Appearance" icon={<ViewQuiltIcon fontSize="small" />} iconPosition="start" />
        </Tabs>
      </Box>
      
      {/* Basic settings tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField 
              fullWidth
              label="Legend"
              value={props.legend || ''}
              onChange={(e) => handleChange('legend', e.target.value)}
              helperText="Text label that appears at the top of the fieldset"
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Icon Position</InputLabel>
              <Select
                value={iconPosition}
                onChange={(e) => {
                  setIconPosition(e.target.value)
                  handleChange('iconPosition', e.target.value)
                }}
                label="Icon Position"
              >
                <MenuItem value="start">Start</MenuItem>
                <MenuItem value="end">End</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={collapsed}
                  onChange={(e) => {
                    setCollapsed(e.target.checked)
                    handleChange('collapsed', e.target.checked)
                  }}
                />
              }
              label="Initially Collapsed"
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={animated}
                  onChange={(e) => {
                    setAnimated(e.target.checked)
                    handleChange('animated', e.target.checked)
                  }}
                />
              }
              label="Use Animation"
            />
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Appearance tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Border Style</InputLabel>
              <Select
                value={borderStyle}
                onChange={(e) => {
                  setBorderStyle(e.target.value)
                  handleChange('borderStyle', e.target.value)
                }}
                label="Border Style"
              >
                <MenuItem value="solid">Solid</MenuItem>
                <MenuItem value="dashed">Dashed</MenuItem>
                <MenuItem value="dotted">Dotted</MenuItem>
                <MenuItem value="none">None</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} sx={{ paddingRight: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Border Radius
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
              valueLabelDisplay="auto"
              onChange={(_e, value) => {
                setBorderRadius(value as number)
                handleChange('borderRadius', value)
              }}
            />
          </Grid>
          
          <Grid item xs={12} sx={{ paddingRight: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Padding
            </Typography>
            <Slider
              value={padding}
              min={0}
              max={4}
              step={1}
              marks
              valueLabelDisplay="auto"
              onChange={(_e, value) => {
                setPadding(value as number)
                handleChange('padding', value)
              }}
            />
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  )
}

export default FieldSetEditor 