import type { SupabaseClient } from '@supabase/supabase-js'
import type { SavedDashboard } from '../components/Dasboard/dashboardStorage'
import type {
  CustomWidget,
  WidgetVersion,
} from '../components/WidgetEditor/WidgetStorage'
import type { StateDashboard } from '../state/store'
import type { StudyPathContainerState } from '../state/store'

export type CloudJson =
  | string
  | number
  | boolean
  | null
  | CloudJson[]
  | { [key: string]: CloudJson | undefined }

export interface UserProfile {
  id: string
  email?: string
  displayName?: string
  avatarPath?: string
  role?: string
  createdAt?: string
  updatedAt?: string
}

export interface WorkspaceState {
  ownerId: string
  selectedDashboard: number
  openDashboards: StateDashboard[]
  settings?: Record<string, CloudJson>
  updatedAt: string
}

export interface LocalWorkspaceSnapshot {
  dashboards: SavedDashboard[]
  studyGuides: StudyGuideRecord[]
  widgets: CustomWidget[]
  widgetVersions: WidgetVersion[]
  workspaceState: {
    selectedDashboard: number
    openDashboards: StateDashboard[]
    settings?: Record<string, CloudJson>
  } | null
}

export interface CloudWorkspaceBundle {
  profile: UserProfile | null
  dashboards: SavedDashboard[]
  studyGuides: StudyGuideRecord[]
  widgets: CustomWidget[]
  widgetVersions: WidgetVersion[]
  workspaceState: WorkspaceState | null
}

export interface StudyGuideRecord {
  id: string
  title: string
  folderName: string
  description?: string
  emoji?: string
  pinnedAt?: string | null
  visitedPageKeys?: string[]
  studyPath: StudyPathContainerState
  createdAt: string
  updatedAt: string
}

export interface DashboardMergeResult {
  readyToUpload: SavedDashboard[]
  conflictedLocalCopies: SavedDashboard[]
}

export type StudyMeshSupabaseClient = SupabaseClient
