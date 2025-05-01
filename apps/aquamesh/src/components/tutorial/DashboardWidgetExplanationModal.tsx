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
  Divider
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
  const dashboardImage = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2Y4ZjlmYSIvPgo8cmVjdCB4PSIyMCIgeT0iMjAiIHdpZHRoPSIzNjAiIGhlaWdodD0iMTYwIiBmaWxsPSIjZWVlIiBzdHJva2U9IiNkZGQiIHN0cm9rZS13aWR0aD0iMiIvPgo8cmVjdCB4PSIzMCIgeT0iMzAiIHdpZHRoPSIxNjAiIGhlaWdodD0iNzAiIGZpbGw9IiNiYmRlZmIiIHN0cm9rZT0iIzIxOTZmMyIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxyZWN0IHg9IjIxMCIgeT0iMzAiIHdpZHRoPSIxNjAiIGhlaWdodD0iNzAiIGZpbGw9IiNjOGU2YzkiIHN0cm9rZT0iIzRjYWY1MCIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxyZWN0IHg9IjMwIiB5PSIxMTAiIHdpZHRoPSIzNDAiIGhlaWdodD0iNjAiIGZpbGw9IiNmZmVjYjMiIHN0cm9rZT0iI2ZmOTgwMCIgc3Ryb2tlLXdpZHRoPSIyIi8+Cjx0ZXh0IHg9IjExMCIgeT0iNjUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzMzMyI+Q29udHJvbCBGbG93IFdpZGdldDwvdGV4dD4KPHRleHQgeD0iMjkwIiB5PSI2NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMzMzIj5TeXN0ZW0gTGVucyBXaWRnZXQ8L3RleHQ+Cjx0ZXh0IHg9IjIwMCIgeT0iMTQwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiMzMzMiPkN1c3RvbSBXaWRnZXQ8L3RleHQ+Cjx0ZXh0IHg9IjIwMCIgeT0iMTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzMzMyI+RGFzaGJvYXJkPC90ZXh0Pgo8L3N2Zz4=`
  
  const widgetImage = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2Y4ZjlmYSIvPgo8cmVjdCB4PSIyMCIgeT0iMjAiIHdpZHRoPSIxNjAiIGhlaWdodD0iMTYwIiBmaWxsPSIjZmZmIiBzdHJva2U9IiMyMTk2ZjMiIHN0cm9rZS13aWR0aD0iMiIgcng9IjQiLz4KPHJlY3QgeD0iMjAiIHk9IjIwIiB3aWR0aD0iMTYwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjYmJkZWZiIiBzdHJva2U9IiMyMTk2ZjMiIHN0cm9rZS13aWR0aD0iMCIgcng9IjQiIHJ5PSIwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzMzMyI+V2lkZ2V0IFRpdGxlPC90ZXh0Pgo8Y2lyY2xlIGN4PSIxMDAiIGN5PSIxMDAiIHI9IjUwIiBmaWxsPSIjZTNmMmZkIiBzdHJva2U9IiM2NGI1ZjYiIHN0cm9rZS13aWR0aD0iMiIvPgo8cmVjdCB4PSI3MCIgeT0iMTUwIiB3aWR0aD0iNjAiIGhlaWdodD0iMjAiIGZpbGw9IiM0Y2FmNTAiIHJ4PSI0Ii8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTY1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmYiPkFjdGlvbjwvdGV4dD4KPC9zdmc+`

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      aria-labelledby="explanation-dialog-title"
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          boxShadow: 24,
          borderRadius: 2,
          overflow: 'hidden'
        }
      }}
      fullScreen={isMobile}
    >
      <DialogTitle id="explanation-dialog-title" sx={{ bgcolor: 'primary.main', color: 'white', pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h5" component="div" fontWeight="bold">
            Understanding Dashboards & Widgets
          </Typography>
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box my={4}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
                <Box display="flex" alignItems="center" mb={2}>
                  <DashboardIcon color="primary" sx={{ fontSize: 32, mr: 2 }} />
                  <Typography variant="h5" fontWeight="bold" color="primary.main">
                    Dashboards
                  </Typography>
                </Box>
                <Typography variant="body1" paragraph>
                  Dashboards are container layouts that organize multiple widgets into a cohesive view. 
                  Think of them as the canvas where you arrange your widgets.
                </Typography>
                <Typography variant="body1" paragraph>
                  With AquaMesh, you can:
                </Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                  <Box component="li" sx={{ mb: 1 }}>
                    <Typography variant="body1">
                      <strong>Use predefined dashboards</strong> with preset layouts
                    </Typography>
                  </Box>
                  <Box component="li" sx={{ mb: 1 }}>
                    <Typography variant="body1">
                      <strong>Create custom dashboard layouts</strong> to fit your needs
                    </Typography>
                  </Box>
                  <Box component="li" sx={{ mb: 1 }}>
                    <Typography variant="body1">
                      <strong>Save your dashboard configurations</strong> for future use
                    </Typography>
                  </Box>
                </Box>
                <Box mt={3} display="flex" justifyContent="center">
                  <img 
                    src={dashboardImage} 
                    alt="Dashboard example"
                    style={{ maxWidth: '100%', border: '1px solid #eee', borderRadius: '4px' }}
                  />
                </Box>
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
                <Box display="flex" alignItems="center" mb={2}>
                  <WidgetsIcon color="primary" sx={{ fontSize: 32, mr: 2 }} />
                  <Typography variant="h5" fontWeight="bold" color="primary.main">
                    Widgets
                  </Typography>
                </Box>
                <Typography variant="body1" paragraph>
                  Widgets are individual components that display specific data, visualizations, or controls. 
                  Each widget serves a distinct purpose and can be added to dashboards.
                </Typography>
                <Typography variant="body1" paragraph>
                  AquaMesh offers:
                </Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                  <Box component="li" sx={{ mb: 1 }}>
                    <Typography variant="body1">
                      <strong>Predefined widgets</strong> like Control Flow and System Lens
                    </Typography>
                  </Box>
                  <Box component="li" sx={{ mb: 1 }}>
                    <Typography variant="body1">
                      <strong>Custom widget creation</strong> with the Widget Editor
                    </Typography>
                  </Box>
                  <Box component="li" sx={{ mb: 1 }}>
                    <Typography variant="body1">
                      <strong>Widget properties customization</strong> to tailor appearance and behavior
                    </Typography>
                  </Box>
                </Box>
                <Box mt={3} display="flex" justifyContent="center">
                  <img 
                    src={widgetImage} 
                    alt="Widget example"
                    style={{ maxWidth: '100%', border: '1px solid #eee', borderRadius: '4px' }}
                  />
                </Box>
              </Paper>
            </Grid>
          </Grid>

          <Box mt={4}>
            <Divider sx={{ mb: 3 }} />
            <Typography variant="h6" gutterBottom color="primary.main">
              How Dashboards and Widgets Work Together
            </Typography>
            <Typography variant="body1" paragraph>
              In AquaMesh, you first select or create a dashboard, which defines the layout structure. 
              Then, you populate this layout with widgets - either predefined ones or custom widgets you create.
              The dashboard manages how widgets are organized and displayed, while each widget handles its specific functionality.
            </Typography>
            <Typography variant="body1">
              This separation allows you to mix and match widgets in different layouts, creating tailored views for your specific needs.
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button 
          onClick={onClose} 
          color="primary"
          variant="contained"
        >
          Got it!
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DashboardWidgetExplanationModal 