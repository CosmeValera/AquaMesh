import React from 'react'
import { 
  DialogTitle, 
  Typography, 
  Box, 
  IconButton,
  useTheme
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

interface DialogHeaderProps {
  title: string
  icon?: React.ReactNode
  onClose?: () => void
  color?: string
  textColor?: string
}

/**
 * Consistent header component for dialogs throughout the application
 */
const DialogHeader: React.FC<DialogHeaderProps> = ({
  title,
  icon,
  onClose,
  color = '#00BC9A',
  textColor = '#191919'
}) => {
  const theme = useTheme()
  
  return (
    <DialogTitle
      sx={{
        bgcolor: color,
        color: 'white',
        pb: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundImage: `linear-gradient(90deg, ${color} 0%, ${theme.palette.mode === 'dark' 
          ? 'rgba(0, 0, 0, 0.2)' 
          : 'rgba(255, 255, 255, 0.1)'} 100%)`,
      }}
    >
      <Box display="flex" alignItems="center">
        {icon && (
          <Box sx={{ mr: 1.5, color: textColor }}>
            {icon}
          </Box>
        )}
        <Typography
          variant="h6"
          component="div"
          fontWeight="bold"
          color={textColor}
        >
          {title}
        </Typography>
      </Box>
      {onClose && (
        <IconButton
          aria-label="close"
          onClick={onClose}
          size="small"
          sx={{ 
            color: textColor,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      )}
    </DialogTitle>
  )
}

export default DialogHeader 