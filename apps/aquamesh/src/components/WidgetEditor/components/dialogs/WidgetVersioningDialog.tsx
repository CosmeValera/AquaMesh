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
  Paper,
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
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import { CustomWidget } from '../../WidgetStorage'
import WidgetStorage, { WidgetVersion } from '../../WidgetStorage'
import { format, formatDistanceToNow } from 'date-fns'
import { alpha, lighten, darken } from '@mui/material/styles'
import MajorVersionDialog from './MajorVersionDialog'
import VersionWarningDialog from './VersionWarningDialog'
import useMediaQuery from '@mui/material/useMediaQuery'

interface WidgetVersioningDialogProps {
  open: boolean
  onClose: () => void
  widget: CustomWidget | null
  onRestoreVersion: (widgetId: string, version: WidgetVersion) => void
  onMajorVersionUpdate?: (widgetId: string) => void
  isLatestVersion?: boolean
}

// Define the component type for proper typing
interface ComponentData {
  id?: string
  type: string
  props: {
    text?: string | number | boolean;
    [key: string]: unknown;
  };
  children?: ComponentData[]
  [key: string]: unknown
}

const WidgetVersioningDialog: React.FC<WidgetVersioningDialogProps> = ({
  open,
  onClose,
  widget,
  onRestoreVersion,
  onMajorVersionUpdate,
  isLatestVersion = true
}) => {
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const [versions, setVersions] = useState<WidgetVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<WidgetVersion | null>(null)
  const [showMajorVersionDialog, setShowMajorVersionDialog] = useState(false)
  const [showVersionWarning, setShowVersionWarning] = useState(false)
  
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
      // Directly restore the version without confirmation dialog
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
      return theme.palette.primary.main // Keep primary for current
    }
    // More diverse and visually appealing colors for older versions
    const colors = [
      theme.palette.secondary.main,
      darken(theme.palette.info.main, 0.1),
      darken(theme.palette.success.main, 0.15),
      darken(theme.palette.warning.main, 0.1),
      darken(theme.palette.error.light, 0.1), // Using a lighter error and darkening it
      lighten(theme.palette.secondary.dark, 0.2),
    ]
    return colors[index % colors.length]
  }
  
  const handleMajorVersionButtonClick = () => {
    if (widget) {
      if (!isLatestVersion) {
        // If not on the latest version, show warning
        setShowVersionWarning(true)
      } else {
        // Otherwise proceed to major version dialog
        setShowMajorVersionDialog(true)
      }
    }
  }

  const handleMajorVersionConfirm = () => {
    if (widget && onMajorVersionUpdate) {
      onMajorVersionUpdate(widget.id)
      setShowMajorVersionDialog(false)
      onClose()
    }
  }

  const handleVersionWarningConfirm = () => {
    setShowVersionWarning(false)
    // After warning confirmation, proceed to major version dialog
    setShowMajorVersionDialog(true)
  }

  const getNextMajorVersion = () => {
    if (!widget || !widget.version) {
      return '2.0'
    }
    
    const versionParts = widget.version.split('.')
    if (versionParts.length >= 2) {
      const major = parseInt(versionParts[0], 10) + 1
      return `${major}.0`
    }
    
    return '2.0' // Default if parsing fails
  }
  
  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth={isPhone ? 'xs' : 'md'}
        fullWidth
        PaperProps={{
          elevation: 12,
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
          }
        }}
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
          color: theme.palette.primary.contrastText,
          p: isPhone ? '8px 16px' : '12px 24px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <HistoryIcon sx={{ mr: 1.5, fontSize: 26, color: 'white' }} />
            <Typography variant={isPhone ? 'subtitle1' : 'h6'} fontWeight="bold" color="white">Version History</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: isPhone ? 1 : 0, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
          {!widget ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                No widget selected
              </Alert>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: isPhone ? 'column' : 'row', height: isPhone ? 'auto' : '550px' }}>
              {/* Left panel - version list */}
              <Box sx={{ 
                width: isPhone ? '100%' : '340px', 
                borderRight: isPhone ? 'none' : '1px solid',
                borderBottom: isPhone ? '1px solid' : 'none',
                borderColor: theme.palette.divider,
                display: 'flex',
                flexDirection: 'column',
                bgcolor: alpha(theme.palette.background.paper, 0.7) // Slightly different bg for panel
              }}>
                <Box sx={{ 
                  p: '16px 20px', 
                  borderBottom: '1px solid',
                  borderColor: theme.palette.divider,
                  background: `linear-gradient(to bottom, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.primary.main, 0.03)})`,
                }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5, color: "#00C49A" }}>
                    {widget.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {versions.length} version{versions.length !== 1 ? 's' : ''} recorded
                  </Typography>
                </Box>
                
                <Box sx={{ flexGrow: 1, overflow: 'auto', p: '12px 8px 12px 20px' /* Adjusted padding */ }}>
                  {versions.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        No version history available yet. 
                        Save changes to create versions.
                      </Typography>
                    </Box>
                  ) : (
                    <Timeline position="right" sx={{ 
                      p: 0, m: 0,
                      '& .MuiTimelineItem-root:before': { flex: 0, padding: '0 8px' /* Spacing for timeline dot */}
                    }}>
                      {versions.map((version, index) => (
                        <TimelineItem key={version.id} sx={{ minHeight: 'auto' /* Compact items */ }}>
                          <TimelineSeparator>
                            <TimelineDot 
                              variant={version.isCurrent ? "filled" : "outlined"}
                              sx={{ 
                                borderColor: getVersionColor(index, !!version.isCurrent),
                                bgcolor: version.isCurrent 
                                  ? getVersionColor(index, !!version.isCurrent) 
                                  : 'transparent', // Use transparent background for non-current versions
                                boxShadow: version.isCurrent 
                                  ? `0 0 10px ${alpha(getVersionColor(index, !!version.isCurrent), 0.7)}` 
                                  : `0 0 6px ${alpha(getVersionColor(index, !!version.isCurrent), 0.9)}`, // Add shadow to non-current versions too
                                cursor: 'pointer',
                                p: 0.75,
                                borderWidth: 2.5, // Make border slightly thicker for better visibility
                                my: '8px', // Vertical margin for dot
                                // Add a subtle background for better contrast
                                '&:hover': {
                                  bgcolor: version.isCurrent 
                                    ? getVersionColor(index, !!version.isCurrent) 
                                    : alpha(getVersionColor(index, !!version.isCurrent), 0.1),
                                  boxShadow: `0 0 12px ${alpha(getVersionColor(index, !!version.isCurrent), 0.8)}`,
                                }
                              }}
                              onClick={() => handleSelectVersion(version)}
                            >
                              {version.isCurrent ? (
                                <CheckCircleIcon fontSize="small" sx={{color: theme.palette.common.white}} />
                              ) : (
                                <AccessTimeIcon fontSize="small" sx={{
                                  color: getVersionColor(index, !!version.isCurrent),
                                  // Make the icon slightly more visible
                                  filter: 'brightness(1.2)',
                                  stroke: getVersionColor(index, !!version.isCurrent),
                                  strokeWidth: 0.5
                                }}/>
                              )}
                            </TimelineDot>
                            {index < versions.length - 1 && (
                              <TimelineConnector sx={{ 
                                minHeight: 60, // Adjusted connector height
                                bgcolor: alpha(theme.palette.divider, 0.5)
                              }} />
                            )}
                          </TimelineSeparator>
                          <TimelineContent sx={{ py: '12px', px: 2 }}>
                            <Paper
                              elevation={selectedVersion?.id === version.id ? 8 : 1}
                              sx={{
                                p: '12px 16px',
                                borderRadius: 2,
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden',
                                border: `1px solid ${selectedVersion?.id === version.id ? alpha(theme.palette.primary.main, 0.5) : alpha(theme.palette.divider, 0.3)}`,
                                bgcolor: selectedVersion?.id === version.id 
                                  ? alpha(theme.palette.primary.main, 0.12)
                                  : alpha(theme.palette.background.paper, 0.9),
                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                ...(selectedVersion?.id !== version.id 
                                  ? { 
                                      '&:hover': {
                                        transform: 'translateY(-2px)',
                                        boxShadow: `0 6px 12px ${alpha(theme.palette.common.black, 0.1)}`,
                                        borderColor: alpha(theme.palette.primary.main, 0.4)
                                      }
                                    }
                                  : {}),
                                ...(selectedVersion?.id === version.id && {
                                  boxShadow: `0 5px 15px ${alpha(theme.palette.primary.main, 0.25)}`,
                                })
                              }}
                              onClick={() => handleSelectVersion(version)}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                                <Typography variant="subtitle1" fontWeight="bold" color={selectedVersion?.id === version.id ? theme.palette.primary.main : "text.primary"}>
                                  Version {version.version}
                                </Typography>
                                {version.isCurrent && (
                                  <Chip 
                                    size="small" 
                                    label="Current"
                                    color="primary"
                                    variant="filled"
                                    icon={<CheckCircleIcon sx={{fontSize: 14, ml: 0.5}}/>}
                                    sx={{ height: 22, fontWeight: 'bold', fontSize: '0.7rem', borderRadius: 1.5}}
                                  />
                                )}
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', mb: 1 }}>
                                <TodayIcon sx={{ fontSize: 14, mr: 0.75 }} />
                                <Typography variant="caption">
                                  {formatDate(version.createdAt)} ({getTimeAgo(version.createdAt)})
                                </Typography>
                              </Box>
                              {version.notes && version.notes !== 'No notes' && (
                                <Typography variant="body2" sx={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'text.secondary', mb: 1.5}}>
                                  {version.notes}
                                </Typography>
                              )}
                              <Chip
                                size="small"
                                label={`${version.components.length} components`}
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.7rem', borderColor: alpha(theme.palette.divider, 0.6), color: 'text.secondary' }}
                              />
                              {!version.isCurrent && selectedVersion?.id === version.id && (
                                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-start' }}>
                                  <Button
                          variant="contained"
                          startIcon={<RestoreIcon />}
                          onClick={handleRestoreVersion}
                          sx={{
                            borderRadius: 2, textTransform: 'none', fontWeight: 'bold', px: 3, py: 1.2,
                            background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${darken(theme.palette.primary.main, 0.2)} 90%)`,
                            boxShadow: `0 4px 15px ${alpha(theme.palette.primary.main, 0.25)}`,
                            '&:hover': {
                              background: `linear-gradient(45deg, ${darken(theme.palette.primary.main, 0.1)} 30%, ${darken(theme.palette.primary.main, 0.3)} 90%)`,
                              boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.35)}`
                            }
                          }}
                        >
                          Restore This Version
                        </Button>
                                </Box>
                              )}
                            </Paper>
                          </TimelineContent>
                        </TimelineItem>
                      ))}
                    </Timeline>
                  )}
                </Box>
              </Box>
              
              {/* Right panel - version details */}
              <Box sx={{ flexGrow: 1, p: isPhone ? '16px' : '24px', display: 'flex', flexDirection: 'column', bgcolor: theme.palette.background.default }}>
                {selectedVersion ? (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                      <Box>
                        <Typography variant="h5" fontWeight="bold" color="#00C49A">
                          Version {selectedVersion.version}
                          {selectedVersion.isCurrent && (
                            <Chip size="small" label="Current Version" color="primary" variant="filled" sx={{ ml: 1.5, fontWeight: 'bold', fontSize: '0.75rem' }}/>
                          )}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          Created: {formatDate(selectedVersion.createdAt)}
                        </Typography>
                      </Box>
                      {!selectedVersion.isCurrent && (
                        <Button
                          variant="contained"
                          startIcon={<RestoreIcon />}
                          onClick={handleRestoreVersion}
                          sx={{
                            borderRadius: 2, textTransform: 'none', fontWeight: 'bold', px: 3, py: 1.2,
                            background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${darken(theme.palette.primary.main, 0.2)} 90%)`,
                            boxShadow: `0 4px 15px ${alpha(theme.palette.primary.main, 0.25)}`,
                            '&:hover': {
                              background: `linear-gradient(45deg, ${darken(theme.palette.primary.main, 0.1)} 30%, ${darken(theme.palette.primary.main, 0.3)} 90%)`,
                              boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.35)}`
                            }
                          }}
                        >
                          Restore This Version
                        </Button>
                      )}
                    </Box>
                    <Typography variant="h6" fontWeight="medium" sx={{mb: 1.5, color: theme.palette.text.primary}}>
                      Component Summary
                    </Typography>
                    <Paper variant="outlined" sx={{ 
                        p: '16px 20px', borderRadius: 2.5, 
                        bgcolor: alpha(theme.palette.background.paper, 0.9),
                        border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                        mb: 3, flexGrow: 1, overflow: 'auto' 
                      }}>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="text.primary">
                        {selectedVersion.components.length} component{selectedVersion.components.length !== 1 ? 's' : ''}
                      </Typography>
                      {selectedVersion.components.length > 0 ? (
                        <Box component="ul" sx={{ pl: 2.5, m: 0, maxHeight: '220px', overflowY: 'auto' }}>
                          {(selectedVersion.components as ComponentData[]).map((component: ComponentData, index: number) => (
                            <Box component="li" key={component.id || index} sx={{ mb: 0.75, color: theme.palette.text.secondary }}>
                              <Typography variant="body1">
                                <Box component="span" sx={{fontWeight: 'medium', color: theme.palette.text.primary}}>{component.type}</Box>
                                {component.props?.text !== undefined && (
                                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                                    ({String(component.props.text).substring(0,50)}{String(component.props.text).length > 50 ? '...':''})
                                  </Typography>
                                )}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary" fontStyle="italic" sx={{mt:1}}>
                          This version is an empty widget.
                        </Typography>
                      )}
                    </Paper>
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
                        <Typography variant="subtitle2" gutterBottom fontWeight="medium">
                          Component Count Comparison
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
                    <HistoryIcon sx={{ fontSize: 70, color: alpha(theme.palette.text.secondary, 0.5), mb: 2.5 }} />
                    <Typography variant="h5" color="text.secondary" gutterBottom sx={{fontWeight: 500}}>
                      Select a version to view details
                    </Typography>
                    <Typography variant="body1" color={alpha(theme.palette.text.secondary, 0.8)} align="center" sx={{ maxWidth: 420 }}>
                      Each version contains a snapshot of your widget configuration. You can browse and restore any previous version if needed.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: isPhone ? 1 : 3, py: isPhone ? 1 : 2, bgcolor: alpha(theme.palette.background.paper,0.9), borderTop: '1px solid', borderColor: theme.palette.divider }}>
          <Button
            onClick={onClose}
            variant="outlined"
            sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 'medium', px: isPhone ? 2 : 3, py: isPhone ? 1 : 0.8, borderColor: alpha(theme.palette.primary.main, 0.7), color: theme.palette.primary.main, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08), borderColor: theme.palette.primary.main } }}
          >
            Close
          </Button>
          {widget && onMajorVersionUpdate && (
            <Button
              variant="contained"
              startIcon={<ArrowUpwardIcon />}
              onClick={handleMajorVersionButtonClick}
              sx={{
                ml: 1.5, borderRadius: 1.5, textTransform: 'none', fontWeight: 'bold', px: 2.5, py: 1,
                background: `linear-gradient(45deg, ${theme.palette.secondary.main} 30%, ${darken(theme.palette.secondary.main, 0.2)} 90%)`,
                boxShadow: `0 4px 15px ${alpha(theme.palette.secondary.main, 0.25)}`,
                '&:hover': {
                  background: `linear-gradient(45deg, ${darken(theme.palette.secondary.main, 0.1)} 30%, ${darken(theme.palette.secondary.main, 0.3)} 90%)`,
                  boxShadow: `0 6px 20px ${alpha(theme.palette.secondary.main, 0.35)}`
                }
              }}
            >
              Major Version Update
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
      <MajorVersionDialog
        open={showMajorVersionDialog}
        onConfirm={handleMajorVersionConfirm}
        onCancel={() => setShowMajorVersionDialog(false)}
        currentVersion={widget?.version || '1.0'}
        nextMajorVersion={getNextMajorVersion()}
      />
      
      <VersionWarningDialog
        open={showVersionWarning}
        onConfirm={handleVersionWarningConfirm}
        onCancel={() => setShowVersionWarning(false)}
        version={widget?.version || '1.0'}
      />
    </>
  )
}

export default WidgetVersioningDialog 