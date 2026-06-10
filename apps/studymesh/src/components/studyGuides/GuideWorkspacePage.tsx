import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Paper,
  Typography,
} from '@mui/material'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import type { StudyGuideRecord } from '../../cloud/types'
import type { StateDashboard, StudyPathContainerState } from '../../state/store'
import type { StudyMaterialResourceType } from '../../studyPack/ai'
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
  getStudyGuidePageText,
} from '../../studyGuides/pages'
import { appendAiQuickCreatePage } from '../../studyGuides/generation'
import {
  StudyGuideStorage,
  createStudyGuideRecord,
} from '../../studyGuides/storage'

const normalizeGeneratedPageLayouts = (
  studyPath: StudyPathContainerState,
): StudyPathContainerState => {
  const count = studyPath.dashboards.length
  return {
    ...studyPath,
    dashboards: studyPath.dashboards.map((dashboard, index) => {
      const pageKey = dashboard.dashboardKey || `${studyPath.pathId}-${index + 1}`
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
  const { studyGuideId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [record, setRecord] = useState<StudyGuideRecord | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [messages, setMessages] = useState<DashboardChatMessage[]>([])
  const [editingPageKey, setEditingPageKey] = useState<string | null>(null)
  const [quickCreateError, setQuickCreateError] = useState('')
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

  const persistStudyPath = (studyPath: StudyPathContainerState) => {
    const normalized = normalizeGeneratedPageLayouts(studyPath)
    const nextRecord = record
      ? StudyGuideStorage.save({
          ...record,
          title: normalized.title || record.title,
          folderName: normalized.folderName || record.folderName,
          studyPath: normalized,
        })
      : StudyGuideStorage.save(createStudyGuideRecord(normalized, {
          id: studyGuideId,
        }))
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
      markdown: '# Untitled page\n\n',
      source: 'manual',
    })
    const nextRecord = persistStudyPath(nextStudyPath)
    const newPage = nextRecord.studyPath.dashboards[nextRecord.studyPath.selectedIndex]
    setEditingPageKey(newPage?.dashboardKey || null)
  }

  const addAssistantMessageToGuide = (message: DashboardChatMessage) => {
    appendMarkdownPage('AI Chat note', message.content, 'chat')
  }

  const quickCreatePage = async (resourceType: StudyMaterialResourceType) => {
    if (!record) {
      return
    }

    setQuickCreateError('')
    const currentPage =
      record.studyPath.dashboards[record.studyPath.selectedIndex] ||
      record.studyPath.dashboards[0]
    const sourceText =
      getStudyGuidePageText(currentPage) ||
      record.studyPath.title ||
      'Study Guide'

    try {
      const nextStudyPath = await appendAiQuickCreatePage({
        studyPath: record.studyPath,
        resourceType,
        sourceTitle: currentPage?.name || record.title,
        sourceText,
      })
      const nextRecord = persistStudyPath(nextStudyPath)
      const newPage =
        nextRecord.studyPath.dashboards[nextRecord.studyPath.selectedIndex]
      if (resourceType === 'improvedNotes') {
        setEditingPageKey(newPage?.dashboardKey || null)
      }
    } catch (error) {
      setQuickCreateError(
        error instanceof Error
          ? error.message
          : 'Could not create this page.',
      )
    }
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
              display: { xs: 'flex', md: 'grid' },
              flexDirection: { xs: 'column', md: 'row' },
              gridTemplateColumns: { md: 'minmax(0, 1fr) 420px' },
              gap: { md: 1 },
              p: 1,
              bgcolor: 'background.default',
              overflow: 'hidden',
            }}
          >
            <Paper
              elevation={0}
              sx={{
                height: { xs: '58%', md: '100%' },
                minHeight: 0,
                overflow: 'hidden',
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: 'background.paper',
                position: 'relative',
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
            <Paper
              elevation={0}
              sx={{
                mt: { xs: 1, md: 0 },
                height: { xs: 'calc(42% - 8px)', md: '100%' },
                minHeight: 0,
                overflow: 'hidden',
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: 'background.paper',
                position: 'relative',
              }}
            >
              <DashboardChatPanel
                dashboard={dashboard}
                messages={messages}
                onMessagesChange={setMessages}
                onClose={() => undefined}
                showCloseButton={false}
                onAddAssistantMessageToGuide={addAssistantMessageToGuide}
                onQuickCreatePage={quickCreatePage}
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
          </Box>
        ) : null}
        <HostedAiIntroModal />
      </Main>
    </Box>
  )
}

export default GuideWorkspacePage
