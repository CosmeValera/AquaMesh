import React from 'react'
import { Box, Paper, Typography, Tooltip } from '@mui/material'
import { ComponentPaletteItemProps } from '../types/types'

// Component palette item that can be dragged
const ComponentPaletteItem: React.FC<ComponentPaletteItemProps> = ({ 
  type, 
  label, 
  tooltip, 
  icon: Icon, 
  onDragStart 
}) => {
  return (
    <Tooltip title={tooltip} placement="right" arrow>
      <Paper
        elevation={0}
        sx={{
          p: 1,
          mb: 1,
          cursor: 'grab',
          border: '1px solid #e0e0e0',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
            borderColor: 'primary.light',
          },
          display: 'flex',
          alignItems: 'center',
        }}
        draggable
        onDragStart={(e) => onDragStart(e, type)}
      >
        <Box sx={{ mr: 1, display: 'flex', alignItems: 'center', color:"#F9F9F9"}}>
          <Icon fontSize="small"/>
        </Box>
        <Typography variant="body2">{label}</Typography>
      </Paper>
    </Tooltip>
  )
}

export default ComponentPaletteItem 