import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  IconButton,
  Box,
  Paper,
  Tooltip,
  Chip,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import WidgetsIcon from '@mui/icons-material/Widgets'
import EditIcon from '@mui/icons-material/Edit'
import PreviewIcon from '@mui/icons-material/Visibility'
import { CustomWidget } from '../WidgetStorage'

interface SavedWidgetsDialogProps {
  open: boolean
  widgets: CustomWidget[]
  onClose: () => void
  onLoad: (widget: CustomWidget, editMode?: boolean) => void
  onDelete: (id: string) => void
}

const SavedWidgetsDialog: React.FC<SavedWidgetsDialogProps> = ({
  open,
  widgets,
  onClose,
  onLoad,
  onDelete,
}) => {
  // Function to preview a widget (load in view mode)
  const handlePreviewWidget = (widget: CustomWidget) => {
    // Pass false to explicitly set it to view mode
    onLoad(widget, false)
  }
  
  // Function to edit a widget (load in edit mode)
  const handleEditWidget = (e: React.MouseEvent, widget: CustomWidget) => {
    e.stopPropagation()
    // Pass true to explicitly set it to edit mode
    onLoad(widget, true)
  }
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          overflow: 'hidden',
          bgcolor: '#00A389', // Teal background for the entire dialog
        }
      }}
    >
      <DialogTitle sx={{ 
        bgcolor: '#00BC9A', 
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        py: 2,
      }}>
        <WidgetsIcon sx={{ mr: 1.5, color: '#191919' }} />
        <Typography variant="h6" component="div" fontWeight="bold" color="#191919">
          Custom Widgets Library
        </Typography>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3, bgcolor: '#00A389', mt: '2rem'}}>        
        {widgets.length === 0 ? (
          <Paper 
            elevation={0} 
            sx={{ 
              p: 4, 
              textAlign: 'center',
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 2,
              border: '1px dashed rgba(255, 255, 255, 0.3)',
            }}
          >
            <WidgetsIcon 
              sx={{ 
                fontSize: 48, 
                mb: 2, 
                color: 'rgba(255, 255, 255, 0.6)'
              }} 
            />
            <Typography color="white" variant="h6" gutterBottom>
              No Custom Widgets Yet
            </Typography>
            <Typography color="rgba(255, 255, 255, 0.7)" variant="body2">
              Start by creating and saving a widget using the editor
            </Typography>
          </Paper>
        ) : (
          <List>
            {widgets.map((widget) => (
              <Paper
                key={widget.id}
                elevation={0}
                sx={{
                  mb: 2,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: 2,
                  transition: 'all 0.2s ease-in-out',
                  bgcolor: '#00886F', // Darker teal for widget cards
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                  },
                }}
              >
                <ListItem
                  button
                  onClick={() => handlePreviewWidget(widget)}
                  sx={{
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                  }}
                >
                  <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box 
                        sx={{ 
                          bgcolor: 'rgba(255, 255, 255, 0.15)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%',
                          width: 40,
                          height: 40,
                          mr: 2
                        }}
                      >
                        <WidgetsIcon />
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold" color="white">
                          {widget.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                          <Typography variant="caption" color="rgba(255, 255, 255, 0.7)">
                            Last modified: {new Date(widget.updatedAt).toLocaleDateString()} at {new Date(widget.updatedAt).toLocaleTimeString()}
                          </Typography>
                          <Chip 
                            size="small" 
                            label={`${widget.components.length} components`} 
                            sx={{ 
                              ml: 2, 
                              height: 20, 
                              fontSize: '0.7rem',
                              bgcolor: 'rgba(255, 255, 255, 0.15)',
                              color: 'white'
                            }}
                          />
                        </Box>
                      </Box>
                    </Box>
                    <Box>
                      <Tooltip title="Preview Widget">
                        <Button
                          size="small"
                          startIcon={<PreviewIcon />}
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePreviewWidget(widget)
                          }}
                          sx={{ 
                            mr: 1,
                            color: 'white',
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            '&:hover': {
                              borderColor: 'white',
                              bgcolor: 'rgba(255, 255, 255, 0.1)'
                            }
                          }}
                          variant="outlined"
                        >
                          Preview
                        </Button>
                      </Tooltip>
                      <Tooltip title="Edit Widget">
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={(e) => handleEditWidget(e, widget)}
                          sx={{ 
                            mr: 1,
                            bgcolor: '#00D1AB',
                            color: '#191919',
                            '&:hover': {
                              bgcolor: '#00E4BC'
                            }
                          }}
                          variant="contained"
                        >
                          Edit
                        </Button>
                      </Tooltip>
                      <Tooltip title="Delete Widget">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(widget.id)
                          }}
                          sx={{
                            bgcolor: 'rgba(211, 47, 47, 0.1)',
                            '&:hover': {
                              bgcolor: 'rgba(211, 47, 47, 0.2)'
                            }
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </ListItem>
              </Paper>
            ))}
          </List>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#00A389' }}>
        <Button 
          onClick={onClose}
          variant="contained" 
          size="medium"
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.15)',
            color: 'white',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.25)'
            }
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SavedWidgetsDialog