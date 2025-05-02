import React from 'react';

// Types for the Widget Editor

// Component data structure
export interface ComponentData {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: ComponentData[];
  parentId?: string;
}

// Widget data structure
export interface WidgetData {
  name: string;
  components: ComponentData[];
}

// Edit component dialog props
export interface EditComponentDialogProps {
  open: boolean;
  component: ComponentData | null;
  onClose: () => void;
  onSave: (component: ComponentData) => void;
}

// Drop target information
export interface DropTarget {
  id: string | null;
  isHovering: boolean;
}

// Component palette item props
export interface ComponentPaletteItemProps {
  type: string;
  label: string;
  tooltip: string;
  icon: React.ElementType;
  onDragStart: (e: React.DragEvent, type: string) => void;
}

// Component preview props
export interface ComponentPreviewProps {
  component: ComponentData;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onAddInside: (parentId: string) => void;
  isFirst: boolean;
  isLast: boolean;
  level?: number;
  editMode: boolean;
  isDragging: boolean;
  dropTarget: DropTarget;
  handleContainerDragEnter: (e: React.DragEvent, containerId: string) => void;
  handleContainerDragOver: (e: React.DragEvent) => void;
  handleContainerDragLeave: (e: React.DragEvent) => void;
  handleContainerDrop: (e: React.DragEvent, containerId: string) => void;
}

// Notification severity options
export type NotificationSeverity = 'success' | 'error' | 'info' | 'warning';

// Component type definition
export interface ComponentType {
  type: string;
  label: string;
  defaultProps: Record<string, unknown>;
  category: string;
  icon: React.ElementType;
  tooltip: string;
} 