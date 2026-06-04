import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  IconButton,
  Box,
  Paper,
  Tooltip,
  Chip,
  TextField,
  InputAdornment,
  MenuItem,
  FormControl,
  Select,
  SelectChangeEvent,
  InputLabel,
  Grid,
  Fade,
  Switch,
  FormControlLabel,
  Menu,
  Autocomplete,
  useTheme,
  useMediaQuery,
  Checkbox,
} from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import DeleteIcon from '@mui/icons-material/Delete'
import DashboardIcon from '@mui/icons-material/Dashboard'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import FolderIcon from '@mui/icons-material/Folder'
import SearchIcon from '@mui/icons-material/Search'
import SortIcon from '@mui/icons-material/Sort'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import PublicIcon from '@mui/icons-material/Public'
import LockIcon from '@mui/icons-material/Lock'
import ReplayIcon from '@mui/icons-material/Replay'
import QuizIcon from '@mui/icons-material/Quiz'
import SchoolIcon from '@mui/icons-material/School'
import { DashboardLayout } from '../../state/store'
import { useDashboards } from './DashboardProvider'
import { DefaultDashboard } from './fixture'
import { ensureStarterDashboards } from '../../customHooks/useWorkspaceActions'
import DeleteConfirmationDialog from '../WidgetEditor/components/dialogs/DeleteConfirmationDialog'
import {
  DEFAULT_FOLDER_COLOR,
  FOLDER_COLOR_PRESETS,
  normalizeFolderColor,
  normalizeFolderName,
} from './folderColors'
import { SAVED_DASHBOARDS_CHANGED_EVENT } from './dashboardStorage'

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
  componentsCount: number
}

interface SavedDashboardsDialogProps {
  open: boolean
  onClose: () => void
  initialSearchTerm?: string
  initialFolderFilter?: string
  initialSearchKey?: number
  mode?: 'workspace' | 'builder'
  onOpenInBuilder?: (dashboard: SavedDashboard) => void
  onOpenInWorkspace?: (dashboard: SavedDashboard) => void
}

// Add a new interface for the edit dashboard dialog
interface EditDashboardDialogProps {
  open: boolean
  onClose: () => void
  dashboard: SavedDashboard | null
  onSave: (dashboard: SavedDashboard) => void
  folderOptions: string[]
  folderColorsByName: Record<string, string>
}

// Sort types
type SortOption =
  | 'nameAsc'
  | 'nameDesc'
  | 'dateNewest'
  | 'dateOldest'
  | 'mostComponents'
  | 'fewestComponents'

const SavedDashboardsDialog: React.FC<SavedDashboardsDialogProps> = ({
  open,
  onClose,
  initialSearchTerm = '',
  initialFolderFilter = '',
  initialSearchKey = 0,
  mode = 'workspace',
  onOpenInBuilder,
  onOpenInWorkspace,
}) => {
  const openActionLabel =
    mode === 'builder' ? 'Open in Builder' : 'Open in Workspace'
  // Increased card spacing and padding for mobile via responsive styles

  // Search state
  const [searchTerm, setSearchTerm] = useState('')

  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>('dateNewest')

  // Filter state
  const [showPublicOnly, setShowPublicOnly] = useState(false)
  const [folderFilter, setFolderFilter] = useState('')

  // Dashboard state
  const [dashboards, setDashboards] = useState<SavedDashboard[]>([])

  // User state - check if user is admin
  const [isAdmin, setIsAdmin] = useState(false)

  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [dashboardToDelete, setDashboardToDelete] = useState<string | null>(
    null,
  )
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleteTitle, setBulkDeleteTitle] = useState('Delete library items')
  const [bulkDeleteCandidates, setBulkDeleteCandidates] = useState<
    SavedDashboard[]
  >([])
  const [bulkDeleteSelectedIds, setBulkDeleteSelectedIds] = useState<string[]>(
    [],
  )

  // Access dashboards context
  const { addDashboard } = useDashboards()

  // Add state for edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [dashboardToEdit, setDashboardToEdit] = useState<SavedDashboard | null>(
    null,
  )

  // Theme and responsive breakpoints for xs checks
  const theme = useTheme()
  const isXs = useMediaQuery(theme.breakpoints.down('sm'))

  // State for action menu
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [menuDashboard, setMenuDashboard] = useState<SavedDashboard | null>(
    null,
  )

  // Get the delete confirmation preference from localStorage
  const shouldConfirmDelete = () => {
    try {
      const stored = localStorage.getItem(
        'widget-editor-delete-dashboard-confirmation',
      )
      if (stored !== null) {
        return JSON.parse(stored)
      }
      return true // Default to true if not set
    } catch (error) {
      console.error(
        'Error reading widget-editor-delete-dashboard-confirmation from localStorage',
        error,
      )
      return true // Default to true if there's an error
    }
  }

  // Check if user is admin on component mount
  useEffect(() => {
    try {
      const userData = localStorage.getItem('userData')
      if (userData) {
        const parsedData = JSON.parse(userData)
        setIsAdmin(parsedData.role === 'ADMIN_ROLE')
      }
    } catch (error) {
      console.error('Failed to parse user data', error)
      setIsAdmin(false)
    }
  }, [])

  // Function to load dashboards from localStorage
  const loadDashboards = () => {
    try {
      ensureStarterDashboards()
      const savedDashboards = localStorage.getItem('customDashboards')
      if (savedDashboards) {
        const parsedDashboards = JSON.parse(savedDashboards)

        // Transform to ensure all required fields
        const formattedDashboards = parsedDashboards.map(
          (dashboard: {
            id: string
            name: string
            folder?: string
            folderColor?: string
            layout: DashboardLayout
            description?: string
            tags?: string[]
            isPublic?: boolean
            createdAt?: string
            updatedAt?: string
          }) => ({
            id: dashboard.id,
            name: dashboard.name,
            folder: normalizeFolderName(dashboard.folder),
            folderColor: normalizeFolderColor(dashboard.folderColor),
            layout: dashboard.layout,
            description: dashboard.description || 'No description',
            tags: dashboard.tags || ['dashboard'],
            isPublic: dashboard.isPublic || false,
            createdAt: dashboard.createdAt || new Date().toISOString(),
            updatedAt: dashboard.updatedAt || new Date().toISOString(),
            componentsCount: calculateComponentsCount(dashboard.layout),
          }),
        )

        setDashboards(formattedDashboards)
      }
    } catch (error) {
      console.error('Failed to load dashboards from localStorage', error)
      setDashboards([])
    }
  }

  // Calculate the number of components in a layout
  const calculateComponentsCount = (layout: DashboardLayout): number => {
    // Define NodeType interface for better type safety
    interface NodeType {
      type?: string
      component?: string | unknown
      config?: {
        customProps?: {
          components?: unknown
        }
      }
      children?: NodeType[]
      weight?: number
      name?: string
    }

    const countWidgetBlocks = (components?: unknown): number => {
      if (!Array.isArray(components)) {
        return 0
      }

      return components.reduce((sum, component) => {
        if (!component || typeof component !== 'object') {
          return sum
        }

        const children =
          'children' in component ? component.children : undefined

        return sum + 1 + countWidgetBlocks(children)
      }, 0)
    }

    // Count tabs with components
    const countTabs = (node: NodeType): number => {
      if (!node) {
        return 0
      }

      if (node.type === 'tab' && node.component) {
        if (node.component === 'CustomWidget') {
          const widgetBlocks = countWidgetBlocks(
            node.config?.customProps?.components,
          )

          return widgetBlocks || 1
        }

        return 1
      }

      if (node.children && Array.isArray(node.children)) {
        return node.children.reduce(
          (sum: number, child: NodeType) => sum + countTabs(child),
          0,
        )
      }

      return 0
    }

    return countTabs(layout as unknown as NodeType)
  }

  // Load dashboards when dialog opens
  useEffect(() => {
    if (open) {
      loadDashboards()
      setSearchTerm(initialSearchTerm)
      setFolderFilter(
        initialFolderFilter ? normalizeFolderName(initialFolderFilter) : '',
      )
      setSortBy('dateNewest')
    }
  }, [initialFolderFilter, initialSearchKey, initialSearchTerm, open])

  // Handle opening a dashboard
  const handleOpenDashboard = (dashboard: SavedDashboard) => {
    if (mode === 'builder') {
      onOpenInBuilder?.(dashboard)
      onClose()
      return
    }

    if (onOpenInWorkspace) {
      onOpenInWorkspace(dashboard)
      onClose()
      return
    }

    // Convert saved dashboard to the format needed by DashboardProvider
    const dashboardToOpen: DefaultDashboard = {
      name: dashboard.name,
      layout: dashboard.layout,
    }

    // Add the dashboard
    addDashboard(dashboardToOpen)

    // Close the dialog
    onClose()
  }

  // Function to delete a dashboard
  const handleDeleteDashboard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    // Check if we should confirm deletion
    if (shouldConfirmDelete()) {
      setDashboardToDelete(id)
      setDeleteConfirmOpen(true)
    } else {
      // Delete without confirmation
      deleteDashboard(id)
    }
  }

  // Function to actually delete the dashboard
  const deleteDashboard = (id: string) => {
    try {
      const updatedDashboards = dashboards.filter(
        (dashboard) => dashboard.id !== id,
      )
      setDashboards(updatedDashboards)
      localStorage.setItem(
        'customDashboards',
        JSON.stringify(updatedDashboards),
      )
      window.dispatchEvent(new Event(SAVED_DASHBOARDS_CHANGED_EVENT))
    } catch (error) {
      console.error('Failed to delete dashboard', error)
    }
  }

  const handleDeleteAllDashboards = () => {
    if (!isAdmin || dashboards.length === 0) {
      return
    }

    openBulkDeleteDialog('Delete all library items', dashboards)
  }

  const handleDeleteFolderDashboards = (
    folderName: string,
    folderDashboards: SavedDashboard[],
    event: React.MouseEvent,
  ) => {
    event.stopPropagation()
    if (!isAdmin || folderDashboards.length === 0) {
      return
    }

    openBulkDeleteDialog(`Delete ${folderName}`, folderDashboards)
  }

  const openBulkDeleteDialog = (
    title: string,
    candidates: SavedDashboard[],
  ) => {
    setBulkDeleteTitle(title)
    setBulkDeleteCandidates(candidates)
    setBulkDeleteSelectedIds(candidates.map((dashboard) => dashboard.id))
    setBulkDeleteOpen(true)
  }

  const confirmBulkDeleteDashboards = () => {
    if (!isAdmin) {
      return
    }

    try {
      const selectedIds = new Set(bulkDeleteSelectedIds)
      const updatedDashboards = dashboards.filter(
        (dashboard) => !selectedIds.has(dashboard.id),
      )

      setDashboards(updatedDashboards)
      setMenuAnchorEl(null)
      setMenuDashboard(null)
      localStorage.setItem(
        'customDashboards',
        JSON.stringify(updatedDashboards),
      )
      window.dispatchEvent(new Event(SAVED_DASHBOARDS_CHANGED_EVENT))
    } catch (error) {
      console.error('Failed to delete selected dashboards', error)
    } finally {
      setBulkDeleteOpen(false)
      setBulkDeleteCandidates([])
      setBulkDeleteSelectedIds([])
    }
  }

  const cancelBulkDeleteDashboards = () => {
    setBulkDeleteOpen(false)
    setBulkDeleteCandidates([])
    setBulkDeleteSelectedIds([])
  }

  const toggleBulkDeleteDashboard = (dashboardId: string) => {
    setBulkDeleteSelectedIds((selectedIds) =>
      selectedIds.includes(dashboardId)
        ? selectedIds.filter((id) => id !== dashboardId)
        : [...selectedIds, dashboardId],
    )
  }

  const setBulkDeleteFolderSelected = (
    folderName: string,
    selected: boolean,
  ) => {
    const folderDashboardIds = bulkDeleteCandidates
      .filter(
        (dashboard) => normalizeFolderName(dashboard.folder) === folderName,
      )
      .map((dashboard) => dashboard.id)

    setBulkDeleteSelectedIds((selectedIds) => {
      const nextIds = new Set(selectedIds)

      folderDashboardIds.forEach((id) => {
        if (selected) {
          nextIds.add(id)
        } else {
          nextIds.delete(id)
        }
      })

      return Array.from(nextIds)
    })
  }

  // Confirm dashboard deletion
  const confirmDeleteDashboard = () => {
    if (dashboardToDelete) {
      deleteDashboard(dashboardToDelete)
      setDeleteConfirmOpen(false)
      setDashboardToDelete(null)
    }
  }

  // Cancel dashboard deletion
  const cancelDeleteDashboard = () => {
    setDeleteConfirmOpen(false)
    setDashboardToDelete(null)
  }

  // Function to toggle a dashboard's public status
  const handleTogglePublic = (id: string, e: React.MouseEvent) => {
    if (!isAdmin) {
      return
    }

    e.stopPropagation()
    try {
      const updatedDashboards = dashboards.map((dashboard) => {
        if (dashboard.id === id) {
          return { ...dashboard, isPublic: !dashboard.isPublic }
        }
        return dashboard
      })
      setDashboards(updatedDashboards)
      localStorage.setItem(
        'customDashboards',
        JSON.stringify(updatedDashboards),
      )
      window.dispatchEvent(new Event(SAVED_DASHBOARDS_CHANGED_EVENT))
    } catch (error) {
      console.error('Failed to update dashboard visibility', error)
    }
  }

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  // Handle sort change
  const handleSortChange = (e: SelectChangeEvent) => {
    setSortBy(e.target.value as SortOption)
  }

  const handleFolderFilterChange = (e: SelectChangeEvent) => {
    setFolderFilter(e.target.value)
  }

  // Handle public filter toggle
  const handlePublicFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowPublicOnly(e.target.checked)
  }

  const roleVisibleDashboards = useMemo(() => {
    let filtered = dashboards

    // If not admin, only show public dashboards
    if (!isAdmin) {
      filtered = filtered.filter((dashboard) => dashboard.isPublic)
    }

    return filtered
  }, [dashboards, isAdmin])

  const folderOptions = useMemo(() => {
    return Array.from(
      new Set(
        roleVisibleDashboards.map((dashboard) =>
          normalizeFolderName(dashboard.folder),
        ),
      ),
    ).sort((a, b) => a.localeCompare(b))
  }, [roleVisibleDashboards])

  const folderColorsByName = useMemo(() => {
    return dashboards.reduce<Record<string, string>>((colors, dashboard) => {
      const folderName = normalizeFolderName(dashboard.folder)

      if (!colors[folderName]) {
        colors[folderName] = normalizeFolderColor(dashboard.folderColor)
      }

      return colors
    }, {})
  }, [dashboards])

  const isStudyPackDashboard = (dashboard: SavedDashboard) => {
    const folderName = normalizeFolderName(dashboard.folder).toLowerCase()
    return (
      folderName === 'study packs' ||
      dashboard.id.startsWith('study-pack-dashboard-') ||
      Boolean(dashboard.tags?.includes('study-pack'))
    )
  }

  // Filter dashboards based on search term, folder, public filter, and user role
  const filteredDashboards = useMemo(() => {
    let filtered = roleVisibleDashboards

    if (isAdmin && showPublicOnly) {
      // Admin user with public filter enabled
      filtered = filtered.filter((dashboard) => dashboard.isPublic)
    }

    if (folderFilter) {
      filtered = filtered.filter(
        (dashboard) => normalizeFolderName(dashboard.folder) === folderFilter,
      )
    }

    // Apply search filter if there's a search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (dashboard) =>
          dashboard.name.toLowerCase().includes(term) ||
          dashboard.folder?.toLowerCase().includes(term) ||
          dashboard.description?.toLowerCase().includes(term) ||
          dashboard.tags?.some((tag) => tag.toLowerCase().includes(term)),
      )
    }

    return filtered
  }, [folderFilter, roleVisibleDashboards, searchTerm, showPublicOnly, isAdmin])

  const getDashboardUpdatedAt = (dashboard: SavedDashboard) =>
    new Date(dashboard.updatedAt).getTime()

  const compareDashboards = (
    a: SavedDashboard,
    b: SavedDashboard,
    option: SortOption,
  ) => {
    switch (option) {
      case 'nameAsc':
        return a.name.localeCompare(b.name)
      case 'nameDesc':
        return b.name.localeCompare(a.name)
      case 'dateNewest':
        return getDashboardUpdatedAt(b) - getDashboardUpdatedAt(a)
      case 'dateOldest':
        return getDashboardUpdatedAt(a) - getDashboardUpdatedAt(b)
      case 'mostComponents':
        return b.componentsCount - a.componentsCount
      case 'fewestComponents':
        return a.componentsCount - b.componentsCount
      default:
        return 0
    }
  }

  // Sort filtered dashboards for counts and empty states.
  const sortedDashboards = useMemo(() => {
    return [...filteredDashboards].sort((a, b) => {
      const result = compareDashboards(a, b, sortBy)
      return (
        result ||
        normalizeFolderName(a.folder).localeCompare(
          normalizeFolderName(b.folder),
        )
      )
    })
  }, [filteredDashboards, sortBy])

  const groupedDashboards = useMemo(() => {
    const groups = new Map<string, SavedDashboard[]>()

    filteredDashboards.forEach((dashboard) => {
      const folderName = normalizeFolderName(dashboard.folder)
      groups.set(folderName, [...(groups.get(folderName) || []), dashboard])
    })

    return Array.from(groups.entries())
      .map(([folderName, dashboards]) => {
        const sortedFolderDashboards = [...dashboards].sort((a, b) => {
          const result = compareDashboards(a, b, sortBy)
          return result || a.name.localeCompare(b.name)
        })

        const folderUpdatedTimes = dashboards.map(getDashboardUpdatedAt)
        const folderComponentsCount = dashboards.reduce(
          (sum, dashboard) => sum + dashboard.componentsCount,
          0,
        )

        return {
          folderName,
          dashboards: sortedFolderDashboards,
          folderColor: normalizeFolderColor(dashboards[0]?.folderColor),
          newestUpdatedAt: Math.max(...folderUpdatedTimes),
          oldestUpdatedAt: Math.min(...folderUpdatedTimes),
          componentsCount: folderComponentsCount,
        }
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'nameDesc':
            return b.folderName.localeCompare(a.folderName)
          case 'dateNewest':
            return b.newestUpdatedAt - a.newestUpdatedAt
          case 'dateOldest':
            return a.oldestUpdatedAt - b.oldestUpdatedAt
          case 'mostComponents':
            return b.componentsCount - a.componentsCount
          case 'fewestComponents':
            return a.componentsCount - b.componentsCount
          case 'nameAsc':
          default:
            return a.folderName.localeCompare(b.folderName)
        }
      })
  }, [filteredDashboards, sortBy])

  const bulkDeleteGroups = useMemo(() => {
    const groups = new Map<string, SavedDashboard[]>()

    bulkDeleteCandidates.forEach((dashboard) => {
      const folderName = normalizeFolderName(dashboard.folder)
      groups.set(folderName, [...(groups.get(folderName) || []), dashboard])
    })

    return Array.from(groups.entries())
      .map(([folderName, folderDashboards]) => ({
        folderName,
        dashboards: [...folderDashboards].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
        folderColor: normalizeFolderColor(folderDashboards[0]?.folderColor),
      }))
      .sort((a, b) => a.folderName.localeCompare(b.folderName))
  }, [bulkDeleteCandidates])

  const handleStudyAction = (
    action: 'generate-exercises' | 'practice-again' | 'create-quiz',
    dashboard: SavedDashboard,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation()

    window.dispatchEvent(
      new CustomEvent('studymesh-study-pack-action-requested', {
        detail: {
          action,
          dashboardId: dashboard.id,
          dashboardName: dashboard.name,
        },
      }),
    )
  }

  // Function to handle editing a dashboard
  const handleEditDashboard = (
    dashboard: SavedDashboard,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation()
    setDashboardToEdit(dashboard)
    setEditDialogOpen(true)
  }

  // Function to save edited dashboard
  const handleSaveEditedDashboard = (editedDashboard: SavedDashboard) => {
    try {
      const editedFolder = normalizeFolderName(editedDashboard.folder)
      const editedFolderColor = normalizeFolderColor(
        editedDashboard.folderColor,
      )
      const updatedDashboards = dashboards.map((dashboard) => {
        const nextDashboard =
          dashboard.id === editedDashboard.id ? editedDashboard : dashboard

        if (normalizeFolderName(nextDashboard.folder) === editedFolder) {
          return {
            ...nextDashboard,
            folder: editedFolder,
            folderColor: editedFolderColor,
          }
        }

        return nextDashboard
      })
      setDashboards(updatedDashboards)
      localStorage.setItem(
        'customDashboards',
        JSON.stringify(updatedDashboards),
      )
      window.dispatchEvent(new Event(SAVED_DASHBOARDS_CHANGED_EVENT))
      setEditDialogOpen(false)
      setDashboardToEdit(null)
    } catch (error) {
      console.error('Failed to update dashboard', error)
    }
  }

  const handleMenuOpen = (
    dashboard: SavedDashboard,
    e: React.MouseEvent<HTMLElement>,
  ) => {
    e.stopPropagation()
    setMenuDashboard(dashboard)
    setMenuAnchorEl(e.currentTarget)
  }
  const handleMenuClose = () => {
    setMenuAnchorEl(null)
    setMenuDashboard(null)
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
          },
        }}
      >
        <DialogTitle
          id="tutorial-dialog-title"
          sx={{
            bgcolor: 'background.paper',
            color: 'text.primary',
            pb: 1,
            borderBottom: 1,
            borderColor: 'divider',
            position: 'sticky',
            top: 0,
            zIndex: 1200,
          }}
        >
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Box display="flex" alignItems="center">
              <AutoStoriesIcon sx={{ mr: 1.5, color: 'primary.main' }} />
              <Box>
                <Typography
                  variant="h5"
                  component="div"
                  fontWeight="bold"
                  sx={{
                    color: 'text.primary',
                  }}
                >
                  Library items
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Study Guides and custom dashboards.
                </Typography>
              </Box>
            </Box>
            <Box display="flex" alignItems="center">
              <IconButton
                aria-label="close"
                onClick={onClose}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent
          sx={{ p: { xs: 2, sm: 3 }, bgcolor: 'background.default' }}
        >
          {/* Search, Sort, and Filter Controls */}
          <Grid container spacing={2} sx={{ mb: 3, mt: 1 }}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search Study Guides..."
                value={searchTerm}
                onChange={handleSearchChange}
                variant="outlined"
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setSearchTerm('')}
                        sx={{ color: 'text.secondary' }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
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
                sx={{
                  '& .MuiInputLabel-root': {
                    color: 'text.secondary',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small" variant="outlined">
                <InputLabel
                  id="folder-filter-label"
                  sx={{ color: 'text.secondary' }}
                >
                  Folder
                </InputLabel>
                <Select
                  labelId="folder-filter-label"
                  value={folderFilter}
                  onChange={handleFolderFilterChange}
                  label="Folder"
                  startAdornment={
                    <InputAdornment position="start">
                      <FolderIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  }
                  sx={{
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
                  }}
                >
                  <MenuItem value="">All Subjects</MenuItem>
                  {folderOptions.map((folderName) => (
                    <MenuItem
                      key={folderName}
                      value={folderName}
                      sx={{
                        borderLeft: '4px solid',
                        borderLeftColor: folderColorsByName[folderName],
                        bgcolor: `${folderColorsByName[folderName]}14`,
                        color: 'text.primary',
                        '&:hover': {
                          bgcolor: `${folderColorsByName[folderName]}24`,
                        },
                        '&.Mui-selected': {
                          bgcolor: `${folderColorsByName[folderName]}30`,
                          '&:hover': {
                            bgcolor: `${folderColorsByName[folderName]}3D`,
                          },
                        },
                      }}
                    >
                      {folderName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small" variant="outlined">
                <InputLabel id="sort-by-label" sx={{ color: 'text.secondary' }}>
                  Sort By
                </InputLabel>
                <Select
                  labelId="sort-by-label"
                  value={sortBy}
                  onChange={handleSortChange}
                  label="Sort By"
                  startAdornment={
                    <InputAdornment position="start">
                      <SortIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  }
                  sx={{
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
                  }}
                >
                  <MenuItem value="nameAsc">Name (A-Z)</MenuItem>
                  <MenuItem value="nameDesc">Name (Z-A)</MenuItem>
                  <MenuItem value="dateNewest">Date (Newest First)</MenuItem>
                  <MenuItem value="dateOldest">Date (Oldest First)</MenuItem>
                  <MenuItem value="mostComponents">Most Blocks</MenuItem>
                  <MenuItem value="fewestComponents">Fewest Blocks</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              {isAdmin && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={showPublicOnly}
                      onChange={handlePublicFilterChange}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: 'primary.light',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track':
                          {
                            backgroundColor: 'primary.dark',
                          },
                      }}
                    />
                  }
                  label="Public only"
                  sx={{
                    color: 'text.primary',
                    '& .MuiFormControlLabel-label': {
                      fontSize: '0.875rem',
                    },
                  }}
                />
              )}
            </Grid>
          </Grid>

          <Box
            sx={{
              mb: 2,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              gap: 1.5,
            }}
          >
            <Box>
              <Typography variant="body2" color="text.secondary">
                {sortedDashboards.length === 0
                  ? 'No Study Guides found'
                  : `Showing ${sortedDashboards.length} item${
                      sortedDashboards.length !== 1 ? 's' : ''
                    }`}
                {searchTerm && ` matching "${searchTerm}"`}
                {folderFilter && ` in "${folderFilter}"`}
                {!isAdmin && ' (only showing public library items)'}
              </Typography>
              {isAdmin && dashboards.length > sortedDashboards.length && (
                <Typography variant="caption" color="text.secondary">
                  Delete all removes every saved library item, including hidden
                  by filters.
                </Typography>
              )}
            </Box>
            {isAdmin && (
              <Tooltip
                title={
                  dashboards.length === 0
                    ? 'No library items to delete'
                    : 'Delete every saved Study Guide and dashboard'
                }
              >
                <span>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<DeleteIcon />}
                    disabled={dashboards.length === 0}
                    onClick={handleDeleteAllDashboards}
                    sx={{
                      alignSelf: { xs: 'flex-start', sm: 'center' },
                      borderColor: 'error.main',
                      color: 'error.main',
                      bgcolor: 'background.paper',
                      fontWeight: 700,
                      '&:hover': {
                        bgcolor: 'error.main',
                        color: 'error.contrastText',
                        borderColor: 'error.main',
                      },
                      '&.Mui-disabled': {
                        bgcolor: 'transparent',
                      },
                    }}
                  >
                    Delete all
                  </Button>
                </span>
              </Tooltip>
            )}
          </Box>

          {/* Dashboards list */}
          {sortedDashboards.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                textAlign: 'center',
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: '1px dashed',
                borderColor: 'divider',
              }}
            >
              <DashboardIcon
                sx={{
                  fontSize: 48,
                  mb: 2,
                  color: 'text.secondary',
                }}
              />
              <Typography color="text.primary" variant="h6" gutterBottom>
                {searchTerm
                  ? 'No Matching Study Guides'
                  : folderFilter
                  ? 'No Study Guides In Subject'
                  : 'No Study Guides Available'}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {searchTerm
                  ? 'Try a different search term or clear the search'
                  : folderFilter
                  ? 'Select a different subject or clear the filter'
                  : !isAdmin
                  ? 'No public Study Guides are currently available'
                  : 'Create a Study Guide from notes to start your library'}
              </Typography>
            </Paper>
          ) : (
            <List sx={{ p: 0 }}>
              {groupedDashboards.map(
                ({ folderName, dashboards, folderColor }) => (
                  <Box key={folderName} sx={{ mb: 3 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1.25,
                        color: 'text.primary',
                      }}
                    >
                      <SchoolIcon
                        sx={{
                          color: folderColor,
                          fontSize: { xs: '1.35rem', sm: '1.55rem' },
                          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))',
                        }}
                      />
                      <Typography
                        variant="h6"
                        fontWeight={800}
                        sx={{ fontSize: { xs: '1rem', sm: '1.1rem' } }}
                      >
                        {folderName}
                      </Typography>
                      <Chip
                        size="small"
                        label={`${dashboards.length} study pack${
                          dashboards.length === 1 ? '' : 's'
                        }`}
                        sx={{
                          height: 24,
                          bgcolor: `${folderColor}22`,
                          color: folderColor,
                          fontWeight: 700,
                        }}
                      />
                      <Box sx={{ flex: 1 }} />
                      {isAdmin ? (
                        <Tooltip title={`Delete items in ${folderName}`}>
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={`Delete ${folderName} folder items`}
                            onClick={(event) =>
                              handleDeleteFolderDashboards(
                                folderName,
                                dashboards,
                                event,
                              )
                            }
                            sx={{
                              bgcolor: 'rgba(211,47,47,0.08)',
                              '&:hover': {
                                bgcolor: 'rgba(211,47,47,0.16)',
                              },
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </Box>
                    {dashboards.map((dashboard, index) => (
                      <Fade
                        key={dashboard.id}
                        in={true}
                        timeout={300}
                        style={{ transitionDelay: `${index * 40}ms` }}
                      >
                        <Paper
                          elevation={0}
                          sx={{
                            mb: { xs: 1, sm: 2 },
                            width: '100%',
                            overflow: 'hidden',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            transition: 'all 0.2s ease-in-out',
                            bgcolor: 'background.paper',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                              borderColor: 'primary.main',
                            },
                            cursor: 'pointer',
                          }}
                          onClick={() => handleOpenDashboard(dashboard)}
                          aria-label={`${openActionLabel} ${dashboard.name}`}
                        >
                          <Box
                            sx={{
                              p: { xs: 1, sm: 2 },
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: { xs: 'center', sm: 'flex-start' },
                            }}
                          >
                            <Box
                              sx={{
                                width: '100%',
                                display: 'flex',
                                justifyContent: {
                                  xs: 'center',
                                  sm: 'space-between',
                                },
                                alignItems: { xs: 'center', sm: 'flex-start' },
                                position: { xs: 'relative', sm: 'static' },
                              }}
                            >
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  flexGrow: { xs: 0, sm: 1 },
                                  flexDirection: { xs: 'column', sm: 'row' },
                                }}
                              >
                                <Box
                                  sx={{
                                    bgcolor: 'rgba(0, 124, 102, 0.1)',
                                    color: 'primary.dark',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '50%',
                                    width: { xs: 32, sm: 40 },
                                    height: { xs: 32, sm: 40 },
                                    mr: 2,
                                  }}
                                >
                                  {isStudyPackDashboard(dashboard) ? (
                                    <AutoStoriesIcon
                                      fontSize={isXs ? 'small' : 'medium'}
                                    />
                                  ) : (
                                    <DashboardIcon
                                      fontSize={isXs ? 'small' : 'medium'}
                                    />
                                  )}
                                </Box>
                                <Box>
                                  <Typography
                                    variant="subtitle1"
                                    fontWeight="bold"
                                    color="text.primary"
                                    sx={{
                                      fontSize: { xs: '0.9rem', sm: '1rem' },
                                    }}
                                  >
                                    {dashboard.name}
                                  </Typography>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      flexDirection: {
                                        xs: 'column',
                                        sm: 'row',
                                      },
                                      alignItems: {
                                        xs: 'flex-start',
                                        sm: 'center',
                                      },
                                      mt: 0.5,
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{
                                        display: { xs: 'none', sm: 'block' },
                                        fontSize: '0.8rem',
                                      }}
                                    >
                                      Last modified:{' '}
                                      {new Date(
                                        dashboard.updatedAt,
                                      ).toLocaleDateString()}{' '}
                                      at{' '}
                                      {new Date(
                                        dashboard.updatedAt,
                                      ).toLocaleTimeString()}
                                    </Typography>
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        mt: { xs: 0.5, sm: 0 },
                                        ml: { xs: 0, sm: 2 },
                                      }}
                                    >
                                      {!isStudyPackDashboard(dashboard) && (
                                        <Chip
                                          size="small"
                                          label={`${dashboard.componentsCount} blocks`}
                                          sx={{
                                            height: 20,
                                            fontSize: '0.7rem',
                                            bgcolor: 'rgba(0, 124, 102, 0.1)',
                                            color: 'primary.dark',
                                          }}
                                        />
                                      )}
                                      <Chip
                                        size="small"
                                        label={dashboard.folder || 'Unsorted'}
                                        sx={{
                                          ml: isStudyPackDashboard(dashboard)
                                            ? 0
                                            : 1,
                                          height: 20,
                                          fontSize: '0.7rem',
                                          bgcolor: `${normalizeFolderColor(
                                            dashboard.folderColor,
                                          )}22`,
                                          color: normalizeFolderColor(
                                            dashboard.folderColor,
                                          ),
                                        }}
                                      />
                                      {dashboard.isPublic && (
                                        <Chip
                                          size="small"
                                          label="Public"
                                          icon={
                                            <PublicIcon
                                              style={{ width: 12, height: 12 }}
                                            />
                                          }
                                          sx={{
                                            ml: 1,
                                            height: 20,
                                            fontSize: '0.7rem',
                                            bgcolor: 'rgba(0, 124, 102, 0.14)',
                                            color: 'primary.dark',
                                            '& .MuiChip-icon': {
                                              color: 'primary.dark',
                                            },
                                          }}
                                        />
                                      )}
                                    </Box>
                                  </Box>
                                  {dashboard.tags &&
                                    dashboard.tags.length > 0 && (
                                      <Box
                                        sx={{
                                          display: { xs: 'none', sm: 'flex' },
                                          flexWrap: 'wrap',
                                          gap: 0.5,
                                          mt: 1,
                                        }}
                                      >
                                        {dashboard.tags.map((tag, tagIndex) => (
                                          <Chip
                                            key={tagIndex}
                                            label={tag}
                                            size="small"
                                            sx={{
                                              height: 18,
                                              fontSize: '0.65rem',
                                              bgcolor: 'action.hover',
                                              color: 'text.secondary',
                                            }}
                                          />
                                        ))}
                                      </Box>
                                    )}
                                  {isStudyPackDashboard(dashboard) && (
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        gap: 1,
                                        alignItems: 'center',
                                        mt: 1,
                                      }}
                                    >
                                      <Chip
                                        size="small"
                                        label="Progress ready"
                                        sx={{
                                          height: 18,
                                          fontSize: '0.65rem',
                                          bgcolor: 'action.hover',
                                          color: 'text.secondary',
                                        }}
                                      />
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        XP, streaks, and mastery can attach here
                                        after practice data exists.
                                      </Typography>
                                    </Box>
                                  )}
                                  <Box
                                    onClick={(e) => e.stopPropagation()}
                                    sx={{
                                      display: 'flex',
                                      gap: 1,
                                      flexWrap: 'wrap',
                                      mt: 1.25,
                                    }}
                                  >
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<AutoAwesomeIcon />}
                                      onClick={(e) =>
                                        handleStudyAction(
                                          'generate-exercises',
                                          dashboard,
                                          e,
                                        )
                                      }
                                      title="Request new practice exercises from this Study Guide"
                                      sx={{
                                        borderColor: 'primary.main',
                                        color: 'primary.dark',
                                        bgcolor: 'background.paper',
                                        textTransform: 'none',
                                        fontWeight: 800,
                                      }}
                                    >
                                      Generate more exercises
                                    </Button>
                                    <Button
                                      size="small"
                                      startIcon={<ReplayIcon />}
                                      onClick={(e) =>
                                        handleStudyAction(
                                          'practice-again',
                                          dashboard,
                                          e,
                                        )
                                      }
                                      title="Open this Study Guide for another practice session"
                                      sx={{
                                        color: 'primary.dark',
                                        textTransform: 'none',
                                        fontWeight: 800,
                                      }}
                                    >
                                      Practice again
                                    </Button>
                                    <Button
                                      size="small"
                                      startIcon={<QuizIcon />}
                                      onClick={(e) =>
                                        handleStudyAction(
                                          'create-quiz',
                                          dashboard,
                                          e,
                                        )
                                      }
                                      title="Request a quiz from this Study Guide lesson"
                                      sx={{
                                        color: 'primary.dark',
                                        textTransform: 'none',
                                        fontWeight: 800,
                                      }}
                                    >
                                      Create quiz from section
                                    </Button>
                                  </Box>
                                </Box>
                              </Box>
                              <Box
                                onClick={(e) => e.stopPropagation()}
                                sx={{
                                  position: { xs: 'absolute', sm: 'static' },
                                  top: { xs: '8px', sm: 'auto' },
                                  right: { xs: '8px', sm: 'auto' },
                                }}
                              >
                                {isAdmin && (
                                  <>
                                    {/* xs: overflow menu, sm+: inline icons */}
                                    <Box
                                      sx={{
                                        display: { xs: 'block', sm: 'none' },
                                      }}
                                    >
                                      <IconButton
                                        size="small"
                                        sx={{ color: 'text.secondary' }}
                                        onClick={(e) =>
                                          handleMenuOpen(dashboard, e)
                                        }
                                      >
                                        <MoreVertIcon fontSize="small" />
                                      </IconButton>
                                    </Box>
                                    <Box
                                      sx={{
                                        display: { xs: 'none', sm: 'flex' },
                                      }}
                                    >
                                      <Tooltip title="Edit details">
                                        <IconButton
                                          size="small"
                                          onClick={(e) =>
                                            handleEditDashboard(dashboard, e)
                                          }
                                          sx={{
                                            mr: 1,
                                            bgcolor: 'rgba(0,150,136,0.1)',
                                            color: 'primary.dark',
                                            '&:hover': {
                                              bgcolor: 'rgba(0,150,136,0.18)',
                                            },
                                          }}
                                        >
                                          <EditIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip
                                        title={
                                          dashboard.isPublic
                                            ? 'Make Private'
                                            : 'Make Public'
                                        }
                                      >
                                        <IconButton
                                          size="small"
                                          onClick={(e) =>
                                            handleTogglePublic(dashboard.id, e)
                                          }
                                          sx={{
                                            mr: 1,
                                            bgcolor: dashboard.isPublic
                                              ? 'rgba(0,124,102,0.14)'
                                              : 'action.hover',
                                            color: 'primary.dark',
                                            '&:hover': {
                                              bgcolor: dashboard.isPublic
                                                ? 'rgba(0,124,102,0.2)'
                                                : 'rgba(0,124,102,0.08)',
                                            },
                                          }}
                                        >
                                          {dashboard.isPublic ? (
                                            <LockIcon fontSize="small" />
                                          ) : (
                                            <PublicIcon fontSize="small" />
                                          )}
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Delete from Library">
                                        <IconButton
                                          size="small"
                                          color="error"
                                          onClick={(e) =>
                                            handleDeleteDashboard(
                                              dashboard.id,
                                              e,
                                            )
                                          }
                                          sx={{
                                            bgcolor: 'rgba(211,47,47,0.1)',
                                            '&:hover': {
                                              bgcolor: 'rgba(211,47,47,0.2)',
                                            },
                                          }}
                                        >
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </Box>
                                    {/* Mobile action menu */}
                                    <Menu
                                      anchorEl={menuAnchorEl}
                                      open={
                                        Boolean(menuAnchorEl) &&
                                        menuDashboard?.id === dashboard.id
                                      }
                                      onClose={handleMenuClose}
                                      anchorOrigin={{
                                        vertical: 'bottom',
                                        horizontal: 'right',
                                      }}
                                      transformOrigin={{
                                        vertical: 'top',
                                        horizontal: 'right',
                                      }}
                                    >
                                      <MenuItem
                                        onClick={(
                                          e: React.MouseEvent<HTMLElement>,
                                        ) => {
                                          handleEditDashboard(dashboard, e)
                                          handleMenuClose()
                                        }}
                                      >
                                        Edit
                                      </MenuItem>
                                      <MenuItem
                                        onClick={(
                                          e: React.MouseEvent<HTMLElement>,
                                        ) => {
                                          handleTogglePublic(dashboard.id, e)
                                          handleMenuClose()
                                        }}
                                      >
                                        {dashboard.isPublic
                                          ? 'Make Private'
                                          : 'Make Public'}
                                      </MenuItem>
                                      <MenuItem
                                        onClick={(
                                          e: React.MouseEvent<HTMLElement>,
                                        ) => {
                                          handleDeleteDashboard(dashboard.id, e)
                                          handleMenuClose()
                                        }}
                                      >
                                        Delete
                                      </MenuItem>
                                    </Menu>
                                  </>
                                )}
                              </Box>
                            </Box>
                            {dashboard.description && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  mt: { xs: 0.5, sm: 1 },
                                  pl: { xs: 0, sm: 7 },
                                  textAlign: { xs: 'center', sm: 'left' },
                                  fontSize: { xs: '0.7rem', sm: '0.875rem' },
                                }}
                              >
                                {dashboard.description}
                              </Typography>
                            )}
                          </Box>
                        </Paper>
                      </Fade>
                    ))}
                  </Box>
                ),
              )}
            </List>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
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

      {/* Delete Confirmation Dialog - Replace with the imported DeleteConfirmationDialog */}
      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        title="Delete from Library"
        content="Are you sure you want to delete this Study Guide or workspace? Export first if you need a backup. This action cannot be undone."
        onConfirm={confirmDeleteDashboard}
        onCancel={cancelDeleteDashboard}
      />

      <Dialog
        open={bulkDeleteOpen}
        onClose={cancelBulkDeleteDashboards}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: 'background.paper',
          },
        }}
      >
        <DialogTitle
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <DeleteIcon color="error" />
            <Box>
              <Typography variant="h6" fontWeight={800}>
                {bulkDeleteTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select the exact library items to delete.
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ bgcolor: 'background.default', p: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {bulkDeleteSelectedIds.length} of {bulkDeleteCandidates.length} item
            {bulkDeleteCandidates.length === 1 ? '' : 's'} selected.
          </Typography>
          <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
            {bulkDeleteGroups.map(({ folderName, dashboards, folderColor }) => {
              const folderIds = dashboards.map((dashboard) => dashboard.id)
              const selectedInFolder = folderIds.filter((id) =>
                bulkDeleteSelectedIds.includes(id),
              )
              const folderChecked =
                selectedInFolder.length === dashboards.length
              const folderIndeterminate =
                selectedInFolder.length > 0 &&
                selectedInFolder.length < dashboards.length

              return (
                <Paper
                  key={folderName}
                  elevation={0}
                  sx={{
                    mb: 1.5,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    overflow: 'hidden',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.5,
                      py: 1,
                      borderLeft: '4px solid',
                      borderLeftColor: folderColor,
                      bgcolor: `${folderColor}10`,
                    }}
                  >
                    <Checkbox
                      checked={folderChecked}
                      indeterminate={folderIndeterminate}
                      onChange={(event) =>
                        setBulkDeleteFolderSelected(
                          folderName,
                          event.target.checked,
                        )
                      }
                      inputProps={{
                        'aria-label': `Select ${folderName} folder items`,
                      }}
                    />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography fontWeight={800}>{folderName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dashboards.length} item
                        {dashboards.length === 1 ? '' : 's'}
                      </Typography>
                    </Box>
                  </Box>
                  {dashboards.map((dashboard) => (
                    <Box
                      key={dashboard.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1.5,
                        py: 1,
                        borderTop: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Checkbox
                        checked={bulkDeleteSelectedIds.includes(dashboard.id)}
                        onChange={() => toggleBulkDeleteDashboard(dashboard.id)}
                        inputProps={{
                          'aria-label': `Select ${dashboard.name}`,
                        }}
                      />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {dashboard.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Updated{' '}
                          {new Date(dashboard.updatedAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Paper>
              )
            })}
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            px: 2,
            py: 1.5,
          }}
        >
          <Button onClick={cancelBulkDeleteDashboards}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={bulkDeleteSelectedIds.length === 0}
            onClick={confirmBulkDeleteDashboards}
            startIcon={<DeleteIcon />}
          >
            Delete selected
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dashboard Dialog */}
      <EditDashboardDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        dashboard={dashboardToEdit}
        onSave={handleSaveEditedDashboard}
        folderOptions={folderOptions}
        folderColorsByName={folderColorsByName}
      />
    </>
  )
}

// Create the EditDashboardDialog component
const EditDashboardDialog: React.FC<EditDashboardDialogProps> = ({
  open,
  onClose,
  dashboard,
  onSave,
  folderOptions,
  folderColorsByName,
}) => {
  const [name, setName] = useState('')
  const [folder, setFolder] = useState('Default')
  const [folderColor, setFolderColor] = useState(DEFAULT_FOLDER_COLOR)
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [isPublic, setIsPublic] = useState(false)
  const [tagInput, setTagInput] = useState('')

  const updateFolder = (nextFolder: string) => {
    setFolder(nextFolder)

    const normalizedFolder = normalizeFolderName(nextFolder)
    const existingFolderColor = folderColorsByName[normalizedFolder]

    if (existingFolderColor) {
      setFolderColor(existingFolderColor)
    }
  }

  // Initialize form values when dashboard changes
  useEffect(() => {
    if (dashboard) {
      setName(dashboard.name)
      setFolder(dashboard.folder || 'Default')
      setFolderColor(normalizeFolderColor(dashboard.folderColor))
      setDescription(dashboard.description || '')
      setTags(dashboard.tags || [])
      setIsPublic(dashboard.isPublic || false)
    }
  }, [dashboard])

  // Handle form submission
  const handleSubmit = () => {
    if (dashboard && name.trim()) {
      const updatedDashboard: SavedDashboard = {
        ...dashboard,
        name: name.trim(),
        folder: normalizeFolderName(folder),
        folderColor: normalizeFolderColor(folderColor),
        description: description.trim() || 'No description',
        tags: tags.length > 0 ? tags : ['dashboard'],
        isPublic,
        updatedAt: new Date().toISOString(),
      }
      onSave(updatedDashboard)
    }
  }

  // Handle adding a tag
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  // Handle removing a tag
  const handleRemoveTag = (tagToDelete: string) => {
    setTags(tags.filter((tag) => tag !== tagToDelete))
  }

  // Handle tag input key down
  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 2,
        }}
      >
        <Box display="flex" alignItems="center">
          <EditIcon sx={{ mr: 1.5, color: 'primary.main' }} />
          <Typography variant="h6" component="div" fontWeight="bold">
            Edit Library Item
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          aria-label="close"
          sx={{ color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, bgcolor: 'background.default' }}>
        <Box component="form" sx={{ mt: 1 }}>
          <TextField
            fullWidth
            label="Study Guide Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => {
              e.target.select()
            }}
            margin="normal"
            required
            InputLabelProps={{ shrink: true, sx: { color: 'text.secondary' } }}
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

          <Autocomplete
            freeSolo
            options={folderOptions}
            value={folder}
            inputValue={folder}
            onChange={(_, nextValue) => updateFolder(nextValue || '')}
            onInputChange={(_, nextInputValue) => {
              updateFolder(nextInputValue)
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                label="Folder"
                margin="normal"
                helperText="Use a subject or folder name such as Mathematics, French, or Exam Prep."
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
                  onClick={() => setFolderColor(color)}
                  sx={{
                    width: 32,
                    height: 32,
                    border: '2px solid',
                    borderColor:
                      normalizeFolderColor(folderColor) === color
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
                value={normalizeFolderColor(folderColor)}
                onChange={(e) => setFolderColor(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={{ width: 96 }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              The color is applied to every item in this subject.
            </Typography>
          </Box>

          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onFocus={(e) => {
              e.target.select()
            }}
            margin="normal"
            multiline
            rows={3}
            InputLabelProps={{ shrink: true, sx: { color: 'text.secondary' } }}
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
              {tags.map((tag, index) => (
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
              {tags.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No tags added yet
                </Typography>
              )}
            </Box>
          </Box>

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
            label="Make visible in shared library"
            sx={{
              color: 'text.primary',
              mt: 2,
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          p: 3,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Button
          onClick={onClose}
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
          onClick={handleSubmit}
          variant="contained"
          disabled={!name.trim()}
          sx={{
            bgcolor: 'primary.light',
            color: '#191919',
            '&:hover': {
              bgcolor: 'primary.main',
            },
          }}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SavedDashboardsDialog
