export type StudyToolId =
  | 'canvas'
  | 'pomodoro'
  | 'todo'
  | 'scratchpad'
  | 'private-chat'

export interface CanvasItem {
  id: string
  x: number
  y: number
  width: number
  height: number
  content: string
  color: string
}

export interface CanvasConnection {
  id: string
  fromItemId: string
  toItemId: string
  label?: string
}

export interface TodoItem {
  id: string
  text: string
  completed: boolean
  createdAt: number
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string
}

export interface PrivateChatMessage {
  id: string
  content: string
  createdAt: number
  updatedAt?: number
  attachments?: Array<{
    id: string
    type: 'image' | 'audio'
    dataUrl: string
    name?: string
  }>
}

export interface StudyToolsStateV1 {
  version: 1
  canvas: {
    items: CanvasItem[]
    connections: CanvasConnection[]
    viewportX: number
    viewportY: number
    zoom: number
    gridSize: number
    showGrid: boolean
    snapToGrid: boolean
    updatedAt: string
  }
  todo: {
    items: TodoItem[]
    updatedAt: string
  }
  scratchpad: {
    content: string
    updatedAt: string
  }
  privateChat: {
    enabled: boolean
    messages: PrivateChatMessage[]
    updatedAt: string
  }
}
