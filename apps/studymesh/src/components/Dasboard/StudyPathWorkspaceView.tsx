import React, { useLayoutEffect, useMemo, useRef } from 'react'
import {
  Box,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { alpha, type Theme } from '@mui/material/styles'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import EditIcon from '@mui/icons-material/Edit'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { DashboardLayout, StudyPathContainerState } from '../../state/store'
import {
  getStudyGuidePageMarkdown,
  isEditableMarkdownStudyGuidePage,
  updateStudyGuideMarkdownPage,
} from '../../studyGuides/pages'
import StudyGuideLinearLayout from './StudyGuideLinearLayout'
import StudyGuidePageEditor from './StudyGuidePageEditor'
import { useNavigate } from 'react-router-dom'
import StudyGuidePagesPanel from './StudyGuidePagesPanel'

type PageIconTone = 'primary' | 'error'

const pageIconButtonSx =
  (tone: PageIconTone = 'primary') =>
  (theme: Theme) => {
    const paletteColor =
      tone === 'error' ? theme.palette.error.main : theme.palette.primary.main
    const hoverColor =
      tone === 'error' ? theme.palette.error.dark : theme.palette.primary.dark

    return {
      width: 34,
      height: 34,
      border: 1,
      borderColor: alpha(paletteColor, 0.44),
      bgcolor: alpha(paletteColor, theme.palette.mode === 'dark' ? 0.18 : 0.1),
      color: paletteColor,
      flex: '0 0 auto',
      '&:hover': {
        borderColor: paletteColor,
        bgcolor: alpha(
          paletteColor,
          theme.palette.mode === 'dark' ? 0.28 : 0.18,
        ),
        color: hoverColor,
      },
      '&.Mui-disabled': {
        borderColor: theme.palette.divider,
        bgcolor: theme.palette.action.disabledBackground,
        color: theme.palette.text.disabled,
        opacity: 0.72,
      },
    }
  }

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
  const theme = useTheme()
  const navigate = useNavigate()
  const showPageRail = useMediaQuery(theme.breakpoints.up('lg'))
  const rootRef = useRef<HTMLDivElement | null>(null)
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

  const toggleCurrentPageEditing = () => {
    if (!currentLesson) {
      return
    }

    onEditingPageKeyChange?.(
      isEditingCurrentPage ? null : currentLesson.dashboardKey,
    )
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
          px: { xs: 1.5, md: 2.25 },
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0}>
          {showPageRail ? (
            <>
              <Typography
                variant="body2"
                color="text.secondary"
                onClick={() => navigate('/study-guides')}
                sx={{ cursor: 'pointer' }}
              >
                My Guides
              </Typography>
              <Typography variant="body2" color="text.secondary">
                /
              </Typography>
            </>
          ) : null}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={900} noWrap>
              {currentLesson.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Page {selectedIndex + 1}/{studyPath.dashboards.length}
            </Typography>
          </Box>
        </Stack>
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          flexWrap="wrap"
        >
          {currentPageEditable ? (
            <Tooltip
              title={
                isEditingCurrentPage
                  ? 'Preview current page'
                  : 'Edit current page'
              }
            >
              <IconButton
                size="small"
                aria-label={
                  isEditingCurrentPage
                    ? 'Preview current page'
                    : 'Edit current page'
                }
                onClick={toggleCurrentPageEditing}
                sx={pageIconButtonSx()}
              >
                {isEditingCurrentPage ? (
                  <VisibilityIcon fontSize="small" />
                ) : (
                  <EditIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          ) : null}
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Tooltip title="Previous page">
              <span>
                <IconButton
                  size="small"
                  aria-label="Previous page"
                  disabled={!canGoPrevious}
                  onClick={() => selectLesson(selectedIndex - 1)}
                  sx={pageIconButtonSx()}
                >
                  <ChevronLeftIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Next page">
              <span>
                <IconButton
                  size="small"
                  aria-label="Next page"
                  disabled={!canGoNext}
                  onClick={() => selectLesson(selectedIndex + 1)}
                  sx={pageIconButtonSx()}
                >
                  <ChevronRightIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>
      <Box
        data-testid="study-path-dashboard-content"
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {showPageRail ? (
          <StudyGuidePagesPanel
            studyPath={studyPath}
            onStudyPathChange={onStudyPathChange}
            onAddPage={onAddPage}
            variant="desktop"
          />
        ) : null}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            p: isEditingCurrentPage ? 2 : 0,
          }}
        >
          {isEditingCurrentPage ? (
            <StudyGuidePageEditor
              title={currentLesson.name}
              markdown={currentMarkdown}
              onChange={updateCurrentMarkdownPage}
            />
          ) : (
            <StudyGuideLinearLayout
              key={currentLesson.dashboardKey}
              layout={studentLayout}
            />
          )}
        </Box>
      </Box>
    </Box>
  )
}

export default StudyPathWorkspaceView
