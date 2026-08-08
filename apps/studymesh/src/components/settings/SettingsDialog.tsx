import React from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'

import { seedStudyMeshGuideStudyPath } from '../../studyGuides/studyMeshGuideSeed'
import { STUDY_GUIDES_CHANGED_EVENT } from '../../studyGuides/storage'
import {
  readContentLanguageSettings,
  type ContentLanguageSettings,
  type InterfaceLanguageCode,
} from '../../language/contentLanguage'
import { useInterfaceText } from '../../language/interfaceLanguage'

interface SettingsDialogProps extends Record<string, unknown> {
  open: boolean
  onClose: () => void
  title?: string
  onDeleteStudyMeshProfile?: () => Promise<void>
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onClose,
  title,
  onDeleteStudyMeshProfile,
}) => {
  const { t, setLanguage } = useInterfaceText()
  const [status, setStatus] = React.useState('')
  const [languageSettings, setLanguageSettings] =
    React.useState<ContentLanguageSettings>(() => readContentLanguageSettings())
  const [profileDeleteConfirmation, setProfileDeleteConfirmation] =
    React.useState('')
  const [profileDeleteStatus, setProfileDeleteStatus] = React.useState('')
  const [isDeletingProfile, setIsDeletingProfile] = React.useState(false)
  const [isProfileDeleteConfirmOpen, setIsProfileDeleteConfirmOpen] =
    React.useState(false)

  React.useEffect(() => {
    if (!open) {
      return
    }

    setStatus('')
    setProfileDeleteConfirmation('')
    setProfileDeleteStatus('')
    setIsProfileDeleteConfirmOpen(false)
    setLanguageSettings(readContentLanguageSettings())
  }, [open])

  const persistLanguageSettings = (nextSettings: ContentLanguageSettings) => {
    setLanguageSettings(nextSettings)
    setLanguage(nextSettings.interfaceLanguage)
  }

  const handleAddStudyMeshGuide = () => {
    seedStudyMeshGuideStudyPath({ force: true })
    window.dispatchEvent(new CustomEvent(STUDY_GUIDES_CHANGED_EVENT))
    setStatus(t('settings.welcomeGuideAdded'))
  }

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
          : t('settings.deleteProfileFailed'),
      )
      setIsDeletingProfile(false)
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{title || t('settings.title')}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Paper
              elevation={0}
              sx={{ p: 2, border: 1, borderColor: 'divider' }}
            >
              <Typography fontWeight={700} sx={{ mb: 1.5 }}>
                {t('settings.language')}
              </Typography>
              <Stack spacing={2}>
                <TextField
                  select
                  label={t('settings.interfaceLanguage')}
                  value={languageSettings.interfaceLanguage}
                  onChange={(event) =>
                    persistLanguageSettings({
                      ...languageSettings,
                      interfaceLanguage: event.target
                        .value as InterfaceLanguageCode,
                    })
                  }
                  fullWidth
                  size="small"
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="es">Español</MenuItem>
                  <MenuItem value="fr">Français</MenuItem>
                  <MenuItem value="de">Deutsch</MenuItem>
                </TextField>
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{ p: 2, border: 1, borderColor: 'divider' }}
            >
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <MenuBookOutlinedIcon color="primary" />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontWeight={700}>
                    {t('settings.welcomeGuide')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1.5 }}
                  >
                    {t('settings.welcomeGuideHelp')}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleAddStudyMeshGuide}
                  >
                    {t('settings.addWelcomeGuide')}
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
                  {t('settings.dangerZone')}
                </Typography>
                <Box
                  sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}
                >
                  <DeleteOutlineIcon color="error" />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={700}>
                      {t('settings.deleteAccountData')}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1.5 }}
                    >
                      {t('settings.deleteAccountHelp')}
                    </Typography>
                    <TextField
                      label={t('settings.typeDelete')}
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
                        ? t('settings.deletingProfile')
                        : t('settings.deleteAccount')}
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
          <Button onClick={onClose}>{t('settings.close')}</Button>
        </DialogActions>
      </Dialog>

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
          {t('settings.deleteConfirmTitle')}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            {t('settings.deleteConfirmBody')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setIsProfileDeleteConfirmOpen(false)}
            disabled={isDeletingProfile}
          >
            {t('settings.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDeleteStudyMeshProfile}
            disabled={isDeletingProfile}
          >
            {isDeletingProfile
              ? t('settings.deletingProfile')
              : t('settings.deleteConfirmAction')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default SettingsDialog
