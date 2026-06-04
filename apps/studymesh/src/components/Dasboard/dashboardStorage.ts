import { DashboardLayout } from '../../state/store'
import { normalizeFolderColor, normalizeFolderName } from './folderColors'

export interface SavedDashboard {
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

export const DEFAULT_DASHBOARD_NAME = 'New Dashboard'
export const SAVED_DASHBOARDS_CHANGED_EVENT =
  'studymesh-saved-dashboards-changed'

export interface SavedDashboardsChangedDetail {
  action?: 'save' | 'delete'
  dashboardId?: string
}

const dispatchSavedDashboardsChanged = (
  detail: SavedDashboardsChangedDetail = {},
) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<SavedDashboardsChangedDetail>(
        SAVED_DASHBOARDS_CHANGED_EVENT,
        { detail },
      ),
    )
  }
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const getUniqueDashboardName = (
  requestedName: string,
  dashboards: SavedDashboard[],
  ignoreDashboardId?: string,
) => {
  const baseName = requestedName.trim() || DEFAULT_DASHBOARD_NAME
  const usedNames = new Set(
    dashboards
      .filter((dashboard) => dashboard.id !== ignoreDashboardId)
      .map((dashboard) => dashboard.name),
  )

  if (!usedNames.has(baseName)) {
    return baseName
  }

  const suffixPattern = new RegExp(`^${escapeRegExp(baseName)} \\((\\d+)\\)$`)
  let nextSuffix = 2

  usedNames.forEach((name) => {
    const match = name.match(suffixPattern)
    if (match) {
      nextSuffix = Math.max(nextSuffix, Number(match[1]) + 1)
    }
  })

  let candidate = `${baseName} (${nextSuffix})`
  while (usedNames.has(candidate)) {
    nextSuffix += 1
    candidate = `${baseName} (${nextSuffix})`
  }

  return candidate
}

export const DashboardStorage = {
  getAll: (): SavedDashboard[] => {
    try {
      const dashboards = localStorage.getItem('customDashboards')
      return dashboards ? JSON.parse(dashboards) : []
    } catch (error) {
      console.error('Failed to parse saved dashboards', error)
      return []
    }
  },

  getByName: (name: string): SavedDashboard | null => {
    try {
      const dashboards = DashboardStorage.getAll()
      return dashboards.find((dashboard) => dashboard.name === name) || null
    } catch (error) {
      console.error('Failed to find dashboard by name', error)
      return null
    }
  },

  save: (dashboard: SavedDashboard): SavedDashboard => {
    try {
      const dashboards = DashboardStorage.getAll()
      const existingIndex = dashboards.findIndex((d) => d.id === dashboard.id)

      if (existingIndex >= 0) {
        dashboards[existingIndex] = dashboard
      } else {
        dashboards.push(dashboard)
      }

      localStorage.setItem('customDashboards', JSON.stringify(dashboards))
      dispatchSavedDashboardsChanged({
        action: 'save',
        dashboardId: dashboard.id,
      })
      return dashboard
    } catch (error) {
      console.error('Failed to save dashboard', error)
      throw error
    }
  },

  delete: (id: string): void => {
    try {
      const dashboards = DashboardStorage.getAll()
      const filteredDashboards = dashboards.filter(
        (dashboard) => dashboard.id !== id,
      )
      localStorage.setItem(
        'customDashboards',
        JSON.stringify(filteredDashboards),
      )
      dispatchSavedDashboardsChanged({ action: 'delete', dashboardId: id })
    } catch (error) {
      console.error('Failed to delete dashboard', error)
    }
  },

  getFolderColor: (folder: string): string => {
    const folderName = normalizeFolderName(folder)
    const dashboard = DashboardStorage.getAll().find(
      (savedDashboard) =>
        normalizeFolderName(savedDashboard.folder) === folderName &&
        savedDashboard.folderColor,
    )

    return normalizeFolderColor(dashboard?.folderColor)
  },

  hasChanges: (name: string, currentLayout?: DashboardLayout): boolean => {
    const savedDashboard = DashboardStorage.getByName(name)
    if (!savedDashboard) {
      return true
    }

    if (!currentLayout) {
      return false
    }

    return (
      JSON.stringify(currentLayout) !== JSON.stringify(savedDashboard.layout)
    )
  },
}
