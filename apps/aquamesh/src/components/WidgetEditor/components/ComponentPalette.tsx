import React from 'react'
import {
  Box,
  Typography,
  Divider
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { getComponentsByCategory } from '../constants/componentTypes'
import ComponentPaletteItem from './ComponentPaletteItem'

interface ComponentPaletteProps {
  showTooltips: boolean;
  handleDragStart: (e: React.DragEvent, type: string) => void;
}

const ComponentPalette: React.FC<ComponentPaletteProps> = ({
  showTooltips,
  handleDragStart
}) => {
  return (
    <Box
      sx={{
        width: 250,
        p: 2,
        borderRight: '1px solid',
        borderColor: 'divider',
        overflowY: 'auto',
        bgcolor: 'background.paper',
        height: '100%'
      }}
    >
      <Typography variant="subtitle2" gutterBottom sx={{ color: 'foreground.contrastPrimary' }}>
        Widget Components
      </Typography>
      <Divider sx={{ mb: 2 }} />

      {Object.entries(getComponentsByCategory()).map(([category, components]) => (
        <Box key={category} sx={{ mb: 3 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {category}
          </Typography>
          {components.map(component => (
            <ComponentPaletteItem
              key={component.type}
              type={component.type}
              label={component.label}
              tooltip={showTooltips ? component.tooltip || '' : ''}
              icon={component.icon || InfoOutlinedIcon}
              onDragStart={handleDragStart}
            />
          ))}
        </Box>
      ))}
    </Box>
  )
}

export default ComponentPalette 