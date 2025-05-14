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
  alpha,
  lighten,
  darken
} from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { Paper } from '@mui/material'

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
  const primaryDark = theme.palette.primary.dark
  const secondaryColor = theme.palette.secondary.main
  const secondaryDark = theme.palette.secondary.dark
  
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        elevation: 12,
        sx: { 
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
        }
      }}
    >
      <Box sx={{
        background: `linear-gradient(135deg, ${primaryDark} 0%, ${primaryColor} 100%)`,
        p: '12px 24px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ArrowUpwardIcon sx={{ fontSize: 26, color: '#ffffff' }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ffffff' }}>
            Major Version Update
          </Typography>
        </Box>
      </Box>
      
      <DialogContent sx={{ px: 3, pt: 3, pb: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Typography variant="body1" color="text.primary">
            You are about to create a new major version for this widget.
          </Typography>
          
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 3.5, 
            my: 2.5,
            p: 3,
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            borderRadius: 2.5,
            border: `1px dashed ${alpha(theme.palette.primary.main, 0.3)}`
          }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="medium" color="text.secondary" sx={{ opacity: 0.8 }}>
                {currentVersion}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Current Version
              </Typography>
            </Box>
            
            <ArrowUpwardIcon sx={{ color: primaryColor, fontSize: 36, opacity: 0.7 }} />
            
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color={primaryColor}>
                {nextMajorVersion}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                New Major Version
              </Typography>
            </Box>
          </Box>
          
          <Paper elevation={0} sx={{ 
            p: '12px 16px',
            borderRadius: 2,
            bgcolor: alpha(theme.palette.info.main, 0.08),
            border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1
          }}>
            <InfoOutlinedIcon sx={{ fontSize: 20, mt: 0.25, color: theme.palette.info.main }} />
            <Typography variant="body2" color="text.secondary">
              Major versions usually involve significant changes. These releases often break backward compatibility.
            </Typography>
          </Paper>
        </Box>
      </DialogContent>
            
      <DialogActions sx={{ px: 3, py: 2, bgcolor: alpha(theme.palette.background.paper, 0.9), borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button 
          onClick={onCancel} 
          variant="outlined"
          sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 'medium', px: 3, py: 0.8, borderColor: alpha(theme.palette.primary.main,0.7), color: theme.palette.primary.main, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08), borderColor: theme.palette.primary.main }}}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          startIcon={<ArrowUpwardIcon />}
          sx={{
            ml: 1.5, borderRadius: 1.5, textTransform: 'none', fontWeight: 'bold', px: 2.5, py: 1,
            background: `linear-gradient(45deg, ${secondaryColor} 30%, ${darken(secondaryColor, 0.2)} 90%)`,
            boxShadow: `0 4px 15px ${alpha(secondaryColor, 0.25)}`,
            '&:hover': {
              background: `linear-gradient(45deg, ${darken(secondaryColor, 0.1)} 30%, ${darken(secondaryColor, 0.3)} 90%)`,
              boxShadow: `0 6px 20px ${alpha(secondaryColor, 0.35)}`
            }
          }}
        >
          Create Major Version
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default MajorVersionDialog 