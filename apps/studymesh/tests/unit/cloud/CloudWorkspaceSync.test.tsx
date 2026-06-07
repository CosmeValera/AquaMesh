import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cloudSyncMocks = vi.hoisted(() => {
  const repository = {
    loadWorkspaceBundle: vi.fn(),
    saveWorkspaceBundle: vi.fn(),
    upsertProfile: vi.fn(),
    deleteWidgetVersions: vi.fn(),
    deleteWidget: vi.fn(),
    deleteDashboard: vi.fn(),
    deleteStudyGuide: vi.fn(),
  }
  const storeState = {
    setDashboards: vi.fn(),
    setSelectedDashboard: vi.fn(),
  }
  const useStore = vi.fn((selector) => selector(storeState))
  const subscribe = vi.fn()

  return {
    repository,
    storeState,
    useStore,
    subscribe,
    readLocalWorkspaceSnapshot: vi.fn(),
    readWorkspaceCacheOwner: vi.fn(),
    writeLocalWorkspaceSnapshot: vi.fn(),
    writeWorkspaceCacheOwner: vi.fn(),
    clearStudyMeshGuideSeedMarker: vi.fn(),
  }
})

cloudSyncMocks.useStore.subscribe = cloudSyncMocks.subscribe

vi.mock('../../../src/auth/AuthProvider', () => ({
  STUDYMESH_PROFILE_DELETE_CANCELLED_EVENT:
    'studymesh-profile-delete-cancelled',
  STUDYMESH_PROFILE_DELETE_STARTED_EVENT: 'studymesh-profile-delete-started',
  useAuth: () => ({
    loading: false,
    user: {
      id: 'user-1',
      email: 'student@example.com',
      user_metadata: { display_name: 'Student' },
    },
  }),
}))

vi.mock('../../../src/auth/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {},
}))

vi.mock('../../../src/cloud/repository', () => ({
  createCloudRepository: () => cloudSyncMocks.repository,
}))

vi.mock('../../../src/cloud/cache', () => ({
  readLocalWorkspaceSnapshot: cloudSyncMocks.readLocalWorkspaceSnapshot,
  readWorkspaceCacheOwner: cloudSyncMocks.readWorkspaceCacheOwner,
  writeLocalWorkspaceSnapshot: cloudSyncMocks.writeLocalWorkspaceSnapshot,
  writeWorkspaceCacheOwner: cloudSyncMocks.writeWorkspaceCacheOwner,
}))

vi.mock('../../../src/components/Dasboard/dashboardStorage', () => ({
  SAVED_DASHBOARDS_CHANGED_EVENT: 'savedDashboardsChanged',
}))

vi.mock('../../../src/components/WidgetEditor/WidgetStorage', () => ({
  WIDGET_STORAGE_UPDATED: 'widgetStorageUpdated',
}))

vi.mock('../../../src/studyGuides/storage', () => ({
  STUDY_GUIDES_CHANGED_EVENT: 'studyGuidesChanged',
}))

vi.mock('../../../src/studyPack/studyMeshGuideSeed', () => ({
  clearStudyMeshGuideSeedMarker:
    cloudSyncMocks.clearStudyMeshGuideSeedMarker,
}))

vi.mock('../../../src/state/store', () => ({
  useStore: cloudSyncMocks.useStore,
}))

import CloudWorkspaceSync from '../../../src/cloud/CloudWorkspaceSync'

const emptyCloudBundle = {
  profile: null,
  dashboards: [],
  studyGuides: [],
  widgets: [],
  widgetVersions: [],
  workspaceState: null,
}

const emptyLocalSnapshot = {
  dashboards: [],
  studyGuides: [],
  widgets: [],
  widgetVersions: [],
  workspaceState: null,
}

describe('CloudWorkspaceSync profile deletion guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cloudSyncMocks.repository.loadWorkspaceBundle.mockResolvedValue(
      emptyCloudBundle,
    )
    cloudSyncMocks.repository.saveWorkspaceBundle.mockResolvedValue(
      emptyCloudBundle,
    )
    cloudSyncMocks.repository.upsertProfile.mockResolvedValue({
      id: 'user-1',
    })
    cloudSyncMocks.readLocalWorkspaceSnapshot.mockReturnValue(
      emptyLocalSnapshot,
    )
    cloudSyncMocks.readWorkspaceCacheOwner.mockReturnValue(null)
    cloudSyncMocks.subscribe.mockReturnValue(vi.fn())
  })

  it('skips scheduled cloud sync while StudyMesh profile deletion is active', async () => {
    render(<CloudWorkspaceSync />)

    await waitFor(() => {
      expect(cloudSyncMocks.repository.upsertProfile).toHaveBeenCalled()
    })

    cloudSyncMocks.repository.saveWorkspaceBundle.mockClear()
    const scheduleSync = cloudSyncMocks.subscribe.mock.calls[0][0]

    window.dispatchEvent(new Event('studymesh-profile-delete-started'))
    scheduleSync()

    await new Promise((resolve) => window.setTimeout(resolve, 950))

    expect(cloudSyncMocks.repository.saveWorkspaceBundle).not.toHaveBeenCalled()
  })

  it('clears the StudyMesh Guide seed marker for a different empty owner', async () => {
    cloudSyncMocks.readWorkspaceCacheOwner.mockReturnValue('old-user')

    render(<CloudWorkspaceSync />)

    await waitFor(() => {
      expect(
        cloudSyncMocks.clearStudyMeshGuideSeedMarker,
      ).toHaveBeenCalled()
    })
    expect(cloudSyncMocks.writeWorkspaceCacheOwner).toHaveBeenCalledWith(
      'user-1',
    )
  })

  it('keeps the StudyMesh Guide seed marker for the same empty owner', async () => {
    cloudSyncMocks.readWorkspaceCacheOwner.mockReturnValue('user-1')

    render(<CloudWorkspaceSync />)

    await waitFor(() => {
      expect(cloudSyncMocks.repository.upsertProfile).toHaveBeenCalled()
    })
    expect(
      cloudSyncMocks.clearStudyMeshGuideSeedMarker,
    ).not.toHaveBeenCalled()
  })
})
