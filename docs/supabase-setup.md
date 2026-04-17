# Supabase Setup

This app uses two Supabase projects: one for local development and one for production.

## 1. Create Projects

1. In Supabase, create or choose a **dev** project.
2. Create or choose a separate **prod** project.
3. Keep both project dashboards open while configuring them.

## 2. Run Database Migration

Repeat these steps in both dev and prod:

1. Open **SQL Editor**.
2. Copy the contents of `supabase/migrations/20260416000000_build_sharing.sql`.
3. Run the script.
4. Confirm these tables, views, and functions exist:
   - `profiles`
   - `builds`
   - `build_votes`
   - `public_builds_with_stats`
   - `toggle_build_vote`

## 3. Enable Auth Provider

Repeat in both Supabase projects.

### Email Magic Link

1. Go to **Authentication > Providers > Email**.
2. Enable Email provider.
3. Keep email confirmation enabled unless you intentionally want unverified email accounts.
4. The app uses Supabase `signInWithOtp()`, which sends the magic-link email automatically when the Email provider is enabled.

## 4. Configure Redirect URLs

Repeat in both projects under **Authentication > URL Configuration**.

Dev project:

1. Add `http://localhost:4200`.
2. Add `http://localhost:4200/**`.

Prod project:

1. Add your production site URL, for example `https://your-domain.example`.
2. Add `https://your-domain.example/**`.
3. Add preview/staging URLs if you use them.

## 5. Configure App Environment

Dev values go in `src/environments/environment.ts`:

```ts
supabase: {
  url: 'https://YOUR_DEV_PROJECT.supabase.co',
  anonKey: 'YOUR_DEV_SUPABASE_ANON_KEY',
}
```

Prod values go in `src/environments/environment.prod.ts` or your deployment-time replacement:

```ts
supabase: {
  url: 'https://YOUR_PROD_PROJECT.supabase.co',
  anonKey: 'YOUR_PROD_SUPABASE_ANON_KEY',
}
```

Never put a service-role key in the frontend.

## 6. Manual Verification

1. Start the app locally with `npm.cmd run dev`.
2. Sign in with an email magic link.
3. Set a display name in the account dialog.
4. Optionally add profile social links. These links are only shown on public builds when that build has **Include profile socials** enabled.
5. Save a private build on **My Builds**.
6. Publish it.
7. Open **Public Builds** while signed out and confirm it is visible.
8. Sign in as another user and like the build.
9. Import the public build and confirm the local planner updates.
