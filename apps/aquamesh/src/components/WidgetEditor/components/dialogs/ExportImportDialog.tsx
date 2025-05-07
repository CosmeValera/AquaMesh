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
  Tooltip
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
    setImportResult({
      success: true,
      message: 'Export data copied to clipboard'
    })
    
    // Clear the success message after 3 seconds
    setTimeout(() => {
      setImportResult(null)
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
        bgcolor: theme.palette.primary.main, 
        color: theme.palette.primary.contrastText,
        p: 3,
        display: 'flex',
        alignItems: 'center',
      }}>
        {tabValue === 0 ? (
          <CloudDownloadIcon sx={{ mr: 1.5 }} />
        ) : (
          <CloudUploadIcon sx={{ mr: 1.5 }} />
        )}
        <Typography variant="h5" fontWeight="bold">
          {tabValue === 0 ? 'Export Widgets' : 'Import Widgets'}
        </Typography>
      </DialogTitle>
      
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        variant="fullWidth"
        sx={{ 
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': {
            py: 1.5,
            fontSize: '0.9rem',
            fontWeight: 'medium',
            textTransform: 'none'
          },
          '& .Mui-selected': {
            fontWeight: 'bold'
          }
        }}
      >
        <Tab 
          label="Export" 
          icon={<DownloadIcon />} 
          iconPosition="start"
        />
        <Tab 
          label="Import" 
          icon={<UploadIcon />} 
          iconPosition="start"
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
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
              }}
            >
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                px: 2,
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider'
              }}>
                <Typography variant="subtitle2">
                  {widgets.length} widget{widgets.length !== 1 ? 's' : ''} available
                </Typography>
                <Box>
                  <Button 
                    size="small" 
                    onClick={selectAllWidgets}
                    sx={{ mr: 1, textTransform: 'none' }}
                  >
                    Select all
                  </Button>
                  <Button 
                    size="small" 
                    onClick={deselectAllWidgets}
                    sx={{ textTransform: 'none' }}
                  >
                    Clear
                  </Button>
                </Box>
              </Box>
              
              {widgets.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No widgets available to export
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
                        transition: 'background-color 0.2s',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.05)
                        }
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Checkbox
                          checked={selectedWidgets.includes(widget.id)}
                          onChange={() => toggleWidgetSelection(widget.id)}
                          edge="start"
                          color="primary"
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={widget.name}
                        secondary={
                          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                            <Typography variant="caption" component="span" sx={{ 
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              px: 1,
                              py: 0.25,
                              borderRadius: 1
                            }}>
                              {widget.components.length} components
                            </Typography>
                            {widget.category && (
                              <Typography variant="caption" component="span" sx={{ 
                                bgcolor: alpha(theme.palette.secondary.main, 0.1),
                                px: 1,
                                py: 0.25,
                                borderRadius: 1
                              }}>
                                {widget.category}
                              </Typography>
                            )}
                            <Typography variant="caption" component="span">
                              Last updated: {new Date(widget.updatedAt).toLocaleDateString()}
                            </Typography>
                          </Box>
                        }
                        primaryTypographyProps={{ 
                          fontWeight: selectedWidgets.includes(widget.id) ? 'bold' : 'normal' 
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
                  <Typography variant="subtitle1" fontWeight="medium">
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
                      bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.05) : alpha(theme.palette.primary.main, 0.02)
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
                  startIcon={<SaveIcon />}
                  sx={{ 
                    borderRadius: 2,
                    px: 3,
                    py: 1,
                    boxShadow: 2,
                    textTransform: 'none'
                  }}
                >
                  Generate Export
                </Button>
                {selectedWidgets.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Select at least one widget to export
                  </Typography>
                )}
              </Box>
            )}
            
            {importResult && (
              <Alert 
                severity={importResult.success ? "success" : "error"}
                sx={{ mb: 3, borderRadius: 2 }}
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
              borderColor: alpha(theme.palette.primary.main, 0.3),
              borderRadius: 2,
              p: 3,
              mb: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.02),
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: theme.palette.primary.main,
                bgcolor: alpha(theme.palette.primary.main, 0.05)
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
                  fontSize: 48, 
                  color: theme.palette.primary.main,
                  mb: 2,
                  opacity: 0.7
                }} 
              />
              <Typography variant="h6" gutterBottom>
                Click to upload
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Accepts .json files
              </Typography>
            </Box>
            
            <Divider sx={{ mb: 3 }}>
              <Typography variant="caption" color="text.secondary">
                OR PASTE JSON BELOW
              </Typography>
            </Divider>
            
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
                  fontSize: '0.8rem',
                  borderRadius: 2
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
                  boxShadow: 2,
                  '& .MuiAlert-message': {
                    fontWeight: 'medium'
                  }
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
                startIcon={<UploadIcon />}
                sx={{ 
                  borderRadius: 2,
                  px: 4,
                  py: 1,
                  boxShadow: 2,
                  textTransform: 'none',
                  fontWeight: 'medium'
                }}
              >
                Import Widgets
              </Button>
            </Box>
          </Box>
        </TabPanel>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.02)', borderTop: '1px solid', borderColor: 'divider' }}>
        <Button 
          onClick={onClose}
          variant="outlined"
          sx={{ borderRadius: 1.5 }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ExportImportDialog 