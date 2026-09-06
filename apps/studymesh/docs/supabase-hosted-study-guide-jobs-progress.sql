-- Hosted Study Guide jobs: live progress
--
-- Follow-up to supabase-hosted-study-guide-jobs.sql, which must be applied first.
--
-- Without this column a learner who refreshes mid-generation gets a card with an
-- empty checklist and a 0% bar, because the only thing the gateway could tell
-- them was "still running". The generation records what it has finished so far
-- here, so any later page life can re-attach and show the real thing.
--
-- The snapshot is small and overwritten in place (title, emoji, key idea, bridge
-- topics, page titles and which are done, current stage). It is display state,
-- never a source of truth: the finished guide still comes from `result`.
--
-- Apply this in the Supabase SQL editor.

alter table public.hosted_study_guide_jobs
  add column if not exists progress jsonb;

comment on column public.hosted_study_guide_jobs.progress is
  'Checklist snapshot for a generation in flight, so a refreshed tab can re-attach. Display only.';
