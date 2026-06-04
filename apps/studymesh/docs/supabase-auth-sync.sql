-- StudyMesh Supabase Auth + Cloud Sync schema
-- Run in Supabase SQL editor after creating the project.
-- Browser clients must use the anon key only. Never expose the service role key.

begin;

create extension if not exists pgcrypto;

-- Keep updated_at fresh for mutable rows.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Public user metadata. One row per auth.users row.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_path text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('user', 'admin'))
);

-- Dashboard JSON, owned by one user. `layout` stores app-native dashboard data.
create table if not exists public.user_dashboards (
  id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  dashboard_type text,
  visibility text not null default 'private',
  layout jsonb not null default '{}'::jsonb,
  referenced_widget_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (owner_id, id),
  constraint user_dashboards_visibility_check check (visibility in ('private'))
);

-- Custom widget JSON, owned by one user. `components` stores app-native widget state.
create table if not exists public.user_widgets (
  id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  widget_type text,
  components jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (owner_id, id)
);

-- Historical widget snapshots for restore/version UI.
create table if not exists public.user_widget_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  widget_id text not null,
  version integer not null,
  title text,
  components jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  unique (owner_id, widget_id, version),
  foreign key (owner_id, widget_id)
    references public.user_widgets(owner_id, id)
    on delete cascade
);

-- Per-user workspace preferences/progress/open tabs.
create table if not exists public.user_workspace_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  selected_dashboard text,
  open_dashboards jsonb not null default '[]'::jsonb,
  study_progress jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists user_dashboards_set_updated_at on public.user_dashboards;
create trigger user_dashboards_set_updated_at
before update on public.user_dashboards
for each row execute function public.set_updated_at();

drop trigger if exists user_widgets_set_updated_at on public.user_widgets;
create trigger user_widgets_set_updated_at
before update on public.user_widgets
for each row execute function public.set_updated_at();

drop trigger if exists user_workspace_state_set_updated_at on public.user_workspace_state;
create trigger user_workspace_state_set_updated_at
before update on public.user_workspace_state
for each row execute function public.set_updated_at();

-- Indexes for owner fetches, recent-sync ordering, soft-delete filtering.
create index if not exists profiles_email_idx
  on public.profiles(email);

create index if not exists user_dashboards_owner_updated_idx
  on public.user_dashboards(owner_id, updated_at desc);

create index if not exists user_dashboards_owner_deleted_idx
  on public.user_dashboards(owner_id, deleted_at);

create index if not exists user_dashboards_owner_visibility_idx
  on public.user_dashboards(owner_id, visibility);

create index if not exists user_dashboards_referenced_widget_ids_gin_idx
  on public.user_dashboards using gin(referenced_widget_ids);

create index if not exists user_widgets_owner_updated_idx
  on public.user_widgets(owner_id, updated_at desc);

create index if not exists user_widgets_owner_deleted_idx
  on public.user_widgets(owner_id, deleted_at);

create index if not exists user_widget_versions_owner_widget_version_idx
  on public.user_widget_versions(owner_id, widget_id, version desc);

create index if not exists user_workspace_state_updated_idx
  on public.user_workspace_state(updated_at desc);

-- Optional profile bootstrap. Safe if app also upserts profile on login.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_path)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        avatar_path = coalesce(public.profiles.avatar_path, excluded.avatar_path);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Row level security
alter table public.profiles enable row level security;
alter table public.user_dashboards enable row level security;
alter table public.user_widgets enable row level security;
alter table public.user_widget_versions enable row level security;
alter table public.user_workspace_state enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "user_dashboards_select_own" on public.user_dashboards;
create policy "user_dashboards_select_own"
on public.user_dashboards for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "user_dashboards_insert_own" on public.user_dashboards;
create policy "user_dashboards_insert_own"
on public.user_dashboards for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "user_dashboards_update_own" on public.user_dashboards;
create policy "user_dashboards_update_own"
on public.user_dashboards for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "user_dashboards_delete_own" on public.user_dashboards;
create policy "user_dashboards_delete_own"
on public.user_dashboards for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists "user_widgets_select_own" on public.user_widgets;
create policy "user_widgets_select_own"
on public.user_widgets for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "user_widgets_insert_own" on public.user_widgets;
create policy "user_widgets_insert_own"
on public.user_widgets for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "user_widgets_update_own" on public.user_widgets;
create policy "user_widgets_update_own"
on public.user_widgets for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "user_widgets_delete_own" on public.user_widgets;
create policy "user_widgets_delete_own"
on public.user_widgets for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists "user_widget_versions_select_own" on public.user_widget_versions;
create policy "user_widget_versions_select_own"
on public.user_widget_versions for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "user_widget_versions_insert_own" on public.user_widget_versions;
create policy "user_widget_versions_insert_own"
on public.user_widget_versions for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "user_widget_versions_update_own" on public.user_widget_versions;
create policy "user_widget_versions_update_own"
on public.user_widget_versions for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "user_widget_versions_delete_own" on public.user_widget_versions;
create policy "user_widget_versions_delete_own"
on public.user_widget_versions for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists "user_workspace_state_select_own" on public.user_workspace_state;
create policy "user_workspace_state_select_own"
on public.user_workspace_state for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "user_workspace_state_insert_own" on public.user_workspace_state;
create policy "user_workspace_state_insert_own"
on public.user_workspace_state for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "user_workspace_state_update_own" on public.user_workspace_state;
create policy "user_workspace_state_update_own"
on public.user_workspace_state for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "user_workspace_state_delete_own" on public.user_workspace_state;
create policy "user_workspace_state_delete_own"
on public.user_workspace_state for delete
to authenticated
using (owner_id = auth.uid());

-- Storage notes for avatar bucket:
-- 1. Create private bucket named `avatars` in Supabase Storage.
-- 2. Store files at `${auth.uid()}/avatar.<ext>`.
-- 3. Use policies like below after bucket exists.
--
-- create policy "avatars_select_own"
-- on storage.objects for select
-- to authenticated
-- using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
--
-- create policy "avatars_insert_own"
-- on storage.objects for insert
-- to authenticated
-- with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
--
-- create policy "avatars_update_own"
-- on storage.objects for update
-- to authenticated
-- using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
-- with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
--
-- create policy "avatars_delete_own"
-- on storage.objects for delete
-- to authenticated
-- using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
