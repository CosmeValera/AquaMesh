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
  owner_id uuid not null references public.profiles(id) on delete cascade,
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

-- Study Guide JSON, owned by one user. Lessons store embedded dashboard/widget data.
create table if not exists public.user_study_guides (
  id text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  folder_name text not null default 'Study Guide',
  description text,
  emoji text,
  page_count integer,
  first_page_title text,
  study_path jsonb not null default '{}'::jsonb,
  pinned_at timestamptz,
  retention_candidate_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

alter table public.user_study_guides
  add column if not exists emoji text,
  add column if not exists page_count integer,
  add column if not exists first_page_title text,
  add column if not exists pinned_at timestamptz,
  add column if not exists retention_candidate_at timestamptz;

update public.user_study_guides
set
  page_count = coalesce(jsonb_array_length(study_path -> 'dashboards'), 0),
  first_page_title = study_path -> 'dashboards' -> 0 ->> 'name'
where page_count is null
  and jsonb_typeof(study_path -> 'dashboards') = 'array';

-- Custom widget JSON, owned by one user. `components` stores app-native widget state.
create table if not exists public.user_widgets (
  id text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
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
  owner_id uuid not null references public.profiles(id) on delete cascade,
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
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  selected_dashboard text,
  open_dashboards jsonb not null default '[]'::jsonb,
  study_progress jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hosted AI Study Credits. One account per signed-in user so quota follows
-- the Supabase account across devices.
create table if not exists public.hosted_ai_accounts (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  study_credit_balance integer not null default 30,
  intro_seen boolean not null default false,
  last_daily_refill_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hosted_ai_accounts_nonnegative_balance_check
    check (study_credit_balance >= 0)
);

alter table public.hosted_ai_accounts
  alter column study_credit_balance set default 30;

-- Auth-user-backed history. This survives StudyMesh profile deletion so
-- recreating the profile cannot mint another first-login credit grant. It still
-- cascades if the underlying Supabase Auth user is removed.
create table if not exists public.hosted_ai_account_history (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  first_profile_created_at timestamptz not null default now(),
  last_profile_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auth-user lifecycle onboarding. Rows are created only when the Supabase Auth
-- user is first created, so deleting/recreating the StudyMesh profile does not
-- re-arm first-run onboarding.
create table if not exists public.account_onboarding_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  welcome_guide_pending boolean not null default true,
  welcome_guide_seeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Audit trail for hosted AI gateway usage. The browser may read its own
-- events, but writes are reserved for the Vercel gateway through service role
-- RPCs so users cannot mint or spend credits directly from the client.
create table if not exists public.hosted_ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  request_id text not null,
  surface text not null,
  credits_charged integer not null,
  credits_refunded integer not null default 0,
  status text not null default 'reserved',
  provider text,
  model text,
  provider_call_count integer not null default 0,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (owner_id, request_id),
  constraint hosted_ai_usage_events_surface_check
    check (surface in ('study-guide', 'quick-create', 'chat', 'podcast')),
  constraint hosted_ai_usage_events_status_check
    check (status in ('reserved', 'succeeded', 'failed')),
  constraint hosted_ai_usage_events_nonnegative_credits_check
    check (credits_charged >= 0 and credits_refunded >= 0),
  constraint hosted_ai_usage_events_refund_check
    check (credits_refunded <= credits_charged),
  constraint hosted_ai_usage_events_provider_call_count_check
    check (provider_call_count >= 0)
);

-- One-time Stripe Checkout credit refills. The browser creates pending rows
-- through the billing API, but credits are granted only by verified webhook RPC.
create table if not exists public.hosted_ai_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  expected_credits integer not null,
  expected_amount integer not null,
  expected_currency text not null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  credited_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hosted_ai_credit_purchases_status_check
    check (status in ('pending', 'checkout_created', 'paid', 'failed', 'expired')),
  constraint hosted_ai_credit_purchases_expected_credits_check
    check (expected_credits > 0),
  constraint hosted_ai_credit_purchases_expected_amount_check
    check (expected_amount > 0),
  constraint hosted_ai_credit_purchases_expected_currency_check
    check (expected_currency = lower(expected_currency))
);

-- Monthly TTS character accounting for Study Guide podcast audio. This caps
-- app-side Unreal Speech free-tier use before a provider request is made.
create table if not exists public.podcast_tts_monthly_usage (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  usage_month text not null,
  characters_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, usage_month),
  constraint podcast_tts_monthly_usage_month_check
    check (usage_month ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint podcast_tts_monthly_usage_nonnegative_check
    check (characters_used >= 0)
);

create table if not exists public.podcast_audio_objects (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  audio_path text not null,
  study_guide_id text,
  podcast_id text,
  candidate_at timestamptz,
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, audio_path),
  constraint podcast_audio_objects_path_owner_check
    check (audio_path like owner_id::text || '/%'),
  constraint podcast_audio_objects_deleted_reason_check
    check (
      deleted_reason is null
      or deleted_reason in (
        'expired',
        'page-deleted',
        'study-guide-expired',
        'study-guide-deleted'
      )
    )
);

alter table public.podcast_audio_objects
  drop constraint if exists podcast_audio_objects_deleted_reason_check;

alter table public.podcast_audio_objects
  add constraint podcast_audio_objects_deleted_reason_check
  check (
    deleted_reason is null
    or deleted_reason in (
      'expired',
      'page-deleted',
      'study-guide-expired',
      'study-guide-deleted'
    )
  );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'study-guide-podcasts',
  'study-guide-podcasts',
  false,
  15000000,
  array['audio/mpeg']
)
on conflict (id) do update
set public = false,
    file_size_limit = 15000000,
    allowed_mime_types = array['audio/mpeg'];

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists user_dashboards_set_updated_at on public.user_dashboards;
create trigger user_dashboards_set_updated_at
before update on public.user_dashboards
for each row execute function public.set_updated_at();

drop trigger if exists user_study_guides_set_updated_at on public.user_study_guides;
create trigger user_study_guides_set_updated_at
before update on public.user_study_guides
for each row execute function public.set_updated_at();

drop trigger if exists user_widgets_set_updated_at on public.user_widgets;
create trigger user_widgets_set_updated_at
before update on public.user_widgets
for each row execute function public.set_updated_at();

drop trigger if exists user_workspace_state_set_updated_at on public.user_workspace_state;
create trigger user_workspace_state_set_updated_at
before update on public.user_workspace_state
for each row execute function public.set_updated_at();

drop trigger if exists hosted_ai_accounts_set_updated_at on public.hosted_ai_accounts;
create trigger hosted_ai_accounts_set_updated_at
before update on public.hosted_ai_accounts
for each row execute function public.set_updated_at();

drop trigger if exists hosted_ai_account_history_set_updated_at on public.hosted_ai_account_history;
create trigger hosted_ai_account_history_set_updated_at
before update on public.hosted_ai_account_history
for each row execute function public.set_updated_at();

drop trigger if exists account_onboarding_state_set_updated_at on public.account_onboarding_state;
create trigger account_onboarding_state_set_updated_at
before update on public.account_onboarding_state
for each row execute function public.set_updated_at();

drop trigger if exists hosted_ai_usage_events_set_updated_at on public.hosted_ai_usage_events;
create trigger hosted_ai_usage_events_set_updated_at
before update on public.hosted_ai_usage_events
for each row execute function public.set_updated_at();

drop trigger if exists hosted_ai_credit_purchases_set_updated_at on public.hosted_ai_credit_purchases;
create trigger hosted_ai_credit_purchases_set_updated_at
before update on public.hosted_ai_credit_purchases
for each row execute function public.set_updated_at();

drop trigger if exists podcast_tts_monthly_usage_set_updated_at on public.podcast_tts_monthly_usage;
create trigger podcast_tts_monthly_usage_set_updated_at
before update on public.podcast_tts_monthly_usage
for each row execute function public.set_updated_at();

drop trigger if exists podcast_audio_objects_set_updated_at on public.podcast_audio_objects;
create trigger podcast_audio_objects_set_updated_at
before update on public.podcast_audio_objects
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

create index if not exists user_study_guides_owner_updated_idx
  on public.user_study_guides(owner_id, updated_at desc);

create index if not exists user_study_guides_owner_retention_idx
  on public.user_study_guides(owner_id, pinned_at desc, created_at desc);

create index if not exists user_study_guides_retention_candidates_idx
  on public.user_study_guides(owner_id, retention_candidate_at, created_at)
  where retention_candidate_at is not null;

create index if not exists user_widgets_owner_updated_idx
  on public.user_widgets(owner_id, updated_at desc);

create index if not exists user_widgets_owner_deleted_idx
  on public.user_widgets(owner_id, deleted_at);

create index if not exists user_widget_versions_owner_widget_version_idx
  on public.user_widget_versions(owner_id, widget_id, version desc);

create index if not exists user_workspace_state_updated_idx
  on public.user_workspace_state(updated_at desc);

create index if not exists hosted_ai_accounts_updated_idx
  on public.hosted_ai_accounts(updated_at desc);

create index if not exists hosted_ai_account_history_deleted_idx
  on public.hosted_ai_account_history(last_profile_deleted_at);

create index if not exists account_onboarding_state_pending_idx
  on public.account_onboarding_state(owner_id, welcome_guide_pending)
  where welcome_guide_pending = true;

create index if not exists hosted_ai_usage_events_owner_created_idx
  on public.hosted_ai_usage_events(owner_id, created_at desc);

create index if not exists hosted_ai_usage_events_owner_status_idx
  on public.hosted_ai_usage_events(owner_id, status);

create index if not exists hosted_ai_credit_purchases_owner_created_idx
  on public.hosted_ai_credit_purchases(owner_id, created_at desc);

create index if not exists hosted_ai_credit_purchases_session_idx
  on public.hosted_ai_credit_purchases(stripe_checkout_session_id);

create index if not exists podcast_tts_monthly_usage_owner_month_idx
  on public.podcast_tts_monthly_usage(owner_id, usage_month);

create index if not exists podcast_audio_objects_owner_created_idx
  on public.podcast_audio_objects(owner_id, created_at desc);

create index if not exists podcast_audio_objects_expired_candidates_idx
  on public.podcast_audio_objects(owner_id, candidate_at, created_at)
  where deleted_at is null and candidate_at is not null;

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

  insert into public.hosted_ai_accounts (owner_id, study_credit_balance)
  values (
    new.id,
    case
      when exists (
        select 1
        from public.hosted_ai_account_history history
        where history.owner_id = new.id
          and history.last_profile_deleted_at is not null
      )
      then 0
      else 30
    end
  )
  on conflict on constraint hosted_ai_accounts_pkey do nothing;

  insert into public.hosted_ai_account_history (owner_id)
  values (new.id)
  on conflict on constraint hosted_ai_account_history_pkey do update
    set first_profile_created_at = public.hosted_ai_account_history.first_profile_created_at;

  insert into public.account_onboarding_state (owner_id)
  values (new.id)
  on conflict on constraint account_onboarding_state_pkey do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Frontend-safe profile deletion. This deletes only the signed-in StudyMesh
-- profile row and returns the real row count so the app can verify cleanup.
create or replace function public.delete_own_profile()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.hosted_ai_account_history (
    owner_id,
    last_profile_deleted_at
  )
  values (auth.uid(), now())
  on conflict on constraint hosted_ai_account_history_pkey do update
    set last_profile_deleted_at = now();

  delete from public.profiles
  where id = auth.uid();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_own_profile() from public;
grant execute on function public.delete_own_profile() to authenticated;

create or replace function public.seed_own_welcome_guide(study_guide jsonb)
returns table (
  seed_status text,
  seeded_study_guide jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_owner uuid := auth.uid();
  onboarding public.account_onboarding_state%rowtype;
  existing_guide public.user_study_guides%rowtype;
  inserted_guide public.user_study_guides%rowtype;
  guide_path jsonb := study_guide -> 'studyPath';
  guide_id text := study_guide ->> 'id';
  created_at_value timestamptz := coalesce(nullif(study_guide ->> 'createdAt', '')::timestamptz, now());
  updated_at_value timestamptz := coalesce(nullif(study_guide ->> 'updatedAt', '')::timestamptz, created_at_value);
  dashboard_count integer := 0;
  first_title text := null;
begin
  if current_owner is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into onboarding
  from public.account_onboarding_state
  where owner_id = current_owner
  for update;

  if not found then
    seed_status := 'not-eligible';
    seeded_study_guide := null;
    return next;
    return;
  end if;

  if onboarding.welcome_guide_pending is not true
     or onboarding.welcome_guide_seeded_at is not null then
    seed_status := 'already-seeded';
    seeded_study_guide := null;
    return next;
    return;
  end if;

  if guide_id <> 'studymesh-student-knowledge-wiki-a-beginner-s-guide' then
    raise exception 'Invalid welcome guide id';
  end if;

  if jsonb_typeof(guide_path) <> 'object' then
    raise exception 'Invalid welcome guide payload';
  end if;

  if jsonb_typeof(guide_path -> 'dashboards') = 'array' then
    dashboard_count := jsonb_array_length(guide_path -> 'dashboards');
    first_title := guide_path -> 'dashboards' -> 0 ->> 'name';
  end if;

  insert into public.user_study_guides (
    id,
    owner_id,
    title,
    folder_name,
    description,
    emoji,
    page_count,
    first_page_title,
    study_path,
    pinned_at,
    retention_candidate_at,
    created_at,
    updated_at
  )
  values (
    guide_id,
    current_owner,
    study_guide ->> 'title',
    coalesce(study_guide ->> 'folderName', 'StudyMesh Guide'),
    nullif(study_guide ->> 'description', ''),
    nullif(study_guide ->> 'emoji', ''),
    dashboard_count,
    first_title,
    guide_path,
    null,
    null,
    created_at_value,
    updated_at_value
  )
  on conflict (owner_id, id) do nothing
  returning * into inserted_guide;

  if inserted_guide.id is null then
    select *
    into existing_guide
    from public.user_study_guides
    where owner_id = current_owner
      and id = guide_id;

    seed_status := 'already-exists';
  else
    existing_guide := inserted_guide;
    seed_status := 'seeded';
  end if;

  update public.account_onboarding_state
  set welcome_guide_pending = false,
      welcome_guide_seeded_at = coalesce(welcome_guide_seeded_at, now())
  where owner_id = current_owner;

  seeded_study_guide := to_jsonb(existing_guide);
  return next;
end;
$$;

revoke all on function public.seed_own_welcome_guide(jsonb) from public;
grant execute on function public.seed_own_welcome_guide(jsonb) to authenticated;

create or replace function public.hosted_ai_credit_cost(p_surface text)
returns integer
language sql
immutable
as $$
  select case p_surface
    when 'study-guide' then 3
    when 'quick-create' then 1
    when 'chat' then 1
    when 'podcast' then 1
    else null
  end
$$;

create or replace function public.hosted_ai_get_or_create_account(p_owner_id uuid)
returns table (
  owner_id uuid,
  study_credit_balance integer,
  intro_seen boolean,
  last_daily_refill_date date,
  next_daily_refill_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (p_owner_id)
  on conflict (id) do nothing;

  insert into public.hosted_ai_accounts (owner_id, study_credit_balance)
  values (
    p_owner_id,
    case
      when exists (
        select 1
        from public.hosted_ai_account_history history
        where history.owner_id = p_owner_id
          and history.last_profile_deleted_at is not null
      )
      then 0
      else 30
    end
  )
  on conflict on constraint hosted_ai_accounts_pkey do nothing;

  insert into public.hosted_ai_account_history (owner_id)
  values (p_owner_id)
  on conflict on constraint hosted_ai_account_history_pkey do update
    set first_profile_created_at = public.hosted_ai_account_history.first_profile_created_at;

  update public.hosted_ai_accounts account
  set study_credit_balance = case
        when account.study_credit_balance < 7
        then greatest(account.study_credit_balance, 7)
        else account.study_credit_balance
      end,
      last_daily_refill_date = current_date
  where account.owner_id = p_owner_id
    and account.last_daily_refill_date < current_date;

  return query
  select account.owner_id,
         account.study_credit_balance,
         account.intro_seen,
         account.last_daily_refill_date,
         (account.last_daily_refill_date + 1)::timestamptz
  from public.hosted_ai_accounts account
  where account.owner_id = p_owner_id;
end;
$$;

create or replace function public.hosted_ai_mark_intro_seen(p_owner_id uuid)
returns table (
  owner_id uuid,
  study_credit_balance integer,
  intro_seen boolean,
  last_daily_refill_date date,
  next_daily_refill_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.hosted_ai_get_or_create_account(p_owner_id);

  update public.hosted_ai_accounts account
  set intro_seen = true
  where account.owner_id = p_owner_id;

  return query
  select account.owner_id,
         account.study_credit_balance,
         account.intro_seen,
         account.last_daily_refill_date,
         (account.last_daily_refill_date + 1)::timestamptz
  from public.hosted_ai_accounts account
  where account.owner_id = p_owner_id;
end;
$$;

create or replace function public.hosted_ai_begin_usage(
  p_owner_id uuid,
  p_request_id text,
  p_surface text,
  p_provider text default null,
  p_model text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  event_id uuid,
  owner_id uuid,
  request_id text,
  surface text,
  credits_charged integer,
  study_credit_balance integer,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  credit_cost integer;
  current_balance integer;
  recent_risky_attempt_count integer := 0;
begin
  if p_request_id is null or btrim(p_request_id) = '' then
    raise exception 'request_id is required';
  end if;

  credit_cost := public.hosted_ai_credit_cost(p_surface);
  if credit_cost is null then
    raise exception 'invalid hosted AI surface: %', p_surface;
  end if;

  perform 1
  from public.hosted_ai_get_or_create_account(p_owner_id);

  return query
  select event.id,
         event.owner_id,
         event.request_id,
         event.surface,
         event.credits_charged,
         account.study_credit_balance,
         event.status
  from public.hosted_ai_usage_events event
  join public.hosted_ai_accounts account on account.owner_id = event.owner_id
  where event.owner_id = p_owner_id
    and event.request_id = p_request_id;

  if found then
    return;
  end if;

  if p_surface = 'study-guide' then
    select count(*)::integer
    into recent_risky_attempt_count
    from public.hosted_ai_usage_events event
    where event.owner_id = p_owner_id
      and event.surface = 'study-guide'
      and event.status in ('reserved', 'failed')
      and event.created_at >= now() - interval '10 minutes';

    if recent_risky_attempt_count >= 6 then
      raise exception 'Hosted Study Guide retry limit reached. Try again later.';
    end if;
  end if;

  select account.study_credit_balance
  into current_balance
  from public.hosted_ai_accounts account
  where account.owner_id = p_owner_id
  for update;

  if current_balance < credit_cost then
    raise exception 'insufficient Study Credits';
  end if;

  update public.hosted_ai_accounts account
  set study_credit_balance = account.study_credit_balance - credit_cost
  where account.owner_id = p_owner_id
  returning account.study_credit_balance into current_balance;

  with inserted_event as (
    insert into public.hosted_ai_usage_events (
      owner_id,
      request_id,
      surface,
      credits_charged,
      provider,
      model,
      metadata
    )
    values (
      p_owner_id,
      p_request_id,
      p_surface,
      credit_cost,
      p_provider,
      p_model,
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning *
  )
  select inserted_event.id,
         inserted_event.owner_id,
         inserted_event.request_id,
         inserted_event.surface,
         inserted_event.credits_charged,
         current_balance,
         inserted_event.status
  into event_id,
       owner_id,
       request_id,
       surface,
       credits_charged,
       study_credit_balance,
       status
  from inserted_event;

  return next;
end;
$$;

create or replace function public.hosted_ai_finish_usage(
  p_owner_id uuid,
  p_request_id text,
  p_status text,
  p_provider_call_count integer default 1,
  p_error_code text default null,
  p_error_message text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  event_id uuid,
  owner_id uuid,
  request_id text,
  surface text,
  credits_charged integer,
  credits_refunded integer,
  study_credit_balance integer,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.hosted_ai_usage_events%rowtype;
  current_balance integer;
begin
  if p_status not in ('succeeded', 'failed') then
    raise exception 'invalid hosted AI usage status: %', p_status;
  end if;

  select *
  into event_row
  from public.hosted_ai_usage_events event
  where event.owner_id = p_owner_id
    and event.request_id = p_request_id
  for update;

  if not found then
    raise exception 'hosted AI usage event not found';
  end if;

  if event_row.status <> 'reserved' then
    select account.study_credit_balance
    into current_balance
    from public.hosted_ai_accounts account
    where account.owner_id = p_owner_id;

    event_id := event_row.id;
    owner_id := event_row.owner_id;
    request_id := event_row.request_id;
    surface := event_row.surface;
    credits_charged := event_row.credits_charged;
    credits_refunded := event_row.credits_refunded;
    study_credit_balance := current_balance;
    status := event_row.status;
    return next;
  end if;

  select account.study_credit_balance
  into current_balance
  from public.hosted_ai_accounts account
  where account.owner_id = p_owner_id;

  update public.hosted_ai_usage_events event
  set status = p_status,
      provider_call_count = greatest(coalesce(p_provider_call_count, 0), 0),
      credits_refunded = event.credits_refunded,
      error_code = p_error_code,
      error_message = p_error_message,
      metadata = event.metadata || coalesce(p_metadata, '{}'::jsonb),
      completed_at = coalesce(event.completed_at, now())
  where event.id = event_row.id
  returning event.id,
            event.owner_id,
            event.request_id,
            event.surface,
            event.credits_charged,
            event.credits_refunded,
            current_balance,
            event.status
  into event_id,
       owner_id,
       request_id,
       surface,
       credits_charged,
       credits_refunded,
       study_credit_balance,
       status;

  return next;
end;
$$;

create or replace function public.podcast_tts_reserve_monthly_usage(
  p_owner_id uuid,
  p_usage_month text,
  p_character_count integer,
  p_monthly_cap integer
)
returns table (
  owner_id uuid,
  usage_month text,
  characters_used integer,
  monthly_cap integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  if p_owner_id is null then
    raise exception 'owner_id is required';
  end if;

  if p_usage_month is null or p_usage_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'invalid podcast TTS usage month';
  end if;

  if p_character_count is null or p_character_count <= 0 then
    raise exception 'invalid podcast TTS character count';
  end if;

  if p_monthly_cap is null or p_monthly_cap <= 0 then
    raise exception 'invalid podcast TTS monthly cap';
  end if;

  insert into public.profiles (id)
  values (p_owner_id)
  on conflict (id) do nothing;

  insert into public.podcast_tts_monthly_usage (
    owner_id,
    usage_month,
    characters_used
  )
  values (
    p_owner_id,
    p_usage_month,
    0
  )
  on conflict on constraint podcast_tts_monthly_usage_pkey do nothing;

  select usage.characters_used
  into current_count
  from public.podcast_tts_monthly_usage usage
  where usage.owner_id = p_owner_id
    and usage.usage_month = p_usage_month
  for update;

  if current_count + p_character_count > p_monthly_cap then
    raise exception 'Monthly free podcast audio limit reached.';
  end if;

  update public.podcast_tts_monthly_usage usage
  set characters_used = usage.characters_used + p_character_count
  where usage.owner_id = p_owner_id
    and usage.usage_month = p_usage_month
  returning usage.owner_id,
            usage.usage_month,
            usage.characters_used,
            p_monthly_cap
  into owner_id,
       usage_month,
       characters_used,
       monthly_cap;

  return next;
end;
$$;

create or replace function public.podcast_audio_register(
  p_owner_id uuid,
  p_audio_path text,
  p_study_guide_id text default null,
  p_podcast_id text default null,
  p_keep_count integer default 5
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_owner_id is null then
    raise exception 'owner_id is required';
  end if;

  if p_audio_path is null or btrim(p_audio_path) = '' then
    raise exception 'audio_path is required';
  end if;

  if p_audio_path not like p_owner_id::text || '/%' then
    raise exception 'audio_path must be owned by owner_id';
  end if;

  insert into public.profiles (id)
  values (p_owner_id)
  on conflict (id) do nothing;

  insert into public.podcast_audio_objects (
    owner_id,
    audio_path,
    study_guide_id,
    podcast_id
  )
  values (
    p_owner_id,
    p_audio_path,
    nullif(btrim(coalesce(p_study_guide_id, '')), ''),
    nullif(btrim(coalesce(p_podcast_id, '')), '')
  )
  on conflict on constraint podcast_audio_objects_pkey do update
    set study_guide_id = excluded.study_guide_id,
        podcast_id = excluded.podcast_id,
        deleted_at = null,
        deleted_reason = null;

  with ranked as (
    select audio.owner_id,
           audio.audio_path,
           row_number() over (
             partition by audio.owner_id
             order by audio.created_at desc, audio.audio_path desc
           ) as retained_rank
    from public.podcast_audio_objects audio
    where audio.owner_id = p_owner_id
      and audio.deleted_at is null
  )
  update public.podcast_audio_objects audio
  set candidate_at = case
        when ranked.retained_rank > greatest(coalesce(p_keep_count, 5), 0)
        then coalesce(audio.candidate_at, now())
        else null
      end
  from ranked
  where audio.owner_id = ranked.owner_id
    and audio.audio_path = ranked.audio_path;
end;
$$;

create or replace function public.podcast_audio_mark_deleted(
  p_owner_id uuid,
  p_audio_path text,
  p_deleted_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_deleted_reason not in (
    'expired',
    'page-deleted',
    'study-guide-expired',
    'study-guide-deleted'
  ) then
    raise exception 'invalid podcast audio deletion reason';
  end if;

  update public.podcast_audio_objects audio
  set deleted_at = coalesce(audio.deleted_at, now()),
      deleted_reason = p_deleted_reason
  where audio.owner_id = p_owner_id
    and audio.audio_path = p_audio_path;
end;
$$;

create or replace function public.podcast_audio_refresh_retention_candidates(
  p_keep_count integer default 5
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with ranked as (
    select audio.owner_id,
           audio.audio_path,
           row_number() over (
             partition by audio.owner_id
             order by audio.created_at desc, audio.audio_path desc
           ) as retained_rank
    from public.podcast_audio_objects audio
    where audio.deleted_at is null
  )
  update public.podcast_audio_objects audio
  set candidate_at = case
        when ranked.retained_rank > greatest(coalesce(p_keep_count, 5), 0)
        then coalesce(audio.candidate_at, now())
        else null
      end
  from ranked
  where audio.owner_id = ranked.owner_id
    and audio.audio_path = ranked.audio_path;
end;
$$;

create or replace function public.study_guides_refresh_retention_candidates(
  p_keep_count integer default 50
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with ranked as (
    select guide.owner_id,
           guide.id,
           row_number() over (
             partition by guide.owner_id
             order by
               case when guide.pinned_at is not null then 0 else 1 end,
               coalesce(guide.pinned_at, guide.created_at) desc,
               guide.created_at desc,
               guide.id desc
           ) as retained_rank
    from public.user_study_guides guide
  )
  update public.user_study_guides guide
  set retention_candidate_at = case
        when ranked.retained_rank > greatest(coalesce(p_keep_count, 50), 0)
        then coalesce(guide.retention_candidate_at, now())
        else null
      end
  from ranked
  where guide.owner_id = ranked.owner_id
    and guide.id = ranked.id;
end;
$$;

create or replace function public.hosted_ai_create_credit_purchase(
  p_owner_id uuid,
  p_expected_credits integer,
  p_expected_amount integer,
  p_expected_currency text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  purchase_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_purchase public.hosted_ai_credit_purchases%rowtype;
begin
  if p_expected_credits <= 0 then
    raise exception 'expected credits must be positive';
  end if;

  if p_expected_amount <= 0 then
    raise exception 'expected amount must be positive';
  end if;

  perform 1
  from public.hosted_ai_get_or_create_account(p_owner_id);

  insert into public.hosted_ai_accounts (owner_id, study_credit_balance)
  values (p_owner_id, 0)
  on conflict on constraint hosted_ai_accounts_pkey do nothing;

  insert into public.hosted_ai_credit_purchases (
    owner_id,
    expected_credits,
    expected_amount,
    expected_currency,
    metadata
  )
  values (
    p_owner_id,
    p_expected_credits,
    p_expected_amount,
    lower(p_expected_currency),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into inserted_purchase;

  purchase_id := inserted_purchase.id;
  status := inserted_purchase.status;
  return next;
end;
$$;

create or replace function public.hosted_ai_attach_checkout_session(
  p_purchase_id uuid,
  p_owner_id uuid,
  p_stripe_checkout_session_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  purchase_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase public.hosted_ai_credit_purchases%rowtype;
begin
  select *
  into purchase
  from public.hosted_ai_credit_purchases
  where id = p_purchase_id
    and owner_id = p_owner_id
  for update;

  if not found then
    raise exception 'credit purchase not found';
  end if;

  if purchase.status not in ('pending', 'checkout_created') then
    raise exception 'credit purchase is not pending';
  end if;

  update public.hosted_ai_credit_purchases
  set status = 'checkout_created',
      stripe_checkout_session_id = p_stripe_checkout_session_id,
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
  where id = p_purchase_id
  returning * into purchase;

  purchase_id := purchase.id;
  status := purchase.status;
  return next;
end;
$$;

create or replace function public.hosted_ai_mark_credit_purchase_paid(
  p_purchase_id uuid,
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text,
  p_expected_credits integer,
  p_expected_amount integer,
  p_expected_currency text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  purchase_id uuid,
  status text,
  study_credit_balance integer,
  credited_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase public.hosted_ai_credit_purchases%rowtype;
  current_balance integer;
begin
  select *
  into purchase
  from public.hosted_ai_credit_purchases
  where id = p_purchase_id
  for update;

  if not found then
    raise exception 'credit purchase not found';
  end if;

  if purchase.expected_credits <> p_expected_credits
    or purchase.expected_amount <> p_expected_amount
    or purchase.expected_currency <> lower(p_expected_currency) then
    raise exception 'credit purchase expectation mismatch';
  end if;

  if purchase.stripe_checkout_session_id is not null
    and purchase.stripe_checkout_session_id <> p_stripe_checkout_session_id then
    raise exception 'checkout session mismatch';
  end if;

  if purchase.status = 'paid' then
    select account.study_credit_balance
    into current_balance
    from public.hosted_ai_accounts account
    where account.owner_id = purchase.owner_id;

    purchase_id := purchase.id;
    status := purchase.status;
    study_credit_balance := current_balance;
    credited_at := purchase.credited_at;
    return next;
    return;
  end if;

  if purchase.status not in ('pending', 'checkout_created') then
    raise exception 'credit purchase is not payable';
  end if;

  perform 1
  from public.hosted_ai_get_or_create_account(purchase.owner_id);

  insert into public.hosted_ai_accounts (owner_id, study_credit_balance)
  values (purchase.owner_id, 0)
  on conflict on constraint hosted_ai_accounts_pkey do nothing;

  update public.hosted_ai_accounts account
  set study_credit_balance = account.study_credit_balance + purchase.expected_credits
  where account.owner_id = purchase.owner_id
  returning account.study_credit_balance into current_balance;

  update public.hosted_ai_credit_purchases
  set status = 'paid',
      stripe_checkout_session_id = p_stripe_checkout_session_id,
      stripe_payment_intent_id = p_stripe_payment_intent_id,
      credited_at = coalesce(public.hosted_ai_credit_purchases.credited_at, now()),
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
  where id = purchase.id
  returning * into purchase;

  purchase_id := purchase.id;
  status := purchase.status;
  study_credit_balance := current_balance;
  credited_at := purchase.credited_at;
  return next;
end;
$$;

create or replace function public.hosted_ai_mark_credit_purchase_terminal(
  p_purchase_id uuid,
  p_stripe_checkout_session_id text,
  p_status text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  purchase_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  purchase public.hosted_ai_credit_purchases%rowtype;
begin
  if p_status not in ('failed', 'expired') then
    raise exception 'invalid terminal purchase status';
  end if;

  select *
  into purchase
  from public.hosted_ai_credit_purchases
  where id = p_purchase_id
  for update;

  if not found then
    raise exception 'credit purchase not found';
  end if;

  if purchase.status = 'paid' then
    purchase_id := purchase.id;
    status := purchase.status;
    return next;
    return;
  end if;

  update public.hosted_ai_credit_purchases
  set status = p_status,
      stripe_checkout_session_id = coalesce(stripe_checkout_session_id, p_stripe_checkout_session_id),
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
  where id = purchase.id
  returning * into purchase;

  purchase_id := purchase.id;
  status := purchase.status;
  return next;
end;
$$;

revoke all on function public.hosted_ai_credit_cost(text) from public;
revoke all on function public.hosted_ai_get_or_create_account(uuid) from public;
revoke all on function public.hosted_ai_mark_intro_seen(uuid) from public;
revoke all on function public.hosted_ai_begin_usage(uuid, text, text, text, text, jsonb) from public;
revoke all on function public.hosted_ai_finish_usage(uuid, text, text, integer, text, text, jsonb) from public;
revoke all on function public.podcast_tts_reserve_monthly_usage(uuid, text, integer, integer) from public;
revoke all on function public.podcast_audio_register(uuid, text, text, text, integer) from public;
revoke all on function public.podcast_audio_mark_deleted(uuid, text, text) from public;
revoke all on function public.podcast_audio_refresh_retention_candidates(integer) from public;
revoke all on function public.study_guides_refresh_retention_candidates(integer) from public;
revoke all on function public.hosted_ai_create_credit_purchase(uuid, integer, integer, text, jsonb) from public;
revoke all on function public.hosted_ai_attach_checkout_session(uuid, uuid, text, jsonb) from public;
revoke all on function public.hosted_ai_mark_credit_purchase_paid(uuid, text, text, integer, integer, text, jsonb) from public;
revoke all on function public.hosted_ai_mark_credit_purchase_terminal(uuid, text, text, jsonb) from public;

grant execute on function public.hosted_ai_credit_cost(text) to service_role;
grant execute on function public.hosted_ai_get_or_create_account(uuid) to service_role;
grant execute on function public.hosted_ai_mark_intro_seen(uuid) to service_role;
grant execute on function public.hosted_ai_begin_usage(uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.hosted_ai_finish_usage(uuid, text, text, integer, text, text, jsonb) to service_role;
grant execute on function public.podcast_tts_reserve_monthly_usage(uuid, text, integer, integer) to service_role;
grant execute on function public.podcast_audio_register(uuid, text, text, text, integer) to service_role;
grant execute on function public.podcast_audio_mark_deleted(uuid, text, text) to service_role;
grant execute on function public.podcast_audio_refresh_retention_candidates(integer) to service_role;
grant execute on function public.study_guides_refresh_retention_candidates(integer) to service_role;
grant execute on function public.hosted_ai_create_credit_purchase(uuid, integer, integer, text, jsonb) to service_role;
grant execute on function public.hosted_ai_attach_checkout_session(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.hosted_ai_mark_credit_purchase_paid(uuid, text, text, integer, integer, text, jsonb) to service_role;
grant execute on function public.hosted_ai_mark_credit_purchase_terminal(uuid, text, text, jsonb) to service_role;

-- Row level security
alter table public.profiles enable row level security;
alter table public.user_dashboards enable row level security;
alter table public.user_study_guides enable row level security;
alter table public.user_widgets enable row level security;
alter table public.user_widget_versions enable row level security;
alter table public.user_workspace_state enable row level security;
alter table public.hosted_ai_accounts enable row level security;
alter table public.hosted_ai_account_history enable row level security;
alter table public.account_onboarding_state enable row level security;
alter table public.hosted_ai_usage_events enable row level security;
alter table public.hosted_ai_credit_purchases enable row level security;
alter table public.podcast_tts_monthly_usage enable row level security;
alter table public.podcast_audio_objects enable row level security;

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

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
on public.profiles for delete
to authenticated
using (id = auth.uid());

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

drop policy if exists "user_study_guides_select_own" on public.user_study_guides;
create policy "user_study_guides_select_own"
on public.user_study_guides for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "account_onboarding_state_select_own" on public.account_onboarding_state;
create policy "account_onboarding_state_select_own"
on public.account_onboarding_state for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "user_study_guides_insert_own" on public.user_study_guides;
create policy "user_study_guides_insert_own"
on public.user_study_guides for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "user_study_guides_update_own" on public.user_study_guides;
create policy "user_study_guides_update_own"
on public.user_study_guides for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "user_study_guides_delete_own" on public.user_study_guides;
create policy "user_study_guides_delete_own"
on public.user_study_guides for delete
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

drop policy if exists "hosted_ai_accounts_select_own" on public.hosted_ai_accounts;
create policy "hosted_ai_accounts_select_own"
on public.hosted_ai_accounts for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "hosted_ai_usage_events_select_own" on public.hosted_ai_usage_events;
create policy "hosted_ai_usage_events_select_own"
on public.hosted_ai_usage_events for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "hosted_ai_credit_purchases_select_own" on public.hosted_ai_credit_purchases;
create policy "hosted_ai_credit_purchases_select_own"
on public.hosted_ai_credit_purchases for select
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
