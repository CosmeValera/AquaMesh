import type { StudyMaterialResourceType } from './ai'

export type QuickCreateActionId =
  | 'quiz'
  | 'flashcards'
  | 'podcast'
  | 'improvedNotes'
export type QuickCreateActionGroup = 'Practice' | 'Notes'
export type QuickCreateSourceScope = 'studyGuide' | 'currentPage'

export interface QuickCreateAction {
  id: QuickCreateActionId
  resourceType: StudyMaterialResourceType
  label: string
  shortLabel: string
  description: string
  group: QuickCreateActionGroup
  folder: string
  generationTargets: string[]
  accent: string
}

export interface QuickCreateActionRequest {
  actionId: QuickCreateActionId
  resourceType: StudyMaterialResourceType
  label: string
  sourceScope?: QuickCreateSourceScope
}

export type QuickCreateActionInput =
  | StudyMaterialResourceType
  | QuickCreateActionRequest
  | QuickCreateAction

export const quickCreateActions: QuickCreateAction[] = [
  {
    id: 'quiz',
    resourceType: 'quiz',
    label: 'Quiz',
    shortLabel: 'Quiz',
    description: 'Create practice questions from this material.',
    group: 'Practice',
    folder: 'Quizzes',
    generationTargets: ['quizzes'],
    accent: '#5b9dff',
  },
  {
    id: 'flashcards',
    resourceType: 'flashcards',
    label: 'Flashcards',
    shortLabel: 'Cards',
    description: 'Create recall cards for key terms and ideas.',
    group: 'Practice',
    folder: 'Flashcards',
    generationTargets: ['flashcards'],
    accent: '#b66cff',
  },
  {
    id: 'podcast',
    resourceType: 'podcast',
    label: 'Podcast',
    shortLabel: 'Podcast',
    description: 'Create a short audio recap from this material.',
    group: 'Practice',
    folder: 'Podcasts',
    generationTargets: ['podcast'],
    accent: '#f57c00',
  },
  {
    id: 'improvedNotes',
    resourceType: 'improvedNotes',
    label: 'Expand on this',
    shortLabel: 'Expand',
    description: 'Turn this material into clearer study notes.',
    group: 'Notes',
    folder: 'Expand on this',
    generationTargets: ['summaries', 'definitions', 'lists'],
    accent: '#18b992',
  },
]

export const quickCreateActionGroups: QuickCreateActionGroup[] = [
  'Practice',
  'Notes',
]

export const quickCreateLabels: Record<StudyMaterialResourceType, string> =
  Object.fromEntries(
    quickCreateActions.map((action) => [action.resourceType, action.label]),
  ) as Record<StudyMaterialResourceType, string>

export const quickCreateFolders: Record<StudyMaterialResourceType, string> =
  Object.fromEntries(
    quickCreateActions.map((action) => [action.resourceType, action.folder]),
  ) as Record<StudyMaterialResourceType, string>

export const quickCreateTargets: Record<StudyMaterialResourceType, string[]> =
  Object.fromEntries(
    quickCreateActions.map((action) => [
      action.resourceType,
      action.generationTargets,
    ]),
  ) as Record<StudyMaterialResourceType, string[]>

export const quickCreateAccents: Record<StudyMaterialResourceType, string> =
  Object.fromEntries(
    quickCreateActions.map((action) => [action.resourceType, action.accent]),
  ) as Record<StudyMaterialResourceType, string>

export const isStudyMaterialResourceType = (
  value: unknown,
): value is StudyMaterialResourceType =>
  value === 'quiz' ||
  value === 'flashcards' ||
  value === 'podcast' ||
  value === 'improvedNotes'

export const normalizeQuickCreateActionInput = (
  input: QuickCreateActionInput,
): QuickCreateActionRequest => {
  if (isStudyMaterialResourceType(input)) {
    return {
      actionId: input,
      resourceType: input,
      label: quickCreateLabels[input],
    }
  }

  if (input && isStudyMaterialResourceType(input.resourceType)) {
    const inputActionId =
      'actionId' in input
        ? input.actionId
        : 'id' in input
          ? input.id
          : undefined
    const action = quickCreateActions.find(
      (candidate) => candidate.id === inputActionId,
    )
    return {
      actionId: inputActionId || action?.id || input.resourceType,
      resourceType: input.resourceType,
      label: input.label || quickCreateLabels[input.resourceType],
      sourceScope: 'sourceScope' in input ? input.sourceScope : undefined,
    }
  }

  throw new Error('Unknown quick create action.')
}
