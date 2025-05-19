# Widget Editor

This folder contains the Widget Editor feature, a powerful tool designed to empower users to easily build, customize, and manage their own widgets through an intuitive drag-and-drop interface.

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
│   │   ├── ComponentSearchDialog.tsx # Dialog for component search
│   │   ├── DeleteConfirmationDialog.tsx # Dialog for confirming deletions
│   │   ├── EditComponentDialog.tsx  # Dialog for editing component properties
│   │   ├── ExportImportDialog.tsx   # Dialog for export/import functionality
│   │   ├── MajorVersionDialog.tsx   # Dialog for major version changes
│   │   ├── SavedWidgetsDialog.tsx   # Dialog for saved widgets management
│   │   ├── SaveWidgetDialog.tsx     # Dialog for saving widgets
│   │   ├── SettingsDialog.tsx       # Dialog for editor settings
│   │   ├── TemplateSelectionDialog.tsx # Dialog for template selection
│   │   ├── VersionWarningDialog.tsx # Dialog for version warnings
│   │   ├── WidgetLibrary.tsx        # Dialog for widget library management
│   │   ├── WidgetMetadataDialog.tsx # Dialog for widget metadata
│   │   └── WidgetVersioningDialog.tsx # Dialog for widget versioning
│   ├── editors/            # Property editors for specific components
│   │   ├── ButtonEditor.tsx         # Button properties editor
│   │   ├── FieldSetEditor.tsx       # FieldSet properties editor
│   │   ├── FlexBoxEditor.tsx        # FlexBox properties editor
│   │   ├── GridBoxEditor.tsx        # GridBox properties editor
│   │   ├── LabelEditor.tsx          # Label properties editor
│   │   ├── PieChartEditor.tsx       # PieChart properties editor
│   │   ├── SwitchEditor.tsx         # Switch properties editor
│   │   └── TextFieldEditor.tsx      # TextField properties editor
│   ├── preview/            # Component preview renderers
│   │   ├── ComponentPreview.tsx     # Preview for most components
│   │   └── ChartPreview.tsx         # Specialized preview for charts
│   ├── shared/             # Shared components across the editor
│   │   └── SharedEditorComponents.tsx # Common editor components
│   └── ui/                 # Generic UI components
│       └── NotificationSystem.tsx   # Notification/toast system
├── constants/              # Constants used throughout the editor
│   ├── componentTypes.ts            # Available component types and metadata
│   └── templateWidgets.ts           # Template widget definitions
├── hooks/                  # Custom React hooks
│   ├── useWidgetEditor.ts           # Main editor state and logic
│   └── useWidgetManager.ts          # Widget management functionality
├── types/                  # TypeScript type definitions
│   └── types.ts                     # Common type definitions
├── utils/                  # Utility functions
│   └── componentUtils.ts            # Component manipulation utilities
├── CustomWidget.tsx        # Component for rendering saved widgets 
├── WidgetEditor.tsx        # Main Widget Editor component
└── WidgetStorage.ts        # Local storage handling for widgets
```

## Focus on Creating Widgets

The WidgetEditor is built from the ground up to make widget creation a seamless and creative experience:

*   **Intuitive Drag & Drop:** Start with a blank canvas or a template and simply drag components from the palette to design your widget's layout and functionality.
*   **Rich Component Set:** Utilize a diverse library of components including interactive elements (Buttons, Switches, TextFields), layout containers (FlexBox, GridBox, FieldSets), and data visualization tools (Charts).
*   **Deep Customization:** Each component comes with a dedicated editor, allowing you to fine-tune its appearance, behavior, and data bindings through an extensive set of properties.
*   **Live Preview:** See your changes reflected instantly in the live preview canvas, enabling rapid iteration and design adjustments.
*   **Complex Layouts:** Easily create sophisticated structures by nesting components within layout containers, providing full control over widget organization.
*   **Save, Load & Reuse:** Save your widget designs to your personal library, load them for further editing, or reuse them across different dashboards.
*   **Versioning & Templates:** Manage different versions of your widgets and leverage pre-built templates to kickstart your creations.

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

## Component Types

The editor supports various component types including:

- UI Components (Button, Label, TextField, Switch)
- Layout Containers (FieldSet, FlexBox, GridBox)
- Chart Components (PieChart)

Each component type has a corresponding editor for its specific properties.

## Implementation Details

The core state is managed in the `useWidgetEditor` hook, which centralizes all editor functionality. Components communicate through a well-defined props interface, maintaining a clean separation between UI and logic.

The editor uses a nested component data structure where container components can have children, allowing for complex widget layouts. 