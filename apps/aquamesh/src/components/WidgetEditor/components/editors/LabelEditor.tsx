/* eslint-disable react/prop-types */
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
import SettingsIcon from '@mui/icons-material/Settings'
import FormatColorTextIcon from '@mui/icons-material/FormatColorText'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import TooltipStyled from '../../../TooltipStyled'

import {
  ComponentPreview,
  EditorTabs,
  TextStylingControls,
  TextAlignmentControls,
  CustomColorControl,
  TabPanelShared
} from '../shared/SharedEditorComponents'

// Define props interface with explicit types
interface LabelProps {
  text?: string;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'subtitle1' | 'subtitle2' | 'body1' | 'body2';
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  useCustomColor?: boolean;
  customColor?: string;
  noWrap?: boolean;
  [key: string]: unknown; 
}

interface LabelEditorProps {
  props: LabelProps;
  onChange: (updatedProps: LabelProps) => void;
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
  
  // Initialize state based on props
  useEffect(() => {
    // Reset custom color toggle on prop change
    setUseCustomColor(Boolean(props.useCustomColor))
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
    color: useCustomColor ? customColor : 'inherit',
    // Apply noWrap CSS if enabled
    ...(props.noWrap ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {})
  }
  
  const editorTabs = [
    { label: 'Basic Settings', id: 'label-basic', icon: <SettingsIcon fontSize="small" /> },
    { label: 'Styling', id: 'label-styling', icon: <FormatColorTextIcon fontSize="small" /> }
  ]
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Preview Section */}
      <ComponentPreview>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: props.textAlign, width: '100%' }}>
          <Typography
            variant={variant as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'subtitle1' | 'subtitle2' | 'body1' | 'body2'}
            noWrap={Boolean(props.noWrap)}
            sx={previewStyles}
          >
            {(props.text as string) || 'Label Text'}
          </Typography>
          
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed rgba(0,0,0,0.1)', width: '100%', display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
              {variant} {useCustomColor && (
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', ml: 1 }}>
                  • Color: <Box component="span" sx={{ width: 10, height: 10, bgcolor: customColor, borderRadius: '50%', display: 'inline-block', mx: 0.5 }} /> {customColor}
                </Box>
              )}
              {isBold && ' • Bold'}
              {isItalic && ' • Italic'}
              {hasUnderline && ' • Underlined'}
              {props.noWrap && ' • No Wrap'}
              {' • Align: ' + textAlign}
            </Typography>
          </Box>
        </Box>
      </ComponentPreview>
      
      {/* Tabs Navigation */}
      <EditorTabs
        value={tabValue}
        onChange={handleTabChange}
        tabs={editorTabs}
      />
      
      {/* Content Tab */}
      <TabPanelShared value={tabValue} index={0} id="label">
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Label Text"
              fullWidth
              onFocus={(e) => { e.target.select() }}
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
          <Grid item xs={12} sm={6}>
            <CustomColorControl
              useCustomColor={useCustomColor}
              customColor={customColor}
              onColorChange={handleColorChange}
              onToggleCustomColor={handleCustomColorToggle}
              label="Use Custom Color"
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(props.noWrap)}
                  onChange={(e) => handleChange('noWrap', e.target.checked)}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  No Text Wrapping
                  <TooltipStyled title="When enabled, text will not wrap to a new line and will be truncated with an ellipsis if it exceeds available space.">
                    <InfoOutlinedIcon fontSize="small" sx={{ ml: 0.5 }} />
                  </TooltipStyled>
                </Box>
              }
            />
          </Grid>
        </Grid>
      </TabPanelShared>
      
      {/* Typography Tab */}
      <TabPanelShared value={tabValue} index={1} id="label">
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
      </TabPanelShared>
    </Box>
  )
}

export default LabelEditor 