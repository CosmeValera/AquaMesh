import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DirectMessage,
  Friendship,
  GuideShare,
  SocialNotification,
  SocialOverview,
  SocialProfile,
} from './types'

const throwOnError = (error?: { message?: string } | null) => {
  if (error?.message) {
    throw new Error(error.message)
  }
}

const profileFromRow = (row: Record<string, unknown>): SocialProfile => ({
  userId: String(row.user_id || ''),
  username: String(row.username || ''),
  displayName: String(row.display_name || row.username || 'Student'),
  avatarPath:
    typeof row.avatar_path === 'string' ? row.avatar_path : undefined,
  lastActiveAt:
    typeof row.last_active_at === 'string' ? row.last_active_at : undefined,
})

const friendshipFromRow = (row: Record<string, unknown>): Friendship => ({
  id: String(row.id),
  requesterId: String(row.requester_id),
  addresseeId: String(row.addressee_id),
  status: row.status === 'accepted' ? 'accepted' : 'pending',
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
})

const messageFromRow = (row: Record<string, unknown>): DirectMessage => ({
  id: String(row.id),
  senderId: String(row.sender_id),
  recipientId: String(row.recipient_id),
  body: String(row.body || ''),
  createdAt: String(row.created_at),
  readAt: typeof row.read_at === 'string' ? row.read_at : undefined,
})

const shareFromRow = (row: Record<string, unknown>): GuideShare => ({
  id: String(row.id),
  senderId: String(row.sender_id),
  recipientId: String(row.recipient_id),
  sourceGuideId: String(row.source_guide_id),
  title: String(row.title || 'Study Guide'),
  description:
    typeof row.description === 'string' ? row.description : undefined,
  emoji: typeof row.emoji === 'string' ? row.emoji : undefined,
  guideSnapshot: row.guide_snapshot as GuideShare['guideSnapshot'],
  status:
    row.status === 'accepted' || row.status === 'declined'
      ? row.status
      : 'pending',
  createdAt: String(row.created_at),
  respondedAt:
    typeof row.responded_at === 'string' ? row.responded_at : undefined,
})

const notificationFromRow = (
  row: Record<string, unknown>,
): SocialNotification => ({
  id: String(row.id),
  actorId: typeof row.actor_id === 'string' ? row.actor_id : undefined,
  type: row.type as SocialNotification['type'],
  entityId: typeof row.entity_id === 'string' ? row.entity_id : undefined,
  createdAt: String(row.created_at),
  readAt: typeof row.read_at === 'string' ? row.read_at : undefined,
})

const attachProfiles = <T extends { actorId?: string; friend?: SocialProfile }>(
  items: T[],
  profiles: Map<string, SocialProfile>,
) =>
  items.map((item) => ({
    ...item,
    actor: item.actorId ? profiles.get(item.actorId) : undefined,
  }))

export const createSocialRepository = (client: SupabaseClient) => ({
  async getOwnProfile(): Promise<SocialProfile | null> {
    const userId = (await client.auth.getUser()).data.user?.id
    if (!userId) {
      return null
    }
    const { data, error } = await client
      .from('social_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    throwOnError(error)
    return data ? profileFromRow(data) : null
  },

  async saveProfile(input: {
    username: string
    displayName: string
    avatarPath?: string
  }): Promise<SocialProfile> {
    const { data, error } = await client.rpc('social_upsert_profile', {
      p_username: input.username,
      p_display_name: input.displayName,
      p_avatar_path: input.avatarPath || null,
    })
    throwOnError(error)
    return profileFromRow(data as Record<string, unknown>)
  },

  async touchPresence(): Promise<void> {
    const { error } = await client.rpc('social_touch_presence')
    throwOnError(error)
  },

  async findExactUsername(username: string): Promise<SocialProfile | null> {
    const { data, error } = await client.rpc('social_find_exact_username', {
      p_username: username,
    })
    throwOnError(error)
    const row = Array.isArray(data) ? data[0] : data
    return row ? profileFromRow(row as Record<string, unknown>) : null
  },

  async createInvite(): Promise<string> {
    const { data, error } = await client.rpc('social_create_invite')
    throwOnError(error)
    return String(data || '')
  },

  async acceptInvite(token: string): Promise<void> {
    const { error } = await client.rpc('social_accept_invite', {
      p_token: token,
    })
    throwOnError(error)
  },

  async sendFriendRequest(userId: string): Promise<void> {
    const { error } = await client.rpc('social_send_friend_request', {
      p_addressee_id: userId,
    })
    throwOnError(error)
  },

  async respondToFriendRequest(
    friendshipId: string,
    accept: boolean,
  ): Promise<void> {
    const { error } = await client.rpc('social_respond_friend_request', {
      p_friendship_id: friendshipId,
      p_accept: accept,
    })
    throwOnError(error)
  },

  async removeFriend(userId: string): Promise<void> {
    const { error } = await client.rpc('social_remove_friend', {
      p_user_id: userId,
    })
    throwOnError(error)
  },

  async blockUser(userId: string): Promise<void> {
    const { error } = await client.rpc('social_block_user', {
      p_user_id: userId,
    })
    throwOnError(error)
  },

  async unblockUser(userId: string): Promise<void> {
    const { error } = await client
      .from('social_blocks')
      .delete()
      .eq('blocked_id', userId)
    throwOnError(error)
  },

  async listBlocked(): Promise<SocialProfile[]> {
    const { data, error } = await client.rpc('social_list_blocked')
    throwOnError(error)
    return (data || []).map((row: Record<string, unknown>) =>
      profileFromRow(row),
    )
  },

  async listMessages(friendId: string): Promise<DirectMessage[]> {
    const { data, error } = await client.rpc('social_list_messages', {
      p_friend_id: friendId,
    })
    throwOnError(error)
    return (data || []).map((row: Record<string, unknown>) =>
      messageFromRow(row),
    )
  },

  async sendMessage(friendId: string, body: string): Promise<void> {
    const { error } = await client.rpc('social_send_message', {
      p_recipient_id: friendId,
      p_body: body,
    })
    throwOnError(error)
  },

  async markMessagesRead(friendId: string): Promise<void> {
    const { error } = await client.rpc('social_mark_messages_read', {
      p_friend_id: friendId,
    })
    throwOnError(error)
  },

  async shareGuide(recipientId: string, sourceGuideId: string): Promise<void> {
    const { error } = await client.rpc('social_share_study_guide', {
      p_recipient_id: recipientId,
      p_source_guide_id: sourceGuideId,
    })
    throwOnError(error)
  },

  async respondToGuideShare(shareId: string, accept: boolean): Promise<void> {
    const { error } = await client.rpc('social_respond_guide_share', {
      p_share_id: shareId,
      p_accept: accept,
    })
    throwOnError(error)
  },

  async markNotificationsRead(): Promise<void> {
    const { error } = await client.rpc('social_mark_notifications_read')
    throwOnError(error)
  },

  async loadOverview(): Promise<SocialOverview> {
    const currentUserId = (await client.auth.getUser()).data.user?.id || ''
    const [profileResult, friendshipsResult, sharesResult, notificationsResult] =
      await Promise.all([
        client
          .from('social_profiles')
          .select('*')
          .eq('user_id', currentUserId)
          .maybeSingle(),
        client
          .from('social_friendships')
          .select('*')
          .order('updated_at', { ascending: false }),
        client
          .from('social_guide_shares')
          .select('*')
          .eq('recipient_id', currentUserId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        client
          .from('social_notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
      ])

    ;[
      profileResult.error,
      friendshipsResult.error,
      sharesResult.error,
      notificationsResult.error,
    ].forEach(throwOnError)

    const profile = profileResult.data
      ? profileFromRow(profileResult.data)
      : null
    const friendships = (friendshipsResult.data || []).map(friendshipFromRow)
    const userId = profile?.userId || currentUserId
    const relatedIds = new Set<string>()
    friendships.forEach((friendship) => {
      relatedIds.add(
        friendship.requesterId === userId
          ? friendship.addresseeId
          : friendship.requesterId,
      )
    })
    ;(sharesResult.data || []).forEach((share) =>
      relatedIds.add(String(share.sender_id)),
    )
    ;(notificationsResult.data || []).forEach((notification) => {
      if (notification.actor_id) {
        relatedIds.add(String(notification.actor_id))
      }
    })

    const profilesResult = relatedIds.size
      ? await client
          .from('social_profiles')
          .select('*')
          .in('user_id', [...relatedIds])
      : { data: [], error: null }
    throwOnError(profilesResult.error)
    const profiles = new Map(
      (profilesResult.data || [])
        .map(profileFromRow)
        .map((item) => [item.userId, item]),
    )

    const accepted = friendships.filter(
      (friendship) => friendship.status === 'accepted',
    )
    const friends = accepted
      .map((friendship) =>
        profiles.get(
          friendship.requesterId === userId
            ? friendship.addresseeId
            : friendship.requesterId,
        ),
      )
      .filter((friend): friend is SocialProfile => Boolean(friend))

    const countResult = await client.rpc('social_unread_message_count')
    throwOnError(countResult.error)

    return {
      profile,
      friends,
      incomingRequests: friendships
        .filter(
          (friendship) =>
            friendship.status === 'pending' &&
            friendship.addresseeId === userId,
        )
        .map((friendship) => ({
          ...friendship,
          friend: profiles.get(friendship.requesterId),
        })),
      outgoingRequests: friendships
        .filter(
          (friendship) =>
            friendship.status === 'pending' &&
            friendship.requesterId === userId,
        )
        .map((friendship) => ({
          ...friendship,
          friend: profiles.get(friendship.addresseeId),
        })),
      guideShares: (sharesResult.data || []).map(shareFromRow).map((share) => ({
        ...share,
        sender: profiles.get(share.senderId),
      })),
      notifications: attachProfiles(
        (notificationsResult.data || []).map(notificationFromRow),
        profiles,
      ),
      unreadMessages: Number(countResult.data || 0),
    }
  },
})
