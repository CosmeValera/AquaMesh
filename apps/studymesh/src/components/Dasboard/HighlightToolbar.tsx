import React, { useCallback, useEffect, useState } from 'react'
import {
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  HighlightColor,
  HIGHLIGHT_COLORS,
} from './dashboardHighlights'

interface HighlightToolbarProps {
  onHighlight: (color: HighlightColor) => void
  onClose: () => void
}

export const HighlightToolbar: React.FC<HighlightToolbarProps> = ({
  onHighlight,
  onClose,
}) => {
  return (
    <Paper
      elevation={4}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        p: 1,
        pb: 'calc(1rem + env(safe-area-inset-bottom))',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Typography variant="caption" fontWeight={900} color="text.secondary" sx={{ mr: 1 }}>
        Highlight:
      </Typography>
      {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((color) => (
        <Tooltip key={color} title={HIGHLIGHT_COLORS[color].label}>
          <IconButton
            onClick={() => onHighlight(color)}
            sx={{
              width: 40,
              height: 40,
              bgcolor: HIGHLIGHT_COLORS[color].bg,
              border: '2px solid transparent',
              '&:hover': {
                borderColor: color === 'yellow' ? '#f9a825' : HIGHLIGHT_COLORS[color].bg.replace('0.5', '1'),
              },
            }}
          />
        </Tooltip>
      ))}
      <Tooltip title="Cancel">
        <IconButton
          onClick={onClose}
          sx={{
            width: 40,
            height: 40,
            ml: 1,
            bgcolor: 'action.hover',
          }}
        >
          ✕
        </IconButton>
      </Tooltip>
    </Paper>
  )
}

interface UseHighlightSelectionResult {
  selectedText: string
  handleTextSelect: () => void
  clearSelection: () => void
}

export const useHighlightSelection = (
  onSelectionChange: (text: string) => void,
): UseHighlightSelectionResult => {
  const [selectedText, setSelectedText] = useState('')

  const handleTextSelect = useCallback(() => {
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && selection.toString().trim()) {
      const text = selection.toString().trim()
      setSelectedText(text)
      onSelectionChange(text)
    }
  }, [onSelectionChange])

  const clearSelection = useCallback(() => {
    setSelectedText('')
    window.getSelection()?.removeAllRanges()
  }, [])

  // Desktop mouse selection
  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelect)
    return () => document.removeEventListener('mouseup', handleTextSelect)
  }, [handleTextSelect])

  // Mobile touch selection
  useEffect(() => {
    const handleTouchEnd = () => {
      setTimeout(handleTextSelect, 300)
    }
    document.addEventListener('touchend', handleTouchEnd)
    return () => document.removeEventListener('touchend', handleTouchEnd)
  }, [handleTextSelect])

  return { selectedText, handleTextSelect, clearSelection }
}
