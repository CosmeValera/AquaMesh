-- Hosted Study Guide jobs
--
-- Gives a hosted generation an identity the server owns, so the browser stops
-- being the only thing that knows a guide is being made. Two problems it fixes:
--
--   1. A refresh or a closed tab used to re-run the generation and spend
--      Carrots again, because `creationQueue.ts` (localStorage) was the only
--      record of the job.
--   2. A generation whose tab went away was lost even though it had been paid
--      for and the server had finished it.
--
-- `client_job_id` is the creation queue's own job id, sent by the client. It is
-- unique **per user**, never globally, so the worst a guessed id can do is
-- attach a caller to a job they already own.
--
-- Apply this in the Supabase SQL editor.

create table if not exists public.hosted_study_guide_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Client-supplied idempotency key. Validated server-side for shape.
  client_job_id text not null check (
    char_length(client_job_id) between 1 and 128
    and client_job_id ~ '^[A-Za-z0-9_-]+$'
  ),
  status text not null default 'running' check (
    status in ('running', 'succeeded', 'failed')
  ),
  prompt text,
  -- The finished HostedAiGatewayResponse. Kept whole so the client turns it
  -- into a guide with exactly the same code path as a live generation.
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The idempotency guarantee. A second request with the same id conflicts here
-- instead of starting a second paid generation.
create unique index if not exists hosted_study_guide_jobs_owner_client_key
  on public.hosted_study_guide_jobs (user_id, client_job_id);

-- Used to find a caller's unfinished work, and to expire stale rows.
create index if not exists hosted_study_guide_jobs_owner_status_idx
  on public.hosted_study_guide_jobs (user_id, status, updated_at desc);

alter table public.hosted_study_guide_jobs enable row level security;

-- The gateway uses the service role key and bypasses RLS. This policy only
-- covers a client reading its own rows directly, and nothing may write.
drop policy if exists hosted_study_guide_jobs_select_own
  on public.hosted_study_guide_jobs;
create policy hosted_study_guide_jobs_select_own
  on public.hosted_study_guide_jobs
  for select
  using (auth.uid() = user_id);

create or replace function public.touch_hosted_study_guide_job()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hosted_study_guide_jobs_touch
  on public.hosted_study_guide_jobs;
create trigger hosted_study_guide_jobs_touch
  before update on public.hosted_study_guide_jobs
  for each row
  execute function public.touch_hosted_study_guide_job();

-- Retention. A finished `result` is a whole guide, so rows are not kept
-- forever: the client copies the guide into its own storage on collection.
-- Safe to run from a scheduled job, or by hand.
create or replace function public.prune_hosted_study_guide_jobs()
returns integer
language sql
as $$
  with removed as (
    delete from public.hosted_study_guide_jobs
    where updated_at < now() - interval '7 days'
    returning 1
  )
  select count(*)::integer from removed;
$$;
