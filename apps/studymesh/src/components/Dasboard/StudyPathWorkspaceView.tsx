import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import {
  DashboardLayout,
  StudyPathContainerState,
} from '../../state/store'
import {
  deleteStudyGuidePage,
  getStudyGuidePageMarkdown,
  isEditableMarkdownStudyGuidePage,
  reorderStudyGuidePage,
  updateStudyGuideMarkdownPage,
} from '../../studyGuides/pages'
import StudyGuideLinearLayout from './StudyGuideLinearLayout'
import AddIcon from '@mui/icons-material/Add'
import { renderMarkdown } from '../WidgetEditor/components/preview/StudyBlockView'

const STUDY_PATH_NAV_OPEN_STORAGE_KEY = 'studymesh-study-path-navigator-open-v2'
const LEGACY_STUDY_PATH_NAV_OPEN_STORAGE_KEY =
  'aquamesh-study-path-navigator-open-v2'
const STUDY_PATH_NAV_DOCK_STORAGE_KEY = 'studymesh-study-path-navigator-dock-v1'
const LEGACY_STUDY_PATH_NAV_DOCK_STORAGE_KEY =
  'aquamesh-study-path-navigator-dock-v1'
const NAVIGATOR_PANEL_WIDTH = 318

type NavigatorDock = 'left' | 'right'

interface StudyPathWorkspaceViewProps {
  studyPath: StudyPathContainerState
  onStudyPathChange: (studyPath: StudyPathContainerState) => void
  mobileView?: boolean
  editingPageKey?: string | null
  onEditingPageKeyChange?: (pageKey: string | null) => void
  onAddPage?: () => void
}

const sanitizeStudentWidgetName = (name?: string): string | undefined => {
  if (!name) {
    return name
  }

  if (/\bmisc\b/i.test(name)) {
    return 'Extra practice'
  }

  return name.replace(/\s*\(?\d+\s+(study\s+)?objects?\)?/gi, '').trim() || name
}

const sanitizeStudentComponent = (component: unknown): unknown => {
  if (typeof component !== 'object' || component === null) {
    return component
  }

  const record = component as Record<string, unknown>
  const props =
    typeof record.props === 'object' && record.props !== null
      ? ({ ...(record.props as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : undefined

  if (props) {
    if (
      typeof props.description === 'string' &&
      /study objects?/i.test(props.description)
    ) {
      delete props.description
    }

    if (typeof props.title === 'string') {
      props.title = sanitizeStudentWidgetName(props.title)
    }
  }

  return props ? { ...record, props } : record
}

const sanitizeStudentLayout = (
  layout?: DashboardLayout,
): DashboardLayout | undefined => {
  if (!layout) {
    return layout
  }

  const customProps = layout.config?.customProps
  const nextCustomProps = customProps
    ? {
        ...customProps,
        components: Array.isArray(customProps.components)
          ? customProps.components.map(sanitizeStudentComponent)
          : customProps.components,
      }
    : undefined

  return {
    ...layout,
    name: sanitizeStudentWidgetName(layout.name),
    config: layout.config
      ? {
          ...layout.config,
          customProps: nextCustomProps,
        }
      : layout.config,
    children: layout.children?.map(
      (child) => sanitizeStudentLayout(child) as DashboardLayout,
    ),
  }
}

const StudyPathWorkspaceView: React.FC<StudyPathWorkspaceViewProps> = ({
  studyPath,
  onStudyPathChange,
  mobileView = false,
  editingPageKey = null,
  onEditingPageKeyChange,
  onAddPage,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [navigatorOpen, setNavigatorOpen] = useState(false)
  const [navigatorDock, setNavigatorDock] = useState<NavigatorDock>('right')
  const selectedIndex = Math.min(
    Math.max(studyPath.selectedIndex || 0, 0),
    Math.max(studyPath.dashboards.length - 1, 0),
  )
  const currentLesson = studyPath.dashboards[selectedIndex]
  const currentPageKey = currentLesson?.dashboardKey || null
  const currentPageEditable = isEditableMarkdownStudyGuidePage(currentLesson)
  const isEditingCurrentPage =
    currentPageEditable && currentPageKey === editingPageKey
  const currentMarkdown = getStudyGuidePageMarkdown(currentLesson)
  const studentLayout = useMemo(
    () => sanitizeStudentLayout(currentLesson?.layout),
    [currentLesson?.layout],
  )

  useEffect(() => {
    try {
      const storedOpenState =
        localStorage.getItem(
          `${STUDY_PATH_NAV_OPEN_STORAGE_KEY}:${studyPath.pathId}`,
        ) ||
        localStorage.getItem(
          `${LEGACY_STUDY_PATH_NAV_OPEN_STORAGE_KEY}:${studyPath.pathId}`,
        )
      const storedDock =
        localStorage.getItem(
          `${STUDY_PATH_NAV_DOCK_STORAGE_KEY}:${studyPath.pathId}`,
        ) ||
        localStorage.getItem(
          `${LEGACY_STUDY_PATH_NAV_DOCK_STORAGE_KEY}:${studyPath.pathId}`,
        )

      setNavigatorOpen(storedOpenState === 'true')
      if (storedDock === 'left' || storedDock === 'right') {
        setNavigatorDock(storedDock)
      }
    } catch (error) {
      console.error('Failed to load Study Guide navigator state', error)
    }
  }, [studyPath.pathId])

  useEffect(() => {
    try {
      localStorage.setItem(
        `${STUDY_PATH_NAV_OPEN_STORAGE_KEY}:${studyPath.pathId}`,
        String(navigatorOpen),
      )
    } catch (error) {
      console.error('Failed to save Study Guide navigator state', error)
    }
  }, [navigatorOpen, studyPath.pathId])

  useEffect(() => {
    try {
      localStorage.setItem(
        `${STUDY_PATH_NAV_DOCK_STORAGE_KEY}:${studyPath.pathId}`,
        navigatorDock,
      )
    } catch (error) {
      console.error('Failed to save Study Guide navigator dock', error)
    }
  }, [navigatorDock, studyPath.pathId])

  useLayoutEffect(() => {
    if (!mobileView) {
      return undefined
    }

    const resetStudyPathScroll = () => {
      let element = rootRef.current?.parentElement

      while (element) {
        const overflowY = window.getComputedStyle(element).overflowY
        const canScroll =
          (overflowY === 'auto' || overflowY === 'scroll') &&
          element.scrollHeight > element.clientHeight

        if (canScroll || element.scrollTop > 0) {
          element.scrollTo({ top: 0, behavior: 'auto' })
          return
        }

        element = element.parentElement
      }

      window.scrollTo({ top: 0, behavior: 'auto' })
    }

    resetStudyPathScroll()
    const frame = window.requestAnimationFrame(resetStudyPathScroll)
    const timeout = window.setTimeout(resetStudyPathScroll, 80)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [currentLesson?.dashboardKey, mobileView, selectedIndex])

  const selectLesson = (index: number) => {
    onStudyPathChange({ ...studyPath, selectedIndex: index })
  }

  const updateCurrentLayout = (layout: DashboardLayout) => {
    if (!currentLesson) {
      return
    }

    onStudyPathChange({
      ...studyPath,
      dashboards: studyPath.dashboards.map((lesson, index) =>
        index === selectedIndex ? { ...lesson, layout } : lesson,
      ),
    })
  }

  const updateCurrentMarkdownPage = (title: string, markdown: string) => {
    if (!currentLesson) {
      return
    }

    onStudyPathChange(
      updateStudyGuideMarkdownPage(studyPath, currentLesson.dashboardKey, {
        title,
        markdown,
      }),
    )
  }

  const moveLesson = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    onStudyPathChange(reorderStudyGuidePage(studyPath, index, nextIndex))
  }

  const deleteLesson = (dashboardKey: string) => {
    onStudyPathChange(deleteStudyGuidePage(studyPath, dashboardKey))
  }

  if (!currentLesson) {
    return (
      <Paper sx={{ p: 3, m: 2 }}>
        <Typography variant="h6">Study Guide is empty</Typography>
        <Typography color="text.secondary">
          This container does not have lessons attached yet.
        </Typography>
      </Paper>
    )
  }

  const canGoPrevious = selectedIndex > 0
  const canGoNext = selectedIndex < studyPath.dashboards.length - 1
  const panelHorizontalSx =
    navigatorDock === 'left'
      ? { left: { xs: 8, md: 14 } }
      : { right: { xs: 8, md: 14 } }
  const pillHorizontalSx =
    navigatorDock === 'left'
      ? { left: { xs: 10, md: 16 } }
      : { right: { xs: 10, md: 16 } }

  return (
    <Box
      ref={rootRef}
      data-testid="study-path-workspace"
      sx={{
        height: '100%',
        minHeight: 0,
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          flex: '0 0 auto',
          px: 1.5,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={900} noWrap>
            {currentLesson.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Page {selectedIndex + 1}/{studyPath.dashboards.length}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} alignItems="center">
          {currentPageEditable ? (
            <Button
              size="small"
              variant={isEditingCurrentPage ? 'contained' : 'outlined'}
              onClick={() =>
                onEditingPageKeyChange?.(
                  isEditingCurrentPage ? null : currentLesson.dashboardKey,
                )
              }
              sx={{ borderRadius: 2, textTransform: 'none' }}
            >
              {isEditingCurrentPage ? 'Preview' : 'Edit'}
            </Button>
          ) : null}
          {onAddPage ? (
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon fontSize="small" />}
              onClick={onAddPage}
              sx={{ borderRadius: 2, textTransform: 'none' }}
            >
              Add Page
            </Button>
          ) : null}
        </Stack>
      </Box>
      <Box
        data-testid="study-path-dashboard-content"
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          p: isEditingCurrentPage ? 2 : 0,
        }}
      >
        {isEditingCurrentPage ? (
          <Stack spacing={2} sx={{ maxWidth: 920, mx: 'auto' }}>
            <TextField
              label="Page title"
              value={currentLesson.name}
              onChange={(event) =>
                updateCurrentMarkdownPage(event.target.value, currentMarkdown)
              }
              fullWidth
            />
            <TextField
              label="Markdown"
              value={currentMarkdown}
              onChange={(event) =>
                updateCurrentMarkdownPage(currentLesson.name, event.target.value)
              }
              fullWidth
              multiline
              minRows={18}
              InputProps={{
                sx: {
                  fontFamily: 'JetBrains Mono, Consolas, monospace',
                  alignItems: 'flex-start',
                },
              }}
            />
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="overline" color="text.secondary">
                Preview
              </Typography>
              <Stack spacing={1.25}>{renderMarkdown(currentMarkdown)}</Stack>
            </Paper>
          </Stack>
        ) : (
          <StudyGuideLinearLayout
            key={currentLesson.dashboardKey}
            layout={studentLayout}
          />
        )}
      </Box>

      <Box
        aria-label="Study Guide navigator overlay"
        data-testid="study-path-navigator-overlay"
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 8,
          pointerEvents: 'none',
        }}
      >
        {!navigatorOpen && (
          <Paper
            data-testid="study-path-navigator-pill"
            elevation={3}
            sx={{
              position: { xs: 'fixed', md: 'absolute' },
              top: { xs: 'auto', md: 14 },
              bottom: {
                xs: 'calc(76px + var(--studymesh-mobile-generation-tray-height, 0px) + env(safe-area-inset-bottom))',
                md: 'auto',
              },
              zIndex: { xs: 1400, md: 'auto' },
              ...pillHorizontalSx,
              pointerEvents: 'auto',
              borderRadius: 999,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={0.25}>
              <Tooltip title="Open Course navigator">
                <Button
                  size="small"
                  onClick={() => setNavigatorOpen(true)}
                  startIcon={<AutoStoriesIcon fontSize="small" />}
                  sx={{
                    px: 1.25,
                    minHeight: 34,
                    borderRadius: 999,
                    textTransform: 'none',
                    fontWeight: 800,
                  }}
                >
                  {selectedIndex + 1}/{studyPath.dashboards.length}
                </Button>
              </Tooltip>
              <Tooltip title="Previous lesson">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Previous lesson"
                    disabled={!canGoPrevious}
                    onClick={() => selectLesson(selectedIndex - 1)}
                    sx={(theme) => ({
                      width: 30,
                      height: 30,
                      mx: 0.25,
                      color:
                        theme.palette.mode === 'dark'
                          ? theme.palette.primary.light
                          : theme.palette.primary.dark,
                      bgcolor: alpha(
                        theme.palette.primary.main,
                        theme.palette.mode === 'dark' ? 0.2 : 0.12,
                      ),
                      '&:hover': {
                        bgcolor: alpha(
                          theme.palette.primary.main,
                          theme.palette.mode === 'dark' ? 0.32 : 0.2,
                        ),
                      },
                      '&.Mui-disabled': {
                        color: 'text.disabled',
                        bgcolor: 'transparent',
                      },
                    })}
                  >
                    <ChevronLeftIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Next lesson">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Next lesson"
                    disabled={!canGoNext}
                    onClick={() => selectLesson(selectedIndex + 1)}
                    sx={(theme) => ({
                      width: 30,
                      height: 30,
                      mx: 0.25,
                      color:
                        theme.palette.mode === 'dark'
                          ? theme.palette.primary.light
                          : theme.palette.primary.dark,
                      bgcolor: alpha(
                        theme.palette.primary.main,
                        theme.palette.mode === 'dark' ? 0.2 : 0.12,
                      ),
                      '&:hover': {
                        bgcolor: alpha(
                          theme.palette.primary.main,
                          theme.palette.mode === 'dark' ? 0.32 : 0.2,
                        ),
                      },
                      '&.Mui-disabled': {
                        color: 'text.disabled',
                        bgcolor: 'transparent',
                      },
                    })}
                  >
                    <ChevronRightIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Paper>
        )}

        {navigatorOpen && (
          <Paper
            data-testid="study-path-navigator-panel"
            elevation={8}
            sx={{
              position: { xs: 'fixed', md: 'absolute' },
              top: { xs: 'auto', md: 14 },
              bottom: {
                xs: 'calc(76px + var(--studymesh-mobile-generation-tray-height, 0px) + env(safe-area-inset-bottom))',
                md: 14,
              },
              ...panelHorizontalSx,
              zIndex: { xs: 1400, md: 'auto' },
              width: {
                xs: 'min(288px, calc(100% - 20px))',
                sm: NAVIGATOR_PANEL_WIDTH,
              },
              maxWidth: { xs: 288, sm: NAVIGATOR_PANEL_WIDTH },
              maxHeight: {
                xs: 'calc(100dvh - 148px - var(--studymesh-mobile-generation-tray-height, 0px) - env(safe-area-inset-bottom))',
                md: 'none',
              },
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: 3,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 16px 44px rgba(0, 0, 0, 0.22)',
            }}
          >
            <Stack
              spacing={{ xs: 0.75, sm: 1.25 }}
              sx={{ p: { xs: 1, sm: 1.5 }, pb: { xs: 0.75, sm: 1.25 } }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: { xs: 28, sm: 34 },
                    height: { xs: 28, sm: 34 },
                    borderRadius: { xs: 1.5, sm: 2 },
                    display: 'grid',
                    placeItems: 'center',
                    color: 'primary.contrastText',
                    bgcolor: 'primary.main',
                    flex: '0 0 auto',
                  }}
                >
                  <AutoStoriesIcon fontSize="small" />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="overline"
                    color="primary.main"
                    sx={{
                      fontWeight: 900,
                      letterSpacing: '.08em',
                      fontSize: { xs: '0.62rem', sm: '0.75rem' },
                      lineHeight: 1.1,
                    }}
                  >
                    Course helper
                  </Typography>
                  <Typography
                    variant="subtitle2"
                    noWrap
                    fontWeight={800}
                    sx={{ fontSize: { xs: '0.82rem', sm: '0.875rem' } }}
                  >
                    {studyPath.title}
                  </Typography>
                </Box>
                <Tooltip title="Collapse Course navigator">
                  <IconButton
                    size="small"
                    aria-label="Collapse Course navigator"
                    onClick={() => setNavigatorOpen(false)}
                    sx={(theme) => ({
                      width: 30,
                      height: 30,
                      color: 'text.primary',
                      border: 1,
                      borderColor: 'divider',
                      bgcolor:
                        theme.palette.mode === 'dark'
                          ? alpha(theme.palette.common.white, 0.08)
                          : 'action.hover',
                      '&:hover': {
                        color: 'primary.main',
                        borderColor: 'primary.main',
                        bgcolor: alpha(theme.palette.primary.main, 0.16),
                      },
                    })}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Stack
                direction="row"
                spacing={{ xs: 0.5, sm: 0.75 }}
                alignItems="center"
              >
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{
                    height: { xs: 22, sm: 24 },
                    fontSize: { xs: '0.68rem', sm: '0.75rem' },
                  }}
                  label={`Lesson ${selectedIndex + 1}/${
                    studyPath.dashboards.length
                  }`}
                />
              </Stack>

              <Paper
                variant="outlined"
                sx={{
                  px: { xs: 1, sm: 1.25 },
                  py: { xs: 0.65, sm: 1 },
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.68rem', sm: '0.75rem' } }}
                >
                  Current lesson
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight={800}
                  noWrap
                  sx={{ fontSize: { xs: '0.78rem', sm: '0.875rem' } }}
                >
                  {currentLesson.name}
                </Typography>
              </Paper>

              <Stack direction="row" spacing={0.75}>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!canGoPrevious}
                  onClick={() => selectLesson(selectedIndex - 1)}
                  startIcon={<ChevronLeftIcon fontSize="small" />}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    fontSize: { xs: '0.72rem', sm: '0.8125rem' },
                    py: { xs: 0.35, sm: 0.5 },
                    color: 'text.primary',
                    borderColor: 'divider',
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.white, 0.06)
                        : 'background.paper',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.16),
                    },
                    '&.Mui-disabled': {
                      color: 'text.disabled',
                      borderColor: 'divider',
                      bgcolor: 'transparent',
                    },
                  }}
                >
                  Previous
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={!canGoNext}
                  onClick={() => selectLesson(selectedIndex + 1)}
                  endIcon={<ChevronRightIcon fontSize="small" />}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    fontSize: { xs: '0.72rem', sm: '0.8125rem' },
                    py: { xs: 0.35, sm: 0.5 },
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    boxShadow: (theme) =>
                      theme.palette.mode === 'dark'
                        ? `0 0 0 1px ${alpha(
                            theme.palette.common.white,
                            0.16,
                          )}, 0 8px 18px ${alpha(
                            theme.palette.primary.main,
                            0.22,
                          )}`
                        : undefined,
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                    '&.Mui-disabled': {
                      color: 'text.disabled',
                      bgcolor: 'action.disabledBackground',
                      boxShadow: 'none',
                    },
                  }}
                >
                  Next
                </Button>
              </Stack>

              <Stack direction="row" spacing={0.75} sx={{ display: 'flex' }}>
                <Button
                  size="small"
                  variant={navigatorDock === 'left' ? 'contained' : 'text'}
                  onClick={() => setNavigatorDock('left')}
                  sx={{ flex: 1, textTransform: 'none' }}
                >
                  Dock left
                </Button>
                <Button
                  size="small"
                  variant={navigatorDock === 'right' ? 'contained' : 'text'}
                  onClick={() => setNavigatorDock('right')}
                  sx={{ flex: 1, textTransform: 'none' }}
                >
                  Dock right
                </Button>
              </Stack>
            </Stack>

            <Divider />

            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                p: { xs: 0.75, sm: 1 },
              }}
            >
              <Stack spacing={{ xs: 0.4, sm: 0.65 }}>
                {studyPath.dashboards.map((lesson, index) => {
                  const active = index === selectedIndex

                  return (
                    <Box
                      key={lesson.dashboardKey}
                      sx={{
                        borderRadius: 2,
                        border: 1,
                        borderColor: active ? 'primary.main' : 'transparent',
                        bgcolor: active ? 'action.selected' : 'transparent',
                        color: 'text.primary',
                        boxShadow: active ? 1 : 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        p: { xs: 0.4, sm: 0.5 },
                        '&:hover': {
                          bgcolor: active ? 'action.selected' : 'action.hover',
                        },
                      }}
                    >
                      <Button
                        onClick={() => selectLesson(index)}
                        variant="text"
                        color="inherit"
                        sx={{
                          minWidth: 0,
                          flex: 1,
                          justifyContent: 'flex-start',
                          textAlign: 'left',
                          alignItems: 'center',
                          borderRadius: 1.5,
                          p: { xs: 0.25, sm: 0.5 },
                          color: 'text.primary',
                          textTransform: 'none',
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ width: '100%' }}
                        >
                        <Box
                          sx={{
                            width: { xs: 22, sm: 26 },
                            height: { xs: 22, sm: 26 },
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            flex: '0 0 auto',
                            fontSize: { xs: 11, sm: 12 },
                            fontWeight: 900,
                            color: active ? 'primary.main' : 'text.secondary',
                            bgcolor: active
                              ? 'background.paper'
                              : 'action.hover',
                            border: 1,
                            borderColor: active
                              ? 'primary.main'
                              : 'transparent',
                          }}
                        >
                          {index + 1}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography
                            variant="body2"
                            fontWeight={800}
                            noWrap
                            sx={{
                              fontSize: { xs: '0.76rem', sm: '0.875rem' },
                            }}
                          >
                            {lesson.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              opacity: active ? 0.84 : 0.66,
                              fontSize: { xs: '0.66rem', sm: '0.75rem' },
                            }}
                            noWrap
                          >
                            Step {lesson.dashboardIndex}/{lesson.dashboardCount}
                          </Typography>
                        </Box>
                        </Stack>
                      </Button>
                      <Tooltip title="Move page up">
                        <span>
                          <IconButton
                            size="small"
                            aria-label={`Move ${lesson.name} up`}
                            disabled={index === 0}
                            onClick={() => moveLesson(index, -1)}
                            sx={{ width: 28, height: 28 }}
                          >
                            <ArrowUpwardIcon fontSize="inherit" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Move page down">
                        <span>
                          <IconButton
                            size="small"
                            aria-label={`Move ${lesson.name} down`}
                            disabled={index === studyPath.dashboards.length - 1}
                            onClick={() => moveLesson(index, 1)}
                            sx={{ width: 28, height: 28 }}
                          >
                            <ArrowDownwardIcon fontSize="inherit" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip
                        title={
                          lesson.deletable
                            ? 'Delete page'
                            : 'Generated Study Guide pages cannot be deleted yet'
                        }
                      >
                        <span>
                          <IconButton
                            size="small"
                            aria-label={`Delete ${lesson.name}`}
                            disabled={!lesson.deletable}
                            onClick={() => deleteLesson(lesson.dashboardKey)}
                            sx={{ width: 28, height: 28 }}
                          >
                            <DeleteOutlineIcon fontSize="inherit" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  )
                })}
              </Stack>
            </Box>
          </Paper>
        )}
      </Box>
    </Box>
  )
}

export default StudyPathWorkspaceView
