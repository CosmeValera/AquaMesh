import React, { useCallback, useState, useEffect, useRef } from 'react'
import {
  Alert,
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  CircularProgress,
  Menu,
  MenuItem,
  Divider,
  Avatar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Stack,
  TextField,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'

import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import LogoutIcon from '@mui/icons-material/Logout'
import ColorLensIcon from '@mui/icons-material/ColorLens'
import Brightness6Icon from '@mui/icons-material/Brightness6'
import CloseIcon from '@mui/icons-material/Close'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import SwitchAccountIcon from '@mui/icons-material/SwitchAccount'
import PersonIcon from '@mui/icons-material/Person'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AddToPhotosIcon from '@mui/icons-material/AddToPhotos'
import WidgetsIcon from '@mui/icons-material/Widgets'
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications'
import ExtensionIcon from '@mui/icons-material/Extension'
import EditIcon from '@mui/icons-material/Edit'

import AccentColorPicker from '../../theme/AccentColorPicker'
import DashboardOptionsMenu from '../Dasboard/DashboardOptionsMenu'
import { useDashboards } from '../Dasboard/DashboardProvider'
import {
  OPEN_DASHBOARD_EDITOR_EVENT,
  OPEN_STUDY_PACK_EVENT,
  OPEN_STUDY_PATH_EVENT,
  OPEN_WIDGET_EDITOR_EVENT,
  useWorkspaceActions,
} from '../../customHooks/useWorkspaceActions'
import ThemeModeToggle from '../shared/ThemeModeToggle'
import { CustomWidget } from '../WidgetEditor/WidgetStorage'
import SettingsDialog from '../WidgetEditor/components/dialogs/SettingsDialog'
import { dispatchWorkspaceOnboardingEvent } from '../onboarding/onboardingEvents'
import CreateStudyPackModal from '../studyPack/CreateStudyPackModal'
import CreateStudyPathModal from '../studyPack/CreateStudyPathModal'
import {
  readStudyPackAiSettings,
  STUDY_PACK_AI_SETTINGS_CHANGED_EVENT,
  StudyPackAiProvider,
} from '../../studyPack/ai'
import {
  createSquareAvatarDataUrl,
  readUserAvatar,
  removeUserAvatar,
  saveUserAvatar,
  USER_PROFILE_AVATAR_CHANGED_EVENT,
} from '../../userProfile'
import {
  dispatchWorkspaceCreationStatus,
  WORKSPACE_CREATION_STATUS_EVENT,
  workspaceCreationTaskLabels,
  WorkspaceCreationStatusDetail,
  WorkspaceCreationTask,
  WorkspaceCreationTaskState,
} from '../../workspaceCreationStatus'
import { WORKSPACE_DASHBOARD_TABS_SLOT_ID } from '../workspace/workspaceEvents'
import WidgetEditorDialog from '../workspace/WidgetEditorDialog'
import { useResponsiveWorkspaceMode } from '../workspace/useResponsiveWorkspaceMode'

// Define user data type
interface UserData {
  id: string
  name: string
  role: string
}

const USER_ROLE_CHANGED_EVENT = 'studymesh-user-role-changed'

const adminUser: UserData = {
  id: 'admin',
  name: 'Admin',
  role: 'ADMIN_ROLE',
}

const viewerUser: UserData = {
  id: 'viewer',
  name: 'Viewer',
  role: 'VIEWER_ROLE',
}

const readCurrentUserData = (fallbackUserData: UserData) => {
  try {
    const storedUserData = localStorage.getItem('userData')
    return storedUserData
      ? (JSON.parse(storedUserData) as UserData)
      : fallbackUserData
  } catch (error) {
    console.error('Failed to parse user data from localStorage', error)
    return fallbackUserData
  }
}

const isAdminUser = (userData: UserData) =>
  userData.id === 'admin' && userData.role === 'ADMIN_ROLE'

const canOpenStudyPathForCurrentState = (userData: UserData) => {
  const provider = readStudyPackAiSettings().provider || 'basic'

  return isAdminUser(userData) && provider !== 'hosted'
}

const canOpenStudyPackForCurrentState = (userData: UserData) => {
  const provider = readStudyPackAiSettings().provider || 'basic'

  return isAdminUser(userData) && provider !== 'hosted'
}

const studyPackAiProviderLabels: Record<StudyPackAiProvider, string> = {
  basic: 'Basic fallback',
  local: 'Google Local AI',
  gemini: 'Own Gemini API token',
  cerebras: 'Own Cerebras API key',
  hosted: 'Hosted AI tokens',
}

const initialCreationTaskStatuses: Record<
  WorkspaceCreationTask,
  WorkspaceCreationTaskState
> = {
  'study-path': 'idle',
  'from-notes': 'idle',
}

// Define component props interface
interface TopNavBarProps {
  open?: boolean
  setOpen?: (open: boolean) => void
  creationHost?: 'navbar' | 'external'
}

// Custom button with icon and label for phone view
interface ButtonWithLabelProps {
  icon: React.ReactNode
  label: React.ReactNode
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  sx?: React.CSSProperties | Record<string, unknown>
  'data-tutorial-id'?: string
  title?: string
  disabled?: boolean
}

const ButtonWithLabel: React.FC<ButtonWithLabelProps> = ({
  icon,
  label,
  onClick,
  sx,
  ...props
}) => {
  return (
    <Button
      onClick={onClick}
      sx={{
        color: 'foreground.contrastPrimary',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: '44px',
        mx: 0.25,
        px: 0.5,
        ...sx,
      }}
      {...props}
    >
      {icon}
      <Typography
        variant="caption"
        sx={{
          fontSize: '0.6rem',
          mt: 0.3,
          lineHeight: 1,
          maxWidth: '58px',
          textAlign: 'center',
          whiteSpace: 'normal',
        }}
      >
        {label}
      </Typography>
    </Button>
  )
}

const getCreationStatusColor = (state: WorkspaceCreationTaskState) => {
  if (state === 'running') {
    return 'warning.main'
  }

  if (state === 'complete') {
    return 'success.main'
  }

  if (state === 'error') {
    return 'error.main'
  }

  return 'transparent'
}

const getCreationStatusBackground = (state: WorkspaceCreationTaskState) => {
  if (state === 'running') {
    return 'warning.light'
  }

  if (state === 'complete') {
    return 'success.light'
  }

  if (state === 'error') {
    return 'error.light'
  }

  return 'transparent'
}

const CreationStatusDot = ({
  state,
}: {
  state: WorkspaceCreationTaskState
}) => {
  if (state === 'idle') {
    return null
  }

  const isRunning = state === 'running'
  const symbol = state === 'complete' ? '✓' : state === 'error' ? '!' : ''

  return (
    <Box
      component="span"
      sx={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: 1,
        borderColor: 'rgba(255,255,255,0.9)',
        bgcolor: getCreationStatusBackground(state),
        color: getCreationStatusColor(state),
        boxShadow:
          '0 0 0 2px rgba(255,255,255,0.18), 0 4px 10px rgba(0,0,0,0.22)',
        flex: '0 0 auto',
        fontSize: 11,
        fontWeight: 900,
        lineHeight: 1,
      }}
    >
      {isRunning ? (
        <CircularProgress
          size={14}
          thickness={5}
          sx={{ color: getCreationStatusColor(state) }}
        />
      ) : (
        symbol
      )}
    </Box>
  )
}

const CreationStatusLabel = ({
  label,
  state,
}: {
  label: string
  state: WorkspaceCreationTaskState
}) => (
  <Box
    component="span"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.85,
      minWidth: 0,
    }}
  >
    <Box component="span" sx={{ minWidth: 0 }}>
      {label}
    </Box>
    <CreationStatusDot state={state} />
  </Box>
)

const useStoredBoolean = (key: string, defaultValue: boolean) => {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const savedValue = localStorage.getItem(key)
      return savedValue ? JSON.parse(savedValue) : defaultValue
    } catch (error) {
      console.error(`Failed to parse ${key} from localStorage`, error)
      return defaultValue
    }
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue] as const
}

const TopNavBar: React.FC<TopNavBarProps> = ({ creationHost = 'navbar' }) => {
  // State for different dropdown menus
  const [userAnchorEl, setUserAnchorEl] = useState<null | HTMLElement>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false)
  const [userSettingsName, setUserSettingsName] = useState('')
  const [userSettingsAvatarStatus, setUserSettingsAvatarStatus] = useState('')
  const [studyPackOpen, setStudyPackOpen] = useState(false)
  const [studyPathOpen, setStudyPathOpen] = useState(false)
  const creationTaskStatusesRef = useRef(initialCreationTaskStatuses)
  const [creationToast, setCreationToast] = useState<{
    severity: 'success' | 'error'
    message: string
  } | null>(null)
  const [studyPackAiProvider, setStudyPackAiProvider] =
    useState<StudyPackAiProvider>(
      () => readStudyPackAiSettings().provider || 'basic',
    )
  const [widgetEditorOpen, setWidgetEditorOpen] = useState(false)
  const [widgetEditorPayload, setWidgetEditorPayload] = useState<{
    loadWidget?: CustomWidget
    initialEditMode?: boolean
  } | null>(null)
  const [showTooltips, setShowTooltips] = useStoredBoolean(
    'widget-editor-show-tooltips',
    false,
  )
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useStoredBoolean(
    'widget-editor-delete-component-confirmation',
    true,
  )
  const [showDeleteWidgetConfirmation, setShowDeleteWidgetConfirmation] =
    useStoredBoolean('widget-editor-delete-widget-confirmation', true)
  const [showComponentPaletteHelp, setShowComponentPaletteHelp] =
    useStoredBoolean('widget-editor-show-palette-help', false)
  const [showDeleteDashboardConfirmation, setShowDeleteDashboardConfirmation] =
    useStoredBoolean('widget-editor-delete-dashboard-confirmation', true)
  const [showAdvancedInToolbar, setShowAdvancedInToolbar] = useStoredBoolean(
    'widget-editor-show-advanced-in-toolbar',
    false,
  )
  const [showDeleteTemplateConfirmation, setShowDeleteTemplateConfirmation] =
    useStoredBoolean('widget-editor-delete-template-confirmation', true)
  const [userData, setUserData] = useState<UserData>(adminUser)
  const [avatarSrc, setAvatarSrc] = useState(() => readUserAvatar(adminUser.id))
  const [dashboardSelectorOpen, setDashboardSelectorOpen] = useState(false)
  const isAdmin = isAdminUser(userData)
  const userModeLabel = isAdmin
    ? studyPackAiProviderLabels[studyPackAiProvider]
    : 'Viewer mode'
  const {
    openCreateWidget,
    openCreateDashboard,
    createStudyPackDashboard,
    createStudyPackDashboards,
  } = useWorkspaceActions()
  const {
    addDashboard,
    openDashboards,
    removeDashboard,
    selectedDashboard,
    setSelectedDashboard,
  } = useDashboards()
  const currentDashboard = openDashboards[selectedDashboard]
  const currentDashboardTitle =
    currentDashboard?.studyPath?.title || currentDashboard?.name || 'StudyMesh'
  const navigate = useNavigate()

  const {
    theme,
    isPhone,
    isTablet,
    isDesktopWorkspace: isDesktop,
    isPhoneOrTablet: isMobileWorkspaceHeader,
  } = useResponsiveWorkspaceMode()

  // Load user data from localStorage on component mount
  useEffect(() => {
    const storedUserData = localStorage.getItem('userData')
    if (storedUserData) {
      try {
        const parsedUserData = JSON.parse(storedUserData)
        setUserData(parsedUserData)
        setAvatarSrc(readUserAvatar(parsedUserData.id))
      } catch (error) {
        console.error('Failed to parse user data from localStorage', error)
      }
    }
  }, [])

  useEffect(() => {
    setAvatarSrc(readUserAvatar(userData.id))

    const handleAvatarChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{
        userId?: string
        avatarDataUrl?: string
      }>

      if (customEvent.detail?.userId === userData.id) {
        setAvatarSrc(customEvent.detail.avatarDataUrl || '')
      }
    }

    window.addEventListener(
      USER_PROFILE_AVATAR_CHANGED_EVENT,
      handleAvatarChanged,
    )

    return () => {
      window.removeEventListener(
        USER_PROFILE_AVATAR_CHANGED_EVENT,
        handleAvatarChanged,
      )
    }
  }, [userData.id])

  useEffect(() => {
    const refreshAiProvider = () => {
      setStudyPackAiProvider(readStudyPackAiSettings().provider || 'basic')
    }

    window.addEventListener(
      STUDY_PACK_AI_SETTINGS_CHANGED_EVENT,
      refreshAiProvider,
    )
    window.addEventListener('storage', refreshAiProvider)

    return () => {
      window.removeEventListener(
        STUDY_PACK_AI_SETTINGS_CHANGED_EVENT,
        refreshAiProvider,
      )
      window.removeEventListener('storage', refreshAiProvider)
    }
  }, [])

  useEffect(() => {
    const handleCreationStatusChange = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceCreationStatusDetail>)
        .detail

      if (!detail?.task || !detail.state) {
        return
      }

      const previousState = creationTaskStatusesRef.current[detail.task]
      if (previousState === detail.state) {
        return
      }

      const nextStatuses = {
        ...creationTaskStatusesRef.current,
        [detail.task]: detail.state,
      }
      creationTaskStatusesRef.current = nextStatuses

      if (detail.state === 'error') {
        setCreationToast({
          severity: 'error',
          message:
            detail.message ||
            `${workspaceCreationTaskLabels[detail.task]} needs attention.`,
        })
      } else if (detail.state === 'idle' && detail.message) {
        setCreationToast({
          severity: 'success',
          message: detail.message,
        })
      }
    }

    window.addEventListener(
      WORKSPACE_CREATION_STATUS_EVENT,
      handleCreationStatusChange,
    )

    return () => {
      window.removeEventListener(
        WORKSPACE_CREATION_STATUS_EVENT,
        handleCreationStatusChange,
      )
    }
  }, [])

  useEffect(() => {
    if (creationHost === 'external') {
      return
    }

    const handleOpenWidgetEditor = (event: Event) => {
      let parsedUserData = userData

      try {
        const storedUserData = localStorage.getItem('userData')
        parsedUserData = storedUserData
          ? (JSON.parse(storedUserData) as UserData)
          : userData
      } catch (error) {
        console.error('Failed to parse user data from localStorage', error)
      }

      const canEdit =
        parsedUserData.id === 'admin' && parsedUserData.role === 'ADMIN_ROLE'

      if (!canEdit) {
        return
      }

      const customEvent = event as CustomEvent<{
        loadWidget?: CustomWidget
        initialEditMode?: boolean
      }>
      setWidgetEditorPayload(customEvent.detail || null)
      setWidgetEditorOpen(true)
      dispatchWorkspaceOnboardingEvent({ type: 'widget-editor-opened' })
    }

    window.addEventListener(OPEN_WIDGET_EDITOR_EVENT, handleOpenWidgetEditor)

    return () => {
      window.removeEventListener(
        OPEN_WIDGET_EDITOR_EVENT,
        handleOpenWidgetEditor,
      )
    }
  }, [creationHost, userData])

  useEffect(() => {
    if (creationHost === 'external') {
      return
    }

    const handleOpenStudyPack = () => {
      const parsedUserData = readCurrentUserData(userData)

      if (!canOpenStudyPackForCurrentState(parsedUserData)) {
        return
      }

      setStudyPackOpen(true)
    }

    window.addEventListener(OPEN_STUDY_PACK_EVENT, handleOpenStudyPack)

    return () => {
      window.removeEventListener(OPEN_STUDY_PACK_EVENT, handleOpenStudyPack)
    }
  }, [creationHost, userData])

  useEffect(() => {
    if (creationHost === 'external') {
      return
    }

    const handleOpenStudyPath = () => {
      const parsedUserData = readCurrentUserData(userData)

      if (!canOpenStudyPathForCurrentState(parsedUserData)) {
        return
      }

      setStudyPathOpen(true)
    }

    window.addEventListener(OPEN_STUDY_PATH_EVENT, handleOpenStudyPath)

    return () => {
      window.removeEventListener(OPEN_STUDY_PATH_EVENT, handleOpenStudyPath)
    }
  }, [creationHost, userData])

  // Handle opening and closing dropdowns
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setUserAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setUserAnchorEl(null)
  }

  const handleLogout = () => {
    handleClose()
    // Clear user data from localStorage
    localStorage.removeItem('userData')
    navigate('/')
  }

  const switchUser = (nextUser: UserData) => {
    localStorage.setItem('userData', JSON.stringify(nextUser))
    setUserData(nextUser)
    setAvatarSrc(readUserAvatar(nextUser.id))
    window.dispatchEvent(
      new CustomEvent(USER_ROLE_CHANGED_EVENT, { detail: nextUser }),
    )
    handleClose()
  }

  const openUserSettings = () => {
    setUserSettingsName(userData.name)
    setUserSettingsAvatarStatus('')
    setIsUserSettingsOpen(true)
    handleClose()
  }

  const saveUserSettings = () => {
    const nextUser = {
      ...userData,
      name: userSettingsName.trim() || userData.name,
    }

    localStorage.setItem('userData', JSON.stringify(nextUser))
    setUserData(nextUser)
    window.dispatchEvent(
      new CustomEvent(USER_ROLE_CHANGED_EVENT, { detail: nextUser }),
    )
    setIsUserSettingsOpen(false)
  }

  const handleUserAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUserSettingsAvatarStatus('Use a PNG, JPG, or WebP image.')
      return
    }

    try {
      setUserSettingsAvatarStatus('Preparing profile picture...')
      const avatarDataUrl = await createSquareAvatarDataUrl(file)
      saveUserAvatar(userData.id, avatarDataUrl)
      setAvatarSrc(avatarDataUrl)
      setUserSettingsAvatarStatus('Profile picture updated.')
    } catch (error) {
      setUserSettingsAvatarStatus(
        error instanceof Error
          ? error.message
          : 'Could not update profile picture.',
      )
    }
  }

  const handleRemoveUserAvatar = () => {
    removeUserAvatar(userData.id)
    setAvatarSrc('')
    setUserSettingsAvatarStatus('Profile picture removed.')
  }

  const reportStudyPathStatus = useCallback(
    (state: WorkspaceCreationTaskState, message?: string) => {
      dispatchWorkspaceCreationStatus({
        task: 'study-path',
        state,
        message,
      })
    },
    [],
  )

  const reportFromNotesStatus = useCallback(
    (state: WorkspaceCreationTaskState, message?: string) => {
      dispatchWorkspaceCreationStatus({
        task: 'from-notes',
        state,
        message,
      })
    },
    [],
  )

  return (
    <>
      <AppBar
        position="static"
        sx={{
          backgroundColor: 'background.header',
          boxShadow: 2,
          height: isMobileWorkspaceHeader ? '56px' : '52px',
        }}
      >
        <Toolbar
          sx={{
            minHeight: isMobileWorkspaceHeader ? '56px' : '52px',
            height: isMobileWorkspaceHeader ? '56px' : '52px',
            px: isMobileWorkspaceHeader ? 0.75 : 1.25,
            gap: isMobileWorkspaceHeader ? 0.75 : 0,
          }}
        >
          {isMobileWorkspaceHeader ? (
            <>
              <Box sx={{ flex: '0 0 44px', display: 'flex' }}>
                <DashboardOptionsMenu compactMobile />
              </Box>
              <Button
                onClick={() => setDashboardSelectorOpen(true)}
                endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 18 }} />}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  height: 44,
                  px: 1,
                  color: 'foreground.contrastPrimary',
                  textTransform: 'none',
                  borderRadius: 999,
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
                  '& .MuiButton-endIcon': { ml: 0.25, mr: 0 },
                }}
              >
                <Typography
                  component="span"
                  variant="subtitle2"
                  fontWeight={800}
                  noWrap
                  sx={{ minWidth: 0, maxWidth: '100%' }}
                >
                  {currentDashboardTitle || 'Select dashboard'}
                </Typography>
              </Button>
              <IconButton
                onClick={handleUserMenuOpen}
                aria-label="Open user menu"
                sx={{
                  width: 44,
                  height: 44,
                  color: 'foreground.contrastPrimary',
                }}
              >
                <Avatar
                  src={avatarSrc || undefined}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: 'primary.main',
                    fontSize: '0.9rem',
                  }}
                >
                  {userData.id.substring(0, 2).toUpperCase()}
                </Avatar>
              </IconButton>
            </>
          ) : (
            <>
              {/* Logo and Brand */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  flex: '0 0 auto',
                  minWidth: 0,
                }}
              >
                {/* Logo and Brand */}
                <Box
                  aria-label="StudyMesh logo"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: isDesktop ? 'bold' : 'normal',
                    mr: isDesktop ? 1.25 : 0.5,
                    color: 'foreground.contrastPrimary',
                    px: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Box
                    data-testid="logo"
                    component="img"
                    src="/logo.png"
                    alt=""
                    sx={{
                      width: isDesktop ? 30 : 28,
                      height: isDesktop ? 30 : 28,
                      display: 'block',
                      mr: isDesktop ? 1 : 0,
                    }}
                  />
                  {isDesktop && 'StudyMesh'}
                </Box>

                {/* Library */}
                {isPhone || isTablet ? (
                  <DashboardOptionsMenu />
                ) : (
                  <DashboardOptionsMenu />
                )}
              </Box>

              <Box
                id={WORKSPACE_DASHBOARD_TABS_SLOT_ID}
                sx={{
                  flex: '1 1 auto',
                  minWidth: 0,
                  height: '100%',
                  display: isMobileWorkspaceHeader ? 'none' : 'flex',
                  alignItems: 'center',
                  mx: isTablet ? 0.5 : 1,
                  position: 'relative',
                }}
              />

              {/* Right Side Elements */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isPhone ? 1.5 : 1,
                  flex: '0 0 auto',
                }}
              >
                {/* User Menu */}
                {isPhone || isTablet ? (
                  <ButtonWithLabel
                    icon={
                      <Avatar
                        src={avatarSrc || undefined}
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: 'primary.main',
                          fontSize: '0.9rem',
                        }}
                      >
                        {userData.id.substring(0, 2).toUpperCase()}
                      </Avatar>
                    }
                    label="User"
                    onClick={handleUserMenuOpen}
                    sx={{ minWidth: '45px' }}
                  />
                ) : (
                  <Button
                    onClick={handleUserMenuOpen}
                    sx={{
                      color: 'foreground.contrastPrimary',
                      textTransform: 'none',
                      minWidth: 'auto',
                      px: 2,
                      display: 'flex',
                    }}
                    endIcon={<KeyboardArrowDownIcon />}
                  >
                    <Avatar
                      src={avatarSrc || undefined}
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'primary.main',
                        mr: 1,
                        fontSize: '0.9rem',
                      }}
                    >
                      {userData.id.substring(0, 2).toUpperCase()}
                    </Avatar>
                    <Box sx={{ textAlign: 'left' }}>
                      <Typography variant="body2" sx={{ lineHeight: 1.2 }}>
                        {userData.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ opacity: 0.7, lineHeight: 1 }}
                      >
                        {userModeLabel}
                      </Typography>
                    </Box>
                  </Button>
                )}
                <Menu
                  anchorEl={userAnchorEl}
                  open={Boolean(userAnchorEl)}
                  onClose={handleClose}
                  PaperProps={{
                    sx: {
                      bgcolor: 'background.paper',
                      color: 'text.primary',
                      border: 1,
                      borderColor: 'divider',
                      minWidth: 260,
                      mt: 1,
                      maxHeight: 'calc(100dvh - 16px)',
                      overflowX: 'hidden',
                      overflowY: 'auto',
                    },
                  }}
                >
                  <Box
                    sx={{
                      px: 2,
                      pt: 1.5,
                      pb: 1,
                      bgcolor: 'background.default',
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={800}>
                      {userData.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {userModeLabel}
                    </Typography>
                  </Box>
                  <Box sx={{ px: 2, py: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Brightness6Icon
                        fontSize="small"
                        sx={{ color: 'primary.main', mr: 1 }}
                      />
                      <Typography variant="body2" fontWeight="medium">
                        Light / dark mode
                      </Typography>
                    </Box>
                    <ThemeModeToggle compact />
                  </Box>
                  <Divider sx={{ borderColor: 'divider' }} />
                  <Box sx={{ px: 2, py: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <ColorLensIcon
                        fontSize="small"
                        sx={{ color: 'primary.main', mr: 1 }}
                      />
                      <Typography variant="body2" fontWeight="medium">
                        Accent color
                      </Typography>
                    </Box>
                    <AccentColorPicker dense />
                  </Box>
                  <Divider sx={{ borderColor: 'divider' }} />
                  <Box sx={{ px: 2, pt: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <SettingsApplicationsIcon
                        fontSize="small"
                        sx={{ color: 'primary.main', mr: 1 }}
                      />
                      <Typography variant="body2" fontWeight="medium">
                        Settings
                      </Typography>
                    </Box>
                  </Box>
                  <MenuItem
                    onClick={openUserSettings}
                    sx={{ color: 'text.primary', marginTop: 1 }}
                  >
                    <ListItemIcon>
                      <PersonIcon
                        fontSize="small"
                        sx={{ color: 'text.secondary' }}
                      />
                    </ListItemIcon>
                    User settings
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setIsSettingsOpen(true)
                      handleClose()
                    }}
                    sx={{
                      marginTop: 1,
                      paddingTop: 0.5,
                      paddingBottom: 0.5,
                      color: 'text.primary',
                    }}
                  >
                    <ListItemIcon>
                      <ManageAccountsIcon
                        fontSize="small"
                        sx={{ color: 'text.secondary' }}
                      />
                    </ListItemIcon>
                    Settings
                  </MenuItem>
                  <Divider sx={{ borderColor: 'divider' }} />
                  <Box sx={{ px: 2, pt: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <ExtensionIcon
                        fontSize="small"
                        sx={{ color: 'primary.main', mr: 1 }}
                      />
                      <Typography variant="body2" fontWeight="medium">
                        Advanced
                      </Typography>
                    </Box>
                  </Box>
                  <MenuItem
                    onClick={() => {
                      openCreateDashboard()
                      handleClose()
                    }}
                    disabled={!isAdmin}
                    data-tutorial-id="create-dashboard-button"
                    data-onboarding-id="create-dashboard"
                    sx={{ color: 'text.primary' }}
                  >
                    <ListItemIcon>
                      <AddToPhotosIcon
                        fontSize="small"
                        sx={{ color: 'text.secondary' }}
                      />
                    </ListItemIcon>
                    Create Dashboard
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      openCreateWidget()
                      handleClose()
                    }}
                    disabled={!isAdmin}
                    data-tutorial-id="create-widget-button"
                    data-onboarding-id="dashboard-widget-create"
                    sx={{ color: 'text.primary' }}
                  >
                    <ListItemIcon>
                      <WidgetsIcon
                        fontSize="small"
                        sx={{ color: 'text.secondary' }}
                      />
                    </ListItemIcon>
                    Create Widget
                  </MenuItem>
                  <Divider sx={{ borderColor: 'divider' }} />
                  <MenuItem
                    onClick={() => switchUser(isAdmin ? viewerUser : adminUser)}
                    sx={{ color: 'text.primary' }}
                  >
                    <ListItemIcon>
                      <SwitchAccountIcon
                        fontSize="small"
                        sx={{ color: 'text.secondary' }}
                      />
                    </ListItemIcon>
                    {isAdmin ? 'Log in as Viewer' : 'Log in as Admin'}
                  </MenuItem>
                  <Divider sx={{ borderColor: 'divider' }} />
                  <MenuItem
                    onClick={handleLogout}
                    sx={{ color: 'text.primary' }}
                  >
                    <ListItemIcon>
                      <LogoutIcon
                        fontSize="small"
                        sx={{ color: 'text.secondary' }}
                      />
                    </ListItemIcon>
                    Logout
                  </MenuItem>
                </Menu>
              </Box>
            </>
          )}
        </Toolbar>
      </AppBar>

      {isMobileWorkspaceHeader && (
        <Menu
          anchorEl={userAnchorEl}
          open={Boolean(userAnchorEl)}
          onClose={handleClose}
          PaperProps={{
            sx: {
              bgcolor: 'background.paper',
              color: 'text.primary',
              border: 1,
              borderColor: 'divider',
              minWidth: 260,
              mt: 1,
              maxHeight: 'calc(100dvh - 16px)',
              overflowX: 'hidden',
              overflowY: 'auto',
            },
          }}
        >
          <Box
            sx={{
              px: 2,
              pt: 1.5,
              pb: 1,
              bgcolor: 'background.default',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="subtitle2" fontWeight={800}>
              {userData.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {userModeLabel}
            </Typography>
          </Box>
          <Box sx={{ px: 2, py: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Brightness6Icon
                fontSize="small"
                sx={{ color: 'primary.main', mr: 1 }}
              />
              <Typography variant="body2" fontWeight="medium">
                Light / dark mode
              </Typography>
            </Box>
            <ThemeModeToggle compact />
          </Box>
          <Divider sx={{ borderColor: 'divider' }} />
          <Box sx={{ px: 2, py: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <ColorLensIcon
                fontSize="small"
                sx={{ color: 'primary.main', mr: 1 }}
              />
              <Typography variant="body2" fontWeight="medium">
                Accent color
              </Typography>
            </Box>
            <AccentColorPicker dense />
          </Box>
          <Divider sx={{ borderColor: 'divider' }} />
          <MenuItem
            onClick={openUserSettings}
            sx={{ color: 'text.primary', marginTop: 1 }}
          >
            <ListItemIcon>
              <PersonIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </ListItemIcon>
            User settings
          </MenuItem>
          <Divider sx={{ borderColor: 'divider' }} />
          <MenuItem
            onClick={() => {
              setIsSettingsOpen(true)
              handleClose()
            }}
            sx={{ color: 'text.primary' }}
          >
            <ListItemIcon>
              <ManageAccountsIcon
                fontSize="small"
                sx={{ color: 'text.secondary' }}
              />
            </ListItemIcon>
            Settings
          </MenuItem>
          <MenuItem
            onClick={() => {
              openCreateDashboard()
              handleClose()
            }}
            disabled={!isAdmin}
            data-tutorial-id="create-dashboard-button"
            data-onboarding-id="create-dashboard"
            sx={{ color: 'text.primary' }}
          >
            <ListItemIcon>
              <AddToPhotosIcon
                fontSize="small"
                sx={{ color: 'text.secondary' }}
              />
            </ListItemIcon>
            Create Dashboard
          </MenuItem>
          <MenuItem
            onClick={() => {
              openCreateWidget()
              handleClose()
            }}
            disabled={!isAdmin}
            data-tutorial-id="create-widget-button"
            data-onboarding-id="dashboard-widget-create"
            sx={{ color: 'text.primary' }}
          >
            <ListItemIcon>
              <WidgetsIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </ListItemIcon>
            Create Widget
          </MenuItem>
          <Divider sx={{ borderColor: 'divider' }} />
          <MenuItem
            onClick={() => switchUser(isAdmin ? viewerUser : adminUser)}
            sx={{ color: 'text.primary' }}
          >
            <ListItemIcon>
              <SwitchAccountIcon
                fontSize="small"
                sx={{ color: 'text.secondary' }}
              />
            </ListItemIcon>
            {isAdmin ? 'Log in as Viewer' : 'Log in as Admin'}
          </MenuItem>
          <Divider sx={{ borderColor: 'divider' }} />
          <MenuItem onClick={handleLogout} sx={{ color: 'text.primary' }}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </ListItemIcon>
            Logout
          </MenuItem>
        </Menu>
      )}

      <Drawer
        anchor="bottom"
        open={isMobileWorkspaceHeader && dashboardSelectorOpen}
        onClose={() => setDashboardSelectorOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '20px 20px 0 0',
            bgcolor: 'background.paper',
            maxHeight: '72dvh',
            pb: 'calc(12px + env(safe-area-inset-bottom))',
          },
        }}
      >
        <Box sx={{ p: 2, pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={900}>
            Your dashboards
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Switch the active dashboard or create a new one.
          </Typography>
        </Box>
        <Box sx={{ overflowY: 'auto', px: 1, pb: 1 }}>
          {openDashboards.map((dashboard, index) => {
            const dashboardTitle =
              dashboard.studyPath?.title ||
              dashboard.name ||
              'Untitled dashboard'
            const selected = index === selectedDashboard
            const canEditDashboard =
              isAdmin &&
              (dashboard.kind === 'studyPathContainer'
                ? Boolean(dashboard.studyPath?.dashboards.length)
                : true)

            return (
              <MenuItem
                key={dashboard.id}
                selected={selected}
                onClick={() => {
                  setSelectedDashboard(index)
                  setDashboardSelectorOpen(false)
                }}
                sx={{
                  minHeight: 48,
                  borderRadius: 2,
                  mb: 0.5,
                  alignItems: 'center',
                  pr: 0.5,
                }}
              >
                <ListItemIcon sx={{ minWidth: 34 }}>
                  {selected ? (
                    <CheckCircleIcon fontSize="small" color="primary" />
                  ) : (
                    <Box sx={{ width: 20 }} />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={dashboardTitle}
                  primaryTypographyProps={{
                    noWrap: true,
                    fontWeight: selected ? 800 : 500,
                  }}
                  sx={{ minWidth: 0, mr: 1 }}
                />
                {canEditDashboard && (
                  <IconButton
                    aria-label={`Edit ${dashboardTitle}`}
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation()
                      window.dispatchEvent(
                        new CustomEvent(OPEN_DASHBOARD_EDITOR_EVENT, {
                          detail: {
                            host: 'workspace-builder',
                            dashboardId: dashboard.id,
                          },
                        }),
                      )
                      setDashboardSelectorOpen(false)
                    }}
                    sx={{
                      width: 36,
                      height: 36,
                      color: 'text.secondary',
                      flex: '0 0 auto',
                      '&:hover': {
                        color: 'primary.main',
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
                <IconButton
                  aria-label={`Close ${dashboardTitle}`}
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation()
                    removeDashboard(dashboard.id)
                  }}
                  sx={{
                    width: 36,
                    height: 36,
                    color: 'text.secondary',
                    flex: '0 0 auto',
                    '&:hover': {
                      color: 'error.main',
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </MenuItem>
            )
          })}
          <Divider sx={{ my: 1 }} />
          <MenuItem
            onClick={() => {
              addDashboard()
              setDashboardSelectorOpen(false)
            }}
            sx={{ minHeight: 48, borderRadius: 2 }}
          >
            <ListItemIcon sx={{ minWidth: 34 }}>
              <AddCircleOutlineIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText primary="Create new dashboard" />
          </MenuItem>
        </Box>
      </Drawer>

      <Dialog
        open={isUserSettingsOpen}
        onClose={() => setIsUserSettingsOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>User settings</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                src={avatarSrc || undefined}
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: 'primary.main',
                  fontWeight: 800,
                }}
              >
                {userData.id.substring(0, 2).toUpperCase()}
              </Avatar>
              <Stack spacing={1} direction="row" useFlexGap flexWrap="wrap">
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
                    onChange={handleUserAvatarUpload}
                  />
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={handleRemoveUserAvatar}
                  disabled={!avatarSrc}
                >
                  Remove
                </Button>
              </Stack>
            </Stack>
            {userSettingsAvatarStatus && (
              <Typography variant="caption" color="text.secondary">
                {userSettingsAvatarStatus}
              </Typography>
            )}
            <TextField
              label="User name"
              value={userSettingsName}
              onChange={(event) => setUserSettingsName(event.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsUserSettingsOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveUserSettings}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
      <SettingsDialog
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Application Settings"
        scope="global"
        showTooltips={showTooltips}
        onShowTooltipsChange={setShowTooltips}
        showDeleteConfirmation={showDeleteConfirmation}
        onShowDeleteConfirmationChange={setShowDeleteConfirmation}
        showComponentPaletteHelp={showComponentPaletteHelp}
        onShowComponentPaletteHelpChange={setShowComponentPaletteHelp}
        showDeleteWidgetConfirmation={showDeleteWidgetConfirmation}
        onShowDeleteWidgetConfirmationChange={setShowDeleteWidgetConfirmation}
        showDeleteDashboardConfirmation={showDeleteDashboardConfirmation}
        onShowDeleteDashboardConfirmationChange={
          setShowDeleteDashboardConfirmation
        }
        showAdvancedInToolbar={showAdvancedInToolbar}
        onShowAdvancedInToolbarChange={setShowAdvancedInToolbar}
        showDeleteTemplateConfirmation={showDeleteTemplateConfirmation}
        onShowDeleteTemplateConfirmationChange={
          setShowDeleteTemplateConfirmation
        }
      />
      {creationHost === 'navbar' && (
        <>
          <CreateStudyPackModal
            open={studyPackOpen}
            onClose={() => setStudyPackOpen(false)}
            onCreatePack={createStudyPackDashboard}
            onStatusChange={reportFromNotesStatus}
          />
          <CreateStudyPathModal
            open={studyPathOpen}
            onClose={() => setStudyPathOpen(false)}
            onCreatePath={createStudyPackDashboards}
            onStatusChange={reportStudyPathStatus}
          />
          <WidgetEditorDialog
            open={widgetEditorOpen}
            payload={widgetEditorPayload}
            onClose={() => {
              setWidgetEditorOpen(false)
              dispatchWorkspaceOnboardingEvent({
                type: 'widget-editor-closed',
              })
            }}
          />
        </>
      )}
      <Snackbar
        open={Boolean(creationToast)}
        autoHideDuration={5000}
        onClose={() => setCreationToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={creationToast?.severity || 'success'}
          variant="filled"
          onClose={() => setCreationToast(null)}
          sx={{ width: '100%' }}
        >
          {creationToast?.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default TopNavBar
