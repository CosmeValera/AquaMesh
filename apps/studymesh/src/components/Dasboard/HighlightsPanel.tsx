import React, { useCallback, useEffect, useState } from 'react'
import { useMediaQuery } from '@mui/material'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import {
  DashboardHighlight,
  DashboardHighlightsStorage,
  DEFAULT_HIGHLIGHT_COLOR,
  HighlightColor,
  HIGHLIGHT_COLORS,
  HighlightLink,
} from './dashboardHighlights'
import { HighlightToolbar, useHighlightSelection } from './HighlightToolbar'
import { SavedDashboard, DashboardStorage } from './dashboardStorage'

interface HighlightsPanelProps {
  dashboardId: string
}

interface CreateHighlightDialogProps {
  open: boolean
  selectedText: string
  onClose: () => void
  onSave: (color: HighlightColor, note?: string) => void
  isMobile?: boolean
}

const CreateHighlightDialog: React.FC<CreateHighlightDialogProps> = ({
  open,
  selectedText,
  onClose,
  onSave,
  isMobile,
}) => {
  const [color, setColor] = useState<HighlightColor>(DEFAULT_HIGHLIGHT_COLOR)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setColor(DEFAULT_HIGHLIGHT_COLOR)
      setNote('')
    }
  }, [open])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle>Create Highlight</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {selectedText && (
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                bgcolor: HIGHLIGHT_COLORS[color].bg,
                borderRadius: 1,
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="body2">{selectedText}</Typography>
            </Paper>
          )}
          
          <Box>
            <Typography variant="subtitle2" fontWeight={900} gutterBottom>
              Highlight Color
            </Typography>
            <Stack direction="row" spacing={1}>
              {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((c) => (
                <Tooltip key={c} title={HIGHLIGHT_COLORS[c].label}>
                  <IconButton
                    onClick={() => setColor(c)}
                    sx={{
                      width: 36,
                      height: 36,
                      bgcolor: HIGHLIGHT_COLORS[c].bg,
                      border: color === c ? '3px solid' : '2px solid transparent',
                      borderColor: color === c ? 'primary.main' : 'divider',
                    }}
                  />
                </Tooltip>
              ))}
            </Stack>
          </Box>

          <TextField
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note to remember why this is important..."
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <Box sx={{ p: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(color, note)}>
          Highlight
        </Button>
      </Box>
    </Dialog>
  )
}

interface EditHighlightDialogProps {
  open: boolean
  highlight: DashboardHighlight | null
  dashboards: SavedDashboard[]
  onClose: () => void
  onSave: (updates: { note?: string; link?: HighlightLink; color?: HighlightColor }) => void
  onDelete: () => void
  isMobile?: boolean
}

const EditHighlightDialog: React.FC<EditHighlightDialogProps> = ({
  open,
  highlight,
  dashboards,
  onClose,
  onSave,
  onDelete,
  isMobile,
}) => {
  const [note, setNote] = useState('')
  const [link, setLink] = useState<HighlightLink | undefined>(undefined)

  useEffect(() => {
    if (highlight && open) {
      setNote(highlight.note || '')
      setLink(highlight.link)
    }
  }, [highlight, open])

  if (!highlight) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Edit Highlight
        <IconButton onClick={onDelete} color="error" size="small">
          <DeleteIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              bgcolor: HIGHLIGHT_COLORS[highlight.color].bg,
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2">{highlight.selectedText}</Typography>
          </Paper>

          <TextField
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note..."
            multiline
            minRows={2}
            fullWidth
          />

          <Box>
            <Typography variant="subtitle2" fontWeight={900} gutterBottom>
              Link to (optional)
            </Typography>
            {link ? (
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  border: 1,
                  borderColor: 'primary.main',
                  borderRadius: 1,
                  bgcolor: 'primary.50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography variant="body2">
                  🔗 {link.type === 'study-path' ? '📚' : '📊'} {link.targetLabel}
                </Typography>
                <Button size="small" onClick={() => setLink(undefined)}>
                  Remove
                </Button>
              </Paper>
            ) : (
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  Link this highlight to a Dashboard or Study Path
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {dashboards.slice(0, 3).map((d) => (
                    <Button
                      key={d.id}
                      size="small"
                      variant="outlined"
                      onClick={() => setLink({
                        type: 'dashboard',
                        targetId: d.id,
                        targetLabel: d.name,
                      })}
                    >
                      📊 {d.name}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <Box sx={{ p: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave({ note, link })}>
          Save
        </Button>
      </Box>
    </Dialog>
  )
}

export const HighlightsPanel: React.FC<HighlightsPanelProps> = ({
  dashboardId,
}) => {
  const [highlights, setHighlights] = useState<DashboardHighlight[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editHighlight, setEditHighlight] = useState<DashboardHighlight | null>(null)
  const [dashboards, setDashboards] = useState<SavedDashboard[]>([])
  const [showSelectionTip, setShowSelectionTip] = useState(false)
  const isMobile = useMediaQuery('(max-width:600px)')

  const { selectedText, clearSelection } = useHighlightSelection(() => {
    setShowSelectionTip(false)
  })

  const loadHighlights = useCallback(() => {
    setHighlights(DashboardHighlightsStorage.getByDashboard(dashboardId))
  }, [dashboardId])

  useEffect(() => {
    loadHighlights()
    setDashboards(DashboardStorage.getAll())

    const handleChange = (e: CustomEvent) => {
      if (e.detail.dashboardId === dashboardId) {
        loadHighlights()
      }
    }
    window.addEventListener('studymesh-highlights-changed', handleChange as EventListener)
    return () => {
      window.removeEventListener('studymesh-highlights-changed', handleChange as EventListener)
    }
  }, [dashboardId, loadHighlights])

  const handleCreateHighlight = useCallback((color: HighlightColor, note?: string) => {
    if (!selectedText.trim()) return

    DashboardHighlightsStorage.add({
      dashboardId,
      widgetId: 'manual',
      blockType: 'text',
      selectedText: selectedText.trim(),
      color,
      note,
    })
    loadHighlights()
    setCreateOpen(false)
    clearSelection()
  }, [dashboardId, selectedText, loadHighlights, clearSelection])

  const handleQuickHighlight = useCallback((color: HighlightColor) => {
    if (!selectedText.trim()) return

    DashboardHighlightsStorage.add({
      dashboardId,
      widgetId: 'manual',
      blockType: 'text',
      selectedText: selectedText.trim(),
      color,
    })
    loadHighlights()
    clearSelection()
  }, [dashboardId, selectedText, loadHighlights, clearSelection])

  const handleUpdateHighlight = useCallback((updates: { note?: string; link?: HighlightLink; color?: HighlightColor }) => {
    if (!editHighlight) return
    DashboardHighlightsStorage.update(editHighlight.id, updates)
    loadHighlights()
    setEditHighlight(null)
  }, [editHighlight, loadHighlights])

  const handleDeleteHighlight = useCallback(() => {
    if (!editHighlight) return
    DashboardHighlightsStorage.delete(editHighlight.id)
    loadHighlights()
    setEditHighlight(null)
  }, [editHighlight, loadHighlights])

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight={900}>
          Highlights
        </Typography>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            if (selectedText) {
              setCreateOpen(true)
            } else {
              setShowSelectionTip(true)
            }
          }}
        >
          Add Highlight
        </Button>
      </Box>

      {showSelectionTip && (
        <Alert severity="warning" onClose={() => setShowSelectionTip(false)} sx={{ py: 0.5 }}>
          👆 Select some text on the dashboard first, then tap Add Highlight
        </Alert>
      )}

      {highlights.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            textAlign: 'center',
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Typography color="text.secondary">
            No highlights yet. Select text and click "Add Highlight".
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1}>
          {highlights.map((h) => (
            <Paper
              key={h.id}
              elevation={0}
              sx={{
                bgcolor: HIGHLIGHT_COLORS[h.color].bg,
                borderRadius: 1,
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <ListItemText
                  primary={h.selectedText}
                  secondary={
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      {h.note && (
                        <Typography variant="caption" color="text.secondary">
                          📝 {h.note.slice(0, 30)}{h.note.length > 30 ? '...' : ''}
                        </Typography>
                      )}
                      {h.link && (
                        <Typography variant="caption" color="primary">
                          🔗 {h.link.targetLabel}
                        </Typography>
                      )}
                    </Stack>
                  }
                  primaryTypographyProps={{ fontWeight: 700 }}
                />
                <IconButton size="small" onClick={() => setEditHighlight(h)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Mobile toolbar when text selected */}
      {isMobile && selectedText && (
        <HighlightToolbar
          onHighlight={handleQuickHighlight}
          onClose={clearSelection}
        />
      )}

      <CreateHighlightDialog
        open={createOpen}
        selectedText={selectedText}
        onClose={() => {
          setCreateOpen(false)
          clearSelection()
        }}
        onSave={handleCreateHighlight}
        isMobile={isMobile}
      />

      <EditHighlightDialog
        open={!!editHighlight}
        highlight={editHighlight}
        dashboards={dashboards}
        onClose={() => setEditHighlight(null)}
        onSave={handleUpdateHighlight}
        onDelete={handleDeleteHighlight}
        isMobile={isMobile}
      />
    </Stack>
  )
}

export default HighlightsPanel
