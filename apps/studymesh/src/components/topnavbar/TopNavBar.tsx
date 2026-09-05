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
  Drawer,
  IconButton,
  ListItemIcon,
  ListItemText,
  Snackbar,
} from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'

import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined'
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
import {
  normalizeStartNextStudyGuideRequests,
  START_NEXT_STUDY_GUIDE_EVENT,
  WORKSPACE_DASHBOARD_TABS_SLOT_ID,
} from '../workspace/workspaceEvents'
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
import {
  getAllUserKnownTopics,
  PROFILE_CONTEXT_CHANGED_EVENT,
} from '../../profileContext'
import { CLOUD_SYNC_STATUS_EVENT } from '../../cloud/CloudWorkspaceSync'
import KnownTopicsPanel from '../profile/KnownTopicsPanel'
import KnownTopicsPill from '../profile/KnownTopicsPill'
import { useInterfaceText } from '../../language/interfaceLanguage'

const KNOWN_TOPICS_PANEL_SEEN_KEY = 'studymesh-known-topics-panel-seen-v1'

const hasSeenKnownTopicsPanel = (): boolean => {
  try {
    return Boolean(window.localStorage.getItem(KNOWN_TOPICS_PANEL_SEEN_KEY))
  } catch {
    return true
  }
}

const markKnownTopicsPanelSeen = () => {
  try {
    window.localStorage.setItem(KNOWN_TOPICS_PANEL_SEEN_KEY, '1')
  } catch {
    // Best-effort: a failed write only means the panel may auto-open again.
  }
}

// Define user data type
interface UserData {
  id: string
  name: string
  role: string
}

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
  const [dashboardSelectorOpen, setDashboardSelectorOpen] = useState(false)
  const [knownTopicsOpen, setKnownTopicsOpen] = useState(false)
  const [knownTopicsCount, setKnownTopicsCount] = useState(
    () => getAllUserKnownTopics().length,
  )
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
  const location = useLocation()

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
      } catch (error) {
        console.error('Failed to parse user data from localStorage', error)
      }
    }
  }, [])

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

  // Sent by a finished quiz offering follow-up guides. Handled here rather than
  // in the quiz block because the nav bar sits on both the guide workspace and
  // the guide list, so one listener covers the hop between them.
  useEffect(() => {
    const handleStartNextStudyGuide = (event: Event) => {
      const detail = (event as CustomEvent<{ prompts?: unknown }>).detail
      const prompts = normalizeStartNextStudyGuideRequests(detail?.prompts)
      if (!prompts.length) {
        return
      }

      navigate('/study-guides', { state: { createGuidePrompts: prompts } })
    }

    window.addEventListener(
      START_NEXT_STUDY_GUIDE_EVENT,
      handleStartNextStudyGuide,
    )

    return () => {
      window.removeEventListener(
        START_NEXT_STUDY_GUIDE_EVENT,
        handleStartNextStudyGuide,
      )
    }
  }, [navigate])

  useEffect(() => {
    const syncKnownTopics = () =>
      setKnownTopicsCount(getAllUserKnownTopics().length)

    window.addEventListener(PROFILE_CONTEXT_CHANGED_EVENT, syncKnownTopics)
    window.addEventListener('storage', syncKnownTopics)

    return () => {
      window.removeEventListener(PROFILE_CONTEXT_CHANGED_EVENT, syncKnownTopics)
      window.removeEventListener('storage', syncKnownTopics)
    }
  }, [])

  // Cloud sync writes the profile context into localStorage asynchronously after
  // login, so deciding on a synchronous read would auto-open the panel for users
  // who already have topics and burn the one-shot flag on them. Only auto-open on
  // the guide library, not on a deep link straight into a workspace canvas.
  useEffect(() => {
    if (location.pathname !== '/study-guides' || hasSeenKnownTopicsPanel()) {
      return undefined
    }

    let settled = false
    let isMounted = true
    const decide = () => {
      if (settled || !isMounted) {
        return
      }

      settled = true
      const topics = getAllUserKnownTopics()
      setKnownTopicsCount(topics.length)
      markKnownTopicsPanelSeen()
      if (topics.length === 0) {
        setKnownTopicsOpen(true)
      }
    }

    const handleCloudStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: string }>).detail
      if (detail?.status === 'synced' || detail?.status === 'error') {
        decide()
      }
    }
    const fallback = window.setTimeout(decide, 1500)

    window.addEventListener(CLOUD_SYNC_STATUS_EVENT, handleCloudStatus)

    return () => {
      isMounted = false
      window.clearTimeout(fallback)
      window.removeEventListener(CLOUD_SYNC_STATUS_EVENT, handleCloudStatus)
    }
  }, [location.pathname])

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
    setIsSettingsOpen(true)
    handleClose()
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
              <KnownTopicsPill
                compact
                count={knownTopicsCount}
                onClick={() => setKnownTopicsOpen(true)}
              />
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
                <AccountCircleOutlinedIcon />
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
                <KnownTopicsPill
                  compact={isPhone || isTablet}
                  count={knownTopicsCount}
                  onClick={() => setKnownTopicsOpen(true)}
                />
                <AiModePill
                  compact={isPhone || isTablet}
                  provider={quickCreateAiProvider}
                  onClick={() => {
                    setAiModeNotice('')
                    setIsAiModeOpen(true)
                  }}
                />
                {/* Account menu. The name and the active AI mode are worth the
                    width; a profile picture is not, so the trigger carries text
                    only. There is nothing to upload and nothing to invent. */}
                {isPhone || isTablet ? (
                  <ButtonWithLabel
                    icon={<AccountCircleOutlinedIcon />}
                    label={t('topnav.account')}
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
                      px: 1.5,
                      display: 'flex',
                    }}
                    endIcon={<KeyboardArrowDownIcon />}
                  >
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

      <KnownTopicsPanel
        open={knownTopicsOpen}
        onClose={() => setKnownTopicsOpen(false)}
      />
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
