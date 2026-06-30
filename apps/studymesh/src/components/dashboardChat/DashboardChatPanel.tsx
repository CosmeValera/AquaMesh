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
import QuizIcon from '@mui/icons-material/Quiz'
import StyleIcon from '@mui/icons-material/Style'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
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
  type DashboardAnswerSourceRef,
} from '../../dashboardChat/askDashboard'
import {
  fetchDashboardExternalSource,
  type DashboardExternalSource,
} from '../../dashboardChat/externalSources'
import { prepareDashboardExternalSourcePageDraft } from '../../dashboardChat/sourcePageDrafts'
import { readQuickCreateAiSettings } from '../../quickCreate/ai'
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
import { ASK_DASHBOARD_CHAT_EVENT } from '../workspace/workspaceEvents'
import { useInterfaceText } from '../../language/interfaceLanguage'

export type { DashboardAnswerSourceRef } from '../../dashboardChat/askDashboard'

export interface DashboardChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  sourceRefs?: DashboardAnswerSourceRef[]
  needsExternalSource?: boolean
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
  onClose: () => void
  showCloseButton?: boolean
  onAddAssistantMessageToGuide?: (message: DashboardChatMessage) => void
  onAddExternalSourceToGuide?: (source: DashboardExternalSource) => void
  onOpenSource?: (source: DashboardAnswerSourceRef) => void
  onQuickCreatePage?: (request: QuickCreateActionRequest) => Promise<void>
  supportsStudyGuideCreateScope?: boolean
  queuedQuestion?: { id: string; content: string } | null
  onQueuedQuestionConsumed?: (id: string) => void
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
  session.messages.length === 0

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

const quickCreateIcons: Record<QuickCreateActionId, React.ReactNode> = {
  quiz: <QuizIcon fontSize="small" />,
  flashcards: <StyleIcon fontSize="small" />,
  improvedNotes: <AutoStoriesIcon fontSize="small" />,
}

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
  /\bagain\b|\brepeat\b|\bearlier\b|\bwhat did you say\b|\bwhat was\b|\bremind me\b/i
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
const TECHNICAL_EVIDENCE_TERMS = [
  'automation',
  'workflow',
  'integration',
  'configuration',
  'orchestration',
  'infrastructure',
  'provision',
  'state',
  'runbook',
  'job',
  'schedule',
  'api',
  'deploy',
  'manage',
  'service',
]

type AiChatPetId = 'dolphin' | 'bee' | 'parrot'

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
    id: 'bee',
    label: 'Bee',
    src: '/images/studymesh-ai-pet-bee.png',
    faceSrc: '/images/studymesh-ai-pet-bee-face.png',
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

const getQuickCreateEstimateSeconds = (): number => {
  const provider = readQuickCreateAiSettings().provider || 'hosted'

  if (provider === 'local') {
    return 90
  }

  if (provider === 'cerebras' || provider === 'hosted') {
    return 20
  }

  return 60
}

const DashboardChatPanel = ({
  dashboard,
  messages,
  onMessagesChange,
  onClose,
  showCloseButton = true,
  onAddAssistantMessageToGuide,
  onAddExternalSourceToGuide,
  onOpenSource,
  onQuickCreatePage,
  supportsStudyGuideCreateScope = false,
  queuedQuestion,
  onQueuedQuestionConsumed,
}: DashboardChatPanelProps) => {
  const { t } = useInterfaceText()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [activeStartedAt, setActiveStartedAt] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [quickCreateStartedAt, setQuickCreateStartedAt] = useState<
    number | null
  >(null)
  const [quickCreateElapsedSeconds, setQuickCreateElapsedSeconds] = useState(0)
  const [quickCreateActionId, setQuickCreateActionId] =
    useState<QuickCreateActionId | null>(null)
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
      const stored = window.localStorage.getItem(AI_CHAT_PET_STORAGE_KEY)
      return isAiChatPetId(stored) ? stored : 'dolphin'
    } catch {
      return 'dolphin'
    }
  })
  const [quickCreateSearch, setQuickCreateSearch] = useState('')
  const [replyScrollBufferActive, setReplyScrollBufferActive] = useState(false)
  const [chatComposerHeight, setChatComposerHeight] = useState(108)
  const [chatComposerResized, setChatComposerResized] = useState(false)
  const [draftHasMultipleLines, setDraftHasMultipleLines] = useState(false)
  const [externalSourcePrompt, setExternalSourcePrompt] =
    useState<ExternalSourcePrompt | null>(null)
  const [quickCreateSourceScope, setQuickCreateSourceScope] =
    useState<QuickCreateSourceScope>(
      supportsStudyGuideCreateScope ? 'studyGuide' : 'currentPage',
    )
  const panelRef = useRef<HTMLDivElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null)
  const composerDragRef = useRef<{
    startY: number
    startHeight: number
  } | null>(null)
  const messagesRef = useRef(messages)
  const chatSessionsRef = useRef<DashboardChatSession[]>([])
  const settings = readQuickCreateAiSettings()
  const isLocalAi = settings.provider === 'local'
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
  const activeChatTitle =
    chatSessions.find((session) => session.id === activeChatId)?.title ||
    'New chat'
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
    type: 'web source',
    text: source.text,
    origin: 'web',
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
    | 'study_guide_question'
    | 'external_info_needed' => {
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

    return hasContext ? 'study_guide_question' : 'external_info_needed'
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

  const isWebLookupStatusOnlyMessage = (
    message: DashboardChatMessage,
  ): boolean =>
    message.role === 'assistant' &&
    Boolean(message.webLookup) &&
    !message.pending &&
    ((message.sourceRefs || []).length === 0 ||
      message.needsExternalSource ||
      /^This dashboard does not have enough source content/i.test(
        message.content,
      ) ||
      /^The dashboard sources do not contain enough information/i.test(
        message.content,
      ) ||
      /^The Study Guide does not contain enough info/i.test(message.content) ||
      /^The provided .*do not contain/i.test(message.content))

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
    const latestUserQuestion = [...historyMessages]
      .reverse()
      .find((message) => message.role === 'user')?.content
    const previousAssistant = [...historyMessages]
      .reverse()
      .find((message) => message.role === 'assistant')
    const sourceSupportFollowUp = SOURCE_SUPPORT_FOLLOWUP_PATTERN.test(question)

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

  const requiredConceptsForQuestion = (
    question: string,
    historyMessages: DashboardChatMessage[] = [],
  ): string[] => {
    const expanded = expandQuestionWithChatContext(question, historyMessages)
    const questionTerms = extractQuestionTerms(question)
    const expandedTerms = extractQuestionTerms(expanded)
    const comparisonFollowUp =
      /\bwhat about\b|\bhow about\b|\bvs\b|\bcompare\b|\bdifference\b/i.test(
        question,
      )
    const sourceSupportFollowUp = SOURCE_SUPPORT_FOLLOWUP_PATTERN.test(question)

    return (
      comparisonFollowUp || sourceSupportFollowUp ? expandedTerms : questionTerms
    ).filter((term) => !isConceptSufficientInDashboard(term, expanded))
  }

  const contextTextContains = (term: string): boolean =>
    context.chunks.some((chunk) =>
      `${chunk.title} ${chunk.text}`.toLowerCase().includes(term),
    )

  const isConceptSufficientInDashboard = (
    concept: string,
    question: string,
  ): boolean => {
    const relevantChunks = context.chunks.filter((chunk) =>
      `${chunk.title} ${chunk.text}`.toLowerCase().includes(concept),
    )
    if (relevantChunks.length === 0) {
      return false
    }

    const combined = relevantChunks
      .map((chunk) => `${chunk.title} ${chunk.text}`)
      .join(' ')
      .toLowerCase()
    const asksComparison =
      /\bvs\b|\bcompare\b|\bdifference\b|\bsimilar\b|\bcategory\b/i.test(
        question,
      )
    const asksIntegration = /\bintegrat|work with|connect|run\b/i.test(question)

    if (asksIntegration) {
      return relevantChunks.some((chunk) => chunk.text.length > 120)
    }

    if (asksComparison) {
      return (
        relevantChunks.some((chunk) => chunk.text.length > 220) &&
        TECHNICAL_EVIDENCE_TERMS.some((term) => combined.includes(term))
      )
    }

    return relevantChunks.some((chunk) => chunk.text.length > 160)
  }

  const sourceCoversConcept = (
    source: Pick<DashboardExternalSource, 'title' | 'text'>,
    concept: string,
  ): boolean => {
    const haystack = `${source.title} ${source.text}`.toLowerCase()
    return (
      haystack.includes(concept) &&
      TECHNICAL_EVIDENCE_TERMS.some((term) => haystack.includes(term))
    )
  }

  const coveredConceptsFromSources = (
    sources: Array<Pick<DashboardExternalSource, 'title' | 'text'>>,
    requiredConcepts: string[],
  ): string[] =>
    requiredConcepts.filter((concept) =>
      sources.some((source) => sourceCoversConcept(source, concept)),
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

    return availableExternalSources
      .map((source) => ({
        source,
        score: scoreExternalSource(source, question),
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map(({ source }) => source)
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
  ): {
    sourceChunks: DashboardSourceChunk[]
    selectedExternalSourceIds: string[]
  } => {
    const dashboardChunks = selectDashboardChatChunks(context, question)
    const selectedExternalSources = selectStoredExternalSources(
      question,
      externalSourceIds,
    )
    const externalChunks = selectedExternalSources.map(externalSourceToChunk)

    return {
      sourceChunks: [...dashboardChunks, ...externalChunks],
      selectedExternalSourceIds: selectedExternalSources.map(
        (source) => source.id,
      ),
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
        const stored = window.localStorage.getItem(AI_CHAT_PET_STORAGE_KEY)
        setActivePetId(isAiChatPetId(stored) ? stored : 'dolphin')
      } catch {
        setActivePetId('dolphin')
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
    if (!activeStartedAt) {
      setElapsedSeconds(0)
      return undefined
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - activeStartedAt) / 1000))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [activeStartedAt])

  useEffect(() => {
    if (!quickCreateStartedAt) {
      setQuickCreateElapsedSeconds(0)
      return undefined
    }

    const interval = window.setInterval(() => {
      setQuickCreateElapsedSeconds(
        Math.floor((Date.now() - quickCreateStartedAt) / 1000),
      )
    }, 1000)

    return () => window.clearInterval(interval)
  }, [quickCreateStartedAt])

  useEffect(() => {
    measureDraftLines()
    if (draft.length === 0) {
      setChatComposerResized(false)
      setChatComposerHeight(108)
    }
  }, [draft])

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
      setChatComposerHeight(Math.min(Math.max(nextHeight, 108), maxHeight))
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

  const upsertExternalSource = (
    source: DashboardExternalSource,
  ): DashboardExternalSource => {
    const enrichedSource: DashboardExternalSource = {
      ...source,
      normalizedUrl:
        source.normalizedUrl || normalizeSourceUrlForDedupe(source.url),
      domain: source.domain || getSourceDomain(source.url),
      summary: source.summary || source.text.slice(0, 500),
      coveredEntities:
        source.coveredEntities ||
        extractCoveredEntities(`${source.title} ${source.text}`),
      usedInAnswer: source.usedInAnswer || false,
    }
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
              dashboard?.contentLanguage || dashboard?.studyPath?.contentLanguage,
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

  const appendWebRetryAnswer = (
    question: string,
    historyMessages: DashboardChatMessage[],
    sourceIds: string[],
  ) => {
    const pendingMessage: DashboardChatMessage = {
      id: makeMessageId(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      pending: true,
      externalSourceIds: sourceIds,
    }

    replaceActiveChatMessages(
      [...messagesRef.current, pendingMessage],
      undefined,
      {
        scrollToBottom: true,
      },
    )
    void answerQuestion(question, pendingMessage.id, historyMessages, sourceIds)
  }

  const runExternalSourceLookup = async (
    question: string,
    gapMessageId: string,
    historyMessages: DashboardChatMessage[],
  ) => {
    updateMessage(gapMessageId, (message) => ({
      ...message,
      content: t('chat.searchingWeb'),
      webLookup: { status: 'searching' },
    }))

    try {
      const lookupQuestion = expandQuestionWithChatContext(
        question,
        historyMessages,
      )
      const requiredConcepts = requiredConceptsForQuestion(
        question,
        historyMessages,
      )
      const dashboardCoveredConcepts = coveredConceptsFromSources(
        context.chunks,
        requiredConcepts,
      )
      const missingConcepts = requiredConcepts.filter(
        (concept) => !dashboardCoveredConcepts.includes(concept),
      )
      const sources = upsertExternalSources(
        await fetchDashboardExternalSource({
          question: lookupQuestion,
          dashboardTitle: context.dashboardTitle,
          contextSummary: buildExternalLookupContextSummary(),
          ...getRejectedSourceFilters(),
        }),
      )
      const usableSourceIds =
        missingConcepts.length > 0
          ? Array.from(
              new Set(
                sources
                  .filter((source) =>
                    missingConcepts.some((concept) =>
                      sourceCoversConcept(source, concept),
                    ),
                  )
                  .map((source) => source.id),
              ),
            )
          : sources.map((source) => source.id)
      const sourceIds = usableSourceIds.length
        ? usableSourceIds
        : Array.from(new Set(sources.map((source) => source.id)))

      updateMessage(gapMessageId, (message) => ({
        ...message,
        webLookup: {
          status: 'found',
          sourceId: sourceIds[0],
          sourceIds,
        },
      }))
      appendWebRetryAnswer(question, historyMessages, sourceIds)
    } catch (err) {
      updateMessage(gapMessageId, (message) => ({
        ...message,
        content:
          'I could not find a reliable web source for the missing topic.',
        webLookup: {
          status: 'failed',
          error:
            err instanceof Error
              ? err.message
              : 'Could not find a useful web source.',
        },
      }))
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

  const answerQuestion = async (
    question: string,
    pendingMessageId: string,
    historyMessages: DashboardChatMessage[],
    externalSourceIds: string[] = [],
  ) => {
    setActiveStartedAt(Date.now())
    const { sourceChunks, selectedExternalSourceIds } =
      selectAnswerSourceChunks(question, externalSourceIds)

    if (!hasContext && selectedExternalSourceIds.length === 0) {
      updateMessage(pendingMessageId, (message) => ({
        ...message,
        content:
          'This dashboard does not have enough source content to answer from yet.',
        needsExternalSource: true,
        webLookup: { status: 'searching' },
        pending: false,
      }))
      setActiveStartedAt(null)
      void runExternalSourceLookup(question, pendingMessageId, historyMessages)
      return
    }

    try {
      const result = await askDashboardSources({
        dashboardTitle: context.dashboardTitle,
        contextText: formatDashboardChatContext(context, sourceChunks),
        question,
        history: usefulHistoryForPrompt(historyMessages),
        sourceChunks,
        contentLanguage:
          dashboard?.contentLanguage || dashboard?.studyPath?.contentLanguage,
      })
      const usedWebSourceIds = result.sourceRefs
        .filter((sourceRef) => sourceRef.origin === 'web')
        .map((sourceRef) => sourceRef.chunkId)
      updateMessage(pendingMessageId, (message) => ({
        ...message,
        content: result.answer,
        sourceRefs: result.sourceRefs,
        needsExternalSource: result.needsExternalSource,
        externalSourceIds: selectedExternalSourceIds,
        pending: false,
      }))
      updateLatestLookupDisplayedSources(externalSourceIds, usedWebSourceIds)
      prepareGuidePageDraftsForSources(usedWebSourceIds, question, result.answer)
      if (!result.needsExternalSource) {
        rememberFinalAnswer({
          userQuestion: question,
          finalAssistantAnswer: result.answer,
          usedSourceIds: usedWebSourceIds,
        })
      }
      if (result.needsExternalSource && externalSourceIds.length === 0) {
        void runExternalSourceLookup(
          question,
          pendingMessageId,
          historyMessages,
        )
      }
    } catch (err) {
      updateMessage(pendingMessageId, (message) => ({
        ...message,
        content: 'I could not answer from this dashboard yet.',
        pending: false,
      }))
      setError(
        err instanceof Error
          ? err.message
          : 'Could not answer from this dashboard.',
      )
    } finally {
      setReplyScrollBufferActive(false)
      setActiveStartedAt(null)
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

  useEffect(() => {
    const askFromEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ content?: unknown }>).detail
      if (typeof detail?.content !== 'string' || !detail.content.trim()) {
        return
      }

      sendQuestion(detail.content)
    }

    window.addEventListener(ASK_DASHBOARD_CHAT_EVENT, askFromEvent)

    return () => {
      window.removeEventListener(ASK_DASHBOARD_CHAT_EVENT, askFromEvent)
    }
  }, [])

  const lastQueuedQuestionIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (
      !queuedQuestion ||
      lastQueuedQuestionIdRef.current === queuedQuestion.id
    ) {
      return
    }

    lastQueuedQuestionIdRef.current = queuedQuestion.id
    sendQuestion(queuedQuestion.content)
    onQueuedQuestionConsumed?.(queuedQuestion.id)
  }, [queuedQuestion])

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
      content: 'Trying another source...',
      createdAt: Date.now(),
      pending: false,
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
    void runExternalSourceLookup(question, pendingMessage.id, previousMessages)
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

    if (source.url) {
      requestExternalSourceOpen({
        title: source.title || 'External source',
        url: source.url,
      })
      return
    }

    onOpenSource?.(source)
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

  const runQuickCreate = async (action: QuickCreateAction) => {
    if (!onQuickCreatePage || quickCreateActionId) {
      return
    }

    setError('')
    setQuickCreateActionId(action.id)
    setQuickCreateStartedAt(Date.now())
    setQuickCreateMenuAnchor(null)
    setQuickCreateSearch('')
    try {
      await onQuickCreatePage({
        actionId: action.id,
        resourceType: action.resourceType,
        label: action.label,
        ...(supportsStudyGuideCreateScope
          ? { sourceScope: quickCreateSourceScope }
          : {}),
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not create this page.',
      )
    } finally {
      setQuickCreateActionId(null)
      setQuickCreateStartedAt(null)
    }
  }

  const formatSeconds = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return minutes > 0
      ? `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
      : `${remainingSeconds}s`
  }

  const quickCreateEstimateSeconds = getQuickCreateEstimateSeconds()
  const activeQuickCreateAction = quickCreateActions.find(
    (action) => action.id === quickCreateActionId,
  )
  const quickCreateMenuOpen = Boolean(quickCreateMenuAnchor)
  const chatMenuOpen = Boolean(chatMenuAnchor)
  const showQuickCreateSearch = quickCreateActions.length > 5
  const normalizedQuickCreateSearch = quickCreateSearch.trim().toLowerCase()
  const filteredQuickCreateActions = normalizedQuickCreateSearch
    ? quickCreateActions.filter((action) =>
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
    : quickCreateActions
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
                const active = quickCreateActionId === action.id
                return (
                  <Button
                    key={action.id}
                    fullWidth
                    aria-label={t(getQuickCreateActionLabelKey(action.id))}
                    variant={active ? 'contained' : 'text'}
                    disabled={!hasContext || Boolean(quickCreateActionId)}
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
                      color: active ? 'warning.contrastText' : 'text.primary',
                      ...(active
                        ? {
                            bgcolor: 'warning.main',
                            '&.Mui-disabled': {
                              bgcolor: 'warning.main',
                              color: 'warning.contrastText',
                              opacity: 0.9,
                            },
                          }
                        : {}),
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
                        color: active ? 'inherit' : 'text.secondary',
                        bgcolor: active
                          ? 'rgba(255,255,255,0.18)'
                          : 'action.hover',
                      }}
                    >
                      {quickCreateIcons[action.id]}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {active
                          ? t('chat.thinking')
                          : t(getQuickCreateActionLabelKey(action.id))}
                      </Typography>
                      <Typography
                        variant="caption"
                        color={active ? 'inherit' : 'text.secondary'}
                      >
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

      return (
        <Box
          key={key}
          component="button"
          type="button"
          aria-label={
            isWebSource
              ? `Open web source ${citationNumber}`
              : `Open source ${citationNumber}`
          }
          onClick={(event) => {
            event.stopPropagation()
            openSource(source)
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

    const sourceDomain = (source: DashboardExternalSource) => {
      try {
        return new URL(source.url).hostname.replace(/^www\./, '')
      } catch {
        return source.url
      }
    }
    const addSourceLabel = (source: DashboardExternalSource) => {
      if (source.guidePageDraftStatus === 'ready') {
        return 'Add this source'
      }

      if (source.guidePageDraftStatus === 'failed') {
        return 'Could not prepare page'
      }

      return 'Preparing page...'
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
            Searching web...
          </Typography>
        ) : message.webLookup.status === 'failed' ? (
          <Typography variant="caption" color="error.main">
            {message.webLookup.error || 'Web search failed.'}
          </Typography>
        ) : sources.length > 0 ? (
          <Stack spacing={0.75}>
            <Box>
              <Typography variant="caption" fontWeight={700}>
                {sources.length === 1 ? 'Found source' : 'Found sources'}
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
                      aria-label={`Open found source ${source.title}`}
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
                    {onAddExternalSourceToGuide ? (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddCircleOutlineIcon fontSize="small" />}
                        aria-label={`Add ${source.title} as page`}
                        disabled={source.guidePageDraftStatus !== 'ready'}
                        onClick={() => {
                          if (source.guidePageDraftStatus === 'ready') {
                            onAddExternalSourceToGuide(source)
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

  const composerInputSx = useMemo<SxProps<Theme>>(
    () => ({
      flex: 1,
      minWidth: 0,
      '& .MuiOutlinedInput-root': {
        height:
          draftHasMultipleLines && chatComposerResized ? '100%' : undefined,
        alignItems: 'flex-start',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 1,
        bgcolor:
          theme.palette.mode === 'dark'
            ? 'rgba(15,23,42,0.72)'
            : 'rgba(248,250,252,0.92)',
      },
      '& .MuiInputBase-inputMultiline': {
        height:
          draftHasMultipleLines && chatComposerResized
            ? '100% !important'
            : undefined,
        maxHeight: draftHasMultipleLines ? '100% !important' : undefined,
        boxSizing: 'border-box',
        overflowY: draftHasMultipleLines ? 'auto !important' : undefined,
      },
    }),
    [chatComposerResized, draftHasMultipleLines, theme.palette.mode],
  )

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
        <DialogTitle>Open external source?</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              StudyMesh will open this source in a new tab.
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
          <Button onClick={() => setExternalSourcePrompt(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmExternalSourceOpen}>
            Open source
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
        {!hasContext ? (
          <Alert severity="info">{t('chat.noSourceContent')}</Alert>
        ) : messages.length === 0 ? (
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
                  disabled={!hasContext}
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
                      : message.role === 'user' && editingPromptId === message.id
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
                      flex: message.role === 'assistant' ? '1 1 auto' : undefined,
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
                          {activeStartedAt &&
                          messages.findIndex(({ id }) => id === message.id) ===
                            messages.findIndex(
                              ({ role, pending }) =>
                                role === 'assistant' && pending,
                            )
                            ? isLocalAi
                              ? `${t('chat.localAiReplying')}… ${formatSeconds(
                                  elapsedSeconds,
                                )} ${t('chat.elapsedLower')}. ${t(
                                  'chat.estimateAbout',
                                )} 1:30.`
                              : `${t('chat.replying')}… ${formatSeconds(
                                  elapsedSeconds,
                                )} ${t('chat.elapsedLower')}.`
                            : t('chat.queuedReply')}
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
                    {isWebLookupStatusOnlyMessage(message)
                      ? null
                      : renderAssistantActions(message)}
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
                xs: 'max(220px, calc(100% - 120px))',
                sm: 'max(260px, calc(100% - 132px))',
              },
            }}
          />
        ) : null}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
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
          height:
            draftHasMultipleLines && chatComposerResized
              ? chatComposerHeight
              : 'auto',
          minHeight:
            draftHasMultipleLines && chatComposerResized ? 108 : undefined,
          maxHeight:
            draftHasMultipleLines && chatComposerResized ? '48%' : undefined,
        }}
      >
        {onQuickCreatePage && activeQuickCreateAction ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 0.75 }}
          >
            {t('chat.creating')}{' '}
            {t(getQuickCreateActionLabelKey(activeQuickCreateAction.id))} -{' '}
            {t('chat.elapsed')} {formatSeconds(quickCreateElapsedSeconds)} -{' '}
            {t('chat.estimate')} {formatSeconds(quickCreateEstimateSeconds)}
          </Typography>
        ) : null}
        <Stack
          direction="row"
          spacing={1}
          alignItems="stretch"
          sx={{
            height:
              draftHasMultipleLines && chatComposerResized ? '100%' : 'auto',
          }}
        >
          {onQuickCreatePage ? (
            <Tooltip title={t('chat.create')}>
              <span>
                <IconButton
                  size="small"
                  aria-label={t('chat.create')}
                  disabled={!hasContext || Boolean(quickCreateActionId)}
                  onClick={(event) =>
                    setQuickCreateMenuAnchor(event.currentTarget)
                  }
                  aria-haspopup="menu"
                  aria-expanded={quickCreateMenuOpen ? 'true' : undefined}
                  sx={{
                    height: 40,
                    minHeight: 40,
                    width: 40,
                    alignSelf: 'flex-end',
                    flex: '0 0 auto',
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    color: 'text.secondary',
                    bgcolor: 'background.paper',
                    '&:hover': {
                      borderColor: alpha(theme.palette.primary.main, 0.32),
                      color: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                    },
                    '&.Mui-disabled': {
                      borderColor: 'divider',
                      color: 'text.disabled',
                      bgcolor: 'action.disabledBackground',
                    },
                  }}
                >
                  <AddCircleOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
          <TextField
            inputRef={draftInputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              hasContext ? t('chat.askAnything') : t('chat.addStudyMaterial')
            }
            disabled={!hasContext}
            fullWidth
            multiline
            minRows={1}
            maxRows={
              draftHasMultipleLines && chatComposerResized ? undefined : 4
            }
            size="small"
            sx={composerInputSx}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                if (!hasContext) {
                  return
                }
                sendQuestion(draft)
              }
            }}
          />
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
          <IconButton
            color="primary"
            onClick={() => sendQuestion(draft)}
            disabled={!hasContext || !draft.trim()}
            aria-label="Send dashboard question"
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1,
              bgcolor:
                hasContext && draft.trim()
                  ? 'primary.main'
                  : 'action.disabledBackground',
              color:
                hasContext && draft.trim()
                  ? 'primary.contrastText'
                  : 'text.disabled',
              '&:hover': {
                bgcolor:
                  hasContext && draft.trim()
                    ? 'primary.dark'
                    : 'action.disabledBackground',
              },
            }}
          >
            <SendIcon />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  )
}

export default DashboardChatPanel
