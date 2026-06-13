import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { chooseCloudHydrationAction } from '../../../src/cloud/CloudWorkspaceSync'
import {
  CLOUD_CACHE_KEYS,
  clearLocalWorkspaceCache,
  readLocalWorkspaceSnapshot,
  readWorkspaceCacheOwner,
  writeLocalWorkspaceSnapshot,
  writeWorkspaceCacheOwner,
} from '../../../src/cloud/cache'
import type {
  CloudWorkspaceBundle,
  LocalWorkspaceSnapshot,
} from '../../../src/cloud/types'
import { createDashboardMergePlan } from '../../../src/cloud/repository'
import {
  createDefaultStudyToolsState,
  STUDY_TOOLS_STORAGE_KEY,
} from '../../../src/components/studyTools/storage'

const installLocalStorageMock = () => {
  const storage = new Map<string, string>()

  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) =>
    storage.has(key) ? storage.get(key)! : null,
  )
  vi.mocked(window.localStorage.setItem).mockImplementation(
    (key: string, value: string) => {
      storage.set(key, value)
    },
  )
  vi.mocked(window.localStorage.removeItem).mockImplementation(
    (key: string) => {
      storage.delete(key)
    },
  )
  vi.mocked(window.localStorage.clear).mockImplementation(() => {
    storage.clear()
  })
}

describe('dashboard migration planning', () => {
  beforeEach(() => {
    installLocalStorageMock()
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uploads standalone local tools when the cloud account is empty', () => {
    const tools = createDefaultStudyToolsState()
    tools.scratchpad.content = 'Local note'
    window.localStorage.setItem(STUDY_TOOLS_STORAGE_KEY, JSON.stringify(tools))
    const localSnapshot = readLocalWorkspaceSnapshot()

    expect(localSnapshot.workspaceState?.settings?.tools).toBeTruthy()
    expect(
      chooseCloudHydrationAction({
        cloudBundle: {
          profile: null,
          dashboards: [],
          studyGuides: [],
          widgets: [],
          widgetVersions: [],
          workspaceState: null,
        },
        localSnapshot,
        cacheOwnerId: null,
        currentOwnerId: 'owner-1',
      }),
    ).toBe('upload-local')
  })

  it('clears private tools data with the account workspace cache', () => {
    window.localStorage.setItem(
      STUDY_TOOLS_STORAGE_KEY,
      JSON.stringify(createDefaultStudyToolsState()),
    )

    clearLocalWorkspaceCache()

    expect(window.localStorage.getItem(STUDY_TOOLS_STORAGE_KEY)).toBeNull()
  })

  it('uploads local dashboards when the cloud account is empty', () => {
    const localDashboard = {
      id: 'dash-1',
      name: 'Chemistry',
      layout: { type: 'row', children: [] },
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-01T10:00:00.000Z',
    }

    const plan = createDashboardMergePlan([localDashboard], [])

    expect(plan.readyToUpload).toEqual([localDashboard])
    expect(plan.conflictedLocalCopies).toEqual([])
  })

  it('keeps newer cloud rows and creates a local conflict copy', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-03T10:00:00.000Z'))

    const plan = createDashboardMergePlan(
      [
        {
          id: 'dash-1',
          name: 'Local Physics',
          layout: { type: 'row', children: [] },
          createdAt: '2026-06-01T10:00:00.000Z',
          updatedAt: '2026-06-01T10:00:00.000Z',
        },
      ],
      [
        {
          id: 'dash-1',
          name: 'Cloud Physics',
          layout: { type: 'row', children: [] },
          createdAt: '2026-06-01T10:00:00.000Z',
          updatedAt: '2026-06-02T10:00:00.000Z',
        },
      ],
    )

    expect(plan.readyToUpload).toEqual([])
    expect(plan.conflictedLocalCopies).toEqual([
      expect.objectContaining({
        id: 'dash-1-local-1780480800000',
        name: 'Local Physics (local copy)',
        createdAt: '2026-06-03T10:00:00.000Z',
        updatedAt: '2026-06-03T10:00:00.000Z',
      }),
    ])
  })

  it('lets newer local rows replace older cloud rows', () => {
    const localDashboard = {
      id: 'dash-1',
      name: 'New Local Physics',
      layout: { type: 'row', children: [] },
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-03T10:00:00.000Z',
    }

    const plan = createDashboardMergePlan(
      [localDashboard],
      [
        {
          id: 'dash-1',
          name: 'Old Cloud Physics',
          layout: { type: 'row', children: [] },
          createdAt: '2026-06-01T10:00:00.000Z',
          updatedAt: '2026-06-02T10:00:00.000Z',
        },
      ],
    )

    expect(plan.readyToUpload).toEqual([localDashboard])
    expect(plan.conflictedLocalCopies).toEqual([])
  })
})

const emptyLocalSnapshot = (): LocalWorkspaceSnapshot => ({
  dashboards: [],
  studyGuides: [],
  widgets: [],
  widgetVersions: [],
  workspaceState: null,
})

const emptyCloudBundle = (): CloudWorkspaceBundle => ({
  profile: null,
  dashboards: [],
  studyGuides: [],
  widgets: [],
  widgetVersions: [],
  workspaceState: null,
})

describe('cloud-first workspace hydration planning', () => {
  beforeEach(() => {
    installLocalStorageMock()
    window.localStorage.clear()
  })

  it('applies cloud data instead of uploading stale local cache', () => {
    const localSnapshot = emptyLocalSnapshot()
    localSnapshot.dashboards = [
      {
        id: 'local-dashboard',
        name: 'Phone dashboard',
        layout: { type: 'row', children: [] },
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z',
      },
    ]
    const cloudBundle = emptyCloudBundle()
    cloudBundle.dashboards = [
      {
        id: 'cloud-dashboard',
        name: 'Desktop dashboard',
        layout: { type: 'row', children: [] },
        createdAt: '2026-06-02T10:00:00.000Z',
        updatedAt: '2026-06-02T10:00:00.000Z',
      },
    ]

    expect(
      chooseCloudHydrationAction({
        cloudBundle,
        localSnapshot,
        cacheOwnerId: null,
        currentOwnerId: 'user-1',
      }),
    ).toBe('apply-cloud')
  })

  it('uploads local cache only when cloud is empty and cache is unowned', () => {
    const localSnapshot = emptyLocalSnapshot()
    localSnapshot.widgets = [
      {
        id: 'widget-1',
        name: 'Local widget',
        components: [],
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z',
      },
    ]

    expect(
      chooseCloudHydrationAction({
        cloudBundle: emptyCloudBundle(),
        localSnapshot,
        cacheOwnerId: null,
        currentOwnerId: 'user-1',
      }),
    ).toBe('upload-local')
  })

  it('ignores local cache owned by another account when cloud is empty', () => {
    const localSnapshot = emptyLocalSnapshot()
    localSnapshot.dashboards = [
      {
        id: 'other-user-dashboard',
        name: 'Other user dashboard',
        layout: { type: 'row', children: [] },
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z',
      },
    ]

    expect(
      chooseCloudHydrationAction({
        cloudBundle: emptyCloudBundle(),
        localSnapshot,
        cacheOwnerId: 'other-user',
        currentOwnerId: 'user-1',
      }),
    ).toBe('initialize-empty')
  })

  it('marks and reads workspace cache owner', () => {
    expect(readWorkspaceCacheOwner()).toBeNull()

    writeWorkspaceCacheOwner('user-1')

    expect(readWorkspaceCacheOwner()).toBe('user-1')
  })

  it('clears stale workspace cache when cloud snapshot is empty', () => {
    window.localStorage.setItem(
      CLOUD_CACHE_KEYS.workspaceState,
      JSON.stringify({
        state: {
          selectedDashboard: 0,
          openDashboards: [{ id: 'dash-1', name: 'Old local' }],
        },
      }),
    )

    writeLocalWorkspaceSnapshot(emptyLocalSnapshot())

    expect(readLocalWorkspaceSnapshot().workspaceState).toBeNull()
    expect(
      window.localStorage.getItem(CLOUD_CACHE_KEYS.workspaceState),
    ).toBeNull()
  })
})
