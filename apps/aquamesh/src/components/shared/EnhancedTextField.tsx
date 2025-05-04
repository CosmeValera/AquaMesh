import React, { useState, useEffect } from 'react'
import {
  TextField,
  TextFieldProps,
  InputAdornment,
  Typography,
  Box,
  Tooltip,
  IconButton,
  Fade,
  useTheme
} from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'

// Additional props for the enhanced field
interface EnhancedTextFieldProps extends Omit<TextFieldProps, 'variant'> {
  /**
   * Show success state when valid
   */
  showSuccessState?: boolean

  /**
   * Field ID for accessibility
   */
  fieldId?: string

  /**
   * Custom validation function
   */
  validate?: (value: string) => { isValid: boolean; message?: string }

  /**
   * Optional tooltip content for additional information
   */
  tooltipContent?: React.ReactNode

  /**
   * Show character count
   */
  showCharCount?: boolean

  /**
   * Variant of the text field
   */
  variant?: 'outlined' | 'filled' | 'standard'
}

/**
 * Enhanced TextField with improved validation and accessibility
 */
const EnhancedTextField: React.FC<EnhancedTextFieldProps> = ({
  error,
  helperText,
  label,
  showSuccessState = false,
  required = false,
  disabled = false,
  fieldId,
  validate,
  tooltipContent,
  showCharCount = false,
  type = 'text',
  onChange,
  value,
  inputProps,
  InputProps,
  variant = 'outlined',
  ...rest
}) => {
  const theme = useTheme()
  const [localValue, setLocalValue] = useState<string>((value as string) || '')
  const [validationState, setValidationState] = useState<{
    isValid: boolean
    message?: string
    checked: boolean
  }>({
    isValid: true,
    message: '',
    checked: false
  })
  const [showPassword, setShowPassword] = useState(false)

  // Generate an ID if not provided
  const id = fieldId || `field-${label?.toString().toLowerCase().replace(/\s+/g, '-')}`

  // Handle local changes and validation
  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)

    // Run custom validation if provided
    if (validate) {
      const result = validate(newValue)
      setValidationState({
        isValid: result.isValid,
        message: result.message,
        checked: true
      })
    }

    // Call original onChange handler
    if (onChange) {
      onChange(e)
    }
  }

  // Update local value when value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setLocalValue(value as string)
    }
  }, [value])

  // Component to show validation state
  const renderValidationIcon = () => {
    // Don't show validation on empty required fields until user interacts
    if (required && !localValue && !validationState.checked) {
      return null
    }

    // Show error icon if error is true or validation failed
    if (error || (validationState.checked && !validationState.isValid)) {
      return (
        <InputAdornment position="end">
          <Tooltip 
            title={validationState.message || helperText || 'Invalid input'} 
            arrow
          >
            <ErrorOutlineIcon color="error" fontSize="small" />
          </Tooltip>
        </InputAdornment>
      )
    }

    // Show success icon if configured and validation passed
    if (showSuccessState && localValue && validationState.isValid) {
      return (
        <InputAdornment position="end">
          <CheckCircleIcon 
            sx={{ 
              color: theme.palette.success.main,
              opacity: 0.8
            }} 
            fontSize="small" 
          />
        </InputAdornment>
      )
    }

    return null
  }

  // Password toggle for password fields
  const renderPasswordToggle = () => {
    if (type !== 'password') return null

    return (
      <InputAdornment position="end">
        <IconButton
          aria-label={showPassword ? "Hide password" : "Show password"}
          onClick={() => setShowPassword(!showPassword)}
          edge="end"
          size="small"
        >
          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
        </IconButton>
      </InputAdornment>
    )
  }

  // Info tooltip icon
  const renderTooltipIcon = () => {
    if (!tooltipContent) return null

    return (
      <InputAdornment position="end">
        <Tooltip 
          title={
            <Box sx={{ p: 0.5 }}>
              {tooltipContent}
            </Box>
          } 
          arrow
        >
          <InfoOutlinedIcon 
            color="action" 
            fontSize="small" 
            sx={{ ml: 0.5, opacity: 0.7, cursor: 'help' }}
          />
        </Tooltip>
      </InputAdornment>
    )
  }

  // Combine all end adornments
  const getEndAdornments = () => {
    const adornments = []
    
    if (renderValidationIcon()) {
      adornments.push(renderValidationIcon())
    }
    
    if (renderPasswordToggle()) {
      adornments.push(renderPasswordToggle())
    }
    
    if (renderTooltipIcon()) {
      adornments.push(renderTooltipIcon())
    }
    
    return adornments.length > 0 ? adornments : null
  }

  // Determine actual error state
  const hasError = error || (validationState.checked && !validationState.isValid)

  // Calculate actual helper text
  const actualHelperText = validationState.checked && !validationState.isValid
    ? validationState.message || helperText
    : helperText

  return (
    <Box sx={{ width: '100%' }}>
      <TextField
        id={id}
        label={label}
        value={value !== undefined ? value : localValue}
        onChange={handleLocalChange}
        required={required}
        disabled={disabled}
        error={hasError}
        helperText={actualHelperText}
        variant={variant}
        type={type === 'password' ? (showPassword ? 'text' : 'password') : type}
        InputProps={{
          ...InputProps,
          endAdornment: getEndAdornments()
        }}
        inputProps={{
          'aria-invalid': hasError,
          'aria-describedby': `${id}-helper`,
          ...inputProps
        }}
        FormHelperTextProps={{
          id: `${id}-helper`
        }}
        {...rest}
      />
      
      {/* Character count */}
      {showCharCount && (
        <Fade in={true}>
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{ 
              display: 'block', 
              textAlign: 'right',
              mt: 0.5,
              color: hasError ? 'error.main' : 'text.secondary'
            }}
          >
            {localValue?.length || 0}
            {inputProps?.maxLength && `/${inputProps.maxLength}`}
          </Typography>
        </Fade>
      )}
    </Box>
  )
}

export default EnhancedTextField 