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
  useMediaQuery,
  useTheme
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import FormatColorTextIcon from '@mui/icons-material/FormatColorText'
import InputAdornment from '@mui/material/InputAdornment'

import {
  TabPanelShared,
  ComponentPreview,
  EditorTabs
} from '../shared/SharedEditorComponents'

interface TextFieldEditorProps {
  props: Record<string, unknown>
  onChange: (updatedProps: Record<string, unknown>) => void
}

const TextFieldEditor: React.FC<TextFieldEditorProps> = ({ props, onChange }) => {
  // Theme and responsive design
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

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
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          width: '100%', 
          maxWidth: '300px',
          p: isMobile ? 1 : 2
        }}>
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
                <InputAdornment position="start">
                  <Typography sx={{ fontSize: isMobile ? '0.75rem' : undefined }}>
                    {props.startAdornmentText as string}
                  </Typography>
                </InputAdornment>
              ) : undefined,
              endAdornment: props.endAdornment ? (
                <InputAdornment position="end">
                  <Typography sx={{ fontSize: isMobile ? '0.75rem' : undefined }}>
                    {props.endAdornmentText as string}
                  </Typography>
                </InputAdornment>
              ) : undefined
            }}
            sx={{
              '& .MuiInputLabel-root': {
                fontSize: isMobile ? '0.875rem' : undefined
              },
              '& .MuiOutlinedInput-input': {
                fontSize: isMobile ? '0.875rem' : undefined
              },
              '& .MuiFormHelperText-root': {
                fontSize: isMobile ? '0.7rem' : '0.75rem'
              }
            }}
          />

          {/* Show validation information when present */}
          {(Boolean(props.required) || Boolean(props.error)) && (
            <Box sx={{ 
              mt: isMobile ? 0.5 : 1, 
              p: isMobile ? 0.5 : 1, 
              bgcolor: 'background.paper', 
              borderRadius: 1, 
              fontSize: isMobile ? '0.65rem' : '0.75rem' 
            }}>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                component="div"
                sx={{ fontSize: isMobile ? '0.65rem' : undefined }}
              >
                {Boolean(props.required) && <Box component="span" sx={{ mr: 1, fontWeight: 'medium' }}>Required</Box>}
                {Boolean(props.error) && <Box component="span" sx={{ mr: 1, color: 'error.main' }}>Error: {props.errorText as string}</Box>}
              </Typography>
            </Box>
          )}
          
          {/* Show field metadata */}
          <Box sx={{ 
            mt: isMobile ? 1 : 2, 
            pt: isMobile ? 1 : 2, 
            borderTop: '1px dashed rgba(0,0,0,0.1)', 
            display: 'flex', 
            justifyContent: 'center', 
            flexWrap: 'wrap', 
            gap: isMobile ? 0.5 : 1 
          }}>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'text.secondary',
                fontSize: isMobile ? '0.65rem' : undefined 
              }}
            >
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                {variant}
              </Box>
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'text.secondary',
                fontSize: isMobile ? '0.65rem' : undefined 
              }}
            >
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                {size}
              </Box>
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'text.secondary',
                fontSize: isMobile ? '0.65rem' : undefined 
              }}
            >
              <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                {type}
              </Box>
            </Typography>
            {Boolean(props.disabled) && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'text.secondary',
                  fontSize: isMobile ? '0.65rem' : undefined 
                }}
              >
                <Box component="span" sx={{ px: 0.5, py: 0.2, bgcolor: 'rgba(25, 118, 210, 0.1)', borderRadius: 0.5 }}>
                  disabled
                </Box>
              </Typography>
            )}
          </Box>
        </Box>
      </ComponentPreview>
      
      {/* Tabs Navigation */}
      <EditorTabs
        value={tabValue}
        onChange={handleTabChange}
        tabs={[
          { label: 'Basic Settings', id: 'textfield-basic', icon: <SettingsIcon fontSize={isMobile ? "small" : "medium"} /> },
          { label: 'Styling', id: 'textfield-styling', icon: <FormatColorTextIcon fontSize={isMobile ? "small" : "medium"} /> }
        ]}
      />
      
      {/* Basic Settings Tab */}
      <TabPanelShared value={tabValue} index={0} id="textfield-basic">
        <Grid container spacing={isMobile ? 1 : 2}>
          <Grid item xs={12}>
            <TextField
              label="Field Label"
              fullWidth
              size={isMobile ? "small" : "medium"}
              onFocus={(e) => { e.target.select() }}
              value={(props.label as string) || ''}
              onChange={(e) => handleChange('label', e.target.value)}
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
          
          <Grid item xs={12} sm={6}>
            <TextField
              label="Placeholder Text"
              fullWidth
              size={isMobile ? "small" : "medium"}
              onFocus={(e) => { e.target.select() }}
              value={(props.placeholder as string) || ''}
              onChange={(e) => handleChange('placeholder', e.target.value)}
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
          
          <Grid item xs={12} sm={6}>
            <TextField
              label="Default Value"
              fullWidth
              size={isMobile ? "small" : "medium"}
              onFocus={(e) => { e.target.select() }}
              value={(props.defaultValue as string) || ''}
              onChange={(e) => handleChange('defaultValue', e.target.value)}
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
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size={isMobile ? "small" : "medium"}>
              <InputLabel sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Input Type</InputLabel>
              <Select
                value={type}
                label="Input Type"
                onChange={(e) => {
                  setType(e.target.value)
                  handleChange('type', e.target.value)
                }}
                sx={{
                  '& .MuiSelect-select': { fontSize: isMobile ? '0.875rem' : undefined }
                }}
              >
                <MenuItem value="text" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Text</MenuItem>
                <MenuItem value="password" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Password</MenuItem>
                <MenuItem value="number" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Number</MenuItem>
                <MenuItem value="email" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Email</MenuItem>
                <MenuItem value="tel" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Telephone</MenuItem>
                <MenuItem value="date" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Date</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </TabPanelShared>
      
      {/* Styling Tab */}
      <TabPanelShared value={tabValue} index={1} id="textfield-styling">
        <Grid container spacing={isMobile ? 1 : 2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size={isMobile ? "small" : "medium"}>
              <InputLabel sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Variant</InputLabel>
              <Select
                value={variant}
                label="Variant"
                onChange={(e) => {
                  setVariant(e.target.value)
                  handleChange('variant', e.target.value)
                }}
                sx={{
                  '& .MuiSelect-select': { fontSize: isMobile ? '0.875rem' : undefined }
                }}
              >
                <MenuItem value="outlined" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Outlined</MenuItem>
                <MenuItem value="filled" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Filled</MenuItem>
                <MenuItem value="standard" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Standard</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size={isMobile ? "small" : "medium"}>
              <InputLabel sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Size</InputLabel>
              <Select
                value={size}
                label="Size"
                onChange={(e) => {
                  setSize(e.target.value)
                  handleChange('size', e.target.value)
                }}
                sx={{
                  '& .MuiSelect-select': { fontSize: isMobile ? '0.875rem' : undefined }
                }}
              >
                <MenuItem value="small" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Small</MenuItem>
                <MenuItem value="medium" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Medium</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: isMobile ? 1 : 2 }} />
            <Typography 
              variant={isMobile ? "body2" : "subtitle2"} 
              gutterBottom
              sx={{ fontSize: isMobile ? '0.875rem' : undefined }}
            >
              Validation
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.required)}
                  onChange={(e) => handleChange('required', e.target.checked)}
                  size={isMobile ? "small" : "medium"}
                />
              }
              label={
                <Typography sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>
                  Required Field
                </Typography>
              }
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.disabled)}
                  onChange={(e) => handleChange('disabled', e.target.checked)}
                  size={isMobile ? "small" : "medium"}
                />
              }
              label={
                <Typography sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>
                  Disabled
                </Typography>
              }
            />
          </Grid>

          <Grid item xs={12}>
            <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(props.error)}
                      onChange={(e) => handleChange('error', e.target.checked)}
                      size={isMobile ? "small" : "medium"}
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>
                      Error State
                    </Typography>
                  }
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
                    size={isMobile ? "small" : "medium"}
                    sx={{
                      '& .MuiInputLabel-root': {
                        fontSize: isMobile ? '0.875rem' : undefined
                      },
                      '& .MuiOutlinedInput-input': {
                        fontSize: isMobile ? '0.875rem' : undefined
                      }
                    }}
                  />
                )}
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: isMobile ? 1 : 2 }} />
            <Typography 
              variant={isMobile ? "body2" : "subtitle2"} 
              gutterBottom
              sx={{ fontSize: isMobile ? '0.875rem' : undefined }}
            >
              Input Adornments
            </Typography>
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
                  size={isMobile ? "small" : "medium"}
                />
              }
              label={
                <Typography sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>
                  Start Adornment
                </Typography>
              }
            />
            
            {hasStartAdornment && (
              <TextField
                label="Start Adornment Text"
                fullWidth
                value={(props.startAdornmentText as string) || '$'}
                onChange={(e) => handleChange('startAdornmentText', e.target.value)}
                sx={{ 
                  mt: isMobile ? 0.5 : 1,
                  '& .MuiInputLabel-root': {
                    fontSize: isMobile ? '0.875rem' : undefined
                  },
                  '& .MuiOutlinedInput-input': {
                    fontSize: isMobile ? '0.875rem' : undefined
                  }
                }}
                size={isMobile ? "small" : "medium"}
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
                  size={isMobile ? "small" : "medium"}
                />
              }
              label={
                <Typography sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>
                  End Adornment
                </Typography>
              }
            />
            
            {hasEndAdornment && (
              <TextField
                label="End Adornment Text"
                fullWidth
                value={(props.endAdornmentText as string) || 'kg'}
                onChange={(e) => handleChange('endAdornmentText', e.target.value)}
                sx={{ 
                  mt: isMobile ? 0.5 : 1,
                  '& .MuiInputLabel-root': {
                    fontSize: isMobile ? '0.875rem' : undefined
                  },
                  '& .MuiOutlinedInput-input': {
                    fontSize: isMobile ? '0.875rem' : undefined
                  }
                }}
                size={isMobile ? "small" : "medium"}
              />
            )}
          </Grid>
        </Grid>
      </TabPanelShared>
    </Box>
  )
}

export default TextFieldEditor 