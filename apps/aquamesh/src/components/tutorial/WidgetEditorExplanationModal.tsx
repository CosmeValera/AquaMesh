import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  Paper,
  IconButton,
  Grid,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import PreviewIcon from '@mui/icons-material/Visibility'
import SaveIcon from '@mui/icons-material/Save'
import WidgetsIcon from '@mui/icons-material/Widgets'
import GridViewIcon from '@mui/icons-material/GridView'
import TableRowsIcon from '@mui/icons-material/TableRows'
import FlexBoxIcon from '@mui/icons-material/ViewComfy'
import ImageIcon from '@mui/icons-material/Image'
import InputIcon from '@mui/icons-material/Input'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

interface WidgetEditorExplanationModalProps {
  open: boolean
  onClose: () => void
}

const WidgetEditorExplanationModal: React.FC<WidgetEditorExplanationModalProps> = ({ open, onClose }) => {
  // Handler for opening the widget editor
  const handleOpenWidgetEditor = () => {
    // Close this modal
    onClose()
    
    // Programmatically click the widget editor button
    const createWidgetButton = document.querySelector('[data-tutorial-id="create-widget-button"]')
    if (createWidgetButton) {
      (createWidgetButton as HTMLElement).click()
    }
  }
  
  // Section data
  const sections = [
    {
      title: 'Widget Editor Overview',
      content: 'The Widget Editor allows you to create custom widgets by combining various UI and layout components. A widget is essentially a collection of components arranged in a specific layout that provides a specific visualization or functionality.'
    },
    {
      title: 'Editor Interface',
      subsections: [
        {
          title: 'Toolbar',
          icon: <EditIcon />,
          content: 'Contains buttons for various editor functions such as saving, previewing, and accessing the widget library.'
        }, 
        {
          title: 'Components Panel',
          icon: <WidgetsIcon />,
          content: 'Located on the left side, this panel contains all available components grouped by category. You can drag and drop these components into your widget design.'
        },
        {
          title: 'Widget Canvas',
          icon: <GridViewIcon />,
          content: 'The central area where you arrange and configure components. Components can be rearranged, edited, or deleted here.'
        }
      ]
    },
    {
      title: 'Toolbar Main Controls',
      subsections: [
        {
          title: 'Edit/Preview Mode',
          icon: <PreviewIcon />,
          content: 'Toggle between editing your widget (making changes) and previewing how it will look when deployed.'
        },
        {
          title: 'Save/Update',
          icon: <SaveIcon />,
          content: 'Save your widget to the library. If you\'re editing an existing widget, this button will update it instead.'
        },
        {
          title: 'Browse Widgets',
          icon: <WidgetsIcon />,
          content: 'Open the widget library to view, edit, or delete your saved widgets.'
        }
      ]
    },
    {
      title: 'Component Types',
      subsections: [
        {
          title: 'UI Components',
          icon: <InputIcon />,
          content: 'Basic user interface elements such as buttons, text fields, sliders, checkboxes, and select menus.'
        },
        {
          title: 'Layout Components',
          icon: <GridViewIcon />,
          content: 'Components that help organize the structure of your widget, such as containers, grids, tabs, and fieldsets.'
        }
      ]
    },
    {
      title: 'Layout Components',
      subsections: [
        {
          title: 'Fieldset',
          icon: <ExpandMoreIcon />,
          content: 'A collapsible container that can group related components. Users can toggle the visibility of its contents, making it useful for organizing complex widgets.'
        },
        {
          title: 'Grid Layout',
          icon: <TableRowsIcon />,
          content: 'Arranges components in a table-like grid with rows and columns. Useful for creating structured, tabular layouts with precise alignment.'
        },
        {
          title: 'Flex Layout',
          icon: <FlexBoxIcon />,
          content: 'A more dynamic layout system that allows components to grow, shrink, and reposition based on available space. Ideal for responsive designs that need to adapt to different screen sizes.'
        }
      ]
    }
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: '#00A389', // Teal background for the entire dialog
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle
        sx={{
          bgcolor: '#00BC9A',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2
        }}
      >
        <Box display="flex" alignItems="center">
          <EditIcon sx={{ mr: 1.5, color: '#191919' }} />
          <Typography variant="h6" fontWeight="bold" color="#191919">
            Understanding the Widget Editor
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#191919' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 3 }}>
          {sections.map((section, index) => (
            <Box key={index} sx={{ mb: 4 }}>
              <Typography variant="h5" gutterBottom fontWeight="bold" color="white">
                {section.title}
              </Typography>
              
              {section.content && (
                <Typography variant="body1" paragraph color="white">
                  {section.content}
                </Typography>
              )}
              
              {/* Widget Editor image after the Overview section */}
              {index === 0 && (
                <Box sx={{ 
                  width: '100%', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  my: 3 
                }}>
                  <img 
                    src="/images/widget_editor.png" 
                    alt="Widget Editor Interface" 
                    style={{ 
                      maxWidth: '90%', 
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
                    }} 
                  />
                </Box>
              )}
              
              {section.subsections && (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  {section.subsections.map((subsection, subIdx) => (
                    <Grid item xs={12} md={subsection.title === 'Grid Layout' || subsection.title === 'Flex Layout' || subsection.title === 'Fieldset' ? 6 : 4} key={subIdx}>
                      <Paper 
                        elevation={1} 
                        sx={{ 
                          p: 2, 
                          height: '100%',
                          bgcolor: '#00886F', // Darker teal for cards
                          borderLeft: '4px solid',
                          borderColor: 'rgba(255, 255, 255, 0.5)',
                          borderRadius: 2,
                          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                            borderColor: 'white'
                          }
                        }}
                      >
                        <Box display="flex" alignItems="center" mb={1}>
                          <Box 
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              bgcolor: 'rgba(255, 255, 255, 0.15)',
                              color: 'white',
                              borderRadius: '50%',
                              width: 36,
                              height: 36,
                              mr: 1.5
                            }}
                          >
                            {subsection.icon}
                          </Box>
                          <Typography variant="subtitle1" fontWeight="bold" color="white">
                            {subsection.title}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="rgba(255, 255, 255, 0.8)" sx={{ mt: 1 }}>
                          {subsection.content}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
              
              {index < sections.length - 1 && (
                <Divider sx={{ mt: 4, borderColor: 'rgba(255, 255, 255, 0.2)' }} />
              )}
            </Box>
          ))}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, bgcolor: '#00A389', display: 'flex', flexDirection: 'column' }}>
        <Button 
          onClick={handleOpenWidgetEditor}
          variant="contained" 
          size="large"
          startIcon={<EditIcon />}
          sx={{ 
            mb: 2,
            bgcolor: '#00D1AB',
            color: '#191919',
            px: 3,
            py: 1,
            '&:hover': {
              bgcolor: '#00E4BC'
            }
          }}
        >
          Open Widget Editor
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default WidgetEditorExplanationModal 