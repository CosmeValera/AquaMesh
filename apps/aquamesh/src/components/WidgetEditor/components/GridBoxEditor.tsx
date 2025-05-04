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
import GridViewIcon from '@mui/icons-material/GridView'
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard'
import CodeIcon from '@mui/icons-material/Code'
import ColorLensIcon from '@mui/icons-material/ColorLens'

interface GridBoxEditorProps {
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
      id={`gridbox-tabpanel-${index}`}
      aria-labelledby={`gridbox-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  )
}

// Grid visualization component
const GridVisualizer: React.FC<{ columns: number, rows: number }> = ({ columns, rows }) => {
  const cells = []
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      cells.push(
        <Box
          key={`${row}-${col}`}
          sx={{
            border: '1px solid #ccc',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 1,
            backgroundColor: (row + col) % 2 === 0 ? 'rgba(66, 165, 245, 0.2)' : 'white',
            aspectRatio: '1/1',
            fontSize: '0.75rem'
          }}
        >
          {row + 1},{col + 1}
        </Box>
      )
    }
  }
  
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 1,
        width: '100%',
        maxWidth: '240px'
      }}
    >
      {cells}
    </Box>
  )
}

const GridBoxEditor: React.FC<GridBoxEditorProps> = ({ props, onChange }) => {
  // Tab state
  const [tabValue, setTabValue] = useState(0)
  
  // GridBox states
  const [columns, setColumns] = useState<number>(typeof props.columns === 'number' ? props.columns : 3)
  const [rows, setRows] = useState<number>(typeof props.rows === 'number' ? props.rows : 2)
  const [spacing, setSpacing] = useState<number>(typeof props.spacing === 'number' ? props.spacing : 2)
  const [minHeight, setMinHeight] = useState<number>(typeof props.minHeight === 'number' ? props.minHeight : 0)
  const [autoRows, setAutoRows] = useState(Boolean(props.autoRows))
  const [equalHeight, setEqualHeight] = useState(Boolean(props.equalHeight))
  const [useCustomColor, setUseCustomColor] = useState(Boolean(props.useCustomColor))
  const [backgroundColor, setBackgroundColor] = useState((props.backgroundColor as string) || '#f5f5f5')
  const [borderColor, setBorderColor] = useState((props.borderColor as string) || '#e0e0e0')
  
  // Initialize state based on props
  useEffect(() => {
    if (typeof props.columns === 'number') {
      setColumns(props.columns)
    }
    
    if (typeof props.rows === 'number') {
      setRows(props.rows)
    }
    
    if (typeof props.spacing === 'number') {
      setSpacing(props.spacing)
    }
    
    if (typeof props.minHeight === 'number') {
      setMinHeight(props.minHeight)
    }
    
    setAutoRows(Boolean(props.autoRows))
    setEqualHeight(Boolean(props.equalHeight))
    setUseCustomColor(Boolean(props.useCustomColor))
    
    if (props.backgroundColor) {
      setBackgroundColor(props.backgroundColor as string)
    }
    
    if (props.borderColor) {
      setBorderColor(props.borderColor as string)
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
  
  // Custom color toggle
  const handleCustomColorToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    setUseCustomColor(checked)
    
    if (checked) {
      handleChange('useCustomColor', true)
      handleChange('backgroundColor', backgroundColor)
      handleChange('borderColor', borderColor)
    } else {
      const newProps = { ...props }
      delete newProps.useCustomColor
      delete newProps.backgroundColor
      delete newProps.borderColor
      onChange(newProps)
    }
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
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <GridVisualizer columns={columns} rows={rows} />
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
          <Tab label="Grid Layout" icon={<GridViewIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Spacing" icon={<SpaceDashboardIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Appearance" icon={<ColorLensIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Advanced" icon={<CodeIcon fontSize="small" />} iconPosition="start" />
        </Tabs>
      </Box>
      
      {/* Grid Layout Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Columns"
              type="number"
              fullWidth
              value={columns}
              onChange={(e) => {
                const value = Number(e.target.value)
                setColumns(value)
                handleChange('columns', value)
              }}
              inputProps={{ min: 1, max: 12, step: 1 }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              label="Rows"
              type="number"
              fullWidth
              value={rows}
              onChange={(e) => {
                const value = Number(e.target.value)
                setRows(value)
                handleChange('rows', value)
              }}
              inputProps={{ min: 1, max: 12, step: 1 }}
              disabled={autoRows}
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoRows}
                  onChange={(e) => {
                    setAutoRows(e.target.checked)
                    handleChange('autoRows', e.target.checked)
                  }}
                />
              }
              label="Auto-calculate Rows (based on children)"
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={equalHeight}
                  onChange={(e) => {
                    setEqualHeight(e.target.checked)
                    handleChange('equalHeight', e.target.checked)
                  }}
                />
              }
              label="Equal Height Cells"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>
          
          <Grid item xs={12}>
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
              helperText="0 = Auto height"
            />
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Spacing Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography gutterBottom>
              Grid Gap: {spacing}
            </Typography>
            <Slider
              value={spacing}
              min={0}
              max={5}
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
            <Box sx={{ mt: 2, mb: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Spacing Visualization
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  backgroundColor: '#f5f5f5',
                  border: '1px dashed #aaa'
                }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: spacing,
                    '& > div': { 
                      height: 40, 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      fontWeight: 'bold',
                      color: 'white',
                      borderRadius: 1
                    }
                  }}
                >
                  <Box sx={{ bgcolor: '#ef5350' }}>A</Box>
                  <Box sx={{ bgcolor: '#42a5f5' }}>B</Box>
                  <Box sx={{ bgcolor: '#66bb6a' }}>C</Box>
                  <Box sx={{ bgcolor: '#ff9800' }}>D</Box>
                </Box>
              </Paper>
            </Box>
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>
          
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Cell Padding</InputLabel>
              <Select
                value={(props.cellPadding as string) || 'normal'}
                label="Cell Padding"
                onChange={(e) => handleChange('cellPadding', e.target.value)}
              >
                <MenuItem value="none">None</MenuItem>
                <MenuItem value="small">Small</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="large">Large</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Appearance Tab */}
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
          
          {/* Custom Color Pickers */}
          {useCustomColor && (
            <>
              <Grid item xs={12} sm={6}>
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
                      placeholder="#f5f5f5"
                      variant="outlined"
                    />
                  </Box>
                </Box>
              </Grid>
              
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
                      placeholder="#e0e0e0"
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
            <FormControl fullWidth>
              <InputLabel>Cell Border Style</InputLabel>
              <Select
                value={(props.borderStyle as string) || 'none'}
                label="Cell Border Style"
                onChange={(e) => handleChange('borderStyle', e.target.value)}
              >
                <MenuItem value="none">None</MenuItem>
                <MenuItem value="solid">Solid</MenuItem>
                <MenuItem value="dashed">Dashed</MenuItem>
                <MenuItem value="dotted">Dotted</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Cell Border Radius</InputLabel>
              <Select
                value={(props.borderRadius as string) || 'small'}
                label="Cell Border Radius"
                onChange={(e) => handleChange('borderRadius', e.target.value)}
              >
                <MenuItem value="none">None</MenuItem>
                <MenuItem value="small">Small</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="large">Large</MenuItem>
              </Select>
            </FormControl>
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
              placeholder="my-custom-grid-class"
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
              label="Responsive Grid (adjust columns on small screens)"
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.alignCenter)}
                  onChange={(e) => handleChange('alignCenter', e.target.checked)}
                />
              }
              label="Center Content Horizontally"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="CSS Grid Template Areas"
              fullWidth
              multiline
              rows={3}
              value={(props.gridTemplateAreas as string) || ''}
              onChange={(e) => handleChange('gridTemplateAreas', e.target.value)}
              placeholder='"header header" "sidebar content" "footer footer"'
              helperText="Advanced: Define named grid areas (use with caution)"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Data Test ID"
              fullWidth
              value={(props.dataTestId as string) || ''}
              onChange={(e) => handleChange('dataTestId', e.target.value)}
              placeholder="grid-test-id"
              helperText="For automated testing"
            />
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  )
}

export default GridBoxEditor 