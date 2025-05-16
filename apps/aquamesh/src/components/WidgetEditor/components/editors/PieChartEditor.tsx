import React, { useState, useEffect, useRef } from 'react'
import {
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
  useTheme
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ColorLensIcon from '@mui/icons-material/ColorLens'
// Use crypto.randomUUID instead of uuid library
import ChartPreview from '../preview/ChartPreview'

// Define some default colors for new segments
const DEFAULT_COLORS = [
  '#FF6384', // red
  '#36A2EB', // blue
  '#FFCE56', // yellow
  '#4BC0C0', // teal
  '#9966FF', // purple
  '#FF9F40', // orange
  '#C7C7C7', // gray
  '#5366FF', // indigo
  '#B266FF', // violet
  '#FF6682', // pink
]

// Helper function to generate unique IDs
const generateId = () => {
  // Use a simple timestamp-based ID since we don't have uuid
  return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

interface PieChartEditorProps {
  initialData?: string
  onChange: (jsonData: string) => void
  title?: string
  description?: string
  onTitleChange: (title: string) => void
  onDescriptionChange: (description: string) => void
}

interface PieSegment {
  id: string
  label: string
  value: number
  color: string
}

interface BufferedSegment extends PieSegment {
  // Track if this segment has pending changes
  isDirty?: boolean
}

// Color picker modal component
interface ColorPickerProps {
  open: boolean
  currentColor: string
  onClose: () => void
  onSave: (color: string) => void
  isMobile?: boolean
}

const ColorPickerModal: React.FC<ColorPickerProps> = ({ open, currentColor, onClose, onSave, isMobile }) => {
  const [selectedColor, setSelectedColor] = useState(currentColor)

  // Reset selected color when modal opens with a new color
  useEffect(() => {
    setSelectedColor(currentColor)
  }, [currentColor, open])

  const handleSave = () => {
    onSave(selectedColor)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: isMobile ? '1rem' : undefined, py: isMobile ? 1 : 2 }}>Choose Color</DialogTitle>
      <DialogContent sx={{ py: isMobile ? 1 : 2 }}>
        <Box sx={{ textAlign: 'center', p: isMobile ? 1 : 2 }}>
          <input
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            style={{ 
              width: isMobile ? '80px' : '100px', 
              height: isMobile ? '80px' : '100px', 
              padding: 0, 
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          />
        </Box>
        
        {/* Predefined colors palette */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 0.5 : 1, justifyContent: 'center', mt: isMobile ? 1 : 2 }}>
          {DEFAULT_COLORS.map((color, index) => (
            <Tooltip title={`Color ${index + 1}`} key={index}>
              <Box 
                sx={{ 
                  width: isMobile ? 24 : 30, 
                  height: isMobile ? 24 : 30, 
                  bgcolor: color, 
                  borderRadius: '4px',
                  cursor: 'pointer',
                  border: selectedColor === color ? '2px solid #000' : '1px solid rgba(0,0,0,0.2)',
                }}
                onClick={() => setSelectedColor(color)}
              />
            </Tooltip>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: isMobile ? 1 : 2 }}>
        <Button onClick={onClose} size={isMobile ? "small" : "medium"}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary" size={isMobile ? "small" : "medium"}>
          Apply Color
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const PieChartEditor: React.FC<PieChartEditorProps> = ({
  initialData = '{}',
  onChange,
  title = '',
  description = '',
  onTitleChange,
  onDescriptionChange,
}) => {
  // Theme and responsive design
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  
  // State for pie chart segments
  const [segments, setSegments] = useState<PieSegment[]>([])
  // Buffered segments to prevent losing focus
  const [bufferedSegments, setBufferedSegments] = useState<BufferedSegment[]>([])
  // Track whether initial data has been processed
  const initializedRef = useRef(false)
  // Track if we need to update the parent
  const [needsUpdate, setNeedsUpdate] = useState(false)
  // Active input ref to maintain focus
  const activeInputRef = useRef<{ id: string, field: string } | null>(null)
  
  // Color picker state
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [currentColor, setCurrentColor] = useState('')
  
  // Parse initial data on component mount
  useEffect(() => {
    // Only process initial data if we haven't initialized yet or if initialData changed
    if (!initializedRef.current || initialData !== '{}') {
      try {
        const data = JSON.parse(initialData)
        if (data.labels && data.datasets && data.datasets[0]?.data) {
          const parsedSegments = data.labels.map((label: string, index: number) => {
            // Get color from backgroundColor if available, or use default
            let color = DEFAULT_COLORS[index % DEFAULT_COLORS.length]
            if (data.datasets[0].backgroundColor) {
              if (Array.isArray(data.datasets[0].backgroundColor) && data.datasets[0].backgroundColor[index]) {
                color = data.datasets[0].backgroundColor[index]
              } else if (typeof data.datasets[0].backgroundColor === 'string') {
                color = data.datasets[0].backgroundColor
              }
            }
            
            return {
              id: generateId(),
              label: label,
              value: data.datasets[0].data[index] || 0,
              color: color.startsWith('rgba') ? rgbaToHex(color) : color,
            }
          })
          
          setSegments(parsedSegments)
          setBufferedSegments(parsedSegments)
        } else if (!initializedRef.current) {
          // Add two default segments only if this is the first initialization
          const defaultSegments = [
            { id: generateId(), label: 'Segment 1', value: 60, color: DEFAULT_COLORS[0] },
            { id: generateId(), label: 'Segment 2', value: 40, color: DEFAULT_COLORS[1] },
          ]
          setSegments(defaultSegments)
          setBufferedSegments(defaultSegments)
        }
        
        initializedRef.current = true
      } catch {
        // If parsing fails, initialize with default segments only if we haven't initialized yet
        if (!initializedRef.current) {
          const defaultSegments = [
            { id: generateId(), label: 'Segment 1', value: 60, color: DEFAULT_COLORS[0] },
            { id: generateId(), label: 'Segment 2', value: 40, color: DEFAULT_COLORS[1] },
          ]
          setSegments(defaultSegments)
          setBufferedSegments(defaultSegments)
          initializedRef.current = true
        }
      }
    }
  }, [initialData])
  
  // Update parent component when segments change - but only when explicitly triggered
  useEffect(() => {
    if (segments.length === 0 || !initializedRef.current || !needsUpdate) {
      return
    }

    const chartData = {
      labels: segments.map(segment => segment.label),
      datasets: [{
        data: segments.map(segment => segment.value),
        backgroundColor: segments.map(segment => hexToRgba(segment.color, 0.8))
      }]
    }
    
    onChange(JSON.stringify(chartData))
    setNeedsUpdate(false)
  }, [segments, onChange, needsUpdate])
  
  // Restore focus after render
  useEffect(() => {
    if (activeInputRef.current) {
      const { id, field } = activeInputRef.current
      const element = document.getElementById(`segment-${id}-${field}`)
      if (element) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          element.focus()
        }, 0)
      }
    }
  }, [bufferedSegments])

  // Add a new segment
  const addSegment = () => {
    const newColor = DEFAULT_COLORS[segments.length % DEFAULT_COLORS.length]
    const newSegment = { 
      id: generateId(), 
      label: `Segment ${segments.length + 1}`, 
      value: 10, 
      color: newColor 
    }
    
    const updatedSegments = [...segments, newSegment]
    setSegments(updatedSegments)
    setBufferedSegments([...updatedSegments])
    setNeedsUpdate(true)
  }
  
  // Delete a segment
  const deleteSegment = (id: string) => {
    if (segments.length <= 1) {
      // Don't allow deleting the last segment
      return
    }
    
    const updatedSegments = segments.filter(segment => segment.id !== id)
    setSegments(updatedSegments)
    setBufferedSegments([...updatedSegments])
    setNeedsUpdate(true)
  }
  
  // Update a segment property in the buffer (without updating the chart yet)
  const updateBufferedSegment = (id: string, field: keyof PieSegment, value: string | number) => {
    // Record which input is currently active
    activeInputRef.current = { id, field: field as string }
    
    setBufferedSegments(prev => 
      prev.map(segment => 
        segment.id === id ? { ...segment, [field]: value, isDirty: true } : segment
      )
    )
  }
  
  // Apply changes from buffered segments to the actual segments
  const applyBufferedChanges = (id: string) => {
    // Find the segment that was edited
    const editedSegment = bufferedSegments.find(s => s.id === id && s.isDirty)
    if (editedSegment) {
      // Clear the active input since we're applying changes
      activeInputRef.current = null
      
      // Update segments and mark as needing update
      setSegments(prev => 
        prev.map(segment => 
          segment.id === id ? { ...editedSegment, isDirty: false } : segment
        )
      )
      
      // Clear dirty flag in buffered segments
      setBufferedSegments(prev => 
        prev.map(segment => 
          segment.id === id ? { ...segment, isDirty: false } : segment
        )
      )
      
      setNeedsUpdate(true)
    }
  }
  
  // Open color picker for a segment
  const openColorPicker = (id: string, color: string) => {
    setSelectedSegmentId(id)
    setCurrentColor(color)
    setColorPickerOpen(true)
  }
  
  // Apply selected color to the segment
  const applyColor = (color: string) => {
    if (selectedSegmentId) {
      // Update both buffered and actual segments
      setBufferedSegments(prev => 
        prev.map(segment => 
          segment.id === selectedSegmentId ? { ...segment, color, isDirty: false } : segment
        )
      )
      
      setSegments(prev => 
        prev.map(segment => 
          segment.id === selectedSegmentId ? { ...segment, color } : segment
        )
      )
      
      setNeedsUpdate(true)
    }
  }
  
  // Format data for preview
  const previewData = {
    labels: segments.map(segment => segment.label),
    datasets: [{
      label: 'Pie Chart',
      data: segments.map(segment => segment.value),
      backgroundColor: segments.map(segment => hexToRgba(segment.color, 0.8))
    }]
  }
  
  // Helper function to convert hex to rgba
  function hexToRgba(hex: string, alpha: number = 1) {
    // Remove the hash if it exists
    hex = hex.replace('#', '')
    
    // Parse the hex values
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    
    // Return as rgba
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  
  // Helper function to convert rgba to hex
  function rgbaToHex(rgba: string) {
    const matches = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/)
    if (!matches) {
      return '#FF6384'
    }
    
    const r = parseInt(matches[1], 10).toString(16).padStart(2, '0')
    const g = parseInt(matches[2], 10).toString(16).padStart(2, '0')
    const b = parseInt(matches[3], 10).toString(16).padStart(2, '0')
    
    return `#${r}${g}${b}`
  }

  return (
    <Box sx={{ 
      width: '100%', 
      p: isMobile ? 1 : 2, 
      display: 'flex', 
      gap: isMobile ? 1 : 2, 
      flexDirection: isMobile ? 'column' : 'row'
    }}>
      {/* Left Pane: Chart Details and Preview */}
      <Box sx={{ 
        flex: isMobile ? '1 1 auto' : '0 0 35%', 
        maxWidth: isMobile ? '100%' : '35%'
      }}>
        {/* Chart Details */}
        <Box sx={{ mb: isMobile ? 0.5 : 1 }}>
          <TextField
            label="Chart Title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            fullWidth
            size="small"
            variant="standard"
            sx={{ mb: isMobile ? 0.5 : 1 }}
            InputLabelProps={{
              style: { fontSize: isMobile ? '0.875rem' : undefined }
            }}
          />
          <TextField
            label="Chart Description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            fullWidth
            size="small"
            variant="standard"
            InputLabelProps={{
              style: { fontSize: isMobile ? '0.875rem' : undefined }
            }}
          />
        </Box>
        {/* Preview */}
        <Typography variant="subtitle2" sx={{ 
          mb: isMobile ? 0.5 : 1,
          fontSize: isMobile ? '0.75rem' : undefined
        }}>
          Preview
        </Typography>
        <Box sx={{ 
          border: '1px solid rgba(0,0,0,0.1)', 
          borderRadius: 1, 
          p: isMobile ? 0.5 : 1, 
          bgcolor: 'rgba(0,0,0,0.02)' 
        }}>
          <ChartPreview chartType="pie" title={title} description={description} data={previewData} />
        </Box>
      </Box>
      {/* Right Pane: Segment Editor */}
      <Box sx={{ flex: '1 1 65%' }}>
        {/* Pie Chart Segments */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: isMobile ? 0.5 : 1 
        }}>
          <Typography variant="subtitle2" sx={{ 
            fontSize: isMobile ? '0.75rem' : undefined 
          }}>
            Pie Chart Segments
          </Typography>
          <Button 
            variant="outlined" 
            startIcon={<AddIcon fontSize={isMobile ? "small" : "medium"} />} 
            size="small" 
            onClick={addSegment}
            sx={{ 
              fontSize: isMobile ? '0.75rem' : undefined,
              py: isMobile ? 0.5 : undefined
            }}
          >
            Add Segment
          </Button>
        </Box>
        <TableContainer component={Paper} variant="outlined" sx={{ p: isMobile ? 0.25 : 0.5 }}>
          <Table size="small" padding={isMobile ? "none" : "normal"}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: isMobile ? '0.75rem' : undefined, py: isMobile ? 0.5 : undefined }}>Label</TableCell>
                <TableCell align="center" sx={{ fontSize: isMobile ? '0.75rem' : undefined, py: isMobile ? 0.5 : undefined }}>Value</TableCell>
                <TableCell align="center" sx={{ fontSize: isMobile ? '0.75rem' : undefined, py: isMobile ? 0.5 : undefined }}>Color</TableCell>
                <TableCell align="center" sx={{ fontSize: isMobile ? '0.75rem' : undefined, py: isMobile ? 0.5 : undefined }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bufferedSegments.map((segment) => (
                <TableRow key={segment.id}>
                  <TableCell sx={{ py: isMobile ? 0.5 : undefined }}>
                    <TextField
                      id={`segment-${segment.id}-label`}
                      fullWidth
                      size="small"
                      onFocus={(e) => { e.target.select() }}
                      value={segment.label}
                      onChange={(e) => updateBufferedSegment(segment.id, 'label', e.target.value)}
                      onBlur={() => applyBufferedChanges(segment.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          applyBufferedChanges(segment.id)
                        }
                      }}
                      placeholder="Segment name"
                      variant="outlined"
                      sx={{ 
                        my: isMobile ? 0.25 : 0.5,
                        '& .MuiInputBase-input': {
                          fontSize: isMobile ? '0.75rem' : undefined
                        }
                      }}
                      InputLabelProps={{
                        style: { fontSize: isMobile ? '0.75rem' : undefined }
                      }}
                    />
                  </TableCell>
                  <TableCell align="center" sx={{ py: isMobile ? 0.5 : undefined }}>
                    <TextField
                      id={`segment-${segment.id}-value`}
                      size="small"
                      type="number"
                      inputProps={{ 
                        min: 0, 
                        style: { 
                          textAlign: 'center',
                          fontSize: isMobile ? '0.75rem' : undefined
                        }
                      }}
                      value={segment.value}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        updateBufferedSegment(segment.id, 'value', value)
                      }}
                      onBlur={() => applyBufferedChanges(segment.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          applyBufferedChanges(segment.id)
                        }
                      }}
                      sx={{ width: isMobile ? '60px' : '80px' }}
                    />
                  </TableCell>
                  <TableCell align="center" sx={{ py: isMobile ? 0.5 : undefined }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <Box
                        sx={{ 
                          width: isMobile ? '20px' : '24px', 
                          height: isMobile ? '20px' : '24px', 
                          bgcolor: segment.color,
                          borderRadius: '4px',
                          border: '1px solid rgba(0,0,0,0.2)',
                          mr: isMobile ? 0.5 : 1,
                          display: 'inline-block'
                        }}
                      />
                      <IconButton 
                        size="small" 
                        onClick={() => openColorPicker(segment.id, segment.color)}
                      >
                        <ColorLensIcon fontSize={isMobile ? "small" : "medium"} />
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell align="center" sx={{ py: isMobile ? 0.5 : undefined }}>
                    <Tooltip title="Delete segment">
                      <IconButton 
                        size="small" 
                        color="error" 
                        disabled={segments.length <= 1}
                        onClick={() => deleteSegment(segment.id)}
                      >
                        <DeleteIcon fontSize={isMobile ? "small" : "medium"} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {/* Color Picker Modal */}
        <ColorPickerModal 
          open={colorPickerOpen} 
          currentColor={currentColor} 
          onClose={() => setColorPickerOpen(false)} 
          onSave={applyColor}
          isMobile={isMobile} 
        />
      </Box>
    </Box>
  )
}

export default PieChartEditor 