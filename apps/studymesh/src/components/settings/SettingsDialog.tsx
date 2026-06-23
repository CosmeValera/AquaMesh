import React from 'react'
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'

import KnowledgeContextDialog from '../profile/KnowledgeContextDialog'
import {
  clearProfileContext,
  getUserKnownTopics,
  readProfileContext,
} from '../../profileContext'
import { seedStudyMeshGuideStudyPath } from '../../studyGuides/studyMeshGuideSeed'
import { STUDY_GUIDES_CHANGED_EVENT } from '../../studyGuides/storage'

interface ProfileSettingsProps {
  userId: string
  userName: string
  avatarSrc: string
  avatarStatus: string
  onUserNameChange: (name: string) => void
  onAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveAvatar: () => void
  onSaveProfile: () => void
}

interface SettingsDialogProps extends Record<string, unknown> {
  open: boolean
  onClose: () => void
  title?: string
  profileSettings?: ProfileSettingsProps
  onDeleteStudyMeshProfile?: () => Promise<void>
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onClose,
  title = 'Application Settings',
  profileSettings,
  onDeleteStudyMeshProfile,
}) => {
  const [status, setStatus] = React.useState('')
  const [profileDeleteConfirmation, setProfileDeleteConfirmation] =
    React.useState('')
  const [profileDeleteStatus, setProfileDeleteStatus] = React.useState('')
  const [isDeletingProfile, setIsDeletingProfile] = React.useState(false)
  const [isProfileDeleteConfirmOpen, setIsProfileDeleteConfirmOpen] =
    React.useState(false)
  const [isKnowledgeContextOpen, setIsKnowledgeContextOpen] =
    React.useState(false)
  const [knowledgeContextVersion, setKnowledgeContextVersion] =
    React.useState(0)

  React.useEffect(() => {
    if (!open) {
      return
    }

    setStatus('')
    setProfileDeleteConfirmation('')
    setProfileDeleteStatus('')
    setIsProfileDeleteConfirmOpen(false)
    setIsKnowledgeContextOpen(false)
  }, [open])

  const handleAddStudyMeshGuide = () => {
    seedStudyMeshGuideStudyPath({ force: true })
    window.dispatchEvent(new CustomEvent(STUDY_GUIDES_CHANGED_EVENT))
    setStatus('Welcome guide added.')
  }

  const profileContext = readProfileContext()
  const knownTopics = getUserKnownTopics(profileContext)
  const roleLabel = profileContext?.roles?.length
    ? profileContext.roles
        .map((role) =>
          role
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' / '),
        )
        .join(', ')
    : 'Not set'

  const handleDeleteStudyMeshProfile = async () => {
    if (!onDeleteStudyMeshProfile || profileDeleteConfirmation !== 'DELETE') {
      return
    }

    setIsProfileDeleteConfirmOpen(true)
  }

  const confirmDeleteStudyMeshProfile = async () => {
    if (!onDeleteStudyMeshProfile || profileDeleteConfirmation !== 'DELETE') {
      return
    }

    setIsDeletingProfile(true)
    setProfileDeleteStatus('')
    try {
      await onDeleteStudyMeshProfile()
    } catch (error) {
      setIsProfileDeleteConfirmOpen(false)
      setProfileDeleteStatus(
        error instanceof Error
          ? error.message
          : 'Could not delete the StudyMesh profile.',
      )
      setIsDeletingProfile(false)
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gap: 2 }}>
            {profileSettings ? (
              <Paper
                elevation={0}
                sx={{ p: 2, border: 1, borderColor: 'divider' }}
              >
                <Typography fontWeight={700} sx={{ mb: 1.5 }}>
                  Profile
                </Typography>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      src={profileSettings.avatarSrc || undefined}
                      sx={{
                        width: 64,
                        height: 64,
                        bgcolor: 'primary.main',
                        fontWeight: 600,
                      }}
                    >
                      {profileSettings.userId.substring(0, 2).toUpperCase()}
                    </Avatar>
                    <Stack
                      spacing={1}
                      direction="row"
                      useFlexGap
                      flexWrap="wrap"
                    >
                      <Button
                        component="label"
                        variant="outlined"
                        size="small"
                        startIcon={<PhotoCameraIcon />}
                      >
                        Upload image
                        <input
                          hidden
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={profileSettings.onAvatarUpload}
                        />
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={profileSettings.onRemoveAvatar}
                        disabled={!profileSettings.avatarSrc}
                      >
                        Remove
                      </Button>
                    </Stack>
                  </Stack>
                  {profileSettings.avatarStatus ? (
                    <Typography variant="caption" color="text.secondary">
                      {profileSettings.avatarStatus}
                    </Typography>
                  ) : null}
                  <TextField
                    label="User name"
                    value={profileSettings.userName}
                    onChange={(event) =>
                      profileSettings.onUserNameChange(event.target.value)
                    }
                    fullWidth
                  />
                  <Box>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={profileSettings.onSaveProfile}
                    >
                      Save profile
                    </Button>
                  </Box>
                </Stack>
              </Paper>
            ) : null}

            <Paper
              elevation={0}
              sx={{ p: 2, border: 1, borderColor: 'divider' }}
            >
              <Typography fontWeight={700} sx={{ mb: 1 }}>
                Explanation Context
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                StudyMesh uses this for TLDR analogies in new Study Guides.
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Role: {roleLabel}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {knownTopics.length
                  ? knownTopics.join(', ')
                  : 'No known topics saved.'}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setIsKnowledgeContextOpen(true)}
                >
                  Edit context
                </Button>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    clearProfileContext()
                    setKnowledgeContextVersion((value) => value + 1)
                  }}
                >
                  Reset
                </Button>
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{ p: 2, border: 1, borderColor: 'divider' }}
            >
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <MenuBookOutlinedIcon color="primary" />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontWeight={700}>Welcome Guide</Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1.5 }}
                  >
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

            {onDeleteStudyMeshProfile ? (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: 1,
                  borderColor: 'error.light',
                }}
              >
                <Typography
                  variant="overline"
                  color="error"
                  fontWeight={800}
                  sx={{ display: 'block', mb: 1 }}
                >
                  Danger Zone
                </Typography>
                <Box
                  sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}
                >
                  <DeleteOutlineIcon color="error" />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={700}>
                      Delete StudyMesh Account Data
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1.5 }}
                    >
                      Permanently delete your StudyMesh account.
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
                        : 'Delete StudyMesh account'}
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

      <KnowledgeContextDialog
        key={knowledgeContextVersion}
        open={isKnowledgeContextOpen}
        initialContext={profileContext}
        onClose={() => {
          setIsKnowledgeContextOpen(false)
          setKnowledgeContextVersion((value) => value + 1)
        }}
      />

      <Dialog
        open={isProfileDeleteConfirmOpen}
        onClose={() => {
          if (!isDeletingProfile) {
            setIsProfileDeleteConfirmOpen(false)
          }
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            border: 1,
            borderColor: 'error.main',
          },
        }}
      >
        <DialogTitle sx={{ color: 'error.main', fontWeight: 800 }}>
          Delete StudyMesh Account Data?
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            This permanently deletes your StudyMesh account data, including
            synced study guides and profile details. You
            will be signed out when deletion finishes.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setIsProfileDeleteConfirmOpen(false)}
            disabled={isDeletingProfile}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDeleteStudyMeshProfile}
            disabled={isDeletingProfile}
          >
            {isDeletingProfile
              ? 'Deleting...'
              : 'I understand, delete my account data'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default SettingsDialog
