import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Tabs,
  Tab,
  TextField,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  IconButton,
  useTheme,
  Divider,
  Paper,
  Tooltip,
  Snackbar
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import UploadIcon from '@mui/icons-material/Upload'
import SaveIcon from '@mui/icons-material/Save'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import ErrorIcon from '@mui/icons-material/Error'
import { alpha } from '@mui/material/styles'
import WidgetStorage, { CustomWidget } from '../../WidgetStorage'

interface ExportImportDialogProps {
  open: boolean
  onClose: () => void
  widgets: CustomWidget[]
  onImportComplete: () => void
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`export-import-tabpanel-${index}`}
      aria-labelledby={`export-import-tab-${index}`}
      {...other}
      style={{ padding: '16px 0' }}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  )
}

const ExportImportDialog: React.FC<ExportImportDialogProps> = ({
  open,
  onClose,
  widgets,
  onImportComplete
}) => {
  const theme = useTheme()
  const [tabValue, setTabValue] = useState(0)
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>([])
  const [exportData, setExportData] = useState('')
  const [importData, setImportData] = useState('')
  const [importResult, setImportResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Select all widgets for export
  const selectAllWidgets = () => {
    setSelectedWidgets(widgets.map(w => w.id))
  }

  // Deselect all widgets for export
  const deselectAllWidgets = () => {
    setSelectedWidgets([])
  }

  // Toggle selection of a widget for export
  const toggleWidgetSelection = (widgetId: string) => {
    if (selectedWidgets.includes(widgetId)) {
      setSelectedWidgets(selectedWidgets.filter(id => id !== widgetId))
    } else {
      setSelectedWidgets([...selectedWidgets, widgetId])
    }
  }

  // Generate export data from selected widgets
  const generateExport = () => {
    const widgetsToExport = widgets.filter(w => selectedWidgets.includes(w.id))
    const exportObj = {
      exportDate: new Date().toISOString(),
      exportVersion: '1.0',
      widgets: widgetsToExport
    }
    setExportData(JSON.stringify(exportObj, null, 2))
  }

  // Download export data as a file
  const downloadExport = () => {
    if (!exportData) {
      return
    }
    
    const blob = new Blob([exportData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aquamesh-widgets-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Copy export data to clipboard
  const copyExportToClipboard = () => {
    navigator.clipboard.writeText(exportData)
    
    setToastMessage('Export data copied to clipboard')
    setToastOpen(true)
    
    setTimeout(() => {
      setToastOpen(false)
    }, 3000)
  }

  // Trigger file input click
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Handle file selection for import
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setImportData(content)
      
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  // Process import data
  const processImport = () => {
    try {
      // Parse the import data
      const parsedData = JSON.parse(importData)
      
      // Validate format
      if (!parsedData.widgets || !Array.isArray(parsedData.widgets)) {
        setImportResult({
          success: false,
          message: 'Invalid import format. Missing or invalid widgets array.'
        })
        return
      }
      
      // Import each widget
      const importedWidgets = parsedData.widgets
      let importCount = 0
      
      importedWidgets.forEach((widget: CustomWidget) => {
        // Check if the widget name already exists
        const existingWidget = widgets.find(w => w.name === widget.name)
        const widgetName = existingWidget 
          ? `${widget.name} (Imported ${new Date().toLocaleTimeString()})`
          : widget.name
        
        // Preserve metadata but assign new IDs
        WidgetStorage.saveWidget({
          name: widgetName,
          components: widget.components,
          category: widget.category || 'Other',
          tags: widget.tags || [],
          description: widget.description || '',
          version: widget.version || '1.0',
          author: widget.author || 'Imported'
        })
        
        importCount++
      })
      
      // Show success message
      setImportResult({
        success: true,
        message: `Successfully imported ${importCount} widget(s)`
      })
      
      // Clear import data
      setImportData('')
      
      // Notify parent component that import is complete
      onImportComplete()
      
    } catch (error) {
      // Show error message
      setImportResult({
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
  }

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
    // Reset states when switching tabs
    setExportData('')
    setImportData('')
    setImportResult(null)
    setSelectedWidgets([])
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        elevation: 8,
        sx: {
          borderRadius: 2,
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ 
        background: `linear-gradient(45deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
        color: theme.palette.primary.contrastText,
        p: 3,
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 1px 8px rgba(0,0,0,0.15)',
        position: 'relative',
        zIndex: 1,
      }}>
        {tabValue === 0 ? (
          <CloudDownloadIcon sx={{ mr: 1.5, fontSize: 28, filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.2))' }} />
        ) : (
          <CloudUploadIcon sx={{ mr: 1.5, fontSize: 28, filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.2))' }} />
        )}
        <Typography variant="h5" fontWeight="bold" sx={{ textShadow: '0px 1px 2px rgba(0,0,0,0.1)' }}>
          {tabValue === 0 ? 'Export Widgets' : 'Import Widgets'}
        </Typography>
      </DialogTitle>
      
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        variant="fullWidth"
        sx={{ 
          bgcolor: alpha(theme.palette.primary.main, 0.12),
          borderBottom: 1,
          borderColor: theme.palette.divider,
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '1px',
            backgroundColor: theme.palette.divider,
          },
          '& .MuiTab-root': {
            py: 1.5,
            height: 56,
            fontSize: '0.95rem',
            fontWeight: 'medium',
            textTransform: 'none',
            transition: 'all 0.2s ease',
            color: theme.palette.text.secondary,
          },
          '& .Mui-selected': {
            fontWeight: 'bold',
            color: theme.palette.primary.main
          },
          '& .MuiTabs-indicator': {
            height: 3,
            borderRadius: '3px 3px 0 0',
            background: theme.palette.mode === 'dark'
              ? `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`
              : theme.palette.primary.main,
          }
        }}
      >
        <Tab 
          label="Export" 
          icon={<DownloadIcon sx={{ 
            filter: tabValue === 0 
              ? 'drop-shadow(0px 1px 2px rgba(0,0,0,0.2))' 
              : 'none',
            transition: 'all 0.2s ease',
          }} />} 
          iconPosition="start"
          sx={{ 
            minHeight: 56,
            gap: 1,
            '&.Mui-selected': {
              color: theme.palette.mode === 'dark' 
                ? theme.palette.primary.light 
                : theme.palette.primary.main,
            },
          }}
        />
        <Tab 
          label="Import" 
          icon={<UploadIcon sx={{ 
            filter: tabValue === 1 ? 'drop-shadow(0px 1px 2px rgba(0,0,0,0.2))' : 'none',
            transition: 'all 0.2s ease',
          }} />} 
          iconPosition="start"
          sx={{ 
            minHeight: 56, 
            gap: 1,
            '&.Mui-selected': { color: theme.palette.primary.main },
          }}
        />
      </Tabs>
      
      <DialogContent sx={{ p: 0 }}>
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
              Select widgets to export
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Export your widgets to share them or transfer between environments
            </Typography>
            
            <Paper 
              variant="outlined" 
              sx={{ 
                mb: 3, 
                borderRadius: 2,
                overflow: 'hidden',
                maxHeight: '300px', 
                overflowY: 'auto',
                bgcolor: theme.palette.mode === 'dark' 
                  ? alpha(theme.palette.background.paper, 0.7) 
                  : theme.palette.background.paper,
                borderColor: theme.palette.mode === 'dark' 
                  ? alpha(theme.palette.divider, 0.3) 
                  : theme.palette.divider,
                boxShadow: theme.palette.mode === 'dark'
                  ? '0 4px 12px rgba(0,0,0,0.15)'
                  : '0 2px 8px rgba(0,0,0,0.05)',
              }}
            >
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                px: 2,
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: theme.palette.divider,
                background: theme.palette.mode === 'dark' 
                  ? `linear-gradient(to right, ${alpha(theme.palette.primary.dark, 0.1)}, ${alpha(theme.palette.background.paper, 0.2)})` 
                  : `linear-gradient(to right, ${alpha(theme.palette.primary.light, 0.1)}, ${alpha(theme.palette.background.paper, 0.05)})`
              }}>
                <Typography variant="subtitle2" sx={{
                  fontWeight: 'bold',
                  color: theme.palette.mode === 'dark' 
                    ? theme.palette.common.white 
                    : theme.palette.text.primary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}>
                  <Box component="span" sx={{ 
                    display: 'inline-flex', 
                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                    color: theme.palette.primary.main,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                    mr: 0.5
                  }}>
                    {widgets.length}
                  </Box>
                  widget{widgets.length !== 1 ? 's' : ''} available
                </Typography>
                <Box>
                  <Button 
                    size="small" 
                    onClick={selectAllWidgets}
                    sx={{ 
                      mr: 1, 
                      textTransform: 'none',
                      color: theme.palette.primary.main,
                      fontWeight: 'bold',
                      borderRadius: 1,
                      px: 1.5,
                      py: 0.3,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                      }
                    }}
                  >
                    Select all
                  </Button>
                  <Button 
                    size="small" 
                    onClick={deselectAllWidgets}
                    sx={{ 
                      textTransform: 'none',
                      color: theme.palette.text.secondary,
                      fontWeight: 'bold',
                      borderRadius: 1,
                      px: 1.5,
                      py: 0.3,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.grey[500], 0.1),
                        color: theme.palette.text.primary,
                      }
                    }}
                  >
                    Clear
                  </Button>
                </Box>
              </Box>
              
              {widgets.length === 0 ? (
                <Box sx={{ 
                  p: 4, 
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.palette.text.secondary,
                  minHeight: 120,
                }}>
                  <Box sx={{ opacity: 0.5, mb: 1.5 }}>
                    <SaveIcon sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="body1" fontWeight="medium" gutterBottom color="text.secondary">
                    No widgets available to export
                  </Typography>
                  <Typography variant="body2" color={alpha(theme.palette.text.secondary, 0.7)}>
                    Create widgets first before exporting
                  </Typography>
                </Box>
              ) : (
                <List disablePadding>
                  {widgets.map((widget) => (
                    <ListItem 
                      key={widget.id} 
                      divider
                      dense
                      sx={{ 
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.08)
                        },
                        ...(selectedWidgets.includes(widget.id) && {
                          bgcolor: alpha(theme.palette.primary.main, 0.05),
                        }),
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Checkbox
                          checked={selectedWidgets.includes(widget.id)}
                          onChange={() => toggleWidgetSelection(widget.id)}
                          edge="start"
                          color="primary"
                          sx={{
                            '&.Mui-checked': {
                              color: theme.palette.mode === 'dark' 
                                ? theme.palette.primary.light 
                                : theme.palette.primary.main,
                              filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.1))',
                            },
                          }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={widget.name}
                        secondary={
                          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                            <Typography variant="caption" component="span" sx={{ 
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: theme.palette.primary.main,
                              px: 1,
                              py: 0.25,
                              borderRadius: 1,
                              fontWeight: 'medium',
                            }}>
                              {widget.components.length} components
                            </Typography>
                            {widget.category && (
                              <Typography variant="caption" component="span" sx={{ 
                                bgcolor: alpha(theme.palette.secondary.main, 0.1),
                                color: theme.palette.secondary.main,
                                px: 1,
                                py: 0.25,
                                borderRadius: 1,
                                fontWeight: 'medium',
                              }}>
                                {widget.category}
                              </Typography>
                            )}
                            <Typography 
                              variant="caption" 
                              component="span"
                              sx={{
                                color: alpha(theme.palette.text.secondary, 0.9)
                              }}
                            >
                              Last updated: {new Date(widget.updatedAt).toLocaleDateString()}
                            </Typography>
                          </Box>
                        }
                        primaryTypographyProps={{ 
                          fontWeight: selectedWidgets.includes(widget.id) ? 'bold' : 'medium',
                          color: selectedWidgets.includes(widget.id) 
                            ? theme.palette.primary.main 
                            : theme.palette.text.primary
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
            
            {exportData ? (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  mb: 1 
                }}>
                  <Typography variant="subtitle1" fontWeight="medium" sx={{
                    color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark
                  }}>
                    Export Data
                  </Typography>
                  <Box>
                    <Tooltip title="Copy to clipboard">
                      <IconButton 
                        onClick={copyExportToClipboard}
                        color="primary"
                        sx={{ mr: 0.5 }}
                      >
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Download as file">
                      <IconButton 
                        onClick={downloadExport}
                        color="primary"
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                <TextField
                  multiline
                  fullWidth
                  rows={12}
                  variant="outlined"
                  value={exportData}
                  InputProps={{
                    readOnly: true,
                    sx: { 
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                      bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.primary.main, 0.05)
                    }
                  }}
                />
              </Box>
            ) : (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                justifyContent: 'center', 
                pt: 2
              }}>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={selectedWidgets.length === 0}
                  onClick={generateExport}
                  startIcon={<SaveIcon sx={{ filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.2))' }} />}
                  sx={{ 
                    borderRadius: 2,
                    px: 3,
                    py: 1.2,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                    textTransform: 'none',
                    fontWeight: 'bold',
                    fontSize: '0.95rem',
                    background: theme.palette.mode === 'dark'
                      ? `linear-gradient(45deg, ${theme.palette.primary.dark} 30%, ${theme.palette.primary.main} 90%)`
                      : `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${alpha(theme.palette.primary.light, 0.9)} 90%)`,
                    letterSpacing: 0.5,
                    '&:hover': {
                      boxShadow: '0 6px 12px rgba(0,0,0,0.2)',
                      background: theme.palette.mode === 'dark'
                        ? `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.dark} 90%)`
                        : `linear-gradient(45deg, ${alpha(theme.palette.primary.light, 0.9)} 30%, ${theme.palette.primary.main} 90%)`,
                    },
                    '&.Mui-disabled': {
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                      color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.26)',
                      boxShadow: 'none',
                    }
                  }}
                >
                  Generate Export
                </Button>
                {selectedWidgets.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontStyle: 'italic' }}>
                    Select at least one widget to export
                  </Typography>
                )}
              </Box>
            )}
            
            {importResult && (
              <Alert 
                icon={importResult.success ? <CheckCircleIcon /> : <ErrorIcon />}
                severity={importResult.success ? "success" : "error"}
                variant="filled"
                sx={{ 
                  mb: 3, 
                  borderRadius: 2,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  '& .MuiAlert-message': {
                    fontWeight: 'bold',
                    fontSize: '0.95rem',
                  },
                  color: '#ffffff',
                  animation: 'fadeIn 0.3s ease-in-out',
                  '@keyframes fadeIn': {
                    '0%': {
                      opacity: 0,
                      transform: 'translateY(10px)',
                    },
                    '100%': {
                      opacity: 1,
                      transform: 'translateY(0)',
                    },
                  },
                }}
              >
                {importResult.message}
              </Alert>
            )}
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
              Import widgets from file or text
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Import widgets previously exported from another environment
            </Typography>
            
            <Box sx={{ 
              border: '2px dashed',
              borderColor: alpha(theme.palette.primary.main, 0.4),
              borderRadius: 2,
              p: 4,
              mb: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              height: 180,
              '&:hover': {
                borderColor: theme.palette.primary.main,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }
            }} onClick={handleUploadClick}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept=".json"
              />
              <CloudUploadIcon 
                sx={{ 
                  fontSize: 52, 
                  color: theme.palette.primary.main,
                  mb: 2,
                  opacity: 0.9,
                  filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.1))',
                }} 
              />
              <Typography variant="h6" gutterBottom fontWeight="bold" color={theme.palette.primary.main}
                sx={{ textShadow: '0px 1px 1px rgba(0,0,0,0.05)' }}
              >
                Click to upload
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.9 }}>
                Accepts .json files
              </Typography>
            </Box>
            
            <Box sx={{ my: 3, display: 'flex', alignItems: 'center', width: '100%' }}>
              <Divider sx={{ 
                flexGrow: 1,
                borderColor: `${alpha(theme.palette.divider, 0.8)}`
              }} />
              <Box
                sx={{
                  px: 2,
                }}
              >
                <Typography 
                  variant="caption" 
                  color="text.secondary" 
                  sx={{ 
                    py: 0.5, 
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.background.paper, 0.8),
                    fontWeight: 'medium',
                    letterSpacing: 0.5,
                    whiteSpace: 'nowrap'
                  }}
                >
                  OR PASTE JSON BELOW
                </Typography>
              </Box>
              <Divider sx={{ 
                flexGrow: 1,
                borderColor: `${alpha(theme.palette.divider, 0.8)}`
              }} />
            </Box>

            <TextField
              multiline
              fullWidth
              rows={10}
              variant="outlined"
              placeholder="Paste exported widget data here as JSON..."
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              InputProps={{
                sx: { 
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  borderRadius: 2,
                  borderColor: theme.palette.mode === 'dark' 
                    ? alpha(theme.palette.primary.main, 0.3) 
                    : theme.palette.divider,
                  bgcolor: theme.palette.mode === 'dark' 
                    ? alpha(theme.palette.common.black, 0.2) 
                    : alpha(theme.palette.background.paper, 0.8),
                  '&:hover': {
                    borderColor: alpha(theme.palette.primary.main, 0.5)
                  },
                  '&.Mui-focused': {
                    borderColor: theme.palette.primary.main,
                    boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.2)}`,
                  }
                }
              }}
              sx={{ mb: 3 }}
            />
            
            {importResult && (
              <Alert 
                icon={importResult.success ? <CheckCircleIcon /> : <ErrorIcon />}
                severity={importResult.success ? "success" : "error"}
                variant="filled"
                sx={{ 
                  mb: 3, 
                  borderRadius: 2,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  '& .MuiAlert-message': {
                    fontWeight: 'bold',
                    fontSize: '0.95rem',
                  },
                  color: '#ffffff',
                  animation: 'fadeIn 0.3s ease-in-out',
                  '@keyframes fadeIn': {
                    '0%': {
                      opacity: 0,
                      transform: 'translateY(10px)',
                    },
                    '100%': {
                      opacity: 1,
                      transform: 'translateY(0)',
                    },
                  },
                }}
              >
                {importResult.message}
              </Alert>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
              <Button
                variant="contained"
                color="primary"
                disabled={!importData.trim()}
                onClick={processImport}
                startIcon={<UploadIcon sx={{ filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.2))' }} />}
                sx={{ 
                  borderRadius: 2,
                  px: 4,
                  py: 1.2,
                  boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                  textTransform: 'none',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  background: theme.palette.mode === 'dark'
                    ? `linear-gradient(45deg, ${theme.palette.primary.dark} 30%, ${theme.palette.primary.main} 90%)`
                    : `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${alpha(theme.palette.primary.light, 0.9)} 90%)`,
                  letterSpacing: 0.5,
                  '&:hover': {
                    boxShadow: '0 6px 12px rgba(0,0,0,0.2)',
                    background: theme.palette.mode === 'dark'
                      ? `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.dark} 90%)`
                      : `linear-gradient(45deg, ${alpha(theme.palette.primary.light, 0.9)} 30%, ${theme.palette.primary.main} 90%)`,
                  },
                  '&.Mui-disabled': {
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                    color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.26)',
                    boxShadow: 'none',
                  }
                }}
              >
                Import Widgets
              </Button>
            </Box>
          </Box>
        </TabPanel>
      </DialogContent>
      
      <DialogActions sx={{ 
        px: 3,
        py: 2,
        bgcolor: alpha(theme.palette.divider, 0.08),
        borderTop: '1px solid', 
        borderColor: theme.palette.divider 
      }}>
        <Button 
          onClick={onClose}
          variant="outlined"
          sx={{ 
            borderRadius: 1.5,
            textTransform: 'none',
            fontWeight: 'medium',
            px: 3,
            py: 0.8,
            borderColor: alpha(theme.palette.primary.main, 0.5),
            color: theme.palette.primary.main,
            '&:hover': {
              borderColor: theme.palette.primary.main,
              bgcolor: alpha(theme.palette.primary.main, 0.12),
            }
          }}
        >
          Close
        </Button>
      </DialogActions>
      
      <Snackbar
        open={toastOpen}
        autoHideDuration={3000}
        onClose={() => setToastOpen(false)}
        message={toastMessage}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{
          '& .MuiSnackbarContent-root': {
            bgcolor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            fontWeight: 'bold',
            borderRadius: 2,
            boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
            px: 2.5,
            py: 1.5,
            fontSize: '0.95rem',
          }
        }}
      />
    </Dialog>
  )
}

export default ExportImportDialog 