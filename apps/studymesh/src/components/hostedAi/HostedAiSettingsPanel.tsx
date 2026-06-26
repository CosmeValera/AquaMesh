import React from 'react'
import { Alert, Box, Stack, Typography } from '@mui/material'
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'

import { STUDY_CREDITS_LABEL } from '../../quickCreate/ai'
import HostedAiPricingCards from './HostedAiPricingCards'
import StudyCreditIcon from './StudyCreditIcon'
import { useHostedAiStatus } from './useHostedAiStatus'

const creditUnit = (count: number): string =>
  count === 1 ? 'credit' : 'credits'

const CostCard = ({
  icon,
  title,
  credits,
}: {
  icon: React.ReactNode
  title: string
  credits: number
}) => (
  <Box
    sx={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: 1.35,
      minHeight: 58,
      p: 1.25,
      borderRadius: 2,
      border: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
      boxShadow: '0 10px 24px rgba(15,23,42,0.04)',
    }}
  >
    <Box
      sx={{
        width: 42,
        height: 42,
        borderRadius: 2,
        display: 'grid',
        placeItems: 'center',
        color: '#00796b',
        bgcolor: 'rgba(0,188,174,0.12)',
      }}
    >
      {icon}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Box
        component="span"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          p: 0,
          m: -1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {title}: {credits} {creditUnit(credits)}
      </Box>
      <Typography variant="subtitle2" fontWeight={900} color="text.primary">
        {title}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={850}
        sx={{ color: '#008575', lineHeight: 1.25 }}
      >
        {credits} {creditUnit(credits)}
      </Typography>
    </Box>
  </Box>
)

const HostedAiSettingsPanel: React.FC = () => {
  const { status, loading, error } = useHostedAiStatus()

  if (!status && loading) {
    return (
      <Alert severity="info" sx={{ mb: 1.5 }}>
        Loading {STUDY_CREDITS_LABEL}...
      </Alert>
    )
  }

  if (!status) {
    return (
      <Alert severity="warning" sx={{ mb: 1.5 }}>
        {error || `${STUDY_CREDITS_LABEL} unavailable.`}
      </Alert>
    )
  }

  return (
    <Box
      sx={{
        mb: 1.5,
        p: { xs: 1.75, sm: 2 },
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: { xs: 2, sm: 3 },
          py: { xs: 2, sm: 2.5 },
          borderRadius: 2,
          border: '1px solid',
          borderColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(45,212,191,0.24)' : 'divider',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(15,23,42,0.94)'
              : 'rgba(236,253,245,0.58)',
          backgroundImage: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(110deg, rgba(15,23,42,0.96), rgba(13,148,136,0.22))'
              : 'linear-gradient(110deg, rgba(255,255,255,0.86), rgba(204,251,241,0.35))',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? 'inset 0 1px 0 rgba(255,255,255,0.05), 0 14px 34px rgba(0,0,0,0.24)'
              : 'none',
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography
            variant="overline"
            fontWeight={950}
            sx={{ color: '#008575', letterSpacing: 1.1 }}
          >
            Your balance
          </Typography>
          <Stack direction="row" spacing={1.15} alignItems="center">
            <Typography variant="h3" fontWeight={950} lineHeight={1}>
              {status.studyCredits}
            </Typography>
            <StudyCreditIcon size={34} />
            <Typography variant="subtitle1" fontWeight={900}>
              {STUDY_CREDITS_LABEL}
            </Typography>
          </Stack>
        </Box>
        <Box
          sx={{
            position: 'relative',
            display: { xs: 'none', sm: 'block' },
            width: 160,
            height: 96,
            flex: '0 0 auto',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 16,
              right: 12,
              bottom: 7,
              height: 34,
              borderRadius: '999px',
              background: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'radial-gradient(ellipse at center, rgba(45,212,191,0.28), rgba(20,184,166,0.10) 68%, transparent 72%)'
                  : 'radial-gradient(ellipse at center, rgba(0,137,123,0.18), rgba(0,137,123,0.04) 68%, transparent 72%)',
              filter: 'blur(1px)',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 8,
              right: 6,
              width: 40,
              height: 40,
              background: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'radial-gradient(circle at 50% 50%, rgba(94,234,212,0.5) 0 8%, transparent 9% 100%)'
                  : 'radial-gradient(circle at 50% 50%, rgba(0,137,123,0.22) 0 8%, transparent 9% 100%)',
              clipPath:
                'polygon(50% 0, 61% 35%, 100% 50%, 61% 65%, 50% 100%, 39% 65%, 0 50%, 39% 35%)',
              opacity: 0.9,
            },
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              left: 38,
              top: 14,
              display: 'grid',
              placeItems: 'center',
              width: 82,
              height: 66,
              borderRadius: 3,
              bgcolor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(30,41,59,0.92)'
                  : 'rgba(255,255,255,0.78)',
              border: (theme) =>
                theme.palette.mode === 'dark'
                  ? '1px solid rgba(94,234,212,0.22)'
                  : '1px solid rgba(0,137,123,0.14)',
              boxShadow: (theme) =>
                theme.palette.mode === 'dark'
                  ? '0 18px 34px rgba(0,0,0,0.34), 0 0 28px rgba(45,212,191,0.18), inset 0 1px 0 rgba(255,255,255,0.08)'
                  : '0 18px 34px rgba(0,137,123,0.18), inset 0 1px 0 rgba(255,255,255,0.95)',
              transform: 'rotate(28deg)',
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: 7,
                borderRadius: 2,
                border: (theme) =>
                  theme.palette.mode === 'dark'
                    ? '1px solid rgba(94,234,212,0.16)'
                    : '1px solid rgba(0,137,123,0.10)',
              },
            }}
          >
            <Box sx={{ transform: 'rotate(-28deg)' }}>
              <StudyCreditIcon size={36} />
            </Box>
          </Box>
          <Box
            sx={{
              position: 'absolute',
              left: 18,
              top: 38,
              width: 15,
              height: 15,
              bgcolor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(94,234,212,0.44)'
                  : 'rgba(0,137,123,0.28)',
              clipPath:
                'polygon(50% 0, 61% 35%, 100% 50%, 61% 65%, 50% 100%, 39% 65%, 0 50%, 39% 35%)',
            }}
          />
        </Box>
      </Box>

      <Typography variant="subtitle1" fontWeight={950} sx={{ mt: 2.25, mb: 1 }}>
        What actions cost
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(3, minmax(0, 1fr))',
          },
          gap: 1.5,
        }}
      >
        <CostCard
          icon={<AutoStoriesOutlinedIcon />}
          title="Study Guide"
          credits={status.costs['study-guide']}
        />
        <CostCard
          icon={<BoltOutlinedIcon />}
          title="Quick Create"
          credits={status.costs['quick-create']}
        />
        <CostCard
          icon={<ChatBubbleOutlineOutlinedIcon />}
          title="AI Chat message"
          credits={status.costs.chat}
        />
      </Box>

      <Box
        sx={{
          display: 'flex',
          gap: 1.25,
          alignItems: 'center',
          mt: 1.5,
          p: 1.25,
          borderRadius: 2,
          border: '1px solid',
          borderColor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(45,212,191,0.24)'
              : 'rgba(14,165,233,0.22)',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(20,184,166,0.12)'
              : 'rgba(224,242,254,0.52)',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
              : 'none',
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            flex: '0 0 auto',
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: (theme) =>
              theme.palette.mode === 'dark' ? '#5eead4' : '#008575',
            bgcolor: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(20,184,166,0.20)'
                : 'rgba(16,185,129,0.12)',
          }}
        >
          <EventAvailableOutlinedIcon fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={950}>
            Credit balance
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Study Credits only increase when a credit purchase is completed.
            Creating, retrying, refreshing, or failed hosted generations never
            add credits back.
          </Typography>
        </Box>
      </Box>

      {status.message && (
        <Alert
          severity={status.available ? 'info' : 'warning'}
          sx={{ mt: 1.5 }}
        >
          {status.message}
        </Alert>
      )}
      <HostedAiPricingCards />
    </Box>
  )
}

export default HostedAiSettingsPanel
