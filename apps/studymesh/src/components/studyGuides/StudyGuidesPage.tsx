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
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PushPinIcon from '@mui/icons-material/PushPin'
import ReplayIcon from '@mui/icons-material/Replay'
import SearchIcon from '@mui/icons-material/Search'
import { nanoid } from 'nanoid'
import { useNavigate } from 'react-router-dom'

import type { StudyGuideRecord } from '../../cloud/types'
import {
  STUDY_GUIDES_CHANGED_EVENT,
  StudyGuideStorage,
  createStudyGuideRecord,
} from '../../studyGuides/storage'
import { generateStudyPathStateFromPrompt } from '../../studyGuides/generation'
import { readQuickCreateAiSettings } from '../../quickCreate/ai'
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
    prompt:
      'Create a Study Guide for Spanish subjunctive with examples and practice.',
  },
  {
    label: 'Photosynthesis',
    prompt:
      'Explain photosynthesis from beginner level to exam-ready understanding.',
  },
]

const getGenerationEstimateSeconds = (): number => {
  const provider = readQuickCreateAiSettings().provider || 'hosted'

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
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const [guides, setGuides] = useState<StudyGuideRecord[]>([])
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [menuGuide, setMenuGuide] = useState<StudyGuideRecord | null>(null)
  const [renameGuide, setRenameGuide] = useState<StudyGuideRecord | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createGuidePrompt, setCreateGuidePrompt] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingGuides, setPendingGuides] = useState<PendingGuide[]>([])
  const [newlyCreatedGuideIds, setNewlyCreatedGuideIds] = useState<Set<string>>(
    () => new Set(),
  )
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
  const filteredGuides = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return sortedGuides
    }

    return sortedGuides.filter((guide) =>
      [guide.title, guide.description, guide.folderName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [searchQuery, sortedGuides])

  const openCreateGuide = () => {
    setCreateOpen(true)
  }

  const runCreateGuide = async (prompt: string, id = nanoid()) => {
    const pendingGuide: PendingGuide = {
      id,
      prompt,
      createdAt: new Date().toISOString(),
      estimateSeconds: getGenerationEstimateSeconds(),
    }
    setPendingGuides((current) => {
      const existingIndex = current.findIndex((guide) => guide.id === id)
      if (existingIndex < 0) {
        return [pendingGuide, ...current]
      }

      return current.map((guide) => (guide.id === id ? pendingGuide : guide))
    })
    setCreateOpen(false)
    setCreateGuidePrompt('')

    try {
      const studyPath = await generateStudyPathStateFromPrompt({ id, prompt })
      StudyGuideStorage.save({
        ...createStudyGuideRecord(studyPath, { id }),
        description: prompt,
      })
      setPendingGuides((current) => current.filter((guide) => guide.id !== id))
      setNewlyCreatedGuideIds((current) => new Set(current).add(id))
      loadGuides()
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

  const submitCreateGuide = async () => {
    const prompt = createGuidePrompt.trim()
    if (!prompt) {
      return
    }

    await runCreateGuide(prompt)
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

  const duplicateGuide = () => {
    if (!menuGuide) {
      return
    }

    const id = nanoid()
    const title = `${menuGuide.title} copy`
    StudyGuideStorage.save({
      ...menuGuide,
      id,
      title,
      folderName: title,
      pinnedAt: null,
      studyPath: {
        ...menuGuide.studyPath,
        pathId: id,
        title,
        folderName: title,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    loadGuides()
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
            ? 'linear-gradient(180deg, #070b12 0%, #0f172a 100%)'
            : 'linear-gradient(180deg, #f8fafc 0%, #f4f6f8 100%)',
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
          sx={{ mb: 2.5 }}
        >
          <Box>
            <Typography variant="h4" fontWeight={650}>
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
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 2.25,
              boxShadow: 'none',
            }}
          >
            New Study Guide
          </Button>
        </Stack>

        <TextField
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search guides..."
          size="small"
          sx={{
            width: { xs: '100%', sm: 300 },
            mb: 2.25,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: 'background.paper',
            },
          }}
          InputProps={{
            startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1 }} />,
          }}
        />

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
          <Paper
            component="button"
            type="button"
            aria-label="New Study Guide"
            onClick={openCreateGuide}
            elevation={0}
            sx={(theme) => ({
              display: isPhone ? 'none' : 'grid',
              minHeight: 190,
              p: 2.4,
              borderRadius: 2,
              border: 1,
              borderStyle: 'dashed',
              borderColor: alpha(theme.palette.primary.main, 0.22),
              bgcolor: alpha(
                theme.palette.primary.main,
                theme.palette.mode === 'dark' ? 0.045 : 0.02,
              ),
              color: 'text.primary',
              cursor: 'pointer',
              font: 'inherit',
              placeItems: 'center',
              textAlign: 'center',
              transition: theme.transitions.create([
                'transform',
                'box-shadow',
                'border-color',
                'background-color',
              ]),
              '&:hover': {
                transform: 'translateY(-2px)',
                borderColor: alpha(theme.palette.primary.main, 0.45),
                bgcolor: alpha(
                  theme.palette.primary.main,
                  theme.palette.mode === 'dark' ? 0.08 : 0.04,
                ),
                boxShadow:
                  theme.palette.mode === 'dark'
                    ? '0 18px 44px rgba(0,0,0,0.3)'
                    : '0 20px 46px rgba(15,23,42,0.11)',
              },
              '&:focus-visible': {
                outline: `3px solid ${alpha(theme.palette.primary.main, 0.45)}`,
                outlineOffset: 3,
              },
            })}
          >
            <Stack spacing={2} alignItems="center">
              <Box
                sx={(theme) => ({
                  width: 76,
                  height: 76,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  color: 'primary.main',
                })}
              >
                <AddIcon sx={{ fontSize: 34 }} />
              </Box>
              <Typography variant="h6" fontWeight={650} color="text.primary">
                New Study Guide
              </Typography>
            </Stack>
          </Paper>
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
                  borderColor: guide.error
                    ? 'error.main'
                    : alpha(theme.palette.primary.main, 0.36),
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
                      fontWeight={650}
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
                    <Stack spacing={1.25}>
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
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ReplayIcon />}
                        onClick={() =>
                          void runCreateGuide(guide.prompt, guide.id)
                        }
                        sx={{
                          alignSelf: 'flex-start',
                          borderRadius: 2,
                          textTransform: 'none',
                        }}
                      >
                        Retry
                      </Button>
                    </Stack>
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
          {filteredGuides.map((guide) => {
            const pageCount = guide.studyPath.dashboards.length
            const accent =
              guide.emoji === '🧬'
                ? '#0b84a5'
                : guide.emoji === '📚'
                  ? '#5b3f92'
                  : guide.emoji === '🎨'
                    ? '#b86b2d'
                    : '#0b6f4f'
            const isNewlyCreated = newlyCreatedGuideIds.has(guide.id)
            return (
              <Paper
                key={guide.id}
                elevation={0}
                data-testid={
                  isNewlyCreated ? 'newly-created-study-guide-card' : undefined
                }
                onClick={() => navigate(`/workspace/${guide.id}`)}
                sx={(theme) => ({
                  position: 'relative',
                  minHeight: 190,
                  p: 2.4,
                  borderRadius: 2,
                  border: 1,
                  borderColor: isNewlyCreated
                    ? theme.palette.warning.main
                    : guide.pinnedAt
                      ? alpha(theme.palette.primary.main, 0.32)
                      : 'divider',
                  bgcolor: 'background.paper',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  boxShadow: isNewlyCreated
                    ? `0 0 0 3px ${alpha(
                        theme.palette.warning.main,
                        theme.palette.mode === 'dark' ? 0.22 : 0.18,
                      )}, 0 18px 44px ${alpha(
                        theme.palette.warning.main,
                        theme.palette.mode === 'dark' ? 0.18 : 0.14,
                      )}`
                    : undefined,
                  transition: theme.transitions.create([
                    'transform',
                    'box-shadow',
                    'border-color',
                  ]),
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    borderColor: isNewlyCreated
                      ? theme.palette.warning.main
                      : alpha(theme.palette.primary.main, 0.38),
                    boxShadow: isNewlyCreated
                      ? `0 0 0 3px ${alpha(
                          theme.palette.warning.main,
                          theme.palette.mode === 'dark' ? 0.24 : 0.2,
                        )}, 0 20px 48px ${alpha(
                          theme.palette.warning.main,
                          theme.palette.mode === 'dark' ? 0.2 : 0.16,
                        )}`
                      : theme.palette.mode === 'dark'
                        ? '0 18px 44px rgba(0,0,0,0.36)'
                        : '0 20px 46px rgba(15,23,42,0.11)',
                  },
                })}
              >
                <Stack spacing={1.35} sx={{ height: '100%' }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: alpha(accent, 0.12),
                        color: accent,
                        fontSize: 22,
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
                          borderColor: 'transparent',
                          bgcolor: 'action.hover',
                          color: 'text.secondary',
                          '&:hover': {
                            borderColor: alpha(
                              theme.palette.primary.main,
                              0.22,
                            ),
                            bgcolor: alpha(
                              theme.palette.primary.main,
                              theme.palette.mode === 'dark' ? 0.12 : 0.06,
                            ),
                            color: 'text.primary',
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
                      fontWeight={650}
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
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mt: 1,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {guide.description ||
                        guide.studyPath.dashboards[0]?.name ||
                        'Open this learning workspace.'}
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
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: 150,
            boxShadow: '0 18px 40px rgba(15,23,42,0.16)',
          },
        }}
      >
        <MenuItem onClick={startRename}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Rename
        </MenuItem>
        <MenuItem onClick={duplicateGuide}>
          <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} />
          Duplicate
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
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 600 }}>
          New Study Guide
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Study Guide prompt"
            value={createGuidePrompt}
            onChange={(event) => setCreateGuidePrompt(event.target.value)}
            placeholder="What should StudyMesh teach?"
            multiline
            minRows={4}
            required
            sx={{ mt: 1 }}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
            {quickPromptOptions.map((option) => (
              <Button
                key={option.label}
                size="small"
                variant="outlined"
                onClick={() => {
                  setCreateGuidePrompt(option.prompt)
                }}
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
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void submitCreateGuide()}
            disabled={!createGuidePrompt.trim()}
          >
            Create Guide
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default StudyGuidesPage
