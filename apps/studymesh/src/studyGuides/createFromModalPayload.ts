import { createStudyPathContainerState } from '../components/Dasboard/studyPathContainer'
import { createStudyGuideRecord } from './storage'
import {
  createQuickCreateDashboardLayout,
  QuickCreateDashboardLayoutMode,
} from '../quickCreate'
import type { StudyGuideRecord } from '../cloud/types'
import type {
  DashboardLayout,
  StudyGuideQuickStart,
  StudyPathContainerState,
} from '../state/store'
import { ComponentData } from '../components/WidgetEditor/types/types'

export interface StudyGuideModalDashboard {
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
}

export interface StudyGuideModalPayload {
  dashboards: StudyGuideModalDashboard[]
  folderName?: string
  quickStart?: StudyGuideQuickStart
}

export interface QuickCreateGeneratedDashboard {
  id: string
  name: string
  folder: string
  folderColor: string
  layout: DashboardLayout
  description: string
  tags: string[]
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export interface StudyGuideModalPayloadResult {
  dashboards: QuickCreateGeneratedDashboard[]
  studyPath: StudyPathContainerState | null
  record: StudyGuideRecord | null
}

/**
 * Pure part of the create flow: turns a CreateStudyGuideModal payload into
 * dashboards, the study path they form and the guide record. Callers own the
 * side effects (storage writes, opening the workspace), so a page without the
 * dashboard context can build the same record.
 */
export const createStudyGuideFromModalPayload = ({
  dashboards,
  folderName = 'Quick Creates',
  quickStart,
}: StudyGuideModalPayload): StudyGuideModalPayloadResult => {
  const generatedDashboards: QuickCreateGeneratedDashboard[] = dashboards.map(
    (dashboard) => {
      const now = new Date().toISOString()
      const embeddedWidgets = dashboard.widgets.map((widget) => ({
        id: `embedded-widget-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        name: widget.name,
        components: widget.components,
        category: widget.category || 'Quick Create',
        tags: widget.tags || ['quick-create', 'embedded-generated'],
        description: widget.description || 'Generated from student notes.',
        version: widget.version || '1.0',
        author: widget.author || 'RabbitHole',
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
    },
  )
  const parsedStudyPath = createStudyPathContainerState(generatedDashboards)
  const studyPath = parsedStudyPath
    ? {
        ...parsedStudyPath,
        quickStart,
      }
    : null

  return {
    dashboards: generatedDashboards,
    studyPath,
    record: studyPath ? createStudyGuideRecord(studyPath) : null,
  }
}
