import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import AddIcon from '@mui/icons-material/Add'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import ContentPasteIcon from '@mui/icons-material/ContentPaste'
import DescriptionIcon from '@mui/icons-material/Description'
import QuizIcon from '@mui/icons-material/Quiz'
import RouteIcon from '@mui/icons-material/Route'
import StyleIcon from '@mui/icons-material/Style'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import LoopIcon from '@mui/icons-material/Loop'

import {
  OPEN_CREATE_HUB_EVENT,
  OPEN_DASHBOARD_EDITOR_EVENT,
  OPEN_STUDY_PACK_EVENT,
  OPEN_STUDY_PATH_EVENT,
  OPEN_WIDGET_EDITOR_EVENT,
  useWorkspaceActions,
} from '../../customHooks/useWorkspaceActions'
import { dispatchWorkspaceOnboardingEvent } from '../onboarding/onboardingEvents'
import CreateStudyPathModal from '../studyPack/CreateStudyPathModal'
import {
  generateStudyPackWithAi,
  isStrongAiProvider,
  readStudyPackAiSettings,
  resolveStudyPackAiCredentials,
  STUDY_PACK_AI_SETTINGS_CHANGED_EVENT,
  StudyMaterialDetailLevel,
  StudyMaterialResourceType,
  StudyPackAiProvider,
} from '../../studyPack/ai'
import {
  extractTextFromPdf,
  extractTextFromPptx,
} from '../../studyPack/documentExtraction'
import { extractRawNotesFromImage } from '../../studyPack/imageOcr'
import { CustomWidget } from '../WidgetEditor/WidgetStorage'
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
  appendQuickSourceText,
  createGenerationDraft,
  CreationSection,
  CreateIntent,
  CreationFlow,
  GenerationDraft,
  GenerationMarkerState,
  OpenCreateHubDetail,
  QuickSourceFocus,
  readIsAdmin,
  quickCreateAccents,
  quickCreateDetailToAmount,
  quickCreateFolders,
  quickCreateLabels,
  quickCreateTargets,
  quickSourceAcceptValue,
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
import { createStudyPackOrchestratorWidgets } from '../../studyPack'
import { augmentStudyPackPracticeObjects } from '../../studyPack/practice'
import { StudyObject } from '../../studyPack/types'
import WidgetEditorDialog from './WidgetEditorDialog'
import { useResponsiveWorkspaceMode } from './useResponsiveWorkspaceMode'
import StudyBlockView, {
  isStudyBlockType,
} from '../WidgetEditor/components/preview/StudyBlockView'

const quickCreateIcons: Record<StudyMaterialResourceType, React.ReactNode> = {
  quiz: <QuizIcon fontSize="small" />,
  flashcards: <StyleIcon fontSize="small" />,
  improvedNotes: <AutoStoriesIcon fontSize="small" />,
}

type QuickSourceMode = 'dashboard' | 'sources'

const GENERATION_RETRY_STORE_KEY = 'studymesh-generation-retry-snapshots'
const GENERATION_QUEUE_STORE_KEY = 'studymesh-generation-queue-v1'

interface FromNotesRetrySnapshot {
  flow: 'from-notes'
  resourceType: StudyMaterialResourceType
  sourceText: string
  title: string
  sourceMode: QuickSourceMode
  detailLevel: StudyMaterialDetailLevel
  difficulty: string
  provider: StudyPackAiProvider
}

type GenerationRetrySnapshot = FromNotesRetrySnapshot

const statusMarkerLabels: Record<
  WorkspaceCreationTaskState | 'editing',
  string
> = {
  editing: 'Creation draft open',
  idle: '',
  running: 'Generating study material…',
  complete: 'Study material saved to dashboards',
  error: 'Generation failed. Click to review.',
}

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
  title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'study-pack'

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
    return 'study path'
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
      if (draft.detailLevel === 'superSmall') {
        return 'est. 12-15m'
      }

      if (draft.detailLevel === 'compact') {
        return 'est. 14-17m'
      }

      return 'est. 15-20m'
    }

    return 'est. 2m-10m'
  }

  if (draft.aiProvider === 'gemini') {
    if (draft.detailLevel === 'long' || draft.detailLevel === 'deep') {
      return 'est. 1-2m'
    }

    return 'est. 30-60s'
  }

  if (draft.aiProvider === 'cerebras') {
    return 'est. 2-10s'
  }

  if (draft.aiProvider === 'basic') {
    return 'est. seconds'
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
    (draft.flow !== 'study-path' && draft.flow !== 'from-notes') ||
    typeof draft.title !== 'string' ||
    typeof draft.createdAt !== 'string'
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
    return `Study Path: ${shortTitle || 'Untitled'}`
  }

  return `${resourceTypeTitle(draft.selectedResourceType)} from ${
    draft.inputSummary || shortTitle || 'notes'
  }`
}

const getDraftMarkerState = (
  draft: GenerationDraft,
): GenerationMarkerState | null => {
  if (draft.status === 'editing' && !draft.isPlaceholder) {
    return 'editing'
  }

  const { status } = draft

  if (status === 'generating') {
    return 'running'
  }

  if (status === 'ready') {
    return 'complete'
  }

  if (status === 'failed') {
    return 'error'
  }

  return null
}

const WorkspaceStudioShell = ({ children }: { children: React.ReactNode }) => {
  const { theme, isPhoneOrTablet: isMobile } = useResponsiveWorkspaceMode()
  const initialDrafts = useMemo(() => {
    const placeholders = [
      createGenerationDraft('study-path', { isPlaceholder: true }),
      createGenerationDraft('from-notes', { isPlaceholder: true }),
    ]

    return [...placeholders, ...readPersistedGenerationQueue()]
  }, [])
  const [isStudioOpen, setIsStudioOpen] = useState(false)
  const [studioWidth, setStudioWidth] = useState(studioPanelWidth)
  const [mobileSection, setMobileSection] = useState<
    'creation' | 'dashboard' | 'ai-chat'
  >('dashboard')
  const [activeFlow, setActiveFlow] = useState<StudioFlow>('hub')
  const [selectedIntent, setSelectedIntent] = useState<CreateIntent | null>(
    null,
  )
  const [generationDrafts, setGenerationDrafts] =
    useState<GenerationDraft[]>(initialDrafts)
  const [activeDraftByFlow, setActiveDraftByFlow] = useState<
    Record<CreationFlow, string>
  >(() => ({
    'study-path':
      initialDrafts.find(
        (draft) => draft.flow === 'study-path' && draft.isPlaceholder,
      )?.id || initialDrafts[0].id,
    'from-notes':
      initialDrafts.find(
        (draft) => draft.flow === 'from-notes' && draft.isPlaceholder,
      )?.id || initialDrafts[1].id,
  }))
  const openingMobileAiChatRef = useRef(false)
  const [aiProvider, setAiProvider] = useState(
    () => readStudyPackAiSettings().provider || 'basic',
  )
  const [activeCreationSection, setActiveCreationSection] =
    useState<CreationSection>('dashboard')
  const [quickDetailLevel, setQuickDetailLevel] =
    useState<StudyMaterialDetailLevel>('medium')
  const [quickDifficulty, setQuickDifficulty] = useState('standard')
  const [quickSourceText, setQuickSourceText] = useState('')
  const [quickCopiedTextDraft, setQuickCopiedTextDraft] = useState('')
  const [quickCopiedTextOpen, setQuickCopiedTextOpen] = useState(false)
  const [quickSourceFiles, setQuickSourceFiles] = useState<File[]>([])
  const [quickSourceMode, setQuickSourceMode] =
    useState<QuickSourceMode>('dashboard')
  const [quickSourceStatus, setQuickSourceStatus] = useState('')
  const [queueClockMs, setQueueClockMs] = useState(() => Date.now())
  const [studyPathRetrySignals, setStudyPathRetrySignals] = useState<
    Record<string, number>
  >({})
  const [studyPathCancelSignals, setStudyPathCancelSignals] = useState<
    Record<string, number>
  >({})
  const [pendingQuickSourceFocus, setPendingQuickSourceFocus] =
    useState<QuickSourceFocus | null>(null)
  const [activeMaterialDraftId, setActiveMaterialDraftId] = useState<
    string | null
  >(null)
  const [visibleQueueJobIds, setVisibleQueueJobIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [autoAcknowledgingDraftIds, setAutoAcknowledgingDraftIds] = useState<
    Set<string>
  >(() => new Set())
  const [fullScreenWidgetPayload, setFullScreenWidgetPayload] = useState<{
    loadWidget?: CustomWidget
    initialEditMode?: boolean
  } | null>(null)
  const quickOptionsPanelRef = useRef<HTMLDivElement | null>(null)
  const quickUploadButtonRef = useRef<HTMLLabelElement | null>(null)
  const quickPasteButtonRef = useRef<HTMLButtonElement | null>(null)
  const quickCopiedTextInputRef = useRef<HTMLTextAreaElement | null>(null)
  const { createStudyPackDashboards } = useWorkspaceActions()
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
      canCreateDashboard: isAdmin,
      canCreateFromNotes: isAdmin && aiProvider !== 'hosted',
      canCreateStudyPath: isAdmin && aiProvider !== 'hosted',
      canCreateWidget: isAdmin,
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
      setAiProvider(readStudyPackAiSettings().provider || 'basic')
    }

    window.addEventListener(
      STUDY_PACK_AI_SETTINGS_CHANGED_EVENT,
      refreshAiProvider,
    )

    return () => {
      window.removeEventListener(
        STUDY_PACK_AI_SETTINGS_CHANGED_EVENT,
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
    const activateCreation = (flow: Exclude<StudioFlow, 'hub'>) => {
      createNewDraft(flow)
      if (isMobile) {
        setMobileSection('creation')
      }
    }
    const handleOpenCreateHub = (event: Event) => {
      const customEvent = event as CustomEvent<OpenCreateHubDetail>
      const detail = customEvent.detail || {}
      setActiveMaterialDraftId(null)
      if (detail.intent === 'study-path' && permissions.canCreateStudyPath) {
        setSelectedIntent('study-path')
        setActiveCreationSection('prompt')
        createNewDraft('study-path')
        return
      }

      setSelectedIntent(detail.intent || null)
      if (detail.openQuickOptions) {
        setActiveCreationSection('sources')
        setQuickSourceMode('sources')
      }
      if (detail.quickSourceFocus) {
        setActiveCreationSection('sources')
        setQuickSourceMode('sources')
        setPendingQuickSourceFocus(detail.quickSourceFocus)
        if (detail.quickSourceFocus === 'paste') {
          setQuickCopiedTextOpen(true)
        }
      }
      setActiveFlow('hub')
      setIsStudioOpen(true)
      if (isMobile) {
        setMobileSection('creation')
      }
    }

    const handleOpenWidgetEditor = (event: Event) => {
      const customEvent = event as CustomEvent<{
        host?: string
        loadWidget?: CustomWidget
        initialEditMode?: boolean
      }>

      if (!readIsAdmin()) {
        return
      }

      setFullScreenWidgetPayload({
        loadWidget: customEvent.detail?.loadWidget,
        initialEditMode: customEvent.detail?.initialEditMode,
      })
      setIsStudioOpen(false)
      dispatchWorkspaceOnboardingEvent({ type: 'widget-editor-opened' })
    }
    const handleOpenStudyPack = () => {
      if (permissions.canCreateFromNotes) {
        activateCreation('from-notes')
      }
    }
    const handleOpenStudyPath = () => {
      if (permissions.canCreateStudyPath) {
        activateCreation('study-path')
      }
    }
    const handleOpenDashboard = () => {
      if (readIsAdmin()) {
        setIsStudioOpen(false)
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
      dispatchWorkspaceOnboardingEvent({ type: 'widget-editor-closed' })
    }

    window.addEventListener(OPEN_CREATE_HUB_EVENT, handleOpenCreateHub)
    window.addEventListener(OPEN_WIDGET_EDITOR_EVENT, handleOpenWidgetEditor)
    window.addEventListener(OPEN_STUDY_PACK_EVENT, handleOpenStudyPack)
    window.addEventListener(OPEN_STUDY_PATH_EVENT, handleOpenStudyPath)
    window.addEventListener(OPEN_DASHBOARD_EDITOR_EVENT, handleOpenDashboard)
    window.addEventListener(CLOSE_CREATE_STUDIO_EVENT, handleCloseCreateStudio)

    return () => {
      window.removeEventListener(OPEN_CREATE_HUB_EVENT, handleOpenCreateHub)
      window.removeEventListener(
        OPEN_WIDGET_EDITOR_EVENT,
        handleOpenWidgetEditor,
      )
      window.removeEventListener(OPEN_STUDY_PACK_EVENT, handleOpenStudyPack)
      window.removeEventListener(OPEN_STUDY_PATH_EVENT, handleOpenStudyPath)
      window.removeEventListener(
        OPEN_DASHBOARD_EDITOR_EVENT,
        handleOpenDashboard,
      )
      window.removeEventListener(
        CLOSE_CREATE_STUDIO_EVENT,
        handleCloseCreateStudio,
      )
    }
  }, [
    isMobile,
    mobileSection,
    permissions.canCreateFromNotes,
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
    dispatchWorkspaceOnboardingEvent({ type: 'widget-editor-closed' })
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

  const reportFromNotesStatus = useCallback(
    (state: WorkspaceCreationTaskState, message?: string) => {
      reportCreationStatus('from-notes', state, message)
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

  const createNewDraft = (flow: Exclude<StudioFlow, 'hub'>) => {
    if (isMobile) {
      window.dispatchEvent(new Event(CLOSE_DASHBOARD_CHAT_EVENT))
    }
    const draft = createGenerationDraft(flow)
    setGenerationDrafts((current) => [
      ...current.filter(
        (existingDraft) =>
          existingDraft.flow !== flow || existingDraft.status !== 'editing',
      ),
      draft,
    ])
    setActiveDraftByFlow((current) => ({ ...current, [flow]: draft.id }))
    setActiveFlow(flow)
    setIsStudioOpen(true)
    if (isMobile) {
      setMobileSection('creation')
    }
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
    (draftId: string, flow: Exclude<StudioFlow, 'hub'>) =>
    (state: WorkspaceCreationTaskState, message?: string) => {
      setGenerationDrafts((current) =>
        current.map((draft) => {
          if (draft.id !== draftId) {
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
        reportFromNotesStatus(state, message)
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
    setSelectedIntent(null)
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
      setSelectedIntent(null)
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
    const fromNotesRetry =
      storedSnapshot?.flow === 'from-notes'
        ? storedSnapshot
        : draft.flow === 'from-notes' &&
          draft.retryResourceType &&
          draft.retrySourceText &&
          draft.retryTitle &&
          draft.retrySourceMode
        ? {
            flow: 'from-notes' as const,
            resourceType: draft.retryResourceType,
            sourceText: draft.retrySourceText,
            title: draft.retryTitle,
            sourceMode: draft.retrySourceMode,
            detailLevel:
              (draft.detailLevel as StudyMaterialDetailLevel) ||
              quickDetailLevel,
            difficulty: draft.retryDifficulty || quickDifficulty,
            provider: (draft.aiProvider as StudyPackAiProvider) || aiProvider,
          }
        : null

    if (draft.flow === 'from-notes' && fromNotesRetry) {
      void runDirectStudyPackCreate(
        fromNotesRetry.resourceType,
        fromNotesRetry.sourceText,
        fromNotesRetry.title,
        fromNotesRetry.sourceMode,
        {
          draftId: draft.id,
          detailLevel: fromNotesRetry.detailLevel,
          difficulty: fromNotesRetry.difficulty,
          provider: fromNotesRetry.provider,
        },
      )
      return
    }

    if (draft.flow === 'from-notes') {
      updateDraft(draft.id, {
        error:
          'Retry data is missing for this older failed job. Start it again from Creation once; future failed jobs keep a retry snapshot.',
      })
      return
    }

    if (draft.flow === 'study-path') {
      updateDraft(draft.id, {
        status: 'generating',
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

  const closeFullScreenWidgetEditor = () => {
    setFullScreenWidgetPayload(null)
    resetOrCloseStudio()
    dispatchWorkspaceOnboardingEvent({ type: 'widget-editor-closed' })
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
  useEffect(() => {
    if (activeCreationSection !== 'dashboard' || hasCurrentDashboardContext) {
      return
    }

    setActiveCreationSection('sources')
    setQuickSourceMode('sources')
  }, [activeCreationSection, hasCurrentDashboardContext])

  const quickHasCustomSources =
    quickSourceText.trim().length > 0 || quickSourceFiles.length > 0
  const quickCustomSourceCount =
    (quickSourceText.trim() ? 1 : 0) + quickSourceFiles.length
  const quickSourceLabel = quickHasCustomSources
    ? `${quickCustomSourceCount} custom source${
        quickCustomSourceCount === 1 ? '' : 's'
      }`
    : hasCurrentDashboardContext
    ? currentDashboardTitle
    : 'Sources required'
  const selectedQuickCreateIntent =
    selectedIntent && selectedIntent !== 'study-path' ? selectedIntent : null
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
  const buildQuickCreationTitle = (
    resourceType: StudyMaterialResourceType,
    sourceMode: QuickSourceMode,
  ) => {
    const label = quickCreateLabels[resourceType]
    const contextTitle =
      sourceMode === 'dashboard' ? currentDashboardTitle : quickSourceLabel
    return `${label} #${getNextQuickCreationIndex(
      resourceType,
    )} · ${truncateQuickCreationContext(contextTitle)}`
  }
  useEffect(() => {
    if (
      !pendingQuickSourceFocus ||
      activeCreationSection !== 'sources' ||
      quickSourceMode !== 'sources' ||
      activeFlow !== 'hub'
    ) {
      return
    }

    const focusTimer = window.setTimeout(() => {
      quickOptionsPanelRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      })

      if (pendingQuickSourceFocus === 'paste') {
        const target =
          quickCopiedTextInputRef.current || quickPasteButtonRef.current
        target?.focus()
      } else {
        quickUploadButtonRef.current?.focus()
      }

      setPendingQuickSourceFocus(null)
    }, 180)

    return () => window.clearTimeout(focusTimer)
  }, [
    activeFlow,
    activeCreationSection,
    pendingQuickSourceFocus,
    quickSourceMode,
    quickCopiedTextOpen,
  ])

  const startCreateIntent = (intent: CreateIntent) => {
    setActiveMaterialDraftId(null)
    setActiveCreationSection(intent === 'study-path' ? 'prompt' : 'sources')
    setSelectedIntent(intent)
    createNewDraft(intent === 'study-path' ? 'study-path' : 'from-notes')
  }

  const addQuickSourceFiles = (files: FileList | File[]) => {
    const nextFiles = Array.from(files)
    setQuickSourceFiles((current) => [...current, ...nextFiles])
    setQuickSourceStatus('')
  }

  const removeQuickSourceFile = (index: number) => {
    setQuickSourceFiles((current) =>
      current.filter((_, fileIndex) => fileIndex !== index),
    )
  }

  const clearQuickSources = () => {
    setQuickSourceText('')
    setQuickCopiedTextDraft('')
    setQuickCopiedTextOpen(false)
    setQuickSourceFiles([])
    setQuickSourceStatus('')
  }

  const addQuickCopiedText = () => {
    const text = quickCopiedTextDraft.trim()
    if (!text) {
      setQuickSourceStatus('Paste copied text before adding it.')
      return
    }

    setQuickSourceText((current) => appendQuickSourceText(current, text))
    setQuickCopiedTextDraft('')
    setQuickCopiedTextOpen(false)
    setQuickSourceStatus('')
  }

  const handleQuickSourceDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (event.dataTransfer.files.length > 0) {
      addQuickSourceFiles(event.dataTransfer.files)
    }
  }

  const extractQuickSourceFile = async (file: File) => {
    const fileName = file.name.toLowerCase()

    if (
      file.type.startsWith('text/') ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.md') ||
      fileName.endsWith('.csv')
    ) {
      return `# ${file.name}\n\n${await file.text()}`
    }

    if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
      const extracted = await extractTextFromPdf(file)
      return extracted.text
    }

    if (
      file.type ===
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      fileName.endsWith('.pptx')
    ) {
      const extracted = await extractTextFromPptx(file)
      return extracted.text
    }

    if (file.type.startsWith('image/')) {
      const text = await extractRawNotesFromImage(file)
      return text ? `# ${file.name}\n\n${text}` : ''
    }

    throw new Error(`${file.name} is not a supported source file.`)
  }

  const buildQuickSourceText = async (sourceMode: QuickSourceMode) => {
    if (sourceMode === 'dashboard') {
      setQuickSourceStatus('')
      return hasCurrentDashboardContext ? currentDashboardContext : ''
    }

    const sourceParts: string[] = []

    if (quickSourceText.trim()) {
      sourceParts.push(`# Pasted text\n\n${quickSourceText.trim()}`)
    }

    if (quickSourceFiles.length > 0) {
      setQuickSourceStatus(
        `Reading ${quickSourceFiles.length} source file${
          quickSourceFiles.length === 1 ? '' : 's'
        }`,
      )
      for (const file of quickSourceFiles) {
        const extracted = await extractQuickSourceFile(file)
        if (extracted.trim()) {
          sourceParts.push(extracted.trim())
        }
      }
    }

    if (sourceParts.length > 0) {
      setQuickSourceStatus('')
      return sourceParts.join('\n\n')
    }

    setQuickSourceStatus('')
    return ''
  }

  const runDirectStudyPackCreate = async (
    resourceType: StudyMaterialResourceType,
    sourceText: string,
    title: string,
    sourceMode: QuickSourceMode,
    retryOptions: {
      draftId?: string
      detailLevel?: StudyMaterialDetailLevel
      difficulty?: string
      provider?: StudyPackAiProvider
    } = {},
  ) => {
    const effectiveDetailLevel = retryOptions.detailLevel || quickDetailLevel
    const effectiveDifficulty = retryOptions.difficulty || quickDifficulty
    const effectiveProvider = retryOptions.provider || aiProvider
    const draft = createGenerationDraft('from-notes', {
      quickCreate: true,
      title,
      inputSummary:
        sourceMode === 'dashboard' ? 'current dashboard' : 'sources',
      selectedResourceType: resourceType,
      detailLevel: effectiveDetailLevel,
      aiProvider: effectiveProvider,
      retrySourceText: sourceText,
      retryTitle: title,
      retrySourceMode: sourceMode,
      retryResourceType: resourceType,
      retryDifficulty: effectiveDifficulty,
    })
    const draftId = retryOptions.draftId || draft.id
    const generationDraft = { ...draft, id: draftId, status: 'generating' }
    saveGenerationRetrySnapshot(draftId, {
      flow: 'from-notes',
      resourceType,
      sourceText,
      title,
      sourceMode,
      detailLevel: effectiveDetailLevel,
      difficulty: effectiveDifficulty,
      provider: effectiveProvider,
    })

    setActiveFlow('hub')
    setSelectedIntent(null)
    setQuickSourceStatus('')
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
            existingDraft.flow !== 'from-notes' ||
            existingDraft.status !== 'editing',
        ),
        generationDraft,
      ]
    })
    setActiveDraftByFlow((current) => ({ ...current, 'from-notes': draftId }))
    dispatchWorkspaceCreationStatus({
      task: 'from-notes',
      state: 'running',
      message: 'Creating study material…',
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
              task: 'from-notes',
              state: 'running',
              message: `Retrying ${quickCreateLabels[resourceType]} (${attempt}/${maxAttempts})...`,
            })
          }

          const credentials = isStrongAiProvider(effectiveProvider)
            ? resolveStudyPackAiCredentials(effectiveProvider)
            : resolveStudyPackAiCredentials()
          const generated = await generateStudyPackWithAi({
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
                ? 'advanced'
                : 'mixed',
            promptMode: false,
            studyPathMode: false,
            signal: generationController.signal,
          })

          if (generationController.signal.aborted) {
            return
          }

          const nextTitle = title
          const augmented = augmentStudyPackPracticeObjects(generated.objects, {
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
          const widgets = createStudyPackOrchestratorWidgets(pack, {
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
                sourceMode === 'dashboard' ? currentDashboard?.id : undefined,
              sourceStudyPathId: currentDashboard?.studyPath?.pathId,
              sourceLessonId: currentDashboard?.studyPath?.dashboardKey,
              sourceLabel:
                sourceMode === 'dashboard'
                  ? currentDashboardTitle
                  : quickSourceLabel,
              createdAt: generationDraft.createdAt,
              updatedAt: now,
              content: {
                widgets,
                sourceSummary: generated.sourceSummary?.bullets?.join('\n'),
              },
              generationConfig: {
                difficulty: effectiveDifficulty,
                detailLevel: effectiveDetailLevel,
                sourceMode,
              },
            },
          })
          removeGenerationRetrySnapshot(draftId)
          dispatchWorkspaceCreationStatus({
            task: 'from-notes',
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
        task: 'from-notes',
        state: 'error',
        message,
      })
      setQuickSourceStatus(message)
    } finally {
      if (
        generationAbortControllersRef.current[draftId] === generationController
      ) {
        delete generationAbortControllersRef.current[draftId]
      }
    }
  }

  const runQuickCreate = async (
    resourceType: StudyMaterialResourceType,
    sourceMode: QuickSourceMode = quickSourceMode,
  ) => {
    const titleBase = quickCreateLabels[resourceType]
    const usesSources = sourceMode === 'sources'
    const hasUsableSource = usesSources
      ? quickHasCustomSources
      : hasCurrentDashboardContext

    if (!hasUsableSource) {
      openCreateFromMaterial(resourceType, 'upload')
      setQuickSourceStatus(`Add material to create ${titleBase}.`)
      return
    }

    try {
      const sourceText = await buildQuickSourceText(sourceMode)

      if (!sourceText.trim()) {
        openCreateFromMaterial(resourceType, 'upload')
        setQuickSourceStatus(`Add material to create ${titleBase}.`)
        return
      }

      await runDirectStudyPackCreate(
        resourceType,
        sourceText,
        buildQuickCreationTitle(resourceType, sourceMode),
        sourceMode,
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Could not read source material for ${titleBase}.`
      setQuickSourceStatus(message)
      openCreateFromMaterial(resourceType, 'upload')
    }
  }

  const openCreateFromMaterial = (
    resourceType?: StudyMaterialResourceType,
    focus?: QuickSourceFocus,
  ) => {
    const shouldUseSources = Boolean(focus) || !hasCurrentDashboardContext

    setActiveMaterialDraftId(null)
    setSelectedIntent(resourceType || selectedQuickCreateIntent || 'quiz')
    setActiveCreationSection(shouldUseSources ? 'sources' : 'dashboard')
    setQuickSourceMode(shouldUseSources ? 'sources' : 'dashboard')
    setQuickSourceStatus(
      shouldUseSources && resourceType
        ? `Add material to create ${quickCreateLabels[resourceType]}.`
        : '',
    )
    if (focus) {
      setPendingQuickSourceFocus(focus)
      if (focus === 'paste') {
        setQuickCopiedTextOpen(true)
      }
    }
  }

  const handleQuickCreateCardClick = (
    resourceType: StudyMaterialResourceType,
  ) => {
    if (!hasCurrentDashboardContext) {
      openCreateFromMaterial(resourceType, 'upload')
      setQuickSourceStatus(
        `Add sources or open a dashboard with study content to create ${quickCreateLabels[resourceType]}.`,
      )
      return
    }

    runQuickCreate(resourceType, 'dashboard')
  }

  const handleCollapsedQuickCreateClick = (
    resourceType: StudyMaterialResourceType,
  ) => {
    if (!hasCurrentDashboardContext) {
      setActiveMaterialDraftId(null)
      setActiveCreationSection('sources')
      setActiveFlow('hub')
      setIsStudioOpen(true)
      if (isMobile) {
        window.dispatchEvent(new Event(CLOSE_DASHBOARD_CHAT_EVENT))
        setMobileSection('creation')
      }
    }

    handleQuickCreateCardClick(resourceType)
  }

  const createOptions: Array<{
    intent: CreateIntent
    title: string
    description: string
    icon: React.ReactNode
  }> = [
    {
      intent: 'study-path',
      title: 'Study Path',
      description: 'Generate a guided learning path with connected dashboards.',
      icon: <RouteIcon />,
    },
  ]

  const studyPathOption = createOptions[0]

  const returnToCreateHub = () => {
    setActiveMaterialDraftId(null)
    setActiveFlow('hub')
    setSelectedIntent(null)
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
    setSelectedIntent(null)
    if (isMobile) {
      setMobileSection('creation')
    }
  }

  const activeMaterialDraft = activeMaterialDraftId
    ? generationDrafts.find((draft) => draft.id === activeMaterialDraftId)
    : null
  const activeMaterial = activeMaterialDraft?.generatedMaterial
  const promoteActiveMaterialToDashboard = () => {
    if (!activeMaterial) {
      return
    }

    createStudyPackDashboards({
      dashboards: [
        {
          name: activeMaterial.title,
          widgets: activeMaterial.content.widgets,
          layoutMode: 'tabs',
          folderName: quickCreateFolders[activeMaterial.type],
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
              From: {activeMaterial.sourceLabel}
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

  const importCurrentDashboardSource = () => {
    if (!hasCurrentDashboardContext) {
      setQuickSourceStatus('Open a dashboard with study content first.')
      return
    }

    setQuickSourceText((current) =>
      appendQuickSourceText(
        current,
        `# ${currentDashboardTitle}\n\n${currentDashboardContext}`,
      ),
    )
    setQuickSourceMode('sources')
    setQuickSourceStatus(`Imported ${currentDashboardTitle}.`)
  }

  const renderQuickCreateCards = (
    sourceMode: QuickSourceMode,
    canCreate: boolean,
  ) => (
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
          const selected =
            sourceMode === 'sources' && selectedIntent === resourceType

          return (
            <Paper
              key={`${sourceMode}-${resourceType}`}
              component="button"
              type="button"
              disabled={sourceMode === 'dashboard' && !canCreate}
              aria-label={`Quick Create ${quickCreateLabels[resourceType]}`}
              elevation={0}
              onClick={() => runQuickCreate(resourceType, sourceMode)}
              sx={{
                minHeight: { xs: 82, sm: 110 },
                p: { xs: 1.15, sm: 1.35 },
                borderRadius: 2,
                border: selected ? 2 : 1,
                borderColor: selected ? accent : alpha(accent, 0.28),
                bgcolor: alpha(accent, selected ? 0.16 : 0.08),
                color: 'text.primary',
                cursor:
                  sourceMode === 'dashboard' && !canCreate
                    ? 'not-allowed'
                    : 'pointer',
                textAlign: 'left',
                opacity: sourceMode === 'dashboard' && !canCreate ? 0.55 : 1,
              }}
            >
              <Stack spacing={0.75}>
                <Box sx={{ color: accent }}>{quickCreateIcons[resourceType]}</Box>
                <Typography variant="subtitle2" fontWeight={900}>
                  {quickCreateLabels[resourceType]}
                </Typography>
                {selected ? (
                  <Typography
                    variant="caption"
                    fontWeight={900}
                    sx={{ color: accent }}
                  >
                    Selected
                  </Typography>
                ) : null}
              </Stack>
            </Paper>
          )
        },
      )}
    </Box>
  )

  const sourceControls = (
    <Stack spacing={1.5}>
      <Box
        onDrop={handleQuickSourceDrop}
        onDragOver={(event) => event.preventDefault()}
        sx={{
          minHeight: 210,
          p: 2,
          border: '1.5px dashed',
          borderColor: quickHasCustomSources ? 'primary.main' : 'divider',
          borderRadius: 2.25,
          bgcolor: quickHasCustomSources
            ? alpha(theme.palette.primary.main, 0.025)
            : 'background.paper',
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
        }}
      >
        <Stack spacing={1.2} alignItems="center" sx={{ width: '100%' }}>
          <UploadFileIcon color="primary" />
          <Box>
            <Typography variant="subtitle1" fontWeight={900}>
              Add sources
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Drop notes here, upload files, paste text, or import the current
              dashboard.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              ref={quickUploadButtonRef}
              component="label"
              variant="contained"
              startIcon={<UploadFileIcon />}
              sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 900 }}
            >
              Upload files
              <input
                hidden
                type="file"
                multiple
                accept={quickSourceAcceptValue}
                onChange={(event) => {
                  if (event.target.files) {
                    addQuickSourceFiles(event.target.files)
                  }
                  event.target.value = ''
                }}
              />
            </Button>
            <Button
              ref={quickPasteButtonRef}
              variant="outlined"
              startIcon={<ContentPasteIcon />}
              onClick={() => {
                setQuickCopiedTextOpen(true)
                setQuickSourceStatus('')
              }}
              sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 900 }}
            >
              Copied text
            </Button>
            <Button
              variant="outlined"
              startIcon={<DashboardIcon />}
              disabled={!hasCurrentDashboardContext}
              onClick={importCurrentDashboardSource}
              sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 900 }}
            >
              Import current dashboard
            </Button>
          </Stack>
        </Stack>
      </Box>
      <Collapse in={quickCopiedTextOpen} unmountOnExit>
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            bgcolor: 'background.paper',
          }}
        >
          <Stack spacing={1.25}>
            <TextField
              label="Copied text"
              inputRef={quickCopiedTextInputRef}
              value={quickCopiedTextDraft}
              onChange={(event) => setQuickCopiedTextDraft(event.target.value)}
              placeholder="Paste notes, assignment text, transcript excerpts, or anything Sources should use."
              multiline
              minRows={5}
              fullWidth
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                onClick={() => {
                  setQuickCopiedTextDraft('')
                  setQuickCopiedTextOpen(false)
                }}
              >
                Cancel
              </Button>
              <Button variant="contained" onClick={addQuickCopiedText}>
                Add copied text
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Collapse>
    </Stack>
  )

  const creationSectionTabs: Array<{
    ariaLabel: string
    disabled: boolean
    icon: React.ReactNode
    id: CreationSection
    label: string
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      ariaLabel: 'Current dashboard',
      icon: <DashboardIcon fontSize="small" />,
      disabled: !hasCurrentDashboardContext,
    },
    {
      id: 'sources',
      label: 'Sources',
      ariaLabel: 'Sources',
      icon: <UploadFileIcon fontSize="small" />,
      disabled: false,
    },
    {
      id: 'prompt',
      label: 'Prompt',
      ariaLabel: 'Prompt',
      icon: <RouteIcon fontSize="small" />,
      disabled: false,
    },
  ]

  const creationHubContent = (
    <Box
      sx={{
        height: '100%',
        overflow: 'auto',
        p: { xs: 2, sm: 2.5 },
        pb: { xs: 10, sm: 2.5 },
      }}
    >
      <Stack spacing={2.5}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 0.75,
            p: 0.75,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2.5,
            bgcolor: 'background.paper',
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 10px 26px rgba(0,0,0,0.22)'
                : '0 10px 24px rgba(15,23,42,0.06)',
          }}
        >
          {creationSectionTabs.map((section) => (
            <Button
              key={section.id}
              aria-label={section.ariaLabel}
              size="small"
              variant={
                activeCreationSection === section.id ? 'contained' : 'outlined'
              }
              disabled={section.disabled}
              startIcon={section.icon}
              onClick={() => {
                setActiveCreationSection(section.id)
                setQuickSourceMode(
                  section.id === 'dashboard' ? 'dashboard' : 'sources',
                )
                setQuickSourceStatus('')
              }}
              sx={{
                minWidth: 0,
                borderRadius: 2,
                py: 0.85,
                px: { xs: 0.35, sm: 0.6 },
                justifyContent: 'center',
                textTransform: 'none',
                fontWeight: 900,
                fontSize: { xs: 10.5, sm: 11.5 },
                lineHeight: 1.15,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                '& .MuiButton-startIcon': {
                  mr: 0.35,
                  ml: 0,
                },
                '& .MuiButton-startIcon > *:nth-of-type(1)': {
                  fontSize: 17,
                },
                '&.Mui-disabled': {
                  opacity: 0.48,
                },
              }}
            >
              <Typography
                component="span"
                variant="caption"
                fontWeight={900}
                noWrap
                sx={{ minWidth: 0, lineHeight: 1.15 }}
              >
                {section.label}
              </Typography>
            </Button>
          ))}
        </Box>

        {activeCreationSection === 'dashboard' ? (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.5, sm: 1.75 },
              border: 1,
              borderColor: hasCurrentDashboardContext
                ? 'divider'
                : alpha(theme.palette.warning.main, 0.65),
              borderRadius: 2.5,
              bgcolor: 'background.default',
            }}
          >
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="h5" fontWeight={900}>
                  Current dashboard
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.3 }}
                >
                  {hasCurrentDashboardContext
                    ? `Generate focused material from ${currentDashboardTitle}.`
                    : 'Open a dashboard with study content to use these quick actions.'}
                </Typography>
              </Box>
              {!hasCurrentDashboardContext ? (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  Current dashboard is empty. Use Sources to add material.
                </Alert>
              ) : null}
              {renderQuickCreateCards('dashboard', hasCurrentDashboardContext)}
            </Stack>
          </Paper>
        ) : null}

        {activeCreationSection === 'sources' ? (
          <Paper
            ref={quickOptionsPanelRef}
            elevation={0}
            sx={{
              p: { xs: 1.5, sm: 1.75 },
              border: 1,
              borderColor: quickHasCustomSources
                ? alpha(theme.palette.primary.main, 0.45)
                : alpha(theme.palette.warning.main, 0.5),
              borderRadius: 2.5,
              bgcolor: 'background.paper',
            }}
          >
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="h5" fontWeight={900}>
                  Sources
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.3 }}
                >
                  Add material once, then reuse it for quick creations.
                </Typography>
              </Box>
              {sourceControls}
              {renderQuickCreateCards('sources', quickHasCustomSources)}
              {selectedQuickCreateIntent ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.25,
                    border: 1,
                    borderColor: quickHasCustomSources
                      ? alpha(theme.palette.primary.main, 0.35)
                      : alpha(theme.palette.warning.main, 0.55),
                    borderRadius: 2,
                    bgcolor: quickHasCustomSources
                      ? alpha(theme.palette.primary.main, 0.045)
                      : alpha(theme.palette.warning.main, 0.08),
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" fontWeight={900}>
                        {quickCreateLabels[selectedQuickCreateIntent]} selected
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {quickHasCustomSources
                          ? 'Ready to create from your session sources.'
                          : `Add sources to create ${quickCreateLabels[selectedQuickCreateIntent]}.`}
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      disabled={!quickHasCustomSources}
                      onClick={() =>
                        runQuickCreate(selectedQuickCreateIntent, 'sources')
                      }
                      sx={{
                        borderRadius: 1.5,
                        textTransform: 'none',
                        fontWeight: 900,
                        flex: '0 0 auto',
                      }}
                    >
                      Create {quickCreateLabels[selectedQuickCreateIntent]}
                    </Button>
                  </Stack>
                </Paper>
              ) : null}
              {(quickHasCustomSources || quickSourceStatus) && (
                <Stack spacing={1}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    gap={1}
                  >
                    <Typography variant="caption" fontWeight={800}>
                      Selected sources
                    </Typography>
                    <Button size="small" onClick={clearQuickSources}>
                      Clear
                    </Button>
                  </Stack>
                  <Stack direction="row" gap={0.75} flexWrap="wrap">
                    {quickSourceText.trim() ? (
                      <Chip
                        size="small"
                        icon={<ContentPasteIcon />}
                        label="Session text"
                        onDelete={() => setQuickSourceText('')}
                      />
                    ) : null}
                    {quickSourceFiles.map((file, index) => (
                      <Chip
                        key={`${file.name}-${index}`}
                        size="small"
                        icon={<DescriptionIcon />}
                        label={file.name}
                        onDelete={() => removeQuickSourceFile(index)}
                      />
                    ))}
                    {quickSourceStatus ? (
                      <Chip
                        size="small"
                        color="primary"
                        label={quickSourceStatus}
                      />
                    ) : null}
                  </Stack>
                </Stack>
              )}
            </Stack>
          </Paper>
        ) : null}

        {activeCreationSection === 'prompt' ? (
          <Paper
            component="button"
            type="button"
            onClick={() => startCreateIntent(studyPathOption.intent)}
            elevation={0}
            sx={{
              width: '100%',
              p: { xs: 2, sm: 2.25 },
              textAlign: 'left',
              borderRadius: 3,
              border: 1,
              borderColor: alpha(theme.palette.primary.main, 0.42),
              bgcolor: alpha(theme.palette.primary.main, 0.075),
              color: 'text.primary',
              cursor: 'pointer',
              display: 'block',
            }}
          >
            <Stack spacing={1.75}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    flex: '0 0 auto',
                  }}
                >
                  {studyPathOption.icon}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="caption"
                    color="primary"
                    fontWeight={900}
                    sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}
                  >
                    Recommended
                  </Typography>
                  <Typography variant="h5" fontWeight={950} lineHeight={1.15}>
                    Prompt
                  </Typography>
                </Box>
              </Stack>
              <Box>
                <Typography variant="subtitle1" fontWeight={900}>
                  Create a Study Path from a learning goal.
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.4 }}
                >
                  Write what you want to learn and StudyMesh builds lesson
                  dashboards.
                </Typography>
              </Box>
              <Button
                component="span"
                variant="contained"
                endIcon={<ChevronRightIcon />}
                sx={{
                  alignSelf: 'flex-start',
                  borderRadius: 999,
                  px: 1.75,
                  textTransform: 'none',
                  fontWeight: 900,
                }}
              >
                Create Study Path
              </Button>
            </Stack>
          </Paper>
        ) : null}

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
                      ? 'Creating study path...'
                      : isGenerating
                      ? `Generating ${materialLabel}...`
                      : draft.title ||
                        (draft.flow === 'study-path'
                          ? 'Study Path'
                          : resourceTypeTitle(draft.selectedResourceType))
                  const generatingDetail =
                    draft.flow === 'study-path'
                      ? [
                          elapsed ? `${elapsed} elapsed` : '',
                          estimate,
                          draft.inputSummary || 'based on source',
                        ]
                          .filter(Boolean)
                          .join(' - ')
                      : [
                          draft.inputSummary || 'based on source',
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
        bgcolor: 'background.paper',
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
              <CreateStudyPathModal
                open
                presentation="embedded"
                onCollapse={isMobile ? undefined : returnToCreateHub}
                autoCreateOnGenerate
                autoRetrySignal={studyPathRetrySignals[draft.id] || 0}
                autoCancelSignal={studyPathCancelSignals[draft.id] || 0}
                openGeneratedInWorkspace={false}
                initialPrompt={
                  !draft.isPlaceholder &&
                  draft.status !== 'ready' &&
                  draft.title &&
                  draft.title !== 'Study Path'
                    ? draft.title
                    : undefined
                }
                onClose={() =>
                  cancelDraftAndReturnToHub(draft.id, 'study-path')
                }
                onCreatePath={(payload) => {
                  const dashboards = createStudyPackDashboards({
                    ...payload,
                    openInWorkspace: false,
                  })
                  const studyPath = createStudyPathContainerState(dashboards)
                  const nextTitle =
                    studyPath?.title ||
                    payload.folderName ||
                    dashboards[0]?.name ||
                    'Study Path'
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
                currentDashboardContext={currentDashboardContext}
                currentDashboardTitle={currentDashboardTitle}
                hasCurrentDashboardContext={hasCurrentDashboardContext}
                allowDashboardSource={false}
                onStatusChange={makeDraftStatusHandler(draft.id, 'study-path')}
                onDraftMetaChange={(metadata) =>
                  updateDraft(draft.id, {
                    title: metadata.title,
                    inputSummary: metadata.inputSummary,
                    detailLevel: metadata.detailLevel,
                    aiProvider,
                  })
                }
              />
            </Box>
          ))}
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: activeFlow === 'from-notes' ? 'flex' : 'none',
          flexDirection: 'column',
        }}
      >
        {generationDrafts
          .filter((draft) => draft.flow === 'from-notes')
          .map((draft) => (
            <Box
              key={draft.id}
              sx={{
                flex: 1,
                minHeight: 0,
                display:
                  draft.id === activeDraftByFlow['from-notes']
                    ? 'flex'
                    : 'none',
                flexDirection: 'column',
              }}
            ></Box>
          ))}
      </Box>
    </Box>
  )

  const openCreationMarker = (draft: GenerationDraft) => {
    const isActiveMarker = activeDraftByFlow[draft.flow] === draft.id

    if (isStudioOpen && activeFlow === draft.flow && isActiveMarker) {
      if (isMobile) {
        setMobileSection('creation')
        return
      }

      closeStudio()
      return
    }

    setActiveFlow(draft.flow)
    if (isMobile) {
      window.dispatchEvent(new Event(CLOSE_DASHBOARD_CHAT_EVENT))
    }
    setActiveDraftByFlow((current) => ({
      ...current,
      [draft.flow]: draft.id,
    }))
    setIsStudioOpen(true)
    if (isMobile) {
      setMobileSection('creation')
    }
  }

  const visibleCreationMarkers = generationDrafts
    .filter((draft) => !draft.quickCreate)
    .map((draft) => {
      const state = getDraftMarkerState(draft)
      if (!isStudioOpen && state === 'editing') {
        return null
      }

      return state ? { draft, state } : null
    })
    .filter(
      (
        marker,
      ): marker is {
        draft: GenerationDraft
        state: GenerationMarkerState
      } => Boolean(marker),
    )

  const openCreateHub = () => {
    if (isMobile && isStudioOpen && activeFlow === 'hub') {
      setActiveMaterialDraftId(null)
      setMobileSection('creation')
      return
    }

    if (!isMobile && isStudioOpen && activeFlow === 'hub') {
      closeStudio()
      return
    }

    setActiveMaterialDraftId(null)
    setSelectedIntent(null)
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
          <Box
            className="studymesh-creation-quick-action"
            component="button"
            type="button"
            aria-label={`Quick Create ${quickCreateLabels[resourceType]}`}
            onClick={(event) => {
              event.stopPropagation()
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
              cursor: 'pointer',
              '&:hover': {
                borderColor: quickCreateAccents[resourceType],
                bgcolor: alpha(quickCreateAccents[resourceType], 0.18),
              },
              '& svg': {
                margin: '0 -2px',
              },
            }}
          >
            {quickCreateIcons[resourceType]}
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

  const widgetBuilderDialog = (
    <WidgetEditorDialog
      open={Boolean(fullScreenWidgetPayload)}
      payload={fullScreenWidgetPayload}
      onClose={closeFullScreenWidgetEditor}
      onSaveComplete={closeFullScreenWidgetEditor}
    />
  )

  if (isMobile) {
    return (
      <WorkspaceMobileLayout
        studioContent={studioContent}
        mobileCreationStatusTray={mobileCreationStatusTray}
        mobileSectionTabs={mobileSectionTabs}
        widgetBuilderDialog={widgetBuilderDialog}
        isStudioOpen={isStudioOpen}
        mobileSection={mobileSection}
        visibleCreationMarkerCount={hasQueueMarker ? 1 : 0}
        theme={theme}
      >
        {children}
      </WorkspaceMobileLayout>
    )
  }

  return (
    <WorkspaceDesktopLayout
      studioContent={studioContent}
      creationStatusMarkers={creationStatusMarkers}
      widgetBuilderDialog={widgetBuilderDialog}
      isStudioOpen={isStudioOpen}
      studioWidth={studioWidth}
      toggleCreatePanel={toggleCreatePanel}
      collapsedCreationActions={collapsedCreationActions}
      startStudioResize={startStudioResize}
      theme={theme}
    >
      {children}
    </WorkspaceDesktopLayout>
  )
}

export default WorkspaceStudioShell
