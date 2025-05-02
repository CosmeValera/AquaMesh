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
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
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
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>My Custom Widgets</DialogTitle>
      <DialogContent>
        {widgets.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ my: 4 }}>
            You haven&apos;t saved any custom widgets yet
          </Typography>
        ) : (
          <List>
            {widgets.map((widget) => (
              <ListItem
                key={widget.id}
                button
                onClick={() => onLoad(widget)}
                sx={{
                  border: '1px solid #eee',
                  borderRadius: 1,
                  mb: 1,
                  '&:hover': {
                    borderColor: 'primary.light',
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  },
                }}
              >
                <ListItemText
                  primary={widget.name}
                  secondary={`Last modified: ${new Date(
                    widget.updatedAt,
                  ).toLocaleString()}`}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(widget.id)
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default SavedWidgetsDialog 