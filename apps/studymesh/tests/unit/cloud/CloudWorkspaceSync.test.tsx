import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cloudSyncMocks = vi.hoisted(() => {
  const repository = {
    loadWorkspaceBundle: vi.fn(),
    saveWorkspaceBundle: vi.fn(),
    upsertProfile: vi.fn(),
    seedWelcomeGuideForNewAccount: vi.fn(),
    upsertStudyGuide: vi.fn(),
    updateStudyGuideSummary: vi.fn(),
    deleteWidgetVersions: vi.fn(),
    deleteWidget: vi.fn(),
    deleteDashboard: vi.fn(),
    deleteStudyGuide: vi.fn(),
  }
  const studyGuideStorage = {
    replaceSummariesFromCloud: vi.fn(),
    cacheFromCloud: vi.fn(),
    getById: vi.fn(),
    getSummaryById: vi.fn(),
  }
  const storeState = {
    setDashboards: vi.fn(),
    setSelectedDashboard: vi.fn(),
  }
  const useStore = vi.fn((selector) => selector(storeState))
  const subscribe = vi.fn()
  const authState: {
    loading: boolean
    user: {
      id: string
      email?: string
      user_metadata?: Record<string, unknown>
      is_anonymous?: boolean
    } | null
  } = { loading: false, user: null }

  return {
    repository,
    studyGuideStorage,
    storeState,
    useStore,
    subscribe,
    authState,
    readLocalWorkspaceSnapshot: vi.fn(),
    readWorkspaceCacheOwner: vi.fn(),
    writeLocalWorkspaceSnapshot: vi.fn(),
    writeWorkspaceCacheOwner: vi.fn(),
    createStudyMeshGuideStudyGuide: vi.fn(() => ({
      id: 'studymesh-student-knowledge-wiki-a-beginner-s-guide',
      title: 'Welcome to StudyMesh',
      folderName: 'StudyMesh Guide',
      studyPath: { dashboards: [] },
      createdAt: '2026-07-08T00:00:00.000Z',
      updatedAt: '2026-07-08T00:00:00.000Z',
    })),
  }
})

cloudSyncMocks.useStore.subscribe = cloudSyncMocks.subscribe

vi.mock('../../../src/auth/AuthProvider', () => ({
  STUDYMESH_PROFILE_DELETE_CANCELLED_EVENT:
    'studymesh-profile-delete-cancelled',
  STUDYMESH_PROFILE_DELETE_STARTED_EVENT: 'studymesh-profile-delete-started',
  useAuth: () => cloudSyncMocks.authState,
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
  StudyGuideStorage: cloudSyncMocks.studyGuideStorage,
}))

vi.mock('../../../src/studyGuides/studyMeshGuideSeed', () => ({
  createStudyMeshGuideStudyGuide: cloudSyncMocks.createStudyMeshGuideStudyGuide,
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
    cloudSyncMocks.authState.loading = false
    cloudSyncMocks.authState.user = {
      id: 'user-1',
      email: 'student@example.com',
      user_metadata: { display_name: 'Student' },
    }
    cloudSyncMocks.repository.loadWorkspaceBundle.mockResolvedValue(
      emptyCloudBundle,
    )
    cloudSyncMocks.repository.saveWorkspaceBundle.mockResolvedValue(
      emptyCloudBundle,
    )
    cloudSyncMocks.repository.upsertStudyGuide.mockResolvedValue({})
    cloudSyncMocks.repository.updateStudyGuideSummary.mockResolvedValue({})
    cloudSyncMocks.repository.seedWelcomeGuideForNewAccount.mockResolvedValue(
      null,
    )
    cloudSyncMocks.repository.upsertProfile.mockResolvedValue({
      id: 'user-1',
    })
    cloudSyncMocks.studyGuideStorage.replaceSummariesFromCloud.mockReturnValue(
      undefined,
    )
    cloudSyncMocks.studyGuideStorage.cacheFromCloud.mockImplementation(
      (studyGuide) => studyGuide,
    )
    cloudSyncMocks.studyGuideStorage.getById.mockReturnValue(null)
    cloudSyncMocks.studyGuideStorage.getSummaryById.mockReturnValue(null)
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

  it('asks Supabase to seed the welcome guide for a new empty owner', async () => {
    cloudSyncMocks.readWorkspaceCacheOwner.mockReturnValue('old-user')
    const seededGuide = {
      id: 'studymesh-student-knowledge-wiki-a-beginner-s-guide',
      title: 'Welcome to StudyMesh',
      folderName: 'StudyMesh Guide',
      studyPath: { dashboards: [] },
      createdAt: '2026-07-08T00:00:00.000Z',
      updatedAt: '2026-07-08T00:00:00.000Z',
    }
    cloudSyncMocks.repository.seedWelcomeGuideForNewAccount.mockResolvedValue(
      seededGuide,
    )

    render(<CloudWorkspaceSync />)

    await waitFor(() => {
      expect(
        cloudSyncMocks.repository.seedWelcomeGuideForNewAccount,
      ).toHaveBeenCalledWith(expect.objectContaining({ id: seededGuide.id }))
      expect(
        cloudSyncMocks.studyGuideStorage.cacheFromCloud,
      ).toHaveBeenCalledWith(seededGuide)
    })
    expect(cloudSyncMocks.writeWorkspaceCacheOwner).toHaveBeenCalledWith(
      'user-1',
    )
  })

  it('does not cache a welcome guide when Supabase reports no seed', async () => {
    cloudSyncMocks.readWorkspaceCacheOwner.mockReturnValue('user-1')

    render(<CloudWorkspaceSync />)

    await waitFor(() => {
      expect(
        cloudSyncMocks.repository.seedWelcomeGuideForNewAccount,
      ).toHaveBeenCalled()
    })
    expect(
      cloudSyncMocks.studyGuideStorage.cacheFromCloud,
    ).not.toHaveBeenCalled()
  })

  it('syncs Study Guide pin changes as metadata updates', async () => {
    cloudSyncMocks.studyGuideStorage.getSummaryById.mockReturnValue({
      id: 'guide-1',
      title: 'Pinned guide',
      folderName: 'Pinned guide',
      pinnedAt: '2026-07-03T10:00:00.000Z',
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-03T10:00:00.000Z',
    })

    render(<CloudWorkspaceSync />)

    await waitFor(() => {
      expect(cloudSyncMocks.repository.upsertProfile).toHaveBeenCalled()
    })
    cloudSyncMocks.repository.updateStudyGuideSummary.mockClear()

    window.dispatchEvent(
      new CustomEvent('studyGuidesChanged', {
        detail: { action: 'pin', studyGuideId: 'guide-1' },
      }),
    )

    await waitFor(() => {
      expect(
        cloudSyncMocks.repository.updateStudyGuideSummary,
      ).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          id: 'guide-1',
          pinnedAt: '2026-07-03T10:00:00.000Z',
        }),
      )
    })
  })

  describe('guest sessions', () => {
    const guestGuide = {
      id: 'guest-guide-1',
      title: 'What is a bottleneck?',
      folderName: 'What is a bottleneck?',
      studyPath: { dashboards: [] },
      createdAt: '2026-07-08T00:00:00.000Z',
      updatedAt: '2026-07-08T00:00:00.000Z',
    }

    beforeEach(() => {
      cloudSyncMocks.authState.user = {
        id: 'guest-1',
        user_metadata: {},
        is_anonymous: true,
      }
      cloudSyncMocks.readLocalWorkspaceSnapshot.mockReturnValue({
        ...emptyLocalSnapshot,
        studyGuides: [guestGuide],
      })
    })

    it('never hydrates or uploads a workspace bundle for a guest', async () => {
      render(<CloudWorkspaceSync />)

      await new Promise((resolve) => window.setTimeout(resolve, 20))

      expect(cloudSyncMocks.subscribe).not.toHaveBeenCalled()
      expect(
        cloudSyncMocks.repository.loadWorkspaceBundle,
      ).not.toHaveBeenCalled()
      expect(
        cloudSyncMocks.repository.saveWorkspaceBundle,
      ).not.toHaveBeenCalled()
      expect(cloudSyncMocks.repository.upsertProfile).not.toHaveBeenCalled()
      expect(
        cloudSyncMocks.repository.seedWelcomeGuideForNewAccount,
      ).not.toHaveBeenCalled()
      expect(cloudSyncMocks.writeWorkspaceCacheOwner).not.toHaveBeenCalled()
      expect(cloudSyncMocks.writeLocalWorkspaceSnapshot).not.toHaveBeenCalled()
    })

    it('still saves a guest Quick Guide under the anonymous owner', async () => {
      cloudSyncMocks.studyGuideStorage.getById.mockReturnValue(guestGuide)

      render(<CloudWorkspaceSync />)

      await new Promise((resolve) => window.setTimeout(resolve, 20))

      window.dispatchEvent(
        new CustomEvent('studyGuidesChanged', {
          detail: { action: 'save', studyGuideId: guestGuide.id },
        }),
      )

      await waitFor(() => {
        expect(cloudSyncMocks.repository.upsertStudyGuide).toHaveBeenCalledWith(
          'guest-1',
          expect.objectContaining({ id: guestGuide.id }),
        )
      })

      expect(
        cloudSyncMocks.repository.saveWorkspaceBundle,
      ).not.toHaveBeenCalled()
      expect(cloudSyncMocks.writeWorkspaceCacheOwner).not.toHaveBeenCalled()
    })
  })
})
