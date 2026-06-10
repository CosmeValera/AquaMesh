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
  Popover,
  Stack,
  TextField,
  Tooltip,
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
import { StateDashboard } from '../../state/store'
import {
  buildDashboardChatContext,
  formatDashboardChatContext,
  selectDashboardChatChunks,
} from '../../dashboardChat/contextBuilder'
import { askDashboardSources } from '../../dashboardChat/askDashboard'
import { readStudyPackAiSettings } from '../../studyPack/ai'
import {
  quickCreateActionGroups,
  quickCreateActions,
  quickCreateLabels,
  type QuickCreateAction,
  type QuickCreateActionId,
  type QuickCreateActionRequest,
} from '../../studyPack/quickCreateActions'
import HostedAiCreditActions from '../hostedAi/HostedAiCreditActions'
import { renderMarkdown } from '../WidgetEditor/components/preview/StudyBlockView'

export interface DashboardChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  sources?: string[]
  pending?: boolean
}

const isInsufficientStudyCreditsError = (message: string): boolean =>
  /not enough study credits|insufficient study credits/i.test(message)

interface DashboardChatPanelProps {
  dashboard?: StateDashboard
  messages: DashboardChatMessage[]
  onMessagesChange: (messages: DashboardChatMessage[]) => void
  onClose: () => void
  showCloseButton?: boolean
  onAddAssistantMessageToGuide?: (message: DashboardChatMessage) => void
  onQuickCreatePage?: (request: QuickCreateActionRequest) => Promise<void>
}

const suggestions = [
  'Summarize the key ideas',
  'Explain this like I’m new',
  'Generate exam-style questions',
  'What should I review first?',
]

const makeMessageId = () =>
  `dashboard-chat-${Date.now()}-${Math.random().toString(36).slice(2)}`

const quickCreateIcons: Record<QuickCreateActionId, React.ReactNode> = {
  quiz: <QuizIcon fontSize="small" />,
  flashcards: <StyleIcon fontSize="small" />,
  improvedNotes: <AutoStoriesIcon fontSize="small" />,
}

const getQuickCreateEstimateSeconds = (): number => {
  const provider = readStudyPackAiSettings().provider || 'basic'
  if (provider === 'basic') {
    return 10
  }

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
}: DashboardChatPanelProps) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
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
  const [quickCreateSearch, setQuickCreateSearch] = useState('')
  const messagesRef = useRef(messages)
  const queueRef = useRef(Promise.resolve())
  const settings = readStudyPackAiSettings()
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

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

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
    messagesRef.current = updated
    onMessagesChange(updated)
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
    messagesRef.current = nextMessages
    onMessagesChange(nextMessages)
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
            Create from this page
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Generate study material from current dashboard context.
          </Typography>
        </Box>
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
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={900} noWrap>
            AI Chat
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5}>
          {messages.length > 0 && (
            <Tooltip title="Clear chat">
              <IconButton
                size="small"
                onClick={() => onMessagesChange([])}
                aria-label="Clear dashboard chat"
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Tooltip>
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
                <ChatBubbleOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          p: 2,
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
              sx={{
                p: 2,
                border: 1,
                borderColor: 'divider',
                borderRadius: 2.5,
                bgcolor: 'background.paper',
              }}
            >
              <Typography variant="h6" fontWeight={900}>
                What do you want to understand?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ask questions based on the sources and study material in this
                dashboard. I’ll keep answers grounded in what’s here.
              </Typography>
            </Box>
            <Stack spacing={1}>
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outlined"
                  size="small"
                  disabled={!hasContext}
                  onClick={() => sendQuestion(suggestion)}
                  sx={{
                    justifyContent: 'flex-start',
                    borderRadius: 2,
                    py: 1,
                    px: 1.25,
                    bgcolor: 'background.paper',
                    borderColor: 'divider',
                    color: 'text.primary',
                    textTransform: 'none',
                  }}
                >
                  {suggestion}
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
                  maxWidth: '90%',
                }}
              >
                <Box
                  sx={{
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
                      <Stack direction="row" spacing={0.5} alignItems="center">
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
                {message.sources?.length ? (
                  <Stack
                    direction="row"
                    spacing={0.5}
                    flexWrap="wrap"
                    sx={{ mt: 0.75 }}
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
        {error && isInsufficientStudyCreditsError(error) && (
          <HostedAiCreditActions />
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
                onClick={(event) => setQuickCreateMenuAnchor(event.currentTarget)}
                aria-haspopup="menu"
                aria-expanded={quickCreateMenuOpen ? 'true' : undefined}
                sx={{
                  minHeight: 42,
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
              hasContext
                ? 'Ask anything'
                : 'Add study material before chatting'
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
