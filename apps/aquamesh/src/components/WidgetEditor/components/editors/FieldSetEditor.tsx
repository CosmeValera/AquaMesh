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
  Slider,
  Collapse,
  Tooltip,
  useMediaQuery,
  useTheme
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import FormatColorTextIcon from '@mui/icons-material/FormatColorText'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { EditorTabs, TabPanelShared } from '../shared/SharedEditorComponents'

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

const FieldSetEditor: React.FC<FieldSetEditorProps> = ({ props, onChange }) => {
  // Theme and responsive design
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  
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
    display: 'block',
    fontSize: isMobile ? '0.875rem' : undefined
  }
  
  // Preview styles and render methods
  const previewContent = (
    <Box sx={{ p: isMobile ? 0.5 : 1, bgcolor: 'rgba(0,0,0,0.04)', borderRadius: 1 }}>
      <Typography variant="body2" sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem', opacity: 0.7 }}>
        Content will appear here
      </Typography>
    </Box>
  )
  
  const editorTabs = [
    { label: 'Basic Settings', id: 'fieldset-basic', icon: <SettingsIcon fontSize={isMobile ? "small" : "medium"} /> },
    { label: 'Styling', id: 'label-styling', icon: <FormatColorTextIcon fontSize={isMobile ? "small" : "medium"} /> }
  ]
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Preview Section */}
      <Box sx={{ p: isMobile ? 1 : 2, bgcolor: 'background.paper', borderRadius: 1, mb: isMobile ? 1 : 2 }}>
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
                    fontSize={isMobile ? "small" : "medium"}
                    onClick={handlePreviewCollapseToggle}
                    sx={{ cursor: 'pointer', color: useCustomLegendColor ? props.legendColor : 'primary.main' }}
                  />
                )}
                {iconPosition === 'start' && previewCollapsed && (
                  <KeyboardArrowDownIcon 
                    fontSize={isMobile ? "small" : "medium"}
                    onClick={handlePreviewCollapseToggle}
                    sx={{ cursor: 'pointer', color: useCustomLegendColor ? props.legendColor : 'primary.main' }}
                  />
                )}
                <Typography
                  variant={isMobile ? "body2" : "subtitle2"}
                  sx={{ ...legendStyles, cursor: 'pointer' }}
                  onClick={handlePreviewCollapseToggle}
                >
                  {props.legend || 'Legend'}
                </Typography>
                {iconPosition === 'end' && !previewCollapsed && (
                  <KeyboardArrowUpIcon 
                    fontSize={isMobile ? "small" : "medium"}
                    onClick={handlePreviewCollapseToggle}
                    sx={{ cursor: 'pointer', color: useCustomLegendColor ? props.legendColor : 'primary.main' }}
                  />
                )}
                {iconPosition === 'end' && previewCollapsed && (
                  <KeyboardArrowDownIcon 
                    fontSize={isMobile ? "small" : "medium"}
                    onClick={handlePreviewCollapseToggle}
                    sx={{ cursor: 'pointer', color: useCustomLegendColor ? props.legendColor : 'primary.main' }}
                  />
                )}
              </Box>
            </Box>
            
            {/* Content area */}
            <Collapse in={!previewCollapsed} timeout={animated ? 300 : 0}>
              <Box sx={{ p: isMobile ? 1 : 2 }}>
                {previewContent}
              </Box>
            </Collapse>
          </Box>
          
          {/* Preview info */}
          <Box sx={{ mt: isMobile ? 1 : 2, pt: isMobile ? 1 : 2, borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'text.secondary', 
                display: 'flex', 
                flexWrap: 'wrap', 
                justifyContent: 'center', 
                gap: isMobile ? 0.5 : 1,
                fontSize: isMobile ? '0.65rem' : undefined 
              }}
            >
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
      <EditorTabs
        value={tabValue}
        onChange={handleTabChange}
        tabs={editorTabs}
      />
      
      {/* Basic Settings Tab */}
      <TabPanelShared value={tabValue} index={0} id="fieldset-basic">
        <Grid container spacing={isMobile ? 1 : 2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              value={props.legend || ''}
              size={isMobile ? "small" : "medium"}
              onFocus={(e) => { e.target.select() }}
              onChange={(e) => handleChange('legend', e.target.value)}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  Legend
                  <Tooltip title="Text label that appears at the top of the fieldset">
                    <InfoOutlinedIcon fontSize={isMobile ? "small" : "medium"} sx={{ ml: 0.5 }} />
                  </Tooltip>
                </Box>
              }
              sx={{
                '& .MuiInputLabel-root': {
                  fontSize: isMobile ? '0.875rem' : undefined
                },
                '& .MuiOutlinedInput-input': {
                  fontSize: isMobile ? '0.875rem' : undefined
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControl fullWidth size={isMobile ? "small" : "medium"}>
              <InputLabel sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Icon Position</InputLabel>
              <Select
                value={iconPosition}
                onChange={(e) => {
                  setIconPosition(e.target.value)
                  handleChange('iconPosition', e.target.value)
                }}
                label="Icon Position"
                sx={{
                  '& .MuiSelect-select': { 
                    fontSize: isMobile ? '0.875rem' : undefined 
                  }
                }}
              >
                <MenuItem value="start" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Start</MenuItem>
                <MenuItem value="end" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>End</MenuItem>
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
                  size={isMobile ? "small" : "medium"}
                />
              }
              label={
                <Typography sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>
                  Initially Collapsed
                </Typography>
              }
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
                  size={isMobile ? "small" : "medium"}
                />
              }
              label={
                <Typography sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>
                  Use Animation
                </Typography>
              }
            />
          </Grid>
        </Grid>
      </TabPanelShared>
      
      {/* Appearance Tab */}
      <TabPanelShared value={tabValue} index={1} id="fieldset-appearance">
        <Grid container spacing={isMobile ? 1 : 2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size={isMobile ? "small" : "medium"}>
              <InputLabel sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Border Style</InputLabel>
              <Select
                value={borderStyle}
                onChange={(e) => {
                  setBorderStyle(e.target.value)
                  handleChange('borderStyle', e.target.value)
                }}
                label="Border Style"
                sx={{
                  '& .MuiSelect-select': { 
                    fontSize: isMobile ? '0.875rem' : undefined 
                  }
                }}
              >
                <MenuItem value="solid" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Solid</MenuItem>
                <MenuItem value="dashed" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Dashed</MenuItem>
                <MenuItem value="dotted" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Dotted</MenuItem>
                <MenuItem value="none" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>None</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} sx={{ paddingRight: isMobile ? 1 : 2 }}>
            <Typography 
              variant={isMobile ? "body2" : "subtitle2"} 
              gutterBottom
              sx={{ fontSize: isMobile ? '0.875rem' : undefined }}
            >
              Border Radius
            </Typography>
            <Slider
              value={borderRadius}
              min={0}
              max={16}
              step={1}
              size={isMobile ? "small" : "medium"}
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
              sx={{
                '& .MuiSlider-markLabel': {
                  fontSize: isMobile ? '0.75rem' : undefined
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12} sx={{ paddingRight: isMobile ? 1 : 2 }}>
            <Typography 
              variant={isMobile ? "body2" : "subtitle2"} 
              gutterBottom
              sx={{ fontSize: isMobile ? '0.875rem' : undefined }}
            >
              Padding
            </Typography>
            <Slider
              value={padding}
              min={0}
              max={4}
              step={1}
              size={isMobile ? "small" : "medium"}
              marks
              valueLabelDisplay="auto"
              onChange={(_e, value) => {
                setPadding(value as number)
                handleChange('padding', value)
              }}
              sx={{
                '& .MuiSlider-markLabel': {
                  fontSize: isMobile ? '0.75rem' : undefined
                }
              }}
            />
          </Grid>
        </Grid>
      </TabPanelShared>
    </Box>
  )
}

export default FieldSetEditor 