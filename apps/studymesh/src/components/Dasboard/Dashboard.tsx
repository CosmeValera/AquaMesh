import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Drawer,
  TextField,
  IconButton,
  FormControlLabel,
  ListItemIcon,
  Menu,
  MenuItem,
  Switch,
  Chip,
  Paper,
  Stack,
  Autocomplete,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Tabs, TabList, TabPanel } from 'react-tabs'
import TooltipStyled from '../TooltipStyled'

import { ReactComponent as CloseIcon } from '../../icons/close.svg'
import SaveIcon from '@mui/icons-material/Save'
import ConstructionIcon from '@mui/icons-material/Construction'
import EditIcon from '@mui/icons-material/Edit'
import ExtensionIcon from '@mui/icons-material/Extension'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import DashboardLayoutView from '../Layout/Layout'
import { useLayout } from '../Layout/LayoutProvider'
import { DashboardLayout, StateDashboard } from '../../state/store'
import { useDashboards } from './DashboardProvider'
import SavedDashboardsDialog from './DashboardLibrary'
import StudyPathWorkspaceView from './StudyPathWorkspaceView'
import DashboardChatPanel, {
  DashboardChatMessage,
} from '../dashboardChat/DashboardChatPanel'
import {
  createStudyPathContainerState,
  getStudyPathMetaFromLayout,
} from './studyPathContainer'
import useTopNavBarWidgets from '../../customHooks/useTopNavBarWidgets'
import {
  ensureStarterDashboards,
  OPEN_DASHBOARD_EDITOR_EVENT,
  OPEN_WIDGET_EDITOR_EVENT,
  STARTER_STUDY_PATH_FOLDER_NAME,
} from '../../customHooks/useWorkspaceActions'
import {
  DEFAULT_FOLDER_COLOR,
  FOLDER_COLOR_PRESETS,
  normalizeFolderColor,
  normalizeFolderName,
} from './folderColors'
import { OPEN_STUDY_PATH_REVIEW_DASHBOARD_EVENT } from '../../studyPack/progress'
import {
  CLOSE_CREATE_STUDIO_EVENT,
  CLOSE_DASHBOARD_CHAT_EVENT,
  OPEN_DASHBOARD_CHAT_EVENT,
  WORKSPACE_DASHBOARD_TABS_SLOT_ID,
} from '../workspace/workspaceEvents'
import { useResponsiveWorkspaceMode } from '../workspace/useResponsiveWorkspaceMode'
import { dispatchWorkspaceOnboardingEvent } from '../onboarding/onboardingEvents'
import { DashboardEditorResponsivePanels } from './DashboardEditorResponsivePanels'
import type { DashboardEditorWidgetConfig } from './dashboardEditorTypes'
import DashboardEmptyState from './DashboardEmptyState'
import DashboardTabsBar from './DashboardTabsBar'
import {
  collectDashboardWidgetTabs,
  countDashboardNodes,
  createDashboardTabFromWidget,
  createLayoutWithComponent,
  createMobileOrderedWidgetLayout,
  hasDashboardContent,
} from './dashboardLayoutUtils'
import {
  DashboardStorage,
  DEFAULT_DASHBOARD_NAME,
  SAVED_DASHBOARDS_CHANGED_EVENT,
  getUniqueDashboardName,
  type SavedDashboard,
} from './dashboardStorage'
import './tabs.scss'
const DEFAULT_STUDY_PATH_OPENED_KEY = 'studymesh-default-study-path-opened-v1'
const USER_ROLE_CHANGED_EVENT = 'studymesh-user-role-changed'
const OPEN_SAVED_DASHBOARDS_EVENT = 'studymesh-open-saved-dashboards'

const readCurrentUserIsAdmin = () => {
  try {
    const userData = localStorage.getItem('userData')
    if (!userData) {
      return false
    }

    const parsedData = JSON.parse(userData)
    return parsedData.role === 'ADMIN_ROLE'
  } catch (error) {
    console.error('Failed to parse user data', error)
    return false
  }
}

const Dashboards = () => {
  const {
    theme,
    isPhone,
    isPhoneOrTablet: isMobileDashboardView,
  } = useResponsiveWorkspaceMode()
  const {
    openDashboards,
    selectedDashboard,
    setSelectedDashboard,
    removeDashboard,
    closeAllDashboards,
    closeOtherDashboards,
    closeDashboardsToRight,
    reorderDashboard,
    addDashboard,
    addDashboards,
    addStudyPathContainer,
    updateStudyPathContainer,
    replaceDashboard,
    updateLayout,
    updateDashboardLayout,
    renameDashboard,
    setDashboardEditing,
  } = useDashboards()

  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [dashboardName, setDashboardName] = useState('')
  const [dashboardFolder, setDashboardFolder] = useState('Default')
  const [dashboardFolderColor, setDashboardFolderColor] =
    useState(DEFAULT_FOLDER_COLOR)
  const [dashboardDescription, setDashboardDescription] = useState('')
  const [dashboardTags, setDashboardTags] = useState<string[]>([])
  const [isPublic, setIsPublic] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [currentTabIndex, setCurrentTabIndex] = useState<number | null>(null)
  const [dashboardTabMenu, setDashboardTabMenu] = useState<{
    mouseX: number
    mouseY: number
    tabIndex: number
  } | null>(null)
  const [draggedDashboardIndex, setDraggedDashboardIndex] = useState<
    number | null
  >(null)
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({})
  const [isAdmin, setIsAdmin] = useState(readCurrentUserIsAdmin)
  const [dashboardOptions, setDashboardOptions] = useState<SavedDashboard[]>([])
  const [dashboardEditorId, setDashboardEditorId] = useState<string | null>(
    null,
  )
  const [draftDashboard, setDraftDashboard] = useState<{
    id: string
    name: string
    layout: DashboardLayout
    savedDashboardId?: string
  } | null>(null)
  const [isEditingDashboardEditorTitle, setIsEditingDashboardEditorTitle] =
    useState(false)
  const [dashboardEditorTitleInput, setDashboardEditorTitleInput] = useState('')
  const [dashboardWidgetsAnchorEl, setDashboardWidgetsAnchorEl] =
    useState<null | HTMLElement>(null)
  const [dashboardLibraryOpen, setDashboardLibraryOpen] = useState(false)
  const [dashboardLibraryInitialSearch, setDashboardLibraryInitialSearch] =
    useState('')
  const [dashboardLibraryInitialFolder, setDashboardLibraryInitialFolder] =
    useState('')
  const [dashboardLibraryMode, setDashboardLibraryMode] = useState<
    'workspace' | 'builder'
  >('workspace')
  const [dashboardChatOpen, setDashboardChatOpen] = useState(false)
  const [workspaceTabsSlot, setWorkspaceTabsSlot] =
    useState<HTMLElement | null>(null)
  const [dashboardChatWidth, setDashboardChatWidth] = useState(420)
  const [dashboardChatMessages, setDashboardChatMessages] = useState<
    Record<string, DashboardChatMessage[]>
  >({})
  const [
    dashboardLibraryInitialSearchKey,
    setDashboardLibraryInitialSearchKey,
  ] = useState(0)
  const dashboardEditorTitleCancelRef = useRef(false)
  const dashboardPanelRefs = useRef<Record<string, HTMLElement | null>>({})
  const dashboardScrollPositionsRef = useRef<
    Record<string, Array<{ top: number; left: number }>>
  >({})
  const pendingScrollRestoreDashboardIdRef = useRef<string | null>(null)

  const getDashboardScrollableElements = (root: HTMLElement) => {
    const descendants = Array.from(root.querySelectorAll<HTMLElement>('*'))
    return [root, ...descendants].filter((element) => {
      const style = window.getComputedStyle(element)
      const canScrollY =
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        element.scrollHeight > element.clientHeight
      const canScrollX =
        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        element.scrollWidth > element.clientWidth

      return canScrollY || canScrollX || element.scrollTop > 0
    })
  }

  const saveDashboardScrollPosition = (dashboardId?: string) => {
    if (!dashboardId) {
      return
    }

    const panel = dashboardPanelRefs.current[dashboardId]
    if (!panel) {
      return
    }

    dashboardScrollPositionsRef.current[dashboardId] =
      getDashboardScrollableElements(panel).map((element) => ({
        top: element.scrollTop,
        left: element.scrollLeft,
      }))
  }

  const restoreDashboardScrollPosition = (dashboardId?: string) => {
    if (!dashboardId) {
      return
    }

    pendingScrollRestoreDashboardIdRef.current = dashboardId
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (pendingScrollRestoreDashboardIdRef.current !== dashboardId) {
          return
        }

        const panel = dashboardPanelRefs.current[dashboardId]
        const positions = dashboardScrollPositionsRef.current[dashboardId]
        if (!panel || !positions?.length) {
          return
        }

        getDashboardScrollableElements(panel).forEach((element, index) => {
          const position = positions[index]
          if (position) {
            element.scrollTo({
              top: position.top,
              left: position.left,
              behavior: 'auto',
            })
          }
        })
      })
    })
  }

  useEffect(() => {
    const openDashboardChat = () => {
      window.dispatchEvent(new Event(CLOSE_CREATE_STUDIO_EVENT))
      setDashboardChatOpen(true)
    }
    const closeDashboardChat = () => setDashboardChatOpen(false)

    window.addEventListener(OPEN_DASHBOARD_CHAT_EVENT, openDashboardChat)
    window.addEventListener(CLOSE_DASHBOARD_CHAT_EVENT, closeDashboardChat)

    return () => {
      window.removeEventListener(OPEN_DASHBOARD_CHAT_EVENT, openDashboardChat)
      window.removeEventListener(CLOSE_DASHBOARD_CHAT_EVENT, closeDashboardChat)
    }
  }, [])

  useEffect(() => {
    if (isMobileDashboardView) {
      setWorkspaceTabsSlot(null)
      return undefined
    }

    let animationFrameId = 0
    let timeoutId = 0

    const refreshWorkspaceTabsSlot = () => {
      const slot = document.getElementById(WORKSPACE_DASHBOARD_TABS_SLOT_ID)
      setWorkspaceTabsSlot(slot)

      if (!slot) {
        animationFrameId = window.requestAnimationFrame(() => {
          setWorkspaceTabsSlot(
            document.getElementById(WORKSPACE_DASHBOARD_TABS_SLOT_ID),
          )
        })
      }
    }

    refreshWorkspaceTabsSlot()
    timeoutId = window.setTimeout(refreshWorkspaceTabsSlot, 0)
    window.addEventListener('resize', refreshWorkspaceTabsSlot)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.clearTimeout(timeoutId)
      window.removeEventListener('resize', refreshWorkspaceTabsSlot)
    }
  }, [isMobileDashboardView])

  const startDashboardChatResize = (
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = dashboardChatWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(
        360,
        Math.min(620, startWidth + startX - moveEvent.clientX),
      )
      setDashboardChatWidth(nextWidth)
    }

    const stopResize = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopResize)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopResize)
  }

  const dashboardChatRailWidth = 58
  const { addComponent } = useLayout()
  const { topNavBarWidgets } = useTopNavBarWidgets()
  const currentDashboard = openDashboards[selectedDashboard]
  const selectedDashboardIsStudyPath = Boolean(
    currentDashboard?.kind === 'studyPathContainer' &&
      currentDashboard.studyPath,
  )
  const selectedDashboardIsEmpty =
    !selectedDashboardIsStudyPath &&
    !hasDashboardContent(currentDashboard?.layout)

  const selectDashboardAndRestoreScroll = (index: number) => {
    const currentDashboardId = openDashboards[selectedDashboard]?.id
    const nextDashboardId = openDashboards[index]?.id
    saveDashboardScrollPosition(currentDashboardId)
    setSelectedDashboard(index)
    restoreDashboardScrollPosition(nextDashboardId)
  }
  const dashboardEditorIndex = dashboardEditorId
    ? openDashboards.findIndex(
        (dashboard) => dashboard.id === dashboardEditorId,
      )
    : -1
  const dashboardEditorDashboard =
    draftDashboard ||
    (dashboardEditorIndex >= 0 ? openDashboards[dashboardEditorIndex] : null)
  const dashboardEditorIsDraft = Boolean(draftDashboard)
  const dashboardEditorIsEmpty = !hasDashboardContent(
    dashboardEditorDashboard?.layout,
  )
  const customWidgetPanels = topNavBarWidgets.filter((widget) =>
    widget.name.includes('Custom'),
  )
  const dashboardEditorWidgetTabs = useMemo(
    () => collectDashboardWidgetTabs(dashboardEditorDashboard?.layout),
    [dashboardEditorDashboard?.layout],
  )
  const savedDashboardsLabel = isPhone ? 'Saved' : 'Saved Dashboards'
  const visibleDashboardOptions = isAdmin
    ? dashboardOptions
    : dashboardOptions.filter((dashboard) => dashboard.isPublic)
  const dashboardFolderOptions = useMemo(
    () =>
      Array.from(
        new Set(
          dashboardOptions.map((dashboard) =>
            normalizeFolderName(dashboard.folder),
          ),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [dashboardOptions],
  )
  const getFolderColorForDetailsInput = (folder: string) => {
    const normalizedFolder = normalizeFolderName(folder)

    if (!folder.trim()) {
      return DashboardStorage.getFolderColor('Default')
    }

    if (dashboardFolderOptions.includes(normalizedFolder)) {
      return DashboardStorage.getFolderColor(normalizedFolder)
    }

    const currentColor = normalizeFolderColor(dashboardFolderColor)
    const availableColors = FOLDER_COLOR_PRESETS.filter(
      (color) => color !== currentColor,
    )
    const nextColors =
      availableColors.length > 0 ? availableColors : FOLDER_COLOR_PRESETS

    return nextColors[Math.floor(Math.random() * nextColors.length)]
  }

  const loadDashboardOptions = () => {
    ensureStarterDashboards()
    setDashboardOptions([...DashboardStorage.getAll()].reverse())
  }

  const openDashboardEditor = (dashboardId: string) => {
    if (!isAdmin) {
      return
    }

    setDraftDashboard(null)
    const dashboardIndex = openDashboards.findIndex(
      (dashboard) => dashboard.id === dashboardId,
    )

    if (dashboardIndex >= 0) {
      setSelectedDashboard(dashboardIndex)
    }

    setDashboardEditing(dashboardId, true)
    setDashboardEditorId(dashboardId)
    dispatchWorkspaceOnboardingEvent({ type: 'dashboard-editor-opened' })
  }

  const openStudyPathDashboardEditor = (dashboard: StateDashboard) => {
    if (!isAdmin || !dashboard.studyPath) {
      return
    }

    const selectedLessonIndex = Math.min(
      Math.max(dashboard.studyPath.selectedIndex || 0, 0),
      Math.max(dashboard.studyPath.dashboards.length - 1, 0),
    )
    const selectedLesson = dashboard.studyPath.dashboards[selectedLessonIndex]

    if (!selectedLesson) {
      return
    }

    setDashboardEditorId(null)
    setDraftDashboard({
      id: `draft-dashboard-${Date.now()}`,
      name: selectedLesson.name,
      layout: selectedLesson.layout,
      savedDashboardId: selectedLesson.id,
    })
    dispatchWorkspaceOnboardingEvent({ type: 'dashboard-editor-opened' })
  }

  const createDashboardInEditor = () => {
    if (!isAdmin) {
      return
    }

    setDashboardEditorId(null)
    setDraftDashboard({
      id: `draft-dashboard-${Date.now()}`,
      name: DEFAULT_DASHBOARD_NAME,
      layout: {
        type: 'row',
        weight: 100,
        children: [],
      },
    })
    dispatchWorkspaceOnboardingEvent({ type: 'dashboard-editor-opened' })
  }

  const updateDashboardChatMessages = (
    dashboard: StateDashboard | undefined,
    messages: DashboardChatMessage[],
  ) => {
    if (!dashboard) {
      return
    }

    setDashboardChatMessages((current) => ({
      ...current,
      [dashboard.id]: messages,
    }))
  }

  const loadSavedDashboardInBuilder = (dashboard: SavedDashboard) => {
    setDashboardEditorId(null)
    setDraftDashboard({
      id: `draft-dashboard-${Date.now()}`,
      name: dashboard.name,
      layout: dashboard.layout,
      savedDashboardId: dashboard.id,
    })
    loadDashboardOptions()
  }

  const createEmptyDashboardTab = () => {
    addDashboard()
  }

  const openSavedDashboardInWorkspace = (dashboard: SavedDashboard) => {
    if (openDashboards[selectedDashboard] && selectedDashboardIsEmpty) {
      replaceDashboard(selectedDashboard, {
        name: dashboard.name,
        layout: dashboard.layout,
      })
      dispatchWorkspaceOnboardingEvent({
        type: 'saved-dashboard-opened',
        dashboardId: dashboard.id,
        dashboardName: dashboard.name,
      })
      return
    }

    addDashboard({
      name: dashboard.name,
      layout: dashboard.layout,
    })
    dispatchWorkspaceOnboardingEvent({
      type: 'saved-dashboard-opened',
      dashboardId: dashboard.id,
      dashboardName: dashboard.name,
    })
  }

  const openSavedDashboardFromLibrary = (dashboard: SavedDashboard) => {
    openSavedDashboardInWorkspace(dashboard)
    closeDashboardEditor()
  }

  const openSavedDashboardFromEmptyState = (dashboard: SavedDashboard) => {
    addDashboard({
      name: dashboard.name,
      layout: dashboard.layout,
    })
    dispatchWorkspaceOnboardingEvent({
      type: 'saved-dashboard-opened',
      dashboardId: dashboard.id,
      dashboardName: dashboard.name,
    })
  }

  const openStudyGuideFromEmptyState = (dashboards: SavedDashboard[]) => {
    const studyPath = createStudyPathContainerState(dashboards)

    if (studyPath) {
      addStudyPathContainer(studyPath)
      dispatchWorkspaceOnboardingEvent({ type: 'saved-dashboard-opened' })
    }
  }

  const openSavedLibraryFromEmptyState = () => {
    setDashboardLibraryInitialSearch('')
    setDashboardLibraryInitialFolder('')
    setDashboardLibraryMode('workspace')
    setDashboardLibraryInitialSearchKey((currentKey) => currentKey + 1)
    setDashboardLibraryOpen(true)
  }

  const closeDashboardEditor = () => {
    if (dashboardEditorIsDraft) {
      setDraftDashboard(null)
    } else if (dashboardEditorId) {
      setDashboardEditing(dashboardEditorId, false)
    }

    setDashboardWidgetsAnchorEl(null)
    setIsEditingDashboardEditorTitle(false)
    setDashboardEditorId(null)
    dispatchWorkspaceOnboardingEvent({ type: 'dashboard-editor-closed' })
  }

  const updateDashboardEditorTitle = (nextName: string) => {
    const trimmedName = nextName.trim()

    if (!trimmedName || !dashboardEditorDashboard) {
      setDashboardEditorTitleInput(dashboardEditorDashboard?.name || '')
      setIsEditingDashboardEditorTitle(false)
      return
    }

    if (dashboardEditorIsDraft) {
      setDraftDashboard((currentDraft) =>
        currentDraft ? { ...currentDraft, name: trimmedName } : currentDraft,
      )
    } else if (dashboardEditorDashboard.id) {
      renameDashboard(dashboardEditorDashboard.id, trimmedName)
      if (dashboardEditorIndex >= 0) {
        setHasChanges((prev) => ({
          ...prev,
          [dashboardEditorIndex]: true,
        }))
      }
    }

    setDashboardName((currentName) =>
      currentName === dashboardEditorDashboard.name ? trimmedName : currentName,
    )
    setDashboardEditorTitleInput(trimmedName)
    setIsEditingDashboardEditorTitle(false)
  }

  const handleDashboardEditorTitleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      updateDashboardEditorTitle(dashboardEditorTitleInput)
    }

    if (event.key === 'Escape') {
      dashboardEditorTitleCancelRef.current = true
      setDashboardEditorTitleInput(dashboardEditorDashboard?.name || '')
      setIsEditingDashboardEditorTitle(false)
    }
  }

  const handleDashboardEditorTitleBlur = () => {
    if (dashboardEditorTitleCancelRef.current) {
      dashboardEditorTitleCancelRef.current = false
      return
    }

    updateDashboardEditorTitle(dashboardEditorTitleInput)
  }

  const updateDashboardEditorLayout = (nextLayout: DashboardLayout) => {
    if (dashboardEditorIsDraft) {
      setDraftDashboard((currentDraft) =>
        currentDraft ? { ...currentDraft, layout: nextLayout } : currentDraft,
      )
      return
    }

    if (dashboardEditorIndex >= 0) {
      updateDashboardLayout(dashboardEditorIndex, nextLayout)
      setHasChanges((prev) => ({
        ...prev,
        [dashboardEditorIndex]: true,
      }))
    }
  }

  const updateMobileDashboardWidgetOrder = (nextTabs: DashboardLayout[]) => {
    const nextLayout = createMobileOrderedWidgetLayout(nextTabs)
    updateDashboardEditorLayout(nextLayout)
    dispatchWorkspaceOnboardingEvent({
      type: 'dashboard-layout-changed',
      ...countDashboardNodes(nextLayout),
    })
  }

  const moveMobileDashboardWidget = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction

    if (targetIndex < 0 || targetIndex >= dashboardEditorWidgetTabs.length) {
      return
    }

    const nextTabs = [...dashboardEditorWidgetTabs]
    const [movedTab] = nextTabs.splice(index, 1)
    nextTabs.splice(targetIndex, 0, movedTab)
    updateMobileDashboardWidgetOrder(nextTabs)
  }

  const removeMobileDashboardWidget = (index: number) => {
    updateMobileDashboardWidgetOrder(
      dashboardEditorWidgetTabs.filter((_, tabIndex) => tabIndex !== index),
    )
  }

  const addWidgetToDashboardEditor = (
    item: DashboardEditorWidgetConfig & { id?: string },
  ) => {
    if (!isAdmin) {
      return
    }

    if (!dashboardEditorDashboard) {
      return
    }

    if (isMobileDashboardView) {
      const nextLayout = createMobileOrderedWidgetLayout([
        ...collectDashboardWidgetTabs(dashboardEditorDashboard.layout),
        createDashboardTabFromWidget(item),
      ])
      const counts = countDashboardNodes(nextLayout)

      updateDashboardEditorLayout(nextLayout)
      dispatchWorkspaceOnboardingEvent({
        type: 'saved-widget-added',
        widgetId:
          typeof item.customProps?.widgetId === 'string'
            ? item.customProps.widgetId
            : item.id,
        widgetName: item.name,
        ...counts,
      })
      dispatchWorkspaceOnboardingEvent({
        type: 'dashboard-layout-changed',
        ...counts,
      })
      return
    }

    if (dashboardEditorIsEmpty) {
      const nextLayout = createLayoutWithComponent(item)
      const counts = countDashboardNodes(nextLayout)

      updateDashboardEditorLayout(nextLayout)

      dispatchWorkspaceOnboardingEvent({
        type: 'saved-widget-added',
        widgetId:
          typeof item.customProps?.widgetId === 'string'
            ? item.customProps.widgetId
            : item.id,
        widgetName: item.name,
        ...counts,
      })
      dispatchWorkspaceOnboardingEvent({
        type: 'dashboard-layout-changed',
        ...counts,
      })

      return
    }

    addComponent(item)
    setTimeout(() => {
      const counts = countDashboardNodes(dashboardEditorDashboard.layout)
      const nextCounts = {
        tabCount: Math.max(2, counts.tabCount + 1),
        tabsetCount: Math.max(1, counts.tabsetCount),
      }
      dispatchWorkspaceOnboardingEvent({
        type: 'saved-widget-added',
        widgetId:
          typeof item.customProps?.widgetId === 'string'
            ? item.customProps.widgetId
            : item.id,
        widgetName: item.name,
        ...nextCounts,
      })
      dispatchWorkspaceOnboardingEvent({
        type: 'dashboard-layout-changed',
        ...nextCounts,
      })
    }, 0)
  }

  const handleDashboardWidgetsMenuOpen = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (!isAdmin) {
      return
    }

    setDashboardWidgetsAnchorEl(event.currentTarget)
    dispatchWorkspaceOnboardingEvent({ type: 'widgets-menu-opened' })
  }

  const handleDashboardWidgetsMenuClose = () => {
    setDashboardWidgetsAnchorEl(null)
  }

  const handleCreateWidgetFromDashboardEditor = () => {
    if (!isAdmin) {
      return
    }

    handleDashboardWidgetsMenuClose()
    window.dispatchEvent(new CustomEvent(OPEN_WIDGET_EDITOR_EVENT))
  }

  // Check if user is admin on component mount
  useEffect(() => {
    const readUserRole = () => {
      const nextIsAdmin = readCurrentUserIsAdmin()
      setIsAdmin(nextIsAdmin)
      if (!nextIsAdmin) {
        closeDashboardEditor()
      }
    }

    readUserRole()
    window.addEventListener(USER_ROLE_CHANGED_EVENT, readUserRole)

    return () => {
      window.removeEventListener(USER_ROLE_CHANGED_EVENT, readUserRole)
    }
  }, [dashboardEditorId, dashboardEditorIsDraft])

  useEffect(() => {
    loadDashboardOptions()

    window.addEventListener(
      SAVED_DASHBOARDS_CHANGED_EVENT,
      loadDashboardOptions,
    )
    window.addEventListener('focus', loadDashboardOptions)

    return () => {
      window.removeEventListener(
        SAVED_DASHBOARDS_CHANGED_EVENT,
        loadDashboardOptions,
      )
      window.removeEventListener('focus', loadDashboardOptions)
    }
  }, [])

  useEffect(() => {
    if (window.localStorage.getItem(DEFAULT_STUDY_PATH_OPENED_KEY) === 'true') {
      return
    }

    ensureStarterDashboards()

    const starterDashboards = DashboardStorage.getAll().filter(
      (dashboard) => dashboard.folder === STARTER_STUDY_PATH_FOLDER_NAME,
    )
    const studyPath = createStudyPathContainerState(starterDashboards)

    if (!studyPath) {
      return
    }

    addStudyPathContainer(studyPath)
    window.localStorage.setItem(DEFAULT_STUDY_PATH_OPENED_KEY, 'true')
  }, [addStudyPathContainer])

  useEffect(() => {
    if (!isEditingDashboardEditorTitle) {
      setDashboardEditorTitleInput(dashboardEditorDashboard?.name || '')
    }
  }, [dashboardEditorDashboard?.name, isEditingDashboardEditorTitle])

  useEffect(() => {
    const handleOpenDashboardEditor = (event: Event) => {
      if (!isAdmin) {
        return
      }

      const customEvent = event as CustomEvent<{
        host?: string
        dashboardId?: string
        dashboard?: SavedDashboard
      }>
      if (customEvent.detail?.host === 'studio') {
        return
      }

      if (customEvent.detail?.dashboardId) {
        openDashboardEditor(customEvent.detail.dashboardId)
        return
      }

      if (customEvent.detail?.dashboard) {
        loadSavedDashboardInBuilder(customEvent.detail.dashboard)
        dispatchWorkspaceOnboardingEvent({ type: 'dashboard-editor-opened' })
        return
      }

      createDashboardInEditor()
    }

    window.addEventListener(
      OPEN_DASHBOARD_EDITOR_EVENT,
      handleOpenDashboardEditor,
    )

    return () => {
      window.removeEventListener(
        OPEN_DASHBOARD_EDITOR_EVENT,
        handleOpenDashboardEditor,
      )
    }
  }, [isAdmin])

  useEffect(() => {
    const handleOpenSavedDashboards = (event: Event) => {
      const customEvent = event as CustomEvent<{
        folderFilter?: string
        searchTerm?: string
      }>

      setDashboardLibraryInitialSearch(customEvent.detail?.searchTerm || '')
      setDashboardLibraryInitialFolder(customEvent.detail?.folderFilter || '')
      setDashboardLibraryMode('workspace')
      setDashboardLibraryInitialSearchKey((currentKey) => currentKey + 1)
      setDashboardLibraryOpen(true)
    }

    window.addEventListener(
      OPEN_SAVED_DASHBOARDS_EVENT,
      handleOpenSavedDashboards,
    )

    return () => {
      window.removeEventListener(
        OPEN_SAVED_DASHBOARDS_EVENT,
        handleOpenSavedDashboards,
      )
    }
  }, [])

  useEffect(() => {
    const handleOpenStudyPathReviewDashboard = (event: Event) => {
      const customEvent = event as CustomEvent<{ dashboard?: SavedDashboard }>
      const dashboard = customEvent.detail?.dashboard

      if (!dashboard) {
        return
      }

      loadDashboardOptions()

      const reviewMeta = getStudyPathMetaFromLayout(dashboard.layout)
      const openStudyPathIndex = reviewMeta
        ? openDashboards.findIndex(
            (openDashboard) =>
              openDashboard.kind === 'studyPathContainer' &&
              openDashboard.studyPath?.pathId === reviewMeta.studyPathId,
          )
        : -1

      if (reviewMeta && openStudyPathIndex >= 0) {
        const openStudyPathDashboard = openDashboards[openStudyPathIndex]

        updateStudyPathContainer(openStudyPathDashboard.id, (studyPath) => {
          const reviewItem = {
            id: dashboard.id,
            name: dashboard.name,
            layout: dashboard.layout,
            dashboardKey: reviewMeta.dashboardKey,
            dashboardIndex: reviewMeta.dashboardIndex,
            dashboardCount: reviewMeta.dashboardCount,
            folderName: reviewMeta.folderName,
          }
          const existingReviewIndex = studyPath.dashboards.findIndex(
            (lesson) => lesson.dashboardKey === reviewItem.dashboardKey,
          )
          const nextDashboards =
            existingReviewIndex >= 0
              ? studyPath.dashboards.map((lesson, index) =>
                  index === existingReviewIndex ? reviewItem : lesson,
                )
              : [...studyPath.dashboards, reviewItem]
          const orderedDashboards = [...nextDashboards].sort(
            (first, second) => first.dashboardIndex - second.dashboardIndex,
          )
          const selectedIndex = Math.max(
            0,
            orderedDashboards.findIndex(
              (lesson) => lesson.dashboardKey === reviewItem.dashboardKey,
            ),
          )

          return {
            ...studyPath,
            dashboards: orderedDashboards,
            selectedIndex,
          }
        })
        setSelectedDashboard(openStudyPathIndex)
        return
      }

      addDashboard({
        name: dashboard.name,
        layout: dashboard.layout,
      })
    }

    window.addEventListener(
      OPEN_STUDY_PATH_REVIEW_DASHBOARD_EVENT,
      handleOpenStudyPathReviewDashboard,
    )

    return () => {
      window.removeEventListener(
        OPEN_STUDY_PATH_REVIEW_DASHBOARD_EVENT,
        handleOpenStudyPathReviewDashboard,
      )
    }
  }, [
    addDashboard,
    openDashboards,
    setSelectedDashboard,
    updateStudyPathContainer,
  ])

  // Check if current dashboards have changes compared to saved dashboards
  useEffect(() => {
    const changes: Record<string, boolean> = {}

    openDashboards.forEach((dashboard, index) => {
      changes[index] = DashboardStorage.hasChanges(
        dashboard.name,
        dashboard.layout,
      )
    })

    setHasChanges(changes)
  }, [openDashboards])

  const getSavedDashboardForEditor = () => {
    if (!dashboardEditorDashboard) {
      return null
    }

    if (dashboardEditorIsDraft) {
      if (!draftDashboard?.savedDashboardId) {
        return null
      }

      return (
        DashboardStorage.getAll().find(
          (dashboard) => dashboard.id === draftDashboard.savedDashboardId,
        ) || null
      )
    }

    return DashboardStorage.getByName(dashboardEditorDashboard.name)
  }

  const dashboardEditorSavedDashboard = getSavedDashboardForEditor()
  const dashboardEditorIsUpdating = Boolean(dashboardEditorSavedDashboard)
  const dashboardEditorHasUnsavedChanges = dashboardEditorSavedDashboard
    ? dashboardEditorDashboard?.name !== dashboardEditorSavedDashboard.name ||
      JSON.stringify(dashboardEditorDashboard?.layout) !==
        JSON.stringify(dashboardEditorSavedDashboard.layout)
    : true

  const populateDashboardDetailsForm = (
    dashboardNameValue: string,
    savedDashboard?: SavedDashboard | null,
  ) => {
    const nextFolder = savedDashboard?.folder || 'Default'

    setDashboardName(dashboardNameValue)
    setDashboardFolder(nextFolder)
    setDashboardFolderColor(
      normalizeFolderColor(
        savedDashboard?.folderColor ||
          DashboardStorage.getFolderColor(nextFolder),
      ),
    )
    setDashboardDescription(savedDashboard?.description || '')
    setDashboardTags(savedDashboard?.tags || ['dashboard'])
    setIsPublic(isAdmin ? Boolean(savedDashboard?.isPublic) : false)
    setTagInput('')
  }

  const handleDashboardDetailsOpen = (index: number) => {
    if (dashboardEditorIsDraft && draftDashboard) {
      if (!hasDashboardContent(draftDashboard.layout)) {
        return
      }

      setCurrentTabIndex(null)
      populateDashboardDetailsForm(
        draftDashboard.name || DEFAULT_DASHBOARD_NAME,
        dashboardEditorSavedDashboard,
      )
      setSaveDialogOpen(true)
      return
    }

    const currentDashboard = openDashboards[index]

    if (!currentDashboard || !hasDashboardContent(currentDashboard.layout)) {
      return
    }

    const existingDashboard = DashboardStorage.getByName(currentDashboard.name)

    if (existingDashboard) {
      setCurrentTabIndex(index)
      populateDashboardDetailsForm(currentDashboard.name, existingDashboard)
      setSaveDialogOpen(true)
      return
    }

    setCurrentTabIndex(index)
    populateDashboardDetailsForm(
      currentDashboard.name || DEFAULT_DASHBOARD_NAME,
      null,
    )
    setSaveDialogOpen(true)
  }

  const saveDashboardDirectly = (index: number) => {
    const currentDashboard = openDashboards[index]

    if (!currentDashboard || !hasDashboardContent(currentDashboard.layout)) {
      return
    }

    try {
      const existingDashboard = DashboardStorage.getByName(
        currentDashboard.name,
      )
      const dashboards = DashboardStorage.getAll()
      const now = new Date().toISOString()
      const nameToSave = existingDashboard
        ? currentDashboard.name
        : getUniqueDashboardName(
            currentDashboard.name === 'Dashboard'
              ? DEFAULT_DASHBOARD_NAME
              : currentDashboard.name,
            dashboards,
          )

      const dashboardToSave: SavedDashboard = existingDashboard
        ? {
            ...existingDashboard,
            name: nameToSave,
            layout: currentDashboard.layout as DashboardLayout,
            updatedAt: now,
          }
        : {
            id: `dashboard-${Date.now()}`,
            name: nameToSave,
            folder: 'Default',
            folderColor: DashboardStorage.getFolderColor('Default'),
            layout: currentDashboard.layout as DashboardLayout,
            tags: ['dashboard'],
            isPublic: isAdmin ? false : true,
            createdAt: now,
            updatedAt: now,
          }

      DashboardStorage.save(dashboardToSave)
      loadDashboardOptions()
      dispatchWorkspaceOnboardingEvent({
        type: 'dashboard-saved',
        dashboardId: dashboardToSave.id,
        dashboardName: dashboardToSave.name,
      })

      if (currentDashboard.name !== nameToSave) {
        renameDashboard(currentDashboard.id, nameToSave)
      }

      setHasChanges((prev) => ({
        ...prev,
        [index]: false,
      }))
    } catch (error) {
      console.error('Error saving dashboard:', error)
    }
  }

  const saveDraftDashboardDirectly = () => {
    if (!draftDashboard || !hasDashboardContent(draftDashboard.layout)) {
      return
    }

    try {
      const dashboards = DashboardStorage.getAll()
      const existingDashboard = draftDashboard.savedDashboardId
        ? dashboards.find(
            (dashboard) => dashboard.id === draftDashboard.savedDashboardId,
          )
        : undefined
      const now = new Date().toISOString()
      const nameToSave = existingDashboard
        ? draftDashboard.name.trim() || existingDashboard.name
        : getUniqueDashboardName(draftDashboard.name, dashboards)

      const dashboardToSave: SavedDashboard = existingDashboard
        ? {
            ...existingDashboard,
            name: nameToSave,
            layout: draftDashboard.layout,
            updatedAt: now,
          }
        : {
            id: `dashboard-${Date.now()}`,
            name: nameToSave,
            folder: 'Default',
            folderColor: DashboardStorage.getFolderColor('Default'),
            layout: draftDashboard.layout,
            tags: ['dashboard'],
            isPublic: isAdmin ? false : true,
            createdAt: now,
            updatedAt: now,
          }

      DashboardStorage.save(dashboardToSave)
      loadDashboardOptions()
      dispatchWorkspaceOnboardingEvent({
        type: 'dashboard-saved',
        dashboardId: dashboardToSave.id,
        dashboardName: dashboardToSave.name,
      })
      setDraftDashboard((currentDraft) =>
        currentDraft
          ? {
              ...currentDraft,
              name: dashboardToSave.name,
              layout: dashboardToSave.layout,
              savedDashboardId: dashboardToSave.id,
            }
          : currentDraft,
      )
    } catch (error) {
      console.error('Error saving dashboard:', error)
    }
  }

  const handleSaveDialogClose = () => {
    setSaveDialogOpen(false)
    setDashboardName('')
    setDashboardFolder('Default')
    setDashboardFolderColor(DEFAULT_FOLDER_COLOR)
    setDashboardDescription('')
    setDashboardTags([])
    setIsPublic(false)
    setTagInput('')
    setCurrentTabIndex(null)
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !dashboardTags.includes(tagInput.trim())) {
      setDashboardTags([...dashboardTags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setDashboardTags(dashboardTags.filter((tag) => tag !== tagToRemove))
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleSaveDashboard = () => {
    if (draftDashboard) {
      if (!hasDashboardContent(draftDashboard.layout)) {
        return
      }

      try {
        const dashboards = DashboardStorage.getAll()
        const existingDashboard = draftDashboard.savedDashboardId
          ? dashboards.find(
              (dashboard) => dashboard.id === draftDashboard.savedDashboardId,
            )
          : undefined
        const now = new Date().toISOString()
        const nameToSave = existingDashboard
          ? dashboardName.trim() || existingDashboard.name
          : getUniqueDashboardName(dashboardName, dashboards)
        const dashboardToSave: SavedDashboard = {
          ...(existingDashboard || {
            id: `dashboard-${Date.now()}`,
            createdAt: now,
          }),
          name: nameToSave,
          folder: normalizeFolderName(dashboardFolder),
          folderColor: normalizeFolderColor(dashboardFolderColor),
          layout: draftDashboard.layout,
          description: dashboardDescription.trim() || undefined,
          tags: dashboardTags.length > 0 ? dashboardTags : ['dashboard'],
          isPublic: isAdmin ? isPublic : true,
          updatedAt: now,
        }

        DashboardStorage.save(dashboardToSave)
        openDashboards.forEach((openDashboard) => {
          if (
            openDashboard.kind !== 'studyPathContainer' ||
            !openDashboard.studyPath ||
            !draftDashboard.savedDashboardId
          ) {
            return
          }

          const lessonIndex = openDashboard.studyPath.dashboards.findIndex(
            (lesson) => lesson.id === draftDashboard.savedDashboardId,
          )

          if (lessonIndex < 0) {
            return
          }

          updateStudyPathContainer(openDashboard.id, (studyPath) => ({
            ...studyPath,
            dashboards: studyPath.dashboards.map((lesson, index) =>
              index === lessonIndex
                ? {
                    ...lesson,
                    name: dashboardToSave.name,
                    layout: dashboardToSave.layout,
                  }
                : lesson,
            ),
          }))
        })
        loadDashboardOptions()
        dispatchWorkspaceOnboardingEvent({
          type: 'dashboard-saved',
          dashboardId: dashboardToSave.id,
          dashboardName: dashboardToSave.name,
        })
        setDraftDashboard((currentDraft) =>
          currentDraft
            ? {
                ...currentDraft,
                name: dashboardToSave.name,
                layout: dashboardToSave.layout,
                savedDashboardId: dashboardToSave.id,
              }
            : currentDraft,
        )
        handleSaveDialogClose()
      } catch (error) {
        console.error('Error saving dashboard:', error)
      }
      return
    }

    if (currentTabIndex !== null) {
      const currentDashboard = openDashboards[currentTabIndex]

      if (!currentDashboard || !hasDashboardContent(currentDashboard.layout)) {
        return
      }

      try {
        if (hasDashboardContent(currentDashboard.layout)) {
          const dashboards = DashboardStorage.getAll()
          const existingDashboard = DashboardStorage.getByName(
            currentDashboard.name,
          )
          const now = new Date().toISOString()
          const nameToSave = existingDashboard
            ? dashboardName.trim() || existingDashboard.name
            : getUniqueDashboardName(dashboardName, dashboards)
          const newDashboard: SavedDashboard = {
            ...(existingDashboard || {
              id: `dashboard-${Date.now()}`,
              createdAt: now,
            }),
            name: nameToSave,
            folder: normalizeFolderName(dashboardFolder),
            folderColor: normalizeFolderColor(dashboardFolderColor),
            layout: currentDashboard.layout as DashboardLayout,
            description: dashboardDescription.trim() || undefined,
            tags: dashboardTags.length > 0 ? dashboardTags : ['dashboard'],
            isPublic: isAdmin ? isPublic : true,
            updatedAt: now,
          }

          DashboardStorage.save(newDashboard)
          loadDashboardOptions()
          dispatchWorkspaceOnboardingEvent({
            type: 'dashboard-saved',
            dashboardId: newDashboard.id,
            dashboardName: newDashboard.name,
          })

          // Update the dashboard name in the TabList
          renameDashboard(currentDashboard.id, nameToSave)

          // Mark this dashboard as no longer having changes
          setHasChanges((prev) => ({
            ...prev,
            [currentTabIndex]: false,
          }))
        }

        handleSaveDialogClose()
      } catch (error) {
        console.error('Error saving dashboard:', error)
      }
    }
  }

  const handleDashboardEditorSave = () => {
    if (!isAdmin) {
      return
    }

    if (dashboardEditorIsDraft) {
      saveDraftDashboardDirectly()
      return
    }

    saveDashboardDirectly(dashboardEditorIndex)
  }

  const handleOpenDashboardEditorInWorkspace = () => {
    if (
      dashboardEditorIsEmpty ||
      dashboardEditorHasUnsavedChanges ||
      !dashboardEditorSavedDashboard
    ) {
      return
    }

    addDashboard({
      name: dashboardEditorSavedDashboard.name,
      layout: dashboardEditorSavedDashboard.layout,
    })
    dispatchWorkspaceOnboardingEvent({
      type: 'saved-dashboard-opened',
      dashboardId: dashboardEditorSavedDashboard.id,
      dashboardName: dashboardEditorSavedDashboard.name,
    })
    closeDashboardEditor()
  }

  const closeDashboardTabMenu = () => {
    setDashboardTabMenu(null)
  }

  const openDashboardTabMenu = (event: React.MouseEvent, tabIndex: number) => {
    event.preventDefault()
    setSelectedDashboard(tabIndex)
    setDashboardTabMenu(
      dashboardTabMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
            tabIndex,
          }
        : null,
    )
  }

  const closeAllDashboardTabs = () => {
    closeAllDashboards()
    closeDashboardTabMenu()
  }

  const closeOtherDashboardTabs = () => {
    if (dashboardTabMenu) {
      closeOtherDashboards(dashboardTabMenu.tabIndex)
    }
    closeDashboardTabMenu()
  }

  const closeDashboardTabsToRight = () => {
    if (dashboardTabMenu) {
      closeDashboardsToRight(dashboardTabMenu.tabIndex)
    }
    closeDashboardTabMenu()
  }

  const startDashboardTabDrag = (event: React.DragEvent, tabIndex: number) => {
    setDraggedDashboardIndex(tabIndex)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(tabIndex))
  }

  const dropDashboardTab = (event: React.DragEvent, targetIndex: number) => {
    event.preventDefault()
    event.stopPropagation()
    const rawDraggedIndex = event.dataTransfer.getData('text/plain')
    const sourceIndex =
      draggedDashboardIndex ?? Number.parseInt(rawDraggedIndex, 10)

    if (!Number.isInteger(sourceIndex)) {
      setDraggedDashboardIndex(null)
      return
    }

    const targetRect = event.currentTarget.getBoundingClientRect()
    const shouldDropAfter =
      event.clientX > targetRect.left + targetRect.width / 2
    let nextIndex = shouldDropAfter ? targetIndex + 1 : targetIndex

    if (sourceIndex < nextIndex) {
      nextIndex -= 1
    }

    nextIndex = Math.max(0, Math.min(openDashboards.length - 1, nextIndex))
    reorderDashboard(sourceIndex, nextIndex)
    setDraggedDashboardIndex(null)
  }

  const allowDashboardTabListDrop = (event: React.DragEvent) => {
    if (draggedDashboardIndex === null) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const dropDashboardTabAtEnd = (event: React.DragEvent) => {
    if (draggedDashboardIndex === null) {
      return
    }

    event.preventDefault()
    reorderDashboard(draggedDashboardIndex, openDashboards.length - 1)
    setDraggedDashboardIndex(null)
  }

  const closeDashboardChatPanel = () => {
    window.dispatchEvent(new Event(CLOSE_DASHBOARD_CHAT_EVENT))
  }

  const dashboardChatPanel = (
    <DashboardChatPanel
      dashboard={currentDashboard}
      messages={
        currentDashboard ? dashboardChatMessages[currentDashboard.id] || [] : []
      }
      onMessagesChange={(messages) =>
        updateDashboardChatMessages(currentDashboard, messages)
      }
      onClose={closeDashboardChatPanel}
      showCloseButton={!isMobileDashboardView}
    />
  )

  const editDashboardFromTabs = (dashboard: StateDashboard) => {
    if (dashboard.kind === 'studyPathContainer') {
      openStudyPathDashboardEditor(dashboard)
      return
    }

    openDashboardEditor(dashboard.id)
  }

  const dashboardTabsList = (
    <TabList
      className={
        isMobileDashboardView
          ? 'react-tabs__tab-list'
          : 'react-tabs__tab-list react-tabs__tab-list--workspace-hidden'
      }
      onDragOver={isMobileDashboardView ? undefined : allowDashboardTabListDrop}
      onDrop={isMobileDashboardView ? undefined : dropDashboardTabAtEnd}
    >
      {DashboardTabsBar({
        dashboards: openDashboards,
        selectedDashboard,
        isAdmin,
        isMobileDashboardView,
        variant: 'mobile-list',
        onSelectDashboard: selectDashboardAndRestoreScroll,
        onCreateDashboard: createEmptyDashboardTab,
        onEditDashboard: editDashboardFromTabs,
        onRemoveDashboard: removeDashboard,
        onOpenTabMenu: openDashboardTabMenu,
        onDragStart: startDashboardTabDrag,
        onDragOverList: allowDashboardTabListDrop,
        onDropAtEnd: dropDashboardTabAtEnd,
        onDropTab: dropDashboardTab,
        onDragEnd: () => setDraggedDashboardIndex(null),
      })}
    </TabList>
  )

  const workspaceHeaderDashboardTabs = (
    <DashboardTabsBar
      dashboards={openDashboards}
      selectedDashboard={selectedDashboard}
      isAdmin={isAdmin}
      isMobileDashboardView={false}
      variant="workspace-header"
      onSelectDashboard={selectDashboardAndRestoreScroll}
      onCreateDashboard={createEmptyDashboardTab}
      onEditDashboard={editDashboardFromTabs}
      onRemoveDashboard={removeDashboard}
      onOpenTabMenu={openDashboardTabMenu}
      onDragStart={startDashboardTabDrag}
      onDragOverList={allowDashboardTabListDrop}
      onDropAtEnd={dropDashboardTabAtEnd}
      onDropTab={dropDashboardTab}
      onDragEnd={() => setDraggedDashboardIndex(null)}
    />
  )

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        overflowX: 'hidden',
        overflowY: 'hidden',
        WebkitOverflowScrolling: isMobileDashboardView ? 'touch' : undefined,
        display: 'flex',
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          mr: isMobileDashboardView ? 0 : '8px',
          border: isMobileDashboardView ? 0 : 1,
          borderColor: 'divider',
          borderRadius: isMobileDashboardView ? 0 : 2,
          bgcolor: 'background.paper',
        }}
      >
        <Tabs
          className={`react-tabs ${
            selectedDashboardIsEmpty ? 'react-tabs--empty-selected' : ''
          } ${
            isMobileDashboardView ? 'react-tabs--mobile-dashboard' : ''
          }`.trim()}
          selectedIndex={selectedDashboard}
          onSelect={(index) => selectDashboardAndRestoreScroll(index)}
          style={{ position: 'relative', height: '100%' }}
        >
          {dashboardTabsList}
          {!isMobileDashboardView &&
            workspaceTabsSlot &&
            createPortal(workspaceHeaderDashboardTabs, workspaceTabsSlot)}
          {openDashboards.map((dashboard, index) => {
            const isStudyPathContainer =
              dashboard.kind === 'studyPathContainer' && dashboard.studyPath
            const isEmptyDashboard =
              !isStudyPathContainer && !hasDashboardContent(dashboard.layout)
            return (
              <TabPanel key={dashboard.id} forceRender={isMobileDashboardView}>
                <Box
                  ref={(element: HTMLElement | null) => {
                    dashboardPanelRefs.current[dashboard.id] = element
                  }}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    minHeight: 0,
                    backgroundColor: 'background.default',
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      flex: 1,
                      minHeight: 0,
                      overflow:
                        isMobileDashboardView || isEmptyDashboard
                          ? 'auto'
                          : 'visible',
                      WebkitOverflowScrolling: isMobileDashboardView
                        ? 'touch'
                        : isEmptyDashboard
                          ? 'touch'
                          : undefined,
                    }}
                  >
                    {isStudyPathContainer && dashboard.studyPath ? (
                      <StudyPathWorkspaceView
                        studyPath={dashboard.studyPath}
                        onStudyPathChange={(studyPath) =>
                          updateStudyPathContainer(
                            dashboard.id,
                            () => studyPath,
                          )
                        }
                        mobileView={isMobileDashboardView}
                      />
                    ) : isEmptyDashboard ? (
                      <DashboardEmptyState
                        onOpenSavedLibrary={openSavedLibraryFromEmptyState}
                        dashboardOptions={visibleDashboardOptions}
                        onOpenDashboard={openSavedDashboardInWorkspace}
                        onOpenStudyGuide={openStudyGuideFromEmptyState}
                      />
                    ) : (
                      <DashboardLayoutView
                        layout={dashboard.layout}
                        mobileView={isMobileDashboardView}
                        readOnly={isMobileDashboardView}
                        updateLayout={(model) => {
                          updateLayout(model)
                          // Mark this dashboard as having changes after layout update
                          setHasChanges((prev) => ({
                            ...prev,
                            [selectedDashboard]: true,
                          }))
                        }}
                      />
                    )}
                  </Box>
                </Box>
              </TabPanel>
            )
          })}
        </Tabs>
      </Box>

      {isMobileDashboardView ? (
        <Drawer
          anchor="right"
          variant="persistent"
          open={dashboardChatOpen}
          onClose={closeDashboardChatPanel}
          hideBackdrop
          ModalProps={{ keepMounted: true }}
          PaperProps={{
            sx: {
              width: '100%',
              maxWidth: '100%',
              top: 56,
              bottom: 'calc(56px + env(safe-area-inset-bottom))',
              height: 'auto',
              bgcolor: 'background.default',
              p: '6px 8px 8px',
              boxSizing: 'border-box',
            },
          }}
        >
          <Box
            sx={{
              height: '100%',
              minHeight: 0,
              overflow: 'hidden',
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'background.paper',
              boxShadow:
                theme.palette.mode === 'dark'
                  ? '0 18px 40px rgba(0,0,0,0.42)'
                  : '0 18px 42px rgba(16,24,40,0.10)',
            }}
          >
            {dashboardChatPanel}
          </Box>
        </Drawer>
      ) : (
        <Box
          sx={{
            width: dashboardChatOpen
              ? dashboardChatWidth
              : dashboardChatRailWidth,
            flex: '0 0 auto',
            minHeight: 0,
            overflow: 'hidden',
            p: '0',
            boxSizing: 'border-box',
            bgcolor: 'background.default',
            position: 'relative',
            transition: theme.transitions.create(['width'], {
              duration: theme.transitions.duration.shorter,
              easing: theme.transitions.easing.easeInOut,
            }),
          }}
        >
          {dashboardChatOpen ? (
            <Box
              sx={{
                height: '100%',
                overflow: 'hidden',
                border: 1,
                borderColor: 'divider',
                borderRadius: 2.5,
                bgcolor: 'background.paper',
                boxShadow:
                  theme.palette.mode === 'dark'
                    ? '0 18px 40px rgba(0,0,0,0.42)'
                    : '0 18px 42px rgba(16,24,40,0.10)',
              }}
            >
              {dashboardChatPanel}
            </Box>
          ) : (
            <TooltipStyled title="Open AI Chat">
              <Box
                component="button"
                type="button"
                aria-label="Open AI Chat panel"
                onClick={() => setDashboardChatOpen(true)}
                sx={{
                  width: '100%',
                  height: '100%',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2.5,
                  bgcolor: 'background.paper',
                  color: 'primary.main',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 1,
                  py: 0.75,
                  boxShadow:
                    theme.palette.mode === 'dark'
                      ? '0 12px 32px rgba(0,0,0,0.32)'
                      : '0 12px 30px rgba(16,24,40,0.12)',
                  '&:hover .studymesh-ai-chat-rail-icon': {
                    borderColor: 'primary.main',
                    bgcolor: alpha(theme.palette.primary.main, 0.18),
                  },
                }}
              >
                <Box
                  className="studymesh-ai-chat-rail-icon"
                  sx={{
                    width: 30,
                    height: 30,
                    border: 1,
                    borderColor: alpha(theme.palette.primary.main, 0.32),
                    borderRadius: 1.25,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                    display: 'grid',
                    placeItems: 'center',
                    flex: '0 0 auto',
                    marginTop: 0.3,
                    transition: theme.transitions.create(
                      ['background-color', 'border-color'],
                      {
                        duration: theme.transitions.duration.shortest,
                      },
                    ),
                  }}
                >
                  <ChatBubbleOutlineIcon fontSize="small" />
                </Box>
                <Box
                  sx={{ width: '100%', borderTop: 1, borderColor: 'divider' }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    writingMode: 'vertical-rl',
                    fontWeight: 800,
                    letterSpacing: 0.4,
                  }}
                >
                  AI Chat
                </Typography>
              </Box>
            </TooltipStyled>
          )}
          {dashboardChatOpen && (
            <Box
              role="separator"
              aria-label="Resize AI Chat panel"
              onMouseDown={startDashboardChatResize}
              sx={{
                position: 'absolute',
                top: 14,
                left: -3,
                width: 8,
                height: 'calc(100% - 28px)',
                cursor: 'col-resize',
                zIndex: 2,
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 3,
                  width: 2,
                  borderRadius: 999,
                  bgcolor: 'divider',
                },
                '&:hover::after': { bgcolor: 'primary.main' },
              }}
            />
          )}
        </Box>
      )}

      <Menu
        open={dashboardTabMenu !== null}
        onClose={closeDashboardTabMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          dashboardTabMenu !== null
            ? {
                top: dashboardTabMenu.mouseY,
                left: dashboardTabMenu.mouseX,
              }
            : undefined
        }
      >
        <MenuItem onClick={closeAllDashboardTabs}>
          Close all dashboards
        </MenuItem>
        <MenuItem
          onClick={closeOtherDashboardTabs}
          disabled={!dashboardTabMenu || openDashboards.length <= 1}
        >
          Close other dashboards
        </MenuItem>
        <MenuItem
          onClick={closeDashboardTabsToRight}
          disabled={
            !dashboardTabMenu ||
            dashboardTabMenu.tabIndex >= openDashboards.length - 1
          }
        >
          Close dashboards to the right
        </MenuItem>
      </Menu>

      {openDashboards.length === 0 && (
        <DashboardEmptyState
          onOpenSavedLibrary={openSavedLibraryFromEmptyState}
          dashboardOptions={visibleDashboardOptions}
          onOpenDashboard={openSavedDashboardFromEmptyState}
          onOpenStudyGuide={openStudyGuideFromEmptyState}
        />
      )}

      <Dialog
        fullScreen
        open={Boolean(dashboardEditorDashboard)}
        onClose={closeDashboardEditor}
        PaperProps={{
          sx: {
            bgcolor: 'background.default',
          },
        }}
      >
        <Box
          sx={{
            height: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              minHeight: { xs: 104, sm: 56 },
              height: 'auto',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
              gap: 1,
              px: { xs: 1, sm: 2 },
              py: { xs: 1, sm: 0 },
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Box sx={{ minWidth: 0, flex: { xs: '1 1 100%', sm: 1 } }}>
              {isEditingDashboardEditorTitle ? (
                <TextField
                  autoFocus
                  size="small"
                  variant="standard"
                  value={dashboardEditorTitleInput}
                  onChange={(event) =>
                    setDashboardEditorTitleInput(event.target.value)
                  }
                  onBlur={handleDashboardEditorTitleBlur}
                  onKeyDown={handleDashboardEditorTitleKeyDown}
                  inputProps={{
                    'aria-label': 'Dashboard title',
                  }}
                  sx={{
                    maxWidth: { xs: '100%', sm: 420 },
                    width: '100%',
                    '& .MuiInputBase-input': {
                      fontSize: '1rem',
                      fontWeight: 700,
                    },
                  }}
                />
              ) : (
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  onDoubleClick={() => {
                    setDashboardEditorTitleInput(
                      dashboardEditorDashboard?.name || '',
                    )
                    setIsEditingDashboardEditorTitle(true)
                  }}
                  title="Double-click to rename"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'text',
                    maxWidth: { xs: '100%', sm: 420 },
                  }}
                >
                  {dashboardEditorDashboard?.name || 'Dashboard'}
                </Typography>
              )}
            </Box>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              useFlexGap
              sx={{
                width: { xs: '100%', sm: 'auto' },
                flexWrap: { xs: 'wrap', sm: 'nowrap' },
                justifyContent: { xs: 'space-between', sm: 'flex-end' },
              }}
            >
              <Button
                variant="outlined"
                startIcon={<FolderOpenIcon />}
                onClick={() => {
                  setDashboardLibraryInitialSearch('')
                  setDashboardLibraryInitialFolder('')
                  setDashboardLibraryMode('builder')
                  setDashboardLibraryInitialSearchKey(
                    (currentKey) => currentKey + 1,
                  )
                  setDashboardLibraryOpen(true)
                }}
                sx={{
                  textTransform: 'none',
                  minWidth: 0,
                  flex: { xs: '1 1 calc(50% - 8px)', sm: '0 0 auto' },
                  px: { xs: 1, sm: 2 },
                  whiteSpace: 'nowrap',
                  '& .MuiButton-startIcon': {
                    mr: { xs: 0.5, sm: 1 },
                  },
                }}
              >
                {savedDashboardsLabel}
              </Button>
              <Button
                variant="outlined"
                startIcon={<ExtensionIcon />}
                onClick={handleDashboardWidgetsMenuOpen}
                data-onboarding-id="dashboard-editor-widgets"
                sx={{
                  textTransform: 'none',
                  minWidth: 0,
                  flex: { xs: '1 1 calc(50% - 8px)', sm: '0 0 auto' },
                  px: { xs: 1, sm: 2 },
                  whiteSpace: 'nowrap',
                  '& .MuiButton-startIcon': {
                    color: 'primary.main',
                    mr: { xs: 0.5, sm: 1 },
                  },
                }}
              >
                Widgets
              </Button>
              <Menu
                anchorEl={dashboardWidgetsAnchorEl}
                open={Boolean(dashboardWidgetsAnchorEl)}
                onClose={handleDashboardWidgetsMenuClose}
                PaperProps={{
                  sx: {
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    width: { xs: 'calc(100vw - 32px)', sm: 260 },
                    maxWidth: 260,
                    boxShadow: 3,
                    border: 1,
                    borderColor: 'divider',
                  },
                }}
              >
                <Typography
                  sx={{
                    px: 2,
                    py: 1,
                    fontWeight: 'bold',
                    color: 'text.primary',
                  }}
                >
                  My Widgets
                </Typography>
                <Divider sx={{ borderColor: 'divider' }} />
                {isAdmin && (
                  <MenuItem
                    onClick={handleCreateWidgetFromDashboardEditor}
                    sx={{ p: 1.5 }}
                  >
                    <ListItemIcon sx={{ color: 'primary.main', minWidth: 36 }}>
                      <ConstructionIcon fontSize="small" />
                    </ListItemIcon>
                    Create Widget
                  </MenuItem>
                )}
                {isAdmin && <Divider sx={{ borderColor: 'divider' }} />}
                {customWidgetPanels.length > 0 ? (
                  customWidgetPanels.map((topNavBarWidget) => (
                    <Box key={topNavBarWidget.name}>
                      {topNavBarWidget.items.map((item) => (
                        <MenuItem
                          key={item.name}
                          data-onboarding-id="dashboard-widget-saved"
                          data-widget-id={
                            typeof item.customProps?.widgetId === 'string'
                              ? item.customProps.widgetId
                              : undefined
                          }
                          onClick={() => {
                            addWidgetToDashboardEditor({
                              id: `panel-${Date.now()}`,
                              ...item,
                            })
                            handleDashboardWidgetsMenuClose()
                          }}
                          sx={{ p: 1.5 }}
                        >
                          {item.name}
                        </MenuItem>
                      ))}
                    </Box>
                  ))
                ) : (
                  <MenuItem
                    disabled
                    sx={{
                      p: 1.5,
                      opacity: 1,
                      whiteSpace: 'normal',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', lineHeight: 1.4 }}
                    >
                      No saved widgets yet. Create a widget first, then return
                      here to place it on a dashboard.
                    </Typography>
                  </MenuItem>
                )}
              </Menu>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={
                  dashboardEditorIsEmpty ||
                  (!dashboardEditorIsDraft && dashboardEditorIndex < 0) ||
                  (dashboardEditorIsUpdating &&
                    !dashboardEditorHasUnsavedChanges)
                }
                onClick={handleDashboardEditorSave}
                data-onboarding-id="dashboard-editor-save"
                sx={{
                  textTransform: 'none',
                  minWidth: 0,
                  flex: { xs: '1 1 calc(50% - 8px)', sm: '0 0 auto' },
                  px: { xs: 1, sm: 2 },
                  whiteSpace: 'nowrap',
                  '& .MuiButton-startIcon': {
                    mr: { xs: 0.5, sm: 1 },
                  },
                }}
              >
                {dashboardEditorIsUpdating ? 'Update' : 'Save'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<OpenInBrowserIcon />}
                disabled={
                  dashboardEditorIsEmpty ||
                  dashboardEditorHasUnsavedChanges ||
                  !dashboardEditorSavedDashboard
                }
                onClick={handleOpenDashboardEditorInWorkspace}
                sx={{
                  textTransform: 'none',
                  minWidth: 0,
                  flex: { xs: '1 1 calc(50% - 8px)', sm: '0 0 auto' },
                  px: { xs: 1, sm: 2 },
                  whiteSpace: 'nowrap',
                  '& .MuiButton-startIcon': {
                    mr: { xs: 0.5, sm: 1 },
                  },
                }}
              >
                Open in Workspace
              </Button>
              <TooltipStyled title="Edit dashboard details">
                <span>
                  <IconButton
                    aria-label="Edit dashboard details"
                    disabled={dashboardEditorIsEmpty}
                    onClick={() =>
                      handleDashboardDetailsOpen(dashboardEditorIndex)
                    }
                    sx={{
                      color: 'text.secondary',
                      border: 1,
                      borderColor: 'divider',
                      flex: '0 0 36px',
                      width: 36,
                      height: 36,
                      '&:hover': {
                        color: 'primary.main',
                        borderColor: 'primary.main',
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </span>
              </TooltipStyled>
              <IconButton
                aria-label="Close dashboard editor"
                onClick={closeDashboardEditor}
                data-onboarding-id="dashboard-editor-close"
                sx={{
                  color: 'text.primary',
                  bgcolor: 'background.default',
                  border: 1,
                  borderColor: 'divider',
                  flex: '0 0 36px',
                  width: 36,
                  height: 36,
                  '&:hover': {
                    bgcolor: 'action.hover',
                    borderColor: 'text.secondary',
                  },
                }}
              >
                <CloseIcon width={20} height={20} />
              </IconButton>
            </Stack>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <DashboardEditorResponsivePanels
              dashboard={dashboardEditorDashboard}
              isPhoneOrTablet={isMobileDashboardView}
              isAdmin={isAdmin}
              isEmpty={dashboardEditorIsEmpty}
              widgetTabs={dashboardEditorWidgetTabs}
              customWidgetPanels={customWidgetPanels}
              onMoveMobileWidget={moveMobileDashboardWidget}
              onRemoveMobileWidget={removeMobileDashboardWidget}
              onAddWidget={addWidgetToDashboardEditor}
              onUpdateLayout={updateDashboardEditorLayout}
            />
          </Box>
        </Box>
      </Dialog>

      <SavedDashboardsDialog
        open={dashboardLibraryOpen}
        onClose={() => {
          setDashboardLibraryOpen(false)
          loadDashboardOptions()
        }}
        initialSearchTerm={dashboardLibraryInitialSearch}
        initialFolderFilter={dashboardLibraryInitialFolder}
        initialSearchKey={dashboardLibraryInitialSearchKey}
        mode={dashboardLibraryMode}
        onOpenInBuilder={loadSavedDashboardInBuilder}
        onOpenInWorkspace={openSavedDashboardFromLibrary}
      />

      {/* Dashboard Details Dialog */}
      <Dialog
        open={saveDialogOpen}
        onClose={handleSaveDialogClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: 'background.paper',
            color: 'text.primary',
            borderBottom: 1,
            borderColor: 'divider',
            pb: 2,
          }}
        >
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h6" fontWeight="medium">
                Save Dashboard
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                Name it and choose where it appears in Dashboards.
              </Typography>
            </Box>
            <IconButton
              onClick={handleSaveDialogClose}
              aria-label="close"
              sx={{ color: 'text.secondary' }}
            >
              <CloseIcon width={20} height={20} />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ bgcolor: 'background.default', pt: 3, pb: 2 }}>
          <TextField
            autoFocus
            margin="normal"
            id="name"
            label="Dashboard Name"
            type="text"
            fullWidth
            variant="outlined"
            value={dashboardName}
            onChange={(e) => setDashboardName(e.target.value)}
            onFocus={(e) => {
              e.target.select()
            }}
            error={dashboardName.trim() === ''}
            helperText={
              dashboardName.trim() === '' ? 'Dashboard name is required' : ''
            }
            required
            InputLabelProps={{
              shrink: true,
              sx: { color: 'text.secondary' },
            }}
            InputProps={{
              sx: {
                bgcolor: 'background.paper',
                color: 'text.primary',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'divider',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
              },
              endAdornment: dashboardName.trim() !== '' && (
                <IconButton
                  size="small"
                  onClick={() => setDashboardName('')}
                  edge="end"
                  sx={{ color: 'text.secondary' }}
                >
                  <CloseIcon width={16} height={16} />
                </IconButton>
              ),
            }}
          />

          <Autocomplete
            freeSolo
            options={dashboardFolderOptions}
            value={dashboardFolder}
            inputValue={dashboardFolder}
            onChange={(_, nextValue) => {
              const nextFolder = nextValue || ''
              setDashboardFolder(nextFolder)
              setDashboardFolderColor(getFolderColorForDetailsInput(nextFolder))
            }}
            onInputChange={(_, nextInputValue) => {
              setDashboardFolder(nextInputValue)
              setDashboardFolderColor(
                getFolderColorForDetailsInput(nextInputValue),
              )
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                margin="normal"
                id="folder"
                label="Folder"
                fullWidth
                variant="outlined"
                helperText="Dashboards with the same folder name are grouped together."
                InputLabelProps={{
                  ...params.InputLabelProps,
                  shrink: true,
                  sx: { color: 'text.secondary' },
                }}
                InputProps={{
                  ...params.InputProps,
                  sx: {
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'divider',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                    },
                  },
                }}
              />
            )}
          />

          <Box sx={{ mt: 2, mb: 1 }}>
            <Typography variant="subtitle2" color="text.primary" gutterBottom>
              Folder color
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              {FOLDER_COLOR_PRESETS.map((color) => (
                <IconButton
                  key={color}
                  size="small"
                  aria-label={`Use folder color ${color}`}
                  onClick={() => setDashboardFolderColor(color)}
                  sx={{
                    width: 32,
                    height: 32,
                    border: '2px solid',
                    borderColor:
                      normalizeFolderColor(dashboardFolderColor) === color
                        ? 'text.primary'
                        : 'divider',
                    bgcolor: color,
                    '&:hover': { bgcolor: color, opacity: 0.85 },
                  }}
                />
              ))}
              <TextField
                type="color"
                label="Custom"
                value={normalizeFolderColor(dashboardFolderColor)}
                onChange={(e) => setDashboardFolderColor(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={{ width: 96 }}
              />
            </Box>
          </Box>

          <TextField
            margin="normal"
            id="description"
            label="Description (optional)"
            type="text"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={dashboardDescription}
            onChange={(e) => setDashboardDescription(e.target.value)}
            onFocus={(e) => {
              e.target.select()
            }}
            InputLabelProps={{
              shrink: true,
              sx: { color: 'text.secondary' },
            }}
            InputProps={{
              sx: {
                bgcolor: 'background.paper',
                color: 'text.primary',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'divider',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
              },
            }}
          />

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" color="text.primary" gutterBottom>
              Tags
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <TextField
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag"
                size="small"
                onKeyDown={handleTagInputKeyDown}
                InputProps={{
                  sx: {
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'divider',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                    },
                  },
                }}
                sx={{ flexGrow: 1, mr: 1 }}
              />
              <Button
                onClick={handleAddTag}
                variant="contained"
                disabled={!tagInput.trim()}
                sx={{
                  bgcolor: 'primary.light',
                  color: '#191919',
                  '&:hover': {
                    bgcolor: 'primary.main',
                  },
                }}
              >
                Add
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {dashboardTags.map((tag, index) => (
                <Chip
                  key={index}
                  label={tag}
                  onDelete={() => handleRemoveTag(tag)}
                  sx={{
                    bgcolor: 'rgba(0, 124, 102, 0.1)',
                    color: 'primary.dark',
                    '& .MuiChip-deleteIcon': {
                      color: 'primary.dark',
                      '&:hover': {
                        color: 'primary.main',
                      },
                    },
                  }}
                />
              ))}
              {dashboardTags.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No tags added yet
                </Typography>
              )}
            </Box>
          </Box>

          {isAdmin && (
            <FormControlLabel
              control={
                <Switch
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: 'primary.light',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: 'primary.dark',
                    },
                  }}
                />
              }
              label="Make dashboard public"
              sx={{
                color: 'text.primary',
                mt: 2,
              }}
            />
          )}
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button
            onClick={handleSaveDialogClose}
            variant="outlined"
            sx={{
              color: 'primary.dark',
              borderColor: 'primary.dark',
              mr: 1,
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'rgba(0, 124, 102, 0.08)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveDashboard}
            variant="contained"
            color="primary"
            disabled={dashboardName.trim() === ''}
            startIcon={<SaveIcon />}
            sx={{
              bgcolor: 'primary.dark',
              color: 'primary.contrastText',
              '&:hover': {
                bgcolor: 'primary.main',
              },
            }}
          >
            Save Dashboard
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Dashboards
