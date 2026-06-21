import React from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import ReplayIcon from '@mui/icons-material/Replay'

import { STUDYMESH_ONBOARDING_RESET_EVENT } from '../onboarding/onboardingEvents'
import { seedStudyMeshGuideStudyPath } from '../../studyGuides/studyMeshGuideSeed'
import { STUDY_GUIDES_CHANGED_EVENT } from '../../studyGuides/storage'

interface SettingsDialogProps extends Record<string, unknown> {
  open: boolean
  onClose: () => void
  title?: string
  onDeleteStudyMeshProfile?: () => Promise<void>
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onClose,
  title = 'Application Settings',
  onDeleteStudyMeshProfile,
}) => {
  const [status, setStatus] = React.useState('')
  const [profileDeleteConfirmation, setProfileDeleteConfirmation] =
    React.useState('')
  const [profileDeleteStatus, setProfileDeleteStatus] = React.useState('')
  const [isDeletingProfile, setIsDeletingProfile] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      return
    }

    setStatus('')
    setProfileDeleteConfirmation('')
    setProfileDeleteStatus('')
  }, [open])

  const handleAddStudyMeshGuide = () => {
    seedStudyMeshGuideStudyPath({ force: true })
    window.dispatchEvent(new CustomEvent(STUDY_GUIDES_CHANGED_EVENT))
    setStatus('Welcome guide added.')
  }

  const handleReplayNotices = () => {
    window.dispatchEvent(new CustomEvent(STUDYMESH_ONBOARDING_RESET_EVENT))
    setStatus('Workspace notices reset.')
  }

  const handleDeleteStudyMeshProfile = async () => {
    if (!onDeleteStudyMeshProfile || profileDeleteConfirmation !== 'DELETE') {
      return
    }

    setIsDeletingProfile(true)
    setProfileDeleteStatus('')
    try {
      await onDeleteStudyMeshProfile()
    } catch (error) {
      setProfileDeleteStatus(
        error instanceof Error
          ? error.message
          : 'Could not delete the StudyMesh profile.',
      )
      setIsDeletingProfile(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Paper
            elevation={0}
            sx={{ p: 2, border: 1, borderColor: 'divider' }}
          >
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <MenuBookOutlinedIcon color="primary" />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography fontWeight={700}>Welcome Guide</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Restore the built-in StudyMesh guide in the Study Guides
                  library.
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleAddStudyMeshGuide}
                >
                  Add welcome guide
                </Button>
              </Box>
            </Box>
          </Paper>

          <Paper
            elevation={0}
            sx={{ p: 2, border: 1, borderColor: 'divider' }}
          >
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <ReplayIcon color="primary" />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography fontWeight={700}>Workspace Notices</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Reset lightweight in-app notices.
                </Typography>
                <Button variant="outlined" size="small" onClick={handleReplayNotices}>
                  Reset notices
                </Button>
              </Box>
            </Box>
          </Paper>

          {onDeleteStudyMeshProfile ? (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: 1,
                borderColor: 'error.light',
              }}
            >
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <DeleteOutlineIcon color="error" />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontWeight={700}>Delete StudyMesh Profile</Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1.5 }}
                  >
                    Delete the current StudyMesh profile row and its cloud study
                    data, then sign out.
                  </Typography>
                  <TextField
                    label="Type DELETE to confirm"
                    value={profileDeleteConfirmation}
                    onChange={(event) =>
                      setProfileDeleteConfirmation(event.target.value)
                    }
                    size="small"
                    fullWidth
                    sx={{ mb: 1.5 }}
                  />
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={handleDeleteStudyMeshProfile}
                    disabled={
                      isDeletingProfile ||
                      profileDeleteConfirmation !== 'DELETE'
                    }
                  >
                    {isDeletingProfile
                      ? 'Deleting profile...'
                      : 'Delete StudyMesh profile'}
                  </Button>
                  {profileDeleteStatus ? (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ display: 'block', mt: 1 }}
                    >
                      {profileDeleteStatus}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            </Paper>
          ) : null}

          {status ? (
            <Typography variant="body2" color="text.secondary">
              {status}
            </Typography>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default SettingsDialog
