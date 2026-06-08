import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import TollIcon from '@mui/icons-material/Toll'

import { STUDY_CREDITS_LABEL } from '../../studyPack/ai'
import HostedAiSettingsPanel from './HostedAiSettingsPanel'

interface StudyCreditsDialogProps {
  open: boolean
  onClose: () => void
}

const StudyCreditsDialog: React.FC<StudyCreditsDialogProps> = ({
  open,
  onClose,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle sx={{ pr: 7 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <TollIcon color="primary" />
        <Stack spacing={0.25}>
          <Typography component="span" variant="h6" fontWeight={900}>
            {STUDY_CREDITS_LABEL}
          </Typography>
          <Typography component="span" variant="body2" color="text.secondary">
            Hosted AI balance, generation costs, and refill status.
          </Typography>
        </Stack>
      </Stack>
      <IconButton
        aria-label="Close Study Credits"
        onClick={onClose}
        sx={{ position: 'absolute', right: 12, top: 12 }}
      >
        <CloseIcon />
      </IconButton>
    </DialogTitle>
    <DialogContent sx={{ pt: 0 }}>
      <HostedAiSettingsPanel />
    </DialogContent>
  </Dialog>
)

export default StudyCreditsDialog
