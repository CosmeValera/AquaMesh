# Widget Editor

This folder contains the Widget Editor feature which allows users to build custom widgets through a drag-and-drop interface.

## Architecture Overview

The Widget Editor implements clean architecture principles with a clear separation of concerns:

```
WidgetEditor/
├── components/             # UI components organized by function
│   ├── core/               # Core editor components
│   │   ├── EditorCanvas.tsx        # Main canvas for editing widgets
│   │   ├── EditorToolbar.tsx       # Toolbar with actions
│   │   ├── ComponentPalette.tsx    # Component palette for drag and drop
│   │   └── ComponentPaletteItem.tsx # Individual component in palette
│   ├── dialogs/            # Modal dialogs
│   │   ├── EditComponentDialog.tsx  # Dialog for editing component properties
│   │   ├── SavedWidgetsDialog.tsx   # Dialog for saved widgets management
│   │   ├── SettingsDialog.tsx       # Dialog for editor settings
│   │   └── DeleteConfirmationDialog.tsx # Dialog for confirming deletions
│   ├── editors/            # Property editors for specific components
│   │   ├── ButtonEditor.tsx         # Button properties editor
│   │   ├── SwitchEditor.tsx         # Switch properties editor
│   │   ├── LabelEditor.tsx          # Label properties editor
│   │   ├── TextFieldEditor.tsx      # TextField properties editor
│   │   ├── FieldSetEditor.tsx       # FieldSet properties editor
│   │   ├── FlexBoxEditor.tsx        # FlexBox properties editor
│   │   ├── GridBoxEditor.tsx        # GridBox properties editor
│   │   └── PieChartEditor.tsx       # PieChart properties editor
│   ├── preview/            # Component preview renderers
│   │   ├── ComponentPreview.tsx     # Preview for most components
│   │   └── ChartPreview.tsx         # Specialized preview for charts
│   └── ui/                 # Generic UI components
│       └── NotificationSystem.tsx   # Notification/toast system
├── constants/              # Constants used throughout the editor
│   └── componentTypes.ts           # Available component types and metadata
├── hooks/                  # Custom React hooks
│   └── useWidgetEditor.ts          # Main editor state and logic
├── types/                  # TypeScript type definitions
│   └── types.ts                    # Common type definitions
├── utils/                  # Utility functions
│   └── componentUtils.ts           # Component manipulation utilities
├── CustomWidget.tsx        # Component for rendering saved widgets 
├── WidgetEditor.tsx        # Main Widget Editor component
└── WidgetStorage.ts        # Local storage handling for widgets
```

## Usage

The Widget Editor can be imported and used as follows:

```jsx
import WidgetEditor from './components/WidgetEditor';

function App() {
  return (
    <div>
      <WidgetEditor />
    </div>
  );
}
```

## Features

- Drag-and-drop interface for building widgets
- Component properties editing
- Save and load widget definitions
- Preview mode for testing
- Local storage persistence

## Component Types

The editor supports various component types including:

- UI Components (Button, Label, TextField, Switch)
- Layout Containers (FieldSet, FlexBox, GridBox)
- Chart Components (PieChart)

Each component type has a corresponding editor for its specific properties.

## Implementation Details

The core state is managed in the `useWidgetEditor` hook, which centralizes all editor functionality. Components communicate through a well-defined props interface, maintaining a clean separation between UI and logic.

The editor uses a nested component data structure where container components can have children, allowing for complex widget layouts. 