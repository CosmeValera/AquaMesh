import React, { useEffect, useMemo, useState } from 'react'
import { Box, Button, Paper, Stack, Tab, Tabs, Typography } from '@mui/material'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'

import type { StateDashboard, StudyPathContainerState } from '../../state/store'
import { appendStudyGuideMarkdownPage } from '../../studyGuides/pages'
import { StudyGuideStorage } from '../../studyGuides/storage'
import { STUDYMESH_GUIDE_STUDY_PATH_ID } from '../../studyGuides/studyMeshGuideSeed'
import { ensureStarterDashboards } from '../../customHooks/useWorkspaceActions'
import {
  ASK_DASHBOARD_CHAT_EVENT,
  CLOSE_DASHBOARD_CHAT_EVENT,
  OPEN_DASHBOARD_CHAT_EVENT,
} from '../workspace/workspaceEvents'
import { useResponsiveWorkspaceMode } from '../workspace/useResponsiveWorkspaceMode'
import DashboardChatPanel, {
  DashboardChatMessage,
} from '../dashboardChat/DashboardChatPanel'
import { useDashboards } from './DashboardProvider'
import StudyPathWorkspaceView from './StudyPathWorkspaceView'
import { useInterfaceText } from '../../language/interfaceLanguage'
import './tabs.scss'

const DEFAULT_STUDY_PATH_OPENED_KEY = 'studymesh-default-study-path-opened-v1'

const isStudyGuideDashboard = (
  dashboard: StateDashboard | undefined,
): dashboard is StateDashboard & { studyPath: StudyPathContainerState } =>
  dashboard?.kind === 'studyPathContainer' && Boolean(dashboard.studyPath)

const Dashboards = () => {
  const { t } = useInterfaceText()
  const { isPhoneOrTablet: isMobileDashboardView } =
    useResponsiveWorkspaceMode()
  const {
    openDashboards,
    selectedDashboard,
    setSelectedDashboard,
    removeDashboard,
    addStudyPathContainer,
    updateStudyPathContainer,
  } = useDashboards()
  const [dashboardChatOpen, setDashboardChatOpen] = useState(false)
  const [dashboardChatMessages, setDashboardChatMessages] = useState<
    Record<string, DashboardChatMessage[]>
  >({})
  const [queuedChatQuestion, setQueuedChatQuestion] = useState<{
    id: string
    content: string
  } | null>(null)
  const [editingPageKeys, setEditingPageKeys] = useState<
    Record<string, string | null>
  >({})

  const currentDashboard = openDashboards[selectedDashboard]
  const currentDashboardId = currentDashboard?.id

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const hasOpenGuide = openDashboards.some(isStudyGuideDashboard)
    if (hasOpenGuide || localStorage.getItem(DEFAULT_STUDY_PATH_OPENED_KEY)) {
      return
    }

    ensureStarterDashboards()
    const guide = StudyGuideStorage.getById(STUDYMESH_GUIDE_STUDY_PATH_ID)
    if (guide) {
      addStudyPathContainer(guide.studyPath)
      localStorage.setItem(DEFAULT_STUDY_PATH_OPENED_KEY, 'true')
    }
  }, [addStudyPathContainer, openDashboards])

  const studyGuideTabs = useMemo(
    () => openDashboards.filter(isStudyGuideDashboard),
    [openDashboards],
  )

  const selectedStudyGuideIndex = studyGuideTabs.findIndex(
    (dashboard) => dashboard.id === currentDashboardId,
  )

  const updateStudyGuide = (
    dashboardId: string,
    studyPath: StudyPathContainerState,
  ) => {
    updateStudyPathContainer(dashboardId, () => studyPath)
    StudyGuideStorage.saveWithId(studyPath.pathId, studyPath)
  }

  const addPage = (dashboardId: string, studyPath: StudyPathContainerState) => {
    const nextStudyPath = appendStudyGuideMarkdownPage(studyPath, {
      title: `Page ${studyPath.dashboards.length + 1}`,
      markdown: '',
      source: 'manual',
    })
    const pageKey =
      nextStudyPath.dashboards[nextStudyPath.selectedIndex]?.dashboardKey ||
      null

    updateStudyGuide(dashboardId, nextStudyPath)
    setEditingPageKeys((current) => ({
      ...current,
      [dashboardId]: pageKey,
    }))
  }

  const setMessagesForDashboard = (messages: DashboardChatMessage[]) => {
    if (!currentDashboardId) {
      return
    }

    setDashboardChatMessages((current) => ({
      ...current,
      [currentDashboardId]: messages,
    }))
  }

  const askDashboardChat = (content: string) => {
    setDashboardChatOpen(true)
    setQueuedChatQuestion({
      id: `quiz-explain-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      content,
    })
  }

  useEffect(() => {
    const openDashboardChat = () => setDashboardChatOpen(true)
    const closeDashboardChat = () => setDashboardChatOpen(false)
    const askDashboardChatFromEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ content?: unknown }>).detail
      if (typeof detail?.content !== 'string' || !detail.content.trim()) {
        setDashboardChatOpen(true)
        return
      }

      if (dashboardChatOpen) {
        return
      }

      askDashboardChat(detail.content)
    }

    window.addEventListener(OPEN_DASHBOARD_CHAT_EVENT, openDashboardChat)
    window.addEventListener(CLOSE_DASHBOARD_CHAT_EVENT, closeDashboardChat)
    window.addEventListener(ASK_DASHBOARD_CHAT_EVENT, askDashboardChatFromEvent)

    return () => {
      window.removeEventListener(OPEN_DASHBOARD_CHAT_EVENT, openDashboardChat)
      window.removeEventListener(CLOSE_DASHBOARD_CHAT_EVENT, closeDashboardChat)
      window.removeEventListener(
        ASK_DASHBOARD_CHAT_EVENT,
        askDashboardChatFromEvent,
      )
    }
  }, [dashboardChatOpen])

  const closeDashboard = (dashboardId: string) => {
    removeDashboard(dashboardId)
    setDashboardChatMessages((current) => {
      const nextMessages = { ...current }
      delete nextMessages[dashboardId]
      return nextMessages
    })
    setEditingPageKeys((current) => {
      const nextKeys = { ...current }
      delete nextKeys[dashboardId]
      return nextKeys
    })
  }

  return (
    <Box
      sx={{
        minHeight: 0,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      {studyGuideTabs.length > 1 ? (
        <Box
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
            minHeight: 48,
            px: 1,
          }}
        >
          <Tabs
            value={Math.max(0, selectedStudyGuideIndex)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ flex: 1, minWidth: 0 }}
          >
            {studyGuideTabs.map((dashboard) => {
              const dashboardIndex = openDashboards.findIndex(
                (openDashboard) => openDashboard.id === dashboard.id,
              )
              return (
                <Tab
                  key={dashboard.id}
                  label={dashboard.name}
                  onClick={() => setSelectedDashboard(dashboardIndex)}
                  onAuxClick={() => closeDashboard(dashboard.id)}
                />
              )
            })}
          </Tabs>
        </Box>
      ) : null}

      <Box
        sx={{
          minHeight: 0,
          flex: 1,
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ minWidth: 0, minHeight: 0, flex: 1, overflow: 'hidden' }}>
          {isStudyGuideDashboard(currentDashboard) ? (
            <StudyPathWorkspaceView
              studyPath={currentDashboard.studyPath}
              onStudyPathChange={(studyPath) =>
                updateStudyGuide(currentDashboard.id, studyPath)
              }
              mobileView={isMobileDashboardView}
              editingPageKey={editingPageKeys[currentDashboard.id] || null}
              onEditingPageKeyChange={(pageKey) =>
                setEditingPageKeys((current) => ({
                  ...current,
                  [currentDashboard.id]: pageKey,
                }))
              }
              onAddPage={() =>
                addPage(currentDashboard.id, currentDashboard.studyPath)
              }
              onAskAi={askDashboardChat}
            />
          ) : (
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 3,
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  maxWidth: 520,
                  p: 3,
                  border: 1,
                  borderColor: 'divider',
                  textAlign: 'center',
                }}
              >
                <Stack spacing={2} alignItems="center">
                  <MenuBookOutlinedIcon color="primary" fontSize="large" />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {t('workspace.openStudyGuideTitle')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('workspace.openStudyGuideBody')}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    onClick={() => {
                      ensureStarterDashboards()
                      const guide = StudyGuideStorage.getById(
                        STUDYMESH_GUIDE_STUDY_PATH_ID,
                      )
                      if (guide) {
                        addStudyPathContainer(guide.studyPath)
                      }
                    }}
                  >
                    {t('workspace.openWelcomeGuide')}
                  </Button>
                </Stack>
              </Paper>
            </Box>
          )}
        </Box>

        {dashboardChatOpen ? (
          <Box
            sx={{
              width: isMobileDashboardView ? '100%' : 420,
              maxWidth: '100%',
              height: '100%',
              borderLeft: isMobileDashboardView ? 0 : 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              position: isMobileDashboardView ? 'absolute' : 'relative',
              inset: isMobileDashboardView ? 0 : undefined,
              zIndex: 4,
            }}
          >
            <DashboardChatPanel
              dashboard={currentDashboard}
              messages={
                currentDashboardId
                  ? dashboardChatMessages[currentDashboardId] || []
                  : []
              }
              onMessagesChange={setMessagesForDashboard}
              onClose={() => setDashboardChatOpen(false)}
              showCloseButton={!isMobileDashboardView}
              supportsStudyGuideCreateScope={isStudyGuideDashboard(
                currentDashboard,
              )}
              queuedQuestion={queuedChatQuestion}
              onQueuedQuestionConsumed={(id) =>
                setQueuedChatQuestion((current) =>
                  current?.id === id ? null : current,
                )
              }
            />
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}

export default Dashboards
