import React, { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import TuneIcon from '@mui/icons-material/Tune'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import ContentPasteIcon from '@mui/icons-material/ContentPaste'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import RouteIcon from '@mui/icons-material/Route'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

import { createStudyPathContainerState } from './studyPathContainer'
import { normalizeFolderColor } from './folderColors'
import { DashboardStorage, SavedDashboard } from './dashboardStorage'

type EmptyDashboardQuickCreate = 'quiz' | 'flashcards' | 'improvedNotes'
type EmptyDashboardBlock = 'creation' | 'studyMaterial'
type EmptyDashboardStudyMaterialMode = 'recent' | 'custom'

interface EmptyDashboardSettings {
  blockOrder: EmptyDashboardBlock[]
  showCreationBlock: boolean
  studyMaterialMode: EmptyDashboardStudyMaterialMode
  studyMaterialLimit: number
  studyMaterialColumns: number
  customEntryIds: string[]
  customSections: EmptyDashboardCustomSection[]
}

interface EmptyDashboardCustomSection {
  id: string
  name: string
  entryIds: string[]
}

interface StudyMaterialEntry {
  id: string
  folderName: string
  dashboards: SavedDashboard[]
  firstDashboard?: SavedDashboard
  title: string
  isStudyPath: boolean
  colorSourceFolder: string
}

interface DashboardEmptyStateProps {
  isAdmin: boolean
  hasDashboard: boolean
  onCreateStudyPath: () => void
  onUploadMaterial: () => void
  onPasteNotes: () => void
  onQuickCreate: (intent: EmptyDashboardQuickCreate) => void
  onOpenSavedLibrary: () => void
  dashboardOptions: SavedDashboard[]
  onOpenDashboard: (dashboard: SavedDashboard) => void
  onOpenStudyGuide: (dashboards: SavedDashboard[]) => void
}

const EMPTY_DASHBOARD_SETTINGS_KEY = 'studymesh-empty-dashboard-settings-v1'
const MAX_STUDY_MATERIAL_ITEMS = 20
const DEFAULT_CUSTOM_SECTION_ID = 'custom-section-default'
const DEFAULT_CUSTOM_SECTION_NAME = 'Custom'

const defaultEmptyDashboardSettings: EmptyDashboardSettings = {
  blockOrder: ['creation', 'studyMaterial'],
  showCreationBlock: true,
  studyMaterialMode: 'recent',
  studyMaterialLimit: 3,
  studyMaterialColumns: 1,
  customEntryIds: [],
  customSections: [
    {
      id: DEFAULT_CUSTOM_SECTION_ID,
      name: DEFAULT_CUSTOM_SECTION_NAME,
      entryIds: [],
    },
  ],
}

const isEmptyDashboardBlock = (value: unknown): value is EmptyDashboardBlock =>
  value === 'creation' || value === 'studyMaterial'

const normalizeEntryIds = (value: unknown) =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value.filter(
            (entryId): entryId is string => typeof entryId === 'string',
          ),
        ),
      )
    : []

const flattenCustomSections = (sections: EmptyDashboardCustomSection[]) =>
  sections.flatMap((section) => section.entryIds)

const normalizeCustomSections = (
  sectionsValue: unknown,
  legacyEntryIds: string[],
): EmptyDashboardCustomSection[] => {
  if (Array.isArray(sectionsValue)) {
    const usedEntryIds = new Set<string>()
    const sections = sectionsValue
      .map((section, index) => {
        if (!section || typeof section !== 'object') {
          return null
        }

        const rawSection = section as Partial<EmptyDashboardCustomSection>
        const entryIds = normalizeEntryIds(rawSection.entryIds).filter(
          (entryId) => {
            if (usedEntryIds.has(entryId)) {
              return false
            }

            usedEntryIds.add(entryId)
            return true
          },
        )

        return {
          id:
            typeof rawSection.id === 'string' && rawSection.id.trim()
              ? rawSection.id
              : `custom-section-${index + 1}`,
          name:
            typeof rawSection.name === 'string' && rawSection.name.trim()
              ? rawSection.name.trim()
              : `Section ${index + 1}`,
          entryIds,
        }
      })
      .filter((section): section is EmptyDashboardCustomSection =>
        Boolean(section),
      )

    if (sections.length > 0) {
      return sections
    }
  }

  return [
    {
      id: DEFAULT_CUSTOM_SECTION_ID,
      name: DEFAULT_CUSTOM_SECTION_NAME,
      entryIds: legacyEntryIds,
    },
  ]
}

const normalizeEmptyDashboardSettings = (
  value: Partial<EmptyDashboardSettings> | null,
): EmptyDashboardSettings => {
  const blockOrder = Array.isArray(value?.blockOrder)
    ? value.blockOrder.filter(isEmptyDashboardBlock)
    : defaultEmptyDashboardSettings.blockOrder
  const uniqueBlockOrder = Array.from(new Set(blockOrder))
  const normalizedBlockOrder: EmptyDashboardBlock[] = [
    ...uniqueBlockOrder,
    ...defaultEmptyDashboardSettings.blockOrder.filter(
      (block) => !uniqueBlockOrder.includes(block),
    ),
  ]

  const legacyEntryIds = normalizeEntryIds(value?.customEntryIds)
  const customSections = normalizeCustomSections(
    value?.customSections,
    legacyEntryIds,
  )
  const customEntryIds = flattenCustomSections(customSections)

  return {
    blockOrder: normalizedBlockOrder,
    showCreationBlock:
      typeof value?.showCreationBlock === 'boolean'
        ? value.showCreationBlock
        : defaultEmptyDashboardSettings.showCreationBlock,
    studyMaterialMode:
      value?.studyMaterialMode === 'custom'
        ? 'custom'
        : defaultEmptyDashboardSettings.studyMaterialMode,
    studyMaterialLimit:
      typeof value?.studyMaterialLimit === 'number'
        ? Math.max(
            0,
            Math.min(MAX_STUDY_MATERIAL_ITEMS, value.studyMaterialLimit),
          )
        : defaultEmptyDashboardSettings.studyMaterialLimit,
    studyMaterialColumns:
      typeof value?.studyMaterialColumns === 'number'
        ? Math.max(1, Math.min(6, Math.round(value.studyMaterialColumns)))
        : defaultEmptyDashboardSettings.studyMaterialColumns,
    customEntryIds,
    customSections,
  }
}

const readEmptyDashboardSettings = (): EmptyDashboardSettings => {
  if (typeof window === 'undefined') {
    return defaultEmptyDashboardSettings
  }

  try {
    const stored = window.localStorage.getItem(EMPTY_DASHBOARD_SETTINGS_KEY)
    return normalizeEmptyDashboardSettings(stored ? JSON.parse(stored) : null)
  } catch (error) {
    console.error('Failed to load empty dashboard settings', error)
    return defaultEmptyDashboardSettings
  }
}

const saveEmptyDashboardSettings = (settings: EmptyDashboardSettings) => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      EMPTY_DASHBOARD_SETTINGS_KEY,
      JSON.stringify(settings),
    )
  } catch (error) {
    console.error('Failed to save empty dashboard settings', error)
  }
}

const getStudyPathEntryId = (folderName: string) =>
  `studyPath:${folderName.trim().toLowerCase()}`

const getDashboardEntryId = (dashboardId: string) => `dashboard:${dashboardId}`

const DashboardEmptyState = ({
  isAdmin,
  onCreateStudyPath,
  onUploadMaterial,
  onPasteNotes,
  dashboardOptions,
  onOpenDashboard,
  onOpenStudyGuide,
}: DashboardEmptyStateProps) => {
  const [settings, setSettings] = useState(readEmptyDashboardSettings)
  const [customizerOpen, setCustomizerOpen] = useState(false)
  const [activeCustomSectionId, setActiveCustomSectionId] = useState(
    DEFAULT_CUSTOM_SECTION_ID,
  )
  const dashboardsByFolder = dashboardOptions.reduce<
    Record<string, SavedDashboard[]>
  >((folders, dashboard) => {
    const folderName = dashboard.folder?.trim() || 'Default'
    folders[folderName] = folders[folderName] || []
    folders[folderName].push(dashboard)
    return folders
  }, {})
  const folderEntries: StudyMaterialEntry[] = Object.entries(
    dashboardsByFolder,
  ).flatMap(([folderName, dashboards]) => {
    const studyGuide = createStudyPathContainerState(dashboards)

    if (studyGuide) {
      return [
        {
          id: getStudyPathEntryId(folderName),
          folderName,
          dashboards,
          firstDashboard: dashboards[0],
          title: studyGuide.title,
          isStudyPath: true,
          colorSourceFolder: folderName,
        },
      ]
    }

    return dashboards.map((dashboard) => ({
      id: getDashboardEntryId(dashboard.id),
      folderName: dashboard.folder?.trim() || 'Default',
      dashboards: [dashboard],
      firstDashboard: dashboard,
      title: dashboard.name,
      isStudyPath: false,
      colorSourceFolder: dashboard.folder?.trim() || 'Default',
    }))
  })
  const entryById = new Map(folderEntries.map((entry) => [entry.id, entry]))
  const selectedCustomIds = new Set(settings.customEntryIds)
  const availableCustomEntries = folderEntries.filter(
    (entry) => !selectedCustomIds.has(entry.id),
  )
  const activeCustomSection =
    settings.customSections.find(
      (section) => section.id === activeCustomSectionId,
    ) || settings.customSections[0]
  const activeCustomSectionIndex = Math.max(
    0,
    settings.customSections.findIndex(
      (section) => section.id === activeCustomSection?.id,
    ),
  )
  const activeCustomSectionIdSafe =
    activeCustomSection?.id || DEFAULT_CUSTOM_SECTION_ID
  const customSectionsWithEntries = settings.customSections.map((section) => ({
    ...section,
    entries: section.entryIds
      .map((entryId) => entryById.get(entryId))
      .filter((entry): entry is StudyMaterialEntry => Boolean(entry)),
  }))
  const getVisibleCustomSections = (
    nextSettings: EmptyDashboardSettings,
  ): Array<EmptyDashboardCustomSection & { entries: StudyMaterialEntry[] }> => {
    let remaining = nextSettings.studyMaterialLimit

    return nextSettings.customSections
      .map((section) => {
        const entries: StudyMaterialEntry[] = []

        for (const entryId of section.entryIds) {
          if (remaining <= 0) {
            break
          }

          const entry = entryById.get(entryId)

          if (entry) {
            entries.push(entry)
            remaining -= 1
          }
        }

        return { ...section, entries }
      })
      .filter((section) => section.entries.length > 0)
  }
  const getStudyMaterialVisibleCount = (
    nextSettings: EmptyDashboardSettings,
  ) => {
    const availableCount =
      nextSettings.studyMaterialMode === 'custom'
        ? nextSettings.customEntryIds.length
        : folderEntries.length

    return Math.min(nextSettings.studyMaterialLimit, availableCount)
  }
  const getStudyMaterialColumnMax = (nextSettings: EmptyDashboardSettings) => {
    const visibleCount = getStudyMaterialVisibleCount(nextSettings)
    const maxByVisibleItems = Math.max(1, visibleCount)

    return Math.max(1, Math.min(6, maxByVisibleItems))
  }
  const studyMaterialColumnMax = getStudyMaterialColumnMax(settings)
  const effectiveStudyMaterialColumns = Math.min(
    settings.studyMaterialColumns,
    studyMaterialColumnMax,
  )
  const visibleCustomSections = getVisibleCustomSections(settings)
  const visibleStudyMaterialEntries =
    settings.studyMaterialMode === 'custom'
      ? settings.customEntryIds
          .map((entryId) => entryById.get(entryId))
          .filter((entry): entry is StudyMaterialEntry => Boolean(entry))
          .slice(0, settings.studyMaterialLimit)
      : folderEntries.slice(0, settings.studyMaterialLimit)
  const isSingleBlock =
    !settings.showCreationBlock ||
    settings.blockOrder.filter(
      (block) => block === 'studyMaterial' || settings.showCreationBlock,
    ).length < 2

  const updateSettings = (
    nextSettings:
      | Partial<EmptyDashboardSettings>
      | ((current: EmptyDashboardSettings) => Partial<EmptyDashboardSettings>),
  ) => {
    setSettings((current) => {
      const nextPartial =
        typeof nextSettings === 'function'
          ? nextSettings(current)
          : nextSettings
      const normalized = normalizeEmptyDashboardSettings({
        ...current,
        ...nextPartial,
      })
      const columnMax = getStudyMaterialColumnMax(normalized)
      const nextNormalized = {
        ...normalized,
        studyMaterialColumns: Math.min(
          normalized.studyMaterialColumns,
          columnMax,
        ),
      }
      saveEmptyDashboardSettings(nextNormalized)
      return nextNormalized
    })
  }

  useEffect(() => {
    if (settings.studyMaterialColumns > studyMaterialColumnMax) {
      updateSettings({ studyMaterialColumns: studyMaterialColumnMax })
    }
  }, [settings.studyMaterialColumns, studyMaterialColumnMax])

  const resetSettings = () => {
    updateSettings(defaultEmptyDashboardSettings)
    setActiveCustomSectionId(DEFAULT_CUSTOM_SECTION_ID)
  }

  const addCustomEntry = (entryId: string) => {
    if (!entryId) {
      return
    }

    updateSettings((current) => {
      if (current.customEntryIds.includes(entryId)) {
        return {}
      }

      const sectionId = current.customSections.some(
        (section) => section.id === activeCustomSectionIdSafe,
      )
        ? activeCustomSectionIdSafe
        : current.customSections[0]?.id || DEFAULT_CUSTOM_SECTION_ID
      const customSections = current.customSections.map((section) =>
        section.id === sectionId
          ? { ...section, entryIds: [...section.entryIds, entryId] }
          : section,
      )

      return {
        customSections,
        customEntryIds: flattenCustomSections(customSections),
      }
    })
  }

  const removeCustomEntry = (entryId: string) => {
    updateSettings((current) => {
      const customSections = current.customSections.map((section) => ({
        ...section,
        entryIds: section.entryIds.filter(
          (customEntryId) => customEntryId !== entryId,
        ),
      }))

      return {
        customSections,
        customEntryIds: flattenCustomSections(customSections),
      }
    })
  }

  const moveCustomEntry = (entryId: string, direction: -1 | 1) => {
    updateSettings((current) => {
      const customSections = current.customSections.map((section) => {
        const currentIndex = section.entryIds.indexOf(entryId)
        const nextIndex = currentIndex + direction

        if (
          currentIndex < 0 ||
          nextIndex < 0 ||
          nextIndex >= section.entryIds.length
        ) {
          return section
        }

        const entryIds = [...section.entryIds]
        const [movedEntryId] = entryIds.splice(currentIndex, 1)
        entryIds.splice(nextIndex, 0, movedEntryId)

        return { ...section, entryIds }
      })

      return {
        customSections,
        customEntryIds: flattenCustomSections(customSections),
      }
    })
  }

  const addCustomSection = () => {
    let index = settings.customSections.length + 1
    let sectionId = `custom-section-${index}`

    while (
      settings.customSections.some((section) => section.id === sectionId)
    ) {
      index += 1
      sectionId = `custom-section-${index}`
    }

    setActiveCustomSectionId(sectionId)

    updateSettings((current) => {
      return {
        customSections: [
          ...current.customSections,
          { id: sectionId, name: `Section ${index}`, entryIds: [] },
        ],
      }
    })
  }

  const moveCustomSection = (sectionId: string, direction: -1 | 1) => {
    updateSettings((current) => {
      const currentIndex = current.customSections.findIndex(
        (section) => section.id === sectionId,
      )
      const nextIndex = currentIndex + direction

      if (
        currentIndex < 0 ||
        nextIndex < 0 ||
        nextIndex >= current.customSections.length
      ) {
        return {}
      }

      const customSections = [...current.customSections]
      const [movedSection] = customSections.splice(currentIndex, 1)
      customSections.splice(nextIndex, 0, movedSection)

      return {
        customSections,
        customEntryIds: flattenCustomSections(customSections),
      }
    })
  }

  const removeCustomSection = (sectionId: string) => {
    const nextActiveSectionId =
      settings.customSections.find((section) => section.id !== sectionId)?.id ||
      DEFAULT_CUSTOM_SECTION_ID

    updateSettings((current) => {
      if (current.customSections.length <= 1) {
        return {}
      }

      const customSections = current.customSections.filter(
        (section) => section.id !== sectionId,
      )

      return {
        customSections,
        customEntryIds: flattenCustomSections(customSections),
      }
    })
    setActiveCustomSectionId(nextActiveSectionId)
  }

  const setFirstBlock = (block: EmptyDashboardBlock) => {
    updateSettings({
      blockOrder:
        block === 'creation'
          ? ['creation', 'studyMaterial']
          : ['studyMaterial', 'creation'],
    })
  }

  const actionIconButtonSx = {
    width: 36,
    height: 36,
    borderRadius: '50%',
    color: 'text.primary',
    border: 1,
    borderColor: 'divider',
    bgcolor: 'background.paper',
    boxShadow: (theme) =>
      theme.palette.mode === 'dark'
        ? '0 1px 0 rgba(255,255,255,0.04)'
        : '0 1px 2px rgba(15,23,42,0.08)',
    '&:hover': {
      color: 'primary.main',
      borderColor: 'primary.main',
      bgcolor: 'action.hover',
    },
    '&.Mui-disabled': {
      color: 'text.disabled',
      borderColor: 'divider',
      bgcolor: 'action.disabledBackground',
      boxShadow: 'none',
    },
  }
  const destructiveActionIconButtonSx = {
    ...actionIconButtonSx,
    '&:hover': {
      color: 'error.main',
      borderColor: 'error.main',
      bgcolor: 'action.hover',
    },
  }

  const renderStudyMaterialEntry = (
    entry: StudyMaterialEntry,
    showCustomEntryControls: boolean,
    sectionName?: string,
  ) => {
    const folderColor = normalizeFolderColor(
      entry.dashboards.find((dashboard) => dashboard.folderColor)
        ?.folderColor ||
        DashboardStorage.getFolderColor(entry.colorSourceFolder),
    )
    const showFolderLabel =
      !sectionName ||
      entry.folderName.trim().toLowerCase() !== sectionName.trim().toLowerCase()

    if (showCustomEntryControls && settings.studyMaterialMode === 'custom') {
      const customEntrySection = settings.customSections.find((section) =>
        section.entryIds.includes(entry.id),
      )
      const customEntryIndex =
        customEntrySection?.entryIds.indexOf(entry.id) ?? -1
      const customEntryCount = customEntrySection?.entryIds.length ?? 0

      return (
        <Paper
          key={entry.id}
          elevation={0}
          sx={{
            width: '100%',
            minHeight: { xs: 58, md: 68 },
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            alignItems: 'center',
            gap: 0.75,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1.5,
            px: 1.25,
            py: 0.75,
            minWidth: 0,
            maxWidth: '100%',
            color: 'text.primary',
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {showFolderLabel ? (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: folderColor,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  lineHeight: 1.2,
                  fontSize: '0.625rem',
                }}
              >
                {entry.folderName}
              </Typography>
            ) : null}
            <Typography
              variant="body2"
              fontWeight={800}
              sx={{
                fontSize: '0.8125rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.title}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.25}>
            <IconButton
              aria-label={`Move ${entry.title} up`}
              size="small"
              onClick={() => moveCustomEntry(entry.id, -1)}
              disabled={customEntryIndex <= 0}
              sx={actionIconButtonSx}
            >
              <KeyboardArrowUpIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label={`Move ${entry.title} down`}
              size="small"
              onClick={() => moveCustomEntry(entry.id, 1)}
              disabled={
                customEntryIndex < 0 ||
                customEntryIndex === customEntryCount - 1
              }
              sx={actionIconButtonSx}
            >
              <KeyboardArrowDownIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label={`Remove ${entry.title}`}
              size="small"
              onClick={() => removeCustomEntry(entry.id)}
              sx={destructiveActionIconButtonSx}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Paper>
      )
    }

    return (
      <Button
        key={entry.id}
        variant="text"
        onClick={() =>
          entry.isStudyPath
            ? onOpenStudyGuide(entry.dashboards)
            : entry.firstDashboard && onOpenDashboard(entry.firstDashboard)
        }
        sx={{
          width: '100%',
          minHeight: { xs: 48, md: 58 },
          justifyContent: 'flex-start',
          textAlign: 'left',
          textTransform: 'none',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
          px: 1.25,
          minWidth: 0,
          maxWidth: '100%',
          color: 'text.primary',
          bgcolor: 'background.paper',
          '&:hover': {
            borderColor: folderColor,
            bgcolor: 'action.hover',
          },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              color: folderColor,
              fontWeight: 900,
              textTransform: 'uppercase',
              lineHeight: 1.2,
              fontSize: '0.625rem',
            }}
          >
            {entry.folderName}
          </Typography>
          <Typography
            variant="body2"
            fontWeight={800}
            sx={{
              fontSize: '0.8125rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.title}
          </Typography>
        </Box>
      </Button>
    )
  }

  const renderCreationBlock = () => (
    <Paper
      key="creation"
      elevation={0}
      sx={{
        p: { xs: 1.25, sm: 2, md: 2.5 },
        borderRadius: 3,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 1.5, md: 2 },
        minWidth: 0,
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: 760,
        mx: 'auto',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 20px 56px rgba(0,0,0,0.28)'
            : '0 20px 56px rgba(15,23,42,0.08)',
      }}
    >
      <Box>
        <Typography
          variant="caption"
          color="primary"
          fontWeight={900}
          sx={{
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            fontSize: '0.56rem',
          }}
        >
          Start creating
        </Typography>
        <Typography
          variant="h4"
          fontWeight={950}
          sx={{
            mt: 0.5,
            lineHeight: 1.08,
            fontSize: { xs: '1.16rem', sm: '1.48rem', md: '1.76rem' },
          }}
        >
          What do you want to learn?
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, maxWidth: 620, fontSize: '0.72rem' }}
        >
          Create a guided Study Path, or add material to generate a quiz,
          flashcards, or Expand on this.
        </Typography>
      </Box>

      <Paper
        component="button"
        type="button"
        elevation={0}
        onClick={onCreateStudyPath}
        disabled={!isAdmin}
        sx={{
          width: '100%',
          p: { xs: 1.5, sm: 2 },
          borderRadius: 2.5,
          border: 1,
          borderColor: (theme) => alpha(theme.palette.primary.main, 0.42),
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.075),
          color: 'text.primary',
          cursor: isAdmin ? 'pointer' : 'default',
          textAlign: 'left',
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: { xs: 1.25, sm: 1.5 },
          boxShadow: (theme) =>
            `0 16px 38px ${alpha(theme.palette.primary.main, 0.1)}`,
          '&:hover': {
            borderColor: isAdmin ? 'primary.main' : undefined,
            bgcolor: (theme) =>
              isAdmin
                ? alpha(theme.palette.primary.main, 0.105)
                : alpha(theme.palette.primary.main, 0.075),
            transform: isAdmin ? 'translateY(-1px)' : undefined,
          },
          '&:focus-visible': {
            outline: (theme) =>
              `3px solid ${alpha(theme.palette.primary.main, 0.3)}`,
            outlineOffset: 2,
          },
          transition:
            'background-color 160ms ease, border-color 160ms ease, transform 160ms ease',
        }}
      >
        <Box
          sx={{
            width: { xs: 44, sm: 52 },
            height: { xs: 44, sm: 52 },
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
          }}
        >
          <RouteIcon />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="primary" fontWeight={900}>
              Recommended
            </Typography>
          </Stack>
          <Typography variant="h5" fontWeight={950} lineHeight={1.12}>
            Create Study Path
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
            A guided multi-dashboard tutorial with lessons, exercises,
            flashcards, and review structure.
          </Typography>
        </Box>
        <ChevronRightIcon color="primary" />
      </Paper>

      <Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1,
          }}
        >
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={onUploadMaterial}
            disabled={!isAdmin}
            sx={{
              justifyContent: 'flex-start',
              minHeight: 42,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.8125rem',
            }}
          >
            Upload material
          </Button>
          <Button
            variant="outlined"
            startIcon={<ContentPasteIcon />}
            onClick={onPasteNotes}
            disabled={!isAdmin}
            sx={{
              justifyContent: 'flex-start',
              minHeight: 42,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.8125rem',
              bgcolor: 'background.paper',
            }}
          >
            Paste notes
          </Button>
        </Box>
      </Box>
    </Paper>
  )

  const renderStudyMaterialBlock = (
    showCustomizeButton = true,
    showCustomEntryControls = false,
  ) => (
    <Paper
      key="studyMaterial"
      elevation={0}
      sx={{
        p: { xs: 1.25, sm: 2, md: 2.25 },
        borderRadius: 3,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 1.25, md: 1.75 },
        minWidth: 0,
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: 760,
        mx: 'auto',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
      >
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'background.default',
              color: 'primary.main',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <FolderOpenIcon sx={{ fontSize: 18 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={900} sx={{ fontSize: '1rem' }}>
              Open study material
            </Typography>
          </Box>
        </Stack>
        {showCustomizeButton ? (
          <IconButton
            aria-label="Customize this page"
            size="small"
            onClick={() => setCustomizerOpen(true)}
            sx={{
              width: 34,
              height: 34,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1.5,
              alignSelf: { xs: 'flex-start', sm: 'center' },
              color: 'primary.main',
              bgcolor: 'background.paper',
              '&:hover': {
                bgcolor: 'action.hover',
                borderColor: 'primary.main',
              },
            }}
          >
            <TuneIcon sx={{ fontSize: 18 }} />
          </IconButton>
        ) : null}
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        {settings.studyMaterialMode === 'recent' ? (
          <Typography
            variant="caption"
            fontWeight={800}
            sx={{ mb: 0.75, color: 'text.secondary', fontSize: '0.6875rem' }}
          >
            Recent
          </Typography>
        ) : null}
        {settings.studyMaterialMode === 'custom' &&
        visibleCustomSections.length > 0 ? (
          <Stack spacing={1.25}>
            {visibleCustomSections.map((section) => (
              <Box key={section.id}>
                <Typography
                  variant="caption"
                  fontWeight={900}
                  color="text.secondary"
                  sx={{
                    display: 'block',
                    mb: 0.5,
                    textTransform: 'uppercase',
                    fontSize: '0.625rem',
                  }}
                >
                  {section.name}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      md: `repeat(${effectiveStudyMaterialColumns}, minmax(0, 1fr))`,
                    },
                    gap: 1,
                  }}
                >
                  {section.entries.map((entry) =>
                    renderStudyMaterialEntry(
                      entry,
                      showCustomEntryControls,
                      section.name,
                    ),
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        ) : visibleStudyMaterialEntries.length > 0 ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: `repeat(${effectiveStudyMaterialColumns}, minmax(0, 1fr))`,
              },
              gap: 1,
            }}
          >
            {visibleStudyMaterialEntries.map((entry) =>
              renderStudyMaterialEntry(entry, showCustomEntryControls),
            )}
          </Box>
        ) : (
          <Box
            sx={{
              minHeight: 220,
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              px: 2,
              color: 'text.secondary',
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'background.default',
            }}
          >
            <Box>
              <FolderOpenIcon sx={{ fontSize: 38, mb: 1, opacity: 0.65 }} />
              <Typography variant="body2" fontWeight={800}>
                {settings.studyMaterialMode === 'custom'
                  ? 'Choose custom Study Paths and dashboards to show here.'
                  : 'Saved Study Paths and dashboards appear here.'}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      <Stack direction="row" gap={0.75} flexWrap="wrap">
        <Chip size="small" label="Study Paths" />
        <Chip size="small" label="Dashboards" />
      </Stack>
    </Paper>
  )

  const customizerControls = (
    <Paper
      elevation={0}
      data-testid="empty-dashboard-customizer-settings"
      sx={{
        p: { xs: 1.25, sm: 1.75, md: 2 },
        borderRadius: 2.5,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        minWidth: 0,
        boxSizing: 'border-box',
        width: '100%',
        position: { lg: 'sticky' },
        top: { lg: 0 },
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1}
      >
        <Box>
          <Typography variant="subtitle2" fontWeight={950}>
            Customize empty dashboard
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Changes apply live.
          </Typography>
        </Box>
        <Button
          size="small"
          onClick={resetSettings}
          sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
        >
          Reset
        </Button>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 1.5,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            bgcolor: 'background.default',
            gridColumn: { xs: 'auto', md: '1 / -1' },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'minmax(0, 1fr) minmax(0, 1fr) auto',
              },
              gap: 1.25,
              alignItems: 'center',
            }}
          >
            <TextField
              select
              size="small"
              label="First block"
              value={settings.blockOrder[0]}
              onChange={(event) =>
                setFirstBlock(event.target.value as EmptyDashboardBlock)
              }
              fullWidth
            >
              <MenuItem value="creation">Creation</MenuItem>
              <MenuItem value="studyMaterial">Open study material</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label="Study material"
              value={settings.studyMaterialMode}
              onChange={(event) =>
                updateSettings({
                  studyMaterialMode: event.target
                    .value as EmptyDashboardStudyMaterialMode,
                })
              }
              fullWidth
            >
              <MenuItem value="recent">Recent</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </TextField>

            <FormControlLabel
              sx={{
                m: 0,
                px: 1.25,
                py: 0.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: 'background.paper',
              }}
              control={
                <Switch
                  checked={settings.showCreationBlock}
                  onChange={(event) =>
                    updateSettings({ showCreationBlock: event.target.checked })
                  }
                />
              }
              label="Show Creation"
            />
          </Box>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            bgcolor: 'background.default',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gridColumn: '1 / -1',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: { xs: 1.25, md: 2 },
            }}
          >
            <Box
              sx={{
                minWidth: 0,
                px: { md: 0.5 },
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 0.25 }}
              >
                <Typography variant="caption" fontWeight={900}>
                  Visible items
                </Typography>
                <Chip
                  size="small"
                  label={settings.studyMaterialLimit}
                  sx={{ fontWeight: 900 }}
                />
              </Stack>
              <Slider
                aria-label="Visible items"
                value={settings.studyMaterialLimit}
                min={0}
                max={MAX_STUDY_MATERIAL_ITEMS}
                step={1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 10, label: '10' },
                  { value: 20, label: '20' },
                ]}
                onChange={(_, value) =>
                  updateSettings({
                    studyMaterialLimit: Array.isArray(value) ? value[0] : value,
                  })
                }
              />
            </Box>

            <Box
              sx={{
                minWidth: 0,
                px: { md: 0.5 },
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 0.25 }}
              >
                <Typography variant="caption" fontWeight={900}>
                  Columns
                </Typography>
                <Chip
                  size="small"
                  label={effectiveStudyMaterialColumns}
                  sx={{ fontWeight: 900 }}
                />
              </Stack>
              <Slider
                aria-label="Study material columns"
                value={effectiveStudyMaterialColumns}
                min={1}
                max={studyMaterialColumnMax}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  ...(studyMaterialColumnMax > 1
                    ? [
                        {
                          value: studyMaterialColumnMax,
                          label: String(studyMaterialColumnMax),
                        },
                      ]
                    : []),
                ]}
                onChange={(_, value) =>
                  updateSettings({
                    studyMaterialColumns: Array.isArray(value)
                      ? value[0]
                      : value,
                  })
                }
              />
            </Box>
          </Box>
        </Paper>

        {settings.studyMaterialMode === 'custom' ? (
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'background.default',
              gridColumn: { xs: 'auto', md: '1 / -1' },
            }}
          >
            <Stack spacing={1.25}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'minmax(0, 1fr) auto',
                    md: 'minmax(0, 1fr) auto minmax(148px, auto)',
                  },
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                <TextField
                  select
                  size="small"
                  label="Active section"
                  value={activeCustomSectionIdSafe}
                  onChange={(event) =>
                    setActiveCustomSectionId(event.target.value)
                  }
                  fullWidth
                >
                  {settings.customSections.map((section) => (
                    <MenuItem key={section.id} value={section.id}>
                      {section.name} ({section.entryIds.length})
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={addCustomSection}
                  sx={{
                    minHeight: 40,
                    flexShrink: 0,
                    textTransform: 'none',
                    fontWeight: 800,
                  }}
                >
                  Add section
                </Button>
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
                  sx={{
                    px: 0.75,
                    py: 0.5,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    minHeight: 40,
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={900}
                    sx={{
                      mr: 0.25,
                      textTransform: 'uppercase',
                      fontSize: '0.625rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Section order
                  </Typography>
                  <IconButton
                    aria-label="Move section up"
                    size="small"
                    onClick={() =>
                      moveCustomSection(activeCustomSectionIdSafe, -1)
                    }
                    disabled={activeCustomSectionIndex <= 0}
                    sx={actionIconButtonSx}
                  >
                    <KeyboardArrowUpIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Move section down"
                    size="small"
                    onClick={() =>
                      moveCustomSection(activeCustomSectionIdSafe, 1)
                    }
                    disabled={
                      activeCustomSectionIndex >=
                      settings.customSections.length - 1
                    }
                    sx={actionIconButtonSx}
                  >
                    <KeyboardArrowDownIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Remove section"
                    size="small"
                    onClick={() =>
                      removeCustomSection(activeCustomSectionIdSafe)
                    }
                    disabled={settings.customSections.length <= 1}
                    sx={destructiveActionIconButtonSx}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>

              <TextField
                select
                size="small"
                label={`Add to ${activeCustomSection?.name || 'section'}`}
                value=""
                onChange={(event) => addCustomEntry(event.target.value)}
                fullWidth
                disabled={availableCustomEntries.length === 0}
              >
                {availableCustomEntries.map((entry) => (
                  <MenuItem key={entry.id} value={entry.id}>
                    {entry.title} -{' '}
                    {entry.isStudyPath ? 'Study Path' : 'Dashboard'}
                  </MenuItem>
                ))}
              </TextField>

              {customSectionsWithEntries.length > 0 ? (
                <Stack direction="row" gap={0.75} flexWrap="wrap">
                  {customSectionsWithEntries.map((section) => (
                    <Chip
                      key={section.id}
                      size="small"
                      label={`${section.name}: ${section.entries.length}`}
                      sx={{ fontWeight: 800 }}
                    />
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </Paper>
        ) : null}
      </Box>
    </Paper>
  )

  const mainBlocks = settings.blockOrder
    .map((block) =>
      block === 'creation'
        ? settings.showCreationBlock
          ? renderCreationBlock()
          : null
        : renderStudyMaterialBlock(),
    )
    .filter(Boolean)
  const previewBlock = renderStudyMaterialBlock(false, true)
  const mainDesktopGridTemplate = isSingleBlock
    ? 'minmax(0, 760px)'
    : settings.blockOrder[0] === 'studyMaterial'
      ? 'minmax(300px, 2fr) minmax(0, 3fr)'
      : 'minmax(0, 3fr) minmax(300px, 2fr)'
  const previewDesktopGridTemplate = 'minmax(0, 1fr)'

  return (
    <Box
      sx={{
        height: { xs: '100%', md: 'auto' },
        minHeight: { xs: '100%', md: 'calc(100dvh - 130px)' },
        display: 'flex',
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'center',
        p: { xs: 1, sm: 1.5, md: 2.5 },
        pb: { xs: 1.25, md: 2.5 },
        bgcolor: 'background.default',
        width: '100%',
        maxWidth: '100%',
        overflow: { xs: 'hidden', md: 'visible' },
        boxSizing: 'border-box',
      }}
    >
      <Box
        data-testid="empty-dashboard-card-grid"
        data-max-width="760px"
        data-desktop-grid-template={mainDesktopGridTemplate}
        sx={{
          width: {
            xs: '100%',
            md: 'min(760px, 100%)',
          },
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: mainDesktopGridTemplate,
          },
          justifyContent: isSingleBlock ? 'center' : undefined,
          gap: { xs: 1.25, sm: 1.5, lg: 2 },
          alignItems: 'stretch',
          maxHeight: { xs: '100%', lg: 'none' },
          overflowY: { xs: 'auto', lg: 'visible' },
        }}
      >
        {mainBlocks}
      </Box>
      <Dialog
        fullScreen
        open={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: 'background.default',
          },
        }}
      >
        <Box
          sx={{
            height: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: 48,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="subtitle1" fontWeight={700}>
              Customize empty dashboard
            </Typography>
            <IconButton
              aria-label="Close customize empty dashboard"
              onClick={() => setCustomizerOpen(false)}
              sx={{
                color: 'text.primary',
                bgcolor: 'background.default',
                border: 1,
                borderColor: 'divider',
                width: 36,
                height: 36,
                '&:hover': {
                  bgcolor: 'action.hover',
                  borderColor: 'text.secondary',
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              p: { xs: 1.25, sm: 2, md: 3 },
            }}
          >
            <Box
              sx={{
                width: 'min(1400px, 100%)',
                mx: 'auto',
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  lg: 'minmax(520px, 640px) minmax(0, 1fr)',
                },
                gap: { xs: 1.5, md: 2.5 },
                alignItems: 'start',
              }}
            >
              {customizerControls}
              <Box
                data-testid="empty-dashboard-customizer-preview"
                data-desktop-grid-template={previewDesktopGridTemplate}
                sx={{
                  minWidth: 0,
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    lg: previewDesktopGridTemplate,
                  },
                  gap: { xs: 1.25, sm: 1.5, lg: 2 },
                  alignItems: 'stretch',
                }}
              >
                {previewBlock}
              </Box>
            </Box>
          </Box>
        </Box>
      </Dialog>
    </Box>
  )
}

export default DashboardEmptyState
