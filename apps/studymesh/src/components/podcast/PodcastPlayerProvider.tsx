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
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
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

interface PodcastSessionSnapshot {
  podcast: HostedAiPodcast
  audioUrl: string
  status: PodcastPlayerStatus
  currentTime: number
  duration: number
  error: string
}

interface MiniPlayerPosition {
  x: number
  y: number
}

interface PodcastPlayerContextValue {
  activePodcast: HostedAiPodcast | null
  status: PodcastPlayerStatus
  isPlaying: boolean
  currentTime: number
  duration: number
  error: string
  miniPlayerVisible: boolean
  getPodcastSession: (podcast: HostedAiPodcast) => PodcastSessionSnapshot
  preparePodcast: (options: OpenPodcastOptions) => boolean
  playPodcast: (options: OpenPodcastOptions) => void
  switchPodcast: (options: OpenPodcastOptions) => void
  openPodcast: (options: OpenPodcastOptions) => void
  showMiniPlayer: () => void
  hideMiniPlayer: () => void
  togglePlayback: () => void
  seek: (deltaSeconds: number) => void
  registerPagePodcast: (podcast: HostedAiPodcast) => () => void
  stopPodcast: () => void
  closePlayer: () => void
}

const PodcastPlayerContext = createContext<PodcastPlayerContextValue | null>(
  null,
)

/** Prefix of the canned demo podcasts shipped as static files under public/. */
const STATIC_PODCAST_AUDIO_PREFIX = '/demo/audio/'

/**
 * True only for the demo MP3s, which are already playable URLs and must never
 * reach the authenticated audio gateway.
 *
 * This cannot capture a real podcast: the gateway rejects any audioPath
 * starting with '/' (api/study-guide-podcast-audio.ts), every real path is
 * minted as `${userId}/${guideId}/${podcastId}.mp3` (api/hosted-ai.ts), and
 * this is a literal prefix match, so it also excludes 'http://', 'blob:',
 * 'data:' and a bare '/'.
 */
export const isStaticPodcastAudioPath = (audioPath: string): boolean =>
  audioPath.startsWith(STATIC_PODCAST_AUDIO_PREFIX)

const createIdlePodcastSession = (
  podcast: HostedAiPodcast,
): PodcastSessionSnapshot => ({
  podcast,
  audioUrl: '',
  status: 'idle',
  currentTime: 0,
  duration: 0,
  error: '',
})

const formatTime = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return '0:00'
  }

  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const clampMiniPlayerPosition = (
  position: MiniPlayerPosition,
  size: { width: number; height: number },
): MiniPlayerPosition => {
  if (typeof window === 'undefined') {
    return position
  }

  const margin = 8
  const maxX = Math.max(margin, window.innerWidth - size.width - margin)
  const maxY = Math.max(margin, window.innerHeight - size.height - margin)

  return {
    x: Math.min(Math.max(position.x, margin), maxX),
    y: Math.min(Math.max(position.y, margin), maxY),
  }
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

interface PodcastControlsProps {
  podcast: HostedAiPodcast
  eyebrow: string
  status: PodcastPlayerStatus
  isPlaying: boolean
  currentTime: number
  duration: number
  error: string
  canControl: boolean
  togglePlayback: () => void
  seek: (deltaSeconds: number) => void
  action?: React.ReactNode
}

const PodcastControls = ({
  podcast,
  eyebrow,
  status,
  isPlaying,
  currentTime,
  duration,
  error,
  canControl,
  togglePlayback,
  seek,
  action,
}: PodcastControlsProps) => {
  const theme = useTheme()
  const { t } = useInterfaceText()
  const progress =
    duration > 0 && Number.isFinite(duration)
      ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
      : 0

  return (
    <Stack spacing={1.25}>
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
            {eyebrow}
          </Typography>
          <Typography variant="subtitle2" fontWeight={800} noWrap>
            {podcast.title}
          </Typography>
        </Box>
        {action}
      </Stack>

      <Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 6, borderRadius: 999 }}
        />
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
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
  )
}

const FloatingPodcastPlayer = ({
  activePodcast,
  status,
  isPlaying,
  currentTime,
  duration,
  error,
  togglePlayback,
  seek,
  hideMiniPlayer,
  miniPlayerPosition,
  setMiniPlayerPosition,
}: {
  activePodcast: HostedAiPodcast
  status: PodcastPlayerStatus
  isPlaying: boolean
  currentTime: number
  duration: number
  error: string
  togglePlayback: () => void
  seek: (deltaSeconds: number) => void
  hideMiniPlayer: () => void
  miniPlayerPosition: MiniPlayerPosition | null
  setMiniPlayerPosition: React.Dispatch<
    React.SetStateAction<MiniPlayerPosition | null>
  >
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { t } = useInterfaceText()
  const playerRef = useRef<HTMLDivElement | null>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  const getPlayerSize = useCallback(() => {
    const rect = playerRef.current?.getBoundingClientRect()
    return {
      width: rect?.width || (isMobile ? window.innerWidth - 20 : 380),
      height: rect?.height || 200,
    }
  }, [isMobile])

  const moveMiniPlayer = useCallback(
    (clientX: number, clientY: number) => {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
        return
      }

      const size = getPlayerSize()
      setMiniPlayerPosition(
        clampMiniPlayerPosition(
          {
            x: clientX - dragOffsetRef.current.x,
            y: clientY - dragOffsetRef.current.y,
          },
          size,
        ),
      )
    },
    [getPlayerSize, setMiniPlayerPosition],
  )

  const handleDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return
      }

      const rect = playerRef.current?.getBoundingClientRect()
      if (!rect) {
        return
      }

      const clientX = Number.isFinite(event.clientX) ? event.clientX : rect.left
      const clientY = Number.isFinite(event.clientY) ? event.clientY : rect.top
      dragOffsetRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      }
      setMiniPlayerPosition(
        clampMiniPlayerPosition(
          { x: rect.left, y: rect.top },
          { width: rect.width, height: rect.height },
        ),
      )
      isDraggingRef.current = true
      setIsDragging(true)
      event.currentTarget.setPointerCapture?.(event.pointerId)
    },
    [setMiniPlayerPosition],
  )

  const handleDragMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isDraggingRef.current) {
        moveMiniPlayer(event.clientX, event.clientY)
      }
    },
    [moveMiniPlayer],
  )

  useEffect(() => {
    if (!isDragging) {
      return undefined
    }

    const handlePointerMove = (event: PointerEvent) => {
      moveMiniPlayer(event.clientX, event.clientY)
    }

    const handlePointerUp = () => {
      isDraggingRef.current = false
      setIsDragging(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [isDragging, moveMiniPlayer])

  useEffect(() => {
    if (!miniPlayerPosition) {
      return undefined
    }

    const handleResize = () => {
      const size = getPlayerSize()
      setMiniPlayerPosition((position) =>
        position ? clampMiniPlayerPosition(position, size) : position,
      )
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [getPlayerSize, miniPlayerPosition, setMiniPlayerPosition])

  return (
    <Box
      ref={playerRef}
      data-testid="floating-podcast-player"
      style={
        miniPlayerPosition
          ? { left: miniPlayerPosition.x, top: miniPlayerPosition.y }
          : undefined
      }
      sx={{
        position: 'fixed',
        right: miniPlayerPosition ? 'auto' : isMobile ? 10 : 24,
        bottom: miniPlayerPosition
          ? 'auto'
          : isMobile
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
      <Box sx={{ p: 1.25 }}>
        <PodcastControls
          podcast={activePodcast}
          eyebrow={t('podcastPlayer.nowPlaying')}
          status={status}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          error={error}
          canControl={status === 'ready'}
          togglePlayback={togglePlayback}
          seek={seek}
          action={
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Tooltip title={t('podcastPlayer.dragPlayer')}>
                <Box
                  role="button"
                  tabIndex={0}
                  aria-label={t('podcastPlayer.dragPlayer')}
                  onPointerDown={handleDragStart}
                  onPointerMove={handleDragMove}
                  sx={{
                    ...podcastIconButtonSx,
                    borderRadius: 1,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    display: 'grid',
                    placeItems: 'center',
                    touchAction: 'none',
                  }}
                >
                  <DragIndicatorIcon fontSize="small" />
                </Box>
              </Tooltip>
              <Tooltip title={t('podcastPlayer.close')}>
                <IconButton
                  aria-label={t('podcastPlayer.close')}
                  onClick={hideMiniPlayer}
                  sx={podcastIconButtonSx}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          }
        />
      </Box>
    </Box>
  )
}

export const PodcastPagePlayer = ({
  podcast,
}: {
  podcast: HostedAiPodcast
}) => {
  const podcastPlayer = useOptionalPodcastPlayer()
  const { t } = useInterfaceText()
  const podcastPlayerRef = useRef(podcastPlayer)

  useEffect(() => {
    podcastPlayerRef.current = podcastPlayer
  }, [podcastPlayer])

  const activePodcast = podcastPlayer?.activePodcast ?? null
  const isActive = activePodcast?.audioPath === podcast.audioPath
  const hasDifferentActive = Boolean(activePodcast && !isActive)
  const pageSession =
    podcastPlayer?.getPodcastSession(podcast) ?? createIdlePodcastSession(podcast)
  const status = isActive ? podcastPlayer?.status ?? 'idle' : pageSession.status
  const currentTime = isActive
    ? podcastPlayer?.currentTime ?? 0
    : pageSession.currentTime
  const duration = isActive ? podcastPlayer?.duration ?? 0 : pageSession.duration
  const error = isActive ? podcastPlayer?.error ?? '' : pageSession.error
  const canControl = Boolean(podcastPlayer && status === 'ready')

  const compactAction = hasDifferentActive ? (
    <Button
      variant="outlined"
      size="small"
      startIcon={<PlayArrowIcon />}
      disabled={!podcastPlayer}
      onClick={() => podcastPlayer?.switchPodcast({ podcast })}
      sx={{ borderRadius: 1.25, textTransform: 'none', fontWeight: 800 }}
    >
      {t('podcastPlayer.switchPodcast')}
    </Button>
  ) : isActive && podcastPlayer?.miniPlayerVisible ? (
    <Button
      variant="outlined"
      size="small"
      startIcon={<VolumeUpIcon />}
      disabled={!podcastPlayer}
      onClick={podcastPlayer.hideMiniPlayer}
      sx={{ borderRadius: 1.25, textTransform: 'none', fontWeight: 800 }}
    >
      {t('podcastPlayer.bringPlayerHere')}
    </Button>
  ) : null

  useEffect(() => {
    const player = podcastPlayerRef.current
    if (!player) {
      return undefined
    }

    const unregister = player.registerPagePodcast(podcast)
    player.playPodcast({ podcast })
    return unregister
  }, [podcast])

  if (hasDifferentActive || (isActive && podcastPlayer?.miniPlayerVisible)) {
    return (
      <Box
        data-testid="podcast-page-player"
        sx={(theme) => ({
          border: 1,
          borderColor: alpha(theme.palette.primary.main, 0.24),
          borderRadius: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.04),
          p: 1.5,
        })}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={(theme) => ({
              width: 36,
              height: 36,
              borderRadius: 1.25,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: 'primary.main',
              flex: '0 0 auto',
            })}
          >
            <VolumeUpIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              {hasDifferentActive
                ? t('podcastPlayer.pagePlayer')
                : t('podcastPlayer.playingInMiniPlayer')}
            </Typography>
            <Typography variant="subtitle2" fontWeight={800} noWrap>
              {podcast.title}
            </Typography>
          </Box>
          {compactAction}
        </Stack>
      </Box>
    )
  }

  return (
    <Box
      data-testid="podcast-page-player"
      sx={(theme) => ({
        border: 1,
        borderColor: alpha(theme.palette.primary.main, 0.24),
        borderRadius: 2,
        bgcolor: alpha(theme.palette.primary.main, 0.04),
        p: 1.5,
      })}
    >
      <PodcastControls
        podcast={podcast}
        eyebrow={
          isActive
            ? t('podcastPlayer.nowPlaying')
            : t('podcastPlayer.pagePlayer')
        }
        status={status}
        isPlaying={Boolean(isActive && podcastPlayer?.isPlaying)}
        currentTime={currentTime}
        duration={duration}
        error={error}
        canControl={canControl}
        togglePlayback={() => {
          if (isActive) {
            podcastPlayer?.togglePlayback()
            return
          }

          podcastPlayer?.switchPodcast({ podcast })
        }}
        seek={(deltaSeconds) => {
          if (isActive) {
            podcastPlayer?.seek(deltaSeconds)
          }
        }}
        action={
          podcastPlayer && !podcastPlayer.miniPlayerVisible ? (
            <Button
              variant="outlined"
              size="small"
              startIcon={<VolumeUpIcon />}
              disabled={!isActive}
              onClick={podcastPlayer.showMiniPlayer}
              sx={{ borderRadius: 1.25, textTransform: 'none', fontWeight: 800 }}
            >
              {t('podcastPlayer.openPlayer')}
            </Button>
          ) : null
        }
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
  const [miniPlayerVisible, setMiniPlayerVisible] = useState(false)
  const [miniPlayerPosition, setMiniPlayerPosition] =
    useState<MiniPlayerPosition | null>(null)
  const [podcastSessions, setPodcastSessions] = useState<
    Record<string, PodcastSessionSnapshot>
  >({})
  const activePodcastRef = useRef<HostedAiPodcast | null>(null)
  const podcastSessionsRef = useRef<Record<string, PodcastSessionSnapshot>>({})
  const podcastSessionRequestsRef = useRef(new Set<string>())
  const pagePodcastCountsRef = useRef(new Map<string, number>())
  const [pagePodcastAudioPaths, setPagePodcastAudioPaths] = useState<string[]>(
    [],
  )

  useEffect(() => {
    activePodcastRef.current = activePodcast
  }, [activePodcast])

  useEffect(() => {
    podcastSessionsRef.current = podcastSessions
  }, [podcastSessions])

  const updatePodcastSession = useCallback(
    (
      podcast: HostedAiPodcast,
      updater: (
        session: PodcastSessionSnapshot,
      ) => PodcastSessionSnapshot,
    ) => {
      const audioPath = podcast.audioPath
      setPodcastSessions((sessions) => {
        const current = sessions[audioPath] ?? createIdlePodcastSession(podcast)
        const next = updater({ ...current, podcast })
        if (
          current.podcast === next.podcast &&
          current.audioUrl === next.audioUrl &&
          current.status === next.status &&
          current.currentTime === next.currentTime &&
          current.duration === next.duration &&
          current.error === next.error
        ) {
          return sessions
        }

        return { ...sessions, [audioPath]: next }
      })
    },
    [],
  )

  const getPodcastSession = useCallback(
    (podcast: HostedAiPodcast): PodcastSessionSnapshot =>
      podcastSessions[podcast.audioPath] ?? createIdlePodcastSession(podcast),
    [podcastSessions],
  )

  const preparePodcastAudio = useCallback(
    (podcast: HostedAiPodcast, providedAudioUrl?: string) => {
      const audioPath = podcast.audioPath
      const currentSession = podcastSessionsRef.current[audioPath]
      // PodcastPagePlayer never passes providedAudioUrl, so a static demo path
      // has to short-circuit here or it would ask the gateway to sign a file
      // that is already served from public/ - and fail, with no session.
      if (providedAudioUrl || isStaticPodcastAudioPath(audioPath)) {
        const readyAudioUrl = providedAudioUrl || audioPath
        updatePodcastSession(podcast, (session) => ({
          ...session,
          audioUrl: readyAudioUrl,
          status: 'ready',
          error: '',
        }))
        if (activePodcastRef.current?.audioPath === audioPath) {
          setAudioUrl(readyAudioUrl)
          setStatus('ready')
          setError('')
        }
        return
      }

      if (
        currentSession?.status === 'loading' ||
        (currentSession?.status === 'ready' && currentSession.audioUrl)
      ) {
        return
      }

      if (podcastSessionRequestsRef.current.has(audioPath)) {
        return
      }

      podcastSessionRequestsRef.current.add(audioPath)
      updatePodcastSession(podcast, (session) => ({
        ...session,
        status: 'loading',
        error: '',
      }))

      getHostedAiPodcastAudioUrl(audioPath)
        .then((signedUrl) => {
          podcastSessionRequestsRef.current.delete(audioPath)
          updatePodcastSession(podcast, (session) => ({
            ...session,
            audioUrl: signedUrl,
            status: 'ready',
            error: '',
          }))
          if (activePodcastRef.current?.audioPath === audioPath) {
            setAudioUrl(signedUrl)
            setStatus('ready')
            setError('')
          }
        })
        .catch((loadError) => {
          podcastSessionRequestsRef.current.delete(audioPath)
          const nextError =
            loadError instanceof Error
              ? loadError.message
              : t('podcastPlayer.loadError')
          updatePodcastSession(podcast, (session) => ({
            ...session,
            status: 'error',
            error: nextError,
          }))
          if (activePodcastRef.current?.audioPath === audioPath) {
            setStatus('error')
            setError(nextError)
          }
        })
    },
    [t, updatePodcastSession],
  )

  const stopPodcast = useCallback(() => {
    audioRef.current?.pause()
    setActivePodcast(null)
    setAudioUrl('')
    setStatus('idle')
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setError('')
    setRequestedPlayback(false)
    setMiniPlayerVisible(false)
    setPodcastSessions({})
    podcastSessionsRef.current = {}
    podcastSessionRequestsRef.current.clear()
  }, [])

  const startPodcast = useCallback(
    (
      { podcast, audioUrl: providedAudioUrl }: OpenPodcastOptions,
      options: { autoplay: boolean; showMini: boolean; force: boolean },
    ): boolean => {
      const samePodcast = activePodcast?.audioPath === podcast.audioPath
      const activePageMounted = activePodcast
        ? pagePodcastCountsRef.current.has(activePodcast.audioPath)
        : false
      const canClaimActiveSlot =
        !activePodcast ||
        samePodcast ||
        options.force ||
        (!miniPlayerVisible && !activePageMounted)

      preparePodcastAudio(podcast, providedAudioUrl)

      if (activePodcast && !samePodcast && !canClaimActiveSlot) {
        return false
      }

      if (samePodcast) {
        const session = podcastSessionsRef.current[podcast.audioPath]
        if ((providedAudioUrl || session?.audioUrl) && !audioUrl) {
          const nextAudioUrl = providedAudioUrl || session?.audioUrl || ''
          setAudioUrl(nextAudioUrl)
          setStatus('ready')
        }
        setError('')
        if (options.showMini) {
          setMiniPlayerVisible(true)
        }
        if (options.autoplay) {
          setRequestedPlayback(true)
        }
        return true
      }

      audioRef.current?.pause()
      const nextSession = podcastSessionsRef.current[podcast.audioPath]
      const nextAudioUrl = providedAudioUrl || nextSession?.audioUrl || ''
      const nextStatus: PodcastPlayerStatus = nextAudioUrl
        ? 'ready'
        : nextSession?.status === 'error'
          ? 'error'
          : 'loading'
      setActivePodcast(podcast)
      setAudioUrl(nextAudioUrl)
      setStatus(nextStatus)
      setIsPlaying(false)
      setCurrentTime(nextSession?.currentTime ?? 0)
      setDuration(nextSession?.duration ?? 0)
      setError(nextSession?.error ?? '')
      setRequestedPlayback(options.autoplay)
      setMiniPlayerVisible(options.showMini)
      return true
    },
    [activePodcast, audioUrl, miniPlayerVisible, preparePodcastAudio],
  )

  const preparePodcast = useCallback(
    (options: OpenPodcastOptions) =>
      startPodcast(options, { autoplay: false, showMini: false, force: false }),
    [startPodcast],
  )

  const playPodcast = useCallback(
    (options: OpenPodcastOptions) =>
      startPodcast(options, { autoplay: true, showMini: false, force: false }),
    [startPodcast],
  )

  const switchPodcast = useCallback(
    (options: OpenPodcastOptions) => {
      startPodcast(options, { autoplay: true, showMini: true, force: true })
    },
    [startPodcast],
  )

  const openPodcast = useCallback(
    (options: OpenPodcastOptions) => {
      startPodcast(options, { autoplay: true, showMini: true, force: true })
    },
    [startPodcast],
  )

  const showMiniPlayer = useCallback(() => {
    if (activePodcast) {
      setMiniPlayerVisible(true)
    }
  }, [activePodcast])

  const hideMiniPlayer = useCallback(() => {
    setMiniPlayerVisible(false)
  }, [])

  const closePlayer = hideMiniPlayer

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

  const seek = useCallback(
    (deltaSeconds: number) => {
      const audio = audioRef.current
      const podcast = activePodcastRef.current
      if (!audio || !podcast) {
        return
      }

      audio.currentTime = Math.max(0, audio.currentTime + deltaSeconds)
      setCurrentTime(audio.currentTime)
      updatePodcastSession(podcast, (session) => ({
        ...session,
        currentTime: audio.currentTime,
      }))
    },
    [updatePodcastSession],
  )

  const registerPagePodcast = useCallback((podcast: HostedAiPodcast) => {
    const audioPath = podcast.audioPath
    const nextCount = (pagePodcastCountsRef.current.get(audioPath) ?? 0) + 1
    pagePodcastCountsRef.current.set(audioPath, nextCount)
    setPagePodcastAudioPaths((paths) =>
      paths.includes(audioPath) ? paths : [...paths, audioPath],
    )

    return () => {
      const currentCount = pagePodcastCountsRef.current.get(audioPath) ?? 0
      if (currentCount <= 1) {
        pagePodcastCountsRef.current.delete(audioPath)
        setPagePodcastAudioPaths((paths) =>
          paths.filter((path) => path !== audioPath),
        )
        return
      }

      pagePodcastCountsRef.current.set(audioPath, currentCount - 1)
    }
  }, [])

  useEffect(() => {
    if (!activePodcast) {
      return
    }

    const session = podcastSessions[activePodcast.audioPath]
    if (session?.audioUrl && !audioUrl) {
      setAudioUrl(session.audioUrl)
      setStatus('ready')
      setError('')
      return
    }

    if (session?.status === 'error') {
      setStatus('error')
      setError(session.error)
      return
    }

    if (!audioUrl) {
      setStatus('loading')
      preparePodcastAudio(activePodcast)
    }
  }, [activePodcast, audioUrl, podcastSessions, preparePodcastAudio])

  useEffect(() => {
    // The prepared demo plays podcasts from /try/<slug>, so it has to be on the
    // same side of this guard as the real workspace.
    const isGuideRoute =
      location.pathname.startsWith('/workspace/') ||
      location.pathname.startsWith('/try/')

    if (!isGuideRoute) {
      stopPodcast()
    }
  }, [location.pathname, stopPodcast])

  useEffect(() => {
    if (
      activePodcast &&
      !miniPlayerVisible &&
      !pagePodcastCountsRef.current.has(activePodcast.audioPath)
    ) {
      stopPodcast()
    }
  }, [activePodcast, miniPlayerVisible, pagePodcastAudioPaths, stopPodcast])

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
      miniPlayerVisible,
      getPodcastSession,
      preparePodcast,
      playPodcast,
      switchPodcast,
      openPodcast,
      showMiniPlayer,
      hideMiniPlayer,
      togglePlayback,
      seek,
      registerPagePodcast,
      stopPodcast,
      closePlayer,
    }),
    [
      activePodcast,
      closePlayer,
      currentTime,
      duration,
      error,
      getPodcastSession,
      hideMiniPlayer,
      isPlaying,
      miniPlayerVisible,
      openPodcast,
      playPodcast,
      preparePodcast,
      registerPagePodcast,
      seek,
      showMiniPlayer,
      status,
      stopPodcast,
      switchPodcast,
      togglePlayback,
    ],
  )

  return (
    <PodcastPlayerContext.Provider value={value}>
      {children}
      {activePodcast ? (
        <Box
          component="audio"
          ref={audioRef}
          src={audioUrl || undefined}
          onLoadedMetadata={(event) => {
            const nextDuration = event.currentTarget.duration || 0
            setDuration(nextDuration)
            setStatus('ready')
            updatePodcastSession(activePodcast, (session) => ({
              ...session,
              duration: nextDuration,
              status: 'ready',
              error: '',
            }))
          }}
          onTimeUpdate={(event) => {
            const nextCurrentTime = event.currentTarget.currentTime
            setCurrentTime(nextCurrentTime)
            updatePodcastSession(activePodcast, (session) => ({
              ...session,
              currentTime: nextCurrentTime,
            }))
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onError={() => {
            setStatus('error')
            setError(t('podcastPlayer.audioError'))
            setIsPlaying(false)
            updatePodcastSession(activePodcast, (session) => ({
              ...session,
              status: 'error',
              error: t('podcastPlayer.audioError'),
            }))
          }}
          sx={{ display: 'none' }}
        />
      ) : null}
      {activePodcast && miniPlayerVisible ? (
        <FloatingPodcastPlayer
          activePodcast={activePodcast}
          status={status}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          error={error}
          togglePlayback={togglePlayback}
          seek={seek}
          hideMiniPlayer={hideMiniPlayer}
          miniPlayerPosition={miniPlayerPosition}
          setMiniPlayerPosition={setMiniPlayerPosition}
        />
      ) : null}
    </PodcastPlayerContext.Provider>
  )
}
