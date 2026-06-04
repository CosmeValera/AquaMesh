import { useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from '../auth/AuthProvider'
import { isSupabaseConfigured, supabase } from '../auth/supabaseClient'
import {
  SAVED_DASHBOARDS_CHANGED_EVENT,
  type SavedDashboardsChangedDetail,
} from '../components/Dasboard/dashboardStorage'
import {
  WIDGET_STORAGE_UPDATED,
  type CustomWidget,
  type WidgetStorageUpdatedDetail,
  type WidgetVersion,
} from '../components/WidgetEditor/WidgetStorage'
import { useStore } from '../state/store'
import {
  readLocalWorkspaceSnapshot,
  writeLocalWorkspaceSnapshot,
} from './cache'
import { createCloudRepository } from './repository'
import type { CloudWorkspaceBundle, UserProfile, WorkspaceState } from './types'

export const CLOUD_SYNC_STATUS_EVENT = 'studymesh-cloud-sync-status'

export type CloudSyncStatus = 'idle' | 'loading' | 'syncing' | 'synced' | 'error'

const hasLocalWorkspaceData = (bundle: ReturnType<typeof readLocalWorkspaceSnapshot>) =>
  bundle.dashboards.length > 0 ||
  bundle.widgets.length > 0 ||
  bundle.widgetVersions.length > 0 ||
  Boolean(bundle.workspaceState?.openDashboards.length) ||
  Boolean(bundle.studyProgress)

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

const getUserDisplayName = (user: { email?: string; user_metadata?: Record<string, unknown> }) => {
  const displayName = user.user_metadata?.display_name
  const fullName = user.user_metadata?.full_name

  return typeof displayName === 'string'
    ? displayName
    : typeof fullName === 'string'
      ? fullName
      : user.email || 'Student'
}

const newerFirst = <T extends { id: string; updatedAt?: string }>(
  first: T,
  second: T,
) =>
  new Date(first.updatedAt || 0).getTime() >=
  new Date(second.updatedAt || 0).getTime()
    ? first
    : second

const mergeById = <T extends { id: string; updatedAt?: string }>(
  localItems: T[],
  cloudItems: T[],
): T[] => {
  const merged = new Map<string, T>()

  cloudItems.forEach((item) => merged.set(item.id, item))
  localItems.forEach((item) => {
    const cloudItem = merged.get(item.id)
    merged.set(item.id, cloudItem ? newerFirst(item, cloudItem) : item)
  })

  return [...merged.values()]
}

const mergeWidgets = (
  localWidgets: CustomWidget[],
  cloudWidgets: CustomWidget[],
) => mergeById(localWidgets, cloudWidgets)

const mergeWidgetVersions = (
  localVersions: WidgetVersion[],
  cloudVersions: WidgetVersion[],
) => mergeById(localVersions, cloudVersions)

const applyCloudBundleToLocalCache = (bundle: CloudWorkspaceBundle): void => {
  writeLocalWorkspaceSnapshot({
    dashboards: bundle.dashboards,
    widgets: bundle.widgets,
    widgetVersions: bundle.widgetVersions,
    workspaceState: bundle.workspaceState
      ? {
          selectedDashboard: bundle.workspaceState.selectedDashboard,
          openDashboards: bundle.workspaceState.openDashboards,
        }
      : null,
    studyProgress: bundle.workspaceState?.studyProgress || null,
  })

  window.dispatchEvent(new Event(SAVED_DASHBOARDS_CHANGED_EVENT))
  window.dispatchEvent(new CustomEvent('dashboardStorageUpdated'))
  document.dispatchEvent(new CustomEvent(WIDGET_STORAGE_UPDATED))
}

const buildWorkspaceBundleFromLocalCache = (
  ownerId: string,
  profile: UserProfile,
  overrides: Partial<
    Pick<CloudWorkspaceBundle, 'dashboards' | 'widgets' | 'widgetVersions'>
  > = {},
): Omit<CloudWorkspaceBundle, 'profile'> & { profile: UserProfile } => {
  const snapshot = readLocalWorkspaceSnapshot()
  const workspaceState: WorkspaceState = {
    ownerId,
    selectedDashboard: snapshot.workspaceState?.selectedDashboard || 0,
    openDashboards: snapshot.workspaceState?.openDashboards || [],
    studyProgress: snapshot.studyProgress || undefined,
    updatedAt: new Date().toISOString(),
  }

  return {
    profile,
    dashboards: overrides.dashboards || snapshot.dashboards,
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
  const setDashboards = useStore((state) => state.setDashboards)
  const setSelectedDashboard = useStore((state) => state.setSelectedDashboard)

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
      try {
        dispatchCloudSyncStatus('loading')
        const [cloudBundle, localSnapshot] = await Promise.all([
          repository.loadWorkspaceBundle(ownerId),
          Promise.resolve(readLocalWorkspaceSnapshot()),
        ])

        if (cancelled) {
          return
        }

        const localHasDashboards =
          localSnapshot.dashboards.length > 0 ||
          Boolean(localSnapshot.workspaceState?.openDashboards.length)
        const cloudHasDashboards =
          cloudBundle.dashboards.length > 0 ||
          Boolean(cloudBundle.workspaceState?.openDashboards.length)
        const mergedWidgets = mergeWidgets(
          localSnapshot.widgets,
          cloudBundle.widgets,
        )
        const mergedWidgetVersions = mergeWidgetVersions(
          localSnapshot.widgetVersions,
          cloudBundle.widgetVersions,
        )

        if (cloudHasDashboards && !localHasDashboards) {
          isApplyingRemoteRef.current = true
          applyCloudBundleToLocalCache(cloudBundle)
          if (cloudBundle.workspaceState?.openDashboards.length) {
            setDashboards(cloudBundle.workspaceState.openDashboards)
            setSelectedDashboard(cloudBundle.workspaceState.selectedDashboard)
          }
          window.setTimeout(() => {
            isApplyingRemoteRef.current = false
          }, 0)
        } else if (hasLocalWorkspaceData(localSnapshot)) {
          await repository.saveWorkspaceBundle(
            ownerId,
            buildWorkspaceBundleFromLocalCache(ownerId, profile, {
              widgets: mergedWidgets,
              widgetVersions: mergedWidgetVersions,
            }),
          )
        } else if (cloudBundle.widgets.length > 0) {
          writeLocalWorkspaceSnapshot({
            ...localSnapshot,
            widgets: cloudBundle.widgets,
            widgetVersions: cloudBundle.widgetVersions,
          })
        } else {
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
      if (isApplyingRemoteRef.current) {
        return
      }

      try {
        dispatchCloudSyncStatus('syncing')
        await repository.saveWorkspaceBundle(
          ownerId,
          buildWorkspaceBundleFromLocalCache(ownerId, profile),
        )
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
      try {
        dispatchCloudSyncStatus('syncing')
        await repository.deleteWidgetVersions(ownerId, widgetId)
        await repository.deleteWidget(ownerId, widgetId)
        await runSync()
      } catch (error) {
        console.error('StudyMesh cloud widget delete failed', error)
        dispatchCloudSyncStatus(
          'error',
          error instanceof Error ? error.message : 'Cloud delete failed.',
        )
      }
    }

    const runCloudDashboardDelete = async (dashboardId: string) => {
      try {
        dispatchCloudSyncStatus('syncing')
        await repository.deleteDashboard(ownerId, dashboardId)
        await runSync()
      } catch (error) {
        console.error('StudyMesh cloud dashboard delete failed', error)
        dispatchCloudSyncStatus(
          'error',
          error instanceof Error ? error.message : 'Cloud delete failed.',
        )
      }
    }

    const scheduleSync = () => {
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

    const unsubscribeStore = useStore.subscribe(scheduleSync)

    window.addEventListener(
      SAVED_DASHBOARDS_CHANGED_EVENT,
      handleDashboardStorageUpdated,
    )
    window.addEventListener('dashboardStorageUpdated', scheduleSync)
    document.addEventListener(WIDGET_STORAGE_UPDATED, handleWidgetStorageUpdated)

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
    }
  }, [hasHydrated, repository, user])

  return null
}

export default CloudWorkspaceSync
