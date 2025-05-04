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
  Stack
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import DesignServicesIcon from '@mui/icons-material/DesignServices'
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard'

interface FlexBoxEditorProps {
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
      id={`flexbox-tabpanel-${index}`}
      aria-labelledby={`flexbox-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  )
}

// Color squares for visualization
const DirectionIndicator: React.FC<{ direction: string }> = ({ direction }) => {
  const getArrows = () => {
    switch (direction) {
      case 'row':
        return <>→→→</>
      case 'column':
        return <>↓<br/>↓<br/>↓</>
      case 'row-reverse':
        return <>←←←</>
      case 'column-reverse':
        return <>↑<br/>↑<br/>↑</>
      default:
        return <>→→→</>
    }
  }
  
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
        fontSize: '24px'
      }}
    >
      {getArrows()}
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
  const [maxItems, setMaxItems] = useState<number>(typeof props.maxItems === 'number' ? props.maxItems : 0)
  const [minHeight, setMinHeight] = useState<number>(typeof props.minHeight === 'number' ? props.minHeight : 0)
  
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
    
    if (typeof props.maxItems === 'number') {
      setMaxItems(props.maxItems as number)
    }
    
    if (typeof props.minHeight === 'number') {
      setMinHeight(props.minHeight as number)
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
            minHeight: minHeight ? `${minHeight}px` : 'auto'
          }}
        >
          {generatePreviewBoxes()}
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
          <Tab label="Layout" icon={<SettingsIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Alignment" icon={<DesignServicesIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Spacing" icon={<SpaceDashboardIcon fontSize="small" />} iconPosition="start" />
        </Tabs>
      </Box>
      
      {/* Layout Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Flex Direction
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <DirectionIndicator direction={direction} />
              <FormControl fullWidth>
                <InputLabel>Direction</InputLabel>
                <Select
                  value={direction}
                  label="Direction"
                  onChange={(e) => {
                    setDirection(e.target.value)
                    handleChange('direction', e.target.value)
                  }}
                >
                  <MenuItem value="row">Row (Horizontal →)</MenuItem>
                  <MenuItem value="column">Column (Vertical ↓)</MenuItem>
                  <MenuItem value="row-reverse">Row Reverse (← Horizontal)</MenuItem>
                  <MenuItem value="column-reverse">Column Reverse (↑ Vertical)</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Grid>
          
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
                <MenuItem value="nowrap">No Wrap (Force single line)</MenuItem>
                <MenuItem value="wrap">Wrap (Allow multiple lines)</MenuItem>
                <MenuItem value="wrap-reverse">Wrap Reverse</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              label="Min Height (px)"
              type="number"
              fullWidth
              value={minHeight}
              onChange={(e) => {
                const value = Number(e.target.value)
                setMinHeight(value)
                handleChange('minHeight', value)
              }}
              inputProps={{ min: 0, step: 10 }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              label="Max Items (0 = unlimited)"
              type="number"
              fullWidth
              value={maxItems}
              onChange={(e) => {
                const value = Number(e.target.value)
                setMaxItems(value)
                handleChange('maxItems', value)
              }}
              inputProps={{ min: 0 }}
              helperText="Limit number of children"
            />
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Alignment Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Justify Content ({direction.includes('column') ? 'Vertical' : 'Horizontal'} Alignment)
            </Typography>
            <FormControl fullWidth>
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
          
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              Align Items (Cross-axis Alignment)
            </Typography>
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
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.grow)}
                  onChange={(e) => handleChange('grow', e.target.checked)}
                />
              }
              label="Allow Children to Grow"
              sx={{ mt: 2 }}
            />
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Spacing Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography gutterBottom>
              Spacing Between Items: {spacing}
            </Typography>
            <Slider
              value={spacing}
              min={0}
              max={10}
              step={1}
              marks
              onChange={(_e, value) => {
                const newValue = Array.isArray(value) ? value[0] : value
                setSpacing(newValue)
                handleChange('spacing', newValue)
              }}
            />
          </Grid>
          
          <Grid item xs={12}>
            <Typography gutterBottom sx={{ mt: 2 }}>
              Padding Inside Container: {padding}
            </Typography>
            <Slider
              value={padding}
              min={0}
              max={5}
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
            <Box sx={{ mt: 2, mb: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Spacing Visualization
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: padding,
                  backgroundColor: '#f5f5f5',
                  border: '1px dashed #aaa'
                }}
              >
                <Stack 
                  direction="row" 
                  spacing={spacing}
                  sx={{ 
                    '& > div': { 
                      width: 30, 
                      height: 30, 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      fontWeight: 'bold',
                      color: 'white',
                      borderRadius: 1
                    }
                  }}
                >
                  <Box sx={{ bgcolor: '#ef5350' }}>1</Box>
                  <Box sx={{ bgcolor: '#42a5f5' }}>2</Box>
                  <Box sx={{ bgcolor: '#66bb6a' }}>3</Box>
                </Stack>
              </Paper>
            </Box>
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.scrollable)}
                  onChange={(e) => handleChange('scrollable', e.target.checked)}
                />
              }
              label="Enable Scrolling (when content overflows)"
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.responsive)}
                  onChange={(e) => handleChange('responsive', e.target.checked)}
                />
              }
              label="Responsive Layout (adapt to screen size)"
            />
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  )
}

export default FlexBoxEditor 