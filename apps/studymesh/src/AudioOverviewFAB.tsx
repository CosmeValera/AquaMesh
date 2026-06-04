import React, { useState } from 'react'
import { Box, Fab, Tooltip } from '@mui/material'
import HeadphonesIcon from '@mui/icons-material/Headphones'
import { AudioOverviewPanel } from './components/audioOverview'
const AudioOverviewFAB: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9997 }}>
        <Tooltip title="🎧 Audio Overview" placement="left">
          <Fab color="primary" aria-label="Audio Overview" onClick={() => setIsOpen(true)} sx={{ width: 56, height: 56, fontSize: '1.5rem', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
            🎧
          </Fab>
        </Tooltip>
      </Box>
      {isOpen && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998, pointerEvents: 'none' }}>
          <Box onClick={() => setIsOpen(false)} sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.3)', pointerEvents: 'auto' }} />
          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'auto' }}>
            <AudioOverviewPanel onClose={() => setIsOpen(false)} />
          </Box>
        </Box>
      )}
    </>
  )
}
export default AudioOverviewFAB
