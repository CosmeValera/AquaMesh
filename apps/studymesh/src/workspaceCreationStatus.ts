export type WorkspaceCreationTask = 'study-path' | 'quick-create'

export type WorkspaceCreationTaskState =
  | 'idle'
  | 'running'
  | 'complete'
  | 'error'

export interface WorkspaceCreationStatusDetail {
  task: WorkspaceCreationTask
  state: WorkspaceCreationTaskState
  message?: string
}

export const WORKSPACE_CREATION_STATUS_EVENT =
  'studymesh-workspace-creation-status'

export const workspaceCreationTaskLabels: Record<WorkspaceCreationTask, string> =
  {
    'study-path': 'Create Study Guide',
    'quick-create': 'Quick Create',
  }

export const dispatchWorkspaceCreationStatus = (
  detail: WorkspaceCreationStatusDetail,
) => {
  window.dispatchEvent(
    new CustomEvent<WorkspaceCreationStatusDetail>(
      WORKSPACE_CREATION_STATUS_EVENT,
      { detail },
    ),
  )
}
