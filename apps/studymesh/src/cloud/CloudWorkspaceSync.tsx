import { useEffect, useMemo, useRef, useState } from 'react'

import {
  STUDYMESH_PROFILE_DELETE_CANCELLED_EVENT,
  STUDYMESH_PROFILE_DELETE_STARTED_EVENT,
  useAuth,
} from '../auth/AuthProvider'
import { isSupabaseConfigured, supabase } from '../auth/supabaseClient'
import {
  SAVED_DASHBOARDS_CHANGED_EVENT,
  type SavedDashboardsChangedDetail,
} from '../components/Dasboard/dashboardStorage'
import {
  WIDGET_STORAGE_UPDATED,
  type WidgetStorageUpdatedDetail,
} from '../components/WidgetEditor/WidgetStorage'
import { useStore } from '../state/store'
import { STUDY_GUIDES_CHANGED_EVENT } from '../studyGuides/storage'
import {
  readLocalWorkspaceSnapshot,
  readWorkspaceCacheOwner,
  writeLocalWorkspaceSnapshot,
  writeWorkspaceCacheOwner,
} from './cache'
import { createCloudRepository } from './repository'
import type { CloudWorkspaceBundle, UserProfile, WorkspaceState } from './types'

export const CLOUD_SYNC_STATUS_EVENT = 'studymesh-cloud-sync-status'

export type CloudSyncStatus =
  | 'idle'
  | 'loading'
  | 'syncing'
  | 'synced'
  | 'error'

const hasLocalWorkspaceData = (
  bundle: ReturnType<typeof readLocalWorkspaceSnapshot>,
) =>
  bundle.dashboards.length > 0 ||
  bundle.studyGuides.length > 0 ||
  bundle.widgets.length > 0 ||
  bundle.widgetVersions.length > 0 ||
  Boolean(bundle.workspaceState?.openDashboards.length)

const hasCloudWorkspaceData = (bundle: CloudWorkspaceBundle) =>
  bundle.dashboards.length > 0 ||
  bundle.studyGuides.length > 0 ||
  bundle.widgets.length > 0 ||
  bundle.widgetVersions.length > 0 ||
  Boolean(bundle.workspaceState?.openDashboards.length)

export type CloudHydrationAction =
  | 'apply-cloud'
  | 'upload-local'
  | 'initialize-empty'

export const chooseCloudHydrationAction = ({
  cloudBundle,
  localSnapshot,
  cacheOwnerId,
  currentOwnerId,
}: {
  cloudBundle: CloudWorkspaceBundle
  localSnapshot: ReturnType<typeof readLocalWorkspaceSnapshot>
  cacheOwnerId: string | null
  currentOwnerId: string
}): CloudHydrationAction => {
  if (hasCloudWorkspaceData(cloudBundle)) {
    return 'apply-cloud'
  }

  if (
    hasLocalWorkspaceData(localSnapshot) &&
    (cacheOwnerId === null || cacheOwnerId === currentOwnerId)
  ) {
    return 'upload-local'
  }

  return 'initialize-empty'
}

const dispatchCloudSyncStatus = (
  status: CloudSyncStatus,
  message = '',
): void => {
  window.dispatchEvent(
    new CustomEvent(CLOUD_SYNC_STATUS_EVENT, {
      detail: { status, message },
    }),
  )
}

const getUserDisplayName = (user: {
  email?: string
  user_metadata?: Record<string, unknown>
}) => {
  const displayName = user.user_metadata?.display_name
  const fullName = user.user_metadata?.full_name

  return typeof displayName === 'string'
    ? displayName
    : typeof fullName === 'string'
      ? fullName
      : user.email || 'Student'
}

const applyCloudBundleToLocalCache = (bundle: CloudWorkspaceBundle): void => {
  writeLocalWorkspaceSnapshot({
    dashboards: bundle.dashboards,
    studyGuides: bundle.studyGuides,
    widgets: bundle.widgets,
    widgetVersions: bundle.widgetVersions,
    workspaceState: bundle.workspaceState
      ? {
          selectedDashboard: bundle.workspaceState.selectedDashboard,
          openDashboards: bundle.workspaceState.openDashboards,
        }
      : null,
  })

  window.dispatchEvent(new Event(SAVED_DASHBOARDS_CHANGED_EVENT))
  window.dispatchEvent(new CustomEvent('dashboardStorageUpdated'))
  document.dispatchEvent(new CustomEvent(WIDGET_STORAGE_UPDATED))
  window.dispatchEvent(new Event(STUDY_GUIDES_CHANGED_EVENT))
}

const buildWorkspaceBundleFromLocalCache = (
  ownerId: string,
  profile: UserProfile,
  overrides: Partial<
    Pick<
      CloudWorkspaceBundle,
      'dashboards' | 'studyGuides' | 'widgets' | 'widgetVersions'
    >
  > = {},
): Omit<CloudWorkspaceBundle, 'profile'> & { profile: UserProfile } => {
  const snapshot = readLocalWorkspaceSnapshot()
  const workspaceState: WorkspaceState = {
    ownerId,
    selectedDashboard: snapshot.workspaceState?.selectedDashboard || 0,
    openDashboards: snapshot.workspaceState?.openDashboards || [],
    updatedAt: new Date().toISOString(),
  }

  return {
    profile,
    dashboards: overrides.dashboards || snapshot.dashboards,
    studyGuides: overrides.studyGuides || snapshot.studyGuides,
    widgets: overrides.widgets || snapshot.widgets,
    widgetVersions: overrides.widgetVersions || snapshot.widgetVersions,
    workspaceState,
  }
}

const CloudWorkspaceSync = () => {
  const { user, loading } = useAuth()
  const repository = useMemo(() => createCloudRepository(supabase), [])
  const [hasHydrated, setHasHydrated] = useState(false)
  const syncTimeoutRef = useRef<number | null>(null)
  const isApplyingRemoteRef = useRef(false)
  const isProfileDeleteInProgressRef = useRef(false)
  const setDashboards = useStore((state) => state.setDashboards)
  const setSelectedDashboard = useStore((state) => state.setSelectedDashboard)

  useEffect(() => {
    const handleProfileDeleteStarted = () => {
      isProfileDeleteInProgressRef.current = true
      if (syncTimeoutRef.current !== null) {
        window.clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
      }
    }

    const handleProfileDeleteCancelled = () => {
      isProfileDeleteInProgressRef.current = false
    }

    window.addEventListener(
      STUDYMESH_PROFILE_DELETE_STARTED_EVENT,
      handleProfileDeleteStarted,
    )
    window.addEventListener(
      STUDYMESH_PROFILE_DELETE_CANCELLED_EVENT,
      handleProfileDeleteCancelled,
    )

    return () => {
      window.removeEventListener(
        STUDYMESH_PROFILE_DELETE_STARTED_EVENT,
        handleProfileDeleteStarted,
      )
      window.removeEventListener(
        STUDYMESH_PROFILE_DELETE_CANCELLED_EVENT,
        handleProfileDeleteCancelled,
      )
    }
  }, [])

  useEffect(() => {
    if (loading || !user || !isSupabaseConfigured) {
      setHasHydrated(false)
      return
    }

    let cancelled = false
    const ownerId = user.id
    const profile: UserProfile = {
      id: ownerId,
      email: user.email,
      displayName: getUserDisplayName(user),
      role: 'user',
      updatedAt: new Date().toISOString(),
    }

    const hydrate = async () => {
      if (isProfileDeleteInProgressRef.current) {
        return
      }

      try {
        dispatchCloudSyncStatus('loading')
        const [cloudBundle, localSnapshot] = await Promise.all([
          repository.loadWorkspaceBundle(ownerId),
          Promise.resolve(readLocalWorkspaceSnapshot()),
        ])
        const cacheOwnerId = readWorkspaceCacheOwner()

        if (cancelled || isProfileDeleteInProgressRef.current) {
          return
        }

        const action = chooseCloudHydrationAction({
          cloudBundle,
          localSnapshot,
          cacheOwnerId,
          currentOwnerId: ownerId,
        })

        if (action === 'apply-cloud') {
          isApplyingRemoteRef.current = true
          applyCloudBundleToLocalCache(cloudBundle)
          writeWorkspaceCacheOwner(ownerId)
          if (cloudBundle.workspaceState?.openDashboards.length) {
            setDashboards(cloudBundle.workspaceState.openDashboards)
            setSelectedDashboard(cloudBundle.workspaceState.selectedDashboard)
          } else {
            setDashboards([])
            setSelectedDashboard(0)
          }
          window.setTimeout(() => {
            isApplyingRemoteRef.current = false
          }, 0)
        } else if (action === 'upload-local') {
          if (isProfileDeleteInProgressRef.current) {
            return
          }
          await repository.saveWorkspaceBundle(
            ownerId,
            buildWorkspaceBundleFromLocalCache(ownerId, profile),
          )
          writeWorkspaceCacheOwner(ownerId)
        } else {
          isApplyingRemoteRef.current = true
          applyCloudBundleToLocalCache(cloudBundle)
          writeWorkspaceCacheOwner(ownerId)
          setDashboards([])
          setSelectedDashboard(0)
          window.setTimeout(() => {
            isApplyingRemoteRef.current = false
          }, 0)
          if (isProfileDeleteInProgressRef.current) {
            return
          }
          await repository.upsertProfile(profile)
        }

        setHasHydrated(true)
        dispatchCloudSyncStatus('synced')
      } catch (error) {
        console.error('StudyMesh cloud hydration failed', error)
        setHasHydrated(true)
        dispatchCloudSyncStatus(
          'error',
          error instanceof Error ? error.message : 'Cloud sync failed.',
        )
      }
    }

    void hydrate()

    return () => {
      cancelled = true
    }
  }, [loading, repository, setDashboards, setSelectedDashboard, user])

  useEffect(() => {
    if (!user || !hasHydrated || !isSupabaseConfigured) {
      return undefined
    }

    const ownerId = user.id
    const profile: UserProfile = {
      id: ownerId,
      email: user.email,
      displayName: getUserDisplayName(user),
      role: 'user',
      updatedAt: new Date().toISOString(),
    }

    const runSync = async () => {
      if (
        isApplyingRemoteRef.current ||
        isProfileDeleteInProgressRef.current
      ) {
        return
      }

      try {
        dispatchCloudSyncStatus('syncing')
        await repository.saveWorkspaceBundle(
          ownerId,
          buildWorkspaceBundleFromLocalCache(ownerId, profile),
        )
        writeWorkspaceCacheOwner(ownerId)
        dispatchCloudSyncStatus('synced')
      } catch (error) {
        console.error('StudyMesh cloud sync failed', error)
        dispatchCloudSyncStatus(
          'error',
          error instanceof Error ? error.message : 'Cloud sync failed.',
        )
      }
    }

    const runCloudWidgetDelete = async (widgetId: string) => {
      if (isProfileDeleteInProgressRef.current) {
        return
      }

      try {
        dispatchCloudSyncStatus('syncing')
        await repository.deleteWidgetVersions(ownerId, widgetId)
        await repository.deleteWidget(ownerId, widgetId)
        dispatchCloudSyncStatus('synced')
      } catch (error) {
        console.error('StudyMesh cloud widget delete failed', error)
        dispatchCloudSyncStatus(
          'error',
          error instanceof Error ? error.message : 'Cloud delete failed.',
        )
      }
    }

    const runCloudDashboardDelete = async (dashboardId: string) => {
      if (isProfileDeleteInProgressRef.current) {
        return
      }

      try {
        dispatchCloudSyncStatus('syncing')
        await repository.deleteDashboard(ownerId, dashboardId)
        dispatchCloudSyncStatus('synced')
      } catch (error) {
        console.error('StudyMesh cloud dashboard delete failed', error)
        dispatchCloudSyncStatus(
          'error',
          error instanceof Error ? error.message : 'Cloud delete failed.',
        )
      }
    }

    const runCloudStudyGuideDelete = async (studyGuideId: string) => {
      if (isProfileDeleteInProgressRef.current) {
        return
      }

      try {
        dispatchCloudSyncStatus('syncing')
        await repository.deleteStudyGuide(ownerId, studyGuideId)
        dispatchCloudSyncStatus('synced')
      } catch (error) {
        console.error('StudyMesh cloud Study Guide delete failed', error)
        dispatchCloudSyncStatus(
          'error',
          error instanceof Error ? error.message : 'Cloud delete failed.',
        )
      }
    }

    const scheduleSync = () => {
      if (isProfileDeleteInProgressRef.current) {
        return
      }

      if (syncTimeoutRef.current !== null) {
        window.clearTimeout(syncTimeoutRef.current)
      }

      syncTimeoutRef.current = window.setTimeout(() => {
        syncTimeoutRef.current = null
        void runSync()
      }, 900)
    }

    const handleWidgetStorageUpdated = (event: Event) => {
      const detail = (event as CustomEvent<WidgetStorageUpdatedDetail>).detail

      if (detail?.action === 'delete' && detail.widgetId) {
        void runCloudWidgetDelete(detail.widgetId)
        return
      }

      scheduleSync()
    }

    const handleDashboardStorageUpdated = (event: Event) => {
      const detail = (event as CustomEvent<SavedDashboardsChangedDetail>).detail

      if (detail?.action === 'delete' && detail.dashboardId) {
        void runCloudDashboardDelete(detail.dashboardId)
        return
      }

      scheduleSync()
    }

    const handleStudyGuidesUpdated = (event: Event) => {
      const detail = (
        event as CustomEvent<{ action?: string; studyGuideId?: string }>
      ).detail

      if (detail?.action === 'delete' && detail.studyGuideId) {
        void runCloudStudyGuideDelete(detail.studyGuideId)
        return
      }

      scheduleSync()
    }

    const unsubscribeStore = useStore.subscribe(scheduleSync)

    window.addEventListener(
      SAVED_DASHBOARDS_CHANGED_EVENT,
      handleDashboardStorageUpdated,
    )
    window.addEventListener('dashboardStorageUpdated', scheduleSync)
    document.addEventListener(
      WIDGET_STORAGE_UPDATED,
      handleWidgetStorageUpdated,
    )
    window.addEventListener(
      STUDY_GUIDES_CHANGED_EVENT,
      handleStudyGuidesUpdated,
    )

    return () => {
      if (syncTimeoutRef.current !== null) {
        window.clearTimeout(syncTimeoutRef.current)
      }
      unsubscribeStore()
      window.removeEventListener(
        SAVED_DASHBOARDS_CHANGED_EVENT,
        handleDashboardStorageUpdated,
      )
      window.removeEventListener('dashboardStorageUpdated', scheduleSync)
      document.removeEventListener(
        WIDGET_STORAGE_UPDATED,
        handleWidgetStorageUpdated,
      )
      window.removeEventListener(
        STUDY_GUIDES_CHANGED_EVENT,
        handleStudyGuidesUpdated,
      )
    }
  }, [hasHydrated, repository, user])

  return null
}

export default CloudWorkspaceSync
