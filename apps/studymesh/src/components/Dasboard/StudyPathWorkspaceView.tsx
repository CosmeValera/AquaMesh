import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, type Theme } from '@mui/material/styles'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { DashboardLayout, StudyPathContainerState } from '../../state/store'
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

const STUDY_GUIDE_EDITOR_LAYOUT_KEY = 'studymesh-study-guide-editor-layout-v1'

type EditorLayoutMode = 'split' | 'stacked'
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

const readEditorLayoutPreference = (): EditorLayoutMode => {
  try {
    const stored = localStorage.getItem(STUDY_GUIDE_EDITOR_LAYOUT_KEY)
    if (stored === 'split' || stored === 'stacked') {
      return stored
    }

    return window.matchMedia('(max-width: 899.95px)').matches
      ? 'stacked'
      : 'split'
  } catch (error) {
    return 'split'
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
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [editPagesMode, setEditPagesMode] = useState(false)
  const [editorLayout, setEditorLayout] = useState<EditorLayoutMode>(
    readEditorLayoutPreference,
  )
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

  const updateEditorLayout = (nextLayout: EditorLayoutMode) => {
    setEditorLayout(nextLayout)
    try {
      localStorage.setItem(STUDY_GUIDE_EDITOR_LAYOUT_KEY, nextLayout)
    } catch (error) {
      console.error('Failed to save Study Guide editor layout', error)
    }
  }

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

  const moveLesson = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    onStudyPathChange(reorderStudyGuidePage(studyPath, index, nextIndex))
  }

  const deleteLesson = (dashboardKey: string) => {
    onStudyPathChange(deleteStudyGuidePage(studyPath, dashboardKey))
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
          px: 1.5,
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
        <Stack spacing={0.25} minWidth={0}>
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
          <Button
            size="small"
            variant={editPagesMode ? 'contained' : 'outlined'}
            onClick={() => setEditPagesMode((current) => !current)}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Edit Pages
          </Button>
          {currentPageEditable ? (
            <Button
              size="small"
              variant={isEditingCurrentPage ? 'contained' : 'outlined'}
              onClick={toggleCurrentPageEditing}
              sx={{ borderRadius: 2, textTransform: 'none' }}
            >
              {isEditingCurrentPage
                ? 'Preview current page'
                : 'Edit current page'}
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
          overflowY: 'auto',
          overflowX: 'hidden',
          p: editPagesMode || isEditingCurrentPage ? 2 : 0,
        }}
      >
        {editPagesMode ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
              gap: 1.5,
            }}
          >
            {studyPath.dashboards.map((lesson, index) => {
              const active = index === selectedIndex
              return (
                <Paper
                  key={lesson.dashboardKey}
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: 1,
                    borderColor: active ? 'primary.main' : 'divider',
                    bgcolor: active ? 'action.selected' : 'background.paper',
                  }}
                >
                  <Stack spacing={1.25}>
                    <Button
                      variant="text"
                      onClick={() => selectLesson(index)}
                      sx={{
                        p: 0,
                        color: 'text.primary',
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                      }}
                    >
                      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">
                          Page {index + 1}
                        </Typography>
                        <Typography
                          variant="subtitle2"
                          fontWeight={900}
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {lesson.name}
                        </Typography>
                      </Stack>
                    </Button>
                    <Stack direction="row" spacing={0.75}>
                      <Tooltip title="Move page up">
                        <span>
                          <IconButton
                            size="small"
                            aria-label={`Move ${lesson.name} up`}
                            disabled={index === 0}
                            onClick={() => moveLesson(index, -1)}
                            sx={pageIconButtonSx()}
                          >
                            <ArrowUpwardIcon fontSize="small" />
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
                            sx={pageIconButtonSx()}
                          >
                            <ArrowDownwardIcon fontSize="small" />
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
                            sx={pageIconButtonSx('error')}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Paper>
              )
            })}
          </Box>
        ) : isEditingCurrentPage ? (
          <Stack
            spacing={2}
            sx={{ maxWidth: editorLayout === 'split' ? 1280 : 920, mx: 'auto' }}
          >
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              {(['split', 'stacked'] as EditorLayoutMode[]).map((mode) => (
                <Button
                  key={mode}
                  size="small"
                  variant={editorLayout === mode ? 'contained' : 'outlined'}
                  onClick={() => updateEditorLayout(mode)}
                  sx={{ borderRadius: 2, textTransform: 'none' }}
                >
                  {mode === 'split' ? 'Split' : 'Stacked'}
                </Button>
              ))}
            </Stack>
            <Box
              sx={{
                display: {
                  xs: 'flex',
                  md: editorLayout === 'split' ? 'grid' : 'flex',
                },
                gridTemplateColumns: { md: 'minmax(0, 1fr) minmax(0, 1fr)' },
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <Stack spacing={2} minWidth={0}>
                <TextField
                  label="Page title"
                  value={currentLesson.name}
                  onChange={(event) =>
                    updateCurrentMarkdownPage(
                      event.target.value,
                      currentMarkdown,
                    )
                  }
                  fullWidth
                />
                <TextField
                  label="Markdown"
                  value={currentMarkdown}
                  onChange={(event) =>
                    updateCurrentMarkdownPage(
                      currentLesson.name,
                      event.target.value,
                    )
                  }
                  fullWidth
                  multiline
                  minRows={editorLayout === 'split' ? 24 : 18}
                  InputProps={{
                    sx: {
                      fontFamily: 'JetBrains Mono, Consolas, monospace',
                      alignItems: 'flex-start',
                    },
                  }}
                />
              </Stack>
              <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
                <Typography variant="overline" color="text.secondary">
                  Preview
                </Typography>
                <Stack spacing={1.25}>{renderMarkdown(currentMarkdown)}</Stack>
              </Paper>
            </Box>
          </Stack>
        ) : (
          <StudyGuideLinearLayout
            key={currentLesson.dashboardKey}
            layout={studentLayout}
          />
        )}
      </Box>
    </Box>
  )
}

export default StudyPathWorkspaceView
