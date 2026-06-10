import type {
  StudyMaterialDetailLevel,
  StudyMaterialResourceType,
} from '../../quickCreate/ai'
import type { ComponentData } from '../WidgetEditor/types/types'
import type { DashboardLayout } from '../../state/store'
export {
  quickCreateAccents,
  quickCreateFolders,
  quickCreateLabels,
  quickCreateTargets,
} from '../../quickCreate/quickCreateActions'

export type StudioFlow = 'hub' | 'study-path' | 'quick-create'
export type CreationFlow = Exclude<StudioFlow, 'hub'>
export type CreateIntent = 'study-path' | StudyMaterialResourceType
export interface OpenCreateHubDetail {
  intent?: CreateIntent
}
export type GenerationDraftStatus =
  | 'generating'
  | 'ready'
  | 'failed'
  | 'cancelled'

export interface GenerationDraft {
  id: string
  flow: CreationFlow
  status: GenerationDraftStatus | 'editing'
  title: string
  createdAt: string
  inputSummary: string
  selectedResourceType?: string | null
  detailLevel?: string
  error?: string
  isPlaceholder?: boolean
  quickCreate?: boolean
  completedAt?: string
  acknowledgedAt?: string
  openedAt?: string
  aiProvider?: string
  generationRequestId?: number
  retrySourceText?: string
  retryTitle?: string
  retryResourceType?: StudyMaterialResourceType
  retryDifficulty?: string
  generatedMaterial?: GeneratedMaterial
  generatedDashboards?: Array<{
    id: string
    name: string
    layout: DashboardLayout
    folder?: string
  }>
}

export interface GeneratedMaterial {
  id: string
  type: StudyMaterialResourceType | 'summary' | 'exercises' | 'other'
  title: string
  sourceDashboardId?: string
  sourceStudyPathId?: string
  sourceLessonId?: string
  sourceModuleId?: string
  contextLabel: string
  createdAt: string
  updatedAt: string
  content: {
    widgets: Array<{
      name: string
      components: ComponentData[]
      category?: string
      tags?: string[]
      description?: string
      version?: string
      author?: string
    }>
    sourceSummary?: string
  }
  generationConfig: {
    difficulty?: string
    detailLevel?: StudyMaterialDetailLevel
    contextMode?: 'dashboard'
  }
}

export const quickCreateDetailToAmount: Record<
  StudyMaterialDetailLevel,
  'few' | 'medium' | 'many'
> = {
  short: 'few',
  medium: 'medium',
  long: 'many',
}

export const statusMarkerGlow: Record<
  'editing' | 'running' | 'complete' | 'error',
  string
> = {
  editing: '0 0 0 6px rgba(59, 130, 246, 0.14)',
  running: '0 0 0 6px rgba(245, 158, 11, 0.14)',
  complete: '0 0 0 7px rgba(34, 197, 94, 0.18)',
  error: '0 0 0 6px rgba(239, 68, 68, 0.16)',
}

export const studioPanelWidth = 424
export const studioPanelRailWidth = 66
export const studioPanelMinWidth = 360
export const studioPanelMaxWidth = 620
export const workspaceCanvasSx = {
  minHeight: 0,
  overflow: 'hidden',
  p: '8px',
  boxSizing: 'border-box',
}

export const readIsAdmin = () => {
  try {
    const storedUserData = localStorage.getItem('userData')
    if (!storedUserData) {
      return true
    }

    const userData = JSON.parse(storedUserData)
    return userData.role === 'ADMIN_ROLE'
  } catch (error) {
    console.error('Failed to read user data', error)
    return false
  }
}

export const createGenerationDraft = (
  flow: Exclude<StudioFlow, 'hub'>,
  options: Partial<GenerationDraft> & { isPlaceholder?: boolean } = {},
): GenerationDraft => ({
  id: `${flow}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  flow,
  status: 'editing',
  title:
    flow === 'study-path'
      ? 'Study basic human anatomy focusing on organs and systems (cardiovascular, respiratory, digestive)'
      : 'Notes draft',
  createdAt: new Date().toISOString(),
  inputSummary: flow === 'study-path' ? 'Learning prompt' : 'Current dashboard',
  ...options,
})

