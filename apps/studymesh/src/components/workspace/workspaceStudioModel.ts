import type {
  StudyMaterialDetailLevel,
  StudyMaterialResourceType,
} from '../../studyPack/ai'
import type { ComponentData } from '../WidgetEditor/types/types'
import type { DashboardLayout } from '../../state/store'
import type { WorkspaceCreationTaskState } from '../../workspaceCreationStatus'

export type StudioFlow = 'hub' | 'study-path' | 'from-notes'
export type CreationFlow = Exclude<StudioFlow, 'hub'>
export type CreateIntent = 'study-path' | StudyMaterialResourceType
export type QuickSourceFocus = 'upload' | 'paste'
export interface OpenCreateHubDetail {
  intent?: CreateIntent
  openQuickOptions?: boolean
  quickSourceFocus?: QuickSourceFocus
}
export type GenerationDraftStatus =
  | 'generating'
  | 'ready'
  | 'failed'
  | 'cancelled'
export type GenerationMarkerState =
  | 'editing'
  | Exclude<WorkspaceCreationTaskState, 'idle'>

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
  retrySourceText?: string
  retryTitle?: string
  retrySourceMode?: 'dashboard' | 'sources'
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
  sourceLabel: string
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
    sourceMode?: 'dashboard' | 'sources'
  }
}

export const quickCreateLabels: Record<StudyMaterialResourceType, string> = {
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  improvedNotes: 'Expand on this',
}

export const quickCreateFolders: Record<StudyMaterialResourceType, string> = {
  quiz: 'Quizzes',
  flashcards: 'Flashcards',
  improvedNotes: 'Expand on this',
}

export const quickCreateTargets: Record<StudyMaterialResourceType, string[]> = {
  quiz: ['quizzes'],
  flashcards: ['flashcards'],
  improvedNotes: ['summaries', 'definitions', 'lists'],
}

export const quickCreateAccents: Record<StudyMaterialResourceType, string> = {
  quiz: '#5b9dff',
  flashcards: '#b66cff',
  improvedNotes: '#18b992',
}

export const quickCreateDetailToAmount: Record<
  StudyMaterialDetailLevel,
  'few' | 'medium' | 'many'
> = {
  short: 'few',
  medium: 'medium',
  long: 'many',
}

export const quickSourceAcceptValue = [
  '.md',
  '.txt',
  '.csv',
  '.pdf',
  '.pptx',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'text/markdown',
  'text/plain',
  'text/csv',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
].join(',')

export const appendQuickSourceText = (current: string, next: string) =>
  [current.trim(), next.trim()].filter(Boolean).join('\n\n---\n\n')

export const statusMarkerLabels: Record<
  WorkspaceCreationTaskState | 'editing',
  string
> = {
  editing: 'Creation draft open',
  idle: '',
  running: 'Generating study material...',
  complete: 'Study material ready to review',
  error: 'Generation failed. Click to review.',
}

export const statusMarkerColors: Record<GenerationMarkerState, string> = {
  editing: 'primary.main',
  running: 'warning.main',
  complete: 'success.main',
  error: 'error.main',
}

export const statusMarkerGlow: Record<GenerationMarkerState, string> = {
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
    return userData.id === 'admin' && userData.role === 'ADMIN_ROLE'
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
  inputSummary: flow === 'study-path' ? 'Learning prompt' : 'Sources',
  ...options,
})

export const resourceTypeTitle = (resourceType?: string | null) => {
  if (resourceType === 'flashcards') {
    return 'Flashcards'
  }

  if (resourceType === 'quiz') {
    return 'Quiz'
  }

  if (resourceType === 'improvedNotes') {
    return 'Expand on this'
  }

  return 'Dashboard'
}

export const formatDraftTitle = (draft: GenerationDraft) => {
  const base = draft.title.trim()
  const shortTitle = base.length > 46 ? `${base.slice(0, 45).trim()}...` : base

  if (draft.flow === 'study-path') {
    return `Study Path: ${shortTitle || 'Untitled'}`
  }

  return `${resourceTypeTitle(draft.selectedResourceType)} from ${
    draft.inputSummary || shortTitle || 'notes'
  }`
}

export const getDraftMarkerState = (
  draft: GenerationDraft,
): GenerationMarkerState | null => {
  if (draft.status === 'editing' && !draft.isPlaceholder) {
    return 'editing'
  }

  const { status } = draft

  if (status === 'generating') {
    return 'running'
  }

  if (status === 'ready') {
    return 'complete'
  }

  if (status === 'failed') {
    return 'error'
  }

  return null
}
