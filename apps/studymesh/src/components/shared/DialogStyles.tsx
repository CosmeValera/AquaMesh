import { SxProps, Theme } from '@mui/material'

/**
 * Standardized dialog styles for StudyMesh application
 * This ensures visual consistency across all modal dialogs
 */
export const dialogStyles = {
  // Dialog Paper container
  paper: {
    borderRadius: '12px',
    overflow: 'hidden',
    bgcolor: 'background.paper',
    color: 'text.primary',
    boxShadow: '0 12px 32px rgba(16, 42, 45, 0.16)',
    border: '1px solid',
    borderColor: 'divider',
  },

  // Dialog title with gradient background (matching TutorialModal)
  title: {
    bgcolor: 'background.paper',
    color: 'text.primary',
    display: 'flex',
    alignItems: 'center',
    px: 3,
    py: 2,
    position: 'relative',
    borderBottom: '1px solid',
    borderColor: 'divider',
  },

  // Content area
  content: {
    px: 3,
    pt: 2.5,
    pb: 1.5,
    bgcolor: 'background.paper',
    color: 'text.primary',
  },

  // Actions area (footer)
  actions: {
    px: 3,
    pb: 3,
    bgcolor: 'background.paper',
    borderTop: '1px solid',
    borderColor: 'divider',
    justifyContent: 'flex-end',
    gap: 2,
  },

  // Centered actions (for confirmation dialogs)
  centeredActions: {
    px: 3,
    py: 1.5,
    bgcolor: 'background.paper',
    borderTop: '1px solid',
    borderColor: 'divider',
    justifyContent: 'center',
    gap: 2,
  },

  // Close button in title
  closeButton: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'text.primary',
    bgcolor: 'transparent',
    border: '1px solid',
    borderColor: 'transparent',
    '&:hover': {
      bgcolor: 'action.hover',
      borderColor: 'divider',
      color: 'text.primary',
    },
    '&.Mui-disabled': {
      bgcolor: 'transparent',
      borderColor: 'transparent',
      color: 'text.disabled',
    },
  },

  // Error dialog title (for delete confirmations)
  errorTitle: {
    bgcolor: 'error.main',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    px: 3,
    py: 1.5,
    position: 'relative',
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
    position: 'relative',
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
    position: 'relative',
  },

  // Small dialog content for confirmation modals
  confirmationContent: {
    px: 3,
    py: 2.5,
    bgcolor: 'background.paper',
    color: 'text.primary',
    minWidth: 320, // Ensure sensible minimum width
    textAlign: 'center',
  },
}

export const buttonStyles = {
  // Primary action button
  primary: {
    px: 3,
    py: 1,
    minWidth: 100,
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
    fontWeight: 500,
    '&:hover': {
      bgcolor: 'primary.dark',
    },
    '&:disabled': {
      color: 'rgba(255,255,255,0.5)',
      bgcolor: 'action.disabled',
    },
  },

  // Secondary action button (outlined)
  secondary: {
    px: 3,
    py: 1,
    minWidth: 100,
    color: 'primary.dark',
    borderColor: 'primary.dark',
    '&:hover': {
      borderColor: 'primary.dark',
      bgcolor: 'action.hover',
    },
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
    },
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
    },
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
    },
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
    color: 'text.primary',
    bgcolor: 'transparent',
    border: '1px solid',
    borderColor: 'transparent',
    '&:hover': {
      bgcolor: 'action.hover',
      borderColor: 'divider',
      color: 'text.primary',
    },
    '&.Mui-disabled': {
      bgcolor: 'transparent',
      borderColor: 'transparent',
      color: 'text.disabled',
    },
  },
} as const

// Styles for cards within dialogs (for things like template selection, widget management)
export const cardStyles = {
  // Basic card style
  base: {
    bgcolor: 'background.paper',
    borderRadius: 2,
    transition: 'all 0.2s ease-in-out',
    border: '1px solid',
    borderColor: 'divider',
    '&:hover': {
      borderColor: 'primary.main',
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 18px rgba(16, 42, 45, 0.12)',
    },
  },

  // Selected card style
  selected: {
    borderColor: 'primary.main',
    bgcolor: 'action.selected',
  },

  // Card content
  content: {
    p: 2,
  },

  // Card actions
  actions: {
    bgcolor: 'background.default',
    borderTop: '1px solid',
    borderColor: 'divider',
    p: 1.5,
  },

  // Feature card - for highlighted items
  feature: {
    bgcolor: 'background.paper',
    borderRadius: 2,
    transition: 'all 0.2s ease-in-out',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: '0 4px 12px rgba(16, 42, 45, 0.08)',
    '&:hover': {
      borderColor: 'primary.main',
      transform: 'translateY(-3px)',
      boxShadow: '0 10px 22px rgba(16, 42, 45, 0.14)',
    },
  },

  // Card with colored top border
  highlight: {
    bgcolor: 'background.paper',
    borderRadius: 2,
    transition: 'all 0.2s ease-in-out',
    border: '1px solid',
    borderColor: 'divider',
    borderTop: '4px solid',
    borderTopColor: 'primary.main',
    '&:hover': {
      borderColor: 'primary.main',
      borderTopColor: 'primary.main',
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 18px rgba(16, 42, 45, 0.12)',
    },
  },
}

// Standardized chip/tag styling
export const chipStyles = {
  base: {
    m: 0.5,
    color: '#191919',
    '& .MuiChip-label': {
      fontWeight: 700,
    },
  },
  small: {
    m: 0.25,
    height: 22,
    fontSize: '0.7rem',
    color: '#191919',
    '& .MuiChip-label': {
      px: 1,
      fontWeight: 700,
    },
  },
  filled: {
    m: 0.5,
    color: '#191919',
    fontWeight: 'bold',
    '& .MuiChip-label': {
      fontWeight: 500,
    },
  },
}

// Form field styles for dialogs
export const formFieldStyles = {
  input: {
    '& .MuiInputBase-input': {
      color: 'text.primary',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'divider',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'primary.main',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: 'primary.main',
    },
  },
  inputLabel: {
    color: 'text.secondary',
  },
  helperText: {
    color: 'text.secondary',
  },
  select: {
    '& .MuiSelect-icon': {
      color: 'text.primary',
    },
    '& .MuiSelect-icon.Mui-disabled': {
      color: 'text.disabled',
    },
  },
  checkbox: {
    color: 'text.secondary',
    '&.Mui-checked': {
      color: 'primary.main',
    },
  },
  switch: {
    '& .MuiSwitch-switchBase': {
      '&.Mui-checked': {
        color: 'white',
        '& + .MuiSwitch-track': {
          backgroundColor: 'primary.main',
        },
      },
    },
    '& .MuiSwitch-track': {
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
  },
}

// Standard color mapping for tags
export const TAG_COLOR_MAP: Record<
  string,
  'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
> = {
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
export const applyDialogStyles = (): { PaperProps: { sx: SxProps<Theme> } } => {
  return {
    PaperProps: {
      sx: {
        ...dialogStyles.paper,
        // Apply any type-specific customizations here
      },
    },
  }
}

// Suggested text styles for consistent typography
export const textStyles = {
  title: {
    fontWeight: 600,
    color: 'text.primary',
    mb: 1.5,
  },
  subtitle: {
    fontWeight: 500,
    color: 'text.primary',
    mb: 1,
  },
  body: {
    color: 'text.secondary',
    mb: 2,
  },
  caption: {
    color: 'text.secondary',
    fontSize: '0.75rem',
  },
}
