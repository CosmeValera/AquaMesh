import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
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
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PushPinIcon from '@mui/icons-material/PushPin'
import ReplayIcon from '@mui/icons-material/Replay'
import SearchIcon from '@mui/icons-material/Search'
import ViewListIcon from '@mui/icons-material/ViewList'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import { nanoid } from 'nanoid'
import { useLocation, useNavigate } from 'react-router-dom'

import type { StudyGuideSummary } from '../../cloud/types'
import {
  STUDY_GUIDES_CHANGED_EVENT,
  STUDY_GUIDES_STORAGE_FULL_MESSAGE,
  StudyGuideStorage,
  createStudyGuideRecord,
} from '../../studyGuides/storage'
import {
  buildReadableStudyPathState,
  generateStudyPathStateFromPrompt,
} from '../../studyGuides/generation'
import { getAllUserKnownTopics } from '../../profileContext'
import {
  applyHostedPreviewEvent,
  splitHostedPreviewRows,
  HOSTED_STUDY_GUIDE_PAGE_COUNT,
  HostedPreviewState,
  makeHostedPreviewFromSnapshot,
  mergeHostedPreviewSnapshot,
} from '../../studyGuides/hostedPreview'
import type {
  HostedAiPreviewEvent,
  HostedAiStudyGuideProgress,
} from '../../quickCreate/ai/hostedCredits'
import { foldHostedStudyGuideProgress } from '../../quickCreate/ai/hostedCredits'
import type { HostedStudyGuideJobLookup } from '../../quickCreate/ai/hostedClient'
import {
  getHostedStudyGuideJobs,
  HostedStudyGuideDeadJobError,
  isResumableHostedStudyGuideJob,
} from '../../quickCreate/ai/hostedClient'
import HostedPreviewChecklist from './HostedPreviewChecklist'

/**
 * Runs on the clock rather than on finished steps. Counting milestones made it
 * lurch a quarter at a time and sit still in between, which read as broken; the
 * checklist below already says which step is happening.
 */
const creationProgressPercent = (
  elapsedSeconds: number,
  estimateSeconds: number,
): number => {
  const ratio = elapsedSeconds / Math.max(estimateSeconds, 1)
  return Math.min(95, Math.round(ratio * 100))
}
import {
  normalizeStartNextStudyGuideRequests,
  type StartNextStudyGuideRequest,
} from '../workspace/workspaceEvents'
import {
  deleteHostedAiPodcastAudio,
  HOSTED_AI_INSUFFICIENT_CREDITS_EVENT,
  readQuickCreateAiSettings,
} from '../../quickCreate/ai'
import {
  getHostedAiCreditCost,
  isCurrencyShortageMessage,
} from '../../quickCreate/ai/hostedCredits'
import { collectPodcastAudioPathsFromStudyPath } from '../../studyGuides/podcasts'
import {
  HOSTED_STUDY_GUIDE_AUTO_RETRY_LIMIT,
  HOSTED_STUDY_GUIDE_MANUAL_RETRY_MESSAGE,
  STUDY_GUIDE_CREATION_QUEUE_CHANGED_EVENT,
  getCreationTabId,
  StudyGuideCreationQueueStorage,
  isRetryableStudyGuideCreationError,
  isWithinHostedGatewayStaleWindow,
  type StudyGuideCreationJob,
  type StudyGuideCreationProvider,
  type StudyGuideCreationStatus,
} from '../../studyGuides/creationQueue'
import TopNavBar from '../topnavbar/TopNavBar'
import StudyCreditCostLabel from '../hostedAi/StudyCreditCostLabel'
import StudyCreditIcon from '../hostedAi/StudyCreditIcon'
import { useHostedAiStatus } from '../hostedAi/useHostedAiStatus'
import { useInterfaceText } from '../../language/interfaceLanguage'

type PendingGuide = StudyGuideCreationJob

const MAX_HOSTED_BROWSER_CONCURRENCY = 3
const MAX_LOCAL_BROWSER_CONCURRENCY = 1

/**
 * Jobs this tab is generating right now. Module scope on purpose: a remount
 * gets a fresh ref, and the resume-after-refresh pass would then treat its own
 * in-flight guides as abandoned and pay for each of them twice.
 */
const jobsRunningInThisTab = new Set<string>()

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

/**
 * How long the learner actually waits.
 *
 * For hosted guides that is until page 1 is readable, not until the whole guide
 * is written: the card offers "Start reading" at that point and the rest fills
 * in behind them. Measured at ~17-20s against the real model.
 */
/** How often to re-ask about a job the gateway could not answer for. */
const UNRESOLVED_JOB_RECHECK_MS = 8000

const getGenerationEstimateSeconds = (): number => {
  const provider = readQuickCreateAiSettings().provider || 'hosted'

  if (provider === 'local') {
    return 90
  }

  return provider === 'hosted' ? 20 : 45
}

const getActiveAiProvider = () =>
  readQuickCreateAiSettings().provider || 'hosted'

const studyGuideCreditCost = getHostedAiCreditCost('study-guide')

// 'collecting' is deliberately absent: that guide is already made and paid for,
// so the learner should just see it appear rather than watch it be fetched.
const isVisiblePendingStatus = (status: StudyGuideCreationStatus): boolean =>
  status === 'queued' ||
  status === 'running' ||
  status === 'interrupted' ||
  status === 'failed'

/** Statuses the runner should pick up, visible or not. */
const isRunnablePendingStatus = (status: StudyGuideCreationStatus): boolean =>
  status === 'queued' || status === 'collecting'

/**
 * The shape of the checklist before anything has arrived.
 *
 * A bridge row is only reserved when the learner claimed a skill, since a guide
 * with nothing to bridge from can never produce one.
 */
const previewShape = (job: { knownSkill?: string | null }) => ({
  expectedPages: HOSTED_STUDY_GUIDE_PAGE_COUNT,
  expectsBridge: Boolean(job.knownSkill?.trim()) || getAllUserKnownTopics().length > 0,
})

/**
 * When this generation was first asked for.
 *
 * The gateway's timestamp wins, because it is the same one across every tab
 * and page life. `startedAt` is deliberately never used: it is re-stamped on
 * every attempt, which is what made a refreshed card restart its clock at zero.
 */
const resolveJobStartedAt = (
  serverCreatedAt: string | undefined,
  job: { createdAt: string },
): number => {
  const fromServer = Date.parse(serverCreatedAt || '')
  if (Number.isFinite(fromServer)) {
    return fromServer
  }

  const fromQueue = Date.parse(job.createdAt || '')
  return Number.isFinite(fromQueue) ? fromQueue : Date.now()
}

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

const getCreationErrorMessage = (
  error: unknown,
  t: ReturnType<typeof useInterfaceText>['t'],
): string => {
  if (!(error instanceof Error)) {
    return t('studyGuides.failedMessage')
  }

  return error.message === STUDY_GUIDES_STORAGE_FULL_MESSAGE
    ? t('studyGuides.storageFullMessage')
    : error.message
}

const isLocalProvider = (provider: StudyGuideCreationProvider): boolean =>
  provider === 'local'

const canAutoRetryPendingGuide = (guide: PendingGuide): boolean =>
  guide.provider !== 'hosted' ||
  guide.autoRetryCount < HOSTED_STUDY_GUIDE_AUTO_RETRY_LIMIT

const isStudyCreditShortageMessage = (message?: string | null): boolean =>
  isCurrencyShortageMessage(message)

const shouldShowBuyCreditPack = (
  guide: PendingGuide,
  displayStudyCredits: number | null,
): boolean =>
  guide.provider === 'hosted' &&
  guide.status === 'failed' &&
  displayStudyCredits !== null &&
  displayStudyCredits < studyGuideCreditCost &&
  isStudyCreditShortageMessage(guide.errorMessage)

const openStudyCreditPackDialog = (): void => {
  window.dispatchEvent(
    new CustomEvent(HOSTED_AI_INSUFFICIENT_CREDITS_EVENT, {
      detail: { showNotice: false },
    }),
  )
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

const sortGuides = (
  guides: StudyGuideSummary[],
  sortMode: StudyGuideSortMode,
) =>
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
  const location = useLocation()
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const [guides, setGuides] = useState<StudyGuideSummary[]>([])
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [menuGuide, setMenuGuide] = useState<StudyGuideSummary | null>(null)
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null)
  const [viewMode, setViewMode] =
    useState<StudyGuideViewMode>(readStoredViewMode)
  const [sortMode, setSortMode] =
    useState<StudyGuideSortMode>(readStoredSortMode)
  const [renameGuide, setRenameGuide] = useState<StudyGuideSummary | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createGuidePrompt, setCreateGuidePrompt] = useState('')
  const [multiCreateOpen, setMultiCreateOpen] = useState(false)
  const [multiCreatePrompts, setMultiCreatePrompts] = useState<
    StartNextStudyGuideRequest[]
  >([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [pendingGuides, setPendingGuides] = useState<PendingGuide[]>([])
  const { displayStudyCredits } = useHostedAiStatus()
  const [newlyCreatedGuideIds, setNewlyCreatedGuideIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [now, setNow] = useState(Date.now())
  // Whether pending jobs have been checked against the gateway yet.
  const [jobsReconciled, setJobsReconciled] = useState(false)
  // Hosted jobs the gateway could not answer for. They are still generating as
  // far as anyone knows, so they keep their card and get asked about again.
  const [unresolvedJobIds, setUnresolvedJobIds] = useState<string[]>([])
  const unresolvedJobIdsRef = useRef<string[]>([])
  // Jobs the gateway has answered for and said are not coming back, so they
  // stop being asked about. Only a gateway answer ever puts a job in here.
  const confirmedGoneJobIdsRef = useRef<Set<string>>(new Set())
  // The checklist as folded in this page life, so it can be written to the
  // queue and survive the refresh that throws this component's state away.
  const previewSnapshotsRef = useRef<Record<string, HostedAiStudyGuideProgress>>(
    {},
  )
  // Only a click puts a job in here, and only that authorises the gateway to
  // start a fresh paid generation for it.
  const userRetryJobIdsRef = useRef<Set<string>>(new Set())
  const userRetryJobIds = userRetryJobIdsRef.current
  // Live preview per running hosted job, keyed by job id.
  const [jobPreviews, setJobPreviews] = useState<
    Record<string, HostedPreviewState>
  >({})
  // What the gateway knows about each job: its recorded progress and the time
  // it was first requested. Survives a page life; the preview does not.
  const [jobServerState, setJobServerState] = useState<
    Record<
      string,
      { progress?: HostedAiStudyGuideProgress; createdAt?: string }
    >
  >({})
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
      setGuides(StudyGuideStorage.getSummaries())
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

  // A refresh or a reopened tab lands here with jobs the gateway may already
  // have finished. Asking first is what turns "start again and pay again" into
  // "collect what is already paid for".
  useEffect(() => {
    let cancelled = false

    const askableHostedJobs = (): PendingGuide[] =>
      StudyGuideCreationQueueStorage.getAll().filter(
        (job) =>
          job.provider === 'hosted' &&
          (job.status === 'running' ||
            job.status === 'collecting' ||
            job.status === 'interrupted' ||
            job.status === 'queued' ||
            // A card the queue gave up on may still be a guide the gateway
            // finished. Asking costs nothing, so it is asked about until the
            // gateway itself says the generation is gone.
            (job.status === 'failed' &&
              !confirmedGoneJobIdsRef.current.has(job.id))),
      )

    const reconcile = async () => {
      const hostedJobs = askableHostedJobs()
      let lookup: HostedStudyGuideJobLookup = { jobs: {}, unresolvedIds: [] }
      try {
        lookup = hostedJobs.length
          ? await getHostedStudyGuideJobs(hostedJobs.map((job) => job.id))
          : { jobs: {}, unresolvedIds: [] }
      } catch {
        // Blocked storage, or the gateway could not be reached at all. Nothing
        // is concluded: the jobs stay exactly as they are until an answer
        // arrives, and the retry below asks again.
        lookup = { jobs: {}, unresolvedIds: hostedJobs.map((job) => job.id) }
      }

      const jobs = lookup.jobs

      if (cancelled) {
        return
      }

      try {
        const resumableJobIds = Object.values(jobs)
          .filter((job) => isResumableHostedStudyGuideJob(job))
          .map((job) => job.clientJobId)

        // An answer of "no such job" is only worth acting on once the gateway
        // would have called the generation dead itself. Before that it means a
        // lookup did not land, and treating it as a lost guide is what turned a
        // second refresh into a permanently failed card.
        const waitingJobIds = [...lookup.unresolvedIds]
        hostedJobs.forEach((job) => {
          if (jobs[job.id] || lookup.unresolvedIds.includes(job.id)) {
            return
          }

          if (isWithinHostedGatewayStaleWindow(job)) {
            waitingJobIds.push(job.id)
          } else {
            confirmedGoneJobIdsRef.current.add(job.id)
          }
        })

        // The gateway has spoken on these, so they stop being asked about.
        Object.values(jobs).forEach((job) => {
          if (job.status === 'dead' || job.status === 'failed') {
            confirmedGoneJobIdsRef.current.add(job.clientJobId)
          }
        })

        // A guide that finished while the tab was shut is not "being created".
        // Marking it hides the card, so only the finished guide appears.
        Object.values(jobs).forEach((job) => {
          if (job.status === 'succeeded') {
            StudyGuideCreationQueueStorage.update(job.clientJobId, {
              status: 'collecting',
            })
          }
        })

        setJobServerState(
          Object.fromEntries(
            Object.values(jobs).map((job) => [
              job.clientJobId,
              { progress: job.progress, createdAt: job.createdAt },
            ]),
          ),
        )

        // Paint every card from what this browser last saw, refined by whatever
        // the gateway recorded. Without the local half a refresh showed an
        // empty checklist whenever the gateway had nothing to say.
        setJobPreviews((current) => {
          const next = { ...current }
          hostedJobs.forEach((job) => {
            const serverJob = jobs[job.id]
            if (serverJob?.status === 'succeeded') {
              return
            }

            const startedAt = resolveJobStartedAt(serverJob?.createdAt, job)
            next[job.id] = mergeHostedPreviewSnapshot(
              next[job.id] ||
                makeHostedPreviewFromSnapshot(
                  job.previewSnapshot || undefined,
                  startedAt,
                  previewShape(job),
                ),
              serverJob?.progress,
              startedAt,
              previewShape(job),
            )
          })

          return next
        })

        StudyGuideCreationQueueStorage.requeueRetryableJobs({
          tabId: getCreationTabId(),
          activeJobIds: Array.from(jobsRunningInThisTab),
          resumableJobIds,
          unresolvedJobIds: waitingJobIds,
        })
        loadPendingGuides()
        unresolvedJobIdsRef.current = waitingJobIds
        setUnresolvedJobIds(waitingJobIds)
      } finally {
        // Generation is gated on this, so it has to be set even on failure or
        // nothing would ever run again.
        setJobsReconciled(true)
      }
    }

    void reconcile()

    // Re-ask while anything is unresolved. This costs no Carrots and calls no
    // model, so a gateway that comes back recovers the card on its own instead
    // of leaving the learner with a job frozen mid-generation.
    const retryTimer = window.setInterval(() => {
      // Also covers a card the queue failed: the generation it gave up on may
      // still land, and only asking again turns that back into a guide.
      if (
        !cancelled &&
        (unresolvedJobIdsRef.current.length ||
          askableHostedJobs().some((job) => job.status === 'failed'))
      ) {
        void reconcile()
      }
    }, UNRESOLVED_JOB_RECHECK_MS)

    return () => {
      cancelled = true
      window.clearInterval(retryTimer)
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    loadGuides()
    // Requeueing waits for the gateway's answer, which the reconcile pass
    // above fetches. Picking jobs up before then would spend the retry budget
    // on work the gateway is still doing.
    loadPendingGuides()
    window.addEventListener(STUDY_GUIDES_CHANGED_EVENT, loadGuides)
    window.addEventListener(
      STUDY_GUIDE_CREATION_QUEUE_CHANGED_EVENT,
      loadPendingGuides,
    )
    window.addEventListener('storage', loadGuides)
    window.addEventListener('storage', loadPendingGuides)

    // Closing the tab kills its requests, so park whatever it was generating
    // for whichever tab opens next. Unmounting is not this: a guide keeps
    // generating and saving when the user navigates inside the app.
    const parkRunningJobs = () => {
      StudyGuideCreationQueueStorage.markJobsInterrupted(
        Array.from(jobsRunningInThisTab),
      )
    }

    window.addEventListener('beforeunload', parkRunningJobs)
    window.addEventListener('pagehide', parkRunningJobs)

    return () => {
      window.removeEventListener('beforeunload', parkRunningJobs)
      window.removeEventListener('pagehide', parkRunningJobs)
      isMountedRef.current = false
      // Deliberately not aborting: the Carrots for an in-flight guide are
      // already spent, so killing it here threw the money away and the resume
      // pass then paid a second time for the same guide. `isMountedRef` is what
      // keeps a finished job from touching state after unmount.
      window.removeEventListener(STUDY_GUIDES_CHANGED_EVENT, loadGuides)
      window.removeEventListener(
        STUDY_GUIDE_CREATION_QUEUE_CHANGED_EVENT,
        loadPendingGuides,
      )
      window.removeEventListener('storage', loadGuides)
      window.removeEventListener('storage', loadPendingGuides)
    }
  }, [])

  // Follow-up guides picked at the end of a quiz arrive as router state, and a
  // single guide asked for from a grown page arrives the same way. The state is
  // cleared right away so a reload does not reopen the dialog.
  useEffect(() => {
    const handedOver = location.state as {
      createGuidePrompts?: unknown
      createGuidePrompt?: unknown
    } | null
    const singlePrompt =
      typeof handedOver?.createGuidePrompt === 'string'
        ? handedOver.createGuidePrompt.trim()
        : ''
    if (singlePrompt) {
      setCreateGuidePrompt(singlePrompt)
      setCreateOpen(true)
      navigate(location.pathname, { replace: true, state: null })
      return
    }

    const prompts = normalizeStartNextStudyGuideRequests(
      handedOver?.createGuidePrompts,
    )
    if (!prompts.length) {
      return
    }

    setMultiCreatePrompts(prompts)
    setMultiCreateOpen(true)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

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

  const enqueueCreateGuide = (
    prompt: string,
    id = nanoid(),
    knownSkill: string | null = null,
  ) => {
    const provider = getActiveAiProvider()
    const estimateSeconds = getGenerationEstimateSeconds()
    let pendingGuide: PendingGuide

    try {
      pendingGuide = StudyGuideCreationQueueStorage.upsert({
        id,
        prompt,
        knownSkill,
        provider,
        status: 'queued',
        estimateSeconds,
        autoRetryCount: 0,
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
        resultStudyGuideId: null,
        // The tab that pressed Create is the one that runs and pays for it.
        ownerTabId: getCreationTabId(),
      })
    } catch (error) {
      const timestamp = new Date().toISOString()
      pendingGuide = {
        id,
        prompt,
        knownSkill,
        provider,
        status: 'failed',
        createdAt: timestamp,
        updatedAt: timestamp,
        estimateSeconds,
        autoRetryCount: 0,
        startedAt: null,
        finishedAt: timestamp,
        errorMessage: getCreationErrorMessage(error, t),
        resultStudyGuideId: null,
      }
    }

    setPendingGuides((current) =>
      sortPendingGuidesForDisplay([
        pendingGuide,
        ...current.filter((guide) => guide.id !== id),
      ]),
    )
    setCreateOpen(false)
    if (pendingGuide.status !== 'failed') {
      setCreateGuidePrompt('')
    }
  }

  const retryPendingGuide = (guide: PendingGuide) => {
    let updatedGuide: PendingGuide | null = null

    // A retry is a new generation, not a resume of the old one, so the card
    // starts over. Keeping the original clock and progress would show a bar
    // near the end and a minute already elapsed for work just beginning.
    setJobPreviews((current) => {
      if (!current[guide.id]) {
        return current
      }

      const next = { ...current }
      delete next[guide.id]
      return next
    })
    setJobServerState((current) => ({
      ...current,
      [guide.id]: { createdAt: new Date().toISOString() },
    }))
    userRetryJobIdsRef.current.add(guide.id)
    // A retry is a fresh generation, so the old checklist must not survive it.
    confirmedGoneJobIdsRef.current.delete(guide.id)
    delete previewSnapshotsRef.current[guide.id]

    try {
      updatedGuide = StudyGuideCreationQueueStorage.update(guide.id, {
        status: 'queued',
        startedAt: null,
        finishedAt: null,
        autoRetryCount: 0,
        errorMessage: null,
        previewSnapshot: null,
      })
    } catch (error) {
      setPendingGuides((current) =>
        current.map((item) =>
          item.id === guide.id
            ? {
                ...item,
                status: 'failed',
                errorMessage: getCreationErrorMessage(error, t),
              }
            : item,
        ),
      )
      return
    }

    if (!updatedGuide) {
      enqueueCreateGuide(guide.prompt, guide.id, guide.knownSkill ?? null)
      return
    }

    loadPendingGuides()
  }

  const deletePendingGuide = (guide: PendingGuide) => {
    activeJobsRef.current.get(guide.id)?.controller.abort()

    try {
      StudyGuideCreationQueueStorage.remove(guide.id)
      loadPendingGuides()
    } catch {
      setPendingGuides((current) =>
        current.filter((item) => item.id !== guide.id),
      )
    }
  }

  /**
   * Saves the page-1 guide so the learner can open it while the rest is still
   * being written. `resultStudyGuideId` is what the card reads to offer the
   * button, and the finished guide later overwrites this same record.
   */
  const saveReadableGuide = async (job: PendingGuide, guideText: string) => {
    try {
      const studyPath = await buildReadableStudyPathState({
        id: job.id,
        prompt: job.prompt,
        guideText,
      })
      if (!isMountedRef.current) {
        return
      }

      StudyGuideStorage.save({
        ...createStudyGuideRecord(studyPath, { id: job.id }),
        description: job.prompt,
      })
      // 'collecting' hides the creating card while the job keeps running, so
      // the learner just sees a finished guide with the pages it has so far.
      StudyGuideCreationQueueStorage.update(job.id, {
        status: 'collecting',
        resultStudyGuideId: job.id,
      })
      loadGuides()
    } catch (error) {
      // Purely an early bonus: the full guide is still coming, so this must not
      // touch the generation or the queue. It is still loud, because a silent
      // failure here looks exactly like the feature not existing.
      console.error(
        '[studyGuides] page 1 was streamed but could not be made readable, so "Start reading" will not appear',
        error,
      )
    }
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
    jobsRunningInThisTab.add(job.id)
    const isCollecting = job.status === 'collecting'
    StudyGuideCreationQueueStorage.update(job.id, {
      // A collecting job stays hidden: it is being fetched, not created.
      status: isCollecting ? 'collecting' : 'running',
      startedAt,
      finishedAt: null,
      errorMessage: null,
    })
    if (job.provider === 'hosted' && !isCollecting) {
      // Seeded from what this browser last saw, then refined by whatever the
      // gateway recorded, so a resumed card shows the real checklist instead of
      // an empty one that looks stuck.
      const known = jobServerState[job.id]
      const startedAt = resolveJobStartedAt(known?.createdAt, job)
      previewSnapshotsRef.current[job.id] = job.previewSnapshot || {}
      setJobPreviews((current) => ({
        ...current,
        [job.id]: mergeHostedPreviewSnapshot(
          current[job.id] ||
            makeHostedPreviewFromSnapshot(
              job.previewSnapshot || undefined,
              startedAt,
              previewShape(job),
            ),
          known?.progress,
          startedAt,
          previewShape(job),
        ),
      }))
    }

    const handlePreview = (event: HostedAiPreviewEvent) => {
      if (generationController.signal.aborted) {
        return
      }

      // Kept in the queue so a refresh repaints the checklist from localStorage
      // straight away, whether or not the gateway managed to record it.
      const previousSnapshot = previewSnapshotsRef.current[job.id] || {}
      const snapshot = foldHostedStudyGuideProgress(previousSnapshot, event)
      if (snapshot !== previousSnapshot) {
        previewSnapshotsRef.current[job.id] = snapshot
        StudyGuideCreationQueueStorage.update(job.id, {
          previewSnapshot: snapshot,
        })
      }

      // Page 1 is written, so there is already a guide worth opening. Saving it
      // now is what turns a 45s wait into a ~17s one; the rest keeps generating
      // and overwrites this with the finished guide.
      if (event.type === 'readableGuide') {
        void saveReadableGuide(job, event.text)
        return
      }

      setJobPreviews((current) => {
        const preview = current[job.id]
        return preview
          ? { ...current, [job.id]: applyHostedPreviewEvent(preview, event) }
          : current
      })
    }

    // Fires when this call attached to a generation already in flight.
    const handleResumed = (state: {
      progress?: HostedAiStudyGuideProgress
      createdAt?: string
    }) => {
      if (generationController.signal.aborted) {
        return
      }

      setJobServerState((current) => ({
        ...current,
        [job.id]: { ...current[job.id], ...state },
      }))
      const startedAt = resolveJobStartedAt(
        state.createdAt || jobServerState[job.id]?.createdAt,
        job,
      )
      setJobPreviews((current) => ({
        ...current,
        // Merged, never replaced: a gateway with no progress column answers
        // with an empty snapshot every poll, and overwriting with it is what
        // left the card showing a blank checklist for the whole generation.
        [job.id]: mergeHostedPreviewSnapshot(
          current[job.id],
          state.progress,
          startedAt,
          previewShape(job),
        ),
      }))
    }

    const clearPreview = () =>
      setJobPreviews((current) => {
        if (!current[job.id]) {
          return current
        }

        const next = { ...current }
        delete next[job.id]
        return next
      })

    try {
      const studyPath = await generateStudyPathStateFromPrompt({
        id: job.id,
        prompt: job.prompt,
        knownSkill: job.knownSkill,
        provider: job.provider,
        signal: generationController.signal,
        onPreview: job.provider === 'hosted' ? handlePreview : undefined,
        onResumed: job.provider === 'hosted' ? handleResumed : undefined,
        // Only ever set by the retry button. Deriving it from autoRetryCount
        // let an automatic requeue authorise the gateway to abandon a stale job
        // and start a fresh paid generation that nobody asked for.
        retry: job.provider === 'hosted' ? userRetryJobIds.has(job.id) : undefined,
      })
      clearPreview()
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
      // The gateway says this generation stopped and is not coming back.
      // Restarting spends Carrots, so it waits for the learner to ask.
      const isDead = error instanceof HostedStudyGuideDeadJobError
      const canAutoRetry =
        !isDead &&
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
          (isDead || isRetryableStudyGuideCreationError(errorMessage)) &&
          job.provider === 'hosted'
            ? HOSTED_STUDY_GUIDE_MANUAL_RETRY_MESSAGE
            : nextStatus === 'failed'
              ? errorMessage
              : null,
      })
    } finally {
      clearPreview()
      activeJobsRef.current.delete(job.id)
      jobsRunningInThisTab.delete(job.id)
      loadPendingGuides()
    }
  }

  useEffect(() => {
    if (!jobsReconciled) {
      return
    }

    const activeJobs = Array.from(activeJobsRef.current.values())
    let availableLocalSlots =
      MAX_LOCAL_BROWSER_CONCURRENCY -
      activeJobs.filter((job) => isLocalProvider(job.provider)).length
    let availableRemoteSlots =
      MAX_HOSTED_BROWSER_CONCURRENCY -
      activeJobs.filter((job) => !isLocalProvider(job.provider)).length

    // Only what this tab owns. The queue is shared through localStorage, so
    // every open tab used to run the same job and the account paid once per
    // tab. A job with no owner predates the field and stays adoptable.
    const tabId = getCreationTabId()
    // Read from storage, not the rendered list: a 'collecting' job has to run
    // without ever being shown.
    const queuedJobs = StudyGuideCreationQueueStorage.getAll()
      .filter(
        (guide) =>
          isRunnablePendingStatus(guide.status) &&
          (!guide.ownerTabId || guide.ownerTabId === tabId),
      )
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
  }, [jobsReconciled, pendingGuides])

  const submitCreateGuide = async () => {
    const prompt = createGuidePrompt.trim()
    if (!prompt) {
      return
    }

    enqueueCreateGuide(prompt)
  }

  // The queue runner already spreads jobs over its slots, so several guides
  // only need several enqueues.
  const submitMultiCreateGuides = () => {
    multiCreatePrompts.forEach((request) =>
      enqueueCreateGuide(request.prompt, nanoid(), request.knownSkill || null),
    )
    setMultiCreateOpen(false)
    setMultiCreatePrompts([])
  }

  const openMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    guide: StudyGuideSummary,
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
    const fullGuide = StudyGuideStorage.getById(menuGuide.id)
    if (!fullGuide) {
      navigate(`/workspace/${menuGuide.id}`)
      closeMenu()
      return
    }

    const id = nanoid()
    const title = `${menuGuide.title} copy`
    StudyGuideStorage.save({
      ...fullGuide,
      id,
      title,
      folderName: title,
      pinnedAt: null,
      studyPath: {
        ...fullGuide.studyPath,
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
      const fullGuide = StudyGuideStorage.getById(menuGuide.id)
      if (fullGuide) {
        collectPodcastAudioPathsFromStudyPath(fullGuide.studyPath).forEach(
          (audioPath) => {
            void deleteHostedAiPodcastAudio(
              audioPath,
              'study-guide-deleted',
            ).catch(() => undefined)
          },
        )
      }
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
              disableRipple
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
          {/* Held until the gateway has been asked, so a guide that already
              finished never flashes an "interrupted" card on the way in. */}
          {(jobsReconciled ? pendingGuides : []).map((guide) => {
            const elapsedSeconds = Math.max(
              0,
              Math.floor(
                (now -
                  resolveJobStartedAt(
                    jobServerState[guide.id]?.createdAt,
                    guide,
                  )) /
                  1000,
              ),
            )
            const preview = jobPreviews[guide.id]
            const isReadable = Boolean(guide.resultStudyGuideId)
            // Reaching page 1 is what fills it, whenever that happens.
            const firstBarPercent = isReadable
              ? 100
              : creationProgressPercent(elapsedSeconds, guide.estimateSeconds)
            const previewRows = preview
              ? splitHostedPreviewRows(preview, t)
              : null
            const estimateSuffix = ` · ${t(
              'studyGuides.estimatedTotal',
            )} ${formatDuration(guide.estimateSeconds)}`
            const isProblem =
              guide.status === 'failed' || guide.status === 'interrupted'
            const isRunning = guide.status === 'running'
            const showBuyCreditPack = shouldShowBuyCreditPack(
              guide,
              displayStudyCredits,
            )
            return (
              <Paper
                key={guide.id}
                elevation={0}
                sx={(theme) => ({
                  alignSelf: 'start',
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
                <Stack spacing={1.75} sx={{ height: '100%' }}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Box
                      sx={(theme) => ({
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        bgcolor: isProblem
                          ? alpha(theme.palette.error.main, 0.1)
                          : alpha(theme.palette.primary.main, 0.1),
                        color: isProblem ? 'error.main' : 'primary.main',
                      })}
                    >
                      {isProblem ? (
                        <ErrorOutlineIcon fontSize="small" />
                      ) : (
                        <AutoAwesomeIcon fontSize="small" />
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="caption"
                        color={isProblem ? 'error.main' : 'primary.main'}
                        fontWeight={700}
                      >
                        {getPendingStatusLabel(guide.status, t)}
                      </Typography>
                      <Typography
                        variant="subtitle1"
                        fontWeight={700}
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.22,
                        }}
                      >
                        {guide.prompt}
                      </Typography>
                    </Box>
                    {!isProblem ? (
                      <Tooltip title={t('studyGuides.cancel')}>
                        <IconButton
                          size="small"
                          aria-label={t('studyGuides.cancel')}
                          onClick={() => deletePendingGuide(guide)}
                          sx={(theme) => ({
                            flexShrink: 0,
                            color: 'text.secondary',
                            bgcolor: 'transparent',
                            border: 1,
                            borderColor: 'transparent',
                            '&:hover': {
                              color: 'error.main',
                              bgcolor: alpha(theme.palette.error.main, 0.08),
                              borderColor: alpha(
                                theme.palette.error.main,
                                0.18,
                              ),
                            },
                            '&.Mui-disabled': {
                              color: 'action.disabled',
                              bgcolor: 'transparent',
                              borderColor: 'transparent',
                            },
                          })}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Stack>
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
                        sx={{ width: '100%', flexWrap: 'wrap', gap: 1 }}
                      >
                        {showBuyCreditPack ? (
                          <Button
                            variant="contained"
                            size="small"
                            onClick={openStudyCreditPackDialog}
                            sx={{
                              borderRadius: 2,
                              textTransform: 'none',
                              fontWeight: 700,
                            }}
                          >
                            <Stack
                              component="span"
                              direction="row"
                              spacing={0.75}
                              alignItems="center"
                            >
                              <span>{t('studyGuides.buyCreditPack')}</span>
                              <StudyCreditIcon size={16} />
                            </Stack>
                          </Button>
                        ) : (
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
                            {guide.provider === 'hosted' ? (
                              <Stack
                                component="span"
                                direction="row"
                                spacing={0.75}
                                alignItems="center"
                              >
                                <span>{t('studyGuides.retry')}</span>
                                <StudyCreditCostLabel
                                  amount={studyGuideCreditCost}
                                  variant="badge"
                                />
                              </Stack>
                            ) : (
                              t('studyGuides.retry')
                            )}
                          </Button>
                        )}
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
                    <Stack spacing={1.25} sx={{ flex: 1 }}>
                      {isRunning ? (
                        <Box
                          sx={(theme) => ({
                            p: 1.25,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.055),
                          })}
                        >
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{ mb: 1 }}
                          >
                            <Typography
                              variant="body2"
                              color="primary.main"
                              fontWeight={700}
                            >
                              {firstBarPercent}%
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ whiteSpace: 'nowrap' }}
                            >
                              {t('studyGuides.elapsed')}{' '}
                              {formatDuration(elapsedSeconds)}
                              {isReadable ? null : estimateSuffix}
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={firstBarPercent}
                            aria-label={`${firstBarPercent}%`}
                            sx={(theme) => ({
                              height: 9,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.primary.main, 0.14),
                              '& .MuiLinearProgress-bar': { borderRadius: 1 },
                            })}
                          />

                          {/* Shown from the first frame. Every row is a
                              placeholder until it fills, so the learner knows
                              the shape of the wait immediately. */}
                          {preview && previewRows ? (
                            <Box sx={{ mt: 1.25 }}>
                              <HostedPreviewChecklist
                                preview={preview}
                                rows={previewRows.upToFirstPage}
                                t={t}
                              />
                            </Box>
                          ) : null}
                        </Box>
                      ) : (
                        <Box
                          sx={(theme) => ({
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.055),
                          })}
                        >
                          <Typography variant="body2" color="text.secondary">
                            {t('studyGuides.waiting')} ·{' '}
                            {t('studyGuides.estimate')}{' '}
                            {formatDuration(guide.estimateSeconds)}
                          </Typography>
                        </Box>
                      )}
                      {isRunning && unresolvedJobIds.includes(guide.id) ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ px: 0.5 }}
                        >
                          {t('studyGuides.reconnecting')}
                        </Typography>
                      ) : null}
                      {/* Hosted generation runs on the server, so closing the
                          tab is safe. Local and bring-your-own providers still
                          generate in this tab and genuinely do need it open. */}
                      {isRunning && guide.provider !== 'hosted' ? (
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="flex-start"
                          sx={{ color: 'text.secondary', px: 0.5 }}
                        >
                          <InfoOutlinedIcon
                            sx={{ fontSize: 17, mt: '1px', flexShrink: 0 }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: '0.735rem',
                              lineHeight: 1.35,
                              whiteSpace: { sm: 'nowrap' },
                            }}
                          >
                            {t('studyGuides.keepTabOpenNotice')}
                          </Typography>
                        </Stack>
                      ) : null}
                    </Stack>
                  )}
                </Stack>
              </Paper>
            )
          })}
          {viewMode === 'grid'
            ? filteredGuides.map((guide) => {
                const pageCount = guide.pageCount ?? 0
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
                            guide.firstPageTitle ||
                            t('studyGuides.openWorkspace')}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {formatGuideDate(guide.createdAt, t, language)} &middot;{' '}
                        {pageCount > 0
                          ? `${pageCount} ${
                              pageCount === 1
                                ? t('studyGuides.page')
                                : t('studyGuides.pages')
                            }`
                          : t('studyGuides.openWorkspace')}
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
            <Table
              size="small"
              aria-label={`${t('studyGuides.title')} ${t(
                'studyGuides.listView',
              )}`}
            >
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
                  const pageCount = guide.pageCount ?? 0
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
                        {pageCount > 0
                          ? `${pageCount} ${
                              pageCount === 1
                                ? t('studyGuides.page')
                                : t('studyGuides.pages')
                            }`
                          : '-'}
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
                          guide.firstPageTitle ||
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
        disableRestoreFocus
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
            <Stack
              component="span"
              direction="row"
              spacing={1}
              alignItems="center"
            >
              <span>{t('studyGuides.createGuide')}</span>
              {getActiveAiProvider() === 'hosted' ? (
                <StudyCreditCostLabel
                  amount={studyGuideCreditCost}
                  variant="contained"
                />
              ) : null}
            </Stack>
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={multiCreateOpen}
        onClose={() => setMultiCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 600 }}>
          {t('studyGuides.multiCreateTitle').replace(
            '{count}',
            String(multiCreatePrompts.length),
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {multiCreatePrompts.map((request) => (
              <Paper
                key={request.prompt}
                variant="outlined"
                sx={{ p: 1.5, borderRadius: 2 }}
              >
                <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                  {request.prompt}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMultiCreateOpen(false)}>
            {t('studyGuides.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={submitMultiCreateGuides}
            disabled={!multiCreatePrompts.length}
          >
            <Stack
              component="span"
              direction="row"
              spacing={1}
              alignItems="center"
            >
              <span>
                {t('studyGuides.multiCreateConfirm').replace(
                  '{count}',
                  String(multiCreatePrompts.length),
                )}
              </span>
              {getActiveAiProvider() === 'hosted' ? (
                <StudyCreditCostLabel
                  amount={studyGuideCreditCost * multiCreatePrompts.length}
                  variant="contained"
                />
              ) : null}
            </Stack>
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default StudyGuidesPage
