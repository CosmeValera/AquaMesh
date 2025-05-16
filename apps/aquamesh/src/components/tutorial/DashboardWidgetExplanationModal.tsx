import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Paper,
  IconButton,
  useTheme,
  useMediaQuery,
  Fade
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DashboardIcon from '@mui/icons-material/Dashboard'
import WidgetsIcon from '@mui/icons-material/Widgets'

interface DashboardWidgetExplanationModalProps {
  open: boolean
  onClose: () => void
}

const DashboardWidgetExplanationModal: React.FC<DashboardWidgetExplanationModalProps> = ({ open, onClose }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // Example Dashboard and Widget images
  const dashboardImage = `/images/understanding_dashboards.png`
  const widgetImage = `/images/understanding_widgets.png`

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      aria-labelledby="explanation-dialog-title"
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: '#00A389',
          overflow: 'hidden',
          backgroundImage: 'linear-gradient(135deg, #00A389 0%, #00886F 100%)'
        }
      }}
      TransitionComponent={Fade}
      transitionDuration={500}
    >
      <DialogTitle id="explanation-dialog-title" sx={{ 
        bgcolor: '#00BC9A', 
        color: 'white', 
        pb: 1,
        backgroundImage: 'linear-gradient(90deg, #00BC9A 0%, #00A389 100%)'
      }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="div" fontWeight="bold" color="#eee">
            Understanding Dashboards & Widgets
          </Typography>
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{ color: '#eee' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        <Box my={4}>
          <Grid container spacing={4}>
            <Fade in={open} style={{ transitionDelay: '100ms' }}>
              <Grid item xs={12} md={6}>
                <Paper elevation={3} sx={{ 
                  p: 3, 
                  height: '100%',
                  bgcolor: '#00886F',
                  borderLeft: '4px solid',
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  borderRadius: 2,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                    borderColor: 'white'
                  }
                }}>
                  <Box display="flex" alignItems="center" mb={2}>
                    <DashboardIcon color="primary" sx={{ fontSize: 32, mr: 2 }} />
                    <Typography variant="h5" fontWeight="bold" color="#f9f9f9">
                      Dashboards
                    </Typography>
                  </Box>
                  <Typography variant="body1" paragraph color="#f9f9f9">
                    Dashboards are container layouts that organize multiple widgets into a cohesive view. 
                    Think of them as the canvas where you arrange your widgets.
                  </Typography>
                  <Box mt={3} display="flex" justifyContent="center">
                    <img 
                      src={dashboardImage} 
                      alt="Dashboard example"
                      style={{ maxWidth: '100%', border: '1px solid #eee', borderRadius: '4px' }}
                    />
                  </Box>
                  <Typography variant="body1" paragraph sx={{marginTop: '1rem'}} color="#f9f9f9">
                    In regards to dashboards you can:
                  </Typography>
                  <Box component="ul" sx={{ pl: 2 }} >
                    <Box component="li" sx={{ mb: 1 }} color="#f9f9f9">
                      <Typography variant="body1">
                        <strong>Use predefined dashboards</strong> with preset layouts
                      </Typography>
                    </Box>
                    <Box component="li" sx={{ mb: 1 }} color="#f9f9f9">
                      <Typography variant="body1">
                        <strong>Create custom dashboard layouts</strong> to fit your needs
                      </Typography>
                    </Box>
                    <Box component="li" sx={{ mb: 1 }} color="#f9f9f9">
                      <Typography variant="body1">
                        <strong>Save your dashboard configurations</strong> for future use
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            </Fade>
            
            <Fade in={open} style={{ transitionDelay: '300ms' }}>
              <Grid item xs={12} md={6}>
                <Paper elevation={3} sx={{ 
                  p: 3, 
                  height: '100%',
                  bgcolor: '#00886F',
                  borderLeft: '4px solid',
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  borderRadius: 2,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                    borderColor: 'white'
                  }
                }}>
                  <Box display="flex" alignItems="center" mb={2}>
                    <WidgetsIcon color="primary" sx={{ fontSize: 32, mr: 2 }} />
                    <Typography variant="h5" fontWeight="bold" color="#f9f9f9">
                      Widgets
                    </Typography>
                  </Box>
                  <Typography variant="body1" paragraph color="#f9f9f9">
                    Widgets are individual components that display specific data, visualizations, or controls. 
                    Each widget serves a distinct purpose and can be added to dashboards.
                  </Typography>
                  <Box mt={3} display="flex" justifyContent="center">
                    <img 
                      src={widgetImage} 
                      alt="Widget example"
                      style={{ maxWidth: '100%', border: '1px solid #eee', borderRadius: '4px' }}
                    />
                  </Box>
                  <Typography variant="body1" paragraph sx={{marginTop: '1rem'}} color="#f9f9f9">
                  In regards to widgets you have:
                  </Typography>
                  <Box component="ul" sx={{ pl: 2 }}>
                    <Box component="li" sx={{ mb: 1 }} color="#f9f9f9">
                      <Typography variant="body1">
                        <strong>Predefined widgets</strong> like Control Flow and System Lens
                      </Typography>
                    </Box>
                    <Box component="li" sx={{ mb: 1 }} color="#f9f9f9">
                      <Typography variant="body1">
                        <strong>Custom widget creation</strong> with the Widget Editor
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            </Fade>
          </Grid>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 3, bgcolor: '#00A389' }}>
        <Button 
          onClick={onClose} 
          color="primary"
          variant="contained"
          sx={{ 
            bgcolor: '#00D1AB',
            color: '#191919',
            px: 3,
            py: 1,
            '&:hover': {
              bgcolor: '#00E4BC',
              transform: 'translateY(-3px)',
              boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)'
            },
            transition: 'all 0.2s ease',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
        >
          Got it!
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DashboardWidgetExplanationModal 