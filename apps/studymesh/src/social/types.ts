import type { StudyGuideRecord } from '../cloud/types'

export interface SocialProfile {
  userId: string
  username: string
  displayName: string
  avatarPath?: string
  lastActiveAt?: string
}

export type FriendshipStatus = 'pending' | 'accepted'

export interface Friendship {
  id: string
  requesterId: string
  addresseeId: string
  status: FriendshipStatus
  createdAt: string
  updatedAt: string
  friend?: SocialProfile
}

export interface DirectMessage {
  id: string
  senderId: string
  recipientId: string
  body: string
  createdAt: string
  readAt?: string
}

export type GuideShareStatus = 'pending' | 'accepted' | 'declined'

export interface GuideShare {
  id: string
  senderId: string
  recipientId: string
  sourceGuideId: string
  title: string
  description?: string
  emoji?: string
  guideSnapshot: StudyGuideRecord
  status: GuideShareStatus
  createdAt: string
  respondedAt?: string
  sender?: SocialProfile
}

export type SocialNotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'guide_shared'

export interface SocialNotification {
  id: string
  actorId?: string
  type: SocialNotificationType
  entityId?: string
  createdAt: string
  readAt?: string
  actor?: SocialProfile
}

export interface SocialOverview {
  profile: SocialProfile | null
  friends: SocialProfile[]
  incomingRequests: Friendship[]
  outgoingRequests: Friendship[]
  guideShares: GuideShare[]
  notifications: SocialNotification[]
  unreadMessages: number
}
