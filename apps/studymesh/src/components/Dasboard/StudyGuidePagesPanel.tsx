import React, { useState } from 'react'
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
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'

import type { StudyPathContainerState } from '../../state/store'
import {
  deleteStudyGuidePage,
  reorderStudyGuidePage,
} from '../../studyGuides/pages'

type StudyGuidePagesPanelVariant = 'desktop' | 'mobile'

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
      width: 34,
      height: 34,
      border: 1,
      borderColor: alpha(color, 0.44),
      bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.18 : 0.1),
      color,
      flex: '0 0 auto',
      '&:hover': {
        borderColor: color,
        bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.28 : 0.18),
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
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

  const dropPage = (event: React.DragEvent, targetIndex: number) => {
    event.preventDefault()
    const rawIndex = event.dataTransfer.getData('text/plain')
    const sourceIndex = draggedIndex ?? Number.parseInt(rawIndex, 10)
    if (Number.isInteger(sourceIndex)) {
      movePage(sourceIndex, targetIndex)
    }
    setDraggedIndex(null)
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
            color: 'primary.main',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            py: 1,
          }}
        >
          <MenuBookOutlinedIcon fontSize="small" />
          <Typography
            variant="caption"
            sx={{ writingMode: 'vertical-rl', fontWeight: 900 }}
          >
            Pages
          </Typography>
        </Box>
      </Tooltip>
    )
  }

  return (
    <Box
      data-testid={`study-guide-pages-panel-${variant}`}
      sx={{
        width: mobile ? '100%' : 248,
        height: '100%',
        flex: mobile ? 1 : '0 0 auto',
        minHeight: 0,
        borderRight: mobile ? 0 : 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography variant="subtitle2" fontWeight={900}>
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
                onDragOver={
                  mobile
                    ? undefined
                    : (event) => {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                      }
                }
                onDrop={mobile ? undefined : (event) => dropPage(event, index)}
                sx={(theme) => ({
                  mx: 0.75,
                  px: 0.5,
                  py: 0.75,
                  borderRadius: 1.5,
                  border: 1,
                  borderColor: active ? 'primary.main' : 'transparent',
                  bgcolor: active
                    ? alpha(theme.palette.primary.main, 0.12)
                    : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                  },
                })}
              >
                {!mobile ? (
                  <Tooltip>
                    <Box
                      component="span"
                      draggable
                      aria-label={`Drag ${page.name} to reorder`}
                      onDragStart={(event) => {
                        setDraggedIndex(index)
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', String(index))
                      }}
                      onDragEnd={() => setDraggedIndex(null)}
                      sx={{
                        display: 'grid',
                        placeItems: 'center',
                        color: 'text.secondary',
                        cursor: 'grab',
                      }}
                    >
                      <DragIndicatorIcon fontSize="small" />
                    </Box>
                  </Tooltip>
                ) : null}
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
                    color: active ? 'primary.main' : 'text.primary',
                  }}
                >
                  <Stack direction="row" spacing={1} minWidth={0}>
                    <Typography variant="caption" fontWeight={900}>
                      {String(index + 1).padStart(2, '0')}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={active ? 900 : 500}
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
        </Stack>
      </Box>
      {onAddPage ? (
        <Box sx={{ p: 1.25, borderTop: 1, borderColor: 'divider' }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<AddIcon fontSize="small" />}
            onClick={onAddPage}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Add Page
          </Button>
        </Box>
      ) : null}
    </Box>
  )
}

export default StudyGuidePagesPanel
