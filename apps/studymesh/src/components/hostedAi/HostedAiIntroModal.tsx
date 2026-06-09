import React from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import TollIcon from '@mui/icons-material/Toll'

import {
  readStudyPackAiSettings,
  saveStudyPackAiSettings,
  STUDY_CREDITS_LABEL,
} from '../../studyPack/ai'
import { useAuth } from '../../auth/AuthProvider'
import HostedAiCreditActions from './HostedAiCreditActions'
import { useHostedAiStatus } from './useHostedAiStatus'

const HostedAiIntroModal: React.FC = () => {
  const auth = useAuth()
  const { status, loading, markIntroSeen } = useHostedAiStatus()
  const [saving, setSaving] = React.useState(false)

  const open = Boolean(
    auth.user && status?.accountReady && !status.introSeen && !loading,
  )

  const saveProvider = (provider: 'hosted' | 'gemini') => {
    const current = readStudyPackAiSettings()
    saveStudyPackAiSettings({
      ...current,
      provider,
    })
  }

  const handleUseHosted = async () => {
    setSaving(true)
    try {
      saveProvider('hosted')
      await markIntroSeen()
    } finally {
      setSaving(false)
    }
  }

  const handleBringOwnKey = async () => {
    setSaving(true)
    try {
      saveProvider('gemini')
      await markIntroSeen()
    } finally {
      setSaving(false)
    }
  }

  if (!status) {
    return null
  }

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            <AutoAwesomeIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={900}>
              Hosted AI is ready
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start with free {STUDY_CREDITS_LABEL}.
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.default',
          }}
        >
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              icon={<TollIcon />}
              label={`${status.studyCredits} credits`}
            />
            <Chip label={`Study Guide: ${status.costs['study-guide']}`} />
            <Chip label={`Quick Create: ${status.costs['quick-create']}`} />
            <Chip label={`Chat: ${status.costs.chat}`} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            You get {status.initialFreeCredits} credits on first login. Free
            balance refills to {status.dailyFreeCredits} credits each day.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, flexWrap: 'wrap' }}>
        <HostedAiCreditActions />
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={handleBringOwnKey} disabled={saving}>
          Bring my own key
        </Button>
        <Button variant="contained" onClick={handleUseHosted} disabled={saving}>
          Use hosted AI
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default HostedAiIntroModal
