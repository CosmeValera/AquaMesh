import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PushPinIcon from '@mui/icons-material/PushPin'
import ReplayIcon from '@mui/icons-material/Replay'
import SearchIcon from '@mui/icons-material/Search'
import ViewListIcon from '@mui/icons-material/ViewList'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
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
import {
  HOSTED_STUDY_GUIDE_AUTO_RETRY_LIMIT,
  HOSTED_STUDY_GUIDE_MANUAL_RETRY_MESSAGE,
  STUDY_GUIDE_CREATION_QUEUE_CHANGED_EVENT,
  StudyGuideCreationQueueStorage,
  isRetryableStudyGuideCreationError,
  type StudyGuideCreationJob,
  type StudyGuideCreationProvider,
  type StudyGuideCreationStatus,
} from '../../studyGuides/creationQueue'
import TopNavBar from '../topnavbar/TopNavBar'
import { useInterfaceText } from '../../language/interfaceLanguage'

type PendingGuide = StudyGuideCreationJob

const MAX_HOSTED_BROWSER_CONCURRENCY = 3
const MAX_LOCAL_BROWSER_CONCURRENCY = 1

const quickPromptOptions = [
  {
    labelKey: 'studyGuides.quickPromptHumanAnatomy',
    promptKey: 'studyGuides.quickPromptHumanAnatomyPrompt',
  },
  {
    labelKey: 'studyGuides.quickPromptLanguageSubjunctive',
    promptKey: 'studyGuides.quickPromptLanguageSubjunctivePrompt',
  },
  {
    labelKey: 'studyGuides.quickPromptPhotosynthesis',
    promptKey: 'studyGuides.quickPromptPhotosynthesisPrompt',
  },
] as const

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

const getActiveAiProvider = () =>
  readQuickCreateAiSettings().provider || 'hosted'

const isVisiblePendingStatus = (status: StudyGuideCreationStatus): boolean =>
  status === 'queued' ||
  status === 'running' ||
  status === 'interrupted' ||
  status === 'failed'

const sortPendingGuidesForDisplay = (guides: PendingGuide[]) =>
  [...guides].sort(
    (first, second) =>
      Date.parse(second.createdAt || '') - Date.parse(first.createdAt || ''),
  )

const getPendingStatusLabel = (
  status: StudyGuideCreationStatus,
  t: ReturnType<typeof useInterfaceText>['t'],
): string => {
  if (status === 'queued') {
    return t('studyGuides.queued')
  }

  if (status === 'running') {
    return t('studyGuides.creating')
  }

  if (status === 'interrupted') {
    return t('studyGuides.interrupted')
  }

  if (status === 'failed') {
    return t('studyGuides.failed')
  }

  return t('studyGuides.creating')
}

const getPendingErrorMessage = (
  guide: PendingGuide,
  t: ReturnType<typeof useInterfaceText>['t'],
): string =>
  guide.errorMessage ||
  (guide.status === 'interrupted'
    ? t('studyGuides.interruptedMessage')
    : t('studyGuides.failedMessage'))

const isLocalProvider = (provider: StudyGuideCreationProvider): boolean =>
  provider === 'local'

const canAutoRetryPendingGuide = (guide: PendingGuide): boolean =>
  guide.provider !== 'hosted' ||
  guide.autoRetryCount < HOSTED_STUDY_GUIDE_AUTO_RETRY_LIMIT

const getRetryButtonLabel = (
  guide: PendingGuide,
  t: ReturnType<typeof useInterfaceText>['t'],
): string =>
  guide.provider === 'hosted'
    ? t('studyGuides.retryCredits')
    : t('studyGuides.retry')

const formatDuration = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  if (minutes <= 0) {
    return `${remainingSeconds}s`
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

const formatGuideDate = (
  value: string,
  t: ReturnType<typeof useInterfaceText>['t'],
  language = 'en',
) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return t('studyGuides.unknownDate')
  }

  return new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

type StudyGuideViewMode = 'grid' | 'list'
type StudyGuideSortMode = 'recent' | 'title'

const STUDY_GUIDE_VIEW_MODE_KEY = 'studymesh.studyGuides.viewMode'
const STUDY_GUIDE_SORT_MODE_KEY = 'studymesh.studyGuides.sortMode'

const isStudyGuideViewMode = (
  value: string | null,
): value is StudyGuideViewMode => value === 'grid' || value === 'list'

const isStudyGuideSortMode = (
  value: string | null,
): value is StudyGuideSortMode => value === 'recent' || value === 'title'

const readStoredViewMode = (): StudyGuideViewMode => {
  try {
    const storedMode = window.localStorage.getItem(STUDY_GUIDE_VIEW_MODE_KEY)
    return isStudyGuideViewMode(storedMode) ? storedMode : 'grid'
  } catch {
    return 'grid'
  }
}

const readStoredSortMode = (): StudyGuideSortMode => {
  try {
    const storedMode = window.localStorage.getItem(STUDY_GUIDE_SORT_MODE_KEY)
    return isStudyGuideSortMode(storedMode) ? storedMode : 'recent'
  } catch {
    return 'recent'
  }
}

const storeStudyGuideViewMode = (mode: StudyGuideViewMode) => {
  try {
    window.localStorage.setItem(STUDY_GUIDE_VIEW_MODE_KEY, mode)
  } catch {
    // Ignore private-mode storage failures.
  }
}

const storeStudyGuideSortMode = (mode: StudyGuideSortMode) => {
  try {
    window.localStorage.setItem(STUDY_GUIDE_SORT_MODE_KEY, mode)
  } catch {
    // Ignore private-mode storage failures.
  }
}

const sortGuides = (guides: StudyGuideRecord[], sortMode: StudyGuideSortMode) =>
  [...guides].sort((first, second) => {
    const firstPinned = first.pinnedAt ? Date.parse(first.pinnedAt) : 0
    const secondPinned = second.pinnedAt ? Date.parse(second.pinnedAt) : 0
    if (firstPinned || secondPinned) {
      if (firstPinned && secondPinned) {
        if (sortMode === 'title') {
          return first.title.localeCompare(second.title, undefined, {
            numeric: true,
            sensitivity: 'base',
          })
        }

        return secondPinned - firstPinned
      }

      return secondPinned - firstPinned
    }

    if (sortMode === 'title') {
      return first.title.localeCompare(second.title, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    }

    return Date.parse(second.createdAt) - Date.parse(first.createdAt)
  })

const StudyGuidesPage = () => {
  const { t, language } = useInterfaceText()
  const navigate = useNavigate()
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const [guides, setGuides] = useState<StudyGuideRecord[]>([])
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [menuGuide, setMenuGuide] = useState<StudyGuideRecord | null>(null)
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null)
  const [viewMode, setViewMode] =
    useState<StudyGuideViewMode>(readStoredViewMode)
  const [sortMode, setSortMode] =
    useState<StudyGuideSortMode>(readStoredSortMode)
  const [renameGuide, setRenameGuide] = useState<StudyGuideRecord | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createGuidePrompt, setCreateGuidePrompt] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [pendingGuides, setPendingGuides] = useState<PendingGuide[]>([])
  const [newlyCreatedGuideIds, setNewlyCreatedGuideIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [now, setNow] = useState(Date.now())
  const activeJobsRef = useRef<
    Map<
      string,
      {
        controller: AbortController
        provider: StudyGuideCreationProvider
      }
    >
  >(new Map())
  const isMountedRef = useRef(true)

  const loadGuides = () => {
    if (isMountedRef.current) {
      setGuides(StudyGuideStorage.getAll())
    }
  }
  const loadPendingGuides = () => {
    const visibleJobs = StudyGuideCreationQueueStorage.getAll().filter((job) =>
      isVisiblePendingStatus(job.status),
    )
    if (isMountedRef.current) {
      setPendingGuides(sortPendingGuidesForDisplay(visibleJobs))
    }
  }

  useEffect(() => {
    isMountedRef.current = true
    loadGuides()
    StudyGuideCreationQueueStorage.requeueRetryableJobs()
    loadPendingGuides()
    window.addEventListener(STUDY_GUIDES_CHANGED_EVENT, loadGuides)
    window.addEventListener(
      STUDY_GUIDE_CREATION_QUEUE_CHANGED_EVENT,
      loadPendingGuides,
    )
    window.addEventListener('storage', loadGuides)
    window.addEventListener('storage', loadPendingGuides)

    return () => {
      isMountedRef.current = false
      activeJobsRef.current.forEach((job) => job.controller.abort())
      activeJobsRef.current.clear()
      window.removeEventListener(STUDY_GUIDES_CHANGED_EVENT, loadGuides)
      window.removeEventListener(
        STUDY_GUIDE_CREATION_QUEUE_CHANGED_EVENT,
        loadPendingGuides,
      )
      window.removeEventListener('storage', loadGuides)
      window.removeEventListener('storage', loadPendingGuides)
    }
  }, [])

  useEffect(() => {
    if (!pendingGuides.some((guide) => guide.status === 'running')) {
      return undefined
    }

    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [pendingGuides])

  const sortedGuides = useMemo(
    () => sortGuides(guides, sortMode),
    [guides, sortMode],
  )
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

  const selectViewMode = (mode: StudyGuideViewMode) => {
    setViewMode(mode)
    storeStudyGuideViewMode(mode)
  }

  const selectSortMode = (mode: StudyGuideSortMode) => {
    setSortMode(mode)
    storeStudyGuideSortMode(mode)
    setSortAnchor(null)
  }

  const enqueueCreateGuide = (prompt: string, id = nanoid()) => {
    const pendingGuide = StudyGuideCreationQueueStorage.upsert({
      id,
      prompt,
      provider: getActiveAiProvider(),
      status: 'queued',
      estimateSeconds: getGenerationEstimateSeconds(),
      autoRetryCount: 0,
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      resultStudyGuideId: null,
    })
    setPendingGuides((current) =>
      sortPendingGuidesForDisplay([
        pendingGuide,
        ...current.filter((guide) => guide.id !== id),
      ]),
    )
    setCreateOpen(false)
    setCreateGuidePrompt('')
  }

  const runQueuedGuide = async (job: PendingGuide) => {
    if (activeJobsRef.current.has(job.id)) {
      return
    }

    const generationController = new AbortController()
    const startedAt = new Date().toISOString()
    activeJobsRef.current.set(job.id, {
      controller: generationController,
      provider: job.provider,
    })
    StudyGuideCreationQueueStorage.update(job.id, {
      status: 'running',
      startedAt,
      finishedAt: null,
      errorMessage: null,
    })
    try {
      const studyPath = await generateStudyPathStateFromPrompt({
        id: job.id,
        prompt: job.prompt,
        provider: job.provider,
        signal: generationController.signal,
      })
      if (generationController.signal.aborted) {
        return
      }

      StudyGuideStorage.save({
        ...createStudyGuideRecord(studyPath, { id: job.id }),
        description: job.prompt,
      })
      StudyGuideCreationQueueStorage.remove(job.id)
      setNewlyCreatedGuideIds((current) => new Set(current).add(job.id))
      loadGuides()
    } catch (error) {
      if (generationController.signal.aborted) {
        return
      }

      const errorMessage =
        error instanceof Error ? error.message : t('studyGuides.failedMessage')
      const canAutoRetry =
        isRetryableStudyGuideCreationError(errorMessage) &&
        canAutoRetryPendingGuide(job)
      const nextStatus = canAutoRetry ? 'queued' : 'failed'
      StudyGuideCreationQueueStorage.update(job.id, {
        status: nextStatus,
        startedAt: nextStatus === 'queued' ? null : startedAt,
        finishedAt: nextStatus === 'failed' ? new Date().toISOString() : null,
        autoRetryCount:
          canAutoRetry && job.provider === 'hosted'
            ? job.autoRetryCount + 1
            : job.autoRetryCount,
        errorMessage:
          nextStatus === 'failed' &&
          isRetryableStudyGuideCreationError(errorMessage) &&
          job.provider === 'hosted'
            ? HOSTED_STUDY_GUIDE_MANUAL_RETRY_MESSAGE
            : nextStatus === 'failed'
            ? errorMessage
            : null,
      })
    } finally {
      activeJobsRef.current.delete(job.id)
      loadPendingGuides()
    }
  }

  useEffect(() => {
    const activeJobs = Array.from(activeJobsRef.current.values())
    let availableLocalSlots =
      MAX_LOCAL_BROWSER_CONCURRENCY -
      activeJobs.filter((job) => isLocalProvider(job.provider)).length
    let availableRemoteSlots =
      MAX_HOSTED_BROWSER_CONCURRENCY -
      activeJobs.filter((job) => !isLocalProvider(job.provider)).length

    const queuedJobs = [...pendingGuides]
      .filter((guide) => guide.status === 'queued')
      .sort(
        (first, second) =>
          Date.parse(first.createdAt || '') -
          Date.parse(second.createdAt || ''),
      )
    queuedJobs.forEach((job) => {
      if (activeJobsRef.current.has(job.id)) {
        return
      }

      if (isLocalProvider(job.provider)) {
        if (availableLocalSlots <= 0) {
          return
        }
        availableLocalSlots -= 1
        void runQueuedGuide(job)
        return
      }

      if (availableRemoteSlots <= 0) {
        return
      }
      availableRemoteSlots -= 1
      void runQueuedGuide(job)
    })
  }, [pendingGuides])

  const retryPendingGuide = (guide: PendingGuide) => {
    StudyGuideCreationQueueStorage.update(guide.id, {
      status: 'queued',
      startedAt: null,
      finishedAt: null,
      autoRetryCount: 0,
      errorMessage: null,
    })
    loadPendingGuides()
  }

  const deletePendingGuide = (guide: PendingGuide) => {
    activeJobsRef.current.get(guide.id)?.controller.abort()

    StudyGuideCreationQueueStorage.remove(guide.id)
    loadPendingGuides()
  }

  const submitCreateGuide = async () => {
    const prompt = createGuidePrompt.trim()
    if (!prompt) {
      return
    }

    enqueueCreateGuide(prompt)
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
          direction="row"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          sx={{
            mb: 2.5,
            columnGap: 1.5,
            rowGap: { xs: 1, md: 0 },
            flexWrap: { xs: 'wrap', md: 'nowrap' },
          }}
        >
          <Box
            sx={{
              minWidth: 0,
              flex: 1,
              flexBasis: { xs: '100%', md: 'auto' },
              overflow: 'hidden',
            }}
          >
            <Typography
              variant="h4"
              fontWeight={650}
              sx={{
                fontSize: { xs: '1.25rem', sm: '1.55rem', md: '2.125rem' },
              }}
            >
              {t('studyGuides.title')}
            </Typography>
            <Typography
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: { xs: '0.82rem', sm: '0.95rem', md: '1rem' },
              }}
            >
              {t('studyGuides.subtitle')}
            </Typography>
          </Box>

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="flex-start"
            sx={{
              flexShrink: 0,
              flexWrap: 'wrap',
              gap: 0.75,
              width: { xs: '100%', md: 'auto' },
              maxWidth: { xs: '100%', md: 'none' },
              ml: { md: 'auto' },
            }}
          >
            {searchExpanded || searchQuery ? (
              <TextField
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onBlur={() => {
                  if (!searchQuery.trim()) {
                    setSearchExpanded(false)
                  }
                }}
                placeholder={t('studyGuides.search')}
                size="small"
                sx={{
                  width: { xs: 168, sm: 220, md: 260 },
                  flexShrink: 0,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 999,
                    bgcolor: 'background.paper',
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            ) : (
              <Tooltip title={t('studyGuides.search')}>
                <IconButton
                  aria-label={t('studyGuides.search')}
                  onClick={() => setSearchExpanded(true)}
                  sx={(theme) => ({
                    width: 38,
                    height: 38,
                    flexShrink: 0,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    '&:hover': {
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                      bgcolor: alpha(
                        theme.palette.primary.main,
                        theme.palette.mode === 'dark' ? 0.12 : 0.06,
                      ),
                    },
                  })}
                >
                  <SearchIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Stack
              direction="row"
              role="group"
              aria-label={t('studyGuides.listView')}
              sx={(theme) => ({
                flexShrink: 0,
                bgcolor: 'background.paper',
                borderRadius: 999,
                border: 1,
                borderColor: 'divider',
                overflow: 'hidden',
                '& button': {
                  width: 42,
                  height: 36,
                  display: 'grid',
                  placeItems: 'center',
                  border: 0,
                  borderRadius: 0,
                  background: 'transparent',
                  color: 'text.secondary',
                  cursor: 'pointer',
                  font: 'inherit',
                  '&[aria-pressed="true"]': {
                    bgcolor: alpha(theme.palette.primary.main, 0.16),
                    color: 'text.primary',
                  },
                  '&[aria-pressed="true"]:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.2),
                  },
                },
              })}
            >
              <Box
                component="button"
                type="button"
                aria-label={t('studyGuides.gridView')}
                aria-pressed={viewMode === 'grid'}
                title={t('studyGuides.gridView')}
                onClick={() => selectViewMode('grid')}
              >
                <ViewModuleIcon fontSize="small" />
              </Box>
              <Box
                component="button"
                type="button"
                aria-label={t('studyGuides.listView')}
                aria-pressed={viewMode === 'list'}
                title={t('studyGuides.listView')}
                onClick={() => selectViewMode('list')}
              >
                <ViewListIcon fontSize="small" />
              </Box>
            </Stack>
            <Button
              variant="outlined"
              onClick={(event) => setSortAnchor(event.currentTarget)}
              endIcon={<ArrowDropDownIcon />}
              sx={{
                flexShrink: 0,
                borderRadius: 999,
                textTransform: 'none',
                color: 'text.primary',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                px: 2,
                minWidth: 148,
                justifyContent: 'space-between',
              }}
            >
              {sortMode === 'recent'
                ? t('studyGuides.sortRecent')
                : t('studyGuides.sortTitle')}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateGuide}
              sx={{
                flexShrink: 0,
                borderRadius: 999,
                textTransform: 'none',
                fontWeight: 600,
                px: 2.25,
                boxShadow: 'none',
              }}
            >
              {t('studyGuides.newTitle')}
            </Button>
          </Stack>
        </Stack>

        <Menu
          anchorEl={sortAnchor}
          open={Boolean(sortAnchor)}
          onClose={() => setSortAnchor(null)}
          PaperProps={{ sx: { borderRadius: 2, minWidth: 160 } }}
        >
          <MenuItem
            selected={sortMode === 'recent'}
            onClick={() => selectSortMode('recent')}
          >
            {t('studyGuides.sortRecent')}
          </MenuItem>
          <MenuItem
            selected={sortMode === 'title'}
            onClick={() => selectSortMode('title')}
          >
            {t('studyGuides.sortTitle')}
          </MenuItem>
        </Menu>

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
          {viewMode === 'grid' && !isPhone ? (
            <Paper
              component="button"
              type="button"
              aria-label={t('studyGuides.newTitle')}
              onClick={openCreateGuide}
              elevation={0}
              sx={(theme) => ({
                display: 'grid',
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
                  outline: `3px solid ${alpha(
                    theme.palette.primary.main,
                    0.45,
                  )}`,
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
                  {t('studyGuides.newTitle')}
                </Typography>
              </Stack>
            </Paper>
          ) : null}
          {pendingGuides.map((guide) => {
            const elapsedSeconds = Math.max(
              0,
              Math.floor(
                (now - Date.parse(guide.startedAt || guide.createdAt)) / 1000,
              ),
            )
            const isProblem =
              guide.status === 'failed' || guide.status === 'interrupted'
            const isRunning = guide.status === 'running'
            return (
              <Paper
                key={guide.id}
                elevation={0}
                sx={(theme) => ({
                  minHeight: 180,
                  p: 2.25,
                  borderRadius: 3,
                  border: 1,
                  borderColor: isProblem
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
                        bgcolor: isProblem ? 'error.light' : 'action.hover',
                        color: isProblem ? 'error.contrastText' : 'inherit',
                      }}
                    >
                      {isProblem ? (
                        '!'
                      ) : isRunning ? (
                        <CircularProgress size={22} />
                      ) : (
                        <CircularProgress
                          size={22}
                          variant="determinate"
                          value={0}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {getPendingStatusLabel(guide.status, t)}
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
                  {isProblem ? (
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
                        {getPendingErrorMessage(guide, t)}
                      </Typography>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ width: '100%' }}
                      >
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<ReplayIcon />}
                          onClick={() => retryPendingGuide(guide)}
                          sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                          }}
                        >
                          {getRetryButtonLabel(guide, t)}
                        </Button>
                        <Button
                          variant="text"
                          color="error"
                          size="small"
                          startIcon={<DeleteOutlineIcon />}
                          onClick={() => deletePendingGuide(guide)}
                          sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                          }}
                        >
                          {t('studyGuides.delete')}
                        </Button>
                      </Stack>
                    </Stack>
                  ) : (
                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        {isRunning
                          ? `${t('studyGuides.elapsed')} ${formatDuration(
                              elapsedSeconds,
                            )} · ${t('studyGuides.estimate')} ${formatDuration(
                              guide.estimateSeconds,
                            )}`
                          : `${t('studyGuides.waiting')} · ${t(
                              'studyGuides.estimate',
                            )} ${formatDuration(guide.estimateSeconds)}`}
                      </Typography>
                      <Button
                        variant="text"
                        color="error"
                        size="small"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={() => deletePendingGuide(guide)}
                        sx={{
                          alignSelf: 'flex-start',
                          borderRadius: 2,
                          textTransform: 'none',
                        }}
                      >
                        {isRunning
                          ? t('studyGuides.cancel')
                          : t('studyGuides.delete')}
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            )
          })}
          {viewMode === 'grid'
            ? filteredGuides.map((guide) => {
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
                      isNewlyCreated
                        ? 'newly-created-study-guide-card'
                        : undefined
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
                            aria-label={`${t('studyGuides.openOptions')}: ${
                              guide.title
                            }`}
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
                            t('studyGuides.openWorkspace')}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {formatGuideDate(guide.createdAt, t, language)} &middot;{' '}
                        {pageCount}{' '}
                        {pageCount === 1
                          ? t('studyGuides.page')
                          : t('studyGuides.pages')}
                      </Typography>
                    </Stack>
                  </Paper>
                )
              })
            : null}
        </Box>

        {viewMode === 'list' ? (
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              mt: pendingGuides.length ? 2 : 0,
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              overflowX: 'auto',
            }}
          >
            <Table size="small" aria-label={t('studyGuides.listView')}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {t('studyGuides.sortTitle')}
                  </TableCell>
                  <TableCell
                    sx={{
                      display: { xs: 'none', md: 'table-cell' },
                      fontWeight: 700,
                      width: 96,
                    }}
                  >
                    {t('studyGuides.pages')}
                  </TableCell>
                  <TableCell
                    sx={{
                      display: { xs: 'none', md: 'table-cell' },
                      fontWeight: 700,
                    }}
                  >
                    {t('studyGuides.prompt')}
                  </TableCell>
                  <TableCell
                    sx={{
                      display: { xs: 'none', md: 'table-cell' },
                      fontWeight: 700,
                      width: 140,
                    }}
                  >
                    {t('studyGuides.created')}
                  </TableCell>
                  <TableCell sx={{ width: 56 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredGuides.map((guide) => {
                  const pageCount = guide.studyPath.dashboards.length
                  const isNewlyCreated = newlyCreatedGuideIds.has(guide.id)

                  return (
                    <TableRow
                      key={guide.id}
                      hover
                      data-testid={
                        isNewlyCreated
                          ? 'newly-created-study-guide-card'
                          : undefined
                      }
                      onClick={() => navigate(`/workspace/${guide.id}`)}
                      sx={(theme) => ({
                        cursor: 'pointer',
                        bgcolor: isNewlyCreated
                          ? alpha(theme.palette.warning.main, 0.1)
                          : undefined,
                        '& td': {
                          borderColor: isNewlyCreated
                            ? alpha(theme.palette.warning.main, 0.7)
                            : 'divider',
                        },
                        '&:hover': {
                          bgcolor: isNewlyCreated
                            ? alpha(theme.palette.warning.main, 0.16)
                            : undefined,
                        },
                      })}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {guide.pinnedAt ? (
                            <PushPinIcon
                              fontSize="small"
                              sx={{ color: 'primary.main' }}
                            />
                          ) : null}
                          <Typography
                            component="span"
                            aria-hidden="true"
                            sx={{ fontSize: 20, lineHeight: 1 }}
                          >
                            {guide.emoji || '\u2728'}
                          </Typography>
                          <Typography fontWeight={650}>
                            {guide.title}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell
                        sx={{ display: { xs: 'none', md: 'table-cell' } }}
                      >
                        {pageCount}{' '}
                        {pageCount === 1
                          ? t('studyGuides.page')
                          : t('studyGuides.pages')}
                      </TableCell>
                      <TableCell
                        sx={{
                          display: { xs: 'none', md: 'table-cell' },
                          maxWidth: 360,
                          color: 'text.secondary',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {guide.description ||
                          guide.studyPath.dashboards[0]?.name ||
                          t('studyGuides.openWorkspace')}
                      </TableCell>
                      <TableCell
                        sx={{ display: { xs: 'none', md: 'table-cell' } }}
                      >
                        {formatGuideDate(guide.createdAt, t, language)}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          aria-label={`${t('studyGuides.openOptions')}: ${
                            guide.title
                          }`}
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
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : null}
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
          {t('studyGuides.rename')}
        </MenuItem>
        <MenuItem onClick={duplicateGuide}>
          <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} />
          {t('studyGuides.duplicate')}
        </MenuItem>
        <MenuItem onClick={togglePinned}>
          <PushPinIcon fontSize="small" sx={{ mr: 1 }} />
          {menuGuide?.pinnedAt ? t('studyGuides.unpin') : t('studyGuides.pin')}
        </MenuItem>
        <MenuItem onClick={deleteGuide} sx={{ color: 'error.main' }}>
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />
          {t('studyGuides.delete')}
        </MenuItem>
      </Menu>

      <Dialog open={Boolean(renameGuide)} onClose={() => setRenameGuide(null)}>
        <DialogTitle>{t('studyGuides.editTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={t('studyGuides.titleField')}
            value={renameTitle}
            onChange={(event) => setRenameTitle(event.target.value)}
            sx={{ mt: 1, minWidth: { xs: 260, sm: 420 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameGuide(null)}>
            {t('studyGuides.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={saveRename}
            disabled={!renameTitle.trim()}
          >
            {t('studyGuides.save')}
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
          {t('studyGuides.newTitle')}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={t('studyGuides.promptField')}
            value={createGuidePrompt}
            onChange={(event) => setCreateGuidePrompt(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key !== 'Enter' ||
                event.shiftKey ||
                event.nativeEvent.isComposing
              ) {
                return
              }

              event.preventDefault()
              if (createGuidePrompt.trim()) {
                void submitCreateGuide()
              }
            }}
            placeholder={t('studyGuides.promptPlaceholder')}
            multiline
            minRows={4}
            required
            sx={{ mt: 1 }}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
            {quickPromptOptions.map((option) => (
              <Button
                key={option.labelKey}
                size="small"
                variant="outlined"
                onClick={() => {
                  setCreateGuidePrompt(t(option.promptKey))
                }}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  mb: 1,
                }}
              >
                {t(option.labelKey)}
              </Button>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>
            {t('studyGuides.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={() => void submitCreateGuide()}
            disabled={!createGuidePrompt.trim()}
          >
            {t('studyGuides.createGuide')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default StudyGuidesPage
