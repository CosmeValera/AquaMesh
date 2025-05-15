import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  TextField,
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
const GridVisualizer: React.FC<{ columns: number }> = ({ 
  columns
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
            borderColor: '#ccc',
            backgroundColor: '#00c49a',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 1,
            aspectRatio: '1/1',
            fontSize: '0.75rem',
            height: '80px'
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
        gap: 2,
      }}
    >
      {cells}
    </Box>
  )
}

const GridBoxEditor: React.FC<GridBoxEditorProps> = ({ props, onChange }) => {
  // GridBox states
  const [columns, setColumns] = useState<number>(typeof props.columns === 'number' ? props.columns : 2)
  const [cellPadding, setCellPadding] = useState<number>(typeof props.cellPadding === 'number' ? props.cellPadding : 1)
  
  // Initialize state based on props
  useEffect(() => {
    if (typeof props.columns === 'number') {
      setColumns(props.columns)
    }
    
    if (typeof props.cellPadding === 'number') {
      setCellPadding(props.cellPadding)
    }
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
          />
          
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed rgba(0,0,0,0.1)', width: '100%' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
              <span>{columns} Columns</span>
              {cellPadding > 0 && (
                <>
                  <span>•</span>
                  <span>Cell Padding: {cellPadding}</span>
                </>
              )}
            </Typography>
          </Box>
        </Box>
      </ComponentPreview>
      
      <Grid container spacing={2} sx={{ padding: 2 }}>
        <Grid item xs={12} sm={6}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
            />
            <Tooltip title="Enter a value between 1 and 12">
              <InfoOutlinedIcon fontSize="small" sx={{ ml: 0.5, mb: 3.5 }} />
            </Tooltip>
          </Box>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2" gutterBottom>
              Cell Padding
            </Typography>
            <Tooltip title="Padding adds space inside each cell, around the content">
              <InfoOutlinedIcon fontSize="small" sx={{ ml: 1 }} />
            </Tooltip>
          </Box>
          <Box sx={{ marginRight: 2 }}>
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
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}

export default GridBoxEditor