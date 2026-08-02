import React, { useState } from 'react'
import { Alert, Box, Button, IconButton, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import { useNavigate } from 'react-router-dom'

import { useInterfaceText } from '../../language/interfaceLanguage'

interface DemoConversionBannerProps {
  /** The last page is the moment the visitor has seen the whole sample. */
  isLastPage: boolean
  onClearProgress: () => void
}

/**
 * Sits in the slot the real workspace uses for its learned-topic alert, so the
 * demo gains a conversion surface without moving anything the visitor sees.
 * Info while there is still guide left, success once there is not.
 */
const DemoConversionBanner: React.FC<DemoConversionBannerProps> = ({
  isLastPage,
  onClearProgress,
}) => {
  const { t } = useInterfaceText()
  const theme = useTheme()
  const navigate = useNavigate()
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            color="inherit"
            size="small"
            variant="outlined"
            onClick={() => navigate('/signup')}
            data-testid="demo-banner-cta"
            sx={{ textTransform: 'none', whiteSpace: 'nowrap', fontWeight: 650 }}
          >
            {isLastPage ? t('demo.endCta') : t('demo.bannerCta')}
          </Button>
          <IconButton
            aria-label={t('settings.close')}
            size="small"
            onClick={() =>
              setDismissed((current) => ({ ...current, [tone]: true }))
            }
            sx={{
              flexShrink: 0,
              color:
                theme.palette.mode === 'dark' ? palette.light : palette.dark,
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
        </Box>
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
        {isLastPage ? t('demo.endBody') : t('demo.bannerBody')}{' '}
        <Box
          component="button"
          type="button"
          onClick={onClearProgress}
          data-testid="demo-clear-progress"
          sx={{
            font: 'inherit',
            p: 0,
            border: 0,
            bgcolor: 'transparent',
            color: 'inherit',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          {t('demo.clearProgress')}
        </Box>
      </Typography>
    </Alert>
  )
}

export default DemoConversionBanner
