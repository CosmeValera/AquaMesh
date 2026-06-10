import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
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
  createStudyGuideRecord,
} from '../../studyGuides/storage'
import { generateStudyPathStateFromPrompt } from '../../studyGuides/generation'
import { readStudyPackAiSettings } from '../../studyPack/ai'
import TopNavBar from '../topnavbar/TopNavBar'

interface PendingGuide {
  id: string
  prompt: string
  createdAt: string
  estimateSeconds: number
  error?: string
}

const quickPromptOptions = [
  {
    label: 'Human anatomy',
    prompt: 'Teach me the basics of human anatomy for an exam.',
  },
  {
    label: 'Spanish subjunctive',
    prompt: 'Create a Study Guide for Spanish subjunctive with examples and practice.',
  },
  {
    label: 'Photosynthesis',
    prompt:
      'Explain photosynthesis from beginner level to exam-ready understanding.',
  },
]

const getGenerationEstimateSeconds = (): number => {
  const provider = readStudyPackAiSettings().provider || 'basic'
  if (provider === 'basic') {
    return 10
  }

  if (provider === 'local') {
    return 90
  }

  if (provider === 'cerebras' || provider === 'hosted') {
    return 20
  }

  return 60
}

const formatDuration = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  if (minutes <= 0) {
    return `${remainingSeconds}s`
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

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
  const [createOpen, setCreateOpen] = useState(false)
  const [createPrompt, setCreatePrompt] = useState('')
  const [pendingGuides, setPendingGuides] = useState<PendingGuide[]>([])
  const [now, setNow] = useState(Date.now())

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

  useEffect(() => {
    if (!pendingGuides.some((guide) => !guide.error)) {
      return undefined
    }

    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [pendingGuides])

  const sortedGuides = useMemo(() => sortGuides(guides), [guides])

  const openCreateGuide = () => {
    setCreateOpen(true)
  }

  const submitCreateGuide = async () => {
    const prompt = createPrompt.trim()
    if (!prompt) {
      return
    }

    const id = nanoid()
    const pendingGuide: PendingGuide = {
      id,
      prompt,
      createdAt: new Date().toISOString(),
      estimateSeconds: getGenerationEstimateSeconds(),
    }
    setPendingGuides((current) => [pendingGuide, ...current])
    setCreateOpen(false)
    setCreatePrompt('')

    try {
      const studyPath = await generateStudyPathStateFromPrompt({ id, prompt })
      StudyGuideStorage.save(createStudyGuideRecord(studyPath, { id }))
      setPendingGuides((current) =>
        current.filter((guide) => guide.id !== id),
      )
      loadGuides()
      navigate(`/workspace/${id}`)
    } catch (error) {
      setPendingGuides((current) =>
        current.map((guide) =>
          guide.id === id
            ? {
                ...guide,
                error:
                  error instanceof Error
                    ? error.message
                    : 'Could not create this Study Guide.',
              }
            : guide,
        ),
      )
    }
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
      <TopNavBar creationHost="external" />

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
            onClick={openCreateGuide}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}
          >
            New Study Guide
          </Button>
        </Stack>

        {sortedGuides.length === 0 && pendingGuides.length === 0 ? (
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
              <Button variant="contained" onClick={openCreateGuide}>
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
            {pendingGuides.map((guide) => {
              const elapsedSeconds = Math.max(
                0,
                Math.floor((now - Date.parse(guide.createdAt)) / 1000),
              )
              const progress = guide.error
                ? 0
                : Math.min(100, (elapsedSeconds / guide.estimateSeconds) * 100)

              return (
                <Paper
                  key={guide.id}
                  elevation={0}
                  sx={(theme) => ({
                    minHeight: 180,
                    p: 2.25,
                    borderRadius: 3,
                    border: 1,
                    borderColor: guide.error ? 'error.main' : 'primary.main',
                    bgcolor: 'background.paper',
                    overflow: 'hidden',
                    boxShadow:
                      theme.palette.mode === 'dark'
                        ? '0 18px 44px rgba(0,0,0,0.28)'
                        : '0 18px 44px rgba(15,23,42,0.1)',
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
                          bgcolor: guide.error ? 'error.light' : 'action.hover',
                          color: guide.error ? 'error.contrastText' : 'inherit',
                        }}
                      >
                        {guide.error ? '!' : <CircularProgress size={22} />}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {guide.error ? 'Failed' : 'Creating'}
                      </Typography>
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
                        {guide.prompt}
                      </Typography>
                    </Box>
                    {guide.error ? (
                      <Typography
                        variant="body2"
                        color="error.main"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {guide.error}
                      </Typography>
                    ) : (
                      <Box>
                        <Box
                          sx={{
                            height: 6,
                            borderRadius: 99,
                            bgcolor: 'action.hover',
                            overflow: 'hidden',
                            mb: 0.75,
                          }}
                        >
                          <Box
                            sx={{
                              width: `${progress}%`,
                              height: '100%',
                              bgcolor: 'primary.main',
                              transition: 'width 300ms ease',
                            }}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          Elapsed {formatDuration(elapsedSeconds)} · Estimate{' '}
                          {formatDuration(guide.estimateSeconds)}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Paper>
              )
            })}
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
                          sx={(theme) => ({
                            width: 34,
                            height: 34,
                            border: 1,
                            borderColor: alpha(theme.palette.primary.main, 0.44),
                            bgcolor: alpha(
                              theme.palette.primary.main,
                              theme.palette.mode === 'dark' ? 0.18 : 0.1,
                            ),
                            color: 'primary.main',
                            '&:hover': {
                              borderColor: 'primary.main',
                              bgcolor: alpha(
                                theme.palette.primary.main,
                                theme.palette.mode === 'dark' ? 0.28 : 0.18,
                              ),
                              color: 'primary.dark',
                            },
                          })}
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

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack spacing={0.5}>
            <Typography variant="h6" fontWeight={900}>
              New Study Guide
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Describe what you want to learn.
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
            {quickPromptOptions.map((option) => (
              <Button
                key={option.label}
                size="small"
                variant={
                  createPrompt === option.prompt ? 'contained' : 'outlined'
                }
                onClick={() => setCreatePrompt(option.prompt)}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  mb: 1,
                }}
              >
                {option.label}
              </Button>
            ))}
          </Stack>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={5}
            label="Prompt"
            value={createPrompt}
            onChange={(event) => setCreatePrompt(event.target.value)}
            placeholder="Example: Teach me the basics of human anatomy for an exam."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void submitCreateGuide()}
            disabled={!createPrompt.trim()}
          >
            Create Study Guide
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default StudyGuidesPage
