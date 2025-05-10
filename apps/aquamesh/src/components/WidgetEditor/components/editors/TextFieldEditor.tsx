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
  Tab
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import FormatColorTextIcon from '@mui/icons-material/FormatColorText'
import InputAdornment from '@mui/material/InputAdornment'

import {
  TabPanelShared,
  ComponentPreview
} from '../shared/SharedEditorComponents'

interface TextFieldEditorProps {
  props: Record<string, unknown>
  onChange: (updatedProps: Record<string, unknown>) => void
}

const TextFieldEditor: React.FC<TextFieldEditorProps> = ({ props, onChange }) => {
  // Tab state
  const [tabValue, setTabValue] = useState(0)
  
  // Field states
  const [variant, setVariant] = useState((props.variant as string) || 'outlined')
  const [size, setSize] = useState((props.size as string) || 'medium')
  const [type, setType] = useState((props.type as string) || 'text')
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
      {/* Preview section */}
      <ComponentPreview>
        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '300px' }}>
          <TextField
            label={props.label as string || 'Label'}
            placeholder={props.placeholder as string || 'Placeholder'}
            defaultValue={props.defaultValue as string || ''}
            variant={(props.variant as 'outlined' | 'filled' | 'standard') || 'outlined'}
            size={(props.size as 'small' | 'medium') || 'medium'}
            required={Boolean(props.required)}
            error={Boolean(props.error)}
            helperText={props.error ? (props.errorText as string || 'Error text') : (props.helperText as string || '')}
            fullWidth
            disabled={Boolean(props.disabled)}
            type={props.type as string || 'text'}
            InputProps={{
              startAdornment: props.startAdornment ? (
                <InputAdornment position="start">{props.startAdornmentText as string}</InputAdornment>
              ) : undefined,
              endAdornment: props.endAdornment ? (
                <InputAdornment position="end">{props.endAdornmentText as string}</InputAdornment>
              ) : undefined
            }}
          />

          {/* Show validation information when present */}
          {(props.required || props.error) && (
            <Box sx={{ mt: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1, fontSize: '0.75rem' }}>
              <Typography variant="caption" color="text.secondary" component="div">
                {props.required && <Box component="span" sx={{ mr: 1, fontWeight: 'medium' }}>Required</Box>}
                {props.error && <Box component="span" sx={{ mr: 1, color: 'error.main' }}>Error: {props.errorText}</Box>}
              </Typography>
            </Box>
          )}
          
          {/* Show field metadata */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                {variant}
              </Box>
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                {size}
              </Box>
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                {type}
              </Box>
            </Typography>
            {Boolean(props.disabled) && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                  disabled
                </Box>
              </Typography>
            )}
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
          <Tab label="Basic" icon={<SettingsIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Advanced" icon={<FormatColorTextIcon fontSize="small" />} iconPosition="start" />
        </Tabs>
      </Box>
      
      {/* Basic Tab */}
      <TabPanelShared value={tabValue} index={0}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Field Label"
              fullWidth
              value={(props.label as string) || ''}
              onChange={(e) => handleChange('label', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              label="Placeholder Text"
              fullWidth
              value={(props.placeholder as string) || ''}
              onChange={(e) => handleChange('placeholder', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
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
                <MenuItem value="date">Date</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </TabPanelShared>
      
      {/* Appearance Tab */}
      <TabPanelShared value={tabValue} index={1}>
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
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>Validation</Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
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
          
          <Grid item xs={12} sm={6}>
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
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(props.error)}
                      onChange={(e) => handleChange('error', e.target.checked)}
                    />
                  }
                  label="Error State"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                {Boolean(props.error) && (
                  <TextField
                    label="Error Text"
                    fullWidth
                    value={(props.errorText as string) || ''}
                    onChange={(e) => handleChange('errorText', e.target.value)}
                    margin="none"
                    size="small"
                  />
                )}
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>Input Adornments</Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={hasStartAdornment}
                  onChange={(e) => {
                    setHasStartAdornment(e.target.checked)
                    handleChange('startAdornment', e.target.checked)
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
                    handleChange('endAdornment', e.target.checked)
                    if (e.target.checked && !props.endAdornmentText) {
                      handleChange('endAdornmentText', 'kg')
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
                value={(props.endAdornmentText as string) || 'kg'}
                onChange={(e) => handleChange('endAdornmentText', e.target.value)}
                sx={{ mt: 1 }}
              />
            )}
          </Grid>
        </Grid>
      </TabPanelShared>
    </Box>
  )
}

export default TextFieldEditor 