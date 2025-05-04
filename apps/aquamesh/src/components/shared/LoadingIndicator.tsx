import React from 'react';
import { Box, CircularProgress, Typography, Fade, useTheme } from '@mui/material';
import Logo from '../../assets/Logo';

export type LoadingVariant = 'overlay' | 'inline' | 'fullscreen' | 'component';

interface LoadingIndicatorProps {
  /**
   * Message to display below the loading indicator
   */
  message?: string;
  
  /**
   * The type of loading indicator to display
   */
  variant?: LoadingVariant;
  
  /**
   * Whether the loading indicator is visible
   */
  loading?: boolean;
  
  /**
   * Component to display as the loading icon (defaults to CircularProgress)
   */
  icon?: React.ReactNode;
  
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * A standardized loading indicator component with multiple variants
 */
const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message,
  variant = 'inline',
  loading = true,
  icon,
  className
}) => {
  const theme = useTheme();
  
  if (!loading) return null;
  
  // Styling based on variant
  const getContainerStyles = () => {
    switch (variant) {
      case 'overlay':
        return {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          backgroundColor: 'rgba(0, 107, 88, 0.7)',
          zIndex: 1000,
          backdropFilter: 'blur(2px)',
        };
      case 'fullscreen':
        return {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          backgroundColor: theme.palette.background.default,
          zIndex: 9999,
        };
      case 'component':
        return {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          minHeight: 200,
        };
      case 'inline':
      default:
        return {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          flexDirection: 'row',
        };
    }
  };
  
  const renderLoadingIcon = () => {
    if (icon) return icon;
    
    // Use AquaMesh logo for fullscreen and component variants
    if (variant === 'fullscreen' || variant === 'component') {
      return (
        <Box sx={{ position: 'relative', mb: 3 }}>
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CircularProgress 
              size={variant === 'fullscreen' ? 100 : 60}
              thickness={2}
              sx={{ 
                color: theme.palette.primary.main,
                opacity: 0.8,
              }} 
            />
          </Box>
          <Logo 
            height={variant === 'fullscreen' ? '80px' : '50px'} 
            width={variant === 'fullscreen' ? '80px' : '50px'} 
            className="pulse-animation"
          />
        </Box>
      );
    }
    
    return (
      <CircularProgress 
        size={variant === 'overlay' ? 40 : 24}
        thickness={4}
        sx={{ color: variant === 'inline' ? theme.palette.primary.main : '#fff' }} 
      />
    );
  };
  
  return (
    <Fade in={loading} timeout={300}>
      <Box
        sx={{
          ...getContainerStyles(),
        }}
        className={className}
      >
        {renderLoadingIcon()}
        
        {message && (
          <Typography
            variant={variant === 'inline' ? 'body2' : 'body1'}
            color={variant === 'inline' ? 'textPrimary' : 'white'}
            sx={{ 
              mt: variant === 'inline' ? 0 : 2,
              fontWeight: variant === 'fullscreen' ? 'medium' : 'normal',
              opacity: 0.9,
              textAlign: 'center'
            }}
          >
            {message}
          </Typography>
        )}
      </Box>
    </Fade>
  );
};

export default LoadingIndicator;

// CSS Animation for the pulsing logo
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.05);
      opacity: 0.8;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  .pulse-animation {
    animation: pulse 1.5s infinite ease-in-out;
  }
`;
document.head.appendChild(style); 