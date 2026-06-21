import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import AddIcon from '@mui/icons-material/Add'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import QuizIcon from '@mui/icons-material/Quiz'
import RouteIcon from '@mui/icons-material/Route'
import StyleIcon from '@mui/icons-material/Style'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import LoopIcon from '@mui/icons-material/Loop'

import {
  OPEN_CREATE_HUB_EVENT,
  OPEN_STUDY_PATH_EVENT,
  useWorkspaceActions,
} from '../../customHooks/useWorkspaceActions'
import { dispatchWorkspaceOnboardingEvent } from '../onboarding/onboardingEvents'
import CreateStudyGuideModal from '../studyGuides/CreateStudyGuideModal'
import StrongAiSessionKeyDialog from '../ai/StrongAiSessionKeyDialog'
import {
  generateQuickCreateWithAi,
  isStrongAiProvider,
  readQuickCreateAiSettings,
  resolveQuickCreateAiCredentials,
  StrongAiProviderId,
  QUICK_CREATE_AI_SETTINGS_CHANGED_EVENT,
  StudyMaterialDetailLevel,
  StudyMaterialResourceType,
  QuickCreateAiProvider,
} from '../../quickCreate/ai'
import { useDashboards } from '../Dasboard/DashboardProvider'
import { createStudyPathContainerState } from '../Dasboard/studyPathContainer'
import {
  buildDashboardChatContext,
  formatDashboardChatContext,
} from '../../dashboardChat/contextBuilder'
import {
  dispatchWorkspaceCreationStatus,
  WorkspaceCreationTask,
  WorkspaceCreationTaskState,
} from '../../workspaceCreationStatus'
import {
  CLOSE_CREATE_STUDIO_EVENT,
  CLOSE_DASHBOARD_CHAT_EVENT,
  OPEN_DASHBOARD_CHAT_EVENT,
} from './workspaceEvents'
import {
  createGenerationDraft,
  CreationFlow,
  GenerationDraft,
  OpenCreateHubDetail,
  readIsAdmin,
  quickCreateAccents,
  quickCreateDetailToAmount,
  quickCreateFolders,
  quickCreateLabels,
  quickCreateTargets,
  statusMarkerGlow,
  studioPanelMaxWidth,
  studioPanelMinWidth,
  studioPanelRailWidth,
  studioPanelWidth,
  StudioFlow,
} from './workspaceStudioModel'
import {
  WorkspaceDesktopLayout,
  WorkspaceMobileLayout,
} from './WorkspaceStudioLayouts'
import { createQuickCreateOrchestratorWidgets } from '../../quickCreate'
import { augmentQuickCreatePracticeObjects } from '../../quickCreate/practice'
import { StudyObject } from '../../quickCreate/types'
import { useResponsiveWorkspaceMode } from './useResponsiveWorkspaceMode'
import StudyBlockView, { isStudyBlockType } from '../study/StudyBlockView'

const quickCreateIcons: Record<StudyMaterialResourceType, React.ReactNode> = {
  quiz: <QuizIcon fontSize="small" />,
  flashcards: <StyleIcon fontSize="small" />,
  improvedNotes: <AutoStoriesIcon fontSize="small" />,
}

const GENERATION_RETRY_STORE_KEY = 'studymesh-generation-retry-snapshots'
const GENERATION_QUEUE_STORE_KEY = 'studymesh-generation-queue-v1'

interface QuickCreateRetrySnapshot {
  flow: 'quick-create'
  resourceType: StudyMaterialResourceType
  sourceText: string
  title: string
  detailLevel: StudyMaterialDetailLevel
  difficulty: string
  provider: QuickCreateAiProvider
}

type GenerationRetrySnapshot = QuickCreateRetrySnapshot


const detailLevelCountLimits: Record<
  StudyMaterialResourceType,
  Record<StudyMaterialDetailLevel, { max: number }>
> = {
  improvedNotes: {
    short: { max: 700 },
    medium: { max: 1400 },
    long: { max: 2600 },
  },
  flashcards: {
    short: { max: 30 },
    medium: { max: 50 },
    long: { max: 65 },
  },
  quiz: {
    short: { max: 30 },
    medium: { max: 50 },
    long: { max: 65 },
  },
}

const getPackId = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'quick-create'

const truncateQuickCreationContext = (title: string) => {
  const cleaned = title.trim() || 'Sources'
  return cleaned.length > 28 ? `${cleaned.slice(0, 27).trim()}...` : cleaned
}

const getSavedDashboardNames = () => {
  try {
    const dashboards = window.localStorage.getItem('customDashboards')
    if (!dashboards) {
      return []
    }

    const parsed = JSON.parse(dashboards) as Array<{ name?: unknown }>
    return parsed
      .map((dashboard) => dashboard.name)
      .filter((name): name is string => typeof name === 'string')
  } catch (error) {
    console.error('Failed to read saved dashboard names', error)
    return []
  }
}

const isReviewableStudyObject = (object: StudyObject) =>
  object.kind === 'qa' ||
  object.kind === 'quiz' ||
  object.kind === 'term' ||
  object.kind === 'code' ||
  object.kind === 'comparison' ||
  object.kind === 'list' ||
  object.kind === 'table' ||
  object.kind === 'reviewPrompt'

const getReviewableObjects = (
  objects: StudyObject[],
  resourceType: StudyMaterialResourceType,
  detailLevel: StudyMaterialDetailLevel,
) => {
  const filtered = objects.filter((object) =>
    resourceType === 'improvedNotes'
      ? object.kind === 'markdown'
      : isReviewableStudyObject(object),
  )

  if (resourceType !== 'flashcards' && resourceType !== 'quiz') {
    return filtered
  }

  const quizFiltered =
    resourceType === 'quiz'
      ? filtered.map((object) =>
          object.kind === 'quiz' && object.quizMode === 'shortAnswer'
            ? {
                ...object,
                quizMode: 'multipleChoice' as const,
                options: [
                  object.answer,
                  'Not supported by the source notes',
                  'The opposite of the source explanation',
                ].filter(Boolean),
                correctIndex: 0,
              }
            : object,
        )
      : filtered

  return quizFiltered.slice(
    0,
    detailLevelCountLimits[resourceType][detailLevel].max,
  )
}

const resourceTypeTitle = (resourceType?: string | null) => {
  if (resourceType === 'flashcards') {
    return 'Flashcards'
  }

  if (resourceType === 'quiz') {
    return 'Quiz'
  }

  if (resourceType === 'improvedNotes') {
    return 'Expand on this'
  }

  return 'Dashboard'
}

const generationMaterialLabel = (draft: GenerationDraft) => {
  if (draft.flow === 'study-path') {
    return 'study guide'
  }

  if (draft.selectedResourceType === 'quiz') {
    return 'quiz'
  }

  if (draft.selectedResourceType === 'flashcards') {
    return 'flashcards'
  }

  if (draft.selectedResourceType === 'improvedNotes') {
    return 'Expand on this'
  }

  return 'material'
}

const formatQueueDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes <= 0) {
    return `${Math.max(1, seconds)}s`
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

const estimateQueueDuration = (draft: GenerationDraft) => {
  if (draft.aiProvider === 'local') {
    if (draft.flow === 'study-path') {
      return 'est. 15-20m'
    }

    return 'est. 2m-10m'
  }

  if (draft.aiProvider === 'gemini') {
    if (draft.detailLevel === 'long') {
      return 'est. 1-2m'
    }

    return 'est. 30-60s'
  }

  if (draft.aiProvider === 'cerebras') {
    return 'est. 2-10s'
  }

  return ''
}

const sanitizePersistedGenerationDraft = (
  value: unknown,
): GenerationDraft | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const draft = value as Partial<GenerationDraft>
  if (
    typeof draft.id !== 'string' ||
    (draft.flow !== 'study-path' && draft.flow !== 'quick-create') ||
    typeof draft.title !== 'string' ||
    typeof draft.createdAt !== 'string'
  ) {
    return null
  }

  if (
    draft.aiProvider &&
    draft.aiProvider !== 'hosted' &&
    draft.aiProvider !== 'local' &&
    !isStrongAiProvider(draft.aiProvider)
  ) {
    return null
  }

  const status =
    draft.status === 'generating'
      ? 'failed'
      : draft.status === 'ready' ||
        draft.status === 'failed' ||
        draft.status === 'cancelled'
      ? draft.status
      : null

  if (!status) {
    return null
  }

  return {
    ...draft,
    id: draft.id,
    flow: draft.flow,
    title: draft.title,
    createdAt: draft.createdAt,
    inputSummary: draft.inputSummary || '',
    status,
    error:
      draft.status === 'generating'
        ? 'Generation was interrupted by a page refresh. Retry to continue.'
        : draft.error,
    completedAt:
      draft.status === 'generating'
        ? new Date().toISOString()
        : draft.completedAt,
    isPlaceholder: false,
  } as GenerationDraft
}

const readPersistedGenerationQueue = (): GenerationDraft[] => {
  try {
    const stored = window.localStorage.getItem(GENERATION_QUEUE_STORE_KEY)
    if (!stored) {
      return []
    }

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map(sanitizePersistedGenerationDraft)
      .filter((draft): draft is GenerationDraft => Boolean(draft))
  } catch (error) {
    console.error('Failed to read generation queue', error)
    return []
  }
}

const writePersistedGenerationQueue = (drafts: GenerationDraft[]) => {
  try {
    const queueDrafts = drafts.filter(
      (draft) => !draft.isPlaceholder && draft.status !== 'editing',
    )
    window.localStorage.setItem(
      GENERATION_QUEUE_STORE_KEY,
      JSON.stringify(queueDrafts),
    )
  } catch (error) {
    console.error('Failed to persist generation queue', error)
  }
}

const readGenerationRetrySnapshots = () => {
  try {
    const stored = window.localStorage.getItem(GENERATION_RETRY_STORE_KEY)
    return stored
      ? (JSON.parse(stored) as Record<string, GenerationRetrySnapshot>)
      : {}
  } catch (error) {
    console.error('Failed to read generation retry snapshots', error)
    return {}
  }
}

const writeGenerationRetrySnapshots = (
  snapshots: Record<string, GenerationRetrySnapshot>,
) => {
  try {
    window.localStorage.setItem(
      GENERATION_RETRY_STORE_KEY,
      JSON.stringify(snapshots),
    )
  } catch (error) {
    console.error('Failed to write generation retry snapshots', error)
  }
}

const saveGenerationRetrySnapshot = (
  draftId: string,
  snapshot: GenerationRetrySnapshot,
) => {
  writeGenerationRetrySnapshots({
    ...readGenerationRetrySnapshots(),
    [draftId]: snapshot,
  })
}

const removeGenerationRetrySnapshot = (draftId: string) => {
  const snapshots = readGenerationRetrySnapshots()
  if (!snapshots[draftId]) {
    return
  }

  const { [draftId]: _removed, ...remaining } = snapshots
  writeGenerationRetrySnapshots(remaining)
}

const getGenerationRetrySnapshot = (draftId: string) =>
  readGenerationRetrySnapshots()[draftId]

const formatDraftTitle = (draft: GenerationDraft) => {
  const base = draft.title.trim()
  const shortTitle = base.length > 46 ? `${base.slice(0, 45).trim()}...` : base

  if (draft.flow === 'study-path') {
    return `Study Guide: ${shortTitle || 'Untitled'}`
  }

  return `${resourceTypeTitle(draft.selectedResourceType)} from ${
    draft.inputSummary || shortTitle || 'notes'
  }`
}

const isTerminalGenerationStatus = (draft: GenerationDraft) =>
  draft.status === 'ready' ||
  draft.status === 'failed' ||
  draft.status === 'cancelled'

const WorkspaceStudioShell = ({ children }: { children: React.ReactNode }) => {
  const { theme, isPhoneOrTablet: isMobile } = useResponsiveWorkspaceMode()
  const initialDrafts = useMemo(() => {
    const placeholders = [
      createGenerationDraft('study-path', { isPlaceholder: true }),
      createGenerationDraft('quick-create', { isPlaceholder: true }),
    ]

    return [...placeholders, ...readPersistedGenerationQueue()]
  }, [])
  const [isStudioOpen, setIsStudioOpen] = useState(() => !isMobile)
  const [studioWidth, setStudioWidth] = useState(studioPanelWidth)
  const [mobileSection, setMobileSection] = useState<
    'creation' | 'dashboard' | 'ai-chat'
  >('dashboard')
  const [activeFlow, setActiveFlow] = useState<StudioFlow>('hub')
  const [generationDrafts, setGenerationDrafts] =
    useState<GenerationDraft[]>(initialDrafts)
  const [activeDraftByFlow, setActiveDraftByFlow] = useState<
    Record<CreationFlow, string>
  >(() => ({
    'study-path':
      initialDrafts.find(
        (draft) => draft.flow === 'study-path' && draft.isPlaceholder,
      )?.id || initialDrafts[0].id,
    'quick-create':
      initialDrafts.find(
        (draft) => draft.flow === 'quick-create' && draft.isPlaceholder,
      )?.id || initialDrafts[1].id,
  }))
  const openingMobileAiChatRef = useRef(false)
  const [aiProvider, setAiProvider] = useState(
    () => readQuickCreateAiSettings().provider || 'hosted',
  )
  const [studyPathPrompt, setStudyPathPrompt] = useState('')
  const [studyPathPromptError, setStudyPathPromptError] = useState('')
  const [studyPathAutoGenerateRequest, setStudyPathAutoGenerateRequest] =
    useState<{ id: number; draftId: string; prompt: string } | undefined>(
      undefined,
    )
  const [quickDetailLevel] = useState<StudyMaterialDetailLevel>('medium')
  const [quickDifficulty] = useState('standard')
  const [quickCreateStatus, setQuickCreateStatus] = useState('')
  const [sessionKeyRequest, setSessionKeyRequest] = useState<{
    provider: StrongAiProviderId
    model: string
    retry:
      | {
          kind: 'quick-create'
          resourceType: StudyMaterialResourceType
          sourceText: string
          title: string
          retryOptions?: {
            draftId?: string
            detailLevel?: StudyMaterialDetailLevel
            difficulty?: string
            provider?: QuickCreateAiProvider
          }
        }
      | {
          kind: 'study-path'
          prompt: string
      }
  } | null>(null)
  const [queueClockMs, setQueueClockMs] = useState(() => Date.now())
  const [studyPathRetrySignals, setStudyPathRetrySignals] = useState<
    Record<string, number>
  >({})
  const [studyPathCancelSignals, setStudyPathCancelSignals] = useState<
    Record<string, number>
  >({})
  const [activeMaterialDraftId, setActiveMaterialDraftId] = useState<
    string | null
  >(null)
  const [visibleQueueJobIds, setVisibleQueueJobIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [autoAcknowledgingDraftIds, setAutoAcknowledgingDraftIds] = useState<
    Set<string>
  >(() => new Set())
  const { createQuickCreateDashboards } = useWorkspaceActions()
  const {
    addDashboards,
    addStudyPathContainer,
    openDashboards,
    selectedDashboard,
  } = useDashboards()
  const generationQueueRef = useRef<HTMLDivElement | null>(null)
  const generationAbortControllersRef = useRef<Record<string, AbortController>>(
    {},
  )
  const autoAcknowledgeTimersRef = useRef<Record<string, number>>({})
  const generationQueueItemRefs = useRef<Record<string, HTMLElement | null>>({})

  const startStudioResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = studioWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(
        studioPanelMinWidth,
        Math.min(studioPanelMaxWidth, startWidth + moveEvent.clientX - startX),
      )
      setStudioWidth(nextWidth)
    }

    const stopResize = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopResize)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopResize)
  }

  const permissions = useMemo(() => {
    const isAdmin = readIsAdmin()

    return {
      canCreateQuickCreate: isAdmin,
      canCreateStudyPath: isAdmin,
    }
  }, [aiProvider])
  const hasGeneratingQueueJobs = generationDrafts.some(
    (draft) => draft.status === 'generating',
  )

  useEffect(() => {
    writePersistedGenerationQueue(generationDrafts)
  }, [generationDrafts])

  useEffect(() => {
    const showDashboardAfterChatClose = () => {
      if (isMobile) {
        setMobileSection('dashboard')
      }
    }

    window.addEventListener(
      CLOSE_DASHBOARD_CHAT_EVENT,
      showDashboardAfterChatClose,
    )

    return () => {
      window.removeEventListener(
        CLOSE_DASHBOARD_CHAT_EVENT,
        showDashboardAfterChatClose,
      )
    }
  }, [isMobile])

  useEffect(() => {
    const refreshAiProvider = () => {
      setAiProvider(readQuickCreateAiSettings().provider || 'hosted')
    }

    window.addEventListener(
      QUICK_CREATE_AI_SETTINGS_CHANGED_EVENT,
      refreshAiProvider,
    )

    return () => {
      window.removeEventListener(
        QUICK_CREATE_AI_SETTINGS_CHANGED_EVENT,
        refreshAiProvider,
      )
    }
  }, [])

  useEffect(() => {
    if (!hasGeneratingQueueJobs) {
      return
    }

    setQueueClockMs(Date.now())
    const intervalId = window.setInterval(
      () => setQueueClockMs(Date.now()),
      1000,
    )
    return () => window.clearInterval(intervalId)
  }, [hasGeneratingQueueJobs])

  useEffect(() => {
    const handleOpenCreateHub = (event: Event) => {
      const customEvent = event as CustomEvent<OpenCreateHubDetail>
      const detail = customEvent.detail || {}
      setActiveMaterialDraftId(null)
      if (detail.intent === 'study-path' && permissions.canCreateStudyPath) {
        setStudyPathPromptError('')
        setActiveFlow('hub')
        setIsStudioOpen(true)
        if (isMobile) {
          window.dispatchEvent(new Event(CLOSE_DASHBOARD_CHAT_EVENT))
          setMobileSection('creation')
        }
        return
      }
      setActiveFlow('hub')
      setIsStudioOpen(true)
      if (isMobile) {
        setMobileSection('creation')
      }
    }

    const handleOpenStudyPath = () => {
      if (permissions.canCreateStudyPath) {
        setActiveMaterialDraftId(null)
        setStudyPathPromptError('')
        setActiveFlow('hub')
        setIsStudioOpen(true)
        if (isMobile) {
          setMobileSection('creation')
        }
      }
    }
    const handleCloseCreateStudio = () => {
      setIsStudioOpen(false)
      if (isMobile && mobileSection === 'creation') {
        setMobileSection(
          openingMobileAiChatRef.current ? 'ai-chat' : 'dashboard',
        )
      }
      openingMobileAiChatRef.current = false
    }

    window.addEventListener(OPEN_CREATE_HUB_EVENT, handleOpenCreateHub)
    window.addEventListener(OPEN_STUDY_PATH_EVENT, handleOpenStudyPath)
    window.addEventListener(CLOSE_CREATE_STUDIO_EVENT, handleCloseCreateStudio)

    return () => {
      window.removeEventListener(OPEN_CREATE_HUB_EVENT, handleOpenCreateHub)
      window.removeEventListener(OPEN_STUDY_PATH_EVENT, handleOpenStudyPath)
      window.removeEventListener(
        CLOSE_CREATE_STUDIO_EVENT,
        handleCloseCreateStudio,
      )
    }
  }, [
    isMobile,
    mobileSection,
    permissions.canCreateQuickCreate,
    permissions.canCreateStudyPath,
  ])

  const resetOrCloseStudio = () => {
    setIsStudioOpen(false)
    if (isMobile) {
      setMobileSection('dashboard')
    }
  }

  const closeStudio = () => {
    setIsStudioOpen(false)
    if (isMobile) {
      setMobileSection('dashboard')
    }
  }

  const reportCreationStatus = useCallback(
    (
      task: WorkspaceCreationTask,
      state: WorkspaceCreationTaskState,
      message?: string,
    ) => {
      dispatchWorkspaceCreationStatus({ task, state, message })
    },
    [],
  )

  const reportStudyPathStatus = useCallback(
    (state: WorkspaceCreationTaskState, message?: string) => {
      reportCreationStatus('study-path', state, message)
    },
    [reportCreationStatus],
  )

  const reportQuickCreateStatus = useCallback(
    (state: WorkspaceCreationTaskState, message?: string) => {
      reportCreationStatus('quick-create', state, message)
    },
    [reportCreationStatus],
  )

  const updateDraft = useCallback(
    (draftId: string, updates: Partial<GenerationDraft>) => {
      setGenerationDrafts((current) =>
        current.map((draft) =>
          draft.id === draftId ? { ...draft, ...updates } : draft,
        ),
      )
    },
    [],
  )

  const createNewDraft = (
    flow: Exclude<StudioFlow, 'hub'>,
    options: Partial<GenerationDraft> = {},
    behavior: { activate?: boolean } = {},
  ) => {
    if (isMobile) {
      window.dispatchEvent(new Event(CLOSE_DASHBOARD_CHAT_EVENT))
    }
    const shouldActivate = behavior.activate !== false
    const draft = createGenerationDraft(flow, options)
    setGenerationDrafts((current) => [
      ...current.filter(
        (existingDraft) =>
          existingDraft.flow !== flow || existingDraft.status !== 'editing',
      ),
      draft,
    ])
    setActiveDraftByFlow((current) => ({ ...current, [flow]: draft.id }))
    if (shouldActivate) {
      setActiveFlow(flow)
    }
    setIsStudioOpen(true)
    if (isMobile) {
      setMobileSection('creation')
    }
    return draft
  }

  const removeDraft = (draftId: string, flow: Exclude<StudioFlow, 'hub'>) => {
    let nextActiveDraftId: string | null = null
    setGenerationDrafts((current) => {
      const remaining = current.filter((draft) => draft.id !== draftId)
      const flowDrafts = remaining.filter((draft) => draft.flow === flow)
      if (flowDrafts.length === 0) {
        const replacement = createGenerationDraft(flow, {
          isPlaceholder: true,
        })
        nextActiveDraftId = replacement.id
        return [...remaining, replacement]
      }

      nextActiveDraftId = flowDrafts[0].id
      return remaining
    })
    setActiveDraftByFlow((active) =>
      active[flow] === draftId && nextActiveDraftId
        ? { ...active, [flow]: nextActiveDraftId }
        : active,
    )
  }

  const makeDraftStatusHandler =
    (
      draftId: string,
      flow: Exclude<StudioFlow, 'hub'>,
      generationRequestId?: number,
    ) =>
    (state: WorkspaceCreationTaskState, message?: string) => {
      setGenerationDrafts((current) =>
        current.map((draft) => {
          if (draft.id !== draftId) {
            return draft
          }

          if (
            flow === 'study-path' &&
            generationRequestId &&
            draft.generationRequestId !== generationRequestId
          ) {
            return draft
          }

          if (isTerminalGenerationStatus(draft)) {
            return draft
          }

          if (state === 'idle' && draft.status === 'cancelled') {
            return draft
          }

          const nextStatus =
            state === 'running'
              ? 'generating'
              : state === 'complete'
              ? 'ready'
              : state === 'error'
              ? 'failed'
              : 'editing'

          return {
            ...draft,
            status: nextStatus,
            aiProvider: state === 'running' ? aiProvider : draft.aiProvider,
            error: state === 'error' ? message : undefined,
          }
        }),
      )

      if (flow === 'study-path') {
        reportStudyPathStatus(state, message)
      } else {
        reportQuickCreateStatus(state, message)
      }
    }

  const queueJobs = generationDrafts.filter(
    (draft) => !draft.isPlaceholder && draft.status !== 'editing',
  )
  const sortedQueueJobs = [...queueJobs].sort((first, second) => {
    const rank = (draft: GenerationDraft) => {
      if (draft.status === 'ready' && !draft.acknowledgedAt) {
        return 0
      }

      if (draft.status === 'generating') {
        return 1
      }

      if (draft.status === 'failed' && !draft.acknowledgedAt) {
        return 2
      }

      return 3
    }

    const rankDelta = rank(first) - rank(second)
    if (rankDelta !== 0) {
      return rankDelta
    }

    return (
      new Date(second.completedAt || second.createdAt).getTime() -
      new Date(first.completedAt || first.createdAt).getTime()
    )
  })
  const queueReadyCount = queueJobs.filter(
    (draft) => draft.status === 'ready' && !draft.acknowledgedAt,
  ).length
  const queueGeneratingCount = queueJobs.filter(
    (draft) => draft.status === 'generating',
  ).length
  const queueFailedCount = queueJobs.filter(
    (draft) => draft.status === 'failed' && !draft.acknowledgedAt,
  ).length
  const hasQueueMarker =
    queueReadyCount > 0 || queueGeneratingCount > 0 || queueFailedCount > 0
  const isCreationPanelVisible =
    isStudioOpen && (!isMobile || mobileSection === 'creation')
  const queueMarkerLabel =
    queueReadyCount > 0
      ? `${queueReadyCount} generated item${
          queueReadyCount === 1 ? '' : 's'
        } ready`
      : queueGeneratingCount > 0
      ? `${queueGeneratingCount} generation${
          queueGeneratingCount === 1 ? '' : 's'
        } running`
      : queueFailedCount > 0
      ? `${queueFailedCount} generation${
          queueFailedCount === 1 ? '' : 's'
        } failed`
      : 'Creation queue'

  useEffect(() => {
    if (
      !isCreationPanelVisible ||
      typeof window === 'undefined' ||
      !('IntersectionObserver' in window)
    ) {
      setVisibleQueueJobIds(new Set())
      return undefined
    }

    const pendingDraftIds = new Set(
      generationDrafts
        .filter(
          (draft) =>
            (draft.status === 'ready' || draft.status === 'failed') &&
            !draft.acknowledgedAt,
        )
        .map((draft) => draft.id),
    )

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleQueueJobIds((current) => {
          const next = new Set(current)
          entries.forEach((entry) => {
            const draftId = (entry.target as HTMLElement).dataset.draftId
            if (!draftId) {
              return
            }

            if (
              entry.isIntersecting &&
              entry.intersectionRatio >= 0.98 &&
              pendingDraftIds.has(draftId)
            ) {
              next.add(draftId)
            } else {
              next.delete(draftId)
            }
          })
          return next
        })
      },
      { threshold: [0, 0.98, 1] },
    )

    pendingDraftIds.forEach((draftId) => {
      const element = generationQueueItemRefs.current[draftId]
      if (element) {
        observer.observe(element)
      }
    })

    return () => {
      observer.disconnect()
    }
  }, [generationDrafts, isCreationPanelVisible])

  useEffect(() => {
    if (!isCreationPanelVisible) {
      return undefined
    }

    const pendingAcknowledgementIds = new Set(
      generationDrafts
        .filter(
          (draft) =>
            (draft.status === 'ready' || draft.status === 'failed') &&
            !draft.acknowledgedAt,
        )
        .map((draft) => draft.id),
    )
    const visiblePendingAcknowledgementIds = new Set(
      [...pendingAcknowledgementIds].filter((draftId) =>
        visibleQueueJobIds.has(draftId),
      ),
    )

    Object.entries(autoAcknowledgeTimersRef.current).forEach(
      ([draftId, timerId]) => {
        if (!pendingAcknowledgementIds.has(draftId)) {
          window.clearTimeout(timerId)
          delete autoAcknowledgeTimersRef.current[draftId]
        }
      },
    )

    visiblePendingAcknowledgementIds.forEach((draftId) => {
      if (autoAcknowledgeTimersRef.current[draftId]) {
        return
      }

      setAutoAcknowledgingDraftIds((current) => {
        const next = new Set(current)
        next.add(draftId)
        return next
      })
      autoAcknowledgeTimersRef.current[draftId] = window.setTimeout(() => {
        const acknowledgedAt = new Date().toISOString()
        setGenerationDrafts((current) =>
          current.map((draft) =>
            draft.id === draftId &&
            (draft.status === 'ready' || draft.status === 'failed') &&
            !draft.acknowledgedAt
              ? { ...draft, acknowledgedAt }
              : draft,
          ),
        )
        setAutoAcknowledgingDraftIds((current) => {
          const next = new Set(current)
          next.delete(draftId)
          return next
        })
        delete autoAcknowledgeTimersRef.current[draftId]
      }, 2600)
    })

    return undefined
  }, [generationDrafts, isCreationPanelVisible, visibleQueueJobIds])

  useEffect(
    () => () => {
      Object.values(autoAcknowledgeTimersRef.current).forEach((timerId) =>
        window.clearTimeout(timerId),
      )
      autoAcknowledgeTimersRef.current = {}
      generationQueueItemRefs.current = {}
    },
    [],
  )

  const clearGenerationQueue = () => {
    queueJobs.forEach((draft) => {
      generationAbortControllersRef.current[draft.id]?.abort()
      delete generationAbortControllersRef.current[draft.id]
      if (draft.flow === 'study-path' && draft.status === 'generating') {
        setStudyPathCancelSignals((current) => ({
          ...current,
          [draft.id]: (current[draft.id] || 0) + 1,
        }))
      }
      removeGenerationRetrySnapshot(draft.id)
    })
    setGenerationDrafts((current) =>
      current.filter(
        (draft) => draft.isPlaceholder || draft.status === 'editing',
      ),
    )
  }

  const clearGenerationDraft = (draft: GenerationDraft) => {
    generationAbortControllersRef.current[draft.id]?.abort()
    delete generationAbortControllersRef.current[draft.id]
    removeGenerationRetrySnapshot(draft.id)
    const timerId = autoAcknowledgeTimersRef.current[draft.id]
    if (timerId) {
      window.clearTimeout(timerId)
      delete autoAcknowledgeTimersRef.current[draft.id]
    }
    delete generationQueueItemRefs.current[draft.id]
    setVisibleQueueJobIds((current) => {
      const next = new Set(current)
      next.delete(draft.id)
      return next
    })
    setAutoAcknowledgingDraftIds((current) => {
      const next = new Set(current)
      next.delete(draft.id)
      return next
    })
    setGenerationDrafts((current) =>
      current.filter((existingDraft) => existingDraft.id !== draft.id),
    )
  }

  const stopGenerationDraft = (draft: GenerationDraft) => {
    if (draft.status !== 'generating') {
      return
    }

    generationAbortControllersRef.current[draft.id]?.abort()
    delete generationAbortControllersRef.current[draft.id]
    if (draft.flow === 'study-path') {
      setStudyPathCancelSignals((current) => ({
        ...current,
        [draft.id]: (current[draft.id] || 0) + 1,
      }))
    }
    updateDraft(draft.id, {
      status: 'cancelled',
      completedAt: new Date().toISOString(),
      error: 'Generation stopped.',
      acknowledgedAt: new Date().toISOString(),
    })
  }

  const openGenerationQueue = () => {
    setActiveMaterialDraftId(null)
    setActiveFlow('hub')
    setIsStudioOpen(true)
    if (isMobile) {
      window.dispatchEvent(new Event(CLOSE_DASHBOARD_CHAT_EVENT))
      setMobileSection('creation')
    }
    window.setTimeout(() => {
      generationQueueRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      })
      generationQueueRef.current?.focus()
    }, 80)
  }

  const openGeneratedDraft = (draft: GenerationDraft) => {
    if (draft.status !== 'ready') {
      return
    }

    const openedAt = new Date().toISOString()

    if (draft.generatedMaterial) {
      updateDraft(draft.id, { acknowledgedAt: openedAt, openedAt })
      setActiveMaterialDraftId(draft.id)
      setActiveFlow('hub')
      setIsStudioOpen(true)
      if (isMobile) {
        window.dispatchEvent(new Event(CLOSE_DASHBOARD_CHAT_EVENT))
        setMobileSection('creation')
      }
      return
    }

    if (!draft.generatedDashboards?.length) {
      return
    }

    const studyPath = createStudyPathContainerState(draft.generatedDashboards)
    if (studyPath) {
      addStudyPathContainer(studyPath)
    } else {
      addDashboards(
        draft.generatedDashboards.map((dashboard) => ({
          name: dashboard.name,
          layout: dashboard.layout,
        })),
        { replaceEmptySelected: true },
      )
    }

    updateDraft(draft.id, { acknowledgedAt: openedAt, openedAt })
    if (isMobile) {
      setIsStudioOpen(false)
      setMobileSection('dashboard')
    }
  }

  const retryGenerationDraft = (draft: GenerationDraft) => {
    if (
      draft.status !== 'failed' &&
      draft.status !== 'ready' &&
      draft.status !== 'cancelled'
    ) {
      return
    }

    const storedSnapshot = getGenerationRetrySnapshot(draft.id)
    const quickCreateRetry =
      storedSnapshot?.flow === 'quick-create'
        ? storedSnapshot
        : draft.flow === 'quick-create' &&
          draft.retryResourceType &&
          draft.retrySourceText &&
          draft.retryTitle
        ? {
            flow: 'quick-create' as const,
            resourceType: draft.retryResourceType,
            sourceText: draft.retrySourceText,
            title: draft.retryTitle,
            detailLevel:
              (draft.detailLevel as StudyMaterialDetailLevel) ||
              quickDetailLevel,
            difficulty: draft.retryDifficulty || quickDifficulty,
            provider: (draft.aiProvider as QuickCreateAiProvider) || aiProvider,
          }
        : null

    if (draft.flow === 'quick-create' && quickCreateRetry) {
      void runDirectQuickCreateCreate(
        quickCreateRetry.resourceType,
        quickCreateRetry.sourceText,
        quickCreateRetry.title,
        {
          draftId: draft.id,
          detailLevel: quickCreateRetry.detailLevel,
          difficulty: quickCreateRetry.difficulty,
          provider: quickCreateRetry.provider,
        },
      )
      return
    }

    if (draft.flow === 'quick-create') {
      updateDraft(draft.id, {
        error:
          'Retry data is missing for this older failed job. Start it again from Creation once; future failed jobs keep a retry snapshot.',
      })
      return
    }

    if (draft.flow === 'study-path') {
      const generationRequestId = Date.now()
      updateDraft(draft.id, {
        status: 'generating',
        generationRequestId,
        error: undefined,
        acknowledgedAt: undefined,
        openedAt: undefined,
        completedAt: undefined,
        generatedDashboards: undefined,
      })
      setStudyPathRetrySignals((current) => ({
        ...current,
        [draft.id]: (current[draft.id] || 0) + 1,
      }))
    }
  }

  const currentDashboard = openDashboards[selectedDashboard]
  const currentDashboardChatContext = useMemo(() => {
    if (!currentDashboard) {
      return null
    }

    return buildDashboardChatContext(currentDashboard, {
      studyPathScope: 'selected',
    })
  }, [currentDashboard])
  const currentDashboardContext = useMemo(() => {
    if (!currentDashboardChatContext) {
      return ''
    }

    return formatDashboardChatContext(
      currentDashboardChatContext,
      currentDashboardChatContext.chunks,
    ).trim()
  }, [currentDashboardChatContext])
  const hasCurrentDashboardContext = Boolean(
    currentDashboardChatContext?.chunks.length && currentDashboardContext,
  )
  const currentDashboardTitle =
    currentDashboard?.studyPath?.title ||
    currentDashboard?.name ||
    'Current dashboard'
  const canRunQuickCreate = hasCurrentDashboardContext
  const getNextQuickCreationIndex = (
    resourceType: StudyMaterialResourceType,
  ) => {
    const label = quickCreateLabels[resourceType]
    const names = [
      ...getSavedDashboardNames(),
      ...generationDrafts.map((draft) => draft.title),
    ]
    const prefix = `${label} #`
    const usedIndexes = names
      .filter((name) => name.startsWith(prefix))
      .map((name) => {
        const match = name.slice(prefix.length).match(/^(\d+)/)
        return match ? Number(match[1]) : 0
      })
      .filter((index) => Number.isFinite(index) && index > 0)

    return usedIndexes.length > 0 ? Math.max(...usedIndexes) + 1 : 1
  }
  const buildQuickCreationTitle = (resourceType: StudyMaterialResourceType) => {
    const label = quickCreateLabels[resourceType]
    return `${label} #${getNextQuickCreationIndex(
      resourceType,
    )} - ${truncateQuickCreationContext(currentDashboardTitle)}`
  }

  const runDirectQuickCreateCreate = async (
    resourceType: StudyMaterialResourceType,
    sourceText: string,
    title: string,
    retryOptions: {
      draftId?: string
      detailLevel?: StudyMaterialDetailLevel
      difficulty?: string
      provider?: QuickCreateAiProvider
    } = {},
  ) => {
    const effectiveDetailLevel = retryOptions.detailLevel || quickDetailLevel
    const effectiveDifficulty = retryOptions.difficulty || quickDifficulty
    const effectiveProvider = retryOptions.provider || aiProvider
    const credentials = isStrongAiProvider(effectiveProvider)
      ? resolveQuickCreateAiCredentials(effectiveProvider)
      : resolveQuickCreateAiCredentials()
    if (isStrongAiProvider(effectiveProvider) && !credentials.apiToken) {
      setSessionKeyRequest({
        provider: effectiveProvider,
        model: credentials.model,
        retry: {
          kind: 'quick-create',
          resourceType,
          sourceText,
          title,
          
          retryOptions,
        },
      })
      setQuickCreateStatus('')
      return
    }
    const draft = createGenerationDraft('quick-create', {
      quickCreate: true,
      title,
      inputSummary: 'current dashboard',
      selectedResourceType: resourceType,
      detailLevel: effectiveDetailLevel,
      aiProvider: effectiveProvider,
      retrySourceText: sourceText,
      retryTitle: title,
      retryResourceType: resourceType,
      retryDifficulty: effectiveDifficulty,
    })
    const draftId = retryOptions.draftId || draft.id
    const generationDraft: GenerationDraft = {
      ...draft,
      id: draftId,
      status: 'generating',
    }
    saveGenerationRetrySnapshot(draftId, {
      flow: 'quick-create',
      resourceType,
      sourceText,
      title,
      
      detailLevel: effectiveDetailLevel,
      difficulty: effectiveDifficulty,
      provider: effectiveProvider,
    })

    setActiveFlow('hub')
    setQuickCreateStatus('')
    setGenerationDrafts((current) => {
      if (retryOptions.draftId) {
        return current.map((existingDraft) =>
          existingDraft.id === retryOptions.draftId
            ? {
                ...existingDraft,
                ...generationDraft,
                error: undefined,
                acknowledgedAt: undefined,
                openedAt: undefined,
                completedAt: undefined,
                generatedMaterial: undefined,
                generatedDashboards: undefined,
              }
            : existingDraft,
        )
      }

      return [
        ...current.filter(
          (existingDraft) =>
            existingDraft.flow !== 'quick-create' ||
            existingDraft.status !== 'editing',
        ),
        generationDraft,
      ]
    })
    setActiveDraftByFlow((current) => ({ ...current, 'quick-create': draftId }))
    dispatchWorkspaceCreationStatus({
      task: 'quick-create',
      state: 'running',
      message: 'Creating study material',
    })

    const generationController = new AbortController()
    generationAbortControllersRef.current[draftId] = generationController

    try {
      const maxAttempts = 3
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          if (attempt > 1) {
            updateDraft(draftId, {
              status: 'generating',
              error: `Attempt ${attempt - 1} failed. Retrying ${
                quickCreateLabels[resourceType]
              }...`,
            })
            dispatchWorkspaceCreationStatus({
              task: 'quick-create',
              state: 'running',
              message: `Retrying ${quickCreateLabels[resourceType]} (${attempt}/${maxAttempts})...`,
            })
          }

          const generated = await generateQuickCreateWithAi({
            provider: effectiveProvider,
            apiToken: credentials.apiToken,
            model: credentials.model,
            title,
            rawNotes: sourceText,
            packId: getPackId(title),
            generationTargets: quickCreateTargets[resourceType],
            generationAmount: quickCreateDetailToAmount[effectiveDetailLevel],
            resourceType,
            detailLevel: effectiveDetailLevel,
            quizQuestionStyle:
              resourceType === 'quiz' && effectiveDifficulty === 'challenge'
                ? 'examLike'
                : 'mixed',
            promptMode: false,
            studyPathMode: false,
            signal: generationController.signal,
          })

          if (generationController.signal.aborted) {
            return
          }

          const nextTitle = title
          const augmented = augmentQuickCreatePracticeObjects(generated.objects, {
            packId: getPackId(nextTitle),
            title: nextTitle,
            rawNotes: sourceText,
            generationTargets: quickCreateTargets[resourceType],
            generationAmount: quickCreateDetailToAmount[effectiveDetailLevel],
          })
          const objects = getReviewableObjects(
            augmented.objects,
            resourceType,
            effectiveDetailLevel,
          )

          if (objects.length === 0) {
            throw new Error(
              'AI did not create any reviewable study material from these notes.',
            )
          }

          const groups = [
            {
              name: nextTitle,
              objects,
            },
          ]
          const pack = {
            id: getPackId(nextTitle),
            title: nextTitle,
            sourceFormat: generated.sourceFormat || 'text',
            objects,
            warnings: [],
            sourceSummary: generated.sourceSummary || undefined,
          }
          const widgets = createQuickCreateOrchestratorWidgets(pack, {
            forceQuizBlockComponent: resourceType === 'quiz',
            focusedResourceType:
              resourceType === 'flashcards' || resourceType === 'quiz'
                ? resourceType
                : undefined,
            includeSourceWidget: false,
            includeSummaryChart: false,
            rawSource: sourceText,
            widgetGroups: groups,
          })

          const now = new Date().toISOString()
          updateDraft(draftId, {
            title: nextTitle,
            status: 'ready',
            error: undefined,
            completedAt: now,
            generatedMaterial: {
              id: `material-${draftId}`,
              type: resourceType,
              title: nextTitle,
              sourceDashboardId:
                currentDashboard?.id,
              sourceStudyPathId: currentDashboard?.studyPath?.pathId,
              sourceLessonId:
                currentDashboard?.studyPath?.dashboards[
                  currentDashboard.studyPath.selectedIndex
                ]?.dashboardKey,
              contextLabel: currentDashboardTitle,
              createdAt: generationDraft.createdAt,
              updatedAt: now,
              content: {
                widgets,
                sourceSummary: generated.sourceSummary?.bullets?.join('\n'),
              },
              generationConfig: {
                difficulty: effectiveDifficulty,
                detailLevel: effectiveDetailLevel,
                
              },
            },
          })
          removeGenerationRetrySnapshot(draftId)
          dispatchWorkspaceCreationStatus({
            task: 'quick-create',
            state: 'complete',
            message: `${quickCreateLabels[resourceType]} ready`,
          })
          return
        } catch (error) {
          if (generationController.signal.aborted) {
            return
          }

          if (attempt < maxAttempts) {
            continue
          }

          throw error
        }
      }
    } catch (error) {
      if (generationController.signal.aborted) {
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : `Could not create ${quickCreateLabels[resourceType]}.`
      updateDraft(draftId, { status: 'failed', error: message })
      dispatchWorkspaceCreationStatus({
        task: 'quick-create',
        state: 'error',
        message,
      })
      setQuickCreateStatus(message)
    } finally {
      if (
        generationAbortControllersRef.current[draftId] === generationController
      ) {
        delete generationAbortControllersRef.current[draftId]
      }
    }
  }

  const runQuickCreate = async (resourceType: StudyMaterialResourceType) => {
    if (!hasCurrentDashboardContext) {
      setQuickCreateStatus('Open a study dashboard first.')
      return
    }

    setQuickCreateStatus('')
    await runDirectQuickCreateCreate(
      resourceType,
      currentDashboardContext,
      buildQuickCreationTitle(resourceType),
    )
  }

  const handleCollapsedQuickCreateClick = (resourceType: StudyMaterialResourceType) => {
    if (!hasCurrentDashboardContext) {
      setActiveMaterialDraftId(null)
      setActiveFlow('hub')
      setIsStudioOpen(true)
      if (isMobile) {
        window.dispatchEvent(new Event(CLOSE_DASHBOARD_CHAT_EVENT))
        setMobileSection('creation')
      }
      setQuickCreateStatus('Open a study dashboard first.')
      return
    }

    void runQuickCreate(resourceType)
  }

  const returnToCreateHub = () => {
    setActiveMaterialDraftId(null)
    setActiveFlow('hub')
    if (isMobile) {
      setMobileSection('creation')
    }
  }

  const cancelDraftAndReturnToHub = (
    draftId: string,
    flow: Exclude<StudioFlow, 'hub'>,
  ) => {
    removeDraft(draftId, flow)
    setActiveFlow('hub')
    if (isMobile) {
      setMobileSection('creation')
    }
  }

  const activeMaterialDraft = activeMaterialDraftId
    ? generationDrafts.find((draft) => draft.id === activeMaterialDraftId)
    : null
  const activeMaterial = activeMaterialDraft?.generatedMaterial
  const activeMaterialFolder =
    activeMaterial?.type === 'quiz' ||
    activeMaterial?.type === 'flashcards' ||
    activeMaterial?.type === 'improvedNotes'
      ? quickCreateFolders[activeMaterial.type]
      : undefined
  const promoteActiveMaterialToDashboard = () => {
    if (!activeMaterial) {
      return
    }

    createQuickCreateDashboards({
      dashboards: [
        {
          name: activeMaterial.title,
          widgets: activeMaterial.content.widgets,
          layoutMode: 'tabs',
          folderName: activeMaterialFolder,
        },
      ],
      openInWorkspace: true,
    })
  }
  const deleteActiveMaterial = () => {
    if (!activeMaterialDraft) {
      return
    }

    removeGenerationRetrySnapshot(activeMaterialDraft.id)
    setGenerationDrafts((current) =>
      current.filter((draft) => draft.id !== activeMaterialDraft.id),
    )
    setActiveMaterialDraftId(null)
  }

  const beginInlineStudyPathGeneration = (
    prompt: string,
    provider: QuickCreateAiProvider,
  ) => {
    setStudyPathPromptError('')
    setActiveMaterialDraftId(null)
    const generationRequestId = Date.now()
    const draft = createNewDraft(
      'study-path',
      {
        title: prompt,
        inputSummary: prompt,
        status: 'generating',
        aiProvider: provider,
        generationRequestId,
      },
      { activate: false },
    )
    setActiveFlow('hub')
    setStudyPathAutoGenerateRequest({
      id: generationRequestId,
      draftId: draft.id,
      prompt,
    })
  }

  const startInlineStudyPath = () => {
    const prompt = studyPathPrompt.trim()
    if (!prompt) {
      setStudyPathPromptError('Describe what you want to learn first.')
      return
    }

    const effectiveProvider = readQuickCreateAiSettings().provider || 'hosted'
    setAiProvider(effectiveProvider)
    const credentials = isStrongAiProvider(effectiveProvider)
      ? resolveQuickCreateAiCredentials(effectiveProvider)
      : resolveQuickCreateAiCredentials()
    if (isStrongAiProvider(effectiveProvider) && !credentials.apiToken) {
      setStudyPathPromptError('')
      setSessionKeyRequest({
        provider: effectiveProvider,
        model: credentials.model,
        retry: {
          kind: 'study-path',
          prompt,
        },
      })
      return
    }

    beginInlineStudyPathGeneration(prompt, effectiveProvider)
  }

  const materialDetailContent = activeMaterial ? (
    <Box
      sx={{
        height: '100%',
        overflow: 'auto',
        p: { xs: 2, sm: 2.5 },
        pb: { xs: 10, sm: 2.5 },
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" alignItems="flex-start" gap={1}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Button
              size="small"
              onClick={returnToCreateHub}
              sx={{
                mb: 1,
                alignSelf: 'flex-start',
                borderRadius: 999,
                fontWeight: 900,
              }}
            >
              ← Back to Create
            </Button>
            <Typography variant="h5" fontWeight={900}>
              {activeMaterial.title}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.35,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              From: {activeMaterial.contextLabel}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              activeMaterialDraft && retryGenerationDraft(activeMaterialDraft)
            }
            sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 900 }}
          >
            Regenerate
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={promoteActiveMaterialToDashboard}
            sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 900 }}
          >
            Add to dashboard
          </Button>
          <Button
            size="small"
            color="error"
            onClick={deleteActiveMaterial}
            sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 900 }}
          >
            Delete
          </Button>
        </Stack>

        <Stack spacing={1.5}>
          {activeMaterial.content.widgets.flatMap((widget) =>
            widget.components
              .filter((component) => isStudyBlockType(component.type))
              .map((component) => (
                <StudyBlockView
                  key={`${widget.name}-${component.id}`}
                  type={component.type}
                  props={component.props || {}}
                />
              )),
          )}
        </Stack>
      </Stack>
    </Box>
  ) : null

  const renderQuickCreateCards = (canCreate: boolean) => (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
        gap: 1,
      }}
    >
      {(['quiz', 'flashcards', 'improvedNotes'] as const).map(
        (resourceType) => {
          const accent = quickCreateAccents[resourceType]
          const displayLabel =
            resourceType === 'improvedNotes'
              ? 'Expand'
              : quickCreateLabels[resourceType]

          return (
            <Paper
              key={resourceType}
              component="button"
              type="button"
              aria-label={`Quick Create ${displayLabel}`}
              disabled={!canCreate}
              elevation={0}
              onClick={() => {
                if (!canCreate) {
                  return
                }

                runQuickCreate(resourceType)
              }}
              sx={{
                minHeight: { xs: 82, sm: 110 },
                p: { xs: 1.15, sm: 1.35 },
                borderRadius: 2,
                border: 1,
                borderColor: alpha(accent, 0.26),
                bgcolor: alpha(accent, 0.06),
                color: 'text.primary',
                cursor: canCreate ? 'pointer' : 'not-allowed',
                textAlign: 'center',
                opacity: canCreate ? 1 : 0.48,
                '&:hover': {
                  borderColor: canCreate ? accent : alpha(accent, 0.26),
                  bgcolor: canCreate
                    ? alpha(accent, 0.1)
                    : alpha(accent, 0.06),
                },
              }}
            >
              <Stack spacing={0.75} alignItems="center">
                <Box sx={{ color: accent }}>{quickCreateIcons[resourceType]}</Box>
                <Typography variant="subtitle2" fontWeight={900}>
                  {displayLabel}
                </Typography>
              </Stack>
            </Paper>
          )
        },
      )}
    </Box>
  )

  const creationHubContent = (
    <Box
      sx={{
        height: '100%',
        overflow: 'auto',
        p: { xs: 2, sm: 2.5 },
        pb: { xs: 10, sm: 2.5 },
        bgcolor: 'background.light',
      }}
    >
      <Stack spacing={1.75}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 1.75 },
            border: 1,
            borderColor: alpha(theme.palette.primary.main, 0.28),
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.09),
          }}
        >
          <Stack spacing={1.25}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 1.5,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  flex: '0 0 auto',
                }}
              >
                <RouteIcon />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle1" fontWeight={950}>
                  Study Guide
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Structured lessons from a learning goal
                </Typography>
              </Box>
            </Stack>
            <TextField
              value={studyPathPrompt}
              onChange={(event) => {
                setStudyPathPrompt(event.target.value)
                setStudyPathPromptError('')
              }}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault()
                  startInlineStudyPath()
                }
              }}
              placeholder='What do you want to learn? e.g. "Spanish B2 grammar..."'
              inputProps={{ 'aria-label': 'What do you want to learn?' }}
              error={Boolean(studyPathPromptError)}
              helperText={studyPathPromptError || ' '}
              multiline
              minRows={2}
              fullWidth
              sx={{
                '& .MuiInputBase-root': {
                  bgcolor: 'background.paper',
                  borderRadius: 1.5,
                },
              }}
            />
            <Button
              variant="contained"
              endIcon={<ChevronRightIcon />}
              onClick={startInlineStudyPath}
              sx={{
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 950,
              }}
            >
              Create Study Guide
            </Button>
          </Stack>
        </Paper>

        <Divider
          sx={{
            color: 'text.secondary',
            fontWeight: 900,
            letterSpacing: 0.8,
            '&::before, &::after': {
              borderColor: 'divider',
            },
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={900}
            sx={{ letterSpacing: 0.8 }}
          >
            OR QUICK CREATE
          </Typography>
        </Divider>

        <Stack spacing={1.25}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Typography variant="subtitle2" fontWeight={950}>
              Quick create
            </Typography>
            <Chip
              size="small"
              label={hasCurrentDashboardContext ? `From ${currentDashboardTitle}` : 'Open a study dashboard first'}
              color={canRunQuickCreate ? 'primary' : 'default'}
              variant="outlined"
              sx={{ fontWeight: 900 }}
            />
          </Stack>
          {renderQuickCreateCards(canRunQuickCreate)}
          {quickCreateStatus ? (
            <Typography variant="caption" color="text.secondary">
              {quickCreateStatus}
            </Typography>
          ) : null}
        </Stack>

        {sortedQueueJobs.length > 0 ? (
          <Paper
            ref={generationQueueRef}
            tabIndex={-1}
            elevation={0}
            aria-label="Generation queue"
            sx={{
              p: 1.25,
              border: 1,
              borderColor: 'divider',
              borderRadius: 2.5,
              bgcolor: alpha(theme.palette.background.default, 0.72),
              outline: 'none',
              '&:focus-visible': {
                boxShadow: `0 0 0 3px ${alpha(
                  theme.palette.primary.main,
                  0.24,
                )}`,
              },
            }}
          >
            <Stack spacing={1}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
              >
                <Typography variant="subtitle2" fontWeight={900}>
                  Generation queue
                </Typography>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Chip
                    size="small"
                    label={`${queueJobs.length} job${
                      queueJobs.length === 1 ? '' : 's'
                    }`}
                    sx={{ fontWeight: 800 }}
                  />
                  <Button
                    size="small"
                    onClick={clearGenerationQueue}
                    sx={{
                      minWidth: 0,
                      px: 1,
                      borderRadius: 999,
                      textTransform: 'none',
                      fontWeight: 800,
                    }}
                  >
                    Clear
                  </Button>
                </Stack>
              </Stack>
              <Stack spacing={0.75}>
                {sortedQueueJobs.map((draft) => {
                  const isReady = draft.status === 'ready'
                  const isGenerating = draft.status === 'generating'
                  const isFailed = draft.status === 'failed'
                  const isCancelled = draft.status === 'cancelled'
                  const canRetry = isFailed || isCancelled
                  const opened = Boolean(draft.openedAt)
                  const acknowledgedAtMs = draft.acknowledgedAt
                    ? new Date(draft.acknowledgedAt).getTime()
                    : 0
                  const completedAtMs = draft.completedAt
                    ? new Date(draft.completedAt).getTime()
                    : 0
                  const acknowledgedAfterCompletionMs =
                    acknowledgedAtMs - completedAtMs
                  const showAcknowledgedPulse =
                    !opened &&
                    ((Number.isFinite(acknowledgedAtMs) &&
                      (!Number.isFinite(completedAtMs) ||
                        acknowledgedAfterCompletionMs > 3200) &&
                      Date.now() - acknowledgedAtMs < 3200) ||
                      autoAcknowledgingDraftIds.has(draft.id))
                  const materialLabel = generationMaterialLabel(draft)
                  const createdAtMs = new Date(draft.createdAt).getTime()
                  const elapsed = isGenerating
                    ? formatQueueDuration(
                        queueClockMs -
                          (Number.isFinite(createdAtMs)
                            ? createdAtMs
                            : queueClockMs),
                      )
                    : ''
                  const estimate = isGenerating
                    ? estimateQueueDuration(draft)
                    : ''
                  const label =
                    isGenerating && draft.flow === 'study-path'
                      ? 'Creating study guide...'
                      : isGenerating
                      ? `Generating ${materialLabel}...`
                      : formatDraftTitle(draft)
                  const generatingDetail =
                    draft.flow === 'study-path'
                      ? [
                          elapsed ? `${elapsed} elapsed` : '',
                          estimate,
                          draft.inputSummary || 'based on dashboard context',
                        ]
                          .filter(Boolean)
                          .join(' - ')
                      : [
                          draft.inputSummary || 'based on dashboard context',
                          elapsed ? `${elapsed} elapsed` : '',
                          estimate,
                        ]
                          .filter(Boolean)
                          .join(' - ')
                  const detail = isCancelled
                    ? draft.error || 'Stopped - Retry'
                    : isFailed
                    ? draft.error || 'Retry'
                    : isReady
                    ? opened
                      ? 'Opened'
                      : 'Ready - Open'
                    : generatingDetail
                  const statusIcon =
                    isFailed || isCancelled ? (
                      <ErrorOutlineIcon fontSize="small" color="error" />
                    ) : isReady ? (
                      <CheckCircleIcon fontSize="small" color="success" />
                    ) : (
                      <LoopIcon
                        fontSize="small"
                        color="warning"
                        sx={{
                          animation:
                            'studymesh-generation-pill-spin 950ms linear infinite',
                          '@keyframes studymesh-generation-pill-spin': {
                            to: { transform: 'rotate(360deg)' },
                          },
                        }}
                      />
                    )

                  return (
                    <Paper
                      key={draft.id}
                      component="div"
                      role={isReady ? 'button' : undefined}
                      tabIndex={isReady ? 0 : undefined}
                      data-draft-id={draft.id}
                      ref={(element: HTMLElement | null) => {
                        generationQueueItemRefs.current[draft.id] = element
                      }}
                      elevation={0}
                      onClick={
                        isReady ? () => openGeneratedDraft(draft) : undefined
                      }
                      onKeyDown={
                        isReady
                          ? (event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                openGeneratedDraft(draft)
                              }
                            }
                          : undefined
                      }
                      sx={{
                        width: '100%',
                        p: 1,
                        border: 1,
                        borderColor: showAcknowledgedPulse
                          ? 'warning.main'
                          : isReady
                          ? alpha(theme.palette.success.main, 0.45)
                          : isFailed || isCancelled
                          ? alpha(theme.palette.error.main, 0.35)
                          : alpha(theme.palette.warning.main, 0.36),
                        borderRadius: 2,
                        bgcolor: isReady
                          ? alpha(theme.palette.success.main, 0.075)
                          : isFailed || isCancelled
                          ? alpha(theme.palette.error.main, 0.055)
                          : alpha(theme.palette.warning.main, 0.07),
                        color: 'text.primary',
                        cursor: isReady ? 'pointer' : 'default',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        animation: showAcknowledgedPulse
                          ? 'studymesh-acknowledged-pill-pulse 820ms ease-in-out 3'
                          : 'none',
                        '@keyframes studymesh-acknowledged-pill-pulse': {
                          '0%, 100%': {
                            boxShadow: `0 0 0 0 ${alpha(
                              theme.palette.warning.main,
                              0,
                            )}`,
                          },
                          '50%': {
                            boxShadow: `0 0 0 5px ${alpha(
                              theme.palette.warning.main,
                              0.3,
                            )}`,
                          },
                        },
                        '&:hover': isReady
                          ? {
                              borderColor: 'success.main',
                              bgcolor: alpha(theme.palette.success.main, 0.11),
                            }
                          : undefined,
                      }}
                    >
                      <Box sx={{ flex: '0 0 auto', display: 'grid' }}>
                        {statusIcon}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          variant="body2"
                          fontWeight={900}
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isFailed
                            ? `${materialLabel[0].toUpperCase()}${materialLabel.slice(
                                1,
                              )} generation failed`
                            : isCancelled
                            ? `${materialLabel[0].toUpperCase()}${materialLabel.slice(
                                1,
                              )} generation stopped`
                            : label}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {detail}
                        </Typography>
                      </Box>
                      {isReady && !opened ? (
                        <Chip
                          size="small"
                          color="success"
                          label="Open"
                          sx={{ fontWeight: 900 }}
                        />
                      ) : null}
                      {isGenerating ? (
                        <Button
                          size="small"
                          type="button"
                          variant="outlined"
                          color="warning"
                          onClick={(event) => {
                            event.stopPropagation()
                            stopGenerationDraft(draft)
                          }}
                          sx={{
                            borderRadius: 999,
                            textTransform: 'none',
                            fontWeight: 900,
                            flex: '0 0 auto',
                          }}
                        >
                          Stop
                        </Button>
                      ) : null}
                      {canRetry ? (
                        <Button
                          size="small"
                          type="button"
                          variant="outlined"
                          onClick={(event) => {
                            event.stopPropagation()
                            retryGenerationDraft(draft)
                          }}
                          sx={{
                            borderRadius: 999,
                            textTransform: 'none',
                            fontWeight: 900,
                            flex: '0 0 auto',
                          }}
                        >
                          Retry
                        </Button>
                      ) : null}
                      {isReady || isFailed || isCancelled ? (
                        <Button
                          size="small"
                          type="button"
                          variant="text"
                          onClick={(event) => {
                            event.stopPropagation()
                            clearGenerationDraft(draft)
                          }}
                          sx={{
                            borderRadius: 999,
                            textTransform: 'none',
                            fontWeight: 900,
                            flex: '0 0 auto',
                          }}
                        >
                          Clear
                        </Button>
                      ) : null}
                    </Paper>
                  )
                })}
              </Stack>
            </Stack>
          </Paper>
        ) : null}
      </Stack>
    </Box>
  )

  const studioContent = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.light',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: activeFlow === 'hub' ? 'flex' : 'none',
          flexDirection: 'column',
        }}
      >
        {materialDetailContent || creationHubContent}
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: activeFlow === 'study-path' ? 'flex' : 'none',
          flexDirection: 'column',
        }}
      >
        {generationDrafts
          .filter((draft) => draft.flow === 'study-path')
          .map((draft) => (
            <Box
              key={draft.id}
              sx={{
                flex: 1,
                minHeight: 0,
                display:
                  draft.id === activeDraftByFlow['study-path']
                    ? 'flex'
                    : 'none',
                flexDirection: 'column',
              }}
            >
              <CreateStudyGuideModal
                open
                presentation="embedded"
                onCollapse={isMobile ? undefined : returnToCreateHub}
                autoCreateOnGenerate
                autoGenerateRequest={
                  studyPathAutoGenerateRequest?.draftId === draft.id
                    ? studyPathAutoGenerateRequest
                    : undefined
                }
                autoRetrySignal={studyPathRetrySignals[draft.id] || 0}
                autoCancelSignal={studyPathCancelSignals[draft.id] || 0}
                openGeneratedInWorkspace={false}
                initialPrompt={
                  !draft.isPlaceholder &&
                  draft.status !== 'ready' &&
                  draft.title &&
                  draft.title !== 'Study Guide'
                    ? draft.title
                    : undefined
                }
                onClose={() =>
                  cancelDraftAndReturnToHub(draft.id, 'study-path')
                }
                onCreatePath={(payload) => {
                  const dashboards = createQuickCreateDashboards({
                    ...payload,
                    openInWorkspace: false,
                  })
                  const studyPath = createStudyPathContainerState(dashboards)
                  const nextTitle =
                    studyPath?.title ||
                    payload.folderName ||
                    dashboards[0]?.name ||
                    'Study Guide'
                  updateDraft(draft.id, {
                    title: nextTitle,
                    inputSummary: nextTitle || draft.inputSummary,
                    status: 'ready',
                    completedAt: new Date().toISOString(),
                    generatedDashboards: dashboards,
                  })
                  reportCreationStatus(
                    'study-path',
                    'complete',
                    'Study material created.',
                  )
                  return dashboards
                }}
                onStatusChange={makeDraftStatusHandler(
                  draft.id,
                  'study-path',
                  draft.generationRequestId,
                )}
                onDraftMetaChange={(metadata) =>
                  setGenerationDrafts((current) =>
                    current.map((existingDraft) => {
                      if (existingDraft.id !== draft.id) {
                        return existingDraft
                      }

                      if (
                        draft.generationRequestId &&
                        existingDraft.generationRequestId !==
                          draft.generationRequestId
                      ) {
                        return existingDraft
                      }

                      if (isTerminalGenerationStatus(existingDraft)) {
                        return existingDraft
                      }

                      return {
                        ...existingDraft,
                        title: metadata.title,
                        inputSummary: metadata.inputSummary,
                        aiProvider,
                      }
                    }),
                  )
                }
              />
            </Box>
          ))}
      </Box>

    </Box>
  )

  const openCreateHub = () => {
    if (isMobile && isStudioOpen && activeFlow === 'hub') {
      setActiveMaterialDraftId(null)
      setMobileSection('creation')
      return
    }

    setActiveMaterialDraftId(null)
    setActiveFlow('hub')
    setIsStudioOpen(true)
    if (isMobile) {
      window.dispatchEvent(new Event(CLOSE_DASHBOARD_CHAT_EVENT))
      setMobileSection('creation')
    }
  }

  const toggleCreatePanel = () => {
    if (isStudioOpen) {
      closeStudio()
      return
    }

    openCreateHub()
  }

  const collapsedCreationActions = (
    <>
      {(
        ['quiz', 'flashcards', 'improvedNotes'] as StudyMaterialResourceType[]
      ).map((resourceType) => (
        <Tooltip
          key={resourceType}
          title={quickCreateLabels[resourceType]}
          placement="right"
        >
          <Box component="span" sx={{ display: 'grid' }}>
            <Box
              className="studymesh-creation-quick-action"
              component="button"
              type="button"
              aria-label={`Quick Create ${quickCreateLabels[resourceType]}`}
              disabled={!canRunQuickCreate}
              onClick={(event) => {
                event.stopPropagation()
                if (!canRunQuickCreate) {
                  return
                }
                handleCollapsedQuickCreateClick(resourceType)
              }}
              sx={{
                width: 30,
                height: 30,
                border: 1,
                borderColor: alpha(quickCreateAccents[resourceType], 0.32),
                borderRadius: 1.25,
                bgcolor: alpha(quickCreateAccents[resourceType], 0.1),
                color: quickCreateAccents[resourceType],
                display: 'grid',
                placeItems: 'center',
                cursor: canRunQuickCreate ? 'pointer' : 'not-allowed',
                opacity: canRunQuickCreate ? 1 : 0.42,
                '&:hover': {
                  borderColor: canRunQuickCreate
                    ? quickCreateAccents[resourceType]
                    : alpha(quickCreateAccents[resourceType], 0.32),
                  bgcolor: canRunQuickCreate
                    ? alpha(quickCreateAccents[resourceType], 0.18)
                    : alpha(quickCreateAccents[resourceType], 0.1),
                },
                '& svg': {
                  margin: '0 -2px',
                },
              }}
            >
              {quickCreateIcons[resourceType]}
            </Box>
          </Box>
        </Tooltip>
      ))}
    </>
  )

  const openMobileDashboard = () => {
    setIsStudioOpen(false)
    setMobileSection('dashboard')
    window.dispatchEvent(new Event(CLOSE_DASHBOARD_CHAT_EVENT))
  }

  const openMobileAiChat = () => {
    openingMobileAiChatRef.current = true
    setIsStudioOpen(false)
    setMobileSection('ai-chat')
    window.dispatchEvent(new Event(OPEN_DASHBOARD_CHAT_EVENT))
  }

  const mobileCreationStatusTray = hasQueueMarker ? (
    <Box
      aria-label="Creation generation status"
      sx={{
        display: 'flex',
        gap: 0.75,
        px: 0.75,
        py: 0.75,
        minHeight: 'var(--studymesh-mobile-generation-tray-height)',
        overflowX: 'auto',
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        flexShrink: 0,
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
      }}
    >
      <Button
        size="small"
        variant={queueReadyCount > 0 ? 'contained' : 'outlined'}
        onClick={openGenerationQueue}
        aria-label={queueMarkerLabel}
        sx={{
          flex: '0 0 auto',
          maxWidth: 240,
          minWidth: 0,
          px: 1,
          borderRadius: 999,
          textTransform: 'none',
          justifyContent: 'flex-start',
          gap: 0.75,
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor:
              queueReadyCount > 0
                ? 'success.main'
                : queueFailedCount > 0 && queueGeneratingCount === 0
                ? 'error.main'
                : 'warning.main',
            flex: '0 0 auto',
            '&::after':
              queueGeneratingCount > 0
                ? {
                    content: '""',
                    position: 'absolute',
                    inset: -4,
                    borderRadius: '50%',
                    border: 1.5,
                    borderColor: 'warning.main',
                    borderTopColor: 'transparent',
                    animation:
                      'studymesh-mobile-marker-spin 900ms linear infinite',
                  }
                : undefined,
            '@keyframes studymesh-mobile-marker-spin': {
              to: { transform: 'rotate(360deg)' },
            },
          }}
        />
        <Typography
          variant="caption"
          sx={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 800,
          }}
        >
          {queueMarkerLabel}
        </Typography>
      </Button>
    </Box>
  ) : null

  const mobileSectionTabs = (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 0.75,
        p: 0.75,
        pb: 'calc(0.75rem + env(safe-area-inset-bottom))',
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        flexShrink: 0,
        position: 'sticky',
        bottom: 0,
        zIndex: theme.zIndex.appBar,
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 -10px 28px rgba(0,0,0,0.35)'
            : '0 -10px 28px rgba(16,24,40,0.12)',
      }}
    >
      {[
        {
          key: 'creation',
          label: 'Creation',
          icon: <AddIcon fontSize="small" />,
          onClick: openCreateHub,
        },
        {
          key: 'dashboard',
          label: 'Dashboards',
          icon: <DashboardIcon fontSize="small" />,
          onClick: openMobileDashboard,
        },
        {
          key: 'ai-chat',
          label: 'AI Chat',
          icon: <ChatBubbleOutlineIcon fontSize="small" />,
          onClick: openMobileAiChat,
        },
      ].map((item) => (
        <Button
          key={item.key}
          size="small"
          variant={mobileSection === item.key ? 'contained' : 'outlined'}
          onClick={item.onClick}
          startIcon={item.icon}
          sx={{
            minWidth: 0,
            px: 0.75,
            borderRadius: 999,
            textTransform: 'none',
            fontSize: '0.72rem',
            '& .MuiButton-startIcon': { mr: 0.5 },
          }}
        >
          {item.label}
        </Button>
      ))}
    </Box>
  )

  const creationStatusMarkers = (
    <Box
      sx={{
        position: isMobile ? 'fixed' : 'absolute',
        left: isMobile ? 0 : isStudioOpen ? studioWidth : studioPanelRailWidth,
        top: 96,
        zIndex: isMobile ? 1100 : 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        alignItems: 'flex-start',
        transition: theme.transitions.create('left', {
          duration: theme.transitions.duration.shorter,
          easing: theme.transitions.easing.easeInOut,
        }),
      }}
    >
      {hasQueueMarker ? (
        <Tooltip
          title={`${queueMarkerLabel}. Click to view queue.`}
          placement="right"
        >
          <Box
            component="button"
            type="button"
            aria-label={`${queueMarkerLabel}. View generation queue.`}
            onClick={openGenerationQueue}
            sx={{
              width: isMobile ? 34 : 34,
              height: isMobile ? 82 : 82,
              border: 0,
              borderRadius: '0 18px 18px 0',
              bgcolor: 'background.paper',
              color: 'text.primary',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow:
                theme.palette.mode === 'dark'
                  ? '0 12px 32px rgba(0,0,0,0.42)'
                  : '0 12px 30px rgba(16,24,40,0.18)',
              outline: 1,
              outlineColor: 'divider',
              animation:
                queueReadyCount > 0
                  ? 'studymesh-marker-ready 1.4s ease-out 1'
                  : 'none',
              '@keyframes studymesh-marker-ready': {
                '0%': { boxShadow: statusMarkerGlow.complete },
                '100%': {
                  boxShadow:
                    theme.palette.mode === 'dark'
                      ? '0 12px 32px rgba(0,0,0,0.42)'
                      : '0 12px 30px rgba(16,24,40,0.18)',
                },
              },
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor:
                  queueReadyCount > 0
                    ? 'success.main'
                    : queueFailedCount > 0 && queueGeneratingCount === 0
                    ? 'error.main'
                    : 'warning.main',
                boxShadow:
                  queueReadyCount > 0
                    ? statusMarkerGlow.complete
                    : queueFailedCount > 0 && queueGeneratingCount === 0
                    ? statusMarkerGlow.error
                    : statusMarkerGlow.running,
                color:
                  queueReadyCount > 0
                    ? 'success.contrastText'
                    : 'warning.contrastText',
                display: 'grid',
                placeItems: 'center',
                fontSize: 9,
                fontWeight: 900,
                '&::after':
                  queueGeneratingCount > 0
                    ? {
                        content: '""',
                        position: 'absolute',
                        inset: -5,
                        borderRadius: '50%',
                        border: 2,
                        borderColor: 'warning.main',
                        borderTopColor: 'transparent',
                        animation:
                          'studymesh-marker-spin 900ms linear infinite',
                      }
                    : undefined,
                '@keyframes studymesh-marker-spin': {
                  to: { transform: 'rotate(360deg)' },
                },
              }}
            >
              {queueReadyCount > 0 ? queueReadyCount : ''}
              {queueFailedCount > 0 && queueReadyCount === 0 ? (
                <Box
                  sx={{
                    position: 'absolute',
                    right: -6,
                    bottom: -6,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: 'error.main',
                    border: 1,
                    borderColor: 'background.paper',
                  }}
                />
              ) : null}
            </Box>
          </Box>
        </Tooltip>
      ) : null}
    </Box>
  )

  const sessionKeyDialog = sessionKeyRequest ? (
    <StrongAiSessionKeyDialog
      open
      provider={sessionKeyRequest.provider}
      model={sessionKeyRequest.model}
      onCancel={() => setSessionKeyRequest(null)}
      onSaved={() => {
        const { provider, retry } = sessionKeyRequest
        setSessionKeyRequest(null)
        if (retry.kind === 'study-path') {
          beginInlineStudyPathGeneration(retry.prompt, provider)
          return
        }

        void runDirectQuickCreateCreate(
          retry.resourceType,
          retry.sourceText,
          retry.title,
          retry.retryOptions,
        )
      }}
    />
  ) : null

  if (isMobile) {
    return (
      <>
        <WorkspaceMobileLayout
          studioContent={studioContent}
          mobileCreationStatusTray={mobileCreationStatusTray}
          mobileSectionTabs={mobileSectionTabs}
          isStudioOpen={isStudioOpen}
          mobileSection={mobileSection}
          visibleCreationMarkerCount={hasQueueMarker ? 1 : 0}
          theme={theme}
        >
          {children}
        </WorkspaceMobileLayout>
        {sessionKeyDialog}
      </>
    )
  }

  return (
    <>
      <WorkspaceDesktopLayout
        studioContent={studioContent}
        creationStatusMarkers={creationStatusMarkers}
        isStudioOpen={isStudioOpen}
        studioWidth={studioWidth}
        toggleCreatePanel={toggleCreatePanel}
        collapsedCreationActions={collapsedCreationActions}
        startStudioResize={startStudioResize}
        theme={theme}
      >
        {children}
      </WorkspaceDesktopLayout>
      {sessionKeyDialog}
    </>
  )
}

export default WorkspaceStudioShell
