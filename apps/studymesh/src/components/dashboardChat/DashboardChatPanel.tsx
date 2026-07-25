import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  InputAdornment,
  InputBase,
  Menu,
  MenuItem,
  Popover,
  Stack,
  TextField,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SendIcon from '@mui/icons-material/Send'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import LinkIcon from '@mui/icons-material/Link'
import NotesIcon from '@mui/icons-material/Notes'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import ContentPasteIcon from '@mui/icons-material/ContentPaste'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import QuizIcon from '@mui/icons-material/Quiz'
import StyleIcon from '@mui/icons-material/Style'
import PodcastsIcon from '@mui/icons-material/Podcasts'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SearchIcon from '@mui/icons-material/Search'
import ArticleIcon from '@mui/icons-material/Article'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import ReplayIcon from '@mui/icons-material/Replay'
import { StateDashboard } from '../../state/store'
import {
  buildDashboardChatContext,
  type DashboardSourceChunk,
  formatDashboardChatContext,
  selectDashboardChatChunks,
} from '../../dashboardChat/contextBuilder'
import {
  askDashboardSources,
  type DashboardAnswerBasis,
  type DashboardAnswerContextSupport,
  type DashboardAnswerSourceRef,
} from '../../dashboardChat/askDashboard'
import {
  fetchDashboardExternalSource,
  type DashboardExternalSource,
  type DashboardExternalSourceOriginType,
} from '../../dashboardChat/externalSources'
import { prepareDashboardExternalSourcePageDraft } from '../../dashboardChat/sourcePageDrafts'
import {
  fallbackDashboardChatSourcePlan,
  planDashboardChatSources,
  type DashboardChatSourceId,
  type DashboardChatSourcePlan,
} from '../../dashboardChat/sourcePlanner'
import { readQuickCreateAiSettings } from '../../quickCreate/ai'
import { getHostedAiCreditCost } from '../../quickCreate/ai/hostedCredits'
import {
  quickCreateActionGroups,
  quickCreateActions,
  type QuickCreateAction,
  type QuickCreateActionGroup,
  type QuickCreateActionId,
  type QuickCreateActionRequest,
  type QuickCreateSourceScope,
} from '../../quickCreate/quickCreateActions'
import { renderMarkdown } from '../study/StudyBlockView'
import { PREFILL_DASHBOARD_CHAT_EVENT } from '../workspace/workspaceEvents'
import { useInterfaceText } from '../../language/interfaceLanguage'
import { useAccentColor } from '../../theme/AccentColorContext'
import StudyCreditCostLabel from '../hostedAi/StudyCreditCostLabel'

export type { DashboardAnswerSourceRef } from '../../dashboardChat/askDashboard'

const MIN_RESIZED_CHAT_COMPOSER_HEIGHT = 148
const MAX_USER_ADDED_SOURCES = 5
const MAX_USER_SOURCE_TEXT_CHARS = 12_000
const MAX_USER_SOURCE_CONTEXT_CHARS = 18_000
const MAX_USER_SOURCES_PER_ANSWER = 3
const MAX_USER_SOURCE_FILE_BYTES = 1_000_000
export interface DashboardChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  sourceRefs?: DashboardAnswerSourceRef[]
  answerBasis?: DashboardAnswerBasis[]
  contextSupport?: DashboardAnswerContextSupport
  webLookup?: {
    status: 'searching' | 'found' | 'failed'
    sourceId?: string
    sourceIds?: string[]
    error?: string
  }
  externalSourceIds?: string[]
  pending?: boolean
  promptBranchId?: string
  promptBranchIndex?: number
  promptBranchCount?: number
}

interface ChatMemoryItem {
  userQuestion: string
  finalAssistantAnswer: string
  coveredEntities: string[]
  usedSourceIds: string[]
  sourceSummaries: string[]
  createdAt: string
}

interface DashboardChatSession {
  id: string
  title: string
  messages: DashboardChatMessage[]
  externalSources?: DashboardExternalSource[]
  memoryItems?: ChatMemoryItem[]
  rejectedExternalSourceUrls?: string[]
  rejectedExternalSourceDomains?: string[]
  branchSnapshots?: Record<string, DashboardChatMessage[][]>
  createdAt: number
  updatedAt: number
}

interface ExternalSourcePrompt {
  title: string
  url: string
}

interface DashboardChatPanelProps {
  dashboard?: StateDashboard
  messages: DashboardChatMessage[]
  onMessagesChange: (messages: DashboardChatMessage[]) => void
  onStorageError?: (error: unknown) => void
  onClose: () => void
  showCloseButton?: boolean
  onAddAssistantMessageToGuide?: (message: DashboardChatMessage) => void
  onAddExternalSourceToGuide?: (source: DashboardExternalSource) => void
  onOpenSource?: (source: DashboardAnswerSourceRef) => void
  onQuickCreatePage?: (
    request: QuickCreateActionRequest,
    options?: { signal?: AbortSignal },
  ) => Promise<void>
  supportsStudyGuideCreateScope?: boolean
  queuedDraft?: { id: string; content: string } | null
  onQueuedDraftConsumed?: (id: string) => void
}

const suggestions = [
  {
    labelKey: 'chat.summarizeKeyIdeas',
    icon: <ArticleIcon fontSize="small" />,
  },
  {
    labelKey: 'chat.explainLikeNew',
    icon: <LightbulbIcon fontSize="small" />,
  },
  {
    labelKey: 'chat.generateExamQuestions',
    icon: <HelpOutlineIcon fontSize="small" />,
  },
] as const

const makeMessageId = () =>
  `dashboard-chat-${Date.now()}-${Math.random().toString(36).slice(2)}`

const makeChatSessionId = () =>
  `dashboard-chat-session-${Date.now()}-${Math.random().toString(36).slice(2)}`

const getChatSessionStorageKey = (dashboardId?: string) =>
  `studymesh-dashboard-chat-sessions-${dashboardId || 'workspace'}`

const isUserAddedSourceOriginType = (
  originType: DashboardExternalSourceOriginType | undefined,
) => originType === 'user-text' || originType === 'user-web'

const isUserAddedSource = (source: DashboardExternalSource) =>
  isUserAddedSourceOriginType(source.originType)

const normalizeUserSourceText = (value: string) =>
  value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()

const truncateUserSourceText = (value: string) => {
  const normalized = normalizeUserSourceText(value)
  if (normalized.length <= MAX_USER_SOURCE_TEXT_CHARS) {
    return { text: normalized, trimmed: false }
  }

  return {
    text: normalized.slice(0, MAX_USER_SOURCE_TEXT_CHARS).trim(),
    trimmed: true,
  }
}

const hashSourceValue = (value: string): string => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash.toString(36)
}

const TEXT_SOURCE_FILE_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'json',
  'html',
  'htm',
  'xml',
  'yaml',
  'yml',
  'log',
])

const isReadableUserSourceFile = (file: File): boolean => {
  if (file.type.startsWith('text/')) {
    return true
  }

  if (
    ['application/json', 'application/xml', 'application/xhtml+xml'].includes(
      file.type,
    )
  ) {
    return true
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  return TEXT_SOURCE_FILE_EXTENSIONS.has(extension)
}

const readUserSourceFileText = (file: File): Promise<string> => {
  if (typeof file.text === 'function') {
    return file.text()
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('read_failed'))
    reader.readAsText(file)
  })
}

const createEmptyChatSession = (): DashboardChatSession => ({
  id: makeChatSessionId(),
  title: 'New chat',
  messages: [],
  externalSources: [],
  memoryItems: [],
  branchSnapshots: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

const isEmptyChatSession = (session: DashboardChatSession) =>
  session.messages.length === 0 && (session.externalSources || []).length === 0

const normalizeChatSessions = (
  sessions: DashboardChatSession[],
): DashboardChatSession[] => {
  const existingEmptySession = sessions.find(isEmptyChatSession)
  const emptySession = existingEmptySession || createEmptyChatSession()
  const filledSessions = sessions.filter(
    (session) => !isEmptyChatSession(session),
  )

  return [
    {
      ...emptySession,
      title: 'New chat',
      messages: [],
    },
    ...filledSessions,
  ]
}

const titleFromQuestion = (question: string) => {
  const words = question
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 7)
  const title = words.join(' ')
  return title.length > 44
    ? `${title.slice(0, 43).trim()}...`
    : title || 'New chat'
}

type DashboardChatQuickCreateAction = QuickCreateAction & {
  id: Exclude<QuickCreateActionId, 'improvedNotes'>
}

const isDashboardChatQuickCreateAction = (
  action: QuickCreateAction,
): action is DashboardChatQuickCreateAction => action.id !== 'improvedNotes'

const dashboardChatQuickCreateActions = quickCreateActions.filter(
  isDashboardChatQuickCreateAction,
)

const quickCreateIcons: Record<
  Exclude<QuickCreateActionId, 'improvedNotes'>,
  React.ReactNode
> = {
  quiz: <QuizIcon fontSize="small" />,
  flashcards: <StyleIcon fontSize="small" />,
  podcast: <PodcastsIcon fontSize="small" />,
}

const quickCreateCreditCost = getHostedAiCreditCost('quick-create')
const chatCreditCost = getHostedAiCreditCost('chat')

const getQuickCreateGroupLabelKey = (group: QuickCreateActionGroup) => {
  switch (group) {
    case 'Practice':
      return 'chat.quickCreateGroupPractice'
    case 'Notes':
      return 'chat.quickCreateGroupNotes'
  }
}

const getQuickCreateActionLabelKey = (actionId: QuickCreateActionId) => {
  switch (actionId) {
    case 'quiz':
      return 'chat.quickCreateQuiz'
    case 'flashcards':
      return 'chat.quickCreateFlashcards'
    case 'podcast':
      return 'chat.quickCreatePodcast'
    case 'improvedNotes':
      return 'chat.quickCreateExpand'
  }
}

const getQuickCreateActionDescriptionKey = (actionId: QuickCreateActionId) => {
  switch (actionId) {
    case 'quiz':
      return 'chat.quickCreateQuizDescription'
    case 'flashcards':
      return 'chat.quickCreateFlashcardsDescription'
    case 'podcast':
      return 'chat.quickCreatePodcastDescription'
    case 'improvedNotes':
      return 'chat.quickCreateExpandDescription'
  }
}

const SOURCE_REJECTION_PATTERN =
  /\b(?:don't|dont|do not|stop)\s+use\b|\btry another\b|\banother source\b|\bwrong source\b|\bbad source\b|\bnot that source\b/i
const SOURCE_SUPPORT_FOLLOWUP_PATTERN =
  /\b(?:what(?:'s| is)? your source|what source|cite|citation|where did you get|what(?:'s| is)? your basis|what(?:'s| is)? your base|base to say|source to say)\b/i
const SMALLTALK_PATTERN =
  /^(?:hi|hello|hey|thanks?|thank you|thx|ty|ok|okay|cool|nice|great|what can you do\??)$/i
const SMALLTALK_HINT_PATTERN =
  /^(?:say\s+hi\b.*|how\s+(?:are|r)?\s*you\b|how you\b|tank\s+yuo)$/i
const RECALL_PATTERN =
  /\brepeat\b|\bearlier\b|\bwhat did you say\b|\bwhat was\b|\bremind me\b/i
const QUESTION_TERM_STOPWORDS = new Set([
  'about',
  'apps',
  'app',
  'are',
  'base',
  'basis',
  'automatization',
  'automation',
  'and',
  'between',
  'compare',
  'comparison',
  'difference',
  'different',
  'does',
  'from',
  'guide',
  'information',
  'into',
  'lesson',
  'key',
  'ideas',
  'or',
  'source',
  'sources',
  'study',
  'summarize',
  'say',
  'says',
  'that',
  'the',
  'their',
  'this',
  'tool',
  'tools',
  'use',
  'versus',
  'vs',
  'what',
  'where',
  'why',
  'with',
  'you',
  'your',
])
type AiChatPetId = 'dolphin' | 'rabbit' | 'parrot'

interface AiChatPetDefinition {
  id: AiChatPetId
  label: string
  src: string
  faceSrc: string
}

export const AI_CHAT_PET_STORAGE_KEY = 'studymesh-ai-chat-pet'
export const AI_CHAT_PET_CHANGED_EVENT = 'studymesh-ai-chat-pet-changed'

export const aiChatPets: AiChatPetDefinition[] = [
  {
    id: 'rabbit',
    label: 'Rabbit',
    src: '/images/studymesh-ai-pet-rabbit.png',
    faceSrc: '/images/studymesh-ai-pet-rabbit-face.png',
  },
  {
    id: 'dolphin',
    label: 'Dolphin',
    src: '/images/studymesh-ai-pet-dolphin.png',
    faceSrc: '/images/studymesh-ai-pet-dolphin-face.png',
  },
  {
    id: 'parrot',
    label: 'Parrot',
    src: '/images/studymesh-ai-pet-parrot.png',
    faceSrc: '/images/studymesh-ai-pet-parrot-face.png',
  },
]

export const isAiChatPetId = (value: string | null): value is AiChatPetId =>
  aiChatPets.some((pet) => pet.id === value)

export const DEFAULT_AI_CHAT_PET_ID: AiChatPetId = 'rabbit'

// 'bee' held the first companion slot before the rabbit replaced it. Existing users still
// have that id in localStorage, and isAiChatPetId now rejects it, so map it across instead
// of letting those users silently fall through to the default.
const LEGACY_AI_CHAT_PET_IDS: Record<string, AiChatPetId> = { bee: 'rabbit' }

// Every read of AI_CHAT_PET_STORAGE_KEY has to go through this so the legacy mapping and
// the default cannot drift apart between the state initializer and the storage-sync effect.
export const resolveAiChatPetId = (value: string | null): AiChatPetId => {
  const normalized = (value && LEGACY_AI_CHAT_PET_IDS[value]) || value
  return isAiChatPetId(normalized) ? normalized : DEFAULT_AI_CHAT_PET_ID
}

export const getAiChatPetSrc = (
  pet: AiChatPetDefinition,
  variant: 'face' | 'full',
): string => (variant === 'face' ? pet.faceSrc : pet.src)

const AiChatPet = ({
  pet,
  compact = false,
}: {
  pet?: (typeof aiChatPets)[number]
  compact?: boolean
}) => {
  const resolvedPet = pet || aiChatPets[0]

  return (
    <Box
      aria-hidden
      sx={{
        width: compact ? { xs: 108, sm: 96 } : 200,
        height: compact ? { xs: 108, sm: 96 } : 200,
        flex: '0 0 auto',
        backgroundImage: `url(${getAiChatPetSrc(resolvedPet, 'full')})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center bottom',
        backgroundRepeat: 'no-repeat',
        filter: 'drop-shadow(0 12px 16px rgba(15,23,42,0.12))',
      }}
    />
  )
}

const getQuickCreateEstimateSeconds = (
  actionId?: QuickCreateActionId | null,
): number => {
  if (actionId === 'quiz') {
    return 70
  }

  if (actionId === 'flashcards') {
    return 25
  }

  if (actionId === 'podcast') {
    return 45
  }

  const provider = readQuickCreateAiSettings().provider || 'hosted'

  if (provider === 'local') {
    return 90
  }

  return 45
}

const getDashboardChatFailureMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : ''

  if (
    /sign in|session expired|unauthorized|rejected the request/i.test(message)
  ) {
    return 'The chat request needs a fresh sign-in before it can answer.'
  }

  if (/not configured|api key|provider rejected/i.test(message)) {
    return 'Hosted AI is not configured correctly on this server yet.'
  }

  if (/rate limited|try again later/i.test(message)) {
    return 'Hosted AI is rate limited right now. Try again later.'
  }

  if (/structured output|output format|JSON/i.test(message)) {
    return 'The model returned an unusable response. Try the question again.'
  }

  return 'I could not answer from this dashboard yet.'
}

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'

interface PendingQuickCreateTask {
  id: string
  actionId: Exclude<QuickCreateActionId, 'improvedNotes'>
  resourceType: QuickCreateActionRequest['resourceType']
  label: string
  sourceScope?: QuickCreateSourceScope
  startedAt: number
  estimateSeconds: number
}

const DashboardChatPanel = ({
  dashboard,
  messages,
  onMessagesChange,
  onStorageError,
  onClose,
  showCloseButton = true,
  onAddAssistantMessageToGuide,
  onAddExternalSourceToGuide,
  onOpenSource,
  onQuickCreatePage,
  supportsStudyGuideCreateScope = false,
  queuedDraft,
  onQueuedDraftConsumed,
}: DashboardChatPanelProps) => {
  const { t } = useInterfaceText()
  const { accentColor } = useAccentColor()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [timerNow, setTimerNow] = useState(Date.now())
  const [pendingQuickCreateTasks, setPendingQuickCreateTasks] = useState<
    PendingQuickCreateTask[]
  >([])
  const [quickCreateMenuAnchor, setQuickCreateMenuAnchor] =
    useState<HTMLElement | null>(null)
  const [chatMenuAnchor, setChatMenuAnchor] = useState<HTMLElement | null>(null)
  const [petMenuAnchor, setPetMenuAnchor] = useState<HTMLElement | null>(null)
  const [chatSessions, setChatSessions] = useState<DashboardChatSession[]>([])
  const [activeChatId, setActiveChatId] = useState('')
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null)
  const [editingPromptDraft, setEditingPromptDraft] = useState('')
  const [activePetId, setActivePetId] = useState<AiChatPetId>(() => {
    try {
      return resolveAiChatPetId(
        window.localStorage.getItem(AI_CHAT_PET_STORAGE_KEY),
      )
    } catch {
      return DEFAULT_AI_CHAT_PET_ID
    }
  })
  const [quickCreateSearch, setQuickCreateSearch] = useState('')
  const [replyScrollBufferActive, setReplyScrollBufferActive] = useState(false)
  const [chatComposerHeight, setChatComposerHeight] = useState(
    MIN_RESIZED_CHAT_COMPOSER_HEIGHT,
  )
  const [sourceChipRowHeight, setSourceChipRowHeight] = useState(0)
  const [chatComposerResized, setChatComposerResized] = useState(false)
  const [draftHasMultipleLines, setDraftHasMultipleLines] = useState(false)
  const [externalSourcePrompt, setExternalSourcePrompt] =
    useState<ExternalSourcePrompt | null>(null)
  const [addSourceDialogOpen, setAddSourceDialogOpen] = useState(false)
  const [pasteSourceDialogOpen, setPasteSourceDialogOpen] = useState(false)
  const [addSourceText, setAddSourceText] = useState('')
  const [addSourceUrl, setAddSourceUrl] = useState('')
  const [addSourceError, setAddSourceError] = useState('')
  const [addSourceNotice, setAddSourceNotice] = useState('')
  const [addSourceLoading, setAddSourceLoading] = useState(false)
  const [quickCreateSourceScope, setQuickCreateSourceScope] =
    useState<QuickCreateSourceScope>(
      supportsStudyGuideCreateScope ? 'studyGuide' : 'currentPage',
    )
  const panelRef = useRef<HTMLDivElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null)
  const externalSourceAddButtonRefs = useRef(
    new Map<string, HTMLButtonElement>(),
  )
  const userSourceChipRefs = useRef(new Map<string, HTMLDivElement>())
  const userSourceRowRef = useRef<HTMLDivElement | null>(null)
  const sourceFileInputRef = useRef<HTMLInputElement | null>(null)
  const quickCreateAbortControllersRef = useRef(
    new Map<string, AbortController>(),
  )
  const composerDragRef = useRef<{
    startY: number
    startHeight: number
  } | null>(null)
  const messagesRef = useRef(messages)
  const chatSessionsRef = useRef<DashboardChatSession[]>([])
  const settings = readQuickCreateAiSettings()
  const currentAiProvider = settings.provider || 'hosted'
  const isHostedAi = currentAiProvider === 'hosted'
  const isLocalAi = currentAiProvider === 'local'
  const context = useMemo(
    () =>
      buildDashboardChatContext(
        dashboard,
        isLocalAi
          ? { sourceNotesOnly: true, studyPathScope: 'selected' }
          : undefined,
      ),
    [dashboard, isLocalAi],
  )
  const hasContext = context.chunks.length > 0
  const activePet =
    aiChatPets.find((pet) => pet.id === activePetId) || aiChatPets[0]
  const dismissibleAlertSx = {
    '& .MuiAlert-action': {
      alignItems: 'flex-start',
      ml: 'auto',
      pl: 1,
    },
  }
  const renderDismissAlertAction = (
    onDismiss: () => void,
    severity: 'error' | 'info' = 'error',
  ) => {
    const palette = theme.palette[severity]

    return (
      <IconButton
        aria-label="Dismiss alert"
        size="small"
        onClick={onDismiss}
        sx={{
          flexShrink: 0,
          color: `${severity}.dark`,
          bgcolor: alpha(palette.main, 0.08),
          border: 1,
          borderColor: alpha(palette.main, 0.24),
          '&:hover': {
            bgcolor: alpha(palette.main, 0.16),
          },
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    )
  }
  const activeChatSession = chatSessions.find(
    (session) => session.id === activeChatId,
  )
  const userAddedSources = (activeChatSession?.externalSources || []).filter(
    isUserAddedSource,
  )
  const activeChatTitle = activeChatSession?.title || 'New chat'
  const displayChatTitle = (title: string) =>
    title === 'New chat' ? t('chat.newChat') : title
  const displayedActiveChatTitle = displayChatTitle(activeChatTitle)
  const userActionIconButtonSx = {
    width: 24,
    height: 24,
    bgcolor: 'background.paper',
    border: 1,
    borderColor: 'divider',
    color: 'text.secondary',
    boxShadow: `0 8px 20px ${alpha(theme.palette.common.black, 0.12)}`,
    '& svg': { fontSize: 16 },
    '&:hover': {
      bgcolor: alpha(theme.palette.primary.main, 0.08),
      borderColor: alpha(theme.palette.primary.main, 0.34),
      color: 'primary.main',
    },
  }

  const measureDraftLines = () => {
    const input = draftInputRef.current
    const hasText = draft.length > 0
    if (!input) {
      setDraftHasMultipleLines(hasText && draft.includes('\n'))
      return
    }

    const computedStyle = window.getComputedStyle(input)
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 20
    const hasMultipleLines =
      hasText &&
      (draft.includes('\n') || input.scrollHeight > lineHeight * 1.65)
    setDraftHasMultipleLines(hasMultipleLines)
  }

  const startComposerResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draftHasMultipleLines) {
      return
    }

    event.preventDefault()
    composerDragRef.current = {
      startY: event.clientY,
      startHeight: chatComposerHeight,
    }
    setChatComposerResized(true)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }

  const scrollChatToBottom = () => {
    window.requestAnimationFrame(() => {
      const scrollElement = chatScrollRef.current
      if (scrollElement) {
        scrollElement.scrollTo({
          top: scrollElement.scrollHeight,
          behavior: 'smooth',
        })
      }
    })
  }

  const focusComposerFromSurface = (
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('button, a, input, textarea, [role="button"]')) {
      return
    }

    event.preventDefault()
    draftInputRef.current?.focus()
  }

  const persistChatSessions = (nextSessions: DashboardChatSession[]) => {
    const normalizedSessions = normalizeChatSessions(nextSessions)
    chatSessionsRef.current = normalizedSessions
    setChatSessions(normalizedSessions)
    try {
      window.localStorage.setItem(
        getChatSessionStorageKey(dashboard?.id),
        JSON.stringify(normalizedSessions),
      )
    } catch (storageError) {
      console.error('Failed to persist dashboard chat sessions', storageError)
      onStorageError?.(storageError)
    }
  }

  const getActiveSession = () => {
    const currentSessions = chatSessionsRef.current.length
      ? chatSessionsRef.current
      : [createEmptyChatSession()]
    const sessionId = activeChatId || currentSessions[0].id
    return {
      currentSessions,
      sessionId,
      session: currentSessions.find(({ id }) => id === sessionId),
    }
  }

  const updateActiveChatExternalSources = (
    updater: (
      externalSources: DashboardExternalSource[],
    ) => DashboardExternalSource[],
  ): DashboardExternalSource[] => {
    const now = Date.now()
    const { currentSessions, sessionId } = getActiveSession()
    let nextExternalSources: DashboardExternalSource[] = []
    const nextSessions = currentSessions.map((session) => {
      if (session.id !== sessionId) {
        return session
      }

      nextExternalSources = updater(session.externalSources || [])
      return {
        ...session,
        externalSources: nextExternalSources,
        updatedAt: now,
      }
    })
    persistChatSessions(nextSessions)
    return nextExternalSources
  }

  const updateActiveChatRejectedSources = (source: DashboardExternalSource) => {
    const now = Date.now()
    const { currentSessions, sessionId } = getActiveSession()
    const domain = getSourceDomain(source.url)
    const normalizedUrl = normalizeSourceUrlForDedupe(source.url)
    const nextSessions = currentSessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            rejectedExternalSourceUrls: Array.from(
              new Set([
                ...(session.rejectedExternalSourceUrls || []),
                normalizedUrl,
              ]),
            ),
            rejectedExternalSourceDomains: domain
              ? Array.from(
                  new Set([
                    ...(session.rejectedExternalSourceDomains || []),
                    domain,
                  ]),
                )
              : session.rejectedExternalSourceDomains || [],
            externalSources: (session.externalSources || []).filter(
              (candidate) =>
                normalizeSourceUrlForDedupe(candidate.url) !== normalizedUrl,
            ),
            updatedAt: now,
          }
        : session,
    )
    persistChatSessions(nextSessions)
  }

  const externalSourceToChunk = (
    source: DashboardExternalSource,
  ): DashboardSourceChunk => ({
    id: source.id,
    title: source.title,
    type:
      source.originType === 'user-text'
        ? 'pasted source'
        : source.originType === 'user-web'
          ? 'user webpage'
          : 'web source',
    text: source.text.slice(0, MAX_USER_SOURCE_TEXT_CHARS),
    origin: 'web',
    originType: source.originType || 'web',
    url: source.url,
  })

  const normalizeSourceUrlForDedupe = (value: string): string => {
    try {
      const url = new URL(value)
      url.hash = ''
      return url.toString().toLowerCase()
    } catch {
      return value.trim().toLowerCase()
    }
  }

  const getSourceDomain = (value: string): string => {
    try {
      return new URL(value).hostname.replace(/^www\./, '').toLowerCase()
    } catch {
      return ''
    }
  }

  const getRejectedSourceFilters = () => {
    const { session } = getActiveSession()
    const rejectedUrls = session?.rejectedExternalSourceUrls || []
    const rejectedDomains = session?.rejectedExternalSourceDomains || []
    return {
      ...(rejectedUrls.length ? { rejectedUrls } : {}),
      ...(rejectedDomains.length ? { rejectedDomains } : {}),
    }
  }

  const classifyQuestionIntent = (
    question: string,
  ):
    | 'conversational_smalltalk'
    | 'recall_previous_chat'
    | 'study_guide_question' => {
    const normalized = question
      .trim()
      .toLowerCase()
      .replace(/[!?.,]+$/g, '')
      .replace(/\s+/g, ' ')
    if (
      normalized.length <= 60 &&
      (SMALLTALK_PATTERN.test(normalized) ||
        SMALLTALK_HINT_PATTERN.test(normalized))
    ) {
      return 'conversational_smalltalk'
    }

    if (RECALL_PATTERN.test(normalized)) {
      return 'recall_previous_chat'
    }

    return 'study_guide_question'
  }

  const isUsefulAssistantAnswer = (message: DashboardChatMessage): boolean =>
    message.role === 'assistant' &&
    !message.pending &&
    message.content.trim().length > 0 &&
    message.webLookup?.status !== 'searching' &&
    message.webLookup?.status !== 'failed' &&
    !/^The Study Guide does not contain enough info/i.test(message.content) &&
    !/^I could not find a reliable web source/i.test(message.content) &&
    !/^The provided .*do not contain/i.test(message.content)

  const answerSmalltalk = (question: string): string => {
    if (/^(?:cool|nice|great|ok|okay)$/i.test(question.trim())) {
      return t('chat.smalltalkGotIt')
    }

    if (/what can you do/i.test(question)) {
      return t('chat.smalltalkCapabilities')
    }

    if (/thank|thx|ty|tank\s+yuo/i.test(question)) {
      return t('chat.smalltalkThanks')
    }

    if (/how\s+(?:are|r)?\s*you|how you/i.test(question)) {
      return t('chat.smalltalkAllGood')
    }

    if (/say\s+hi.*twice/i.test(question)) {
      return t('chat.smalltalkHiTwice')
    }

    return t('chat.smalltalkDefault')
  }

  const summarizeExternalSource = (source: DashboardExternalSource): string =>
    `${source.title}: ${source.summary || source.text.slice(0, 360)}`

  const extractCoveredEntities = (value: string): string[] =>
    extractQuestionTerms(value)
      .filter((term) => term.length > 2)
      .slice(0, 12)

  const updateExternalSourcesUsedInAnswer = (sourceIds: string[]) => {
    if (sourceIds.length === 0) {
      return
    }

    const sourceIdSet = new Set(sourceIds)
    updateActiveChatExternalSources((externalSources) =>
      externalSources.map((source) =>
        sourceIdSet.has(source.id)
          ? {
              ...source,
              normalizedUrl:
                source.normalizedUrl || normalizeSourceUrlForDedupe(source.url),
              domain: source.domain || getSourceDomain(source.url),
              summary: source.summary || source.text.slice(0, 500),
              coveredEntities:
                source.coveredEntities ||
                extractCoveredEntities(`${source.title} ${source.text}`),
              usedInAnswer: true,
            }
          : source,
      ),
    )
  }

  const rememberFinalAnswer = ({
    userQuestion,
    finalAssistantAnswer,
    usedSourceIds,
  }: {
    userQuestion: string
    finalAssistantAnswer: string
    usedSourceIds: string[]
  }) => {
    if (!finalAssistantAnswer.trim()) {
      return
    }

    const { currentSessions, sessionId, session } = getActiveSession()
    const sources = session?.externalSources || []
    const sourceSummaries = usedSourceIds
      .map((sourceId) => sources.find((source) => source.id === sourceId))
      .filter((source): source is DashboardExternalSource => Boolean(source))
      .map(summarizeExternalSource)
    const memoryItem: ChatMemoryItem = {
      userQuestion,
      finalAssistantAnswer,
      coveredEntities: extractCoveredEntities(
        `${userQuestion} ${finalAssistantAnswer} ${sourceSummaries.join(' ')}`,
      ),
      usedSourceIds,
      sourceSummaries,
      createdAt: new Date().toISOString(),
    }
    const nextSessions = currentSessions.map((currentSession) =>
      currentSession.id === sessionId
        ? {
            ...currentSession,
            memoryItems: [
              memoryItem,
              ...(currentSession.memoryItems || []),
            ].slice(0, 24),
            updatedAt: Date.now(),
          }
        : currentSession,
    )
    persistChatSessions(nextSessions)
    updateExternalSourcesUsedInAnswer(usedSourceIds)
  }

  const expandQuestionWithChatContext = (
    question: string,
    historyMessages: DashboardChatMessage[],
  ): string => {
    const sourceSupportFollowUp = SOURCE_SUPPORT_FOLLOWUP_PATTERN.test(question)
    const latestUserQuestion = [...historyMessages]
      .reverse()
      .find(
        (message) =>
          message.role === 'user' &&
          (!sourceSupportFollowUp ||
            !SOURCE_SUPPORT_FOLLOWUP_PATTERN.test(message.content)),
      )?.content
    const previousAssistant = [...historyMessages]
      .reverse()
      .find((message) => message.role === 'assistant')

    if (sourceSupportFollowUp && previousAssistant) {
      const answerTerms = extractQuestionTerms(previousAssistant.content).slice(
        0,
        12,
      )
      return Array.from(
        new Set([latestUserQuestion || '', ...answerTerms, question]),
      )
        .filter(Boolean)
        .join(' ')
    }

    const followUp =
      /\bwhat about\b|\bhow about\b|\bthey\b|\bthose\b|\bthem\b|\bit\b/i.test(
        question,
      )
    if (!followUp) {
      return question
    }

    const priorTerms = previousAssistant
      ? extractQuestionTerms(previousAssistant.content)
          .filter((term) => contextTextContains(term))
          .slice(0, 6)
      : []

    return Array.from(new Set([...priorTerms, question])).join(' ')
  }

  const extractQuestionTerms = (value: string): string[] =>
    Array.from(
      new Set(
        (value.match(/[a-z0-9][a-z0-9.+#-]*/gi) || [])
          .map((term) => term.toLowerCase())
          .filter(
            (term) => term.length > 1 && !QUESTION_TERM_STOPWORDS.has(term),
          ),
      ),
    )

  const contextTextContains = (term: string): boolean =>
    context.chunks.some((chunk) =>
      `${chunk.title} ${chunk.text}`.toLowerCase().includes(term),
    )

  const scoreExternalSource = (
    source: DashboardExternalSource,
    question: string,
  ): number => {
    const terms = question
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((term) => term.length > 2)
    const haystack = `${source.title} ${source.text}`.toLowerCase()

    return terms.reduce(
      (score, term) => score + (haystack.includes(term) ? 1 : 0),
      0,
    )
  }

  const selectStoredExternalSources = (
    question: string,
    externalSourceIds: string[] = [],
  ): DashboardExternalSource[] => {
    const { session } = getActiveSession()
    const sessionExternalSources = session?.externalSources || []
    const rejectedUrls = new Set(session?.rejectedExternalSourceUrls || [])
    const rejectedDomains = new Set(
      session?.rejectedExternalSourceDomains || [],
    )
    const availableExternalSources = sessionExternalSources.filter((source) => {
      const normalizedUrl = normalizeSourceUrlForDedupe(source.url)
      const domain = getSourceDomain(source.url)
      return !rejectedUrls.has(normalizedUrl) && !rejectedDomains.has(domain)
    })

    if (externalSourceIds.length > 0) {
      return availableExternalSources.filter((source) =>
        externalSourceIds.includes(source.id),
      )
    }

    let selectedUserSourceCount = 0

    return availableExternalSources
      .map((source) => ({
        source,
        score: scoreExternalSource(source, question),
      }))
      .filter(({ source, score }) => score > 0 || isUserAddedSource(source))
      .sort((left, right) => right.score - left.score)
      .map(({ source }) => source)
      .filter((source) => {
        if (!isUserAddedSource(source)) {
          return true
        }

        selectedUserSourceCount += 1
        return selectedUserSourceCount <= MAX_USER_SOURCES_PER_ANSWER
      })
      .slice(0, 3)
  }

  const scoreTextForQuestion = (text: string, question: string): number => {
    const terms = extractQuestionTerms(question)
    const haystack = text.toLowerCase()
    return terms.reduce(
      (score, term) => score + (haystack.includes(term) ? 1 : 0),
      0,
    )
  }

  const findRecallAnswer = (
    question: string,
    historyMessages: DashboardChatMessage[],
  ): string | null => {
    const { session } = getActiveSession()
    const terms = extractQuestionTerms(question)
    if (terms.length === 0) {
      return null
    }

    const memoryMatch = (session?.memoryItems || [])
      .map((item) => ({
        item,
        score: scoreTextForQuestion(
          `${item.userQuestion} ${
            item.finalAssistantAnswer
          } ${item.coveredEntities.join(' ')} ${item.sourceSummaries.join(
            ' ',
          )}`,
          question,
        ),
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)[0]

    if (memoryMatch) {
      return `Earlier, I said: ${memoryMatch.item.finalAssistantAnswer}`
    }

    const answerMatch = [...historyMessages]
      .reverse()
      .filter(isUsefulAssistantAnswer)
      .map((message) => ({
        message,
        score: scoreTextForQuestion(message.content, question),
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)[0]

    if (answerMatch) {
      return `Earlier, I said: ${answerMatch.message.content}`
    }

    const sourceMatch = selectStoredExternalSources(question)[0]
    if (sourceMatch && scoreExternalSource(sourceMatch, question) > 0) {
      return `${sourceMatch.title}: ${
        sourceMatch.summary || sourceMatch.text.slice(0, 700)
      }`
    }

    if (
      /\bwhat did you say\b|\bearlier\b|\brepeat\b|\bremind me\b/i.test(
        question,
      )
    ) {
      const latestMemory = session?.memoryItems?.[0]
      if (latestMemory) {
        return `Earlier, I said: ${latestMemory.finalAssistantAnswer}`
      }

      const latestAnswer = [...historyMessages]
        .reverse()
        .find(isUsefulAssistantAnswer)
      if (latestAnswer) {
        return `Earlier, I said: ${latestAnswer.content}`
      }
    }

    return null
  }

  const usefulHistoryForPrompt = (
    historyMessages: DashboardChatMessage[],
  ): Array<{ role: 'user' | 'assistant'; content: string }> =>
    historyMessages
      .filter(
        (message) =>
          message.role === 'user' || isUsefulAssistantAnswer(message),
      )
      .slice(-8)
      .map(({ role, content }) => ({ role, content }))

  const selectAnswerSourceChunks = (
    question: string,
    externalSourceIds: string[] = [],
    allowedSources: DashboardChatSourceId[] = ['study-guide', 'general'],
  ): {
    sourceChunks: DashboardSourceChunk[]
    selectedExternalSourceIds: string[]
  } => {
    const allowStudyGuide = allowedSources.includes('study-guide')
    const allowWeb = allowedSources.includes('web')
    const dashboardChunks = allowStudyGuide
      ? selectDashboardChatChunks(context, question)
      : []
    const selectedExternalSources = selectStoredExternalSources(
      question,
      externalSourceIds,
    ).filter((source) => {
      if (isUserAddedSource(source)) {
        return allowStudyGuide
      }

      return allowWeb
    })
    let remainingUserSourceChars = MAX_USER_SOURCE_CONTEXT_CHARS
    const externalChunks = selectedExternalSources
      .map((source): DashboardExternalSource | null => {
        if (!isUserAddedSource(source)) {
          return source
        }

        if (remainingUserSourceChars <= 0) {
          return null
        }

        const text = source.text.slice(
          0,
          Math.min(MAX_USER_SOURCE_TEXT_CHARS, remainingUserSourceChars),
        )
        remainingUserSourceChars -= text.length
        return { ...source, text }
      })
      .filter((source): source is DashboardExternalSource => Boolean(source))
      .map(externalSourceToChunk)

    return {
      sourceChunks: [...dashboardChunks, ...externalChunks],
      selectedExternalSourceIds: externalChunks.map((chunk) => chunk.id),
    }
  }

  const withPromptBranchMetadata = (
    tail: DashboardChatMessage[],
    branchId: string,
    branchIndex: number,
    branchCount: number,
  ): DashboardChatMessage[] =>
    tail.map((message, index) =>
      index === 0 && message.role === 'user'
        ? {
            ...message,
            promptBranchId: branchId,
            promptBranchIndex: branchIndex,
            promptBranchCount: branchCount,
          }
        : message,
    )

  const syncCurrentBranchSnapshots = (
    nextMessages: DashboardChatMessage[],
    branchSnapshots?: Record<string, DashboardChatMessage[][]>,
  ) => {
    const nextBranchSnapshots = { ...(branchSnapshots || {}) }

    nextMessages.forEach((message, index) => {
      if (
        message.role !== 'user' ||
        !message.promptBranchId ||
        message.promptBranchIndex === undefined
      ) {
        return
      }

      const branches = nextBranchSnapshots[message.promptBranchId]
      if (!branches?.[message.promptBranchIndex]) {
        return
      }

      nextBranchSnapshots[message.promptBranchId] = branches.map(
        (branch, branchIndex) =>
          branchIndex === message.promptBranchIndex
            ? nextMessages.slice(index)
            : branch,
      )
    })

    return nextBranchSnapshots
  }

  const replaceActiveChatMessages = (
    nextMessages: DashboardChatMessage[],
    title?: string,
    options?: {
      branchSnapshots?: Record<string, DashboardChatMessage[][]>
      scrollToBottom?: boolean
    },
  ) => {
    const now = Date.now()
    const { currentSessions, sessionId, session } = getActiveSession()
    const branchSnapshots = syncCurrentBranchSnapshots(
      nextMessages,
      options?.branchSnapshots || session?.branchSnapshots,
    )
    const nextSessions = currentSessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            title:
              title ||
              (session.title === 'New chat' && nextMessages[0]?.role === 'user'
                ? titleFromQuestion(nextMessages[0].content)
                : session.title),
            messages: nextMessages,
            branchSnapshots,
            updatedAt: now,
          }
        : session,
    )
    persistChatSessions(nextSessions)
    messagesRef.current = nextMessages
    onMessagesChange(nextMessages)
    if (options?.scrollToBottom) {
      scrollChatToBottom()
    }
  }

  const startNewChat = () => {
    const nextSessions = normalizeChatSessions(chatSessionsRef.current)
    const emptySession = nextSessions[0]
    setActiveChatId(emptySession.id)
    persistChatSessions(nextSessions)
    messagesRef.current = emptySession.messages
    onMessagesChange(emptySession.messages)
    setChatMenuAnchor(null)
  }

  const selectChatSession = (session: DashboardChatSession) => {
    setActiveChatId(session.id)
    messagesRef.current = session.messages
    onMessagesChange(session.messages)
    setChatMenuAnchor(null)
  }

  const deleteChatSession = (sessionId: string) => {
    const remainingSessions = chatSessionsRef.current.filter(
      (session) => session.id !== sessionId,
    )
    const nextSessions =
      remainingSessions.length > 0
        ? remainingSessions
        : [createEmptyChatSession()]
    persistChatSessions(nextSessions)

    if (sessionId === activeChatId) {
      const nextActiveSession = nextSessions[0]
      setActiveChatId(nextActiveSession.id)
      messagesRef.current = nextActiveSession.messages
      onMessagesChange(nextActiveSession.messages)
    }
  }

  const selectAiChatPet = (petId: AiChatPetId) => {
    setActivePetId(petId)

    try {
      window.localStorage.setItem(AI_CHAT_PET_STORAGE_KEY, petId)
      window.dispatchEvent(new CustomEvent(AI_CHAT_PET_CHANGED_EVENT))
    } catch (storageError) {
      console.error('Failed to save dashboard chat pet', storageError)
    }
  }

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    if (messages.length === 0) {
      return
    }

    const scrollId = window.setTimeout(() => {
      chatScrollRef.current?.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'auto',
      })
    }, 0)

    return () => window.clearTimeout(scrollId)
  }, [activeChatId, messages.length])

  useEffect(() => {
    const refreshPet = () => {
      try {
        setActivePetId(
          resolveAiChatPetId(
            window.localStorage.getItem(AI_CHAT_PET_STORAGE_KEY),
          ),
        )
      } catch {
        setActivePetId(DEFAULT_AI_CHAT_PET_ID)
      }
    }

    window.addEventListener(AI_CHAT_PET_CHANGED_EVENT, refreshPet)
    window.addEventListener('storage', refreshPet)

    return () => {
      window.removeEventListener(AI_CHAT_PET_CHANGED_EVENT, refreshPet)
      window.removeEventListener('storage', refreshPet)
    }
  }, [])

  useEffect(() => {
    let nextSessions: DashboardChatSession[] = []
    try {
      const stored = window.localStorage.getItem(
        getChatSessionStorageKey(dashboard?.id),
      )
      const parsed = stored ? JSON.parse(stored) : []
      nextSessions = Array.isArray(parsed) ? parsed : []
    } catch (storageError) {
      console.error('Failed to read dashboard chat sessions', storageError)
    }

    nextSessions = normalizeChatSessions(nextSessions)
    chatSessionsRef.current = nextSessions
    setChatSessions(nextSessions)
    const activeSession =
      nextSessions.find((session) => !isEmptyChatSession(session)) ||
      nextSessions[0]
    setActiveChatId(activeSession.id)
    messagesRef.current = activeSession.messages
    onMessagesChange(activeSession.messages)
    persistChatSessions(nextSessions)
  }, [dashboard?.id])

  useEffect(() => {
    const hasPendingMessages = messages.some((message) => message.pending)
    const hasPendingQuickCreateTasks = pendingQuickCreateTasks.length > 0
    if (!hasPendingMessages && !hasPendingQuickCreateTasks) {
      return undefined
    }

    setTimerNow(Date.now())
    const interval = window.setInterval(() => {
      setTimerNow(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [messages, pendingQuickCreateTasks.length])

  useEffect(() => {
    measureDraftLines()
    if (draft.length === 0) {
      setChatComposerResized(false)
      setChatComposerHeight(MIN_RESIZED_CHAT_COMPOSER_HEIGHT)
    }
  }, [draft])

  useEffect(() => {
    const sourceRow = userSourceRowRef.current
    if (!sourceRow) {
      setSourceChipRowHeight(0)
      return undefined
    }

    const measureSourceRow = () => {
      setSourceChipRowHeight(
        Math.ceil(sourceRow.getBoundingClientRect().height),
      )
    }

    measureSourceRow()
    if (typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = new ResizeObserver(measureSourceRow)
    observer.observe(sourceRow)
    return () => observer.disconnect()
  }, [userAddedSources.length, pendingQuickCreateTasks.length])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = composerDragRef.current
      if (!dragState) {
        return
      }

      const panelHeight = panelRef.current?.clientHeight || 0
      const maxHeight = Math.max(160, Math.floor(panelHeight * 0.48))
      const nextHeight =
        dragState.startHeight + dragState.startY - event.clientY
      setChatComposerHeight(
        Math.min(
          Math.max(nextHeight, MIN_RESIZED_CHAT_COMPOSER_HEIGHT),
          maxHeight,
        ),
      )
    }

    const handlePointerUp = () => {
      if (!composerDragRef.current) {
        return
      }

      composerDragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  const updateMessage = (
    messageId: string,
    updater: (message: DashboardChatMessage) => DashboardChatMessage,
  ) => {
    const { currentSessions, sessionId, session } = getActiveSession()
    const activeMessageFound = messagesRef.current.some(
      ({ id }) => id === messageId,
    )
    const updatedMessages = activeMessageFound
      ? messagesRef.current.map((message) =>
          message.id === messageId ? updater(message) : message,
        )
      : messagesRef.current

    const nextBranchSnapshots = Object.fromEntries(
      Object.entries(session?.branchSnapshots || {}).map(
        ([branchId, branches]) => [
          branchId,
          branches.map((branch) =>
            branch.map((message) =>
              message.id === messageId ? updater(message) : message,
            ),
          ),
        ],
      ),
    )

    if (activeMessageFound) {
      replaceActiveChatMessages(updatedMessages, undefined, {
        branchSnapshots: nextBranchSnapshots,
      })
      return
    }

    const nextSessions = currentSessions.map((currentSession) =>
      currentSession.id === sessionId
        ? {
            ...currentSession,
            branchSnapshots: nextBranchSnapshots,
            updatedAt: Date.now(),
          }
        : currentSession,
    )
    persistChatSessions(nextSessions)
  }

  const findExternalSourceById = (
    sourceId: string,
  ): DashboardExternalSource | undefined => {
    const { session } = getActiveSession()
    return (session?.externalSources || []).find(
      (source) => source.id === sourceId,
    )
  }

  const enrichExternalSource = (
    source: DashboardExternalSource,
  ): DashboardExternalSource => ({
    ...source,
    normalizedUrl:
      source.normalizedUrl || normalizeSourceUrlForDedupe(source.url),
    domain: source.domain || getSourceDomain(source.url),
    summary: source.summary || source.text.slice(0, 500),
    coveredEntities:
      source.coveredEntities ||
      extractCoveredEntities(`${source.title} ${source.text}`),
    usedInAnswer: source.usedInAnswer || false,
  })

  const upsertExternalSource = (
    source: DashboardExternalSource,
  ): DashboardExternalSource => {
    const enrichedSource = enrichExternalSource(source)
    let savedSource = enrichedSource
    updateActiveChatExternalSources((externalSources) => {
      const normalizedUrl = normalizeSourceUrlForDedupe(enrichedSource.url)
      const existingSource = externalSources.find(
        (candidate) =>
          normalizeSourceUrlForDedupe(candidate.url) === normalizedUrl,
      )

      if (existingSource) {
        savedSource = existingSource
        return externalSources
      }

      return [enrichedSource, ...externalSources]
    })

    return savedSource
  }

  const upsertExternalSources = (
    sources: DashboardExternalSource[],
  ): DashboardExternalSource[] => sources.map(upsertExternalSource)

  const addUserAddedSource = (
    source: DashboardExternalSource,
  ): {
    savedSource?: DashboardExternalSource
    added: boolean
    limitReached: boolean
  } => {
    const enrichedSource = enrichExternalSource(source)
    let savedSource: DashboardExternalSource | undefined = enrichedSource
    let added = false
    let limitReached = false

    updateActiveChatExternalSources((externalSources) => {
      const normalizedUrl = normalizeSourceUrlForDedupe(enrichedSource.url)
      const existingSource = externalSources.find(
        (candidate) =>
          normalizeSourceUrlForDedupe(candidate.url) === normalizedUrl,
      )

      if (existingSource) {
        if (isUserAddedSource(existingSource)) {
          savedSource = existingSource
          return externalSources
        }

        const upgradedSource = {
          ...existingSource,
          ...enrichedSource,
          text: enrichedSource.text || existingSource.text,
          title: enrichedSource.title || existingSource.title,
          fetchedAt: enrichedSource.fetchedAt || existingSource.fetchedAt,
          usedInAnswer:
            existingSource.usedInAnswer || enrichedSource.usedInAnswer,
        }
        savedSource = upgradedSource
        added = true
        return externalSources.map((candidate) =>
          candidate.id === existingSource.id ? upgradedSource : candidate,
        )
      }

      if (
        externalSources.filter(isUserAddedSource).length >=
        MAX_USER_ADDED_SOURCES
      ) {
        limitReached = true
        savedSource = undefined
        return externalSources
      }

      added = true
      return [enrichedSource, ...externalSources]
    })

    return { savedSource, added, limitReached }
  }

  const removeUserAddedSource = (sourceId: string) => {
    updateActiveChatExternalSources((externalSources) =>
      externalSources.filter((source) => source.id !== sourceId),
    )
  }

  const focusUserSourceChip = (sourceId: string) => {
    const chip = userSourceChipRefs.current.get(sourceId)
    if (!chip) {
      return
    }

    chip.scrollIntoView({ block: 'center', behavior: 'smooth' })
    window.setTimeout(() => chip.focus(), 160)
  }

  const resetAddSourceDialog = () => {
    setAddSourceText('')
    setAddSourceUrl('')
    setAddSourceError('')
    setAddSourceNotice('')
    setAddSourceLoading(false)
  }

  const openAddSourceDialog = () => {
    resetAddSourceDialog()
    setAddSourceDialogOpen(true)
  }

  const closeAddSourceDialog = () => {
    if (addSourceLoading) {
      return
    }

    setAddSourceDialogOpen(false)
    setPasteSourceDialogOpen(false)
    resetAddSourceDialog()
  }

  const openPasteSourceDialog = () => {
    setAddSourceText('')
    setAddSourceError('')
    setAddSourceNotice('')
    setPasteSourceDialogOpen(true)
  }

  const closePasteSourceDialog = () => {
    if (addSourceLoading) {
      return
    }

    setPasteSourceDialogOpen(false)
    setAddSourceText('')
    setAddSourceError('')
  }

  const handleUserSourceResult = (
    result: ReturnType<typeof addUserAddedSource>,
    trimmed: boolean,
  ) => {
    if (result.limitReached) {
      setAddSourceError(
        `You can add up to ${MAX_USER_ADDED_SOURCES} sources per chat.`,
      )
      return
    }

    if (!result.savedSource) {
      setAddSourceError('Could not add this source.')
      return
    }

    setAddSourceNotice(
      trimmed
        ? 'Source was trimmed to fit chat limits.'
        : result.added
          ? 'Source added.'
          : 'Source already exists in this chat.',
    )
    setAddSourceDialogOpen(false)
    setPasteSourceDialogOpen(false)
    resetAddSourceDialog()
  }

  const addPastedTextSource = () => {
    const { text, trimmed } = truncateUserSourceText(addSourceText)
    const title = 'Pasted source'

    if (text.length < 20) {
      setAddSourceError('Add at least a few sentences of source text.')
      return
    }

    const sourceHash = hashSourceValue(text)
    const result = addUserAddedSource({
      id: `user-text-source-${sourceHash}`,
      url: `studymesh://user-source/${sourceHash}`,
      title,
      text,
      originType: 'user-text',
      trimmed,
      searchQuery: title,
      fetchedAt: Date.now(),
    })
    handleUserSourceResult(result, trimmed)
  }

  const addWebSource = async () => {
    let sourceUrl = addSourceUrl.trim()
    if (sourceUrl && !/^[a-z][a-z0-9+.-]*:\/\//i.test(sourceUrl)) {
      sourceUrl = `https://${sourceUrl}`
    }

    try {
      const parsedUrl = new URL(sourceUrl)
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Use an http or https URL.')
      }
    } catch {
      setAddSourceError('Enter a valid webpage URL.')
      return
    }

    setAddSourceLoading(true)
    setAddSourceError('')

    try {
      const [source] = await fetchDashboardExternalSource({
        url: sourceUrl,
        dashboardTitle: context.dashboardTitle,
      })
      if (!source) {
        throw new Error('Could not read this webpage source.')
      }
      const { text, trimmed } = truncateUserSourceText(source.text)
      const result = addUserAddedSource({
        ...source,
        title: source.title || sourceUrl,
        text,
        originType: 'user-web',
        trimmed: trimmed || source.trimmed,
        searchQuery: sourceUrl,
      })
      handleUserSourceResult(result, Boolean(trimmed || source.trimmed))
    } catch (addError) {
      setAddSourceError(
        addError instanceof Error
          ? addError.message
          : 'Could not add this webpage source.',
      )
    } finally {
      setAddSourceLoading(false)
    }
  }

  const addSourceFile = async (file: File): Promise<boolean> => {
    if (!isReadableUserSourceFile(file)) {
      setAddSourceError('Use a text, Markdown, CSV, JSON, HTML, or XML file.')
      return false
    }

    if (file.size > MAX_USER_SOURCE_FILE_BYTES) {
      setAddSourceError('Use a file under 1 MB.')
      return false
    }

    const { text, trimmed } = truncateUserSourceText(
      await readUserSourceFileText(file),
    )
    if (text.length < 20) {
      setAddSourceError('This file does not contain enough source text.')
      return false
    }

    const sourceHash = hashSourceValue(`${file.name}\n${text}`)
    const result = addUserAddedSource({
      id: `user-file-source-${sourceHash}`,
      url: `studymesh://user-source-file/${sourceHash}`,
      title: file.name,
      text,
      originType: 'user-text',
      trimmed,
      searchQuery: file.name,
      fetchedAt: Date.now(),
    })

    if (result.limitReached) {
      setAddSourceError(
        `You can add up to ${MAX_USER_ADDED_SOURCES} sources per chat.`,
      )
      return false
    }

    return Boolean(result.savedSource)
  }

  const addSourceFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files)
    if (fileList.length === 0) {
      return
    }

    setAddSourceLoading(true)
    setAddSourceError('')

    try {
      let addedAny = false
      for (const file of fileList) {
        const added = await addSourceFile(file)
        addedAny = addedAny || added
        if (!added) {
          break
        }
      }

      if (addedAny) {
        setAddSourceDialogOpen(false)
        resetAddSourceDialog()
      }
    } finally {
      setAddSourceLoading(false)
      if (sourceFileInputRef.current) {
        sourceFileInputRef.current.value = ''
      }
    }
  }

  const handleSourceFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (event.target.files) {
      void addSourceFiles(event.target.files)
    }
  }

  const openSourceFilePicker = () => {
    sourceFileInputRef.current?.click()
  }

  const updateExternalSourceDraftState = (
    sourceId: string,
    updater: (source: DashboardExternalSource) => DashboardExternalSource,
  ) => {
    updateActiveChatExternalSources((externalSources) =>
      externalSources.map((source) =>
        source.id === sourceId ? updater(source) : source,
      ),
    )
  }

  const prepareGuidePageDraftsForSources = (
    sourceIds: string[],
    question: string,
    answer: string,
  ) => {
    const uniqueSourceIds = Array.from(new Set(sourceIds))
    const sources = uniqueSourceIds
      .map(findExternalSourceById)
      .filter((source): source is DashboardExternalSource => Boolean(source))
      .filter((source) => !isUserAddedSource(source))
      .filter(
        (source) =>
          source.guidePageDraftStatus !== 'ready' &&
          source.guidePageDraftStatus !== 'pending',
      )

    if (sources.length === 0) {
      return
    }

    sources.forEach((source) => {
      updateExternalSourceDraftState(source.id, (current) => ({
        ...current,
        guidePageDraftStatus: 'pending',
        guidePageDraftError: undefined,
      }))
    })

    void (async () => {
      for (const source of sources) {
        try {
          const draft = await prepareDashboardExternalSourcePageDraft({
            source,
            question,
            dashboardTitle: context.dashboardTitle,
            answer,
            contentLanguage:
              dashboard?.contentLanguage ||
              dashboard?.studyPath?.contentLanguage,
          })
          updateExternalSourceDraftState(source.id, (current) => ({
            ...current,
            guidePageDraft: draft,
            guidePageDraftStatus: 'ready',
            guidePageDraftError: undefined,
          }))
        } catch (error) {
          updateExternalSourceDraftState(source.id, (current) => ({
            ...current,
            guidePageDraftStatus: 'failed',
            guidePageDraftError:
              error instanceof Error
                ? error.message
                : 'Could not prepare this source page.',
          }))
        }
      }
    })()
  }

  const buildExternalLookupContextSummary = (): string =>
    context.chunks
      .slice(0, 4)
      .map((chunk) => `${chunk.title}: ${chunk.text}`)
      .join('\n')
      .slice(0, 1200)

  const runExternalSourceLookup = async (
    question: string,
    messageId: string,
    historyMessages: DashboardChatMessage[],
    searchQuery?: string,
  ): Promise<string[]> => {
    const messageIndex = messagesRef.current.findIndex(
      (message) => message.id === messageId,
    )
    const liveHistoryMessages =
      messageIndex > 0
        ? messagesRef.current.slice(0, messageIndex)
        : messagesRef.current
    const lookupHistoryMessages =
      historyMessages.length > 0 ? historyMessages : liveHistoryMessages

    updateMessage(messageId, (message) => ({
      ...message,
      webLookup: { status: 'searching' },
    }))

    try {
      const lookupQuestion = expandQuestionWithChatContext(
        question,
        lookupHistoryMessages,
      )
      const sources = upsertExternalSources(
        await fetchDashboardExternalSource({
          question: lookupQuestion,
          dashboardTitle: context.dashboardTitle,
          ...(searchQuery?.trim() ? { searchQuery: searchQuery.trim() } : {}),
          contextSummary: buildExternalLookupContextSummary(),
          ...getRejectedSourceFilters(),
        }),
      )
      const sourceIds = Array.from(new Set(sources.map((source) => source.id)))

      updateMessage(messageId, (message) => ({
        ...message,
        webLookup: {
          status: 'found',
          sourceId: sourceIds[0],
          sourceIds,
        },
      }))
      return sourceIds
    } catch (err) {
      updateMessage(messageId, (message) => ({
        ...message,
        webLookup: {
          status: 'failed',
          error:
            err instanceof Error
              ? err.message
              : 'Could not find a useful web source.',
        },
      }))
      return []
    }
  }

  const updateLatestLookupDisplayedSources = (
    candidateSourceIds: string[],
    usedSourceIds: string[],
  ) => {
    if (candidateSourceIds.length === 0 || usedSourceIds.length === 0) {
      return
    }

    const candidateSet = new Set(candidateSourceIds)
    const filteredSourceIds = Array.from(
      new Set(usedSourceIds.filter((sourceId) => candidateSet.has(sourceId))),
    )
    if (filteredSourceIds.length === 0) {
      return
    }

    const lookupMessage = [...messagesRef.current]
      .reverse()
      .find(
        (message) =>
          message.role === 'assistant' &&
          message.webLookup?.status === 'found' &&
          (message.webLookup.sourceIds || []).some((sourceId) =>
            candidateSet.has(sourceId),
          ),
      )
    if (!lookupMessage) {
      return
    }

    updateMessage(lookupMessage.id, (message) => ({
      ...message,
      webLookup: {
        ...message.webLookup,
        status: 'found',
        sourceId: filteredSourceIds[0],
        sourceIds: filteredSourceIds,
      },
    }))
  }

  const resolveSourcePlan = async (
    question: string,
    historyMessages: DashboardChatMessage[],
    selectedSources: DashboardChatSourceId[],
    signal?: AbortSignal,
  ): Promise<DashboardChatSourcePlan> => {
    const fallbackPlan = fallbackDashboardChatSourcePlan(
      question,
      selectedSources,
    )

    if (selectedSources.length > 0 && !selectedSources.includes('web')) {
      return fallbackPlan
    }

    try {
      const plan = await planDashboardChatSources({
        question,
        dashboardTitle: context.dashboardTitle,
        contextSummary: buildExternalLookupContextSummary(),
        history: usefulHistoryForPrompt(historyMessages),
        selectedSources,
        contentLanguage:
          dashboard?.contentLanguage || dashboard?.studyPath?.contentLanguage,
        signal,
      })
      return {
        ...plan,
        shouldSearchWeb: selectedSources.includes('web')
          ? plan.selectedSources.includes('web')
          : plan.shouldSearchWeb && plan.selectedSources.includes('web'),
      }
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        throw error
      }

      return fallbackPlan
    }
  }

  const answerQuestion = async (
    question: string,
    pendingMessageId: string,
    historyMessages: DashboardChatMessage[],
    externalSourceIds: string[] = [],
    signal?: AbortSignal,
    options: { selectedSources?: DashboardChatSourceId[] } = {},
  ) => {
    const pendingMessageIndex = messagesRef.current.findIndex(
      (message) => message.id === pendingMessageId,
    )
    const liveHistoryMessages =
      pendingMessageIndex > 0
        ? messagesRef.current.slice(0, pendingMessageIndex)
        : messagesRef.current
    const effectiveHistoryMessages =
      historyMessages.length > 0 ? historyMessages : liveHistoryMessages

    try {
      const sourcePlan = await resolveSourcePlan(
        question,
        effectiveHistoryMessages,
        options.selectedSources ?? [],
        signal,
      )
      const lookupSourceIds =
        sourcePlan.shouldSearchWeb && externalSourceIds.length === 0
          ? await runExternalSourceLookup(
              question,
              pendingMessageId,
              effectiveHistoryMessages,
              sourcePlan.searchQuery,
            )
          : externalSourceIds
      const { sourceChunks, selectedExternalSourceIds } =
        selectAnswerSourceChunks(
          question,
          lookupSourceIds,
          sourcePlan.selectedSources,
        )
      const result = await askDashboardSources({
        dashboardTitle: context.dashboardTitle,
        contextText: formatDashboardChatContext(context, sourceChunks),
        question,
        history: usefulHistoryForPrompt(effectiveHistoryMessages),
        sourceChunks,
        allowedSources: sourcePlan.selectedSources,
        answerStyleHint: sourcePlan.answerStyleHint,
        exactAnswerCount: sourcePlan.exactAnswerCount,
        contentLanguage:
          dashboard?.contentLanguage || dashboard?.studyPath?.contentLanguage,
        signal,
      })
      const usedWebSourceIds = result.sourceRefs
        .filter((sourceRef) => sourceRef.origin === 'web')
        .map((sourceRef) => sourceRef.chunkId)
      updateMessage(pendingMessageId, (message) => ({
        ...message,
        content: result.answer,
        sourceRefs: result.sourceRefs,
        answerBasis: result.answerBasis,
        contextSupport: result.contextSupport,
        externalSourceIds: selectedExternalSourceIds,
        pending: false,
      }))
      updateLatestLookupDisplayedSources(lookupSourceIds, usedWebSourceIds)
      prepareGuidePageDraftsForSources(
        usedWebSourceIds,
        question,
        result.answer,
      )
      rememberFinalAnswer({
        userQuestion: question,
        finalAssistantAnswer: result.answer,
        usedSourceIds: usedWebSourceIds,
      })
    } catch (err) {
      if (isAbortError(err)) {
        updateMessage(pendingMessageId, (message) => ({
          ...message,
          pending: false,
        }))
        return
      }

      const failureMessage = getDashboardChatFailureMessage(err)
      updateMessage(pendingMessageId, (message) => ({
        ...message,
        content: failureMessage,
        pending: false,
      }))
      setError(
        err instanceof Error
          ? err.message
          : 'Could not answer from this dashboard.',
      )
    } finally {
      setReplyScrollBufferActive(
        messagesRef.current.some(
          (message) => message.pending && message.id !== pendingMessageId,
        ),
      )
    }
  }

  const sendQuestion = (question: string) => {
    const trimmed = question.trim()
    if (!trimmed) {
      return
    }

    if (handleSourceRejection(trimmed)) {
      return
    }

    const userMessage: DashboardChatMessage = {
      id: makeMessageId(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    }
    const pendingMessage: DashboardChatMessage = {
      id: makeMessageId(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      pending: true,
    }
    const previousMessages = messagesRef.current
    const nextMessages = [...previousMessages, userMessage, pendingMessage]
    setReplyScrollBufferActive(true)
    replaceActiveChatMessages(
      nextMessages,
      previousMessages.length === 0 ? titleFromQuestion(trimmed) : undefined,
      { scrollToBottom: true },
    )
    setDraft('')
    setError('')

    const intent = classifyQuestionIntent(trimmed)
    if (intent === 'conversational_smalltalk') {
      const answer = answerSmalltalk(trimmed)
      updateMessage(pendingMessage.id, (message) => ({
        ...message,
        content: answer,
        pending: false,
      }))
      rememberFinalAnswer({
        userQuestion: trimmed,
        finalAssistantAnswer: answer,
        usedSourceIds: [],
      })
      setReplyScrollBufferActive(false)
      return
    }

    if (intent === 'recall_previous_chat') {
      const recalledAnswer = findRecallAnswer(trimmed, previousMessages)
      if (recalledAnswer) {
        updateMessage(pendingMessage.id, (message) => ({
          ...message,
          content: recalledAnswer,
          pending: false,
        }))
        rememberFinalAnswer({
          userQuestion: trimmed,
          finalAssistantAnswer: recalledAnswer,
          usedSourceIds: [],
        })
        setReplyScrollBufferActive(false)
        return
      }
    }

    void answerQuestion(trimmed, pendingMessage.id, previousMessages)
  }

  const prefillDraft = (content: string) => {
    const trimmed = content.trim()
    if (!trimmed) {
      return
    }

    setDraft(trimmed)
    setError('')
  }

  useEffect(() => {
    const prefillFromEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ content?: unknown }>).detail
      if (typeof detail?.content !== 'string' || !detail.content.trim()) {
        return
      }

      prefillDraft(detail.content)
    }

    window.addEventListener(PREFILL_DASHBOARD_CHAT_EVENT, prefillFromEvent)

    return () => {
      window.removeEventListener(PREFILL_DASHBOARD_CHAT_EVENT, prefillFromEvent)
    }
  }, [])

  const lastQueuedDraftIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!queuedDraft || lastQueuedDraftIdRef.current === queuedDraft.id) {
      return
    }

    lastQueuedDraftIdRef.current = queuedDraft.id
    prefillDraft(queuedDraft.content)
    onQueuedDraftConsumed?.(queuedDraft.id)
  }, [queuedDraft])

  const findLastFoundExternalSource = (): {
    source?: DashboardExternalSource
    question?: string
  } => {
    const messages = messagesRef.current
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]
      const sourceId = message.webLookup?.sourceId
      if (message.role === 'assistant' && sourceId) {
        const previousUser = messages
          .slice(0, index)
          .reverse()
          .find((candidate) => candidate.role === 'user')
        return {
          source: findExternalSourceById(sourceId),
          question: previousUser?.content,
        }
      }
    }
    return {}
  }

  const handleSourceRejection = (content: string): boolean => {
    if (!SOURCE_REJECTION_PATTERN.test(content)) {
      return false
    }

    const { source, question } = findLastFoundExternalSource()
    if (!source || !question) {
      return false
    }

    updateActiveChatRejectedSources(source)
    const userMessage: DashboardChatMessage = {
      id: makeMessageId(),
      role: 'user',
      content,
      createdAt: Date.now(),
    }
    const pendingMessage: DashboardChatMessage = {
      id: makeMessageId(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      pending: true,
      webLookup: { status: 'searching' },
    }
    const previousMessages = messagesRef.current
    replaceActiveChatMessages(
      [...previousMessages, userMessage, pendingMessage],
      undefined,
      {
        scrollToBottom: true,
      },
    )
    setDraft('')
    setError('')
    void answerQuestion(
      question,
      pendingMessage.id,
      previousMessages,
      [],
      undefined,
      {
        selectedSources: ['study-guide', 'web'],
      },
    )
    return true
  }

  const copyUserPrompt = (content: string) => {
    void navigator.clipboard?.writeText(content)
  }

  const copyAssistantAnswer = (content: string) => {
    void navigator.clipboard?.writeText(content)
  }

  const requestExternalSourceOpen = (source: ExternalSourcePrompt) => {
    setExternalSourcePrompt(source)
  }

  const confirmExternalSourceOpen = () => {
    if (!externalSourcePrompt) {
      return
    }

    window.open(externalSourcePrompt.url, '_blank', 'noopener,noreferrer')
    setExternalSourcePrompt(null)
  }

  const openSource = (source: DashboardAnswerSourceRef) => {
    if (source.dashboardKey && onOpenSource) {
      onOpenSource(source)
      return
    }

    const sourceUrl = source.url
    if (sourceUrl && /^https?:\/\//i.test(sourceUrl)) {
      requestExternalSourceOpen({
        title: source.title || 'External source',
        url: sourceUrl,
      })
      return
    }

    onOpenSource?.(source)
  }

  const focusExternalSourceAddButton = (sourceId: string) => {
    const addButton = externalSourceAddButtonRefs.current.get(sourceId)
    if (!addButton) {
      return false
    }

    addButton.scrollIntoView({ block: 'center', behavior: 'smooth' })
    window.setTimeout(() => addButton.focus(), 200)
    return true
  }

  const openWebSourceInGuide = (sourceRef: DashboardAnswerSourceRef) => {
    const externalSource = findExternalSourceById(sourceRef.chunkId)
    if (!externalSource) {
      return
    }

    if (
      onAddExternalSourceToGuide &&
      externalSource.guidePageDraftStatus === 'ready'
    ) {
      onAddExternalSourceToGuide(externalSource)
      return
    }

    focusExternalSourceAddButton(externalSource.id)
  }

  const buildUserSourceGuideDraft = (
    source: DashboardExternalSource,
  ): DashboardExternalSource => {
    const title = source.title || 'AI Chat source'
    const text = normalizeUserSourceText(source.text)
    const markdown = [
      `# ${title}`,
      '',
      'Source added from AI Chat.',
      '',
      '## Content',
      '',
      text || 'No readable text was available for this source.',
    ].join('\n')

    return {
      ...source,
      guidePageDraftStatus: 'ready',
      guidePageDraft: {
        title,
        markdown,
        generatedAt: Date.now(),
      },
    }
  }

  const openUserSourceInGuide = (sourceRef: DashboardAnswerSourceRef) => {
    const externalSource = findExternalSourceById(sourceRef.chunkId)
    if (!externalSource) {
      return
    }

    if (onAddExternalSourceToGuide) {
      const sourceWithDraft = buildUserSourceGuideDraft(externalSource)
      updateExternalSourceDraftState(externalSource.id, () => sourceWithDraft)
      onAddExternalSourceToGuide(sourceWithDraft)
      return
    }

    focusUserSourceChip(externalSource.id)
  }

  const startEditingUserPrompt = (message: DashboardChatMessage) => {
    setEditingPromptId(message.id)
    setEditingPromptDraft(message.content)
  }

  const cancelEditingUserPrompt = () => {
    setEditingPromptId(null)
    setEditingPromptDraft('')
  }

  const saveEditedUserPromptBranch = (message: DashboardChatMessage) => {
    const trimmed = editingPromptDraft.trim()
    if (!trimmed) {
      return
    }

    const messageIndex = messagesRef.current.findIndex(
      ({ id }) => id === message.id,
    )
    if (messageIndex < 0) {
      return
    }

    const { session } = getActiveSession()
    const branchId = message.promptBranchId || message.id
    const existingBranches = session?.branchSnapshots?.[branchId]
    const currentBranchIndex = message.promptBranchIndex ?? 0
    const currentTail = messagesRef.current.slice(messageIndex)
    const baseBranches = existingBranches?.length
      ? existingBranches.map((branch, branchIndex) =>
          branchIndex === currentBranchIndex ? currentTail : branch,
        )
      : [currentTail]
    const nextBranchIndex = baseBranches.length
    const nextBranchCount = baseBranches.length + 1
    const normalizedBranches = baseBranches.map((branch, branchIndex) =>
      withPromptBranchMetadata(branch, branchId, branchIndex, nextBranchCount),
    )
    const editedUserMessage: DashboardChatMessage = {
      id: makeMessageId(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
      promptBranchId: branchId,
      promptBranchIndex: nextBranchIndex,
      promptBranchCount: nextBranchCount,
    }
    const pendingMessage: DashboardChatMessage = {
      id: makeMessageId(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      pending: true,
    }
    const nextTail = [editedUserMessage, pendingMessage]
    const branchSnapshots = {
      ...(session?.branchSnapshots || {}),
      [branchId]: [...normalizedBranches, nextTail],
    }
    const prefixMessages = messagesRef.current.slice(0, messageIndex)
    const nextMessages = [...prefixMessages, ...nextTail]
    setEditingPromptId(null)
    setEditingPromptDraft('')
    setError('')
    setReplyScrollBufferActive(true)
    replaceActiveChatMessages(nextMessages, undefined, {
      branchSnapshots,
      scrollToBottom: true,
    })
    void answerQuestion(trimmed, pendingMessage.id, prefixMessages)
  }

  const switchUserPromptBranch = (
    message: DashboardChatMessage,
    direction: -1 | 1,
  ) => {
    if (!message.promptBranchId || message.promptBranchIndex === undefined) {
      return
    }

    const messageIndex = messagesRef.current.findIndex(
      ({ id }) => id === message.id,
    )
    if (messageIndex < 0) {
      return
    }

    const { session } = getActiveSession()
    const branches = session?.branchSnapshots?.[message.promptBranchId]
    if (!branches?.length) {
      return
    }

    const nextBranchIndex =
      (message.promptBranchIndex + direction + branches.length) %
      branches.length
    const nextTail = withPromptBranchMetadata(
      branches[nextBranchIndex],
      message.promptBranchId,
      nextBranchIndex,
      branches.length,
    )
    const branchSnapshots = {
      ...(session?.branchSnapshots || {}),
      [message.promptBranchId]: branches.map((branch, branchIndex) =>
        branchIndex === nextBranchIndex ? nextTail : branch,
      ),
    }
    setEditingPromptId(null)
    setEditingPromptDraft('')
    setReplyScrollBufferActive(false)
    replaceActiveChatMessages(
      [...messagesRef.current.slice(0, messageIndex), ...nextTail],
      undefined,
      { branchSnapshots },
    )
  }

  const retryAssistantAnswer = (
    message: DashboardChatMessage,
    externalSourceIds: string[] = message.externalSourceIds || [],
  ) => {
    const messageIndex = messagesRef.current.findIndex(
      ({ id }) => id === message.id,
    )
    if (messageIndex < 0) {
      return
    }

    const userMessageIndex = messagesRef.current
      .slice(0, messageIndex)
      .map((candidate, index) => ({ candidate, index }))
      .reverse()
      .find(({ candidate }) => candidate.role === 'user')?.index
    if (userMessageIndex === undefined) {
      return
    }

    const userMessage = messagesRef.current[userMessageIndex]
    const { session } = getActiveSession()
    const branchId = userMessage.promptBranchId || userMessage.id
    const existingBranches = session?.branchSnapshots?.[branchId]
    const currentBranchIndex = userMessage.promptBranchIndex ?? 0
    const currentTail = messagesRef.current.slice(userMessageIndex)
    const baseBranches = existingBranches?.length
      ? existingBranches.map((branch, branchIndex) =>
          branchIndex === currentBranchIndex ? currentTail : branch,
        )
      : [currentTail]
    const nextBranchIndex = baseBranches.length
    const nextBranchCount = baseBranches.length + 1
    const normalizedBranches = baseBranches.map((branch, branchIndex) =>
      withPromptBranchMetadata(branch, branchId, branchIndex, nextBranchCount),
    )
    const retryUserMessage: DashboardChatMessage = {
      ...userMessage,
      id: makeMessageId(),
      createdAt: Date.now(),
      externalSourceIds,
      promptBranchId: branchId,
      promptBranchIndex: nextBranchIndex,
      promptBranchCount: nextBranchCount,
    }
    const pendingMessage: DashboardChatMessage = {
      id: makeMessageId(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      pending: true,
    }
    const nextTail = [retryUserMessage, pendingMessage]
    const branchSnapshots = {
      ...(session?.branchSnapshots || {}),
      [branchId]: [...normalizedBranches, nextTail],
    }
    const prefixMessages = messagesRef.current.slice(0, userMessageIndex)
    setError('')
    setReplyScrollBufferActive(true)
    replaceActiveChatMessages([...prefixMessages, ...nextTail], undefined, {
      branchSnapshots,
      scrollToBottom: true,
    })
    void answerQuestion(
      retryUserMessage.content,
      pendingMessage.id,
      prefixMessages,
      externalSourceIds,
    )
  }

  const runQuickCreate = async (action: DashboardChatQuickCreateAction) => {
    if (!onQuickCreatePage) {
      return
    }

    const controller = new AbortController()
    const taskId = `quick-create-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`
    const request: QuickCreateActionRequest = {
      actionId: action.id,
      resourceType: action.resourceType,
      label: action.label,
      ...(supportsStudyGuideCreateScope
        ? { sourceScope: quickCreateSourceScope }
        : {}),
    }
    const task: PendingQuickCreateTask = {
      id: taskId,
      actionId: action.id,
      resourceType: action.resourceType,
      label: action.label,
      sourceScope: request.sourceScope,
      startedAt: Date.now(),
      estimateSeconds: getQuickCreateEstimateSeconds(action.id),
    }

    setError('')
    quickCreateAbortControllersRef.current.set(taskId, controller)
    setPendingQuickCreateTasks((current) => [...current, task])
    setQuickCreateMenuAnchor(null)
    setQuickCreateSearch('')
    try {
      await onQuickCreatePage(request, { signal: controller.signal })
    } catch (err) {
      if (isAbortError(err) || controller.signal.aborted) {
        return
      }

      setError(
        err instanceof Error ? err.message : 'Could not create this page.',
      )
    } finally {
      quickCreateAbortControllersRef.current.delete(taskId)
      setPendingQuickCreateTasks((current) =>
        current.filter((candidate) => candidate.id !== taskId),
      )
    }
  }

  const cancelQuickCreateTask = (taskId: string) => {
    quickCreateAbortControllersRef.current.get(taskId)?.abort()
    quickCreateAbortControllersRef.current.delete(taskId)
    setPendingQuickCreateTasks((current) =>
      current.filter((task) => task.id !== taskId),
    )
  }

  const formatSeconds = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return minutes > 0
      ? `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
      : `${remainingSeconds}s`
  }

  const getElapsedSeconds = (startedAt: number) =>
    Math.max(0, Math.floor((timerNow - startedAt) / 1000))

  const quickCreateMenuOpen = Boolean(quickCreateMenuAnchor)
  const chatMenuOpen = Boolean(chatMenuAnchor)
  const showQuickCreateSearch = dashboardChatQuickCreateActions.length > 5
  const normalizedQuickCreateSearch = quickCreateSearch.trim().toLowerCase()
  const filteredQuickCreateActions = normalizedQuickCreateSearch
    ? dashboardChatQuickCreateActions.filter((action) =>
        [
          action.label,
          action.shortLabel,
          action.description,
          action.group,
          t(getQuickCreateActionLabelKey(action.id)),
          t(getQuickCreateActionDescriptionKey(action.id)),
          t(getQuickCreateGroupLabelKey(action.group)),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuickCreateSearch),
      )
    : dashboardChatQuickCreateActions
  const renderQuickCreateMenuContent = () => (
    <Box
      sx={{
        width: isMobile ? '100%' : 340,
        maxWidth: '100%',
        p: 1.25,
      }}
    >
      <Stack spacing={1}>
        <Box sx={{ px: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            {supportsStudyGuideCreateScope
              ? quickCreateSourceScope === 'studyGuide'
                ? t('chat.createFromStudyGuideSource')
                : t('chat.createFromCurrentPage')
              : t('chat.createFromThisPage')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {supportsStudyGuideCreateScope
              ? quickCreateSourceScope === 'studyGuide'
                ? t('chat.usesStudyGuideSource')
                : t('chat.usesCurrentPageOnly')
              : t('chat.generateFromCurrentDashboard')}
          </Typography>
        </Box>
        {supportsStudyGuideCreateScope ? (
          <ToggleButtonGroup
            value={quickCreateSourceScope}
            exclusive
            fullWidth
            size="small"
            onChange={(_, value: QuickCreateSourceScope | null) => {
              if (value) {
                setQuickCreateSourceScope(value)
              }
            }}
            aria-label={t('chat.quickCreateSourceScope')}
          >
            <ToggleButton value="studyGuide">
              {t('chat.studyGuideSource')}
            </ToggleButton>
            <ToggleButton value="currentPage">
              {t('chat.currentPageSource')}
            </ToggleButton>
          </ToggleButtonGroup>
        ) : null}
        {showQuickCreateSearch ? (
          <TextField
            value={quickCreateSearch}
            onChange={(event) => setQuickCreateSearch(event.target.value)}
            placeholder={t('chat.findCreationAction')}
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        ) : null}
        {quickCreateActionGroups.map((group) => {
          const actions = filteredQuickCreateActions.filter(
            (action) => action.group === group,
          )
          if (actions.length === 0) {
            return null
          }

          return (
            <Stack key={group} spacing={0.5}>
              <Divider textAlign="left">
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={600}
                >
                  {t(getQuickCreateGroupLabelKey(group))}
                </Typography>
              </Divider>
              {actions.map((action) => {
                return (
                  <Button
                    key={action.id}
                    fullWidth
                    aria-label={t(getQuickCreateActionLabelKey(action.id))}
                    variant="text"
                    disabled={!hasContext}
                    onClick={() => void runQuickCreate(action)}
                    sx={{
                      justifyContent: 'flex-start',
                      alignItems: 'flex-start',
                      gap: 1,
                      minHeight: 64,
                      borderRadius: 1.5,
                      px: 1,
                      py: 1,
                      textAlign: 'left',
                      textTransform: 'none',
                      color: 'text.primary',
                    }}
                  >
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: 1.25,
                        flex: '0 0 auto',
                        display: 'grid',
                        placeItems: 'center',
                        color: accentColor.main,
                        bgcolor: alpha(accentColor.main, 0.12),
                      }}
                      data-testid={`quick-create-action-icon-${action.id}`}
                    >
                      {quickCreateIcons[action.id]}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ minWidth: 0 }}
                      >
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          noWrap
                          sx={{ minWidth: 0 }}
                        >
                          {t(getQuickCreateActionLabelKey(action.id))}
                        </Typography>
                        {isHostedAi ? (
                          <StudyCreditCostLabel
                            amount={quickCreateCreditCost}
                            variant="badge"
                          />
                        ) : null}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {t(getQuickCreateActionDescriptionKey(action.id))}
                      </Typography>
                    </Box>
                  </Button>
                )
              })}
            </Stack>
          )
        })}
      </Stack>
    </Box>
  )

  const inferAnswerBasis = (
    message: DashboardChatMessage,
  ): DashboardAnswerBasis[] => {
    if (message.answerBasis?.length) {
      return message.answerBasis
    }

    const basis = new Set<DashboardAnswerBasis>()
    ;(message.sourceRefs || []).forEach((sourceRef) => {
      if (sourceRef.origin === 'web') {
        basis.add(
          sourceRef.originType === 'user-text' ||
            sourceRef.originType === 'user-web'
            ? 'added-source'
            : 'web',
        )
        return
      }

      basis.add('study-guide')
    })

    return Array.from(basis)
  }

  const getAnswerBasisLabelKey = (basis: DashboardAnswerBasis) => {
    switch (basis) {
      case 'study-guide':
        return 'chat.basisStudyGuide'
      case 'added-source':
        return 'chat.basisAddedSource'
      case 'web':
        return 'chat.basisWeb'
      case 'general':
        return 'chat.basisGeneral'
    }
  }

  const renderAnswerBasisBadges = (message: DashboardChatMessage) => {
    const basis = inferAnswerBasis(message)
    if (basis.length === 0) {
      return null
    }

    return (
      <Stack
        direction="row"
        spacing={0.5}
        flexWrap="wrap"
        useFlexGap
        sx={{ mb: 0.75 }}
      >
        {basis.map((item) => (
          <Box
            key={item}
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 22,
              px: 0.75,
              borderRadius: 1,
              border: 1,
              borderColor:
                item === 'general'
                  ? alpha(theme.palette.warning.main, 0.34)
                  : alpha(theme.palette.primary.main, 0.28),
              bgcolor:
                item === 'general'
                  ? alpha(theme.palette.warning.main, 0.08)
                  : alpha(theme.palette.primary.main, 0.07),
              color: 'text.secondary',
              fontSize: '0.7rem',
              fontWeight: 700,
              lineHeight: 1.2,
            }}
          >
            {t(getAnswerBasisLabelKey(item))}
          </Box>
        ))}
      </Stack>
    )
  }

  const renderCitation = (message: DashboardChatMessage) => {
    const sourceRefs = message.sourceRefs || []

    return (citationNumber: number, key: string) => {
      const source = sourceRefs.find(
        (candidate) => candidate.citationNumber === citationNumber,
      )
      if (!source) {
        return `[${citationNumber}]`
      }

      const isWebSource = source.origin === 'web'
      const isUserAddedCitation = isUserAddedSourceOriginType(source.originType)

      return (
        <Box
          key={key}
          component="button"
          type="button"
          aria-label={
            isWebSource
              ? isUserAddedCitation
                ? source.originType === 'user-web'
                  ? `Open added source ${citationNumber}`
                  : `Add source as page ${citationNumber}`
                : `Open web source ${citationNumber}`
              : `Open source ${citationNumber}`
          }
          onClick={(event) => {
            event.stopPropagation()
            if (source.originType === 'user-text') {
              openUserSourceInGuide(source)
            } else if (source.originType === 'user-web') {
              openSource(source)
            } else if (isWebSource && !isUserAddedCitation) {
              openWebSourceInGuide(source)
            } else {
              openSource(source)
            }
          }}
          sx={{
            mx: 0.25,
            minWidth: 22,
            height: 22,
            borderRadius: '50%',
            border: 1,
            borderStyle: isWebSource ? 'dashed' : 'solid',
            borderColor: alpha(theme.palette.primary.main, 0.35),
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            color: 'primary.main',
            cursor: 'pointer',
            fontSize: '0.72rem',
            fontWeight: 700,
            lineHeight: '20px',
            p: 0,
            verticalAlign: 'baseline',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: alpha(theme.palette.primary.main, 0.16),
            },
          }}
        >
          {citationNumber}
        </Box>
      )
    }
  }

  const renderWebLookupStatus = (message: DashboardChatMessage) => {
    if (!message.webLookup) {
      return null
    }

    const sources = (
      message.webLookup.sourceIds ||
      (message.webLookup.sourceId ? [message.webLookup.sourceId] : [])
    )
      .map(findExternalSourceById)
      .filter((source): source is DashboardExternalSource => Boolean(source))
    const citedWebSourceIds = new Set(
      (message.sourceRefs || [])
        .filter(
          (sourceRef) =>
            sourceRef.origin === 'web' &&
            !isUserAddedSourceOriginType(sourceRef.originType),
        )
        .map((sourceRef) => sourceRef.chunkId),
    )
    const hasCitedWebSource = citedWebSourceIds.size > 0

    const sourceDomain = (source: DashboardExternalSource) => {
      try {
        return new URL(source.url).hostname.replace(/^www\./, '')
      } catch {
        return source.url
      }
    }
    const addSourceLabel = (source: DashboardExternalSource) => {
      if (source.guidePageDraftStatus === 'ready') {
        return t('chat.addThisSource')
      }

      if (source.guidePageDraftStatus === 'failed') {
        return t('chat.retryPreparingPage')
      }

      return t('chat.preparingPage')
    }

    return (
      <Box
        sx={{
          mt: 1,
          ml: isPhone ? 5 : 6,
          p: 1,
          border: 1,
          borderColor:
            message.webLookup.status === 'failed' ? 'error.light' : 'divider',
          borderRadius: 1,
          bgcolor:
            message.webLookup.status === 'failed'
              ? alpha(theme.palette.error.main, 0.06)
              : 'background.paper',
        }}
      >
        {message.webLookup.status === 'searching' ? (
          <Typography variant="caption" color="text.secondary">
            {t('chat.searchingWebShort')}
          </Typography>
        ) : message.webLookup.status === 'failed' ? (
          <Typography variant="caption" color="error.main">
            {message.webLookup.error || t('chat.webSearchFailed')}
          </Typography>
        ) : sources.length > 0 ? (
          <Stack spacing={0.75}>
            <Box>
              <Typography variant="caption" fontWeight={700}>
                {!hasCitedWebSource
                  ? t('chat.webSearchedNoCitedSource')
                  : sources.length === 1
                    ? t('chat.foundSource')
                    : t('chat.foundSources')}
              </Typography>
              <Stack spacing={0.5} sx={{ mt: 0.25 }}>
                {sources.map((source) => (
                  <Box
                    key={source.id}
                    sx={{
                      pb: 0.75,
                      '&:last-child': { pb: 0 },
                    }}
                  >
                    <Box
                      component="button"
                      type="button"
                      onClick={() =>
                        requestExternalSourceOpen({
                          title: source.title || 'External source',
                          url: source.url,
                        })
                      }
                      aria-label={`${t('chat.openSource')}: ${source.title}`}
                      sx={{
                        display: 'block',
                        width: '100%',
                        border: 0,
                        p: 0,
                        bgcolor: 'transparent',
                        color: 'primary.main',
                        cursor: 'pointer',
                        font: 'inherit',
                        fontWeight: 600,
                        textAlign: 'left',
                        overflowWrap: 'anywhere',
                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      {source.title}
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block' }}
                    >
                      {sourceDomain(source)}
                    </Typography>
                    {onAddExternalSourceToGuide &&
                    citedWebSourceIds.has(source.id) ? (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddCircleOutlineIcon fontSize="small" />}
                        aria-label={`${t('chat.addThisSource')}: ${source.title}`}
                        ref={(node) => {
                          if (node) {
                            externalSourceAddButtonRefs.current.set(
                              source.id,
                              node,
                            )
                          } else {
                            externalSourceAddButtonRefs.current.delete(
                              source.id,
                            )
                          }
                        }}
                        disabled={source.guidePageDraftStatus === 'pending'}
                        onClick={() => {
                          if (source.guidePageDraftStatus === 'ready') {
                            onAddExternalSourceToGuide(source)
                            return
                          }

                          if (source.guidePageDraftStatus === 'failed') {
                            prepareGuidePageDraftsForSources(
                              [source.id],
                              source.searchQuery,
                              message.content,
                            )
                          }
                        }}
                        sx={{
                          display: 'flex',
                          mt: 0.75,
                          minHeight: 30,
                          borderRadius: 1,
                          textTransform: 'none',
                        }}
                      >
                        {addSourceLabel(source)}
                      </Button>
                    ) : null}
                    {source.guidePageDraftStatus === 'failed' &&
                    source.guidePageDraftError ? (
                      <Typography
                        variant="caption"
                        color="error.main"
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        {source.guidePageDraftError}
                      </Typography>
                    ) : null}
                    {!citedWebSourceIds.has(source.id) &&
                    message.webLookup?.status === 'found' ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        {t('chat.sourceNotUsedInAnswer')}
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            </Box>
          </Stack>
        ) : null}
      </Box>
    )
  }

  const renderAssistantActions = (message: DashboardChatMessage) => {
    const canAddToGuide = Boolean(onAddAssistantMessageToGuide)

    const actions = (
      <>
        <Tooltip title={t('chat.copyAnswer')}>
          <IconButton
            size="small"
            aria-label={t('chat.copyAnswer')}
            onClick={(event) => {
              event.stopPropagation()
              copyAssistantAnswer(message.content)
            }}
            sx={userActionIconButtonSx}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('chat.retryAnswer')}>
          <IconButton
            size="small"
            aria-label={t('chat.retryAnswer')}
            onClick={(event) => {
              event.stopPropagation()
              retryAssistantAnswer(message)
            }}
            sx={userActionIconButtonSx}
          >
            <ReplayIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {canAddToGuide ? (
          <Tooltip title={t('chat.addToStudyGuide')}>
            <IconButton
              size="small"
              aria-label={t('chat.addAnswerToStudyGuide')}
              onClick={(event) => {
                event.stopPropagation()
                onAddAssistantMessageToGuide?.(message)
              }}
              sx={userActionIconButtonSx}
            >
              <AddCircleOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
      </>
    )

    if (isMobile) {
      return (
        <Stack
          direction="row"
          spacing={0.35}
          alignItems="center"
          sx={{
            ml: isPhone ? 5 : 6,
            mt: 0.35,
            p: 0.25,
            borderRadius: 1,
          }}
        >
          {actions}
        </Stack>
      )
    }

    return (
      <Stack
        className="studymesh-assistant-message-actions"
        direction="row"
        spacing={0.35}
        alignItems="center"
        sx={{
          position: 'absolute',
          left: isPhone ? 40 : 48,
          bottom: -18,
          zIndex: 2,
          p: 0.25,
          borderRadius: 1,
        }}
      >
        {actions}
      </Stack>
    )
  }

  const composerSurfaceSx = useMemo(
    () =>
      ({
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        p: 1,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor:
          theme.palette.mode === 'dark'
            ? 'rgba(15,23,42,0.78)'
            : 'rgba(248,250,252,0.96)',
        boxShadow:
          theme.palette.mode === 'dark'
            ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
            : 'inset 0 1px 0 rgba(255,255,255,0.9)',
        cursor: 'text',
        transition:
          'border-color 140ms ease, box-shadow 140ms ease, background-color 140ms ease',
        '&:hover': {
          borderColor: alpha(theme.palette.primary.main, 0.42),
        },
        '&:focus-within': {
          borderColor: 'primary.main',
          boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.14)}`,
        },
      }) satisfies SxProps<Theme>,
    [theme.palette.mode, theme.palette.primary.main],
  )

  const composerInputSx = useMemo<SxProps<Theme>>(
    () => ({
      flex:
        draftHasMultipleLines && chatComposerResized ? '1 1 auto' : '0 1 auto',
      minWidth: 0,
      minHeight: 0,
      width: '100%',
      alignItems: 'flex-start',
      px: 0.5,
      py: 0.25,
      color: 'text.primary',
      '& textarea': {
        height:
          draftHasMultipleLines && chatComposerResized
            ? '100% !important'
            : undefined,
        maxHeight: draftHasMultipleLines ? '100% !important' : undefined,
        boxSizing: 'border-box',
        overflowY: draftHasMultipleLines ? 'auto !important' : undefined,
        resize: 'none',
      },
      '& .MuiInputBase-input': {
        p: 0,
        fontSize: '1rem',
        lineHeight: 1.5,
      },
    }),
    [chatComposerResized, draftHasMultipleLines],
  )

  const composerActionButtonSx = {
    height: 32,
    minHeight: 32,
    width: 32,
    flex: '0 0 auto',
    borderRadius: 1,
    border: 0,
    color: 'text.secondary',
    bgcolor: 'transparent',
    '&:hover': {
      color: 'primary.main',
      bgcolor: alpha(theme.palette.primary.main, 0.08),
    },
    '&.Mui-disabled': {
      color: 'text.disabled',
      bgcolor: 'transparent',
    },
    '& svg': {
      fontSize: 21,
    },
  }

  const sendComposerButtonSx = {
    width: 34,
    height: 34,
    flex: '0 0 auto',
    borderRadius: 1,
    bgcolor: 'transparent',
    color: draft.trim() ? 'primary.main' : 'text.disabled',
    '&:hover': {
      bgcolor: draft.trim()
        ? alpha(theme.palette.primary.main, 0.08)
        : 'transparent',
    },
    '&.Mui-disabled': {
      bgcolor: 'transparent',
      color: 'text.disabled',
    },
    '& svg': {
      fontSize: 24,
    },
  }

  const composerResizeSx = {
    height:
      draftHasMultipleLines && chatComposerResized
        ? chatComposerHeight
        : 'auto',
    minHeight:
      draftHasMultipleLines && chatComposerResized
        ? MIN_RESIZED_CHAT_COMPOSER_HEIGHT
        : undefined,
    maxHeight:
      draftHasMultipleLines && chatComposerResized ? '48vh' : undefined,
    overflow: 'hidden',
  }

  return (
    <Box
      ref={panelRef}
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          height: 48,
          flex: '0 0 auto',
          px: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Button
          onClick={(event) => setPetMenuAnchor(event.currentTarget)}
          aria-haspopup="dialog"
          aria-expanded={Boolean(petMenuAnchor)}
          aria-label="Choose AI companion"
          sx={{
            minWidth: 0,
            p: 0.5,
            pr: 0.75,
            justifyContent: 'flex-start',
            borderRadius: 1.25,
            color: 'text.primary',
            textTransform: 'none',
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.08),
            },
          }}
        >
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ minWidth: 0 }}
          >
            <Box
              component="img"
              src={getAiChatPetSrc(activePet, 'face')}
              alt=""
              sx={{
                width: 34,
                height: 34,
                objectFit: 'cover',
                borderRadius: '50%',
                flex: '0 0 auto',
              }}
            />
            <Box sx={{ minWidth: 0, textAlign: 'left' }}>
              <Typography variant="subtitle2" fontWeight={600} noWrap>
                {t('workspace.aiChat')}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ display: 'block', lineHeight: 1.1 }}
              >
                {displayedActiveChatTitle}
              </Typography>
            </Box>
          </Stack>
        </Button>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {messages.length > 0 && (
            <Tooltip title={t('chat.newChat')}>
              <IconButton
                size="small"
                onClick={startNewChat}
                aria-label={t('chat.newChat')}
                sx={{
                  color: 'primary.main',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                  },
                }}
              >
                <AddCircleOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {(chatSessions.length > 1 || chatMenuOpen) && (
            <Button
              size="small"
              onClick={(event) => setChatMenuAnchor(event.currentTarget)}
              endIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
              aria-haspopup="menu"
              aria-expanded={chatMenuOpen ? 'true' : undefined}
              sx={{
                minWidth: 0,
                px: 1,
                borderRadius: 1.25,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              {t('chat.chats')}
            </Button>
          )}
          {showCloseButton ? (
            <Tooltip title={t('settings.close')}>
              <IconButton
                size="small"
                onClick={onClose}
                aria-label={t('chat.closeAiChat')}
                sx={{
                  width: 30,
                  height: 30,
                  border: 1,
                  borderColor: theme.palette.divider,
                  borderRadius: 1.25,
                  bgcolor: 'background.paper',
                  color: 'primary.main',
                  flex: '0 0 auto',
                  transition: theme.transitions.create(
                    ['background-color', 'border-color'],
                    {
                      duration: theme.transitions.duration.shortest,
                    },
                  ),
                  '&:hover': {
                    borderColor: alpha(theme.palette.primary.main, 0.48),
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                <ChatBubbleOutlineIcon
                  fontSize="small"
                  sx={{ transform: 'translateY(1px)' }}
                />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      </Box>
      <Popover
        open={Boolean(petMenuAnchor)}
        anchorEl={petMenuAnchor}
        onClose={() => setPetMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            mt: 0.75,
            p: 1,
            bgcolor: alpha(theme.palette.background.paper, 0.78),
            backdropFilter: 'blur(14px)',
            border: 1,
            borderColor: alpha(theme.palette.divider, 0.74),
            borderRadius: 2,
            boxShadow: `0 18px 42px ${alpha(theme.palette.common.black, 0.2)}`,
          },
        }}
      >
        <Stack
          direction="column"
          spacing={1}
          role="listbox"
          aria-label="AI companions"
        >
          {aiChatPets.map((pet) => {
            const selected = pet.id === activePetId

            return (
              <Tooltip key={pet.id} title={pet.label} placement="right">
                <IconButton
                  onClick={() => selectAiChatPet(pet.id)}
                  aria-label={`Choose ${pet.label}`}
                  aria-selected={selected}
                  role="option"
                  sx={{
                    width: 54,
                    height: 54,
                    p: 0.35,
                    border: 2,
                    borderColor: selected
                      ? theme.palette.primary.main
                      : alpha(theme.palette.divider, 0.7),
                    bgcolor: selected
                      ? alpha(theme.palette.primary.main, 0.12)
                      : alpha(theme.palette.background.paper, 0.4),
                    '&:hover': {
                      borderColor: alpha(theme.palette.primary.main, 0.72),
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                    },
                  }}
                >
                  <Box
                    component="img"
                    src={getAiChatPetSrc(pet, 'face')}
                    alt=""
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: '50%',
                    }}
                  />
                </IconButton>
              </Tooltip>
            )
          })}
        </Stack>
      </Popover>
      <Dialog
        open={Boolean(externalSourcePrompt)}
        onClose={() => setExternalSourcePrompt(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('chat.openExternalSourceTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              {t('chat.openExternalSourceBody')}
            </Typography>
            <Typography variant="subtitle2" fontWeight={700}>
              {externalSourcePrompt?.title}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {externalSourcePrompt?.url}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExternalSourcePrompt(null)}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={confirmExternalSourceOpen}>
            {t('chat.openSource')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={addSourceDialogOpen}
        onClose={closeAddSourceDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: 'hidden',
            background:
              theme.palette.mode === 'dark'
                ? `radial-gradient(circle at 22% 0%, ${alpha(
                    accentColor.main,
                    0.28,
                  )}, transparent 34%), radial-gradient(circle at 82% 10%, ${alpha(
                    theme.palette.success.main,
                    0.22,
                  )}, transparent 36%), ${theme.palette.background.paper}`
                : `radial-gradient(circle at 18% 0%, ${alpha(
                    accentColor.main,
                    0.16,
                  )}, transparent 36%), radial-gradient(circle at 82% 8%, ${alpha(
                    theme.palette.success.main,
                    0.12,
                  )}, transparent 34%), ${theme.palette.background.paper}`,
          },
        }}
      >
        <DialogTitle>{t('chat.addSourceTitle')}</DialogTitle>
        <DialogContent sx={{ pb: 2 }}>
          <Stack spacing={2.25} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              {t('chat.addSourceHelp')}
            </Typography>
            <TextField
              value={addSourceUrl}
              onChange={(event) => setAddSourceUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && addSourceUrl.trim()) {
                  event.preventDefault()
                  void addWebSource()
                }
              }}
              label={t('chat.sourceUrl')}
              size="small"
              fullWidth
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LinkIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <Box
              onDragOver={(event) => {
                event.preventDefault()
              }}
              onDrop={(event) => {
                event.preventDefault()
                void addSourceFiles(event.dataTransfer.files)
              }}
              sx={{
                minHeight: 188,
                border: 1,
                borderStyle: 'dashed',
                borderColor: alpha(theme.palette.text.primary, 0.28),
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.background.paper, 0.62),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: 2,
                py: 3,
              }}
            >
              <Stack spacing={1.75} alignItems="center">
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {t('chat.dropFiles')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('chat.fileTypesHelp')}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    startIcon={<UploadFileIcon />}
                    onClick={openSourceFilePicker}
                    disabled={addSourceLoading}
                    sx={{ borderRadius: 999, bgcolor: 'background.paper' }}
                  >
                    {t('chat.uploadFiles')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<ContentPasteIcon />}
                    onClick={openPasteSourceDialog}
                    disabled={addSourceLoading}
                    sx={{ borderRadius: 999, bgcolor: 'background.paper' }}
                  >
                    {t('chat.copiedText')}
                  </Button>
                </Stack>
              </Stack>
            </Box>
            <input
              ref={sourceFileInputRef}
              type="file"
              multiple
              hidden
              accept=".txt,.md,.markdown,.csv,.json,.html,.htm,.xml,.yaml,.yml,.log,text/*,application/json,application/xml,application/xhtml+xml"
              onChange={handleSourceFileInputChange}
            />
            <Typography variant="caption" color="text.secondary">
              {t('chat.sourceLimitHelp')}
            </Typography>
            {addSourceError ? (
              <Alert
                severity="error"
                sx={dismissibleAlertSx}
                action={renderDismissAlertAction(() => setAddSourceError(''))}
              >
                {addSourceError}
              </Alert>
            ) : null}
            {addSourceNotice ? (
              <Alert
                severity="info"
                sx={dismissibleAlertSx}
                action={renderDismissAlertAction(
                  () => setAddSourceNotice(''),
                  'info',
                )}
              >
                {addSourceNotice}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAddSourceDialog} disabled={addSourceLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={() => void addWebSource()}
            disabled={addSourceLoading || !addSourceUrl.trim()}
          >
            {addSourceLoading
              ? t('chat.searchingWebShort')
              : t('chat.addSourceButton')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={pasteSourceDialogOpen}
        onClose={closePasteSourceDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            background:
              theme.palette.mode === 'dark'
                ? `radial-gradient(circle at 18% 0%, ${alpha(
                    accentColor.main,
                    0.24,
                  )}, transparent 34%), radial-gradient(circle at 84% 0%, ${alpha(
                    theme.palette.success.main,
                    0.16,
                  )}, transparent 34%), ${theme.palette.background.paper}`
                : undefined,
          },
        }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton
              size="small"
              aria-label={t('common.back')}
              onClick={closePasteSourceDialog}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography variant="h6" component="span" sx={{ flex: 1 }}>
              {t('chat.pasteCopiedTextTitle')}
            </Typography>
            <IconButton
              size="small"
              aria-label={t('common.close')}
              onClick={closePasteSourceDialog}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {t('chat.pasteCopiedTextHelp')}
            </Typography>
            <TextField
              value={addSourceText}
              onChange={(event) => setAddSourceText(event.target.value)}
              inputProps={{ 'aria-label': t('chat.sourceText') }}
              placeholder={t('chat.pasteTextHere')}
              multiline
              minRows={8}
              fullWidth
              autoFocus
            />
            {addSourceError ? (
              <Alert
                severity="error"
                sx={dismissibleAlertSx}
                action={renderDismissAlertAction(() => setAddSourceError(''))}
              >
                {addSourceError}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={addPastedTextSource}
            disabled={!addSourceText.trim()}
          >
            {t('chat.insertSource')}
          </Button>
        </DialogActions>
      </Dialog>
      <Menu
        anchorEl={chatMenuAnchor}
        open={chatMenuOpen}
        onClose={() => setChatMenuAnchor(null)}
        PaperProps={{
          sx: {
            width: 260,
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 420,
            mt: 0.75,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1.5,
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 18px 44px rgba(0,0,0,0.38)'
                : '0 16px 36px rgba(15,23,42,0.16)',
          },
        }}
        MenuListProps={{ sx: { p: 0.75 } }}
      >
        {chatSessions.map((session) => {
          const selected = session.id === activeChatId
          const canDeleteSession = !isEmptyChatSession(session)
          const replyCount = session.messages.filter(
            (message) => message.role === 'assistant',
          ).length
          return (
            <MenuItem
              key={session.id}
              selected={selected}
              disableRipple
              onClick={() => selectChatSession(session)}
              sx={{
                alignItems: 'center',
                gap: 1,
                minHeight: 72,
                px: 1,
                py: 0.9,
                borderRadius: 1.25,
                transition: 'none',
                '&.Mui-selected': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                },
                '&.Mui-selected:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.16),
                },
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1,
                  flex: '0 0 auto',
                  display: 'grid',
                  placeItems: 'center',
                  color: selected ? 'primary.main' : 'text.secondary',
                  bgcolor: selected
                    ? alpha(theme.palette.primary.main, 0.14)
                    : alpha(theme.palette.text.primary, 0.06),
                }}
              >
                <ChatBubbleOutlineIcon fontSize="small" />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {displayChatTitle(session.title)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ display: 'block', lineHeight: 1.35 }}
                >
                  {replyCount}{' '}
                  {replyCount === 1 ? t('chat.reply') : t('chat.replies')}
                </Typography>
              </Box>
              {canDeleteSession ? (
                <IconButton
                  size="small"
                  aria-label={`${t('chat.deleteChat')}: ${displayChatTitle(
                    session.title,
                  )}`}
                  disableRipple
                  onClick={(event) => {
                    event.stopPropagation()
                    deleteChatSession(session.id)
                  }}
                  sx={{
                    width: 32,
                    height: 32,
                    flex: '0 0 auto',
                    border: 1,
                    borderColor: alpha(theme.palette.text.primary, 0.14),
                    color:
                      theme.palette.mode === 'dark'
                        ? theme.palette.error.light
                        : theme.palette.error.dark,
                    bgcolor: alpha(theme.palette.background.paper, 0.72),
                    transition: 'none',
                    '&:hover': {
                      borderColor: alpha(theme.palette.error.main, 0.48),
                      color: 'error.main',
                      bgcolor: alpha(theme.palette.error.main, 0.1),
                    },
                  }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              ) : (
                <Box sx={{ width: 32, height: 32, flex: '0 0 auto' }} />
              )}
            </MenuItem>
          )
        })}
      </Menu>

      <Box
        ref={chatScrollRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          p: isPhone ? 1.25 : 2,
          bgcolor:
            theme.palette.mode === 'dark'
              ? 'rgba(2,6,23,0.18)'
              : 'background.light',
        }}
      >
        {messages.length === 0 ? (
          <Stack
            spacing={1.5}
            alignItems="center"
            sx={{
              minHeight: '100%',
              pt: 0.5,
              pb: 1,
            }}
          >
            <Box
              sx={{
                width: '100%',
                minHeight: 204,
                display: 'grid',
                placeItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <AiChatPet pet={activePet} />
            </Box>
            <Stack
              spacing={0.75}
              sx={{
                width: '100%',
                maxWidth: 380,
              }}
            >
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion.labelKey}
                  variant="outlined"
                  onClick={() => sendQuestion(t(suggestion.labelKey))}
                  sx={{
                    minHeight: 36,
                    justifyContent: 'flex-start',
                    borderRadius: 1,
                    py: 0.5,
                    px: 1.25,
                    width: '100%',
                    bgcolor: 'background.paper',
                    borderColor: 'divider',
                    color: 'text.primary',
                    textTransform: 'none',
                    fontWeight: 500,
                    gap: 0.75,
                  }}
                >
                  <Box sx={{ color: 'text.secondary', display: 'flex' }}>
                    {suggestion.icon}
                  </Box>
                  {t(suggestion.labelKey)}
                </Button>
              ))}
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={1}>
            {messages.map((message) => (
              <Box
                key={message.id}
                className={
                  message.role === 'user' ? 'studymesh-user-message' : undefined
                }
                sx={{
                  alignSelf:
                    message.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: message.role === 'user' ? '90%' : '96%',
                  width:
                    message.role === 'assistant'
                      ? '100%'
                      : message.role === 'user' &&
                          editingPromptId === message.id
                        ? 'min(90%, 360px)'
                        : 'auto',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems:
                    message.role === 'user' ? 'flex-end' : 'flex-start',
                  position: 'relative',
                  '& .studymesh-user-message-actions': {
                    opacity: 0,
                    pointerEvents: 'none',
                    transform: 'translateY(-2px)',
                    transition: theme.transitions.create(
                      ['opacity', 'transform'],
                      {
                        duration: theme.transitions.duration.shortest,
                      },
                    ),
                  },
                  '& .studymesh-assistant-message-actions': {
                    opacity: 0,
                    pointerEvents: 'none',
                    transform: 'translateY(-2px)',
                    transition: theme.transitions.create(
                      ['opacity', 'transform'],
                      {
                        duration: theme.transitions.duration.shortest,
                      },
                    ),
                  },
                  '&:hover .studymesh-user-message-actions, &:focus-within .studymesh-user-message-actions, &:hover .studymesh-assistant-message-actions, &:focus-within .studymesh-assistant-message-actions':
                    {
                      opacity: 1,
                      pointerEvents: 'auto',
                      transform: 'translateY(0)',
                    },
                }}
              >
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="flex-end"
                  sx={{ maxWidth: '100%', minWidth: 0 }}
                >
                  {message.role === 'assistant' && (
                    <Box
                      sx={{
                        width: isPhone ? 34 : 40,
                        height: isPhone ? 34 : 40,
                        flex: '0 0 auto',
                        display: 'grid',
                        placeItems: 'center',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: '50%',
                        bgcolor: 'background.paper',
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        component="img"
                        src={getAiChatPetSrc(activePet, 'face')}
                        alt=""
                        data-testid="assistant-pet-face"
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </Box>
                  )}
                  <Box
                    sx={{
                      minWidth: 0,
                      maxWidth: '100%',
                      width:
                        message.role === 'assistant'
                          ? '100%'
                          : message.role === 'user' &&
                              editingPromptId === message.id
                            ? '100%'
                            : 'auto',
                      flex:
                        message.role === 'assistant' ? '1 1 auto' : undefined,
                      overflow: 'hidden',
                      px: 1.5,
                      py: 1.1,
                      borderRadius: 1.5,
                      bgcolor:
                        message.role === 'user'
                          ? alpha(theme.palette.primary.main, 0.08)
                          : 'background.paper',
                      color:
                        message.role === 'user'
                          ? 'text.primary'
                          : 'text.primary',
                      border: 1,
                      borderColor:
                        message.role === 'user'
                          ? alpha(theme.palette.primary.main, 0.18)
                          : 'divider',
                      boxShadow: 'none',
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    {message.pending ? (
                      <Stack spacing={0.75}>
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                        >
                          {[0, 1, 2].map((dot) => (
                            <Box
                              key={dot}
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                bgcolor: 'text.secondary',
                                animation:
                                  'studymesh-chat-dot 1s infinite ease-in-out',
                                animationDelay: `${dot * 140}ms`,
                                '@keyframes studymesh-chat-dot': {
                                  '0%, 80%, 100%': {
                                    opacity: 0.35,
                                    transform: 'translateY(0)',
                                  },
                                  '40%': {
                                    opacity: 1,
                                    transform: 'translateY(-3px)',
                                  },
                                },
                              }}
                            />
                          ))}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {isLocalAi
                            ? `${t('chat.localAiReplying')}… ${formatSeconds(
                                getElapsedSeconds(message.createdAt),
                              )} ${t('chat.elapsedLower')}. ${t(
                                'chat.estimateAbout',
                              )} 1:30.`
                            : `${t('chat.replying')}… ${formatSeconds(
                                getElapsedSeconds(message.createdAt),
                              )} ${t('chat.elapsedLower')}.`}
                        </Typography>
                      </Stack>
                    ) : message.role === 'assistant' ? (
                      <Box
                        sx={{
                          '& p': { m: 0, mb: 1 },
                          '& p:last-child': { mb: 0 },
                          '& ul, & ol': { pl: 2.5, my: 0.75 },
                          '& pre': {
                            maxWidth: '100%',
                            overflowX: 'hidden',
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                          },
                          '& code': { overflowWrap: 'anywhere' },
                          '& .MuiTableContainer-root': {
                            maxWidth: '100%',
                            overflowX: 'auto',
                            whiteSpace: 'normal',
                          },
                          '& .MuiTable-root': {
                            minWidth: isPhone ? 520 : 560,
                            tableLayout: 'auto',
                          },
                          '& .MuiTableCell-root': {
                            minWidth: isPhone ? 132 : 148,
                            whiteSpace: 'normal',
                            wordBreak: 'normal',
                            overflowWrap: 'normal',
                            verticalAlign: 'top',
                          },
                        }}
                      >
                        {renderAnswerBasisBadges(message)}
                        {renderMarkdown(message.content, {
                          renderCitation: renderCitation(message),
                        })}
                      </Box>
                    ) : editingPromptId === message.id ? (
                      <Stack spacing={0.75}>
                        <TextField
                          value={editingPromptDraft}
                          onChange={(event) =>
                            setEditingPromptDraft(event.target.value)
                          }
                          autoFocus
                          multiline
                          minRows={2}
                          size="small"
                          fullWidth
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && event.metaKey) {
                              event.preventDefault()
                              saveEditedUserPromptBranch(message)
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault()
                              cancelEditingUserPrompt()
                            }
                          }}
                          sx={{
                            minWidth: 0,
                            width: '100%',
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 1,
                              bgcolor: 'background.paper',
                            },
                          }}
                        />
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="flex-end"
                        >
                          <Tooltip title={t('chat.cancelEdit')}>
                            <IconButton
                              size="small"
                              aria-label={t('chat.cancelEdit')}
                              onClick={cancelEditingUserPrompt}
                              sx={{
                                width: 26,
                                height: 26,
                                border: 1,
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                              }}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('chat.saveEdit')}>
                            <IconButton
                              size="small"
                              aria-label={t('chat.saveEdit')}
                              disabled={!editingPromptDraft.trim()}
                              onClick={() =>
                                saveEditedUserPromptBranch(message)
                              }
                              sx={{
                                width: 26,
                                height: 26,
                                border: 1,
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                                color: 'primary.main',
                              }}
                            >
                              <CheckIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>
                    ) : (
                      <Typography variant="body2">{message.content}</Typography>
                    )}
                  </Box>
                </Stack>
                {message.role === 'user' && editingPromptId !== message.id ? (
                  isMobile ? (
                    <Stack
                      direction="row"
                      spacing={0.35}
                      justifyContent="flex-end"
                      alignItems="center"
                      sx={{
                        mt: 0.35,
                        p: 0.25,
                        borderRadius: 1,
                      }}
                    >
                      <Tooltip title={t('chat.copyPrompt')}>
                        <IconButton
                          size="small"
                          aria-label={t('chat.copyPrompt')}
                          onClick={(event) => {
                            event.stopPropagation()
                            copyUserPrompt(message.content)
                          }}
                          sx={userActionIconButtonSx}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('chat.editPrompt')}>
                        <IconButton
                          size="small"
                          aria-label={t('chat.editPrompt')}
                          onClick={(event) => {
                            event.stopPropagation()
                            startEditingUserPrompt(message)
                          }}
                          sx={userActionIconButtonSx}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {message.promptBranchId &&
                      (message.promptBranchCount || 0) > 1 ? (
                        <>
                          <IconButton
                            size="small"
                            aria-label="Previous prompt branch"
                            onClick={(event) => {
                              event.stopPropagation()
                              switchUserPromptBranch(message, -1)
                            }}
                            sx={{
                              ...userActionIconButtonSx,
                              width: 22,
                            }}
                          >
                            <ChevronLeftIcon fontSize="small" />
                          </IconButton>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              minWidth: 24,
                              textAlign: 'center',
                              bgcolor: 'background.paper',
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1,
                              px: 0.5,
                            }}
                          >
                            {(message.promptBranchIndex ?? 0) + 1}/
                            {message.promptBranchCount}
                          </Typography>
                          <IconButton
                            size="small"
                            aria-label="Next prompt branch"
                            onClick={(event) => {
                              event.stopPropagation()
                              switchUserPromptBranch(message, 1)
                            }}
                            sx={{
                              ...userActionIconButtonSx,
                              width: 22,
                            }}
                          >
                            <ChevronRightIcon fontSize="small" />
                          </IconButton>
                        </>
                      ) : null}
                    </Stack>
                  ) : (
                    <Stack
                      className="studymesh-user-message-actions"
                      direction="row"
                      spacing={0.35}
                      justifyContent="flex-end"
                      alignItems="center"
                      sx={{
                        position: 'absolute',
                        right: 0,
                        bottom: -18,
                        zIndex: 2,
                        p: 0.25,
                        borderRadius: 1,
                      }}
                    >
                      <Tooltip title={t('chat.copyPrompt')}>
                        <IconButton
                          size="small"
                          aria-label={t('chat.copyPrompt')}
                          onClick={(event) => {
                            event.stopPropagation()
                            copyUserPrompt(message.content)
                          }}
                          sx={userActionIconButtonSx}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('chat.editPrompt')}>
                        <IconButton
                          size="small"
                          aria-label={t('chat.editPrompt')}
                          onClick={(event) => {
                            event.stopPropagation()
                            startEditingUserPrompt(message)
                          }}
                          sx={userActionIconButtonSx}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {message.promptBranchId &&
                      (message.promptBranchCount || 0) > 1 ? (
                        <>
                          <IconButton
                            size="small"
                            aria-label="Previous prompt branch"
                            onClick={(event) => {
                              event.stopPropagation()
                              switchUserPromptBranch(message, -1)
                            }}
                            sx={{
                              ...userActionIconButtonSx,
                              width: 22,
                            }}
                          >
                            <ChevronLeftIcon fontSize="small" />
                          </IconButton>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              minWidth: 24,
                              textAlign: 'center',
                              bgcolor: 'background.paper',
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1,
                              px: 0.5,
                            }}
                          >
                            {(message.promptBranchIndex ?? 0) + 1}/
                            {message.promptBranchCount}
                          </Typography>
                          <IconButton
                            size="small"
                            aria-label="Next prompt branch"
                            onClick={(event) => {
                              event.stopPropagation()
                              switchUserPromptBranch(message, 1)
                            }}
                            sx={{
                              ...userActionIconButtonSx,
                              width: 22,
                            }}
                          >
                            <ChevronRightIcon fontSize="small" />
                          </IconButton>
                        </>
                      ) : null}
                    </Stack>
                  )
                ) : null}
                {message.role === 'assistant' && !message.pending ? (
                  <>
                    {renderAssistantActions(message)}
                    {renderWebLookupStatus(message)}
                  </>
                ) : null}
              </Box>
            ))}
          </Stack>
        )}
        {replyScrollBufferActive &&
        messages.some((message) => message.pending) ? (
          <Box
            aria-hidden
            sx={{
              height: {
                xs:
                  sourceChipRowHeight > 0
                    ? `max(64px, calc(100% - ${120 + sourceChipRowHeight}px))`
                    : `max(180px, calc(100% - 120px))`,
                sm:
                  sourceChipRowHeight > 0
                    ? `max(80px, calc(100% - ${132 + sourceChipRowHeight}px))`
                    : `max(220px, calc(100% - 132px))`,
              },
            }}
          />
        ) : null}
        {error && (
          <Alert
            severity="error"
            sx={{ mt: 2, ...dismissibleAlertSx }}
            action={renderDismissAlertAction(() => setError(''))}
          >
            {error}
          </Alert>
        )}
      </Box>

      <Box
        role="separator"
        aria-orientation="horizontal"
        aria-label={t('chat.resizeInput')}
        onPointerDown={startComposerResize}
        sx={{
          height: draftHasMultipleLines ? 10 : '1px',
          flex: '0 0 auto',
          mt: draftHasMultipleLines ? -0.5 : 0,
          borderTop: 1,
          borderColor: draftHasMultipleLines
            ? alpha(theme.palette.primary.main, 0.28)
            : 'divider',
          cursor: draftHasMultipleLines ? 'row-resize' : 'default',
          bgcolor: 'background.paper',
          position: 'relative',
          '&::after': draftHasMultipleLines
            ? {
                content: '""',
                position: 'absolute',
                left: '50%',
                top: 3,
                width: 46,
                height: 3,
                borderRadius: 999,
                transform: 'translateX(-50%)',
                bgcolor: alpha(theme.palette.primary.main, 0.34),
              }
            : undefined,
        }}
      />
      <Box
        sx={{
          p: 1.5,
          bgcolor: 'background.paper',
          flex: '0 0 auto',
        }}
      >
        <Stack spacing={1} sx={{ minHeight: 0 }}>
          {userAddedSources.length > 0 || pendingQuickCreateTasks.length > 0 ? (
            <Stack
              ref={userSourceRowRef}
              spacing={0.75}
              data-testid="dashboard-chat-inline-status"
            >
              {userAddedSources.length > 0 ? (
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                  data-testid="dashboard-chat-added-sources"
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={700}
                    sx={{ mr: 0.25 }}
                  >
                    {t('chat.addedSources')}
                  </Typography>
                  {userAddedSources.map((source) => (
                    <Box
                      key={source.id}
                      ref={(node: HTMLDivElement | null) => {
                        if (node) {
                          userSourceChipRefs.current.set(source.id, node)
                        } else {
                          userSourceChipRefs.current.delete(source.id)
                        }
                      }}
                      tabIndex={-1}
                      data-testid={`dashboard-chat-added-source-${source.id}`}
                      sx={{
                        minHeight: 26,
                        maxWidth: '100%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.4,
                        px: 0.6,
                        py: 0.2,
                        border: 1,
                        borderColor: alpha(theme.palette.primary.main, 0.28),
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        color: 'text.primary',
                        outline: 'none',
                        '&:focus-visible': {
                          borderColor: 'primary.main',
                          boxShadow: `0 0 0 2px ${alpha(
                            theme.palette.primary.main,
                            0.18,
                          )}`,
                        },
                      }}
                    >
                      {source.originType === 'user-web' ? (
                        <LinkIcon
                          sx={{ fontSize: 14, color: 'primary.main' }}
                        />
                      ) : (
                        <NotesIcon
                          sx={{ fontSize: 14, color: 'primary.main' }}
                        />
                      )}
                      <Typography
                        variant="caption"
                        fontWeight={600}
                        noWrap
                        sx={{ maxWidth: 140, fontSize: '0.72rem' }}
                      >
                        {source.title}
                      </Typography>
                      <IconButton
                        size="small"
                        aria-label={`${t('chat.removeSource')}: ${source.title}`}
                        onClick={() => removeUserAddedSource(source.id)}
                        sx={{
                          width: 20,
                          height: 20,
                          ml: 0.1,
                          border: 1,
                          borderColor: alpha(theme.palette.text.primary, 0.18),
                          bgcolor: 'background.paper',
                          color: 'text.secondary',
                          '&:hover': {
                            borderColor: alpha(theme.palette.error.main, 0.45),
                            bgcolor: alpha(theme.palette.error.main, 0.08),
                            color: 'error.main',
                          },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              ) : null}
              {pendingQuickCreateTasks.length > 0 ? (
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                  data-testid="dashboard-chat-quick-create-tasks"
                >
                  {pendingQuickCreateTasks.map((task) => (
                    <Box
                      key={task.id}
                      data-testid={`dashboard-chat-quick-create-task-${task.actionId}`}
                      sx={{
                        minHeight: 28,
                        maxWidth: '100%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 0.75,
                        py: 0.25,
                        border: 1,
                        borderColor: alpha(accentColor.main, 0.34),
                        borderRadius: 1,
                        bgcolor: alpha(accentColor.main, 0.1),
                        color: 'text.primary',
                      }}
                    >
                      {quickCreateIcons[task.actionId]}
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        noWrap
                        sx={{ maxWidth: 92, fontSize: '0.72rem' }}
                      >
                        {t('chat.creating')}{' '}
                        {t(getQuickCreateActionLabelKey(task.actionId))}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ fontSize: '0.7rem' }}
                      >
                        {formatSeconds(getElapsedSeconds(task.startedAt))} / ~{' '}
                        {formatSeconds(task.estimateSeconds)}
                      </Typography>
                      <IconButton
                        size="small"
                        aria-label={`${t('common.cancel')} ${t(
                          getQuickCreateActionLabelKey(task.actionId),
                        )}`}
                        onClick={() => cancelQuickCreateTask(task.id)}
                        sx={{
                          width: 20,
                          height: 20,
                          border: 1,
                          borderColor: alpha(theme.palette.text.primary, 0.2),
                          bgcolor: 'background.paper',
                          color: 'text.secondary',
                          '&:hover': {
                            borderColor: alpha(theme.palette.error.main, 0.5),
                            bgcolor: alpha(theme.palette.error.main, 0.08),
                            color: 'error.main',
                          },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          ) : null}
          <Box
            data-testid="dashboard-chat-composer"
            onMouseDown={focusComposerFromSurface}
            sx={[composerSurfaceSx, composerResizeSx]}
          >
            <InputBase
              inputRef={draftInputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('chat.askAnything')}
              fullWidth
              multiline
              minRows={1}
              maxRows={
                draftHasMultipleLines && chatComposerResized ? undefined : 4
              }
              sx={composerInputSx}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  sendQuestion(draft)
                }
              }}
            />
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              data-testid="dashboard-chat-composer-actions"
              sx={{ flex: '0 0 auto', gap: 1 }}
            >
              <Stack direction="row" spacing={0.75} alignItems="center">
                {onQuickCreatePage ? (
                  <Tooltip title={t('chat.create')}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={t('chat.create')}
                        disabled={!hasContext}
                        onClick={(event) =>
                          setQuickCreateMenuAnchor(event.currentTarget)
                        }
                        aria-haspopup="menu"
                        aria-expanded={quickCreateMenuOpen ? 'true' : undefined}
                        sx={composerActionButtonSx}
                      >
                        <AddCircleOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : null}
                <Tooltip title={t('chat.addSource')}>
                  <span>
                    <IconButton
                      size="small"
                      aria-label={t('chat.addSource')}
                      onClick={openAddSourceDialog}
                      sx={composerActionButtonSx}
                    >
                      <AttachFileIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
              <Stack direction="row" spacing={0.25} alignItems="center">
                <Tooltip
                  title={
                    isHostedAi ? (
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <span>Send -</span>
                        <StudyCreditCostLabel
                          amount={chatCreditCost}
                          variant="tooltip"
                        />
                      </Stack>
                    ) : (
                      'Send'
                    )
                  }
                >
                  <span style={{ display: 'inline-flex' }}>
                    <IconButton
                      color="primary"
                      onClick={() => sendQuestion(draft)}
                      disabled={!draft.trim()}
                      aria-label="Send dashboard question"
                      sx={sendComposerButtonSx}
                    >
                      <SendIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
          </Box>
          {onQuickCreatePage ? (
            <>
              {isMobile ? (
                <Drawer
                  anchor="bottom"
                  open={quickCreateMenuOpen}
                  onClose={() => setQuickCreateMenuAnchor(null)}
                  PaperProps={{
                    sx: {
                      borderRadius: '16px 16px 0 0',
                      pb: 'env(safe-area-inset-bottom)',
                    },
                  }}
                >
                  {renderQuickCreateMenuContent()}
                </Drawer>
              ) : (
                <Popover
                  open={quickCreateMenuOpen}
                  anchorEl={quickCreateMenuAnchor}
                  onClose={() => setQuickCreateMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  PaperProps={{
                    sx: {
                      borderRadius: 1.5,
                      border: 1,
                      borderColor: 'divider',
                      boxShadow:
                        theme.palette.mode === 'dark'
                          ? '0 18px 44px rgba(0,0,0,0.36)'
                          : '0 16px 36px rgba(15,23,42,0.12)',
                    },
                  }}
                >
                  {renderQuickCreateMenuContent()}
                </Popover>
              )}
            </>
          ) : null}
        </Stack>
      </Box>
    </Box>
  )
}

export default DashboardChatPanel
