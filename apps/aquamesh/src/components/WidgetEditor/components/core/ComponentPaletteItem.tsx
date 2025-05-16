import React, { useState, useRef } from 'react'
import { 
  Box, 
  Typography, 
  Paper,
  IconButton,
  useTheme,
  useMediaQuery
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { ComponentType } from '../../types/types'
import TooltipStyled from '../../../TooltipStyled'

interface ComponentPaletteItemProps {
  component: ComponentType
  showTooltips?: boolean
  handleDragStart: (e: React.DragEvent<HTMLDivElement>, type: string) => void
  isPhone?: boolean
  onDirectAdd?: (componentType: string) => void
}

const ComponentPaletteItem: React.FC<ComponentPaletteItemProps> = ({
  component,
  showTooltips = false,
  handleDragStart,
  isPhone = false,
  onDirectAdd
}) => {
  // Create the icon element dynamically from the component's icon property
  const IconComponent = component.icon
  const theme = useTheme()
  const isPhoneSize = useMediaQuery(theme.breakpoints.down('sm'))
  
  // Touch handling state
  const [isTouching, setIsTouching] = useState(false)
  const touchTimeoutRef = useRef<number | null>(null)
  const touchStartPositionRef = useRef({ x: 0, y: 0 })
  const itemRef = useRef<HTMLDivElement>(null)
  
  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    // Store initial touch position
    touchStartPositionRef.current = { 
      x: e.touches[0].clientX, 
      y: e.touches[0].clientY 
    }
    
    // Set a timeout to determine if it's a touch-and-hold gesture
    touchTimeoutRef.current = window.setTimeout(() => {
      // After the timeout, mark as "touching" to create a draggable state
      setIsTouching(true)
      
      // Create and dispatch a custom drag start event
      if (itemRef.current) {
        const dataTransfer = new DataTransfer()
        dataTransfer.setData('componentType', component.type)
        
        // Create a synthetic drag event
        const dragEvent = new DragEvent('dragstart', { 
          bubbles: true,
          cancelable: true,
          dataTransfer 
        })
        
        // Dispatch the event on the element
        itemRef.current.dispatchEvent(dragEvent)
        
        // Call the handler with the created event
        // Use a cast that preserves type safety better than 'any'
        const syntheticDragEvent = dragEvent as unknown as React.DragEvent<HTMLDivElement>
        handleDragStart(syntheticDragEvent, component.type)
      }
    }, 300) // 300ms is a good balance for touch-and-hold
  }
  
  // Handle touch move
  const handleTouchMove = (e: React.TouchEvent) => {
    // Calculate movement distance
    const currentX = e.touches[0].clientX
    const currentY = e.touches[0].clientY
    const deltaX = Math.abs(currentX - touchStartPositionRef.current.x)
    const deltaY = Math.abs(currentY - touchStartPositionRef.current.y)
    
    // If user moved more than 10px in any direction before the touch timeout,
    // cancel the timeout to allow scrolling
    if ((deltaX > 10 || deltaY > 10) && touchTimeoutRef.current) {
      window.clearTimeout(touchTimeoutRef.current)
      touchTimeoutRef.current = null
    }
  }
  
  // Handle touch end
  const handleTouchEnd = () => {
    // Clear timeout if touch ends
    if (touchTimeoutRef.current) {
      window.clearTimeout(touchTimeoutRef.current)
      touchTimeoutRef.current = null
    }
    
    // Reset touching state
    setIsTouching(false)
  }

  // Handle direct add click
  const handleAddClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    
    if (onDirectAdd) {
      onDirectAdd(component.type)
    }
  }
  
  return (
    <Box key={component.type} sx={{ mb: isPhoneSize ? 0.5 : 1 }}>
      <TooltipStyled
        title={showTooltips ? component.tooltip || '' : ''}
        placement="right"
        arrow
      >
        <Paper
          ref={itemRef}
          elevation={1}
          draggable
          onDragStart={(e) => handleDragStart(e, component.type)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          sx={{
            p: isPhoneSize ? 0.75 : 1.5,
            display: 'flex',
            alignItems: 'center',
            cursor: 'grab',
            transition: 'all 0.2s',
            '&:hover': {
              bgcolor: 'background.paper',
              transform: 'translateY(-2px)',
              boxShadow: 2,
            },
            bgcolor: isTouching 
              ? 'rgba(25, 118, 210, 0.12)' 
              : 'rgba(255, 255, 255, 0.05)',
            borderRadius: 1,
            position: 'relative',
          }}
        >
          <Box
            sx={{
              mr: isPhoneSize ? 0.75 : 1.5,
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {IconComponent && <IconComponent sx={{ fontSize: isPhoneSize ? '0.9rem' : '1.2rem' }} />}
          </Box>
          <Typography
            variant={isPhoneSize ? "caption" : "body2"}
            sx={{ 
              fontWeight: 'medium', 
              color: 'foreground.contrastPrimary',
              flexGrow: 1,
              pr: isPhone ? 2 : 0, // Add padding if there's an add button
              fontSize: isPhoneSize ? '0.7rem' : undefined,
            }}
          >
            {component.label}
          </Typography>
          
          {/* Add button for mobile devices */}
          {isPhone && onDirectAdd && (
            <IconButton
              size="small"
              onClick={handleAddClick}
              sx={{
                position: 'absolute',
                right: 2,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'primary.main',
                bgcolor: 'background.paper',
                width: isPhoneSize ? 18 : 24,
                height: isPhoneSize ? 18 : 24,
                '&:hover': {
                  bgcolor: 'primary.light',
                  color: 'white',
                },
              }}
            >
              <AddIcon fontSize={isPhoneSize ? "inherit" : "small"} />
            </IconButton>
          )}
        </Paper>
      </TooltipStyled>
    </Box>
  )
}

export default ComponentPaletteItem 