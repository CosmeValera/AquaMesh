import React, { useCallback, useEffect, useState } from 'react'
import {
  Box,
  Fab,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMediaQuery } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { Dialog, DialogTitle, DialogContent, Button } from '@mui/material'
import {
  DashboardHighlightsStorage,
  DashboardHighlight,
  DEFAULT_HIGHLIGHT_COLOR,
  HighlightColor,
  HIGHLIGHT_COLORS,
} from './dashboardHighlights'

interface HighlightControlsProps {
  dashboardId: string
}

export const HighlightControls: React.FC<HighlightControlsProps> = ({
  dashboardId,
}) => {
  const isMobile = useMediaQuery('(max-width:600px)')
  const [selectedText, setSelectedText] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [color, setColor] = useState<HighlightColor>(DEFAULT_HIGHLIGHT_COLOR)
  const [highlights, setHighlights] = useState<DashboardHighlight[]>([])

  // Load highlights
  useEffect(() => {
    setHighlights(DashboardHighlightsStorage.getByDashboard(dashboardId))
  }, [dashboardId])

  // Selection detection
  useEffect(() => {
    const updateSelection = () => {
      const selection = window.getSelection()
      if (selection && !selection.isCollapsed && selection.toString().trim()) {
        setSelectedText(selection.toString().trim())
      }
    }
    
    document.addEventListener('selectionchange', updateSelection)
    document.addEventListener('mouseup', updateSelection)
    const handleTouchEnd = () => setTimeout(updateSelection, 500)
    document.addEventListener('touchend', handleTouchEnd)
    
    return () => {
      document.removeEventListener('selectionchange', updateSelection)
      document.removeEventListener('mouseup', updateSelection)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  const handleSaveHighlight = useCallback(() => {
    if (!selectedText.trim()) return
    
    DashboardHighlightsStorage.add({
      dashboardId,
      widgetId: 'manual',
      blockType: 'text',
      selectedText: selectedText.trim(),
      color,
      note: noteText.trim() || undefined,
    })
    
    setHighlights(DashboardHighlightsStorage.getByDashboard(dashboardId))
    setCreateOpen(false)
    setNoteText('')
    setSelectedText('')
    window.getSelection()?.removeAllRanges()
  }, [dashboardId, selectedText, color, noteText])

  const handleQuickHighlight = useCallback((c: HighlightColor) => {
    if (!selectedText.trim()) return
    
    DashboardHighlightsStorage.add({
      dashboardId,
      widgetId: 'manual',
      blockType: 'text',
      selectedText: selectedText.trim(),
      color: c,
    })
    
    setHighlights(DashboardHighlightsStorage.getByDashboard(dashboardId))
    setSelectedText('')
    window.getSelection()?.removeAllRanges()
  }, [dashboardId, selectedText])

  if (!isMobile) return null

  return (
    <>
      {/* Floating Action Button - ALWAYS VISIBLE */}
      <Fab
        color="secondary"
        onClick={() => setCreateOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          bgcolor: 'primary.main',
          '&:hover': { bgcolor: 'primary.dark' },
        }}
      >
        <AddIcon />
      </Fab>

      {/* Bottom Toolbar - ALWAYS VISIBLE */}
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          p: 2,
          pb: 'calc(2rem + env(safe-area-inset-bottom))',
          zIndex: 9998,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
          <Typography variant="caption" fontWeight={900} color="text.secondary">
            Highlight:
          </Typography>
          {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((c) => (
            <Tooltip key={c} title={HIGHLIGHT_COLORS[c].label}>
              <IconButton
                onClick={() => handleQuickHighlight(c)}
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: HIGHLIGHT_COLORS[c].bg,
                  border: '2px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              />
            </Tooltip>
          ))}
        </Stack>
        
        {selectedText && (
          <Box sx={{ mt: 1.5, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              "{selectedText.slice(0, 40)}{selectedText.length > 40 ? '...' : ''}"
            </Typography>
          </Box>
        )}
        
        {highlights.length > 0 && (
          <Box sx={{ mt: 1.5, textAlign: 'center' }}>
            <Typography variant="caption" color="primary">
              {highlights.length} highlight{highlights.length !== 1 ? 's' : ''} saved
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullScreen
        maxWidth="sm"
      >
        <DialogTitle>Create Highlight</DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            {selectedText && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: HIGHLIGHT_COLORS[color].bg,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body1">
                  {selectedText}
                </Typography>
              </Paper>
            )}

            <Typography variant="h6" fontWeight={900}>
              Choose Color
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((c) => (
                <Tooltip key={c} title={HIGHLIGHT_COLORS[c].label}>
                  <IconButton
                    onClick={() => setColor(c)}
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: HIGHLIGHT_COLORS[c].bg,
                      border: color === c ? '3px solid' : '2px solid',
                      borderColor: color === c ? 'primary.main' : 'divider',
                      borderRadius: 2,
                    }}
                  />
                </Tooltip>
              ))}
            </Stack>

            <TextField
              label="Add a note (optional)"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Why is this important?"
              multiline
              minRows={3}
              fullWidth
            />

            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                fullWidth
                onClick={handleSaveHighlight}
                disabled={!selectedText.trim()}
              >
                Save Highlight
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  )
}
