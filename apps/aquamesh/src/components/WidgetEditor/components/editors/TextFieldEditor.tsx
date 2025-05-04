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
  InputAdornment
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import FormatColorTextIcon from '@mui/icons-material/FormatColorText'
import CodeIcon from '@mui/icons-material/Code'

interface TextFieldEditorProps {
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
      id={`textfield-tabpanel-${index}`}
      aria-labelledby={`textfield-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  )
}

const TextFieldEditor: React.FC<TextFieldEditorProps> = ({ props, onChange }) => {
  // Tab state
  const [tabValue, setTabValue] = useState(0)
  
  // Field states
  const [variant, setVariant] = useState((props.variant as string) || 'outlined')
  const [size, setSize] = useState((props.size as string) || 'medium')
  const [type, setType] = useState((props.type as string) || 'text')
  const [showHelperText, setShowHelperText] = useState(Boolean(props.helperText))
  const [hasStartAdornment, setHasStartAdornment] = useState(Boolean(props.startAdornment))
  const [hasEndAdornment, setHasEndAdornment] = useState(Boolean(props.endAdornment))
  
  // Initialize state based on props
  useEffect(() => {
    if (props.variant) {
      setVariant(props.variant as string)
    }
    
    if (props.size) {
      setSize(props.size as string)
    }
    
    if (props.type) {
      setType(props.type as string)
    }
    
    setShowHelperText(Boolean(props.helperText))
    setHasStartAdornment(Boolean(props.startAdornment))
    setHasEndAdornment(Boolean(props.endAdornment))
  }, [props])
  
  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }
  
  // Generic change handler
  const handleChange = (name: string, value: unknown) => {
    onChange({ ...props, [name]: value })
  }
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Preview Section */}
      <Paper variant="outlined" sx={{ mb: 2, p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <TextField
          label={(props.label as string) || 'Label'}
          placeholder={(props.placeholder as string) || 'Placeholder text'}
          defaultValue={(props.defaultValue as string) || ''}
          variant={variant as 'outlined' | 'filled' | 'standard'}
          size={size as 'small' | 'medium'}
          type={type as string}
          fullWidth
          helperText={showHelperText ? (props.helperText as string) || 'Helper text' : undefined}
          required={Boolean(props.required)}
          disabled={Boolean(props.disabled)}
          error={Boolean(props.error)}
          multiline={Boolean(props.multiline)}
          rows={props.multiline ? ((props.rows as number) || 3) : undefined}
          InputProps={{
            startAdornment: hasStartAdornment ? (
              <InputAdornment position="start">
                {(props.startAdornmentText as string) || '$'}
              </InputAdornment>
            ) : undefined,
            endAdornment: hasEndAdornment ? (
              <InputAdornment position="end">
                {(props.endAdornmentText as string) || '.00'}
              </InputAdornment>
            ) : undefined
          }}
        />
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
          <Tab label="Appearance" icon={<FormatColorTextIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Validation" icon={<CodeIcon fontSize="small" />} iconPosition="start" />
        </Tabs>
      </Box>
      
      {/* Basic Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Field Label"
              fullWidth
              value={(props.label as string) || ''}
              onChange={(e) => handleChange('label', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Placeholder Text"
              fullWidth
              value={(props.placeholder as string) || ''}
              onChange={(e) => handleChange('placeholder', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Default Value"
              fullWidth
              value={(props.defaultValue as string) || ''}
              onChange={(e) => handleChange('defaultValue', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Input Type</InputLabel>
              <Select
                value={type}
                label="Input Type"
                onChange={(e) => {
                  setType(e.target.value)
                  handleChange('type', e.target.value)
                }}
              >
                <MenuItem value="text">Text</MenuItem>
                <MenuItem value="password">Password</MenuItem>
                <MenuItem value="number">Number</MenuItem>
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="tel">Telephone</MenuItem>
                <MenuItem value="url">URL</MenuItem>
                <MenuItem value="date">Date</MenuItem>
                <MenuItem value="datetime-local">Date & Time</MenuItem>
                <MenuItem value="time">Time</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.multiline)}
                  onChange={(e) => {
                    handleChange('multiline', e.target.checked)
                    if (e.target.checked && !props.rows) {
                      handleChange('rows', 3)
                    }
                  }}
                />
              }
              label="Multiline"
            />
            
            {Boolean(props.multiline) && (
              <TextField
                label="Rows"
                type="number"
                value={(props.rows as number) || 3}
                onChange={(e) => handleChange('rows', Number(e.target.value))}
                inputProps={{ min: 2, max: 10 }}
                size="small"
                sx={{ mt: 1 }}
              />
            )}
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Appearance Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Variant</InputLabel>
              <Select
                value={variant}
                label="Variant"
                onChange={(e) => {
                  setVariant(e.target.value)
                  handleChange('variant', e.target.value)
                }}
              >
                <MenuItem value="outlined">Outlined</MenuItem>
                <MenuItem value="filled">Filled</MenuItem>
                <MenuItem value="standard">Standard</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Size</InputLabel>
              <Select
                value={size}
                label="Size"
                onChange={(e) => {
                  setSize(e.target.value)
                  handleChange('size', e.target.value)
                }}
              >
                <MenuItem value="small">Small</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={showHelperText}
                  onChange={(e) => {
                    setShowHelperText(e.target.checked)
                    if (e.target.checked && !props.helperText) {
                      handleChange('helperText', 'Helper text')
                    }
                  }}
                />
              }
              label="Show Helper Text"
            />
            
            {showHelperText && (
              <TextField
                label="Helper Text"
                fullWidth
                value={(props.helperText as string) || 'Helper text'}
                onChange={(e) => handleChange('helperText', e.target.value)}
                sx={{ mt: 1 }}
              />
            )}
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2">Input Adorments</Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={hasStartAdornment}
                  onChange={(e) => {
                    setHasStartAdornment(e.target.checked)
                    if (e.target.checked && !props.startAdornmentText) {
                      handleChange('startAdornmentText', '$')
                    }
                  }}
                />
              }
              label="Start Adornment"
            />
            
            {hasStartAdornment && (
              <TextField
                label="Start Adornment Text"
                fullWidth
                value={(props.startAdornmentText as string) || '$'}
                onChange={(e) => handleChange('startAdornmentText', e.target.value)}
                sx={{ mt: 1 }}
              />
            )}
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={hasEndAdornment}
                  onChange={(e) => {
                    setHasEndAdornment(e.target.checked)
                    if (e.target.checked && !props.endAdornmentText) {
                      handleChange('endAdornmentText', '.00')
                    }
                  }}
                />
              }
              label="End Adornment"
            />
            
            {hasEndAdornment && (
              <TextField
                label="End Adornment Text"
                fullWidth
                value={(props.endAdornmentText as string) || '.00'}
                onChange={(e) => handleChange('endAdornmentText', e.target.value)}
                sx={{ mt: 1 }}
              />
            )}
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Validation Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.required)}
                  onChange={(e) => handleChange('required', e.target.checked)}
                />
              }
              label="Required Field"
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.error)}
                  onChange={(e) => handleChange('error', e.target.checked)}
                />
              }
              label="Error State"
            />
            
            {Boolean(props.error) && (
              <TextField
                label="Error Text"
                fullWidth
                value={(props.errorText as string) || 'This field has an error'}
                onChange={(e) => handleChange('errorText', e.target.value)}
                sx={{ mt: 1 }}
              />
            )}
          </Grid>
          
          {type === 'text' && (
            <>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Min Length"
                  type="number"
                  fullWidth
                  value={(props.minLength as number) || ''}
                  onChange={(e) => handleChange('minLength', Number(e.target.value))}
                  inputProps={{ min: 0 }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Max Length"
                  type="number"
                  fullWidth
                  value={(props.maxLength as number) || ''}
                  onChange={(e) => handleChange('maxLength', Number(e.target.value))}
                  inputProps={{ min: 0 }}
                />
              </Grid>
            </>
          )}
          
          {type === 'number' && (
            <>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Min Value"
                  type="number"
                  fullWidth
                  value={(props.min as number) || ''}
                  onChange={(e) => handleChange('min', Number(e.target.value))}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Max Value"
                  type="number"
                  fullWidth
                  value={(props.max as number) || ''}
                  onChange={(e) => handleChange('max', Number(e.target.value))}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Step"
                  type="number"
                  fullWidth
                  value={(props.step as number) || ''}
                  onChange={(e) => handleChange('step', Number(e.target.value))}
                  inputProps={{ min: 0 }}
                />
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
                  checked={Boolean(props.disabled)}
                  onChange={(e) => handleChange('disabled', e.target.checked)}
                />
              }
              label="Disabled"
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.autoFocus)}
                  onChange={(e) => handleChange('autoFocus', e.target.checked)}
                />
              }
              label="Auto Focus"
            />
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  )
}

export default TextFieldEditor 