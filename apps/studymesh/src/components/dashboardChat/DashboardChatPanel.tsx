import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import SendIcon from '@mui/icons-material/Send'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import QuizIcon from '@mui/icons-material/Quiz'
import StyleIcon from '@mui/icons-material/Style'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SearchIcon from '@mui/icons-material/Search'
import ArticleIcon from '@mui/icons-material/Article'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import TrackChangesIcon from '@mui/icons-material/TrackChanges'
import { StateDashboard } from '../../state/store'
import {
  buildDashboardChatContext,
  formatDashboardChatContext,
  selectDashboardChatChunks,
} from '../../dashboardChat/contextBuilder'
import { askDashboardSources } from '../../dashboardChat/askDashboard'
import { readQuickCreateAiSettings } from '../../quickCreate/ai'
import {
  quickCreateActionGroups,
  quickCreateActions,
  quickCreateLabels,
  type QuickCreateAction,
  type QuickCreateActionId,
  type QuickCreateActionRequest,
  type QuickCreateSourceScope,
} from '../../quickCreate/quickCreateActions'
import { renderMarkdown } from '../WidgetEditor/components/preview/StudyBlockView'

export interface DashboardChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  sources?: string[]
  pending?: boolean
}

interface DashboardChatSession {
  id: string
  title: string
  messages: DashboardChatMessage[]
  createdAt: number
  updatedAt: number
}

interface DashboardChatPanelProps {
  dashboard?: StateDashboard
  messages: DashboardChatMessage[]
  onMessagesChange: (messages: DashboardChatMessage[]) => void
  onClose: () => void
  showCloseButton?: boolean
  onAddAssistantMessageToGuide?: (message: DashboardChatMessage) => void
  onQuickCreatePage?: (request: QuickCreateActionRequest) => Promise<void>
  supportsStudyGuideCreateScope?: boolean
}

const legacySuggestionLabels = [
  'Summarize the key ideas',
  'Explain this like I’m new',
  'Generate exam-style questions',
  'What should I review first?',
]

const suggestions = [
  {
    label: 'Summarize the key ideas',
    icon: <ArticleIcon fontSize="small" />,
  },
  {
    label: "Explain this like I'm new",
    icon: <LightbulbIcon fontSize="small" />,
  },
  {
    label: 'Generate exam-style questions',
    icon: <HelpOutlineIcon fontSize="small" />,
  },
  {
    label: 'What should I review first?',
    icon: <TrackChangesIcon fontSize="small" />,
  },
]

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
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

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

type AiChatPetId = 'axolotl' | 'dolphin' | 'parrot'

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
    id: 'axolotl',
    label: 'Axolotl',
    src: '/images/studymesh-ai-pet-axolotl.png',
    faceSrc: '/images/studymesh-ai-pet-axolotl-face.png',
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
        width: compact ? { xs: 108, sm: 96 } : { xs: 112, sm: 154 },
        height: compact ? { xs: 108, sm: 96 } : { xs: 112, sm: 154 },
        flex: '0 0 auto',
        backgroundImage: `url(${getAiChatPetSrc(resolvedPet, 'full')})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center bottom',
        backgroundRepeat: 'no-repeat',
        filter: 'drop-shadow(0 16px 18px rgba(139,92,246,0.14))',
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
  onQuickCreatePage,
  supportsStudyGuideCreateScope = false,
}: DashboardChatPanelProps) => {
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
  const [chatSessions, setChatSessions] = useState<DashboardChatSession[]>([])
  const [activeChatId, setActiveChatId] = useState('')
  const [activePetId, setActivePetId] = useState<AiChatPetId>(() => {
    try {
      const stored = window.localStorage.getItem(AI_CHAT_PET_STORAGE_KEY)
      return isAiChatPetId(stored) ? stored : 'axolotl'
    } catch {
      return 'axolotl'
    }
  })
  const [quickCreateSearch, setQuickCreateSearch] = useState('')
  const [quickCreateSourceScope, setQuickCreateSourceScope] =
    useState<QuickCreateSourceScope>(
      supportsStudyGuideCreateScope ? 'studyGuide' : 'currentPage',
    )
  const messagesRef = useRef(messages)
  const queueRef = useRef(Promise.resolve())
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
  const latestAssistantMessageId = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && !message.pending)?.id
  const activePet =
    aiChatPets.find((pet) => pet.id === activePetId) || aiChatPets[0]
  const activeChatTitle =
    chatSessions.find((session) => session.id === activeChatId)?.title ||
    'New chat'

  const persistChatSessions = (nextSessions: DashboardChatSession[]) => {
    chatSessionsRef.current = nextSessions
    setChatSessions(nextSessions)
    try {
      window.localStorage.setItem(
        getChatSessionStorageKey(dashboard?.id),
        JSON.stringify(nextSessions),
      )
    } catch (storageError) {
      console.error('Failed to persist dashboard chat sessions', storageError)
    }
  }

  const replaceActiveChatMessages = (
    nextMessages: DashboardChatMessage[],
    title?: string,
  ) => {
    const now = Date.now()
    const currentSessions = chatSessionsRef.current.length
      ? chatSessionsRef.current
      : [createEmptyChatSession()]
    const sessionId = activeChatId || currentSessions[0].id
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
            updatedAt: now,
          }
        : session,
    )
    persistChatSessions(nextSessions)
    messagesRef.current = nextMessages
    onMessagesChange(nextMessages)
  }

  const startNewChat = () => {
    const nextSession = createEmptyChatSession()
    const nextSessions = [nextSession, ...chatSessionsRef.current]
    setActiveChatId(nextSession.id)
    persistChatSessions(nextSessions)
    messagesRef.current = []
    onMessagesChange([])
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
    setChatMenuAnchor(null)
  }

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    const refreshPet = () => {
      try {
        const stored = window.localStorage.getItem(AI_CHAT_PET_STORAGE_KEY)
        setActivePetId(isAiChatPetId(stored) ? stored : 'axolotl')
      } catch {
        setActivePetId('axolotl')
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

    if (nextSessions.length === 0) {
      nextSessions = [createEmptyChatSession()]
    }

    chatSessionsRef.current = nextSessions
    setChatSessions(nextSessions)
    setActiveChatId(nextSessions[0].id)
    messagesRef.current = nextSessions[0].messages
    onMessagesChange(nextSessions[0].messages)
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

  const updateMessage = (
    messageId: string,
    updater: (message: DashboardChatMessage) => DashboardChatMessage,
  ) => {
    const updated = messagesRef.current.map((message) =>
      message.id === messageId ? updater(message) : message,
    )
    replaceActiveChatMessages(updated)
  }

  const answerQuestion = async (
    question: string,
    pendingMessageId: string,
    historyMessages: DashboardChatMessage[],
  ) => {
    setActiveStartedAt(Date.now())

    if (!hasContext) {
      updateMessage(pendingMessageId, (message) => ({
        ...message,
        content:
          'This dashboard does not have enough source content to answer from yet. Add source notes or generated study material, then ask again.',
        pending: false,
      }))
      setActiveStartedAt(null)
      return
    }

    const sourceChunks = selectDashboardChatChunks(context, question)

    try {
      const result = await askDashboardSources({
        dashboardTitle: context.dashboardTitle,
        contextText: formatDashboardChatContext(context, sourceChunks),
        question,
        history: historyMessages.map(({ role, content }) => ({
          role,
          content,
        })),
        sourceChunks,
      })
      updateMessage(pendingMessageId, (message) => ({
        ...message,
        content: result.answer,
        sources: result.sources,
        pending: false,
      }))
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
      setActiveStartedAt(null)
    }
  }

  const sendQuestion = (question: string) => {
    const trimmed = question.trim()
    if (!trimmed) {
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
    replaceActiveChatMessages(
      nextMessages,
      previousMessages.length === 0 ? titleFromQuestion(trimmed) : undefined,
    )
    setDraft('')
    setError('')

    queueRef.current = queueRef.current.then(() =>
      answerQuestion(trimmed, pendingMessage.id, previousMessages),
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
  const showQuickCreateSearch = quickCreateActions.length > 5
  const normalizedQuickCreateSearch = quickCreateSearch.trim().toLowerCase()
  const filteredQuickCreateActions = normalizedQuickCreateSearch
    ? quickCreateActions.filter((action) =>
        [action.label, action.shortLabel, action.description, action.group]
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
          <Typography variant="subtitle2" fontWeight={900}>
            {supportsStudyGuideCreateScope
              ? quickCreateSourceScope === 'studyGuide'
                ? 'Create from Study Guide source'
                : 'Create from current page'
              : 'Create from this page'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {supportsStudyGuideCreateScope
              ? quickCreateSourceScope === 'studyGuide'
                ? 'Uses lesson, manual, and chat-note pages. Excludes previous Quick Create results.'
                : 'Uses only the page currently open in the Study Guide.'
              : 'Generate study material from current dashboard context.'}
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
            aria-label="Quick Create source scope"
          >
            <ToggleButton value="studyGuide">Study Guide source</ToggleButton>
            <ToggleButton value="currentPage">Current page</ToggleButton>
          </ToggleButtonGroup>
        ) : null}
        {showQuickCreateSearch ? (
          <TextField
            value={quickCreateSearch}
            onChange={(event) => setQuickCreateSearch(event.target.value)}
            placeholder="Find creation action"
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
                  fontWeight={900}
                >
                  {group}
                </Typography>
              </Divider>
              {actions.map((action) => {
                const active = quickCreateActionId === action.id
                return (
                  <Button
                    key={action.id}
                    fullWidth
                    aria-label={action.label}
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
                        color: active ? 'inherit' : action.accent,
                        bgcolor: active
                          ? 'rgba(255,255,255,0.18)'
                          : alpha(action.accent, 0.12),
                      }}
                    >
                      {quickCreateIcons[action.id]}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={900}>
                        {active ? 'Thinking...' : action.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        color={active ? 'inherit' : 'text.secondary'}
                      >
                        {action.description}
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

  return (
    <Box
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
              objectFit: 'contain',
              flex: '0 0 auto',
            }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={900} noWrap>
              AI Chat
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: 'block', lineHeight: 1.1 }}
            >
              {activeChatTitle}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {messages.length > 0 && (
            <Tooltip title="New chat">
              <IconButton
                size="small"
                onClick={startNewChat}
                aria-label="Start new AI chat"
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
          {chatSessions.length > 1 && (
            <Button
              size="small"
              onClick={(event) => setChatMenuAnchor(event.currentTarget)}
              endIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
              sx={{
                minWidth: 0,
                px: 1,
                borderRadius: 1.25,
                textTransform: 'none',
                fontWeight: 800,
              }}
            >
              Chats
            </Button>
          )}
          {showCloseButton ? (
            <Tooltip title="Close">
              <IconButton
                size="small"
                onClick={onClose}
                aria-label="Close AI Chat"
                sx={{
                  width: 30,
                  height: 30,
                  border: 1,
                  borderColor: alpha(theme.palette.primary.main, 0.32),
                  borderRadius: 1.25,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  flex: '0 0 auto',
                  transition: theme.transitions.create(
                    ['background-color', 'border-color'],
                    {
                      duration: theme.transitions.duration.shortest,
                    },
                  ),
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: alpha(theme.palette.primary.main, 0.18),
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
      <Menu
        anchorEl={chatMenuAnchor}
        open={Boolean(chatMenuAnchor)}
        onClose={() => setChatMenuAnchor(null)}
        PaperProps={{ sx: { width: 260, maxWidth: '90vw' } }}
      >
        {chatSessions.map((session) => {
          const replyCount = session.messages.filter(
            (message) => message.role === 'assistant',
          ).length
          return (
            <MenuItem
              key={session.id}
              selected={session.id === activeChatId}
              onClick={() => selectChatSession(session)}
              sx={{ alignItems: 'flex-start', gap: 1 }}
            >
              <ChatBubbleOutlineIcon
                fontSize="small"
                color={session.id === activeChatId ? 'primary' : 'inherit'}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={800} noWrap>
                  {session.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                </Typography>
              </Box>
              <IconButton
                size="small"
                aria-label={`Delete ${session.title}`}
                onClick={(event) => {
                  event.stopPropagation()
                  deleteChatSession(session.id)
                }}
                sx={{
                  ml: 'auto',
                  color: 'text.secondary',
                  '&:hover': {
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
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          p: isPhone ? 1.25 : 2,
          bgcolor:
            theme.palette.mode === 'dark'
              ? 'rgba(2,6,23,0.18)'
              : 'background.light',
        }}
      >
        {!hasContext ? (
          <Alert severity="info">
            This dashboard does not have enough source content to chat with yet.
          </Alert>
        ) : messages.length === 0 ? (
          <Stack spacing={2.25}>
            <Box
              sx={(theme) => ({
                position: 'relative',
                minHeight: isPhone ? 150 : isMobile ? 232 : 190,
                mt: 0,
                p: isPhone ? 2 : isMobile ? 2.5 : 2,
                pl: isPhone ? 2 : isMobile ? 3 : 2,
                pt: isPhone ? 2 : isMobile ? 2.5 : 2,
                pr: isPhone ? 14 : isMobile ? 18 : 17,
                border: 1,
                borderColor: 'divider',
                borderRadius: isMobile ? 3 : 2,
                bgcolor: 'background.paper',
                overflow: 'hidden',
                boxShadow:
                  theme.palette.mode === 'dark'
                    ? '0 16px 36px rgba(0,0,0,0.28)'
                    : '0 18px 44px rgba(16,24,40,0.10)',
              })}
            >
              <Box
                aria-hidden
                sx={{
                  display: 'none',
                  position: 'absolute',
                  left: isMobile ? -8 : -10,
                  top: isMobile ? -94 : -76,
                  width: isMobile ? 174 : 142,
                  height: isMobile ? 178 : 146,
                  backgroundImage: 'none',
                  backgroundSize: isMobile ? '360px auto' : '294px auto',
                  backgroundPosition: isMobile
                    ? '-16px -176px'
                    : '-13px -144px',
                  backgroundRepeat: 'no-repeat',
                  filter: 'drop-shadow(0 16px 20px rgba(15,118,110,0.18))',
                  pointerEvents: 'none',
                }}
              />
              <Box
                sx={{
                  display: 'none',
                  position: 'absolute',
                  left: isMobile ? 150 : 120,
                  top: isMobile ? -48 : -38,
                  maxWidth: isMobile
                    ? 'min(220px, calc(100% - 165px))'
                    : 'min(190px, calc(100% - 130px))',
                  px: 1.25,
                  py: 0.85,
                  border: 1,
                  borderColor: alpha(theme.palette.primary.main, 0.28),
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  color: 'text.primary',
                  fontWeight: 900,
                  fontSize: isMobile ? 14 : 12,
                  lineHeight: 1.25,
                  boxShadow:
                    theme.palette.mode === 'dark'
                      ? '0 10px 22px rgba(0,0,0,0.28)'
                      : '0 10px 22px rgba(16,24,40,0.08)',
                }}
              >
                Hi! I&apos;m your StudyMesh AI.
              </Box>
              <Typography
                variant="h6"
                fontWeight={900}
                sx={{
                  maxWidth: isPhone ? '58%' : isMobile ? '58%' : '64%',
                  fontSize: isPhone ? 18 : undefined,
                  lineHeight: isPhone ? 1.2 : undefined,
                }}
              >
                What do you want to understand?
              </Typography>
              <Box
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: isPhone ? 28 : isMobile ? 40 : 28,
                  pointerEvents: 'none',
                }}
              >
                <AiChatPet pet={activePet} compact={isPhone} />
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  maxWidth: isMobile ? '58%' : '66%',
                  mt: 1,
                  fontWeight: 600,
                  display: isPhone ? 'none' : 'block',
                }}
              >
                Ask questions based on the sources and study material in this
                dashboard. I&apos;ll keep answers grounded in what&apos;s here.
              </Typography>
            </Box>
            <Stack spacing={1}>
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion.label}
                  variant="outlined"
                  disabled={!hasContext}
                  onClick={() => sendQuestion(suggestion.label)}
                  sx={{
                    minHeight: isPhone ? 50 : isMobile ? 64 : 42,
                    justifyContent: 'space-between',
                    borderRadius: 2,
                    py: 1,
                    px: 1.25,
                    bgcolor: 'background.paper',
                    borderColor: 'divider',
                    color: 'text.primary',
                    textTransform: 'none',
                    fontWeight: 900,
                    gap: 1,
                  }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: 1.5,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                        flex: '0 0 auto',
                      }}
                    >
                      {suggestion.icon}
                    </Box>
                    <Typography variant="body2" fontWeight={900}>
                      {suggestion.label}
                    </Typography>
                  </Stack>
                  <ArrowForwardIosIcon sx={{ fontSize: 16 }} />
                </Button>
              ))}
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            {messages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  alignSelf:
                    message.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: message.role === 'user' ? '90%' : '96%',
                }}
              >
                <Stack direction="row" spacing={0.75} alignItems="flex-end">
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
                      }}
                    >
                      <Box
                        component="img"
                        src={getAiChatPetSrc(activePet, 'face')}
                        alt=""
                        sx={{
                          width: isPhone ? 30 : 36,
                          height: isPhone ? 30 : 36,
                          objectFit: 'contain',
                        }}
                      />
                    </Box>
                  )}
                  <Box
                    sx={{
                      minWidth: 0,
                      px: 1.5,
                      py: 1.1,
                      borderRadius:
                        message.role === 'user'
                          ? '18px 18px 6px 18px'
                          : '18px 18px 18px 6px',
                      bgcolor:
                        message.role === 'user'
                          ? 'primary.main'
                          : 'background.paper',
                      color:
                        message.role === 'user'
                          ? 'primary.contrastText'
                          : 'text.primary',
                      border: message.role === 'assistant' ? 1 : 0,
                      borderColor: 'divider',
                      boxShadow:
                        message.role === 'assistant'
                          ? theme.palette.mode === 'dark'
                            ? '0 10px 24px rgba(0,0,0,0.22)'
                            : '0 10px 24px rgba(16,24,40,0.08)'
                          : 'none',
                      whiteSpace: 'pre-wrap',
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
                              ? `Local AI is replying… ${formatSeconds(
                                  elapsedSeconds,
                                )} elapsed. Estimate: about 1:30.`
                              : `Replying… ${formatSeconds(
                                  elapsedSeconds,
                                )} elapsed.`
                            : 'Queued — I’ll answer this after the previous question.'}
                        </Typography>
                      </Stack>
                    ) : message.role === 'assistant' ? (
                      <Box
                        sx={{
                          '& p': { m: 0, mb: 1 },
                          '& p:last-child': { mb: 0 },
                          '& ul, & ol': { pl: 2.5, my: 0.75 },
                          '& pre': { maxWidth: '100%' },
                        }}
                      >
                        {renderMarkdown(message.content)}
                      </Box>
                    ) : (
                      <Typography variant="body2">{message.content}</Typography>
                    )}
                  </Box>
                </Stack>
                {message.sources?.length ? (
                  <Stack
                    direction="row"
                    spacing={0.5}
                    flexWrap="wrap"
                    sx={{
                      mt: 0.75,
                      ml: message.role === 'assistant' ? (isPhone ? 5 : 6) : 0,
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mr: 0.5 }}
                    >
                      Based on:
                    </Typography>
                    {message.sources.map((source) => (
                      <Chip
                        key={source}
                        label={source}
                        size="small"
                        variant="outlined"
                        sx={{ mb: 0.5 }}
                      />
                    ))}
                  </Stack>
                ) : null}
                {message.role === 'assistant' &&
                !message.pending &&
                onAddAssistantMessageToGuide &&
                message.id === latestAssistantMessageId ? (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddCircleOutlineIcon fontSize="small" />}
                    onClick={() => onAddAssistantMessageToGuide(message)}
                    sx={{
                      mt: 0.75,
                      ml: isPhone ? 5 : 6,
                      borderRadius: 2,
                      textTransform: 'none',
                      bgcolor: 'background.paper',
                    }}
                  >
                    Add to Study Guide
                  </Button>
                ) : null}
              </Box>
            ))}
          </Stack>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Box>

      <Box sx={{ borderTop: 1, borderColor: 'divider' }} />
      <Box sx={{ p: 1.5, bgcolor: 'background.paper' }}>
        {onQuickCreatePage && activeQuickCreateAction ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 0.75 }}
          >
            Creating {quickCreateLabels[activeQuickCreateAction.resourceType]} -
            Elapsed {formatSeconds(quickCreateElapsedSeconds)} - Estimate{' '}
            {formatSeconds(quickCreateEstimateSeconds)}
          </Typography>
        ) : null}
        <Stack direction="row" spacing={1} alignItems="flex-end">
          {onQuickCreatePage ? (
            <>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddCircleOutlineIcon fontSize="small" />}
                endIcon={<ExpandMoreIcon fontSize="small" />}
                disabled={!hasContext || Boolean(quickCreateActionId)}
                onClick={(event) =>
                  setQuickCreateMenuAnchor(event.currentTarget)
                }
                aria-haspopup="menu"
                aria-expanded={quickCreateMenuOpen ? 'true' : undefined}
                sx={{
                  height: 40,
                  minHeight: 40,
                  flex: '0 0 auto',
                  borderRadius: 2,
                  textTransform: 'none',
                  bgcolor: 'background.paper',
                }}
              >
                Create
              </Button>
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
                  anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  PaperProps={{
                    sx: {
                      borderRadius: 2,
                      border: 1,
                      borderColor: 'divider',
                      boxShadow:
                        theme.palette.mode === 'dark'
                          ? '0 18px 44px rgba(0,0,0,0.44)'
                          : '0 18px 44px rgba(16,24,40,0.16)',
                    },
                  }}
                >
                  {renderQuickCreateMenuContent()}
                </Popover>
              )}
            </>
          ) : null}
          <TextField
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              hasContext ? 'Ask anything' : 'Add study material before chatting'
            }
            disabled={!hasContext}
            fullWidth
            multiline
            maxRows={4}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2.5,
                bgcolor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(15,23,42,0.72)'
                    : 'rgba(248,250,252,0.92)',
              },
            }}
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
          <IconButton
            color="primary"
            onClick={() => sendQuestion(draft)}
            disabled={!hasContext || !draft.trim()}
            aria-label="Send dashboard question"
            sx={{
              width: 42,
              height: 42,
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
