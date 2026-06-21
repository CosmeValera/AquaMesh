import { useCallback } from 'react'

import { useDashboards } from '../components/Dasboard/DashboardProvider'
import { DashboardLayout } from '../state/store'
import { createStudyPathContainerState } from '../components/Dasboard/studyPathContainer'
import { SAVED_DASHBOARDS_CHANGED_EVENT } from '../components/Dasboard/dashboardStorage'
import {
  StudyGuideStorage,
  createStudyGuideRecord,
} from '../studyGuides/storage'
import {
  createQuickCreateDashboardLayout,
  QuickCreateDashboardLayoutMode,
} from '../quickCreate'
import { ComponentData } from '../components/WidgetEditor/types/types'
import {
  STUDYMESH_GUIDE_STUDY_PATH_ID,
  STUDYMESH_GUIDE_FOLDER_NAME,
  ensureStarterDashboards,
} from '../studyGuides/studyMeshGuideSeed'

export { ensureStarterDashboards } from '../studyGuides/studyMeshGuideSeed'

export const OPEN_SAVED_DASHBOARDS_EVENT = 'studymesh-open-saved-dashboards'
export const OPEN_STUDY_PATH_EVENT = 'studymesh-open-study-path'
export const OPEN_CREATE_HUB_EVENT = 'studymesh-open-create-hub'
export const STARTER_STUDY_PATH_FOLDER_NAME = STUDYMESH_GUIDE_FOLDER_NAME

interface SavedDashboardRecord {
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

const getSavedDashboards = (): SavedDashboardRecord[] => {
  try {
    const dashboards = window.localStorage.getItem('customDashboards')
    return dashboards ? JSON.parse(dashboards) : []
  } catch (error) {
    console.error('Failed to read saved dashboards', error)
    return []
  }
}

const getUniqueSavedDashboardName = (
  requestedName: string,
  dashboards: SavedDashboardRecord[],
) => {
  const baseName = requestedName.trim() || 'Quick Create'
  const usedNames = new Set(dashboards.map((dashboard) => dashboard.name))

  if (!usedNames.has(baseName)) {
    return baseName
  }

  let suffix = 2
  let candidate = `${baseName} (${suffix})`
  while (usedNames.has(candidate)) {
    suffix += 1
    candidate = `${baseName} (${suffix})`
  }

  return candidate
}

const saveQuickCreateDashboard = (
  name: string,
  layout: DashboardLayout,
  folderName = 'Quick Creates',
): SavedDashboardRecord => {
  const dashboards = getSavedDashboards()
  const now = new Date().toISOString()
  const dashboard: SavedDashboardRecord = {
    id: `quick-create-dashboard-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
    name: getUniqueSavedDashboardName(name, dashboards),
    folder: folderName.trim() || 'Quick Creates',
    folderColor: '#007C66',
    layout,
    description: 'Generated from student notes.',
    tags: ['quick-create', 'notes'],
    isPublic: false,
    createdAt: now,
    updatedAt: now,
  }

  window.localStorage.setItem(
    'customDashboards',
    JSON.stringify([...dashboards, dashboard]),
  )
  window.dispatchEvent(new Event(SAVED_DASHBOARDS_CHANGED_EVENT))

  return dashboard
}

export const useWorkspaceActions = () => {
  const {
    addDashboards,
    addStudyPathContainer,
  } = useDashboards()

  const openCreateStudyPath = useCallback((options?: { toggle?: boolean }) => {
    window.dispatchEvent(
      new CustomEvent(OPEN_STUDY_PATH_EVENT, { detail: options }),
    )
  }, [])

  const openCreateHub = useCallback(
    (options?: { toggle?: boolean; intent?: string }) => {
      window.dispatchEvent(
        new CustomEvent(OPEN_CREATE_HUB_EVENT, { detail: options }),
      )
    },
    [],
  )

  const createQuickCreateDashboards = useCallback(
    ({
      dashboards,
      folderName = 'Quick Creates',
      openInWorkspace = true,
    }: {
      folderName?: string
      openInWorkspace?: boolean
      dashboards: Array<{
        name: string
        widgets: Array<{
          name: string
          components: ComponentData[]
          category?: string
          tags?: string[]
          description?: string
          version?: string
          author?: string
        }>
        layoutMode?: QuickCreateDashboardLayoutMode
        folderName?: string
      }>
    }) => {
      const generatedDashboards = dashboards.map((dashboard) => {
        const now = new Date().toISOString()
        const embeddedWidgets = dashboard.widgets.map((widget) => ({
          id: `embedded-widget-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          name: widget.name,
          components: widget.components,
          category: widget.category || 'Quick Create',
          tags: widget.tags || ['quick-create', 'embedded-generated'],
          description: widget.description || 'Generated from student notes.',
          version: widget.version || '1.0',
          author: widget.author || 'StudyMesh',
          createdAt: now,
          updatedAt: now,
        }))
        const layout = createQuickCreateDashboardLayout(embeddedWidgets, {
          mode: dashboard.layoutMode || 'smart',
        })

        return {
          id: `quick-create-dashboard-${Date.now()}-${Math.floor(
            Math.random() * 1000000,
          )}`,
          name: dashboard.name,
          folder: (dashboard.folderName || folderName).trim() || 'Quick Creates',
          folderColor: '#007C66',
          layout,
          description: 'Generated from student notes.',
          tags: ['quick-create', 'notes'],
          isPublic: false,
          createdAt: now,
          updatedAt: now,
        }
      })
      const studyPath = createStudyPathContainerState(generatedDashboards)
      const savedDashboards = studyPath
        ? generatedDashboards
        : generatedDashboards.map((dashboard) =>
            saveQuickCreateDashboard(
              dashboard.name,
              dashboard.layout,
              dashboard.folder || folderName,
            ),
          )

      if (studyPath) {
        StudyGuideStorage.save(createStudyGuideRecord(studyPath))
      }

      if (openInWorkspace) {
        if (studyPath) {
          addStudyPathContainer(studyPath)
        } else {
          addDashboards(
            savedDashboards.map((dashboard) => ({
              name: dashboard.name,
              layout: dashboard.layout,
            })),
            { replaceEmptySelected: true },
          )
        }
      }

      return savedDashboards
    },
    [addDashboards, addStudyPathContainer],
  )

  const openStudyMeshGuide = useCallback(() => {
    ensureStarterDashboards()
    const guide = StudyGuideStorage.getAll().find(
      (studyGuide) => studyGuide.id === STUDYMESH_GUIDE_STUDY_PATH_ID,
    )

    if (guide) {
      addStudyPathContainer(guide.studyPath)
    }
  }, [addStudyPathContainer])

  return {
    openCreateStudyPath,
    openCreateHub,
    createQuickCreateDashboards,
    openStudyMeshGuide,
  }
}
