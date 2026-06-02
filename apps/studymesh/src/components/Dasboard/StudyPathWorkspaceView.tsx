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
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import DashboardLayoutView from '../Layout/Layout'
import {
  DashboardLayout,
  StudyPathContainerState,
  StudyPathDashboardItem,
} from '../../state/store'
import { getStudyPathDashboardProgress } from '../../studyPack/progress'

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
}

const getProgressForLesson = (
  studyPath: StudyPathContainerState,
  lesson: StudyPathDashboardItem,
) =>
  getStudyPathDashboardProgress({
    studyPathId: studyPath.pathId,
    studyPathTitle: studyPath.title,
    dashboardKey: lesson.dashboardKey,
    dashboardName: lesson.name,
    dashboardIndex: lesson.dashboardIndex,
    dashboardCount: lesson.dashboardCount,
    folderName: lesson.folderName || studyPath.folderName,
  })

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
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [navigatorOpen, setNavigatorOpen] = useState(false)
  const [navigatorDock, setNavigatorDock] = useState<NavigatorDock>('right')
  const selectedIndex = Math.min(
    Math.max(studyPath.selectedIndex || 0, 0),
    Math.max(studyPath.dashboards.length - 1, 0),
  )
  const currentLesson = studyPath.dashboards[selectedIndex]
  const progressByKey = useMemo(
    () =>
      Object.fromEntries(
        studyPath.dashboards.map((lesson) => [
          lesson.dashboardKey,
          getProgressForLesson(studyPath, lesson),
        ]),
      ),
    [studyPath],
  )
  const completedCount = Object.values(progressByKey).filter(
    (progress) => progress.completedAt,
  ).length
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
  const completionPercent =
    studyPath.dashboards.length > 0
      ? Math.round((completedCount / studyPath.dashboards.length) * 100)
      : 0
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
        overflow: 'visible',
        backgroundColor: 'background.default',
      }}
    >
      <Box
        data-testid="study-path-dashboard-content"
        sx={{
          height: '100%',
          minHeight: 0,
          overflow: 'visible',
        }}
      >
        <DashboardLayoutView
          key={currentLesson.dashboardKey}
          layout={studentLayout}
          readOnly
          mobileView={mobileView}
          updateLayout={(model) => updateCurrentLayout(model.toJson().layout)}
        />
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
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ fontSize: { xs: '0.68rem', sm: '0.75rem' } }}
                >
                  {completedCount}/{studyPath.dashboards.length} completed
                </Typography>
              </Stack>

              <LinearProgress
                variant="determinate"
                value={completionPercent}
                sx={{ borderRadius: 999, height: { xs: 4, sm: 5 } }}
              />

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
                  const progress = progressByKey[lesson.dashboardKey]
                  const active = index === selectedIndex

                  return (
                    <Button
                      key={lesson.dashboardKey}
                      onClick={() => selectLesson(index)}
                      variant="text"
                      color="inherit"
                      sx={{
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        alignItems: 'center',
                        borderRadius: 2,
                        py: { xs: 0.5, sm: 0.75 },
                        px: { xs: 0.75, sm: 1 },
                        border: 1,
                        borderColor: active ? 'primary.main' : 'transparent',
                        bgcolor: active ? 'action.selected' : 'transparent',
                        color: 'text.primary',
                        boxShadow: active ? 1 : 0,
                        '&:hover': {
                          bgcolor: active ? 'action.selected' : 'action.hover',
                        },
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
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
                          {progress?.completedAt ? (
                            <CheckCircleIcon sx={{ fontSize: 16 }} />
                          ) : (
                            index + 1
                          )}
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
                            {progress?.score
                              ? ` · Score ${progress.score}%`
                              : ''}
                          </Typography>
                        </Box>
                      </Stack>
                    </Button>
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
