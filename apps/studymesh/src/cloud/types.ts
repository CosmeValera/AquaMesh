import type { SupabaseClient } from '@supabase/supabase-js'
import type { SavedDashboard } from '../components/Dasboard/dashboardStorage'
import type {
  CustomWidget,
  WidgetVersion,
} from '../components/WidgetEditor/WidgetStorage'
import type { StateDashboard } from '../state/store'

export type CloudJson =
  | string
  | number
  | boolean
  | null
  | CloudJson[]
  | { [key: string]: CloudJson | undefined }

export type StudyPathProgressCache = {
  paths: Record<string, CloudJson>
}

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
  studyProgress?: StudyPathProgressCache
  settings?: Record<string, CloudJson>
  updatedAt: string
}

export interface LocalWorkspaceSnapshot {
  dashboards: SavedDashboard[]
  widgets: CustomWidget[]
  widgetVersions: WidgetVersion[]
  workspaceState: {
    selectedDashboard: number
    openDashboards: StateDashboard[]
  } | null
  studyProgress: StudyPathProgressCache | null
}

export interface CloudWorkspaceBundle {
  profile: UserProfile | null
  dashboards: SavedDashboard[]
  widgets: CustomWidget[]
  widgetVersions: WidgetVersion[]
  workspaceState: WorkspaceState | null
}

export interface DashboardMergeResult {
  readyToUpload: SavedDashboard[]
  conflictedLocalCopies: SavedDashboard[]
}

export type StudyMeshSupabaseClient = SupabaseClient

