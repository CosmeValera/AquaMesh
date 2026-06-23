import React from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import {
  getBroadKnowledgeOptions,
  getBroadKnowledgeGroups,
  parseSpecificKnowledgeInput,
  PROFILE_CONTEXT_RECOMMENDED_MAX_TOPICS,
  PROFILE_CONTEXT_RECOMMENDED_MIN_TOPICS,
  ProfileContext,
  saveProfileContext,
  skipProfileContext,
  UserKnowledgeRoleId,
  userKnowledgeRoles,
} from '../../profileContext'

interface KnowledgeContextDialogProps {
  open: boolean
  initialContext?: ProfileContext | null
  surface?: 'onboarding' | 'settings'
  onClose: () => void
}

const KnowledgeContextDialog: React.FC<KnowledgeContextDialogProps> = ({
  open,
  initialContext,
  surface = 'settings',
  onClose,
}) => {
  const [roles, setRoles] = React.useState<UserKnowledgeRoleId[]>([])
  const [broadKnowledge, setBroadKnowledge] = React.useState<string[]>([])
  const [specificKnowledge, setSpecificKnowledge] = React.useState<string[]>([])
  const [specificKnowledgeInput, setSpecificKnowledgeInput] = React.useState('')

  React.useEffect(() => {
    if (!open) {
      return
    }

    setRoles(initialContext?.roles || [])
    setBroadKnowledge(initialContext?.broadKnowledge || [])
    setSpecificKnowledge(initialContext?.specificKnowledge || [])
    setSpecificKnowledgeInput('')
  }, [initialContext, open])

  const selectedCount = broadKnowledge.length + specificKnowledge.length
  const broadGroups = getBroadKnowledgeGroups(roles)
  const broadOptions = getBroadKnowledgeOptions(roles[0] || null)
  const showBroadKnowledge = surface === 'settings' || roles.length > 0
  const showSpecificKnowledge = surface === 'settings'

  const toggleBroadKnowledge = (topic: string) => {
    setBroadKnowledge((current) => {
      if (current.includes(topic)) {
        return current.filter((item) => item !== topic)
      }

      return [...current, topic]
    })
  }

  const toggleRole = (role: UserKnowledgeRoleId) => {
    setRoles((current) =>
      current.includes(role)
        ? current.filter((item) => item !== role)
        : [...current, role],
    )
  }

  const removeKnowledge = (topic: string) => {
    setBroadKnowledge((current) => current.filter((item) => item !== topic))
    setSpecificKnowledge((current) => current.filter((item) => item !== topic))
  }

  const addSpecificKnowledge = () => {
    const [topic] = parseSpecificKnowledgeInput(specificKnowledgeInput)
    if (!topic) {
      return
    }

    setSpecificKnowledge((current) =>
      current.some((item) => item.toLowerCase() === topic.toLowerCase())
        ? current
        : [...current, topic],
    )
    setSpecificKnowledgeInput('')
  }

  const handleSave = () => {
    saveProfileContext({
      roles,
      broadKnowledge: showBroadKnowledge ? broadKnowledge : [],
      specificKnowledge: showSpecificKnowledge ? specificKnowledge : [],
    })
    onClose()
  }

  const handleSkip = () => {
    skipProfileContext()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Personal explanation context</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.25}>
          <Box>
            <Typography fontWeight={750} sx={{ mb: 0.75 }}>
              Help StudyMesh explain things using concepts you already know.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              It is recommended to choose 3-5. You can skip.
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 1 }}>
              What best describes you?
            </Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {userKnowledgeRoles.map((item) => (
                <Chip
                  key={item.id}
                  label={item.label}
                  clickable
                  color={roles.includes(item.id) ? 'primary' : 'default'}
                  variant={roles.includes(item.id) ? 'filled' : 'outlined'}
                  onClick={() => toggleRole(item.id)}
                />
              ))}
            </Stack>
          </Box>

          {showBroadKnowledge ? (
            <>
              <Box>
                <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 1 }}>
                  Knowledge areas
                </Typography>
                <Stack spacing={1.25}>
                  {(broadGroups.length
                    ? broadGroups
                    : [{ role: 'general_curious' as const, label: '', topics: broadOptions }]
                  ).map((group) => (
                    <Stack
                      key={group.role}
                      direction="row"
                      gap={1}
                      flexWrap="wrap"
                      alignItems="center"
                    >
                      {group.label ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={750}
                        >
                          {group.label} |
                        </Typography>
                      ) : null}
                      {group.topics.map((topic) => (
                        <Chip
                          key={`${group.role}-${topic}`}
                          label={topic}
                          clickable
                          variant="outlined"
                          onClick={() => toggleBroadKnowledge(topic)}
                        />
                      ))}
                    </Stack>
                  ))}
                </Stack>
              </Box>

              {showSpecificKnowledge ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                  <TextField
                    label="Add something else you know"
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
                    placeholder="MinIO"
                    fullWidth
                    size="small"
                  />
                  <Button variant="outlined" onClick={addSpecificKnowledge}>
                    Add
                  </Button>
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  {selectedCount} selected. Recommended:{' '}
                  {PROFILE_CONTEXT_RECOMMENDED_MIN_TOPICS}-
                  {PROFILE_CONTEXT_RECOMMENDED_MAX_TOPICS}.
                </Typography>
              )}

              {selectedCount ? (
                <Box>
                  <Typography
                    variant="subtitle2"
                    fontWeight={750}
                    sx={{ mb: 1 }}
                  >
                    Knowledge context
                  </Typography>
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    {[...broadKnowledge, ...specificKnowledge].map((topic) => (
                      <Chip
                        key={topic}
                        label={topic}
                        color="primary"
                        onDelete={() => removeKnowledge(topic)}
                      />
                    ))}
                  </Stack>
                  {showSpecificKnowledge ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 1 }}
                    >
                      {selectedCount} selected. Recommended:{' '}
                      {PROFILE_CONTEXT_RECOMMENDED_MIN_TOPICS}-
                      {PROFILE_CONTEXT_RECOMMENDED_MAX_TOPICS}.
                    </Typography>
                  ) : null}
                </Box>
              ) : null}
            </>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleSkip}>Skip</Button>
        <Button variant="contained" onClick={handleSave}>
          Save context
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default KnowledgeContextDialog
