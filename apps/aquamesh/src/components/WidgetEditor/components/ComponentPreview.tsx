import React from 'react'
import {
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Collapse,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { ComponentPreviewProps } from '../types/types'
import { getComponentIcon } from '../constants/componentTypes'

const ComponentPreview: React.FC<ComponentPreviewProps> = ({
  component,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddInside,
  isFirst,
  isLast,
  level = 0,
  editMode,
  isDragging,
  dropTarget,
  handleContainerDragEnter,
  handleContainerDragOver,
  handleContainerDragLeave,
  handleContainerDrop,
}) => {
  const isCurrentTarget = dropTarget.id === component.id && dropTarget.isHovering

  // Get the component icon for display
  const ComponentIcon = getComponentIcon(component.type)

  // Toggle collapse state for fieldset
  const handleToggleCollapse = (e: React.MouseEvent, fieldsetId: string) => {
    e.stopPropagation()
    // Find the component and toggle its collapsed state
    // We use the existing edit functionality
    onEdit(fieldsetId)
  }

  // Render a preview of the component based on its type
  const renderComponent = () => {
    switch (component.type) {
      case 'SwitchEnable':
        return (
          <FormControlLabel
            control={<Switch defaultChecked={component.props.defaultChecked as boolean} />}
            label={component.props.label as string}
          />
        )
      case 'FieldSet': {
        const isCollapsed = component.props.collapsed as boolean
        
        return (
          <Box
            sx={{
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 1,
              p: 2,
              bgcolor: isCurrentTarget ? 'rgba(0, 188, 162, 0.15)' : 'transparent',
              borderStyle: isCurrentTarget ? 'dashed' : 'solid',
              transition: 'background-color 0.2s, border-color 0.2s',
            }}
            onDragEnter={(e) => handleContainerDragEnter(e, component.id)}
            onDragOver={handleContainerDragOver}
            onDragLeave={handleContainerDragLeave}
            onDrop={(e) => handleContainerDrop(e, component.id)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <IconButton 
                onClick={(e) => handleToggleCollapse(e, component.id)} 
                size="small" 
                sx={{ color: 'primary.main' }}
              >
                {isCollapsed ? <KeyboardArrowDownIcon /> : <KeyboardArrowUpIcon />}
              </IconButton>
              <Typography variant="h6" sx={{ ml: 1 }}>
                {component.props.legend as string}
              </Typography>
            </Box>
            <Collapse in={!isCollapsed}>
              {component.children && component.children.length > 0 ? (
                component.children.map((child, index) => (
                  <ComponentPreview
                    key={child.id}
                    component={child}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    onAddInside={onAddInside}
                    isFirst={index === 0}
                    isLast={index === component.children!.length - 1}
                    level={level + 1}
                    editMode={editMode}
                    isDragging={isDragging}
                    dropTarget={dropTarget}
                    handleContainerDragEnter={handleContainerDragEnter}
                    handleContainerDragOver={handleContainerDragOver}
                    handleContainerDragLeave={handleContainerDragLeave}
                    handleContainerDrop={handleContainerDrop}
                  />
                ))
              ) : (
                <Box
                  sx={{
                    p: 2,
                    border: '1px dashed rgba(255, 255, 255, 0.2)',
                    borderRadius: 1,
                    bgcolor: isCurrentTarget ? 'rgba(0, 188, 162, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: 'text.secondary',
                    textAlign: 'center',
                  }}
                >
                  {isDragging ? 'Drop component here' : (editMode ? 'Drag components here' : 'No content')}
                </Box>
              )}
            </Collapse>
          </Box>
        )
      }
      case 'Label':
        return (
          <Typography variant="body1">{component.props.text as string}</Typography>
        )
      case 'Button':
        return (
          <Button
            variant={(component.props.variant as 'contained' | 'outlined' | 'text') || 'contained'}
            color="primary"
          >
            {component.props.text as string}
          </Button>
        )
      case 'TextField':
        return (
          <TextField
            label={component.props.label as string}
            placeholder={component.props.placeholder as string}
            defaultValue={component.props.defaultValue as string}
            fullWidth
            size="small"
          />
        )
      case 'FlexBox':
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: (component.props.direction as 'row' | 'column' | 'row-reverse' | 'column-reverse') || 'row',
              justifyContent: (component.props.justifyContent as string) || 'flex-start',
              alignItems: (component.props.alignItems as string) || 'center',
              flexWrap: (component.props.wrap as 'wrap' | 'nowrap' | 'wrap-reverse') || 'wrap',
              gap: (component.props.spacing as number) || 2,
              p: 2,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 1,
              minHeight: '50px',
              bgcolor: isCurrentTarget ? 'rgba(0, 188, 162, 0.15)' : 'transparent',
              borderStyle: isCurrentTarget ? 'dashed' : 'solid',
              transition: 'background-color 0.2s, border-color 0.2s',
            }}
            onDragEnter={(e) => handleContainerDragEnter(e, component.id)}
            onDragOver={handleContainerDragOver}
            onDragLeave={handleContainerDragLeave}
            onDrop={(e) => handleContainerDrop(e, component.id)}
          >
            {component.children && component.children.length > 0 ? (
              component.children.map((child, index) => (
                <ComponentPreview
                  key={child.id}
                  component={child}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onAddInside={onAddInside}
                  isFirst={index === 0}
                  isLast={index === component.children!.length - 1}
                  level={level + 1}
                  editMode={editMode}
                  isDragging={isDragging}
                  dropTarget={dropTarget}
                  handleContainerDragEnter={handleContainerDragEnter}
                  handleContainerDragOver={handleContainerDragOver}
                  handleContainerDragLeave={handleContainerDragLeave}
                  handleContainerDrop={handleContainerDrop}
                />
              ))
            ) : (
              <Box sx={{ width: '100%', textAlign: 'center', color: 'text.secondary' }}>
                {isDragging ? 'Drop component here' : (editMode ? 'Drag components here' : 'Empty Flex Container')}
              </Box>
            )}
          </Box>
        )
      case 'GridBox':
        return (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${component.props.columns as number || 1}, 1fr)`,
              gridTemplateRows: `repeat(${component.props.rows as number || 1}, auto)`,
              gap: (component.props.spacing as number) || 2,
              p: 2,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 1,
              minHeight: '50px',
              bgcolor: isCurrentTarget ? 'rgba(0, 188, 162, 0.15)' : 'transparent',
              borderStyle: isCurrentTarget ? 'dashed' : 'solid',
              transition: 'background-color 0.2s, border-color 0.2s',
            }}
            onDragEnter={(e) => handleContainerDragEnter(e, component.id)}
            onDragOver={handleContainerDragOver}
            onDragLeave={handleContainerDragLeave}
            onDrop={(e) => handleContainerDrop(e, component.id)}
          >
            {component.children && component.children.length > 0 ? (
              component.children.map((child, index) => (
                <ComponentPreview
                  key={child.id}
                  component={child}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onAddInside={onAddInside}
                  isFirst={index === 0}
                  isLast={index === component.children!.length - 1}
                  level={level + 1}
                  editMode={editMode}
                  isDragging={isDragging}
                  dropTarget={dropTarget}
                  handleContainerDragEnter={handleContainerDragEnter}
                  handleContainerDragOver={handleContainerDragOver}
                  handleContainerDragLeave={handleContainerDragLeave}
                  handleContainerDrop={handleContainerDrop}
                />
              ))
            ) : (
              <Box sx={{ 
                width: '100%', 
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center', 
                color: 'text.secondary' 
              }}>
                {isDragging ? 'Drop component here' : (editMode ? 'Drag components here' : 'Empty Grid Container')}
              </Box>
            )}
          </Box>
        )
      default:
        return <Typography>Unknown component type: {component.type}</Typography>
    }
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1,
        mb: 1,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 1,
        position: 'relative',
        ml: level * 2,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
      }}
    >
      {editMode && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            mb: 1,
            bgcolor: 'rgba(0, 0, 0, 0.1)',
            borderRadius: '4px',
            p: 0.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 'auto', color: 'text.secondary' }}>
            {ComponentIcon && <ComponentIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.7 }} />}
            <Typography variant="caption">
              {component.type}
            </Typography>
          </Box>
          {!isFirst && (
            <IconButton
              size="small"
              onClick={() => onMoveUp(component.id)}
              sx={{ p: 0.5, color: 'primary.main' }}
            >
              <KeyboardArrowUpIcon fontSize="small" />
            </IconButton>
          )}
          {!isLast && (
            <IconButton
              size="small"
              onClick={() => onMoveDown(component.id)}
              sx={{ p: 0.5, color: 'primary.main' }}
            >
              <KeyboardArrowDownIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={() => onEdit(component.id)}
            sx={{ p: 0.5, color: '#2196f3' }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onDelete(component.id)}
            sx={{ p: 0.5, color: '#f44336' }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
      {renderComponent()}
    </Paper>
  )
}

export default ComponentPreview 