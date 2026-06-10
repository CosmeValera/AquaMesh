import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PushPinIcon from '@mui/icons-material/PushPin'
import { nanoid } from 'nanoid'
import { useNavigate } from 'react-router-dom'

import type { StudyGuideRecord } from '../../cloud/types'
import {
  STUDY_GUIDES_CHANGED_EVENT,
  StudyGuideStorage,
} from '../../studyGuides/storage'
import ThemeModeToggle from '../shared/ThemeModeToggle'
import StudyCreditsPill from '../hostedAi/StudyCreditsPill'

const formatGuideDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const sortGuides = (guides: StudyGuideRecord[]) =>
  [...guides].sort((first, second) => {
    const firstPinned = first.pinnedAt ? Date.parse(first.pinnedAt) : 0
    const secondPinned = second.pinnedAt ? Date.parse(second.pinnedAt) : 0
    if (firstPinned || secondPinned) {
      return secondPinned - firstPinned
    }

    return Date.parse(second.createdAt) - Date.parse(first.createdAt)
  })

const StudyGuidesPage = () => {
  const navigate = useNavigate()
  const [guides, setGuides] = useState<StudyGuideRecord[]>([])
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [menuGuide, setMenuGuide] = useState<StudyGuideRecord | null>(null)
  const [renameGuide, setRenameGuide] = useState<StudyGuideRecord | null>(null)
  const [renameTitle, setRenameTitle] = useState('')

  const loadGuides = () => setGuides(StudyGuideStorage.getAll())

  useEffect(() => {
    loadGuides()
    window.addEventListener(STUDY_GUIDES_CHANGED_EVENT, loadGuides)
    window.addEventListener('storage', loadGuides)

    return () => {
      window.removeEventListener(STUDY_GUIDES_CHANGED_EVENT, loadGuides)
      window.removeEventListener('storage', loadGuides)
    }
  }, [])

  const sortedGuides = useMemo(() => sortGuides(guides), [guides])

  const createGuide = () => {
    navigate(`/workspace/${nanoid()}?create=1`)
  }

  const openMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    guide: StudyGuideRecord,
  ) => {
    event.stopPropagation()
    setMenuAnchor(event.currentTarget)
    setMenuGuide(guide)
  }

  const closeMenu = () => {
    setMenuAnchor(null)
    setMenuGuide(null)
  }

  const startRename = () => {
    if (!menuGuide) {
      return
    }
    setRenameGuide(menuGuide)
    setRenameTitle(menuGuide.title)
    closeMenu()
  }

  const saveRename = () => {
    if (renameGuide) {
      StudyGuideStorage.rename(renameGuide.id, renameTitle)
      loadGuides()
    }
    setRenameGuide(null)
    setRenameTitle('')
  }

  const togglePinned = () => {
    if (menuGuide) {
      StudyGuideStorage.togglePinned(menuGuide.id)
      loadGuides()
    }
    closeMenu()
  }

  const deleteGuide = () => {
    if (menuGuide) {
      StudyGuideStorage.delete(menuGuide.id)
      loadGuides()
    }
    closeMenu()
  }

  return (
    <Box
      sx={(theme) => ({
        minHeight: '100dvh',
        background:
          theme.palette.mode === 'dark'
            ? 'linear-gradient(180deg, #050816 0%, #0f172a 100%)'
            : 'linear-gradient(180deg, #f8fafc 0%, #eef6f3 100%)',
        color: 'text.primary',
      })}
    >
      <Box
        component="header"
        sx={{
          height: 64,
          px: { xs: 2, md: 4 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            component="img"
            src="/logo.png"
            alt=""
            sx={{ width: 32, height: 32 }}
          />
          <Typography variant="h6" fontWeight={900}>
            StudyMesh
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <StudyCreditsPill compact />
          <ThemeModeToggle />
        </Stack>
      </Box>

      <Box
        component="main"
        sx={{
          maxWidth: 1180,
          mx: 'auto',
          px: { xs: 2, md: 4 },
          py: { xs: 3, md: 5 },
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h4" fontWeight={950}>
              My Study Guides
            </Typography>
            <Typography color="text.secondary">
              Open a guide or create a new learning workspace.
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={createGuide}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}
          >
            New Study Guide
          </Button>
        </Stack>

        {sortedGuides.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              minHeight: 280,
              border: 1,
              borderColor: 'divider',
              borderRadius: 3,
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              p: 4,
              bgcolor: 'background.paper',
            }}
          >
            <Stack spacing={1.5} alignItems="center">
              <AutoStoriesIcon sx={{ fontSize: 48, color: 'primary.main' }} />
              <Typography variant="h6" fontWeight={900}>
                No Study Guides yet
              </Typography>
              <Typography color="text.secondary" maxWidth={420}>
                Start with a prompt and StudyMesh will build the first guide
                pages.
              </Typography>
              <Button variant="contained" onClick={createGuide}>
                Create Study Guide
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
              gap: 2,
            }}
          >
            {sortedGuides.map((guide) => {
              const pageCount = guide.studyPath.dashboards.length
              return (
                <Paper
                  key={guide.id}
                  elevation={0}
                  onClick={() => navigate(`/workspace/${guide.id}`)}
                  sx={(theme) => ({
                    position: 'relative',
                    minHeight: 180,
                    p: 2.25,
                    borderRadius: 3,
                    border: 1,
                    borderColor: guide.pinnedAt
                      ? alpha(theme.palette.primary.main, 0.5)
                      : 'divider',
                    bgcolor: 'background.paper',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: theme.transitions.create([
                      'transform',
                      'box-shadow',
                      'border-color',
                    ]),
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      borderColor: 'primary.main',
                      boxShadow:
                        theme.palette.mode === 'dark'
                          ? '0 18px 44px rgba(0,0,0,0.36)'
                          : '0 18px 44px rgba(15,23,42,0.12)',
                    },
                  })}
                >
                  <Stack spacing={2} sx={{ height: '100%' }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: 'action.hover',
                          fontSize: 24,
                        }}
                      >
                        {guide.emoji || '\u2728'}
                      </Box>
                      <Stack direction="row" spacing={0.25}>
                        {guide.pinnedAt ? (
                          <PushPinIcon
                            fontSize="small"
                            sx={{ color: 'primary.main', mt: 0.75 }}
                          />
                        ) : null}
                        <IconButton
                          aria-label={`Open ${guide.title} options`}
                          onClick={(event) => openMenu(event, guide)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Stack>
                    </Stack>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="h6"
                        fontWeight={900}
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.18,
                        }}
                      >
                        {guide.title}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {formatGuideDate(guide.createdAt)} &middot; {pageCount}{' '}
                      {pageCount === 1 ? 'page' : 'pages'}
                    </Typography>
                  </Stack>
                </Paper>
              )
            })}
          </Box>
        )}
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem onClick={startRename}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit title
        </MenuItem>
        <MenuItem onClick={togglePinned}>
          <PushPinIcon fontSize="small" sx={{ mr: 1 }} />
          {menuGuide?.pinnedAt ? 'Unpin' : 'Pin to top'}
        </MenuItem>
        <MenuItem onClick={deleteGuide} sx={{ color: 'error.main' }}>
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      <Dialog open={Boolean(renameGuide)} onClose={() => setRenameGuide(null)}>
        <DialogTitle>Edit title</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Study Guide title"
            value={renameTitle}
            onChange={(event) => setRenameTitle(event.target.value)}
            sx={{ mt: 1, minWidth: { xs: 260, sm: 420 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameGuide(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={saveRename}
            disabled={!renameTitle.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default StudyGuidesPage
