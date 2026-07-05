import React from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'

import {
  getBroadKnowledgeGroups,
  parseSpecificKnowledgeInput,
  ProfileContext,
  saveProfileContext,
  UserKnowledgeRoleId,
  userKnowledgeRoles,
} from '../../profileContext'

type KnowledgeContextSurface = 'onboarding' | 'settings'

interface KnowledgeContextDialogProps {
  open: boolean
  initialContext?: ProfileContext | null
  surface?: KnowledgeContextSurface
  onClose: () => void
}

interface KnowledgeContextDraft {
  roles: UserKnowledgeRoleId[]
  broadKnowledge: string[]
  specificKnowledge: string[]
}

const getRecommendationText = (surface: KnowledgeContextSurface): string =>
  surface === 'onboarding' ? 'Recommended: 3-5.' : 'Recommended: 5 or more.'

const selectedChipSx = (selected: boolean) =>
  selected
    ? (theme: Theme) => ({
        borderColor: alpha(theme.palette.primary.main, 0.85),
        bgcolor: alpha(theme.palette.primary.main, 0.16),
        color:
          theme.palette.mode === 'dark'
            ? theme.palette.primary.light
            : theme.palette.primary.dark,
        fontWeight: 700,
        '&:hover': {
          bgcolor: alpha(theme.palette.primary.main, 0.24),
        },
        '& .MuiChip-deleteIcon': {
          color: alpha(theme.palette.primary.main, 0.75),
          '&:hover': {
            color: theme.palette.primary.main,
          },
        },
      })
    : undefined

const toTopicKey = (topic: string): string => topic.toLowerCase()

const mergeUniqueTopics = (topics: string[]): string[] => {
  const seen = new Set<string>()
  const next: string[] = []

  topics.forEach((topic) => {
    const key = toTopicKey(topic)
    if (!topic || seen.has(key)) {
      return
    }

    seen.add(key)
    next.push(topic)
  })

  return next
}

const getSelectedKnowledge = (draft: {
  broadKnowledge: string[]
  specificKnowledge: string[]
}): string[] =>
  mergeUniqueTopics([...draft.broadKnowledge, ...draft.specificKnowledge])

const getSelectedKnowledgeCount = (draft: {
  broadKnowledge: string[]
  specificKnowledge: string[]
}): number => getSelectedKnowledge(draft).length

const getNewestSelectedKnowledge = (topics: string[]): string[] => [
  ...topics,
].reverse()

const KnowledgeRolePicker: React.FC<{
  roles: UserKnowledgeRoleId[]
  onToggleRole: (role: UserKnowledgeRoleId) => void
}> = ({ roles, onToggleRole }) => (
  <Box>
    <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 1 }}>
      Optional: show suggestions for a study/work area
    </Typography>
    <Stack direction="row" gap={1} flexWrap="wrap">
      {userKnowledgeRoles.map((item) => {
        const selected = roles.includes(item.id)
        return (
          <Chip
            key={item.id}
            label={item.label}
            clickable
            color={selected ? 'primary' : 'default'}
            variant={selected ? 'filled' : 'outlined'}
            sx={selectedChipSx(selected)}
            onClick={() => onToggleRole(item.id)}
          />
        )
      })}
    </Stack>
  </Box>
)

const KnowledgeAreaGroups: React.FC<{
  roles: UserKnowledgeRoleId[]
  broadKnowledge: string[]
  onToggleBroadKnowledge: (topic: string) => void
}> = ({ roles, broadKnowledge, onToggleBroadKnowledge }) => {
  const groups = getBroadKnowledgeGroups(roles)

  if (!groups.length) {
    return null
  }

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 1 }}>
        Suggested familiar areas
      </Typography>
      <Stack spacing={1.75}>
        {groups.map((group) => (
          <Box key={group.role}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={800}
              sx={{
                display: 'block',
                mb: 0.75,
                textTransform: 'uppercase',
                letterSpacing: 0,
              }}
            >
              {group.label}
            </Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {group.topics.map((topic) => {
                const selected = broadKnowledge.includes(topic)
                return (
                  <Chip
                    key={`${group.role}-${topic}`}
                    label={topic}
                    clickable
                    color={selected ? 'primary' : 'default'}
                    variant={selected ? 'filled' : 'outlined'}
                    sx={selectedChipSx(selected)}
                    onClick={() => onToggleBroadKnowledge(topic)}
                  />
                )
              })}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}

const KnowledgeContextForm: React.FC<{
  surface: KnowledgeContextSurface
  initialContext?: ProfileContext | null
  onSelectedCountChange: (count: number) => void
}> = ({ surface, initialContext, onSelectedCountChange }) => {
  const [roles, setRoles] = React.useState<UserKnowledgeRoleId[]>([])
  const [broadKnowledge, setBroadKnowledge] = React.useState<string[]>([])
  const [specificKnowledge, setSpecificKnowledge] = React.useState<string[]>([])
  const [specificKnowledgeInput, setSpecificKnowledgeInput] = React.useState('')

  React.useEffect(() => {
    const nextBroadKnowledge = initialContext?.broadKnowledge || []
    const nextSpecificKnowledge = initialContext?.specificKnowledge || []

    setRoles(initialContext?.roles || [])
    setBroadKnowledge(nextBroadKnowledge)
    setSpecificKnowledge(nextSpecificKnowledge)
    setSpecificKnowledgeInput('')
    onSelectedCountChange(
      getSelectedKnowledgeCount({
        broadKnowledge: nextBroadKnowledge,
        specificKnowledge: nextSpecificKnowledge,
      }),
    )
  }, [initialContext, onSelectedCountChange])

  const selectedKnowledge = getSelectedKnowledge({
    broadKnowledge,
    specificKnowledge,
  })
  const newestSelectedKnowledge = getNewestSelectedKnowledge(selectedKnowledge)
  const selectedCount = selectedKnowledge.length
  const recommendationText = getRecommendationText(surface)

  const persist = React.useCallback(
    (draft: KnowledgeContextDraft) => {
      saveProfileContext({
        roles: draft.roles,
        broadKnowledge: draft.broadKnowledge,
        specificKnowledge: draft.specificKnowledge,
      })
    },
    [],
  )

  const updateDraft = React.useCallback(
    (createNext: (current: KnowledgeContextDraft) => KnowledgeContextDraft) => {
      const current = { roles, broadKnowledge, specificKnowledge }
      const next = createNext(current)

      setRoles(next.roles)
      setBroadKnowledge(next.broadKnowledge)
      setSpecificKnowledge(next.specificKnowledge)
      onSelectedCountChange(getSelectedKnowledgeCount(next))
      persist(next)
    },
    [broadKnowledge, onSelectedCountChange, persist, roles, specificKnowledge],
  )

  const toggleBroadKnowledge = (topic: string) => {
    updateDraft((current) => ({
      ...current,
      broadKnowledge: current.broadKnowledge.includes(topic)
        ? current.broadKnowledge.filter((item) => item !== topic)
        : [...current.broadKnowledge, topic],
    }))
  }

  const toggleRole = (role: UserKnowledgeRoleId) => {
    updateDraft((current) => {
      const nextRoles = current.roles.includes(role)
        ? current.roles.filter((item) => item !== role)
        : [...current.roles, role]

      return {
        ...current,
        roles: nextRoles,
      }
    })
  }

  const removeKnowledge = (topic: string) => {
    updateDraft((current) => ({
      ...current,
      broadKnowledge: current.broadKnowledge.filter((item) => item !== topic),
      specificKnowledge: current.specificKnowledge.filter(
        (item) => item !== topic,
      ),
    }))
  }

  const addSpecificKnowledge = () => {
    const topics = parseSpecificKnowledgeInput(specificKnowledgeInput)
    if (!topics.length) {
      return
    }

    updateDraft((current) => ({
      ...current,
      specificKnowledge: mergeUniqueTopics([
        ...current.specificKnowledge,
        ...topics,
      ]),
    }))
    setSpecificKnowledgeInput('')
  }

  return (
    <Stack spacing={2.25}>
      <Paper
        elevation={0}
        sx={(theme) => ({
          p: 2,
          border: 1,
          borderColor: alpha(theme.palette.primary.main, 0.2),
          background:
            theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.28)} 0%, ${alpha(theme.palette.secondary.main, 0.18)} 48%, ${alpha(theme.palette.background.paper, 0.86)} 100%)`
              : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.32)} 0%, ${alpha(theme.palette.secondary.light, 0.22)} 52%, ${alpha(theme.palette.background.paper, 0.94)} 100%)`,
        })}
      >
        <Typography fontWeight={800} sx={{ mb: 0.75 }}>
          Help StudyMesh explain new topics using things you already understand.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Add a few examples that are relevant to the Study Guides you create.
          These can be school subjects, tools, languages, places, hobbies,
          books, sports, or daily routines. StudyMesh only uses them when they
          make an explanation easier.
        </Typography>
      </Paper>

      <Stack spacing={1}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <TextField
            label="Helpful things you know"
            helperText="Use commas or Enter. Examples: Valencian, Docker, anatomy, football, LEGO."
            value={specificKnowledgeInput}
            onChange={(event) =>
              setSpecificKnowledgeInput(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addSpecificKnowledge()
              }
            }}
            placeholder="Valencian, Docker, anatomy, football..."
            fullWidth
            size="small"
          />
          <Button
            variant="outlined"
            onClick={addSpecificKnowledge}
            sx={{ minWidth: { sm: 88 }, alignSelf: { sm: 'flex-start' } }}
          >
            Add
          </Button>
        </Stack>
      </Stack>

      {selectedCount ? (
        <Box>
          <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 1 }}>
            Your context
          </Typography>
          <Stack direction="row" gap={1} flexWrap="wrap">
            {newestSelectedKnowledge.map((topic) => (
              <Chip
                key={topic}
                label={topic}
                color="primary"
                variant="filled"
                sx={selectedChipSx(true)}
                onDelete={() => removeKnowledge(topic)}
              />
            ))}
          </Stack>
        </Box>
      ) : null}

      <KnowledgeRolePicker roles={roles} onToggleRole={toggleRole} />

      <KnowledgeAreaGroups
        roles={roles}
        broadKnowledge={broadKnowledge}
        onToggleBroadKnowledge={toggleBroadKnowledge}
      />

      <Typography variant="caption" color="text.secondary">
        {selectedCount} selected. {recommendationText}
      </Typography>
    </Stack>
  )
}

const KnowledgeContextDialog: React.FC<KnowledgeContextDialogProps> = ({
  open,
  initialContext,
  surface = 'settings',
  onClose,
}) => {
  const [selectedCount, setSelectedCount] = React.useState(0)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Personal explanation context</DialogTitle>
      <DialogContent dividers>
        <KnowledgeContextForm
          surface={surface}
          initialContext={initialContext}
          onSelectedCountChange={setSelectedCount}
        />
      </DialogContent>
      <DialogActions>
        {surface === 'onboarding' ? (
          <Button onClick={onClose}>Skip</Button>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )}
        <Button
          variant="contained"
          onClick={onClose}
          disabled={selectedCount === 0}
        >
          Accept
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export const KnowledgeContextOnboardingDialog: React.FC<
  Omit<KnowledgeContextDialogProps, 'surface'>
> = (props) => <KnowledgeContextDialog {...props} surface="onboarding" />

export const KnowledgeContextSettingsDialog: React.FC<
  Omit<KnowledgeContextDialogProps, 'surface'>
> = (props) => <KnowledgeContextDialog {...props} surface="settings" />

export default KnowledgeContextDialog
