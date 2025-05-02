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
} from '@mui/material'
import { EditComponentDialogProps } from '../types/types'

const EditComponentDialog: React.FC<EditComponentDialogProps> = ({
  open,
  component,
  onClose,
  onSave,
}) => {
  const [editedProps, setEditedProps] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (component) {
      setEditedProps({ ...component.props })
    }
  }, [component])

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
        return (
          <>
            <TextField
              label="Button Text"
              fullWidth
              margin="normal"
              value={(editedProps.text as string) || ''}
              onChange={(e) =>
                setEditedProps({ ...editedProps, text: e.target.value })
              }
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Variant</InputLabel>
              <Select
                value={(editedProps.variant as string) || 'contained'}
                label="Variant"
                onChange={(e) =>
                  setEditedProps({ ...editedProps, variant: e.target.value })
                }
              >
                <MenuItem value="contained">Contained</MenuItem>
                <MenuItem value="outlined">Outlined</MenuItem>
                <MenuItem value="text">Text</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(editedProps.showToast)}
                  onChange={(e) =>
                    setEditedProps({
                      ...editedProps,
                      showToast: e.target.checked,
                    })
                  }
                />
              }
              label="Show Toast on Click"
            />
            {editedProps.showToast && (
              <>
                <TextField
                  label="Toast Message"
                  fullWidth
                  margin="normal"
                  value={(editedProps.toastMessage as string) || ''}
                  onChange={(e) =>
                    setEditedProps({ ...editedProps, toastMessage: e.target.value })
                  }
                />
                <FormControl fullWidth margin="normal">
                  <InputLabel>Toast Severity</InputLabel>
                  <Select
                    value={(editedProps.toastSeverity as string) || 'info'}
                    label="Toast Severity"
                    onChange={(e) =>
                      setEditedProps({ ...editedProps, toastSeverity: e.target.value })
                    }
                  >
                    <MenuItem value="info">Info</MenuItem>
                    <MenuItem value="success">Success</MenuItem>
                    <MenuItem value="warning">Warning</MenuItem>
                    <MenuItem value="error">Error</MenuItem>
                  </Select>
                </FormControl>
              </>
            )}
          </>
        )
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
      default:
        return <Typography>No editable properties</Typography>
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit {component.type}</DialogTitle>
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