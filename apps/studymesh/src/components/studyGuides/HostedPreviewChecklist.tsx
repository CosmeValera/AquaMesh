import React from 'react'
import { Box, CircularProgress, Stack, Typography } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'

import {
  buildHostedPreviewRows,
  HostedPreviewState,
} from '../../studyGuides/hostedPreview'
import type { InterfaceTextKey } from '../../language/interfaceLanguage'

/**
 * The guide taking shape, one line per piece the model has finished.
 *
 * Rows keep a fixed height and only the icon changes, so nothing on the card
 * moves as items complete.
 */
const HostedPreviewChecklist: React.FC<{
  preview: HostedPreviewState
  t: (key: InterfaceTextKey) => string
}> = ({ preview, t }) => {
  const rows = buildHostedPreviewRows(preview, t)
  const activeIndex = rows.findIndex((row) => !row.done)

  return (
    <Stack spacing={0}>
      {rows.map((row, index) => (
        <Stack
          key={row.id}
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ minHeight: 26 }}
        >
          <Box
            sx={{
              width: 18,
              height: 18,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {row.done ? (
              <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
            ) : index === activeIndex ? (
              <CircularProgress size={14} thickness={6} />
            ) : (
              <RadioButtonUncheckedIcon
                sx={{ fontSize: 18, color: 'text.disabled' }}
              />
            )}
          </Box>
          <Typography
            variant="caption"
            noWrap
            sx={{
              color:
                row.done || index === activeIndex
                  ? 'text.primary'
                  : 'text.disabled',
              fontWeight: index === activeIndex ? 700 : 400,
            }}
          >
            {row.label}
          </Typography>
        </Stack>
      ))}
    </Stack>
  )
}

export default HostedPreviewChecklist
