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
  Slider,
  Stack,
  Chip,
  Button
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import DesignServicesIcon from '@mui/icons-material/DesignServices'
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

import {
  ComponentPreview,
  TabPanelShared
} from '../shared/SharedEditorComponents'

interface FlexBoxEditorProps {
  props: Record<string, unknown>
  onChange: (updatedProps: Record<string, unknown>) => void
}

// Color squares for visualization
const DirectionIndicator: React.FC<{ direction: string }> = ({ direction }) => {
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        border: '1px solid #ccc',
        p: 1,
        borderRadius: 1,
        width: '60px',
        height: '60px',
        bgcolor: 'rgba(0,0,0,0.04)'
      }}
    >
      {direction === 'row' && <ArrowForwardIcon color="primary" />}
      {direction === 'column' && <ArrowDownwardIcon color="primary" />}
      {direction === 'row-reverse' && <ArrowBackIcon color="primary" />}
      {direction === 'column-reverse' && <ArrowUpwardIcon color="primary" />}
    </Box>
  )
}

const FlexBoxEditor: React.FC<FlexBoxEditorProps> = ({ props, onChange }) => {
  // Tab state
  const [tabValue, setTabValue] = useState(0)
  
  // FlexBox states
  const [direction, setDirection] = useState((props.direction as string) || 'row')
  const [justifyContent, setJustifyContent] = useState((props.justifyContent as string) || 'flex-start')
  const [alignItems, setAlignItems] = useState((props.alignItems as string) || 'center')
  const [flexWrap, setFlexWrap] = useState((props.wrap as string) || 'wrap')
  const [spacing, setSpacing] = useState<number>(typeof props.spacing === 'number' ? props.spacing : 1)
  const [padding, setPadding] = useState<number>(typeof props.padding === 'number' ? props.padding : 1)
  
  // Initialize state based on props
  useEffect(() => {
    if (props.direction) {
      setDirection(props.direction as string)
    }
    
    if (props.justifyContent) {
      setJustifyContent(props.justifyContent as string)
    }
    
    if (props.alignItems) {
      setAlignItems(props.alignItems as string)
    }
    
    if (props.wrap) {
      setFlexWrap(props.wrap as string)
    }
    
    if (typeof props.spacing === 'number') {
      setSpacing(props.spacing as number)
    }
    
    if (typeof props.padding === 'number') {
      setPadding(props.padding as number)
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
  
  // Generate preview boxes
  const generatePreviewBoxes = () => {
    const boxes = []
    for (let i = 0; i < 3; i++) {
      boxes.push(
        <Box
          key={i}
          sx={{
            backgroundColor: i === 0 ? '#ef5350' : i === 1 ? '#42a5f5' : '#66bb6a',
            width: direction.includes('column') ? '80%' : 40,
            height: direction.includes('column') ? 40 : 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 1,
            p: 1,
            color: 'white',
            fontWeight: 'bold'
          }}
        >
          {i + 1}
        </Box>
      )
    }
    return boxes
  }
  
  // Get alignment description
  const getAlignmentDescription = () => {
    let justifyText = '';
    let alignText = '';
    
    // Map justifyContent values to readable descriptions
    switch (justifyContent) {
      case 'flex-start': justifyText = 'Start'; break;
      case 'flex-end': justifyText = 'End'; break;
      case 'center': justifyText = 'Center'; break;
      case 'space-between': justifyText = 'Space Between'; break;
      case 'space-around': justifyText = 'Space Around'; break;
      case 'space-evenly': justifyText = 'Space Evenly'; break;
      default: justifyText = justifyContent;
    }
    
    // Map alignItems values to readable descriptions
    switch (alignItems) {
      case 'flex-start': alignText = 'Start'; break;
      case 'flex-end': alignText = 'End'; break;
      case 'center': alignText = 'Center'; break;
      case 'stretch': alignText = 'Stretch'; break;
      case 'baseline': alignText = 'Baseline'; break;
      default: alignText = alignItems;
    }
    
    return {
      justifyText,
      alignText
    };
  }
  
  const { justifyText, alignText } = getAlignmentDescription();
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Preview Section */}
      <ComponentPreview>
        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <Box 
            sx={{ 
              display: 'flex',
              flexDirection: direction as 'row' | 'column' | 'row-reverse' | 'column-reverse',
              justifyContent: justifyContent as string,
              alignItems: alignItems as string,
              flexWrap: flexWrap as 'nowrap' | 'wrap' | 'wrap-reverse',
              gap: spacing,
              padding: padding,
              width: '100%',
              border: '1px dashed #ccc',
              borderRadius: 1,
              minHeight: '120px',
              backgroundColor: 'rgba(0,0,0,0.02)'
            }}
          >
            {generatePreviewBoxes()}
          </Box>
          
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed rgba(0,0,0,0.1)', width: '100%' }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" sx={{ mb: 1 }}>
              <Chip size="small" label={`Direction: ${direction}`} color="primary" variant="outlined" />
              <Chip size="small" label={`Justify: ${justifyText}`} color="secondary" variant="outlined" />
              <Chip size="small" label={`Align: ${alignText}`} color="info" variant="outlined" />
              <Chip size="small" label={`Wrap: ${flexWrap}`} color="default" variant="outlined" />
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
              <span>Gap: {spacing}</span>
              <span>•</span>
              <span>Padding: {padding}</span>
              {Boolean(props.scrollable) && (
                <>
                  <span>•</span>
                  <span>Scrollable</span>
                </>
              )}
            </Typography>
          </Box>
        </Box>
      </ComponentPreview>
      
      {/* Tabs Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Layout" icon={<SpaceDashboardIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Appearance" icon={<DesignServicesIcon fontSize="small" />} iconPosition="start" />
        </Tabs>
      </Box>
      
      {/* Layout Tab */}
      <TabPanelShared value={tabValue} index={0}>
        <Grid container spacing={2}>
          {/* Flex Direction */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Flex Direction
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={3}>
                <Button 
                  fullWidth
                  variant={direction === 'row' ? 'contained' : 'outlined'}
                  onClick={() => {
                    setDirection('row')
                    handleChange('direction', 'row')
                  }}
                  sx={{ height: '60px', display: 'flex', flexDirection: 'column', gap: 0.5 }}
                >
                  <ArrowForwardIcon />
                  <Typography variant="caption">Row</Typography>
                </Button>
              </Grid>
              <Grid item xs={3}>
                <Button 
                  fullWidth
                  variant={direction === 'column' ? 'contained' : 'outlined'}
                  onClick={() => {
                    setDirection('column')
                    handleChange('direction', 'column')
                  }}
                  sx={{ height: '60px', display: 'flex', flexDirection: 'column', gap: 0.5 }}
                >
                  <ArrowDownwardIcon />
                  <Typography variant="caption">Column</Typography>
                </Button>
              </Grid>
              <Grid item xs={3}>
                <Button 
                  fullWidth
                  variant={direction === 'row-reverse' ? 'contained' : 'outlined'}
                  onClick={() => {
                    setDirection('row-reverse')
                    handleChange('direction', 'row-reverse')
                  }}
                  sx={{ height: '60px', display: 'flex', flexDirection: 'column', gap: 0.5 }}
                >
                  <ArrowBackIcon />
                  <Typography variant="caption">Row Rev</Typography>
                </Button>
              </Grid>
              <Grid item xs={3}>
                <Button 
                  fullWidth
                  variant={direction === 'column-reverse' ? 'contained' : 'outlined'}
                  onClick={() => {
                    setDirection('column-reverse')
                    handleChange('direction', 'column-reverse')
                  }}
                  sx={{ height: '60px', display: 'flex', flexDirection: 'column', gap: 0.5 }}
                >
                  <ArrowUpwardIcon />
                  <Typography variant="caption">Col Rev</Typography>
                </Button>
              </Grid>
            </Grid>
          </Grid>
          
          {/* Justification */}
          <Grid item xs={12}>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Justify Content</InputLabel>
              <Select
                value={justifyContent}
                label="Justify Content"
                onChange={(e) => {
                  setJustifyContent(e.target.value)
                  handleChange('justifyContent', e.target.value)
                }}
              >
                <MenuItem value="flex-start">Start</MenuItem>
                <MenuItem value="center">Center</MenuItem>
                <MenuItem value="flex-end">End</MenuItem>
                <MenuItem value="space-between">Space Between</MenuItem>
                <MenuItem value="space-around">Space Around</MenuItem>
                <MenuItem value="space-evenly">Space Evenly</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {/* Alignment */}
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Align Items</InputLabel>
              <Select
                value={alignItems}
                label="Align Items"
                onChange={(e) => {
                  setAlignItems(e.target.value)
                  handleChange('alignItems', e.target.value)
                }}
              >
                <MenuItem value="flex-start">Start</MenuItem>
                <MenuItem value="center">Center</MenuItem>
                <MenuItem value="flex-end">End</MenuItem>
                <MenuItem value="stretch">Stretch</MenuItem>
                <MenuItem value="baseline">Baseline</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {/* Wrapping */}
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Flex Wrap</InputLabel>
              <Select
                value={flexWrap}
                label="Flex Wrap"
                onChange={(e) => {
                  setFlexWrap(e.target.value)
                  handleChange('wrap', e.target.value)
                }}
              >
                <MenuItem value="nowrap">No Wrap</MenuItem>
                <MenuItem value="wrap">Wrap</MenuItem>
                <MenuItem value="wrap-reverse">Wrap Reverse</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {/* Spacing */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Item Spacing (Gap)
            </Typography>
            <Slider
              value={spacing}
              min={0}
              max={8}
              step={1}
              marks
              valueLabelDisplay="auto"
              onChange={(_e, value) => {
                setSpacing(value as number)
                handleChange('spacing', value)
              }}
              sx={{
                '& .MuiSlider-markLabel': {
                  color: 'text.primary',
                  fontWeight: 'medium'
                }
              }}
            />
          </Grid>
          
          {/* Scrollable Option */}
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.scrollable)}
                  onChange={(e) => handleChange('scrollable', e.target.checked)}
                />
              }
              label="Make Container Scrollable"
            />
          </Grid>
        </Grid>
      </TabPanelShared>
      
      {/* Appearance Tab */}
      <TabPanelShared value={tabValue} index={1}>
        <Grid container spacing={2}>
          {/* Padding */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Container Padding
            </Typography>
            <Slider
              value={padding}
              min={0}
              max={8}
              step={1}
              marks
              valueLabelDisplay="auto"
              onChange={(_e, value) => {
                setPadding(value as number)
                handleChange('padding', value)
              }}
              sx={{
                '& .MuiSlider-markLabel': {
                  color: 'text.primary',
                  fontWeight: 'medium'
                }
              }}
            />
          </Grid>
          
          {/* Background Color */}
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.useCustomColor)}
                  onChange={(e) => handleChange('useCustomColor', e.target.checked)}
                />
              }
              label="Use Custom Background Color"
            />
          </Grid>
          
          {props.useCustomColor && (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <input
                  type="color"
                  value={(props.backgroundColor as string) || '#f5f5f5'}
                  onChange={(e) => handleChange('backgroundColor', e.target.value)}
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
                  fullWidth
                  label="Background Color"
                  value={(props.backgroundColor as string) || '#f5f5f5'}
                  onChange={(e) => handleChange('backgroundColor', e.target.value)}
                />
              </Box>
            </Grid>
          )}
          
          {/* Border Option */}
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.showBorder)}
                  onChange={(e) => handleChange('showBorder', e.target.checked)}
                />
              }
              label="Show Border"
            />
          </Grid>
          
          {props.showBorder && (
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Border Style</InputLabel>
                <Select
                  value={(props.borderStyle as string) || 'solid'}
                  label="Border Style"
                  onChange={(e) => handleChange('borderStyle', e.target.value)}
                >
                  <MenuItem value="solid">Solid</MenuItem>
                  <MenuItem value="dashed">Dashed</MenuItem>
                  <MenuItem value="dotted">Dotted</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>
      </TabPanelShared>
    </Box>
  )
}

export default FlexBoxEditor