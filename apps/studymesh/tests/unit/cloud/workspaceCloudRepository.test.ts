import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createCloudRepository,
  extractReferencedWidgetIds,
} from '../../../src/cloud/repository'

const createQueryBuilder = () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(),
    upsert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    delete: vi.fn(() => builder),
  }

  return builder
}

describe('workspace cloud repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extracts referenced widget IDs from nested dashboard JSON', () => {
    expect(
      extractReferencedWidgetIds({
        layout: {
          type: 'row',
          children: [
            {
              type: 'tab',
              config: { customProps: { widgetId: 'widget-1' } },
            },
            {
              type: 'tab',
              config: { customProps: { customWidgetId: 'widget-2' } },
            },
            {
              type: 'tab',
              config: { customProps: { widgetId: 'not-a-widget-id' } },
            },
          ],
        },
      }),
    ).toEqual(['widget-1', 'widget-2'])
  })

  it('lists only non-deleted dashboards owned by the signed-in user', async () => {
    const builder = createQueryBuilder()
    builder.order.mockResolvedValue({
      data: [
        {
          id: 'dash-1',
          owner_id: 'user-1',
          title: 'Physics',
          folder: null,
          folder_color: null,
          description: null,
          tags: [],
          visibility: 'private',
          layout: { type: 'row', children: [] },
          referenced_widget_ids: [],
          created_at: '2026-06-01T10:00:00.000Z',
          updated_at: '2026-06-02T10:00:00.000Z',
          deleted_at: null,
        },
      ],
      error: null,
    })
    const supabase = { from: vi.fn(() => builder) }
    const repository = createCloudRepository(supabase as never)

    const dashboards = await repository.listDashboards('user-1')

    expect(supabase.from).toHaveBeenCalledWith('user_dashboards')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.eq).toHaveBeenCalledWith('owner_id', 'user-1')
    expect(builder.is).toHaveBeenCalledWith('deleted_at', null)
    expect(builder.order).toHaveBeenCalledWith('updated_at', {
      ascending: false,
    })
    expect(dashboards).toEqual([
      expect.objectContaining({
        id: 'dash-1',
        name: 'Physics',
        isPublic: false,
      }),
    ])
  })

  it('upserts dashboards with owner scope and referenced widget IDs', async () => {
    const builder = createQueryBuilder()
    builder.single.mockResolvedValue({
      data: {
        id: 'dash-1',
        owner_id: 'user-1',
        title: 'Calculus',
        folder: 'Math',
        folder_color: '#00836f',
        description: 'Limits practice',
        tags: ['math'],
        visibility: 'private',
        layout: {
          type: 'row',
          children: [
            {
              config: { customProps: { widgetId: 'widget-1' } },
            },
          ],
        },
        referenced_widget_ids: ['widget-1'],
        created_at: '2026-06-01T10:00:00.000Z',
        updated_at: '2026-06-02T10:00:00.000Z',
        deleted_at: null,
      },
      error: null,
    })
    const supabase = { from: vi.fn(() => builder) }
    const repository = createCloudRepository(supabase as never)

    await repository.upsertDashboard('user-1', {
      id: 'dash-1',
      name: 'Calculus',
      folder: 'Math',
      folderColor: '#00836f',
      description: 'Limits practice',
      tags: ['math'],
      isPublic: false,
      layout: {
        type: 'row',
        children: [
          {
            config: { customProps: { widgetId: 'widget-1' } },
          },
        ],
      },
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-02T10:00:00.000Z',
    })

    expect(supabase.from).toHaveBeenCalledWith('user_dashboards')
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'dash-1',
        owner_id: 'user-1',
        title: 'Calculus',
        dashboard_type: 'dashboard',
        visibility: 'private',
        referenced_widget_ids: ['widget-1'],
      }),
      { onConflict: 'owner_id,id' },
    )
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.single).toHaveBeenCalled()
  })

  it('upserts widgets and workspace state using owner-scoped rows', async () => {
    const widgetBuilder = createQueryBuilder()
    widgetBuilder.single.mockResolvedValue({
      data: {
        id: 'widget-1',
        owner_id: 'user-1',
        name: 'Flashcards',
        category: 'Study',
        tags: ['cards'],
        description: 'Core terms',
        components: [],
        version: '1.0',
        author: '',
        created_at: '2026-06-01T10:00:00.000Z',
        updated_at: '2026-06-02T10:00:00.000Z',
        deleted_at: null,
      },
      error: null,
    })

    const stateBuilder = createQueryBuilder()
    stateBuilder.single.mockResolvedValue({
      data: {
        owner_id: 'user-1',
        selected_dashboard: 0,
        open_dashboards: [{ id: 'dash-1', name: 'Physics' }],
        study_progress: {},
        settings: {},
        updated_at: '2026-06-02T10:00:00.000Z',
      },
      error: null,
    })

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(widgetBuilder)
        .mockReturnValueOnce(stateBuilder),
    }
    const repository = createCloudRepository(supabase as never)

    await repository.upsertWidget('user-1', {
      id: 'widget-1',
      name: 'Flashcards',
      category: 'Study',
      tags: ['cards'],
      description: 'Core terms',
      components: [],
      version: '1.0',
      author: '',
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-02T10:00:00.000Z',
    })
    await repository.upsertWorkspaceState({
      ownerId: 'user-1',
      selectedDashboard: 0,
      openDashboards: [{ id: 'dash-1', name: 'Physics' }],
      studyProgress: { paths: {} },
      settings: {},
      updatedAt: '2026-06-02T10:00:00.000Z',
    })

    expect(supabase.from).toHaveBeenNthCalledWith(1, 'user_widgets')
    expect(widgetBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'widget-1',
        owner_id: 'user-1',
        components: [],
      }),
      { onConflict: 'owner_id,id' },
    )
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'user_workspace_state')
    expect(stateBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_id: 'user-1',
        selected_dashboard: '0',
        open_dashboards: [{ id: 'dash-1', name: 'Physics' }],
        settings: {},
        study_progress: { paths: {} },
      }),
      { onConflict: 'owner_id' },
    )
  })

  it('deletes dashboards from cloud storage', async () => {
    const builder = createQueryBuilder()
    const supabase = { from: vi.fn(() => builder) }
    const repository = createCloudRepository(supabase as never)

    await repository.deleteDashboard('user-1', 'dash-1')

    expect(supabase.from).toHaveBeenCalledWith('user_dashboards')
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('owner_id', 'user-1')
    expect(builder.eq).toHaveBeenCalledWith('id', 'dash-1')
  })

  it('throws a readable error when Supabase returns a failure', async () => {
    const builder = createQueryBuilder()
    builder.order.mockResolvedValue({
      data: null,
      error: { message: 'JWT expired' },
    })
    const supabase = { from: vi.fn(() => builder) }
    const repository = createCloudRepository(supabase as never)

    await expect(repository.listDashboards('user-1')).rejects.toThrow(
      'JWT expired',
    )
  })
})
