import React from 'react'
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import EditIcon from '@mui/icons-material/Edit'
import DescriptionIcon from '@mui/icons-material/Description'
import SettingsIcon from '@mui/icons-material/Settings'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import MenuIcon from '@mui/icons-material/Menu'

interface EditorToolbarProps {
  editMode: boolean;
  showSidebar: boolean;
  toggleSidebar: () => void;
  toggleEditMode: () => void;
  handleSaveWidget: () => void;
  setShowWidgetList: (show: boolean) => void;
  setShowSettingsModal: (show: boolean) => void;
  isUpdating: boolean;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editMode,
  showSidebar,
  toggleSidebar,
  toggleEditMode,
  handleSaveWidget,
  setShowWidgetList,
  setShowSettingsModal,
  isUpdating,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        p: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      {editMode && (
        <Tooltip title={showSidebar ? "Hide component sidebar" : "Show component sidebar"}>
          <IconButton
            size="small"
            onClick={toggleSidebar}
            sx={{ color: 'foreground.contrastPrimary', mr: 1.5 }}
          >
            {showSidebar ? <MenuOpenIcon /> : <MenuIcon />}
          </IconButton>
        </Tooltip>
      )}
      
      <Typography variant="h6" sx={{ flexGrow: 1, color: 'foreground.contrastPrimary', pl: editMode ? '0rem' : '0.5rem' }}>
        Widget Editor
      </Typography>

      <Tooltip title="Settings">
        <IconButton
          size="small"
          onClick={() => setShowSettingsModal(true)}
          sx={{ color: 'text.secondary', marginInline: '0.75rem' }}
        >
          <SettingsIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Edit/Preview mode">
        <Button
          size="small"
          variant="contained"
          startIcon={editMode ? <DescriptionIcon /> : <EditIcon />}
          onClick={toggleEditMode}
          sx={{ mr: 1 }}
        >
          {editMode ? 'Preview Mode' : 'Edit Mode'}
        </Button>
      </Tooltip>
      <Tooltip title={isUpdating ? "Update widget" : "Save widget"}>
        <Button
          size="small"
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSaveWidget}
          sx={{ mr: 1 }}
        >
          {isUpdating ? 'UPDATE' : 'SAVE'}
        </Button>
      </Tooltip>
      <Button
        size="small"
        variant="contained"
        onClick={() => setShowWidgetList(true)}
        sx={{ mr: 1 }}
      >
        Browse Widgets
      </Button>
    </Box>
  )
}

export default EditorToolbar 