import React from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'

import { useInterfaceText } from '../../language/interfaceLanguage'

type DemoTextKey = Parameters<ReturnType<typeof useInterfaceText>['t']>[0]

/**
 * Every affordance the demo cannot honour opens this instead of failing. The
 * demo never shows an error state: a red alert reads as "broken product", not
 * "sample", so a locked action always becomes an invitation.
 */
export type DemoNudgeReason =
  | 'askAi'
  | 'addPage'
  | 'lockedQuickCreate'
  | 'alreadyCreated'

// One shared title, one body per reason: the invitation is always the same,
// only the thing being invited to changes.
const reasonBodyKeys: Record<DemoNudgeReason, DemoTextKey> = {
  askAi: 'demo.nudgeAskAi',
  addPage: 'demo.nudgeAddPage',
  lockedQuickCreate: 'demo.nudgeQuickCreate',
  alreadyCreated: 'demo.nudgeAlreadyCreated',
}

interface DemoSignupNudgeProps {
  reason: DemoNudgeReason | null
  onClose: () => void
}

const DemoSignupNudge: React.FC<DemoSignupNudgeProps> = ({
  reason,
  onClose,
}) => {
  const { t } = useInterfaceText()
  const navigate = useNavigate()
  const bodyKey = reason ? reasonBodyKeys[reason] : null

  return (
    <Dialog
      open={Boolean(bodyKey)}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ 'data-testid': 'demo-signup-nudge' }}
    >
      <DialogTitle sx={{ fontWeight: 800 }}>{t('demo.nudgeTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{bodyKey ? t(bodyKey) : ''}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          data-testid="demo-nudge-dismiss"
          sx={{ textTransform: 'none' }}
        >
          {t('demo.nudgeDismiss')}
        </Button>
        <Button
          variant="contained"
          onClick={() => navigate('/signup')}
          data-testid="demo-nudge-signup"
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
        >
          {t('demo.signUpFree')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DemoSignupNudge
