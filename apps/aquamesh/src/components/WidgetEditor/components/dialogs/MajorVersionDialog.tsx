import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  useTheme,
  alpha
} from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

interface MajorVersionDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  currentVersion: string
  nextMajorVersion: string
}

const MajorVersionDialog: React.FC<MajorVersionDialogProps> = ({
  open,
  onConfirm,
  onCancel,
  currentVersion,
  nextMajorVersion
}) => {
  const theme = useTheme()
  const primaryColor = theme.palette.primary.main
  const primaryLight = alpha(theme.palette.primary.main, 0.1)
  
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        elevation: 6,
        sx: { 
          borderRadius: 1.5,
          overflow: 'hidden'
        }
      }}
    >
      <Box sx={{
        bgcolor: primaryColor,
        p: 2,
        position: 'relative'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ArrowUpwardIcon sx={{ 
            fontSize: 28,
            color: '#ffffff'
          }} />
          <Typography variant="h6" sx={{ 
            fontWeight: 600,
            color: '#ffffff'
          }}>
            Major Version Update
          </Typography>
        </Box>
      </Box>
      
      <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body1">
            You are about to create a major version update for this widget.
          </Typography>
          
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 3, 
            my: 2,
            p: 3,
            bgcolor: primaryLight,
            borderRadius: 2
          }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" color="text.secondary">
                {currentVersion}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Current Version
              </Typography>
            </Box>
            
            <ArrowUpwardIcon sx={{ color: primaryColor, fontSize: 30 }} />
            
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" fontWeight="bold" color={primaryColor}>
                {nextMajorVersion}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                New Major Version
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ 
            p: 2,
            borderRadius: 1,
            bgcolor: theme.palette.mode === 'dark' ? alpha(primaryColor, 0.1) : alpha(primaryColor, 0.05),
            border: `1px solid ${alpha(primaryColor, 0.2)}`
          }}>
            <Typography variant="body2" sx={{ 
              display: 'flex',
              alignItems: 'flex-start'
            }}>
              <InfoOutlinedIcon 
                sx={{ 
                  fontSize: 18, 
                  mr: 1,
                  mt: 0.25,
                  color: primaryColor
                }}
              />
              Major version updates are typically used for significant changes to the widget&apos;s functionality or appearance.
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      
      <Divider sx={{ mt: 2 }} />
      
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button 
          onClick={onCancel} 
          variant="outlined"
          sx={{ 
            borderRadius: 1,
            px: 2.5,
            py: 0.8
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="primary"
          sx={{ 
            ml: 1.5, 
            borderRadius: 1,
            px: 2.5,
            py: 0.8,
            fontWeight: 500
          }}
        >
          Create Major Version
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default MajorVersionDialog 