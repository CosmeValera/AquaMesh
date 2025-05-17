import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Box,
  Divider,
  useTheme,
  alpha
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

interface VersionWarningDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  version: string
}

const VersionWarningDialog: React.FC<VersionWarningDialogProps> = ({
  open,
  onConfirm,
  onCancel,
  version
}) => {
  const theme = useTheme()
  const isLightMode = theme.palette.mode === 'light'
  
  // Orange palette
  const orangeBase = '#f57c00'
  const orangeDark = '#e65100'

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiTypography-h6': { fontSize: { xs: '1rem', sm: '1.25rem' } },
        '& .MuiTypography-body1': { fontSize: { xs: '0.75rem', sm: '1rem' } },
        '& .MuiTypography-body2': { fontSize: { xs: '0.75rem', sm: '0.875rem' } },
      }}
      PaperProps={{
        elevation: 6,
        sx: { 
          borderRadius: 1.5,
          overflow: 'hidden'
        }
      }}
    >
      <Box sx={{
        bgcolor: orangeBase,
        p: 2,
        position: 'relative'
      }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <WarningAmberIcon sx={{ 
            fontSize: 28,
            color: '#ffffff'
          }} />
          <Typography variant="h6" sx={{ 
            fontWeight: 600,
            color: '#ffffff'
          }}>
            Version Restoration Warning
          </Typography>
        </Stack>
      </Box>
      
      <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
        <Stack spacing={2}>
          <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
            This action will discard all versions after the currently restored version.
          </Typography>
          <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
            You are about to update this widget while using an older version 
            <Box component="span" sx={{ 
              fontWeight: 'bold',
              mx: 0.5,
              px: 0.8,
              py: 0.3,
              bgcolor: orangeDark,
              color: '#ffffff',
              borderRadius: 0.8,
              border: `1px solid ${orangeBase}`
            }}>
              {version}
            </Box>
            All versions created after this one will be discarded permanently.
          </Typography>
          
          <Box sx={{ 
            p: 2,
            borderRadius: 1,
            bgcolor: isLightMode ? alpha(orangeBase, 0.08) : alpha(orangeBase, 0.15),
            border: `1px solid ${isLightMode ? alpha(orangeBase, 0.2) : alpha(orangeBase, 0.4)}`
          }}>
            <Typography variant="body2" sx={{ 
              display: 'flex',
              alignItems: 'flex-start',
              color: theme.palette.text.primary
            }}>
              <InfoOutlinedIcon 
                sx={{ 
                  fontSize: 18, 
                  mr: 1,
                  mt: 0.25,
                  color: orangeBase
                }}
              />
              If you want to keep these future versions, you should export them before proceeding with the update.
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      
      <Divider sx={{ mt: 2 }} />
      
      <DialogActions sx={{
        px: 3,
        py: 2,
        bgcolor: '#107349',
      }}>
        <Button 
          onClick={onCancel} 
          variant="outlined"
          sx={{ 
            borderRadius: 1,
            px: 2.5,
            py: 0.8,
            color: orangeDark,
            borderColor: orangeDark,
            '&:hover': {
              borderColor: orangeDark,
              bgcolor: alpha(orangeDark, 0.05)
            }
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          sx={{ 
            ml: 1.5, 
            borderRadius: 1,
            px: 2.5,
            py: 0.8,
            fontWeight: 500,
            bgcolor: orangeBase,
            color: '#ffffff',
            '&:hover': {
              bgcolor: orangeDark
            }
          }}
        >
          Update and Discard Future Versions
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default VersionWarningDialog 