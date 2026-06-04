import React, { useState } from 'react'
import { Box, Fab, Tooltip } from '@mui/material'
import { AISearchPanel } from './components/aiSmartSearch'

const AISearchFAB: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9997 }}>
        <Tooltip title="AISearchFAB" placement="left">
          <Fab
            color="primary"
            aria-label="AISearchFAB"
            onClick={() => setIsOpen(true)}
            sx={{
              width: 56,
              height: 56,
              fontSize: '1.5rem',
              bgcolor: 'primary.main',
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            ⚡
          </Fab>
        </Tooltip>
      </Box>

      {isOpen && (
        <>
          <Box
            onClick={() => setIsOpen(false)}
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(0,0,0,0.3)',
              zIndex: 9998,
            }}
          />
          <Box sx={{ width: '100%', height: '100%' }} onClick={(e) => e.stopPropagation()}>
            <AISearchPanel onClose={() => setIsOpen(false)} />
          </Box>
        </>
      )}
    </>
  )
}

export default AISearchFAB
