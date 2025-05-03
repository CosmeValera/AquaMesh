import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Typography,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Box,
  Divider,
} from '@mui/material'
import { EditComponentDialogProps } from '../types/types'
import ChartPreview from './ChartPreview'
import PieChartEditor from './PieChartEditor'
import ButtonEditor from './ButtonEditor'

const EditComponentDialog: React.FC<EditComponentDialogProps> = ({
  open,
  component,
  onClose,
  onSave,
}) => {
  const [editedProps, setEditedProps] = useState<Record<string, unknown>>({})
  // For chart preview - parsed data with proper typing
  const [parsedChartData, setParsedChartData] = useState<{
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
      backgroundColor?: string | string[]
    }>
  }>({
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [{
      label: 'Sales',
      data: [30, 20, 15, 25, 10],
      backgroundColor: [
        'rgba(255, 99, 132, 0.8)',
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 206, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(153, 102, 255, 0.8)'
      ]
    }]
  })

  useEffect(() => {
    if (component) {
      setEditedProps({ ...component.props })
      
      // Parse chart data if it's a chart component
      if (component.type === 'Chart') {
        try {
          const chartData = component.props.data as string || '{}'
          if (chartData.trim().startsWith('<')) {
            // Basic XML parsing logic here if needed
            // For now we'll skip XML support in the live preview
            setParsedChartData({
              labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
              datasets: [{
                label: 'Sales',
                data: [30, 20, 15, 25, 10],
                backgroundColor: [
                  'rgba(255, 99, 132, 0.8)',
                  'rgba(54, 162, 235, 0.8)',
                  'rgba(255, 206, 86, 0.8)',
                  'rgba(75, 192, 192, 0.8)',
                  'rgba(153, 102, 255, 0.8)'
                ]
              }]
            })
          } else {
            // Parse JSON data
            const data = JSON.parse(chartData)
            setParsedChartData(data)
          }
        } catch (error) {
          console.error("Error parsing chart data:", error)
          // Set default data on error
          setParsedChartData({
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
            datasets: [{
              label: 'Sales',
              data: [30, 20, 15, 25, 10],
              backgroundColor: [
                'rgba(255, 99, 132, 0.8)',
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 206, 86, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(153, 102, 255, 0.8)'
              ]
            }]
          })
        }
      }
    }
  }, [component])

  // Update parsed chart data whenever edited props change
  useEffect(() => {
    if (component?.type === 'Chart') {
      try {
        const chartData = editedProps.data as string || '{}'
        if (chartData.trim().startsWith('<')) {
          // Skip XML for now in the live preview
        } else if (chartData.trim()) {
          // Only try to parse if there's actual data
          const data = JSON.parse(chartData)
          setParsedChartData(data)
        }
      } catch (error: unknown) {
        // Silently fail during editing - this will happen as user types
        // We'll keep the last valid parsed data
        if (error instanceof Error) {
          console.debug("Invalid JSON format while editing:", error.message)
        }
      }
    }
  }, [editedProps.data, component?.type])

  if (!component) {
    return null
  }

  const handleSave = () => {
    const updatedComponent = {
      ...component,
      props: editedProps,
    }
    onSave(updatedComponent)
    onClose()
  }

  const renderPropsEdit = () => {
    switch (component.type) {
      case 'SwitchEnable':
        return (
          <>
            <TextField
              label="Label"
              fullWidth
              margin="normal"
              value={(editedProps.label as string) || ''}
              onChange={(e) =>
                setEditedProps({ ...editedProps, label: e.target.value })
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(editedProps.defaultChecked)}
                  onChange={(e) =>
                    setEditedProps({
                      ...editedProps,
                      defaultChecked: e.target.checked,
                    })
                  }
                />
              }
              label="Default State"
            />
          </>
        )
      case 'FieldSet':
        return (
          <>
            <TextField
              label="Legend"
              fullWidth
              margin="normal"
              value={(editedProps.legend as string) || ''}
              onChange={(e) =>
                setEditedProps({ ...editedProps, legend: e.target.value })
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(editedProps.collapsed)}
                  onChange={(e) =>
                    setEditedProps({
                      ...editedProps,
                      collapsed: e.target.checked,
                    })
                  }
                />
              }
              label="Default Collapsed"
            />
          </>
        )
      case 'Label':
        return (
          <TextField
            label="Text"
            fullWidth
            margin="normal"
            value={(editedProps.text as string) || ''}
            onChange={(e) =>
              setEditedProps({ ...editedProps, text: e.target.value })
            }
          />
        )
      case 'Button':
        return <ButtonEditor props={editedProps} onChange={setEditedProps} />
      case 'TextField':
        return (
          <>
            <TextField
              label="Field Label"
              fullWidth
              margin="normal"
              value={(editedProps.label as string) || ''}
              onChange={(e) =>
                setEditedProps({ ...editedProps, label: e.target.value })
              }
            />
            <TextField
              label="Placeholder"
              fullWidth
              margin="normal"
              value={(editedProps.placeholder as string) || ''}
              onChange={(e) =>
                setEditedProps({ ...editedProps, placeholder: e.target.value })
              }
            />
            <TextField
              label="Default Value"
              fullWidth
              margin="normal"
              value={(editedProps.defaultValue as string) || ''}
              onChange={(e) =>
                setEditedProps({ ...editedProps, defaultValue: e.target.value })
              }
            />
          </>
        )
      case 'FlexBox':
        return (
          <>
            <FormControl fullWidth margin="normal">
              <InputLabel>Direction</InputLabel>
              <Select
                value={(editedProps.direction as string) || 'row'}
                label="Direction"
                onChange={(e) =>
                  setEditedProps({ ...editedProps, direction: e.target.value })
                }
              >
                <MenuItem value="row">Row</MenuItem>
                <MenuItem value="column">Column</MenuItem>
                <MenuItem value="row-reverse">Row Reverse</MenuItem>
                <MenuItem value="column-reverse">Column Reverse</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel>Justify Content</InputLabel>
              <Select
                value={(editedProps.justifyContent as string) || 'flex-start'}
                label="Justify Content"
                onChange={(e) =>
                  setEditedProps({ ...editedProps, justifyContent: e.target.value })
                }
              >
                <MenuItem value="flex-start">Start</MenuItem>
                <MenuItem value="center">Center</MenuItem>
                <MenuItem value="flex-end">End</MenuItem>
                <MenuItem value="space-between">Space Between</MenuItem>
                <MenuItem value="space-around">Space Around</MenuItem>
                <MenuItem value="space-evenly">Space Evenly</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel>Align Items</InputLabel>
              <Select
                value={(editedProps.alignItems as string) || 'center'}
                label="Align Items"
                onChange={(e) =>
                  setEditedProps({ ...editedProps, alignItems: e.target.value })
                }
              >
                <MenuItem value="flex-start">Start</MenuItem>
                <MenuItem value="center">Center</MenuItem>
                <MenuItem value="flex-end">End</MenuItem>
                <MenuItem value="stretch">Stretch</MenuItem>
                <MenuItem value="baseline">Baseline</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel>Wrap</InputLabel>
              <Select
                value={(editedProps.wrap as string) || 'wrap'}
                label="Wrap"
                onChange={(e) =>
                  setEditedProps({ ...editedProps, wrap: e.target.value })
                }
              >
                <MenuItem value="wrap">Wrap</MenuItem>
                <MenuItem value="nowrap">No Wrap</MenuItem>
                <MenuItem value="wrap-reverse">Wrap Reverse</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Spacing"
              type="number"
              fullWidth
              margin="normal"
              inputProps={{ min: 0, max: 10, step: 1 }}
              value={(editedProps.spacing as number) || 0}
              onChange={(e) =>
                setEditedProps({ ...editedProps, spacing: Number(e.target.value) })
              }
            />
          </>
        )
      case 'GridBox':
        return (
          <>
            <TextField
              label="Columns"
              type="number"
              fullWidth
              margin="normal"
              inputProps={{ min: 1, max: 12, step: 1 }}
              value={(editedProps.columns as number) || 1}
              onChange={(e) =>
                setEditedProps({ ...editedProps, columns: Number(e.target.value) })
              }
            />
            <TextField
              label="Rows"
              type="number"
              fullWidth
              margin="normal"
              inputProps={{ min: 1, max: 12, step: 1 }}
              value={(editedProps.rows as number) || 1}
              onChange={(e) =>
                setEditedProps({ ...editedProps, rows: Number(e.target.value) })
              }
            />
            <TextField
              label="Spacing"
              type="number"
              fullWidth
              margin="normal"
              inputProps={{ min: 0, max: 10, step: 1 }}
              value={(editedProps.spacing as number) || 2}
              onChange={(e) =>
                setEditedProps({ ...editedProps, spacing: Number(e.target.value) })
              }
            />
          </>
        )
      case 'Chart': {
        // Check if it's a pie chart
        const isPieChart = Boolean(
          (editedProps.chartType as string)?.toLowerCase() === 'pie' ||
          ((editedProps.data as string) && (editedProps.data as string).includes('"type":"pie"'))
        )
        
        // If it's a pie chart, use our new user-friendly PieChartEditor
        if (isPieChart) {
          return (
            <>
              <TextField
                label="Chart Title"
                fullWidth
                margin="normal"
                value={(editedProps.title as string) || ''}
                onChange={(e) =>
                  setEditedProps({ ...editedProps, title: e.target.value })
                }
              />
              <TextField
                label="Description"
                fullWidth
                margin="normal"
                value={(editedProps.description as string) || ''}
                onChange={(e) =>
                  setEditedProps({ ...editedProps, description: e.target.value })
                }
              />
              
              <Divider sx={{ my: 2 }} />
              
              {/* User-friendly pie chart editor */}
              <PieChartEditor 
                initialData={(editedProps.data as string) || '{}'}
                onChange={(jsonData) => 
                  setEditedProps({ ...editedProps, data: jsonData })
                }
                title={(editedProps.title as string) || ''}
                description={(editedProps.description as string) || ''}
              />
            </>
          )
        }
        
        // For other chart types, keep the existing code
        return (
          <>
            <TextField
              label="Chart Title"
              fullWidth
              margin="normal"
              value={(editedProps.title as string) || ''}
              onChange={(e) =>
                setEditedProps({ ...editedProps, title: e.target.value })
              }
            />
            <TextField
              label="Description"
              fullWidth
              margin="normal"
              value={(editedProps.description as string) || ''}
              onChange={(e) =>
                setEditedProps({ ...editedProps, description: e.target.value })
              }
            />
            <TextField
              label="Chart Data (JSON or XML)"
              fullWidth
              multiline
              rows={8}
              margin="normal"
              value={(editedProps.data as string) || '{}'}
              onChange={(e) =>
                setEditedProps({ ...editedProps, data: e.target.value })
              }
              helperText={
                <span>
                  JSON format example: {`{"labels": ["Jan", "Feb"], "datasets": [{"data": [20, 30], "backgroundColor": ["rgba(255, 99, 132, 0.8)", "rgba(54, 162, 235, 0.8)"]}]}`}
                  <br />
                </span>
              }
            />
            
            <Divider sx={{ my: 2 }} />
            
            {/* Live Chart Preview */}
            <Box sx={{ mb: 3, mt: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Live Preview</Typography>
              <Box sx={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 1, p: 1, bgcolor: 'rgba(0,0,0,0.02)' }}>
                <ChartPreview
                  chartType="pie"
                  title={(editedProps.title as string) || ''}
                  description={(editedProps.description as string) || ''}
                  data={parsedChartData}
                />
              </Box>
            </Box>
          </>
        )
      }
      case 'DataUpload':
        return (
          <>
            <TextField
              label="Label"
              fullWidth
              margin="normal"
              value={(editedProps.label as string) || 'Upload File'}
              onChange={(e) =>
                setEditedProps({ ...editedProps, label: e.target.value })
              }
            />
            <TextField
              label="Accepted File Types"
              fullWidth
              margin="normal"
              value={(editedProps.acceptedFileTypes as string) || 'image/*,application/pdf'}
              onChange={(e) =>
                setEditedProps({ ...editedProps, acceptedFileTypes: e.target.value })
              }
              helperText="Comma separated list of MIME types, e.g. 'image/*,application/pdf'"
            />
            <TextField
              label="Max File Size (MB)"
              type="number"
              fullWidth
              margin="normal"
              inputProps={{ min: 1, max: 20, step: 1 }}
              value={(editedProps.maxFileSize as number) || 5}
              onChange={(e) =>
                setEditedProps({ ...editedProps, maxFileSize: Number(e.target.value) })
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(editedProps.allowMultiple)}
                  onChange={(e) =>
                    setEditedProps({
                      ...editedProps,
                      allowMultiple: e.target.checked,
                    })
                  }
                />
              }
              label="Allow Multiple Files"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(editedProps.showCaptions)}
                  onChange={(e) =>
                    setEditedProps({
                      ...editedProps,
                      showCaptions: e.target.checked,
                    })
                  }
                />
              }
              label="Show Image Captions"
            />
            <TextField
              label="Helper Text"
              fullWidth
              margin="normal"
              value={(editedProps.helperText as string) || 'Upload PDF or images (max 5MB)'}
              onChange={(e) =>
                setEditedProps({ ...editedProps, helperText: e.target.value })
              }
            />
            <TextField
              label="Image Columns"
              type="number"
              fullWidth
              margin="normal"
              inputProps={{ min: 1, max: 6, step: 1 }}
              value={(editedProps.columns as number) || 3}
              onChange={(e) =>
                setEditedProps({ ...editedProps, columns: Number(e.target.value) })
              }
              helperText="Number of columns to display images in (when files are uploaded)"
            />
          </>
        )
      default:
        return <Typography>No editable properties</Typography>
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit {component.type === 'Chart' ? 'Pie Chart' : component.type}</DialogTitle>
      <DialogContent>{renderPropsEdit()}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default EditComponentDialog 