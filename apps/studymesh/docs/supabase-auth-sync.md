# RabbitHole Supabase Auth + Cloud Sync Setup

This document supports the real-login/cloud-sync implementation. It covers the database setup owned by Supabase, plus the localStorage migration contract the app should follow.

## Supabase Project

1. Create a Supabase project on the free tier.
2. In Auth, enable email/password.
3. In Auth providers, enable Google OAuth if desired.
   - Also enable **Allow anonymous sign-ins** under Sign In/Up. The guest trial
     on `/try` depends on it. Verify the GoTrue version exposes the flag with
     `select is_anonymous from auth.users limit 1;`.
   - If **Confirm email** is on, upgrading a guest with
     `updateUser({ email, password })` sets the password immediately but leaves
     `is_anonymous` true until the emailed link is clicked. The guest's guides
     stay safe in the cloud meanwhile, and the grant lands through
     `on_auth_user_upgraded` or the app's `claim_guest_upgrade_grant()` call.
4. Configure redirect URLs:
   - Local: `http://localhost:3000/**`
   - Production: the deployed RabbitHole URL
   - Preview: Vercel preview wildcard, if used
5. Add browser-safe env vars to the app and deployment:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
6. Never expose the Supabase service role key in browser code.

## Database Install

Run `apps/studymesh/docs/supabase-auth-sync.sql` in the Supabase SQL editor.

If you already had these tables before the cascade constraints existed, run
`apps/studymesh/docs/supabase-repair-delete-cascade.sql` once. Deleting a user
from Supabase Auth should then remove their RabbitHole rows automatically.

The SQL creates:

- `profiles`: auth profile row for display name, email, avatar path, and app role.
- `user_dashboards`: per-user dashboard JSON.
- `user_widgets`: per-user custom widget JSON.
- `user_widget_versions`: per-user widget snapshots.
- `user_workspace_state`: selected/open dashboards, study progress, and workspace settings.
- `hosted_ai_account_history`: auth-user-backed hosted credit history that survives RabbitHole profile deletion, so recreated profiles do not receive another first-login Carrots grant.
- `podcast_tts_monthly_usage`: per-user monthly podcast TTS character usage for the app-side Unreal Speech free-tier cap.
- `podcast_audio_objects`: private podcast MP3 lifecycle metadata. The latest 5
  podcast audio files per user are kept; older audio becomes a deletion
  candidate and can be removed after 30 days while the transcript page remains.
- `user_study_guides.pinned_at` and `retention_candidate_at`: Study Guide
  retention metadata. The newest pinned guides are kept first, then newest
  unpinned guides, up to 50 total per user.
- `guest_allowances`: the 3-Quick-Guide trial for anonymous sign-in users, keyed
  to `auth.users` so clearing browser storage cannot mint a fresh allowance.
  `upgraded_at` is the single latch that grants the welcome Carrots exactly once
  when a guest converts to a real account.
- `guest_ip_usage` and `guest_ip_owners`: per-network daily guest ceilings plus a
  `__global__` circuit-breaker row. Both are service-role only. The gateway
  stores an HMAC of the client address, never the address itself. Signed-in
  accounts are never IP limited.
- Owner indexes for sync reads.
- `on delete cascade` constraints from `auth.users` to `profiles`, and from `profiles` to app-owned rows, so deleting an auth user removes that user's profile, dashboards, widgets, widget versions, and workspace state.
- `on delete cascade` from `user_widgets` to `user_widget_versions`, so deleting a widget removes its version history.
- `updated_at` trigger.
- RLS policies that allow authenticated users to access only their own app rows.
  Podcast TTS monthly usage is service-role-managed through the hosted gateway.

Sharing is intentionally not implemented. `visibility` only accepts `private` in v1.

## Avatar Storage

Create a private Supabase Storage bucket named `avatars`.

Store avatar files under:

```text
avatars/{userId}/avatar.{ext}
```

Use the commented storage policies at the bottom of `supabase-auth-sync.sql` after the bucket exists. Those policies require the first folder segment to match `auth.uid()`.

## Podcast Audio Storage

Study Guide podcasts use server-side uploads and signed URLs. The SQL creates a
private Supabase Storage bucket named `study-guide-podcasts` with a 15 MB MP3
limit. The SQL also creates podcast TTS/accounting tables and RPCs so the app
enforces its own monthly TTS character cap before calling Unreal Speech and can
clean up old private MP3s without deleting the Study Guide transcript page.

Required server env vars:

- `UNREAL_SPEECH_API_KEY`
- `UNREAL_SPEECH_HOST_A_VOICE_ID` optional English/default Host A voice,
  defaults to `UNREAL_SPEECH_VOICE_ID` or `Sierra`
- `UNREAL_SPEECH_HOST_B_VOICE_ID` optional English/default Host B voice,
  defaults to `Daniel`
- `UNREAL_SPEECH_HOST_A_VOICE_ID_ES`, `UNREAL_SPEECH_HOST_B_VOICE_ID_ES`,
  and equivalent language suffixes optional per-language voice overrides
- `UNREAL_SPEECH_VOICE_ID` optional legacy Host A fallback
- `UNREAL_SPEECH_MODEL` optional
- `PODCAST_AUDIO_BUCKET` optional, defaults to `study-guide-podcasts`
- `PODCAST_TTS_MONTHLY_CHARACTER_CAP` optional, defaults to `225000`
- `CRON_SECRET` or `PODCAST_CLEANUP_SECRET` for `/api/podcast-audio-cleanup`
  daily cleanup auth

## Guest Trial

Logged-out visitors can create Quick Guides from `/try` without an account. The
app calls `signInAnonymously()` only when a visitor actually generates, so the
landing page itself never creates auth users.

Server env vars for `/api/hosted-ai`:

- `GUEST_TRIAL_ENABLED` optional kill switch, defaults to enabled
- `GUEST_IP_HASH_SECRET` HMAC secret for network hashing. Rotating it resets the
  per-network daily counters.
- `GUEST_STUDY_GUIDES_PER_IP_PER_DAY` optional, defaults to `12`
- `GUEST_ACCOUNTS_PER_IP_PER_DAY` optional, defaults to `5`
- `GUEST_STUDY_GUIDES_GLOBAL_PER_DAY` optional, defaults to `300`
- `GUEST_MAX_PROMPT_CHARS` optional, defaults to `4000`
- `GUEST_MAX_TIMEOUT_MS` optional, defaults to `60000`

Guests may only call `generateWithQuickStart` on the `study-guide` surface. The
allowance decrement lives in `hosted_ai_begin_usage`, which reads
`auth.users.is_anonymous` live, so a self-minted anonymous JWT cannot bypass it.

Rollback:

```sql
drop trigger if exists on_auth_user_upgraded on auth.users;
drop function if exists public.handle_guest_upgrade();
drop function if exists public.claim_guest_upgrade_grant();
drop function if exists public.grant_guest_upgrade_rewards(uuid, text);
drop function if exists public.guest_ip_reserve_study_guide(text, uuid, integer, integer, integer);
drop function if exists public.guest_get_allowance(uuid);
drop function if exists public.guest_purge_stale_accounts(integer, integer);
-- then restore the pre-guest public.handle_new_user() body
```

Vercel runs `/api/podcast-audio-cleanup` daily. It refreshes Study Guide
retention candidates first, deletes expired Study Guide candidates after 30
days, deletes any MP3s embedded in those guides, then recomputes podcast MP3
retention and deletes expired podcast-only candidates. To run it manually after
deploy:

```bash
curl -X GET "https://YOUR_DOMAIN/api/podcast-audio-cleanup" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

The same run then purges guests who never converted by calling
`guest_purge_stale_accounts`. It deletes anonymous `auth.users` rows older than
the retention window whose `guest_allowances.upgraded_at` is still null, so the
cascade takes their profile, guides, hosted AI account and allowance with them,
and prunes `guest_ip_usage` and `guest_ip_owners` rows past the same window.
This stage runs last and its failures are isolated, so a purge error never
discards the Study Guide or podcast counts from the stages before it. Optional
env vars: `GUEST_PURGE_BATCH_SIZE` (accounts per run, defaults to `200`) and
`GUEST_PURGE_RETENTION_DAYS` (defaults to `30`). Anonymous users count toward
Supabase MAU until they are purged, so keep an eye on the retention window.

## Local Storage Migration Contract

On first login, app should inspect current local-only RabbitHole data and offer migration to the signed-in account.

Known local keys:

- `customDashboards`
- `studymesh-storage`
- `studymesh_custom_widgets`
- `studymesh_widget_versions`
- Existing study progress keys from the workspace/progress modules

Recommended migration flow:

1. Detect local data after Supabase session is ready.
2. Show migration dialog when local data exists and cloud data is empty or differs.
3. Let user import local workspace to account or start empty.
4. Upsert widgets first, widget versions second, dashboards third, workspace state last.
5. Preserve local IDs when no matching cloud row exists.
6. If same ID exists and cloud `updated_at` is newer, create a local duplicate ID with suffix `-local-{timestamp}`.
7. Keep localStorage as cache after migration, but treat Supabase as source of truth while online.
8. Mark pending writes when offline or Supabase write fails; retry later.

## Sync Rules

- Route guards should require authenticated session before `/workspace`.
- Client writes should be optimistic: update local cache first, then upsert Supabase.
- Dashboards should sync referenced widgets before dashboard rows.
- Deleting a dashboard should hard-delete only the dashboard row. It must not delete referenced widgets, because widgets can be reused by multiple dashboards.
- Deleting a widget should hard-delete the widget row and its related `user_widget_versions` rows.
- Deleting the signed-in RabbitHole profile row should be allowed from the app and should cascade-delete that profile's RabbitHole rows.
- Recreating a RabbitHole profile for the same Supabase Auth user should start hosted Carrots at 0 if that profile was deleted before. First-time Auth users still get the normal initial Carrots grant.
- Hosted Carrots have a daily floor allowance: once per day, active accounts below 7 Carrots are restored up to 7. Failed hosted generations do not refund credits.
- Deleting an auth user should cascade-delete all RabbitHole rows owned by that user.
- Conflict default: last-write-wins by `updated_at`, except migration duplicates newer cloud conflicts as described above.
- User logout should clear in-memory workspace state. Local cache may remain, but should not hydrate into another account without session/user match.

## RLS Verification

After install, verify from Supabase SQL editor or app tests:

- Signed-in user can insert/select/update/delete own `user_dashboards`.
- Signed-in user can delete own `profiles` row.
- Signed-in user cannot read or mutate another user's rows.
- The Postgres `anon` role cannot read or write any sync table. Note that
  Supabase anonymous *sign-in* users are `authenticated`, so they pass the
  owner-scoped policies for their own rows by design.
- A guest can select only its own `guest_allowances` row, and neither
  `guest_ip_usage` nor `guest_ip_owners` from the client.
- `profiles` row is created on new auth user insert.
- Avatar object policies only allow paths beginning with the current user id.
