import React, { useState, useCallback, useMemo } from 'react'
import {
  Box,
  Typography,
  Button,
  IconButton,
  Slider,
  CircularProgress,
  Chip,
  Paper,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import StopIcon from '@mui/icons-material/Stop'
import SettingsIcon from '@mui/icons-material/Settings'
import CloseIcon from '@mui/icons-material/Close'
import { alpha } from '@mui/material/styles'

import { useDashboards } from '../Dasboard/DashboardProvider'
import { StudyObject } from '../../studyPack/types'

export interface AudioOverviewSource {
  id: string
  title: string
  type: 'pdf' | 'text' | 'notes' | 'url'
  content: string
}

export interface AudioOverviewConfig {
  hosts: '两名AI主持人' | '一男一女' | '两女' | '沉稳男声+活泼女声'
  speed: number // 0.75 - 1.5
  language: string
  length: 'short' | 'medium' | 'long'
}

export interface GeneratedAudioOverview {
  id: string
  title: string
  transcript: string
  audioUrl?: string
  createdAt: Date
  sources: AudioOverviewSource[]
  duration: number // seconds
}

const defaultConfig: AudioOverviewConfig = {
  hosts: '一男一女',
  speed: 1.0,
  language: 'en',
  length: 'medium',
}

interface AudioOverviewPanelProps {
  studyObjects?: StudyObject[]
  onGenerated?: (overview: GeneratedAudioOverview) => void
  onClose?: () => void
}

const AudioOverviewPanel: React.FC<AudioOverviewPanelProps> = ({
  studyObjects = [],
  onGenerated,
  onClose,
}) => {
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generatedOverviews, setGeneratedOverviews] = useState<GeneratedAudioOverview[]>([])
  const [currentPlaying, setCurrentPlaying] = useState<string | null>(null)
  const [config, setConfig] = useState<AudioOverviewConfig>(defaultConfig)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedSources, setSelectedSources] = useState<AudioOverviewSource[]>([])

  // Collect content from study objects
  const availableSources = useMemo<AudioOverviewSource[]>(() => {
    return studyObjects.map((obj) => ({
      id: obj.id,
      title: (obj as any).displayTitle || obj.title || 'Untitled',
      type: 'notes' as const,
      content: (obj as any).displayTitle || obj.title || '',
    }))
  }, [studyObjects])

  const handleGenerate = useCallback(async () => {
    if (selectedSources.length === 0) {
      alert('请选择至少一个内容来源')
      return
    }

    setIsGenerating(true)
    setProgress(0)

    // Simulate generation progress (in real implementation, this would call AI)
    const totalSteps = 10
    for (let i = 1; i <= totalSteps; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      setProgress((i / totalSteps) * 100)
    }

    const combinedContent = selectedSources.map((s) => s.content).join('\n\n')

    const newOverview: GeneratedAudioOverview = {
      id: `audio-overview-${Date.now()}`,
      title: selectedSources.length === 1
        ? `Audio: ${selectedSources[0].title}`
        : `Audio Overview (${selectedSources.length} sources)`,
      transcript: generateMockTranscript(selectedSources, config),
      audioUrl: undefined, // In production, this would be the generated audio URL
      createdAt: new Date(),
      sources: selectedSources,
      duration: estimateDuration(selectedSources.length, config.length),
    }

    setGeneratedOverviews((prev) => [newOverview, ...prev])
    setIsGenerating(false)
    onGenerated?.(newOverview)
  }, [selectedSources, config, onGenerated])

  const handlePlayPreview = useCallback((overviewId: string) => {
    setCurrentPlaying(currentPlaying === overviewId ? null : overviewId)
  }, [currentPlaying])

  const handleStop = useCallback(() => {
    setCurrentPlaying(null)
  }, [])

  const toggleSourceSelection = useCallback((source: AudioOverviewSource) => {
    setSelectedSources((prev) => {
      const exists = prev.find((s) => s.id === source.id)
      if (exists) {
        return prev.filter((s) => s.id !== source.id)
      }
      return [...prev, source]
    })
  }, [])

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 420,
        maxHeight: '80vh',
        overflow: 'auto',
        borderRadius: 2,
        zIndex: 9999,
        bgcolor: 'background.paper',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>
            🎙️ Audio Overviews
          </Typography>
          <Chip
            label="AI Podcast"
            size="small"
            sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'rgba(255,255,255,0.2)' }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => setShowSettings(!showSettings)}
            sx={{ color: 'inherit' }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
          {onClose && (
            <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Settings Panel */}
      {showSettings && (
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            🎛️ 生成设置
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              主持人风格
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
              {(['两名AI主持人', '一男一女', '两女', '沉稳男声+活泼女声'] as const).map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  size="small"
                  variant={config.hosts === opt ? 'filled' : 'outlined'}
                  onClick={() => setConfig((c) => ({ ...c, hosts: opt }))}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              语速: {config.speed}x
            </Typography>
            <Slider
              value={config.speed}
              min={0.75}
              max={1.5}
              step={0.05}
              onChange={(_, v) => setConfig((c) => ({ ...c, speed: v as number }))}
              valueLabelDisplay="auto"
              size="small"
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              时长
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
              {(['short', 'medium', 'long'] as const).map((opt) => (
                <Chip
                  key={opt}
                  label={{ short: '~3分钟', medium: '~8分钟', long: '~15分钟' }[opt]}
                  size="small"
                  variant={config.length === opt ? 'filled' : 'outlined'}
                  onClick={() => setConfig((c) => ({ ...c, length: opt }))}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">
              语言
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
              {(['en', 'es', 'fr', 'de', 'zh']).map((lang) => (
                <Chip
                  key={lang}
                  label={lang.toUpperCase()}
                  size="small"
                  variant={config.language === lang ? 'filled' : 'outlined'}
                  onClick={() => setConfig((c) => ({ ...c, language: lang }))}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>
        </Box>
      )}

      {/* Source Selection */}
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          📚 选择内容来源 ({selectedSources.length} selected)
        </Typography>

        {availableSources.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            当前没有可用的学习内容。请先添加一些学习资料。
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 200, overflow: 'auto', mb: 2 }}>
            {availableSources.map((source) => (
              <Paper
                key={source.id}
                elevation={selectedSources.find((s) => s.id === source.id) ? 2 : 0}
                sx={{
                  p: 1,
                  mb: 0.5,
                  cursor: 'pointer',
                  border: '2px solid',
                  borderColor: selectedSources.find((s) => s.id === source.id)
                    ? 'primary.main'
                    : 'transparent',
                  bgcolor: selectedSources.find((s) => s.id === source.id)
                    ? 'primary.50'
                    : 'grey.50',
                  borderRadius: 1,
                }}
                onClick={() => toggleSourceSelection(source)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={source.type}
                    size="small"
                    sx={{ height: 18, fontSize: '0.65rem' }}
                    color={source.type === 'pdf' ? 'error' : source.type === 'url' ? 'info' : 'default'}
                  />
                  <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                    {source.title}
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Box>
        )}

        {/* Generate Button */}
        <Button
          variant="contained"
          fullWidth
          disabled={isGenerating || selectedSources.length === 0}
          onClick={handleGenerate}
          startIcon={isGenerating ? <CircularProgress size={18} color="inherit" /> : null}
          sx={{ mt: 1 }}
        >
          {isGenerating
            ? `生成中... ${Math.round(progress)}%`
            : `🎙️ 生成 Audio Overview (${config.length === 'short' ? '3分钟' : config.length === 'medium' ? '8分钟' : '15分钟'})`}
        </Button>
      </Box>

      {/* Generated Overviews List */}
      {generatedOverviews.length > 0 && (
        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            📖 已生成的 Overviews
          </Typography>

          {generatedOverviews.map((overview) => (
            <Paper
              key={overview.id}
              sx={{ p: 1.5, mb: 1, bgcolor: 'grey.50', borderRadius: 1 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }} noWrap>
                  {overview.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {Math.round(overview.duration / 60)}min
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => handlePlayPreview(overview.id)}
                >
                  {currentPlaying === overview.id ? (
                    <PauseIcon fontSize="small" />
                  ) : (
                    <PlayArrowIcon fontSize="small" />
                  )}
                </IconButton>

                {currentPlaying === overview.id && (
                  <IconButton size="small" color="error" onClick={handleStop}>
                    <StopIcon fontSize="small" />
                  </IconButton>
                )}

                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                  {currentPlaying === overview.id ? '🔊 播放中' : '⏸️ 已暂停'}
                </Typography>

                <Chip
                  label={`${overview.sources.length} sources`}
                  size="small"
                  sx={{ height: 18, fontSize: '0.65rem' }}
                />
              </Box>

              {/* Progress Bar for playing */}
              {currentPlaying === overview.id && (
                <Box sx={{ mt: 1 }}>
                  <Box
                    sx={{
                      height: 3,
                      bgcolor: 'grey.300',
                      borderRadius: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: '35%',
                        bgcolor: 'primary.main',
                        animation: 'progressAnimation 60s linear infinite',
                        '@keyframes progressAnimation': {
                          '0%': { width: '0%' },
                          '100%': { width: '100%' },
                        },
                      }}
                    />
                  </Box>
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      )}

      {/* Transcript Toggle */}
      {generatedOverviews.length > 0 && (
        <Box sx={{ p: 2, pt: 0 }}>
          <Typography
            variant="caption"
            color="primary"
            sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5 }}
            onClick={() => {
              const latest = generatedOverviews[0]
              alert(`📝 文字稿预览:\n\n${latest.transcript.substring(0, 300)}...`)
            }}
          >
            📜 查看最新 Overview 文字稿
          </Typography>
        </Box>
      )}
    </Paper>
  )
}

// Mock transcript generator (in production, this would come from AI)
function generateMockTranscript(
  sources: AudioOverviewSource[],
  config: AudioOverviewConfig,
): string {
  const titles = sources.map((s) => s.title).join(', ')
  return `【Audio Overview 文字稿】

主题: ${titles}
风格: ${config.hosts}
时长: ${config.length === 'short' ? '3分钟' : config.length === 'medium' ? '8分钟' : '15分钟'}

---

[开场]
主持人A: 大家好！今天我们要讨论一个非常有趣的话题——${titles}。让我们一起来深入了解吧！

主持人B: 是的！让我们从基础概念开始。

[主要内容]
主持人A: 首先，我们需要理解这个主题的核心要点...

[总结]
主持人B: 总的来说，今天我们讨论了关于${titles}的关键知识点。希望这对大家的学习有所帮助！

[结束]
主持人A: 感谢大家的收听！下次再见！
主持人B: 再见！`

}

function estimateDuration(sourceCount: number, length: 'short' | 'medium' | 'long'): number {
  const baseSeconds = length === 'short' ? 180 : length === 'medium' ? 480 : 900
  return baseSeconds + sourceCount * 30
}

export default AudioOverviewPanel

// Hook for integrating audio overview into StudyMesh
export function useAudioOverview() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [overviews, setOverviews] = useState<GeneratedAudioOverview[]>([])

  const openPanel = useCallback(() => setIsPanelOpen(true), [])
  const closePanel = useCallback(() => setIsPanelOpen(false), [])

  const saveOverview = useCallback((overview: GeneratedAudioOverview) => {
    setOverviews((prev) => [overview, ...prev])
  }, [])

  return {
    isPanelOpen,
    overviews,
    openPanel,
    closePanel,
    saveOverview,
    AudioOverviewPanel,
  }
}