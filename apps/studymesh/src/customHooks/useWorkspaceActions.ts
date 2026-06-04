import { useCallback } from 'react'
import { Actions } from 'flexlayout-react'

import { useDashboards } from '../components/Dasboard/DashboardProvider'
import { useLayout } from '../components/Layout/LayoutProvider'
import WidgetStorage from '../components/WidgetEditor/WidgetStorage'
import { cloneTemplate } from '../components/WidgetEditor/constants/templateWidgets'
import { DashboardLayout } from '../state/store'
import { createStudyPathContainerState } from '../components/Dasboard/studyPathContainer'
import { SAVED_DASHBOARDS_CHANGED_EVENT } from '../components/Dasboard/dashboardStorage'
import {
  StudyGuideStorage,
  createStudyGuideRecord,
} from '../studyGuides/storage'
import {
  createStudyPackDashboardLayout,
  StudyPackDashboardLayoutMode,
} from '../studyPack'
import { ComponentData } from '../components/WidgetEditor/types/types'
import {
  STUDYMESH_GUIDE_FOLDER_NAME,
  ensureStarterDashboards,
} from '../studyPack/studyMeshGuideSeed'

export { ensureStarterDashboards } from '../studyPack/studyMeshGuideSeed'

export const OPEN_WIDGET_EDITOR_EVENT = 'studymesh-open-widget-editor'
export const OPEN_DASHBOARD_EDITOR_EVENT = 'studymesh-open-dashboard-editor'
export const OPEN_SAVED_DASHBOARDS_EVENT = 'studymesh-open-saved-dashboards'
export const OPEN_STUDY_PACK_EVENT = 'studymesh-open-study-pack'
export const OPEN_STUDY_PATH_EVENT = 'studymesh-open-study-path'
export const OPEN_CREATE_HUB_EVENT = 'studymesh-open-create-hub'
export const STARTER_STUDY_PATH_FOLDER_NAME = STUDYMESH_GUIDE_FOLDER_NAME

export interface WorkspaceComponentConfig {
  id?: string
  name: string
  component: string
  customProps?: Record<string, unknown>
}

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

const createLayoutWithComponent = (
  componentConfig: WorkspaceComponentConfig,
): DashboardLayout => ({
  type: 'row',
  weight: 100,
  children: [
    {
      type: 'tabset',
      weight: 100,
      active: true,
      children: [
        {
          type: 'tab',
          name: componentConfig.name,
          component: componentConfig.component,
          config: componentConfig.customProps
            ? { customProps: componentConfig.customProps }
            : undefined,
        },
      ],
    },
  ],
})

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
  const baseName = requestedName.trim() || 'Study Pack'
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

const saveStudyPackDashboard = (
  name: string,
  layout: DashboardLayout,
  folderName = 'Study Packs',
): SavedDashboardRecord => {
  const dashboards = getSavedDashboards()
  const now = new Date().toISOString()
  const dashboard: SavedDashboardRecord = {
    id: `study-pack-dashboard-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
    name: getUniqueSavedDashboardName(name, dashboards),
    folder: folderName.trim() || 'Study Packs',
    folderColor: '#007C66',
    layout,
    description: 'Generated from student notes.',
    tags: ['study-pack', 'notes'],
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

const countWidgetComponents = (components?: unknown): number => {
  if (!Array.isArray(components)) {
    return 0
  }

  return components.reduce((count, component) => {
    if (!component || typeof component !== 'object') {
      return count
    }

    const children = 'children' in component ? component.children : undefined
    return count + 1 + countWidgetComponents(children)
  }, 0)
}

const hasDashboardContent = (layout?: DashboardLayout): boolean => {
  if (!layout) {
    return false
  }

  if (layout.type === 'tab' && Boolean(layout.component)) {
    if (layout.component !== 'CustomWidget') {
      return true
    }

    const customProps = layout.config?.customProps
    const embeddedComponentsCount = countWidgetComponents(
      customProps?.components,
    )

    if (embeddedComponentsCount > 0) {
      return true
    }

    if (typeof customProps?.widgetId === 'string') {
      const storedWidget = WidgetStorage.getWidgetById(customProps.widgetId)
      return countWidgetComponents(storedWidget?.components) > 0
    }

    return false
  }

  if (layout.component) {
    return true
  }

  return Boolean(layout.children?.some((child) => hasDashboardContent(child)))
}

export const useWorkspaceActions = () => {
  const { ref: layoutRef, addComponent } = useLayout()
  const {
    addDashboard,
    addDashboards,
    addStudyPathContainer,
    openDashboards,
    selectedDashboard,
    updateDashboardLayout,
  } = useDashboards()

  const ensureDashboardAndAddComponent = useCallback(
    (componentConfig: WorkspaceComponentConfig) => {
      if (openDashboards.length === 0) {
        addDashboard({
          name: 'Dashboard',
          layout: createLayoutWithComponent(componentConfig),
        })
        return
      }

      const currentDashboard = openDashboards[selectedDashboard]

      if (!hasDashboardContent(currentDashboard?.layout)) {
        updateDashboardLayout(
          selectedDashboard,
          createLayoutWithComponent(componentConfig),
        )
        return
      }

      if (layoutRef.current) {
        const model = layoutRef.current.props.model
        if (!model.getActiveTabset()) {
          const firstTabset = model.getFirstTabSet()
          if (firstTabset) {
            // @ts-expect-error: doAction exists at runtime on Layout instance
            layoutRef.current.doAction(
              Actions.setActiveTabset(firstTabset.getId()),
            )
          }
        }
      }

      addComponent(componentConfig)
    },
    [
      addComponent,
      addDashboard,
      layoutRef,
      openDashboards,
      selectedDashboard,
      updateDashboardLayout,
    ],
  )

  const openCreateWidget = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent(OPEN_WIDGET_EDITOR_EVENT, {
        detail: { host: 'studio' },
      }),
    )
  }, [])

  const openCreateDashboard = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent(OPEN_DASHBOARD_EDITOR_EVENT, {
        detail: { host: 'workspace-builder' },
      }),
    )
  }, [])

  const openCreateStudyPack = useCallback((options?: { toggle?: boolean }) => {
    window.dispatchEvent(
      new CustomEvent(OPEN_STUDY_PACK_EVENT, { detail: options }),
    )
  }, [])

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

  const createStudyPackDashboard = useCallback(
    ({
      name,
      widgets,
      layoutMode = 'smart',
      folderName = 'Study Packs',
    }: {
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
      layoutMode?: StudyPackDashboardLayoutMode
      folderName?: string
    }) => {
      const layout = createStudyPackDashboardLayout(
        widgets.map((widget) => ({
          id: `embedded-widget-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          name: widget.name,
          components: widget.components,
          category: widget.category || 'Study Pack',
          tags: widget.tags || ['study-pack', 'embedded-generated'],
          description: widget.description || 'Generated from student notes.',
          version: widget.version || '1.0',
          author: widget.author || 'StudyMesh',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        {
          mode: layoutMode,
        },
      )
      const dashboard = saveStudyPackDashboard(name, layout, folderName)

      addDashboard({
        name: dashboard.name,
        layout: dashboard.layout,
      })

      return dashboard
    },
    [addDashboard],
  )

  const createStudyPackDashboards = useCallback(
    ({
      dashboards,
      folderName = 'Study Packs',
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
        layoutMode?: StudyPackDashboardLayoutMode
        folderName?: string
      }>
    }) => {
      const generatedDashboards = dashboards.map((dashboard) => {
        const now = new Date().toISOString()
        const embeddedWidgets = dashboard.widgets.map((widget) => ({
          id: `embedded-widget-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          name: widget.name,
          components: widget.components,
          category: widget.category || 'Study Pack',
          tags: widget.tags || ['study-pack', 'embedded-generated'],
          description: widget.description || 'Generated from student notes.',
          version: widget.version || '1.0',
          author: widget.author || 'StudyMesh',
          createdAt: now,
          updatedAt: now,
        }))
        const layout = createStudyPackDashboardLayout(embeddedWidgets, {
          mode: dashboard.layoutMode || 'smart',
        })

        return {
          id: `study-pack-dashboard-${Date.now()}-${Math.floor(
            Math.random() * 1000000,
          )}`,
          name: dashboard.name,
          folder: (dashboard.folderName || folderName).trim() || 'Study Packs',
          folderColor: '#007C66',
          layout,
          description: 'Generated from student notes.',
          tags: ['study-pack', 'notes'],
          isPublic: false,
          createdAt: now,
          updatedAt: now,
        }
      })
      const studyPath = createStudyPathContainerState(generatedDashboards)
      const savedDashboards = studyPath
        ? generatedDashboards
        : generatedDashboards.map((dashboard) =>
            saveStudyPackDashboard(
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

  const openTemplateDashboard = useCallback(
    ({
      widgetName,
      templateId,
      description,
      tags,
    }: {
      widgetName: string
      templateId: string
      description: string
      tags: string[]
    }) => {
      let widget = WidgetStorage.getAllWidgets().find(
        (savedWidget) => savedWidget.name === widgetName,
      )

      if (!widget) {
        const template = cloneTemplate(templateId)

        if (template) {
          widget = WidgetStorage.saveWidget({
            name: widgetName,
            description,
            category: 'Knowledge Workspace',
            tags,
            components: template.components,
            version: '1.0',
            author: 'StudyMesh',
          })
        }
      }

      addDashboard({
        name: widgetName,
        layout: createLayoutWithComponent({
          name: widgetName,
          component: 'CustomWidget',
          customProps: widget
            ? {
                widgetId: widget.id,
                components: widget.components,
              }
            : undefined,
        }),
      })
    },
    [addDashboard],
  )

  const openOperationsExample = useCallback(() => {
    openTemplateDashboard({
      widgetName: 'Daily Operations Dashboard',
      templateId: 'template-operations-dashboard',
      description:
        'Daily operations dashboard for orders, delayed tasks, support tickets, system status, team notes, and handoff actions.',
      tags: ['dashboard', 'daily operations', 'orders', 'tickets'],
    })
  }, [openTemplateDashboard])

  const openStudyMeshGuide = useCallback(() => {
    ensureStarterDashboards()
    const guideDashboards = getSavedDashboards().filter(
      (dashboard) => dashboard.folder === STUDYMESH_GUIDE_FOLDER_NAME,
    )
    const studyPath = createStudyPathContainerState(guideDashboards)

    if (studyPath) {
      addStudyPathContainer(studyPath)
    }
  }, [addStudyPathContainer])

  const openMathExample = openStudyMeshGuide
  const openTutorialExample = openStudyMeshGuide

  return {
    ensureDashboardAndAddComponent,
    openCreateWidget,
    openCreateDashboard,
    openCreateStudyPack,
    openCreateStudyPath,
    openCreateHub,
    createStudyPackDashboard,
    createStudyPackDashboards,
    openOperationsExample,
    openMathExample,
    openTutorialExample,
  }
}
