import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../../auth/AuthProvider'
import type { StateDashboard, StudyPathContainerState } from '../../state/store'
import type { QuickCreateActionRequest } from '../../quickCreate/quickCreateActions'
import StudyPathWorkspaceView from '../Dasboard/StudyPathWorkspaceView'
import StudyGuidePagesPanel from '../Dasboard/StudyGuidePagesPanel'
import DashboardChatPanel, {
  type DashboardChatMessage,
} from '../dashboardChat/DashboardChatPanel'
import Main from '../Main'
import {
  OPEN_STUDY_GUIDE_PAGE_LINK_EVENT,
  type OpenStudyGuidePageLinkDetail,
} from '../../studyGuides/pageLinks'
import { findDemoGuide } from '../../demo/demoGuides'
import { useDemoGuide } from '../../demo/useDemoGuide'
import {
  appendDemoBonusPage,
  buildDemoStudyPath,
} from '../../demo/demoStudyPath'
import {
  DEMO_CHAT_ANSWER_DELAY_MS,
  type DemoBonusActionId,
} from '../../demo/types'
import { useInterfaceText } from '../../language/interfaceLanguage'
import DemoTopNavBar from './DemoTopNavBar'
import DemoConversionBanner from './DemoConversionBanner'
import DemoSignupNudge, { type DemoNudgeReason } from './DemoSignupNudge'

const AI_CHAT_MIN_WIDTH = 310
const AI_CHAT_MAX_WIDTH = 720
const AI_CHAT_RAIL_WIDTH = 58

const isBonusActionId = (value: string): value is DemoBonusActionId =>
  value === 'quiz' || value === 'flashcards' || value === 'podcast'

/**
 * Rejects with an AbortError so a cancelled demo Quick Create unwinds exactly
 * like a cancelled real one: `runQuickCreate` already swallows that name.
 */
const abortableDelay = (durationMs: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const handleAbort = () => {
      window.clearTimeout(timeout)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    const timeout = window.setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, durationMs)

    signal?.addEventListener('abort', handleAbort, { once: true })
  })

const normalizeQuestion = (value: string): string =>
  value.replace(/\s+/g, ' ').trim().toLowerCase()

const DemoGuidePage = () => {
  const { t } = useInterfaceText()
  const { user } = useAuth()
  const { demoSlug = '' } = useParams()
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'))
  const guide = useMemo(() => findDemoGuide(demoSlug), [demoSlug])
  const { content, loading, failed } = useDemoGuide(guide)
  const [studyPath, setStudyPath] = useState<StudyPathContainerState | null>(
    null,
  )
  const [unlocked, setUnlocked] = useState<DemoBonusActionId[]>([])
  const [messages, setMessages] = useState<DashboardChatMessage[]>([])
  const [editingPageKey, setEditingPageKey] = useState<string | null>(null)
  const [nudgeReason, setNudgeReason] = useState<DemoNudgeReason | null>(null)
  const [aiChatOpen, setAiChatOpen] = useState(true)
  const [aiChatWidth, setAiChatWidth] = useState(AI_CHAT_MIN_WIDTH)
  const [mobileSection, setMobileSection] = useState<
    'pages' | 'study-guide' | 'ai-chat'
  >('study-guide')
  const pageScrollPositionsRef = useRef<Record<string, number>>({})
  const unlockedRef = useRef<DemoBonusActionId[]>([])
  const runningActionsRef = useRef(new Set<DemoBonusActionId>())

  useEffect(() => {
    unlockedRef.current = unlocked
  }, [unlocked])

  useEffect(() => {
    if (!guide || !content) {
      return
    }

    setUnlocked([])
    setStudyPath(buildDemoStudyPath(content))
  }, [content, guide])

  const openStudyGuidePageKey = (dashboardKey: string) => {
    setStudyPath((current) => {
      const pageIndex =
        current?.dashboards.findIndex(
          (dashboard) => dashboard.dashboardKey === dashboardKey,
        ) ?? -1

      if (!current || pageIndex < 0) {
        return current
      }

      return { ...current, selectedIndex: pageIndex }
    })
    setMobileSection('study-guide')
  }

  useEffect(() => {
    const handleStudyGuidePageLink = (event: Event) => {
      const detail = (event as CustomEvent<OpenStudyGuidePageLinkDetail>).detail
      if (!detail?.dashboardKey) {
        return
      }

      openStudyGuidePageKey(detail.dashboardKey)
    }

    window.addEventListener(
      OPEN_STUDY_GUIDE_PAGE_LINK_EVENT,
      handleStudyGuidePageLink,
    )

    return () => {
      window.removeEventListener(
        OPEN_STUDY_GUIDE_PAGE_LINK_EVENT,
        handleStudyGuidePageLink,
      )
    }
  }, [])

  const runDemoQuickCreate = async (
    request: QuickCreateActionRequest,
    options?: { signal?: AbortSignal },
  ) => {
    const actionId = request.actionId
    if (!content || !isBonusActionId(actionId)) {
      setNudgeReason('expandOnThis')
      return
    }

    const bonus = content.bonusPages.find(
      (candidate) => candidate.actionId === actionId,
    )
    if (!bonus) {
      setNudgeReason('expandOnThis')
      return
    }

    if (
      unlockedRef.current.includes(actionId) ||
      runningActionsRef.current.has(actionId)
    ) {
      setNudgeReason('alreadyCreated')
      return
    }

    runningActionsRef.current.add(actionId)
    try {
      await abortableDelay(bonus.durationMs, options?.signal)
    } finally {
      runningActionsRef.current.delete(actionId)
    }

    setUnlocked((current) =>
      current.includes(actionId) ? current : [...current, actionId],
    )
    setStudyPath((current) =>
      current ? appendDemoBonusPage(current, bonus.page) : current,
    )
    setMobileSection('study-guide')
  }

  const suggestionOverrides = useMemo(
    () =>
      (content?.chat || []).map((exchange) => ({
        id: exchange.id,
        label: exchange.chip,
        question: exchange.question,
      })),
    [content],
  )

  const resolveCannedAnswer = async (question: string) => {
    const asked = normalizeQuestion(question)
    const exchange = content?.chat.find(
      (candidate) =>
        normalizeQuestion(candidate.question) === asked ||
        normalizeQuestion(candidate.chip) === asked,
    )

    await abortableDelay(exchange?.answerDelayMs ?? DEMO_CHAT_ANSWER_DELAY_MS)

    // Never null: null falls through to the real network path, and the demo
    // must not be able to make a request.
    return exchange?.answer || t('demo.chatUnknownQuestion')
  }

  const dashboard = useMemo<StateDashboard | undefined>(
    () =>
      studyPath
        ? {
          id: studyPath.pathId,
          name: studyPath.title,
          kind: 'studyPathContainer',
          studyPath,
        }
        : undefined,
    [studyPath],
  )

  const pageCount = studyPath?.dashboards.length ?? 0
  const isLastPage = pageCount > 1 && studyPath?.selectedIndex === pageCount - 1

  const startAiChatResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = aiChatWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const availableWidth = Math.max(
        AI_CHAT_MIN_WIDTH,
        window.innerWidth - 520,
      )
      const maxWidth = Math.min(AI_CHAT_MAX_WIDTH, availableWidth)
      const nextWidth = Math.max(
        AI_CHAT_MIN_WIDTH,
        Math.min(maxWidth, startWidth + startX - moveEvent.clientX),
      )
      setAiChatWidth(nextWidth)
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

  const studyGuidePanel = studyPath ? (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        border: isMobile ? 1 : 0,
        borderColor: 'divider',
        borderRadius: isMobile ? 1.5 : 0,
        bgcolor: 'background.paper',
        position: 'relative',
        flex: 1,
      }}
    >
      <StudyPathWorkspaceView
        studyPath={studyPath}
        onStudyPathChange={setStudyPath}
        pageScrollPositionsRef={pageScrollPositionsRef}
        editingPageKey={editingPageKey}
        onEditingPageKeyChange={setEditingPageKey}
        onAddPage={() => setNudgeReason('addPage')}
        onAskAi={() => setNudgeReason('askAi')}
        breadcrumb={{
          label: t('demo.breadcrumb'),
          onClick: () => navigate('/try'),
        }}
      />
    </Paper>
  ) : null

  const pagesPanel = studyPath ? (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        position: 'relative',
        display: 'flex',
      }}
    >
      <StudyGuidePagesPanel
        studyPath={studyPath}
        onStudyPathChange={setStudyPath}
        onPageSelected={() => setMobileSection('study-guide')}
        onAddPage={() => setNudgeReason('addPage')}
        variant="mobile"
      />
    </Paper>
  ) : null

  // onAddAssistantMessageToGuide and onAddExternalSourceToGuide are omitted on
  // purpose, so those actions disappear instead of leaving dead buttons.
  const chatPanel = studyPath ? (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        border: isMobile ? 1 : 0,
        borderColor: 'divider',
        borderRadius: isMobile ? 1.5 : 0,
        bgcolor: 'background.paper',
        position: 'relative',
      }}
    >
      <DashboardChatPanel
        dashboard={dashboard}
        messages={messages}
        onMessagesChange={setMessages}
        onClose={() =>
          isMobile ? setMobileSection('study-guide') : setAiChatOpen(false)
        }
        showCloseButton={!isMobile}
        onOpenSource={(source) => {
          if (source.dashboardKey) {
            openStudyGuidePageKey(source.dashboardKey)
          }
        }}
        onQuickCreatePage={runDemoQuickCreate}
        supportsStudyGuideCreateScope
        composerReadOnly
        composerReadOnlyHint={t('demo.composerLockedHint')}
        hideCreditCosts
        suggestionOverrides={suggestionOverrides}
        resolveCannedAnswer={resolveCannedAnswer}
      />
    </Paper>
  ) : null

  if (!guide || failed) {
    return <Navigate to="/try" replace />
  }

  if (user) {
    return <Navigate to="/study-guides" replace />
  }

  return (
    <Box
      sx={{
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <DemoTopNavBar />
      <Main
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          height: 'auto',
          marginTop: 0,
          overflow: 'hidden',
          p: 0,
        }}
      >
        {studyPath ? (
          <Box
            sx={{
              height: '100%',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              p: isMobile ? 1 : 0,
              bgcolor: 'background.default',
              overflow: 'hidden',
            }}
          >
            {/* Keyed on the guide: opening a different sample is a fresh
                visit, so the closing message starts unshown again. */}
            <DemoConversionBanner key={demoSlug} isLastPage={isLastPage} />
            {isMobile ? (
              <>
                <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  {mobileSection === 'pages'
                    ? pagesPanel
                    : mobileSection === 'study-guide'
                      ? studyGuidePanel
                      : chatPanel}
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 0.75,
                    pt: 0.75,
                    pb: 'calc(0.75rem + env(safe-area-inset-bottom))',
                    bgcolor: 'background.default',
                    flex: '0 0 auto',
                  }}
                >
                  {[
                    ['pages', t('workspace.pages')],
                    ['study-guide', t('workspace.studyGuide')],
                    ['ai-chat', t('workspace.aiChat')],
                  ].map(([key, label]) => (
                    <Button
                      key={key}
                      size="small"
                      variant={mobileSection === key ? 'contained' : 'outlined'}
                      onClick={() =>
                        setMobileSection(
                          key as 'pages' | 'study-guide' | 'ai-chat',
                        )
                      }
                      sx={{ borderRadius: 1, textTransform: 'none' }}
                    >
                      {label}
                    </Button>
                  ))}
                </Box>
              </>
            ) : (
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  gap: 0,
                  overflow: 'hidden',
                }}
              >
                {studyGuidePanel}
                <Box
                  sx={{
                    width: aiChatOpen ? aiChatWidth : AI_CHAT_RAIL_WIDTH,
                    flex: '0 0 auto',
                    minHeight: 0,
                    overflow: 'hidden',
                    position: 'relative',
                    transition: theme.transitions.create('width', {
                      duration: theme.transitions.duration.shorter,
                    }),
                  }}
                >
                  {aiChatOpen ? (
                    chatPanel
                  ) : (
                    <Tooltip title={t('topnav.openAiChat')}>
                      <Box
                        component="button"
                        type="button"
                        aria-label={t('workspace.openAiChatPanel')}
                        onClick={() => setAiChatOpen(true)}
                        sx={{
                          width: '100%',
                          height: '100%',
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 0,
                          bgcolor: 'background.paper',
                          color: 'text.secondary',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 0.75,
                          py: 1,
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            width: 32,
                            height: 32,
                            display: 'grid',
                            placeItems: 'center',
                            color: 'primary.main',
                          }}
                        >
                          <ChatBubbleOutlineIcon fontSize="small" />
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{
                            writingMode: 'vertical-rl',
                            fontWeight: 500,
                            color: 'primary.main',
                          }}
                        >
                          {t('workspace.aiChat')}
                        </Typography>
                      </Box>
                    </Tooltip>
                  )}
                  {aiChatOpen ? (
                    <Box
                      role="separator"
                      aria-label={t('workspace.resizeAiChat')}
                      onMouseDown={startAiChatResize}
                      sx={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        width: 8,
                        cursor: 'col-resize',
                        zIndex: 2,
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: 0,
                          width: 2,
                          borderRadius: 1,
                          bgcolor: 'divider',
                        },
                        '&:hover::after': { bgcolor: 'primary.main' },
                      }}
                    />
                  ) : null}
                </Box>
              </Box>
            )}
          </Box>
        ) : loading ? (
          <Box
            sx={{
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'background.default',
              p: 2,
            }}
          >
            <Paper
              elevation={0}
              sx={{
                width: 'min(420px, 100%)',
                p: 4,
                borderRadius: 3,
                border: 1,
                borderColor: 'divider',
                textAlign: 'center',
              }}
            >
              <CircularProgress size={28} />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                {t('demo.loadingGuide')}
              </Typography>
            </Paper>
          </Box>
        ) : null}
      </Main>
      <DemoSignupNudge
        reason={nudgeReason}
        onClose={() => setNudgeReason(null)}
      />
    </Box>
  )
}

export default DemoGuidePage
