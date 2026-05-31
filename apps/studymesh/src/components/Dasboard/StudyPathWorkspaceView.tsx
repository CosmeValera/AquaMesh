import React, {
  useCallback,
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
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import SchoolIcon from '@mui/icons-material/School'
import RefreshIcon from '@mui/icons-material/Refresh'
import QuizIcon from '@mui/icons-material/Quiz'
import DashboardLayoutView from '../Layout/Layout'
import {
  DashboardLayout,
  StudyPathContainerState,
  StudyPathDashboardItem,
} from '../../state/store'
import {
  getStudyPathDashboardProgress,
  getStudyPathMasteryProgress,
  setSectionMasteryStatus,
  recordSectionQuizScore,
  recordSectionTeachBack,
  isSectionLockedWithGuidedMode,
  getStudyPathGuidedMode,
  setStudyPathGuidedMode,
  getReviewSections,
  getNextRecommendedStep,
  getQuickCheckQuestions,
  getStatusFromScore,
  StudyPathSectionMasteryStatus,
  NextStepSuggestion,
  ReviewQueueItem,
  QuickCheckQuestion,
} from '../../studyPack/progress'

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
  const [masteryOpen, setMasteryOpen] = useState(false)
  const [teachBackOpen, setTeachBackOpen] = useState(false)
  const [teachBackText, setTeachBackText] = useState('')
  const [teachBackLoading, setTeachBackLoading] = useState(false)
  const [teachBackResult, setTeachBackResult] = useState<string | null>(null)
  const [quickCheckAnswers, setQuickCheckAnswers] = useState<Record<number, number>>({})
  const [quickCheckSubmitted, setQuickCheckSubmitted] = useState(false)

  const selectedIndex = Math.min(
    Math.max(studyPath.selectedIndex || 0, 0),
    Math.max(studyPath.dashboards.length - 1, 0),
  )
  const currentLesson = studyPath.dashboards[selectedIndex]

  // Mastery section (depends on currentLesson declared above)
  const sectionIds = useMemo(
    () => studyPath.dashboards.map((d) => d.dashboardKey),
    [studyPath],
  )

  const masteryProgress = useMemo(
    () => getStudyPathMasteryProgress(studyPath.pathId),
    [studyPath.pathId, masteryOpen, teachBackOpen],
  )

  const currentSectionProgress = useMemo(
    () =>
      currentLesson
        ? masteryProgress?.sections[currentLesson.dashboardKey] || {
            sectionId: currentLesson.dashboardKey,
            status: 'notStarted' as StudyPathSectionMasteryStatus,
            quizAttempts: 0,
            teachBackAttempts: 0,
          }
        : null,
    [currentLesson, masteryProgress],
  )

  const guidedModeEnabled = useMemo(
    () => getStudyPathGuidedMode(studyPath.pathId),
    [studyPath.pathId],
  )

  const sectionLocked = useMemo(
    () =>
      currentLesson
        ? isSectionLockedWithGuidedMode(
            studyPath.pathId,
            currentLesson.dashboardKey,
            sectionIds,
          )
        : false,
    [currentLesson, studyPath.pathId, sectionIds],
  )

  const quickCheckQuestions = useMemo<QuickCheckQuestion[]>(
    () => (currentLesson ? getQuickCheckQuestions(currentLesson.layout, 3) : []),
    [currentLesson],
  )

  const reviewSections = useMemo<ReviewQueueItem[]>(
    () => getReviewSections(studyPath.pathId, studyPath.dashboards),
    [studyPath.pathId, masteryOpen, teachBackOpen],
  )

  const nextStep = useMemo<NextStepSuggestion>(
    () => getNextRecommendedStep(studyPath.pathId, studyPath.dashboards),
    [studyPath.pathId, masteryOpen, teachBackOpen],
  )

  const handleSetStatus = useCallback(
    (status: StudyPathSectionMasteryStatus) => {
      if (!currentLesson) return
      setSectionMasteryStatus(studyPath.pathId, currentLesson.dashboardKey, status)
      setMasteryOpen(false)
    },
    [currentLesson, studyPath.pathId],
  )

  const handleRecordScore = useCallback(
    (score: number) => {
      if (!currentLesson) return
      recordSectionQuizScore(studyPath.pathId, currentLesson.dashboardKey, score)
      setMasteryOpen(false)
    },
    [currentLesson, studyPath.pathId],
  )

  const handleTeachBackSubmit = useCallback(async () => {
    if (!currentLesson || !teachBackText.trim()) return
    setTeachBackLoading(true)
    setTeachBackResult(null)

    try {
      const words = teachBackText.trim().split(/\s+/).length
      const feedback =
        words < 20
          ? 'Try to explain the concept in more detail. Aim for at least 2-3 sentences covering the key points.'
          : words < 50
          ? 'Good effort! Try to include more specific examples or details about how or why something works.'
          : 'Great explanation! You covered the main points well.'

      recordSectionTeachBack(
        studyPath.pathId,
        currentLesson.dashboardKey,
        feedback,
      )
      setTeachBackResult(feedback)
    } finally {
      setTeachBackLoading(false)
    }
  }, [currentLesson, studyPath.pathId, teachBackText])

  const handleQuickCheckAnswer = useCallback((questionIndex: number, answerIndex: number) => {
    setQuickCheckAnswers((prev) => ({ ...prev, [questionIndex]: answerIndex }))
  }, [])

  const handleQuickCheckSubmit = useCallback(() => {
    if (!currentLesson || quickCheckQuestions.length === 0) return

    // Calculate score
    let correct = 0
    quickCheckQuestions.forEach((q, i) => {
      if (quickCheckAnswers[i] === q.correctIndex) {
        correct += 1
      }
    })
    const score = Math.round((correct / quickCheckQuestions.length) * 100)
    recordSectionQuizScore(studyPath.pathId, currentLesson.dashboardKey, score)
    setQuickCheckSubmitted(true)
  }, [currentLesson, studyPath.pathId, quickCheckQuestions, quickCheckAnswers])

  const handleGuidedModeToggle = useCallback(
    (_event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      setStudyPathGuidedMode(studyPath.pathId, checked)
    },
    [studyPath.pathId],
  )

  const masteryStatusColor = (
    status: StudyPathSectionMasteryStatus,
  ): 'default' | 'primary' | 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'mastered':
        return 'success'
      case 'needsReview':
        return 'warning'
      case 'inProgress':
        return 'primary'
      case 'locked':
        return 'error'
      default:
        return 'default'
    }
  }

  const masteryStatusLabel: Record<StudyPathSectionMasteryStatus, string> = {
    notStarted: 'Not started',
    inProgress: 'In progress',
    needsReview: 'Needs review',
    mastered: 'Mastered',
    locked: 'Locked',
  }
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
      console.error('Failed to load Study Path navigator state', error)
    }
  }, [studyPath.pathId])

  useEffect(() => {
    try {
      localStorage.setItem(
        `${STUDY_PATH_NAV_OPEN_STORAGE_KEY}:${studyPath.pathId}`,
        String(navigatorOpen),
      )
    } catch (error) {
      console.error('Failed to save Study Path navigator state', error)
    }
  }, [navigatorOpen, studyPath.pathId])

  useEffect(() => {
    try {
      localStorage.setItem(
        `${STUDY_PATH_NAV_DOCK_STORAGE_KEY}:${studyPath.pathId}`,
        navigatorDock,
      )
    } catch (error) {
      console.error('Failed to save Study Path navigator dock', error)
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
        <Typography variant="h6">Study Path is empty</Typography>
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
        aria-label="Study Path navigator overlay"
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

              {/* Mastery check section */}
              <Paper
                variant="outlined"
                sx={{
                  px: { xs: 1, sm: 1.25 },
                  py: { xs: 0.65, sm: 1 },
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                }}
              >
                <Stack spacing={0.75}>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.68rem', sm: '0.75rem' } }}
                    >
                      Mastery check
                    </Typography>
                    <Chip
                      size="small"
                      label={
                        currentSectionProgress
                          ? masteryStatusLabel[currentSectionProgress.status]
                          : 'Not started'
                      }
                      color={masteryStatusColor(
                        sectionLocked
                          ? 'locked'
                          : currentSectionProgress?.status || 'notStarted',
                      )}
                      sx={{
                        height: { xs: 18, sm: 22 },
                        fontSize: { xs: '0.6rem', sm: '0.7rem' },
                      }}
                    />
                  </Stack>

                  {currentSectionProgress && (
                    <Stack spacing={0.4}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: { xs: '0.6rem', sm: '0.68rem' } }}
                      >
                        Quiz attempts: {currentSectionProgress.quizAttempts}{
                          currentSectionProgress.bestScore !== undefined
                            ? ` · Best: ${currentSectionProgress.bestScore}%`
                            : ''
                        }
                        {currentSectionProgress.lastReviewedAt &&
                          ` · Reviewed ${new Date(
                            currentSectionProgress.lastReviewedAt,
                          ).toLocaleDateString()}`}
                      </Typography>
                      {currentSectionProgress.lastTeachBackFeedback && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            fontSize: { xs: '0.6rem', sm: '0.68rem' },
                            fontStyle: 'italic',
                          }}
                        >
                          "{currentSectionProgress.lastTeachBackFeedback}"
                        </Typography>
                      )}
                    </Stack>
                  )}

                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    <Button
                      size="small"
                      variant={
                        currentSectionProgress?.status === 'inProgress'
                          ? 'contained'
                          : 'outlined'
                      }
                      color="primary"
                      disabled={sectionLocked}
                      onClick={() => handleSetStatus('inProgress')}
                      startIcon={<SchoolIcon sx={{ fontSize: 13 }} />}
                      sx={{
                        textTransform: 'none',
                        py: { xs: 0.2, sm: 0.35 },
                        px: { xs: 0.75, sm: 1 },
                        fontSize: { xs: '0.68rem', sm: '0.75rem' },
                        minWidth: 0,
                      }}
                    >
                      Studying
                    </Button>
                    <Button
                      size="small"
                      variant={
                        currentSectionProgress?.status === 'mastered'
                          ? 'contained'
                          : 'outlined'
                      }
                      color="success"
                      disabled={sectionLocked}
                      onClick={() => handleSetStatus('mastered')}
                      startIcon={<CheckCircleIcon sx={{ fontSize: 13 }} />}
                      sx={{
                        textTransform: 'none',
                        py: { xs: 0.2, sm: 0.35 },
                        px: { xs: 0.75, sm: 1 },
                        fontSize: { xs: '0.68rem', sm: '0.75rem' },
                        minWidth: 0,
                      }}
                    >
                      Mastered
                    </Button>
                    <Button
                      size="small"
                      variant={
                        currentSectionProgress?.status === 'needsReview'
                          ? 'contained'
                          : 'outlined'
                      }
                      color="warning"
                      disabled={sectionLocked}
                      onClick={() => handleSetStatus('needsReview')}
                      startIcon={<RefreshIcon sx={{ fontSize: 13 }} />}
                      sx={{
                        textTransform: 'none',
                        py: { xs: 0.2, sm: 0.35 },
                        px: { xs: 0.75, sm: 1 },
                        fontSize: { xs: '0.68rem', sm: '0.75rem' },
                        minWidth: 0,
                      }}
                    >
                      Review
                    </Button>
                  </Stack>

                  {sectionLocked && (
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => {
                        // Override lock: mark previous section as mastered to unlock
                        const idx = sectionIds.indexOf(currentLesson.dashboardKey)
                        if (idx > 0) {
                          const prevId = sectionIds[idx - 1]
                          setSectionMasteryStatus(studyPath.pathId, prevId, 'mastered')
                        }
                      }}
                      sx={{
                        textTransform: 'none',
                        py: { xs: 0.1, sm: 0.2 },
                        px: 0,
                        fontSize: { xs: '0.65rem', sm: '0.72rem' },
                        color: 'text.secondary',
                        alignSelf: 'flex-start',
                      }}
                    >
                      Unlock section
                    </Button>
                  )}

                  <Collapse in={masteryOpen}>
                    <Stack spacing={0.75}>
                      {quickCheckQuestions.length > 0 ? (
                        <>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: { xs: '0.62rem', sm: '0.7rem' } }}
                          >
                            Quick check — select the best answer
                          </Typography>
                          {quickCheckQuestions.map((q, qi) => (
                            <FormControl key={qi} component="fieldset" fullWidth>
                              <Typography
                                variant="caption"
                                sx={{
                                  fontSize: { xs: '0.65rem', sm: '0.72rem' },
                                  fontWeight: 600,
                                  mb: 0.25,
                                }}
                              >
                                {qi + 1}. {q.question}
                              </Typography>
                              <RadioGroup
                                row
                                value={quickCheckAnswers[qi]?.toString() ?? ''}
                                onChange={(_, v) =>
                                  handleQuickCheckAnswer(qi, Number(v))
                                }
                              >
                                {q.options.map((opt, oi) => (
                                  <FormControlLabel
                                    key={oi}
                                    value={oi.toString()}
                                    control={
                                      <Radio
                                        size="small"
                                        sx={{ py: 0.25 }}
                                      />
                                    }
                                    label={
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          fontSize: { xs: '0.6rem', sm: '0.68rem' },
                                        }}
                                      >
                                        {opt}
                                      </Typography>
                                    }
                                    disabled={quickCheckSubmitted}
                                  />
                                ))}
                              </RadioGroup>
                            </FormControl>
                          ))}
                          <Button
                            size="small"
                            variant="contained"
                            disabled={
                              Object.keys(quickCheckAnswers).length <
                                quickCheckQuestions.length || quickCheckSubmitted
                            }
                            onClick={handleQuickCheckSubmit}
                            sx={{
                              textTransform: 'none',
                              fontSize: { xs: '0.72rem', sm: '0.8125rem' },
                            }}
                          >
                            {quickCheckSubmitted ? 'Submitted!' : 'Submit answers'}
                          </Button>
                          {quickCheckSubmitted && currentSectionProgress?.lastScore !== undefined && (
                            <Typography
                              variant="caption"
                              color={
                                currentSectionProgress.lastScore >= 85
                                  ? 'success.main'
                                  : currentSectionProgress.lastScore >= 60
                                  ? 'warning.main'
                                  : 'error.main'
                              }
                              sx={{ fontSize: { xs: '0.65rem', sm: '0.72rem' } }}
                            >
                              Score: {currentSectionProgress.lastScore}% —{' '}
                              {currentSectionProgress.lastScore >= 85
                                ? 'Mastered!'
                                : currentSectionProgress.lastScore >= 60
                                ? 'Needs review'
                                : 'Keep practicing'}
                            </Typography>
                          )}
                        </>
                      ) : (
                        <>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: { xs: '0.62rem', sm: '0.7rem' } }}
                          >
                            Quick check (or manual score below)
                          </Typography>
                          <Stack direction="row" spacing={0.5}>
                            {[100, 80, 60, 40].map((score) => (
                              <Button
                                key={score}
                                size="small"
                                variant="outlined"
                                onClick={() => handleRecordScore(score)}
                                sx={{
                                  minWidth: 0,
                                  py: { xs: 0.1, sm: 0.25 },
                                  px: { xs: 0.5, sm: 0.75 },
                                  fontSize: { xs: '0.68rem', sm: '0.75rem' },
                                  flex: 1,
                                }}
                              >
                                {score}%
                              </Button>
                            ))}
                          </Stack>
                        </>
                      )}
                    </Stack>
                  </Collapse>

                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setMasteryOpen((v) => !v)}
                    startIcon={<QuizIcon sx={{ fontSize: 13 }} />}
                    sx={{
                      textTransform: 'none',
                      py: { xs: 0.2, sm: 0.25 },
                      px: { xs: 0.5, sm: 0.75 },
                      fontSize: { xs: '0.68rem', sm: '0.75rem' },
                      color: 'text.secondary',
                    }}
                  >
                    {masteryOpen ? 'Hide quick check' : 'Quick check'}
                  </Button>
                </Stack>
              </Paper>

              {/* Guided mode + review queue */}
              <Paper
                variant="outlined"
                sx={{
                  px: { xs: 1, sm: 1.25 },
                  py: { xs: 0.65, sm: 1 },
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                }}
              >
                <Stack spacing={0.75}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={guidedModeEnabled}
                        onChange={handleGuidedModeToggle}
                        color="primary"
                      />
                    }
                    label={
                      <Typography
                        variant="caption"
                        sx={{ fontSize: { xs: '0.68rem', sm: '0.75rem' } }}
                      >
                        Guided mode
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />

                  {reviewSections.length > 0 && (
                    <Box>
                      <Typography
                        variant="caption"
                        color="warning.main"
                        sx={{ fontSize: { xs: '0.62rem', sm: '0.7rem' }, fontWeight: 700 }}
                      >
                        Review queue ({reviewSections.length})
                      </Typography>
                      <Stack spacing={0.25} mt={0.25}>
                        {reviewSections.slice(0, 3).map((section) => (
                          <Chip
                            key={section.sectionId}
                            size="small"
                            label={section.sectionName}
                            color="warning"
                            variant="outlined"
                            onClick={() => {
                              const idx = studyPath.dashboards.findIndex(
                                (d) => d.dashboardKey === section.sectionId,
                              )
                              if (idx >= 0) {
                                onStudyPathChange({
                                  ...studyPath,
                                  selectedIndex: idx,
                                })
                              }
                            }}
                            sx={{
                              height: { xs: 18, sm: 22 },
                              fontSize: { xs: '0.6rem', sm: '0.7rem' },
                            }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {nextStep && (
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: { xs: '0.6rem', sm: '0.68rem' } }}
                      >
                        <strong>Next recommended step:</strong> {nextStep.message}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Paper>

              {/* Teach-back section */}
              <Paper
                variant="outlined"
                sx={{
                  px: { xs: 1, sm: 1.25 },
                  py: { xs: 0.65, sm: 1 },
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                }}
              >
                <Stack spacing={0.5}>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setTeachBackOpen((v) => !v)}
                    startIcon={<SchoolIcon sx={{ fontSize: 13 }} />}
                    sx={{
                      textTransform: 'none',
                      py: { xs: 0.2, sm: 0.25 },
                      px: 0,
                      fontSize: { xs: '0.72rem', sm: '0.8125rem' },
                      fontWeight: 800,
                      color: 'text.primary',
                      justifyContent: 'flex-start',
                    }}
                  >
                    Teach it back
                  </Button>

                  <Collapse in={teachBackOpen}>
                    <Stack spacing={0.5}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: { xs: '0.62rem', sm: '0.7rem' } }}
                      >
                        Briefly explain the main concept of this lesson
                        without looking at the material.
                      </Typography>
                      <TextField
                        size="small"
                        multiline
                        minRows={2}
                        maxRows={5}
                        value={teachBackText}
                        onChange={(e) => setTeachBackText(e.target.value)}
                        placeholder="e.g. This lesson was about..."
                        sx={{
                          '& .MuiInputBase-root': {
                            fontSize: { xs: '0.72rem', sm: '0.8125rem' },
                          },
                        }}
                      />
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!teachBackText.trim() || teachBackLoading}
                        onClick={handleTeachBackSubmit}
                        sx={{
                          textTransform: 'none',
                          fontSize: { xs: '0.72rem', sm: '0.8125rem' },
                        }}
                      >
                        {teachBackLoading ? 'Analyzing...' : 'Submit explanation'}
                      </Button>
                      {teachBackResult && (
                        <Paper
                          variant="outlined"
                          sx={{
                            p: { xs: 0.75, sm: 1 },
                            bgcolor: 'background.paper',
                            borderRadius: 1.5,
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: { xs: '0.68rem', sm: '0.75rem' } }}
                          >
                            <strong>Feedback:</strong> {teachBackResult}
                          </Typography>
                        </Paper>
                      )}
                    </Stack>
                  </Collapse>
                </Stack>
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
                  const lessonMastery = masteryProgress?.sections[lesson.dashboardKey]
                  const locked = isSectionLocked(
                    studyPath.pathId,
                    lesson.dashboardKey,
                    sectionIds,
                  )
                  const masteryStatus: StudyPathSectionMasteryStatus = locked
                    ? 'locked'
                    : lessonMastery?.status || 'notStarted'

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
                          {masteryStatus === 'mastered' || progress?.completedAt ? (
                            <CheckCircleIcon sx={{ fontSize: 16 }} />
                          ) : (
                            index + 1
                          )}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack
                            direction="row"
                            spacing={0.5}
                            alignItems="center"
                          >
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
                            <Chip
                              size="small"
                              label={
                                masteryStatus === 'mastered'
                                  ? '✓'
                                  : masteryStatus === 'inProgress'
                                  ? '→'
                                  : masteryStatus === 'needsReview'
                                  ? '?'
                                  : masteryStatus === 'locked'
                                  ? '🔒'
                                  : '○'
                              }
                              color={masteryStatusColor(masteryStatus)}
                              sx={{
                                height: { xs: 14, sm: 16 },
                                fontSize: { xs: '0.58rem', sm: '0.65rem' },
                                ml: 0.25,
                              }}
                            />
                          </Stack>
                          <Typography
                            variant="caption"
                            sx={{
                              opacity: active ? 0.84 : 0.66,
                              fontSize: { xs: '0.66rem', sm: '0.75rem' },
                            }}
                            noWrap
                          >
                            Step {lesson.dashboardIndex}/{lesson.dashboardCount}{
                              lessonMastery?.bestScore !== undefined
                                ? ` · Best ${lessonMastery.bestScore}%`
                                : progress?.score
                                ? ` · Score ${progress.score}%`
                                : ''
                            }
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
