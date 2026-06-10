import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import type { StudyGuideRecord } from '../../cloud/types'
import type { StateDashboard, StudyPathContainerState } from '../../state/store'
import {
  createStudyPackDashboardLayout,
  createStudyPackOrchestratorWidgets,
  type StudyPackDashboardLayoutMode,
} from '../../studyPack'
import type { StudyMaterialResourceType } from '../../studyPack/ai'
import { createStudyPathContainerState } from '../Dasboard/studyPathContainer'
import StudyPathWorkspaceView from '../Dasboard/StudyPathWorkspaceView'
import DashboardChatPanel, {
  type DashboardChatMessage,
} from '../dashboardChat/DashboardChatPanel'
import CreateStudyPathModal from '../studyPack/CreateStudyPathModal'
import TopNavBar from '../topnavbar/TopNavBar'
import Main from '../Main'
import HostedAiIntroModal from '../hostedAi/HostedAiIntroModal'
import {
  appendStudyGuideMarkdownPage,
  createMarkdownStudyGuidePageLayout,
} from '../../studyGuides/pages'
import {
  StudyGuideStorage,
  createStudyGuideRecord,
} from '../../studyGuides/storage'

type CreatePathPayload = {
  folderName: string
  openInWorkspace?: boolean
  dashboards: Array<{
    name: string
    widgets: ReturnType<typeof createStudyPackOrchestratorWidgets>
    layoutMode?: StudyPackDashboardLayoutMode
    folderName: string
  }>
}

const emptyStudyPath = (id: string): StudyPathContainerState => ({
  pathId: id,
  title: 'Study Guide',
  folderName: 'Study Guide',
  dashboards: [],
  selectedIndex: 0,
  pinnedDashboardKeys: [],
})

const quickCreateCopy: Record<StudyMaterialResourceType, string> = {
  quiz: '## Quiz\n\nUse this page to turn the current lesson into exam-style questions.',
  flashcards:
    '## Flashcards\n\nUse this page to turn the current lesson into active-recall cards.',
  improvedNotes:
    '## Expanded notes\n\nUse this page to expand and clarify the current lesson.',
}

const buildStudyPathFromPayload = (
  id: string,
  payload: CreatePathPayload,
): StudyPathContainerState => {
  const now = new Date().toISOString()
  const dashboards = payload.dashboards.map((dashboard, index) => ({
    id: `${id}-dashboard-${index + 1}`,
    name: dashboard.name,
    folder: dashboard.folderName || payload.folderName,
    layout: createStudyPackDashboardLayout(dashboard.widgets, {
      mode: dashboard.layoutMode || 'smart',
    }),
    createdAt: now,
    updatedAt: now,
  }))
  const generatedStudyPath =
    createStudyPathContainerState(dashboards) || emptyStudyPath(id)
  const title =
    generatedStudyPath.title || payload.folderName || dashboards[0]?.name ||
    'Study Guide'
  const folderName = payload.folderName || generatedStudyPath.folderName || title
  const count = generatedStudyPath.dashboards.length

  return {
    ...generatedStudyPath,
    pathId: id,
    title,
    folderName,
    selectedIndex: 0,
    dashboards: generatedStudyPath.dashboards.map((dashboard, index) => ({
      ...dashboard,
      dashboardKey: `${id}-${index + 1}`,
      dashboardIndex: index + 1,
      dashboardCount: count,
      folderName,
      createdBy: 'generator',
      deletable: false,
    })),
  }
}

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
  const [createOpen, setCreateOpen] = useState(false)
  const [addPageOpen, setAddPageOpen] = useState(false)
  const [pageTitle, setPageTitle] = useState('')
  const [pageMarkdown, setPageMarkdown] = useState('')
  const [messages, setMessages] = useState<DashboardChatMessage[]>([])
  const isCreateRoute = searchParams.get('create') === '1'

  const loadRecord = () => {
    if (!studyGuideId) {
      return
    }
    const existing = StudyGuideStorage.getById(studyGuideId)
    if (existing) {
      setRecord(existing)
      setNotFound(false)
      setCreateOpen(false)
      return
    }

    setRecord(null)
    setNotFound(!isCreateRoute)
    setCreateOpen(isCreateRoute)
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
  }

  const createStudyGuide = (payload: CreatePathPayload) => {
    const studyPath = buildStudyPathFromPayload(studyGuideId, payload)
    const nextRecord = StudyGuideStorage.save(
      createStudyGuideRecord(studyPath, { id: studyGuideId }),
    )
    setRecord(nextRecord)
    setCreateOpen(false)
    navigate(`/workspace/${studyGuideId}`, { replace: true })
  }

  const cancelCreate = () => {
    setCreateOpen(false)
    if (!record) {
      navigate('/study-guides', { replace: true })
    }
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

  const saveManualPage = () => {
    appendMarkdownPage(pageTitle, pageMarkdown, 'manual')
    setPageTitle('')
    setPageMarkdown('')
    setAddPageOpen(false)
  }

  const addAssistantMessageToGuide = (message: DashboardChatMessage) => {
    appendMarkdownPage('AI Chat note', message.content, 'chat')
  }

  const quickCreatePage = (resourceType: StudyMaterialResourceType) => {
    const labels: Record<StudyMaterialResourceType, string> = {
      quiz: 'Quiz',
      flashcards: 'Flashcards',
      improvedNotes: 'Expanded notes',
    }
    appendMarkdownPage(
      labels[resourceType],
      quickCreateCopy[resourceType],
      'quickCreate',
    )
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
              display: { xs: 'block', md: 'grid' },
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
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddPageOpen(true)}
                sx={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  zIndex: 9,
                  borderRadius: 2,
                  textTransform: 'none',
                }}
              >
                Add Page
              </Button>
              <StudyPathWorkspaceView
                studyPath={record.studyPath}
                onStudyPathChange={persistStudyPath}
                mobileView
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
            </Paper>
          </Box>
        ) : null}
        <HostedAiIntroModal />
      </Main>

      <CreateStudyPathModal
        open={createOpen}
        onClose={cancelCreate}
        onCreatePath={createStudyGuide}
        openGeneratedInWorkspace
      />

      <Dialog open={addPageOpen} onClose={() => setAddPageOpen(false)}>
        <DialogTitle>Add Page</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, minWidth: { xs: 280, sm: 520 } }}>
            <TextField
              autoFocus
              label="Page title"
              value={pageTitle}
              onChange={(event) => setPageTitle(event.target.value)}
              fullWidth
            />
            <TextField
              label="Markdown"
              value={pageMarkdown}
              onChange={(event) => setPageMarkdown(event.target.value)}
              fullWidth
              multiline
              minRows={8}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddPageOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={saveManualPage}
            disabled={!pageTitle.trim() && !pageMarkdown.trim()}
          >
            Add Page
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default GuideWorkspacePage
