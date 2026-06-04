import type { SavedDashboard } from '../components/Dasboard/dashboardStorage'
import type {
  CustomWidget,
  WidgetVersion,
} from '../components/WidgetEditor/WidgetStorage'
import type { StateDashboard } from '../state/store'
import type {
  LocalWorkspaceSnapshot,
  StudyGuideRecord,
  StudyPathProgressCache,
} from './types'

export const CLOUD_CACHE_KEYS = {
  dashboards: 'customDashboards',
  workspaceState: 'studymesh-storage',
  widgets: 'studymesh_custom_widgets',
  widgetVersions: 'studymesh_widget_versions',
  studyGuides: 'studymesh_study_guides',
  studyPathProgress: 'studymesh-study-path-progress-v1',
  owner: 'studymesh-cloud-cache-owner-v1',
} as const

export const CLOUD_LEGACY_CACHE_KEYS = {
  workspaceState: 'aquamesh-storage',
  widgets: 'aquamesh_custom_widgets',
  widgetVersions: 'aquamesh_widget_versions',
  studyPathProgress: 'aquamesh-study-path-progress-v1',
} as const

const hasBrowserStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

export const readJsonCache = <T>(key: string, fallback: T): T => {
  if (!hasBrowserStorage()) {
    return fallback
  }

  try {
    const stored = window.localStorage.getItem(key)
    return stored ? (JSON.parse(stored) as T) : fallback
  } catch {
    return fallback
  }
}

export const writeJsonCache = <T>(key: string, value: T): void => {
  if (!hasBrowserStorage()) {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

export const removeJsonCache = (key: string): void => {
  if (!hasBrowserStorage()) {
    return
  }

  window.localStorage.removeItem(key)
}

export const readDashboardsCache = (): SavedDashboard[] =>
  readJsonCache<SavedDashboard[]>(CLOUD_CACHE_KEYS.dashboards, [])

export const writeDashboardsCache = (dashboards: SavedDashboard[]): void => {
  writeJsonCache(CLOUD_CACHE_KEYS.dashboards, dashboards)
}

export const readWidgetsCache = (): CustomWidget[] =>
  readJsonCache<CustomWidget[]>(CLOUD_CACHE_KEYS.widgets, [])

export const writeWidgetsCache = (widgets: CustomWidget[]): void => {
  writeJsonCache(CLOUD_CACHE_KEYS.widgets, widgets)
}

export const readWidgetVersionsCache = (): WidgetVersion[] =>
  readJsonCache<WidgetVersion[]>(CLOUD_CACHE_KEYS.widgetVersions, [])

export const writeWidgetVersionsCache = (
  widgetVersions: WidgetVersion[],
): void => {
  writeJsonCache(CLOUD_CACHE_KEYS.widgetVersions, widgetVersions)
}

export const readStudyGuidesCache = (): StudyGuideRecord[] =>
  readJsonCache<StudyGuideRecord[]>(CLOUD_CACHE_KEYS.studyGuides, [])

export const writeStudyGuidesCache = (
  studyGuides: StudyGuideRecord[],
): void => {
  writeJsonCache(CLOUD_CACHE_KEYS.studyGuides, studyGuides)
}

export const readWorkspaceStateCache = (): {
  selectedDashboard: number
  openDashboards: StateDashboard[]
} | null => {
  const stored = readJsonCache<{
    state?: {
      selectedDashboard?: number
      openDashboards?: StateDashboard[]
    }
  } | null>(CLOUD_CACHE_KEYS.workspaceState, null)

  const state = stored?.state
  if (!state || !Array.isArray(state.openDashboards)) {
    return null
  }

  return {
    selectedDashboard:
      typeof state.selectedDashboard === 'number' ? state.selectedDashboard : 0,
    openDashboards: state.openDashboards,
  }
}

export const writeWorkspaceStateCache = (workspaceState: {
  selectedDashboard: number
  openDashboards: StateDashboard[]
}): void => {
  writeJsonCache(CLOUD_CACHE_KEYS.workspaceState, {
    state: workspaceState,
    version: 0,
  })
}

export const clearWorkspaceStateCache = (): void => {
  removeJsonCache(CLOUD_CACHE_KEYS.workspaceState)
}

export const readStudyPathProgressCache = (): StudyPathProgressCache | null => {
  const current = readJsonCache<StudyPathProgressCache | null>(
    CLOUD_CACHE_KEYS.studyPathProgress,
    null,
  )

  if (current) {
    return current
  }

  return readJsonCache<StudyPathProgressCache | null>(
    CLOUD_LEGACY_CACHE_KEYS.studyPathProgress,
    null,
  )
}

export const writeStudyPathProgressCache = (
  progress: StudyPathProgressCache | null,
): void => {
  if (progress) {
    writeJsonCache(CLOUD_CACHE_KEYS.studyPathProgress, progress)
  } else {
    removeJsonCache(CLOUD_CACHE_KEYS.studyPathProgress)
    removeJsonCache(CLOUD_LEGACY_CACHE_KEYS.studyPathProgress)
  }
}

export const readWorkspaceCacheOwner = (): string | null =>
  readJsonCache<string | null>(CLOUD_CACHE_KEYS.owner, null)

export const writeWorkspaceCacheOwner = (ownerId: string): void => {
  writeJsonCache(CLOUD_CACHE_KEYS.owner, ownerId)
}

export const isWorkspaceCacheOwnedBy = (ownerId: string): boolean =>
  readWorkspaceCacheOwner() === ownerId

export const isWorkspaceCacheUnowned = (): boolean =>
  readWorkspaceCacheOwner() === null

export const readLocalWorkspaceSnapshot = (): LocalWorkspaceSnapshot => ({
  dashboards: readDashboardsCache(),
  studyGuides: readStudyGuidesCache(),
  widgets: readWidgetsCache(),
  widgetVersions: readWidgetVersionsCache(),
  workspaceState: readWorkspaceStateCache(),
  studyProgress: readStudyPathProgressCache(),
})

export const writeLocalWorkspaceSnapshot = (
  snapshot: LocalWorkspaceSnapshot,
): void => {
  writeDashboardsCache(snapshot.dashboards)
  writeStudyGuidesCache(snapshot.studyGuides)
  writeWidgetsCache(snapshot.widgets)
  writeWidgetVersionsCache(snapshot.widgetVersions)

  if (snapshot.workspaceState) {
    writeWorkspaceStateCache(snapshot.workspaceState)
  } else {
    clearWorkspaceStateCache()
  }

  writeStudyPathProgressCache(snapshot.studyProgress)
}
