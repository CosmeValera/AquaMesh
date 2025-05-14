import { SxProps, Theme } from '@mui/material'

/**
 * Standardized dialog styles for AquaMesh application
 * This ensures visual consistency across all modal dialogs
 */
export const dialogStyles = {
  // Dialog Paper container
  paper: {
    borderRadius: '12px',
    overflow: 'hidden',
    bgcolor: '#00A389',
    boxShadow: '0 8px 16px rgba(0,0,0,0.25)'
  },
  
  // Dialog title with gradient background
  title: { 
    bgcolor: '#00BC9A',
    backgroundImage: 'linear-gradient(135deg, #00BC9A 0%, #008C8C 100%)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    px: 3,
    py: 1.75,
    position: 'relative'
  },
  
  // Content area
  content: {
    px: 3, 
    pt: 2.5, 
    pb: 1.5,
    bgcolor: '#00A389',
    color: 'white'
  },
  
  // Actions area (footer)
  actions: { 
    px: 3, 
    py: 1.5, 
    bgcolor: '#00A389',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    justifyContent: 'flex-end',
    gap: 2 
  },
  
  // Centered actions (for confirmation dialogs)
  centeredActions: {
    px: 3, 
    py: 1.5, 
    bgcolor: '#00A389',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    gap: 2
  },
  
  // Close button in title
  closeButton: {
    position: 'absolute', 
    right: 8, 
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'white',
    '&:hover': {
      bgcolor: 'rgba(255,255,255,0.1)'
    }
  },

  // Error dialog title (for delete confirmations)
  errorTitle: {
    bgcolor: 'error.main',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    px: 3,
    py: 1.5,
    position: 'relative'
  },

  // Secondary title variant
  secondaryTitle: {
    bgcolor: '#9c27b0', // Purple background
    backgroundImage: 'linear-gradient(135deg, #9c27b0 0%, #6A1B9A 100%)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    px: 3,
    py: 1.75,
    position: 'relative'
  },
  
  // Info dialog title
  infoTitle: {
    bgcolor: '#2196f3', // Blue background
    backgroundImage: 'linear-gradient(135deg, #2196f3 0%, #0d47a1 100%)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    px: 3,
    py: 1.75,
    position: 'relative'
  },
  
  // Small dialog content for confirmation modals
  confirmationContent: {
    px: 3, 
    py: 2.5, 
    bgcolor: '#00A389',
    color: 'white',
    minWidth: 320, // Ensure sensible minimum width
    textAlign: 'center'
  },
}

export const buttonStyles = {
  // Primary action button with gradient
  primary: {
    px: 3,
    py: 1,
    minWidth: 100,
    backgroundImage: 'linear-gradient(135deg, #00BC9A 0%, #008C8C 100%)',
    color: 'white',
    fontWeight: 500,
    '&:hover': {
      backgroundImage: 'linear-gradient(135deg, #00CEAA 0%, #009D9D 100%)',
    },
    '&:disabled': {
      color: 'rgba(255,255,255,0.5)',
      backgroundImage: 'linear-gradient(135deg, rgba(0,188,154,0.5) 0%, rgba(0,140,140,0.5) 100%)',
    }
  },
  
  // Secondary action button (outlined)
  secondary: {
    px: 3,
    py: 1,
    minWidth: 100,
    color: 'white',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    '&:hover': {
      borderColor: 'white',
      bgcolor: 'rgba(255, 255, 255, 0.05)'
    }
  },
  
  // Danger/delete button
  danger: {
    px: 3,
    py: 1,
    minWidth: 100,
    fontWeight: 500,
    bgcolor: 'error.main',
    color: 'white',
    '&:hover': {
      bgcolor: 'error.dark',
    }
  },

  // Success button
  success: {
    px: 3,
    py: 1,
    minWidth: 100,
    fontWeight: 500,
    bgcolor: '#4caf50', // Green
    color: 'white',
    '&:hover': {
      bgcolor: '#388e3c', // Darker green
    }
  },

  // Info button
  info: {
    px: 3,
    py: 1,
    minWidth: 100,
    fontWeight: 500,
    backgroundImage: 'linear-gradient(135deg, #2196f3 0%, #0d47a1 100%)',
    color: 'white',
    '&:hover': {
      backgroundImage: 'linear-gradient(135deg, #42a5f5 0%, #1565c0 100%)',
    }
  },

  // Small button
  small: {
    px: 2,
    py: 0.5,
    minWidth: 70,
    fontSize: '0.875rem',
  },
  
  // Icon button styles
  icon: {
    color: 'white',
    '&:hover': {
      bgcolor: 'rgba(255,255,255,0.1)'
    }
  }
} as const

// Styles for cards within dialogs (for things like template selection, widget management)
export const cardStyles = {
  // Basic card style
  base: {
    bgcolor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 2,
    transition: 'all 0.2s ease-in-out',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    '&:hover': {
      borderColor: 'rgba(255, 255, 255, 0.3)',
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
    }
  },
  
  // Selected card style
  selected: {
    borderColor: 'white',
    bgcolor: 'rgba(255, 255, 255, 0.05)'
  },
  
  // Card content
  content: {
    p: 2
  },
  
  // Card actions
  actions: {
    bgcolor: 'rgba(0, 0, 0, 0.05)',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    p: 1.5
  },

  // Feature card - for highlighted items
  feature: {
    bgcolor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 2,
    transition: 'all 0.2s ease-in-out',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    '&:hover': {
      borderColor: 'rgba(255, 255, 255, 0.4)',
      transform: 'translateY(-3px)',
      boxShadow: '0 6px 12px rgba(0,0,0,0.2)'
    }
  },
  
  // Card with colored top border  
  highlight: {
    bgcolor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 2,
    transition: 'all 0.2s ease-in-out',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderTop: '4px solid #00BC9A',
    '&:hover': {
      borderColor: 'rgba(255, 255, 255, 0.3)',
      borderTopColor: '#00BC9A',
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
    }
  }
}

// Standardized chip/tag styling
export const chipStyles = {
  base: {
    m: 0.5,
    color: 'white',
    '& .MuiChip-label': {
      fontWeight: 400
    }
  },
  small: {
    m: 0.25,
    height: 22,
    fontSize: '0.7rem',
    color: 'white',
    '& .MuiChip-label': {
      px: 1,
      fontWeight: 400
    }
  },
  filled: {
    m: 0.5,
    color: 'white',
    fontWeight: 'bold',
    '& .MuiChip-label': {
      fontWeight: 500
    }
  }
}

// Form field styles for dialogs
export const formFieldStyles = {
  input: {
    '& .MuiInputBase-input': {
      color: 'white',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: 'white',
    }
  },
  inputLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  helperText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  select: {
    '& .MuiSelect-icon': {
      color: 'rgba(255, 255, 255, 0.7)',
    },
  },
  checkbox: {
    color: 'rgba(255, 255, 255, 0.7)',
    '&.Mui-checked': {
      color: 'white',
    },
  },
  switch: {
    '& .MuiSwitch-switchBase': {
      '&.Mui-checked': {
        color: 'white',
        '& + .MuiSwitch-track': {
          backgroundColor: '#00BC9A',
        },
      },
    },
    '& .MuiSwitch-track': {
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
  }
}

// Standard color mapping for tags
export const TAG_COLOR_MAP: Record<string, 'default'|'primary'|'secondary'|'error'|'info'|'success'|'warning'> = {
  form: 'primary',
  input: 'warning',
  dashboard: 'success',
  stats: 'info',
  chart: 'info',
  report: 'warning',
  status: 'error',
  metrics: 'primary',
  'user data': 'info',
  monitoring: 'success',
  custom: 'secondary',
  template: 'secondary',
  system: 'error',
  // Add more tag mappings as needed
}

// Helper function to apply consistent dialog styling
export const applyDialogStyles = (type: 'standard' | 'error' | 'info' | 'secondary' = 'standard'): {
  PaperProps: { sx: SxProps<Theme> }
} => {
  const titleStyle = 
    type === 'error' ? dialogStyles.errorTitle :
    type === 'info' ? dialogStyles.infoTitle :
    type === 'secondary' ? dialogStyles.secondaryTitle :
    dialogStyles.title;
    
  return {
    PaperProps: {
      sx: {
        ...dialogStyles.paper,
        // Apply any type-specific customizations here
      }
    }
  }
}

// Suggested text styles for consistent typography
export const textStyles = {
  title: {
    fontWeight: 600, 
    color: 'white',
    mb: 1.5
  },
  subtitle: {
    fontWeight: 500,
    color: 'white',
    mb: 1
  },
  body: {
    color: 'rgba(255, 255, 255, 0.9)',
    mb: 2
  },
  caption: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '0.75rem'
  }
} 