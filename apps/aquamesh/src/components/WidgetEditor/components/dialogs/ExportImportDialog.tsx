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
  useTheme
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import UploadIcon from '@mui/icons-material/Upload'
import SaveIcon from '@mui/icons-material/Save'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
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
    if (!exportData) return
    
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
    if (!file) return
    
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
        sx: {
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary
        }
      }}
    >
      <DialogTitle>
        <Typography variant="h6">Export & Import Widgets</Typography>
      </DialogTitle>
      
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        centered
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Export" id="export-import-tab-0" />
        <Tab label="Import" id="export-import-tab-1" />
      </Tabs>
      
      <DialogContent>
        <TabPanel value={tabValue} index={0}>
          {/* Export Tab */}
          <Typography variant="subtitle1" gutterBottom>
            Select widgets to export
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <Button 
              variant="outlined" 
              size="small" 
              onClick={selectAllWidgets}
              sx={{ mr: 1 }}
            >
              Select All
            </Button>
            <Button 
              variant="outlined" 
              size="small" 
              onClick={deselectAllWidgets}
            >
              Deselect All
            </Button>
          </Box>
          
          <List sx={{ bgcolor: 'background.paper', mb: 2 }}>
            {widgets.length > 0 ? (
              widgets.map((widget) => (
                <ListItem key={widget.id} dense button onClick={() => toggleWidgetSelection(widget.id)}>
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={selectedWidgets.includes(widget.id)}
                      tabIndex={-1}
                      disableRipple
                    />
                  </ListItemIcon>
                  <ListItemText 
                    primary={widget.name} 
                    secondary={`${widget.components.length} components • Last updated: ${new Date(widget.updatedAt).toLocaleDateString()}`} 
                  />
                </ListItem>
              ))
            ) : (
              <ListItem>
                <ListItemText primary="No widgets available" />
              </ListItem>
            )}
          </List>
          
          <Box sx={{ mb: 2 }}>
            <Button
              variant="contained"
              onClick={generateExport}
              disabled={selectedWidgets.length === 0}
              startIcon={<SaveIcon />}
            >
              Generate Export
            </Button>
          </Box>
          
          {exportData && (
            <>
              <TextField
                label="Export Data"
                multiline
                rows={10}
                value={exportData}
                fullWidth
                variant="outlined"
                InputProps={{
                  readOnly: true,
                }}
                sx={{ mb: 2 }}
              />
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={downloadExport}
                  startIcon={<DownloadIcon />}
                >
                  Download JSON
                </Button>
                <IconButton
                  onClick={copyExportToClipboard}
                  title="Copy to clipboard"
                >
                  <ContentCopyIcon />
                </IconButton>
              </Box>
            </>
          )}
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          {/* Import Tab */}
          <Typography variant="subtitle1" gutterBottom>
            Import widgets from file or paste JSON
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <Button
              variant="contained"
              onClick={handleUploadClick}
              startIcon={<UploadIcon />}
              sx={{ mb: 2 }}
            >
              Upload JSON File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </Box>
          
          <TextField
            label="Paste JSON Data"
            multiline
            rows={10}
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            fullWidth
            variant="outlined"
            sx={{ mb: 2 }}
            placeholder='{"exportDate":"2023-05-15T12:00:00.000Z", "widgets":[...]}'
          />
          
          {importResult && (
            <Alert 
              severity={importResult.success ? 'success' : 'error'}
              sx={{ mb: 2 }}
            >
              {importResult.message}
            </Alert>
          )}
          
          <Button
            variant="contained"
            color="primary"
            onClick={processImport}
            disabled={!importData}
          >
            Import Widgets
          </Button>
        </TabPanel>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default ExportImportDialog 