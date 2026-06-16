import React, { useRef, useState } from 'react'
import {
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, type Theme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'

import type { StudyPathContainerState } from '../../state/store'
import {
  deleteStudyGuidePage,
  reorderStudyGuidePage,
} from '../../studyGuides/pages'

type StudyGuidePagesPanelVariant = 'desktop' | 'mobile'

const PAGES_PANEL_MIN_WIDTH = 220
const PAGES_PANEL_MAX_WIDTH = 440

interface StudyGuidePagesPanelProps {
  studyPath: StudyPathContainerState
  onStudyPathChange: (studyPath: StudyPathContainerState) => void
  onAddPage?: () => void
  onPageSelected?: () => void
  variant: StudyGuidePagesPanelVariant
}

const pageIconButtonSx =
  (tone: 'primary' | 'error' = 'primary') =>
  (theme: Theme) => {
    const color =
      tone === 'error' ? theme.palette.error.main : theme.palette.primary.main

    return {
      width: 32,
      height: 32,
      border: 1,
      borderColor:
        tone === 'error' ? alpha(color, 0.36) : theme.palette.divider,
      bgcolor: 'background.paper',
      color,
      flex: '0 0 auto',
      '&:hover': {
        borderColor: tone === 'error' ? color : theme.palette.text.secondary,
        bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.14 : 0.08),
      },
      '&.Mui-disabled': {
        borderColor: theme.palette.divider,
        bgcolor: theme.palette.action.disabledBackground,
        color: theme.palette.text.disabled,
        opacity: 0.72,
      },
    }
  }

const StudyGuidePagesPanel: React.FC<StudyGuidePagesPanelProps> = ({
  studyPath,
  onStudyPathChange,
  onAddPage,
  onPageSelected,
  variant,
}) => {
  const [open, setOpen] = useState(true)
  const [panelWidth, setPanelWidth] = useState(248)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null)
  const pageRowRefs = useRef<Array<HTMLDivElement | null>>([])
  const mobile = variant === 'mobile'
  const selectedIndex = Math.min(
    Math.max(studyPath.selectedIndex || 0, 0),
    Math.max(studyPath.dashboards.length - 1, 0),
  )

  const selectPage = (index: number) => {
    onStudyPathChange({ ...studyPath, selectedIndex: index })
    onPageSelected?.()
  }

  const movePage = (fromIndex: number, toIndex: number) => {
    onStudyPathChange(reorderStudyGuidePage(studyPath, fromIndex, toIndex))
  }

  const getInsertionIndex = (clientY: number): number => {
    const targetIndex = pageRowRefs.current.findIndex((row) => {
      if (!row) {
        return false
      }

      const rect = row.getBoundingClientRect()
      return clientY < rect.top + rect.height / 2
    })

    return targetIndex < 0 ? studyPath.dashboards.length : targetIndex
  }

  const allowPanelDrop = (event: React.DragEvent) => {
    if (mobile || draggedIndex === null) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setInsertionIndex(getInsertionIndex(event.clientY))
  }

  const dropPage = (event: React.DragEvent) => {
    event.preventDefault()
    const rawIndex = event.dataTransfer.getData('text/plain')
    const sourceIndex = draggedIndex ?? Number.parseInt(rawIndex, 10)
    const targetSlot = insertionIndex ?? getInsertionIndex(event.clientY)
    if (Number.isInteger(sourceIndex) && sourceIndex !== null) {
      const targetIndex = sourceIndex < targetSlot ? targetSlot - 1 : targetSlot
      movePage(
        sourceIndex,
        Math.max(0, Math.min(studyPath.dashboards.length - 1, targetIndex)),
      )
    }
    setDraggedIndex(null)
    setInsertionIndex(null)
  }

  const startPanelResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setPanelWidth(
        Math.max(
          PAGES_PANEL_MIN_WIDTH,
          Math.min(
            PAGES_PANEL_MAX_WIDTH,
            startWidth + moveEvent.clientX - startX,
          ),
        ),
      )
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

  if (!mobile && !open) {
    return (
      <Tooltip title="Open Pages">
        <Box
          component="button"
          type="button"
          aria-label="Open Pages panel"
          onClick={() => setOpen(true)}
          sx={{
            width: 58,
            height: '100%',
            flex: '0 0 auto',
            border: 0,
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            color: 'text.secondary',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            py: 1,
          }}
        >
          <MenuBookOutlinedIcon fontSize="small" />
          <Typography variant="caption" sx={{ writingMode: 'vertical-rl' }}>
            Pages
          </Typography>
        </Box>
      </Tooltip>
    )
  }

  return (
    <Box
      data-testid={`study-guide-pages-panel-${variant}`}
      onDragOver={mobile ? undefined : allowPanelDrop}
      onDrop={mobile ? undefined : dropPage}
      sx={{
        width: mobile ? '100%' : panelWidth,
        height: '100%',
        flex: mobile ? 1 : '0 0 auto',
        minHeight: 0,
        borderRight: mobile ? 0 : 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          Pages
        </Typography>
        {!mobile ? (
          <Tooltip title="Close Pages">
            <IconButton
              size="small"
              aria-label="Close Pages panel"
              onClick={() => setOpen(false)}
              sx={pageIconButtonSx()}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', py: 0.75 }}>
        <Stack spacing={0.5}>
          {studyPath.dashboards.map((page, index) => {
            const active = index === selectedIndex
            return (
              <Box
                key={page.dashboardKey}
                ref={(element: HTMLDivElement | null) => {
                  pageRowRefs.current[index] = element
                }}
                data-testid={`study-guide-page-row-${index}`}
                data-drop-before={
                  !mobile && insertionIndex === index ? 'true' : undefined
                }
                draggable={!mobile}
                aria-label={mobile ? undefined : `Drag ${page.name} to reorder`}
                onDragStart={
                  mobile
                    ? undefined
                    : (event) => {
                        setDraggedIndex(index)
                        setInsertionIndex(index)
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', String(index))
                      }
                }
                onDragEnd={
                  mobile
                    ? undefined
                    : () => {
                        setDraggedIndex(null)
                        setInsertionIndex(null)
                      }
                }
                sx={(theme) => ({
                  mx: 0.75,
                  px: 0.25,
                  py: 0.5,
                  borderRadius: 1,
                  border: 1,
                  borderColor: active
                    ? alpha(theme.palette.primary.main, 0.24)
                    : 'transparent',
                  bgcolor: active
                    ? alpha(theme.palette.primary.main, 0.055)
                    : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  position: 'relative',
                  opacity: draggedIndex === index ? 0.52 : 1,
                  cursor: mobile
                    ? 'default'
                    : draggedIndex === index
                    ? 'grabbing'
                    : 'grab',
                  transition: theme.transitions.create([
                    'background-color',
                    'border-color',
                    'opacity',
                  ]),
                  '&::before': {
                    content: '""',
                    display: active
                      ? 'block'
                      : !mobile && insertionIndex === index
                      ? 'block'
                      : 'none',
                    position: 'absolute',
                    top: active ? 8 : -4,
                    bottom: active ? 8 : 'auto',
                    left: active ? 0 : 8,
                    right: active ? 'auto' : 4,
                    width: active ? 3 : 'auto',
                    height: active ? 'auto' : 3,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.primary.main, 0.82),
                    pointerEvents: 'none',
                  },
                  '&:hover': {
                    bgcolor: active
                      ? alpha(theme.palette.primary.main, 0.07)
                      : theme.palette.action.hover,
                  },
                })}
              >
                <Button
                  onClick={() => selectPage(index)}
                  sx={{
                    minWidth: 0,
                    flex: 1,
                    px: 0.5,
                    py: 0.25,
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    textTransform: 'none',
                    color: 'text.primary',
                  }}
                >
                  <Stack direction="row" spacing={1} minWidth={0}>
                    <Typography variant="caption" fontWeight={600}>
                      {String(index + 1).padStart(2, '0')}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={active ? 600 : 500}
                      sx={{
                        lineHeight: 1.25,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {page.name}
                    </Typography>
                  </Stack>
                </Button>
                {mobile ? (
                  <>
                    <IconButton
                      size="small"
                      aria-label={`Move ${page.name} up`}
                      disabled={index === 0}
                      onClick={() => movePage(index, index - 1)}
                      sx={pageIconButtonSx()}
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Move ${page.name} down`}
                      disabled={index === studyPath.dashboards.length - 1}
                      onClick={() => movePage(index, index + 1)}
                      sx={pageIconButtonSx()}
                    >
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                  </>
                ) : null}
                {page.deletable ? (
                  <Tooltip title="Delete page">
                    <IconButton
                      size="small"
                      aria-label={`Delete ${page.name}`}
                      onClick={() =>
                        onStudyPathChange(
                          deleteStudyGuidePage(studyPath, page.dashboardKey),
                        )
                      }
                      sx={pageIconButtonSx('error')}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Box>
            )
          })}
          {!mobile ? (
            <Box
              data-testid="study-guide-page-end-slot"
              data-drop-active={
                insertionIndex === studyPath.dashboards.length
                  ? 'true'
                  : undefined
              }
              sx={{
                height: 3,
                mx: 1.25,
                borderRadius: 999,
                bgcolor:
                  insertionIndex === studyPath.dashboards.length
                    ? 'primary.main'
                    : 'transparent',
                pointerEvents: 'none',
              }}
            />
          ) : null}
        </Stack>
      </Box>
      {onAddPage ? (
        <Box sx={{ p: 1.25, borderTop: 1, borderColor: 'divider' }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<AddIcon fontSize="small" />}
            onClick={onAddPage}
            sx={{
              borderRadius: 1,
              textTransform: 'none',
              bgcolor: 'background.paper',
              borderColor: 'divider',
              color: 'text.primary',
            }}
          >
            Add Page
          </Button>
        </Box>
      ) : null}
      {!mobile ? (
        <Box
          role="separator"
          aria-label="Resize Pages panel"
          onMouseDown={startPanelResize}
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            width: 9,
            cursor: 'col-resize',
            zIndex: 3,
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: 2,
              borderRadius: 999,
              bgcolor: 'divider',
            },
            '&:hover::after': { bgcolor: 'primary.main' },
          }}
        />
      ) : null}
    </Box>
  )
}

export default StudyGuidePagesPanel
