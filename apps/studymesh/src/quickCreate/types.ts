import { CustomWidget } from '../components/WidgetEditor/WidgetStorage'
import { ComponentData } from '../components/WidgetEditor/types/types'
import { DashboardLayout } from '../state/store'

export type QuickCreateSourceFormat =
  | 'paste'
  | 'markdown'
  | 'text'
  | 'csv'
  | 'markdown-table'
  | 'quick-syntax'

export type StudyPathDashboardRole = 'normal' | 'summary' | 'exercises'

export type StudyPathDashboardPurpose =
  | 'overview'
  | 'lesson'
  | 'practice'
  | 'review'
  | 'finalReview'
  | 'projectLab'

export type StudyPathPracticeType = 'none' | 'quiz' | 'mixed'

export interface StudyPathSourceRef {
  id?: string
  label?: string
  source?: string
  chunkIndex?: number
}

export type StudyObjectKind =
  | 'markdown'
  | 'note'
  | 'term'
  | 'qa'
  | 'quiz'
  | 'reveal'
  | 'comparison'
  | 'sequence'
  | 'reviewPrompt'
  | 'code'
  | 'list'
  | 'table'
  | 'resource'

export interface StudyObjectBase {
  id: string
  kind: StudyObjectKind
  title?: string
  sourceLine: number
  tags: string[]
}

export interface StudyNoteObject extends StudyObjectBase {
  kind: 'note'
  body: string
}

export interface StudyTermObject extends StudyObjectBase {
  kind: 'term'
  term: string
  definition: string
}

export interface StudyQAObject extends StudyObjectBase {
  kind: 'qa'
  question: string
  answer: string
}

export interface StudyQuizObject extends StudyObjectBase {
  kind: 'quiz'
  quizMode: 'multipleChoice' | 'shortAnswer'
  question: string
  options: string[]
  correctIndex: number
  answer: string
  explanation: string
  hint?: string
  optionFeedback?: Array<{
    option: string
    explanation: string
  }>
}

export interface StudyRevealObject extends StudyObjectBase {
  kind: 'reveal'
  prompt: string
  hiddenText: string
}

export interface StudyComparisonObject extends StudyObjectBase {
  kind: 'comparison'
  columns: string[]
  rows: string[][]
}

export interface StudySequenceObject extends StudyObjectBase {
  kind: 'sequence'
  steps: string[]
  ordered: boolean
  interactiveChecklist: boolean
}

export interface StudyReviewPromptObject extends StudyObjectBase {
  kind: 'reviewPrompt'
  prompt: string
  reason: string
  status: 'needsReview' | 'reviewing' | 'mastered'
}

export interface StudyMarkdownObject extends StudyObjectBase {
  kind: 'markdown'
  markdown: string
}

export interface StudyCodeObject extends StudyObjectBase {
  kind: 'code'
  code: string
  language: string
  caption: string
}

export interface StudyListObject extends StudyObjectBase {
  kind: 'list'
  items: string[]
  ordered: boolean
  checklist: boolean
}

export interface StudyTableObject extends StudyObjectBase {
  kind: 'table'
  headers: string[]
  rows: string[][]
}

export interface StudyResourceObject extends StudyObjectBase {
  kind: 'resource'
  url: string
  label: string
  resourceType: 'image' | 'pdf' | 'link'
}

export type StudyObject =
  | StudyMarkdownObject
  | StudyNoteObject
  | StudyTermObject
  | StudyQAObject
  | StudyQuizObject
  | StudyRevealObject
  | StudyComparisonObject
  | StudySequenceObject
  | StudyReviewPromptObject
  | StudyCodeObject
  | StudyListObject
  | StudyTableObject
  | StudyResourceObject

export interface QuickCreate {
  id: string
  title: string
  sourceFormat: QuickCreateSourceFormat
  objects: StudyObject[]
  warnings: string[]
  sourceSummary?: {
    title: string
    bullets: string[]
  }
  dashboardRole?: StudyPathDashboardRole
}

export interface QuickCreateParseOptions {
  title?: string
  sourceFormat?: QuickCreateSourceFormat
  packId?: string
  defaultTags?: string[]
}

export interface QuickCreateGeneratorOptions {
  author?: string
  category?: string
  createdAt?: string
  dashboardName?: string
  forceQuizBlockComponent?: boolean
  groupingThreshold?: number
  includeSourceWidget?: boolean
  includeSourceSummaryWidget?: boolean
  includeSummaryChart?: boolean
  focusedResourceType?: 'flashcards' | 'quiz'
  rawSource?: string
  maxObjectsPerWidget?: number
  widgetIdPrefix?: string
  widgetGroups?: QuickCreateWidgetGroupInput[]
  studyPath?: StudyPathDashboardContext
}

export interface StudyPathDashboardContext {
  pathId: string
  title: string
  dashboardKey: string
  dashboardName: string
  dashboardIndex: number
  dashboardCount: number
  folderName: string
  dashboardRole?: StudyPathDashboardRole
  dashboardPurpose?: StudyPathDashboardPurpose
  practiceType?: StudyPathPracticeType
  layoutReason?: string
  sourceRefs?: StudyPathSourceRef[]
}

export type QuickCreateDashboardLayoutMode = 'smart' | 'tabs' | 'orchestrator'

export interface QuickCreateDashboardLayoutOptions {
  mode?: QuickCreateDashboardLayoutMode
}

export interface QuickCreateWidgetGroupInput {
  name: string
  objects: StudyObject[]
}

export type QuickCreateWidgetRecord = CustomWidget

export type QuickCreateSaveWidgetInput = Omit<
  CustomWidget,
  'id' | 'createdAt' | 'updatedAt'
>

export interface QuickCreateGeneratedDashboard {
  name: string
  layout: DashboardLayout
}

export interface GeneratedQuickCreate {
  pack: QuickCreate
  widgets: QuickCreateWidgetRecord[]
  dashboard: QuickCreateGeneratedDashboard
}

export type QuickCreateComponent = ComponentData
