-- StudyMesh Supabase cascade repair
-- Run once if deleting an Auth user did not remove their dashboards/widgets.
--
-- Why this exists:
-- `create table if not exists` does not retrofit foreign keys onto tables that
-- already existed. This script removes orphaned rows, then recreates the FK
-- constraints with `on delete cascade`.

begin;

create table if not exists public.user_study_guides (
  id text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  folder_name text not null default 'Study Guide',
  description text,
  study_path jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

-- Remove rows for profiles/Auth users that no longer exist. App tables are
-- profile-owned, and profiles cascade from auth.users.
delete from public.user_widget_versions
where owner_id not in (select id from auth.users);

delete from public.user_widget_versions
where owner_id not in (select id from public.profiles);

delete from public.user_widget_versions versions
where not exists (
  select 1
  from public.user_widgets widgets
  where widgets.owner_id = versions.owner_id
    and widgets.id = versions.widget_id
);

delete from public.user_dashboards
where owner_id not in (select id from auth.users);

delete from public.user_dashboards
where owner_id not in (select id from public.profiles);

delete from public.user_study_guides
where owner_id not in (select id from auth.users);

delete from public.user_study_guides
where owner_id not in (select id from public.profiles);

delete from public.user_widgets
where owner_id not in (select id from auth.users);

delete from public.user_widgets
where owner_id not in (select id from public.profiles);

delete from public.user_workspace_state
where owner_id not in (select id from auth.users);

delete from public.user_workspace_state
where owner_id not in (select id from public.profiles);

delete from public.profiles
where id not in (select id from auth.users);

-- Recreate profile ownership foreign keys with cascade behavior.
alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id)
  references auth.users(id)
  on delete cascade;

alter table public.user_dashboards
  drop constraint if exists user_dashboards_owner_id_fkey;

alter table public.user_dashboards
  add constraint user_dashboards_owner_id_fkey
  foreign key (owner_id)
  references public.profiles(id)
  on delete cascade;

alter table public.user_widgets
  drop constraint if exists user_widgets_owner_id_fkey;

alter table public.user_widgets
  add constraint user_widgets_owner_id_fkey
  foreign key (owner_id)
  references public.profiles(id)
  on delete cascade;

alter table public.user_study_guides
  drop constraint if exists user_study_guides_owner_id_fkey;

alter table public.user_study_guides
  add constraint user_study_guides_owner_id_fkey
  foreign key (owner_id)
  references public.profiles(id)
  on delete cascade;

alter table public.user_widget_versions
  drop constraint if exists user_widget_versions_owner_id_fkey;

alter table public.user_widget_versions
  add constraint user_widget_versions_owner_id_fkey
  foreign key (owner_id)
  references public.profiles(id)
  on delete cascade;

alter table public.user_widget_versions
  drop constraint if exists user_widget_versions_owner_id_widget_id_fkey;

alter table public.user_widget_versions
  add constraint user_widget_versions_owner_id_widget_id_fkey
  foreign key (owner_id, widget_id)
  references public.user_widgets(owner_id, id)
  on delete cascade;

alter table public.user_workspace_state
  drop constraint if exists user_workspace_state_owner_id_fkey;

alter table public.user_workspace_state
  add constraint user_workspace_state_owner_id_fkey
  foreign key (owner_id)
  references public.profiles(id)
  on delete cascade;

commit;
