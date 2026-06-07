import type { SavedDashboard } from '../components/Dasboard/dashboardStorage'
import type {
  CustomWidget,
  WidgetVersion,
} from '../components/WidgetEditor/WidgetStorage'
import type { StateDashboard } from '../state/store'
import {
  createCloudRepository,
  mapDashboardRowToSavedDashboard,
  mapSavedDashboardToDashboardRow,
} from './repository'
import type {
  CloudJson,
  StudyMeshSupabaseClient,
  WorkspaceState,
} from './types'

interface LocalMigrationWorkspaceState {
  selectedDashboard: number
  openDashboards: StateDashboard[]
  settings?: Record<string, CloudJson>
  updatedAt: string
}

interface MigrationInput {
  nowIso: string
  local: {
    dashboards: SavedDashboard[]
    widgets: CustomWidget[]
    widgetVersions?: WidgetVersion[]
    workspaceState: LocalMigrationWorkspaceState | null
  }
  cloud: {
    dashboards: SavedDashboard[]
    widgets: CustomWidget[]
    workspaceState: WorkspaceState | null
  }
}

export const createWorkspaceCloudRepository = (
  client: StudyMeshSupabaseClient,
) => {
  const repository = createCloudRepository(client)

  return {
    ...repository,
    upsertWorkspaceState: (
      ownerId: string,
      workspaceState: Omit<WorkspaceState, 'ownerId'>,
    ) =>
      repository.upsertWorkspaceState({
        ...workspaceState,
        ownerId,
      }),
  }
}

const formatConflictSuffix = (nowIso: string) =>
  nowIso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', '')

const isNewerThan = (first?: string, second?: string) =>
  new Date(first || 0).getTime() > new Date(second || 0).getTime()

const valuesDiffer = (first: unknown, second: unknown) =>
  JSON.stringify(first) !== JSON.stringify(second)

const migrateByUpdatedAt = <T extends { id: string; name: string; updatedAt: string; createdAt: string }>(
  localItems: T[],
  cloudItems: T[],
  nowIso: string,
) => {
  const suffix = formatConflictSuffix(nowIso)
  const cloudById = new Map(cloudItems.map((item) => [item.id, item]))
  const replacements: Record<string, string> = {}
  const toUpsert: T[] = []

  localItems.forEach((localItem) => {
    const cloudItem = cloudById.get(localItem.id)

    if (!cloudItem || isNewerThan(localItem.updatedAt, cloudItem.updatedAt)) {
      toUpsert.push(localItem)
      return
    }

    if (valuesDiffer(localItem, cloudItem)) {
      const replacementId = `${localItem.id}-local-${suffix}`
      replacements[localItem.id] = replacementId
      toUpsert.push({
        ...localItem,
        id: replacementId,
        name: `${localItem.name} (local copy)`,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
    }
  })

  return { replacements, toUpsert }
}

const rewriteOpenDashboardIds = (
  dashboards: StateDashboard[],
  replacements: Record<string, string>,
) =>
  dashboards.map((dashboard) => ({
    ...dashboard,
    id: replacements[dashboard.id] || dashboard.id,
  }))

export const buildWorkspaceMigrationPlan = ({
  nowIso,
  local,
  cloud,
}: MigrationInput) => {
  const dashboardPlan = migrateByUpdatedAt(
    local.dashboards,
    cloud.dashboards,
    nowIso,
  )
  const widgetPlan = migrateByUpdatedAt(local.widgets, cloud.widgets, nowIso)
  const workspaceStateToUpsert =
    local.workspaceState &&
    (!cloud.workspaceState ||
      isNewerThan(local.workspaceState.updatedAt, cloud.workspaceState.updatedAt))
      ? {
          ...local.workspaceState,
          openDashboards: rewriteOpenDashboardIds(
            local.workspaceState.openDashboards,
            dashboardPlan.replacements,
          ),
        }
      : null

  return {
    dashboardsToUpsert: dashboardPlan.toUpsert,
    widgetsToUpsert: widgetPlan.toUpsert,
    widgetVersionsToUpsert: local.widgetVersions || [],
    workspaceStateToUpsert,
    localDashboardIdReplacements: dashboardPlan.replacements,
    localWidgetIdReplacements: widgetPlan.replacements,
  }
}

export {
  mapDashboardRowToSavedDashboard,
  mapSavedDashboardToDashboardRow,
}
