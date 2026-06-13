import React, { useCallback, useState, useEffect, useRef } from 'react'
import {
  Alert,
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
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
import BuildIcon from '@mui/icons-material/Build'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import DrawIcon from '@mui/icons-material/Draw'
import NotesIcon from '@mui/icons-material/Notes'
import TimerIcon from '@mui/icons-material/Timer'

import AccentColorPicker from '../../theme/AccentColorPicker'
import DashboardOptionsMenu from '../Dasboard/DashboardOptionsMenu'
import { useDashboards } from '../Dasboard/DashboardProvider'
import {
  OPEN_DASHBOARD_EDITOR_EVENT,
  OPEN_STUDY_PATH_EVENT,
  OPEN_WIDGET_EDITOR_EVENT,
  useWorkspaceActions,
} from '../../customHooks/useWorkspaceActions'
import ThemeModeToggle from '../shared/ThemeModeToggle'
import { CustomWidget } from '../WidgetEditor/WidgetStorage'
import SettingsDialog from '../WidgetEditor/components/dialogs/SettingsDialog'
import { dispatchWorkspaceOnboardingEvent } from '../onboarding/onboardingEvents'
import CreateStudyGuideModal from '../studyGuides/CreateStudyGuideModal'
import {
  HOSTED_AI_INSUFFICIENT_CREDITS_EVENT,
  readQuickCreateAiSettings,
  QUICK_CREATE_AI_SETTINGS_CHANGED_EVENT,
  QuickCreateAiProvider,
} from '../../quickCreate/ai'
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
import { deleteStudyMeshProfile, useAuth } from '../../auth/AuthProvider'
import AiModePill from '../hostedAi/AiModePill'
import AiModeDialog from '../hostedAi/AiModeDialog'
import { useStudyTools } from '../studyTools'
import type { StudyToolId } from '../studyTools'

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
  userData.role === 'ADMIN_ROLE'

const canOpenStudyPathForCurrentState = (userData: UserData) => {
  return isAdminUser(userData)
}

const quickCreateAiProviderLabels: Record<QuickCreateAiProvider, string> = {
  local: 'Google Local AI',
  gemini: 'Own Gemini API token',
  cerebras: 'Own Cerebras API key',
  hosted: 'Hosted AI',
}

const initialCreationTaskStatuses: Record<
  WorkspaceCreationTask,
  WorkspaceCreationTaskState
> = {
  'study-path': 'idle',
  'quick-create': 'idle',
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
  'aria-label'?: string
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
  const [toolsAnchorEl, setToolsAnchorEl] = useState<null | HTMLElement>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false)
  const [isAiModeOpen, setIsAiModeOpen] = useState(false)
  const [aiModeNotice, setAiModeNotice] = useState('')
  const [userSettingsName, setUserSettingsName] = useState('')
  const [userSettingsAvatarStatus, setUserSettingsAvatarStatus] = useState('')
  const [studyPathOpen, setStudyPathOpen] = useState(false)
  const creationTaskStatusesRef = useRef(initialCreationTaskStatuses)
  const [creationToast, setCreationToast] = useState<{
    severity: 'success' | 'error'
    message: string
  } | null>(null)
  const [quickCreateAiProvider, setQuickCreateAiProvider] =
    useState<QuickCreateAiProvider>(
      () => readQuickCreateAiSettings().provider || 'hosted',
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
  const userModeLabel = quickCreateAiProviderLabels[quickCreateAiProvider]
  const auth = useAuth()
  const {
    openCreateWidget,
    openCreateDashboard,
    createQuickCreateDashboards,
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
  const { openTool, state: studyToolsState } = useStudyTools()
  const tools: Array<{
    id: StudyToolId
    label: string
    description: string
    icon: React.ReactNode
  }> = [
    { id: 'canvas', label: 'Canvas', description: 'Spatial notes and links', icon: <DrawIcon /> },
    { id: 'pomodoro', label: 'Pomodoro', description: 'Focus timer', icon: <TimerIcon /> },
    { id: 'todo', label: 'Todo', description: 'Personal task list', icon: <CheckBoxIcon /> },
    { id: 'scratchpad', label: 'Scratchpad', description: 'Quick personal notes', icon: <NotesIcon /> },
    {
      id: 'private-chat',
      label: studyToolsState.privateChat.enabled ? 'Restore AI Chat' : 'Private Chat',
      description: studyToolsState.privateChat.enabled
        ? 'Put AI Chat back in the chat section'
        : 'Show Private Chat in this panel',
      icon: <ChatBubbleOutlineIcon />,
    },
  ]

  const {
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
      setQuickCreateAiProvider(readQuickCreateAiSettings().provider || 'hosted')
    }

    window.addEventListener(
      QUICK_CREATE_AI_SETTINGS_CHANGED_EVENT,
      refreshAiProvider,
    )
    window.addEventListener('storage', refreshAiProvider)

    return () => {
      window.removeEventListener(
        QUICK_CREATE_AI_SETTINGS_CHANGED_EVENT,
        refreshAiProvider,
      )
      window.removeEventListener('storage', refreshAiProvider)
    }
  }, [])

  useEffect(() => {
    const handleInsufficientCredits = () => {
      setAiModeNotice(
        'You do not have enough Study Credits for that action. Buy a credit pack, switch to your own API key, or wait for the next daily refill.',
      )
      setIsAiModeOpen(true)
    }

    window.addEventListener(
      HOSTED_AI_INSUFFICIENT_CREDITS_EVENT,
      handleInsufficientCredits,
    )

    return () => {
      window.removeEventListener(
        HOSTED_AI_INSUFFICIENT_CREDITS_EVENT,
        handleInsufficientCredits,
      )
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

      const canEdit = parsedUserData.role === 'ADMIN_ROLE'

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
    auth
      .signOut()
      .catch((error) => {
        console.error('Failed to sign out', error)
        localStorage.removeItem('userData')
      })
      .finally(() => navigate('/login', { replace: true }))
  }

  const handleDeleteStudyMeshProfile = async () => {
    if (!auth.user) {
      throw new Error('No signed-in StudyMesh profile is available.')
    }

    await deleteStudyMeshProfile(auth.user.id)
    setIsSettingsOpen(false)
    navigate('/login', { replace: true })
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
              {creationHost === 'external' ? (
                <Box
                  aria-label="StudyMesh logo"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/study-guides')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      navigate('/study-guides')
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    flex: 1,
                    minWidth: 0,
                    color: 'foreground.contrastPrimary',
                    cursor: 'pointer',
                  }}
                >
                  <Box
                    data-testid="logo"
                    component="img"
                    src="/logo.png"
                    alt=""
                    sx={{ width: 30, height: 30, display: 'block' }}
                  />
                  <Typography variant="subtitle2" fontWeight={900} noWrap>
                    StudyMesh
                  </Typography>
                </Box>
              ) : (
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
                </>
              )}
              <IconButton
                aria-label="Open Tools"
                onClick={(event) => setToolsAnchorEl(event.currentTarget)}
                sx={{
                  width: 44,
                  height: 44,
                  color: 'foreground.contrastPrimary',
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
                }}
              >
                <BuildIcon />
              </IconButton>
              <AiModePill
                compact
                provider={quickCreateAiProvider}
                onClick={() => {
                  setAiModeNotice('')
                  setIsAiModeOpen(true)
                }}
              />
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
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/study-guides')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      navigate('/study-guides')
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: isDesktop ? 'bold' : 'normal',
                    mr: isDesktop ? 1.25 : 0.5,
                    color: 'foreground.contrastPrimary',
                    px: 0,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
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

                {creationHost !== 'external' ? <DashboardOptionsMenu /> : null}
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
                <Button
                  aria-label="Open Tools"
                  onClick={(event) => setToolsAnchorEl(event.currentTarget)}
                  startIcon={<BuildIcon />}
                  sx={{
                    color: 'foreground.contrastPrimary',
                    textTransform: 'none',
                    minWidth: isTablet ? 44 : 'auto',
                    px: isTablet ? 1 : 1.5,
                  }}
                >
                  {isTablet ? null : 'Tools'}
                </Button>
                <AiModePill
                  compact={isPhone || isTablet}
                  provider={quickCreateAiProvider}
                  onClick={() => {
                    setAiModeNotice('')
                    setIsAiModeOpen(true)
                  }}
                />
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
                    aria-label="Open user menu"
                    onClick={handleUserMenuOpen}
                    sx={{ minWidth: '45px' }}
                  />
                ) : (
                  <Button
                    onClick={handleUserMenuOpen}
                    aria-label="Open user menu"
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

      <Menu
        anchorEl={toolsAnchorEl}
        open={Boolean(toolsAnchorEl)}
        onClose={() => setToolsAnchorEl(null)}
        PaperProps={{
          sx: {
            width: 320,
            maxWidth: 'calc(100vw - 24px)',
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography fontWeight={900}>Tools</Typography>
          <Typography variant="caption" color="text.secondary">
            Personal study utilities
          </Typography>
        </Box>
        <Divider />
        {tools.map((tool) => (
          <MenuItem
            key={tool.id}
            onClick={() => {
              openTool(tool.id)
              setToolsAnchorEl(null)
            }}
            sx={{ py: 1.25 }}
          >
            <ListItemIcon sx={{ color: 'primary.main' }}>
              {tool.icon}
            </ListItemIcon>
            <ListItemText primary={tool.label} secondary={tool.description} />
          </MenuItem>
        ))}
      </Menu>

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
          {creationHost !== 'external' ? (
            <>
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
            </>
          ) : null}
          <MenuItem onClick={handleLogout} sx={{ color: 'text.primary' }}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </ListItemIcon>
            Logout
          </MenuItem>
        </Menu>
      )}

      {creationHost !== 'external' ? (
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
                    component="span"
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
                  component="span"
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
      ) : null}

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
      <AiModeDialog
        open={isAiModeOpen}
        notice={aiModeNotice}
        onClose={() => {
          setIsAiModeOpen(false)
          setAiModeNotice('')
        }}
      />
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
        onDeleteStudyMeshProfile={handleDeleteStudyMeshProfile}
      />
      {creationHost === 'navbar' && (
        <>
          <CreateStudyGuideModal
            open={studyPathOpen}
            onClose={() => setStudyPathOpen(false)}
            onCreatePath={createQuickCreateDashboards}
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
