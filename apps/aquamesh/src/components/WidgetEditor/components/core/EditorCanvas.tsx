import React from 'react'
import {
  Box,
  Typography,
  Paper,
  TextField
} from '@mui/material'
import { ComponentData, DropTarget } from '../../types/types'
import ComponentPreview from '../preview/ComponentPreview'

interface EditorCanvasProps {
  editMode: boolean;
  widgetData: {
    name: string;
    components: ComponentData[];
    id?: string;
    createdAt?: number;
    updatedAt?: number;
    version?: string;
  };
  setWidgetData: React.Dispatch<React.SetStateAction<{
    name: string;
    components: ComponentData[];
    id?: string;
    createdAt?: number;
    updatedAt?: number;
    version?: string;
  }>>;
  dropAreaRef: React.RefObject<HTMLDivElement>;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragEnd: () => void;
  isDragging: boolean;
  dropTarget: DropTarget;
  handleEditComponent: (id: string) => void;
  handleDeleteComponent: (id: string) => void;
  handleMoveComponent: (id: string, direction: 'up' | 'down') => void;
  handleAddInsideFieldset: (parentId: string) => void;
  handleToggleVisibility: (id: string) => void;
  handleContainerDragEnter: (e: React.DragEvent, containerId: string) => void;
  handleContainerDragOver: (e: React.DragEvent) => void;
  handleContainerDragLeave: (e: React.DragEvent) => void;
  handleContainerDrop: (e: React.DragEvent, containerId: string) => void;
  /** Toggle collapse for FieldSet components */
  handleToggleFieldsetCollapse: (id: string) => void;
  showSidebar: boolean;
  handleWidgetNameChange?: (name: string) => void;
}

const EditorCanvas: React.FC<EditorCanvasProps> = ({
  editMode,
  widgetData,
  setWidgetData,
  dropAreaRef,
  handleDrop,
  handleDragOver,
  handleDragEnd,
  isDragging,
  dropTarget,
  handleEditComponent,
  handleDeleteComponent,
  handleMoveComponent,
  handleAddInsideFieldset,
  handleToggleVisibility,
  handleContainerDragEnter,
  handleContainerDragOver,
  handleContainerDragLeave,
  handleContainerDrop,
  handleToggleFieldsetCollapse,
  showSidebar,
  handleWidgetNameChange
}) => {
  // Render the component hierarchy
  const renderComponents = (components: ComponentData[]) => {
    return components.map((component, index) => (
      <ComponentPreview
        key={component.id}
        component={component}
        onEdit={handleEditComponent}
        onDelete={handleDeleteComponent}
        onMoveUp={(id) => handleMoveComponent(id, 'up')}
        onMoveDown={(id) => handleMoveComponent(id, 'down')}
        onAddInside={handleAddInsideFieldset}
        onToggleCollapse={handleToggleFieldsetCollapse}
        onToggleVisibility={handleToggleVisibility}
        isFirst={index === 0}
        isLast={index === components.length - 1}
        editMode={editMode}
        isDragging={isDragging}
        dropTarget={dropTarget}
        handleContainerDragEnter={handleContainerDragEnter}
        handleContainerDragOver={handleContainerDragOver}
        handleContainerDragLeave={handleContainerDragLeave}
        handleContainerDrop={handleContainerDrop}
        showWidgetName={editMode}
      />
    ))
  }

  return (
    <Box
      sx={{
        flex: 1,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        bgcolor: 'background.default',
        transition: 'width 0.3s ease',
        width: '100%',
      }}
    >
      {/* Widget name field */}
      {editMode ? (
        <TextField
          label="Widget Name"
          value={widgetData.name}
          onChange={(e) => 
            handleWidgetNameChange 
              ? handleWidgetNameChange(e.target.value) 
              : setWidgetData((prev) => ({ ...prev, name: e.target.value }))
          }
          margin="normal"
          variant="outlined"
          size="small"
          onFocus={(e) => {
            e.target.select()
          }}
          sx={{ 
            mb: 2,
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.2)',
              },
              '&:hover fieldset': {
                borderColor: 'primary.light',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
              },
            },
            '& .MuiInputLabel-root': {
              color: 'foreground.contrastSecondary',
            },
            '& .MuiOutlinedInput-input': {
              color: 'foreground.contrastPrimary',
            },
          }}
        />
      ) : (
        <Typography 
          variant="body1" 
          sx={{ 
            mb: 2, 
            color: 'foreground.contrastPrimary',
            userSelect: 'none' // Prevent text selection in view mode
          }}
        >
          <strong>Widget Name:</strong> {widgetData.name}
        </Typography>
      )}

      {/* Drop area */}
      <Paper
        ref={dropAreaRef}
        sx={{
          flex: 1,
          p: 2,
          backgroundColor: editMode
            ? dropTarget.id === null && isDragging 
              ? 'rgba(0, 188, 162, 0.1)' 
              : 'rgba(0, 188, 162, 0.05)'
            : 'rgba(0, 188, 162, 0.02)',
          border: editMode ? '2px dashed rgba(0, 188, 162, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 1,
          minHeight: 200,
          overflowY: 'auto',
          color: 'foreground.contrastPrimary',
          boxShadow: 'none',
          transition: 'background-color 0.2s'
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {widgetData.components.length === 0 ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'rgba(255, 255, 255, 0.4)',
              pt: 4,
              pb: 4,
            }}
          >
            <Typography variant="body1" sx={{ mb: 1, textAlign: 'center' }}>
              {editMode
                ? isDragging 
                  ? 'Drop component here'
                  : 'Drag and drop components here'
                : 'No components added yet'}
            </Typography>
            {editMode && !isDragging && (
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)' }}>
                {showSidebar 
                  ? 'Use the components panel on the left to build your widget'
                  : 'Click the menu button in the toolbar to show component panel'}
              </Typography>
            )}
          </Box>
        ) : (
          renderComponents(widgetData.components)
        )}
      </Paper>
    </Box>
  )
}

export default EditorCanvas 