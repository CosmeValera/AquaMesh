import type { SavedDashboard } from '../components/Dasboard/dashboardStorage'
import type {
  CustomWidget,
  WidgetVersion,
} from '../components/WidgetEditor/WidgetStorage'
import type {
  CloudJson,
  CloudWorkspaceBundle,
  CloudWorkspaceSaveBundle,
  DashboardMergeResult,
  StudyGuideRecord,
  StudyGuideSummary,
  StudyMeshSupabaseClient,
  UserProfile,
  WorkspaceState,
} from './types'

const nowIso = () => new Date().toISOString()

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const toCloudJson = (value: unknown): CloudJson => cloneJson(value) as CloudJson

const assertSingle = async <T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T | null> => {
  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  return data
}

const assertMany = async <T>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> => {
  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

const assertMutation = async (
  query: PromiseLike<{ error: { message: string } | null }>,
): Promise<void> => {
  const { error } = await query
  if (error) {
    throw new Error(error.message)
  }
}

interface ProfileRow {
  id: string
  email?: string | null
  display_name?: string | null
  avatar_path?: string | null
  role?: string | null
  created_at?: string
  updated_at?: string
}

export interface DashboardRow {
  id: string
  owner_id: string
  title: string
  description?: string | null
  dashboard_type?: string | null
  visibility?: string | null
  layout: CloudJson
  referenced_widget_ids?: string[] | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface WidgetRow {
  id: string
  owner_id: string
  title: string
  widget_type?: string | null
  components: CloudJson
  metadata?: CloudJson | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface WidgetVersionRow {
  id?: string
  owner_id: string
  widget_id: string
  version: number
  title?: string | null
  components: CloudJson
  metadata?: CloudJson | null
  notes?: string | null
  created_at: string
}

export interface WorkspaceStateRow {
  owner_id: string
  selected_dashboard: string | null
  open_dashboards: CloudJson
  settings?: CloudJson | null
  updated_at: string
}

export interface StudyGuideRow {
  id: string
  owner_id: string
  title: string
  folder_name: string
  description?: string | null
  emoji?: string | null
  page_count?: number | null
  first_page_title?: string | null
  study_path: CloudJson
  created_at: string
  updated_at: string
}

export interface StudyGuideSummaryRow {
  id: string
  owner_id: string
  title: string
  folder_name: string
  description?: string | null
  emoji?: string | null
  page_count?: number | null
  first_page_title?: string | null
  created_at: string
  updated_at: string
}

const profileFromRow = (row: ProfileRow): UserProfile => ({
  id: row.id,
  email: row.email || undefined,
  displayName: row.display_name || undefined,
  avatarPath: row.avatar_path || undefined,
  role: row.role || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const profileToRow = (profile: UserProfile): ProfileRow => ({
  id: profile.id,
  email: profile.email,
  display_name: profile.displayName,
  avatar_path: profile.avatarPath,
  role: profile.role,
  updated_at: profile.updatedAt || nowIso(),
})

const metadataValue = (metadata: CloudJson | null | undefined, key: string) =>
  typeof metadata === 'object' && metadata && !Array.isArray(metadata)
    ? metadata[key]
    : undefined

export const mapDashboardRowToSavedDashboard = (
  row: DashboardRow,
): SavedDashboard => ({
  id: row.id,
  name: row.title,
  folder: undefined,
  folderColor: undefined,
  description: row.description || undefined,
  tags: [],
  isPublic: false,
  layout: cloneJson(row.layout) as SavedDashboard['layout'],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const mapSavedDashboardToDashboardRow = (
  ownerId: string,
  dashboard: SavedDashboard,
): DashboardRow => ({
  id: dashboard.id,
  owner_id: ownerId,
  title: dashboard.name,
  description: dashboard.description,
  dashboard_type: 'dashboard',
  visibility: 'private',
  layout: toCloudJson(dashboard.layout),
  referenced_widget_ids: extractReferencedWidgetIds(dashboard),
  created_at: dashboard.createdAt,
  updated_at: dashboard.updatedAt || nowIso(),
  deleted_at: null,
})

const widgetFromRow = (row: WidgetRow): CustomWidget => ({
  id: row.id,
  name: row.title,
  components: cloneJson(
    row.components,
  ) as unknown as CustomWidget['components'],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  category:
    typeof metadataValue(row.metadata, 'category') === 'string'
      ? (metadataValue(row.metadata, 'category') as string)
      : row.widget_type || 'Other',
  tags: Array.isArray(metadataValue(row.metadata, 'tags'))
    ? (metadataValue(row.metadata, 'tags') as unknown[]).filter(
        (tag): tag is string => typeof tag === 'string',
      )
    : [],
  description:
    typeof metadataValue(row.metadata, 'description') === 'string'
      ? (metadataValue(row.metadata, 'description') as string)
      : '',
  version:
    typeof metadataValue(row.metadata, 'version') === 'string'
      ? (metadataValue(row.metadata, 'version') as string)
      : '1.0',
  author:
    typeof metadataValue(row.metadata, 'author') === 'string'
      ? (metadataValue(row.metadata, 'author') as string)
      : '',
})

const widgetToRow = (ownerId: string, widget: CustomWidget): WidgetRow => ({
  id: widget.id,
  owner_id: ownerId,
  title: widget.name,
  widget_type: widget.category || 'Other',
  components: toCloudJson(widget.components),
  metadata: toCloudJson({
    category: widget.category || 'Other',
    tags: widget.tags || [],
    description: widget.description || '',
    version: widget.version || '1.0',
    author: widget.author || '',
  }),
  created_at: widget.createdAt,
  updated_at: widget.updatedAt || nowIso(),
  deleted_at: null,
})

const widgetVersionToNumber = (version: string): number => {
  const [major = '1', minor = '0'] = version.split('.')
  return Number(major) * 1000 + Number(minor)
}

const widgetVersionFromNumber = (version: number): string =>
  `${Math.floor(version / 1000)}.${version % 1000}`

const widgetVersionFromRow = (row: WidgetVersionRow): WidgetVersion => ({
  id: row.id || `${row.widget_id}-version-${row.version}`,
  widgetId: row.widget_id,
  version: widgetVersionFromNumber(row.version),
  components: cloneJson(
    row.components,
  ) as unknown as WidgetVersion['components'],
  createdAt: row.created_at,
  notes: row.notes || undefined,
  isCurrent: metadataValue(row.metadata, 'isCurrent') === true || undefined,
})

const widgetVersionToRow = (
  ownerId: string,
  version: WidgetVersion,
): WidgetVersionRow => ({
  owner_id: ownerId,
  widget_id: version.widgetId,
  version: widgetVersionToNumber(version.version),
  title: version.version,
  components: toCloudJson(version.components),
  metadata: toCloudJson({
    originalId: version.id,
    originalVersion: version.version,
    isCurrent: Boolean(version.isCurrent),
  }),
  notes: version.notes,
  created_at: version.createdAt,
})

const workspaceStateFromRow = (row: WorkspaceStateRow): WorkspaceState => ({
  ownerId: row.owner_id,
  selectedDashboard: Number(row.selected_dashboard || 0),
  openDashboards: cloneJson(
    row.open_dashboards,
  ) as unknown as WorkspaceState['openDashboards'],
  settings: row.settings
    ? (cloneJson(row.settings) as Record<string, CloudJson>)
    : undefined,
  updatedAt: row.updated_at,
})

const workspaceStateToRow = (
  workspaceState: WorkspaceState,
): WorkspaceStateRow => ({
  owner_id: workspaceState.ownerId,
  selected_dashboard: String(workspaceState.selectedDashboard),
  open_dashboards: toCloudJson(workspaceState.openDashboards),
  settings: workspaceState.settings ? toCloudJson(workspaceState.settings) : {},
  updated_at: workspaceState.updatedAt || nowIso(),
})

const studyGuideFromRow = (row: StudyGuideRow): StudyGuideRecord => {
  const studyPath = cloneJson(
    row.study_path,
  ) as unknown as StudyGuideRecord['studyPath']

  return {
    id: row.id,
    title: row.title,
    folderName: row.folder_name,
    description: row.description || undefined,
    emoji: row.emoji || studyPath.emoji,
    studyPath,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const studyGuideSummaryFromRow = (
  row: StudyGuideSummaryRow,
): StudyGuideSummary => ({
  id: row.id,
  title: row.title,
  folderName: row.folder_name,
  description: row.description || undefined,
  emoji: row.emoji || undefined,
  pageCount: row.page_count ?? undefined,
  firstPageTitle: row.first_page_title || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const studyGuideSummaryFromRecord = (
  record: StudyGuideRecord,
): StudyGuideSummary => ({
  id: record.id,
  title: record.title,
  folderName: record.folderName,
  description: record.description,
  emoji: record.emoji || record.studyPath.emoji,
  pageCount: record.studyPath.dashboards.length,
  firstPageTitle: record.studyPath.dashboards[0]?.name,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
})

const studyGuideSummaryToRow = (
  summary: StudyGuideSummary,
): Pick<
  StudyGuideSummaryRow,
  | 'title'
  | 'folder_name'
  | 'description'
  | 'emoji'
  | 'page_count'
  | 'first_page_title'
  | 'updated_at'
> => ({
  title: summary.title,
  folder_name: summary.folderName,
  description: summary.description,
  emoji: summary.emoji,
  page_count: summary.pageCount ?? null,
  first_page_title: summary.firstPageTitle || null,
  updated_at: summary.updatedAt || nowIso(),
})

const studyGuideToRow = (
  ownerId: string,
  studyGuide: StudyGuideRecord,
): StudyGuideRow => ({
  id: studyGuide.id,
  owner_id: ownerId,
  title: studyGuide.title,
  folder_name: studyGuide.folderName,
  description: studyGuide.description,
  emoji: studyGuide.emoji || studyGuide.studyPath.emoji,
  page_count: studyGuide.studyPath.dashboards.length,
  first_page_title: studyGuide.studyPath.dashboards[0]?.name || null,
  study_path: toCloudJson(studyGuide.studyPath),
  created_at: studyGuide.createdAt,
  updated_at: studyGuide.updatedAt || nowIso(),
})

const collectWidgetIds = (value: unknown, widgetIds: Set<string>): void => {
  if (!value || typeof value !== 'object') {
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectWidgetIds(item, widgetIds))
    return
  }

  const record = value as Record<string, unknown>
  const candidates = [
    record.widgetId,
    record.customWidgetId,
    record.savedWidgetId,
    record.id && record.component === 'CustomWidget' ? record.id : undefined,
  ]

  candidates.forEach((candidate) => {
    if (typeof candidate === 'string' && candidate.startsWith('widget-')) {
      widgetIds.add(candidate)
    }
  })

  Object.values(record).forEach((nested) => collectWidgetIds(nested, widgetIds))
}

export const extractReferencedWidgetIds = (
  dashboard: Pick<SavedDashboard, 'layout'>,
): string[] => {
  const widgetIds = new Set<string>()
  collectWidgetIds(dashboard.layout, widgetIds)
  return [...widgetIds]
}

export const createDashboardMergePlan = (
  localDashboards: SavedDashboard[],
  cloudDashboards: SavedDashboard[],
): DashboardMergeResult => {
  const cloudById = new Map(
    cloudDashboards.map((dashboard) => [dashboard.id, dashboard]),
  )
  const readyToUpload: SavedDashboard[] = []
  const conflictedLocalCopies: SavedDashboard[] = []

  localDashboards.forEach((localDashboard) => {
    const cloudDashboard = cloudById.get(localDashboard.id)
    if (!cloudDashboard) {
      readyToUpload.push(localDashboard)
      return
    }

    const localTime = new Date(localDashboard.updatedAt).getTime()
    const cloudTime = new Date(cloudDashboard.updatedAt).getTime()
    if (localTime > cloudTime) {
      readyToUpload.push(localDashboard)
      return
    }

    if (JSON.stringify(localDashboard) !== JSON.stringify(cloudDashboard)) {
      conflictedLocalCopies.push({
        ...localDashboard,
        id: `${localDashboard.id}-local-${Date.now()}`,
        name: `${localDashboard.name} (local copy)`,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })
    }
  })

  return { readyToUpload, conflictedLocalCopies }
}

export const createCloudRepository = (client: StudyMeshSupabaseClient) => ({
  async getProfile(userId: string): Promise<UserProfile | null> {
    const row = await assertSingle<ProfileRow>(
      client.from('profiles').select('*').eq('id', userId).maybeSingle(),
    )
    return row ? profileFromRow(row) : null
  },

  async upsertProfile(profile: UserProfile): Promise<UserProfile> {
    const row = profileToRow(profile)
    await assertMutation(
      client
        .from('profiles')
        .upsert(row, { onConflict: 'id' }),
    )

    return profileFromRow(row)
  },

  async deleteProfile(_userId: string): Promise<void> {
    const { data, error } = await client.rpc('delete_own_profile')

    if (error) {
      throw new Error(error.message)
    }

    const deletedCount = typeof data === 'number' ? data : Number(data)
    if (!Number.isFinite(deletedCount) || deletedCount < 1) {
      throw new Error(
        'StudyMesh profile was not deleted. Apply the delete_own_profile Supabase RPC, then try again.',
      )
    }
  },

  async listDashboards(ownerId: string): Promise<SavedDashboard[]> {
    const rows = await assertMany<DashboardRow>(
      client
        .from('user_dashboards')
        .select('*')
        .eq('owner_id', ownerId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false }),
    )
    return rows.map(mapDashboardRowToSavedDashboard)
  },

  async getDashboard(
    ownerId: string,
    dashboardId: string,
  ): Promise<SavedDashboard | null> {
    const row = await assertSingle<DashboardRow>(
      client
        .from('user_dashboards')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('id', dashboardId)
        .is('deleted_at', null)
        .maybeSingle(),
    )
    return row ? mapDashboardRowToSavedDashboard(row) : null
  },

  async upsertDashboard(
    ownerId: string,
    dashboard: SavedDashboard,
  ): Promise<SavedDashboard> {
    const row = mapSavedDashboardToDashboardRow(ownerId, dashboard)
    await assertMutation(
      client
        .from('user_dashboards')
        .upsert(row, {
          onConflict: 'owner_id,id',
        }),
    )

    return mapDashboardRowToSavedDashboard(row)
  },

  async deleteDashboard(ownerId: string, dashboardId: string): Promise<void> {
    const { error } = await client
      .from('user_dashboards')
      .delete()
      .eq('owner_id', ownerId)
      .eq('id', dashboardId)

    if (error) {
      throw new Error(error.message)
    }
  },

  async listWidgets(ownerId: string): Promise<CustomWidget[]> {
    const rows = await assertMany<WidgetRow>(
      client
        .from('user_widgets')
        .select('*')
        .eq('owner_id', ownerId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false }),
    )
    return rows.map(widgetFromRow)
  },

  async getWidget(
    ownerId: string,
    widgetId: string,
  ): Promise<CustomWidget | null> {
    const row = await assertSingle<WidgetRow>(
      client
        .from('user_widgets')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('id', widgetId)
        .is('deleted_at', null)
        .maybeSingle(),
    )
    return row ? widgetFromRow(row) : null
  },

  async upsertWidget(
    ownerId: string,
    widget: CustomWidget,
  ): Promise<CustomWidget> {
    const row = widgetToRow(ownerId, widget)
    await assertMutation(
      client
        .from('user_widgets')
        .upsert(row, { onConflict: 'owner_id,id' }),
    )

    return widgetFromRow(row)
  },

  async deleteWidget(ownerId: string, widgetId: string): Promise<void> {
    const { error } = await client
      .from('user_widgets')
      .delete()
      .eq('owner_id', ownerId)
      .eq('id', widgetId)

    if (error) {
      throw new Error(error.message)
    }
  },

  async listWidgetVersions(
    ownerId: string,
    widgetId?: string,
  ): Promise<WidgetVersion[]> {
    let query = client
      .from('user_widget_versions')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })

    if (widgetId) {
      query = query.eq('widget_id', widgetId)
    }

    const rows = await assertMany<WidgetVersionRow>(query)
    return rows.map(widgetVersionFromRow)
  },

  async upsertWidgetVersion(
    ownerId: string,
    version: WidgetVersion,
  ): Promise<WidgetVersion> {
    const row = widgetVersionToRow(ownerId, version)
    await assertMutation(
      client
        .from('user_widget_versions')
        .upsert(row, {
          onConflict: 'owner_id,widget_id,version',
        }),
    )

    return widgetVersionFromRow(row)
  },

  async deleteWidgetVersions(ownerId: string, widgetId: string): Promise<void> {
    const { error } = await client
      .from('user_widget_versions')
      .delete()
      .eq('owner_id', ownerId)
      .eq('widget_id', widgetId)

    if (error) {
      throw new Error(error.message)
    }
  },

  async getWorkspaceState(ownerId: string): Promise<WorkspaceState | null> {
    const row = await assertSingle<WorkspaceStateRow>(
      client
        .from('user_workspace_state')
        .select('owner_id,selected_dashboard,settings,updated_at')
        .eq('owner_id', ownerId)
        .maybeSingle(),
    )
    return row
      ? workspaceStateFromRow({
          ...row,
          open_dashboards: [],
        })
      : null
  },

  async upsertWorkspaceState(
    workspaceState: WorkspaceState,
  ): Promise<WorkspaceState> {
    const row = workspaceStateToRow(workspaceState)
    await assertMutation(
      client
        .from('user_workspace_state')
        .upsert(row, {
          onConflict: 'owner_id',
        }),
    )

    return workspaceStateFromRow(row)
  },

  async listStudyGuides(ownerId: string): Promise<StudyGuideSummary[]> {
    const rows = await assertMany<StudyGuideSummaryRow>(
      client
        .from('user_study_guides')
        .select(
          'id,owner_id,title,folder_name,description,emoji,page_count,first_page_title,created_at,updated_at',
        )
        .eq('owner_id', ownerId)
        .order('updated_at', { ascending: false }),
    )
    return rows.map(studyGuideSummaryFromRow)
  },

  async getStudyGuide(
    ownerId: string,
    studyGuideId: string,
  ): Promise<StudyGuideRecord | null> {
    const row = await assertSingle<StudyGuideRow>(
      client
        .from('user_study_guides')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('id', studyGuideId)
        .maybeSingle(),
    )
    return row ? studyGuideFromRow(row) : null
  },

  async updateStudyGuideSummary(
    ownerId: string,
    summary: StudyGuideSummary,
  ): Promise<StudyGuideSummary> {
    const row = studyGuideSummaryToRow(summary)
    await assertMutation(
      client
        .from('user_study_guides')
        .update(row)
        .eq('owner_id', ownerId)
        .eq('id', summary.id),
    )

    return {
      ...summary,
      updatedAt: row.updated_at,
    }
  },

  async upsertStudyGuide(
    ownerId: string,
    studyGuide: StudyGuideRecord,
  ): Promise<StudyGuideRecord> {
    const row = studyGuideToRow(ownerId, studyGuide)
    await assertMutation(
      client
        .from('user_study_guides')
        .upsert(row, {
          onConflict: 'owner_id,id',
        }),
    )

    return studyGuideFromRow(row)
  },

  async deleteStudyGuide(ownerId: string, studyGuideId: string): Promise<void> {
    const { error } = await client
      .from('user_study_guides')
      .delete()
      .eq('owner_id', ownerId)
      .eq('id', studyGuideId)

    if (error) {
      throw new Error(error.message)
    }
  },

  async loadWorkspaceBundle(ownerId: string): Promise<CloudWorkspaceBundle> {
    const [
      profile,
      dashboards,
      studyGuides,
      widgets,
      widgetVersions,
      workspaceState,
    ] = await Promise.all([
      this.getProfile(ownerId),
      this.listDashboards(ownerId),
      this.listStudyGuides(ownerId),
      this.listWidgets(ownerId),
      this.listWidgetVersions(ownerId),
      this.getWorkspaceState(ownerId),
    ])

    return {
      profile,
      dashboards,
      studyGuides,
      widgets,
      widgetVersions,
      workspaceState,
    }
  },

  async saveWorkspaceBundle(
    ownerId: string,
    bundle: CloudWorkspaceSaveBundle,
  ): Promise<CloudWorkspaceBundle> {
    const profile = bundle.profile
      ? await this.upsertProfile(bundle.profile)
      : await this.getProfile(ownerId)

    const widgets = await Promise.all(
      bundle.widgets.map((widget) => this.upsertWidget(ownerId, widget)),
    )
    const dashboards = await Promise.all(
      bundle.dashboards.map((dashboard) =>
        this.upsertDashboard(ownerId, dashboard),
      ),
    )
    const studyGuides = await Promise.all(
      bundle.studyGuides.map((studyGuide) =>
        this.upsertStudyGuide(ownerId, studyGuide),
      ),
    )
    const widgetVersions = await Promise.all(
      bundle.widgetVersions.map((version) =>
        this.upsertWidgetVersion(ownerId, version),
      ),
    )
    const workspaceState = bundle.workspaceState
      ? await this.upsertWorkspaceState(bundle.workspaceState)
      : null

    return {
      profile,
      dashboards,
      studyGuides,
      widgets,
      widgetVersions,
      workspaceState,
    }
  },
})

export type CloudRepository = ReturnType<typeof createCloudRepository>
