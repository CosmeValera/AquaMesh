import React, { useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import RouteIcon from '@mui/icons-material/Route'
import {
  createStudyPackOrchestratorWidgets,
  StudyObject,
  StudyPackDashboardLayoutMode,
} from '../../studyPack'
import {
  AiGenerationDebugTrace,
  AiStudyPathDashboardDraft,
  AiStudyPathDraft,
  assertRoleObjectsAreClean,
  filterStudyObjectsForDashboardRole,
  generateStudyPathWithAi,
  isStrongAiProvider,
  isLocalAiGenerationError,
  LocalAiGenerationFailureDebug,
  LocalAiProgressEvent,
  readStudyPackAiSettings,
  resolveStudyPackAiCredentials,
  StrongAiProviderId,
  STUDY_PACK_AI_SETTINGS_CHANGED_EVENT,
  StudyPackAiProvider,
} from '../../studyPack/ai'
import { WorkspaceCreationTaskState } from '../../workspaceCreationStatus'
import StrongAiSessionKeyDialog from './StrongAiSessionKeyDialog'

interface CreateStudyPathModalProps {
  open: boolean
  onClose: () => void
  onCreatePath: (payload: {
    folderName: string
    openInWorkspace?: boolean
    dashboards: Array<{
      name: string
      widgets: ReturnType<typeof createStudyPackOrchestratorWidgets>
      layoutMode?: StudyPackDashboardLayoutMode
      folderName: string
    }>
  }) => void
  presentation?: 'dialog' | 'embedded'
  onCollapse?: () => void
  onContinueCreating?: () => void
  onContinueInBackground?: () => void
  autoCreateOnGenerate?: boolean
  openGeneratedInWorkspace?: boolean
  autoRetrySignal?: number
  autoCancelSignal?: number
  autoGenerateRequest?: { id: number; prompt: string }
  onStatusChange?: (state: WorkspaceCreationTaskState, message?: string) => void
  onDraftMetaChange?: (metadata: {
    title: string
    inputSummary: string
  }) => void
  initialPrompt?: string
}

const providerLabels: Record<StudyPackAiProvider, string> = {
  local: 'Google Local AI',
  gemini: 'Own Gemini API token',
  cerebras: 'Own Cerebras API key',
  hosted: 'Hosted AI',
}

const LOCAL_AI_ESTIMATE_COPY =
  'Local AI runs on your device and can be slow. For faster, richer Study Guides, use a Gemini or Cerebras API key.'
const GEMINI_STUDY_PATH_ESTIMATE_MS = 60 * 1000
const CEREBRAS_STUDY_PATH_ESTIMATE_MS = 10 * 1000
const DEFAULT_STUDY_PATH_PROMPT =
  'Study basic human anatomy focusing on organs and systems (cardiovascular, respiratory, digestive)'

interface GeminiTimedProgress {
  startedAt: number
  elapsedMs: number
  estimatedTotalMs: number
  estimatedRemainingMs: number
  percent: number
}

const getProviderPathProgressLabel = (provider: StudyPackAiProvider): string =>
  provider === 'local'
    ? 'Generating dashboards with Google Local AI...'
    : isStrongAiProvider(provider)
      ? `Generating ordered dashboards with ${providerLabels[provider]}...`
      : 'Generating ordered dashboards with Hosted AI...'

const getProviderPathDescription = (provider: StudyPackAiProvider): string =>
  provider === 'local'
    ? 'Local AI is running on your device. StudyMesh plans the path first, then generates each lesson dashboard with its own estimated timer.'
    : isStrongAiProvider(provider)
      ? `StudyMesh is sending the request to ${providerLabels[provider]} and converting the response into dashboards.`
      : 'Hosted AI uses Study Credits and the app-hosted Cerebras model.'

const formatPipelineRemaining = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes <= 0) {
    return `~${seconds}s remaining`
  }

  return `~${minutes}m ${String(seconds).padStart(2, '0')}s remaining`
}

const formatGeminiDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes <= 0) {
    return `${seconds}s`
  }

  if (seconds === 0) {
    return `${minutes}m`
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

const makeGeminiTimedProgress = (
  startedAt: number,
  estimatedTotalMs: number,
): GeminiTimedProgress => {
  const elapsedMs = Math.max(0, Date.now() - startedAt)

  return {
    startedAt,
    elapsedMs,
    estimatedTotalMs,
    estimatedRemainingMs: Math.max(0, estimatedTotalMs - elapsedMs),
    percent: Math.min(
      99,
      Math.floor((elapsedMs / Math.max(1, estimatedTotalMs)) * 100),
    ),
  }
}

type LocalPipelineStep = NonNullable<
  LocalAiProgressEvent['studyPathPipeline']
>['steps'][number]
type LocalDashboardProgress = NonNullable<
  LocalAiProgressEvent['dashboardProgress']
>[number]

const pipelineStepGroups: Array<{
  key: NonNullable<LocalAiProgressEvent['studyPathStep']>
  label: string
}> = [
  { key: 'planner', label: 'Planning' },
  { key: 'markdown1', label: 'Markdown 1' },
  { key: 'markdown2', label: 'Markdown 2' },
  { key: 'flashcards', label: 'Flashcards' },
  { key: 'quizzes', label: 'Quizzes' },
]

const statusColor = (status: LocalPipelineStep['status']) =>
  status === 'failed'
    ? 'error'
    : status === 'complete'
      ? 'success'
      : status === 'running'
        ? 'primary'
        : 'default'

const aggregatePipelineSteps = (
  steps: LocalPipelineStep[],
): LocalPipelineStep[] =>
  pipelineStepGroups
    .map((group): LocalPipelineStep | null => {
      const groupSteps = steps.filter((step) =>
        group.key === 'planner'
          ? step.id === 'planner'
          : step.id.endsWith(`-${group.key}`),
      )
      if (groupSteps.length === 0) {
        return null
      }

      const completeCount = groupSteps.filter(
        (step) => step.status === 'complete',
      ).length
      const status: LocalPipelineStep['status'] = groupSteps.some(
        (step) => step.status === 'failed',
      )
        ? 'failed'
        : groupSteps.some((step) => step.status === 'running')
          ? 'running'
          : completeCount === groupSteps.length
            ? 'complete'
            : 'pending'
      const percent = Math.round(
        groupSteps.reduce((total, step) => total + step.percent, 0) /
          groupSteps.length,
      )
      const label =
        group.key === 'planner'
          ? group.label
          : `${group.label} ${completeCount}/${groupSteps.length}`

      return {
        id: group.key,
        label,
        status,
        percent,
      }
    })
    .filter((step): step is LocalPipelineStep => Boolean(step))

const threadLaneSteps = (
  pipelineSteps: LocalPipelineStep[],
  dashboardIndex?: number,
): LocalPipelineStep[] =>
  dashboardIndex
    ? pipelineSteps.filter((step) =>
        step.id.startsWith(`dashboard-${dashboardIndex}-`),
      )
    : []

const localThreadLanes = (
  progress: LocalAiProgressEvent,
): Array<{
  threadId: number
  threadCount: number
  active?: LocalDashboardProgress
  completedCount: number
  failedCount: number
  steps: LocalPipelineStep[]
}> => {
  const dashboardProgress = progress.dashboardProgress || []
  const pipelineSteps = progress.studyPathPipeline?.steps || []
  const threadCount =
    dashboardProgress.find((item) => item.threadCount)?.threadCount ||
    Math.max(1, ...dashboardProgress.map((item) => item.threadId || 0))

  return Array.from({ length: threadCount }, (_value, index) => {
    const threadId = index + 1
    const entries = dashboardProgress.filter(
      (item) => item.threadId === threadId,
    )
    const active =
      entries.find((item) => item.status === 'running') ||
      entries
        .filter((item) => item.status !== 'pending')
        .sort(
          (first, second) => second.dashboardIndex - first.dashboardIndex,
        )[0]

    return {
      threadId,
      threadCount,
      active,
      completedCount: entries.filter((item) => item.status === 'complete')
        .length,
      failedCount: entries.filter((item) => item.status === 'failed').length,
      steps: threadLaneSteps(pipelineSteps, active?.dashboardIndex),
    }
  })
}

const getObjectPreview = (object?: StudyObject) => {
  if (!object) {
    return 'Generated study widgets for this lesson.'
  }

  switch (object.kind) {
    case 'markdown':
      return object.markdown
    case 'note':
      return object.body
    case 'term':
      return `${object.term}: ${object.definition}`
    case 'qa':
      return object.question
    case 'quiz':
      return object.question
    case 'list':
      return object.items.slice(0, 2).join(' · ')
    case 'sequence':
      return object.steps.slice(0, 2).join(' → ')
    case 'reviewPrompt':
      return object.prompt
    case 'code':
      return object.caption || object.code
    case 'table':
      return object.headers.join(' · ')
    case 'comparison':
      return object.columns.join(' vs ')
    case 'resource':
      return object.label
    case 'reveal':
      return object.prompt
    default:
      return 'Generated study widgets for this lesson.'
  }
}

const getDashboardPreviewSummary = (
  dashboard: AiStudyPathDashboardDraft,
  provider: StudyPackAiProvider,
): string =>
  provider === 'local' && !dashboard.summary
    ? truncate(getObjectPreview(dashboard.objects[0]))
    : dashboard.summary || truncate(getObjectPreview(dashboard.objects[0]))

const truncate = (value: string, max = 150) => {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > max
    ? `${normalized.slice(0, Math.max(0, max - 1))}…`
    : normalized
}

const makePackId = (title: string, index: number) =>
  `${title}-${index + 1}`.toLowerCase().replace(/[^a-z0-9]+/g, '-') ||
  `study-path-${index + 1}`

const formatDebugValue = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value, null, 2)

const localAiFailureDebugSections = (
  debug: LocalAiGenerationFailureDebug,
): Array<[string, unknown]> => [
  [
    'Dashboard',
    debug.dashboardIndex && debug.dashboardCount
      ? `${debug.dashboardIndex} of ${debug.dashboardCount}`
      : '',
  ],
  ['Prompt length', debug.promptLength],
  [
    'Attempt',
    debug.attempt && debug.attemptCount
      ? `${debug.attempt} of ${debug.attemptCount}`
      : '',
  ],
  ['Raw dashboard response', debug.rawResponse],
  ['Parsed JSON', debug.parsedJson],
  ['Parse error', debug.parseError],
  ['Mapping error', debug.mappingError],
  ['Dropped or repaired items', debug.droppedOrRepairedItems],
  ['Failed attempts', debug.attempts],
]

const combinedDebugTrace = (
  draft: AiStudyPathDraft | null,
): AiGenerationDebugTrace | null => {
  if (!draft) {
    return null
  }

  const traces = draft.dashboards
    .map((dashboard) => dashboard.debugTrace)
    .filter((trace): trace is AiGenerationDebugTrace => Boolean(trace))
  if (traces.length === 0) {
    return null
  }

  const validatedContracts = draft.dashboards.map((dashboard, index) => ({
    dashboard: index + 1,
    title: dashboard.title,
    dashboardRole: dashboard.dashboardRole,
    validatedContract: dashboard.debugTrace?.validatedContract || null,
  }))
  const roleFilteredContracts = draft.dashboards.map((dashboard, index) => ({
    dashboard: index + 1,
    title: dashboard.title,
    dashboardRole: dashboard.dashboardRole,
    roleFilteredContract: dashboard.debugTrace?.roleFilteredContract || null,
  }))

  return {
    rawAiResponse: traces
      .map((trace) => trace.rawAiResponse)
      .join('\n\n---\n\n'),
    rawDashboardInput: draft.dashboards.map((dashboard, index) => ({
      dashboard: index + 1,
      title: dashboard.title,
      dashboardRole: dashboard.dashboardRole,
      rawDashboardInput: dashboard.debugTrace?.rawDashboardInput || null,
    })),
    roleSanitizedInput: draft.dashboards.map((dashboard, index) => ({
      dashboard: index + 1,
      title: dashboard.title,
      dashboardRole: dashboard.dashboardRole,
      roleSanitizedInput: dashboard.debugTrace?.roleSanitizedInput || null,
    })),
    validatedContract: validatedContracts,
    roleFilteredContract: roleFilteredContracts,
    droppedOrRepairedItems: traces.flatMap(
      (trace) => trace.droppedOrRepairedItems,
    ),
    finalObjects: draft.dashboards.flatMap((dashboard) => dashboard.objects),
    localAiFailedAttempts: traces.flatMap(
      (trace) => trace.localAiFailedAttempts || [],
    ),
  }
}

const makeStudyPathId = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'study-path'

const CreateStudyPathModal: React.FC<CreateStudyPathModalProps> = ({
  open,
  onClose,
  onCreatePath,
  presentation = 'dialog',
  onCollapse,
  onContinueCreating,
  onContinueInBackground,
  autoCreateOnGenerate = false,
  openGeneratedInWorkspace,
  autoRetrySignal = 0,
  autoCancelSignal = 0,
  autoGenerateRequest,
  onStatusChange,
  onDraftMetaChange,
  initialPrompt,
}) => {
  const [step, setStep] = useState<'prompt' | 'review'>('prompt')
  const [prompt, setPrompt] = useState(
    initialPrompt || DEFAULT_STUDY_PATH_PROMPT,
  )
  const [aiProvider, setAiProvider] = useState<StudyPackAiProvider>('hosted')
  const [draft, setDraft] = useState<AiStudyPathDraft | null>(null)
  const [reviewFolderName, setReviewFolderName] = useState('')
  const [openInWorkspace, setOpenInWorkspace] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [localAiProgress, setLocalAiProgress] =
    useState<LocalAiProgressEvent | null>(null)
  const [geminiProgress, setGeminiProgress] =
    useState<GeminiTimedProgress | null>(null)
  const [localAiFailureDebug, setLocalAiFailureDebug] =
    useState<LocalAiGenerationFailureDebug | null>(null)
  const [error, setError] = useState('')
  const [sessionKeyRequest, setSessionKeyRequest] = useState<{
    provider: StrongAiProviderId
    model: string
    promptOverride?: string
  } | null>(null)
  const activeGenerationRef = useRef<AbortController | null>(null)
  const initializedProviderRef = useRef(false)
  const autoRetrySignalRef = useRef(autoRetrySignal)
  const autoCancelSignalRef = useRef(autoCancelSignal)
  const debugTrace = combinedDebugTrace(draft)

  React.useEffect(() => {
    onDraftMetaChange?.({
      title: prompt.trim() || 'Study Guide',
      inputSummary: prompt.trim() || 'Learning prompt',
    })
  }, [onDraftMetaChange, prompt])

  React.useEffect(() => {
    if (isGenerating) {
      onStatusChange?.('running', 'Create Study Guide is working')
      return
    }

    if (step === 'review' && draft) {
      onStatusChange?.('complete', 'Create Study Guide is ready to review')
      return
    }

    if (error) {
      if (
        autoCreateOnGenerate &&
        autoRetrySignalRef.current !== autoRetrySignal
      ) {
        return
      }

      onStatusChange?.('error', error)
      return
    }

    if (autoCreateOnGenerate) {
      return
    }

    onStatusChange?.('idle')
  }, [
    autoCreateOnGenerate,
    autoRetrySignal,
    draft,
    error,
    isGenerating,
    onStatusChange,
    step,
  ])

  const cancelActiveGeneration = () => {
    activeGenerationRef.current?.abort()
    activeGenerationRef.current = null
  }

  React.useEffect(
    () => () => {
      cancelActiveGeneration()
    },
    [],
  )

  React.useEffect(() => {
    if (!isGenerating || !isStrongAiProvider(aiProvider) || !geminiProgress) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setGeminiProgress((current) =>
        current
          ? makeGeminiTimedProgress(current.startedAt, current.estimatedTotalMs)
          : current,
      )
    }, 500)

    return () => window.clearInterval(intervalId)
  }, [aiProvider, geminiProgress, isGenerating])

  React.useEffect(() => {
    const refreshAiProvider = () => {
      const provider = readStudyPackAiSettings().provider || 'hosted'
      setAiProvider(provider)
    }

    if (open) {
      refreshAiProvider()
      if (!initializedProviderRef.current) {
        initializedProviderRef.current = true
      }
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
  }, [isGenerating, open])

  const reset = () => {
    setStep('prompt')
    setPrompt(initialPrompt || DEFAULT_STUDY_PATH_PROMPT)
    setDraft(null)
    setReviewFolderName('')
    setOpenInWorkspace(true)
    setIsGenerating(false)
    setLocalAiProgress(null)
    setLocalAiFailureDebug(null)
    setError('')
  }

  const handleClose = () => {
    cancelActiveGeneration()
    reset()
    onStatusChange?.('idle')
    onClose()
  }

  const cancelSessionKeyRequest = () => {
    const missingKeyProvider = sessionKeyRequest?.provider || aiProvider
    const message = `${providerLabels[missingKeyProvider]} needs an API key before StudyMesh can create a Study Guide.`
    setSessionKeyRequest(null)
    setError(message)
    if (autoCreateOnGenerate) {
      onStatusChange?.('error', message)
    }
  }

  const generatePath = async (promptOverride?: string) => {
    const settingsProvider = readStudyPackAiSettings().provider || 'hosted'
    const effectiveAiProvider = settingsProvider
    setAiProvider(effectiveAiProvider)
    const basePrompt =
      typeof promptOverride === 'string' ? promptOverride.trim() : prompt.trim()
    const effectivePrompt = basePrompt

    if (!basePrompt) {
      setError('Describe what you want StudyMesh to teach.')
      return
    }

    const credentials = isStrongAiProvider(effectiveAiProvider)
      ? resolveStudyPackAiCredentials(effectiveAiProvider)
      : resolveStudyPackAiCredentials()
    if (isStrongAiProvider(effectiveAiProvider) && !credentials.apiToken) {
      setSessionKeyRequest({
        provider: effectiveAiProvider,
        model: credentials.model,
        promptOverride,
      })
      setError('')
      return
    }

    cancelActiveGeneration()
    const generationController = new AbortController()
    activeGenerationRef.current = generationController
    setIsGenerating(true)
    setLocalAiProgress(null)
    setGeminiProgress(
      isStrongAiProvider(effectiveAiProvider)
        ? makeGeminiTimedProgress(
            Date.now(),
            effectiveAiProvider === 'cerebras'
              ? CEREBRAS_STUDY_PATH_ESTIMATE_MS
              : GEMINI_STUDY_PATH_ESTIMATE_MS,
          )
        : null,
    )
    setLocalAiFailureDebug(null)
    setError('')
    if (autoCreateOnGenerate) {
      onCollapse?.()
    }

    try {
      const nextDraft = await generateStudyPathWithAi({
        provider: effectiveAiProvider,
        apiToken: credentials.apiToken,
        model: credentials.model,
        title: 'Study Guide',
        folderName: '',
        prompt: effectivePrompt,
        signal: generationController.signal,
        onProgress: (event) => {
          if (generationController.signal.aborted) {
            return
          }

          setLocalAiProgress(event)
        },
      })
      if (generationController.signal.aborted) {
        return
      }

      const sanitizedDashboards = nextDraft.dashboards.map((dashboard) => {
        if (effectiveAiProvider === 'local') {
          return dashboard
        }

        const events = [...(dashboard.debugTrace?.droppedOrRepairedItems || [])]
        const objects = filterStudyObjectsForDashboardRole(
          dashboard.objects,
          dashboard.dashboardRole,
          events,
        )
        assertRoleObjectsAreClean(
          objects,
          dashboard.dashboardRole,
          dashboard.title || 'Study Guide dashboard',
        )

        return {
          ...dashboard,
          objects,
          debugTrace: dashboard.debugTrace
            ? {
                ...dashboard.debugTrace,
                droppedOrRepairedItems: events,
                finalObjects: objects,
              }
            : dashboard.debugTrace,
        }
      })
      const sanitizedDraft = { ...nextDraft, dashboards: sanitizedDashboards }
      setDraft(sanitizedDraft)
      setReviewFolderName(nextDraft.folderName || nextDraft.title || '')
      if (autoCreateOnGenerate) {
        onCreatePath(buildPathPayload(sanitizedDraft))
        reset()
      } else {
        setStep('review')
      }
    } catch (err) {
      if (
        generationController.signal.aborted ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        return
      }

      setLocalAiFailureDebug(
        effectiveAiProvider === 'local' &&
          isLocalAiGenerationError(err) &&
          err.debug
          ? err.debug
          : null,
      )
      setError(
        err instanceof Error
          ? err.message
          : 'Could not generate this Study Guide.',
      )
    } finally {
      if (activeGenerationRef.current === generationController) {
        activeGenerationRef.current = null
      }

      if (!generationController.signal.aborted) {
        setIsGenerating(false)
        setLocalAiProgress(null)
        setGeminiProgress(null)
      }
    }
  }

  const cancelGeneration = () => {
    cancelActiveGeneration()
    setIsGenerating(false)
    setLocalAiProgress(null)
    setGeminiProgress(null)
    setError('')
    onStatusChange?.('idle')
  }

  React.useEffect(() => {
    if (autoRetrySignalRef.current === autoRetrySignal) {
      return
    }

    autoRetrySignalRef.current = autoRetrySignal
    if (autoCreateOnGenerate) {
      void generatePath()
    }
  }, [autoCreateOnGenerate, autoRetrySignal])

  React.useEffect(() => {
    if (!autoGenerateRequest) {
      return
    }

    const nextPrompt = autoGenerateRequest.prompt.trim()
    setPrompt(nextPrompt)
    setError('')
    void generatePath(nextPrompt)
  }, [autoGenerateRequest?.id])

  React.useEffect(() => {
    if (autoCancelSignalRef.current === autoCancelSignal) {
      return
    }

    autoCancelSignalRef.current = autoCancelSignal
    if (isGenerating) {
      cancelGeneration()
    }
  }, [autoCancelSignal, isGenerating])

  const buildPathPayload = (
    pathDraft: AiStudyPathDraft,
  ): Parameters<CreateStudyPathModalProps['onCreatePath']>[0] => {
    const effectiveFolder =
      reviewFolderName.trim() ||
      pathDraft.folderName ||
      pathDraft.title ||
      'Study Guide'
    const studyPathId = makeStudyPathId(pathDraft.title || effectiveFolder)
    const dashboardCount = pathDraft.dashboards.length
    const firstMarkdown = (dashboard: AiStudyPathDraft['dashboards'][number]) =>
      dashboard.objects.find((object) => object.kind === 'markdown')
    const sourceTextForDashboard = (
      dashboard: AiStudyPathDraft['dashboards'][number],
    ) => {
      const markdown = firstMarkdown(dashboard)

      return dashboard.rawNotes || markdown?.markdown || prompt
    }

    return {
      folderName: effectiveFolder,
      openInWorkspace: openGeneratedInWorkspace ?? openInWorkspace,
      dashboards: pathDraft.dashboards.map((dashboard, index) => ({
        name: dashboard.title || `${pathDraft.title} ${index + 1}`,
        folderName: effectiveFolder,
        layoutMode: 'smart',
        widgets: createStudyPackOrchestratorWidgets(
          {
            id: makePackId(dashboard.title || pathDraft.title, index),
            title: dashboard.title || `${pathDraft.title} ${index + 1}`,
            sourceFormat: dashboard.sourceFormat || 'text',
            objects: dashboard.objects,
            warnings: dashboard.warnings || [],
            sourceSummary: dashboard.sourceSummary,
            dashboardRole: dashboard.dashboardRole,
          },
          {
            rawSource: sourceTextForDashboard(dashboard),
            includeSourceWidget: true,
            includeSourceSummaryWidget: aiProvider !== 'local',
            includeSummaryChart: false,
            widgetIdPrefix: makePackId(
              dashboard.title || pathDraft.title,
              index,
            ),
            studyPath: {
              pathId: studyPathId,
              title: pathDraft.title || effectiveFolder,
              dashboardKey: `${studyPathId}-${index + 1}`,
              dashboardName:
                dashboard.title || `${pathDraft.title} ${index + 1}`,
              dashboardIndex: index + 1,
              dashboardCount,
              folderName: effectiveFolder,
              dashboardRole: dashboard.dashboardRole,
              dashboardPurpose: dashboard.dashboardPurpose,
              practiceType: dashboard.practiceType,
              layoutReason: dashboard.layoutReason,
              sourceRefs: dashboard.sourceRefs,
            },
          },
        ),
      })),
    }
  }

  const createPath = () => {
    if (!draft) {
      return
    }

    onCreatePath(buildPathPayload(draft))
    handleClose()
  }

  const content = (
    <>
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={2}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                flex: '0 0 auto',
              }}
            >
              <RouteIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" fontWeight={900} noWrap>
                Create Study Guide
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Build an ordered lesson path from a learning goal.
              </Typography>
            </Box>
          </Stack>
          {onCollapse && (
            <Tooltip title="Collapse panel">
              <IconButton
                aria-label="Collapse Create Study Guide panel"
                onClick={onCollapse}
                size="small"
                sx={{
                  color: 'text.primary',
                  bgcolor: 'background.default',
                  border: 1,
                  borderColor: 'divider',
                  flex: '0 0 auto',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    borderColor: 'text.secondary',
                  },
                }}
              >
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent
        sx={{ bgcolor: 'background.default', p: { xs: 2, md: 3 } }}
      >
        <Stack spacing={presentation === 'embedded' ? 1.5 : 2}>
          {error && (
            <>
              <Alert severity="error">{error}</Alert>
            </>
          )}
          {step === 'prompt' ? (
            <>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <Stack spacing={2}>
                  <TextField
                    label="Study Guide prompt"
                    inputProps={{
                      'aria-label': 'What should StudyMesh teach?',
                    }}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Example: Help me learn React hooks as a beginner/someone with JS experience..."
                    multiline
                    minRows={presentation === 'embedded' ? 5 : 6}
                    required
                    fullWidth
                  />
                </Stack>
              </Paper>
              {aiProvider === 'local' && (
                <Alert severity="info">{LOCAL_AI_ESTIMATE_COPY}</Alert>
              )}
              {aiProvider === 'hosted' && (
                <Alert severity="info">
                  Hosted AI uses Study Credits. Creating a Study Guide costs 2
                  credits.
                </Alert>
              )}
              {isGenerating && !autoCreateOnGenerate && (
                <Paper
                  elevation={0}
                  sx={{ p: 2, border: 1, borderColor: 'primary.main' }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AutoAwesomeIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle2" fontWeight={800}>
                        {localAiProgress?.label ||
                          getProviderPathProgressLabel(aiProvider)}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {providerLabels[aiProvider]}:{' '}
                      {getProviderPathDescription(aiProvider)}
                    </Typography>
                    {aiProvider === 'local' && localAiProgress ? (
                      (() => {
                        const pipeline = localAiProgress.studyPathPipeline
                        const threadLanes = localThreadLanes(localAiProgress)

                        return (
                          <Stack spacing={1.5}>
                            {pipeline ? (
                              <Box>
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                  spacing={1}
                                >
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    fontWeight={700}
                                  >
                                    {pipeline.label}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {formatPipelineRemaining(
                                      pipeline.estimatedRemainingMs,
                                    )}
                                  </Typography>
                                </Stack>
                                <LinearProgress
                                  variant="determinate"
                                  value={pipeline.percent}
                                />
                                <Stack
                                  direction="row"
                                  spacing={0.75}
                                  useFlexGap
                                  flexWrap="wrap"
                                  sx={{ mt: 1 }}
                                >
                                  {aggregatePipelineSteps(pipeline.steps).map(
                                    (pipelineStep) => (
                                      <Chip
                                        key={pipelineStep.id}
                                        size="small"
                                        label={`${pipelineStep.label} ${pipelineStep.percent}%`}
                                        color={statusColor(pipelineStep.status)}
                                        variant={
                                          pipelineStep.status === 'pending'
                                            ? 'outlined'
                                            : 'filled'
                                        }
                                      />
                                    ),
                                  )}
                                </Stack>
                              </Box>
                            ) : (
                              <LinearProgress
                                variant="determinate"
                                value={localAiProgress.percent}
                              />
                            )}
                            {threadLanes.length > 0 ? (
                              <Box
                                sx={{
                                  display: 'grid',
                                  gridTemplateColumns:
                                    'repeat(auto-fit, minmax(220px, 1fr))',
                                  gap: 1,
                                }}
                              >
                                {threadLanes.map((lane) => (
                                  <Box
                                    key={lane.threadId}
                                    sx={{
                                      border: 1,
                                      borderColor: 'divider',
                                      borderRadius: 1,
                                      p: 1,
                                    }}
                                  >
                                    <Stack spacing={0.75}>
                                      <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        spacing={1}
                                      >
                                        <Typography
                                          variant="caption"
                                          fontWeight={800}
                                        >
                                          Thread {lane.threadId}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          {lane.completedCount} done
                                          {lane.failedCount > 0
                                            ? `, ${lane.failedCount} failed`
                                            : ''}
                                        </Typography>
                                      </Stack>
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        {lane.active?.label || 'Waiting'}
                                      </Typography>
                                      <LinearProgress
                                        variant="determinate"
                                        value={lane.active?.percent || 0}
                                        color={
                                          lane.active?.status === 'failed'
                                            ? 'error'
                                            : lane.active?.status === 'complete'
                                              ? 'success'
                                              : 'primary'
                                        }
                                      />
                                      {lane.steps.length > 0 ? (
                                        <Stack
                                          direction="row"
                                          spacing={0.5}
                                          useFlexGap
                                          flexWrap="wrap"
                                        >
                                          {lane.steps.map((step) => (
                                            <Chip
                                              key={step.id}
                                              size="small"
                                              label={`${step.label.replace(
                                                /^Dashboard \d+: /,
                                                '',
                                              )} ${step.percent}%`}
                                              color={statusColor(step.status)}
                                              variant={
                                                step.status === 'pending'
                                                  ? 'outlined'
                                                  : 'filled'
                                              }
                                            />
                                          ))}
                                        </Stack>
                                      ) : null}
                                    </Stack>
                                  </Box>
                                ))}
                              </Box>
                            ) : null}
                          </Stack>
                        )
                      })()
                    ) : isStrongAiProvider(aiProvider) && geminiProgress ? (
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">
                            Elapsed{' '}
                            {formatGeminiDuration(geminiProgress.elapsedMs)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {geminiProgress.percent}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={geminiProgress.percent}
                        />
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={{ xs: 0.25, sm: 1.5 }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            Estimated total{' '}
                            {formatGeminiDuration(
                              geminiProgress.estimatedTotalMs,
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Remaining{' '}
                            {formatGeminiDuration(
                              geminiProgress.estimatedRemainingMs,
                            )}
                          </Typography>
                        </Stack>
                      </Stack>
                    ) : (
                      <LinearProgress />
                    )}
                  </Stack>
                </Paper>
              )}
              {isGenerating && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    border: 1,
                    borderColor: 'warning.main',
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                  }}
                >
                  <Stack spacing={1}>
                    <Typography variant="subtitle2" fontWeight={900}>
                      Study Guide generation running
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                      <Button onClick={cancelGeneration}>Cancel</Button>
                      <Button onClick={onContinueCreating}>
                        Continue Creating
                      </Button>
                      <Button
                        variant="contained"
                        onClick={onContinueInBackground}
                      >
                        Continue in Background
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              )}
              {localAiFailureDebug ? (
                <Paper
                  component="details"
                  elevation={0}
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.default',
                  }}
                >
                  <Typography component="summary" variant="subtitle2">
                    Local AI failure debug
                  </Typography>
                  <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                    {localAiFailureDebugSections(localAiFailureDebug)
                      .filter(([, value]) => {
                        if (Array.isArray(value)) {
                          return value.length > 0
                        }

                        return value !== undefined && value !== ''
                      })
                      .map(([label, value]) => (
                        <Box key={label}>
                          <Typography variant="caption" fontWeight={700}>
                            {label}
                          </Typography>
                          <Box
                            component="pre"
                            data-testid={`local-ai-failure-debug-${label
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, '-')}`}
                            sx={{
                              m: 0,
                              mt: 0.5,
                              p: 1,
                              maxHeight: 180,
                              overflow: 'auto',
                              bgcolor: 'background.paper',
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1,
                              fontSize: 12,
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {formatDebugValue(value)}
                          </Box>
                        </Box>
                      ))}
                  </Stack>
                </Paper>
              ) : null}
            </>
          ) : (
            <>
              <TextField
                label="Folder name"
                value={reviewFolderName}
                onChange={(event) => setReviewFolderName(event.target.value)}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={openInWorkspace}
                    onChange={(event) =>
                      setOpenInWorkspace(event.target.checked)
                    }
                  />
                }
                label="Open as a Study Guide tutorial after creating it"
              />
              <Stack spacing={1.5}>
                {draft?.dashboards.map((dashboard, index) => (
                  <Paper
                    key={`${dashboard.title}-${index}`}
                    elevation={0}
                    data-testid={`study-path-dashboard-${index + 1}`}
                    sx={{ p: 2, border: 1, borderColor: 'divider' }}
                  >
                    <Stack spacing={1}>
                      <Stack
                        direction="row"
                        gap={1}
                        flexWrap="wrap"
                        alignItems="center"
                      >
                        <Chip
                          label={`Dashboard ${index + 1}`}
                          color="primary"
                          size="small"
                        />
                        <Chip
                          label={`${dashboard.objects.length} study items`}
                          size="small"
                        />
                        {dashboard.dashboardPurpose ? (
                          <Chip
                            label={dashboard.dashboardPurpose}
                            size="small"
                          />
                        ) : null}
                      </Stack>
                      <Typography variant="subtitle1" fontWeight={800}>
                        {dashboard.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {getDashboardPreviewSummary(dashboard, aiProvider)}
                      </Typography>
                      <Typography variant="body2">
                        {truncate(getObjectPreview(dashboard.objects[0]))}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
              {draft?.warnings.length ? (
                <Alert severity="warning">
                  {draft.warnings.slice(0, 2).join(' ')}
                </Alert>
              ) : null}
              {debugTrace ? (
                <Paper
                  component="details"
                  elevation={0}
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.default',
                  }}
                >
                  <Typography component="summary" variant="subtitle2">
                    AI generation debug
                  </Typography>
                  <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                    {[
                      ['Raw AI response', debugTrace.rawAiResponse],
                      ['Raw dashboard input', debugTrace.rawDashboardInput],
                      [
                        'Sanitized input before normalization',
                        debugTrace.roleSanitizedInput,
                      ],
                      [
                        'Validated contract before role filtering',
                        debugTrace.validatedContract,
                      ],
                      [
                        'Role-filtered contract',
                        debugTrace.roleFilteredContract,
                      ],
                      [
                        'Dropped or repaired items',
                        debugTrace.droppedOrRepairedItems,
                      ],
                      [
                        'Local AI failed attempts',
                        debugTrace.localAiFailedAttempts,
                      ],
                      ['Final StudyObject mapping', debugTrace.finalObjects],
                    ]
                      .filter(([, value]) => {
                        if (Array.isArray(value)) {
                          return value.length > 0
                        }

                        return value !== undefined
                      })
                      .map(([label, value]) => (
                        <Box key={String(label)}>
                          <Typography variant="caption" fontWeight={700}>
                            {String(label)}
                          </Typography>
                          <Box
                            component="pre"
                            data-testid={`study-path-debug-${String(label)
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, '-')}`}
                            sx={{
                              m: 0,
                              mt: 0.5,
                              p: 1,
                              maxHeight: 180,
                              overflow: 'auto',
                              bgcolor: 'background.paper',
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1,
                              fontSize: 12,
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {formatDebugValue(value)}
                          </Box>
                        </Box>
                      ))}
                  </Stack>
                </Paper>
              ) : null}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, flexShrink: 0 }}>
        <Button onClick={handleClose}>Cancel</Button>
        {step === 'review' && (
          <Button onClick={() => setStep('prompt')}>Back</Button>
        )}
        {step === 'prompt' ? (
          <Button
            variant="contained"
            onClick={() => void generatePath()}
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating ? 'Generating...' : 'Generate Study Guide'}
          </Button>
        ) : (
          <Button variant="contained" onClick={createPath}>
            Create {draft?.dashboards.length || 0} dashboards
          </Button>
        )}
      </DialogActions>
    </>
  )

  if (presentation === 'embedded') {
    if (!open || (autoCreateOnGenerate && !sessionKeyRequest)) {
      return null
    }

    if (autoCreateOnGenerate && sessionKeyRequest) {
      return (
        <StrongAiSessionKeyDialog
          open
          provider={sessionKeyRequest.provider}
          model={sessionKeyRequest.model}
          onCancel={cancelSessionKeyRequest}
          onSaved={() => {
            const promptOverride = sessionKeyRequest.promptOverride
            setSessionKeyRequest(null)
            void generatePath(promptOverride)
          }}
        />
      )
    }

    return (
      <>
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            overflow: 'hidden',
            '& .MuiDialogContent-root': {
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
            },
          }}
        >
          {content}
        </Box>
        {sessionKeyRequest ? (
          <StrongAiSessionKeyDialog
            open
            provider={sessionKeyRequest.provider}
            model={sessionKeyRequest.model}
            onCancel={cancelSessionKeyRequest}
            onSaved={() => {
              const promptOverride = sessionKeyRequest.promptOverride
              setSessionKeyRequest(null)
              void generatePath(promptOverride)
            }}
          />
        ) : null}
      </>
    )
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            borderRadius: 3,
            minHeight: { xs: '100dvh', md: 620 },
          },
        }}
      >
        {content}
      </Dialog>
      {sessionKeyRequest ? (
        <StrongAiSessionKeyDialog
          open
          provider={sessionKeyRequest.provider}
          model={sessionKeyRequest.model}
          onCancel={cancelSessionKeyRequest}
          onSaved={() => {
            const promptOverride = sessionKeyRequest.promptOverride
            setSessionKeyRequest(null)
            void generatePath(promptOverride)
          }}
        />
      ) : null}
    </>
  )
}

export default CreateStudyPathModal
