import React, { ReactElement } from 'react';

// Types for the Widget Editor

// Component data structure
export interface ComponentData {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: ComponentData[];
  parentId?: string;
  hidden?: boolean;
}

// Widget data structure
export interface WidgetData {
  id: string;
  name: string;
  components: ComponentData[];
  createdAt: number;
  updatedAt: number;
  version: string;
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
  position?: 'before' | 'after' | 'inside';
}

// Component palette item props
export interface ComponentPaletteItemProps {
  component: ComponentType;
  showTooltips: boolean;
  handleDragStart: (e: React.DragEvent<HTMLDivElement>, type: string) => void;
}

// Component preview props
export interface ComponentPreviewProps {
  component: ComponentData;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onAddInside: (parentId: string) => void;
  onToggleVisibility?: (id: string) => void;
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
  category: string;
  tooltip: string;
  icon: React.ComponentType;
  defaultProps: Record<string, unknown>;
}

// Notification
export interface Notification {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

// Component Editor Props
export interface ComponentEditorProps<T = Record<string, unknown>> {
  props: T;
  onChange: (updatedProps: T) => void;
}

// Specific Component Props Types
export interface ButtonProps {
  text?: string;
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  fullWidth?: boolean;
  disabled?: boolean;
  showToast?: boolean;
  toastMessage?: string;
  toastSeverity?: 'info' | 'success' | 'warning' | 'error';
  fontWeight?: number | string;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  customColor?: string;
  customHoverColor?: string;
  showStartIcon?: boolean;
  iconName?: string;
  showEndIcon?: boolean;
  [key: string]: unknown;
}

export interface LabelProps {
  text?: string;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'subtitle1' | 'subtitle2' | 'body1' | 'body2' | 'caption' | 'overline';
  align?: 'left' | 'center' | 'right' | 'justify';
  color?: string;
  fontWeight?: number | string;
  fontSize?: number | string;
  [key: string]: unknown;
}

export interface SwitchProps {
  label?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  labelPlacement?: 'end' | 'start' | 'top' | 'bottom';
  size?: 'small' | 'medium';
  [key: string]: unknown;
} 