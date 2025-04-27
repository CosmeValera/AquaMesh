import React, { useEffect, useRef, useState } from 'react';
import './container-responsive.scss';

/**
 * Hook to get the container width and derived breakpoints.
 * This is used instead of viewport-based media queries.
 */
export const useContainerQueries = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  
  // Breakpoints matching standard responsive design breakpoints
  const breakpoints = {
    xs: containerWidth < 576,
    sm: containerWidth >= 576 && containerWidth < 768,
    md: containerWidth >= 768 && containerWidth < 992,
    lg: containerWidth >= 992 && containerWidth < 1200,
    xl: containerWidth >= 1200
  };
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.getBoundingClientRect().width);
      }
    };
    
    // Initial measurement
    updateWidth();
    
    // Set up resize observer to detect container size changes
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.current);
    
    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
      resizeObserver.disconnect();
    };
  }, []);
  
  return {
    containerRef,
    containerWidth,
    breakpoints
  };
};

/**
 * Container component that provides container query context to its children
 */
interface ContainerQueryWrapperProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const ContainerQueryWrapper: React.FC<ContainerQueryWrapperProps> = ({ 
  children,
  className = '',
  style = {}
}) => {
  const { containerRef, breakpoints } = useContainerQueries();
  
  return (
    <div 
      ref={containerRef}
      className={`container-query-wrapper ${className}`}
      style={style}
      data-breakpoints={Object.entries(breakpoints)
        .filter(([_, isActive]) => isActive)
        .map(([bp]) => bp)
        .join(' ')}
    >
      {children}
    </div>
  );
};

// Create a context to pass container size information down
interface ContainerBreakpointContextType {
  breakpoints: {
    xs: boolean;
    sm: boolean;
    md: boolean;
    lg: boolean;
    xl: boolean;
  };
  containerWidth: number;
}

const ContainerBreakpointContext = React.createContext<ContainerBreakpointContextType | undefined>(undefined);

// Provider component
export const ContainerBreakpointProvider: React.FC<ContainerQueryWrapperProps> = ({
  children,
  className = '',
  style = {}
}) => {
  const { containerRef, containerWidth, breakpoints } = useContainerQueries();
  
  return (
    <ContainerBreakpointContext.Provider value={{ breakpoints, containerWidth }}>
      <div 
        ref={containerRef}
        className={`container-query-wrapper ${className}`}
        style={style}
      >
        {children}
      </div>
    </ContainerBreakpointContext.Provider>
  );
};

// Custom hook to use container breakpoints
export const useContainerBreakpoints = () => {
  const context = React.useContext(ContainerBreakpointContext);
  
  if (context === undefined) {
    // Fallback behavior if not inside a provider
    console.warn('useContainerBreakpoints must be used within a ContainerBreakpointProvider');
    
    // Return default values - assume small container
    return {
      breakpoints: {
        xs: true,
        sm: false,
        md: false,
        lg: false,
        xl: false
      },
      containerWidth: 400
    };
  }
  
  return context;
};

/**
 * A component that conditionally renders content based on container width
 */
interface ContainerVisibilityProps {
  children: React.ReactNode;
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  condition: 'only' | 'up' | 'down';
  as?: keyof JSX.IntrinsicElements;
}

export const ContainerVisible: React.FC<ContainerVisibilityProps> = ({ 
  children, 
  breakpoint, 
  condition,
  as
}) => {
  const { breakpoints } = useContainerBreakpoints();
  
  // Determine visibility based on breakpoint and condition
  let isVisible = false;
  
  const breakpointValues = {
    xs: 0,
    sm: 1,
    md: 2,
    lg: 3,
    xl: 4
  };
  
  const currentBreakpoint = Object.entries(breakpoints)
    .filter(([_, isActive]) => isActive)
    .map(([bp]) => bp as keyof typeof breakpointValues)[0] || 'xs';
  
  const currentValue = breakpointValues[currentBreakpoint];
  const targetValue = breakpointValues[breakpoint];
  
  if (condition === 'only') {
    isVisible = currentValue === targetValue;
  } else if (condition === 'up') {
    isVisible = currentValue >= targetValue;
  } else if (condition === 'down') {
    isVisible = currentValue <= targetValue;
  }
  
  if (!isVisible) return null;
  
  // If no wrapping element is needed, just return children
  if (as === undefined) {
    return <>{children}</>;
  }
  
  // Create the element with the specified tag
  const Component = as as any;
  return <Component>{children}</Component>;
};

// CSS classes to use in JSX
export const CQ = {
  // Column classes
  col1: 'cq-1',
  col2: 'cq-2',
  col3: 'cq-3',
  col4: 'cq-4',
  col5: 'cq-5',
  col6: 'cq-6',
  col7: 'cq-7',
  col8: 'cq-8',
  col9: 'cq-9',
  col10: 'cq-10',
  col11: 'cq-11',
  col12: 'cq-12',
  
  // Responsive column classes
  xs: {
    col1: 'cq-xs-1',
    col2: 'cq-xs-2',
    col3: 'cq-xs-3',
    col4: 'cq-xs-4',
    col5: 'cq-xs-5',
    col6: 'cq-xs-6',
    col7: 'cq-xs-7',
    col8: 'cq-xs-8',
    col9: 'cq-xs-9',
    col10: 'cq-xs-10',
    col11: 'cq-xs-11',
    col12: 'cq-xs-12',
  },
  sm: {
    col1: 'cq-sm-1',
    col2: 'cq-sm-2',
    col3: 'cq-sm-3',
    col4: 'cq-sm-4',
    col5: 'cq-sm-5',
    col6: 'cq-sm-6',
    col7: 'cq-sm-7',
    col8: 'cq-sm-8',
    col9: 'cq-sm-9',
    col10: 'cq-sm-10',
    col11: 'cq-sm-11',
    col12: 'cq-sm-12',
  },
  md: {
    col1: 'cq-md-1',
    col2: 'cq-md-2',
    col3: 'cq-md-3',
    col4: 'cq-md-4',
    col5: 'cq-md-5',
    col6: 'cq-md-6',
    col7: 'cq-md-7',
    col8: 'cq-md-8',
    col9: 'cq-md-9',
    col10: 'cq-md-10',
    col11: 'cq-md-11',
    col12: 'cq-md-12',
  },
  lg: {
    col1: 'cq-lg-1',
    col2: 'cq-lg-2',
    col3: 'cq-lg-3',
    col4: 'cq-lg-4',
    col5: 'cq-lg-5',
    col6: 'cq-lg-6',
    col7: 'cq-lg-7',
    col8: 'cq-lg-8',
    col9: 'cq-lg-9',
    col10: 'cq-lg-10',
    col11: 'cq-lg-11',
    col12: 'cq-lg-12',
  },
  xl: {
    col1: 'cq-xl-1',
    col2: 'cq-xl-2',
    col3: 'cq-xl-3',
    col4: 'cq-xl-4',
    col5: 'cq-xl-5',
    col6: 'cq-xl-6',
    col7: 'cq-xl-7',
    col8: 'cq-xl-8',
    col9: 'cq-xl-9',
    col10: 'cq-xl-10',
    col11: 'cq-xl-11',
    col12: 'cq-xl-12',
  },
  
  // Utility for display
  hidden: 'cq-hidden',
  visible: 'cq-visible',
  
  // Responsive visibility
  visibleXs: 'cq-visible-xs',
  visibleSm: 'cq-visible-sm',
  visibleMd: 'cq-visible-md',
  visibleLg: 'cq-visible-lg',
  visibleXl: 'cq-visible-xl',
  
  hiddenXs: 'cq-hidden-xs',
  hiddenSm: 'cq-hidden-sm',
  hiddenMd: 'cq-hidden-md',
  hiddenLg: 'cq-hidden-lg',
  hiddenXl: 'cq-hidden-xl',
}; 