import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import type { StudyGuideRecord } from '../../cloud/types'
import type { StateDashboard, StudyPathContainerState } from '../../state/store'
import {
  normalizeQuickCreateActionInput,
  type QuickCreateActionInput,
} from '../../quickCreate/quickCreateActions'
import StudyPathWorkspaceView from '../Dasboard/StudyPathWorkspaceView'
import DashboardChatPanel, {
  type DashboardChatMessage,
} from '../dashboardChat/DashboardChatPanel'
import TopNavBar from '../topnavbar/TopNavBar'
import Main from '../Main'
import HostedAiIntroModal from '../hostedAi/HostedAiIntroModal'
import {
  appendStudyGuideMarkdownPage,
  createMarkdownStudyGuidePageLayout,
  getStudyGuideCreationSourceText,
  getStudyGuidePageText,
} from '../../studyGuides/pages'
import { appendAiQuickCreatePage } from '../../studyGuides/generation'
import {
  StudyGuideStorage,
  createStudyGuideRecord,
} from '../../studyGuides/storage'

const AI_CHAT_MIN_WIDTH = 420
const AI_CHAT_MAX_WIDTH = 720
const AI_CHAT_RAIL_WIDTH = 58

const normalizeGeneratedPageLayouts = (
  studyPath: StudyPathContainerState,
): StudyPathContainerState => {
  const count = studyPath.dashboards.length
  return {
    ...studyPath,
    dashboards: studyPath.dashboards.map((dashboard, index) => {
      const pageKey =
        dashboard.dashboardKey || `${studyPath.pathId}-${index + 1}`
      return {
        ...dashboard,
        dashboardKey: pageKey,
        dashboardIndex: index + 1,
        dashboardCount: count,
        createdBy: dashboard.createdBy || 'generator',
        deletable: dashboard.deletable ?? false,
        layout:
          dashboard.layout ||
          createMarkdownStudyGuidePageLayout({
            studyPath,
            pageKey,
            title: dashboard.name,
            markdown: `# ${dashboard.name}`,
            pageIndex: index + 1,
            pageCount: count,
          }),
      }
    }),
  }
}

const GuideWorkspacePage = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { studyGuideId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [record, setRecord] = useState<StudyGuideRecord | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [messages, setMessages] = useState<DashboardChatMessage[]>([])
  const [editingPageKey, setEditingPageKey] = useState<string | null>(null)
  const [quickCreateError, setQuickCreateError] = useState('')
  const [aiChatOpen, setAiChatOpen] = useState(true)
  const [aiChatWidth, setAiChatWidth] = useState(AI_CHAT_MIN_WIDTH)
  const [mobileSection, setMobileSection] = useState<'study-guide' | 'ai-chat'>(
    'study-guide',
  )
  const isCreateRoute = searchParams.get('create') === '1'

  const loadRecord = () => {
    if (!studyGuideId) {
      return
    }
    const existing = StudyGuideStorage.getById(studyGuideId)
    if (existing) {
      setRecord(existing)
      setNotFound(false)
      return
    }

    setRecord(null)
    setNotFound(!isCreateRoute)
    if (isCreateRoute) {
      navigate('/study-guides', { replace: true })
    }
  }

  useEffect(loadRecord, [studyGuideId, isCreateRoute])

  const dashboard = useMemo<StateDashboard | undefined>(() => {
    if (!record) {
      return undefined
    }

    return {
      id: record.id,
      name: record.title,
      kind: 'studyPathContainer',
      studyPath: record.studyPath,
    }
  }, [record])

  useEffect(() => {
    if (!record) {
      return
    }

    const currentPage =
      record.studyPath.dashboards[record.studyPath.selectedIndex] ||
      record.studyPath.dashboards[0]
    const pageKey = currentPage?.dashboardKey
    if (!pageKey || record.visitedPageKeys?.includes(pageKey)) {
      return
    }

    const nextRecord = StudyGuideStorage.save({
      ...record,
      visitedPageKeys: [...(record.visitedPageKeys || []), pageKey],
    })
    setRecord(nextRecord)
  }, [record?.id, record?.studyPath.selectedIndex])

  const persistStudyPath = (studyPath: StudyPathContainerState) => {
    const normalized = normalizeGeneratedPageLayouts(studyPath)
    const nextRecord = record
      ? StudyGuideStorage.save({
          ...record,
          title: normalized.title || record.title,
          folderName: normalized.folderName || record.folderName,
          studyPath: normalized,
        })
      : StudyGuideStorage.save(
          createStudyGuideRecord(normalized, {
            id: studyGuideId,
          }),
        )
    setRecord(nextRecord)
    return nextRecord
  }

  const appendMarkdownPage = (
    title: string,
    markdown: string,
    source: 'manual' | 'chat' | 'quickCreate',
  ) => {
    if (!record) {
      return
    }

    persistStudyPath(
      appendStudyGuideMarkdownPage(record.studyPath, {
        title,
        markdown,
        source,
      }),
    )
  }

  const addManualPage = () => {
    if (!record) {
      return
    }

    const nextStudyPath = appendStudyGuideMarkdownPage(record.studyPath, {
      title: 'Untitled page',
      markdown: '',
      source: 'manual',
    })
    const nextRecord = persistStudyPath(nextStudyPath)
    const newPage =
      nextRecord.studyPath.dashboards[nextRecord.studyPath.selectedIndex]
    setEditingPageKey(newPage?.dashboardKey || null)
  }

  const addAssistantMessageToGuide = (message: DashboardChatMessage) => {
    appendMarkdownPage('AI Chat note', message.content, 'chat')
  }

  const quickCreatePage = async (input: QuickCreateActionInput) => {
    if (!record) {
      return
    }

    const request = normalizeQuickCreateActionInput(input)
    setQuickCreateError('')
    const currentPage =
      record.studyPath.dashboards[record.studyPath.selectedIndex] ||
      record.studyPath.dashboards[0]
    const currentPageText = getStudyGuidePageText(currentPage)
    const studyGuideSourceText = getStudyGuideCreationSourceText(
      record.studyPath,
    )
    const useCurrentPage = request.sourceScope === 'currentPage'
    const sourceText = useCurrentPage
      ? currentPageText || studyGuideSourceText || record.studyPath.title
      : studyGuideSourceText ||
        currentPageText ||
        record.studyPath.title ||
        'Study Guide'
    const sourceTitle = useCurrentPage
      ? currentPage?.name || record.title
      : record.studyPath.title || record.title

    try {
      const nextStudyPath = await appendAiQuickCreatePage({
        studyPath: record.studyPath,
        resourceType: request.resourceType,
        sourceTitle,
        sourceText,
      })
      const nextRecord = persistStudyPath(nextStudyPath)
      const newPage =
        nextRecord.studyPath.dashboards[nextRecord.studyPath.selectedIndex]
      if (request.resourceType === 'improvedNotes') {
        setEditingPageKey(newPage?.dashboardKey || null)
      }
    } catch (error) {
      setQuickCreateError(
        error instanceof Error ? error.message : 'Could not create this page.',
      )
    }
  }

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

  const studyGuidePanel = record ? (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        borderRadius: isMobile ? 2 : 0,
        bgcolor: 'background.paper',
        position: 'relative',
        flex: 1,
      }}
    >
      <StudyPathWorkspaceView
        studyPath={record.studyPath}
        onStudyPathChange={persistStudyPath}
        mobileView
        editingPageKey={editingPageKey}
        onEditingPageKeyChange={setEditingPageKey}
        onAddPage={addManualPage}
      />
    </Paper>
  ) : null

  const chatPanel = record ? (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        borderRadius: isMobile ? 2 : 0,
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
        showCloseButton
        onAddAssistantMessageToGuide={addAssistantMessageToGuide}
        onQuickCreatePage={quickCreatePage}
        supportsStudyGuideCreateScope
      />
      {quickCreateError ? (
        <Alert
          severity="error"
          sx={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            maxWidth: 420,
            zIndex: 10,
          }}
        >
          {quickCreateError}
        </Alert>
      ) : null}
    </Paper>
  ) : null

  return (
    <Box
      sx={{
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TopNavBar creationHost="external" />
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
        {notFound ? (
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
                width: 'min(520px, 100%)',
                p: 4,
                borderRadius: 3,
                border: 1,
                borderColor: 'divider',
                textAlign: 'center',
              }}
            >
              <Typography variant="h5" fontWeight={900}>
                Study Guide not found
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                This guide does not exist on this device.
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/study-guides')}
              >
                Back to My Study Guides
              </Button>
            </Paper>
          </Box>
        ) : record ? (
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
            {isMobile ? (
              <>
                <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  {mobileSection === 'study-guide'
                    ? studyGuidePanel
                    : chatPanel}
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 0.75,
                    pt: 0.75,
                    pb: 'calc(0.75rem + env(safe-area-inset-bottom))',
                    bgcolor: 'background.default',
                    flex: '0 0 auto',
                  }}
                >
                  {[
                    ['study-guide', 'Study Guide'],
                    ['ai-chat', 'AI Chat'],
                  ].map(([key, label]) => (
                    <Button
                      key={key}
                      size="small"
                      variant={mobileSection === key ? 'contained' : 'outlined'}
                      onClick={() =>
                        setMobileSection(key as 'study-guide' | 'ai-chat')
                      }
                      sx={{ borderRadius: 999, textTransform: 'none' }}
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
                    <Tooltip title="Open AI Chat">
                      <Box
                        component="button"
                        type="button"
                        aria-label="Open AI Chat panel"
                        onClick={() => setAiChatOpen(true)}
                        sx={{
                          width: '100%',
                          height: '100%',
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 2,
                          bgcolor: 'background.paper',
                          color: 'primary.main',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 1,
                          py: 1,
                        }}
                      >
                        <IconButton size="small" tabIndex={-1}>
                          <ChatBubbleOutlineIcon fontSize="small" />
                        </IconButton>
                        <Typography
                          variant="caption"
                          sx={{ writingMode: 'vertical-rl', fontWeight: 900 }}
                        >
                          AI Chat
                        </Typography>
                      </Box>
                    </Tooltip>
                  )}
                  {aiChatOpen ? (
                    <Box
                      role="separator"
                      aria-label="Resize AI Chat panel"
                      onMouseDown={startAiChatResize}
                      sx={{
                        position: 'absolute',
                        top: 14,
                        left: -3,
                        width: 8,
                        height: 'calc(100% - 28px)',
                        cursor: 'col-resize',
                        zIndex: 2,
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: 3,
                          width: 2,
                          borderRadius: 999,
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
        ) : null}
        <HostedAiIntroModal />
      </Main>
    </Box>
  )
}

export default GuideWorkspacePage
