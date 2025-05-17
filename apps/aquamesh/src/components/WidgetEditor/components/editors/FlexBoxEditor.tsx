import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Grid,
  Slider,
  Stack,
  Chip,
  Button,
  useMediaQuery,
  useTheme
} from '@mui/material'
import FormatColorTextIcon from '@mui/icons-material/FormatColorText'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SettingsIcon from '@mui/icons-material/Settings'

import {
  ComponentPreview,
  TabPanelShared,
  EditorTabs
} from '../shared/SharedEditorComponents'

interface FlexBoxEditorProps {
  props: Record<string, unknown>
  onChange: (updatedProps: Record<string, unknown>) => void
}

const FlexBoxEditor: React.FC<FlexBoxEditorProps> = ({ props, onChange }) => {
  // Theme and responsive design
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  
  // Tab state
  const [tabValue, setTabValue] = useState(0)
  
  // FlexBox states
  const [direction, setDirection] = useState((props.direction as string) || 'row')
  const [justifyContent, setJustifyContent] = useState((props.justifyContent as string) || 'flex-start')
  const [alignItems, setAlignItems] = useState((props.alignItems as string) || 'center')
  const [flexWrap, setFlexWrap] = useState((props.wrap as string) || 'wrap')
  const [spacing, setSpacing] = useState<number>(typeof props.spacing === 'number' ? props.spacing : 1)
  const [padding, setPadding] = useState<number>(typeof props.padding === 'number' ? props.padding : 1)
  
  // Initialize state based on props
  useEffect(() => {
    if (props.direction) {
      setDirection(props.direction as string)
    }
    
    if (props.justifyContent) {
      setJustifyContent(props.justifyContent as string)
    }
    
    if (props.alignItems) {
      setAlignItems(props.alignItems as string)
    }
    
    if (props.wrap) {
      setFlexWrap(props.wrap as string)
    }
    
    if (typeof props.spacing === 'number') {
      setSpacing(props.spacing as number)
    }
    
    if (typeof props.padding === 'number') {
      setPadding(props.padding as number)
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
  
  // Generate preview boxes
  const generatePreviewBoxes = () => {
    const boxes = []
    for (let i = 0; i < 3; i++) {
      boxes.push(
        <Box
          key={i}
          sx={{
            backgroundColor: i === 0 ? '#ef5350' : i === 1 ? '#42a5f5' : '#66bb6a',
            width: direction.includes('column') ? '80%' : 40,
            height: direction.includes('column') ? 40 : 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 1,
            p: isMobile ? 0.5 : 1,
            color: 'white',
            fontWeight: 'bold',
            fontSize: isMobile ? '0.75rem' : 'inherit'
          }}
        >
          {i + 1}
        </Box>
      )
    }
    return boxes
  }
  
  // Get alignment description
  const getAlignmentDescription = () => {
    let justifyText = '';
    let alignText = '';
    
    // Map justifyContent values to readable descriptions
    switch (justifyContent) {
      case 'flex-start': justifyText = 'Start'; break;
      case 'flex-end': justifyText = 'End'; break;
      case 'center': justifyText = 'Center'; break;
      case 'space-between': justifyText = 'Space Between'; break;
      case 'space-around': justifyText = 'Space Around'; break;
      case 'space-evenly': justifyText = 'Space Evenly'; break;
      default: justifyText = justifyContent;
    }
    
    // Map alignItems values to readable descriptions
    switch (alignItems) {
      case 'flex-start': alignText = 'Start'; break;
      case 'flex-end': alignText = 'End'; break;
      case 'center': alignText = 'Center'; break;
      case 'stretch': alignText = 'Stretch'; break;
      case 'baseline': alignText = 'Baseline'; break;
      default: alignText = alignItems;
    }
    
    return {
      justifyText,
      alignText
    };
  }
  
  const { justifyText, alignText } = getAlignmentDescription();
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Preview Section */}
      <ComponentPreview>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          width: '100%',
          p: isMobile ? 1 : 2 
        }}>
          <Box 
            sx={{ 
              display: 'flex',
              flexDirection: direction as 'row' | 'column' | 'row-reverse' | 'column-reverse',
              justifyContent: justifyContent as string,
              alignItems: alignItems as string,
              flexWrap: flexWrap as 'nowrap' | 'wrap' | 'wrap-reverse',
              gap: spacing,
              padding: padding,
              width: '100%',
              border: '1px dashed #ccc',
              borderRadius: 1,
              minHeight: isMobile ? '100px' : '120px',
              backgroundColor: 'rgba(0,0,0,0.02)'
            }}
          >
            {generatePreviewBoxes()}
          </Box>
          
          <Box sx={{ 
            mt: isMobile ? 1 : 2, 
            pt: isMobile ? 1 : 2, 
            borderTop: '1px dashed rgba(0,0,0,0.1)', 
            width: '100%' 
          }}>
            <Stack 
              direction="row" 
              spacing={0.5} 
              flexWrap="wrap" 
              justifyContent="center" 
              sx={{ mb: isMobile ? 0.5 : 1, gap: isMobile ? 0.5 : 1 }}
            >
              <Chip 
                size="small" 
                label={`Direction: ${direction}`} 
                color="primary" 
                variant="outlined" 
                sx={{ fontSize: isMobile ? '0.65rem' : undefined }}
              />
              <Chip 
                size="small" 
                label={`Justify: ${justifyText}`} 
                color="secondary" 
                variant="outlined" 
                sx={{ fontSize: isMobile ? '0.65rem' : undefined }}
              />
              <Chip 
                size="small" 
                label={`Align: ${alignText}`} 
                color="info" 
                variant="outlined" 
                sx={{ fontSize: isMobile ? '0.65rem' : undefined }}
              />
              <Chip 
                size="small" 
                label={`Wrap: ${flexWrap}`} 
                color="default" 
                variant="outlined" 
                sx={{ fontSize: isMobile ? '0.65rem' : undefined }}
              />
            </Stack>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'text.secondary', 
                display: 'flex', 
                flexWrap: 'wrap', 
                justifyContent: 'center', 
                gap: 1,
                fontSize: isMobile ? '0.65rem' : undefined 
              }}
            >
              <span>Gap: {spacing}</span>
              <span>•</span>
              <span>Padding: {padding}</span>
              {Boolean(props.scrollable) && (
                <>
                  <span>•</span>
                  <span>Scrollable</span>
                </>
              )}
            </Typography>
          </Box>
        </Box>
      </ComponentPreview>
      
      {/* Tabs Navigation */}
      <EditorTabs
        value={tabValue}
        onChange={handleTabChange}
        tabs={[
          { label: 'Basic Settings', id: 'flexbox-basic', icon: <SettingsIcon fontSize={isMobile ? "small" : "medium"} /> },
          { label: 'Styling', id: 'label-styling', icon: <FormatColorTextIcon fontSize={isMobile ? "small" : "medium"} /> }
        ]}
      />
      
      {/* Layout Tab */}
      <TabPanelShared value={tabValue} index={0}>
        <Grid container spacing={isMobile ? 1 : 2}>
          {/* Flex Direction */}
          <Grid item xs={12}>
            <Typography 
              variant={isMobile ? "body2" : "subtitle2"} 
              gutterBottom
              sx={{ fontSize: isMobile ? '0.875rem' : undefined }}
            >
              Flex Direction
            </Typography>
            <Grid container spacing={isMobile ? 0.5 : 1}>
              <Grid item xs={3}>
                <Button 
                  fullWidth
                  variant={direction === 'row' ? 'contained' : 'outlined'}
                  onClick={() => {
                    setDirection('row')
                    handleChange('direction', 'row')
                  }}
                  sx={{ 
                    height: isMobile ? '50px' : '60px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 0.5 
                  }}
                  size={isMobile ? "small" : "medium"}
                >
                  <ArrowForwardIcon fontSize={isMobile ? "small" : "medium"} />
                  <Typography variant="caption" sx={{ fontSize: isMobile ? '0.65rem' : undefined }}>
                    Row
                  </Typography>
                </Button>
              </Grid>
              <Grid item xs={3}>
                <Button 
                  fullWidth
                  variant={direction === 'column' ? 'contained' : 'outlined'}
                  onClick={() => {
                    setDirection('column')
                    handleChange('direction', 'column')
                  }}
                  sx={{ 
                    height: isMobile ? '50px' : '60px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 0.5 
                  }}
                  size={isMobile ? "small" : "medium"}
                >
                  <ArrowDownwardIcon fontSize={isMobile ? "small" : "medium"} />
                  <Typography variant="caption" sx={{ fontSize: isMobile ? '0.65rem' : undefined }}>
                    Column
                  </Typography>
                </Button>
              </Grid>
              <Grid item xs={3}>
                <Button 
                  fullWidth
                  variant={direction === 'row-reverse' ? 'contained' : 'outlined'}
                  onClick={() => {
                    setDirection('row-reverse')
                    handleChange('direction', 'row-reverse')
                  }}
                  sx={{ 
                    height: isMobile ? '50px' : '60px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 0.5 
                  }}
                  size={isMobile ? "small" : "medium"}
                >
                  <ArrowBackIcon fontSize={isMobile ? "small" : "medium"} />
                  <Typography variant="caption" sx={{ fontSize: isMobile ? '0.65rem' : undefined }}>
                    Row Rev
                  </Typography>
                </Button>
              </Grid>
              <Grid item xs={3}>
                <Button 
                  fullWidth
                  variant={direction === 'column-reverse' ? 'contained' : 'outlined'}
                  onClick={() => {
                    setDirection('column-reverse')
                    handleChange('direction', 'column-reverse')
                  }}
                  sx={{ 
                    height: isMobile ? '50px' : '60px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 0.5 
                  }}
                  size={isMobile ? "small" : "medium"}
                >
                  <ArrowUpwardIcon fontSize={isMobile ? "small" : "medium"} />
                  <Typography variant="caption" sx={{ fontSize: isMobile ? '0.65rem' : undefined }}>
                    Col Rev
                  </Typography>
                </Button>
              </Grid>
            </Grid>
          </Grid>
          
          {/* Justification */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth sx={{ mt: isMobile ? 1 : 2 }} size={isMobile ? "small" : "medium"}>
              <InputLabel sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Justify Content</InputLabel>
              <Select
                value={justifyContent}
                label="Justify Content"
                onChange={(e) => {
                  setJustifyContent(e.target.value)
                  handleChange('justifyContent', e.target.value)
                }}
                sx={{
                  '& .MuiSelect-select': { fontSize: isMobile ? '0.875rem' : undefined }
                }}
              >
                <MenuItem value="flex-start" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Start</MenuItem>
                <MenuItem value="center" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Center</MenuItem>
                <MenuItem value="flex-end" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>End</MenuItem>
                <MenuItem value="space-between" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Space Between</MenuItem>
                <MenuItem value="space-around" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Space Around</MenuItem>
                <MenuItem value="space-evenly" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Space Evenly</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {/* Alignment */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth sx={{ mt: isMobile ? 1 : 2 }} size={isMobile ? "small" : "medium"}>
              <InputLabel sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Align Items</InputLabel>
              <Select
                value={alignItems}
                label="Align Items"
                onChange={(e) => {
                  setAlignItems(e.target.value)
                  handleChange('alignItems', e.target.value)
                }}
                sx={{
                  '& .MuiSelect-select': { fontSize: isMobile ? '0.875rem' : undefined }
                }}
              >
                <MenuItem value="flex-start" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Start</MenuItem>
                <MenuItem value="center" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Center</MenuItem>
                <MenuItem value="flex-end" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>End</MenuItem>
                <MenuItem value="stretch" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Stretch</MenuItem>
                <MenuItem value="baseline" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Baseline</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {/* Wrapping */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size={isMobile ? "small" : "medium"}>
              <InputLabel sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Flex Wrap</InputLabel>
              <Select
                value={flexWrap}
                label="Flex Wrap"
                onChange={(e) => {
                  setFlexWrap(e.target.value)
                  handleChange('wrap', e.target.value)
                }}
                sx={{
                  '& .MuiSelect-select': { fontSize: isMobile ? '0.875rem' : undefined }
                }}
              >
                <MenuItem value="nowrap" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>No Wrap</MenuItem>
                <MenuItem value="wrap" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Wrap</MenuItem>
                <MenuItem value="wrap-reverse" sx={{ fontSize: isMobile ? '0.875rem' : undefined }}>Wrap Reverse</MenuItem>
              </Select>
            </FormControl>
          </Grid> 
        </Grid>
      </TabPanelShared>
      
      {/* Appearance Tab */}
      <TabPanelShared value={tabValue} index={1}>
        
        {/* Spacing */}
        <Grid item xs={12} sx={{ marginX: isMobile ? 1 : 2 }}>
          <Typography 
            variant={isMobile ? "body2" : "subtitle2"} 
            gutterBottom
            sx={{ fontSize: isMobile ? '0.875rem' : undefined }}
          >
            Item Spacing (Gap)
          </Typography>
          <Slider
            value={spacing}
            min={0}
            max={8}
            step={1}
            marks
            size={isMobile ? "small" : "medium"}
            valueLabelDisplay="auto"
            onChange={(_e, value) => {
              setSpacing(value as number)
              handleChange('spacing', value)
            }}
            sx={{
              '& .MuiSlider-markLabel': {
                color: 'text.primary',
                fontWeight: 'medium',
                fontSize: isMobile ? '0.75rem' : undefined
              }
            }}
          />
        </Grid>
        <Grid container spacing={isMobile ? 1 : 2}>
          {/* Padding */}
          <Grid item xs={12} sx={{ marginX: isMobile ? 1 : 2 }}>
            <Typography 
              variant={isMobile ? "body2" : "subtitle2"} 
              gutterBottom
              sx={{ fontSize: isMobile ? '0.875rem' : undefined }}
            >
              Container Padding
            </Typography>
            <Slider
              value={padding}
              min={0}
              max={8}
              step={1}
              marks
              size={isMobile ? "small" : "medium"}
              valueLabelDisplay="auto"
              onChange={(_e, value) => {
                setPadding(value as number)
                handleChange('padding', value)
              }}
              sx={{
                '& .MuiSlider-markLabel': {
                  color: 'text.primary',
                  fontWeight: 'medium',
                  fontSize: isMobile ? '0.75rem' : undefined
                }
              }}
            />
          </Grid>
        </Grid>
      </TabPanelShared>
    </Box>
  )
}

export default FlexBoxEditor