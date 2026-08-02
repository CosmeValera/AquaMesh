import React, { useState } from 'react'
import { Alert, Box, IconButton, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'

import { useInterfaceText } from '../../language/interfaceLanguage'

interface DemoConversionBannerProps {
  /** The last page is the moment the visitor has seen the whole sample. */
  isLastPage: boolean
}

/**
 * Sits in the slot the real workspace uses for its learned-topic alert, so the
 * demo states what it is without moving anything the visitor sees.
 * Info while there is still guide left, success once there is not.
 */
const DemoConversionBanner: React.FC<DemoConversionBannerProps> = ({
  isLastPage,
}) => {
  const { t } = useInterfaceText()
  const theme = useTheme()
  const [dismissed, setDismissed] = useState({ info: false, success: false })
  const tone = isLastPage ? 'success' : 'info'

  if (dismissed[tone]) {
    return null
  }

  const palette = isLastPage ? theme.palette.success : theme.palette.info

  return (
    <Alert
      severity={tone}
      data-testid={isLastPage ? 'demo-banner-end' : 'demo-banner-sample'}
      action={
        <IconButton
          aria-label={t('settings.close')}
          size="small"
          onClick={() =>
            setDismissed((current) => ({ ...current, [tone]: true }))
          }
          sx={{
            flexShrink: 0,
            color: theme.palette.mode === 'dark' ? palette.light : palette.dark,
            bgcolor: alpha(palette.main, 0.08),
            border: 1,
            borderColor: alpha(palette.main, 0.32),
            '&:hover': {
              bgcolor: alpha(palette.main, 0.2),
              borderColor: alpha(palette.main, 0.48),
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      }
      sx={{
        flex: '0 0 auto',
        m: { xs: 0, lg: 1 },
        mb: { xs: 1, lg: 0 },
        alignItems: 'center',
      }}
    >
      <Typography variant="body2">
        {isLastPage ? (
          <Box component="span" sx={{ fontWeight: 700 }}>
            {t('demo.endTitle')}{' '}
          </Box>
        ) : null}
        {isLastPage ? t('demo.endBody') : t('demo.bannerBody')}
      </Typography>
    </Alert>
  )
}

export default DemoConversionBanner
