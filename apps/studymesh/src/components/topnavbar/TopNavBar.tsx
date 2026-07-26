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
  Drawer,
  IconButton,
  ListItemIcon,
  ListItemText,
  Snackbar,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'

import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import LogoutIcon from '@mui/icons-material/Logout'
import ColorLensIcon from '@mui/icons-material/ColorLens'
import CloseIcon from '@mui/icons-material/Close'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

import DashboardOptionsMenu from '../Dasboard/DashboardOptionsMenu'
import { useDashboards } from '../Dasboard/DashboardProvider'
import {
  OPEN_STUDY_PATH_EVENT,
  useWorkspaceActions,
} from '../../customHooks/useWorkspaceActions'
import { WORKSPACE_DASHBOARD_TABS_SLOT_ID } from '../workspace/workspaceEvents'
import AppearanceDialog from '../settings/AppearanceDialog'
import SettingsDialog from '../settings/SettingsDialog'
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
import { useResponsiveWorkspaceMode } from '../workspace/useResponsiveWorkspaceMode'
import { deleteStudyMeshProfile, useAuth } from '../../auth/AuthProvider'
import AiModePill from '../hostedAi/AiModePill'
import AiModeDialog from '../hostedAi/AiModeDialog'
import { useInterfaceText } from '../../language/interfaceLanguage'

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

const isAdminUser = (userData: UserData) => userData.role === 'ADMIN_ROLE'

const canOpenStudyPathForCurrentState = (userData: UserData) => {
  return isAdminUser(userData)
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

const TopNavBar: React.FC<TopNavBarProps> = ({ creationHost = 'navbar' }) => {
  const { t } = useInterfaceText()
  // State for different dropdown menus
  const [userAnchorEl, setUserAnchorEl] = useState<null | HTMLElement>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false)
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
  const [userData, setUserData] = useState<UserData>(adminUser)
  const [avatarSrc, setAvatarSrc] = useState(() => readUserAvatar(adminUser.id))
  const [dashboardSelectorOpen, setDashboardSelectorOpen] = useState(false)
  const userModeLabel = React.useMemo(() => {
    switch (quickCreateAiProvider) {
      case 'local':
        return t('ai.localGoogle')
      case 'gemini':
        return t('ai.ownGemini')
      case 'cerebras':
        return t('ai.ownCerebras')
      case 'hosted':
      default:
        return t('ai.hosted')
    }
  }, [quickCreateAiProvider, t])
  const auth = useAuth()
  const { createQuickCreateDashboards } = useWorkspaceActions()
  const {
    openDashboards,
    removeDashboard,
    selectedDashboard,
    setSelectedDashboard,
  } = useDashboards()
  const currentDashboard = openDashboards[selectedDashboard]
  const currentDashboardTitle =
    currentDashboard?.studyPath?.title || currentDashboard?.name || 'RabbitHole'
  const navigate = useNavigate()

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
    const handleInsufficientCredits = (event: Event) => {
      const detail = (event as CustomEvent<{ showNotice?: boolean }>).detail
      setAiModeNotice(
        detail?.showNotice === false
          ? ''
          : 'You do not have enough Carrots for that action. Buy a carrot pack, switch to your own API key, or use local AI.',
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
      throw new Error(t('settings.noSignedInProfile'))
    }

    await deleteStudyMeshProfile(auth.user.id)
    setIsSettingsOpen(false)
    navigate('/login', { replace: true })
  }

  const openSettings = () => {
    setUserSettingsName(userData.name)
    setUserSettingsAvatarStatus('')
    setIsSettingsOpen(true)
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
    setUserSettingsAvatarStatus(t('settings.profileSaved'))
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
      setUserSettingsAvatarStatus(t('settings.avatarFileType'))
      return
    }

    try {
      setUserSettingsAvatarStatus(t('settings.avatarPreparing'))
      const avatarDataUrl = await createSquareAvatarDataUrl(file)
      saveUserAvatar(userData.id, avatarDataUrl)
      setAvatarSrc(avatarDataUrl)
      setUserSettingsAvatarStatus(t('settings.avatarUpdated'))
    } catch (error) {
      setUserSettingsAvatarStatus(
        error instanceof Error
          ? error.message
          : t('settings.avatarUpdateFailed'),
      )
    }
  }

  const handleRemoveUserAvatar = () => {
    removeUserAvatar(userData.id)
    setAvatarSrc('')
    setUserSettingsAvatarStatus(t('settings.avatarRemoved'))
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
          boxShadow: 'none',
          borderBottom: 1,
          borderColor: 'divider',
          height: isMobileWorkspaceHeader ? '56px' : '52px',
        }}
      >
        <Toolbar
          sx={{
            minHeight: isMobileWorkspaceHeader ? '56px' : '52px',
            height: isMobileWorkspaceHeader ? '56px' : '52px',
            boxSizing: 'border-box',
            alignItems: 'center',
            py: 0,
            px: isMobileWorkspaceHeader ? 0.75 : 1.25,
            gap: isMobileWorkspaceHeader ? 0.75 : 0,
            '& .MuiTypography-root': {
              lineHeight: 1.15,
            },
            '@media (min-width:600px)': {
              minHeight: isMobileWorkspaceHeader ? '56px' : '52px',
              height: isMobileWorkspaceHeader ? '56px' : '52px',
            },
          }}
        >
          {isMobileWorkspaceHeader ? (
            <>
              {creationHost === 'external' ? (
                <Box
                  aria-label="RabbitHole logo"
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
                    gap: 1.1,
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
                  <Typography variant="subtitle2" fontWeight={600} noWrap>
                    RabbitHole
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
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                      '&:hover': { bgcolor: 'action.selected' },
                      '& .MuiButton-endIcon': { ml: 0.25, mr: 0 },
                    }}
                  >
                    <Typography
                      component="span"
                      variant="subtitle2"
                      fontWeight={600}
                      noWrap
                      sx={{ minWidth: 0, maxWidth: '100%' }}
                    >
                      {currentDashboardTitle || t('topnav.selectDashboard')}
                    </Typography>
                  </Button>
                </>
              )}
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
                  aria-label="RabbitHole logo"
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
                      mr: isDesktop ? 1.35 : 0,
                    }}
                  />
                  {isDesktop && 'RabbitHole'}
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
                    label={t('topnav.user')}
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
                    <Typography variant="subtitle2" fontWeight={600}>
                      {userData.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {userModeLabel}
                    </Typography>
                  </Box>
                  <MenuItem
                    onClick={() => {
                      setIsAppearanceOpen(true)
                      handleClose()
                    }}
                    sx={{ color: 'text.primary', marginTop: 1 }}
                  >
                    <ListItemIcon>
                      <ColorLensIcon
                        fontSize="small"
                        sx={{ color: 'text.secondary' }}
                      />
                    </ListItemIcon>
                    {t('topnav.appearance')}
                  </MenuItem>
                  <MenuItem
                    onClick={openSettings}
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
                    {t('topnav.settings')}
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
                    {t('topnav.logout')}
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
            <Typography variant="subtitle2" fontWeight={600}>
              {userData.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {userModeLabel}
            </Typography>
          </Box>
          <MenuItem
            onClick={() => {
              setIsAppearanceOpen(true)
              handleClose()
            }}
            sx={{ color: 'text.primary', marginTop: 1 }}
          >
            <ListItemIcon>
              <ColorLensIcon
                fontSize="small"
                sx={{ color: 'text.secondary' }}
              />
            </ListItemIcon>
            {t('topnav.appearance')}
          </MenuItem>
          <MenuItem onClick={openSettings} sx={{ color: 'text.primary' }}>
            <ListItemIcon>
              <ManageAccountsIcon
                fontSize="small"
                sx={{ color: 'text.secondary' }}
              />
            </ListItemIcon>
            {t('topnav.settings')}
          </MenuItem>
          <MenuItem onClick={handleLogout} sx={{ color: 'text.primary' }}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </ListItemIcon>
            {t('topnav.logout')}
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
              borderRadius: '16px 16px 0 0',
              bgcolor: 'background.paper',
              maxHeight: '72dvh',
              pb: 'calc(12px + env(safe-area-inset-bottom))',
            },
          }}
        >
          <Box sx={{ p: 2, pb: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {t('topnav.yourDashboards')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('topnav.yourDashboardsHelp')}
            </Typography>
          </Box>
          <Box sx={{ overflowY: 'auto', px: 1, pb: 1 }}>
            {openDashboards.map((dashboard, index) => {
              const dashboardTitle =
                dashboard.studyPath?.title ||
                dashboard.name ||
                'Untitled dashboard'
              const selected = index === selectedDashboard
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
          </Box>
        </Drawer>
      ) : null}

      <AppearanceDialog
        open={isAppearanceOpen}
        onClose={() => setIsAppearanceOpen(false)}
      />
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
        title={t('settings.title')}
        profileSettings={{
          userId: userData.id,
          userName: userSettingsName,
          avatarSrc,
          avatarStatus: userSettingsAvatarStatus,
          onUserNameChange: setUserSettingsName,
          onAvatarUpload: handleUserAvatarUpload,
          onRemoveAvatar: handleRemoveUserAvatar,
          onSaveProfile: saveUserSettings,
        }}
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
