import React, { useState, useEffect, useMemo } from 'react'
import { useMediaQuery, useTheme } from '@mui/material'

export type BreakpointBehavior = {
  xs?: React.ReactNode
  sm?: React.ReactNode
  md?: React.ReactNode
  lg?: React.ReactNode
  xl?: React.ReactNode
}

export type ResponsiveStyle = {
  xs?: object
  sm?: object
  md?: object
  lg?: object
  xl?: object
}

type BreakpointKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface ResponsiveContainerProps {
  /**
   * Different content to display based on breakpoint
   */
  responsive?: BreakpointBehavior
  
  /**
   * Styles to apply based on breakpoint
   */
  stylesByBreakpoint?: ResponsiveStyle
  
  /**
   * Default content to display if no breakpoint matches
   */
  children?: React.ReactNode
  
  /**
   * Container element type
   */
  component?: React.ElementType
  
  /**
   * Additional styles
   */
  sx?: object
  
  /**
   * Additional classes
   */
  className?: string
  
  /**
   * Use container queries instead of viewport queries
   */
  useContainerQueries?: boolean
}

/**
 * A responsive container that adapts its content and styles based on screen size
 */
const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  responsive,
  stylesByBreakpoint,
  children,
  component = 'div',
  sx,
  className,
  useContainerQueries = false
}) => {
  const theme = useTheme()
  
  // Define breakpoint matches using useMediaQuery
  const isSm = useMediaQuery(theme.breakpoints.only('sm'))
  const isMd = useMediaQuery(theme.breakpoints.only('md'))
  const isLg = useMediaQuery(theme.breakpoints.only('lg'))
  const isXl = useMediaQuery(theme.breakpoints.up('xl'))
  
  // For container queries, we'll need ref and state
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  
  // Set up resize observer for container queries
  useEffect(() => {
    if (!useContainerQueries || !containerRef.current) {
      return
    }
    
    const resizeObserver = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect
      setContainerWidth(width)
    })
    
    resizeObserver.observe(containerRef.current)
    
    return () => {
      resizeObserver.disconnect()
    }
  }, [useContainerQueries])
  
  // Determine breakpoint from container width
  const containerBreakpoint = useMemo(() => {
    if (!useContainerQueries) {
      return null
    }
    
    if (containerWidth < theme.breakpoints.values.sm) {
      return 'xs'
    }
    if (containerWidth < theme.breakpoints.values.md) {
      return 'sm'
    }
    if (containerWidth < theme.breakpoints.values.lg) {
      return 'md'
    }
    if (containerWidth < theme.breakpoints.values.xl) {
      return 'lg'
    }
    return 'xl'
  }, [containerWidth, theme.breakpoints.values, useContainerQueries])
  
  // Get current breakpoint
  const getCurrentBreakpoint = (): BreakpointKey => {
    if (useContainerQueries && containerBreakpoint) {
      return containerBreakpoint as BreakpointKey
    }
    
    if (isXl) {
      return 'xl'
    }
    if (isLg) {
      return 'lg'
    }
    if (isMd) {
      return 'md'
    }
    if (isSm) {
      return 'sm'
    }
    return 'xs'
  }
  
  // Get styles for current breakpoint
  const getBreakpointStyles = () => {
    if (!stylesByBreakpoint) {
      return {}
    }
    
    const breakpoint = getCurrentBreakpoint()
    let styles = {}
    
    // Apply cascading styles (xs styles apply to all breakpoints, sm to sm and up, etc.)
    if (stylesByBreakpoint.xs) {
      styles = { ...styles, ...stylesByBreakpoint.xs }
    }
    
    if (breakpoint !== 'xs' && stylesByBreakpoint.sm) {
      styles = { ...styles, ...stylesByBreakpoint.sm }
    }
    
    if (['md', 'lg', 'xl'].includes(breakpoint) && stylesByBreakpoint.md) {
      styles = { ...styles, ...stylesByBreakpoint.md }
    }
    
    if (['lg', 'xl'].includes(breakpoint) && stylesByBreakpoint.lg) {
      styles = { ...styles, ...stylesByBreakpoint.lg }
    }
    
    if (breakpoint === 'xl' && stylesByBreakpoint.xl) {
      styles = { ...styles, ...stylesByBreakpoint.xl }
    }
    
    return styles
  }
  
  // Determine content based on breakpoint
  const getContent = () => {
    if (!responsive) {
      return children
    }
    
    const breakpoint = getCurrentBreakpoint()
    return responsive[breakpoint] || children
  }
  
  // Combine all styles
  const combinedStyles = {
    ...getBreakpointStyles(),
    ...sx
  }
  
  const Component = component
  
  return (
    <Component
      ref={useContainerQueries ? containerRef : undefined}
      sx={combinedStyles}
      className={className}
    >
      {getContent()}
    </Component>
  )
}

export default ResponsiveContainer 