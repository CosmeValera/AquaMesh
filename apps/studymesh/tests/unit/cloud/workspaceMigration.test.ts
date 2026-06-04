import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { chooseCloudHydrationAction } from '../../../src/cloud/CloudWorkspaceSync'
import {
  CLOUD_CACHE_KEYS,
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
  studyProgress: null,
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

  it('clears stale workspace and progress cache when cloud snapshot is empty', () => {
    window.localStorage.setItem(
      CLOUD_CACHE_KEYS.workspaceState,
      JSON.stringify({
        state: {
          selectedDashboard: 0,
          openDashboards: [{ id: 'dash-1', name: 'Old local' }],
        },
      }),
    )
    window.localStorage.setItem(
      CLOUD_CACHE_KEYS.studyPathProgress,
      JSON.stringify({ paths: { old: true } }),
    )

    writeLocalWorkspaceSnapshot(emptyLocalSnapshot())

    expect(readLocalWorkspaceSnapshot().workspaceState).toBeNull()
    expect(readLocalWorkspaceSnapshot().studyProgress).toBeNull()
    expect(
      window.localStorage.getItem(CLOUD_CACHE_KEYS.workspaceState),
    ).toBeNull()
    expect(
      window.localStorage.getItem(CLOUD_CACHE_KEYS.studyPathProgress),
    ).toBeNull()
  })
})
