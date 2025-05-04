import React from 'react'
import { 
  Box, 
  Typography, 
  Paper,
  Tooltip 
} from '@mui/material'
import { ComponentType } from '../../types/types'

interface ComponentPaletteItemProps {
  component: ComponentType
  showTooltips: boolean
  handleDragStart: (e: React.DragEvent<HTMLDivElement>, type: string) => void
}

const ComponentPaletteItem: React.FC<ComponentPaletteItemProps> = ({
  component,
  showTooltips,
  handleDragStart
}) => {
  // Create the icon element dynamically from the component's icon property
  const IconComponent = component.icon
  
  return (
    <Box key={component.type} sx={{ mb: 1 }}>
      <Tooltip
        title={showTooltips ? component.tooltip || '' : ''}
        placement="right"
        arrow
      >
        <Paper
          elevation={1}
          draggable
          onDragStart={(e) => handleDragStart(e, component.type)}
          sx={{
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            cursor: 'grab',
            transition: 'all 0.2s',
            '&:hover': {
              bgcolor: 'background.paper',
              transform: 'translateY(-2px)',
              boxShadow: 2,
            },
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 1,
          }}
        >
          <Box
            sx={{
              mr: 1.5,
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {IconComponent && <IconComponent />}
          </Box>
          <Typography
            variant="body2"
            sx={{ fontWeight: 'medium', color: 'foreground.contrastPrimary' }}
          >
            {component.label}
          </Typography>
        </Paper>
      </Tooltip>
    </Box>
  )
}

export default ComponentPaletteItem 