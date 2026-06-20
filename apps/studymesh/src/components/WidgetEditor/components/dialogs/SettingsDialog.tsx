import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Switch,
  Divider,
  Paper,
  Grid,
  Chip,
  TextField,
  Alert,
  Checkbox,
  IconButton,
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import WidgetsIcon from '@mui/icons-material/Widgets'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import SaveIcon from '@mui/icons-material/Save'
import EditIcon from '@mui/icons-material/Edit'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import SettingsIcon from '@mui/icons-material/Settings'
import DashboardIcon from '@mui/icons-material/Dashboard'
import SearchIcon from '@mui/icons-material/Search'
import ReplayIcon from '@mui/icons-material/Replay'

import { STUDYMESH_ONBOARDING_RESET_EVENT } from '../../../onboarding/onboardingEvents'
import { seedStudyMeshGuideStudyPath } from '../../../../studyGuides/studyMeshGuideSeed'
import {
  STUDY_GUIDES_CHANGED_EVENT,
  STUDY_GUIDES_STORAGE_KEY,
  StudyGuideStorage,
} from '../../../../studyGuides/storage'

const WORKSPACE_ONBOARDING_KEY = 'studymesh-workspace-onboarding-v1'
type ExportLibraryItemType = 'dashboard' | 'studyGuide'

const normalizeExportFolderName = (folder?: unknown) =>
  typeof folder === 'string' && folder.trim() ? folder.trim() : 'Default'

const createExportLibraryItem = (
  item: unknown,
  itemType: ExportLibraryItemType,
  index: number,
): ExportLibraryItem => {
  const record =
    item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
  const folderName =
    itemType === 'studyGuide'
      ? normalizeExportFolderName(record.folderName)
      : normalizeExportFolderName(record.folder)
  const fallbackName =
    itemType === 'studyGuide'
      ? `Study Guide ${index + 1}`
      : `Dashboard ${index + 1}`
  const name =
    typeof record.name === 'string' && record.name.trim()
      ? record.name.trim()
      : typeof record.title === 'string' && record.title.trim()
        ? record.title.trim()
        : fallbackName

  return { item, itemType, index, folderName, name }
}

interface ExportLibraryItem {
  item: unknown
  itemType: ExportLibraryItemType
  index: number
  folderName: string
  name: string
}

interface ExportLibraryGroup {
  folderName: string
  items: ExportLibraryItem[]
}

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  title?: string
  scope?: 'editor' | 'global'
  showTooltips?: boolean
  onShowTooltipsChange?: (value: boolean) => void
  showDeleteConfirmation?: boolean
  onShowDeleteConfirmationChange?: (value: boolean) => void
  showComponentPaletteHelp?: boolean
  onShowComponentPaletteHelpChange?: (value: boolean) => void
  showDeleteWidgetConfirmation?: boolean
  onShowDeleteWidgetConfirmationChange?: (value: boolean) => void
  showDeleteDashboardConfirmation?: boolean
  onShowDeleteDashboardConfirmationChange?: (value: boolean) => void
  showAdvancedInToolbar?: boolean
  onShowAdvancedInToolbarChange?: (value: boolean) => void
  showDeleteTemplateConfirmation?: boolean
  onShowDeleteTemplateConfirmationChange?: (value: boolean) => void
  onDeleteStudyMeshProfile?: () => Promise<void>
}

// Keyboard shortcut card component
interface ShortcutCardProps {
  icon: React.ReactNode
  title: string
  shortcut: string
  color?: string
}

const ShortcutCard: React.FC<ShortcutCardProps> = ({
  icon,
  title,
  shortcut,
  color = 'primary.main',
}) => (
  <Paper
    elevation={0}
    sx={{
      p: 1.5,
      display: 'flex',
      alignItems: 'center',
      mb: 1.5,
      borderRadius: 2,
      border: '1px solid',
      borderColor: 'divider',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
      },
    }}
  >
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        bgcolor: color,
        borderRadius: '50%',
        minWidth: 36,
        minHeight: 36,
        mr: 2,
      }}
    >
      {icon}
    </Box>
    <Box sx={{ flex: 1 }}>
      <Typography variant="body2" fontWeight="medium" color="text.primary">
        {title}
      </Typography>
    </Box>
    <Chip
      label={shortcut}
      size="small"
      sx={{
        fontFamily: 'monospace',
        fontWeight: 'bold',
        bgcolor: 'rgba(0,0,0,0.05)',
        border: '1px solid rgba(0,0,0,0.1)',
        borderRadius: 1,
        px: 0.5,
        color: 'text.primary',
      }}
    />
  </Paper>
)

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onClose,
  showTooltips,
  onShowTooltipsChange,
  showDeleteConfirmation,
  onShowDeleteConfirmationChange,
  showComponentPaletteHelp,
  onShowComponentPaletteHelpChange,
  showDeleteWidgetConfirmation,
  onShowDeleteWidgetConfirmationChange,
  showDeleteDashboardConfirmation,
  onShowDeleteDashboardConfirmationChange,
  showAdvancedInToolbar = false,
  onShowAdvancedInToolbarChange,
  showDeleteTemplateConfirmation,
  onShowDeleteTemplateConfirmationChange,
  onDeleteStudyMeshProfile,
  title = 'Widget Editor Settings',
  scope = 'editor',
}) => {
  const showEditorSettings = scope === 'editor'
  const showGlobalSettings = scope === 'global'
  const [libraryTransferStatus, setLibraryTransferStatus] = React.useState('')
  const [profileDeleteConfirmation, setProfileDeleteConfirmation] =
    React.useState('')
  const [profileDeleteStatus, setProfileDeleteStatus] = React.useState('')
  const [isDeletingProfile, setIsDeletingProfile] = React.useState(false)
  const [exportModalOpen, setExportModalOpen] = React.useState(false)
  const [exportLibraryItems, setExportLibraryItems] = React.useState<
    ExportLibraryItem[]
  >([])
  const [selectedExportIndexes, setSelectedExportIndexes] = React.useState<
    Set<number>
  >(new Set())

  const exportLibraryGroups = React.useMemo<ExportLibraryGroup[]>(() => {
    const groups = new Map<string, ExportLibraryItem[]>()

    exportLibraryItems.forEach((item) => {
      const items = groups.get(item.folderName) || []

      items.push(item)
      groups.set(item.folderName, items)
    })

    return Array.from(groups.entries())
      .map(([folderName, items]) => ({
        folderName,
        items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.folderName.localeCompare(b.folderName))
  }, [exportLibraryItems])

  const selectedExportCount = selectedExportIndexes.size

  React.useEffect(() => {
    if (!open || !showGlobalSettings) {
      return
    }

    setProfileDeleteConfirmation('')
    setProfileDeleteStatus('')
  }, [open, showGlobalSettings])

  // Create safe handlers for all possibly undefined callbacks
  const handleTooltipsChange = (checked: boolean) => {
    if (onShowTooltipsChange) {
      onShowTooltipsChange(checked)
    }
  }

  const handleComponentPaletteHelpChange = (checked: boolean) => {
    if (onShowComponentPaletteHelpChange) {
      onShowComponentPaletteHelpChange(checked)
    }
  }

  const handleAdvancedInToolbarChange = (checked: boolean) => {
    if (onShowAdvancedInToolbarChange) {
      onShowAdvancedInToolbarChange(checked)
    }
  }

  const handleDeleteDashboardConfirmationChange = (checked: boolean) => {
    if (onShowDeleteDashboardConfirmationChange) {
      onShowDeleteDashboardConfirmationChange(checked)
    }
  }

  const handleDeleteTemplateConfirmationChange = (checked: boolean) => {
    if (onShowDeleteTemplateConfirmationChange) {
      onShowDeleteTemplateConfirmationChange(checked)
    }
  }

  const handleReplayTutorial = () => {
    window.localStorage.setItem(
      WORKSPACE_ONBOARDING_KEY,
      JSON.stringify({
        status: 'active',
        stepId: 'create-dashboard',
      }),
    )
    window.dispatchEvent(new CustomEvent(STUDYMESH_ONBOARDING_RESET_EVENT))
    onClose()
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
          : 'Could not delete StudyMesh profile.',
      )
      setIsDeletingProfile(false)
    }
  }

  const handleOpenExportLibrary = () => {
    try {
      const savedDashboards = window.localStorage.getItem('customDashboards')
      const dashboards = savedDashboards ? JSON.parse(savedDashboards) : []
      const studyGuides = StudyGuideStorage.getAll()

      if (!Array.isArray(dashboards)) {
        setLibraryTransferStatus('Could not read the saved library.')
        return
      }

      const libraryItems = [
        ...dashboards.map((dashboard, index) =>
          createExportLibraryItem(dashboard, 'dashboard', index),
        ),
        ...studyGuides.map((studyGuide, index) =>
          createExportLibraryItem(
            studyGuide,
            'studyGuide',
            dashboards.length + index,
          ),
        ),
      ]

      setExportLibraryItems(libraryItems)
      setSelectedExportIndexes(new Set(libraryItems.map(({ index }) => index)))
      setExportModalOpen(true)
      setLibraryTransferStatus('')
    } catch (error) {
      console.error('Failed to prepare Quick Create library export', error)
      setLibraryTransferStatus('Could not read the saved library.')
    }
  }

  const handleToggleExportItem = (index: number, checked: boolean) => {
    setSelectedExportIndexes((current) => {
      const next = new Set(current)

      if (checked) {
        next.add(index)
      } else {
        next.delete(index)
      }

      return next
    })
  }

  const handleToggleExportFolder = (
    items: ExportLibraryItem[],
    checked: boolean,
  ) => {
    setSelectedExportIndexes((current) => {
      const next = new Set(current)

      items.forEach(({ index }) => {
        if (checked) {
          next.add(index)
        } else {
          next.delete(index)
        }
      })

      return next
    })
  }

  const handleExportSelectedLibrary = () => {
    try {
      const selectedItems = exportLibraryItems.filter(({ index }) =>
        selectedExportIndexes.has(index),
      )
      const selectedDashboards = selectedItems
        .filter(({ itemType }) => itemType === 'dashboard')
        .map(({ item }) => item)
      const selectedStudyGuides = selectedItems
        .filter(({ itemType }) => itemType === 'studyGuide')
        .map(({ item }) => item)
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        dashboards: selectedDashboards,
        studyGuides: selectedStudyGuides,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `studymesh-study-library-${new Date()
        .toISOString()
        .slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setExportModalOpen(false)
      setLibraryTransferStatus(
        `Library export created with ${selectedItems.length} item${
          selectedItems.length === 1 ? '' : 's'
        }.`,
      )
    } catch (error) {
      console.error('Failed to export Quick Create library', error)
      setLibraryTransferStatus('Could not export the library.')
    }
  }

  const handleImportLibrary = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    try {
      const payload = JSON.parse(await file.text()) as {
        dashboards?: unknown
        studyGuides?: unknown
      }
      const hasDashboards = Array.isArray(payload.dashboards)
      const hasStudyGuides = Array.isArray(payload.studyGuides)

      if (!hasDashboards && !hasStudyGuides) {
        setLibraryTransferStatus(
          'Import file must include a dashboards or studyGuides array.',
        )
        return
      }

      if (hasDashboards) {
        window.localStorage.setItem(
          'customDashboards',
          JSON.stringify(payload.dashboards),
        )
        window.dispatchEvent(new CustomEvent('dashboardStorageUpdated'))
      }

      if (hasStudyGuides) {
        window.localStorage.setItem(
          STUDY_GUIDES_STORAGE_KEY,
          JSON.stringify(payload.studyGuides),
        )
        window.dispatchEvent(new CustomEvent(STUDY_GUIDES_CHANGED_EVENT))
      }

      const importedCount =
        (hasDashboards ? payload.dashboards.length : 0) +
        (hasStudyGuides ? (payload.studyGuides as unknown[]).length : 0)

      setLibraryTransferStatus(
        `Imported ${importedCount} library item${
          importedCount === 1 ? '' : 's'
        }.`,
      )
    } catch (error) {
      console.error('Failed to import Quick Create library', error)
      setLibraryTransferStatus('Could not import that library file.')
    }
  }

  const handleAddStudyMeshGuide = () => {
    const added = seedStudyMeshGuideStudyPath({ force: true })
    window.dispatchEvent(new CustomEvent('dashboardStorageUpdated'))
    setLibraryTransferStatus(
      added
        ? 'StudyMesh Guide Study Guide added.'
        : 'StudyMesh Guide Study Guide is already available.',
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiTypography-h6': { fontSize: { xs: '1rem', sm: '1.25rem' } },
        '& .MuiTypography-body1': { fontSize: { xs: '0.75rem', sm: '1rem' } },
        '& .MuiTypography-body2': {
          fontSize: { xs: '0.75rem', sm: '0.875rem' },
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: '12px',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box display="flex" alignItems="center">
          <SettingsIcon sx={{ mr: 1.5, color: 'primary.main' }} />
          <Typography
            variant="h6"
            component="div"
            fontWeight="bold"
            color="text.primary"
          >
            {title}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <Typography
            variant="h6"
            gutterBottom
            fontWeight="medium"
            color="text.primary"
          >
            {showGlobalSettings ? 'Application Options' : 'Editor Options'}
          </Typography>

          {showGlobalSettings && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 2,
                bgcolor: 'background.default',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <FolderOpenIcon sx={{ mr: 1.5, color: 'primary.main' }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontWeight="medium" color="text.primary">
                    Study Library Backup
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1.5 }}
                  >
                    Export or replace all saved Quick Creates, subjects, and
                    advanced workspaces stored in this browser.
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 1,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleOpenExportLibrary}
                    >
                      Export library
                    </Button>
                    <Button component="label" variant="outlined" size="small">
                      Import library
                      <input
                        hidden
                        type="file"
                        accept="application/json,.json"
                        onChange={handleImportLibrary}
                      />
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleAddStudyMeshGuide}
                    >
                      Add StudyMesh Guide Study Guide
                    </Button>
                    {libraryTransferStatus && (
                      <Typography variant="caption" color="text.secondary">
                        {libraryTransferStatus}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            </Paper>
          )}

          {showGlobalSettings && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 2,
                bgcolor: 'background.default',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ReplayIcon sx={{ mr: 1.5, color: 'primary.main' }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontWeight="medium" color="text.primary">
                    Replay Workspace Tutorial
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Restart the guided dashboard and widget tutorial from the
                    first step.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleReplayTutorial}
                  sx={{ ml: 2, whiteSpace: 'nowrap' }}
                >
                  Replay
                </Button>
              </Box>
            </Paper>
          )}

          {showGlobalSettings && onDeleteStudyMeshProfile && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 2,
                bgcolor: 'background.default',
                borderRadius: 2,
                border: 1,
                borderColor: 'error.light',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <DeleteOutlineIcon sx={{ mr: 1.5, color: 'error.main' }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontWeight="medium" color="text.primary">
                    Delete StudyMesh Profile
                  </Typography>
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
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 1,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
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
                    {profileDeleteStatus && (
                      <Typography variant="caption" color="error">
                        {profileDeleteStatus}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            </Paper>
          )}

          {showEditorSettings && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 2,
                bgcolor: 'background.default',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <InfoOutlinedIcon sx={{ mr: 1.5, color: 'primary.main' }} />
                    <Typography fontWeight="medium" color="text.primary">
                      Show Helpful Tips
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Switch
                      checked={Boolean(showTooltips)}
                      onChange={(e) => handleTooltipsChange(e.target.checked)}
                      color="primary"
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 5, mb: 1 }}
                  >
                    Show short explanations when hovering over building blocks
                    in the palette.
                  </Typography>
                </Box>
              </Box>
            </Paper>
          )}

          {showEditorSettings && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 2,
                bgcolor: 'background.default',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <HelpOutlineIcon sx={{ mr: 1.5, color: 'primary.main' }} />
                    <Typography fontWeight="medium" color="text.primary">
                      Show Building Blocks Help
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Switch
                      checked={Boolean(showComponentPaletteHelp)}
                      onChange={(e) =>
                        handleComponentPaletteHelpChange(e.target.checked)
                      }
                      color="primary"
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 5, mb: 1 }}
                  >
                    Show the help text at the bottom of the Building Blocks
                    panel.
                  </Typography>
                </Box>
              </Box>
            </Paper>
          )}

          {showEditorSettings && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 2,
                bgcolor: 'background.default',
                borderRadius: 2,
                display: { xs: 'none', lg: 'block' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <SearchIcon
                      fontSize="small"
                      sx={{ mr: 1.5, color: 'primary.main' }}
                    />
                    <Typography fontWeight="medium" color="text.primary">
                      Show Advanced Features in Toolbar
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Switch
                      checked={Boolean(showAdvancedInToolbar)}
                      onChange={(e) =>
                        handleAdvancedInToolbarChange(e.target.checked)
                      }
                      color="primary"
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 5, mb: 1 }}
                  >
                    Display Templates, Export/Import, and Version History
                    buttons directly in the toolbar for easy access.
                  </Typography>
                </Box>
              </Box>
            </Paper>
          )}

          {showGlobalSettings && <Divider sx={{ my: 3 }} />}

          {showGlobalSettings && (
            <Typography
              variant="h6"
              gutterBottom
              fontWeight="medium"
              color="text.primary"
            >
              Confirmation Options
            </Typography>
          )}

          {showGlobalSettings && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 2,
                bgcolor: 'background.default',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <DashboardIcon sx={{ mr: 1.5, color: 'error.main' }} />
                    <Typography fontWeight="medium" color="text.primary">
                      Confirm Dashboard Deletion
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Switch
                      checked={Boolean(showDeleteDashboardConfirmation)}
                      onChange={(e) =>
                        handleDeleteDashboardConfirmationChange(
                          e.target.checked,
                        )
                      }
                      color="primary"
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 5, mb: 1 }}
                  >
                    Show a confirmation dialog when deleting dashboards.
                  </Typography>
                </Box>
              </Box>
            </Paper>
          )}

          {showGlobalSettings && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 2,
                bgcolor: 'background.default',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <DeleteOutlineIcon sx={{ mr: 1.5, color: 'error.main' }} />
                    <Typography fontWeight="medium" color="text.primary">
                      Confirm Template Deletion
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Switch
                      checked={Boolean(showDeleteTemplateConfirmation)}
                      onChange={(e) =>
                        handleDeleteTemplateConfirmationChange(e.target.checked)
                      }
                      color="primary"
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 5, mb: 1 }}
                  >
                    Show a confirmation dialog when deleting templates.
                  </Typography>
                </Box>
              </Box>
            </Paper>
          )}

          {showGlobalSettings && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 2,
                bgcolor: 'background.default',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <WidgetsIcon sx={{ mr: 1.5, color: 'error.main' }} />
                    <Typography fontWeight="medium" color="text.primary">
                      Confirm Widget Deletion
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Switch
                      checked={Boolean(showDeleteWidgetConfirmation)}
                      onChange={(e) =>
                        onShowDeleteWidgetConfirmationChange?.(e.target.checked)
                      }
                      color="primary"
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 5, mb: 1 }}
                  >
                    Show a confirmation dialog when deleting widgets from the
                    library.
                  </Typography>
                </Box>
              </Box>
            </Paper>
          )}

          {showGlobalSettings && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 2,
                bgcolor: 'background.default',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <DeleteOutlineIcon sx={{ mr: 1.5, color: 'error.main' }} />
                    <Typography fontWeight="medium" color="text.primary">
                      Confirm Block Deletion
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Switch
                      checked={Boolean(showDeleteConfirmation)}
                      onChange={(e) =>
                        onShowDeleteConfirmationChange?.(e.target.checked)
                      }
                      color="primary"
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 5, mb: 1 }}
                  >
                    Show a confirmation dialog when deleting blocks.
                  </Typography>
                </Box>
              </Box>
            </Paper>
          )}

          {showEditorSettings && (
            <Divider sx={{ my: 3, display: { xs: 'none', sm: 'flex' } }} />
          )}

          {showEditorSettings && (
            <Box
              sx={{
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                mb: 2.5,
              }}
            >
              <KeyboardIcon
                sx={{ mr: 1.5, color: 'primary.main', fontSize: 28 }}
              />
              <Typography variant="h6" fontWeight="medium" color="text.primary">
                Keyboard Shortcuts
              </Typography>
            </Box>
          )}

          {showEditorSettings && (
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 2,
                bgcolor: 'background.default',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                display: { xs: 'none', sm: 'block' },
              }}
            >
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <ShortcutCard
                    icon={<UndoIcon />}
                    title="Undo"
                    shortcut="Ctrl + Z"
                    color="#3f51b5"
                  />

                  <ShortcutCard
                    icon={<RedoIcon />}
                    title="Redo"
                    shortcut="Ctrl + Y"
                    color="#3f51b5"
                  />

                  <ShortcutCard
                    icon={<SaveIcon />}
                    title="Save Widget"
                    shortcut="Ctrl + S"
                    color="#4caf50"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <ShortcutCard
                    icon={<EditIcon />}
                    title="Cycle through both, edit, and preview views"
                    shortcut="Ctrl + E"
                    color="#ff9800"
                  />

                  <ShortcutCard
                    icon={<FolderOpenIcon />}
                    title="Open or close saved widgets"
                    shortcut="Ctrl + O"
                    color="#9c27b0"
                  />

                  <ShortcutCard
                    icon={<SettingsIcon />}
                    title="Open or close settings"
                    shortcut="Ctrl + ,"
                    color="#2196f3"
                  />
                </Grid>
              </Grid>
            </Paper>
          )}
        </Box>
      </DialogContent>

      <Dialog
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="study-library-export-title"
      >
        <DialogTitle id="study-library-export-title">
          Export study library
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose which saved dashboards and Study Guides to include in this
            backup.
          </Typography>
          {exportLibraryGroups.length === 0 ? (
            <Alert severity="info">
              There are no saved library items to export.
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {exportLibraryGroups.map((group) => {
                const selectedInFolder = group.items.filter(({ index }) =>
                  selectedExportIndexes.has(index),
                )
                const folderChecked =
                  selectedInFolder.length === group.items.length
                const folderIndeterminate =
                  selectedInFolder.length > 0 &&
                  selectedInFolder.length < group.items.length

                return (
                  <Paper
                    key={group.folderName}
                    variant="outlined"
                    sx={{ p: 1.5, borderRadius: 1 }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Checkbox
                        checked={folderChecked}
                        indeterminate={folderIndeterminate}
                        onChange={(event) =>
                          handleToggleExportFolder(
                            group.items,
                            event.target.checked,
                          )
                        }
                        inputProps={{
                          'aria-label': `Select ${group.folderName} folder`,
                        }}
                      />
                      <Typography fontWeight="medium">
                        {group.folderName}
                      </Typography>
                      <Chip
                        size="small"
                        label={`${group.items.length} item${
                          group.items.length === 1 ? '' : 's'
                        }`}
                        sx={{ ml: 1 }}
                      />
                    </Box>
                    <Box sx={{ pl: 5 }}>
                      {group.items.map((item) => (
                        <Box
                          key={item.index}
                          sx={{ display: 'flex', alignItems: 'center' }}
                        >
                          <Checkbox
                            checked={selectedExportIndexes.has(item.index)}
                            onChange={(event) =>
                              handleToggleExportItem(
                                item.index,
                                event.target.checked,
                              )
                            }
                            inputProps={{
                              'aria-label': `Select ${item.name}`,
                            }}
                          />
                          <Typography variant="body2">{item.name}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Paper>
                )
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleExportSelectedLibrary}
            disabled={selectedExportCount === 0}
          >
            Export selected
          </Button>
        </DialogActions>
      </Dialog>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            bgcolor: 'primary.light',
            color: '#191919',
            '&:hover': {
              bgcolor: 'primary.main',
            },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SettingsDialog
