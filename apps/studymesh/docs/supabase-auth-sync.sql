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
  study_path jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

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
  study_credit_balance integer not null default 20,
  intro_seen boolean not null default false,
  last_daily_refill_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hosted_ai_accounts_nonnegative_balance_check
    check (study_credit_balance >= 0)
);

alter table public.hosted_ai_accounts
  alter column study_credit_balance set default 20;

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
    check (surface in ('study-guide', 'quick-create', 'chat')),
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

drop trigger if exists hosted_ai_usage_events_set_updated_at on public.hosted_ai_usage_events;
create trigger hosted_ai_usage_events_set_updated_at
before update on public.hosted_ai_usage_events
for each row execute function public.set_updated_at();

drop trigger if exists hosted_ai_credit_purchases_set_updated_at on public.hosted_ai_credit_purchases;
create trigger hosted_ai_credit_purchases_set_updated_at
before update on public.hosted_ai_credit_purchases
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

create index if not exists hosted_ai_usage_events_owner_created_idx
  on public.hosted_ai_usage_events(owner_id, created_at desc);

create index if not exists hosted_ai_usage_events_owner_status_idx
  on public.hosted_ai_usage_events(owner_id, status);

create index if not exists hosted_ai_credit_purchases_owner_created_idx
  on public.hosted_ai_credit_purchases(owner_id, created_at desc);

create index if not exists hosted_ai_credit_purchases_session_idx
  on public.hosted_ai_credit_purchases(stripe_checkout_session_id);

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

  insert into public.hosted_ai_accounts (owner_id)
  values (new.id)
  on conflict on constraint hosted_ai_accounts_pkey do nothing;

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

  delete from public.profiles
  where id = auth.uid();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_own_profile() from public;
grant execute on function public.delete_own_profile() to authenticated;

create or replace function public.hosted_ai_credit_cost(p_surface text)
returns integer
language sql
immutable
as $$
  select case p_surface
    when 'study-guide' then 2
    when 'quick-create' then 1
    when 'chat' then 1
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
  insert into public.hosted_ai_accounts (owner_id)
  values (p_owner_id)
  on conflict on constraint hosted_ai_accounts_pkey do nothing;

  update public.hosted_ai_accounts account
  set study_credit_balance = greatest(account.study_credit_balance, 5),
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
  refund_amount integer := 0;
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

  if event_row.status = 'reserved' and p_status = 'failed' then
    refund_amount := event_row.credits_charged - event_row.credits_refunded;
  end if;

  if refund_amount > 0 then
    update public.hosted_ai_accounts account
    set study_credit_balance = account.study_credit_balance + refund_amount
    where account.owner_id = p_owner_id
    returning account.study_credit_balance into current_balance;
  else
    select account.study_credit_balance
    into current_balance
    from public.hosted_ai_accounts account
    where account.owner_id = p_owner_id;
  end if;

  update public.hosted_ai_usage_events event
  set status = p_status,
      provider_call_count = greatest(coalesce(p_provider_call_count, 0), 0),
      credits_refunded = event.credits_refunded + refund_amount,
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

  insert into public.hosted_ai_accounts (owner_id)
  values (p_owner_id)
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

  insert into public.hosted_ai_accounts (owner_id)
  values (purchase.owner_id)
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
revoke all on function public.hosted_ai_create_credit_purchase(uuid, integer, integer, text, jsonb) from public;
revoke all on function public.hosted_ai_attach_checkout_session(uuid, uuid, text, jsonb) from public;
revoke all on function public.hosted_ai_mark_credit_purchase_paid(uuid, text, text, integer, integer, text, jsonb) from public;
revoke all on function public.hosted_ai_mark_credit_purchase_terminal(uuid, text, text, jsonb) from public;

grant execute on function public.hosted_ai_credit_cost(text) to service_role;
grant execute on function public.hosted_ai_get_or_create_account(uuid) to service_role;
grant execute on function public.hosted_ai_mark_intro_seen(uuid) to service_role;
grant execute on function public.hosted_ai_begin_usage(uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.hosted_ai_finish_usage(uuid, text, text, integer, text, text, jsonb) to service_role;
grant execute on function public.hosted_ai_create_credit_purchase(uuid, integer, integer, text, jsonb) to service_role;
grant execute on function public.hosted_ai_attach_checkout_session(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.hosted_ai_mark_credit_purchase_paid(uuid, text, text, integer, integer, text, jsonb) to service_role;
grant execute on function public.hosted_ai_mark_credit_purchase_terminal(uuid, text, text, jsonb) to service_role;

-- Private friends, messaging, presence, and Study Guide sharing.
create table if not exists public.social_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_path text,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_profiles_username_format_check
    check (username ~ '^[a-z0-9_]{3,24}$')
);

create unique index if not exists social_profiles_username_lower_idx
  on public.social_profiles(lower(username));

create table if not exists public.social_friend_invites (
  token uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.social_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.social_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.social_profiles(user_id) on delete cascade,
  addressee_id uuid not null references public.social_profiles(user_id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_friendships_not_self_check check (requester_id <> addressee_id),
  constraint social_friendships_status_check check (status in ('pending', 'accepted'))
);

create unique index if not exists social_friendships_pair_idx
  on public.social_friendships(
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create table if not exists public.social_blocks (
  blocker_id uuid not null references public.social_profiles(user_id) on delete cascade,
  blocked_id uuid not null references public.social_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint social_blocks_not_self_check check (blocker_id <> blocked_id)
);

create table if not exists public.social_direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.social_profiles(user_id) on delete cascade,
  recipient_id uuid not null references public.social_profiles(user_id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint social_direct_messages_body_check
    check (char_length(trim(body)) between 1 and 4000)
);

alter table public.user_study_guides
  add column if not exists shared_from_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists shared_from_guide_id text;

create table if not exists public.social_guide_shares (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.social_profiles(user_id) on delete cascade,
  recipient_id uuid not null references public.social_profiles(user_id) on delete cascade,
  source_guide_id text not null,
  title text not null,
  description text,
  emoji text,
  guide_snapshot jsonb not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint social_guide_shares_status_check
    check (status in ('pending', 'accepted', 'declined'))
);

create table if not exists public.social_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.social_profiles(user_id) on delete cascade,
  actor_id uuid references public.social_profiles(user_id) on delete cascade,
  type text not null,
  entity_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint social_notifications_type_check
    check (type in ('friend_request', 'friend_accepted', 'guide_shared'))
);

drop trigger if exists social_profiles_set_updated_at on public.social_profiles;
create trigger social_profiles_set_updated_at
before update on public.social_profiles
for each row execute function public.set_updated_at();

drop trigger if exists social_friendships_set_updated_at on public.social_friendships;
create trigger social_friendships_set_updated_at
before update on public.social_friendships
for each row execute function public.set_updated_at();

create index if not exists social_messages_recipient_created_idx
  on public.social_direct_messages(recipient_id, created_at desc);
create index if not exists social_messages_sender_created_idx
  on public.social_direct_messages(sender_id, created_at desc);
create index if not exists social_shares_recipient_status_idx
  on public.social_guide_shares(recipient_id, status, created_at desc);
create index if not exists social_notifications_owner_created_idx
  on public.social_notifications(owner_id, created_at desc);

create or replace function public.social_are_friends(p_first uuid, p_second uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.social_friendships
    where status = 'accepted'
      and ((requester_id = p_first and addressee_id = p_second)
        or (requester_id = p_second and addressee_id = p_first))
  ) and not exists (
    select 1 from public.social_blocks
    where (blocker_id = p_first and blocked_id = p_second)
       or (blocker_id = p_second and blocked_id = p_first)
  );
$$;

create or replace function public.social_upsert_profile(
  p_username text,
  p_display_name text,
  p_avatar_path text default null
)
returns public.social_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.social_profiles;
  normalized_username text := lower(trim(p_username));
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if normalized_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must use 3-24 lowercase letters, numbers, or underscores.';
  end if;
  if char_length(trim(p_display_name)) not between 1 and 60 then
    raise exception 'Display name must use 1-60 characters.';
  end if;

  insert into public.social_profiles(user_id, username, display_name, avatar_path, last_active_at)
  values (auth.uid(), normalized_username, trim(p_display_name), p_avatar_path, now())
  on conflict (user_id) do update set
    username = excluded.username,
    display_name = excluded.display_name,
    avatar_path = excluded.avatar_path,
    last_active_at = now()
  returning * into result;
  return result;
exception when unique_violation then
  raise exception 'That username is already taken.';
end;
$$;

create or replace function public.social_touch_presence()
returns void language sql security definer set search_path = public as $$
  update public.social_profiles set last_active_at = now() where user_id = auth.uid();
$$;

create or replace function public.social_find_exact_username(p_username text)
returns setof public.social_profiles
language sql
stable
security definer
set search_path = public
as $$
  select profile.* from public.social_profiles profile
  where lower(profile.username) = lower(trim(p_username))
    and profile.user_id <> auth.uid()
    and not exists (
      select 1 from public.social_blocks block
      where (block.blocker_id = auth.uid() and block.blocked_id = profile.user_id)
         or (block.blocker_id = profile.user_id and block.blocked_id = auth.uid())
    )
  limit 1;
$$;

create or replace function public.social_create_invite()
returns uuid language plpgsql security definer set search_path = public as $$
declare result uuid;
begin
  if not exists (select 1 from public.social_profiles where user_id = auth.uid()) then
    raise exception 'Create your Friends profile first.';
  end if;
  update public.social_friend_invites set revoked_at = now()
  where owner_id = auth.uid() and revoked_at is null;
  insert into public.social_friend_invites(owner_id) values (auth.uid())
  returning token into result;
  return result;
end;
$$;

create or replace function public.social_send_friend_request(p_addressee_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare friendship_id uuid;
begin
  if p_addressee_id = auth.uid() then raise exception 'You cannot add yourself.'; end if;
  if not exists (select 1 from public.social_profiles where user_id = auth.uid())
    or not exists (select 1 from public.social_profiles where user_id = p_addressee_id) then
    raise exception 'Friends profile not found.';
  end if;
  if exists (
    select 1 from public.social_blocks where
      (blocker_id = auth.uid() and blocked_id = p_addressee_id)
      or (blocker_id = p_addressee_id and blocked_id = auth.uid())
  ) then raise exception 'This friend request is unavailable.'; end if;

  insert into public.social_friendships(requester_id, addressee_id)
  values (auth.uid(), p_addressee_id)
  on conflict do nothing
  returning id into friendship_id;

  if friendship_id is not null then
    insert into public.social_notifications(owner_id, actor_id, type, entity_id)
    values (p_addressee_id, auth.uid(), 'friend_request', friendship_id);
  end if;
end;
$$;

create or replace function public.social_accept_invite(p_token uuid)
returns void language plpgsql security definer set search_path = public as $$
declare target_id uuid;
begin
  select owner_id into target_id from public.social_friend_invites
  where token = p_token and revoked_at is null;
  if target_id is null then raise exception 'Friend invite is invalid or expired.'; end if;
  perform public.social_send_friend_request(target_id);
end;
$$;

create or replace function public.social_respond_friend_request(p_friendship_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare requester uuid;
begin
  select requester_id into requester from public.social_friendships
  where id = p_friendship_id and addressee_id = auth.uid() and status = 'pending';
  if requester is null then raise exception 'Friend request not found.'; end if;
  delete from public.social_notifications where owner_id = auth.uid() and entity_id = p_friendship_id;
  if p_accept then
    update public.social_friendships set status = 'accepted' where id = p_friendship_id;
    insert into public.social_notifications(owner_id, actor_id, type, entity_id)
    values (requester, auth.uid(), 'friend_accepted', p_friendship_id);
  else
    delete from public.social_friendships where id = p_friendship_id;
  end if;
end;
$$;

create or replace function public.social_remove_friend(p_user_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.social_friendships where
    (requester_id = auth.uid() and addressee_id = p_user_id)
    or (requester_id = p_user_id and addressee_id = auth.uid());
$$;

create or replace function public.social_block_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user_id = auth.uid() then raise exception 'You cannot block yourself.'; end if;
  insert into public.social_blocks(blocker_id, blocked_id)
  values (auth.uid(), p_user_id) on conflict do nothing;
  delete from public.social_friendships where
    (requester_id = auth.uid() and addressee_id = p_user_id)
    or (requester_id = p_user_id and addressee_id = auth.uid());
  delete from public.social_guide_shares where status = 'pending' and
    ((sender_id = auth.uid() and recipient_id = p_user_id)
      or (sender_id = p_user_id and recipient_id = auth.uid()));
end;
$$;

create or replace function public.social_list_blocked()
returns setof public.social_profiles language sql stable security definer set search_path = public as $$
  select profile.* from public.social_profiles profile
  join public.social_blocks block on block.blocked_id = profile.user_id
  where block.blocker_id = auth.uid();
$$;

create or replace function public.social_send_message(p_recipient_id uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.social_are_friends(auth.uid(), p_recipient_id) then
    raise exception 'Messages are only available between friends.';
  end if;
  insert into public.social_direct_messages(sender_id, recipient_id, body)
  values (auth.uid(), p_recipient_id, trim(p_body));
end;
$$;

create or replace function public.social_list_messages(p_friend_id uuid)
returns setof public.social_direct_messages language sql stable security definer set search_path = public as $$
  select message.* from public.social_direct_messages message
  where public.social_are_friends(auth.uid(), p_friend_id)
    and ((message.sender_id = auth.uid() and message.recipient_id = p_friend_id)
      or (message.sender_id = p_friend_id and message.recipient_id = auth.uid()))
  order by message.created_at asc
  limit 500;
$$;

create or replace function public.social_mark_messages_read(p_friend_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.social_direct_messages set read_at = now()
  where recipient_id = auth.uid() and sender_id = p_friend_id and read_at is null;
$$;

create or replace function public.social_unread_message_count()
returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from public.social_direct_messages
  where recipient_id = auth.uid() and read_at is null;
$$;

create or replace function public.social_share_study_guide(p_recipient_id uuid, p_source_guide_id text)
returns void language plpgsql security definer set search_path = public as $$
declare source public.user_study_guides;
declare share_id uuid;
begin
  if not public.social_are_friends(auth.uid(), p_recipient_id) then
    raise exception 'Study Guides can only be shared with friends.';
  end if;
  select * into source from public.user_study_guides
  where owner_id = auth.uid() and id = p_source_guide_id;
  if source.id is null then raise exception 'Study Guide not found in cloud storage.'; end if;
  insert into public.social_guide_shares(
    sender_id, recipient_id, source_guide_id, title, description, guide_snapshot
  ) values (
    auth.uid(), p_recipient_id, source.id, source.title, source.description,
    jsonb_build_object(
      'id', source.id, 'title', source.title, 'folderName', source.folder_name,
      'description', source.description, 'studyPath', source.study_path,
      'createdAt', source.created_at, 'updatedAt', source.updated_at
    )
  ) returning id into share_id;
  insert into public.social_notifications(owner_id, actor_id, type, entity_id)
  values (p_recipient_id, auth.uid(), 'guide_shared', share_id);
end;
$$;

create or replace function public.social_respond_guide_share(p_share_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare share public.social_guide_shares;
declare new_id text := gen_random_uuid()::text;
begin
  select * into share from public.social_guide_shares
  where id = p_share_id and recipient_id = auth.uid() and status = 'pending';
  if share.id is null then raise exception 'Study Guide share not found.'; end if;
  if p_accept then
    insert into public.user_study_guides(
      id, owner_id, title, folder_name, description, study_path,
      shared_from_user_id, shared_from_guide_id
    ) values (
      new_id, auth.uid(), share.title,
      coalesce(share.guide_snapshot->>'folderName', share.title),
      share.description,
      jsonb_set(share.guide_snapshot->'studyPath', '{pathId}', to_jsonb(new_id)),
      share.sender_id, share.source_guide_id
    );
  end if;
  update public.social_guide_shares set
    status = case when p_accept then 'accepted' else 'declined' end,
    responded_at = now()
  where id = p_share_id;
  delete from public.social_notifications where owner_id = auth.uid() and entity_id = p_share_id;
end;
$$;

create or replace function public.social_mark_notifications_read()
returns void language sql security definer set search_path = public as $$
  update public.social_notifications set read_at = now()
  where owner_id = auth.uid() and read_at is null;
$$;

revoke all on function public.social_are_friends(uuid, uuid) from public;
grant execute on function public.social_upsert_profile(text, text, text) to authenticated;
grant execute on function public.social_touch_presence() to authenticated;
grant execute on function public.social_find_exact_username(text) to authenticated;
grant execute on function public.social_create_invite() to authenticated;
grant execute on function public.social_accept_invite(uuid) to authenticated;
grant execute on function public.social_send_friend_request(uuid) to authenticated;
grant execute on function public.social_respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.social_remove_friend(uuid) to authenticated;
grant execute on function public.social_block_user(uuid) to authenticated;
grant execute on function public.social_list_blocked() to authenticated;
grant execute on function public.social_send_message(uuid, text) to authenticated;
grant execute on function public.social_list_messages(uuid) to authenticated;
grant execute on function public.social_mark_messages_read(uuid) to authenticated;
grant execute on function public.social_unread_message_count() to authenticated;
grant execute on function public.social_share_study_guide(uuid, text) to authenticated;
grant execute on function public.social_respond_guide_share(uuid, boolean) to authenticated;
grant execute on function public.social_mark_notifications_read() to authenticated;

-- Row level security
alter table public.profiles enable row level security;
alter table public.user_dashboards enable row level security;
alter table public.user_study_guides enable row level security;
alter table public.user_widgets enable row level security;
alter table public.user_widget_versions enable row level security;
alter table public.user_workspace_state enable row level security;
alter table public.hosted_ai_accounts enable row level security;
alter table public.hosted_ai_usage_events enable row level security;
alter table public.hosted_ai_credit_purchases enable row level security;
alter table public.social_profiles enable row level security;
alter table public.social_friend_invites enable row level security;
alter table public.social_friendships enable row level security;
alter table public.social_blocks enable row level security;
alter table public.social_direct_messages enable row level security;
alter table public.social_guide_shares enable row level security;
alter table public.social_notifications enable row level security;

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

drop policy if exists "social_profiles_select_related" on public.social_profiles;
create policy "social_profiles_select_related"
on public.social_profiles for select to authenticated
using (
  user_id = auth.uid()
  or public.social_are_friends(auth.uid(), user_id)
  or exists (
    select 1 from public.social_friendships friendship
    where (friendship.requester_id = auth.uid() and friendship.addressee_id = user_id)
       or (friendship.requester_id = user_id and friendship.addressee_id = auth.uid())
  )
  or exists (
    select 1 from public.social_guide_shares share
    where share.recipient_id = auth.uid() and share.sender_id = user_id
  )
  or exists (
    select 1 from public.social_notifications notification
    where notification.owner_id = auth.uid() and notification.actor_id = user_id
  )
);

drop policy if exists "social_friendships_select_participant" on public.social_friendships;
create policy "social_friendships_select_participant"
on public.social_friendships for select to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "social_blocks_select_own" on public.social_blocks;
create policy "social_blocks_select_own"
on public.social_blocks for select to authenticated using (blocker_id = auth.uid());
drop policy if exists "social_blocks_delete_own" on public.social_blocks;
create policy "social_blocks_delete_own"
on public.social_blocks for delete to authenticated using (blocker_id = auth.uid());

drop policy if exists "social_messages_select_participant" on public.social_direct_messages;
create policy "social_messages_select_participant"
on public.social_direct_messages for select to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "social_shares_select_participant" on public.social_guide_shares;
create policy "social_shares_select_participant"
on public.social_guide_shares for select to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "social_notifications_select_own" on public.social_notifications;
create policy "social_notifications_select_own"
on public.social_notifications for select to authenticated using (owner_id = auth.uid());

do $$
begin
  alter publication supabase_realtime add table
    public.social_friendships,
    public.social_direct_messages,
    public.social_guide_shares,
    public.social_notifications;
exception when duplicate_object then null;
end $$;

insert into storage.buckets(id, name, public)
values ('social-avatars', 'social-avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "social_avatars_insert_own" on storage.objects;
create policy "social_avatars_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'social-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "social_avatars_update_own" on storage.objects;
create policy "social_avatars_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'social-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'social-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "social_avatars_delete_own" on storage.objects;
create policy "social_avatars_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'social-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

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
