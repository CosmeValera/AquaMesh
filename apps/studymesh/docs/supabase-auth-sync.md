# StudyMesh Supabase Auth + Cloud Sync Setup

This document supports the real-login/cloud-sync implementation. It covers the database setup owned by Supabase, plus the localStorage migration contract the app should follow.

## Supabase Project

1. Create a Supabase project on the free tier.
2. In Auth, enable email/password.
3. In Auth providers, enable Google OAuth if desired.
4. Configure redirect URLs:
   - Local: `http://localhost:3000/**`
   - Production: the deployed StudyMesh URL
   - Preview: Vercel preview wildcard, if used
5. Add browser-safe env vars to the app and deployment:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
6. Never expose the Supabase service role key in browser code.

## Database Install

Run `apps/StudyMesh/docs/supabase-auth-sync.sql` in the Supabase SQL editor.

If you already had these tables before the cascade constraints existed, run
`apps/StudyMesh/docs/supabase-repair-delete-cascade.sql` once. Deleting a user
from Supabase Auth should then remove their StudyMesh rows automatically.

The SQL creates:

- `profiles`: auth profile row for display name, email, avatar path, and app role.
- `user_dashboards`: per-user dashboard JSON.
- `user_widgets`: per-user custom widget JSON.
- `user_widget_versions`: per-user widget snapshots.
- `user_workspace_state`: selected/open dashboards, study progress, and workspace settings.
- Owner indexes for sync reads.
- `on delete cascade` constraints from `auth.users` to `profiles`, and from `profiles` to app-owned rows, so deleting an auth user removes that user's profile, dashboards, widgets, widget versions, and workspace state.
- `on delete cascade` from `user_widgets` to `user_widget_versions`, so deleting a widget removes its version history.
- `updated_at` trigger.
- RLS policies that allow authenticated users to access only their own rows.

Sharing is intentionally not implemented. `visibility` only accepts `private` in v1.

## Avatar Storage

Create a private Supabase Storage bucket named `avatars`.

Store avatar files under:

```text
avatars/{userId}/avatar.{ext}
```

Use the commented storage policies at the bottom of `supabase-auth-sync.sql` after the bucket exists. Those policies require the first folder segment to match `auth.uid()`.

## Local Storage Migration Contract

On first login, app should inspect current local-only StudyMesh data and offer migration to the signed-in account.

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
- Deleting the signed-in StudyMesh profile row should be allowed from the app and should cascade-delete that profile's StudyMesh rows.
- Deleting an auth user should cascade-delete all StudyMesh rows owned by that user.
- Conflict default: last-write-wins by `updated_at`, except migration duplicates newer cloud conflicts as described above.
- User logout should clear in-memory workspace state. Local cache may remain, but should not hydrate into another account without session/user match.

## RLS Verification

After install, verify from Supabase SQL editor or app tests:

- Signed-in user can insert/select/update/delete own `user_dashboards`.
- Signed-in user can delete own `profiles` row.
- Signed-in user cannot read or mutate another user's rows.
- Anonymous user cannot read or write any sync table.
- `profiles` row is created on new auth user insert.
- Avatar object policies only allow paths beginning with the current user id.
