import React, { useState, useEffect } from 'react'
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
  IconButton,
  Tooltip,
  Box,
  Divider,
  TextField,
  Alert,
  useTheme,
  Chip
} from '@mui/material'
import RestoreIcon from '@mui/icons-material/Restore'
import HistoryIcon from '@mui/icons-material/History'
import { CustomWidget } from '../../WidgetStorage'
import WidgetStorage, { WidgetVersion } from '../../WidgetStorage'
import { format, formatDistanceToNow } from 'date-fns'

interface WidgetVersioningDialogProps {
  open: boolean
  onClose: () => void
  widget: CustomWidget | null
  onRestoreVersion: (widgetId: string, version: WidgetVersion) => void
}

const WidgetVersioningDialog: React.FC<WidgetVersioningDialogProps> = ({
  open,
  onClose,
  widget,
  onRestoreVersion
}) => {
  const theme = useTheme()
  const [versions, setVersions] = useState<WidgetVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<WidgetVersion | null>(null)
  const [versionNotes, setVersionNotes] = useState('')
  
  useEffect(() => {
    if (open && widget) {
      // Load real versions from widget storage
      const widgetVersions = WidgetStorage.getWidgetVersions(widget.id)
      
      // Check if the current version is already in the versions list
      const currentVersionExists = widgetVersions.some(v => v.version === widget.version)
      
      if (!currentVersionExists) {
        // Create a current version entry for display purposes
        const currentVersion = {
          id: `current-${Date.now()}`,
          widgetId: widget.id,
          version: widget.version || '1.0',
          components: widget.components ? [...widget.components] : [],
          createdAt: new Date().toISOString(),
          notes: 'Current version',
          isCurrent: true
        }
        
        setVersions([currentVersion, ...widgetVersions])
      } else {
        // Mark the current version in the list
        const updatedVersions = widgetVersions.map(v => ({
          ...v,
          isCurrent: v.version === widget.version
        }))
        setVersions(updatedVersions)
      }
    } else {
      setSelectedVersion(null)
    }
  }, [open, widget?.id])
  
  const handleSelectVersion = (version: WidgetVersion) => {
    setSelectedVersion(version === selectedVersion ? null : version)
  }
  
  const handleRestoreVersion = () => {
    if (widget && selectedVersion) {
      onRestoreVersion(widget.id, selectedVersion)
      onClose()
    }
  }
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return format(date, 'PPP p') // e.g., "Apr 29, 2023, 1:30 PM"
    } catch {
      return 'Invalid date'
    }
  }
  
  const getTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return formatDistanceToNow(date, { addSuffix: true }) // e.g., "2 hours ago"
    } catch {
      return 'Unknown time'
    }
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
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <HistoryIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Version History</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {!widget ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            No widget selected
          </Alert>
        ) : (
          <>
            <Typography variant="subtitle1" gutterBottom>
              {widget.name}
            </Typography>
            
            {/* Current version indicator at the top */}
            <Box sx={{ 
              p: 2, 
              mb: 3, 
              borderRadius: 1, 
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(0, 100, 255, 0.1)' : 'rgba(230, 240, 255, 0.8)',
              border: '1px solid',
              borderColor: theme.palette.primary.main
            }}>
              <Typography variant="subtitle2" component="div" sx={{ display: 'flex', alignItems: 'center' }}>
                <HistoryIcon color="primary" sx={{ mr: 1 }} />
                Current Version: {widget.version || '1.0'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Last updated: {formatDate(widget.updatedAt || new Date().toISOString())}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {widget.components?.length || 0} components
              </Typography>
            </Box>
            
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {versions.length} version{versions.length !== 1 ? 's' : ''}
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            {versions.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                No version history available yet. Save changes to create versions.
              </Alert>
            ) : (
              <List sx={{ width: '100%' }}>
                {versions.map((version) => (
                  <React.Fragment key={version.id}>
                    <ListItem
                      button
                      selected={selectedVersion?.id === version.id}
                      onClick={() => handleSelectVersion(version)}
                      sx={{
                        borderRadius: 1,
                        '&.Mui-selected': {
                          backgroundColor: theme.palette.action.selected,
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover
                          }
                        }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="subtitle2">
                              Version {version.version}
                              {version.isCurrent && (
                                <Chip 
                                  size="small" 
                                  label="You are here" 
                                  color="primary" 
                                  variant="outlined"
                                  sx={{ ml: 1, fontWeight: 'normal', fontSize: '0.75rem' }}
                                />
                              )}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {getTimeAgo(version.createdAt)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {formatDate(version.createdAt)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {version.notes || 'No notes'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              {version.components.length} components
                            </Typography>
                          </>
                        }
                        secondaryTypographyProps={{ component: 'div' }}
                      />
                      {selectedVersion?.id === version.id && (
                        <Tooltip title="Restore this version">
                          <IconButton 
                            edge="end" 
                            onClick={handleRestoreVersion}
                            color="primary"
                          >
                            <RestoreIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </ListItem>
                    <Divider component="li" />
                  </React.Fragment>
                ))}
              </List>
            )}
            
            {selectedVersion && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Version Notes
                </Typography>
                <TextField
                  variant="outlined"
                  fullWidth
                  multiline
                  rows={3}
                  value={versionNotes}
                  onChange={(e) => setVersionNotes(e.target.value)}
                  placeholder="Add notes about this version restoration (optional)"
                  sx={{ mb: 2 }}
                />
                
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Restoring this version will overwrite your current widget. This action cannot be undone.
                </Alert>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {selectedVersion && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<RestoreIcon />}
            onClick={handleRestoreVersion}
          >
            Restore Version {selectedVersion.version}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default WidgetVersioningDialog 