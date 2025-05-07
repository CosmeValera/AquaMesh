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
  Paper,
  Slider,
  Collapse,
  IconButton,
  Divider
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt'
import { CustomColorControl } from '../shared/SharedEditorComponents'

// Define props interface
interface FieldSetProps {
  legend?: string;
  collapsed?: boolean;
  legendAlign?: 'left' | 'center' | 'right';
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
  const [legendAlign, setLegendAlign] = useState((props.legendAlign as string) || 'left')
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
    
    if (props.legendAlign) {
      setLegendAlign(props.legendAlign as string)
    } else {
      setLegendAlign('left')
    }
    
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
    color: useCustomLegendColor ? props.legendColor || '#1976d2' : '#1976d2',
    textAlign: legendAlign as 'left' | 'center' | 'right',
    paddingLeft: '8px',
    paddingRight: '8px',
    fontWeight: 'bold' as const,
    width: legendAlign === 'center' ? '100%' : 'auto',
    display: 'block'
  }
  
  // Basic settings form
  const basicSettingsForm = (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <TextField 
          fullWidth
          label="Legend"
          value={props.legend || ''}
          onChange={(e) => handleChange('legend', e.target.value)}
        />
      </Grid>
      
      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <InputLabel>Legend Alignment</InputLabel>
          <Select
            value={legendAlign}
            onChange={(e) => {
              setLegendAlign(e.target.value)
              handleChange('legendAlign', e.target.value)
            }}
            label="Legend Alignment"
          >
            <MenuItem value="left">
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormatAlignLeftIcon sx={{ mr: 1 }} fontSize="small" />
                Left
              </Box>
            </MenuItem>
            <MenuItem value="center">
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormatAlignCenterIcon sx={{ mr: 1 }} fontSize="small" />
                Center
              </Box>
            </MenuItem>
            <MenuItem value="right">
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormatAlignRightIcon sx={{ mr: 1 }} fontSize="small" />
                Right
              </Box>
            </MenuItem>
          </Select>
        </FormControl>
      </Grid>
      
      <Grid item xs={12} sm={6}>
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
      
      <Grid item xs={12}>
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
      
      <Grid item xs={12}>
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
          label="Animated Collapse/Expand"
        />
      </Grid>
    </Grid>
  )
  
  // Appearance settings form
  const appearanceSettingsForm = (
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
      
      <Grid item xs={12} sm={6}>
        <Typography gutterBottom>Border Radius: {borderRadius}px</Typography>
        <Box sx={{ px: 1 }}>
          <Slider
            value={borderRadius}
            onChange={(_e, newValue) => {
              setBorderRadius(newValue as number)
              handleChange('borderRadius', newValue)
            }}
            min={0}
            max={16}
            step={1}
            marks={[
              { value: 0, label: '0' },
              { value: 8, label: '8' },
              { value: 16, label: '16' }
            ]}
          />
        </Box>
      </Grid>
      
      <Grid item xs={12}>
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          Colors
        </Typography>
        <Divider sx={{ mb: 2 }} />
      </Grid>
      
      <Grid item xs={12} sm={6}>
        <CustomColorControl
          useCustomColor={useCustomBorderColor}
          customColor={props.borderColor as string || '#cccccc'}
          onColorChange={(color) => handleChange('borderColor', color)}
          onToggleCustomColor={(useCustom) => {
            setUseCustomBorderColor(useCustom)
            handleChange('useCustomBorderColor', useCustom)
          }}
          label="Custom Border Color"
        />
      </Grid>
      
      <Grid item xs={12} sm={6}>
        <CustomColorControl
          useCustomColor={useCustomLegendColor}
          customColor={props.legendColor as string || '#1976d2'}
          onColorChange={(color) => handleChange('legendColor', color)}
          onToggleCustomColor={(useCustom) => {
            setUseCustomLegendColor(useCustom)
            handleChange('useCustomLegendColor', useCustom)
          }}
          label="Custom Legend Color"
        />
      </Grid>
    </Grid>
  )
  
  return (
    <Box sx={{ width: '100%', overflowX: 'hidden' }}>
      {/* Preview Section */}
      <Paper 
        variant="outlined" 
        sx={{ 
          mb: 2, 
          p: 2, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: '200px',
          background: 'rgba(0, 0, 0, 0.04)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: 2
        }}
      >
        <Box 
          sx={{ 
            ...previewStyles,
            width: '100%',
            minHeight: '120px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: legendAlign === 'center' 
                ? 'center' 
                : legendAlign === 'right' 
                  ? 'flex-end' 
                  : 'flex-start',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              borderTopLeftRadius: `${borderRadius}px`,
              borderTopRightRadius: `${borderRadius}px`,
              pl: 1,
              pr: 1,
              position: 'relative',
              borderBottom: `1px ${borderStyle} ${useCustomBorderColor ? (props.borderColor || '#cccccc') : '#cccccc'}`,
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
              }
            }}
            onClick={handlePreviewCollapseToggle}
          >
            {iconPosition === 'start' && (
              <IconButton 
                onClick={(e) => {
                  e.stopPropagation(); // Prevent double triggering
                  handlePreviewCollapseToggle();
                }} 
                size="small" 
                sx={{ mr: 1 }}
              >
                {previewCollapsed ? (
                  <KeyboardArrowDownIcon fontSize="small" sx={{ color: useCustomLegendColor ? props.legendColor || '#1976d2' : '#1976d2' }} />
                ) : (
                  <KeyboardArrowUpIcon fontSize="small" sx={{ color: useCustomLegendColor ? props.legendColor || '#1976d2' : '#1976d2' }} />
                )}
              </IconButton>
            )}
            
            <Typography 
              variant="subtitle2" 
              sx={{
                ...legendStyles,
                textAlign: legendAlign
              }}
            >
              {(props.legend as string) || 'Field Set'}
            </Typography>
            
            {iconPosition === 'end' && (
              <IconButton 
                onClick={(e) => {
                  e.stopPropagation(); // Prevent double triggering
                  handlePreviewCollapseToggle();
                }} 
                size="small" 
                sx={{ ml: 1 }}
              >
                {previewCollapsed ? (
                  <KeyboardArrowDownIcon fontSize="small" sx={{ color: useCustomLegendColor ? props.legendColor || '#1976d2' : '#1976d2' }} />
                ) : (
                  <KeyboardArrowUpIcon fontSize="small" sx={{ color: useCustomLegendColor ? props.legendColor || '#1976d2' : '#1976d2' }} />
                )}
              </IconButton>
            )}
          </Box>
          
          {/* Actual collapse content */}
          <Collapse 
            in={!previewCollapsed} 
            timeout={animated ? 'auto' : 0}
          >
            <Box sx={{ 
              p: 1, 
              mt: 1, 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '80px',
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '4px',
              margin: '8px'
            }}>
              <Typography variant="body2" color="text.secondary">
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
        </Tabs>
      </Box>
      
      {/* Basic Tab */}
      <TabPanel value={tabValue} index={0}>
        {basicSettingsForm}
      </TabPanel>
      
      {/* Appearance Tab */}
      <TabPanel value={tabValue} index={1}>
        {appearanceSettingsForm}
      </TabPanel>
    </Box>
  )
}

export default FieldSetEditor 