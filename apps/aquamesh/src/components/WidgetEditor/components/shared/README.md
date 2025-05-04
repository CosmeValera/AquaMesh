# Shared Widget Editor Components

This directory contains shared UI components used across the different widget editors in the AquaMesh application. These components help maintain consistency in the UI and reduce code duplication.

## Available Components

### TabPanel
A simple tab panel component that shows/hides content based on the selected tab.

```jsx
<TabPanel value={tabValue} index={0} id="my-component">
  {/* Content for the first tab */}
</TabPanel>
```

### ComponentPreview
A standardized preview container for showing widget previews.

```jsx
<ComponentPreview>
  <MyComponent {...previewProps} />
</ComponentPreview>
```

### EditorTabs
Navigation tabs for the editor interfaces.

```jsx
const editorTabs = [
  { label: 'Basic', id: 'basic-tab' },
  { label: 'Advanced', id: 'advanced-tab' }
];

<EditorTabs 
  value={tabValue} 
  onChange={handleTabChange}
  tabs={editorTabs}
/>
```

### TextStylingControls
Controls for applying text styling (bold, italic, underline, font weight).

```jsx
<TextStylingControls
  fontWeight={fontWeight}
  isBold={isBold}
  isItalic={isItalic}
  hasUnderline={hasUnderline}
  onChange={handleTextStyleChange}
/>
```

### TextAlignmentControls
Controls for text alignment (left, center, right, justify).

```jsx
<TextAlignmentControls
  textAlign={textAlign}
  onChange={handleTextAlignChange}
/>
```

### CustomColorControl
A control for selecting and applying a custom color with color picker.

```jsx
<CustomColorControl
  useCustomColor={useCustomColor}
  customColor={customColor}
  onColorChange={handleColorChange}
  onToggleCustomColor={handleCustomColorToggle}
  label="Use Custom Color"
/>
```

### DualColorPicker
A dual color picker for components that need two colors (like button and hover colors).

```jsx
<DualColorPicker
  useCustomColor={useCustomColor}
  primaryColor={customColor}
  secondaryColor={customHoverColor}
  onToggleCustomColor={handleCustomColorToggle}
  onPrimaryColorChange={handlePrimaryColorChange}
  onSecondaryColorChange={handleHoverColorChange}
  primaryLabel="Button Color"
  secondaryLabel="Hover Color"
/>
```

### ColorPickerModal
A modal dialog for picking colors with a color wheel and preset options.

```jsx
<ColorPickerModal
  open={colorPickerOpen}
  currentColor={customColor}
  onClose={() => setColorPickerOpen(false)}
  onSave={handleColorPickerSave}
  title="Choose Color"
/>
```

## Usage Pattern

1. Import the components you need from `../shared/SharedEditorComponents`
2. Use them in your editor component to replace repetitive UI sections
3. Connect the component callbacks to your local state management

## Example

```jsx
import { 
  TabPanel, 
  ComponentPreview, 
  TextStylingControls
} from '../shared/SharedEditorComponents';

// In your component:
const MyEditor = ({ props, onChange }) => {
  // State setup...
  
  const handleTextStyleChange = (prop, value) => {
    // Handle the change...
  };
  
  return (
    <Box>
      <ComponentPreview>
        {/* Preview content */}
      </ComponentPreview>
      
      <TabPanel value={tabValue} index={0} id="my-editor">
        <TextStylingControls
          fontWeight={fontWeight}
          isBold={isBold}
          isItalic={isItalic}
          hasUnderline={hasUnderline}
          onChange={handleTextStyleChange}
        />
      </TabPanel>
    </Box>
  );
};
``` 