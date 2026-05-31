import React from 'react'
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import DeleteIcon from '@mui/icons-material/Delete'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import BoltIcon from '@mui/icons-material/Bolt'
import {
  getPersistentSourceLabel,
  PersistentSource,
} from '../../studyPack/persistentSources'

interface CreationPanelTabsProps {
  creationActiveSection: 'dashboard' | 'sources' | 'study-path'
  setCreationActiveSection: (section: 'dashboard' | 'sources' | 'study-path') => void
  // Study Path content (passed as render prop to avoid moving 1400+ lines)
  studyPathContent: React.ReactNode
  // Quick options state
  quickOptionsOpen: boolean
  onOpenQuickOptions: () => void
  onCloseQuickOptions: () => void
  // Sources state
  persistentSources: PersistentSource[]
  persistentSourceTextDraft: string
  onPersistentSourceTextChange: (text: string) => void
  onAddPersistentSourceText: () => void
  onRemovePersistentSource: (id: string) => void
  onClearAllPersistentSources: () => void
  // Quick create from dashboard
  onQuickCreateFromDashboard: () => void
}

export const CreationPanelTabs: React.FC<CreationPanelTabsProps> = ({
  creationActiveSection,
  setCreationActiveSection,
  studyPathContent,
  quickOptionsOpen,
  onOpenQuickOptions,
  onCloseQuickOptions,
  persistentSources,
  persistentSourceTextDraft,
  onPersistentSourceTextChange,
  onAddPersistentSourceText,
  onRemovePersistentSource,
  onClearAllPersistentSources,
  onQuickCreateFromDashboard,
}) => {
  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Tab bar */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 0.5,
          p: 0.75,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        {([
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'sources', label: 'Sources' },
          { key: 'study-path', label: 'Study Path' },
        ] as const).map((item) => (
          <Button
            key={item.key}
            size="small"
            variant={creationActiveSection === item.key ? 'contained' : 'outlined'}
            onClick={() => setCreationActiveSection(item.key)}
            sx={{
              minWidth: 0,
              px: 1,
              borderRadius: 1.5,
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.75rem',
            }}
          >
            {item.label}
          </Button>
        ))}
      </Box>

      {/* Tab content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 2, sm: 2.5 }, pb: { xs: 10, sm: 2.5 } }}>
        <Stack spacing={2.5}>
          {/* Study Path tab */}
          {creationActiveSection === 'study-path' && studyPathContent}

          {/* Dashboard tab */}
          {creationActiveSection === 'dashboard' && (
            <Paper
              component="button"
              type="button"
              onClick={onQuickCreateFromDashboard}
              elevation={0}
              sx={{
                width: '100%',
                p: { xs: 2, sm: 2.25 },
                textAlign: 'left',
                borderRadius: 3,
                border: 1,
                borderColor: alpha('#000', 0.12),
                bgcolor: alpha('#000', 0.025),
                color: 'text.primary',
                cursor: 'pointer',
                display: 'block',
                boxShadow: `0 2px 8px ${alpha('#000', 0.08)}`,
                '&:hover': {
                  borderColor: 'secondary.main',
                  bgcolor: alpha('#000', 0.04),
                  transform: 'translateY(-1px)',
                },
                transition: 'background-color 160ms ease, border-color 160ms ease, transform 160ms ease',
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 38, height: 38, borderRadius: 1.75, display: 'grid', placeItems: 'center', bgcolor: alpha('#000', 0.08) }}>
                    <AutoAwesomeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={900}>
                      Quick Create
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Generate from current dashboard
                    </Typography>
                  </Box>
                </Stack>
                <ChevronRightIcon color="action" />
              </Stack>
            </Paper>
          )}

          {/* Sources tab */}
          {creationActiveSection === 'sources' && (
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight={900}>
                Persistent Sources
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Add text, images, PDFs, or slides.
              </Typography>
              <TextField
                label="Add text source"
                value={persistentSourceTextDraft}
                onChange={(e) => onPersistentSourceTextChange(e.target.value)}
                placeholder="Paste content here..."
                multiline
                minRows={3}
                fullWidth
              />
              <Button
                variant="contained"
                onClick={onAddPersistentSourceText}
                disabled={!persistentSourceTextDraft.trim()}
              >
                Add text
              </Button>
              {persistentSources.length > 0 && (
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" fontWeight={900}>
                      {persistentSources.length} source{persistentSources.length !== 1 ? 's' : ''}
                    </Typography>
                    <Button size="small" color="error" onClick={onClearAllPersistentSources}>
                      Clear all
                    </Button>
                  </Stack>
                  {persistentSources.map((source) => (
                    <Paper key={source.id} elevation={0} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {getPersistentSourceLabel(source)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {source.type}
                          </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => onRemovePersistentSource(source.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          )}
        </Stack>
      </Box>
    </Box>
  )
}
