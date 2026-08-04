import React from 'react'
import { Box, Button, Drawer, IconButton, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'

import { readProfileContext, type ProfileContext } from '../../profileContext'
import { studioPanelWidth } from '../workspace/workspaceStudioModel'
import { useInterfaceText } from '../../language/interfaceLanguage'
import { KnownTopicsForm } from './KnownTopicsForm'

interface KnownTopicsPanelProps {
  open: boolean
  onClose: () => void
}

const KnownTopicsPanel: React.FC<KnownTopicsPanelProps> = ({
  open,
  onClose,
}) => {
  const { t } = useInterfaceText()
  const [initialContext, setInitialContext] =
    React.useState<ProfileContext | null>(null)
  const handleSelectedCountChange = React.useCallback(() => {}, [])

  // Re-read on every open so the form starts from whatever cloud sync or another
  // tab persisted while the panel was closed.
  React.useEffect(() => {
    if (open) {
      setInitialContext(readProfileContext())
    }
  }, [open])

  return (
    <Drawer
      anchor="right"
      variant="temporary"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: studioPanelWidth },
          maxWidth: '100%',
          borderRadius: 0,
          bgcolor: 'background.default',
          backgroundImage: 'none',
        },
      }}
    >
      <Stack sx={{ height: '100%', minHeight: 0 }}>
        <Box
          sx={(theme) => ({
            position: 'sticky',
            top: 0,
            zIndex: 1,
            pr: 6,
            pl: 2.5,
            pt: 2,
            pb: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 6px 18px rgba(0,0,0,0.32)'
                : '0 6px 18px rgba(15,23,42,0.06)',
          })}
        >
          <Typography variant="h6" fontWeight={700}>
            {t('knownTopics.panelTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('knowledgeContext.introTitle')}
          </Typography>
          <IconButton
            aria-label={t('knownTopics.closePanel')}
            onClick={onClose}
            sx={(theme) => ({
              position: 'absolute',
              top: 12,
              right: 12,
              width: 38,
              height: 38,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              color: 'text.primary',
              '&:hover': {
                borderColor: alpha(theme.palette.primary.main, 0.3),
                bgcolor: alpha(
                  theme.palette.primary.main,
                  theme.palette.mode === 'dark' ? 0.12 : 0.06,
                ),
              },
            })}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2.5, py: 2.5 }}>
          <KnownTopicsForm
            initialContext={initialContext}
            onSelectedCountChange={handleSelectedCountChange}
          />
        </Box>

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 2.5,
            py: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {t('knownTopics.footerNote')}
          </Typography>
          <Button variant="outlined" onClick={onClose}>
            {t('knownTopics.done')}
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  )
}

export default KnownTopicsPanel
