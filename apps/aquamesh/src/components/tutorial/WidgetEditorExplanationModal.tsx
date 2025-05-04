import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  IconButton,
  Grid,
  Fade,
  Zoom,
  Tooltip,
  Tab,
  Tabs
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import PreviewIcon from '@mui/icons-material/Visibility'
import SaveIcon from '@mui/icons-material/Save'
import WidgetsIcon from '@mui/icons-material/Widgets'
import GridViewIcon from '@mui/icons-material/GridView'
import InputIcon from '@mui/icons-material/Input'
import SmartButtonIcon from '@mui/icons-material/SmartButton'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import ToggleOnIcon from '@mui/icons-material/ToggleOn'
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt'
import FlexibleIcon from '@mui/icons-material/Dashboard'
import PieChartIcon from '@mui/icons-material/PieChart'
import BuildIcon from '@mui/icons-material/Build'
import CategoryIcon from '@mui/icons-material/Category'
import VisibilityIcon from '@mui/icons-material/Visibility'

interface WidgetEditorExplanationModalProps {
  open: boolean
  onClose: () => void
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

// Add interfaces for the sections data structure
interface EditorSubsection {
  title: string;
  icon: React.ReactElement;
  content: string;
}

interface EditorSection {
  title: string;
  content?: string;
  subsections?: EditorSubsection[];
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`widget-editor-tabpanel-${index}`}
      aria-labelledby={`widget-editor-tab-${index}`}
      {...other}
      style={{ paddingTop: '20px' }}
    >
      {value === index && (
        <Fade in={true} timeout={500}>
          <Box>{children}</Box>
        </Fade>
      )}
    </div>
  )
}

const WidgetEditorExplanationModal: React.FC<WidgetEditorExplanationModalProps> = ({ open, onClose }) => {
  const [tabValue, setTabValue] = useState(0)
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }
  
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
  const sections: EditorSection[] = [
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
      title: 'Toolbar Controls',
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
      title: 'UI Components',
      subsections: [
        {
          title: 'Text Label',
          icon: <TextFieldsIcon />,
          content: 'A static text display element for showing information. Can be configured with different styles, sizes, and colors.'
        },
        {
          title: 'Text Field',
          icon: <InputIcon />,
          content: 'An input field for text entry. Supports single-line, multi-line, validation, and various styling options.'
        },
        {
          title: 'Button',
          icon: <SmartButtonIcon />,
          content: 'A clickable button element that triggers actions. Configurable properties include button text, variant, colors, and ability to show toast notifications when clicked.'
        },
        {
          title: 'Switch',
          icon: <ToggleOnIcon />,
          content: 'A toggle switch that allows users to choose between on/off states for boolean values. Can be configured with custom labels and default states.'
        },
        {
          title: 'Pie Chart',
          icon: <PieChartIcon />,
          content: 'A data visualization component that displays proportional data using a circular chart. Supports custom colors, labels, and data values.'
        }
      ]
    },
    {
      title: 'Layout Components',
      subsections: [
        {
          title: 'Fieldset',
          icon: <ViewQuiltIcon />,
          content: 'A collapsible container that can group related components. Users can toggle the visibility of its contents, making it useful for organizing complex widgets.'
        },
        {
          title: 'Grid Layout',
          icon: <GridViewIcon />,
          content: 'Arranges components in a table-like grid with rows and columns. Useful for creating structured, tabular layouts with precise alignment.'
        },
        {
          title: 'Flex Layout',
          icon: <FlexibleIcon />,
          content: 'A more dynamic layout system that allows components to grow, shrink, and reposition based on available space. Ideal for responsive designs that need to adapt to different screen sizes.'
        }
      ]
    }
  ]

  const tabContent = [
    // Overview tab
    <>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom fontWeight="bold" color="white">
          {sections[0].title}
        </Typography>
        <Typography variant="body1" paragraph color="white">
          {sections[0].content}
        </Typography>
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
      </Box>

      <Typography variant="h5" gutterBottom fontWeight="bold" color="white">
        Key Features
      </Typography>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} md={4}>
          <Paper 
            elevation={3} 
            sx={{ 
              p: 2, 
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
                <BuildIcon />
              </Box>
              <Typography variant="subtitle1" fontWeight="bold" color="white">
                Component Customization
              </Typography>
            </Box>
            <Typography variant="body2" color="rgba(255, 255, 255, 0.8)" sx={{ mt: 1 }}>
              Edit component properties like labels, styles, colors, and behaviors with the intuitive property editor.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper 
            elevation={3} 
            sx={{ 
              p: 2, 
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
                <CategoryIcon />
              </Box>
              <Typography variant="subtitle1" fontWeight="bold" color="white">
                Component Library
              </Typography>
            </Box>
            <Typography variant="body2" color="rgba(255, 255, 255, 0.8)" sx={{ mt: 1 }}>
              Choose from a growing library of UI and layout components to build any widget you need.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper 
            elevation={3} 
            sx={{ 
              p: 2, 
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
                <VisibilityIcon />
              </Box>
              <Typography variant="subtitle1" fontWeight="bold" color="white">
                Live Preview
              </Typography>
            </Box>
            <Typography variant="body2" color="rgba(255, 255, 255, 0.8)" sx={{ mt: 1 }}>
              See your widget come to life with the live preview mode as you build and customize it.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </>,
    
    // Interface tab
    <>
      <Typography variant="h5" gutterBottom fontWeight="bold" color="white">
        {sections[1].title}
      </Typography>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {sections[1]?.subsections?.map((subsection, i) => (
          <Grid item xs={12} md={4} key={i}>
            <Zoom in={true} style={{ transitionDelay: `${i * 100}ms` }}>
              <Paper 
                elevation={3} 
                sx={{ 
                  p: 2, 
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
            </Zoom>
          </Grid>
        ))}
      </Grid>
      
      <Typography variant="h5" gutterBottom fontWeight="bold" color="white" sx={{ mt: 4 }}>
        {sections[2].title}
      </Typography>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {sections[2]?.subsections?.map((subsection, i) => (
          <Grid item xs={12} md={4} key={i}>
            <Zoom in={true} style={{ transitionDelay: `${i * 100 + 300}ms` }}>
              <Paper 
                elevation={3} 
                sx={{ 
                  p: 2, 
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
            </Zoom>
          </Grid>
        ))}
      </Grid>
    </>,
    
    // Components tab
    <>
      <Typography variant="h5" gutterBottom fontWeight="bold" color="white">
        {sections[4].title}
      </Typography>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {sections[4]?.subsections?.map((subsection, i) => (
          <Grid item xs={12} md={4} key={i}>
            <Zoom in={true} style={{ transitionDelay: `${i * 80}ms` }}>
              <Paper 
                elevation={3} 
                sx={{ 
                  p: 2, 
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
                }}
              >
                <Box display="flex" alignItems="center" mb={1}>
                  <Tooltip title="Drag this component in the Widget Editor">
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
                        mr: 1.5,
                        cursor: 'grab'
                      }}
                    >
                      {subsection.icon}
                    </Box>
                  </Tooltip>
                  <Typography variant="subtitle1" fontWeight="bold" color="white">
                    {subsection.title}
                  </Typography>
                </Box>
                <Typography variant="body2" color="rgba(255, 255, 255, 0.8)" sx={{ mt: 1 }}>
                  {subsection.content}
                </Typography>
              </Paper>
            </Zoom>
          </Grid>
        ))}
      </Grid>
      
      <Typography variant="h5" gutterBottom fontWeight="bold" color="white" sx={{ mt: 4 }}>
        {sections[5].title}
      </Typography>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {sections[5]?.subsections?.map((subsection, i) => (
          <Grid item xs={12} md={4} key={i}>
            <Zoom in={true} style={{ transitionDelay: `${i * 80 + 400}ms` }}>
              <Paper 
                elevation={3} 
                sx={{ 
                  p: 2, 
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
                }}
              >
                <Box display="flex" alignItems="center" mb={1}>
                  <Tooltip title="Drag this component in the Widget Editor">
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
                        mr: 1.5,
                        cursor: 'grab'
                      }}
                    >
                      {subsection.icon}
                    </Box>
                  </Tooltip>
                  <Typography variant="subtitle1" fontWeight="bold" color="white">
                    {subsection.title}
                  </Typography>
                </Box>
                <Typography variant="body2" color="rgba(255, 255, 255, 0.8)" sx={{ mt: 1 }}>
                  {subsection.content}
                </Typography>
              </Paper>
            </Zoom>
          </Grid>
        ))}
      </Grid>
    </>
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      TransitionComponent={Fade}
      transitionDuration={500}
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: '#00A389', // Teal background for the entire dialog
          overflow: 'hidden',
          backgroundImage: 'linear-gradient(135deg, #00A389 0%, #00886F 100%)'
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
          p: 2,
          backgroundImage: 'linear-gradient(90deg, #00BC9A 0%, #00A389 100%)'
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

      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        aria-label="widget editor explanation tabs"
        centered
        sx={{
          bgcolor: 'rgba(0, 0, 0, 0.1)',
          '& .MuiTab-root': {
            color: 'rgba(255, 255, 255, 0.7)',
            fontWeight: 'bold',
            '&.Mui-selected': {
              color: 'white'
            }
          },
          '& .MuiTabs-indicator': {
            backgroundColor: 'white'
          }
        }}
      >
        <Tab label="Overview" id="widget-editor-tab-0" aria-controls="widget-editor-tabpanel-0" />
        <Tab label="Interface" id="widget-editor-tab-1" aria-controls="widget-editor-tabpanel-1" />
        <Tab label="Components" id="widget-editor-tab-2" aria-controls="widget-editor-tabpanel-2" />
      </Tabs>

      <DialogContent sx={{ p: 3 }}>
        <TabPanel value={tabValue} index={0}>
          {tabContent[0]}
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          {tabContent[1]}
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          {tabContent[2]}
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ p: 3, bgcolor: '#00A389', display: 'flex', flexDirection: 'column' }}>
        <Button 
          onClick={handleOpenWidgetEditor}
          variant="contained" 
          size="large"
          startIcon={<EditIcon />}
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
          Open Widget Editor
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default WidgetEditorExplanationModal 