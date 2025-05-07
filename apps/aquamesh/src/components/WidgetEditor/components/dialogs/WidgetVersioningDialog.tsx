import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  useTheme,
  Chip,
  Paper
} from '@mui/material'
import Timeline from '@mui/lab/Timeline'
import TimelineItem from '@mui/lab/TimelineItem'
import TimelineSeparator from '@mui/lab/TimelineSeparator'
import TimelineConnector from '@mui/lab/TimelineConnector'
import TimelineContent from '@mui/lab/TimelineContent'
import TimelineDot from '@mui/lab/TimelineDot'
import RestoreIcon from '@mui/icons-material/Restore'
import HistoryIcon from '@mui/icons-material/History'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import TodayIcon from '@mui/icons-material/Today'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import { CustomWidget } from '../../WidgetStorage'
import WidgetStorage, { WidgetVersion } from '../../WidgetStorage'
import { format, formatDistanceToNow } from 'date-fns'
import { alpha } from '@mui/material/styles'

interface WidgetVersioningDialogProps {
  open: boolean
  onClose: () => void
  widget: CustomWidget | null
  onRestoreVersion: (widgetId: string, version: WidgetVersion) => void
}

// Define the component type for proper typing
interface ComponentData {
  id?: string
  type: string
  props: Record<string, unknown>
  children?: ComponentData[]
  [key: string]: unknown
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

  const getVersionColor = (index: number, isCurrent: boolean) => {
    if (isCurrent) {
      return theme.palette.primary.main
    }
    
    // Generate colors based on index for non-current versions
    const colors = [
      theme.palette.secondary.main,
      theme.palette.success.main,
      theme.palette.info.main,
      theme.palette.warning.main,
    ]
    
    return colors[index % colors.length]
  }
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        elevation: 8,
        sx: {
          borderRadius: 2,
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ 
        bgcolor: theme.palette.primary.main, 
        color: theme.palette.primary.contrastText,
        p: 3
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <HistoryIcon sx={{ mr: 1.5, fontSize: 28 }} />
          <Typography variant="h5" fontWeight="bold">Version History</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        {!widget ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No widget selected
            </Alert>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', height: '500px' }}>
            {/* Left panel - version list */}
            <Box sx={{ 
              width: '320px', 
              borderRight: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Box sx={{ 
                p: 2, 
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)'
              }}>
                <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 0.5 }}>
                  {widget.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {versions.length} version{versions.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
              
              <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {versions.length === 0 ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No version history available yet. 
                      Save changes to create versions.
                    </Typography>
                  </Box>
                ) : (
                  <Timeline position="right" sx={{ 
                    p: 0, 
                    m: 0,
                    '& .MuiTimelineItem-root:before': {
                      flex: 0,
                      padding: 0
                    }
                  }}>
                    {versions.map((version, index) => (
                      <TimelineItem key={version.id}>
                        <TimelineSeparator>
                          <TimelineDot 
                            sx={{ 
                              bgcolor: getVersionColor(index, !!version.isCurrent),
                              boxShadow: version.isCurrent ? 4 : 1,
                              cursor: 'pointer',
                              p: version.isCurrent ? 1 : 0.5
                            }}
                            onClick={() => handleSelectVersion(version)}
                          >
                            {version.isCurrent ? (
                              <CheckCircleIcon fontSize="small" />
                            ) : (
                              <AccessTimeIcon fontSize="small" />
                            )}
                          </TimelineDot>
                          {index < versions.length - 1 && (
                            <TimelineConnector sx={{ 
                              minHeight: 50,
                              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                            }} />
                          )}
                        </TimelineSeparator>
                        <TimelineContent sx={{ py: 0, px: 2 }}>
                          <Paper
                            elevation={selectedVersion?.id === version.id ? 3 : 0}
                            sx={{ 
                              p: 2, 
                              borderRadius: 2,
                              cursor: 'pointer',
                              bgcolor: selectedVersion?.id === version.id 
                                ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.05)
                                : theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'background.paper',
                              border: '1px solid',
                              borderColor: selectedVersion?.id === version.id 
                                ? alpha(theme.palette.primary.main, 0.3)
                                : 'divider',
                              transition: 'all 0.2s',
                              '&:hover': {
                                bgcolor: selectedVersion?.id !== version.id 
                                  ? alpha(theme.palette.action.selected, 0.15)
                                  : alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.08)
                              }
                            }}
                            onClick={() => handleSelectVersion(version)}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <Typography variant="subtitle2">
                                Version {version.version}
                              </Typography>
                              <Box>
                                {version.isCurrent && (
                                  <Chip 
                                    size="small" 
                                    label="Current" 
                                    color="primary" 
                                    variant="filled"
                                    sx={{ 
                                      height: 20, 
                                      fontWeight: 'medium', 
                                      fontSize: '0.7rem',
                                      mb: 0.5
                                    }}
                                  />
                                )}
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, mb: 1 }}>
                              <TodayIcon sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(version.createdAt)}
                              </Typography>
                            </Box>
                            <Typography 
                              variant="body2" 
                              color="text.secondary"
                              sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                mb: 1,
                                fontSize: '0.8rem',
                                fontStyle: 'italic'
                              }}
                            >
                              {version.notes || 'No notes'}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Chip
                                size="small"
                                label={`${version.components.length} components`}
                                variant="outlined"
                                sx={{ 
                                  height: 20, 
                                  fontSize: '0.7rem',
                                  bgcolor: alpha(theme.palette.primary.main, 0.05)
                                }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {getTimeAgo(version.createdAt)}
                              </Typography>
                            </Box>
                          </Paper>
                        </TimelineContent>
                      </TimelineItem>
                    ))}
                  </Timeline>
                )}
              </Box>
            </Box>
            
            {/* Right panel - version details */}
            <Box sx={{ 
              flexGrow: 1, 
              p: 3,
              display: 'flex',
              flexDirection: 'column'
            }}>
              {selectedVersion ? (
                <>
                  <Box sx={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start', 
                    mb: 3
                  }}>
                    <Box>
                      <Typography variant="h6" fontWeight="medium">
                        Version {selectedVersion.version}
                        {selectedVersion.isCurrent && (
                          <Chip 
                            size="small" 
                            label="Current Version" 
                            color="primary" 
                            sx={{ ml: 1.5, fontWeight: 'medium' }}
                          />
                        )}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Created {formatDate(selectedVersion.createdAt)}
                      </Typography>
                    </Box>
                    
                    {!selectedVersion.isCurrent && (
                      <Button
                        variant="contained"
                        startIcon={<RestoreIcon />}
                        onClick={handleRestoreVersion}
                        color="primary"
                        sx={{ 
                          borderRadius: 2,
                          textTransform: 'none',
                          boxShadow: 2
                        }}
                      >
                        Restore This Version
                      </Button>
                    )}
                  </Box>
                  
                  <Paper
                    variant="outlined"
                    sx={{ 
                      p: 3, 
                      mb: 3, 
                      borderRadius: 2,
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)'
                    }}
                  >
                    <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                      Version Notes
                    </Typography>
                    {selectedVersion.notes ? (
                      <Typography variant="body1">
                        {selectedVersion.notes}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                        No notes available for this version
                      </Typography>
                    )}
                  </Paper>
                  
                  <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                    Component Summary
                  </Typography>
                  
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 2, 
                      borderRadius: 2,
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)',
                      mb: 3,
                      flexGrow: 1,
                      overflow: 'auto'
                    }}
                  >
                    <Typography variant="body2" fontWeight="medium" gutterBottom>
                      {selectedVersion.components.length} component{selectedVersion.components.length !== 1 ? 's' : ''}
                    </Typography>
                    
                    {selectedVersion.components.length > 0 ? (
                      <Box component="ul" sx={{ 
                        pl: 2, 
                        m: 0,
                        maxHeight: '200px',
                        overflow: 'auto' 
                      }}>
                        {selectedVersion.components.map((component: ComponentData, index: number) => (
                          <Box component="li" key={component.id || index} sx={{ mb: 0.5 }}>
                            <Typography variant="body2">
                              {component.type}
                              {component.props?.text && (
                                <Typography 
                                  component="span" 
                                  variant="body2" 
                                  color="text.secondary"
                                  sx={{ ml: 1 }}
                                >
                                  ({component.props.text})
                                </Typography>
                              )}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                        Empty widget with no components
                      </Typography>
                    )}
                  </Paper>
                  
                  {/* Component count comparison */}
                  {selectedVersion && !selectedVersion.isCurrent && widget && (
                    <Paper
                      variant="outlined"
                      sx={{ 
                        p: 2, 
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.info.main, 0.05),
                        border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`
                      }}
                    >
                      <Typography variant="subtitle2" gutterBottom>
                        Compare with current version
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h6" color="primary" fontWeight="bold">
                            {selectedVersion.components.length}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Selected Version
                          </Typography>
                        </Box>
                        <Box sx={{ 
                          width: 80, 
                          height: 2, 
                          bgcolor: 'divider',
                          position: 'relative',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: -4,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: theme.palette.primary.main
                          },
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            top: -4,
                            right: 0,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: theme.palette.secondary.main
                          }
                        }} />
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h6" color="secondary" fontWeight="bold">
                            {widget.components.length}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Current Version
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  )}
                </>
              ) : (
                <Box sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  justifyContent: 'center', 
                  alignItems: 'center',
                  opacity: 0.7
                }}>
                  <HistoryIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Select a version to view details
                  </Typography>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 400 }}>
                    Each version contains a snapshot of your widget configuration at the time it was saved.
                    You can restore any previous version if needed.
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.02)', borderTop: '1px solid', borderColor: 'divider' }}>
        <Button 
          onClick={onClose}
          variant="outlined" 
          sx={{ borderRadius: 1.5 }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default WidgetVersioningDialog 