import React, { useEffect, useState } from 'react'
import { Alert, Box, Button, IconButton, Stack, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import { useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState({ info: false, success: false })
  // Reaching the end is a fact about the visit, not about the page currently
  // open. Paging back to re-read something has not un-shown them the sample,
  // so the closing message and its two ways out stay put. Reset by the caller
  // keying this component on the demo being viewed.
  const [reachedEnd, setReachedEnd] = useState(isLastPage)

  useEffect(() => {
    if (isLastPage) {
      setReachedEnd(true)
    }
  }, [isLastPage])

  const tone = reachedEnd ? 'success' : 'info'

  if (dismissed[tone]) {
    return null
  }

  const palette = reachedEnd ? theme.palette.success : theme.palette.info

  const closeButton = (
    <IconButton
      aria-label={t('settings.close')}
      size="small"
      onClick={() => setDismissed((current) => ({ ...current, [tone]: true }))}
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
  )

  const conversionButtonSx = {
    flexShrink: 0,
    whiteSpace: 'nowrap',
    textTransform: 'none',
    fontWeight: 700,
    color: theme.palette.mode === 'dark' ? palette.light : palette.dark,
    borderColor: alpha(palette.main, 0.42),
    '&:hover': {
      borderColor: palette.main,
      bgcolor: alpha(palette.main, 0.14),
    },
  } as const

  return (
    <Alert
      severity={tone}
      data-testid={reachedEnd ? 'demo-banner-end' : 'demo-banner-sample'}
      action={
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          useFlexGap
          flexWrap="wrap"
          justifyContent="flex-end"
        >
          {/* Only the closing message offers a way out: the earlier one is
              describing what the visitor is reading, not asking for anything. */}
          {reachedEnd ? (
            <>
              <Button
                size="small"
                variant="outlined"
                data-testid="demo-banner-try-another"
                onClick={() => navigate('/try')}
                sx={conversionButtonSx}
              >
                {t('demo.tryAnotherDemo')}
              </Button>
              <Button
                size="small"
                variant="outlined"
                data-testid="demo-banner-log-in"
                onClick={() => navigate('/login')}
                sx={conversionButtonSx}
              >
                {t('demo.logIn')}
              </Button>
            </>
          ) : null}
          {closeButton}
        </Stack>
      }
      sx={{
        flex: '0 0 auto',
        m: { xs: 0, lg: 1 },
        mb: { xs: 1, lg: 0 },
        alignItems: 'center',
      }}
    >
      <Typography variant="body2">
        {reachedEnd ? (
          <Box component="span" sx={{ fontWeight: 700 }}>
            {t('demo.endTitle')}{' '}
          </Box>
        ) : null}
        {reachedEnd ? t('demo.endBody') : t('demo.bannerBody')}
      </Typography>
    </Alert>
  )
}

export default DemoConversionBanner
