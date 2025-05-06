import React, { useState } from 'react'
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Switch,
  TextField,
  Tooltip,
  InputAdornment,
  Paper,
  Slider,
  Tabs,
  Tab
} from '@mui/material'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify'
import ColorLensIcon from '@mui/icons-material/ColorLens'

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

// ============= TYPES =============

export interface TextStyleProps {
  fontWeight?: number;
  isBold?: boolean;
  isItalic?: boolean;
  hasUnderline?: boolean;
  textAlign?: string;
  onChange: (prop: string, value: unknown) => void;
}

export interface ColorPickerProps {
  open: boolean;
  currentColor: string;
  onClose: () => void;
  onSave: (color: string) => void;
  title?: string;
}

export interface CustomColorProps {
  useCustomColor: boolean;
  customColor: string;
  onColorChange: (color: string) => void;
  onToggleCustomColor: (useCustom: boolean) => void;
  label?: string;
}

export interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
  id?: string;
}

export interface PreviewProps {
  children: React.ReactNode;
}

// ============= COMPONENTS =============

/**
 * Reusable TabPanel component
 */
export const TabPanelShared: React.FC<TabPanelProps> = ({ children, value, index, id = 'widget' }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`${id}-tabpanel-${index}`}
      aria-labelledby={`${id}-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  )
}

/**
 * Standardized component preview container
 */
export const ComponentPreview: React.FC<PreviewProps> = ({ children }) => {
  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        mb: 2, 
        p: 2, 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        bgcolor: 'transparent',
        borderRadius: 1,
        minHeight: '80px'
      }}
    >
      <Typography variant="subtitle2" gutterBottom sx={{ color: '#191919', fontWeight: 500, alignSelf: 'flex-start' }}>
        Preview
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, width: '100%' }}>
        {children}
      </Box>
    </Paper>
  )
}

/**
 * Reusable editor tabs component
 */
export const EditorTabs: React.FC<{
  value: number;
  onChange: (event: React.SyntheticEvent, newValue: number) => void;
  tabs: { label: string; id: string }[];
}> = ({ value, onChange, tabs }) => {
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tabs 
        value={value} 
        onChange={onChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          '& .MuiTab-root': {
            color: '#191919',
            '&.Mui-selected': {
              color: 'primary.main',
            }
          }
        }}
      >
        {tabs.map((tab, index) => (
          <Tab key={tab.id} label={tab.label} id={`${tab.id}-tab-${index}`} />
        ))}
      </Tabs>
    </Box>
  )
}

/**
 * Text styling controls (bold, italic, underline)
 */
export const TextStylingControls: React.FC<TextStyleProps> = ({
  fontWeight = 400,
  isBold = false,
  isItalic = false,
  hasUnderline = false,
  onChange
}) => {
  const toggleBold = () => {
    const newIsBold = !isBold
    const newWeight = newIsBold ? 700 : 400
    onChange('fontWeight', newWeight)
  }
  
  const toggleItalic = () => {
    onChange('fontStyle', !isItalic ? 'italic' : 'normal')
  }
  
  const toggleUnderline = () => {
    onChange('textDecoration', !hasUnderline ? 'underline' : 'none')
  }

  return (
    <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.05)', mb: 2 }}>
      <Typography variant="subtitle2" gutterBottom sx={{ color: '#191919' }}>
        Text Styling
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Tooltip title="Bold">
          <IconButton 
            sx={{ 
              bgcolor: isBold ? 'rgba(0, 0, 0, 0.1)' : 'transparent',
              color: '#191919'
            }} 
            onClick={toggleBold}
          >
            <FormatBoldIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Italic">
          <IconButton 
            sx={{ 
              bgcolor: isItalic ? 'rgba(0, 0, 0, 0.1)' : 'transparent',
              color: '#191919'
            }} 
            onClick={toggleItalic}
          >
            <FormatItalicIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Underline">
          <IconButton 
            sx={{ 
              bgcolor: hasUnderline ? 'rgba(0, 0, 0, 0.1)' : 'transparent',
              color: '#191919'
            }} 
            onClick={toggleUnderline}
          >
            <FormatUnderlinedIcon />
          </IconButton>
        </Tooltip>
      </Box>
      
      <Box sx={{ mt: 2 }}>
        <Typography gutterBottom>
          Font Weight: {fontWeight}
        </Typography>
        <Slider
          value={fontWeight}
          min={100}
          max={900}
          step={100}
          marks
          onChange={(_e, value) => {
            const newValue = Array.isArray(value) ? value[0] : value
            onChange('fontWeight', newValue)
          }}
        />
      </Box>
    </Paper>
  )
}

/**
 * Text alignment controls
 */
export const TextAlignmentControls: React.FC<{
  textAlign: string;
  onChange: (align: string) => void;
}> = ({ textAlign, onChange }) => {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography gutterBottom>
        Text Alignment
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <IconButton 
          color={textAlign === 'left' ? 'primary' : 'default'} 
          onClick={() => onChange('left')}
          sx={{
            color: textAlign === 'left' ? 'primary.main' : 'rgba(0, 0, 0, 0.54)',
          }}
        >
          <FormatAlignLeftIcon />
        </IconButton>
        
        <IconButton 
          color={textAlign === 'center' ? 'primary' : 'default'} 
          onClick={() => onChange('center')}
          sx={{
            color: textAlign === 'center' ? 'primary.main' : 'rgba(0, 0, 0, 0.54)',
          }}
        >
          <FormatAlignCenterIcon />
        </IconButton>
        
        <IconButton 
          color={textAlign === 'right' ? 'primary' : 'default'} 
          onClick={() => onChange('right')}
          sx={{
            color: textAlign === 'right' ? 'primary.main' : 'rgba(0, 0, 0, 0.54)',
          }}
        >
          <FormatAlignRightIcon />
        </IconButton>
        
        <IconButton 
          color={textAlign === 'justify' ? 'primary' : 'default'} 
          onClick={() => onChange('justify')}
          sx={{
            color: textAlign === 'justify' ? 'primary.main' : 'rgba(0, 0, 0, 0.54)',
          }}
        >
          <FormatAlignJustifyIcon />
        </IconButton>
      </Box>
    </Box>
  )
}

/**
 * Color picker modal component
 */
export const ColorPickerModal: React.FC<ColorPickerProps> = ({ 
  open, 
  currentColor, 
  onClose, 
  onSave,
  title = "Choose Color"
}) => {
  const [selectedColor, setSelectedColor] = useState(currentColor)

  // Reset selected color when modal opens with a new color
  React.useEffect(() => {
    setSelectedColor(currentColor)
  }, [currentColor, open])

  const handleSave = () => {
    onSave(selectedColor)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
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

/**
 * Custom color control with toggle
 */
export const CustomColorControl: React.FC<CustomColorProps> = ({
  useCustomColor,
  customColor,
  onColorChange,
  onToggleCustomColor,
  label = "Use Custom Color"
}) => {
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  
  const handleCustomColorToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onToggleCustomColor(e.target.checked)
  }
  
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onColorChange(e.target.value)
  }
  
  const handleColorPickerSave = (color: string) => {
    onColorChange(color)
  }

  return (
    <Box sx={{ mb: 2 }}>
      <FormControlLabel
        control={
          <Switch
            checked={useCustomColor}
            onChange={handleCustomColorToggle}
          />
        }
        label={label}
      />
      
      {useCustomColor && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" gutterBottom>
            Text Color
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box 
              sx={{ 
                width: '36px', 
                height: '36px', 
                bgcolor: customColor,
                borderRadius: '4px',
                border: '1px solid rgba(0,0,0,0.2)',
                cursor: 'pointer' 
              }}
              onClick={() => setColorPickerOpen(true)}
            />
            <TextField 
              size="small" 
              value={customColor}
              onChange={handleColorChange}
              placeholder="#000000"
              variant="outlined"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setColorPickerOpen(true)}>
                      <ColorLensIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'rgba(0, 0, 0, 0.23)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'primary.light',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#191919',
                },
                '& .MuiOutlinedInput-input': {
                  color: '#000000',
                },
              }}
            />
          </Box>
        </Box>
      )}
      
      <ColorPickerModal
        open={colorPickerOpen}
        currentColor={customColor}
        onClose={() => setColorPickerOpen(false)}
        onSave={handleColorPickerSave}
      />
    </Box>
  )
}

/**
 * Dual color picker for components that need two colors (like a button and its hover state)
 */
export const DualColorPicker: React.FC<{
  useCustomColor: boolean;
  primaryColor: string;
  secondaryColor: string;
  onToggleCustomColor: (useCustom: boolean) => void;
  onPrimaryColorChange: (color: string) => void;
  onSecondaryColorChange: (color: string) => void;
  primaryLabel?: string;
  secondaryLabel?: string;
}> = ({
  useCustomColor,
  primaryColor,
  secondaryColor,
  onToggleCustomColor,
  onPrimaryColorChange,
  onSecondaryColorChange,
  primaryLabel = "Button Color",
  secondaryLabel = "Hover Color"
}) => {
  const [primaryColorPickerOpen, setPrimaryColorPickerOpen] = useState(false)
  const [secondaryColorPickerOpen, setSecondaryColorPickerOpen] = useState(false)
  
  const handleCustomColorToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onToggleCustomColor(e.target.checked)
  }

  return (
    <Box sx={{ mb: 2 }}>
      <FormControlLabel
        control={
          <Switch
            checked={useCustomColor}
            onChange={handleCustomColorToggle}
          />
        }
        label="Use Custom Colors"
      />
      
      {useCustomColor && (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Primary Color */}
          <TextField
            fullWidth
            label={primaryLabel}
            value={primaryColor}
            onChange={(e) => onPrimaryColorChange(e.target.value)}
            variant="outlined"
            margin="dense"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      bgcolor: primaryColor,
                      borderRadius: '2px',
                      border: '1px solid rgba(0,0,0,0.23)',
                      cursor: 'pointer'
                    }}
                    onClick={() => setPrimaryColorPickerOpen(true)}
                  />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setPrimaryColorPickerOpen(true)}>
                    <ColorLensIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'rgba(0, 0, 0, 0.23)',
                },
                '&:hover fieldset': {
                  borderColor: 'primary.light',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.main',
                },
              },
              '& .MuiInputLabel-root': {
                color: '#191919',
              },
              '& .MuiOutlinedInput-input': {
                color: '#000000',
              },
            }}
          />
          
          {/* Secondary Color */}
          <TextField
            fullWidth
            label={secondaryLabel}
            value={secondaryColor}
            onChange={(e) => onSecondaryColorChange(e.target.value)}
            variant="outlined"
            margin="dense"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      bgcolor: secondaryColor,
                      borderRadius: '2px',
                      border: '1px solid rgba(0,0,0,0.23)',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSecondaryColorPickerOpen(true)}
                  />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSecondaryColorPickerOpen(true)}>
                    <ColorLensIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'rgba(0, 0, 0, 0.23)',
                },
                '&:hover fieldset': {
                  borderColor: 'primary.light',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.main',
                },
              },
              '& .MuiInputLabel-root': {
                color: '#191919',
              },
              '& .MuiOutlinedInput-input': {
                color: '#000000',
              },
            }}
          />
        </Box>
      )}
      
      {/* Color Picker Modals */}
      <ColorPickerModal
        open={primaryColorPickerOpen}
        currentColor={primaryColor}
        onClose={() => setPrimaryColorPickerOpen(false)}
        onSave={onPrimaryColorChange}
        title={`Choose ${primaryLabel}`}
      />
      
      <ColorPickerModal
        open={secondaryColorPickerOpen}
        currentColor={secondaryColor}
        onClose={() => setSecondaryColorPickerOpen(false)}
        onSave={onSecondaryColorChange}
        title={`Choose ${secondaryLabel}`}
      />
    </Box>
  )
} 