import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDashboardMergePlan } from '../../../src/cloud/repository'

describe('dashboard migration planning', () => {
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
