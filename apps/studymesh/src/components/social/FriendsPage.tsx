import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import BlockIcon from '@mui/icons-material/Block'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import SendIcon from '@mui/icons-material/Send'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { supabase } from '../../auth/supabaseClient'
import type { StudyGuideRecord } from '../../cloud/types'
import { createCloudRepository } from '../../cloud'
import {
  createSocialRepository,
  type DirectMessage,
  type SocialProfile,
  useSocial,
} from '../../social'
import TopNavBar from '../topnavbar/TopNavBar'
import {
  STUDY_GUIDES_CHANGED_EVENT,
  StudyGuideStorage,
} from '../../studyGuides/storage'

const isOnline = (profile: SocialProfile) =>
  Boolean(
    profile.lastActiveAt &&
      Date.now() - Date.parse(profile.lastActiveAt) < 2 * 60 * 1000,
  )

const notificationText = (type: string, actor?: SocialProfile) => {
  const name = actor?.displayName || 'Someone'
  if (type === 'friend_request') {
    return `${name} sent you a friend request.`
  }
  if (type === 'friend_accepted') {
    return `${name} accepted your friend request. You are now friends.`
  }
  if (type === 'guide_shared') {
    return `${name} shared a Study Guide with you.`
  }
  return `${name} updated something in Friends.`
}

const ProfileForm = ({ onSaved }: { onSaved: () => Promise<void> }) => {
  const auth = useAuth()
  const { overview } = useSocial()
  const repository = useMemo(() => createSocialRepository(supabase), [])
  const [username, setUsername] = useState(overview.profile?.username || '')
  const [displayName, setDisplayName] = useState(
    overview.profile?.displayName ||
      String(auth.user?.user_metadata?.display_name || auth.user?.email || ''),
  )
  const [avatarPath, setAvatarPath] = useState(
    overview.profile?.avatarPath || '',
  )
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setUsername(overview.profile?.username || '')
    setDisplayName(
      overview.profile?.displayName ||
        String(
          auth.user?.user_metadata?.display_name || auth.user?.email || '',
        ),
    )
    setAvatarPath(overview.profile?.avatarPath || '')
  }, [auth.user, overview.profile])

  const uploadAvatar = async (file?: File) => {
    if (!file || !auth.user) {
      return
    }
    setBusy(true)
    setStatus('')
    try {
      const path = `${auth.user.id}/avatar-${Date.now()}`
      const { error } = await supabase.storage
        .from('social-avatars')
        .upload(path, file, { upsert: true })
      if (error) {
        throw new Error(error.message)
      }
      const { data } = supabase.storage
        .from('social-avatars')
        .getPublicUrl(path)
      setAvatarPath(data.publicUrl)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    setBusy(true)
    setStatus('')
    try {
      await repository.saveProfile({ username, displayName, avatarPath })
      await onSaved()
      setStatus('Profile saved.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6" fontWeight={900}>
          {overview.profile ? 'Your profile' : 'Create Friends profile'}
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar src={avatarPath} sx={{ width: 72, height: 72 }}>
            {displayName.slice(0, 1).toUpperCase()}
          </Avatar>
          <Button component="label" variant="outlined" disabled={busy}>
            Upload avatar
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => void uploadAvatar(event.target.files?.[0])}
            />
          </Button>
        </Stack>
        <TextField
          label="Username"
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
          helperText="3-24 lowercase letters, numbers, or underscores."
        />
        <TextField
          label="Display name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        {status ? (
          <Alert severity={status.includes('saved') ? 'success' : 'error'}>
            {status}
          </Alert>
        ) : null}
        <Button
          variant="contained"
          onClick={() => void save()}
          disabled={busy || !username.trim() || !displayName.trim()}
        >
          {busy ? 'Saving...' : 'Save profile'}
        </Button>
      </Stack>
    </Paper>
  )
}

const FriendsPage = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const navigate = useNavigate()
  const location = useLocation()
  const { friendId, inviteToken } = useParams()
  const { overview, loading, error, refresh } = useSocial()
  const repository = useMemo(() => createSocialRepository(supabase), [])
  const cloudRepository = useMemo(() => createCloudRepository(supabase), [])
  const auth = useAuth()
  const [tab, setTab] = useState('inbox')
  const [search, setSearch] = useState('')
  const [searchResult, setSearchResult] = useState<SocialProfile | null>(null)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [messageDraft, setMessageDraft] = useState('')
  const [guidePickerOpen, setGuidePickerOpen] = useState(false)
  const [guideSearch, setGuideSearch] = useState('')
  const [availableGuides, setAvailableGuides] = useState<StudyGuideRecord[]>([])
  const [blocked, setBlocked] = useState<SocialProfile[]>([])
  const activeFriend = overview.friends.find(
    (friend) => friend.userId === friendId,
  )
  const pendingSharesFromActiveFriend = activeFriend
    ? overview.guideShares.filter(
        (share) => share.senderId === activeFriend.userId,
      )
    : []
  const filteredGuides = availableGuides.filter((guide) => {
    const query = guideSearch.trim().toLowerCase()
    if (!query) {
      return true
    }
    return [guide.title, guide.folderName, guide.studyPath.title]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query))
  })
  const returnTo =
    typeof location.state === 'object' &&
    location.state &&
    'returnTo' in location.state &&
    typeof location.state.returnTo === 'string'
      ? location.state.returnTo
      : '/study-guides'

  const run = async (action: () => Promise<unknown>) => {
    setActionError('')
    setActionMessage('')
    try {
      await action()
      await refresh()
    } catch (nextError) {
      setActionError(
        nextError instanceof Error ? nextError.message : 'Action failed.',
      )
    }
  }

  const goBackToStudy = () => {
    navigate(returnTo, { replace: true })
  }

  useEffect(() => {
    if (inviteToken && overview.profile) {
      void run(() => repository.acceptInvite(inviteToken))
      navigate('/friends', { replace: true, state: { returnTo } })
    }
  }, [inviteToken, overview.profile, returnTo])

  useEffect(() => {
    if (!friendId || !activeFriend) {
      setMessages([])
      setGuidePickerOpen(false)
      return
    }
    void repository
      .listMessages(friendId)
      .then(setMessages)
      .catch(() => undefined)
    void repository
      .markMessagesRead(friendId)
      .then(refresh)
      .catch(() => undefined)
  }, [activeFriend, friendId, overview.unreadMessages])

  useEffect(() => {
    const loadGuides = () => setAvailableGuides(StudyGuideStorage.getAll())
    loadGuides()
    window.addEventListener(STUDY_GUIDES_CHANGED_EVENT, loadGuides)
    window.addEventListener('storage', loadGuides)

    return () => {
      window.removeEventListener(STUDY_GUIDES_CHANGED_EVENT, loadGuides)
      window.removeEventListener('storage', loadGuides)
    }
  }, [])

  const searchUser = () =>
    void run(async () => {
      setSearchResult(await repository.findExactUsername(search))
    })

  const sendFriendRequest = (userId: string) =>
    void run(async () => {
      await repository.sendFriendRequest(userId)
      setActionMessage(
        'Friend request sent. They will appear in Friends after they accept.',
      )
      setSearchResult(null)
    })

  const respondToFriendRequest = (friendshipId: string, accept: boolean) =>
    void run(async () => {
      await repository.respondToFriendRequest(friendshipId, accept)
      setActionMessage(
        accept ? 'Friend request accepted.' : 'Friend request declined.',
      )
    })

  const createInvite = () =>
    void run(async () => {
      const token = await repository.createInvite()
      const link = `${window.location.origin}/friends/invite/${token}`
      setInviteLink(link)
      await navigator.clipboard?.writeText(link)
    })

  const sendMessage = () =>
    void run(async () => {
      if (!friendId || !messageDraft.trim()) {
        return
      }
      await repository.sendMessage(friendId, messageDraft)
      setMessageDraft('')
      setMessages(await repository.listMessages(friendId))
    })

  const shareGuideInChat = (guide: StudyGuideRecord) =>
    void run(async () => {
      if (!auth.user || !activeFriend) {
        return
      }
      await cloudRepository.upsertStudyGuide(auth.user.id, guide)
      await repository.shareGuide(activeFriend.userId, guide.id)
      await repository.sendMessage(
        activeFriend.userId,
        `Shared Study Guide: ${guide.title}`,
      )
      setMessages(await repository.listMessages(activeFriend.userId))
      setGuidePickerOpen(false)
      setGuideSearch('')
      setActionMessage(
        `Shared "${guide.title}" with ${activeFriend.displayName}.`,
      )
    })

  const respondToGuideShare = (shareId: string, accept: boolean) =>
    void run(async () => {
      await repository.respondToGuideShare(shareId, accept)
      if (accept && auth.user) {
        const guides = await cloudRepository.listStudyGuides(auth.user.id)
        guides.forEach((guide) => StudyGuideStorage.save(guide))
      }
      setActionMessage(
        accept ? 'Study Guide copy added.' : 'Study Guide share declined.',
      )
    })

  if (loading && !overview.profile) {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <TopNavBar creationHost="external" />
      <Box
        component="main"
        sx={{ maxWidth: 1180, mx: 'auto', p: { xs: 2, md: 4 } }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h4" fontWeight={950}>
              Friends
            </Typography>
            <Typography color="text.secondary">
              Message friends and share Study Guides.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="outlined" onClick={goBackToStudy}>
              Back to study
            </Button>
            {overview.profile ? (
              <Button
                variant="outlined"
                startIcon={<ContentCopyIcon />}
                onClick={createInvite}
              >
                Copy friend invite
              </Button>
            ) : null}
          </Stack>
        </Stack>
        {inviteLink ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            Invite copied: {inviteLink}
          </Alert>
        ) : null}
        {actionMessage ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            {actionMessage}
          </Alert>
        ) : null}
        {error || actionError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {actionError || error}
          </Alert>
        ) : null}

        {!overview.profile ? (
          <ProfileForm onSaved={refresh} />
        ) : activeFriend ? (
          <Paper
            variant="outlined"
            sx={{ borderRadius: 3, overflow: 'hidden' }}
          >
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}
            >
              <Button
                onClick={() => navigate('/friends', { state: { returnTo } })}
              >
                Back
              </Button>
              <Avatar src={activeFriend.avatarPath} />
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={900}>
                  {activeFriend.displayName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  @{activeFriend.username} ·{' '}
                  {isOnline(activeFriend) ? 'Online' : 'Offline'}
                </Typography>
              </Box>
              <IconButton
                aria-label={`Block ${activeFriend.displayName}`}
                onClick={() =>
                  void run(async () => {
                    await repository.blockUser(activeFriend.userId)
                    navigate('/friends', { state: { returnTo } })
                  })
                }
                sx={{
                  color: 'error.main',
                  border: 1,
                  borderColor: 'error.main',
                }}
              >
                <BlockIcon />
              </IconButton>
            </Stack>
            <Stack
              spacing={1}
              sx={{
                p: 2,
                minHeight: 440,
                maxHeight: '60dvh',
                overflowY: 'auto',
              }}
            >
              {messages.map((message) => (
                <Box
                  key={message.id}
                  sx={{
                    alignSelf:
                      message.senderId === overview.profile?.userId
                        ? 'flex-end'
                        : 'flex-start',
                    maxWidth: '75%',
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor:
                      message.senderId === overview.profile?.userId
                        ? 'primary.main'
                        : 'action.hover',
                    color:
                      message.senderId === overview.profile?.userId
                        ? 'primary.contrastText'
                        : 'text.primary',
                  }}
                >
                  {message.body}
                </Box>
              ))}
              {pendingSharesFromActiveFriend.map((share) => (
                <Paper
                  key={share.id}
                  variant="outlined"
                  sx={{
                    alignSelf: 'flex-start',
                    maxWidth: '85%',
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Shared Study Guide
                  </Typography>
                  <Typography fontWeight={900}>
                    {share.emoji || '✨'} {share.title}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button
                      size="small"
                      onClick={() => respondToGuideShare(share.id, false)}
                    >
                      Decline
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => respondToGuideShare(share.id, true)}
                    >
                      Add copy
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Stack>
            {guidePickerOpen ? (
              <Paper
                variant="outlined"
                sx={{
                  mx: 2,
                  mb: 1,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                }}
              >
                <TextField
                  fullWidth
                  size="small"
                  label="Filter Study Guides"
                  value={guideSearch}
                  onChange={(event) => setGuideSearch(event.target.value)}
                  sx={{ mb: 1 }}
                />
                <List
                  dense
                  disablePadding
                  sx={{ maxHeight: 220, overflowY: 'auto' }}
                >
                  {filteredGuides.map((guide) => (
                    <ListItemButton
                      key={guide.id}
                      onClick={() => shareGuideInChat(guide)}
                      sx={{ borderRadius: 1.5 }}
                    >
                      <ListItemText
                        primary={`${guide.emoji || '✨'} ${guide.title}`}
                        secondary={guide.studyPath.dashboards
                          .map((dashboard) => dashboard.name)
                          .slice(0, 3)
                          .join(' • ')}
                      />
                    </ListItemButton>
                  ))}
                  {!filteredGuides.length ? (
                    <Typography color="text.secondary" sx={{ px: 1, py: 1 }}>
                      No matching Study Guides.
                    </Typography>
                  ) : null}
                </List>
              </Paper>
            ) : null}
            <Stack
              direction="row"
              spacing={1}
              sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}
            >
              {isMobile ? (
                <IconButton
                  aria-label="Share Study Guide"
                  onClick={() => setGuidePickerOpen((current) => !current)}
                  sx={{
                    color: 'primary.main',
                    border: 1,
                    borderColor: 'primary.main',
                  }}
                >
                  <AddIcon />
                </IconButton>
              ) : (
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setGuidePickerOpen((current) => !current)}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Share Study Guide
                </Button>
              )}
              <TextField
                fullWidth
                size="small"
                placeholder="Message..."
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') sendMessage()
                }}
              />
              <IconButton
                aria-label="Send message"
                onClick={sendMessage}
                sx={{
                  color: 'primary.contrastText',
                  bgcolor: 'primary.main',
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                <SendIcon />
              </IconButton>
            </Stack>
          </Paper>
        ) : (
          <Paper
            variant="outlined"
            sx={{ borderRadius: 3, overflow: 'hidden' }}
          >
            <Tabs
              value={tab}
              onChange={(_event, value) => setTab(value)}
              variant={isMobile ? 'scrollable' : 'standard'}
            >
              <Tab
                value="inbox"
                label={
                  <Badge
                    color="error"
                    badgeContent={
                      overview.incomingRequests.length +
                      overview.guideShares.length +
                      overview.notifications.filter(
                        (notification) => !notification.readAt,
                      ).length
                    }
                  >
                    Inbox
                  </Badge>
                }
              />
              <Tab value="friends" label="Friends" />
              <Tab value="find" label="Add friend" />
              <Tab value="profile" label="Profile" />
            </Tabs>
            <Divider />
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              {tab === 'inbox' ? (
                <Stack spacing={3}>
                  {overview.incomingRequests.length ? (
                    <Box>
                      <Typography variant="h6" fontWeight={900}>
                        Friend requests
                      </Typography>
                      <List>
                        {overview.incomingRequests.map((request) => (
                          <ListItem
                            key={request.id}
                            secondaryAction={
                              <Stack direction="row" spacing={1}>
                                <Button
                                  onClick={() =>
                                    respondToFriendRequest(request.id, false)
                                  }
                                >
                                  Decline
                                </Button>
                                <Button
                                  variant="contained"
                                  onClick={() =>
                                    respondToFriendRequest(request.id, true)
                                  }
                                >
                                  Accept
                                </Button>
                              </Stack>
                            }
                          >
                            <ListItemAvatar>
                              <Avatar src={request.friend?.avatarPath} />
                            </ListItemAvatar>
                            <ListItemText
                              primary={request.friend?.displayName || 'Student'}
                              secondary={`@${request.friend?.username || ''}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  ) : null}
                  {overview.outgoingRequests.length ? (
                    <Box>
                      <Typography variant="h6" fontWeight={900}>
                        Sent requests
                      </Typography>
                      <List>
                        {overview.outgoingRequests.map((request) => (
                          <ListItem key={request.id}>
                            <ListItemAvatar>
                              <Avatar src={request.friend?.avatarPath} />
                            </ListItemAvatar>
                            <ListItemText
                              primary={request.friend?.displayName || 'Student'}
                              secondary={`Waiting for @${request.friend?.username || 'student'} to accept`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  ) : null}
                  {overview.guideShares.length ? (
                    <Box>
                      <Typography variant="h6" fontWeight={900}>
                        Shared Study Guides
                      </Typography>
                      <List>
                        {overview.guideShares.map((share) => (
                          <ListItem
                            key={share.id}
                            secondaryAction={
                              <Stack direction="row" spacing={1}>
                                <Button
                                  onClick={() =>
                                    void run(() =>
                                      repository.respondToGuideShare(
                                        share.id,
                                        false,
                                      ),
                                    )
                                  }
                                >
                                  Decline
                                </Button>
                                <Button
                                  variant="contained"
                                  onClick={() =>
                                    void run(async () => {
                                      await repository.respondToGuideShare(
                                        share.id,
                                        true,
                                      )
                                      if (auth.user) {
                                        const guides =
                                          await cloudRepository.listStudyGuides(
                                            auth.user.id,
                                          )
                                        guides.forEach((guide) =>
                                          StudyGuideStorage.save(guide),
                                        )
                                      }
                                    })
                                  }
                                >
                                  Add copy
                                </Button>
                              </Stack>
                            }
                          >
                            <ListItemText
                              primary={`${share.emoji || '✨'} ${share.title}`}
                              secondary={`Shared by ${share.sender?.displayName || 'friend'}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  ) : null}
                  {overview.notifications.length ? (
                    <Box>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Typography variant="h6" fontWeight={900}>
                          History
                        </Typography>
                        {overview.notifications.some(
                          (notification) => !notification.readAt,
                        ) ? (
                          <Button
                            size="small"
                            onClick={() =>
                              void run(() => repository.markNotificationsRead())
                            }
                          >
                            Mark read
                          </Button>
                        ) : null}
                      </Stack>
                      <List>
                        {overview.notifications.map((notification) => (
                          <ListItem key={notification.id}>
                            <ListItemAvatar>
                              <Badge
                                color="error"
                                variant="dot"
                                invisible={Boolean(notification.readAt)}
                              >
                                <Avatar src={notification.actor?.avatarPath} />
                              </Badge>
                            </ListItemAvatar>
                            <ListItemText
                              primary={notificationText(
                                notification.type,
                                notification.actor,
                              )}
                              secondary={new Date(
                                notification.createdAt,
                              ).toLocaleString()}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  ) : null}
                  {!overview.incomingRequests.length &&
                  !overview.outgoingRequests.length &&
                  !overview.guideShares.length &&
                  !overview.notifications.length ? (
                    <Typography color="text.secondary">
                      No Friends inbox activity yet.
                    </Typography>
                  ) : null}
                </Stack>
              ) : null}
              {tab === 'friends' ? (
                <List>
                  {overview.friends.map((friend) => (
                    <ListItemButton
                      key={friend.userId}
                      onClick={() =>
                        navigate(`/friends/chat/${friend.userId}`, {
                          state: { returnTo },
                        })
                      }
                      sx={{ borderRadius: 2 }}
                    >
                      <ListItemAvatar>
                        <Badge
                          overlap="circular"
                          variant="dot"
                          color={isOnline(friend) ? 'success' : 'default'}
                        >
                          <Avatar src={friend.avatarPath} />
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={friend.displayName}
                        secondary={`@${friend.username} · ${isOnline(friend) ? 'Online' : 'Offline'}`}
                      />
                    </ListItemButton>
                  ))}
                  {!overview.friends.length ? (
                    <Typography color="text.secondary">
                      No friends yet.
                    </Typography>
                  ) : null}
                </List>
              ) : null}
              {tab === 'find' ? (
                <Stack spacing={2}>
                  <Typography variant="h6" fontWeight={900}>
                    Find exact username
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      fullWidth
                      label="Username"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    <Button
                      variant="contained"
                      startIcon={<PersonAddIcon />}
                      onClick={searchUser}
                    >
                      Find
                    </Button>
                  </Stack>
                  {searchResult ? (
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar src={searchResult.avatarPath} />
                        <Box sx={{ flex: 1 }}>
                          <Typography fontWeight={900}>
                            {searchResult.displayName}
                          </Typography>
                          <Typography color="text.secondary">
                            @{searchResult.username}
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          onClick={() => sendFriendRequest(searchResult.userId)}
                        >
                          Add friend
                        </Button>
                      </Stack>
                    </Paper>
                  ) : null}
                </Stack>
              ) : null}
              {tab === 'profile' ? (
                <Stack spacing={3}>
                  <ProfileForm onSaved={refresh} />
                  <Button
                    variant="outlined"
                    onClick={() =>
                      void repository.listBlocked().then(setBlocked)
                    }
                  >
                    Manage blocked users
                  </Button>
                  {blocked.map((profile) => (
                    <Chip
                      key={profile.userId}
                      label={`@${profile.username}`}
                      onDelete={() =>
                        void run(() => repository.unblockUser(profile.userId))
                      }
                    />
                  ))}
                </Stack>
              ) : null}
            </Box>
          </Paper>
        )}
      </Box>
    </Box>
  )
}

export default FriendsPage
