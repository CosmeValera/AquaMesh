import {
  DashboardLayout,
  StudyPathContainerState,
  StudyPathDashboardItem,
} from '../../state/store'
import type {
  StudyPathDashboardPurpose,
  StudyPathLayoutArchetype,
  StudyPathPracticeType,
  StudyPathSourceRef,
} from '../../studyPack/studyPathArchetypes'

interface SavedDashboardLike {
  id?: string
  name: string
  folder?: string
  layout: DashboardLayout
  createdAt?: string
  updatedAt?: string
}

interface StudyPathMeta {
  studyPathId: string
  studyPathTitle: string
  dashboardKey: string
  dashboardName: string
  dashboardIndex: number
  dashboardCount: number
  folderName: string
  layoutArchetype?: StudyPathLayoutArchetype
  dashboardPurpose?: StudyPathDashboardPurpose
  practiceType?: StudyPathPracticeType
  layoutReason?: string
  sourceRefs?: StudyPathSourceRef[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readMetaFromCustomProps = (
  customProps?: Record<string, unknown>,
): StudyPathMeta | null => {
  if (!customProps) {
    return null
  }

  const studyPathId = String(customProps.studyPathId || '')
  const dashboardKey = String(customProps.studyPathDashboardKey || '')

  if (!studyPathId || !dashboardKey) {
    return null
  }

  return {
    studyPathId,
    studyPathTitle: String(customProps.studyPathTitle || 'Study Guide'),
    dashboardKey,
    dashboardName: String(customProps.studyPathDashboardName || 'Lesson'),
    dashboardIndex: Number(customProps.studyPathDashboardIndex || 1),
      dashboardCount: Number(customProps.studyPathDashboardCount || 1),
      folderName: String(customProps.studyPathFolderName || 'Study Guide'),
      layoutArchetype:
        typeof customProps.studyPathLayoutArchetype === 'string'
          ? (customProps.studyPathLayoutArchetype as StudyPathLayoutArchetype)
          : undefined,
      dashboardPurpose:
        typeof customProps.studyPathDashboardPurpose === 'string'
          ? (customProps.studyPathDashboardPurpose as StudyPathDashboardPurpose)
          : undefined,
      practiceType:
        typeof customProps.studyPathPracticeType === 'string'
          ? (customProps.studyPathPracticeType as StudyPathPracticeType)
          : undefined,
      layoutReason:
        typeof customProps.studyPathLayoutReason === 'string'
          ? customProps.studyPathLayoutReason
          : undefined,
      sourceRefs: Array.isArray(customProps.studyPathSourceRefs)
        ? (customProps.studyPathSourceRefs as StudyPathSourceRef[])
        : undefined,
  }
}

const readMetaFromComponent = (component: unknown): StudyPathMeta | null => {
  if (!isRecord(component) || !isRecord(component.props)) {
    return null
  }

  return readMetaFromCustomProps(component.props)
}

const readMetaFromCustomWidgetProps = (
  customProps?: Record<string, unknown>,
): StudyPathMeta | null => {
  const directMeta = readMetaFromCustomProps(customProps)

  if (directMeta) {
    return directMeta
  }

  const components = customProps?.components
  if (!Array.isArray(components)) {
    return null
  }

  for (const component of components) {
    const componentMeta = readMetaFromComponent(component)
    if (componentMeta) {
      return componentMeta
    }
  }

  return null
}

export const getStudyPathMetaFromLayout = (
  layout?: DashboardLayout,
): StudyPathMeta | null => {
  if (!layout) {
    return null
  }

  const customProps = isRecord(layout.config?.customProps)
    ? layout.config?.customProps
    : undefined
  const meta = readMetaFromCustomWidgetProps(customProps)

  if (meta) {
    return meta
  }

  for (const child of layout.children || []) {
    const childMeta = getStudyPathMetaFromLayout(child)
    if (childMeta) {
      return childMeta
    }
  }

  return null
}

export const getDashboardCreatedTime = (dashboard: SavedDashboardLike): number => {
  const timestamp = Date.parse(dashboard.createdAt || dashboard.updatedAt || '')
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export const createStudyPathContainerState = (
  dashboards: SavedDashboardLike[],
): StudyPathContainerState | null => {
  const studyPathDashboards = dashboards
    .map((dashboard) => ({
      dashboard,
      meta: getStudyPathMetaFromLayout(dashboard.layout),
    }))
    .filter(
      (entry): entry is { dashboard: SavedDashboardLike; meta: StudyPathMeta } =>
        Boolean(entry.meta),
    )

  if (studyPathDashboards.length < 2) {
    return null
  }

  const pathId = studyPathDashboards[0].meta.studyPathId
  const samePathDashboards = studyPathDashboards.filter(
    (entry) => entry.meta.studyPathId === pathId,
  )

  if (samePathDashboards.length !== dashboards.length) {
    return null
  }

  const orderedDashboards: StudyPathDashboardItem[] = samePathDashboards
    .sort((first, second) => {
      const indexDelta = first.meta.dashboardIndex - second.meta.dashboardIndex
      return indexDelta !== 0
        ? indexDelta
        : getDashboardCreatedTime(first.dashboard) -
            getDashboardCreatedTime(second.dashboard)
    })
    .map(({ dashboard, meta }) => ({
      id: dashboard.id,
      name: dashboard.name || meta.dashboardName,
      layout: dashboard.layout,
      dashboardKey: meta.dashboardKey,
      dashboardIndex: meta.dashboardIndex,
      dashboardCount: meta.dashboardCount,
      folderName: meta.folderName || dashboard.folder || 'Study Guide',
      layoutArchetype: meta.layoutArchetype,
      dashboardPurpose: meta.dashboardPurpose,
      practiceType: meta.practiceType,
      layoutReason: meta.layoutReason,
      sourceRefs: meta.sourceRefs,
    }))

  return {
    pathId,
    title: studyPathDashboards[0].meta.studyPathTitle,
    folderName:
      studyPathDashboards[0].meta.folderName ||
      studyPathDashboards[0].dashboard.folder ||
      'Study Guide',
    dashboards: orderedDashboards,
    selectedIndex: 0,
    pinnedDashboardKeys: [],
  }
}
