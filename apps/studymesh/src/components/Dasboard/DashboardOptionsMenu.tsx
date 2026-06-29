import React, { useState, useEffect } from 'react'
import {
  Button,
  Menu,
  MenuItem,
  Divider,
  Typography,
  Box,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  ListItemText,
} from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DashboardIcon from '@mui/icons-material/Dashboard'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { DashboardLayout, StudyPathContainerState } from '../../state/store'
import { useDashboards } from './DashboardProvider'
import {
  ensureStarterDashboards,
  OPEN_SAVED_DASHBOARDS_EVENT,
} from '../../customHooks/useWorkspaceActions'
import {
  DEFAULT_FOLDER_COLOR,
  normalizeFolderColor,
  normalizeFolderName,
} from './folderColors'
import {
  createStudyPathContainerState,
  getDashboardCreatedTime,
} from './studyPathContainer'
import { dispatchWorkspaceOnboardingEvent } from '../onboarding/onboardingEvents'
import { StudyGuideStorage } from '../../studyGuides/storage'
import { useInterfaceText } from '../../language/interfaceLanguage'

const USER_ROLE_CHANGED_EVENT = 'studymesh-user-role-changed'
const MAX_MENU_ITEMS_PER_FOLDER = 15
const STUDY_PATH_EXPANDED_STORAGE_KEY =
  'studymesh-study-path-menu-expanded-folders-v1'

// Define saved dashboard type
interface SavedDashboard {
  id: string
  name: string
  folder?: string
  folderColor?: string
  layout: DashboardLayout
  description?: string
  tags?: string[]
  isPublic?: boolean
  createdAt: string
  updatedAt: string
}

interface StudyPathMenuGroup {
  id: string
  folderName: string
  dashboards: SavedDashboard[]
  studyPath: StudyPathContainerState
}

// Button with label component
interface ButtonWithLabelProps {
  icon: React.ReactNode
  label: string
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  sx?: React.CSSProperties | Record<string, unknown>
  'data-tutorial-id'?: string
  'data-onboarding-id'?: string
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
        minWidth: '48px',
        mx: 0.5,
        px: 1,
        ...sx,
      }}
      {...props}
    >
      {icon}
      <Typography
        variant="caption"
        sx={{ fontSize: '0.6rem', mt: 0.3, lineHeight: 1 }}
      >
        {label}
      </Typography>
    </Button>
  )
}

const hasDashboardContent = (layout?: DashboardLayout): boolean => {
  if (!layout) {
    return false
  }

  if (layout.type === 'tab' && Boolean(layout.component)) {
    return true
  }

  return Boolean(layout.children?.some((child) => hasDashboardContent(child)))
}

interface DashboardOptionsMenuProps {
  compactMobile?: boolean
}

const DashboardOptionsMenu: React.FC<DashboardOptionsMenuProps> = ({
  compactMobile = false,
}) => {
  const { t } = useInterfaceText()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [customDashboards, setCustomDashboards] = useState<SavedDashboard[]>([])
  const [studyGuides, setStudyGuides] = useState<
    ReturnType<typeof StudyGuideStorage.getAll>
  >([])
  const [expandedDashboardFolders, setExpandedDashboardFolders] = useState<
    string[]
  >([])
  const [expandedStudyPathFolders, setExpandedStudyPathFolders] = useState<
    string[]
  >([])
  // Track admin status to filter dashboards
  const [isAdmin, setIsAdmin] = useState(false)

  const {
    addDashboard,
    addDashboards,
    addStudyPathContainer,
    openDashboards,
    replaceDashboard,
    selectedDashboard,
    setSelectedDashboard,
    updateStudyPathContainer,
  } = useDashboards()

  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'))
  const isDarkMode = theme.palette.mode === 'dark'
  const studyGuideHeaderColor = isDarkMode ? '#7FE3C4' : '#007C66'
  const studyGuideHeaderBackground = isDarkMode ? '#007C6652' : '#007C6624'
  const quickCreateHeaderColor = isDarkMode ? '#FFD166' : '#B26A00'
  const quickCreateHeaderBackground = isDarkMode ? '#FFD16633' : '#B26A0024'
  const customDashboardHeaderColor = isDarkMode ? '#C5D0D6' : '#455A64'
  const customDashboardHeaderBackground = isDarkMode ? '#455A6466' : '#455A6420'
  const getFolderItemBackground = (folderColor: string) =>
    `${folderColor}${isDarkMode ? '0E' : '10'}`
  const getFolderItemHoverBackground = (folderColor: string) =>
    `${folderColor}${isDarkMode ? '23' : '22'}`

  // Load saved dashboards from localStorage on component mount
  useEffect(() => {
    loadSavedDashboards()
    try {
      const storedExpandedFolders = localStorage.getItem(
        STUDY_PATH_EXPANDED_STORAGE_KEY,
      )
      if (storedExpandedFolders) {
        setExpandedStudyPathFolders(JSON.parse(storedExpandedFolders))
      }
    } catch (error) {
      console.error('Failed to load Study Guide menu state', error)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(
        STUDY_PATH_EXPANDED_STORAGE_KEY,
        JSON.stringify(expandedStudyPathFolders),
      )
    } catch (error) {
      console.error('Failed to save Study Guide menu state', error)
    }
  }, [expandedStudyPathFolders])

  // Determine if current user is admin
  useEffect(() => {
    const readUserRole = () => {
      try {
        const userData = localStorage.getItem('userData')
        if (userData) {
          const parsedData = JSON.parse(userData)
          setIsAdmin(parsedData.role === 'ADMIN_ROLE')
          return
        }
        setIsAdmin(false)
      } catch (error) {
        console.error('Failed to parse user data', error)
        setIsAdmin(false)
      }
    }

    readUserRole()
    window.addEventListener(USER_ROLE_CHANGED_EVENT, readUserRole)

    return () => {
      window.removeEventListener(USER_ROLE_CHANGED_EVENT, readUserRole)
    }
  }, [])

  const loadSavedDashboards = () => {
    try {
      ensureStarterDashboards()
      const dashboards = localStorage.getItem('customDashboards')
      if (dashboards) {
        setCustomDashboards(JSON.parse(dashboards))
      }
      setStudyGuides(StudyGuideStorage.getAll())
    } catch (error) {
      console.error('Failed to load saved dashboards', error)
    }
  }

  // Filter dashboards based on admin status
  const visibleCustomDashboards = isAdmin
    ? customDashboards
    : customDashboards.filter((d) => d.isPublic)

  const dashboardsByFolder = visibleCustomDashboards.reduce<
    Record<string, SavedDashboard[]>
  >((folders, dashboard) => {
    const folderName = normalizeFolderName(dashboard.folder)
    folders[folderName] = folders[folderName] || []
    folders[folderName].push(dashboard)
    return folders
  }, {})

  const isQuickCreateDashboard = (dashboard: SavedDashboard) => {
    const folderName = normalizeFolderName(dashboard.folder).toLowerCase()
    return (
      folderName === 'quick creates' ||
      dashboard.id.startsWith('quick-create-dashboard-') ||
      Boolean(dashboard.tags?.includes('quick-create'))
    )
  }

  const quickCreateDashboards = visibleCustomDashboards.filter(
    isQuickCreateDashboard,
  )
  const rawQuickCreateFolders = Object.entries(
    quickCreateDashboards.reduce<Record<string, SavedDashboard[]>>(
      (folders, dashboard) => {
        const folderName = normalizeFolderName(dashboard.folder)
        folders[folderName] = folders[folderName] || []
        folders[folderName].push(dashboard)
        return folders
      },
      {},
    ),
  )
  const storedStudyPathGroups: StudyPathMenuGroup[] = studyGuides.map(
    (studyGuide) => ({
      id: studyGuide.id,
      folderName: studyGuide.folderName,
      dashboards: studyGuide.studyPath.dashboards,
      studyPath: studyGuide.studyPath,
    }),
  )
  const studyPathGroups = storedStudyPathGroups
  const studyPathFolderNames = new Set(
    studyPathGroups.map((group) => group.folderName),
  )
  const quickCreateFolders = rawQuickCreateFolders.filter(
    ([folderName]) => !studyPathFolderNames.has(folderName),
  )
  const customDashboardFolders = Object.entries(dashboardsByFolder).filter(
    ([folderName, dashboards]) =>
      folderName.toLowerCase() !== 'quick creates' &&
      dashboards.some((dashboard) => !isQuickCreateDashboard(dashboard)),
  )
  const hasVisibleLibraryItems =
    studyPathGroups.length > 0 ||
    quickCreateFolders.length > 0 ||
    customDashboardFolders.length > 0

  const getFolderColor = (folderName: string, dashboards: SavedDashboard[]) =>
    normalizeFolderColor(
      dashboards.find((dashboard) => dashboard.folderColor)?.folderColor ||
        (folderName === 'Mathematics'
          ? '#1976D2'
          : folderName === 'Tutorial'
          ? DEFAULT_FOLDER_COLOR
          : undefined),
    )

  // Handle opening and closing dropdown
  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    loadSavedDashboards() // Refresh the list when opening menu
    setExpandedDashboardFolders([])
    setAnchorEl(event.currentTarget)
    dispatchWorkspaceOnboardingEvent({ type: 'dashboard-menu-opened' })
  }

  const handleClose = () => {
    setAnchorEl(null)
    setExpandedDashboardFolders([])
  }

  // Create a dashboard with predefined layout
  const createDashboardWithLayout = (
    dashboardName: string,
    layout: DashboardLayout,
  ) => {
    const focusedDashboard = openDashboards[selectedDashboard]

    if (
      focusedDashboard &&
      focusedDashboard.kind !== 'studyPathContainer' &&
      !hasDashboardContent(focusedDashboard.layout)
    ) {
      replaceDashboard(selectedDashboard, {
        name: dashboardName,
        layout,
      })
      handleClose()
      return
    }

    addDashboard({
      name: dashboardName,
      layout,
    })
    handleClose()
  }

  // Load a saved dashboard
  const loadCustomDashboard = (dashboard: SavedDashboard) => {
    createDashboardWithLayout(dashboard.name, dashboard.layout)
    dispatchWorkspaceOnboardingEvent({
      type: 'saved-dashboard-opened',
      dashboardId: dashboard.id,
      dashboardName: dashboard.name,
    })
  }

  const loadDashboardFolder = (dashboards: SavedDashboard[]) => {
    const orderedDashboards = [...dashboards].sort(
      (firstDashboard, secondDashboard) =>
        getDashboardCreatedTime(firstDashboard) -
        getDashboardCreatedTime(secondDashboard),
    )
    const studyPath = createStudyPathContainerState(orderedDashboards)

    if (studyPath) {
      addStudyPathContainer(studyPath)

      orderedDashboards.forEach((dashboard) => {
        dispatchWorkspaceOnboardingEvent({
          type: 'saved-dashboard-opened',
          dashboardId: dashboard.id,
          dashboardName: dashboard.name,
        })
      })

      handleClose()
      return
    }

    addDashboards(
      orderedDashboards.map((dashboard) => ({
        name: dashboard.name,
        layout: dashboard.layout,
      })),
      { replaceEmptySelected: true },
    )

    orderedDashboards.forEach((dashboard) => {
      dispatchWorkspaceOnboardingEvent({
        type: 'saved-dashboard-opened',
        dashboardId: dashboard.id,
        dashboardName: dashboard.name,
      })
    })

    handleClose()
  }

  const openStudyPathGroup = (group: StudyPathMenuGroup, selectedIndex = 0) => {
    const normalizedIndex = Math.min(
      Math.max(selectedIndex, 0),
      Math.max(group.studyPath.dashboards.length - 1, 0),
    )
    const openStudyPathIndex = openDashboards.findIndex(
      (dashboard) =>
        dashboard.kind === 'studyPathContainer' &&
        dashboard.studyPath?.pathId === group.studyPath.pathId,
    )

    if (openStudyPathIndex >= 0) {
      const openStudyPathDashboard = openDashboards[openStudyPathIndex]
      updateStudyPathContainer(openStudyPathDashboard.id, (studyPath) => ({
        ...studyPath,
        selectedIndex: normalizedIndex,
      }))
      setSelectedDashboard(openStudyPathIndex)
    } else {
      addStudyPathContainer({
        ...group.studyPath,
        selectedIndex: normalizedIndex,
      })
    }

    group.dashboards.forEach((dashboard) => {
      dispatchWorkspaceOnboardingEvent({
        type: 'saved-dashboard-opened',
        dashboardId: dashboard.id,
        dashboardName: dashboard.name,
      })
    })

    handleClose()
  }

  const openStudyPathLessonInNewTab = (
    group: StudyPathMenuGroup,
    lessonIndex: number,
  ) => {
    const lesson = group.studyPath.dashboards[lessonIndex]
    if (!lesson) {
      return
    }

    createDashboardWithLayout(lesson.name, lesson.layout)
    handleClose()
  }

  const toggleStudyPathExpanded = (
    event: React.MouseEvent<HTMLElement>,
    folderName: string,
  ) => {
    event.stopPropagation()
    setExpandedStudyPathFolders((currentFolders) =>
      currentFolders.includes(folderName)
        ? currentFolders.filter((currentFolder) => currentFolder !== folderName)
        : [...currentFolders, folderName],
    )
  }

  const openSavedDashboardsForFolder = (
    event: React.MouseEvent<HTMLElement>,
    folderName: string,
  ) => {
    event.stopPropagation()
    handleClose()
    window.dispatchEvent(
      new CustomEvent(OPEN_SAVED_DASHBOARDS_EVENT, {
        detail: { folderFilter: folderName },
      }),
    )
  }

  const showAllDashboardsForFolder = (
    event: React.MouseEvent<HTMLElement>,
    folderName: string,
  ) => {
    event.stopPropagation()
    setExpandedDashboardFolders((currentFolders) =>
      currentFolders.includes(folderName)
        ? currentFolders
        : [...currentFolders, folderName],
    )
  }

  return (
    <>
      {isPhone || isTablet ? (
        compactMobile ? (
          <IconButton
            onClick={handleMenuOpen}
            aria-label="Open library"
            data-tutorial-id="dashboards-button"
            data-onboarding-id="topnav-dashboards"
            sx={{
              color: 'foreground.contrastPrimary',
              width: 44,
              height: 44,
            }}
          >
            <AutoStoriesIcon />
          </IconButton>
        ) : (
          <ButtonWithLabel
            icon={<AutoStoriesIcon />}
            label={'Library'}
            onClick={handleMenuOpen}
            data-tutorial-id="dashboards-button"
            data-onboarding-id="topnav-dashboards"
          />
        )
      ) : (
        <Button
          onClick={handleMenuOpen}
          sx={{
            color: 'foreground.contrastPrimary',
            display: 'flex',
            alignItems: 'center',
            minWidth: 'auto',
            mx: 1,
            px: 2,
          }}
          startIcon={<AutoStoriesIcon />}
          endIcon={<KeyboardArrowDownIcon />}
          data-tutorial-id="dashboards-button"
          data-onboarding-id="topnav-dashboards"
        >
          Library
        </Button>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            color: 'text.primary',
            width: '250px',
            boxShadow: 3,
            border: 1,
            borderColor: 'divider',
          },
        }}
      >
        {studyPathGroups.length > 0 && (
          <Box component="div">
            <Typography
              component="div"
              sx={{
                px: 2,
                py: 0.7,
                fontWeight: 800,
                mt: 0.5,
                color: studyGuideHeaderColor,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: studyGuideHeaderBackground,
                borderLeft: '4px solid',
                borderLeftColor: studyGuideHeaderColor,
              }}
            >
              <AutoStoriesIcon
                fontSize="small"
                sx={{ color: studyGuideHeaderColor }}
              />
              <Box
                component="span"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('studyGuides.title')}
              </Box>
            </Typography>
            {studyPathGroups.map((group) => {
              const { folderName, dashboards, studyPath } = group
              const folderColor = getFolderColor(folderName, dashboards)
              const isExpanded = expandedStudyPathFolders.includes(folderName)

              return (
                <React.Fragment key={group.id}>
                  <Box
                    component="div"
                    role="button"
                    tabIndex={0}
                    onClick={() => openStudyPathGroup(group)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openStudyPathGroup(group)
                      }
                    }}
                    sx={{
                      px: 1,
                      py: 0.65,
                      fontWeight: 'bold',
                      mt: 0.75,
                      color: 'text.primary',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      bgcolor: `${folderColor}24`,
                      borderLeft: '4px solid',
                      borderLeftColor: folderColor,
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: `${folderColor}30`,
                      },
                    }}
                  >
                    <Tooltip
                      title={isExpanded ? 'Collapse lessons' : 'Expand lessons'}
                    >
                      <IconButton
                        size="small"
                        aria-label={`${
                          isExpanded ? 'Collapse' : 'Expand'
                        } ${folderName} lessons`}
                        onClick={(event) =>
                          toggleStudyPathExpanded(event, folderName)
                        }
                        sx={{ color: folderColor, p: 0.25 }}
                      >
                        {isExpanded ? (
                          <ExpandMoreIcon fontSize="small" />
                        ) : (
                          <ChevronRightIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <AutoStoriesIcon
                      fontSize="small"
                      sx={{
                        color: folderColor,
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.24))',
                      }}
                    />
                    <Box
                      component="span"
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {studyPath.title || folderName}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', lineHeight: 1.1 }}
                      >
                        {studyPath.dashboards.length} lessons
                      </Typography>
                    </Box>
                    <Tooltip title={`Manage ${folderName} in Library`}>
                      <IconButton
                        size="small"
                        aria-label={`Manage ${folderName} in Library`}
                        onClick={(event) =>
                          openSavedDashboardsForFolder(event, folderName)
                        }
                        sx={{ color: folderColor, p: 0.5 }}
                      >
                        <AutoStoriesIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {isExpanded &&
                    studyPath.dashboards.map((lesson, index) => (
                      <MenuItem
                        key={lesson.dashboardKey}
                        onClick={() =>
                          openStudyPathLessonInNewTab(group, index)
                        }
                        sx={{
                          py: 1,
                          pl: 5.5,
                          pr: 2,
                          bgcolor: getFolderItemBackground(folderColor),
                          '&:hover': {
                            bgcolor: getFolderItemHoverBackground(folderColor),
                          },
                        }}
                      >
                        <ListItemText
                          primary={`${String(index + 1).padStart(2, '0')} ${
                            lesson.name
                          }`}
                          primaryTypographyProps={{
                            variant: 'body2',
                            noWrap: true,
                          }}
                        />
                      </MenuItem>
                    ))}
                  <Divider sx={{ borderColor: 'divider' }} />
                </React.Fragment>
              )
            })}
          </Box>
        )}

        {quickCreateFolders.length > 0 && (
          <Box component="div">
            <Typography
              component="div"
              sx={{
                px: 2,
                py: 0.7,
                fontWeight: 800,
                mt: 0.5,
                color: quickCreateHeaderColor,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: quickCreateHeaderBackground,
                borderLeft: '4px solid',
                borderLeftColor: quickCreateHeaderColor,
              }}
            >
              <AutoAwesomeIcon
                fontSize="small"
                sx={{ color: quickCreateHeaderColor }}
              />
              <Box
                component="span"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                Quick Create Results
              </Box>
            </Typography>
            {quickCreateFolders.map(([folderName, dashboards]) => {
              const folderColor = getFolderColor(folderName, dashboards)
              const orderedDashboards = [...dashboards].reverse()
              const isFolderExpanded =
                expandedDashboardFolders.includes(folderName)
              const visibleDashboards = isFolderExpanded
                ? orderedDashboards
                : orderedDashboards.slice(0, MAX_MENU_ITEMS_PER_FOLDER)

              return (
                <React.Fragment key={folderName}>
                  <Typography
                    component="div"
                    role="button"
                    tabIndex={0}
                    onClick={() => loadDashboardFolder(dashboards)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        loadDashboardFolder(dashboards)
                      }
                    }}
                    sx={{
                      px: 2,
                      py: 0.6,
                      fontWeight: 'bold',
                      mt: 0.75,
                      color: 'text.primary',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      bgcolor: `${folderColor}24`,
                      borderLeft: '4px solid',
                      borderLeftColor: folderColor,
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: `${folderColor}30`,
                      },
                    }}
                  >
                    <AutoAwesomeIcon
                      fontSize="small"
                      sx={{
                        color: folderColor,
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.24))',
                      }}
                    />
                    <Box
                      component="span"
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {folderName}
                    </Box>
                    <Tooltip title={`Show ${folderName} in Library`}>
                      <IconButton
                        size="small"
                        aria-label={`Show ${folderName} in Library`}
                        onClick={(event) =>
                          openSavedDashboardsForFolder(event, folderName)
                        }
                        sx={{
                          color: folderColor,
                          p: 0.5,
                          '&:hover': {
                            bgcolor: `${folderColor}22`,
                          },
                        }}
                      >
                        <DashboardIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Typography>
                  <Divider sx={{ borderColor: 'divider' }} />
                  {visibleDashboards.map((dashboard) => (
                    <MenuItem
                      key={dashboard.id}
                      data-onboarding-id="topnav-saved-dashboard"
                      data-dashboard-id={dashboard.id}
                      onClick={() => loadCustomDashboard(dashboard)}
                      sx={{
                        p: 1.5,
                        bgcolor: getFolderItemBackground(folderColor),
                        '&:hover': {
                          bgcolor: getFolderItemHoverBackground(folderColor),
                        },
                      }}
                    >
                      <ListItemText
                        primary={dashboard.name}
                        primaryTypographyProps={{ noWrap: true }}
                      />
                    </MenuItem>
                  ))}
                  {!isFolderExpanded &&
                    dashboards.length > MAX_MENU_ITEMS_PER_FOLDER && (
                      <MenuItem
                        onClick={(event) =>
                          showAllDashboardsForFolder(event, folderName)
                        }
                        sx={{
                          p: 1.5,
                          fontWeight: 700,
                          bgcolor: getFolderItemBackground(folderColor),
                          '&:hover': {
                            bgcolor: getFolderItemHoverBackground(folderColor),
                          },
                        }}
                      >
                        ... Show all {dashboards.length}
                      </MenuItem>
                    )}
                </React.Fragment>
              )
            })}
          </Box>
        )}

        {customDashboardFolders.length > 0 && (
          <Box component="div">
            <Typography
              component="div"
              sx={{
                px: 2,
                py: 0.7,
                fontWeight: 800,
                mt: 0.75,
                color: customDashboardHeaderColor,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: customDashboardHeaderBackground,
                borderLeft: '4px solid',
                borderLeftColor: customDashboardHeaderColor,
              }}
            >
              Custom Dashboards
            </Typography>
            {customDashboardFolders.map(([folderName, dashboards]) => {
              const folderColor = getFolderColor(folderName, dashboards)
              const nonStudyDashboards = dashboards.filter(
                (dashboard) => !isQuickCreateDashboard(dashboard),
              )
              const orderedNonStudyDashboards = [
                ...nonStudyDashboards,
              ].reverse()
              const isFolderExpanded =
                expandedDashboardFolders.includes(folderName)
              const visibleNonStudyDashboards = isFolderExpanded
                ? orderedNonStudyDashboards
                : orderedNonStudyDashboards.slice(0, MAX_MENU_ITEMS_PER_FOLDER)

              return (
                <React.Fragment key={folderName}>
                  <Typography
                    component="div"
                    role="button"
                    tabIndex={0}
                    onClick={() => loadDashboardFolder(nonStudyDashboards)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        loadDashboardFolder(nonStudyDashboards)
                      }
                    }}
                    sx={{
                      px: 2,
                      py: 0.6,
                      fontWeight: 'bold',
                      mt: 0.75,
                      color: 'text.primary',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      bgcolor: `${folderColor}24`,
                      borderLeft: '4px solid',
                      borderLeftColor: folderColor,
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: `${folderColor}30`,
                      },
                    }}
                  >
                    <DashboardIcon
                      fontSize="small"
                      sx={{
                        color: folderColor,
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.24))',
                      }}
                    />
                    <Box
                      component="span"
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {folderName}
                    </Box>
                    <Tooltip title={`Show ${folderName} in Library`}>
                      <IconButton
                        size="small"
                        aria-label={`Show ${folderName} in Library`}
                        onClick={(event) =>
                          openSavedDashboardsForFolder(event, folderName)
                        }
                        sx={{
                          color: folderColor,
                          p: 0.5,
                          '&:hover': {
                            bgcolor: `${folderColor}22`,
                          },
                        }}
                      >
                        <DashboardIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Typography>
                  <Divider sx={{ borderColor: 'divider' }} />
                  {visibleNonStudyDashboards.map((dashboard) => (
                    <MenuItem
                      key={dashboard.id}
                      data-onboarding-id="topnav-saved-dashboard"
                      data-dashboard-id={dashboard.id}
                      onClick={() => loadCustomDashboard(dashboard)}
                      sx={{
                        p: 1.5,
                        bgcolor: getFolderItemBackground(folderColor),
                        '&:hover': {
                          bgcolor: getFolderItemHoverBackground(folderColor),
                        },
                      }}
                    >
                      <ListItemText
                        primary={dashboard.name}
                        primaryTypographyProps={{ noWrap: true }}
                      />
                    </MenuItem>
                  ))}
                  {!isFolderExpanded &&
                    nonStudyDashboards.length > MAX_MENU_ITEMS_PER_FOLDER && (
                      <MenuItem
                        onClick={(event) =>
                          showAllDashboardsForFolder(event, folderName)
                        }
                        sx={{
                          p: 1.5,
                          fontWeight: 700,
                          bgcolor: getFolderItemBackground(folderColor),
                          '&:hover': {
                            bgcolor: getFolderItemHoverBackground(folderColor),
                          },
                        }}
                      >
                        ... Show all {nonStudyDashboards.length}
                      </MenuItem>
                    )}
                </React.Fragment>
              )
            })}
          </Box>
        )}
        {isPhone && !hasVisibleLibraryItems && (
          <MenuItem
            disabled
            sx={{
              p: 1.5,
              opacity: 1,
              justifyContent: 'center',
              whiteSpace: 'normal',
              textAlign: 'center',
            }}
          >
            No study guides or dashboards yet
          </MenuItem>
        )}
        {!isPhone && !hasVisibleLibraryItems && (
          <MenuItem
            disabled
            sx={{
              p: 1.5,
              opacity: 1,
              justifyContent: 'center',
              whiteSpace: 'normal',
              textAlign: 'center',
            }}
          >
            No study guides or dashboards yet
          </MenuItem>
        )}
      </Menu>
    </>
  )
}

export default DashboardOptionsMenu
