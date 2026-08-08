/**
 * RabbitHole no longer has a user persona: nothing in the app is shared or
 * attributed, so there is no profile picture to show. This module is what is
 * left of the feature — a purge for the key the old uploader wrote, so the
 * photo does not sit in storage forever for someone who can no longer see or
 * remove it.
 */
export const getUserAvatarStorageKey = (userId: string) =>
  `studymesh-user-avatar-v1:${userId}`

export const purgeLegacyUserAvatar = (userId: string) => {
  if (!userId) {
    return
  }

  try {
    localStorage.removeItem(getUserAvatarStorageKey(userId))
  } catch (error) {
    console.error('Failed to purge the legacy user avatar', error)
  }
}
