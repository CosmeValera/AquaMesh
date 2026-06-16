import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material'
import { useAuth } from '../../auth/AuthProvider'
import { supabase } from '../../auth/supabaseClient'
import { createCloudRepository } from '../../cloud'
import { createSocialRepository, useSocial } from '../../social'
import { StudyGuideStorage } from '../../studyGuides/storage'

interface ShareStudyGuideDialogProps {
  open: boolean
  studyGuideId: string
  onClose: () => void
}

const ShareStudyGuideDialog = ({
  open,
  studyGuideId,
  onClose,
}: ShareStudyGuideDialogProps) => {
  const auth = useAuth()
  const { overview, refresh } = useSocial()
  const socialRepository = useMemo(() => createSocialRepository(supabase), [])
  const cloudRepository = useMemo(() => createCloudRepository(supabase), [])
  const [busyFriendId, setBusyFriendId] = useState('')
  const [error, setError] = useState('')
  const [sentIds, setSentIds] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setError('')
      setSentIds([])
    }
  }, [open])

  const share = async (friendId: string) => {
    const guide = StudyGuideStorage.getById(studyGuideId)
    if (!auth.user || !guide) {
      setError('Study Guide is unavailable.')
      return
    }

    setBusyFriendId(friendId)
    setError('')
    try {
      await cloudRepository.upsertStudyGuide(auth.user.id, guide)
      await socialRepository.shareGuide(friendId, studyGuideId)
      setSentIds((current) => [...current, friendId])
      await refresh()
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Could not share Study Guide.',
      )
    } finally {
      setBusyFriendId('')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Share Study Guide</DialogTitle>
      <DialogContent dividers>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {overview.friends.length ? (
          <List disablePadding>
            {overview.friends.map((friend) => (
              <ListItemButton
                key={friend.userId}
                onClick={() => void share(friend.userId)}
                disabled={
                  Boolean(busyFriendId) || sentIds.includes(friend.userId)
                }
                sx={{ borderRadius: 2 }}
              >
                <ListItemAvatar>
                  <Avatar src={friend.avatarPath}>
                    {friend.displayName.slice(0, 1).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={friend.displayName}
                  secondary={`@${friend.username}`}
                />
                <Button size="small" variant="outlined" component="span">
                  {sentIds.includes(friend.userId)
                    ? 'Shared'
                    : busyFriendId === friend.userId
                      ? 'Sharing...'
                      : 'Share'}
                </Button>
              </ListItemButton>
            ))}
          </List>
        ) : (
          <Typography color="text.secondary">
            Add a friend before sharing a Study Guide.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default ShareStudyGuideDialog
