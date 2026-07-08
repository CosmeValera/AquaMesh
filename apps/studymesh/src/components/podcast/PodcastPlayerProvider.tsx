import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import Forward10Icon from '@mui/icons-material/Forward10'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import Replay10Icon from '@mui/icons-material/Replay10'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import { useLocation } from 'react-router-dom'

import {
  getHostedAiPodcastAudioUrl,
  type HostedAiPodcast,
} from '../../quickCreate/ai'
import { useInterfaceText } from '../../language/interfaceLanguage'

type PodcastPlayerStatus = 'idle' | 'loading' | 'ready' | 'error'

interface OpenPodcastOptions {
  podcast: HostedAiPodcast
  audioUrl?: string
}

interface PodcastPlayerContextValue {
  activePodcast: HostedAiPodcast | null
  status: PodcastPlayerStatus
  isPlaying: boolean
  currentTime: number
  duration: number
  error: string
  openPodcast: (options: OpenPodcastOptions) => void
  togglePlayback: () => void
  seek: (deltaSeconds: number) => void
  closePlayer: () => void
}

const PodcastPlayerContext = createContext<PodcastPlayerContextValue | null>(
  null,
)

const formatTime = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return '0:00'
  }

  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export const usePodcastPlayer = (): PodcastPlayerContextValue => {
  const value = useContext(PodcastPlayerContext)
  if (!value) {
    throw new Error('usePodcastPlayer must be used within PodcastPlayerProvider.')
  }

  return value
}

export const useOptionalPodcastPlayer = (): PodcastPlayerContextValue | null =>
  useContext(PodcastPlayerContext)

const podcastIconButtonSx = {
  width: 34,
  height: 34,
  border: 1,
  borderColor: 'divider',
  bgcolor: 'background.paper',
  color: 'text.primary',
  '&:hover': {
    borderColor: 'primary.main',
    bgcolor: 'action.hover',
  },
  '&.Mui-disabled': {
    borderColor: 'divider',
    bgcolor: 'action.disabledBackground',
    color: 'text.disabled',
  },
}

const FloatingPodcastPlayer = ({
  audioRef,
  activePodcast,
  audioUrl,
  status,
  isPlaying,
  currentTime,
  duration,
  error,
  togglePlayback,
  seek,
  closePlayer,
  setIsPlaying,
  setCurrentTime,
  setDuration,
  setStatus,
  setError,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>
  activePodcast: HostedAiPodcast
  audioUrl: string
  status: PodcastPlayerStatus
  isPlaying: boolean
  currentTime: number
  duration: number
  error: string
  togglePlayback: () => void
  seek: (deltaSeconds: number) => void
  closePlayer: () => void
  setIsPlaying: (value: boolean) => void
  setCurrentTime: (value: number) => void
  setDuration: (value: number) => void
  setStatus: (value: PodcastPlayerStatus) => void
  setError: (value: string) => void
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { t } = useInterfaceText()
  const progress =
    duration > 0 && Number.isFinite(duration)
      ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
      : 0
  const canControl = Boolean(audioUrl) && status === 'ready'

  return (
    <Box
      data-testid="floating-podcast-player"
      sx={{
        position: 'fixed',
        right: isMobile ? 10 : 24,
        bottom: isMobile
          ? 'calc(76px + env(safe-area-inset-bottom))'
          : 24,
        width: isMobile ? 'calc(100vw - 20px)' : 380,
        maxWidth: 'calc(100vw - 20px)',
        zIndex: theme.zIndex.modal - 1,
        border: 1,
        borderColor: alpha(theme.palette.primary.main, 0.28),
        borderRadius: 2,
        bgcolor: 'background.paper',
        color: 'text.primary',
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 20px 44px rgba(0,0,0,0.52)'
            : '0 20px 44px rgba(15,23,42,0.22)',
        overflow: 'hidden',
      }}
    >
      <Stack spacing={1.25} sx={{ p: 1.25 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.25,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: 'primary.main',
              flex: '0 0 auto',
            }}
          >
            <VolumeUpIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              {t('podcastPlayer.nowPlaying')}
            </Typography>
            <Typography variant="subtitle2" fontWeight={800} noWrap>
              {activePodcast.title}
            </Typography>
          </Box>
          <Tooltip title={t('podcastPlayer.close')}>
            <IconButton
              aria-label={t('podcastPlayer.close')}
              onClick={closePlayer}
              sx={podcastIconButtonSx}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 6, borderRadius: 999 }}
          />
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{ mt: 0.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              {formatTime(currentTime)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatTime(duration)}
            </Typography>
          </Stack>
        </Box>

        {error ? (
          <Typography variant="caption" color="error">
            {error}
          </Typography>
        ) : status === 'loading' ? (
          <Typography variant="caption" color="text.secondary">
            {t('podcastPlayer.loading')}
          </Typography>
        ) : null}

        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title={t('podcastPlayer.rewind')}>
            <span>
              <IconButton
                aria-label={t('podcastPlayer.rewind')}
                disabled={!canControl}
                onClick={() => seek(-10)}
                sx={podcastIconButtonSx}
              >
                <Replay10Icon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            onClick={togglePlayback}
            disabled={!canControl || status === 'error'}
            startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            sx={{
              flex: 1,
              minWidth: 0,
              borderRadius: 1.25,
              textTransform: 'none',
              fontWeight: 800,
            }}
          >
            {isPlaying ? t('podcastPlayer.pause') : t('podcastPlayer.play')}
          </Button>
          <Tooltip title={t('podcastPlayer.forward')}>
            <span>
              <IconButton
                aria-label={t('podcastPlayer.forward')}
                disabled={!canControl}
                onClick={() => seek(10)}
                sx={podcastIconButtonSx}
              >
                <Forward10Icon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
      <Box
        component="audio"
        ref={audioRef}
        src={audioUrl || undefined}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || 0)
          setStatus('ready')
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setStatus('error')
          setError(t('podcastPlayer.audioError'))
          setIsPlaying(false)
        }}
        sx={{ display: 'none' }}
      />
    </Box>
  )
}

export const PodcastPlayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const location = useLocation()
  const { t } = useInterfaceText()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [activePodcast, setActivePodcast] = useState<HostedAiPodcast | null>(
    null,
  )
  const [audioUrl, setAudioUrl] = useState('')
  const [status, setStatus] = useState<PodcastPlayerStatus>('idle')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState('')
  const [requestedPlayback, setRequestedPlayback] = useState(false)

  const closePlayer = useCallback(() => {
    audioRef.current?.pause()
    setActivePodcast(null)
    setAudioUrl('')
    setStatus('idle')
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setError('')
    setRequestedPlayback(false)
  }, [])

  const openPodcast = useCallback(
    ({ podcast, audioUrl: providedAudioUrl }: OpenPodcastOptions) => {
      audioRef.current?.pause()
      setActivePodcast(podcast)
      setAudioUrl(providedAudioUrl || '')
      setStatus(providedAudioUrl ? 'ready' : 'loading')
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      setError('')
      setRequestedPlayback(true)
    },
    [],
  )

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current
    if (!audio || status === 'loading' || status === 'error') {
      return
    }

    if (audio.paused) {
      setRequestedPlayback(true)
      void audio.play().catch((playError) => {
        setRequestedPlayback(false)
        setStatus('error')
        setError(
          playError instanceof Error
            ? playError.message
            : t('podcastPlayer.audioError'),
        )
      })
      return
    }

    setRequestedPlayback(false)
    audio.pause()
  }, [status, t])

  const seek = useCallback((deltaSeconds: number) => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    audio.currentTime = Math.max(0, audio.currentTime + deltaSeconds)
    setCurrentTime(audio.currentTime)
  }, [])

  useEffect(() => {
    if (!activePodcast || audioUrl) {
      return
    }

    let cancelled = false
    setStatus('loading')
    getHostedAiPodcastAudioUrl(activePodcast.audioPath)
      .then((signedUrl) => {
        if (cancelled) {
          return
        }

        setAudioUrl(signedUrl)
        setStatus('ready')
      })
      .catch((loadError) => {
        if (cancelled) {
          return
        }

        setStatus('error')
        setError(
          loadError instanceof Error
            ? loadError.message
            : t('podcastPlayer.loadError'),
        )
      })

    return () => {
      cancelled = true
    }
  }, [activePodcast, audioUrl, t])

  useEffect(() => {
    if (!location.pathname.startsWith('/workspace/')) {
      closePlayer()
    }
  }, [closePlayer, location.pathname])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl || !requestedPlayback || status === 'error') {
      return
    }

    void audio.play().catch(() => {
      setRequestedPlayback(false)
    })
  }, [audioUrl, requestedPlayback, status])

  const value = useMemo<PodcastPlayerContextValue>(
    () => ({
      activePodcast,
      status,
      isPlaying,
      currentTime,
      duration,
      error,
      openPodcast,
      togglePlayback,
      seek,
      closePlayer,
    }),
    [
      activePodcast,
      closePlayer,
      currentTime,
      duration,
      error,
      isPlaying,
      openPodcast,
      seek,
      status,
      togglePlayback,
    ],
  )

  return (
    <PodcastPlayerContext.Provider value={value}>
      {children}
      {activePodcast ? (
        <FloatingPodcastPlayer
          audioRef={audioRef}
          activePodcast={activePodcast}
          audioUrl={audioUrl}
          status={status}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          error={error}
          togglePlayback={togglePlayback}
          seek={seek}
          closePlayer={closePlayer}
          setIsPlaying={setIsPlaying}
          setCurrentTime={setCurrentTime}
          setDuration={setDuration}
          setStatus={setStatus}
          setError={setError}
        />
      ) : null}
    </PodcastPlayerContext.Provider>
  )
}
