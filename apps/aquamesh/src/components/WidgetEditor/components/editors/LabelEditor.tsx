import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Divider,
  Grid
} from '@mui/material'

import {
  ComponentPreview,
  EditorTabs,
  TextStylingControls,
  TextAlignmentControls,
  CustomColorControl
} from '../shared/SharedEditorComponents'

// Define some default colors for color picker
const DEFAULT_COLORS = [
  '#2196F3', // blue
  '#F44336', // red
  '#4CAF50', // green  
  '#FF9800', // orange
  '#9C27B0', // purple
  '#795548', // brown
  '#607D8B', // blue-grey
  '#E91E63', // pink
  '#000000', // black
  '#666666', // dark grey
]

interface LabelProps {
  [key: string]: unknown; 
}

interface LabelEditorProps {
  props: LabelProps;
  onChange: (updatedProps: LabelProps) => void;
}

// Tab panel component for organizing the editor
const TabPanel: React.FC<{ 
  children: React.ReactNode
  value: number
  index: number 
}> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`label-tabpanel-${index}`}
      aria-labelledby={`label-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  )
}

// Color picker modal component
interface ColorPickerProps {
  open: boolean
  currentColor: string
  onClose: () => void
  onSave: (color: string) => void
}

const ColorPickerModal: React.FC<ColorPickerProps> = ({ open, currentColor, onClose, onSave }) => {
  const [selectedColor, setSelectedColor] = useState(currentColor)

  // Reset selected color when modal opens with a new color
  useEffect(() => {
    setSelectedColor(currentColor)
  }, [currentColor, open])

  const handleSave = () => {
    onSave(selectedColor)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Choose Color</DialogTitle>
      <DialogContent>
        <Box sx={{ textAlign: 'center', p: 2 }}>
          <input
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            style={{ 
              width: '100px', 
              height: '100px', 
              padding: 0, 
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          />
        </Box>
        
        {/* Predefined colors palette */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', mt: 2 }}>
          {DEFAULT_COLORS.map((color, index) => (
            <Box 
              key={index}
              sx={{ 
                width: 30, 
                height: 30, 
                bgcolor: color, 
                borderRadius: '4px',
                cursor: 'pointer',
                border: selectedColor === color ? '2px solid #000' : '1px solid rgba(0,0,0,0.2)',
              }}
              onClick={() => setSelectedColor(color)}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Apply Color
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const LabelEditor: React.FC<LabelEditorProps> = ({ props, onChange }) => {
  // Tab state
  const [tabValue, setTabValue] = useState(0)
  
  // Text formatting states
  const [variant, setVariant] = useState((props.variant as string) || 'body1')
  const [fontWeight, setFontWeight] = useState<number>(
    typeof props.fontWeight === 'number' ? props.fontWeight : 400
  )
  const [isBold, setIsBold] = useState(fontWeight >= 600)
  const [isItalic, setIsItalic] = useState(Boolean(props.fontStyle === 'italic'))
  const [hasUnderline, setHasUnderline] = useState(Boolean(props.textDecoration === 'underline'))
  const [textAlign, setTextAlign] = useState((props.textAlign as string) || 'left')
  
  // Color states
  const [useCustomColor, setUseCustomColor] = useState(Boolean(props.useCustomColor))
  const [customColor, setCustomColor] = useState((props.customColor as string) || '#1976d2')
  
  // Color picker state
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  
  // Initialize state based on props
  useEffect(() => {
    if (props.variant) {
      setVariant(props.variant as string)
    }
    
    if (props.fontWeight) {
      const weight = Number(props.fontWeight)
      setFontWeight(weight)
      setIsBold(weight >= 600)
    } else {
      setFontWeight(400)
      setIsBold(false)
    }
    
    setIsItalic(Boolean(props.fontStyle === 'italic'))
    setHasUnderline(Boolean(props.textDecoration === 'underline'))
    
    if (props.textAlign) {
      setTextAlign(props.textAlign as string)
    } else {
      setTextAlign('left')
    }
    
    if (props.customColor) {
      setCustomColor(props.customColor as string)
    } else {
      setCustomColor('#000000')
    }
  }, [props])
  
  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }
  
  // Generic change handler
  const handleChange = (name: string, value: unknown) => {
    onChange({ ...props, [name]: value })
  }
  
  // Handle text style changes
  const handleTextStyleChange = (prop: string, value: unknown) => {
    handleChange(prop, value)
    
    // Update local state based on the changed property
    if (prop === 'fontWeight') {
      const weightValue = value as number
      setFontWeight(weightValue)
      setIsBold(weightValue >= 600)
    } else if (prop === 'fontStyle') {
      setIsItalic(value === 'italic')
    } else if (prop === 'textDecoration') {
      setHasUnderline(value === 'underline')
    }
  }
  
  // Handle text alignment change
  const handleTextAlignChange = (align: string) => {
    setTextAlign(align)
    handleChange('textAlign', align)
  }
  
  // Custom color handlers
  const handleColorChange = (color: string) => {
    setCustomColor(color)
    handleChange('customColor', color)
  }
  
  const handleCustomColorToggle = (useCustom: boolean) => {
    setUseCustomColor(useCustom)
    
    if (useCustom) {
      handleChange('useCustomColor', true)
      handleChange('customColor', customColor)
    } else {
      handleChange('useCustomColor', undefined)
      handleChange('customColor', undefined)
    }
  }
  
  // Preview styles based on current settings
  const previewStyles = {
    fontWeight: fontWeight,
    fontStyle: isItalic ? 'italic' : 'normal',
    textDecoration: hasUnderline ? 'underline' : 'none',
    textAlign: textAlign,
    color: useCustomColor ? customColor : 'inherit'
  }
  
  const editorTabs = [
    { label: 'Content', id: 'label-content' },
    { label: 'Typography', id: 'label-typography' }
  ]
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Preview Section */}
      <ComponentPreview>
        <Typography
          variant={variant as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'subtitle1' | 'subtitle2' | 'body1' | 'body2'}
          sx={previewStyles}
        >
          {(props.text as string) || 'Label Text'}
        </Typography>
      </ComponentPreview>
      
      {/* Tabs Navigation */}
      <EditorTabs 
        value={tabValue} 
        onChange={handleTabChange}
        tabs={editorTabs}
      />
      
      {/* Content Tab */}
      <TabPanel value={tabValue} index={0} id="label">
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Text Content"
              fullWidth
              multiline
              rows={3}
              value={(props.text as string) || ''}
              onChange={(e) => handleChange('text', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Styling Options
            </Typography>
          </Grid>
          
          {/* Custom Color Toggle and Picker */}
          <Grid item xs={12}>
            <CustomColorControl
              useCustomColor={useCustomColor}
              customColor={customColor}
              onColorChange={handleColorChange}
              onToggleCustomColor={handleCustomColorToggle}
              label="Use Custom Color"
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.noWrap)}
                  onChange={(e) => handleChange('noWrap', e.target.checked)}
                />
              }
              label="No Text Wrapping"
            />
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Typography Tab */}
      <TabPanel value={tabValue} index={1} id="label">
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Text Variant</InputLabel>
              <Select
                value={variant}
                label="Text Variant"
                onChange={(e) => {
                  setVariant(e.target.value)
                  handleChange('variant', e.target.value)
                }}
              >
                <MenuItem value="h1">Heading 1</MenuItem>
                <MenuItem value="h2">Heading 2</MenuItem>
                <MenuItem value="h3">Heading 3</MenuItem>
                <MenuItem value="h4">Heading 4</MenuItem>
                <MenuItem value="h5">Heading 5</MenuItem>
                <MenuItem value="h6">Heading 6</MenuItem>
                <MenuItem value="subtitle1">Subtitle 1</MenuItem>
                <MenuItem value="subtitle2">Subtitle 2</MenuItem>
                <MenuItem value="body1">Body 1</MenuItem>
                <MenuItem value="body2">Body 2</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            {/* Text Styling Controls */}
            <TextStylingControls
              fontWeight={fontWeight}
              isBold={isBold}
              isItalic={isItalic}
              hasUnderline={hasUnderline}
              onChange={handleTextStyleChange}
            />
          </Grid>
          
          <Grid item xs={12}>
            {/* Text Alignment Controls */}
            <TextAlignmentControls
              textAlign={textAlign}
              onChange={handleTextAlignChange}
            />
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  )
}

export default LabelEditor 