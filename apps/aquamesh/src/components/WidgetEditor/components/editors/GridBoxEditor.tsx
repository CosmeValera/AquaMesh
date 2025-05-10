import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  TextField,
  FormControlLabel,
  Switch,
  Grid,
  Slider,
  Tooltip
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

import { ComponentPreview } from '../shared/SharedEditorComponents'

interface GridBoxEditorProps {
  props: Record<string, unknown>
  onChange: (updatedProps: Record<string, unknown>) => void
}

// Grid visualization component
const GridVisualizer: React.FC<{ columns: number, spacing: number, useCustomColor?: boolean, backgroundColor?: string, borderColor?: string }> = ({ 
  columns, 
  spacing, 
  useCustomColor = false, 
  backgroundColor = '#f5f5f5',
  borderColor = '#e0e0e0'
}) => {
  const rows = 2; // Fixed number of rows
  const cells = []
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      cells.push(
        <Box
          key={`${row}-${col}`}
          sx={{
            border: '1px solid',
            borderColor: useCustomColor ? borderColor : '#ccc',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 1,
            backgroundColor: useCustomColor ? 
              backgroundColor : 
              (row + col) % 2 === 0 ? 'rgba(66, 165, 245, 0.2)' : 'white',
            aspectRatio: '1/1',
            fontSize: '0.75rem',
            height: '100px'
          }}
        >
          {row + 1},{col + 1}
        </Box>
      )
    }
  }
  
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: spacing,
      }}
    >
      {cells}
    </Box>
  )
}

const GridBoxEditor: React.FC<GridBoxEditorProps> = ({ props, onChange }) => {
  // GridBox states
  const [columns, setColumns] = useState<number>(typeof props.columns === 'number' ? props.columns : 3)
  const [spacing, setSpacing] = useState<number>(typeof props.spacing === 'number' ? props.spacing : 2)
  const [cellPadding, setCellPadding] = useState<number>(typeof props.cellPadding === 'number' ? props.cellPadding : 1)
  const [equalHeight, setEqualHeight] = useState(Boolean(props.equalHeight))
  
  // Initialize state based on props
  useEffect(() => {
    if (typeof props.columns === 'number') {
      setColumns(props.columns)
    }
    
    if (typeof props.spacing === 'number') {
      setSpacing(props.spacing)
    }
    
    if (typeof props.cellPadding === 'number') {
      setCellPadding(props.cellPadding)
    }
    
    setEqualHeight(Boolean(props.equalHeight))
  }, [props])
  
  // Generic change handler
  const handleChange = (name: string, value: unknown) => {
    onChange({ ...props, [name]: value })
  }
  
  return (
    <Box sx={{ width: '100%' }}>
      {/* Preview Section */}
      <ComponentPreview>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <GridVisualizer 
            columns={columns} 
            spacing={spacing}
          />
          
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed rgba(0,0,0,0.1)', width: '100%' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
              <span>{columns} Columns</span>
              <span>•</span>
              <span>Gap: {spacing}</span>
              {cellPadding > 0 && (
                <>
                  <span>•</span>
                  <span>Cell Padding: {cellPadding}</span>
                </>
              )}
              {equalHeight && (
                <>
                  <span>•</span>
                  <span>Equal Height Cells</span>
                </>
              )}
            </Typography>
          </Box>
        </Box>
      </ComponentPreview>
      
      <Grid container spacing={2} sx={{ padding: 2 }}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Columns"
            type="number"
            fullWidth
            onFocus={(e) => { e.target.select() }}
            value={columns}
            onChange={(e) => {
              const value = Number(e.target.value)
              // Enforce min and max constraints
              const validValue = Math.min(Math.max(value, 0), 12)
              setColumns(validValue)
              handleChange('columns', validValue)
            }}
            inputProps={{ min: 0, max: 12, step: 1 }}
            helperText="Enter a value between 1 and 12"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={equalHeight}
                onChange={(e) => {
                  setEqualHeight(e.target.checked)
                  handleChange('equalHeight', e.target.checked)
                }}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                Equal Height Cells
                <Tooltip title="When enabled, all cells will have the same height, regardless of their content">
                  <InfoOutlinedIcon fontSize="small" sx={{ ml: 0.5 }} />
                </Tooltip>
              </Box>
            }
          />
        </Grid>
        
        <Grid item xs={12} sx={{ marginX: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Grid Gap (Spacing between cells)
          </Typography>
          <Slider
            value={spacing}
            min={0}
            max={8}
            step={1}
            marks
            valueLabelDisplay="auto"
            onChange={(_e, value) => {
              setSpacing(value as number)
              handleChange('spacing', value)
            }}
            sx={{ marginRight: 2 }}
          />
        </Grid>
        
        
        <Grid item xs={12} sx={{ marginX: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Cell Padding
          </Typography>
          <Box>
            <Slider
              value={cellPadding}
              min={0}
              max={4}
              step={1}
              marks
              valueLabelDisplay="auto"
              onChange={(_e, value) => {
                setCellPadding(value as number)
                handleChange('cellPadding', value)
              }}
              sx={{ marginRight: 2 }}
            />
          </Box>
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
            Padding adds space inside each cell, around the content
          </Typography>
        </Grid>
      </Grid>
    </Box>
  )
}

export default GridBoxEditor