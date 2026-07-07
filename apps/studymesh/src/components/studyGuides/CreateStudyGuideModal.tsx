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
  createQuickCreateOrchestratorWidgets,
  StudyObject,
  QuickCreateDashboardLayoutMode,
} from '../../quickCreate'
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
  readQuickCreateAiSettings,
  resolveQuickCreateAiCredentials,
  StrongAiProviderId,
  QUICK_CREATE_AI_SETTINGS_CHANGED_EVENT,
  QuickCreateAiProvider,
} from '../../quickCreate/ai'
import {
  getHostedAiCreditCost,
} from '../../quickCreate/ai/hostedCredits'
import { WorkspaceCreationTaskState } from '../../workspaceCreationStatus'
import StrongAiSessionKeyDialog from '../ai/StrongAiSessionKeyDialog'
import StudyCreditCostLabel from '../hostedAi/StudyCreditCostLabel'
import { getAllUserKnownTopics } from '../../profileContext'
import type { StudyGuideQuickStart } from '../../state/store'
import { resolveContentLanguage } from '../../language/contentLanguage'
import { useInterfaceText } from '../../language/interfaceLanguage'

interface CreateStudyGuideModalProps {
  open: boolean
  onClose: () => void
  onCreatePath: (payload: {
    folderName: string
    openInWorkspace?: boolean
    quickStart?: StudyGuideQuickStart
    dashboards: Array<{
      name: string
      widgets: ReturnType<typeof createQuickCreateOrchestratorWidgets>
      layoutMode?: QuickCreateDashboardLayoutMode
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

const GEMINI_STUDY_PATH_ESTIMATE_MS = 60 * 1000
const CEREBRAS_STUDY_PATH_ESTIMATE_MS = 10 * 1000
interface GeminiTimedProgress {
  startedAt: number
  elapsedMs: number
  estimatedTotalMs: number
  estimatedRemainingMs: number
  percent: number
}

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
  provider: QuickCreateAiProvider,
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

const studyGuideCreditCost = getHostedAiCreditCost('study-guide')

const CreateStudyGuideModal: React.FC<CreateStudyGuideModalProps> = ({
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
  const { t } = useInterfaceText()
  const defaultStudyPathPrompt = t('studyGuides.defaultPrompt')
  const providerLabel = (provider: QuickCreateAiProvider): string => {
    switch (provider) {
      case 'local':
        return t('ai.localGoogle')
      case 'gemini':
        return t('ai.ownGemini')
      case 'cerebras':
        return t('ai.ownCerebras')
      case 'hosted':
      default:
        return t('ai.hosted')
    }
  }
  const providerPathProgressLabel = (
    provider: QuickCreateAiProvider,
  ): string =>
    provider === 'local'
      ? t('studyGuides.generatingWithLocalAi')
      : isStrongAiProvider(provider)
        ? `${t('studyGuides.generatingWithProvider')} ${providerLabel(
            provider,
          )}...`
        : t('studyGuides.generatingWithHosted')
  const providerPathDescription = (provider: QuickCreateAiProvider): string =>
    provider === 'local'
      ? t('studyGuides.localProviderDescription')
      : isStrongAiProvider(provider)
        ? `${t('studyGuides.strongProviderDescriptionPrefix')} ${providerLabel(
            provider,
          )} ${t('studyGuides.strongProviderDescriptionSuffix')}`
        : t('studyGuides.hostedProviderDescription')
  const [step, setStep] = useState<'prompt' | 'review'>('prompt')
  const [prompt, setPrompt] = useState(initialPrompt || defaultStudyPathPrompt)
  const [aiProvider, setAiProvider] = useState<QuickCreateAiProvider>('hosted')
  const [draft, setDraft] = useState<AiStudyPathDraft | null>(null)
  const [reviewFolderName, setReviewFolderName] = useState('')
  const [resolvedContentLanguage, setResolvedContentLanguage] =
    useState<ReturnType<typeof resolveContentLanguage> | null>(null)
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
      title: prompt.trim() || t('workspace.studyGuide'),
      inputSummary: prompt.trim() || t('studyGuides.promptField'),
    })
  }, [onDraftMetaChange, prompt, t])

  React.useEffect(() => {
    if (isGenerating) {
      onStatusChange?.('running', t('studyGuides.createWorking'))
      return
    }

    if (step === 'review' && draft) {
      onStatusChange?.('complete', t('studyGuides.createReady'))
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
    t,
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
      const provider = readQuickCreateAiSettings().provider || 'hosted'
      setAiProvider(provider)
    }

    if (open) {
      refreshAiProvider()
      if (!initializedProviderRef.current) {
        initializedProviderRef.current = true
      }
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
  }, [isGenerating, open])

  const reset = () => {
    setStep('prompt')
    setPrompt(initialPrompt || defaultStudyPathPrompt)
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
    const message = `${providerLabel(missingKeyProvider)} ${t(
      'studyGuides.needsApiKey',
    )}`
    setSessionKeyRequest(null)
    setError(message)
    if (autoCreateOnGenerate) {
      onStatusChange?.('error', message)
    }
  }

  const generatePath = async (promptOverride?: string) => {
    const settingsProvider = readQuickCreateAiSettings().provider || 'hosted'
    const effectiveAiProvider = settingsProvider
    setAiProvider(effectiveAiProvider)
    const basePrompt =
      typeof promptOverride === 'string' ? promptOverride.trim() : prompt.trim()
    const effectivePrompt = basePrompt

    if (!basePrompt) {
      setError(t('studyGuides.promptPlaceholder'))
      return
    }

    const credentials = isStrongAiProvider(effectiveAiProvider)
      ? resolveQuickCreateAiCredentials(effectiveAiProvider)
      : resolveQuickCreateAiCredentials()
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
    const resolvedLanguage = resolveContentLanguage({ text: effectivePrompt })
    const knownTopics = getAllUserKnownTopics()
    setResolvedContentLanguage(resolvedLanguage)
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
        outputLanguage: resolvedLanguage.language,
        signal: generationController.signal,
        userKnownTopics: knownTopics,
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
          dashboard.title || t('studyGuides.dashboardFallbackTitle'),
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
        err instanceof Error ? err.message : t('studyGuides.generateFailed'),
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
  ): Parameters<CreateStudyGuideModalProps['onCreatePath']>[0] => {
    const effectiveFolder =
      reviewFolderName.trim() ||
      pathDraft.folderName ||
      pathDraft.title ||
      'Study Guide'
    const studyPathId = makeStudyPathId(pathDraft.title || effectiveFolder)
    const dashboardCount = pathDraft.dashboards.length
    const fallbackLanguage = resolveContentLanguage({ text: prompt })
    const pathLanguage =
      pathDraft.contentLanguage ||
      resolvedContentLanguage?.language ||
      fallbackLanguage.language
    const pathLanguageSource =
      resolvedContentLanguage?.source || fallbackLanguage.source
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
      quickStart: pathDraft.quickStart,
      openInWorkspace: openGeneratedInWorkspace ?? openInWorkspace,
      dashboards: pathDraft.dashboards.map((dashboard, index) => {
        const widgets = createQuickCreateOrchestratorWidgets(
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
              contentLanguage: pathLanguage,
              contentLanguageSource: pathLanguageSource,
            },
          },
        )

        return {
          name: dashboard.title || `${pathDraft.title} ${index + 1}`,
          folderName: effectiveFolder,
          layoutMode: 'smart',
          widgets,
        }
      }),
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
                {t('studyGuides.create')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('studyGuides.createSubtitle')}
              </Typography>
            </Box>
          </Stack>
          {onCollapse && (
            <Tooltip title={t('studyGuides.collapsePanel')}>
              <IconButton
                aria-label={t('studyGuides.collapseCreatePanel')}
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
                    label={t('studyGuides.promptField')}
                    inputProps={{
                      'aria-label': t('studyGuides.promptPlaceholder'),
                    }}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder={t('studyGuides.promptExample')}
                    multiline
                    minRows={presentation === 'embedded' ? 5 : 6}
                    required
                    fullWidth
                  />
                </Stack>
              </Paper>
              {aiProvider === 'local' && (
                <Alert severity="info">
                  {t('studyGuides.localAiEstimate')}
                </Alert>
              )}
              {aiProvider === 'hosted' && (
                <Alert severity="info">
                  {t('studyGuides.hostedCreditsNotice')}
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
                          providerPathProgressLabel(aiProvider)}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {providerLabel(aiProvider)}:{' '}
                      {providerPathDescription(aiProvider)}
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
                                          {t('studyGuides.thread')}{' '}
                                          {lane.threadId}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          {lane.completedCount}{' '}
                                          {t('studyGuides.doneLower')}
                                          {lane.failedCount > 0
                                            ? `, ${lane.failedCount} ${t(
                                                'studyGuides.failedLower',
                                              )}`
                                            : ''}
                                        </Typography>
                                      </Stack>
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        {lane.active?.label ||
                                          t('studyGuides.waiting')}
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
                            {t('studyGuides.elapsed')}{' '}
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
                            {t('studyGuides.estimatedTotal')}{' '}
                            {formatGeminiDuration(
                              geminiProgress.estimatedTotalMs,
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('studyGuides.remaining')}{' '}
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
                      {t('studyGuides.generationRunning')}
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                      <Button onClick={cancelGeneration}>
                        {t('studyGuides.cancel')}
                      </Button>
                      <Button onClick={onContinueCreating}>
                        {t('studyGuides.continueCreating')}
                      </Button>
                      <Button
                        variant="contained"
                        onClick={onContinueInBackground}
                      >
                        {t('studyGuides.continueInBackground')}
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
                    {t('studyGuides.localAiFailureDebug')}
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
                label={t('studyGuides.folderName')}
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
                label={t('studyGuides.openAsTutorial')}
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
                          label={`${t('studyGuides.dashboard')} ${index + 1}`}
                          color="primary"
                          size="small"
                        />
                        <Chip
                          label={`${dashboard.objects.length} ${t(
                            'studyGuides.studyItems',
                          )}`}
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
                    {t('studyGuides.aiGenerationDebug')}
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
        <Button onClick={handleClose}>{t('studyGuides.cancel')}</Button>
        {step === 'review' && (
          <Button onClick={() => setStep('prompt')}>
            {t('studyGuides.back')}
          </Button>
        )}
        {step === 'prompt' ? (
          <Button
            variant="contained"
            onClick={() => void generatePath()}
            disabled={isGenerating || !prompt.trim()}
          >
            <Stack
              component="span"
              direction="row"
              spacing={1}
              alignItems="center"
            >
              <span>
                {isGenerating
                  ? t('studyGuides.generating')
                  : t('studyGuides.generateStudyGuide')}
              </span>
              {!isGenerating && aiProvider === 'hosted' ? (
                <StudyCreditCostLabel
                  amount={studyGuideCreditCost}
                  variant="contained"
                />
              ) : null}
            </Stack>
          </Button>
        ) : (
          <Button variant="contained" onClick={createPath}>
            {t('studyGuides.createDashboards')} {draft?.dashboards.length || 0}
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

export default CreateStudyGuideModal
