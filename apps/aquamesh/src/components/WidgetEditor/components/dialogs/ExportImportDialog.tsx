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
  Divider,
  Paper,
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
import CloseIcon from '@mui/icons-material/Close'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import WidgetStorage, { CustomWidget } from '../../WidgetStorage'
import { dialogStyles, buttonStyles } from '../../../shared/DialogStyles'

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
        sx: dialogStyles.paper
      }}
    >
      <DialogTitle sx={dialogStyles.title}>
        <SwapHorizIcon sx={{ mr: 1.5, color: 'white' }} />
        <Typography variant="h6" sx={{ fontWeight: 500, color: 'white' }}>
          Export & Import Widgets
        </Typography>
      </DialogTitle>

      <DialogContent sx={{
        ...dialogStyles.content,
        p: 0, // Remove padding for tabs to extend to edges
      }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            borderBottom: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            bgcolor: 'rgba(0, 0, 0, 0.1)',
            minHeight: '48px',
            '& .MuiTab-root': {
              color: 'rgba(255, 255, 255, 0.7)',
              minHeight: '48px',
              fontWeight: 500,
              fontSize: '0.95rem',
              '&.Mui-selected': {
                color: 'white',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: 'white',
            },
          }}
        >
          <Tab 
            label="Export Widgets" 
            icon={<CloudDownloadIcon />} 
            iconPosition="start" 
          />
          <Tab 
            label="Import Widgets" 
            icon={<CloudUploadIcon />}
            iconPosition="start"
          />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ p: 3 }}>
            <Typography variant="body1" paragraph color="white">
              Export your widgets to share with others or back up your work.
              Select the widgets you want to export from the list below.
            </Typography>

            <Box sx={{ 
              mb: 3, 
              mt: 2, 
              display: 'flex', 
              gap: 1.5,
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Typography variant="subtitle1" fontWeight="500" color="white">
                {widgets.length > 0 
                  ? `Available Widgets (${widgets.length})` 
                  : 'No widgets available to export'}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  size="small" 
                  onClick={selectAllWidgets} 
                  disabled={widgets.length === 0}
                  sx={{
                    color: 'white',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    '&:hover': {
                      borderColor: 'white',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                  }}
                  variant="outlined"
                >
                  Select All
                </Button>
                <Button 
                  size="small" 
                  onClick={deselectAllWidgets} 
                  disabled={selectedWidgets.length === 0}
                  sx={{
                    color: 'white',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    '&:hover': {
                      borderColor: 'white',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                  }}
                  variant="outlined"
                >
                  Clear
                </Button>
              </Box>
            </Box>

            <Paper 
              elevation={0} 
              sx={{ 
                maxHeight: 240, 
                overflow: 'auto',
                mb: 3,
                bgcolor: 'rgba(0, 0, 0, 0.15)',
                borderRadius: 2,
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <List dense>
                {widgets.length === 0 ? (
                  <ListItem>
                    <ListItemText 
                      primary="No widgets found" 
                      primaryTypographyProps={{ 
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontStyle: 'italic',
                      }} 
                    />
                  </ListItem>
                ) : (
                  widgets.map((widget) => (
                    <ListItem 
                      key={widget.id}
                      button
                      onClick={() => toggleWidgetSelection(widget.id)}
                      sx={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.05)',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Checkbox 
                          edge="start"
                          checked={selectedWidgets.includes(widget.id)}
                          tabIndex={-1}
                          disableRipple
                          inputProps={{ 'aria-labelledby': `widget-${widget.id}` }}
                          sx={{ 
                            color: 'rgba(255, 255, 255, 0.5)',
                            '&.Mui-checked': {
                              color: 'white',
                            },
                          }}
                        />
                      </ListItemIcon>
                      <ListItemText 
                        id={`widget-${widget.id}`}
                        primary={widget.name} 
                        secondary={widget.description || 'No description available'}
                        primaryTypographyProps={{ 
                          color: 'white',
                          fontWeight: 500,
                        }}
                        secondaryTypographyProps={{ 
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '0.8rem',
                        }}
                      />
                    </ListItem>
                  ))
                )}
              </List>
            </Paper>

            <Button
              variant="contained"
              color="primary"
              disabled={selectedWidgets.length === 0}
              onClick={generateExport}
              startIcon={<SaveIcon />}
              sx={buttonStyles.primary}
            >
              Generate Export
            </Button>

            {exportData && (
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ 
                  mb: 3, 
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  '&::before, &::after': {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }
                }}>
                  <Typography 
                    variant="caption" 
                    component="span"
                    sx={{ 
                      color: 'rgba(255, 255, 255, 0.7)', 
                      fontWeight: 'medium',
                      px: 1,
                    }}
                  >
                    EXPORT DATA
                  </Typography>
                </Divider>

                <TextField
                  multiline
                  fullWidth
                  rows={8}
                  variant="outlined"
                  value={exportData}
                  InputProps={{
                    readOnly: true,
                    sx: { 
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      color: 'white',
                      borderRadius: 2,
                      bgcolor: 'rgba(0, 0, 0, 0.2)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                    }
                  }}
                  sx={{ mb: 2 }}
                />

                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Button
                    variant="contained"
                    onClick={downloadExport}
                    startIcon={<DownloadIcon />}
                    sx={buttonStyles.primary}
                  >
                    Download as File
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={copyExportToClipboard}
                    startIcon={<ContentCopyIcon />}
                    sx={buttonStyles.secondary}
                  >
                    Copy to Clipboard
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ p: 3 }}>
            <Typography variant="body1" paragraph color="white">
              Import widgets from a file or by pasting exported widget data.
            </Typography>
            
            <Box sx={{ 
              border: '2px dashed',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              borderRadius: 2,
              p: 4,
              mb: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              height: 180,
              '&:hover': {
                borderColor: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.08)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
                  color: 'white',
                  mb: 2,
                  opacity: 0.9,
                }} 
              />
              <Typography variant="h6" gutterBottom fontWeight="bold" color="white">
                Click to Upload File
              </Typography>
              <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
                Accepts .json files
              </Typography>
            </Box>
            
            <Box sx={{ my: 3, display: 'flex', alignItems: 'center', width: '100%' }}>
              <Divider sx={{ 
                flexGrow: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }} />
              <Typography 
                variant="caption" 
                sx={{ 
                  px: 2, 
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontWeight: 'medium',
                }}
              >
                OR PASTE JSON BELOW
              </Typography>
              <Divider sx={{ 
                flexGrow: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
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
                  color: 'white',
                  bgcolor: 'rgba(0, 0, 0, 0.2)',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'white',
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
                  boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                }}
              >
                {importResult.message}
              </Alert>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
              <Button
                variant="contained"
                disabled={!importData.trim()}
                onClick={processImport}
                startIcon={<UploadIcon />}
                sx={buttonStyles.primary}
              >
                Import Widgets
              </Button>
            </Box>
          </Box>
        </TabPanel>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#00A389', display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          onClick={onClose} 
          variant="contained"
          sx={{ 
            bgcolor: '#00D1AB',
            color: '#191919',
            '&:hover': {
              bgcolor: '#00E4BC',
            }
          }}
        >
          Close
        </Button>
      </DialogActions>

      {/* Toast notification */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={3000}
        onClose={() => setToastOpen(false)}
        message={toastMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ 
          '& .MuiSnackbarContent-root': {
            bgcolor: '#00BC9A',
            color: 'black',
            fontWeight: 'medium',
            borderRadius: 2,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }
        }}
      />
    </Dialog>
  )
}

export default ExportImportDialog 