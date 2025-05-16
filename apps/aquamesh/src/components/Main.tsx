import React from 'react'
import { Box, BoxProps } from '@mui/material'

// No need for a separate interface since we're just extending BoxProps
const Main: React.FC<BoxProps> = ({ children, ...props }) => {
  return (
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        backgroundColor: 'background.default',
        position: 'relative',
        height: 'calc(100dvh - 26px)', // Adjust for top navbar height
        width: '100%',
        marginTop: '26px', // Add margin top for the navbar
        overflowX: 'hidden',
        ...props.sx,
      }}
      {...props}
    >
      {children}
    </Box>
  )
}

export default Main
