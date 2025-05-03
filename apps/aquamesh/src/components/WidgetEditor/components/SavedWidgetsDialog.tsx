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
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Box,
  Divider,
  Paper,
  Tooltip,
  Chip,
  alpha,
  useTheme,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import WidgetsIcon from '@mui/icons-material/Widgets'
import EditIcon from '@mui/icons-material/Edit'
import { CustomWidget } from '../WidgetStorage'

interface SavedWidgetsDialogProps {
  open: boolean
  widgets: CustomWidget[]
  onClose: () => void
  onLoad: (widget: CustomWidget) => void
  onDelete: (id: string) => void
}

const SavedWidgetsDialog: React.FC<SavedWidgetsDialogProps> = ({
  open,
  widgets,
  onClose,
  onLoad,
  onDelete,
}) => {
  const theme = useTheme();
  
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
        }
      }}
    >
      <DialogTitle sx={{ 
        bgcolor: 'primary.main', 
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        py: 2,
      }}>
        <WidgetsIcon sx={{ mr: 1.5 }} />
        <Typography variant="h6" component="div" fontWeight="bold">
          Custom Widgets Library
        </Typography>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3, bgcolor: 'background.paper' }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Load any of your saved widgets to modify them or create new ones based on existing designs.
          </Typography>
          <Divider sx={{ my: 2 }} />
        </Box>
        
        {widgets.length === 0 ? (
          <Paper 
            elevation={0} 
            sx={{ 
              p: 4, 
              textAlign: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.05),
              borderRadius: 2,
              border: `1px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          >
            <WidgetsIcon 
              sx={{ 
                fontSize: 48, 
                mb: 2, 
                color: alpha(theme.palette.primary.main, 0.5)
              }} 
            />
            <Typography color="text.secondary" variant="h6" gutterBottom>
              No Custom Widgets Yet
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Start by creating and saving a widget using the editor
            </Typography>
          </Paper>
        ) : (
          <List sx={{ p: 0 }}>
            {widgets.map((widget) => (
              <Paper
                key={widget.id}
                elevation={0}
                sx={{
                  mb: 2,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                    borderColor: 'primary.main',
                  },
                }}
              >
                <ListItem
                  button
                  onClick={() => onLoad(widget)}
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
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: 'primary.main',
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
                        <Typography variant="subtitle1" fontWeight="bold">
                          {widget.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Last modified: {new Date(widget.updatedAt).toLocaleDateString()} at {new Date(widget.updatedAt).toLocaleTimeString()}
                          </Typography>
                          <Chip 
                            size="small" 
                            label={`${widget.components.length} components`} 
                            sx={{ ml: 2, height: 20, fontSize: '0.7rem' }}
                          />
                        </Box>
                      </Box>
                    </Box>
                    <Box>
                      <Tooltip title="Edit Widget">
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={(e) => {
                            e.stopPropagation()
                            onLoad(widget)
                          }}
                          sx={{ mr: 1 }}
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
      
      <DialogActions sx={{ px: 3, py: 2, bgcolor: 'background.paper' }}>
        <Button 
          onClick={onClose}
          variant="outlined" 
          size="medium"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SavedWidgetsDialog