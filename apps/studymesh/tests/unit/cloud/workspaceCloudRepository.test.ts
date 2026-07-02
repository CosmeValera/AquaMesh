import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
    expect(builder.select).not.toHaveBeenCalled()
    expect(builder.single).not.toHaveBeenCalled()
  })

  it('deletes the signed-in StudyMesh profile row', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: 1,
        error: null,
      }),
    }
    const repository = createCloudRepository(supabase as never)

    await repository.deleteProfile('user-1')

    expect(supabase.rpc).toHaveBeenCalledWith('delete_own_profile')
  })

  it('reports a zero-count StudyMesh profile delete', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: 0,
        error: null,
      }),
    }
    const repository = createCloudRepository(supabase as never)

    await expect(repository.deleteProfile('user-1')).rejects.toThrow(
      /delete_own_profile/i,
    )
  })

  it('reports a Supabase RPC failure when deleting the StudyMesh profile row', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not authenticated' },
      }),
    }
    const repository = createCloudRepository(supabase as never)

    await expect(repository.deleteProfile('user-1')).rejects.toThrow(
      'Not authenticated',
    )
  })

  it('keeps the StudyMesh profile delete RPC in the Supabase schema', () => {
    const sqlPath = resolve(process.cwd(), 'docs/supabase-auth-sync.sql')
    const sql = readFileSync(sqlPath, 'utf8').replace(/\s+/g, ' ')

    expect(sql).toContain(
      'create or replace function public.delete_own_profile()',
    )
    expect(sql).toContain('insert into public.hosted_ai_account_history')
    expect(sql).toContain(
      'on conflict on constraint hosted_ai_account_history_pkey do update',
    )
    expect(sql).toContain('set last_profile_deleted_at = now()')
    expect(sql).toContain('delete from public.profiles where id = auth.uid()')
    expect(sql).toContain('get diagnostics deleted_count = row_count')
    expect(sql).toContain(
      'grant execute on function public.delete_own_profile() to authenticated',
    )
  })

  it('keeps recreated StudyMesh profiles from receiving another initial hosted credit grant', () => {
    const sqlPath = resolve(process.cwd(), 'docs/supabase-auth-sync.sql')
    const sql = readFileSync(sqlPath, 'utf8').replace(/\s+/g, ' ')

    expect(sql).toContain(
      'create table if not exists public.hosted_ai_account_history',
    )
    expect(sql).toContain(
      'owner_id uuid primary key references auth.users(id) on delete cascade',
    )
    expect(sql).toContain('last_profile_deleted_at timestamptz')
    expect(sql).toContain(
      'when exists ( select 1 from public.hosted_ai_account_history history where history.owner_id = p_owner_id and history.last_profile_deleted_at is not null ) then 0 else 20',
    )
    expect(sql).toContain(
      'insert into public.profiles (id) values (p_owner_id) on conflict (id) do nothing',
    )
    expect(sql).toContain(
      'on conflict on constraint hosted_ai_account_history_pkey do update',
    )
    expect(sql).not.toContain('on conflict (owner_id) do update')
    expect(sql).toContain(
      'when exists ( select 1 from public.hosted_ai_account_history history where history.owner_id = new.id and history.last_profile_deleted_at is not null ) then 0 else 20',
    )
    expect(sql).not.toContain(
      'update public.hosted_ai_accounts account set study_credit_balance = greatest(account.study_credit_balance, 5)',
    )
  })

  it('keeps Study Credits from increasing outside completed purchases', () => {
    const sqlPath = resolve(process.cwd(), 'docs/supabase-auth-sync.sql')
    const sql = readFileSync(sqlPath, 'utf8').replace(/\s+/g, ' ')

    expect(sql).toContain(
      'create or replace function public.hosted_ai_finish_usage',
    )
    expect(sql).not.toContain(
      'study_credit_balance = account.study_credit_balance + refund_amount',
    )
    expect(sql).not.toContain(
      'study_credit_balance = greatest(account.study_credit_balance, 5)',
    )
    expect(sql).toContain('credits_refunded = event.credits_refunded')
    expect(sql).toContain(
      'set study_credit_balance = account.study_credit_balance + purchase.expected_credits',
    )
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

  it('upserts and deletes Study Guides as owner-scoped cloud rows', async () => {
    const upsertBuilder = createQueryBuilder()
    upsertBuilder.single.mockResolvedValue({
      data: {
        id: 'guide-1',
        owner_id: 'user-1',
        title: 'Physics Guide',
        folder_name: 'Physics',
        description: null,
        emoji: '⚛️',
        page_count: 0,
        first_page_title: null,
        study_path: {
          pathId: 'guide-1',
          title: 'Physics Guide',
          folderName: 'Physics',
          emoji: '⚛️',
          selectedIndex: 0,
          dashboards: [],
        },
        created_at: '2026-06-01T10:00:00.000Z',
        updated_at: '2026-06-02T10:00:00.000Z',
      },
      error: null,
    })
    const deleteBuilder = createQueryBuilder()
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(upsertBuilder)
        .mockReturnValueOnce(deleteBuilder),
    }
    const repository = createCloudRepository(supabase as never)

    const savedGuide = await repository.upsertStudyGuide('user-1', {
      id: 'guide-1',
      title: 'Physics Guide',
      folderName: 'Physics',
      emoji: '⚛️',
      studyPath: {
        pathId: 'guide-1',
        title: 'Physics Guide',
        folderName: 'Physics',
        emoji: '⚛️',
        selectedIndex: 0,
        dashboards: [],
      },
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-02T10:00:00.000Z',
    })
    await repository.deleteStudyGuide('user-1', 'guide-1')

    expect(savedGuide.emoji).toBe('⚛️')
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'user_study_guides')
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'guide-1',
        owner_id: 'user-1',
        title: 'Physics Guide',
        folder_name: 'Physics',
        emoji: '⚛️',
        page_count: 0,
        first_page_title: null,
      }),
      { onConflict: 'owner_id,id' },
    )
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'user_study_guides')
    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith('owner_id', 'user-1')
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'guide-1')
  })

  it('loads Study Guide library metadata without requiring full study paths', async () => {
    const profileBuilder = createQueryBuilder()
    const dashboardBuilder = createQueryBuilder()
    const studyGuideBuilder = createQueryBuilder()
    const widgetBuilder = createQueryBuilder()
    const widgetVersionBuilder = createQueryBuilder()
    const workspaceStateBuilder = createQueryBuilder()

    profileBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })
    dashboardBuilder.order.mockResolvedValue({ data: [], error: null })
    studyGuideBuilder.order.mockResolvedValue({
      data: [
        {
          id: 'guide-1',
          owner_id: 'user-1',
          title: 'Cloud Algebra',
          folder_name: 'Algebra',
          description: 'Linear equations prompt',
          emoji: '🔢',
          page_count: 3,
          first_page_title: 'Intro',
          created_at: '2026-06-01T10:00:00.000Z',
          updated_at: '2026-06-02T10:00:00.000Z',
        },
      ],
      error: null,
    })
    widgetBuilder.order.mockResolvedValue({ data: [], error: null })
    widgetVersionBuilder.order.mockResolvedValue({ data: [], error: null })
    workspaceStateBuilder.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    })
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(profileBuilder)
        .mockReturnValueOnce(dashboardBuilder)
        .mockReturnValueOnce(studyGuideBuilder)
        .mockReturnValueOnce(widgetBuilder)
        .mockReturnValueOnce(widgetVersionBuilder)
        .mockReturnValueOnce(workspaceStateBuilder),
    }
    const repository = createCloudRepository(supabase as never)

    const bundle = await repository.loadWorkspaceBundle('user-1')

    expect(studyGuideBuilder.select).toHaveBeenCalledWith(
      'id,owner_id,title,folder_name,description,emoji,page_count,first_page_title,created_at,updated_at',
    )
    expect(bundle.studyGuides).toEqual([
      expect.objectContaining({
        id: 'guide-1',
        title: 'Cloud Algebra',
        folderName: 'Algebra',
        description: 'Linear equations prompt',
        pageCount: 3,
        firstPageTitle: 'Intro',
      }),
    ])
  })

  it('deletes widgets and their version history from cloud storage', async () => {
    const versionBuilder = createQueryBuilder()
    const widgetBuilder = createQueryBuilder()
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(versionBuilder)
        .mockReturnValueOnce(widgetBuilder),
    }
    const repository = createCloudRepository(supabase as never)

    await repository.deleteWidgetVersions('user-1', 'widget-1')
    await repository.deleteWidget('user-1', 'widget-1')

    expect(supabase.from).toHaveBeenNthCalledWith(1, 'user_widget_versions')
    expect(versionBuilder.delete).toHaveBeenCalled()
    expect(versionBuilder.eq).toHaveBeenCalledWith('owner_id', 'user-1')
    expect(versionBuilder.eq).toHaveBeenCalledWith('widget_id', 'widget-1')
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'user_widgets')
    expect(widgetBuilder.delete).toHaveBeenCalled()
    expect(widgetBuilder.eq).toHaveBeenCalledWith('owner_id', 'user-1')
    expect(widgetBuilder.eq).toHaveBeenCalledWith('id', 'widget-1')
  })

  it('keeps user and widget cascade deletion in the Supabase schema', () => {
    const sqlPath = resolve(process.cwd(), 'docs/supabase-auth-sync.sql')
    const sql = readFileSync(sqlPath, 'utf8').replace(/\s+/g, ' ')

    expect(sql).toContain(
      'profiles ( id uuid primary key references auth.users(id) on delete cascade',
    )
    expect(sql).toContain(
      'owner_id uuid not null references public.profiles(id) on delete cascade',
    )
    expect(sql).toContain(
      'owner_id uuid primary key references public.profiles(id) on delete cascade',
    )
    expect(sql).toContain(
      'create table if not exists public.hosted_ai_account_history',
    )
    expect(sql).toContain(
      'references public.user_widgets(owner_id, id) on delete cascade',
    )
    expect(sql).toContain(
      'create policy "profiles_delete_own" on public.profiles for delete to authenticated using (id = auth.uid())',
    )
    expect(sql).toContain('create table if not exists public.user_study_guides')
    expect(sql).toContain('primary key (owner_id, id)')
  })

  it('keeps a Supabase cascade repair script for existing projects', () => {
    const sqlPath = resolve(
      process.cwd(),
      'docs/supabase-repair-delete-cascade.sql',
    )
    const sql = readFileSync(sqlPath, 'utf8').replace(/\s+/g, ' ')

    expect(sql).toContain('delete from public.user_dashboards')
    expect(sql).toContain('delete from public.user_study_guides')
    expect(sql).toContain('delete from public.user_widgets')
    expect(sql).toContain('delete from public.user_widget_versions')
    expect(sql).toContain(
      'where owner_id not in (select id from public.profiles)',
    )
    expect(sql).toContain('references auth.users(id) on delete cascade')
    expect(sql).toContain('references public.profiles(id) on delete cascade')
    expect(sql).toContain(
      'references public.user_widgets(owner_id, id) on delete cascade',
    )
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
