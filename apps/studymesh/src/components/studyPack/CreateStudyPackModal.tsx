import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentPasteIcon from '@mui/icons-material/ContentPaste'
import DescriptionIcon from '@mui/icons-material/Description'
import {
  createStudyPackOrchestratorWidgets,
  createStudyPackWidgets,
  augmentStudyPackPracticeObjects,
  createStudyPackPracticeProfile,
  isReviewableStudyObject,
  StudyObject,
  StudyPackSourceFormat,
  StudyPackDashboardLayoutMode,
} from '../../studyPack'
import { extractRawNotesFromImage } from '../../studyPack/imageOcr'
import {
  AiSourceSummary,
  extractNotesFromImageWithLocalLanguageModel,
  extractRawNotesWithAi,
  generateStudyPackWithAi,
  isStrongAiProvider,
  LocalAiProgressEvent,
  readStudyPackAiSettings,
  resolveStudyPackAiCredentials,
  StrongAiProviderId,
  STUDY_PACK_AI_SETTINGS_CHANGED_EVENT,
  QuizQuestionStyle,
  StudyMaterialDetailLevel,
  StudyMaterialResourceType,
  StudyPackAiProvider,
} from '../../studyPack/ai'
import {
  extractTextFromPdf,
  extractTextFromPptx,
} from '../../studyPack/documentExtraction'
import { WorkspaceCreationTaskState } from '../../workspaceCreationStatus'
import { quickCreateFolders } from '../workspace/workspaceStudioModel'
import StrongAiSessionKeyDialog from './StrongAiSessionKeyDialog'

type ReviewType =
  | 'flashcard'
  | 'quiz'
  | 'term'
  | 'code'
  | 'comparison'
  | 'list'
  | 'table'
  | 'reviewPrompt'
  | 'note'
  | 'reveal'
  | 'sequence'
  | 'markdown'
  | 'ignore'
type SourceInputType = 'text' | 'image' | 'pdf' | 'powerpoint'
type GenerationAmount = 'few' | 'medium' | 'many'
type DocumentSourceType = 'pdf' | 'powerpoint'
type SessionKeyContinuation =
  | { action: 'generate'; rawSource: string }
  | { action: 'extractImage' }

interface DocumentSource {
  file: File
  type: DocumentSourceType
}

interface GeminiTimedProgress {
  startedAt: number
  elapsedMs: number
  estimatedTotalMs: number
  estimatedRemainingMs: number
  percent: number
}

interface ReviewItem {
  object: StudyObject
  title: string
  type: ReviewType
}

interface PreviewWidgetGroup {
  id: string
  name: string
  objectIds: string[]
}

interface CreateStudyPackModalProps {
  open: boolean
  onClose: () => void
  onCreatePack: (payload: {
    name: string
    widgets: ReturnType<typeof createStudyPackWidgets>
    layoutMode?: StudyPackDashboardLayoutMode
    folderName?: string
  }) => void
  presentation?: 'dialog' | 'embedded'
  onCollapse?: () => void
  onStatusChange?: (state: WorkspaceCreationTaskState, message?: string) => void
  onDraftMetaChange?: (metadata: {
    title: string
    inputSummary: string
    resourceType?: StudyMaterialResourceType | null
    detailLevel: StudyMaterialDetailLevel
  }) => void
  initialResourceType?: StudyMaterialResourceType | null
  initialSourceText?: string
  initialTitle?: string
  currentDashboardContext?: string
  currentDashboardTitle?: string
  hasCurrentDashboardContext?: boolean
}

const supportedImageExtensions = [
  'bmp',
  'jpg',
  'jpeg',
  'png',
  'pbm',
  'webp',
  'gif',
]
const supportedImageMimeTypes = [
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/x-ms-bmp',
  'image/x-portable-bitmap',
]
const imageAcceptValue = [
  '.bmp',
  '.gif',
  '.jpg',
  '.jpeg',
  '.pbm',
  '.png',
  '.webp',
  ...supportedImageMimeTypes,
].join(',')

const GEMINI_STUDY_PACK_ESTIMATES_MS: Record<GenerationAmount, number> = {
  few: 30 * 1000,
  medium: 60 * 1000,
  many: 90 * 1000,
}
const CEREBRAS_STUDY_PACK_ESTIMATE_MS = 10 * 1000

const resourceTypeOptions: Array<{
  value: StudyMaterialResourceType
  label: string
  description: string
}> = [
  {
    value: 'improvedNotes',
    label: 'Expand on this',
    description: '',
  },
  {
    value: 'flashcards',
    label: 'Flashcards',
    description: '',
  },
  {
    value: 'quiz',
    label: 'Quiz',
    description: '',
  },
]

const detailLevelOptions: Array<{
  value: StudyMaterialDetailLevel
  label: string
}> = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
]

const quizQuestionStyleOptions: Array<{
  value: QuizQuestionStyle
  label: string
}> = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'conceptual', label: 'Conceptual' },
  { value: 'examLike', label: 'Exam-like' },
]

const resourceTypeTargets: Record<StudyMaterialResourceType, string[]> = {
  improvedNotes: ['summaries', 'definitions', 'lists'],
  flashcards: ['flashcards'],
  quiz: ['quizzes'],
}

const detailLevelToGenerationAmount: Record<
  StudyMaterialDetailLevel,
  GenerationAmount
> = {
  short: 'few',
  medium: 'medium',
  long: 'many',
}

const resourceTypeLabels: Record<StudyMaterialResourceType, string> = {
  improvedNotes: 'Expand on this',
  flashcards: 'Flashcards',
  quiz: 'Quiz',
}

const detailLevelCountLimits: Record<
  StudyMaterialResourceType,
  Record<StudyMaterialDetailLevel, { min: number; max: number }>
> = {
  improvedNotes: {
    short: { min: 400, max: 700 },
    medium: { min: 900, max: 1400 },
    long: { min: 1800, max: 2600 },
  },
  flashcards: {
    short: { min: 20, max: 30 },
    medium: { min: 40, max: 50 },
    long: { min: 50, max: 65 },
  },
  quiz: {
    short: { min: 20, max: 30 },
    medium: { min: 40, max: 50 },
    long: { min: 50, max: 65 },
  },
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

const getObjectTitle = (object: StudyObject) => {
  if (object.title) {
    return object.title
  }

  switch (object.kind) {
    case 'markdown':
      return object.title || 'Expand on this'
    case 'term':
      return object.term
    case 'qa':
      return object.question
    case 'quiz':
      return object.question
    case 'reveal':
      return object.prompt
    case 'comparison':
      return object.title || 'Comparison'
    case 'sequence':
      return object.title || 'Sequence'
    case 'reviewPrompt':
      return object.title || 'Review later'
    case 'code':
      return object.title || 'Code note'
    case 'list':
      return object.checklist ? 'Checklist' : 'Study list'
    case 'table':
      return object.title || 'Study table'
    case 'resource':
      return object.label
    case 'note':
    default:
      return 'Study note'
  }
}

const getObjectPreview = (object: StudyObject) => {
  switch (object.kind) {
    case 'markdown':
      return object.markdown
    case 'term':
      return object.definition
    case 'qa':
      return object.answer
    case 'quiz':
      return object.explanation || object.answer || object.options.join(' / ')
    case 'reveal':
      return object.hiddenText
    case 'comparison':
      return `${object.columns.length} columns, ${object.rows.length} rows`
    case 'sequence':
      return object.steps.slice(0, 3).join(' / ')
    case 'reviewPrompt':
      return object.reason || object.prompt
    case 'code':
      return object.code
    case 'list':
      return object.items.slice(0, 3).join(' / ')
    case 'table':
      return `${object.headers.length} columns, ${object.rows.length} rows`
    case 'resource':
      return object.url
    case 'note':
    default:
      return object.body
  }
}

const getReviewType = (object: StudyObject): ReviewType => {
  if (object.kind === 'markdown') {
    return 'markdown'
  }

  if (object.kind === 'qa' || object.kind === 'reveal') {
    return 'flashcard'
  }

  if (object.kind === 'sequence') {
    return 'list'
  }

  if (
    object.kind === 'quiz' ||
    object.kind === 'term' ||
    object.kind === 'code' ||
    object.kind === 'comparison' ||
    object.kind === 'list' ||
    object.kind === 'table' ||
    object.kind === 'reviewPrompt'
  ) {
    return object.kind
  }

  return 'ignore'
}

const getFileTitle = (file: File) =>
  file.name.replace(/\.[^.]+$/, '') || 'Notes Dashboard'

const getPackId = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'study-pack'

const isSupportedImageFile = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase()

  return (
    supportedImageExtensions.includes(extension || '') ||
    supportedImageMimeTypes.includes(file.type)
  )
}

const appendSourceText = (current: string, next: string) =>
  [current.trim(), next.trim()].filter(Boolean).join('\n\n---\n\n')

const formatSourceAttachmentText = (title: string, text: string) =>
  `# ${title}\n\n${text.trim()}`

const toReviewItems = (
  objects: StudyObject[],
  resourceType: StudyMaterialResourceType,
): ReviewItem[] =>
  objects
    .filter((object) =>
      resourceType === 'improvedNotes'
        ? object.kind === 'markdown'
        : isReviewableStudyObject(object),
    )
    .map((object) => ({
      object,
      title: getObjectTitle(object),
      type: getReviewType(object),
    }))
    .filter((item) => item.type !== 'ignore')

const limitReviewItemsForDetailLevel = (
  items: ReviewItem[],
  resourceType: StudyMaterialResourceType,
  detailLevel: StudyMaterialDetailLevel,
): ReviewItem[] => {
  if (resourceType !== 'flashcards' && resourceType !== 'quiz') {
    return items
  }

  const quizFiltered =
    resourceType === 'quiz'
      ? items.map((item) =>
          item.object.kind === 'quiz' && item.object.quizMode === 'shortAnswer'
            ? {
                ...item,
                object: {
                  ...item.object,
                  quizMode: 'multipleChoice' as const,
                  options: [
                    item.object.answer,
                    'Not supported by the source notes',
                    'The opposite of the source explanation',
                  ].filter(Boolean),
                  correctIndex: 0,
                },
              }
            : item,
        )
      : items

  return quizFiltered.slice(
    0,
    detailLevelCountLimits[resourceType][detailLevel].max,
  )
}

const createPreviewWidgetGroups = (
  objects: StudyObject[],
  title: string,
  resourceType: StudyMaterialResourceType,
): PreviewWidgetGroup[] =>
  objects.length === 0
    ? []
    : [
        {
          id: 'preview-widget-1',
          name: `${title} ${resourceTypeLabels[resourceType]}`,
          objectIds: objects.map((object) => object.id),
        },
      ]

const applyReviewItem = (item: ReviewItem): StudyObject | null => {
  if (item.type === 'ignore') {
    return null
  }

  if (item.type === 'markdown' && item.object.kind === 'markdown') {
    return { ...item.object, title: item.title }
  }

  if (item.type === 'flashcard' && item.object.kind === 'qa') {
    return { ...item.object, title: item.title }
  }

  if (item.type === 'list' && item.object.kind === 'sequence') {
    return {
      ...item.object,
      kind: 'list',
      title: item.title,
      items: item.object.steps,
      ordered: item.object.ordered,
      checklist: item.object.interactiveChecklist,
    }
  }

  if (item.type === item.object.kind) {
    return { ...item.object, title: item.title }
  }

  const preview = getObjectPreview(item.object)
  const base = {
    ...item.object,
    kind: item.type,
    title: item.title,
  }

  if (item.type === 'note') {
    return {
      ...base,
      kind: 'note',
      body: preview,
    }
  }

  if (item.type === 'flashcard') {
    return {
      ...base,
      kind: 'qa',
      question: item.title,
      answer: preview,
    }
  }

  if (item.type === 'list') {
    return {
      ...base,
      kind: 'list',
      items: preview
        .split(/\n|\/|,/)
        .map((value) => value.trim())
        .filter(Boolean),
      ordered: false,
      checklist: false,
    }
  }

  if (item.type === 'term') {
    return {
      ...base,
      kind: 'term',
      term: item.title,
      definition: preview,
    }
  }

  if (item.type === 'quiz') {
    if (
      item.object.kind === 'quiz' &&
      item.object.quizMode === 'multipleChoice'
    ) {
      return { ...item.object, question: item.title }
    }

    return {
      ...base,
      kind: 'quiz',
      quizMode: 'multipleChoice',
      question: item.title,
      options: [preview, 'Review the source notes', 'Not enough information'],
      correctIndex: 0,
      answer: preview,
      explanation: '',
    }
  }

  if (item.type === 'reveal') {
    return {
      ...base,
      kind: 'reveal',
      prompt: item.title,
      hiddenText: preview,
    }
  }

  if (item.type === 'sequence') {
    return {
      ...base,
      kind: 'sequence',
      steps: preview
        .split(/\n|\/|,/)
        .map((value) => value.trim())
        .filter(Boolean),
      ordered: true,
      interactiveChecklist: false,
    }
  }

  if (item.type === 'reviewPrompt') {
    return {
      ...base,
      kind: 'reviewPrompt',
      prompt: item.title,
      reason: preview,
      status: 'needsReview',
    }
  }

  if (item.type === 'code') {
    return {
      ...base,
      kind: 'code',
      code: preview,
      language: 'text',
      caption: item.title,
    }
  }

  if (item.type === 'comparison') {
    return {
      ...base,
      kind: 'comparison',
      columns: ['Item A', 'Item B'],
      rows: preview
        .split('\n')
        .map((value) => value.split('|').map((cell) => cell.trim()))
        .filter((row) => row.some(Boolean)),
    }
  }

  return { ...item.object, title: item.title }
}

const CreateStudyPackModal: React.FC<CreateStudyPackModalProps> = ({
  open,
  onClose,
  onCreatePack,
  presentation = 'dialog',
  onCollapse,
  onStatusChange,
  onDraftMetaChange,
  initialResourceType,
  initialSourceText,
  initialTitle,
  currentDashboardContext = '',
  currentDashboardTitle = 'Current dashboard',
  hasCurrentDashboardContext = false,
}) => {
  const [step, setStep] = useState<'source' | 'review'>('source')
  const [aiProvider, setAiProvider] = useState<StudyPackAiProvider>('hosted')
  const [sourceMode, setSourceMode] = useState<'sources' | 'dashboard'>(
    'sources',
  )
  const [sourceInputType, setSourceInputType] =
    useState<SourceInputType>('text')
  const [sourceText, setSourceText] = useState('')
  const [copiedTextDraft, setCopiedTextDraft] = useState('')
  const [showCopiedTextBox, setShowCopiedTextBox] = useState(false)
  const [copiedTextSourceCount, setCopiedTextSourceCount] = useState(0)
  const [textSourceNames, setTextSourceNames] = useState<string[]>([])
  const [sourceFormat, setSourceFormat] =
    useState<StudyPackSourceFormat>('text')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<
    Array<{ name: string; url: string }>
  >([])
  const [extractedImageCount, setExtractedImageCount] = useState(0)
  const [imageTextExtracted, setImageTextExtracted] = useState(false)
  const [documentSources, setDocumentSources] = useState<DocumentSource[]>([])
  const [extractedDocumentCount, setExtractedDocumentCount] = useState(0)
  const [isExtractingImage, setIsExtractingImage] = useState(false)
  const [isExtractingDocument, setIsExtractingDocument] = useState(false)
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)
  const [aiProgressLabel, setAiProgressLabel] = useState('')
  const [aiGenerationProgress, setAiGenerationProgress] = useState(0)
  const [aiGenerationProgressPhase, setAiGenerationProgressPhase] = useState<
    LocalAiProgressEvent['phase'] | ''
  >('')
  const [geminiProgress, setGeminiProgress] =
    useState<GeminiTimedProgress | null>(null)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrStatus, setOcrStatus] = useState('')
  const [packTitle, setPackTitle] = useState('Notes Dashboard')
  const [resourceType, setResourceType] =
    useState<StudyMaterialResourceType | null>(null)
  const [detailLevel, setDetailLevel] =
    useState<StudyMaterialDetailLevel>('medium')
  const [quizQuestionStyle, setQuizQuestionStyle] =
    useState<QuizQuestionStyle>('mixed')
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [widgetGroups, setWidgetGroups] = useState<PreviewWidgetGroup[]>([])
  const [aiSourceSummary, setAiSourceSummary] =
    useState<AiSourceSummary | null>(null)
  const [layoutMode, setLayoutMode] =
    useState<StudyPackDashboardLayoutMode>('orchestrator')
  const [error, setError] = useState('')
  const [sessionKeyRequest, setSessionKeyRequest] = useState<{
    provider: StrongAiProviderId
    model: string
    continuation: SessionKeyContinuation
  } | null>(null)
  const activeOperationRef = useRef<AbortController | null>(null)
  const appliedInitialSourceRef = useRef(false)

  useEffect(() => {
    if (appliedInitialSourceRef.current) {
      return
    }

    appliedInitialSourceRef.current = true

    if (initialResourceType) {
      setResourceType(initialResourceType)
    }

    if (initialSourceText?.trim()) {
      setSourceText(initialSourceText.trim())
      setSourceFormat('text')
      setSourceInputType('text')
      setPackTitle(initialTitle?.trim() || 'Current Dashboard')
      setTextSourceNames(['Current dashboard'])
    } else if (initialTitle?.trim()) {
      setPackTitle(initialTitle.trim())
    }
  }, [initialResourceType, initialSourceText, initialTitle])

  useEffect(() => {
    const sourceCount =
      copiedTextSourceCount +
      textSourceNames.length +
      documentSources.length +
      imageFiles.length
    const sourceKind =
      documentSources.length > 0
        ? documentSources[0].type === 'pdf'
          ? 'PDF'
          : 'slides'
        : imageFiles.length > 0
          ? 'image notes'
          : sourceText.trim() || copiedTextDraft.trim()
            ? 'notes'
            : 'sources'

    onDraftMetaChange?.({
      title: packTitle,
      inputSummary:
        sourceMode === 'dashboard'
          ? `Current dashboard: ${currentDashboardTitle}`
          : sourceCount > 1
            ? `${sourceCount} source files`
            : sourceKind,
      resourceType,
      detailLevel,
    })
  }, [
    copiedTextDraft,
    copiedTextSourceCount,
    detailLevel,
    documentSources,
    imageFiles,
    onDraftMetaChange,
    packTitle,
    resourceType,
    sourceText,
    sourceMode,
    textSourceNames,
    currentDashboardTitle,
  ])

  const cancelActiveOperation = () => {
    activeOperationRef.current?.abort()
    activeOperationRef.current = null
  }

  useEffect(
    () => () => {
      cancelActiveOperation()
    },
    [],
  )

  const generationTargets = resourceType
    ? resourceTypeTargets[resourceType]
    : []
  const generationAmount = detailLevelToGenerationAmount[detailLevel]
  const practiceProfile = useMemo(
    () => createStudyPackPracticeProfile(generationAmount, generationTargets),
    [generationAmount, generationTargets],
  )
  const reviewableCount = useMemo(
    () => reviewItems.filter((item) => item.type !== 'ignore').length,
    [reviewItems],
  )

  useEffect(() => {
    if (isExtractingImage || isExtractingDocument || isGeneratingAi) {
      onStatusChange?.('running', 'Create From Notes is working')
      return
    }

    if (step === 'review' && reviewableCount > 0) {
      onStatusChange?.('complete', 'Create From Notes is ready to review')
      return
    }

    if (error && step !== 'review') {
      onStatusChange?.('error', error)
      return
    }

    onStatusChange?.('idle')
  }, [
    error,
    isExtractingDocument,
    isExtractingImage,
    isGeneratingAi,
    onStatusChange,
    reviewableCount,
    step,
  ])

  useEffect(() => {
    const refreshAiProvider = () => {
      setAiProvider(readStudyPackAiSettings().provider || 'hosted')
    }

    if (open && !isGeneratingAi && !isExtractingImage) {
      refreshAiProvider()
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
  }, [isExtractingImage, isGeneratingAi, open])

  useEffect(() => {
    if (!isGeneratingAi || !isStrongAiProvider(aiProvider) || !geminiProgress) {
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
  }, [aiProvider, geminiProgress, isGeneratingAi])

  useEffect(() => {
    if (imageFiles.length === 0) {
      setImagePreviewUrls([])
      return undefined
    }

    const previewUrls = imageFiles.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }))
    setImagePreviewUrls(previewUrls)

    return () => {
      previewUrls.forEach(({ url }) => URL.revokeObjectURL(url))
    }
  }, [imageFiles])

  const reset = () => {
    appliedInitialSourceRef.current = false
    setStep('source')
    setSourceMode('sources')
    setSourceInputType('text')
    setSourceText('')
    setCopiedTextDraft('')
    setShowCopiedTextBox(false)
    setCopiedTextSourceCount(0)
    setTextSourceNames([])
    setSourceFormat('text')
    setImageFiles([])
    setImagePreviewUrls([])
    setExtractedImageCount(0)
    setImageTextExtracted(false)
    setDocumentSources([])
    setExtractedDocumentCount(0)
    setIsExtractingImage(false)
    setIsExtractingDocument(false)
    setIsGeneratingAi(false)
    setAiProgressLabel('')
    setAiGenerationProgress(0)
    setAiGenerationProgressPhase('')
    setGeminiProgress(null)
    setOcrProgress(0)
    setOcrStatus('')
    setPackTitle('Notes Dashboard')
    setResourceType(null)
    setDetailLevel('medium')
    setQuizQuestionStyle('mixed')
    setReviewItems([])
    setWidgetGroups([])
    setAiSourceSummary(null)
    setLayoutMode('orchestrator')
    setError('')
  }

  const handleClose = () => {
    cancelActiveOperation()
    reset()
    onStatusChange?.('idle')
    onClose()
  }

  const selectImageFiles = (files: File[]) => {
    const unsupportedFile = files.find((file) => !isSupportedImageFile(file))
    if (unsupportedFile) {
      setError('Use a PNG, JPG, WebP, GIF, BMP, or PBM image.')
      setImageTextExtracted(false)
      return
    }

    setImageFiles((current) => [...current, ...files])
    setPackTitle((currentTitle) =>
      currentTitle === 'Notes Dashboard' && files.length > 0
        ? files.length === 1
          ? getFileTitle(files[0])
          : `${getFileTitle(files[0])} Dashboard`
        : currentTitle,
    )
    setImageTextExtracted(false)
    setOcrProgress(0)
    setOcrStatus('')
    setError('')
  }

  const appendCopiedTextDraft = () => {
    const text = copiedTextDraft.trim()
    if (!text) {
      setError('Paste copied text before adding it as a source.')
      return false
    }

    const nextIndex = copiedTextSourceCount + 1
    setSourceText((current) => appendSourceText(current, text))
    setCopiedTextSourceCount(nextIndex)
    setCopiedTextDraft('')
    setShowCopiedTextBox(false)
    setSourceFormat('text')
    setSourceInputType('text')
    setError('')
    return true
  }

  const appendTextFiles = async (files: File[]) => {
    const fileTexts = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        text: await file.text(),
      })),
    )
    const text = fileTexts
      .map(({ name, text }) =>
        formatSourceAttachmentText(getFileTitle({ name } as File), text),
      )
      .join('\n\n---\n\n')

    setSourceText((current) => appendSourceText(current, text))
    setPackTitle((currentTitle) =>
      currentTitle === 'Notes Dashboard'
        ? files.length === 1
          ? getFileTitle(files[0])
          : `${getFileTitle(files[0])} Dashboard`
        : currentTitle,
    )
    setSourceFormat('text')
    setSourceInputType('text')
    setTextSourceNames((current) => [
      ...current,
      ...files.map((file) => file.name),
    ])
  }

  const appendDocumentFiles = (sources: DocumentSource[]) => {
    setDocumentSources((current) => [...current, ...sources])
    setPackTitle((currentTitle) =>
      currentTitle === 'Notes Dashboard' && sources.length > 0
        ? sources.length === 1
          ? getFileTitle(sources[0].file)
          : `${getFileTitle(sources[0].file)} Dashboard`
        : currentTitle,
    )
    setError('')
  }

  const extractPendingDocuments = async (currentSourceText: string) => {
    const pendingSources = documentSources.slice(extractedDocumentCount)
    if (pendingSources.length === 0) {
      return currentSourceText
    }

    setIsExtractingDocument(true)
    setOcrStatus('Reading attached documents')

    try {
      const extracted = await Promise.all(
        pendingSources.map(async (source) => {
          const result =
            source.type === 'pdf'
              ? await extractTextFromPdf(source.file)
              : await extractTextFromPptx(source.file)

          return {
            ...result,
            title: getFileTitle(source.file),
            type: source.type,
          }
        }),
      )
      const text = extracted
        .map((item) =>
          item.text.trim()
            ? formatSourceAttachmentText(item.title, item.text)
            : '',
        )
        .filter(Boolean)
        .join('\n\n---\n\n')
      const warnings = extracted.flatMap((item) => item.warnings)

      if (!text.trim()) {
        setError(
          'No selectable document text was found. Scanned PDFs need OCR in a later iteration.',
        )
        return null
      }

      const nextSourceText = appendSourceText(currentSourceText, text)
      setSourceText(nextSourceText)
      setExtractedDocumentCount(documentSources.length)
      setSourceFormat('text')
      setSourceInputType('text')
      setError(warnings[0] || '')
      return nextSourceText
    } catch {
      setError('Could not read text from one of these attached documents.')
      return null
    } finally {
      setIsExtractingDocument(false)
      setOcrStatus('')
    }
  }

  const addSourceFiles = async (files: File[]) => {
    if (files.length === 0) {
      return
    }

    const textFiles: File[] = []
    const pdfFiles: File[] = []
    const powerPointFiles: File[] = []
    const imageSourceFiles: File[] = []
    const unsupportedFiles: File[] = []

    files.forEach((file) => {
      const lowerName = file.name.toLowerCase()
      const extension = lowerName.split('.').pop() || ''

      if (['md', 'txt', 'csv'].includes(extension)) {
        textFiles.push(file)
      } else if (extension === 'pdf') {
        pdfFiles.push(file)
      } else if (extension === 'pptx') {
        powerPointFiles.push(file)
      } else if (extension === 'ppt') {
        unsupportedFiles.push(file)
      } else if (isSupportedImageFile(file)) {
        imageSourceFiles.push(file)
      } else {
        unsupportedFiles.push(file)
      }
    })

    if (unsupportedFiles.length > 0) {
      setError(
        unsupportedFiles.some((file) =>
          file.name.toLowerCase().endsWith('.ppt'),
        )
          ? 'Legacy .ppt files are not supported. Export to .pptx or PDF.'
          : 'Use text, image, PDF, or .pptx source files.',
      )
      return
    }

    setError('')

    if (textFiles.length > 0) {
      await appendTextFiles(textFiles)
    }

    if (pdfFiles.length > 0) {
      appendDocumentFiles(
        pdfFiles.map((file) => ({
          file,
          type: 'pdf',
        })),
      )
    }

    if (powerPointFiles.length > 0) {
      appendDocumentFiles(
        powerPointFiles.map((file) => ({
          file,
          type: 'powerpoint',
        })),
      )
    }

    if (imageSourceFiles.length > 0) {
      setSourceInputType('image')
      selectImageFiles(imageSourceFiles)
    }
  }

  const requestSessionKey = (
    provider: StrongAiProviderId,
    model: string,
    continuation: SessionKeyContinuation,
  ) => {
    setSessionKeyRequest({ provider, model, continuation })
    setError('')
  }

  const parseSourceWithAi = async (rawSource = sourceText) => {
    if (!resourceType) {
      setError('Choose a resource type before continuing.')
      return
    }

    const credentials = isStrongAiProvider(aiProvider)
      ? resolveStudyPackAiCredentials(aiProvider)
      : resolveStudyPackAiCredentials()
    if (isStrongAiProvider(aiProvider) && !credentials.apiToken) {
      requestSessionKey(aiProvider, credentials.model, {
        action: 'generate',
        rawSource,
      })
      return
    }

    cancelActiveOperation()
    const generationController = new AbortController()
    activeOperationRef.current = generationController
    setIsGeneratingAi(true)
    setOcrStatus('Generating study materials')
    setAiGenerationProgress(0)
    setAiGenerationProgressPhase('')
    setGeminiProgress(
      isStrongAiProvider(aiProvider)
        ? makeGeminiTimedProgress(
            Date.now(),
            aiProvider === 'cerebras'
              ? CEREBRAS_STUDY_PACK_ESTIMATE_MS
              : GEMINI_STUDY_PACK_ESTIMATES_MS[generationAmount],
          )
        : null,
    )
    setAiProgressLabel(
      aiProvider === 'local'
        ? 'Starting Google Local AI'
        : isStrongAiProvider(aiProvider)
          ? `Connecting to ${aiProvider === 'cerebras' ? 'Cerebras' : 'Gemini'}`
          : 'Preparing generation',
    )
    setError('')

    try {
      window.setTimeout(() => {
        setAiProgressLabel((current) =>
          current
            ? aiProvider === 'local'
              ? 'Asking Chrome Local AI for a compact outline'
              : isStrongAiProvider(aiProvider)
                ? 'Reading notes and planning study sections'
                : 'Parsing notes locally'
            : current,
        )
      }, 700)
      window.setTimeout(() => {
        setAiProgressLabel((current) =>
          current
            ? aiProvider === 'local'
              ? 'Creating compact local study objects'
              : isStrongAiProvider(aiProvider)
                ? `Creating ${resourceTypeLabels[resourceType]} with ${
                    aiProvider === 'cerebras' ? 'Cerebras' : 'Gemini'
                  }`
                : `Creating ${resourceTypeLabels[resourceType]}`
            : current,
        )
      }, 1800)
      const draft = await generateStudyPackWithAi({
        provider: aiProvider,
        apiToken: credentials.apiToken,
        model: credentials.model,
        title: packTitle.trim() || 'Notes Dashboard',
        rawNotes: rawSource,
        packId: getPackId(packTitle),
        generationTargets,
        generationAmount,
        resourceType,
        detailLevel,
        quizQuestionStyle,
        promptMode: false,
        studyPathMode: false,
        signal: generationController.signal,
        onProgress: (event) => {
          if (generationController.signal.aborted) {
            return
          }

          setAiGenerationProgress(event.percent)
          setAiGenerationProgressPhase(event.phase)
          setAiProgressLabel(
            event.phase === 'download'
              ? `${event.label} ${event.percent}%`
              : event.label,
          )
        },
      })
      if (generationController.signal.aborted) {
        return
      }

      const nextTitle = draft.title || packTitle
      setAiProgressLabel('Preparing review screen')
      const augmented = augmentStudyPackPracticeObjects(draft.objects, {
        packId: getPackId(nextTitle),
        title: nextTitle,
        rawNotes: rawSource,
        generationTargets,
        generationAmount,
        visiblePracticeTarget: Math.max(0, practiceProfile.targetTotal - 2),
      })
      const reviewableItems = limitReviewItemsForDetailLevel(
        toReviewItems(augmented.objects, resourceType),
        resourceType,
        detailLevel,
      )
      setPackTitle(nextTitle)
      setSourceFormat(draft.sourceFormat || 'text')
      setReviewItems(reviewableItems)
      setAiSourceSummary(draft.sourceSummary || null)
      setWidgetGroups(
        createPreviewWidgetGroups(
          reviewableItems.map((item) => item.object),
          nextTitle,
          resourceType,
        ),
      )
      setError(
        draft.warnings[0] ||
          augmented.warnings[0] ||
          (reviewableItems.length === 0
            ? 'AI did not create any reviewable study materials from these notes.'
            : ''),
      )
      setStep('review')
    } catch (error) {
      if (
        generationController.signal.aborted ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        return
      }

      setError(
        error instanceof Error
          ? error.message
          : 'Could not generate study materials with AI.',
      )
    } finally {
      if (activeOperationRef.current === generationController) {
        activeOperationRef.current = null
      }

      if (!generationController.signal.aborted) {
        setIsGeneratingAi(false)
        setAiProgressLabel('')
        setAiGenerationProgress(0)
        setAiGenerationProgressPhase('')
        setGeminiProgress(null)
        setOcrStatus('')
      }
    }
  }

  const extractImageNotes = async () => {
    if (imageFiles.length === 0) {
      setError('Add one or more images before extracting notes.')
      return
    }

    const credentials = isStrongAiProvider(aiProvider)
      ? resolveStudyPackAiCredentials(aiProvider)
      : resolveStudyPackAiCredentials()
    if (isStrongAiProvider(aiProvider) && !credentials.apiToken) {
      requestSessionKey(aiProvider, credentials.model, {
        action: 'extractImage',
      })
      return
    }

    cancelActiveOperation()
    const extractionController = new AbortController()
    activeOperationRef.current = extractionController
    setIsExtractingImage(true)
    setOcrProgress(0)
    setOcrStatus(
      aiProvider === 'gemini'
        ? 'Preparing AI extraction'
        : aiProvider === 'local'
          ? 'Checking Local AI image support'
          : 'Preparing OCR',
    )
    setAiProgressLabel(
      aiProvider === 'gemini' ? 'Connecting to Gemini vision' : '',
    )
    setError('')

    try {
      if (aiProvider === 'gemini') {
        window.setTimeout(() => {
          setAiProgressLabel((current) =>
            current ? 'Reading image and correcting text' : current,
          )
        }, 700)
      }
      const pendingImageFiles = imageFiles.slice(extractedImageCount)
      if (pendingImageFiles.length === 0) {
        setImageTextExtracted(Boolean(sourceText.trim()))
        return
      }
      const extractedTexts: string[] = []
      for (let index = 0; index < pendingImageFiles.length; index += 1) {
        const imageFile = pendingImageFiles[index]
        if (extractionController.signal.aborted) {
          return
        }

        const imageNumber = extractedImageCount + index + 1
        setOcrStatus(
          pendingImageFiles.length > 1 || imageFiles.length > 1
            ? `Extracting ${imageFile.name} (${imageNumber}/${imageFiles.length})`
            : ocrStatus,
        )
        let text = ''
        if (aiProvider === 'gemini') {
          text = await extractRawNotesWithAi({
            apiToken: credentials.apiToken,
            model: credentials.model,
            image: imageFile,
          })
        } else if (aiProvider === 'local') {
          try {
            setOcrStatus('Extracting notes with Google Local AI')
            text = await extractNotesFromImageWithLocalLanguageModel(
              imageFile,
              {
                timeoutMs: 90 * 1000,
                signal: extractionController.signal,
                onProgress: (progress) => {
                  if (extractionController.signal.aborted) {
                    return
                  }

                  setOcrProgress(progress)
                  setOcrStatus(`Downloading local model ${progress}%`)
                },
              },
            )
          } catch (error) {
            if (
              extractionController.signal.aborted ||
              (error instanceof Error && error.name === 'AbortError')
            ) {
              return
            }

            setOcrStatus('Local AI image input unavailable; using OCR')
            text = await extractRawNotesFromImage(imageFile, (progress) => {
              setOcrProgress(Math.round(progress.progress * 100))
              setOcrStatus(progress.status)
            })
          }
        } else {
          text = await extractRawNotesFromImage(imageFile, (progress) => {
            setOcrProgress(Math.round(progress.progress * 100))
            setOcrStatus(progress.status)
          })
        }

        if (text.trim()) {
          extractedTexts.push(`# ${getFileTitle(imageFile)}\n\n${text.trim()}`)
        }
      }

      if (extractedTexts.length === 0) {
        if (extractionController.signal.aborted) {
          return
        }

        setSourceText('')
        setImageTextExtracted(false)
        setError('No text was detected in these images.')
        return
      }

      setSourceText((current) =>
        appendSourceText(current, extractedTexts.join('\n\n---\n\n')),
      )
      setExtractedImageCount(imageFiles.length)
      setImageTextExtracted(true)
      setOcrProgress(100)
      setOcrStatus(
        aiProvider === 'gemini'
          ? 'AI extraction complete'
          : aiProvider === 'local'
            ? 'Image extraction complete'
            : 'OCR complete',
      )
    } catch (error) {
      if (
        extractionController.signal.aborted ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        return
      }

      setError(
        aiProvider === 'gemini'
          ? 'Could not extract notes with AI. Check your Gemini API key or switch AI mode.'
          : 'Could not extract notes from this image.',
      )
      setImageTextExtracted(false)
    } finally {
      if (activeOperationRef.current === extractionController) {
        activeOperationRef.current = null
      }

      if (!extractionController.signal.aborted) {
        setIsExtractingImage(false)
        setAiProgressLabel('')
      }
    }
  }

  const parseCurrentSource = async () => {
    if (!resourceType) {
      setError('Choose a resource type before continuing.')
      return
    }

    let rawSource =
      sourceMode === 'dashboard'
        ? [
            `Use current dashboard as source: ${currentDashboardTitle}`,
            currentDashboardContext,
          ]
            .filter(Boolean)
            .join('\n\n')
        : sourceText

    if (sourceMode === 'dashboard' && !hasCurrentDashboardContext) {
      setError('Current dashboard has no usable study content.')
      return
    }

    if (sourceMode === 'dashboard') {
      setSourceText(rawSource)
      setSourceFormat('text')
      setSourceInputType('text')
      setTextSourceNames(['Current dashboard'])
      setPackTitle((currentTitle) =>
        currentTitle === 'Notes Dashboard'
          ? `${currentDashboardTitle} Study Material`
          : currentTitle,
      )
    }

    const copiedDraft = copiedTextDraft.trim()
    if (sourceMode === 'sources' && copiedDraft) {
      const nextIndex = copiedTextSourceCount + 1
      rawSource = appendSourceText(rawSource, copiedDraft)
      setSourceText(rawSource)
      setCopiedTextSourceCount(nextIndex)
      setCopiedTextDraft('')
      setShowCopiedTextBox(false)
      setSourceFormat('text')
      setSourceInputType('text')
    }

    if (
      sourceMode === 'sources' &&
      documentSources.length > extractedDocumentCount
    ) {
      const extractedSource = await extractPendingDocuments(rawSource)
      if (extractedSource === null) {
        return
      }
      rawSource = extractedSource
    }

    if (
      sourceMode === 'sources' &&
      sourceInputType === 'image' &&
      !imageTextExtracted
    ) {
      await extractImageNotes()
      return
    }

    if (!rawSource.trim()) {
      setError('Add sources before continuing.')
      return
    }

    await parseSourceWithAi(rawSource)
  }

  const handleUnifiedFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    await addSourceFiles(Array.from(event.target.files || []))
    event.target.value = ''
  }

  const handleUnifiedSourceDrop = async (
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault()
    await addSourceFiles(Array.from(event.dataTransfer.files || []))
  }

  const removeImageFile = (indexToRemove: number) => {
    setImageFiles((current) =>
      current.filter((_, index) => index !== indexToRemove),
    )
    setExtractedImageCount((current) =>
      indexToRemove < current ? Math.max(0, current - 1) : current,
    )
    setImageTextExtracted((current) =>
      indexToRemove >= extractedImageCount ? false : current,
    )
    setOcrProgress(0)
    setOcrStatus('')
    setError('')
  }

  const removeDocumentSource = (indexToRemove: number) => {
    setDocumentSources((current) =>
      current.filter((_, index) => index !== indexToRemove),
    )
    setExtractedDocumentCount((current) =>
      indexToRemove < current ? Math.max(0, current - 1) : current,
    )
    setError('')
  }

  const createPack = () => {
    const limits = resourceType
      ? detailLevelCountLimits[resourceType][detailLevel]
      : null
    const objects = reviewItems
      .map(applyReviewItem)
      .filter((object): object is StudyObject => Boolean(object))
      .slice(
        0,
        resourceType === 'flashcards' || resourceType === 'quiz'
          ? limits?.max
          : undefined,
      )
    const objectsById = new Map(objects.map((object) => [object.id, object]))
    const groups =
      resourceType === 'flashcards' || resourceType === 'quiz'
        ? [
            {
              name: `${packTitle.trim() || 'Notes Dashboard'} ${
                resourceTypeLabels[resourceType]
              }`,
              objects,
            },
          ]
        : widgetGroups
            .map((group, index) => ({
              name: group.name.trim() || `${packTitle} ${index + 1}`,
              objects: group.objectIds
                .map((objectId) => objectsById.get(objectId))
                .filter((object): object is StudyObject => Boolean(object)),
            }))
            .filter((group) => group.objects.length > 0)

    if (groups.length === 0) {
      setError('Add at least one generated study section.')
      return
    }

    const pack = {
      id: packTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: packTitle.trim() || 'Notes Dashboard',
      sourceFormat,
      objects,
      warnings: [],
      sourceSummary: aiSourceSummary || undefined,
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

    onCreatePack({
      name: packTitle.trim() || 'Notes Dashboard',
      widgets,
      layoutMode:
        resourceType === 'flashcards' || resourceType === 'quiz'
          ? 'tabs'
          : layoutMode !== 'orchestrator'
            ? layoutMode
            : 'tabs',
      folderName: quickCreateFolders[resourceType],
    })
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
          <Stack direction="row" spacing={1.5} alignItems="center">
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
              <AutoStoriesIcon />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Create from notes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Turn notes, images, PDFs, or slides into a clean study
                dashboard.
              </Typography>
            </Box>
          </Stack>
          {onCollapse && (
            <Tooltip title="Collapse panel">
              <IconButton
                aria-label="Collapse Create From Notes panel"
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
        {error && (
          <Box sx={{ mb: 2 }}>
            <Alert severity={step === 'review' ? 'info' : 'error'}>
              {error}
            </Alert>
          </Box>
        )}

        {step === 'source' ? (
          <Stack spacing={presentation === 'embedded' ? 1.5 : 2.5}>
            <TextField
              label="Dashboard name"
              value={packTitle}
              onChange={(event) => setPackTitle(event.target.value)}
              fullWidth
            />

            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: 1,
                borderColor: resourceType ? 'primary.main' : 'divider',
                borderRadius: 2,
                bgcolor: 'background.paper',
              }}
            >
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={900}>
                    Choose resource
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pick one output type for this resource pack.
                  </Typography>
                </Box>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems="stretch"
                >
                  {resourceTypeOptions.map((option) => {
                    const selected = resourceType === option.value
                    return (
                      <Button
                        key={option.value}
                        variant={selected ? 'contained' : 'outlined'}
                        onClick={() => {
                          setResourceType(option.value)
                          setError('')
                        }}
                        sx={{
                          flex: 1,
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          textAlign: 'left',
                          alignItems: 'flex-start',
                          p: 1.25,
                        }}
                      >
                        <Box>
                          <Typography variant="subtitle2" fontWeight={900}>
                            {option.label}
                          </Typography>
                          <Typography
                            variant="caption"
                            color={selected ? 'inherit' : 'text.secondary'}
                          >
                            {option.description}
                          </Typography>
                        </Box>
                      </Button>
                    )
                  })}
                </Stack>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  {detailLevelOptions.map((option) => (
                    <Button
                      key={option.value}
                      size="small"
                      variant={
                        detailLevel === option.value ? 'contained' : 'outlined'
                      }
                      onClick={() => setDetailLevel(option.value)}
                      sx={{ textTransform: 'none' }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </Stack>
                {resourceType === 'quiz' && (
                  <Stack spacing={0.75}>
                    <Typography variant="caption" color="text.secondary">
                      Question style
                    </Typography>
                    <Stack direction="row" gap={1} flexWrap="wrap">
                      {quizQuestionStyleOptions.map((option) => (
                        <Button
                          key={option.value}
                          size="small"
                          variant={
                            quizQuestionStyle === option.value
                              ? 'contained'
                              : 'outlined'
                          }
                          onClick={() => setQuizQuestionStyle(option.value)}
                          sx={{ textTransform: 'none' }}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </Stack>
                  </Stack>
                )}
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: 1,
                borderColor:
                  sourceMode === 'dashboard' ? 'primary.main' : 'divider',
                borderRadius: 2,
                bgcolor: 'background.paper',
              }}
            >
              <Stack spacing={1.25}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={900}>
                    Source
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Add material, or reuse the current dashboard.
                  </Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                  <Button
                    variant={
                      sourceMode === 'sources' ? 'contained' : 'outlined'
                    }
                    onClick={() => {
                      setSourceMode('sources')
                      setError('')
                    }}
                    sx={{ textTransform: 'none', flex: 1 }}
                  >
                    Add sources
                  </Button>
                  <Button
                    variant={
                      sourceMode === 'dashboard' ? 'contained' : 'outlined'
                    }
                    disabled={!hasCurrentDashboardContext}
                    onClick={() => {
                      setSourceMode('dashboard')
                      setError('')
                    }}
                    sx={{ textTransform: 'none', flex: 1 }}
                  >
                    Current dashboard
                  </Button>
                </Stack>
                {sourceMode === 'dashboard' ? (
                  <Alert severity="info">
                    Using current dashboard: {currentDashboardTitle}
                  </Alert>
                ) : !hasCurrentDashboardContext ? (
                  <Typography variant="caption" color="text.secondary">
                    Current dashboard has no usable study content.
                  </Typography>
                ) : null}
              </Stack>
            </Paper>

            {sourceMode === 'sources' && (
              <Paper
                elevation={0}
                onDrop={handleUnifiedSourceDrop}
                onDragOver={(event) => event.preventDefault()}
                sx={{
                  p: presentation === 'embedded' ? 2 : 3,
                  border: '1.5px dashed',
                  borderColor:
                    sourceText.trim() ||
                    copiedTextDraft.trim() ||
                    imageFiles.length > 0 ||
                    documentSources.length > 0
                      ? 'primary.main'
                      : 'divider',
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                }}
              >
                <Stack spacing={1.5} alignItems="center" textAlign="center">
                  <UploadFileIcon color="primary" sx={{ fontSize: 44 }} />
                  <Box sx={{ width: '100%', minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={900}>
                      Add sources
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Drop notes here, or upload text, images, PDFs, and slides.
                    </Typography>
                  </Box>
                  <Button
                    component="label"
                    variant="contained"
                    startIcon={<UploadFileIcon />}
                    disabled={isExtractingDocument || isExtractingImage}
                    fullWidth={presentation === 'embedded'}
                    sx={{
                      width: presentation === 'embedded' ? '100%' : undefined,
                      textTransform: 'none',
                    }}
                  >
                    Upload files
                    <input
                      hidden
                      type="file"
                      multiple
                      accept={[
                        '.md',
                        '.txt',
                        '.csv',
                        '.pdf',
                        '.pptx',
                        imageAcceptValue,
                        'text/markdown',
                        'text/plain',
                        'text/csv',
                        'application/pdf',
                        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                      ].join(',')}
                      onChange={handleUnifiedFileUpload}
                    />
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<ContentPasteIcon />}
                    onClick={() => setShowCopiedTextBox(true)}
                    disabled={isExtractingDocument || isExtractingImage}
                    fullWidth={presentation === 'embedded'}
                    sx={{
                      width: presentation === 'embedded' ? '100%' : undefined,
                      textTransform: 'none',
                    }}
                  >
                    Copied text
                  </Button>
                  <Stack
                    direction="row"
                    gap={0.75}
                    flexWrap="wrap"
                    justifyContent="center"
                  >
                    {['Text', 'Images', 'PDF', 'PPTX'].map((label) => (
                      <Chip key={label} label={label} size="small" />
                    ))}
                  </Stack>
                </Stack>
              </Paper>
            )}

            {sourceMode === 'sources' && showCopiedTextBox && (
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
                    value={copiedTextDraft}
                    onChange={(event) => setCopiedTextDraft(event.target.value)}
                    fullWidth
                    multiline
                    minRows={presentation === 'embedded' ? 7 : 10}
                    disabled={isExtractingImage || isExtractingDocument}
                    placeholder={`# Derivatives\n\nDefinition:: A derivative measures instantaneous rate of change.\n\nQ: What is the power rule?\nA: d/dx x^n = nx^(n-1)`}
                  />
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      onClick={() => {
                        setCopiedTextDraft('')
                        setShowCopiedTextBox(false)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      onClick={appendCopiedTextDraft}
                      disabled={isExtractingImage || isExtractingDocument}
                    >
                      Add copied text
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            )}

            {sourceMode === 'sources' &&
              (copiedTextSourceCount > 0 ||
                textSourceNames.length > 0 ||
                documentSources.length > 0) && (
                <Stack spacing={1}>
                  <Typography variant="subtitle2" fontWeight={900}>
                    Sources
                  </Typography>
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    {Array.from({ length: copiedTextSourceCount }).map(
                      (_, index) => (
                        <Chip
                          key={`copied-text-${index + 1}`}
                          icon={<ContentPasteIcon />}
                          label={
                            index === 0
                              ? 'Copied text'
                              : `Copied text ${index + 1}`
                          }
                        />
                      ),
                    )}
                    {textSourceNames.map((name) => (
                      <Chip
                        key={`text-${name}`}
                        icon={<DescriptionIcon />}
                        label={name}
                      />
                    ))}
                    {documentSources.map((source, index) => (
                      <Chip
                        key={`${source.file.name}-${index}`}
                        icon={<DescriptionIcon />}
                        label={source.file.name}
                        onDelete={
                          index >= extractedDocumentCount
                            ? () => removeDocumentSource(index)
                            : undefined
                        }
                        deleteIcon={<DeleteIcon />}
                      />
                    ))}
                  </Stack>
                </Stack>
              )}

            {sourceMode === 'sources' && imagePreviewUrls.length > 0 && (
              <Stack direction="row" gap={1} flexWrap="wrap">
                {imagePreviewUrls.map((preview, index) => (
                  <Paper
                    key={`${preview.name}-${preview.url}`}
                    elevation={0}
                    sx={{
                      width: 104,
                      maxWidth: 104,
                      minWidth: 0,
                      p: 0.75,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      component="img"
                      src={preview.url}
                      alt={preview.name}
                      sx={{
                        width: '100%',
                        height: 64,
                        borderRadius: 0.75,
                        objectFit: 'cover',
                      }}
                    />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{
                        display: 'block',
                        mt: 0.5,
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {preview.name}
                    </Typography>
                    <IconButton
                      aria-label={`Remove ${preview.name}`}
                      size="small"
                      onClick={() => removeImageFile(index)}
                      sx={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        bgcolor: 'background.paper',
                      }}
                    >
                      <DeleteIcon fontSize="inherit" />
                    </IconButton>
                  </Paper>
                ))}
              </Stack>
            )}

            {sourceMode === 'sources' &&
              (isExtractingImage || isExtractingDocument) && (
                <Box>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    sx={{ mb: 0.75 }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {aiProgressLabel || ocrStatus || 'Extracting notes'}
                    </Typography>
                    {isExtractingImage && aiProvider !== 'gemini' && (
                      <Typography variant="body2" color="text.secondary">
                        {ocrProgress}%
                      </Typography>
                    )}
                  </Stack>
                  <LinearProgress
                    variant={
                      isExtractingImage &&
                      aiProvider !== 'gemini' &&
                      ocrProgress > 0
                        ? 'determinate'
                        : 'indeterminate'
                    }
                    value={ocrProgress}
                  />
                </Box>
              )}

            {isGeneratingAi && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: 1,
                  borderColor: 'primary.main',
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AutoAwesomeIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={800}>
                      {aiProgressLabel || ocrStatus || 'Creating dashboard'}
                    </Typography>
                  </Stack>
                  {aiProvider === 'local' && aiGenerationProgressPhase ? (
                    <>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">
                          Estimated Local AI generation time
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {aiGenerationProgress}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={aiGenerationProgress}
                      />
                    </>
                  ) : isStrongAiProvider(aiProvider) && geminiProgress ? (
                    <>
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
                    </>
                  ) : (
                    <LinearProgress />
                  )}
                </Stack>
              </Paper>
            )}
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Paper
              elevation={0}
              sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}
            >
              <Stack spacing={2}>
                <TextField
                  label="Dashboard name"
                  value={packTitle}
                  onChange={(event) => setPackTitle(event.target.value)}
                  fullWidth
                />
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <Chip
                    color="primary"
                    label={`${reviewableCount} study blocks`}
                  />
                  <Chip label={`${widgetGroups.length} sections`} />
                  <Chip
                    label={
                      resourceType
                        ? resourceTypeLabels[resourceType]
                        : sourceFormat === 'csv'
                          ? 'Source table included'
                          : 'Source notes included'
                    }
                  />
                  <Chip label={`${detailLevel} detail`} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Review the dashboard structure below, then create it in your
                  workspace.
                </Typography>
              </Stack>
            </Paper>

            {widgetGroups.length > 0 ? (
              <Stack spacing={1.25}>
                {widgetGroups.map((group, index) => (
                  <Paper
                    key={group.id}
                    elevation={0}
                    sx={{
                      p: 1.5,
                      border: 1,
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                      borderRadius: 2,
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Box
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: 'action.hover',
                          fontWeight: 900,
                          flex: '0 0 auto',
                        }}
                      >
                        {index + 1}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="subtitle2" fontWeight={900} noWrap>
                          {group.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {group.objectIds.length} generated blocks
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  StudyMesh was not able to extract study materials from these
                  notes.
                </Typography>
              </Paper>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, flexShrink: 0 }}>
        {step === 'review' && (
          <Button onClick={() => setStep('source')}>Back</Button>
        )}
        <Button onClick={handleClose}>Cancel</Button>
        {step === 'source' ? (
          <Button
            variant="contained"
            onClick={parseCurrentSource}
            disabled={
              !resourceType ||
              (sourceMode === 'dashboard' && !hasCurrentDashboardContext) ||
              isExtractingImage ||
              isGeneratingAi ||
              isExtractingDocument
            }
          >
            {isGeneratingAi
              ? 'Creating...'
              : sourceInputType === 'image' && !imageTextExtracted
                ? 'Extract notes'
                : 'Continue'}
          </Button>
        ) : (
          <Button variant="contained" onClick={createPack}>
            Create dashboard
          </Button>
        )}
      </DialogActions>
    </>
  )

  if (presentation === 'embedded') {
    if (!open) {
      return null
    }

    return (
      <>
        <Box
          data-testid="study-pack-modal"
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
            onCancel={() => setSessionKeyRequest(null)}
            onSaved={() => {
              const continuation = sessionKeyRequest.continuation
              setSessionKeyRequest(null)
              if (continuation.action === 'generate') {
                void parseSourceWithAi(continuation.rawSource)
              } else {
                void extractImageNotes()
              }
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
          onCancel={() => setSessionKeyRequest(null)}
          onSaved={() => {
            const continuation = sessionKeyRequest.continuation
            setSessionKeyRequest(null)
            if (continuation.action === 'generate') {
              void parseSourceWithAi(continuation.rawSource)
            } else {
              void extractImageNotes()
            }
          }}
        />
      ) : null}
    </>
  )
}

export default CreateStudyPackModal
